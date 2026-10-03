import jwt
import httpx
from datetime import datetime, timezone, timedelta

# From .env
JWT_SECRET = "change-me-in-production"
TOKEN_VERSION = 2

payload = {
    "sub": "mock-admin-id",
    "username": "admin",
    "display_name": "Admin",
    "role": "admin",
    "org_id": "mock-org-id",
    "ver": TOKEN_VERSION,
    "exp": datetime.now(timezone.utc) + timedelta(hours=8),
}

token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
headers = {"Authorization": f"Bearer {token}"}

try:
    resp = httpx.post("http://localhost:8000/api/hospital/predict_and_escalate", headers=headers)
    print("STATUS:", resp.status_code)
    print("RESPONSE:", resp.json())
except Exception as e:
    print("Failed to reach server:", e)
