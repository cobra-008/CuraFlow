"""Clear ALL cached LLM-generated executor code so they regenerate fresh with the new safe prompt."""
import asyncio, sys
sys.path.insert(0, '/app')

from db.hasura import hasura

DELETE_ALL_GQL = """
mutation DeleteAllExecCache {
    delete_hospilot_app_task_registry(where: {id: {_like: "exec__%"}}) {
        affected_rows
    }
}
"""

async def clear():
    result = await hasura.query(DELETE_ALL_GQL, {})
    rows = result.get("delete_hospilot_app_task_registry", {}).get("affected_rows", 0)
    print(f'Cleared {rows} cached LLM code entries.')

asyncio.run(clear())
