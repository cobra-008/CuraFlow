"""
Seed script: creates a default organization and seeds the agent/subagent/task registries
into Hasura so the Hospilot UI fully works.
"""
import asyncio
import httpx

HASURA_URL = 'http://localhost:8080/v1/graphql'
HASURA_SECRET = 'hospilot-dev-secret'
HEADERS = {'x-hasura-admin-secret': HASURA_SECRET, 'Content-Type': 'application/json'}


def gql(query: str, variables: dict = None) -> dict:
    r = httpx.post(HASURA_URL, headers=HEADERS,
                   json={"query": query, "variables": variables or {}}, timeout=30)
    r.raise_for_status()
    data = r.json()
    if 'errors' in data:
        raise Exception(f"GraphQL error: {data['errors']}")
    return data['data']


# ── 1. Create Default Organization ───────────────────────────────────────────
print("Creating default organization...")
try:
    result = gql("""
        mutation CreateOrg($name: String!, $slug: String!) {
            insert_hospilot_app_organizations_one(
                object: { name: $name, slug: $slug, status: "active" }
                on_conflict: { constraint: organizations_slug_key, update_columns: [name, status] }
            ) { id name slug status }
        }
    """, {"name": "General Hospital", "slug": "general"})
    org = result['insert_hospilot_app_organizations_one']
    print(f"  ✅ Organization: {org['name']} (id={org['id']})")
except Exception as e:
    print(f"  ❌ Organization error: {e}")

# ── 2. Seed Agent Registry ────────────────────────────────────────────────────
AGENTS = [
    {"id": "bed_agent",                 "label": "Bed Management",      "color": "#3b82f6", "emoji": "🛏️",  "sort_order": 10,
     "description": "Owns finding/reserving a specific bed for a specific patient NOW; when ICU is full it also recovers dirty ICU beds"},
    {"id": "icu_agent",                 "label": "ICU Operations",      "color": "#8b5cf6", "emoji": "💊",  "sort_order": 20,
     "description": "Owns ICU census, capacity, step-down, critical-patient escalation"},
    {"id": "er_agent",                  "label": "ER Coordination",     "color": "#ef4444", "emoji": "🚨",  "sort_order": 30,
     "description": "Owns emergency department flow: triage, CTAS scoring, fast-track, admission selection, boarding"},
    {"id": "staff_agent",               "label": "Staffing",            "color": "#f59e0b", "emoji": "👩‍⚕️", "sort_order": 40,
     "description": "Owns nurse-to-patient ratios, shift coverage, float-pool deployment"},
    {"id": "discharge_agent",           "label": "Discharge Planning",  "color": "#10b981", "emoji": "🏠",  "sort_order": 50,
     "description": "Owns getting patients out of the hospital entirely (home/SNF)"},
    {"id": "pharmacy_agent",            "label": "Pharmacy",            "color": "#06b6d4", "emoji": "💊",  "sort_order": 60,
     "description": "Owns drug stock, dispensing queue, STAT orders, interactions, substitutions"},
    {"id": "lab_agent",                 "label": "Lab Operations",      "color": "#06b6d4", "emoji": "🔬",  "sort_order": 70,
     "description": "Owns lab order tracking, sample management, TAT, critical-result escalation"},
    {"id": "ot_agent",                  "label": "OT Scheduling",       "color": "#7c3aed", "emoji": "🔪",  "sort_order": 80,
     "description": "Owns live operating-theatre scheduling: today's surgical list, theatre capacity, emergency case insertion"},
    {"id": "revenue_agent",             "label": "Revenue",             "color": "#f97316", "emoji": "💰",  "sort_order": 90,
     "description": "Predict & prevent revenue loss: billing-gap review, package profitability, insurance denial-risk prevention"},
    {"id": "billing_agent",             "label": "Billing",             "color": "#0ea5e9", "emoji": "🧾",  "sort_order": 100,
     "description": "Execute billing operations: claim validation, collections, invoice lookup, bill generation"},
    {"id": "ambulance_agent",           "label": "Ambulance Dispatch",  "color": "#ef4444", "emoji": "🚑",  "sort_order": 110,
     "description": "Owns ambulance dispatch / pre-arrival coordination"},
    {"id": "patient_verification_agent","label": "Patient Verification","color": "#14b8a6", "emoji": "🪪",  "sort_order": 120,
     "description": "Owns establishing patient identity (mobile → patient_token + vitals)"},
]

