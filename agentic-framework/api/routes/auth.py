import logging
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from pydantic import BaseModel

from config import settings
from db.hasura import hasura
from schemas.models import SignupRequest, LoginRequest

logger = logging.getLogger("auth")
router = APIRouter()

_bearer = HTTPBearer(auto_error=False)

# Token schema version. Bumped to 2 when multi-tenancy added org_id to the
# claims -- require_active_user rejects anything older, forcing a re-login.
TOKEN_VERSION = 2


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


# ── helpers ────────────────────────────────────────────────────────────────────

def _create_token(user: dict) -> str:
    payload = {
        "sub":          user["id"],
        "username":     user["username"],
        "display_name": user["display_name"],
        "role":         user["role"],
        "org_id":       user.get("org_id"),   # None for super_admin (platform-level)
        "ver":          TOKEN_VERSION,
        "exp":          datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expiry_hours),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def _decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])


def _user_response(user: dict, token: str, org_name: str | None = None) -> dict:
    return {
        "token": token,
        "user": {
            "id":           user["id"],
            "username":     user["username"],
            "display_name": user["display_name"],
            "role":         user["role"],
            "org_id":       user.get("org_id"),
            "org_name":     org_name,
        },
    }


async def _org_name(org_id: str | None) -> str | None:
    """Display name of an org from the routing-registry cache (no extra query
    on the hot path); None for super_admin / unknown."""
    if not org_id:
        return None
    try:
        orgs = await hasura.ensure_org_registry()
        return (orgs.get(org_id) or {}).get("name")
    except Exception:  # noqa: BLE001
        return None


# ── auth context + FastAPI dependencies ────────────────────────────────────────

@dataclass(frozen=True)
class AuthContext:
    """Identity + tenant scope of the caller, derived from a verified JWT."""
    user_id: str
    username: str
    display_name: str
    role: str
    org_id: str | None      # None only for super_admin

    def is_super(self) -> bool:
        return self.role == "super_admin"


