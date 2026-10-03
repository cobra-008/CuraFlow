import json
import asyncio
import logging

from llm_client import llm_json_prefill, llm_chat
from hospital_state_engine import get_state_engine

logger = logging.getLogger("chat_rag")

def _state():
    return get_state_engine()

async def execute_bed_agent(prompt: str) -> str:
    snapshot = _state().get_snapshot()
    data = json.dumps(snapshot.get("beds", {}))
    system = f"You are the Bed Management Agent. Real-time data: {data}. Answer the prompt concisely."
    return await llm_chat(system=system, user=prompt, tier="fast")

async def execute_icu_agent(prompt: str) -> str:
    snapshot = _state().get_snapshot()
    data = json.dumps(snapshot.get("icu", {}))
    system = f"You are the ICU Management Agent. Real-time data: {data}. Answer the prompt concisely."
    return await llm_chat(system=system, user=prompt, tier="fast")

async def execute_er_agent(prompt: str) -> str:
    snapshot = _state().get_snapshot()
    data = json.dumps(snapshot.get("emergency", {}))
    system = f"You are the Emergency Room Agent. Real-time data: {data}. Answer the prompt concisely."
    return await llm_chat(system=system, user=prompt, tier="fast")

async def execute_staff_agent(prompt: str) -> str:
    snapshot = _state().get_snapshot()
    
    # Collect real data from system accounts and the DB
    from api.routes.auth import SYSTEM_DEMO_ACCOUNTS
    
    nurses = 0
    doctors = 0
    nurses_available = 0
    nurses_busy = 0
    nurses_leave = 0
    
    doctors_available = 0
    doctors_busy = 0
    doctors_leave = 0

    # Aggregate system demo accounts (mocked database roles and statuses)
    for acc in SYSTEM_DEMO_ACCOUNTS.values():
        role = acc.get("role")
        status = acc.get("status", "active")
        
        # Determine availability logically. If active -> available.
        # If the user says "busy" or "leave", those statuses would exist in a real DB.
        if role == "nurse":
            nurses += 1
            if status == "active": nurses_available += 1
            elif status == "busy": nurses_busy += 1
            elif status == "leave": nurses_leave += 1
        elif role == "doctor":
            doctors += 1
            if status == "active": doctors_available += 1
            elif status == "busy": doctors_busy += 1
            elif status == "leave": doctors_leave += 1

    real_data = {
        "staff_database_counts": {
            "nurses": {
                "total": nurses,
                "available_now": nurses_available,
                "busy": nurses_busy,
                "on_leave": nurses_leave
            },
            "doctors": {
                "total": doctors,
                "available_now": doctors_available,
                "busy": doctors_busy,
                "on_leave": doctors_leave
            }
        },
        "realtime_telemetry_snapshot": snapshot.get("staff", {})
    }
    
    data = json.dumps(real_data)
    system = f"You are the Staff Management Agent. Real database data: {data}. Answer the prompt accurately using the exact numbers provided. Never apologize or say you don't have access."
    return await llm_chat(system=system, user=prompt, tier="fast")

async def execute_ot_agent(prompt: str) -> str:
    snapshot = _state().get_snapshot()
    data = json.dumps(snapshot.get("operating_rooms", {}))
    system = f"You are the Operating Theatre Agent. Real-time data: {data}. Answer the prompt concisely."
    return await llm_chat(system=system, user=prompt, tier="fast")

AGENTS = {
    "bed_agent": execute_bed_agent,
    "icu_agent": execute_icu_agent,
    "er_agent": execute_er_agent,
    "staff_agent": execute_staff_agent,
    "ot_agent": execute_ot_agent,
}

async def process_chat_rag(user_message: str) -> str:
    """
    RAG Pipeline for Chat:
    1. Common Model (Router) identifies required agents and generates tailored prompts.
    2. Respective agents execute in parallel, querying the real database (snapshot).
    3. Proper data is returned to the general model.
    4. The general model synthesizes the required answer.
    """
    router_prompt = f"""
    The user is asking: "{user_message}"
    
    You have the following agents available:
    - bed_agent: general hospital bed occupancy, availability, cleaning.
    - icu_agent: ICU beds, waitlist, ventilator status.
    - er_agent: emergency room patients waiting, capacity, demand score.
    - staff_agent: EXPLICITLY handles ALL queries regarding nurses, doctors, staff, users, busy, leave, presence, availability, roles, credentials.
    - ot_agent: operating theatre utilization.

    Identify which agents are needed to answer the query. Return a JSON object where keys are agent names (from the list above) and values are the specific question/prompt to send to that agent to get the required information.
    Example: {{"staff_agent": "How many nurses are currently available vs on leave?"}}
    If the question is completely unrelated to the hospital, return an empty object {{}}. Do NOT return an empty object if the user mentions doctors or nurses.
    """
    
    try:
        router_response_text = await llm_json_prefill(user=router_prompt, tier="fast")
        import re
        # Find the first { and last } to extract JSON
        json_match = re.search(r'\{.*\}', router_response_text.strip(), re.DOTALL)
        if json_match:
            plan = json.loads(json_match.group(0))
        else:
            raise ValueError("No JSON object found in response.")
    except Exception as e:
        logger.error(f"Router parsing error: {e}. Raw response: {router_response_text if 'router_response_text' in locals() else 'None'}")
        plan = {}
        
    tasks = []
    agent_names = []
    
    if isinstance(plan, dict):
        for agent_name, prompt in plan.items():
            if agent_name in AGENTS:
                tasks.append(AGENTS[agent_name](prompt))
                agent_names.append(agent_name)
            
    if not tasks:
        # Fallback if no agents were triggered or it's a general question
        return await llm_chat(system="You are a helpful hospital AI assistant. You don't have telemetry for this request. Just be conversational.", user=user_message, tier="quality")
        
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    context_blocks = []
    for name, result in zip(agent_names, results):
        if isinstance(result, Exception):
            context_blocks.append(f"[{name}]: Failed to retrieve data ({str(result)})")
        else:
            context_blocks.append(f"[{name}]: {result}")
            
    synthesis_context = "\n".join(context_blocks)
    
    synthesis_prompt = f"""
    The user asked: "{user_message}"
    
    To answer this, our specialized agents queried the hospital database and provided the following context:
    {synthesis_context}
    
    Synthesize this information into a natural, helpful, and concise response to the user's question. 
    Only include the relevant telemetry data provided by the agents.
    """
    
    final_answer = await llm_chat(system="You are the CuraFlow Hospital AI Orchestrator.", user=synthesis_prompt, tier="quality")
    return final_answer
