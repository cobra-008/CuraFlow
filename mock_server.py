"""
CuraFlow Mock API Server
Serves both the original Hospilot API endpoints AND the new CuraFlow
operational intelligence endpoints. Used for local development without
a full Docker/PostgreSQL setup.

Authentication:
  - Production path: all /api/ops/* require Bearer JWT.
  - Dev/demo mode:   set CURAFLOW_DEV_AUTH=1 to accept any token value
                     (or no token) so the frontend demo works without a
                     login step. THIS MUST NEVER be set in production.

Run:  python3 mock_server.py
      CURAFLOW_DEV_AUTH=1 python3 mock_server.py   # bypass auth for demo
"""

import http.server
import json
import os
import random
import socketserver
import sys
import uuid
from datetime import datetime, timedelta, timezone

# Optional JWT validation
try:
    import jwt as _jwt
    _JWT_AVAILABLE = True
except ImportError:
    _JWT_AVAILABLE = False

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
NOW = lambda: datetime.now(timezone.utc).isoformat()

# Auth configuration
_JWT_SECRET = os.environ.get("JWT_SECRET", "change-me-in-production")
_DEV_AUTH   = os.environ.get("CURAFLOW_DEV_AUTH", "") in ("1", "true", "yes")
TOKEN_VERSION = 2  # must match auth.py TOKEN_VERSION

def _check_auth(headers: dict) -> tuple:
    auth_header = headers.get("Authorization") or headers.get("authorization") or ""
    if _DEV_AUTH:
        if auth_header.startswith("Bearer ") and _JWT_AVAILABLE:
            try:
                claims = _jwt.decode(auth_header.split(" ", 1)[1], _JWT_SECRET, algorithms=["HS256"])
                return True, claims.get("username", "demo_user")
            except Exception:
                pass
        return True, "dev_user"
    if not auth_header.startswith("Bearer "):
        return False, "missing_token"
    token = auth_header.split(" ", 1)[1]
    if not _JWT_AVAILABLE:
        print("[WARN] PyJWT not installed; token content not validated.")
        return True, "unknown_user"
    try:
        claims = _jwt.decode(token, _JWT_SECRET, algorithms=["HS256"])
    except _jwt.ExpiredSignatureError:
        return False, "token_expired"
    except _jwt.InvalidTokenError:
        return False, "invalid_token"
    if claims.get("ver") != TOKEN_VERSION:
        return False, "token_version_mismatch"
    return True, claims.get("username", "unknown")


def _make_demo_token() -> str:
    if not _JWT_AVAILABLE:
        return "mock-token-no-jwt-library"
    payload = {
        "sub": "00000000-0000-0000-0000-000000000000",
        "username": "admin",
        "display_name": "Mock Admin",
        "role": "super_admin",
        "org_id": None,
        "ver": TOKEN_VERSION,
        "exp": datetime.now(timezone.utc) + timedelta(hours=8),
    }
    return _jwt.encode(payload, _JWT_SECRET, algorithm="HS256")


# Synthetic hospital state
try:
    sys.path.insert(0, "agentic-framework")
    from synthetic_hospital import SyntheticHospital
    _hospital = SyntheticHospital(seed=42)
except Exception:
    _hospital = None

rng = random.Random(42)

# In-memory state stores
_approvals: dict = {}
_audit_events: list = []
_execution_log: list = []   # FIX G1 — was always returned as []
_sim_runs: dict = {}
_crisis_active = False
_verifications: dict = {}

