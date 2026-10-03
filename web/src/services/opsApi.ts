/**
 * CuraFlow Operations API client
 * Connects frontend to /api/ops/* endpoints (real backend or mock server)
 */

import { getToken } from './api'

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

function authHeader(): Record<string, string> {
  const t = getToken()
  return t ? { 'Authorization': `Bearer ${t}` } : {}
}

async function opsGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/api/ops/${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  })
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json()
}

async function opsPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/api/ops/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json()
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HospitalState {
  timestamp: string
  is_synthetic: boolean
  crisis_mode: boolean
  beds: { total: number; occupied: number; available: number; cleaning: number; blocked: number; reserved: number; occupancy_pct: number }
  icu: { total: number; occupied: number; available: number; occupancy_pct: number }
  staff: { total: number; on_duty: number; available: number; utilization_pct: number }
  operating_rooms: { total: number; available: number; occupied: number; utilization_pct: number }
  diagnostics: { total_devices: number; available_devices: number; queue_length: number }
  emergency: { waiting: number; capacity: number; demand_score: number }
  pressure: { overall: number; icu: number; beds: number; staff: number; emergency: number; label: string }
}

export interface Bottleneck {
  id: string
  bottleneck_type: string
  resource_type: string
  severity: 'low' | 'moderate' | 'high' | 'critical'
  detected_at: string
  current_value: number
  threshold_value: number
  confidence: number
  status: string
  description?: string
}

export interface RecommendationAction {
  id: string
  action_order: number
  action_type: string
  action_description: string
  status: string
}

export interface Recommendation {
  id: string
  recommendation_number: number
  rec_type: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: string
  created_at: string
  expires_at: string
  agent_id: string
  title: string
  summary: string
  reason: string
  why_explanation: string
  constraints_satisfied: string[]
  alternatives_rejected: { option: string; reason: string }[]
  counterfactual_scenario: {
    label: string
    predicted_saturation_pct: number
    expected_delay_minutes: number
    alternative_description: string
  }
  expected_impact: Record<string, number>
  confidence: number
  data_freshness_seconds?: number
  requires_approval: boolean
  actions: RecommendationAction[]
  verification?: {
    id: string
    outcome: 'PENDING' | 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'NOT_MEASURABLE'
    expected_impact: Record<string, number>
    actual_impact?: Record<string, number>
    variance?: Record<string, number>
  }
  _is_synthetic?: boolean
}

export interface Prediction {
  id: string
  prediction_type: string
  forecast_start: string
  forecast_end: string
  predicted_value: number
  lower_bound: number
  upper_bound: number
  confidence: number
  model_name: string
  is_synthetic: boolean
}

export interface AgentPerf {
  id: string
  label: string
  status: string
  runs_today: number
  recommendations_today: number
  accepted: number
  modified: number
  rejected: number
  acceptance_rate_pct: number
  avg_latency_ms: number
  avg_confidence: number
}

export interface SimScenario {
  id: string
  name: string
  type: string
  description: string
}

export interface SystemComponent {
  name: string
  type: string
  status: 'healthy' | 'degraded' | 'disconnected' | 'failed'
  latency_ms: number | null
  note?: string
}

export interface DataSource {
  name: string
  type: string
  status: string
  last_event_seconds_ago: number | null
  completeness_pct: number
  freshness_label: string
  note?: string
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const opsApi = {
  // Hospital State
  getHospitalState: () => opsGet<HospitalState>('hospital-state'),
  getBeds: (ward?: string, status?: string) => {
    const params = new URLSearchParams()
    if (ward) params.set('ward', ward)
    if (status) params.set('status', status)
    return opsGet<{ beds: unknown[] }>(`beds${params.toString() ? '?' + params : ''}`)
  },
  getStaff: (role?: string, status?: string) => {
    const params = new URLSearchParams()
    if (role) params.set('role', role)
    if (status) params.set('status', status)
    return opsGet<{ staff: unknown[] }>(`staff${params.toString() ? '?' + params : ''}`)
  },
  getOTRooms: () => opsGet<{ operating_rooms: unknown[] }>('operating-rooms'),
  getDiagnostics: () => opsGet<{ devices: unknown[] }>('diagnostics'),
  triggerCrisis: () => opsPost<{ status: string; snapshot: HospitalState }>('hospital-state/crisis'),
  resolveCrisis: () => opsPost<{ status: string }>('hospital-state/resolve-crisis'),

  // Intelligence
  getPredictions: (type?: string) => {
    const params = type ? `?prediction_type=${type}` : ''
    return opsGet<{ predictions: Prediction[] }>(`predictions${params}`)
  },
  getBottlenecks: () => opsGet<{ bottlenecks: Bottleneck[]; count: number; critical_count: number; high_count: number }>('bottlenecks'),
  getRecommendations: (status?: string) => {
    const params = status ? `?status=${status}` : ''
    return opsGet<{ recommendations: Recommendation[]; count: number }>(`recommendations${params}`)
  },

  // Approvals
  getApprovals: (status?: string) => {
    const params = status ? `?status=${status}` : ''
    return opsGet<{ approvals: unknown[]; count: number }>(`approvals${params}`)
  },
  decide: (approvalId: string, decision: 'approve' | 'modify' | 'reject', reason?: string, modifications?: unknown[]) =>
    opsPost<{ approval: unknown; message: string }>(`approvals/${approvalId}/decide`, {
      decision, reason, modifications
    }),
  requestApproval: (recId: string) => opsPost<{ approval: unknown }>(`recommendations/${recId}/request-approval`),

  // Execution
  getExecutionLog: () => opsGet<{ execution_log: unknown[]; total: number }>('execution'),

  // Audit
  getAuditEvents: (limit = 100) => opsGet<{ events: unknown[]; total: number }>(`audit?limit=${limit}`),

  // Simulations
  getScenarios: () => opsGet<{ scenarios: SimScenario[] }>('simulations/scenarios'),
  runSimulation: (body: { scenario_type: string; with_curaflow: boolean; time_multiplier?: number }) =>
    opsPost<unknown>('simulations/run', body),

  // System
  getSystemHealth: () => opsGet<{ overall_status: string; components: SystemComponent[] }>('system-health'),
  getDataQuality: () => opsGet<{ sources: DataSource[]; overall_confidence: number }>('data-quality'),
  getAgentPerformance: () => opsGet<{ agents: AgentPerf[] }>('agents/performance'),

  // AI Chat
  chat: (message: string) =>
    opsPost<{ response: string; context: { pressure: string; timestamp: string }; timestamp: string }>('chat', { message }),

  // Patients
  getPatients: () => opsGet<{ patients: unknown[] }>('patients'),
  admitPatient: (body: { name: string; phone: string; type: string; dept: string; needsBed: boolean }) =>
    opsPost<{ status: string; patient: unknown }>('patients/admit', body),
}
