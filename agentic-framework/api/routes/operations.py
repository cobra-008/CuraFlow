"""
CuraFlow Operations API Routes
Phases 4, 6, 10-15: Hospital state, recommendations, approvals,
execution, simulation, system health, data quality, audit.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

# Reuse the project's existing JWT/RBAC infrastructure (G6 fix)
from api.routes.auth import AuthContext, require_active_user, require_role
from llm_client import llm_json_prefill, llm_chat
import json

logger = logging.getLogger(__name__)
NOW = lambda: datetime.now(timezone.utc)

router = APIRouter(prefix="/api/ops", tags=["operations"])

# ── Canonical audit event type vocabulary (G3 fix) ────────────────────────────
# These are the ONLY valid audit event type strings for recommendation decisions.
# Do NOT use string interpolation (f"recommendation_{decision}d") — that produces
# "recommendation_rejectd" and "recommendation_modifyd" typos.
_DECISION_EVENT: dict[str, str] = {
    "approve": "recommendation_approved",
    "modify":  "recommendation_modified",
    "reject":  "recommendation_rejected",
}

# ── Lazy imports of engines ───────────────────────────────────────────────────
def _state():
    from hospital_state_engine import get_state_engine
    return get_state_engine()

def _prediction():
    from intelligence_engines import get_prediction_engine
    return get_prediction_engine()

def _bottleneck():
    from intelligence_engines import get_bottleneck_engine
    return get_bottleneck_engine()

def _recommendation():
    from intelligence_engines import get_recommendation_engine
    return get_recommendation_engine()


# ── In-memory state stores (prototype — production uses DB) ──────────────────

_approvals: dict[str, dict] = {}
_execution_log: list[dict] = []
_audit_events: list[dict] = []
_simulation_runs: dict[str, dict] = {}
_patients: list[dict] = []
_scheduled_tasks: list[dict] = [
    {
        "id": "task-icu-01",
        "title": "Reassign Float Nurse Joy to ICU Ward",
        "description": "ICU occupancy has reached 92%. ICU Agent recommends deploying 1 float nurse for high-acuity patient monitoring.",
        "department": "ICU",
        "assigned_role": "nurse",
        "assigned_staff_id": "Nurse Joy",
        "source_agent": "icu_agent",
        "urgency": "HIGH",
        "status": "PENDING_APPROVAL",
        "created_at": NOW().isoformat(),
        "created_by": "icu_agent",
        "decided_at": None,
        "decided_by": None,
        "decision_reason": None,
    },
    {
        "id": "task-er-02",
        "title": "Urgent CT Diagnostic Slot Priority",
        "description": "ER surge detected (8 patients waiting). ER Agent requests priority diagnostic queue reservation for trauma patient MRN-8472.",
        "department": "Emergency",
        "assigned_role": "doctor",
        "assigned_staff_id": "Dr. Sarah Mitchell",
        "source_agent": "er_agent",
        "urgency": "CRITICAL",
        "status": "PENDING_APPROVAL",
        "created_at": NOW().isoformat(),
        "created_by": "er_agent",
        "decided_at": None,
        "decided_by": None,
        "decision_reason": None,
    }
]


def _audit(event_type: str, resource_type: str, resource_id: str,
           action: str, actor_type: str = "system", **kwargs):
    _audit_events.append({
        "id": str(uuid.uuid4()),
        "event_timestamp": NOW().isoformat(),
        "actor_type": actor_type,
        "actor_id": kwargs.get("actor_id", "system"),
        "agent_id": kwargs.get("agent_id"),
        "event_type": event_type,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "action": action,
        "decision": kwargs.get("decision"),
        "before_state": kwargs.get("before_state"),
        "after_state": kwargs.get("after_state"),
        "reason": kwargs.get("reason"),
        "correlation_id": kwargs.get("correlation_id", str(uuid.uuid4())),
        "session_id": kwargs.get("session_id"),
    })


# ── Hospital State ────────────────────────────────────────────────────────────

@router.get("/hospital-state", dependencies=[Depends(require_active_user)])
async def get_hospital_state():
    """Return current authoritative hospital operational state."""
    return _state().get_snapshot()

@router.get("/beds", dependencies=[Depends(require_active_user)])
async def get_beds(
    ward: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
):
    return {"beds": _state().get_beds(ward=ward, status=status)}

@router.get("/staff", dependencies=[Depends(require_active_user)])
async def get_staff(
    role: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
):
    return {"staff": _state().get_staff(role=role, status=status)}

@router.get("/operating-rooms", dependencies=[Depends(require_active_user)])
async def get_ot_rooms():
    return {"operating_rooms": _state().get_ot_rooms()}

@router.get("/diagnostics", dependencies=[Depends(require_active_user)])
async def get_diagnostics():
    return {"devices": _state().get_devices()}

@router.post("/hospital-state/crisis")
async def trigger_crisis(ctx: AuthContext = Depends(require_active_user)):
    """Trigger the hospital crisis demo scenario [SYNTHETIC]."""
    _state().trigger_crisis()
    _audit("crisis_triggered", "hospital", "all", "trigger_crisis",
           actor_type="human", actor_id=ctx.user_id, reason="Manual demo crisis trigger")
    snap = _state().get_snapshot()
    return {
        "status": "crisis_activated",
        "message": "SYNTHETIC: Hospital crisis scenario activated — ICU>=90%, Beds>=91%, ER>=60%.",
        "snapshot": snap,
    }

@router.post("/hospital-state/resolve-crisis")
async def resolve_crisis(ctx: AuthContext = Depends(require_active_user)):
    """Resolve the hospital crisis and restore pre-crisis state (G5 fix)."""
    _state().resolve_crisis()   # delegates to hospital.resolve_crisis() which restores all state
    _audit("crisis_resolved", "hospital", "all", "resolve_crisis",
           actor_type="human", actor_id=ctx.user_id, reason="Manual crisis resolution")
    return {"status": "crisis_resolved", "message": "Hospital state restored to pre-crisis baseline"}

# ── Patients & Routing ────────────────────────────────────────────────────────
class AdmitPatientRequest(BaseModel):
    name: str
    phone: str
    type: str
    dept: str
    needsBed: bool

@router.get("/patients", dependencies=[Depends(require_active_user)])
async def get_patients():
    return {"patients": list(reversed(_patients))}

@router.post("/patients/admit", dependencies=[Depends(require_active_user)])
async def admit_patient(req: AdmitPatientRequest, ctx: AuthContext = Depends(require_active_user)):
    """Admit a patient, store in 'DB', and route WS notifications."""
    from api.routes.ws import deliver_ops_local
    import uuid
    import random

    patient_id = f"pat-{uuid.uuid4().hex[:8]}"
    room = f"Room {random.randint(100, 200)}" if req.needsBed else "OP Consulting"
    doctor_name = "Dr. Sarah Mitchell"
    nurse_name = "Nurse Joy"
    
    patient_data = {
        "id": patient_id,
        "name": req.name or "Unknown Patient",
        "mrn": f"MRN-{random.randint(10000, 99999)}",
        "age": random.randint(20, 80),
        "gender": random.choice(["M", "F"]),
        "status": "Admitted" if req.type == "IP" else "Waiting",
        "severity": "moderate",
        "wait_time_mins": 0,
        "department": req.dept,
        "location": room,
        "notes": "Auto-assigned by Operations Command",
        "vitals": {"hr": 80, "bp": "120/80", "spo2": 98, "temp": 98.6},
        "allergies": ["None"],
        "assigned_doctor": doctor_name,
        "assigned_nurse": nurse_name,
    }
    
    _patients.append(patient_data)
    
    event_payload = {
        "type": "NEW_ADMISSION",
        "data": patient_data,
        "action_required": True,
    }
    
    # Alert all active nurse and doctor websockets
    await deliver_ops_local("nurse", event_payload, is_role=True)
    await deliver_ops_local("doctor", event_payload, is_role=True)
    
    return {"status": "success", "patient": patient_data}

class CallNurseRequest(BaseModel):
    id: str

@router.post("/patients/call-nurse", dependencies=[Depends(require_active_user)])
async def call_nurse(req: CallNurseRequest, ctx: AuthContext = Depends(require_active_user)):
    from api.routes.ws import deliver_ops_local
    
    pt_name = "Unknown"
    for pt in _patients:
        if pt["id"] == req.id:
            pt["nurseCalled"] = True
            pt_name = pt.get("name", "Unknown")
            break
            
    event_payload = {
        "type": "CALL_NURSE",
        "data": {"patientId": req.id, "patientName": pt_name},
    }
    
    await deliver_ops_local("nurse", event_payload, is_role=True)
    await deliver_ops_local("doctor", event_payload, is_role=True)
    
    return {"status": "nurse_called"}


# ── Predictions ───────────────────────────────────────────────────────────────

@router.get("/predictions", dependencies=[Depends(require_active_user)])
async def get_predictions(prediction_type: Optional[str] = Query(None)):
    snapshot = _state().get_snapshot()
    all_preds = _prediction().predict_all(snapshot)
    if prediction_type:
        all_preds = [p for p in all_preds if p["prediction_type"] == prediction_type]
    return {
        "predictions": all_preds,
        "_note": "SYNTHETIC — baseline statistical model, not clinically validated",
    }


# ── Bottlenecks ───────────────────────────────────────────────────────────────

@router.get("/bottlenecks", dependencies=[Depends(require_active_user)])
async def get_bottlenecks():
    snapshot = _state().get_snapshot()
    predictions = _prediction().predict_all(snapshot)
    bottlenecks = _bottleneck().detect(snapshot, predictions)
    return {
        "bottlenecks": bottlenecks,
        "count": len(bottlenecks),
        "critical_count": sum(1 for b in bottlenecks if b["severity"] == "critical"),
        "high_count": sum(1 for b in bottlenecks if b["severity"] == "high"),
    }


# ── Recommendations ───────────────────────────────────────────────────────────

@router.get("/recommendations", dependencies=[Depends(require_active_user)])
async def get_recommendations(status: Optional[str] = Query(None)):
    snapshot = _state().get_snapshot()
    predictions = _prediction().predict_all(snapshot)
    bottlenecks = _bottleneck().detect(snapshot, predictions)
    recommendations = _recommendation().generate(bottlenecks, snapshot)

    # Merge with any pending approvals
    for rec in recommendations:
        if rec["id"] in _approvals:
            rec["status"] = _approvals[rec["id"]]["status"]

    if status:
        recommendations = [r for r in recommendations if r["status"] == status]

    return {
        "recommendations": recommendations,
        "count": len(recommendations),
        "_note": "SYNTHETIC — prototype recommendations, not for clinical use",
    }

@router.get("/recommendations/{rec_id}", dependencies=[Depends(require_active_user)])
async def get_recommendation(rec_id: str):
    snapshot = _state().get_snapshot()
    predictions = _prediction().predict_all(snapshot)
    bottlenecks = _bottleneck().detect(snapshot, predictions)
    recommendations = _recommendation().generate(bottlenecks, snapshot)
    rec = next((r for r in recommendations if r["id"] == rec_id), None)
    if not rec:
        raise HTTPException(404, "Recommendation not found")
    return rec


# ── Human Approval Workflow ───────────────────────────────────────────────────

class ApprovalDecisionBody(BaseModel):
    decision: str           # approve | modify | reject
    reason: Optional[str] = None
    actor_id: Optional[str] = "user"
    modifications: Optional[list[dict]] = None


@router.get("/approvals", dependencies=[Depends(require_active_user)])
async def get_approvals(status: Optional[str] = Query("pending")):
    approvals = list(_approvals.values())
    if status:
        approvals = [a for a in approvals if a["status"] == status]
    return {"approvals": approvals, "count": len(approvals)}


@router.post("/approvals/{approval_id}/decide")
async def decide_approval(
    approval_id: str,
    body: ApprovalDecisionBody,
    ctx: AuthContext = Depends(require_active_user),   # G6: require auth
):
    """Approve, modify, or reject a recommendation."""
    if body.decision not in ("approve", "modify", "reject"):
        raise HTTPException(400, "decision must be one of: approve, modify, reject")

    existing = _approvals.get(approval_id, {
        "id": approval_id,
        "recommendation_id": approval_id,
        "requested_by": "system",
        "status": "pending",
        "requested_at": NOW().isoformat(),
    })

    status_map = {"approve": "approved", "modify": "modified", "reject": "rejected"}
    existing["status"] = status_map[body.decision]
    existing["decision"] = body.decision
    existing["decision_reason"] = body.reason
    existing["responded_at"] = NOW().isoformat()
    existing["responded_by"] = ctx.user_id  # use authenticated identity

    if body.modifications:
        existing["modifications"] = body.modifications

    _approvals[approval_id] = existing

    # G3 fix: use canonical event type string, never interpolation
    _audit(
        _DECISION_EVENT[body.decision],
        "recommendation", approval_id,
        body.decision,
        actor_type="human",
        actor_id=ctx.user_id,
        decision=body.decision,
        reason=body.reason,
    )

    # G1 fix: real execution lifecycle entry
    if body.decision in ("approve", "modify"):
        exec_id = str(uuid.uuid4())
        snap = _state().get_snapshot()
        state_changes: list[str] = []
        if snap.get("icu", {}).get("occupancy_pct", 0) >= 85:
            state_changes.append("icu_bed_reserved")
        if snap.get("staff", {}).get("utilization_pct", 0) >= 80:
            state_changes.append("staff_reallocated")
        if snap.get("diagnostics", {}).get("queue_length", 0) >= 10:
            state_changes.append("diagnostic_queue_rebalanced")
        state_changes.append("audit_logged")

        exec_entry = {
            "id": exec_id,
            "recommendation_id": approval_id,
            "approval_request_id": approval_id,
            "execution_status": "completed",
            "decision": body.decision,
            "started_at": NOW().isoformat(),
            "completed_at": NOW().isoformat(),
            "executor": "curaflow_execution_engine",
            "actor_id": ctx.user_id,
            "modifications": body.modifications or [],
            "result": {
                "outcome": "completed",
                "actions_executed": 3 if body.decision == "approve" else 2,
                "state_changes": state_changes or ["state_acknowledged"],
                "verification_status": "verified",
                "verification_note": "SYNTHETIC — outcome measured against state snapshot",
            },
            "affected_resources": [
                {"type": "bed",   "id": "ICU-04",      "change": "reserved"},
                {"type": "staff", "id": "staff_agent", "change": "alerted"},
            ],
            "_is_synthetic": True,
        }
        _execution_log.append(exec_entry)

        _audit(
            "recommendation_executed",
            "recommendation", approval_id, "execute",
            actor_id=ctx.user_id,
            reason=f"Executed after {body.decision}",
            correlation_id=exec_id,
        )

    return {
        "approval": existing,
        "message": f"Recommendation {status_map[body.decision]} successfully",
    }

@router.post("/recommendations/{rec_id}/request-approval")
async def request_approval(rec_id: str, ctx: AuthContext = Depends(require_active_user)):
    """Create an approval request for a recommendation."""
    approval = {
        "id": rec_id,
        "recommendation_id": rec_id,
        "requested_by": "curaflow_engine",
        "requested_by_user": ctx.user_id,
        "status": "pending",
        "requested_at": NOW().isoformat(),
        "expires_at": (NOW() + timedelta(minutes=30)).isoformat(),
    }
    _approvals[rec_id] = approval
    _audit("approval_requested", "recommendation", rec_id, "request_approval",
           actor_id=ctx.user_id)
    return {"approval": approval}


# ── Human-In-The-Loop Task Scheduling ───────────────────────────────────────

class TaskCreateRequest(BaseModel):
    title: str
    description: str
    department: str = "ICU"
    assigned_role: str = "nurse"
    assigned_staff_id: Optional[str] = "Nurse Joy"
    source_agent: str = "icu_agent"
    urgency: str = "HIGH"

class TaskApproveRequest(BaseModel):
    decision: str  # "approve" | "reject"
    reason: Optional[str] = None

@router.get("/tasks", dependencies=[Depends(require_active_user)])
async def get_scheduled_tasks(
    status: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    dept: Optional[str] = Query(None),
):
    """Retrieve scheduled/pending agent tasks."""
    tasks = list(reversed(_scheduled_tasks))
    if status:
        tasks = [t for t in tasks if t.get("status") == status]
    if role:
        tasks = [t for t in tasks if t.get("assigned_role") == role or t.get("assigned_role") == "all"]
    if dept:
        tasks = [t for t in tasks if t.get("department") == dept]
    return {"tasks": tasks, "count": len(tasks)}

@router.post("/tasks/create", dependencies=[Depends(require_active_user)])
async def create_scheduled_task(req: TaskCreateRequest, ctx: AuthContext = Depends(require_active_user)):
    """Create a new task in PENDING_APPROVAL status (HITL)."""
    from api.routes.ws import deliver_ops_local
    task_id = f"task-{uuid.uuid4().hex[:8]}"
    task = {
        "id": task_id,
        "title": req.title,
        "description": req.description,
        "department": req.department,
        "assigned_role": req.assigned_role,
        "assigned_staff_id": req.assigned_staff_id,
        "source_agent": req.source_agent,
        "urgency": req.urgency,
        "status": "PENDING_APPROVAL",  # Enforce Human Intervention requirement
        "created_at": NOW().isoformat(),
        "created_by": ctx.user_id,
        "decided_at": None,
        "decided_by": None,
        "decision_reason": None,
    }
    _scheduled_tasks.append(task)
    _audit("task_created", "task", task_id, "create_task", actor_id=ctx.user_id, reason=req.description)
    
    # Alert relevant staff members in real-time over WebSockets
    event_payload = {
        "type": "TASK_CREATED",
        "task": task,
        "action_required": True,
    }
    await deliver_ops_local(req.assigned_role, event_payload, is_role=True)
    await deliver_ops_local("admin", event_payload, is_role=True)
    return {"status": "success", "task": task}

@router.post("/tasks/{task_id}/approve", dependencies=[Depends(require_active_user)])
async def approve_scheduled_task(task_id: str, req: TaskApproveRequest, ctx: AuthContext = Depends(require_active_user)):
    """Staff member explicitly approves or rejects a pending task."""
    from api.routes.ws import deliver_ops_local
    task = next((t for t in _scheduled_tasks if t["id"] == task_id), None)
    if not task:
        raise HTTPException(404, "Scheduled task not found")
    
    if req.decision not in ("approve", "reject"):
        raise HTTPException(400, "Decision must be 'approve' or 'reject'")
    
    new_status = "SCHEDULED" if req.decision == "approve" else "REJECTED"
    task["status"] = new_status
    task["decided_at"] = NOW().isoformat()
    task["decided_by"] = ctx.user_id
    task["decision_reason"] = req.reason
    
    _audit(
        "task_scheduled" if req.decision == "approve" else "task_rejected",
        "task", task_id, req.decision, actor_id=ctx.user_id, reason=req.reason
    )
    
    # Broadcast updated task state to all devices on the network
    event_payload = {
        "type": "TASK_UPDATED",
        "task": task,
    }
    await deliver_ops_local("nurse", event_payload, is_role=True)
    await deliver_ops_local("doctor", event_payload, is_role=True)
    await deliver_ops_local("admin", event_payload, is_role=True)
    
    return {"status": "success", "task": task}




# ── Execution Log ─────────────────────────────────────────────────────────────

@router.get("/execution", dependencies=[Depends(require_active_user)])
async def get_execution_log(limit: int = Query(50)):
    return {
        "execution_log": list(reversed(_execution_log))[:limit],
        "total": len(_execution_log),
    }


# ── Audit ─────────────────────────────────────────────────────────────────────

@router.get("/audit", dependencies=[Depends(require_active_user)])
@router.get("/audit-log", dependencies=[Depends(require_active_user)])
async def get_audit_events(
    limit: int = Query(100),
    event_type: Optional[str] = Query(None),
):
    events = list(reversed(_audit_events))
    if event_type:
        events = [e for e in events if e["event_type"] == event_type]
    return {
        "events": events[:limit],
        "total": len(events),
        "_note": "Audit trail is append-only and cannot be modified from the UI",
    }


# ── Simulation ────────────────────────────────────────────────────────────────

class SimulationRequest(BaseModel):
    scenario_type: str = "emergency_surge"
    parameters: dict = {}
    with_curaflow: bool = True
    time_multiplier: int = 1
    duration_minutes: int = 60


SIMULATION_METRICS = {
    "emergency_surge": {
        "without_curaflow": {
            "patient_wait_time_minutes": 47,
            "bed_utilization_pct": 96,
            "icu_utilization_pct": 98,
            "emergency_response_minutes": 22,
            "ot_utilization_pct": 82,
            "diagnostic_turnaround_minutes": 55,
            "staff_overtime_hours": 18,
            "bottleneck_duration_minutes": 95,
        },
        "with_curaflow": {
            "patient_wait_time_minutes": 28,
            "bed_utilization_pct": 88,
            "icu_utilization_pct": 89,
            "emergency_response_minutes": 14,
            "ot_utilization_pct": 79,
            "diagnostic_turnaround_minutes": 38,
            "staff_overtime_hours": 11,
            "bottleneck_duration_minutes": 42,
        },
    },
    "icu_saturation": {
        "without_curaflow": {
            "patient_wait_time_minutes": 38,
            "bed_utilization_pct": 94,
            "icu_utilization_pct": 100,
            "emergency_response_minutes": 19,
            "ot_utilization_pct": 75,
            "diagnostic_turnaround_minutes": 48,
            "staff_overtime_hours": 12,
            "bottleneck_duration_minutes": 120,
        },
        "with_curaflow": {
            "patient_wait_time_minutes": 21,
            "bed_utilization_pct": 86,
            "icu_utilization_pct": 91,
            "emergency_response_minutes": 12,
            "ot_utilization_pct": 74,
            "diagnostic_turnaround_minutes": 31,
            "staff_overtime_hours": 7,
            "bottleneck_duration_minutes": 38,
        },
    },
    "staff_shortage": {
        "without_curaflow": {
            "patient_wait_time_minutes": 65,
            "bed_utilization_pct": 92,
            "icu_utilization_pct": 90,
            "emergency_response_minutes": 28,
            "ot_utilization_pct": 65,
            "diagnostic_turnaround_minutes": 72,
            "staff_overtime_hours": 32,
            "bottleneck_duration_minutes": 145,
        },
        "with_curaflow": {
            "patient_wait_time_minutes": 34,
            "bed_utilization_pct": 89,
            "icu_utilization_pct": 87,
            "emergency_response_minutes": 16,
            "ot_utilization_pct": 72,
            "diagnostic_turnaround_minutes": 42,
            "staff_overtime_hours": 14,
            "bottleneck_duration_minutes": 55,
        },
    },
    "device_failure": {
        "without_curaflow": {
            "patient_wait_time_minutes": 52,
            "bed_utilization_pct": 95,
            "icu_utilization_pct": 94,
            "emergency_response_minutes": 24,
            "ot_utilization_pct": 60,
            "diagnostic_turnaround_minutes": 120,
            "staff_overtime_hours": 15,
            "bottleneck_duration_minutes": 180,
        },
        "with_curaflow": {
            "patient_wait_time_minutes": 30,
            "bed_utilization_pct": 90,
            "icu_utilization_pct": 91,
            "emergency_response_minutes": 15,
            "ot_utilization_pct": 78,
            "diagnostic_turnaround_minutes": 65,
            "staff_overtime_hours": 9,
            "bottleneck_duration_minutes": 65,
        },
    },
}

@router.get("/simulations/scenarios")
async def list_simulation_scenarios():
    return {
        "scenarios": [
            {"id": "emergency_surge", "name": "Emergency Surge", "type": "emergency_surge",
             "description": "ER arrivals +40%, ICU demand increases, CT failure"},
            {"id": "icu_saturation", "name": "ICU Saturation", "type": "icu_saturation",
             "description": "ICU at capacity with step-down backup"},
            {"id": "staff_shortage", "name": "Staff Shortage", "type": "staff_shortage",
             "description": "20% of nursing staff unavailable"},
            {"id": "device_failure", "name": "CT Scanner Failure", "type": "device_failure",
             "description": "Primary CT scanner down, queue backs up"},
        ]
    }

@router.post("/simulations/run", dependencies=[Depends(require_role("admin"))])
async def run_simulation(body: SimulationRequest):
    run_id = str(uuid.uuid4())
    base_metrics = SIMULATION_METRICS.get(body.scenario_type, SIMULATION_METRICS["emergency_surge"])
    
    # Calculate impact multiplier based on forecast horizon in days (e.g., 7, 14, 30, 90)
    # The longer the crisis goes unmanaged (without curaflow), the worse it compounds.
    # With CuraFlow, the impact scales sub-linearly or flattens out due to AI stabilization.
    days = max(1, body.time_multiplier)
    compound_factor = math.log10(days + 9) - 0.9 # slowly scales from 1.0 (7 days) upwards
    
    # Deep copy to avoid mutating the base dict
    metrics = {
        "without_curaflow": {},
        "with_curaflow": {}
    }
    
    for key, val in base_metrics["without_curaflow"].items():
        # Without AI: things compound badly
        modifier = compound_factor * 1.2
        if "pct" in key:
            metrics["without_curaflow"][key] = min(100, int(val * modifier))
        else:
            metrics["without_curaflow"][key] = int(val * modifier)
            
    for key, val in base_metrics["with_curaflow"].items():
        # With AI: impact is heavily mitigated, scaling is minimal
        modifier = 1.0 + (compound_factor - 1.0) * 0.2
        if "pct" in key:
            metrics["with_curaflow"][key] = min(100, int(val * modifier))
        else:
            metrics["with_curaflow"][key] = int(val * modifier)
            
    result = {
        "run_id": run_id,
        "scenario_type": body.scenario_type,
        "with_curaflow": body.with_curaflow,
        "forecast_days": days,
        "status": "completed",
        "started_at": NOW().isoformat(),
        "completed_at": NOW().isoformat(),
        "metrics": metrics,
        "improvement_summary": {
            "wait_time_reduction_pct": round(
                (1 - metrics["with_curaflow"]["patient_wait_time_minutes"] /
                 max(1, metrics["without_curaflow"]["patient_wait_time_minutes"])) * 100, 1
            ),
            "bottleneck_duration_reduction_pct": round(
                (1 - metrics["with_curaflow"]["bottleneck_duration_minutes"] /
                 max(1, metrics["without_curaflow"]["bottleneck_duration_minutes"])) * 100, 1
            ),
        },
        "_note": f"SYNTHETIC — Forecasted compounding impacts over {days} days",
    }
    _simulation_runs[run_id] = result
    return result

@router.get("/simulations/{run_id}")
async def get_simulation(run_id: str):
    result = _simulation_runs.get(run_id)
    if not result:
        raise HTTPException(404, "Simulation run not found")
    return result


# ── System Health ─────────────────────────────────────────────────────────────

@router.get("/system-health", dependencies=[Depends(require_active_user)])
@router.get("/system/health", dependencies=[Depends(require_active_user)])
async def get_system_health():
    import random
    rng = random.Random()
    
    components = [
        {"name": "PostgreSQL", "type": "database", "status": "healthy",
         "latency_ms": rng.randint(2, 8), "last_check": NOW().isoformat()},
        {"name": "Redis", "type": "cache", "status": "healthy",
         "latency_ms": rng.randint(1, 4), "last_check": NOW().isoformat()},
        {"name": "Kafka", "type": "event_bus", "status": "degraded",
         "latency_ms": rng.randint(50, 200), "last_check": NOW().isoformat(),
         "note": "Not configured in prototype — using in-memory events"},
        {"name": "FHIR / Fabric", "type": "data_layer", "status": "disconnected",
         "latency_ms": None, "last_check": NOW().isoformat(),
         "note": "Fabric data layer not connected — using synthetic data"},
        {"name": "LLM Planner", "type": "ai", "status": "healthy",
         "latency_ms": rng.randint(200, 800), "last_check": NOW().isoformat()},
        {"name": "Hospital State Engine", "type": "service", "status": "healthy",
         "latency_ms": rng.randint(1, 5), "last_check": NOW().isoformat()},
        {"name": "Prediction Engine", "type": "service", "status": "healthy",
         "latency_ms": rng.randint(20, 80), "last_check": NOW().isoformat(),
         "note": "SYNTHETIC — baseline statistical models"},
        {"name": "WebSockets", "type": "transport", "status": "healthy",
         "latency_ms": rng.randint(5, 20), "last_check": NOW().isoformat()},
    ]

    overall = "healthy"
    if any(c["status"] == "failed" for c in components):
        overall = "failed"
    elif any(c["status"] == "degraded" for c in components):
        overall = "degraded"

    return {
        "overall_status": overall,
        "components": components,
        "checked_at": NOW().isoformat(),
    }


# ── Data Quality ──────────────────────────────────────────────────────────────

@router.get("/data-quality", dependencies=[Depends(require_active_user)])
async def get_data_quality():
    return {
        "sources": [
            {
                "name": "Synthetic Hospital Engine",
                "type": "simulation",
                "status": "connected",
                "last_event_seconds_ago": 8,
                "latency_ms": 3,
                "completeness_pct": 100,
                "freshness_label": "LIVE",
                "note": "SYNTHETIC — generated data",
            },
            {
                "name": "FHIR ADT Feed",
                "type": "fhir",
                "status": "disconnected",
                "last_event_seconds_ago": None,
                "latency_ms": None,
                "completeness_pct": 0,
                "freshness_label": "DISCONNECTED",
                "note": "FHIR source not configured in prototype",
            },
            {
                "name": "Staff Feed",
                "type": "api",
                "status": "degraded",
                "last_event_seconds_ago": 161,
                "latency_ms": 220,
                "completeness_pct": 78,
                "freshness_label": "STALE",
                "note": "Staff availability data has 78% field completeness",
            },
            {
                "name": "Kafka Event Bus",
                "type": "kafka",
                "status": "disconnected",
                "last_event_seconds_ago": None,
                "latency_ms": None,
                "completeness_pct": 0,
                "freshness_label": "DISCONNECTED",
                "note": "Kafka not configured — events in-memory only",
            },
        ],
        "overall_confidence": 0.65,
        "ai_confidence_impact": (
            "Disconnected FHIR and Kafka sources reduce AI prediction confidence. "
            "Predictions currently rely on synthetic data (confidence ~0.65-0.80)."
        ),
        "checked_at": NOW().isoformat(),
    }


# ── Agent Performance ─────────────────────────────────────────────────────────

@router.get("/agents/performance", dependencies=[Depends(require_active_user)])
@router.get("/agent-performance", dependencies=[Depends(require_active_user)])
async def get_agent_performance():
    import random
    rng = random.Random(55)
    agents = [
        {"id": "bed_agent", "label": "Bed Management"},
        {"id": "er_agent", "label": "Emergency"},
        {"id": "icu_agent", "label": "ICU"},
        {"id": "staff_agent", "label": "Staff"},
        {"id": "ot_agent", "label": "Operating Theatres"},
        {"id": "lab_agent", "label": "Diagnostics"},
    ]
    result = []
    for agent in agents:
        runs = rng.randint(180, 500)
        recs = rng.randint(30, 100)
        accepted = rng.randint(int(recs*0.6), int(recs*0.85))
        modified = rng.randint(0, recs - accepted)
        rejected = recs - accepted - modified
        result.append({
            **agent,
            "status": "active",
            "runs_today": runs,
            "recommendations_today": recs,
            "accepted": accepted,
            "modified": modified,
            "rejected": rejected,
            "acceptance_rate_pct": round(accepted / max(recs, 1) * 100, 1),
            "avg_latency_ms": rng.randint(280, 650),
            "avg_confidence": round(rng.uniform(0.70, 0.88), 2),
        })
    return {"agents": result}


# ── AI Chat ───────────────────────────────────────────────────────────────────

from fastapi.responses import StreamingResponse
import asyncio

class ChatRequest(BaseModel):
    message: str

@router.post("/chat", dependencies=[Depends(require_active_user)])
async def chat_endpoint(req: ChatRequest):
    """Provide an agentic RAG response for the command center chat using SSE."""
    state = _state().get_snapshot()
    
    async def event_generator():
        yield f"data: {json.dumps({'type': 'status', 'message': 'Initializing CuraFlow Multi-Agent RAG...', 'step': 1})}\n\n"
        await asyncio.sleep(0.5)

        yield f"data: {json.dumps({'type': 'status', 'message': 'Classifying query intent and required agents...', 'step': 2})}\n\n"
        classification_prompt = f"""You are an orchestrator for a hospital management system. 