print("\nSeeding agent registry...")
for agent in AGENTS:
    try:
        gql("""
            mutation UpsertAgent($id: String!, $label: String!, $color: String!, 
                                  $emoji: String!, $description: String!, $sort_order: Int!) {
                insert_hospilot_app_agent_registry_one(
                    object: { id: $id, label: $label, color: $color, emoji: $emoji,
                              description: $description, sort_order: $sort_order, is_active: true }
                    on_conflict: { constraint: agent_registry_pkey, 
                                   update_columns: [label, color, emoji, description, sort_order, is_active] }
                ) { id }
            }
        """, agent)
        print(f"  ✅ Agent: {agent['id']}")
    except Exception as e:
        print(f"  ❌ Agent {agent['id']}: {e}")

# ── 3. Seed key Subagent + Task entries ───────────────────────────────────────
SUBAGENTS = [
    # bed_agent
    {"id": "sa_bed_availability", "agent_id": "bed_agent", "label": "Bed Availability", "sort_order": 10,
     "description": "Identifies all available beds that are clean, unblocked, and ready for a patient",
     "capabilities": "bed-census,availability", "is_prefetch_eligible": True},
    {"id": "sa_bed_ranking",      "agent_id": "bed_agent", "label": "Bed Assignment",   "sort_order": 20,
     "description": "Uses clinical AI to recommend the best available bed based on the patient's needs",
     "capabilities": "bed-ranking,assignment", "is_prefetch_eligible": False},
    {"id": "sa_bed_reservation",  "agent_id": "bed_agent", "label": "Bed Reservation",  "sort_order": 30,
     "description": "Reserves the selected bed and notifies the receiving ward after clinical approval",
     "capabilities": "bed-reservation", "is_prefetch_eligible": False},
    # icu_agent
    {"id": "sa_icu_census",    "agent_id": "icu_agent", "label": "ICU Census",          "sort_order": 10,
     "description": "Reviews current ICU occupancy, active admissions, and available beds",
     "capabilities": "icu-census", "is_prefetch_eligible": True},
    {"id": "sa_icu_stepdown",  "agent_id": "icu_agent", "label": "Step-Down Coordinator", "sort_order": 20,
     "description": "Confirms clinical criteria for step-down (ICU-to-ward internal transfer)",
     "capabilities": "icu-stepdown", "is_prefetch_eligible": False},
    # er_agent
    {"id": "sa_er_triage",    "agent_id": "er_agent", "label": "Triage Monitor",        "sort_order": 10,
     "description": "Pulls the active ER queue and scores/persists CTAS triage for every patient",
     "capabilities": "er-triage", "is_prefetch_eligible": True},
    {"id": "sa_er_disposition","agent_id": "er_agent", "label": "Disposition Coordinator","sort_order": 20,
     "description": "Routes triaged patients to fast-track/OPD or inpatient admission",
     "capabilities": "er-disposition", "is_prefetch_eligible": False},
    # staff_agent
    {"id": "sa_ratio_monitor", "agent_id": "staff_agent", "label": "Ratio Monitor",     "sort_order": 10,
     "description": "Reviews nurse-to-patient ratios across all wards and flags understaffed areas",
     "capabilities": "staffing-ratios", "is_prefetch_eligible": True},
    {"id": "sa_float_pool",    "agent_id": "staff_agent", "label": "Float Pool Dispatcher","sort_order": 20,
     "description": "Covers staffing shortfalls by deploying available float nurses",
     "capabilities": "float-pool", "is_prefetch_eligible": False},
    # discharge_agent
    {"id": "sa_discharge_ready",   "agent_id": "discharge_agent", "label": "Readiness Assessor","sort_order": 10,
     "description": "Reviews each admitted patient to determine if they are clinically ready for discharge",
     "capabilities": "discharge-readiness", "is_prefetch_eligible": True},
    {"id": "sa_discharge_barriers","agent_id": "discharge_agent", "label": "Discharge Approver","sort_order": 20,
     "description": "Awaits human approval then commits discharge-ready status and frees the bed",
     "capabilities": "discharge-approval", "is_prefetch_eligible": False},
    # pharmacy_agent
    {"id": "sa_stock_monitor", "agent_id": "pharmacy_agent", "label": "Stock Monitor",  "sort_order": 10,
     "description": "Reviews current medication stock levels and flags drugs running low",
     "capabilities": "pharmacy-stock", "is_prefetch_eligible": True},
    # ambulance_agent
    {"id": "sa_ambulance_census",   "agent_id": "ambulance_agent", "label": "Fleet Census",      "sort_order": 10,
     "description": "Fetches the full ambulance fleet and caches it in Redis",
     "capabilities": "ambulance-census", "is_prefetch_eligible": True},
    {"id": "sa_ambulance_dispatch", "agent_id": "ambulance_agent", "label": "Dispatch Coordinator","sort_order": 20,
     "description": "Assigns the best available unit and creates a dispatch approval",
     "capabilities": "ambulance-dispatch", "is_prefetch_eligible": False},
]

