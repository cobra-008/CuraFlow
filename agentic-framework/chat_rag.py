import json
import asyncio
import logging

from llm_client import llm_json_prefill, llm_chat
from synthetic_hospital import _state

logger = logging.getLogger("chat_rag")

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
    data = json.dumps(snapshot.get("staff", {}))
    system = f"You are the Staff Management Agent. Real-time data: {data}. Answer the prompt concisely."
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
    - bed_agent: Knows about general hospital bed occupancy, availability, cleaning.
    - icu_agent: Knows about ICU beds, waitlist, ventilator status.
    - er_agent: Knows about emergency room patients waiting, capacity, demand score.
    - staff_agent: Knows about staff (doctors, nurses) on duty, utilization, shortages.
    - ot_agent: Knows about operating theatre utilization.

    Identify which agents are needed to answer the query. Return a JSON object where keys are agent names (from the list above) and values are the specific question/prompt to send to that agent to get the required information.
    Example: {{"staff_agent": "How many nurses are currently on duty?"}}
    If the question is a general greeting or unrelated to hospital telemetry, return an empty object {{}}.
    """
    
    try:
        router_response_text = await llm_json_prefill(user=router_prompt, tier="fast")
        # llm_json_prefill handles anthropic/openai differences, ensuring JSON starts at the root
        # and returns a valid string (though openai might still have closing fences we should strip if any)
        cleaned = router_response_text.strip()
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0].strip()
        plan = json.loads(cleaned)
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
