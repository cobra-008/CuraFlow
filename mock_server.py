"""
CuraFlow Mock API Server
Serves both the original Hospilot API endpoints AND the new CuraFlow
operational intelligence endpoints. Used for local development without
a full Docker/PostgreSQL setup.

Run: python3 mock_server.py
"""

import http.server
import json
import math
import random
import socketserver
import sys
import uuid
from datetime import datetime, timedelta, timezone

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
NOW = lambda: datetime.now(timezone.utc).isoformat()

# ── Synthetic state (imported from the real engine when available) ─────────────
try:
    sys.path.insert(0, "agentic-framework")
    from agentic_framework.synthetic_hospital import SyntheticHospital
    _hospital = SyntheticHospital(seed=42)
except Exception:
    try:
        from synthetic_hospital import SyntheticHospital
        _hospital = SyntheticHospital(seed=42)
    except Exception:
        _hospital = None

rng = random.Random(42)

# ── In-memory approval/audit stores ──────────────────────────────────────────
_approvals = {}
_audit_events = []
_sim_runs = {}
_crisis_active = False


def _snap():
    if _hospital:
        s = _hospital.snapshot()
        return {
            "timestamp": s.timestamp,
            "is_synthetic": True,
            "crisis_mode": _crisis_active,
            "beds": {
                "total": s.total_beds, "occupied": s.occupied_beds,
                "available": s.available_beds, "cleaning": s.cleaning_beds,
                "blocked": s.blocked_beds, "reserved": s.reserved_beds,
                "occupancy_pct": round(s.occupied_beds / max(s.total_beds, 1) * 100, 1),
            },
            "icu": {
                "total": s.total_icu_beds, "occupied": s.occupied_icu_beds,
                "available": s.available_icu_beds,
                "occupancy_pct": round(s.occupied_icu_beds / max(s.total_icu_beds, 1) * 100, 1),
            },
            "staff": {
                "total": s.total_staff, "on_duty": s.on_duty_staff,
                "available": s.available_staff,
                "utilization_pct": s.staff_utilization_pct,
            },
            "operating_rooms": {
                "total": s.total_ot_rooms, "available": s.available_ot_rooms,
                "occupied": s.occupied_ot_rooms, "utilization_pct": s.ot_utilization_pct,
            },
            "diagnostics": {
                "total_devices": s.total_diagnostic_devices,
                "available_devices": s.available_diagnostic_devices,
                "queue_length": s.diagnostic_queue_length,
            },
            "emergency": {
                "waiting": s.er_waiting, "capacity": 30,
                "demand_score": s.er_demand_score,
            },
            "pressure": {
                "overall": s.overall_pressure_score,
                "icu": s.icu_pressure_score,
                "beds": s.bed_pressure_score,
                "staff": s.staff_pressure_score,
                "emergency": s.er_pressure_score,
                "label": _pressure_label(s.overall_pressure_score),
            },
        }
    return {"timestamp": NOW(), "is_synthetic": True, "pressure": {"label": "UNKNOWN"}}


def _pressure_label(score):
    if score >= 85: return "CRITICAL"
    if score >= 70: return "HIGH"
    if score >= 50: return "ELEVATED"
    if score >= 30: return "MODERATE"
    return "NORMAL"


