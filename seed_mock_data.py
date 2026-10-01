"""
Populate the hospilot schema with rich, realistic mock hospital data.
Run from the project root with the venv active.
"""
import httpx, uuid, random
from datetime import datetime, timedelta

HASURA = 'http://localhost:8080/v2/query'
HEADERS = {'x-hasura-admin-secret': 'hospilot-dev-secret', 'Content-Type': 'application/json'}

def run_sql(sql: str):
    r = httpx.post(HASURA, headers=HEADERS, json={'type': 'run_sql', 'args': {'sql': sql}}, timeout=30)
    if r.status_code != 200:
        print(f'ERROR: {r.text[:300]}')
    else:
        print(f'OK: {sql[:80].strip()!r}')

now = datetime.utcnow()

# ── Departments ────────────────────────────────────────────────────────────────
dept_ids = {name: str(uuid.uuid4()) for name in [
    'Emergency', 'ICU', 'General Ward', 'Cardiology', 'Orthopedics',
    'Neurology', 'Pediatrics', 'Oncology', 'Gynecology', 'Radiology'
]}
dept_values = ',\n'.join([
    f"('{did}', '{name}', 'clinical', {cap}, 80)"
    for (name, did), cap in zip(dept_ids.items(), [40, 20, 100, 50, 40, 30, 60, 25, 35, 20])
])
run_sql(f"""
INSERT INTO hospilot.departments (id, name, type, capacity, target_occupancy_pct)
VALUES {dept_values}
ON CONFLICT DO NOTHING;
""")

# ── Beds ───────────────────────────────────────────────────────────────────────
branch_id = str(uuid.uuid4())
bed_rows = []
bed_ids = []
wards = list(dept_ids.keys())
statuses_pool = ['available'] * 5 + ['occupied'] * 8 + ['cleaning'] * 2 + ['maintenance'] * 1
for i in range(1, 81):
    bid = str(uuid.uuid4())
    bed_ids.append(bid)
    ward = random.choice(wards)
    status = random.choice(statuses_pool)
    floor = random.randint(1, 5)
    wing = random.choice(['A', 'B', 'C'])
    bed_rows.append(f"('{bid}', '{branch_id}', '{ward}', 'BED-{i:03d}', 'general', '{status}', true, {floor}, '{wing}')")

beds_sql = ',\n'.join(bed_rows)
run_sql(f"""
INSERT INTO hospilot.beds (id, branch_id, ward, bed_number, room_type, status, is_active, floor, wing)
VALUES {beds_sql}
ON CONFLICT DO NOTHING;
""")

# ── Staff Roster ───────────────────────────────────────────────────────────────
shifts = ['morning', 'evening', 'night']
roles = [
    ('Doctor', ['Emergency', 'ICU', 'Cardiology', 'Orthopedics', 'Neurology', 'Pediatrics']),
    ('Nurse', ['General Ward', 'ICU', 'Emergency', 'Pediatrics', 'Oncology']),
    ('Technician', ['Radiology', 'Oncology']),
    ('Pharmacist', ['General Ward', 'Cardiology']),
    ('Administrator', ['General Ward', 'Gynecology']),
]
staff_rows = []
for role, areas in roles:
    for shift in shifts:
        for area in areas:
            sid = str(uuid.uuid4())
            headcount = random.randint(3, 12)
            load = random.randint(headcount, headcount * 3)
            lps = round(load / max(headcount, 1))
            status = random.choice(['online', 'online', 'online', 'standby', 'offline'])
            staff_rows.append(
                f"('{sid}', '{area}', '{area} {role}s', '{role}', '{shift}', {headcount}, {load}, {lps}, '{branch_id}')"
            )

staff_sql = ',\n'.join(staff_rows)
run_sql(f"""
INSERT INTO hospilot.staff_roster (id, area, area_label, role, shift, headcount, assigned_load, load_per_staff, branch_id)
VALUES {staff_sql}
ON CONFLICT DO NOTHING;
""")

# ── Doctor Slots (today) ───────────────────────────────────────────────────────
today = now.date()
specializations = ['Cardiology', 'Orthopedics', 'Neurology', 'Pediatrics', 'Oncology', 'Gynecology', 'General']
slot_rows = []
for i in range(60):
    slot_id = str(uuid.uuid4())
    provider_id = str(uuid.uuid4())
    hour = random.randint(8, 18)
    slot_start = f'{hour:02d}:00:00'
    slot_end = f'{hour+1:02d}:00:00'
    status = random.choice(['available', 'available', 'booked', 'booked', 'completed'])
    max_p = random.randint(5, 15)
    booked = random.randint(0, max_p) if status != 'available' else 0
    spec = random.choice(specializations)
    slot_rows.append(
        f"('{slot_id}', '{provider_id}', '{today}', '{slot_start}', '{slot_end}', 'outpatient', '{status}', {max_p}, {booked}, '{spec}')"
    )

slots_sql = ',\n'.join(slot_rows)
run_sql(f"""
INSERT INTO hospilot.doctor_slots (id, provider_id, slot_date, slot_start, slot_end, slot_type, status, max_patients, booked_count, specialization)
VALUES {slots_sql}
ON CONFLICT DO NOTHING;
""")

# ── Patients ───────────────────────────────────────────────────────────────────
first_names = ['Arjun', 'Priya', 'Rajan', 'Meena', 'Vikram', 'Lakshmi', 'Suresh', 'Kavitha', 'Deepak', 'Nisha',
               'Mohammed', 'Sunita', 'Ravi', 'Ananya', 'Kartik', 'Divya', 'Ganesh', 'Pooja', 'Sanjay', 'Asha']
