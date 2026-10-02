"""
CuraFlow Synthetic Hospital Generator (Phase 3)
Generates a realistic, evolving synthetic hospital with:
  - 120 beds (incl. 20 ICU), 8 OT rooms, 2 CT + 1 MRI
  - 65 doctors, 180 nurses
  - 30 ER capacity
  - Live patient flow simulation

Run: python3 synthetic_hospital.py
"""

import json
import math
import random
import time
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta, timezone
from typing import Optional

NOW = lambda: datetime.now(timezone.utc)

# ── Seeded RNG for reproducibility ───────────────────────────────────────────
rng = random.Random(42)

# ── Configuration ─────────────────────────────────────────────────────────────

HOSPITAL_CFG = {
    "total_beds": 120,
    "icu_beds": 20,
    "ot_rooms": 8,
    "ct_scanners": 2,
    "mri_machines": 1,
    "xray_units": 4,
    "ultrasound_units": 3,
    "er_capacity": 30,
    "doctors": 65,
    "nurses": 180,
    "ward_boys": 30,
    "wards": [
        {"name": "General Ward A",   "code": "GWA", "beds": 20, "icu": False, "specialty": "general"},
        {"name": "General Ward B",   "code": "GWB", "beds": 20, "icu": False, "specialty": "general"},
        {"name": "Respiratory Ward", "code": "RW",  "beds": 15, "icu": False, "specialty": "respiratory"},
        {"name": "Cardiac Ward",     "code": "CW",  "beds": 15, "icu": False, "specialty": "cardiac"},
        {"name": "Surgical Ward",    "code": "SW",  "beds": 10, "icu": False, "specialty": "surgical"},
        {"name": "Orthopedics",      "code": "OW",  "beds": 10, "icu": False, "specialty": "orthopedics"},
        {"name": "Pediatrics",       "code": "PW",  "beds": 10, "icu": False, "specialty": "pediatrics"},
        {"name": "ICU",              "code": "ICU", "beds": 20, "icu": True,  "specialty": "critical_care"},
    ],
    "ot_specialties": ["general_surgery", "cardiac_surgery", "orthopedics", "neurosurgery",
                        "gynecology", "urology", "ophthalmology", "plastic_surgery"],
}

CONDITION_CATEGORIES = [
    "respiratory", "cardiac", "trauma", "surgical", "neurological",
    "gastrointestinal", "renal", "infectious", "orthopedic", "pediatric",
]

BED_STATES = ["available", "occupied", "cleaning", "maintenance", "reserved", "blocked", "isolation"]


# ── Data classes ──────────────────────────────────────────────────────────────

@dataclass
class SyntheticBed:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    ward_code: str = ""
    ward_name: str = ""
    bed_number: str = ""
    specialty: str = "general"
    is_icu: bool = False
    status: str = "available"
    patient_token: Optional[str] = None
    admission_id: Optional[str] = None
    reserved_until: Optional[str] = None
    last_status_change: str = field(default_factory=lambda: NOW().isoformat())
    ventilation: bool = False
    isolation: bool = False
    features: list = field(default_factory=list)


@dataclass
class SyntheticStaff:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    employee_code: str = ""
    name_token: str = ""
    display_name: str = ""
    role: str = "nurse"
    department: str = "general"
    status: str = "active"
    shift_start: Optional[str] = None
    shift_end: Optional[str] = None
    current_workload: int = 0
    max_workload: int = 4
    skills: list = field(default_factory=list)


@dataclass
class SyntheticPatient:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    patient_token: str = field(default_factory=lambda: f"SYN-{uuid.uuid4().hex[:8].upper()}")
    age_group: str = "adult"
    acuity_level: str = "moderate"
    condition_category: str = "general"
    admission_id: Optional[str] = None
    bed_id: Optional[str] = None
    admitted_at: Optional[str] = None
    expected_discharge_at: Optional[str] = None