print("\nSeeding subagent registry...")
for sa in SUBAGENTS:
    try:
        gql("""
            mutation UpsertSubagent($id: String!, $agent_id: String!, $label: String!, 
                                    $description: String!, $capabilities: String!,
                                    $is_prefetch_eligible: Boolean!, $sort_order: Int!) {
                insert_hospilot_app_subagent_registry_one(
                    object: { id: $id, agent_id: $agent_id, label: $label, 
                              description: $description, capabilities: $capabilities,
                              is_prefetch_eligible: $is_prefetch_eligible,
                              sort_order: $sort_order, is_active: true }
                    on_conflict: { constraint: subagent_registry_pkey, 
                                   update_columns: [label, description, sort_order, is_active] }
                ) { id }
            }
        """, sa)
        print(f"  ✅ Subagent: {sa['id']}")
    except Exception as e:
        print(f"  ❌ Subagent {sa['id']}: {e}")

# ── 4. Seed key Tasks ─────────────────────────────────────────────────────────
TASKS = [
    # bed_agent tasks
    {"id": "ta_query_beds",         "subagent_id": "sa_bed_availability", "label": "Query all available beds", "sort_order": 10,
     "description": "Query all available beds — always include; returns counts by type", "outputs": ["candidate_count","icu_count","hdu_count","general_count","ventilator_count","candidates"]},
    {"id": "ta_rank_beds",          "subagent_id": "sa_bed_ranking",      "label": "Rank candidate beds",     "sort_order": 10,
     "description": "Rank candidate beds for this patient — always include when reserving", "outputs": ["ranked_beds","recommendation"]},
    {"id": "ta_create_approval",    "subagent_id": "sa_bed_reservation",  "label": "Lock bed and create approval","sort_order": 10,
     "description": "Lock bed and create approval task — always include when reserving", "outputs": ["approval_id","bed_id"]},
    {"id": "ta_confirm_reservation","subagent_id": "sa_bed_reservation",  "label": "Confirm reservation post-approval","sort_order": 20,
     "description": "Confirm reservation post-approval — always include when reserving", "outputs": ["bed_id","status"]},
    # icu_agent tasks
    {"id": "ta_get_icu_census",     "subagent_id": "sa_icu_census",    "label": "Query ICU occupancy",   "sort_order": 10,
     "description": "Query ICU occupancy, current admissions, and available beds from Redis", "outputs": ["icu_available","available_beds","icu_admissions"]},
    {"id": "ta_analyze_icu_status", "subagent_id": "sa_icu_stepdown",  "label": "Analyse step-down eligibility","sort_order": 10,
     "description": "Analyse step-down and escalation eligibility with Claude", "outputs": ["step_down_candidates","transfer_candidate_count"]},
    # er_agent tasks
    {"id": "ta_get_er_visits",      "subagent_id": "sa_er_triage",    "label": "Query active ER queue",  "sort_order": 10,
     "description": "Query the active ER visit queue from Redis — always include", "outputs": ["visits"]},
    {"id": "ta_triage_patients",    "subagent_id": "sa_er_triage",    "label": "Score and triage ER patients","sort_order": 20,
     "description": "Score and triage ER patients with Claude", "outputs": ["triaged","ctas1","ctas2","critical","fasttrack_count","admission_candidate_count"]},
    {"id": "ta_route_fasttrack",    "subagent_id": "sa_er_disposition","label": "Route low-acuity fast-track","sort_order": 10,
     "description": "Route low-acuity patients (CTAS 4-5) to fast-track / OPD diversion", "outputs": ["fasttrack_candidates"]},
    # staff_agent tasks
    {"id": "ta_get_ward_workload",  "subagent_id": "sa_ratio_monitor","label": "Aggregate ward workload", "sort_order": 10,
     "description": "Aggregate patients and task load per ward from admissions + clinical tasks", "outputs": ["workload"]},
    {"id": "ta_analyze_staff_workload","subagent_id": "sa_ratio_monitor","label": "Analyse ward staffing","sort_order": 20,
     "description": "Analyse ward workload; flag high-pressure wards and recommend same-type staff moves", "outputs": ["recommendations","high_pressure_wards","summary"]},
    {"id": "ta_create_staff_approval","subagent_id": "sa_float_pool","label": "Create float pool deployment approval","sort_order": 10,
     "description": "Create float pool deployment approval", "outputs": ["created"]},
    # discharge_agent tasks
    {"id": "ta_get_discharge_candidates","subagent_id": "sa_discharge_ready","label": "Fetch discharge candidates","sort_order": 10,
     "description": "Fetch active admissions and discharge checklists", "outputs": ["candidates","count"]},
    {"id": "ta_batch_assess_discharges","subagent_id": "sa_discharge_ready","label": "Assess discharge readiness","sort_order": 20,
     "description": "Assess discharge readiness for each patient", "outputs": ["assessed","ready","blocked"]},
    {"id": "ta_create_discharge_approval","subagent_id": "sa_discharge_barriers","label": "Create discharge approval","sort_order": 10,
     "description": "Create discharge approval task in Hasura", "outputs": ["approval_id"]},
    # pharmacy_agent tasks
    {"id": "ta_get_discharge_patients","subagent_id": "sa_stock_monitor","label": "Fetch discharge patients for med reconciliation","sort_order": 10,
     "description": "Fetch discharge-ready patients for medication reconciliation", "outputs": ["patients"]},
    {"id": "ta_check_medication_reconciliation","subagent_id": "sa_stock_monitor","label": "Check medication reconciliation","sort_order": 20,
     "description": "Check medication reconciliation gaps", "outputs": ["gaps","stock_hours_remaining"]},
    # ambulance_agent tasks
    {"id": "ta_get_available_ambulances","subagent_id": "sa_ambulance_census","label": "Fetch ambulance fleet","sort_order": 10,
     "description": "Fetch ambulance fleet data", "outputs": ["ambulances"]},
    {"id": "ta_assign_ambulance",    "subagent_id": "sa_ambulance_dispatch","label": "Assign ambulance unit","sort_order": 10,
     "description": "Assign best available unit, surface ETA and crew, flag escalation", "outputs": ["assigned_vehicle_no","eta_mins","escalate"]},
    {"id": "ta_create_ambulance_approval","subagent_id": "sa_ambulance_dispatch","label": "Create dispatch approval","sort_order": 20,
     "description": "Create dispatch approval task", "outputs": ["approval_id"]},
]

