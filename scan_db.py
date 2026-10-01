import psycopg
import httpx

DB_URL = 'postgresql://postgres.bynfxwxswvezbevaspci:UwPpBkiLMbJj78aA@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'
HASURA_URL = 'http://localhost:8080/v1/graphql'
HASURA_SECRET = 'hospilot-dev-secret'

# 1. Check all hospilot_app tables and their row counts
print("=" * 60)
print("1. DATABASE TABLES (hospilot_app schema)")
print("=" * 60)
with psycopg.connect(DB_URL) as conn:
    with conn.cursor() as cur:
        cur.execute("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'hospilot_app'
            ORDER BY table_name;
        """)
        tables = [row[0] for row in cur.fetchall()]
        print(f"Found {len(tables)} tables: {tables}\n")

        for table in tables:
            cur.execute(f"SELECT COUNT(*) FROM hospilot_app.{table}")
            count = cur.fetchone()[0]
            print(f"  hospilot_app.{table}: {count} rows")

# 2. Check key API endpoints
print("\n" + "=" * 60)
print("2. KEY API ENDPOINTS")
print("=" * 60)
tests = [
    ("GET", "http://localhost:8000/health", None, None),
    ("GET", "http://localhost:8000/api/orgs/public", None, None),
]
for method, url, data, headers in tests:
    try:
        if method == "GET":
            r = httpx.get(url, timeout=5)
        else:
            r = httpx.post(url, json=data, headers=headers, timeout=5)
        print(f"  {method} {url}: {r.status_code} -> {r.text[:200]}")
    except Exception as e:
        print(f"  {method} {url}: ERROR - {e}")

# 3. Check what Hasura has tracked
print("\n" + "=" * 60)
print("3. HASURA TRACKED TABLES")
print("=" * 60)
try:
    r = httpx.get('http://localhost:8080/v1/metadata', timeout=5,
                  headers={'x-hasura-admin-secret': HASURA_SECRET})
    print(f"  Hasura metadata status: {r.status_code}")
except Exception as e:
    print(f"  Cannot reach Hasura: {e}")

# 4. Check orgs/agents/tasks in DB
print("\n" + "=" * 60)
print("4. CONTENT CHECK")
print("=" * 60)
with psycopg.connect(DB_URL) as conn:
    with conn.cursor() as cur:
        cur.execute("SELECT id, name, slug, status FROM hospilot_app.organizations LIMIT 10")
        orgs = cur.fetchall()
        print(f"Organizations: {orgs}")

        cur.execute("SELECT id, username, role, status FROM hospilot_app.users LIMIT 10")
        users = cur.fetchall()
        print(f"Users: {users}")

        try:
            cur.execute("SELECT id, label FROM hospilot_app.task_registry LIMIT 10")
            tasks = cur.fetchall()
            print(f"Task registry: {tasks}")
        except Exception as e:
            print(f"Task registry error: {e}")

        try:
            cur.execute("SELECT id, label FROM hospilot_app.agent_registry LIMIT 10")
            agents = cur.fetchall()
            print(f"Agent registry: {agents}")
        except Exception as e:
            print(f"Agent registry error: {e}")

print("\nDone!")
