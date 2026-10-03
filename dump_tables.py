import httpx
HASURA = 'http://localhost:8080/v2/query'
HEADERS = {'x-hasura-admin-secret': 'hospilot-dev-secret', 'Content-Type': 'application/json'}
sql = "SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema IN ('public', 'hospilot', 'auth');"
r = httpx.post(HASURA, headers=HEADERS, json={'type': 'run_sql', 'args': {'sql': sql}})
print(r.json())