@dataclass
class SyntheticOTRoom:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    room_code: str = ""
    name: str = ""
    specialty: str = "general_surgery"
    status: str = "available"
    emergency_capable: bool = False
    current_case_start: Optional[str] = None
    current_case_end: Optional[str] = None
    current_patient_token: Optional[str] = None


@dataclass
class SyntheticDevice:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    device_code: str = ""
    device_name: str = ""
    device_type: str = "ct_scanner"
    status: str = "available"
    queue_length: int = 0
    capacity_per_hour: int = 3
    emergency_capable: bool = True


@dataclass
class HospitalSnapshot:
    timestamp: str = field(default_factory=lambda: NOW().isoformat())
    total_beds: int = 0
    occupied_beds: int = 0
    available_beds: int = 0
    blocked_beds: int = 0
    cleaning_beds: int = 0
    reserved_beds: int = 0
    total_icu_beds: int = 0
    occupied_icu_beds: int = 0
    available_icu_beds: int = 0
    total_staff: int = 0
    available_staff: int = 0
    on_duty_staff: int = 0
    staff_utilization_pct: float = 0.0
    total_ot_rooms: int = 0
    available_ot_rooms: int = 0
    occupied_ot_rooms: int = 0
    ot_utilization_pct: float = 0.0
    total_diagnostic_devices: int = 0
    available_diagnostic_devices: int = 0
    diagnostic_queue_length: int = 0
    er_waiting: int = 0
    er_capacity: int = 0
    er_demand_score: float = 0.0
    overall_pressure_score: float = 0.0
    icu_pressure_score: float = 0.0
    bed_pressure_score: float = 0.0
    staff_pressure_score: float = 0.0
    er_pressure_score: float = 0.0


# ── Generator ────────────────────────────────────────────────────────────────