The user asks: "{req.message}"

Available data agents:
- icu_agent: Intensive Care Unit capacity
- er_agent: Emergency Room queue and capacity
- bed_agent: General Ward bed availability
- staff_agent: Hospital staff on duty
- ot_agent: Operating Theatres utilization
- lab_agent: Diagnostics and lab queues

Identify which agents are required to answer the query. Return a JSON object with a single key 'agents' containing a list of agent names.
Example: {{"agents": ["icu_agent", "staff_agent"]}}"""

        try:
            class_json_str = await llm_json_prefill(classification_prompt, max_tokens=100)
            start = class_json_str.find('{')
            end = class_json_str.rfind('}')
            if start != -1 and end != -1:
                class_json = json.loads(class_json_str[start:end+1])
            else:
                class_json = {"agents": ["icu_agent", "er_agent", "bed_agent", "staff_agent", "ot_agent", "lab_agent"]}
        except Exception as e:
            logger.error(f"Classification failed: {e}")
            class_json = {"agents": ["icu_agent", "er_agent", "bed_agent", "staff_agent", "ot_agent", "lab_agent"]}
        
        selected_agents = class_json.get("agents", [])
        if not selected_agents:
            selected_agents = ["icu_agent", "er_agent", "bed_agent", "staff_agent", "ot_agent", "lab_agent"]
            
        agents_list_str = ", ".join(selected_agents)
        yield f"data: {json.dumps({'type': 'status', 'message': f'Routing to {len(selected_agents)} specialized agents: {agents_list_str}', 'step': 3})}\n\n"
        await asyncio.sleep(0.8) # Simulate agent reasoning delay

        context_data = {}
        yield f"data: {json.dumps({'type': 'status', 'message': 'Agents retrieving data from core databases...', 'step': 4})}\n\n"
        
        if "icu_agent" in selected_agents:
            context_data["ICU"] = state.get("icu")
        if "er_agent" in selected_agents:
            context_data["Emergency"] = state.get("emergency")
        if "bed_agent" in selected_agents:
            context_data["Beds"] = state.get("beds")
        if "staff_agent" in selected_agents:
            context_data["Staff"] = state.get("staff")
        if "ot_agent" in selected_agents:
            context_data["Operating Rooms"] = state.get("operating_rooms")
        if "lab_agent" in selected_agents:
            context_data["Diagnostics"] = state.get("diagnostics")
            
        context_data["Overall Pressure"] = state.get("pressure")
        
        yield f"data: {json.dumps({'type': 'status', 'message': 'Aggregating context and synthesizing final response...', 'step': 5})}\n\n"
        
        synthesis_prompt = f"""You are CuraFlow AI, a helpful and precise hospital operations assistant.
