import httpx

HASURA_URL = 'http://localhost:8080/v1/metadata'
HEADERS = {'x-hasura-admin-secret': 'hospilot-dev-secret', 'Content-Type': 'application/json'}

def apply(payload):
    r = httpx.post(HASURA_URL, headers=HEADERS, json=payload, timeout=30)
    print(r.status_code, r.text[:500])

# 1. agent_registry -> subagent_registry
apply({
    "type": "pg_create_array_relationship",
    "args": {
        "source": "default",
        "table": {"schema": "hospilot_app", "name": "agent_registry"},
        "name": "subagent_registries",
        "using": {
            "manual_configuration": {
                "remote_table": {"schema": "hospilot_app", "name": "subagent_registry"},
                "column_mapping": {
                    "id": "agent_id"
                }
            }
        }
    }
})

# 2. subagent_registry -> task_registry
apply({
    "type": "pg_create_array_relationship",
    "args": {
        "source": "default",
        "table": {"schema": "hospilot_app", "name": "subagent_registry"},
        "name": "task_registries",
        "using": {
            "manual_configuration": {
                "remote_table": {"schema": "hospilot_app", "name": "task_registry"},
                "column_mapping": {
                    "id": "subagent_id"
                }
            }
        }
    }
})

print("Done creating manual relationships.")
