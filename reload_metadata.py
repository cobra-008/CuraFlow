import httpx

HASURA_SECRET = 'hospilot-dev-secret'
HEADERS = {'x-hasura-admin-secret': HASURA_SECRET}

print("Reloading Hasura metadata to pick up new columns...")
r = httpx.post('http://localhost:8080/v1/metadata', headers=HEADERS,
               json={"type": "reload_metadata", "args": {}}, timeout=120)
print(f"Status: {r.status_code}")
if r.status_code == 200:
    print("Metadata reloaded successfully!")
else:
    print(f"Response: {r.text[:500]}")
