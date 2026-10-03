import httpx
HASURA = 'http://hasura:8080/v2/query'
HEADERS = {'x-hasura-admin-secret': 'hospilot-dev-secret', 'Content-Type': 'application/json'}

def run_sql(sql: str):
    r = httpx.post(HASURA, headers=HEADERS, json={'type': 'run_sql', 'args': {'sql': sql}})
    print(r.text[:100])

run_sql("""
TRUNCATE TABLE hospilot.claims CASCADE;
TRUNCATE TABLE hospilot.ot_surgeries CASCADE;
TRUNCATE TABLE hospilot.visits CASCADE;
TRUNCATE TABLE hospilot.ipd_admissions CASCADE;
TRUNCATE TABLE hospilot.patients CASCADE;
TRUNCATE TABLE hospilot.doctor_slots CASCADE;
TRUNCATE TABLE hospilot.staff_roster CASCADE;
TRUNCATE TABLE hospilot.beds CASCADE;
""")