last_names  = ['Kumar', 'Sharma', 'Patel', 'Singh', 'Reddy', 'Nair', 'Bose', 'Iyer', 'Pillai', 'Rao']
patient_ids = []
patient_rows = []
for i in range(50):
    pid = str(uuid.uuid4())
    patient_ids.append(pid)
    fn = random.choice(first_names)
    ln = random.choice(last_names)
    uhid = f'UHID-{2000+i}'
    patient_rows.append(f"('{pid}', '{fn}', '{ln}', '{uhid}')")

patients_sql = ',\n'.join(patient_rows)
run_sql(f"""
INSERT INTO hospilot.patients (id, first_name, last_name, uhid)
VALUES {patients_sql}
ON CONFLICT DO NOTHING;
""")

# ── IPD Admissions ─────────────────────────────────────────────────────────────
available_beds = [b for b in bed_ids[:30]]  # use first 30 beds for admissions
dept_list = list(dept_ids.values())
admission_rows = []
for i, pid in enumerate(patient_ids[:30]):
    aid = str(uuid.uuid4())
    bed_id = available_beds[i]
    dept = random.choice(dept_list)
    admitted = now - timedelta(days=random.randint(0, 10))
    exp_discharge = admitted + timedelta(days=random.randint(1, 14))
    status = random.choice(['admitted', 'admitted', 'admitted', 'discharge_ready', 'transferred'])
    discharge_ready = 'true' if status == 'discharge_ready' else 'false'
    admission_rows.append(
        f"('{aid}', '{pid}', '{bed_id}', '{dept}', '{admitted.isoformat()}', '{exp_discharge.isoformat()}', '{status}', {discharge_ready})"
    )

adm_sql = ',\n'.join(admission_rows)
run_sql(f"""
INSERT INTO hospilot.ipd_admissions (id, patient_token, bed_id, department_id, admitted_at, expected_discharge_at, status, discharge_ready)
VALUES {adm_sql}
ON CONFLICT DO NOTHING;
""")

# ── Visits (ER / OPD) ─────────────────────────────────────────────────────────
complaints = ['chest pain', 'fever', 'fracture', 'headache', 'abdominal pain', 'breathlessness', 'injury', 'follow-up']
visit_rows = []
for pid in patient_ids[30:]:
    vid = str(uuid.uuid4())
    dept = random.choice(dept_list)
    arrived = now - timedelta(hours=random.randint(0, 8))
    status = random.choice(['waiting', 'in_progress', 'completed'])
    complaint = random.choice(complaints)
    triage = random.randint(1, 5)
    vtype = random.choice(['emergency', 'opd', 'referral'])
    visit_rows.append(
        f"('{vid}', '{pid}', '{dept}', '{arrived.isoformat()}', '{status}', '{complaint}', {triage}, '{vtype}')"
    )

visits_sql = ',\n'.join(visit_rows)
run_sql(f"""
INSERT INTO hospilot.visits (id, patient_token, department_id, arrived_at, status, chief_complaint, triage_score, visit_type)
VALUES {visits_sql}
ON CONFLICT DO NOTHING;
""")

# ── OT Surgeries ───────────────────────────────────────────────────────────────
ot_rows = []
ot_statuses = ['scheduled'] * 3 + ['in_progress'] * 2 + ['completed'] * 4 + ['cancelled'] * 1
for i in range(10):
    oid = str(uuid.uuid4())
    aid = str(uuid.uuid4())
    pt = random.choice(patient_ids)
    status = ot_statuses[i]
    created = now - timedelta(hours=random.randint(0, 48))
    ot_rows.append(f"('{oid}', '{aid}', '{pt}', '{status}', '{created.isoformat()}')")

ot_sql = ',\n'.join(ot_rows)
run_sql(f"""
INSERT INTO hospilot.ot_surgeries (id, admission_id, patient_token, status, created_at)
VALUES {ot_sql}
ON CONFLICT DO NOTHING;
""")

# ── Claims ─────────────────────────────────────────────────────────────────────
tpa_names = ['Blue Cross', 'Star Health', 'Bajaj Allianz', 'Aetna', 'HDFC Ergo', 'New India Assurance']
claim_rows = []
c_statuses = ['pending', 'pending', 'approved', 'rejected', 'under_review']
for i in range(20):
    cid = str(uuid.uuid4())
    pt = random.choice(patient_ids)
    tpa = random.choice(tpa_names)
    amount = round(random.uniform(5000, 200000), 2)
    status = random.choice(c_statuses)
    created = now - timedelta(days=random.randint(0, 30))
    claim_rows.append(f"('{cid}', '{pt}', '{tpa}', {amount}, '{status}', '{created.isoformat()}')")

claims_sql = ',\n'.join(claim_rows)
run_sql(f"""
INSERT INTO hospilot.claims (id, patient_token, tpa_name, claim_amount, status, created_at)
VALUES {claims_sql}
ON CONFLICT DO NOTHING;
""")

print("\n✅  Mock data populated successfully!")
print(f"   Departments: {len(dept_ids)}")
print(f"   Beds: {len(bed_rows)}")
print(f"   Staff roster entries: {len(staff_rows)}")
print(f"   Doctor slots: {len(slot_rows)}")
print(f"   Patients: {len(patient_rows)}")
print(f"   IPD Admissions: {len(admission_rows)}")
print(f"   ER/OPD Visits: {len(visit_rows)}")
print(f"   OT Surgeries: {len(ot_rows)}")
print(f"   Claims: {len(claim_rows)}")
