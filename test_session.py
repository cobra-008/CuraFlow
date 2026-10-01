import httpx
import jwt
import datetime

secret = 'change-me-in-production'
payload = {
    "sub": "aac1718d-baae-4380-9367-092e89438d9d",
    "username": "admin",
    "display_name": "Super Admin",
    "role": "super_admin",
    "org_id": None,
    "ver": 2,
    "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=8),
}
token = jwt.encode(payload, secret, algorithm="HS256")
org_id = "f939bd1d-d95a-42a7-b046-86333fdaae89"

# Enable detailed error output
import httpx

# First check what the backend logs say about the 500
# We'll call with a verbose client
with httpx.Client(timeout=30) as client:
    r = client.post(
        f'http://localhost:8000/api/sessions?org_id={org_id}',
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
        json={'goal': 'How many ICU beds are available right now?', 'constraints': '', 'autonomous': False},
    )
    print(f"Status: {r.status_code}")
    print(f"Headers: {dict(r.headers)}")
    print(f"Body: {r.text}")
