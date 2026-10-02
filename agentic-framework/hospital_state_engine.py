"""
CuraFlow Hospital State Engine (Phase 5)
Maintains a near-real-time snapshot of hospital operational state.
Driven by synthetic_hospital.py for prototype; designed to accept
real FHIR/Kafka events in production.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

NOW = lambda: datetime.now(timezone.utc)

# Import synthetic hospital (Phase 3)
try:
    from synthetic_hospital import get_hospital, SyntheticHospital
    _USE_SYNTHETIC = True
except ImportError:
    _USE_SYNTHETIC = False
    logger.warning("synthetic_hospital.py not found — state engine will return empty state")


class HospitalStateEngine:
    """
    Singleton engine that owns the authoritative hospital state.
    The frontend NEVER independently calculates hospital metrics —
    it reads from this engine via the API.
    """

    def __init__(self):
        self._hospital: Optional[SyntheticHospital] = None
        self._running = False
        self._tick_interval_seconds = 15   # evolve every 15 seconds
        self._crisis_mode = False
        self._listeners = []  # async callbacks for websocket broadcast

    async def start(self):
        """Initialize hospital and begin background tick loop."""
        if _USE_SYNTHETIC:
            self._hospital = get_hospital(seed=42)
            logger.info("HospitalStateEngine: synthetic hospital initialized — "
                        "%d beds, %d staff", 
                        len(self._hospital.beds), len(self._hospital.staff))
        self._running = True
        asyncio.create_task(self._tick_loop(), name="hospital-state-tick")
        logger.info("HospitalStateEngine: tick loop started (interval=%ds)", self._tick_interval_seconds)

    async def stop(self):
        self._running = False

    async def _tick_loop(self):
        while self._running:
            try:
                await asyncio.sleep(self._tick_interval_seconds)
                if self._hospital:
                    events = self._hospital.tick(surge=self._crisis_mode)
                    if events:
                        await self._broadcast_events(events)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("State engine tick error: %s", e)

    async def _broadcast_events(self, events: list[dict]):
        for cb in self._listeners:
            try:
                await cb(events)
            except Exception as e:
                logger.warning("State broadcast error: %s", e)

    def add_listener(self, callback):
        self._listeners.append(callback)

    def remove_listener(self, callback):
        self._listeners.discard(callback) if hasattr(self._listeners, 'discard') \
            else (self._listeners.remove(callback) if callback in self._listeners else None)

    # ── Public API ────────────────────────────────────────────────────────────

    def get_snapshot(self) -> dict:
        """Return the current hospital state snapshot."""
        if not self._hospital:
            return self._empty_snapshot()
        snap = self._hospital.snapshot()
        return {
            "timestamp": snap.timestamp,
            "is_synthetic": True,
            "crisis_mode": self._crisis_mode,
            "beds": {
                "total": snap.total_beds,
                "occupied": snap.occupied_beds,
                "available": snap.available_beds,
                "cleaning": snap.cleaning_beds,
                "blocked": snap.blocked_beds,
                "reserved": snap.reserved_beds,
                "occupancy_pct": round(snap.occupied_beds / max(snap.total_beds, 1) * 100, 1),
            },
            "icu": {
                "total": snap.total_icu_beds,
                "occupied": snap.occupied_icu_beds,
                "available": snap.available_icu_beds,
                "occupancy_pct": round(snap.occupied_icu_beds / max(snap.total_icu_beds, 1) * 100, 1),
            },
            "staff": {
                "total": snap.total_staff,
                "on_duty": snap.on_duty_staff,
                "available": snap.available_staff,
                "utilization_pct": snap.staff_utilization_pct,
            },
            "operating_rooms": {
                "total": snap.total_ot_rooms,
                "available": snap.available_ot_rooms,
                "occupied": snap.occupied_ot_rooms,
                "utilization_pct": snap.ot_utilization_pct,
            },
            "diagnostics": {
                "total_devices": snap.total_diagnostic_devices,
                "available_devices": snap.available_diagnostic_devices,
                "queue_length": snap.diagnostic_queue_length,
            },
            "emergency": {
                "waiting": snap.er_waiting,
                "capacity": snap.er_capacity,
                "demand_score": snap.er_demand_score,
                "queue": self._hospital.er_queue[:10] if self._hospital else [],
            },
            "pressure": {
                "overall": snap.overall_pressure_score,
                "icu": snap.icu_pressure_score,
                "beds": snap.bed_pressure_score,
                "staff": snap.staff_pressure_score,
                "emergency": snap.er_pressure_score,
                "label": self._pressure_label(snap.overall_pressure_score),
            },
        }

    def get_beds(self, ward: Optional[str] = None, status: Optional[str] = None) -> list[dict]:
        if not self._hospital:
            return []
        beds = self._hospital.beds
        if ward:
            beds = [b for b in beds if b.ward_code == ward]
        if status:
            beds = [b for b in beds if b.status == status]
        return [
            {
                "id": b.id,
                "ward_code": b.ward_code,
                "ward_name": b.ward_name,
                "bed_number": b.bed_number,
                "specialty": b.specialty,
                "is_icu": b.is_icu,
                "status": b.status,
                "patient_token": b.patient_token,
                "features": b.features,
                "ventilation": b.ventilation,
                "isolation": b.isolation,
                "last_status_change": b.last_status_change,
            }
            for b in beds
        ]

    def get_staff(self, role: Optional[str] = None, status: Optional[str] = None) -> list[dict]:
        if not self._hospital:
            return []
        staff = self._hospital.staff
        if role:
            staff = [s for s in staff if s.role == role]
        if status:
            staff = [s for s in staff if s.status == status]
        return [
            {
                "id": s.id,
                "employee_code": s.employee_code,
                "name_token": s.name_token,
                "display_name": s.display_name,
                "role": s.role,
                "department": s.department,
                "status": s.status,
                "shift_start": s.shift_start,
                "shift_end": s.shift_end,
                "current_workload": s.current_workload,
                "max_workload": s.max_workload,
                "utilization_pct": round(s.current_workload / max(s.max_workload, 1) * 100, 1),
                "skills": s.skills,
            }
            for s in staff
        ]

    def get_ot_rooms(self) -> list[dict]:
        if not self._hospital:
            return []
        return [
            {
                "id": r.id,
                "room_code": r.room_code,
                "name": r.name,
                "specialty": r.specialty,
                "status": r.status,
                "emergency_capable": r.emergency_capable,
                "current_patient_token": r.current_patient_token,
                "current_case_start": r.current_case_start,
                "current_case_end": r.current_case_end,
            }
            for r in self._hospital.ot_rooms
        ]

    def get_devices(self) -> list[dict]:
        if not self._hospital:
            return []
        return [
            {
                "id": d.id,
                "device_code": d.device_code,
                "device_name": d.device_name,
                "device_type": d.device_type,
                "status": d.status,
                "queue_length": d.queue_length,
                "capacity_per_hour": d.capacity_per_hour,
                "emergency_capable": d.emergency_capable,
            }
            for d in self._hospital.devices
        ]

    def trigger_crisis(self):
        """Trigger the hospital crisis scenario."""
        if self._hospital:
            self._hospital.apply_crisis()
            self._crisis_mode = True
            logger.warning("HospitalStateEngine: CRISIS MODE ACTIVATED")

    def resolve_crisis(self):
        """Restore hospital to pre-crisis state by reversing all mutations."""
        self._crisis_mode = False
        if self._hospital:
            self._hospital.resolve_crisis()
            logger.info("HospitalStateEngine: crisis resolved — state restored to baseline")
        else:
            logger.info("HospitalStateEngine: crisis flag cleared (no hospital object)")


    def update_bed_status(self, bed_id: str, new_status: str) -> bool:
        if not self._hospital:
            return False
        for bed in self._hospital.beds:
            if bed.id == bed_id:
                bed.status = new_status
                bed.last_status_change = NOW().isoformat()
                return True
        return False

    def _pressure_label(self, score: float) -> str:
        if score >= 85:
            return "CRITICAL"
        elif score >= 70:
            return "HIGH"
        elif score >= 50:
            return "ELEVATED"
        elif score >= 30:
            return "MODERATE"
        return "NORMAL"

    def _empty_snapshot(self) -> dict:
        return {
            "timestamp": NOW().isoformat(),
            "is_synthetic": False,
            "crisis_mode": False,
            "beds": {"total": 0, "occupied": 0, "available": 0},
            "icu": {"total": 0, "occupied": 0, "available": 0},
            "staff": {"total": 0, "on_duty": 0, "available": 0, "utilization_pct": 0},
            "operating_rooms": {"total": 0, "available": 0, "occupied": 0},
            "diagnostics": {"total_devices": 0, "available_devices": 0, "queue_length": 0},
            "emergency": {"waiting": 0, "capacity": 30},
            "pressure": {"overall": 0, "label": "UNKNOWN"},
        }


# ── Singleton ─────────────────────────────────────────────────────────────────
_state_engine: Optional[HospitalStateEngine] = None


def get_state_engine() -> HospitalStateEngine:
    global _state_engine
    if _state_engine is None:
        _state_engine = HospitalStateEngine()
    return _state_engine