# Canonical audit event type vocabulary (FIX G3)
_DECISION_EVENT = {
    "approve": "recommendation_approved",
    "modify":  "recommendation_modified",
    "reject":  "recommendation_rejected",
}


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
    return [
        {
            "id": "rec-icu-001", "recommendation_number": 1,
            "rec_type": "resource_allocation", "priority": "critical",
            "title": "Reserve ICU capacity",
            "summary": "ICU occupancy at {:.0f}% — reserve ICU-04 for high-acuity admission".format(snap["icu"]["occupancy_pct"]),
            "why_explanation": "ICU occupancy is at {:.0f}% — above the 85% safe threshold. Respiratory demand predicted to increase within 45 minutes.".format(snap["icu"]["occupancy_pct"]),
            "agent_id": "icu_agent", "confidence": 0.87, "requires_approval": True, "status": "pending",
            "created_at": NOW(), "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
            "constraints_satisfied": ["Respiratory capable", "Isolation capable", "Ventilator available"],
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
            "expected_impact": {"icu_occupancy_reduction_pct": 7.2, "wait_time_reduction_minutes": 17, "patients_benefited": 4},
            "actions": [
                {"id": str(uuid.uuid4()), "action_order": 1, "action_type": "reserve_bed", "action_description": "Reserve ICU-04 for high-acuity admission", "status": "pending"},
                {"id": str(uuid.uuid4()), "action_order": 2, "action_type": "staff_alert", "action_description": "Alert ICU charge nurse of incoming pressure", "status": "pending"},
                {"id": str(uuid.uuid4()), "action_order": 3, "action_type": "review_stepdown", "action_description": "Review step-down candidates in ICU", "status": "pending"},
            ],
            "_is_synthetic": True,
        },
        {
            "id": "rec-staff-002", "recommendation_number": 2,
            "rec_type": "staff_rebalance", "priority": "high",
            "title": "Rebalance staff assignments",
            "summary": "Staff utilization at {:.0f}% — reassign float nurses from Orthopedics to Respiratory".format(snap["staff"]["utilization_pct"]),
            "why_explanation": "Staff utilization is at {:.0f}%. Float pool nurses available in Orthopedics should be reallocated to Respiratory Ward.".format(snap["staff"]["utilization_pct"]),
            "agent_id": "staff_agent", "confidence": 0.79, "requires_approval": True, "status": "pending",
            "created_at": NOW(), "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
            "constraints_satisfied": ["Staff qualifications verified", "Shift overlap confirmed", "Workload within limits"],
            "alternatives_rejected": [{"option": "Call in off-duty staff", "reason": "Minimum 2hr response time"}],
            "counterfactual_scenario": {
                "label": "If rejected",
                "predicted_saturation_pct": min(100, snap["staff"]["utilization_pct"] + 6),
                "expected_delay_minutes": 10,
                "alternative_description": "Reduce patient intake by 15% for 1 shift",
            },
            "expected_impact": {"staff_utilization_reduction_pct": 5.8, "wait_time_reduction_minutes": 10, "patients_benefited": 6},
            "actions": [
                {"id": str(uuid.uuid4()), "action_order": 1, "action_type": "reassign_staff", "action_description": "Reassign 2 float nurses from Orthopedics to Respiratory Ward", "status": "pending"},
                {"id": str(uuid.uuid4()), "action_order": 2, "action_type": "overtime_request", "action_description": "Send optional overtime request to eligible staff", "status": "pending"},
            ],
            "_is_synthetic": True,
        },
        {
            "id": "rec-lab-003", "recommendation_number": 3,
            "rec_type": "resource_allocation", "priority": "medium",
            "title": "Redirect diagnostic workload",
            "summary": "Diagnostic queue at {} orders — route non-urgent to CT-02".format(snap["diagnostics"]["queue_length"]),
            "why_explanation": "Diagnostic queue has {} pending orders. CT-02 is available and can absorb non-urgent workload.".format(snap["diagnostics"]["queue_length"]),
            "agent_id": "lab_agent", "confidence": 0.73, "requires_approval": True, "status": "pending",
            "created_at": NOW(), "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
            "constraints_satisfied": ["Device compatible", "No emergency conflict"],
            "alternatives_rejected": [{"option": "MRI-01", "reason": "Different modality — not suitable for CT orders"}],
            "counterfactual_scenario": {
                "label": "If rejected",
                "predicted_saturation_pct": min(100, snap["diagnostics"]["queue_length"] * 5),
                "expected_delay_minutes": 35,
                "alternative_description": "Manual triage adds ~45 min to non-urgent turnaround",
            },
            "expected_impact": {"queue_reduction_orders": 8, "wait_time_reduction_minutes": 35, "patients_benefited": 8},
            "actions": [
                {"id": str(uuid.uuid4()), "action_order": 1, "action_type": "redirect_orders", "action_description": "Route non-urgent orders to CT-02 (available now)", "status": "pending"},
                {"id": str(uuid.uuid4()), "action_order": 2, "action_type": "expedite_stat", "action_description": "Expedite 3 STAT orders ahead of queue", "status": "pending"},
            ],
            "_is_synthetic": True,
        },
    ]