def _gen_recommendations():
    snap = _snap()
    recs = []
    templates = [
        {
            "id": str(uuid.uuid4()), "recommendation_number": 1,
            "rec_type": "resource_allocation", "priority": "critical",
            "title": "Reserve ICU capacity",
            "summary": "ICU occupancy at {icu_pct:.0f}% — reserve ICU-04 for high-acuity admission".format(
                icu_pct=snap["icu"]["occupancy_pct"]),
            "why_explanation": (
                "ICU occupancy is at {:.0f}% — above the 85% safe threshold. "
                "Respiratory demand predicted to increase within 45 minutes.".format(
                    snap["icu"]["occupancy_pct"])),
            "agent_id": "icu_agent",
            "confidence": 0.87,
            "requires_approval": True,
            "status": "pending",
            "created_at": NOW(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
            "constraints_satisfied": ["Respiratory capable", "Isolation capable",
                                      "Ventilator available", "No existing reservation"],
            "alternatives_rejected": [
                {"option": "ICU-07", "reason": "Equipment conflict — ventilator in maintenance"},
                {"option": "Defer 2 hours", "reason": "Predicted saturation in <1hr at current trend"},
            ],
            "counterfactual_scenario": {
                "label": "If rejected",
                "predicted_saturation_pct": min(100, snap["icu"]["occupancy_pct"] + 8),
                "expected_delay_minutes": 17,
                "alternative_description": "ICU-07 available with +12 min preparation",
            },
            "expected_impact": {
                "icu_occupancy_reduction_pct": 7.2,
                "wait_time_reduction_minutes": 17,
                "patients_benefited": 4,
            },
            "actions": [
                {"id": str(uuid.uuid4()), "action_order": 1, "action_type": "reserve_bed",
                 "action_description": "Reserve ICU-04 for high-acuity admission", "status": "pending"},
                {"id": str(uuid.uuid4()), "action_order": 2, "action_type": "staff_alert",
                 "action_description": "Alert ICU charge nurse of incoming pressure", "status": "pending"},
                {"id": str(uuid.uuid4()), "action_order": 3, "action_type": "review_stepdown",
                 "action_description": "Review step-down candidates in ICU", "status": "pending"},
            ],
            "_is_synthetic": True,
        },
        {
            "id": str(uuid.uuid4()), "recommendation_number": 2,
            "rec_type": "staff_rebalance", "priority": "high",
            "title": "Rebalance staff assignments",
            "summary": "Staff utilization at {util:.0f}% — reassign float nurses from Orthopedics to Respiratory".format(
                util=snap["staff"]["utilization_pct"]),
            "why_explanation": (
                "Staff utilization is at {:.0f}%. Float pool nurses available "
                "in Orthopedics (under-utilized) should be reallocated to Respiratory Ward.".format(
                    snap["staff"]["utilization_pct"])),
            "agent_id": "staff_agent",
            "confidence": 0.79,
            "requires_approval": True,
            "status": "pending",
            "created_at": NOW(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
            "constraints_satisfied": ["Staff qualifications verified", "Shift overlap confirmed",
                                       "Workload within limits"],
            "alternatives_rejected": [
                {"option": "Call in off-duty staff", "reason": "Minimum 2hr response time"},
            ],
            "counterfactual_scenario": {
                "label": "If rejected",
                "predicted_saturation_pct": min(100, snap["staff"]["utilization_pct"] + 6),
                "expected_delay_minutes": 10,
                "alternative_description": "Reduce patient intake by 15% for 1 shift",
            },
            "expected_impact": {
                "staff_utilization_reduction_pct": 5.8,
                "wait_time_reduction_minutes": 10,
                "patients_benefited": 6,
            },
            "actions": [
                {"id": str(uuid.uuid4()), "action_order": 1, "action_type": "reassign_staff",
                 "action_description": "Reassign 2 float nurses from Orthopedics to Respiratory Ward",
                 "status": "pending"},
                {"id": str(uuid.uuid4()), "action_order": 2, "action_type": "overtime_request",
                 "action_description": "Send optional overtime request to eligible staff",
                 "status": "pending"},
            ],
            "_is_synthetic": True,
        },
        {
            "id": str(uuid.uuid4()), "recommendation_number": 3,
            "rec_type": "resource_allocation", "priority": "medium",
            "title": "Redirect diagnostic workload",
            "summary": "Diagnostic queue at {q} orders — route non-urgent to CT-02".format(
                q=snap["diagnostics"]["queue_length"]),
            "why_explanation": (
                "Diagnostic queue has {} pending orders. CT-02 is available "
                "and can absorb non-urgent workload.".format(snap["diagnostics"]["queue_length"])),
            "agent_id": "lab_agent",
            "confidence": 0.73,
            "requires_approval": True,
            "status": "pending",
            "created_at": NOW(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
            "constraints_satisfied": ["Device compatible", "No emergency conflict"],
            "alternatives_rejected": [
                {"option": "MRI-01", "reason": "Different modality — not suitable for CT orders"},
            ],
            "counterfactual_scenario": {
                "label": "If rejected",
                "predicted_saturation_pct": min(100, snap["diagnostics"]["queue_length"] * 5),
                "expected_delay_minutes": 35,
                "alternative_description": "Manual triage adds ~45 min to non-urgent turnaround",
            },
            "expected_impact": {
                "queue_reduction_orders": 8,
                "wait_time_reduction_minutes": 35,
                "patients_benefited": 8,
            },
            "actions": [
                {"id": str(uuid.uuid4()), "action_order": 1, "action_type": "redirect_orders",
                 "action_description": "Route non-urgent orders to CT-02 (available now)",
                 "status": "pending"},
                {"id": str(uuid.uuid4()), "action_order": 2, "action_type": "expedite_stat",
                 "action_description": "Expedite 3 STAT orders ahead of queue",
                 "status": "pending"},
            ],
            "_is_synthetic": True,
        },
    ]
    return templates


def _json(obj, code=200):
    return code, json.dumps(obj)


class MockAPIHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # suppress request logs

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PATCH, PUT, DELETE')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def _read_body(self):
        length = int(self.headers.get('Content-Length', 0))
        if length:
            try:
                return json.loads(self.rfile.read(length))
            except Exception:
                return {}
        return {}

    def _send(self, code, body):
        data = body.encode() if isinstance(body, str) else json.dumps(body).encode()
        self.send_response(code)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        body = self._read_body()
        p = self.path.split('?')[0]

        # ── Auth ──────────────────────────────────────────────────────────────
        if p == '/api/auth/login':
            self._send(200, {
                "token": "mock-token",
                "user": {
                    "id": "00000000-0000-0000-0000-000000000000",
                    "username": body.get("username", "admin"),
                    "display_name": "Admin",
                    "role": "super_admin", "org_id": None, "org_name": "System"
                }
            })

        # ── Sessions ──────────────────────────────────────────────────────────
        elif p.startswith('/api/sessions'):
            session_id = str(uuid.uuid4())
            self._send(200, {
                "session_id": session_id, "status": "pending", "autonomous": False,
                "pipeline": {"understood_goal": "Mock goal", "priority": "normal", "agents": [], "edges": []}
            })

        # ── Crisis trigger ────────────────────────────────────────────────────
        elif p == '/api/ops/hospital-state/crisis':
            global _crisis_active
            _crisis_active = True
            if _hospital:
                _hospital.apply_crisis()
            self._send(200, {
                "status": "crisis_activated",
                "message": "SYNTHETIC: Hospital crisis scenario activated.",
                "snapshot": _snap(),
            })

        elif p == '/api/ops/hospital-state/resolve-crisis':
            _crisis_active = False
            self._send(200, {"status": "crisis_resolved"})

        # ── Approval decisions ────────────────────────────────────────────────
        elif '/decide' in p:
            parts = p.split('/')
            approval_id = parts[parts.index('approvals') + 1] if 'approvals' in parts else str(uuid.uuid4())
            decision = body.get("decision", "approve")
            status_map = {"approve": "approved", "modify": "modified", "reject": "rejected"}
            approval = {
                "id": approval_id, "recommendation_id": approval_id,
                "status": status_map.get(decision, "approved"),
                "decision": decision,
                "decision_reason": body.get("reason"),
                "responded_at": NOW(),
                "responded_by": body.get("actor_id", "user"),
            }
            _approvals[approval_id] = approval
            _audit_events.append({
                "id": str(uuid.uuid4()), "event_timestamp": NOW(),
                "actor_type": "human", "actor_id": body.get("actor_id", "user"),
                "event_type": f"recommendation_{decision}d",
                "resource_type": "recommendation", "resource_id": approval_id,
                "action": decision, "decision": decision,
                "reason": body.get("reason"),
                "correlation_id": str(uuid.uuid4()),
            })
            self._send(200, {
                "approval": approval,
                "message": f"Recommendation {decision}d successfully",
            })

        elif p.endswith('/request-approval'):
            rec_id = p.split('/')[-2]
            approval = {
                "id": rec_id, "recommendation_id": rec_id,
                "requested_by": "system", "status": "pending",
                "requested_at": NOW(),
                "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
            }
            _approvals[rec_id] = approval
            self._send(200, {"approval": approval})

        # ── Simulations ───────────────────────────────────────────────────────
        elif p == '/api/ops/simulations/run':
            scenario_type = body.get("scenario_type", "emergency_surge")
            run_id = str(uuid.uuid4())
            METRICS = {
                "emergency_surge": {
                    "without_curaflow": {
                        "patient_wait_time_minutes": 47, "bed_utilization_pct": 96,
                        "icu_utilization_pct": 98, "emergency_response_minutes": 22,
                        "ot_utilization_pct": 82, "diagnostic_turnaround_minutes": 55,
                        "staff_overtime_hours": 18, "bottleneck_duration_minutes": 95,
                    },
                    "with_curaflow": {
                        "patient_wait_time_minutes": 28, "bed_utilization_pct": 88,
                        "icu_utilization_pct": 89, "emergency_response_minutes": 14,
                        "ot_utilization_pct": 79, "diagnostic_turnaround_minutes": 38,
                        "staff_overtime_hours": 11, "bottleneck_duration_minutes": 42,
                    },
                },
            }
            metrics = METRICS.get(scenario_type, METRICS["emergency_surge"])
            result = {
                "run_id": run_id, "scenario_type": scenario_type,
                "status": "completed", "started_at": NOW(), "completed_at": NOW(),
                "metrics": metrics,
                "improvement_summary": {
                    "wait_time_reduction_pct": round(
                        (1 - metrics["with_curaflow"]["patient_wait_time_minutes"] /
                         metrics["without_curaflow"]["patient_wait_time_minutes"]) * 100, 1),
                    "bottleneck_duration_reduction_pct": round(
                        (1 - metrics["with_curaflow"]["bottleneck_duration_minutes"] /
                         metrics["without_curaflow"]["bottleneck_duration_minutes"]) * 100, 1),
                },
                "_note": "SYNTHETIC — prototype benchmark results, not clinical evidence",
            }
            _sim_runs[run_id] = result
            self._send(200, result)

        else:
            self._send(404, {"detail": "Not found"})

    def do_GET(self):
        p = self.path.split('?')[0]

        # ── Auth ──────────────────────────────────────────────────────────────
        if p == '/api/auth/me':
            self._send(200, {
                "id": "00000000-0000-0000-0000-000000000000",
                "username": "admin", "display_name": "Admin",
                "role": "super_admin", "org_id": None, "org_name": "System"
            })
        elif p == '/api/orgs/public':
            self._send(200, {"organizations": []})

        # ── Original routes ───────────────────────────────────────────────────
        elif p in ('/api/sessions', '/api/sessions?limit=50'):
            self._send(200, {"sessions": []})
        elif p == '/api/queues/paused':
            self._send(200, {"paused": 0, "flows": []})
        elif p == '/api/approvals/pending':
            self._send(200, {"approvals": []})
        elif p == '/api/agents/registry':
            self._send(200, [])

        # ── CuraFlow: Hospital State ──────────────────────────────────────────
        elif p == '/api/ops/hospital-state':
            self._send(200, _snap())

        elif p == '/api/ops/beds':
            beds = []
            if _hospital:
                for b in _hospital.beds:
                    beds.append({
                        "id": b.id, "ward_code": b.ward_code, "ward_name": b.ward_name,
                        "bed_number": b.bed_number, "specialty": b.specialty,
                        "is_icu": b.is_icu, "status": b.status,
                        "patient_token": b.patient_token,
                        "ventilation": b.ventilation, "isolation": b.isolation,
                        "last_status_change": b.last_status_change,
                    })
            self._send(200, {"beds": beds})

        elif p == '/api/ops/staff':
            staff = []
            if _hospital:
                for s in _hospital.staff:
                    staff.append({
                        "id": s.id, "employee_code": s.employee_code,
                        "name_token": s.name_token, "display_name": s.display_name,
                        "role": s.role, "department": s.department, "status": s.status,
                        "shift_start": s.shift_start, "shift_end": s.shift_end,
                        "current_workload": s.current_workload, "max_workload": s.max_workload,
                        "utilization_pct": round(s.current_workload / max(s.max_workload, 1) * 100, 1),
                    })
            self._send(200, {"staff": staff})

        elif p == '/api/ops/operating-rooms':
            rooms = []
            if _hospital:
                for r in _hospital.ot_rooms:
                    rooms.append({
                        "id": r.id, "room_code": r.room_code, "name": r.name,
                        "specialty": r.specialty, "status": r.status,
                        "emergency_capable": r.emergency_capable,
                    })
            self._send(200, {"operating_rooms": rooms})

        elif p == '/api/ops/diagnostics':
            devices = []
            if _hospital:
                for d in _hospital.devices:
                    devices.append({
                        "id": d.id, "device_code": d.device_code, "device_name": d.device_name,
                        "device_type": d.device_type, "status": d.status,
                        "queue_length": d.queue_length, "capacity_per_hour": d.capacity_per_hour,
                        "emergency_capable": d.emergency_capable,
                    })
            self._send(200, {"devices": devices})

        # ── CuraFlow: Intelligence ────────────────────────────────────────────
        elif p == '/api/ops/predictions':
            snap = _snap()
            preds = []
            for ptype in ["icu_demand", "bed_occupancy", "er_arrivals", "discharges"]:
                for i, h in enumerate([1, 4, 8]):
                    preds.append({
                        "id": str(uuid.uuid4()),
                        "prediction_type": ptype,
                        "forecast_start": (datetime.now(timezone.utc) + timedelta(hours=h)).isoformat(),
                        "forecast_end": (datetime.now(timezone.utc) + timedelta(hours=h+1)).isoformat(),
                        "predicted_value": round(rng.uniform(60, 95), 1),
                        "lower_bound": round(rng.uniform(55, 65), 1),
                        "upper_bound": round(rng.uniform(90, 100), 1),
                        "confidence": round(rng.uniform(0.65, 0.88), 2),
                        "model_name": f"{ptype}_baseline",
                        "is_synthetic": True,
                    })
            self._send(200, {"predictions": preds,
                             "_note": "SYNTHETIC — not clinically validated"})

        elif p == '/api/ops/bottlenecks':
            snap = _snap()
            bns = []
            rules = [
                ("icu_saturation", "icu", snap["icu"]["occupancy_pct"], 85.0),
                ("bed_shortage", "beds", snap["beds"]["occupancy_pct"], 88.0),
                ("er_queue_growth", "er",
                 snap["emergency"]["waiting"] / max(snap["emergency"]["capacity"], 1) * 100, 50.0),
            ]
            for btype, rtype, value, threshold in rules:
                if value >= threshold:
                    sev = "critical" if value >= 95 else "high" if value >= 90 else "moderate"
                    bns.append({
                        "id": str(uuid.uuid4()),
                        "bottleneck_type": btype, "resource_type": rtype,
                        "severity": sev, "detected_at": NOW(),
                        "current_value": round(value, 2),
                        "threshold_value": threshold,
                        "confidence": 0.90, "status": "active",
                    })
            self._send(200, {"bottlenecks": bns, "count": len(bns),
                             "critical_count": sum(1 for b in bns if b["severity"] == "critical"),
                             "high_count": sum(1 for b in bns if b["severity"] == "high")})

        elif p == '/api/ops/recommendations':
            recs = _gen_recommendations()
            for rec in recs:
                if rec["id"] in _approvals:
                    rec["status"] = _approvals[rec["id"]]["status"]
            self._send(200, {"recommendations": recs, "count": len(recs),
                             "_note": "SYNTHETIC — not for clinical use"})

        # ── CuraFlow: Approvals ───────────────────────────────────────────────
        elif p == '/api/ops/approvals':
            self._send(200, {"approvals": list(_approvals.values()),
                             "count": len(_approvals)})

        # ── CuraFlow: Execution ───────────────────────────────────────────────
        elif p == '/api/ops/execution':
            self._send(200, {"execution_log": [], "total": 0})

        # ── CuraFlow: Audit ───────────────────────────────────────────────────
        elif p == '/api/ops/audit':
            self._send(200, {"events": list(reversed(_audit_events))[:100],
                             "total": len(_audit_events)})

        # ── CuraFlow: Simulations ─────────────────────────────────────────────
        elif p == '/api/ops/simulations/scenarios':
            self._send(200, {"scenarios": [
                {"id": "emergency_surge", "name": "Emergency Surge",
                 "type": "emergency_surge", "description": "ER arrivals +40%, CT failure"},
                {"id": "icu_saturation", "name": "ICU Saturation",
                 "type": "icu_saturation", "description": "ICU at capacity"},
                {"id": "staff_shortage", "name": "Staff Shortage",
                 "type": "staff_shortage", "description": "20% staff unavailable"},
                {"id": "device_failure", "name": "Device Failure",
                 "type": "device_failure", "description": "CT scanner down"},
            ]})

        # ── CuraFlow: System health ───────────────────────────────────────────
        elif p == '/api/ops/system-health':
            self._send(200, {"overall_status": "degraded", "components": [
                {"name": "Hospital State Engine", "type": "service", "status": "healthy", "latency_ms": 3},
                {"name": "Prediction Engine", "type": "service", "status": "healthy", "latency_ms": 45,
                 "note": "SYNTHETIC models"},
                {"name": "PostgreSQL", "type": "database", "status": "disconnected",
                 "note": "Mock server — no DB"},
                {"name": "Redis", "type": "cache", "status": "disconnected",
                 "note": "Mock server — no Redis"},
                {"name": "Kafka", "type": "event_bus", "status": "disconnected",
                 "note": "Not configured"},
                {"name": "FHIR / Fabric", "type": "data_layer", "status": "disconnected",
                 "note": "Not configured in prototype"},
            ], "checked_at": NOW()})

        # ── CuraFlow: Data quality ────────────────────────────────────────────
        elif p == '/api/ops/data-quality':
            self._send(200, {"sources": [
                {"name": "Synthetic Hospital Engine", "type": "simulation",
                 "status": "connected", "last_event_seconds_ago": 8, "completeness_pct": 100,
                 "freshness_label": "LIVE", "note": "SYNTHETIC"},
                {"name": "FHIR ADT Feed", "type": "fhir", "status": "disconnected",
                 "completeness_pct": 0, "freshness_label": "DISCONNECTED"},
                {"name": "Staff Feed", "type": "api", "status": "degraded",
                 "last_event_seconds_ago": 161, "completeness_pct": 78,
                 "freshness_label": "STALE"},
            ], "overall_confidence": 0.65, "checked_at": NOW()})

        # ── CuraFlow: Agent performance ───────────────────────────────────────
        elif p == '/api/ops/agents/performance':
            agents = [
                {"id": "bed_agent", "label": "Bed Management", "status": "active",
                 "runs_today": 428, "recommendations_today": 76, "accepted": 61,
                 "modified": 9, "rejected": 6, "acceptance_rate_pct": 80.3,
                 "avg_latency_ms": 420, "avg_confidence": 0.84},
                {"id": "icu_agent", "label": "ICU", "status": "active",
                 "runs_today": 312, "recommendations_today": 45, "accepted": 38,
                 "modified": 4, "rejected": 3, "acceptance_rate_pct": 84.4,
                 "avg_latency_ms": 380, "avg_confidence": 0.87},
                {"id": "er_agent", "label": "Emergency", "status": "active",
                 "runs_today": 519, "recommendations_today": 88, "accepted": 71,
                 "modified": 11, "rejected": 6, "acceptance_rate_pct": 80.7,
                 "avg_latency_ms": 290, "avg_confidence": 0.81},
                {"id": "staff_agent", "label": "Staff", "status": "active",
                 "runs_today": 201, "recommendations_today": 34, "accepted": 25,
                 "modified": 6, "rejected": 3, "acceptance_rate_pct": 73.5,
                 "avg_latency_ms": 510, "avg_confidence": 0.75},
                {"id": "ot_agent", "label": "Operating Theatres", "status": "active",
                 "runs_today": 118, "recommendations_today": 19, "accepted": 14,
                 "modified": 3, "rejected": 2, "acceptance_rate_pct": 73.7,
                 "avg_latency_ms": 445, "avg_confidence": 0.76},
                {"id": "lab_agent", "label": "Diagnostics", "status": "active",
                 "runs_today": 244, "recommendations_today": 41, "accepted": 32,
                 "modified": 6, "rejected": 3, "acceptance_rate_pct": 78.0,
                 "avg_latency_ms": 330, "avg_confidence": 0.78},
            ]
            self._send(200, {"agents": agents})

        else:
            self._send(404, {"detail": f"Not found: {p}"})


print(f"CuraFlow Mock API Server — port {PORT}")
print(f"  Hospital state: synthetic ({'loaded' if _hospital else 'unavailable'})")
print(f"  New routes: /api/ops/*")
with socketserver.TCPServer(("", PORT), MockAPIHandler) as httpd:
    httpd.serve_forever()