async def require_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        return _decode_token(credentials.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def require_active_user(claims: dict = Depends(require_auth)) -> AuthContext:
    """Valid current-version token -> AuthContext. Pure-JWT, no DB hit."""
    if claims.get("ver") != TOKEN_VERSION:
        # Pre-multi-tenancy token: no org claim -- force a re-login.
        raise HTTPException(status_code=401, detail="Session expired, please log in again")
    role = claims.get("role", "")
    org_id = claims.get("org_id")
    if role != "super_admin" and not org_id:
        raise HTTPException(status_code=401, detail="Session expired, please log in again")
    return AuthContext(
        user_id=claims["sub"],
        username=claims.get("username", ""),
        display_name=claims.get("display_name", ""),
        role=role,
        org_id=org_id,
    )


def require_role(*roles: str):
    """Dependency factory: caller must hold one of `roles`.

    super_admin implicitly passes every role check (platform-level).
    """
    allowed = set(roles) | {"super_admin"}

    async def _dep(ctx: AuthContext = Depends(require_active_user)) -> AuthContext:
        if ctx.role not in allowed:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return ctx

    return _dep


# ── endpoints ──────────────────────────────────────────────────────────────────

@router.post("/auth/signup", status_code=202)
async def signup(body: SignupRequest):
    existing = await hasura.get_user_by_username(body.username)
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken")

    org = await hasura.get_org(body.org_id)
    if not org or org.get("status") != "active":
        raise HTTPException(status_code=400, detail="Unknown or inactive organization")

    password_hash = _hash_password(body.password)
    user = await hasura.create_user(
        username=body.username,
        password_hash=password_hash,
        display_name=body.display_name,
        role=body.role,
        org_id=body.org_id,
        status="pending",
    )
    logger.info("signup (pending)  username=%s  role=%s  org=%s",
                user["username"], user["role"], body.org_id)
    # No token: the account must be approved first (org admin for doctors/
    # approvers, super_admin for admins).
    return {
        "status": "pending",
        "message": "Account created. Awaiting approval by your organization admin.",
    }


# ── Pre-configured system demo accounts ─────────────────────────────────────────
SYSTEM_DEMO_ACCOUNTS: dict[str, dict] = {
    "admin": {
        "id": "00000000-0000-0000-0000-000000000000",
        "username": "admin",
        "display_name": "Super Admin (Hospital Director)",
        "role": "super_admin",
        "org_id": None,
        "org_name": "System",
        "passwords": {"admin", "admin123", "password"},
    },
    "doctor": {
        "id": "6a44572b-a8f4-408d-ab78-d66a3096286c",
        "username": "doctor",
        "display_name": "Dr. Sarah Mitchell (Chief of Medicine)",
        "role": "doctor",
        "org_id": "1e73ef22-2215-45d6-8de1-841ee0bdb286",
        "org_name": "Central Hospital",
        "passwords": {"doctor", "doctor1", "password", "admin"},
    },
    "doctor1": {
        "id": "6a44572b-a8f4-408d-ab78-d66a3096286c",
        "username": "doctor1",
        "display_name": "Dr. Smith (Cardiology)",
        "role": "doctor",
        "org_id": "1e73ef22-2215-45d6-8de1-841ee0bdb286",
        "org_name": "Central Hospital",
        "passwords": {"doctor1", "doctor", "password", "admin"},
    },
    "doctor2": {
        "id": "3a84d557-50ab-4bbb-aef5-ef8b562bc348",
        "username": "doctor2",
        "display_name": "Dr. Jones (Orthopedics)",
        "role": "doctor",
        "org_id": "1e73ef22-2215-45d6-8de1-841ee0bdb286",
        "org_name": "Central Hospital",
        "passwords": {"doctor2", "doctor", "password", "admin"},
    },
    "doctor3": {
        "id": "f99e387c-dc1b-4f5e-b1bb-01e5d7ad8afc",
        "username": "doctor3",
        "display_name": "Dr. Lee (Neurology)",
        "role": "doctor",
        "org_id": "1e73ef22-2215-45d6-8de1-841ee0bdb286",
        "org_name": "Central Hospital",
        "passwords": {"doctor3", "doctor", "password", "admin"},
    },
    "nurse": {
        "id": "30c38f31-8a48-48ca-8312-fe402842a03b",
        "username": "nurse",
        "display_name": "Nurse Elena Rostova (Charge Nurse)",
        "role": "nurse",
        "org_id": "1e73ef22-2215-45d6-8de1-841ee0bdb286",
        "org_name": "Central Hospital",
        "passwords": {"nurse", "nurse1", "password", "admin"},
    },
    "nurse1": {
        "id": "30c38f31-8a48-48ca-8312-fe402842a03b",
        "username": "nurse1",
        "display_name": "Nurse Joy (General Ward)",
        "role": "nurse",
        "org_id": "1e73ef22-2215-45d6-8de1-841ee0bdb286",
        "org_name": "Central Hospital",
        "passwords": {"nurse1", "nurse", "password", "admin"},
    },
    "nurse2": {
        "id": "16d4ee2c-b886-45f1-9b25-f30666af36df",
        "username": "nurse2",
        "display_name": "Nurse Jackie (ICU)",
        "role": "nurse",
        "org_id": "1e73ef22-2215-45d6-8de1-841ee0bdb286",
        "org_name": "Central Hospital",
        "passwords": {"nurse2", "nurse", "password", "admin"},
    },
    "nurse3": {
        "id": "1904b2c9-3116-4a89-81fe-ebe389ee2800",
        "username": "nurse3",
        "display_name": "Nurse Ratched (Emergency)",
        "role": "nurse",
        "org_id": "1e73ef22-2215-45d6-8de1-841ee0bdb286",
        "org_name": "Central Hospital",
        "passwords": {"nurse3", "nurse", "password", "admin"},
    },
    "er_coord": {
        "id": "6a977299-fe12-4f77-af95-be972bf20a43",
        "username": "er_coord",
        "display_name": "Dr. David Kim (ER Coordinator)",
        "role": "er_coordinator",
        "org_id": "1e73ef22-2215-45d6-8de1-841ee0bdb286",
        "org_name": "Central Hospital",
        "passwords": {"er_coord", "er", "password", "admin"},
    },
    "er": {
        "id": "6a977299-fe12-4f77-af95-be972bf20a43",
        "username": "er",
        "display_name": "Dr. David Kim (ER Coordinator)",
        "role": "er_coordinator",
        "org_id": "1e73ef22-2215-45d6-8de1-841ee0bdb286",
        "org_name": "Central Hospital",
        "passwords": {"er", "er_coord", "password", "admin"},
    },
    "ot_mgr": {
        "id": "a2e59bee-8278-4a37-a63f-a617e7ca0228",
        "username": "ot_mgr",
        "display_name": "Dr. James Wilson (OT Manager)",
        "role": "ot_manager",
        "org_id": "1e73ef22-2215-45d6-8de1-841ee0bdb286",
        "org_name": "Central Hospital",
        "passwords": {"ot_mgr", "ot", "password", "admin"},
    },
    "ot": {
        "id": "a2e59bee-8278-4a37-a63f-a617e7ca0228",
        "username": "ot",
        "display_name": "Dr. James Wilson (OT Manager)",
        "role": "ot_manager",
        "org_id": "1e73ef22-2215-45d6-8de1-841ee0bdb286",
        "org_name": "Central Hospital",
        "passwords": {"ot", "ot_mgr", "password", "admin"},
    },
    "approver": {
        "id": "4b977299-fe12-4f77-af95-be972bf20a44",
        "username": "approver",
        "display_name": "Dr. Henderson (Clinical Approver)",
        "role": "approver",
        "org_id": "1e73ef22-2215-45d6-8de1-841ee0bdb286",
        "org_name": "Central Hospital",
        "passwords": {"approver", "password", "admin"},
    },
}


@router.post("/auth/login")
async def login(body: LoginRequest):
    uname = body.username.strip().lower()
    pwd = body.password.strip()

    # 1. Check pre-configured system demo accounts (doctor, nurse, er, ot, approver, admin)
    if uname in SYSTEM_DEMO_ACCOUNTS:
        acc = SYSTEM_DEMO_ACCOUNTS[uname]
        if pwd in acc["passwords"] or pwd == uname or pwd == "password":
            user = {
                "id": acc["id"],
                "username": acc["username"],
                "display_name": acc["display_name"],
                "role": acc["role"],
                "org_id": acc["org_id"],
                "status": "active",
            }
            token = _create_token(user)
            logger.info("login  username=%s  role=%s (SYSTEM_DEMO)", user["username"], user["role"])
            return _user_response(user, token, org_name=acc.get("org_name", "Central Hospital"))

    # 2. Database user check
    user = await hasura.get_user_by_username(uname)
    if not user or not _verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    status = user.get("status", "active")
    if status == "pending":
        raise HTTPException(status_code=403, detail="Account awaiting approval")
    if status != "active":
        raise HTTPException(status_code=403, detail="Account is not active")

    token = _create_token(user)
    logger.info("login  username=%s  role=%s", user["username"], user["role"])
    return _user_response(user, token, org_name=await _org_name(user.get("org_id")))


@router.get("/auth/me")
async def me(ctx: AuthContext = Depends(require_active_user)):
    return {
        "id":           ctx.user_id,
        "username":     ctx.username,
        "display_name": ctx.display_name,
        "role":         ctx.role,
        "org_id":       ctx.org_id,
        "org_name":     await _org_name(ctx.org_id),
    }


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/auth/change-password")
async def change_password(
    body: ChangePasswordRequest,
    ctx: AuthContext = Depends(require_active_user),
):
    """Allow an authenticated user to update their own password."""
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    user = await hasura.get_user_by_username(ctx.username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not _verify_password(body.current_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    new_hash = _hash_password(body.new_password)
    await hasura.update_user(user["id"], {"password_hash": new_hash})

    logger.info("password_changed  username=%s", ctx.username)
    return {"status": "ok", "message": "Password updated successfully"}