def _add_execution_entry(approval_id: str, decision: str, actor: str, modifications=None, simulate_outcome=None):
    """FIX G1: Real execution log entry with lifecycle timestamps."""
    exec_id = str(uuid.uuid4())
    snap = _snap()
    
    # Capture expected impact for verification
    recs = _gen_recommendations()
    rec = next((r for r in recs if r["id"] == approval_id), None)
    expected_impact = rec["expected_impact"] if rec else {}
    
    changes = []
    if snap.get("icu", {}).get("occupancy_pct", 0) >= 85:
        changes.append("icu_bed_reserved")
    if snap.get("staff", {}).get("utilization_pct", 0) >= 80:
        changes.append("staff_reallocated")
    if snap.get("diagnostics", {}).get("queue_length", 0) >= 10:
        changes.append("diagnostic_queue_rebalanced")
    changes.append("audit_logged")
    entry = {
        "id": exec_id,
        "recommendation_id": approval_id,
        "approval_request_id": approval_id,
        "execution_status": "completed",
        "decision": decision,
        "started_at": NOW(),
        "completed_at": NOW(),
        "executor": "curaflow_mock_execution_engine",
        "actor_id": actor,
        "modifications": modifications or [],
        "result": {
            "outcome": "completed",
            "actions_executed": 3 if decision == "approve" else 2,
            "state_changes": changes or ["state_acknowledged"],
            "verification_status": "verified",
            "verification_note": "SYNTHETIC — outcome measured against state snapshot",
        },
        "affected_resources": [
            {"type": "bed", "id": "ICU-04", "change": "reserved"},
            {"type": "staff", "id": "staff_agent", "change": "alerted"},
        ],
        "_is_synthetic": True,
    }
    _execution_log.append(entry)
    _audit_events.append({
        "id": str(uuid.uuid4()),
        "event_timestamp": NOW(),
        "actor_type": "system",
        "actor_id": "curaflow_execution_engine",
        "event_type": "recommendation_executed",
        "resource_type": "recommendation",
        "resource_id": approval_id,
        "action": "execute",
        "decision": decision,
        "reason": f"Executed after {decision} by {actor}",
        "correlation_id": exec_id,
    })
    
    # Create verification record
    verif_id = str(uuid.uuid4())
    _verifications[approval_id] = {
        "id": verif_id,
        "recommendation_id": approval_id,
        "execution_id": exec_id,
        "baseline_timestamp": NOW(),
        "measurement_timestamp": None,
        "measurement_window_seconds": 15,
        "baseline_state": snap,
        "expected_impact": expected_impact,
        "outcome": "PENDING",
        "_simulate_outcome": simulate_outcome
    }
    _audit_events.append({
        "id": str(uuid.uuid4()),
        "event_timestamp": NOW(),
        "actor_type": "system",
        "actor_id": "curaflow_verification_engine",
        "event_type": "recommendation_verification_started",
        "resource_type": "verification",
        "resource_id": verif_id,
        "action": "start_verification",
        "reason": f"Measurement window started for execution {exec_id}",
        "correlation_id": exec_id,
    })
    return entry


def _evaluate_verification(approval_id: str):
    v = _verifications.get(approval_id)
    if not v or v["outcome"] != "PENDING":
        return v
        
    baseline_time = datetime.fromisoformat(v["baseline_timestamp"].replace('Z', '+00:00'))
    # Shorten measurement window to 1 second for testing if simulate_outcome is set
    window = 1 if v.get("_simulate_outcome") else v["measurement_window_seconds"]
    if datetime.now(timezone.utc) < baseline_time + timedelta(seconds=window):
        return v
        
    v["measurement_timestamp"] = NOW()
    expected = v["expected_impact"]
    sim_outcome = v.get("_simulate_outcome")
    
    actual = {}
    variance = {}
    
    if sim_outcome:
        v["outcome"] = sim_outcome
        if sim_outcome == "SUCCESS":
            actual = expected.copy()
            variance = {k: 0 for k in expected}
        elif sim_outcome == "PARTIAL":
            actual = {k: v * 0.5 for k, v in expected.items()}
            variance = {k: actual[k] - expected[k] for k in expected}
        elif sim_outcome == "FAILED":
            actual = {k: 0 for k in expected}
            variance = {k: -expected[k] for k in expected}
        elif sim_outcome == "NOT_MEASURABLE":
            pass
    else:
        # Default behavior if not explicitly simulated: SUCCESS for demo purposes
        v["outcome"] = "SUCCESS"
        actual = expected.copy()
        variance = {k: 0 for k in expected}
        
    v["actual_impact"] = actual
    v["variance"] = variance
    
    _audit_events.append({
        "id": str(uuid.uuid4()),
        "event_timestamp": NOW(),
        "actor_type": "system",
        "actor_id": "curaflow_verification_engine",
        "event_type": "recommendation_verified",
        "resource_type": "verification",
        "resource_id": v["id"],
        "action": "verify_outcome",
        "outcome": v["outcome"],
        "correlation_id": v["execution_id"],
    })
    return v


