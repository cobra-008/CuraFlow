# Agentic Task Scheduling & HITL Assignment Design

## 1. Problem Statement
Currently, when agents (like the ER, ICU, OT, or Staff agents) process hospital operational data and suggest actions (e.g., "Deploy 2 float nurses to ICU" or "Route patient to available diagnostic device"), they simply return informational text. These insights are not actionable, not tracked, and not communicated to the staff members who actually need to execute them.

## 2. Proposed Solution with Human-in-the-Loop (HITL)
The orchestration layer will be enhanced so that when agents propose operational interventions:
1. Interventions are converted into structured **Tasks** in a `PENDING_APPROVAL` state.
2. Tasks are routed in real-time to the concerned staff member's device (e.g., Nurse Dashboard, Doctor Dashboard).
3. **Human Intervention Gate**: The task **WILL NOT** proceed to execution or final scheduling until the concerned staff member explicitly **Approves** it.
4. Upon staff approval, the task transitions to `SCHEDULED` / `APPROVED`, triggers execution, and updates all connected devices via WebSockets.

---

## 3. Key Components & Lifecycle

### 3.1 Task Lifecycle & State Machine
```
[Agent Output]
       │
       ▼
 [Task Created] ──► Status: PENDING_APPROVAL
       │
       ├────────────────────────┐
       ▼                        ▼
[Staff Approves]         [Staff Rejects]
       │                        │
       ▼                        ▼
Status: SCHEDULED        Status: REJECTED
 (Triggers Action)        (No Action Taken)
```

### 3.2 Task Schema
- `id`: String (UUID)
- `title`: String
- `description`: Text
- `department`: String (e.g., "ICU", "ER", "General Ward")
- `assigned_role`: String (e.g., "nurse", "doctor", "admin")
- `assigned_staff_id`: String (Optional specific staff ID, e.g. "Nurse Joy")
- `source_agent`: String (e.g., "icu_agent", "er_agent")
- `urgency`: String ("CRITICAL", "HIGH", "MEDIUM", "LOW")
- `status`: String ("PENDING_APPROVAL", "SCHEDULED", "REJECTED", "COMPLETED")
- `created_at`: Timestamp
- `decided_at`: Timestamp (Optional)
- `decided_by`: String (Optional)

---

## 4. Implementation Plan

### Step 1: Backend Task & HITL Workflow Service (`agentic-framework/api/routes/operations.py`)
- Implement `_scheduled_tasks` in-memory store in `operations.py`.
- Add backend REST endpoints:
  - `GET /api/ops/tasks` - Fetch all tasks (supports filtering by `status`, `department`, `role`).
  - `POST /api/ops/tasks/create` - Create a pending task from agent outputs or user chat and broadcast WebSocket notification.
  - `POST /api/ops/tasks/{task_id}/approve` - Staff approval endpoint: transitions task from `PENDING_APPROVAL` to `SCHEDULED` (or `REJECTED`) and triggers real-time WS update to all clients.

### Step 2: Agent Orchestration Integration
- Update `chat_endpoint` and agent execution routes in `operations.py` to parse structured task recommendations from agent responses and auto-create `PENDING_APPROVAL` tasks.

### Step 3: Frontend Real-Time HITL Task Components
- Update `web/src/services/opsApi.ts` to include task creation, listing, and approval API methods.
- Update `web/src/hooks/useRealTime.ts` to handle `TASK_CREATED` and `TASK_UPDATED` WebSocket events.
- Enhance `NurseDashboard.tsx` and `DoctorDashboard.tsx` with a **"Pending Staff Task Approvals"** panel featuring interactive **[Approve & Schedule]** and **[Reject]** controls.

---
