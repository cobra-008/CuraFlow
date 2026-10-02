# CuraFlow (formerly Hospilot) - Full Architecture & Codebase Report

## Overview
**CuraFlow** is an open-source Agentic AI Operating Layer for Hospital Operations. It sits on top of existing Hospital Information Systems (HIS/HMIS) and coordinates purpose-built AI agents to plan and execute operational workflows autonomously (e.g., bed management, ER triage, ICU capacity, staffing). It utilizes a "Human-in-the-loop" (HITL) design where the workflow durably waits for a human administrator to approve consequential actions before they are executed.

This report summarizes the entire codebase, architecture, toolchain, and configurations built from scratch up to this point.

---

## 1. System Architecture & Flow
The application acts as a bridge between a natural language prompt ("Can we safely take this patient into the respiratory ward?") and concrete hospital operations:
1. **User Goal:** A prompt is sent via API.
2. **Planner (LLM):** Parses the goal and maps it to a **LangGraph StateGraph** pipeline of specific domain agents.
3. **Agent Nodes:** The pipeline executes level-by-level. Each agent assigns sub-agents to execute tasks (either built-in or dynamically generated via LLM).
4. **Sandboxed Tasks:** Dynamically generated tasks execute securely inside a `RestrictedPython` sandbox, using a data schema (not raw patient data) to generate logic.
5. **Human Approval:** LangGraph pauses execution (`interrupt()`), saving the state to Postgres. The frontend displays the proposed action.
6. **Synthesis & Write:** Once approved, Fabric writes the action back to the HIS system.

---

## 2. Frontend (`/web`)

### Tech Stack & Tools
- **Build Tool:** Vite
- **Core Library:** React 18, TypeScript
- **Styling:** Tailwind CSS, PostCSS, Custom CSS (`index.css`)
- **State Management:** Zustand
- **Canvas / Workflow Editor:** `@xyflow/react` (React Flow)
- **Drag-and-Drop:** `@dnd-kit/core`, `@dnd-kit/sortable`
- **Icons:** `lucide-react`
- **Theming:** `next-themes` (Dark/Light mode support, predominantly Navy Blue UI)

### Key UI Designs & Components
- **Pipeline Canvas (`PipelineCanvas.tsx`):** The core interactive node-based graph editor. It features a dotted background (`BackgroundVariant.Dots`), custom blue edge-paths, and a minimized `MiniMap` tailored for unobtrusive reference.
- **Custom Nodes:** `AgentNode.tsx`, `DecisionNode.tsx`, `CheckpointGroupNode.tsx`. Cards lift off the canvas with soft shadows and interactive hover states.
- **Loading & State UI (`CoordinatingLoader.tsx`):** A custom SVG "molten goo" loader. Originally implemented using CSS filters inside masks (which caused rendering glitches in Safari), it was re-engineered using native SVG `<filter>` and `<feColorMatrix>` for cross-browser gooey blob effects.
- **Shimmer Text (`PlanningThinkingText.tsx`):** A smooth CSS linear-gradient background clip animation that simulates a shimmering "Thinking..." effect while the LLM generates the graph.

---

## 3. Backend (`/agentic-framework`)

### Tech Stack & Tools
- **Core Server:** Python 3.11+, FastAPI, Uvicorn
- **Orchestration:** LangGraph (StateGraph for DAGs)
- **State Persistence:** `langgraph-checkpoint-postgres` + PostgreSQL (Hasura)
- **Caching & Sessions:** Redis
- **Event Bus & Streams:** Kafka (`aiokafka`) and WebSockets for real-time frontend updates.
- **LLM Integration:** `anthropic`, `openai` (Designed to connect to local Ollama models like Qwen 3.5 3B).
- **Data Modeling:** `fhir.resources` (FHIR R4/R5 schema enforcement), `pydantic`.
- **Security:** JWT Authentication, `bcrypt`, `RestrictedPython` for dynamic code.
- **Observability:** `langfuse`

### Core Modules
- **`workflows/planner.py`:** Takes the goal and constructs the StateGraph.
- **`workflows/graph/builder.py`:** Compiles the snapshot into the actual LangGraph runtime.
- **`workflows/unified_executor.py`:** Generates code via LLM based on data schemas and runs it in the `RestrictedPython` sandbox.
- **`agents/` Directory:** Contains 14 predefined domain agents (e.g., `bed_agent`, `er_agent`, `icu_agent`, `staff_agent`, `revenue_agent`). Each domain has a specific context and guardrail (`agents/_shared/manifest.py`).

---

## 4. Fabric (The Data Layer)
- Fabric is a translation layer that sits between the agentic framework and the hospital's actual HIS.
- It maps live hospital data (ingested via polling, change-APIs, or Kafka) into **FHIR R5** format.
- It operates under a strict "No Data Storage" policy; it acts as a pass-through layer, meaning the agents never hold clinical data locally.

---

## 5. APIs & Mock Server
Due to dependency conflicts with `psycopg-binary` on macOS and Docker unavailability, a native mock server was written to serve the UI for prototyping.

### `mock_server.py`
A lightweight TCP Python HTTP server (`http.server.SimpleHTTPRequestHandler`) simulating the backend.
**Endpoints:**
- `OPTIONS *`: Handles CORS for the frontend.
- `POST /api/auth/login`: Mocks JWT token generation and user profiles.
- `GET /api/auth/me`: Mocks user validation.
- `POST /api/sessions`: Mocks the creation of an LLM planner session (Generates a fake UUID and returns status `pending`).
- `GET /api/sessions`, `GET /api/orgs/public`, `GET /api/queues/paused`, `GET /api/approvals/pending`, `GET /api/agents/registry`: Return empty arrays to prevent frontend `404` errors and allow seamless UI navigation.

---

## 6. Infrastructure & Deployment (`/deployments`)
The system is built to be orchestrated locally via Docker Compose.
- **`docker-compose.agentic-framework.yml`**: Spins up the FastAPI application, LangGraph agents, and Redis.
- **`docker-compose.fabric.yml`**: Spins up the FHIR translation data layer.
- **`docker-compose.db.yml`**: Spins up PostgreSQL 15 and Hasura to serve as the durable datastore.
- **`docker-compose.hasura.yml`**: Legacy or alternative Hasura config.
- Requires `.env` injection for API keys (Anthropic/OpenAI) and database credentials.

## Next Steps / Current State
The web frontend is currently running via `npm run dev` and interacting seamlessly with `python3 mock_server.py`. The frontend's visual glitches (SVG loader rendering in Safari and oversized ReactFlow MiniMap) have been completely resolved via precise CSS and JSX intervention. 

To transition from prototype to production, the `mock_server.py` must be replaced by spinning up the actual Docker environment (Postgres, Hasura, Redis, Kafka, FastAPI) and plugging in the locally downloaded **Qwen 3.5 3B** LLM weights for the Planner engine.