SIMULATION_METRICS = {
    "emergency_surge": {
        "without_curaflow": {"patient_wait_time_minutes": 47, "bed_utilization_pct": 96, "icu_utilization_pct": 98, "emergency_response_minutes": 22, "ot_utilization_pct": 82, "diagnostic_turnaround_minutes": 55, "staff_overtime_hours": 18, "bottleneck_duration_minutes": 95},
        "with_curaflow":    {"patient_wait_time_minutes": 28, "bed_utilization_pct": 88, "icu_utilization_pct": 89, "emergency_response_minutes": 14, "ot_utilization_pct": 79, "diagnostic_turnaround_minutes": 38, "staff_overtime_hours": 11, "bottleneck_duration_minutes": 42},
    },
    "icu_saturation": {
        "without_curaflow": {"patient_wait_time_minutes": 38, "bed_utilization_pct": 94, "icu_utilization_pct": 100, "emergency_response_minutes": 19, "ot_utilization_pct": 75, "diagnostic_turnaround_minutes": 48, "staff_overtime_hours": 12, "bottleneck_duration_minutes": 120},
        "with_curaflow":    {"patient_wait_time_minutes": 21, "bed_utilization_pct": 86, "icu_utilization_pct": 91, "emergency_response_minutes": 12, "ot_utilization_pct": 74, "diagnostic_turnaround_minutes": 31, "staff_overtime_hours": 7,  "bottleneck_duration_minutes": 38},
    },
    "staff_shortage": {
        "without_curaflow": {"patient_wait_time_minutes": 52, "bed_utilization_pct": 89, "icu_utilization_pct": 88, "emergency_response_minutes": 29, "ot_utilization_pct": 68, "diagnostic_turnaround_minutes": 62, "staff_overtime_hours": 28, "bottleneck_duration_minutes": 140},
        "with_curaflow":    {"patient_wait_time_minutes": 34, "bed_utilization_pct": 83, "icu_utilization_pct": 84, "emergency_response_minutes": 18, "ot_utilization_pct": 65, "diagnostic_turnaround_minutes": 44, "staff_overtime_hours": 16, "bottleneck_duration_minutes": 58},
    },
    "device_failure": {
        "without_curaflow": {"patient_wait_time_minutes": 44, "bed_utilization_pct": 82, "icu_utilization_pct": 79, "emergency_response_minutes": 18, "ot_utilization_pct": 71, "diagnostic_turnaround_minutes": 95, "staff_overtime_hours": 8,  "bottleneck_duration_minutes": 110},
        "with_curaflow":    {"patient_wait_time_minutes": 26, "bed_utilization_pct": 79, "icu_utilization_pct": 77, "emergency_response_minutes": 13, "ot_utilization_pct": 69, "diagnostic_turnaround_minutes": 51, "staff_overtime_hours": 5,  "bottleneck_duration_minutes": 44},
    },
}


class MockAPIHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

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

    def _require_ops_auth(self):
        """Returns (ok, actor_id). Sends 401 and returns (False, reason) on failure."""
        ok, actor = _check_auth(dict(self.headers))
        if not ok:
            body = json.dumps({"detail": actor, "hint": "Provide Authorization: Bearer <token>"}).encode()
            self.send_response(401)
            self.send_header('Content-type', 'application/json')
            self.send_header('WWW-Authenticate', 'Bearer realm="CuraFlow"')
            self.end_headers()
            self.wfile.write(body)
        return ok, actor

    def do_POST(self):
        body = self._read_body()
        p = self.path.split('?')[0]

        if p == '/api/auth/login':
            token = _make_demo_token()
            self._send(200, {"token": token, "user": {
                "id": "00000000-0000-0000-0000-000000000000",
                "username": body.get("username", "admin"), "display_name": "Mock Admin",
                "role": "super_admin", "org_id": None, "org_name": "System"
            }})

        elif p.startswith('/api/sessions'):
            self._send(200, {
                "session_id": str(uuid.uuid4()), "status": "pending", "autonomous": False,
                "pipeline": {"understood_goal": "Mock goal", "priority": "normal", "agents": [], "edges": []}
            })

        elif p.startswith('/api/ops/'):
            ok, actor = self._require_ops_auth()
            if not ok:
                return
            self._ops_post(p, body, actor)

        else:
            self._send(404, {"detail": "Not found"})

    def _ops_post(self, p, body, actor):
        global _crisis_active

        if p == '/api/ops/hospital-state/crisis':
            _crisis_active = True
            if _hospital:
                _hospital.apply_crisis()
            self._send(200, {
                "status": "crisis_activated",
                "message": "SYNTHETIC: Crisis activated — ICU>=90%, Beds>=91%, ER>=60%.",
                "snapshot": _snap(),
            })

        elif p == '/api/ops/hospital-state/resolve-crisis':
            # FIX G5: restore ALL state, not just flip the flag
            _crisis_active = False
            if _hospital:
                _hospital.resolve_crisis()
            self._send(200, {"status": "crisis_resolved", "message": "Hospital state restored to pre-crisis baseline"})

        elif '/decide' in p:
            parts = p.split('/')
            approval_id = parts[parts.index('approvals') + 1] if 'approvals' in parts else str(uuid.uuid4())
            decision = body.get("decision", "approve")
            if decision not in ("approve", "modify", "reject"):
                self._send(400, {"detail": "decision must be approve | modify | reject"})
                return
            status_map = {"approve": "approved", "modify": "modified", "reject": "rejected"}
            modifications = body.get("modifications") or []
            approval = {
                "id": approval_id, "recommendation_id": approval_id,
                "status": status_map[decision], "decision": decision,
                "decision_reason": body.get("reason"),
                "responded_at": NOW(), "responded_by": actor,
                "modifications": modifications,
            }
            _approvals[approval_id] = approval
            # FIX G3: canonical event type string
            _audit_events.append({
                "id": str(uuid.uuid4()), "event_timestamp": NOW(),
                "actor_type": "human", "actor_id": actor,
                "event_type": _DECISION_EVENT[decision],
                "resource_type": "recommendation", "resource_id": approval_id,
                "action": decision, "decision": decision,
                "reason": body.get("reason"), "correlation_id": str(uuid.uuid4()),
            })
            # FIX G1: real execution entry
            if decision in ("approve", "modify"):
                simulate_outcome = body.get("simulate_outcome")
                _add_execution_entry(approval_id, decision, actor, modifications, simulate_outcome)
            self._send(200, {"approval": approval, "message": f"Recommendation {status_map[decision]} successfully"})

        elif p.endswith('/request-approval'):
            rec_id = p.split('/')[-2]
            approval = {
                "id": rec_id, "recommendation_id": rec_id, "requested_by": "system",
                "status": "pending", "requested_at": NOW(),
                "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
            }
            _approvals[rec_id] = approval
            self._send(200, {"approval": approval})

        elif p == '/api/ops/simulations/run':
            scenario_type = body.get("scenario_type", "emergency_surge")
            metrics = SIMULATION_METRICS.get(scenario_type)
            if metrics is None:
                self._send(400, {"detail": f"Unknown scenario_type: {scenario_type}"})
                return
            run_id = str(uuid.uuid4())
            result = {
                "run_id": run_id, "scenario_type": scenario_type,
                "status": "completed", "started_at": NOW(), "completed_at": NOW(),
                "metrics": metrics,
                "improvement_summary": {
                    "wait_time_reduction_pct": round((1 - metrics["with_curaflow"]["patient_wait_time_minutes"] / metrics["without_curaflow"]["patient_wait_time_minutes"]) * 100, 1),
                    "bottleneck_duration_reduction_pct": round((1 - metrics["with_curaflow"]["bottleneck_duration_minutes"] / metrics["without_curaflow"]["bottleneck_duration_minutes"]) * 100, 1),
                },
                "_note": "SYNTHETIC — prototype benchmark results, not clinical evidence",
            }
            _sim_runs[run_id] = result
            self._send(200, result)

        elif p == '/api/ops/chat':
            message = (body.get("message") or "").strip().lower()
            snap = _snap()

            # Build context from live data
            beds_pct   = snap["beds"]["occupancy_pct"]
            icu_pct    = snap["icu"]["occupancy_pct"]
            staff_pct  = snap["staff"]["utilization_pct"]
            er_wait    = snap["emergency"]["waiting"]
            diag_q     = snap["diagnostics"]["queue_length"]
            ot_pct     = snap["operating_rooms"]["utilization_pct"]
            pressure   = snap["pressure"]["label"]

            # Keyword-based contextual responses
            if any(k in message for k in ["icu", "intensive", "critical care"]):
                response = (
                    f"ICU is currently at {icu_pct:.1f}% occupancy ({snap['icu']['occupied']}/{snap['icu']['total']} beds). "
                    f"{'ALERT: This is above the 85% safety threshold — escalation recommended.' if icu_pct >= 85 else 'Occupancy is within safe limits.'} "
                    f"Staff utilization stands at {staff_pct:.0f}%. "
                    + ("Recommended: Activate float pool nurses and review discharge eligibility for stable ICU patients." if icu_pct >= 85 else
                       "Continue monitoring. No immediate action required.")
                )
            elif any(k in message for k in ["er", "emergency", "waiting", "queue"]):
                response = (
                    f"Emergency department currently has {er_wait} patients waiting against a capacity of {snap['emergency']['capacity']}. "
                    f"Demand score: {snap['emergency']['demand_score']:.0f}%. "
                    + ("ALERT: High demand — consider fast-tracking triage and opening overflow bays." if er_wait > 20 else
                       "ER demand is manageable at current staffing levels.")
                )
            elif any(k in message for k in ["bed", "ward", "admission", "discharge"]):
                response = (
                    f"General ward occupancy is at {beds_pct:.1f}% ({snap['beds']['occupied']}/{snap['beds']['total']} beds). "
                    f"Available: {snap['beds']['available']} | Cleaning: {snap['beds']['cleaning']} | Blocked: {snap['beds']['blocked']}. "
                    + ("ALERT: Bed pressure is elevated — expedite discharge planning for medically stable patients." if beds_pct >= 85 else
                       "Bed availability is adequate. Continue standard discharge planning.")
                )
            elif any(k in message for k in ["staff", "nurse", "doctor", "staffing"]):
                response = (
                    f"Staff utilization is currently {staff_pct:.1f}% with {snap['staff']['on_duty']} of {snap['staff']['total']} staff on duty. "
                    f"Available staff: {snap['staff']['available']}. "
                    + ("ALERT: High utilization — consider activating float pool or requesting overtime shifts." if staff_pct >= 85 else
                       "Staffing levels are within expected range for current patient load.")
                )
            elif any(k in message for k in ["diagnostic", "lab", "ct", "scan", "test", "imaging"]):
                response = (
                    f"Diagnostic queue has {diag_q} pending orders across {snap['diagnostics']['total_devices']} devices "
                    f"({snap['diagnostics']['available_devices']} available). "
                    + ("ALERT: Queue is above threshold — route non-urgent orders to available devices and consider extended hours." if diag_q > 15 else
                       "Diagnostic throughput is keeping up with demand.")
                )
            elif any(k in message for k in ["ot", "operation", "surgery", "theatre", "theater"]):
                response = (
                    f"Operating theatres: {snap['operating_rooms']['occupied']}/{snap['operating_rooms']['total']} in use ({ot_pct:.0f}% utilization). "
                    f"Available rooms: {snap['operating_rooms']['available']}. "
                    + ("ALERT: High OT utilization — review elective surgery scheduling." if ot_pct >= 85 else
                       "OT utilization is within normal parameters.")
                )
            elif any(k in message for k in ["pressure", "status", "summary", "overview", "report"]):
                response = (
                    f"Hospital operational pressure: {pressure.upper()}. "
                    f"Beds {beds_pct:.0f}% | ICU {icu_pct:.0f}% | Staff {staff_pct:.0f}% | ER {er_wait} waiting | Diag queue {diag_q}. "
                    f"Overall pressure score: {snap['pressure']['overall']:.0f}/100. "
                    + ("Immediate attention required across multiple departments." if snap['pressure']['overall'] >= 75 else
                       "Operations are running smoothly. Continue monitoring key metrics.")
                )
            elif any(k in message for k in ["recommend", "action", "suggest", "what should", "what to"]):
                recs = _gen_recommendations()
                top = recs[:2] if recs else []
                if top:
                    actions = " | ".join([r["title"] for r in top])
                    response = (
                        f"Based on current hospital state (pressure: {pressure}), CuraFlow recommends: {actions}. "
                        f"Review and approve these in the Approval Center to execute actions."
                    )
                else:
                    response = "No active recommendations at this time. All systems are within operational parameters."
            elif any(k in message for k in ["hi", "hello", "help", "what can you"]):
                response = (
                    f"Hello! I'm CuraFlow AI. Current hospital pressure is {pressure.upper()}. "
                    f"You can ask me about: ICU status, ER queue, bed availability, staff utilization, diagnostics, OT status, "
                    f"recommendations, or request a full summary. How can I help?"
                )
            else:
                response = (
                    f"Hospital state snapshot — Pressure: {pressure.upper()} | "
                    f"Beds: {beds_pct:.0f}% | ICU: {icu_pct:.0f}% | Staff: {staff_pct:.0f}% | "
                    f"ER waiting: {er_wait} | Diag queue: {diag_q}. "
                    f"Ask me about any specific department, staffing, recommendations, or operational status."
                )

            self._send(200, {
                "response": response,
                "context": {"pressure": pressure, "timestamp": NOW()},
                "timestamp": NOW(),
            })

        else:
            self._send(404, {"detail": f"Not found: {p}"})

    def do_GET(self):
        p = self.path.split('?')[0]

        if p == '/api/auth/me':
            self._send(200, {"id": "00000000-0000-0000-0000-000000000000", "username": "admin", "display_name": "Mock Admin", "role": "super_admin", "org_id": None, "org_name": "System"})
        elif p == '/api/orgs/public':
            self._send(200, {"organizations": []})
        elif p in ('/api/sessions', '/api/sessions?limit=50'):
            self._send(200, {"sessions": []})
        elif p.startswith('/api/sessions/'):
            if p.endswith('/pending-approvals'):
                self._send(200, {"approvals": []})
            else:
                self._send(200, {
                    "session_id": p.split('/')[-1], "status": "pending", "autonomous": False,
                    "pipeline": {"understood_goal": "Mock goal", "priority": "normal", "agents": [], "edges": []}
                })
        elif p == '/api/queues/paused':
            self._send(200, {"paused": 0, "flows": []})
        elif p == '/api/approvals/pending':
            self._send(200, {"approvals": []})
        elif p == '/api/agents/registry':
            self._send(200, [])
        elif p.startswith('/api/ops/'):
            ok, actor = self._require_ops_auth()
            if not ok:
                return
            self._ops_get(p, actor)
        else:
            self._send(404, {"detail": f"Not found: {p}"})

    def _ops_get(self, p, actor):
        if p == '/api/ops/hospital-state':
            self._send(200, _snap())

        elif p == '/api/ops/beds':
            beds = []
            if _hospital:
                for b in _hospital.beds:
                    beds.append({"id": b.id, "ward_code": b.ward_code, "ward_name": b.ward_name, "bed_number": b.bed_number, "specialty": b.specialty, "is_icu": b.is_icu, "status": b.status, "patient_token": b.patient_token, "ventilation": b.ventilation, "isolation": b.isolation, "last_status_change": b.last_status_change})
            self._send(200, {"beds": beds})

        elif p == '/api/ops/staff':
            staff = []
            if _hospital:
                for s in _hospital.staff:
                    staff.append({"id": s.id, "employee_code": s.employee_code, "name_token": s.name_token, "display_name": s.display_name, "role": s.role, "department": s.department, "status": s.status, "shift_start": s.shift_start, "shift_end": s.shift_end, "current_workload": s.current_workload, "max_workload": s.max_workload, "utilization_pct": round(s.current_workload / max(s.max_workload, 1) * 100, 1)})
            self._send(200, {"staff": staff})

        elif p == '/api/ops/operating-rooms':
            rooms = []
            if _hospital:
                for r in _hospital.ot_rooms:
                    rooms.append({"id": r.id, "room_code": r.room_code, "name": r.name, "specialty": r.specialty, "status": r.status, "emergency_capable": r.emergency_capable})
            self._send(200, {"operating_rooms": rooms})

        elif p == '/api/ops/diagnostics':
            devices = []
            if _hospital:
                for d in _hospital.devices:
                    devices.append({"id": d.id, "device_code": d.device_code, "device_name": d.device_name, "device_type": d.device_type, "status": d.status, "queue_length": d.queue_length, "capacity_per_hour": d.capacity_per_hour, "emergency_capable": d.emergency_capable})
            self._send(200, {"devices": devices})

        elif p == '/api/ops/predictions':
            preds = []
            for ptype in ["icu_demand", "bed_occupancy", "er_arrivals", "discharges"]:
                for h in [1, 4, 8]:
                    preds.append({"id": str(uuid.uuid4()), "prediction_type": ptype, "forecast_start": (datetime.now(timezone.utc) + timedelta(hours=h)).isoformat(), "forecast_end": (datetime.now(timezone.utc) + timedelta(hours=h+1)).isoformat(), "predicted_value": round(rng.uniform(60, 95), 1), "lower_bound": round(rng.uniform(55, 65), 1), "upper_bound": round(rng.uniform(90, 100), 1), "confidence": round(rng.uniform(0.65, 0.88), 2), "model_name": f"{ptype}_baseline", "is_synthetic": True})
            self._send(200, {"predictions": preds, "_note": "SYNTHETIC — not clinically validated"})

        elif p == '/api/ops/bottlenecks':
            snap = _snap()
            bns = []
            rules = [
                ("icu_saturation",    "icu",         snap["icu"]["occupancy_pct"],                                                    85.0),
                ("bed_shortage",      "beds",         snap["beds"]["occupancy_pct"],                                                   88.0),
                ("er_queue_growth",   "er",           snap["emergency"]["waiting"] / max(snap["emergency"]["capacity"], 1) * 100,      50.0),
                ("staff_shortage",    "staff",        snap["staff"]["utilization_pct"],                                               80.0),
                ("diagnostic_backlog","diagnostics",  float(snap["diagnostics"]["queue_length"]),                                     10.0),
            ]
            for btype, rtype, value, threshold in rules:
                if value >= threshold:
                    sev = "critical" if value >= 95 else "high" if value >= 90 else "moderate"
                    bns.append({"id": str(uuid.uuid4()), "bottleneck_type": btype, "resource_type": rtype, "severity": sev, "detected_at": NOW(), "current_value": round(value, 2), "threshold_value": threshold, "confidence": 0.90, "status": "active"})
            self._send(200, {"bottlenecks": bns, "count": len(bns), "critical_count": sum(1 for b in bns if b["severity"] == "critical"), "high_count": sum(1 for b in bns if b["severity"] == "high")})

        elif p == '/api/ops/recommendations':
            recs = _gen_recommendations()
            for rec in recs:
                if rec["id"] in _approvals:
                    rec["status"] = _approvals[rec["id"]]["status"]
                v = _evaluate_verification(rec["id"])
                if v:
                    rec["verification"] = v
            self._send(200, {"recommendations": recs, "count": len(recs), "_note": "SYNTHETIC — not for clinical use"})

        elif p == '/api/ops/approvals':
            self._send(200, {"approvals": list(_approvals.values()), "count": len(_approvals)})

        # FIX G1 — returns actual execution log
        elif p == '/api/ops/execution':
            self._send(200, {"execution_log": list(reversed(_execution_log)), "total": len(_execution_log)})

        elif p == '/api/ops/audit':
            self._send(200, {"events": list(reversed(_audit_events))[:100], "total": len(_audit_events)})

        elif p == '/api/ops/simulations/scenarios':
            self._send(200, {"scenarios": [
                {"id": "emergency_surge",  "name": "Emergency Surge",  "type": "emergency_surge",  "description": "ER arrivals +40%, ICU demand increases, CT failure"},
                {"id": "icu_saturation",   "name": "ICU Saturation",   "type": "icu_saturation",   "description": "ICU at capacity with step-down backup"},
                {"id": "staff_shortage",   "name": "Staff Shortage",   "type": "staff_shortage",   "description": "20% of nursing staff unavailable"},
                {"id": "device_failure",   "name": "CT Scanner Failure","type": "device_failure",  "description": "Primary CT scanner down, queue backs up"},
            ]})

        elif p.startswith('/api/ops/simulations/'):
            run_id = p.split('/')[-1]
            result = _sim_runs.get(run_id)
            self._send(200, result) if result else self._send(404, {"detail": "Simulation run not found"})

        elif p == '/api/ops/system-health':
            self._send(200, {"overall_status": "degraded", "components": [
                {"name": "Hospital State Engine", "type": "service",    "status": "healthy",       "latency_ms": 3},
                {"name": "Prediction Engine",     "type": "service",    "status": "healthy",       "latency_ms": 45,   "note": "SYNTHETIC models"},
                {"name": "PostgreSQL",            "type": "database",   "status": "disconnected",  "latency_ms": None, "note": "Mock server — no DB"},
                {"name": "Redis",                 "type": "cache",      "status": "disconnected",  "latency_ms": None, "note": "Mock server — no Redis"},
                {"name": "Kafka",                 "type": "event_bus",  "status": "disconnected",  "latency_ms": None, "note": "Not configured"},
                {"name": "FHIR / Fabric",         "type": "data_layer", "status": "disconnected",  "latency_ms": None, "note": "Not configured in prototype"},
            ], "checked_at": NOW()})

        elif p == '/api/ops/data-quality':
            self._send(200, {"sources": [
                {"name": "Synthetic Hospital Engine", "type": "simulation", "status": "connected",    "last_event_seconds_ago": 8,   "completeness_pct": 100, "freshness_label": "LIVE",         "note": "SYNTHETIC"},
                {"name": "FHIR ADT Feed",             "type": "fhir",       "status": "disconnected", "last_event_seconds_ago": None, "completeness_pct": 0,   "freshness_label": "DISCONNECTED"},
                {"name": "Staff Feed",                "type": "api",        "status": "degraded",     "last_event_seconds_ago": 161,  "completeness_pct": 78,  "freshness_label": "STALE"},
            ], "overall_confidence": 0.65, "checked_at": NOW()})

        elif p == '/api/ops/agents/performance':
            self._send(200, {"agents": [
                {"id": "bed_agent",   "label": "Bed Management",     "status": "active", "runs_today": 428, "recommendations_today": 76, "accepted": 61, "modified": 9,  "rejected": 6, "acceptance_rate_pct": 80.3, "avg_latency_ms": 420, "avg_confidence": 0.84},
                {"id": "icu_agent",   "label": "ICU",                "status": "active", "runs_today": 312, "recommendations_today": 45, "accepted": 38, "modified": 4,  "rejected": 3, "acceptance_rate_pct": 84.4, "avg_latency_ms": 380, "avg_confidence": 0.87},
                {"id": "er_agent",    "label": "Emergency",          "status": "active", "runs_today": 519, "recommendations_today": 88, "accepted": 71, "modified": 11, "rejected": 6, "acceptance_rate_pct": 80.7, "avg_latency_ms": 290, "avg_confidence": 0.81},
                {"id": "staff_agent", "label": "Staff",              "status": "active", "runs_today": 201, "recommendations_today": 34, "accepted": 25, "modified": 6,  "rejected": 3, "acceptance_rate_pct": 73.5, "avg_latency_ms": 510, "avg_confidence": 0.75},
                {"id": "ot_agent",    "label": "Operating Theatres", "status": "active", "runs_today": 118, "recommendations_today": 19, "accepted": 14, "modified": 3,  "rejected": 2, "acceptance_rate_pct": 73.7, "avg_latency_ms": 445, "avg_confidence": 0.76},
                {"id": "lab_agent",   "label": "Diagnostics",        "status": "active", "runs_today": 244, "recommendations_today": 41, "accepted": 32, "modified": 6,  "rejected": 3, "acceptance_rate_pct": 78.0, "avg_latency_ms": 330, "avg_confidence": 0.78},
            ]})

        else:
            self._send(404, {"detail": f"Not found: {p}"})


auth_mode = "DEV_AUTH bypass (CURAFLOW_DEV_AUTH=1)" if _DEV_AUTH else \
            ("JWT validation" if _JWT_AVAILABLE else "no JWT library — install PyJWT for auth")
print(f"CuraFlow Mock API Server — port {PORT}")
print(f"  Hospital state: synthetic ({'loaded' if _hospital else 'unavailable'})")
print(f"  Auth mode: {auth_mode}")
print(f"  All /api/ops/* routes require Authorization: Bearer <token>")
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), MockAPIHandler) as httpd:
    httpd.serve_forever()