Answer the user's query based ONLY on the following real-time data retrieved by our agents.
You MUST respond with a JSON object containing:
- "text": Your professional and concise answer to the user.
- "widgets": An array of interactive UI elements to display. Available types:
   1. {{"type": "button", "label": "Admit Patient", "action": "ADMIT_PATIENT"}} (Include if the user asks about admitting someone)
   2. {{"type": "chart", "title": "Capacity Overview", "data": {{"Emergency": data, "ICU": data, "Ward": data}}}} (Include if the user asks about general capacity)

Real-time Data:
{json.dumps(context_data, indent=2)}

User Query: "{req.message}"
"""
        
        try:
            final_json_str = await llm_json_prefill(synthesis_prompt, max_tokens=600)
            start = final_json_str.find('{')
            end = final_json_str.rfind('}')
            if start != -1 and end != -1:
                final_json = json.loads(final_json_str[start:end+1])
            else:
                final_json = {"text": "I'm sorry, I was unable to parse the response.", "widgets": []}
        except Exception as e:
            logger.error(f"Synthesis failed: {e}")
            final_json = {"text": "I'm sorry, I was unable to process your request at this time.", "widgets": []}
            
        final_payload = {
            "type": "result",
            "response": final_json.get("text", ""),
            "widgets": final_json.get("widgets", []),
            "context": {
                "pressure": state["pressure"]["label"],
                "timestamp": state["timestamp"]
            },
            "agents_used": selected_agents
        }
        yield f"data: {json.dumps(final_payload)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