class SyntheticHospital:
    """Generates and evolves a realistic synthetic hospital state."""

    def __init__(self, seed: int = 42):
        self.rng = random.Random(seed)
        self.beds: list[SyntheticBed] = []
        self.staff: list[SyntheticStaff] = []
        self.patients: list[SyntheticPatient] = []
        self.ot_rooms: list[SyntheticOTRoom] = []
        self.devices: list[SyntheticDevice] = []
        self.er_queue: list[dict] = []
        self._tick = 0
        self._generate()

    # ── Generation ────────────────────────────────────────────────────────────

    def _generate(self):
        self._gen_beds()
        self._gen_ot_rooms()
        self._gen_devices()
        self._gen_staff()
        self._gen_initial_patients()

    def _gen_beds(self):
        bed_counter = 1
        for ward in HOSPITAL_CFG["wards"]:
            for i in range(ward["beds"]):
                bed = SyntheticBed(
                    ward_code=ward["code"],
                    ward_name=ward["name"],
                    bed_number=f"{ward['code']}-{i+1:03d}",
                    specialty=ward["specialty"],
                    is_icu=ward["icu"],
                    ventilation=ward["icu"] and self.rng.random() < 0.7,
                    isolation=self.rng.random() < 0.15,
                )
                # Pre-fill ~75% occupancy to simulate a busy hospital
                if self.rng.random() < 0.75:
                    bed.status = "occupied"
                elif self.rng.random() < 0.1:
                    bed.status = "cleaning"
                elif self.rng.random() < 0.05:
                    bed.status = "maintenance"
                self.beds.append(bed)
                bed_counter += 1

    def _gen_ot_rooms(self):
        specialties = HOSPITAL_CFG["ot_specialties"]
        for i in range(HOSPITAL_CFG["ot_rooms"]):
            room = SyntheticOTRoom(
                room_code=f"OT-{i+1:02d}",
                name=f"Operating Theatre {i+1}",
                specialty=specialties[i % len(specialties)],
                emergency_capable=(i < 2),
                status=self.rng.choice(["available", "available", "occupied", "cleaning"])
            )
            self.ot_rooms.append(room)

    def _gen_devices(self):
        device_defs = (
            [("CT", "ct_scanner", 4, True)] * HOSPITAL_CFG["ct_scanners"] +
            [("MRI", "mri", 2, False)] * HOSPITAL_CFG["mri_machines"] +
            [("XR", "xray", 6, True)] * HOSPITAL_CFG["xray_units"] +
            [("US", "ultrasound", 5, False)] * HOSPITAL_CFG["ultrasound_units"]
        )
        for i, (prefix, dtype, cph, ec) in enumerate(device_defs):
            dev = SyntheticDevice(
                device_code=f"{prefix}-{i+1:02d}",
                device_name=f"{dtype.replace('_',' ').title()} Unit {i+1}",
                device_type=dtype,
                status=self.rng.choice(["available", "available", "in_use", "in_use", "maintenance"]),
                capacity_per_hour=cph,
                emergency_capable=ec,
                queue_length=self.rng.randint(0, 5)
            )
            self.devices.append(dev)

    def _gen_staff(self):
        role_counts = {
            "doctor": HOSPITAL_CFG["doctors"],
            "nurse": HOSPITAL_CFG["nurses"],
            "ward_boy": HOSPITAL_CFG["ward_boys"],
        }
        roles_max_workload = {"doctor": 6, "nurse": 4, "ward_boy": 8}
        skills_by_role = {
            "doctor": ["diagnosis", "procedures", "prescriptions"],
            "nurse": ["iv_access", "wound_care", "vitals_monitoring", "medication_administration"],
            "ward_boy": ["patient_transport", "bed_cleaning"],
        }
        n = 0
        for role, count in role_counts.items():
            for i in range(count):
                n += 1
                shift_offset_hours = self.rng.randint(0, 7)
                shift_start = NOW().replace(hour=shift_offset_hours, minute=0, second=0, microsecond=0)
                shift_end = shift_start + timedelta(hours=8)
                current_workload = self.rng.randint(0, roles_max_workload[role])
                staff = SyntheticStaff(
                    employee_code=f"EMP-{n:04d}",
                    name_token=f"STAFF-{role[0].upper()}{n:04d}",
                    display_name=f"{role.title()[:2]}. {chr(65+n%26)}.",
                    role=role,
                    department=self.rng.choice(HOSPITAL_CFG["wards"])["specialty"],
                    status=self.rng.choice(["active", "active", "active", "off_duty", "on_leave"]),
                    shift_start=shift_start.isoformat(),
                    shift_end=shift_end.isoformat(),
                    current_workload=current_workload,
                    max_workload=roles_max_workload[role],
                    skills=skills_by_role.get(role, []),
                )
                self.staff.append(staff)

    def _gen_initial_patients(self):
        occupied_beds = [b for b in self.beds if b.status == "occupied"]
        for bed in occupied_beds:
            patient = SyntheticPatient(
                age_group=self.rng.choice(["pediatric", "adult", "adult", "adult", "elderly"]),
                acuity_level=self.rng.choice(["low", "moderate", "moderate", "high", "critical"])
                    if bed.is_icu else self.rng.choice(["low", "moderate", "moderate", "high"]),
                condition_category=self.rng.choice(CONDITION_CATEGORIES),
                bed_id=bed.id,
                admitted_at=(NOW() - timedelta(hours=self.rng.randint(1, 72))).isoformat(),
                expected_discharge_at=(NOW() + timedelta(hours=self.rng.randint(4, 48))).isoformat(),
            )
            patient.admission_id = str(uuid.uuid4())
            bed.patient_token = patient.patient_token
            bed.admission_id = patient.admission_id
            self.patients.append(patient)

        # ER queue
        er_count = self.rng.randint(4, 14)
        for i in range(er_count):
            self.er_queue.append({
                "id": str(uuid.uuid4()),
                "patient_token": f"ER-{uuid.uuid4().hex[:6].upper()}",
                "arrived_at": (NOW() - timedelta(minutes=self.rng.randint(5, 120))).isoformat(),
                "acuity": self.rng.choice(["critical", "high", "moderate", "low"]),
                "status": self.rng.choice(["waiting", "triaged", "in_assessment"]),
            })

    # ── Snapshot ──────────────────────────────────────────────────────────────

    def snapshot(self) -> HospitalSnapshot:
        icu_beds  = [b for b in self.beds if b.is_icu]
        gen_beds  = [b for b in self.beds if not b.is_icu]
        all_beds  = self.beds

        total_icu = len(icu_beds)
        occ_icu   = sum(1 for b in icu_beds if b.status == "occupied")
        avail_icu = sum(1 for b in icu_beds if b.status == "available")

        total_beds   = len(all_beds)
        occ_beds     = sum(1 for b in all_beds if b.status == "occupied")
        avail_beds   = sum(1 for b in all_beds if b.status == "available")
        blocked      = sum(1 for b in all_beds if b.status in ("maintenance", "blocked"))
        cleaning     = sum(1 for b in all_beds if b.status == "cleaning")
        reserved     = sum(1 for b in all_beds if b.status == "reserved")

        on_duty      = [s for s in self.staff if s.status == "active"]
        avail_staff  = [s for s in on_duty if s.current_workload < s.max_workload]
        total_wl     = sum(s.current_workload for s in on_duty)
        max_wl       = sum(s.max_workload for s in on_duty)
        staff_util   = (total_wl / max_wl * 100) if max_wl else 0.0

        total_ot     = len(self.ot_rooms)
        avail_ot     = sum(1 for r in self.ot_rooms if r.status == "available")
        occ_ot       = sum(1 for r in self.ot_rooms if r.status == "occupied")
        ot_util      = (occ_ot / total_ot * 100) if total_ot else 0.0

        total_dev    = len(self.devices)
        avail_dev    = sum(1 for d in self.devices if d.status == "available")
        diag_q       = sum(d.queue_length for d in self.devices)

        er_waiting   = len([p for p in self.er_queue if p["status"] == "waiting"])

        # Pressure scores (0-100)
        icu_pressure  = min(100.0, (occ_icu / total_icu * 100)) if total_icu else 0.0
        bed_pressure  = min(100.0, ((occ_beds + reserved + blocked) / total_beds * 100)) if total_beds else 0.0
        staff_pressure = min(100.0, staff_util)
        er_pressure   = min(100.0, (er_waiting / max(HOSPITAL_CFG["er_capacity"], 1) * 100))
        overall       = (icu_pressure * 0.30 + bed_pressure * 0.25 +
                         staff_pressure * 0.25 + er_pressure * 0.20)

        return HospitalSnapshot(
            timestamp=NOW().isoformat(),
            total_beds=total_beds, occupied_beds=occ_beds, available_beds=avail_beds,
            blocked_beds=blocked, cleaning_beds=cleaning, reserved_beds=reserved,
            total_icu_beds=total_icu, occupied_icu_beds=occ_icu, available_icu_beds=avail_icu,
            total_staff=len(self.staff), available_staff=len(avail_staff), on_duty_staff=len(on_duty),
            staff_utilization_pct=round(staff_util, 2),
            total_ot_rooms=total_ot, available_ot_rooms=avail_ot, occupied_ot_rooms=occ_ot,
            ot_utilization_pct=round(ot_util, 2),
            total_diagnostic_devices=total_dev, available_diagnostic_devices=avail_dev,
            diagnostic_queue_length=diag_q,
            er_waiting=er_waiting, er_capacity=HOSPITAL_CFG["er_capacity"],
            er_demand_score=round(er_pressure, 2),
            overall_pressure_score=round(overall, 2),
            icu_pressure_score=round(icu_pressure, 2),
            bed_pressure_score=round(bed_pressure, 2),
            staff_pressure_score=round(staff_pressure, 2),
            er_pressure_score=round(er_pressure, 2),
        )

    # ── Tick (evolve over time) ───────────────────────────────────────────────

    def tick(self, surge: bool = False) -> list[dict]:
        """Advance hospital state by one tick. Returns list of events."""
        self._tick += 1
        events = []

        er_arrival_prob = 0.35 if not surge else 0.65
        if self.rng.random() < er_arrival_prob:
            patient_token = f"ER-{uuid.uuid4().hex[:6].upper()}"
            self.er_queue.append({
                "id": str(uuid.uuid4()),
                "patient_token": patient_token,
                "arrived_at": NOW().isoformat(),
                "acuity": self.rng.choice(["critical", "high", "moderate", "low", "low"]),
                "status": "waiting",
            })
            events.append({"event_type": "EMERGENCY_ARRIVAL", "resource_type": "er",
                           "patient_token": patient_token, "timestamp": NOW().isoformat()})

        # Random bed -> cleaning -> available cycle
        for bed in self.rng.sample(self.beds, min(3, len(self.beds))):
            if bed.status == "cleaning" and self.rng.random() < 0.4:
                bed.status = "available"
                bed.patient_token = None
                bed.admission_id = None
                bed.last_status_change = NOW().isoformat()
                events.append({"event_type": "BED_STATUS_CHANGED", "resource_type": "bed",
                               "resource_id": bed.id, "new_state": {"status": "available"},
                               "timestamp": NOW().isoformat()})

        # Discharge some patients
        eligible = [p for p in self.patients if p.expected_discharge_at and
                    p.expected_discharge_at < NOW().isoformat() and
                    p.bed_id is not None]
        for patient in self.rng.sample(eligible, min(2, len(eligible))):
            bed = next((b for b in self.beds if b.id == patient.bed_id), None)
            if bed:
                bed.status = "cleaning"
                bed.patient_token = None
                bed.admission_id = None
                bed.last_status_change = NOW().isoformat()
            patient.bed_id = None
            events.append({"event_type": "PATIENT_DISCHARGED", "resource_type": "patient",
                           "patient_token": patient.patient_token, "timestamp": NOW().isoformat()})

        # OT status flips
        for room in self.ot_rooms:
            if room.status == "occupied" and self.rng.random() < 0.15:
                room.status = "cleaning"
                room.current_patient_token = None
                events.append({"event_type": "OT_COMPLETED", "resource_type": "ot",
                               "resource_id": room.id, "timestamp": NOW().isoformat()})
            elif room.status == "available" and self.rng.random() < 0.20:
                room.status = "occupied"
                events.append({"event_type": "OT_STARTED", "resource_type": "ot",
                               "resource_id": room.id, "timestamp": NOW().isoformat()})
            elif room.status == "cleaning" and self.rng.random() < 0.5:
                room.status = "available"

        # Device failures
        for dev in self.devices:
            if dev.status == "available" and self.rng.random() < 0.02:
                dev.status = "maintenance"
                events.append({"event_type": "DEVICE_FAILED", "resource_type": "device",
                               "resource_id": dev.id, "timestamp": NOW().isoformat()})
            elif dev.status == "maintenance" and self.rng.random() < 0.1:
                dev.status = "available"
                events.append({"event_type": "DEVICE_AVAILABLE", "resource_type": "device",
                               "resource_id": dev.id, "timestamp": NOW().isoformat()})
            # Queue growth
            if dev.status == "in_use" or dev.status == "available":
                dev.queue_length = max(0, dev.queue_length + self.rng.randint(-1, 2))

        return events

    # ── Crisis scenario ───────────────────────────────────────────────────────

    def apply_crisis(self):
        """Simulate a hospital crisis: ER surge, CT failure, staff shortage."""
        # ER surge: add 8-12 arrivals at once
        for _ in range(self.rng.randint(8, 12)):
            self.er_queue.append({
                "id": str(uuid.uuid4()),
                "patient_token": f"ER-{uuid.uuid4().hex[:6].upper()}",
                "arrived_at": NOW().isoformat(),
                "acuity": self.rng.choice(["critical", "high", "high", "moderate"]),
                "status": "waiting",
            })

        # One CT scanner fails
        ct_devs = [d for d in self.devices if d.device_type == "ct_scanner"]
        if ct_devs:
            ct_devs[0].status = "maintenance"
            ct_devs[0].queue_length = 0

        # 20% staff go off duty
        active = [s for s in self.staff if s.status == "active"]
        for s in self.rng.sample(active, max(1, len(active) // 5)):
            s.status = "off_duty"

        # One OT overruns
        occupied_ot = [r for r in self.ot_rooms if r.status == "occupied"]
        if occupied_ot:
            occupied_ot[0].current_case_end = (NOW() + timedelta(hours=2)).isoformat()

    # ── Export ────────────────────────────────────────────────────────────────

    def export_json(self) -> dict:
        snap = self.snapshot()
        return {
            "generated_at": NOW().isoformat(),
            "hospital_config": HOSPITAL_CFG,
            "snapshot": asdict(snap),
            "beds": [asdict(b) for b in self.beds],
            "staff": [asdict(s) for s in self.staff],
            "patients": [asdict(p) for p in self.patients],
            "ot_rooms": [asdict(r) for r in self.ot_rooms],
            "devices": [asdict(d) for d in self.devices],
            "er_queue": self.er_queue,
        }


# ── Singleton for import ──────────────────────────────────────────────────────

_hospital_instance: Optional[SyntheticHospital] = None


def get_hospital(seed: int = 42) -> SyntheticHospital:
    global _hospital_instance
    if _hospital_instance is None:
        _hospital_instance = SyntheticHospital(seed=seed)
    return _hospital_instance


def reset_hospital(seed: int = 42) -> SyntheticHospital:
    global _hospital_instance
    _hospital_instance = SyntheticHospital(seed=seed)
    return _hospital_instance


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("CuraFlow Synthetic Hospital Generator")
    print("=" * 60)
    hospital = SyntheticHospital(seed=42)
    snap = hospital.snapshot()
    print(f"Generated at: {snap.timestamp}")
    print(f"Beds: {snap.occupied_beds}/{snap.total_beds} occupied  "
          f"({snap.available_beds} available, {snap.cleaning_beds} cleaning)")
    print(f"ICU: {snap.occupied_icu_beds}/{snap.total_icu_beds} occupied")
    print(f"Staff on duty: {snap.on_duty_staff} | Available: {snap.available_staff} | "
          f"Utilization: {snap.staff_utilization_pct:.1f}%")
    print(f"OT: {snap.occupied_ot_rooms}/{snap.total_ot_rooms} rooms in use "
          f"({snap.ot_utilization_pct:.1f}% utilization)")
    print(f"Diagnostics: {snap.available_diagnostic_devices}/{snap.total_diagnostic_devices} available | "
          f"Queue: {snap.diagnostic_queue_length}")
    print(f"ER: {snap.er_waiting} waiting / {snap.er_capacity} capacity")
    print("-" * 60)
    print(f"PRESSURE SCORES (0-100):")
    print(f"  Overall: {snap.overall_pressure_score:.1f}")
    print(f"  ICU: {snap.icu_pressure_score:.1f}")
    print(f"  Beds: {snap.bed_pressure_score:.1f}")
    print(f"  Staff: {snap.staff_pressure_score:.1f}")
    print(f"  ER: {snap.er_pressure_score:.1f}")

    print("\nRunning 5 ticks...")
    for i in range(5):
        events = hospital.tick()
        if events:
            print(f"  Tick {i+1}: {len(events)} events — {[e['event_type'] for e in events]}")

    print("\nApplying crisis scenario...")
    hospital.apply_crisis()
    crisis_snap = hospital.snapshot()
    print(f"  Post-crisis ER waiting: {crisis_snap.er_waiting}")
    print(f"  Post-crisis Overall pressure: {crisis_snap.overall_pressure_score:.1f}")
    print(f"  Post-crisis Staff utilization: {crisis_snap.staff_utilization_pct:.1f}%")

    # Save to file for inspection
    output = hospital.export_json()
    with open("/tmp/curaflow_hospital.json", "w") as f:
        json.dump(output, f, indent=2, default=str)
    print(f"\nFull snapshot saved to /tmp/curaflow_hospital.json")
