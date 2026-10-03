import asyncio
import bcrypt
import sys
from pathlib import Path

# Add agentic-framework to sys.path
sys.path.append(str(Path("agentic-framework").resolve()))

from db.hasura import HasuraClient

async def run():
    client = HasuraClient()
    
    # We can't TRUNCATE via GraphQL, but we don't necessarily have to.
    # We can just create the users and org.
    
    def hash_pw(password: str) -> str:
        return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    
    # 1. Create org
    try:
        org = await client.create_org("Central Hospital", "central", "00000000-0000-0000-0000-000000000000")
        org_id = org['id']
        print(f"Created org: {org_id}")
    except Exception as e:
        print(f"Org creation failed (might exist): {e}")
        orgs = await client.list_orgs()
        org_id = orgs[0]['id']
        print(f"Using existing org: {org_id}")
        
    roles = [
        ('admin', 'admin', 'Hospital Admin'),
        ('er_coordinator', 'er_coord', 'ER Coordinator'),
        ('ot_manager', 'ot_mgr', 'OT Manager'),
        ('doctor', 'doctor1', 'Dr. Smith (Cardiology)'),
        ('doctor', 'doctor2', 'Dr. Jones (Orthopedics)'),
        ('doctor', 'doctor3', 'Dr. Lee (Neurology)'),
        ('nurse', 'nurse1', 'Nurse Joy (General Ward)'),
        ('nurse', 'nurse2', 'Nurse Jackie (ICU)'),
        ('nurse', 'nurse3', 'Nurse Ratched (Emergency)'),
    ]

    for role, username, display_name in roles:
        try:
            pw_hash = hash_pw('password123')
            user = await client.create_user(
                username=username,
                password_hash=pw_hash,
                display_name=display_name,
                role=role,
                org_id=org_id,
                status='active'
            )
            print(f"Created user: {username} ({role})")
        except Exception as e:
            print(f"Failed to create user {username}: {e}")
            
    try:
        sa_pw = hash_pw('admin')
        user = await client.create_user(
            username='superadmin',
            password_hash=sa_pw,
            display_name='Super Admin',
            role='super_admin',
            org_id=None,
            status='active'
        )
        print("Created user: superadmin (super_admin)")
    except Exception as e:
        print(f"Failed to create superadmin: {e}")

if __name__ == "__main__":
    asyncio.run(run())