print("\nSeeding task registry...")
import json
for task in TASKS:
    try:
        gql("""
            mutation UpsertTask($id: String!, $subagent_id: String!, $label: String!, 
                                $description: String!, $outputs: jsonb!, $sort_order: Int!) {
                insert_hospilot_app_task_registry_one(
                    object: { id: $id, subagent_id: $subagent_id, label: $label,
                              description: $description, outputs: $outputs,
                              is_dynamic: false, is_active: true, sort_order: $sort_order }
                    on_conflict: { constraint: task_registry_pkey, 
                                   update_columns: [label, description, outputs, sort_order, is_active] }
                ) { id }
            }
        """, {**task, "outputs": task["outputs"]})
        print(f"  ✅ Task: {task['id']}")
    except Exception as e:
        print(f"  ❌ Task {task['id']}: {e}")

print("\n🎉 Seed complete!")
print("\nVerification:")
r = gql("query { hospilot_app_organizations { id name slug status } }")
print(f"  Organizations: {r['hospilot_app_organizations']}")
r = gql("query { hospilot_app_agent_registry_aggregate { aggregate { count } } }")
print(f"  Agents: {r['hospilot_app_agent_registry_aggregate']['aggregate']['count']}")
r = gql("query { hospilot_app_subagent_registry_aggregate { aggregate { count } } }")
print(f"  Subagents: {r['hospilot_app_subagent_registry_aggregate']['aggregate']['count']}")
r = gql("query { hospilot_app_task_registry_aggregate { aggregate { count } } }")
print(f"  Tasks: {r['hospilot_app_task_registry_aggregate']['aggregate']['count']}")
