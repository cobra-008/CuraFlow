"""Hospital overview stats endpoint.

GET /api/hospital/stats  — returns live operational counts:
  beds, staff, OT, patients, visits, claims, departments
"""
import logging
import httpx
from fastapi import APIRouter, Depends
from api.routes.auth import AuthContext, require_role
from config import settings

logger = logging.getLogger("hospital")
router = APIRouter()

HASURA_BASE = settings.hasura_url.replace('/v1/graphql', '')
HASURA_SQL_URL = HASURA_BASE.rstrip('/') + '/v2/query'
HASURA_HEADERS = {
    'x-hasura-admin-secret': settings.hasura_admin_secret,
    'Content-Type': 'application/json',
}


async def run_sql(sql: str) -> list:
    async with httpx.AsyncClient() as client:
        r = await client.post(
            HASURA_SQL_URL,
            headers=HASURA_HEADERS,
            json={'type': 'run_sql', 'args': {'sql': sql}},
            timeout=15.0,
        )
        r.raise_for_status()
        data = r.json()
        rows = data.get('result', [])
        if len(rows) < 2:
            return []
        cols = rows[0]
        return [dict(zip(cols, row)) for row in rows[1:]]


@router.get("/stats")
async def get_hospital_stats(ctx: AuthContext = Depends(require_role("admin", "doctor", "approver"))):
    """Aggregate hospital operational stats from the hospilot schema using raw SQL."""
    try:
        sql = """
        SELECT
            -- Beds
            (SELECT COUNT(*) FROM hospilot.beds)::int                                            AS beds_total,
            (SELECT COUNT(*) FROM hospilot.beds WHERE status = 'available')::int                 AS beds_available,
            (SELECT COUNT(*) FROM hospilot.beds WHERE status = 'occupied')::int                  AS beds_occupied,
            (SELECT COUNT(*) FROM hospilot.beds WHERE status IN ('cleaning','maintenance'))::int  AS beds_cleaning,

            -- Staff
            (SELECT COALESCE(SUM(headcount),0) FROM hospilot.staff_roster)::int                 AS staff_total,
            (SELECT COALESCE(SUM(headcount),0) FROM hospilot.staff_roster WHERE shift='morning')::int AS staff_online,
            (SELECT COALESCE(SUM(headcount),0) FROM hospilot.staff_roster WHERE shift='evening')::int AS staff_standby,
            (SELECT COALESCE(SUM(headcount),0) FROM hospilot.staff_roster WHERE shift='night')::int   AS staff_offline,

            -- OT
            (SELECT COUNT(*) FROM hospilot.ot_surgeries)::int                                     AS ot_total,
            (SELECT COUNT(*) FROM hospilot.ot_surgeries WHERE status='in_progress')::int          AS ot_in_progress,
            (SELECT COUNT(*) FROM hospilot.ot_surgeries WHERE status='scheduled')::int            AS ot_scheduled,
            (SELECT COUNT(*) FROM hospilot.ot_surgeries WHERE status='completed')::int            AS ot_completed,

            -- Patients
            (SELECT COUNT(*) FROM hospilot.ipd_admissions WHERE status='admitted')::int          AS pts_admitted,
            (SELECT COUNT(*) FROM hospilot.ipd_admissions WHERE discharge_ready=true)::int       AS pts_discharge_ready,
            (SELECT COUNT(*) FROM hospilot.visits WHERE status='waiting')::int                   AS pts_waiting,

            -- Visits
            (SELECT COUNT(*) FROM hospilot.visits)::int                                          AS visits_total,
            (SELECT COUNT(*) FROM hospilot.visits WHERE visit_type='emergency')::int             AS visits_emergency,
            (SELECT COUNT(*) FROM hospilot.visits WHERE visit_type='opd')::int                  AS visits_opd,

            -- Claims
            (SELECT COUNT(*) FROM hospilot.claims WHERE status='pending')::int                   AS claims_pending,
            (SELECT COUNT(*) FROM hospilot.claims WHERE status='approved')::int                  AS claims_approved,
            (SELECT COUNT(*) FROM hospilot.claims WHERE status='under_review')::int              AS claims_review,
            (SELECT COUNT(*) FROM hospilot.claims WHERE status='rejected')::int                  AS claims_rejected
        """

        rows = await run_sql(sql)
        s = rows[0] if rows else {}

        # Staff by role
        by_role_rows = await run_sql(
            "SELECT role, COALESCE(SUM(headcount),0)::int AS total FROM hospilot.staff_roster GROUP BY role ORDER BY total DESC"
        )
        by_role = {r['role']: int(r['total']) for r in by_role_rows}

        # Doctor slots
        slot_rows = await run_sql(
            "SELECT status, specialization, COUNT(*)::int AS cnt FROM hospilot.doctor_slots GROUP BY status, specialization"
        )
        spec_map: dict[str, int] = {}
        ds_avail = 0
        ds_booked = 0
        for r in slot_rows:
            spec = r.get('specialization') or 'General'
            cnt = int(r['cnt'])
            spec_map[spec] = spec_map.get(spec, 0) + cnt
            if r['status'] == 'available':
                ds_avail += cnt
            elif r['status'] in ('booked', 'completed'):
                ds_booked += cnt

        # Department list
        dept_rows = await run_sql(
            "SELECT name, COALESCE(capacity,0) AS capacity FROM hospilot.departments ORDER BY name"
        )
        # Occupancy: count IPD admissions per dept
        occ_rows = await run_sql(
            """
            SELECT d.name, COUNT(a.id)::int AS occupied
            FROM hospilot.departments d
            LEFT JOIN hospilot.ipd_admissions a ON a.department_id = d.id AND a.status = 'admitted'
            GROUP BY d.name
            """
        )
        occ_map = {r['name']: int(r['occupied']) for r in occ_rows}
        depts = [{'name': r['name'], 'capacity': int(r['capacity']), 'occupied': occ_map.get(r['name'], 0)} for r in dept_rows]

        total_slots = sum(int(r['cnt']) for r in slot_rows)

        def _i(val): return int(val) if val is not None else 0

        return {
            "beds": {
                "total": _i(s.get("beds_total")),
                "available": _i(s.get("beds_available")),
                "occupied": _i(s.get("beds_occupied")),
                "cleaning": _i(s.get("beds_cleaning")),
            },
            "staff": {
                "total": _i(s.get("staff_total")),
                "online": _i(s.get("staff_online")),
                "standby": _i(s.get("staff_standby")),
                "offline": _i(s.get("staff_offline")),
                "by_role": by_role,
            },
            "doctors": {
                "total_slots": total_slots,
                "available": ds_avail,
                "booked": ds_booked,
                "specializations": spec_map,
            },
            "ot": {
                "total": _i(s.get("ot_total")),
                "in_progress": _i(s.get("ot_in_progress")),
                "scheduled": _i(s.get("ot_scheduled")),
                "completed": _i(s.get("ot_completed")),
            },
            "patients": {
                "admitted": _i(s.get("pts_admitted")),
                "discharge_ready": _i(s.get("pts_discharge_ready")),
                "waiting": _i(s.get("pts_waiting")),
            },
            "visits": {
                "total_today": _i(s.get("visits_total")),
                "emergency": _i(s.get("visits_emergency")),
                "opd": _i(s.get("visits_opd")),
            },
            "claims": {
                "pending": _i(s.get("claims_pending")),
                "approved": _i(s.get("claims_approved")),
                "under_review": _i(s.get("claims_review")),
                "rejected": _i(s.get("claims_rejected")),
            },
            "departments": depts,
        }
    except Exception as e:
        logger.error("hospital stats error: %s", e)
        raise
