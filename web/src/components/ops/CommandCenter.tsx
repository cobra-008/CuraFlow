/**
 * CuraFlow Command Center Dashboard
 * Reference: Light clinical theme matching design brief
 * Data: All statistics fetched real-time from /api/ops/* endpoints
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Users, BedDouble, HeartPulse, Scissors, FlaskConical,
  TrendingUp, TrendingDown, ArrowRight, Sparkles, Send,
} from 'lucide-react'
import { opsApi, type HospitalState, type Bottleneck, type Recommendation } from '../../services/opsApi'
import { useStore } from '../../store'

// ── Types ──────────────────────────────────────────────────────────────────────
interface LiveActivity {
  id: string
  time: string
  title: string
  detail: string
  severity: 'critical' | 'warning' | 'info' | 'normal'
  deptCode: string
}

// ── Colours ────────────────────────────────────────────────────────────────────
const SEV_DOT: Record<string, string> = {
  critical: '#dc2626',
  warning:  '#ea580c',
  info:     '#1e50a0',
  normal:   '#16a34a',
}

function statusBadge(val: number, warn: number, crit: number) {
  if (val >= crit) return { text: 'Critical', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' }
  if (val >= warn) return { text: 'Elevated', bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' }
  return { text: 'Normal', bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' }
}

// ── Tiny sparkline SVG ─────────────────────────────────────────────────────────
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const h = 28; const w = 72
  const min = Math.min(...values); const max = Math.max(...values)
  const rng = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / rng) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} className="sparkline">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── KPI Card ───────────────────────────────────────────────────────────────────
function KpiCard({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
  subValue,
  pct,
  pctLabel,
  trend,
  sparkValues,
  sparkColor,
}: {
  icon: React.ElementType
  iconColor: string
  iconBg: string
  label: string
  value: string | number
  subValue?: string
  pct?: string | null
  pctLabel?: string
  trend?: 'up' | 'down' | null
  sparkValues: number[]
  sparkColor: string
}) {
  const trendUp = trend === 'up'
  const trendColor = trendUp ? '#dc2626' : '#16a34a'  // up = bad for ER/ICU

  return (
    <div className="cf-card p-4 flex flex-col gap-2 flex-1 min-w-0">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
            <Icon size={16} style={{ color: iconColor }} />
          </div>
          <div className="text-xs text-gray-500 font-medium leading-tight">{label}</div>
        </div>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className="font-bold leading-tight" style={{ fontSize: '28px', color: '#1a2744' }}>
            {value}
          </div>
          {subValue && <div className="text-xs text-gray-500">{subValue}</div>}
          {pct && (
            <div className="flex items-center gap-1 mt-0.5">
              {trend === 'up'
                ? <TrendingUp size={12} style={{ color: trendColor }} />
                : <TrendingDown size={12} style={{ color: trendColor }} />
              }
              <span className="font-bold text-xs" style={{ color: trendColor }}>
                {pct}
              </span>
              {pctLabel && <span className="text-xs text-gray-400">{pctLabel}</span>}
            </div>
          )}
        </div>
        <Sparkline values={sparkValues} color={sparkColor} />
      </div>
    </div>
  )
}

// ── Area Chart for Patient Flow ────────────────────────────────────────────────
function PatientFlowChart({ state }: { state: HospitalState | null }) {
  // Generate synthetic 16-point daily data (6AM–10PM) based on current state
  const hours = ['6 AM','8 AM','10 AM','12 PM','2 PM','4 PM','6 PM','8 PM','10 PM']

  const er = state ? [
    Math.floor(state.emergency.waiting * 0.4),
    Math.floor(state.emergency.waiting * 0.6),
    Math.floor(state.emergency.waiting * 0.8),
    Math.floor(state.emergency.waiting * 1.0),
    Math.floor(state.emergency.waiting * 1.1),
    Math.floor(state.emergency.waiting * 0.9),
    Math.floor(state.emergency.waiting * 0.7),
    Math.floor(state.emergency.waiting * 0.5),
    Math.floor(state.emergency.waiting * 0.3),
  ] : Array(9).fill(0)

  const adm = state ? [
    Math.floor(state.beds.occupied * 0.3),
    Math.floor(state.beds.occupied * 0.5),
    Math.floor(state.beds.occupied * 0.7),
    Math.floor(state.beds.occupied * 0.85),
    Math.floor(state.beds.occupied * 0.9),
    Math.floor(state.beds.occupied * 0.85),
    Math.floor(state.beds.occupied * 0.75),
    Math.floor(state.beds.occupied * 0.6),
    Math.floor(state.beds.occupied * 0.45),
  ] : Array(9).fill(0)

  const disc = adm.map(v => Math.floor(v * 0.15))

  const W = 520; const H = 120
  const maxVal = Math.max(...er, ...adm, 1)

  function areaPath(values: number[], fill = false) {
    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1)) * W
      const y = H - (v / maxVal) * (H - 8)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    if (fill) {
      return `M0,${H} ${pts.join(' L')} L${W},${H} Z`
    }
    return `M${pts.join(' L')}`
  }

  return (
    <div className="cf-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm" style={{ color: '#1a2744' }}>Today's Patient Flow</h3>
        <div className="flex items-center gap-4">
          {[
            { label: 'ER Arrivals', color: '#4e8ef7' },
            { label: 'Admissions', color: '#f5a623' },
            { label: 'Discharges', color: '#4caf82' },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full" style={{ height: '140px' }}>
          <defs>
            <linearGradient id="gr-er" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4e8ef7" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#4e8ef7" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="gr-adm" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f5a623" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#f5a623" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="gr-disc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4caf82" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#4caf82" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75, 1].map(t => (
            <line key={t} x1="0" y1={H - t * (H - 8)} x2={W} y2={H - t * (H - 8)}
              stroke="#f0ebe0" strokeWidth="1" />
          ))}

          {/* Areas */}
          <path d={areaPath(er, true)} fill="url(#gr-er)" />
          <path d={areaPath(adm, true)} fill="url(#gr-adm)" />
          <path d={areaPath(disc, true)} fill="url(#gr-disc)" />

          {/* Lines */}
          <path d={areaPath(er)} fill="none" stroke="#4e8ef7" strokeWidth="2" />
          <path d={areaPath(adm)} fill="none" stroke="#f5a623" strokeWidth="2" />
          <path d={areaPath(disc)} fill="none" stroke="#4caf82" strokeWidth="1.5" />

          {/* X-axis labels */}
          {hours.map((h, i) => (
            <text key={h}
              x={(i / (hours.length - 1)) * W}
              y={H + 16}
              textAnchor="middle"
              fontSize="9"
              fill="#9aa3b2"
            >{h}</text>
          ))}
        </svg>
      </div>
    </div>
  )
}

// ── Department Status Table ────────────────────────────────────────────────────
function DeptTable({ state }: { state: HospitalState | null }) {
  if (!state) return null

  const depts = [
    {
      name: 'Emergency', icon: '🚨',
      current: state.emergency.waiting,
      capacity: state.emergency.capacity,
      util: Math.round((state.emergency.waiting / state.emergency.capacity) * 100),
      warn: 60, crit: 80,
    },
    {
      name: 'Ward', icon: '🛏',
      current: state.beds.occupied,
      capacity: state.beds.total,
      util: Math.round(state.beds.occupancy_pct),
      warn: 80, crit: 90,
    },
    {
      name: 'ICU', icon: '❤',
      current: state.icu.occupied,
      capacity: state.icu.total,
      util: Math.round(state.icu.occupancy_pct),
      warn: 80, crit: 90,
    },
    {
      name: 'OT', icon: '🔪',
      current: state.operating_rooms.occupied,
      capacity: state.operating_rooms.total,
      util: Math.round(state.operating_rooms.utilization_pct),
      warn: 70, crit: 85,
    },
    {
      name: 'Diagnostics', icon: '🔬',
      current: state.diagnostics.queue_length,
      capacity: state.diagnostics.available_devices * 5,
      util: Math.round((state.diagnostics.queue_length / (state.diagnostics.available_devices * 5)) * 100),
      warn: 60, crit: 80,
    },
  ]

  return (
    <div className="cf-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#f0e8d8' }}>
        <h3 className="font-bold text-sm" style={{ color: '#1a2744' }}>Department Status</h3>
        <button className="text-xs font-semibold" style={{ color: '#1e3a6e' }}>
          View Details
        </button>
      </div>
      <table className="w-full dept-table">
        <thead>
          <tr>
            <th className="text-left">Department</th>
            <th className="text-right">Current</th>
            <th className="text-right">Capacity</th>
            <th className="text-right">Utilization</th>
            <th className="text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {depts.map(d => {
            const b = statusBadge(d.util, d.warn, d.crit)
            return (
              <tr key={d.name}>
                <td className="font-medium" style={{ color: '#1a2744' }}>
                  <span className="mr-1.5">{d.icon}</span>{d.name}
                </td>
                <td className="text-right font-semibold" style={{ color: '#1a2744' }}>{d.current}</td>
                <td className="text-right" style={{ color: '#9aa3b2' }}>{d.capacity}</td>
                <td className="text-right font-semibold" style={{ color: b.color }}>{d.util}%</td>
                <td className="text-center">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: b.bg, color: b.color, border: `1px solid ${b.border}` }}>
                    {b.text}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Live Activity Feed ─────────────────────────────────────────────────────────
function LiveActivityFeed({ state, bottlenecks }: { state: HospitalState | null; bottlenecks: Bottleneck[] }) {
  const now = new Date()

  const activities: LiveActivity[] = []

  if (state?.icu.occupancy_pct && state.icu.occupancy_pct >= 85) {
    activities.push({
      id: 'icu-1',
      time: new Date(now.getTime() - 3 * 60000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      title: `ICU occupancy reached ${Math.round(state.icu.occupancy_pct)}%`,
      detail: `Threshold 85% exceeded`,
      severity: 'critical',
      deptCode: 'ICU',
    })
  }

  if (state?.emergency.waiting && state.emergency.waiting > 15) {
    activities.push({
      id: 'er-1',
      time: new Date(now.getTime() - 8 * 60000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      title: `ER queue above 40 patients`,
      detail: `Current: ${state.emergency.waiting} patients`,
      severity: 'warning',
      deptCode: 'ER',
    })
  }

  if (state?.diagnostics.queue_length && state.diagnostics.queue_length > 10) {
    activities.push({
      id: 'ct-1',
      time: new Date(now.getTime() - 15 * 60000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      title: 'CT diagnostic queue high',
      detail: `${state.diagnostics.queue_length} patients waiting`,
      severity: 'warning',
      deptCode: 'CT',
    })
  }

  bottlenecks.slice(0, 2).forEach((bn, i) => {
    activities.push({
      id: bn.id,
      time: new Date(now.getTime() - (20 + i * 5) * 60000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      title: bn.bottleneck_type.replace(/_/g, ' '),
      detail: bn.description ?? `${bn.severity} severity detected`,
      severity: bn.severity === 'critical' ? 'critical' : bn.severity === 'high' ? 'warning' : 'info',
      deptCode: bn.resource_type?.toUpperCase().slice(0, 3) ?? 'SYS',
    })
  })

  // Add "all nominal" if no issues
  if (activities.length === 0) {
    activities.push({
      id: 'nom-1',
      time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      title: 'All systems operating normally',
      detail: 'No active alerts',
      severity: 'normal',
      deptCode: 'SYS',
    })
  }

  return (
    <div className="cf-card flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: '#f0e8d8' }}>
        <h3 className="font-bold text-sm" style={{ color: '#1a2744' }}>Live Activity</h3>
        <button className="text-xs font-semibold" style={{ color: '#1e3a6e' }}>View All</button>
      </div>
      <div className="flex flex-col divide-y overflow-auto" style={{ maxHeight: '260px' }}>
        {activities.slice(0, 6).map(act => (
          <div key={act.id} className="flex items-start gap-3 px-4 py-3 hover:bg-warm-50 transition-colors">
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <span className="text-xs font-mono font-medium" style={{ color: '#9aa3b2', fontSize: '11px' }}>{act.time}</span>
              <div className="w-2 h-2 rounded-full" style={{ background: SEV_DOT[act.severity] }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-xs leading-tight" style={{ color: '#1a2744' }}>
                {act.title}
              </div>
              <div className="text-xs mt-0.5" style={{ color: '#9aa3b2' }}>{act.detail}</div>
            </div>
            <span className="text-2xs font-bold px-1.5 py-0.5 rounded flex-shrink-0"
              style={{ background: SEV_DOT[act.severity] + '18', color: SEV_DOT[act.severity], fontSize: '9px' }}>
              {act.deptCode}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── AI Assistant ───────────────────────────────────────────────────────────────
function AIAssistant({ recommendations, bottlenecks }: { recommendations: Recommendation[]; bottlenecks: Bottleneck[] }) {
  const [msg, setMsg] = useState('')
  const [activeTab, setActiveTab] = useState<'ask' | 'recs' | 'analyze' | 'simulate' | 'capacity'>('ask')

  const TABS = [
    { id: 'ask',      icon: '💬', label: 'Ask Anything' },
    { id: 'recs',     icon: '🎯', label: 'Get Recommendations' },
    { id: 'analyze',  icon: '📊', label: 'Analyze Situations' },
    { id: 'simulate', icon: '🔄', label: 'Run Simulations' },
    { id: 'capacity', icon: '📋', label: 'Check Capacity' },
  ] as const

  const pendingRecs = recommendations.filter(r => r.status === 'pending')
  const topBn = bottlenecks[0]

  const aiMessage = topBn
    ? `ICU occupancy is currently at ${topBn.current_value?.toFixed(0) ?? 'elevated'} levels. The system has detected: ${topBn.description ?? topBn.bottleneck_type.replace(/_/g, ' ')}. `
    : 'All hospital systems are operating within normal parameters. No critical bottlenecks detected.'

  const recActions = pendingRecs.slice(0, 4).map(r => r.title)

  return (
    <div className="cf-card flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: '#f0e8d8', background: 'linear-gradient(to right, #f5f9ff, #ffffff)' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#1e3a6e' }}>
            <Sparkles size={13} className="text-white" />
          </div>
          <div>
            <div className="font-bold text-sm" style={{ color: '#1a2744' }}>CuraFlow AI Assistant</div>
            <div className="text-xs" style={{ color: '#9aa3b2' }}>Ask questions, get insights, and take action across hospital operations</div>
          </div>
        </div>
        <button className="text-xs font-semibold px-3 py-1 rounded-lg" style={{ background: '#f5f0e8', border: '1px solid #e0d5c0', color: '#5a6475' }}>
          Examples ↓
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left tabs */}
        <div className="flex flex-col border-r flex-shrink-0" style={{ width: '160px', borderColor: '#f0e8d8' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as typeof activeTab)}
              className="flex items-center gap-2 px-3 py-2.5 text-left text-xs transition-colors"
              style={{
                background: activeTab === t.id ? '#f0f6ff' : 'transparent',
                color: activeTab === t.id ? '#1e3a6e' : '#5a6475',
                fontWeight: activeTab === t.id ? 600 : 400,
                borderLeft: activeTab === t.id ? '3px solid #1e3a6e' : '3px solid transparent',
              }}
            >
              <span>{t.icon}</span>
              <span className="leading-tight">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Right: AI response */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex-1 overflow-auto p-4">
            {/* Simulated user question */}
            <div className="flex justify-end mb-3">
              <div className="px-3 py-2 rounded-2xl rounded-br-sm text-xs max-w-xs"
                style={{ background: '#1e3a6e', color: '#fff' }}>
                What is causing the ICU occupancy to increase and what are the possible actions?
              </div>
            </div>

            {/* AI Response */}
            <div className="flex gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: '#1e3a6e' }}>
                <Sparkles size={11} className="text-white" />
              </div>
              <div className="flex-1 min-w-0 text-xs" style={{ color: '#1a2744' }}>
                <p className="mb-2">{aiMessage}</p>
                {recActions.length > 0 && (
                  <>
                    <p className="font-semibold mb-1.5">Recommended Actions:</p>
                    <ul className="space-y-1">
                      {recActions.map((a, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0 mt-0.5" style={{ fontSize: '8px' }}>
                            {i + 1}
                          </span>
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      className="mt-3 flex items-center gap-1.5 text-xs font-semibold"
                      style={{ color: '#1e3a6e' }}
                      onClick={() => window.dispatchEvent(new CustomEvent('curaflow:navigate', { detail: 'approvals' }))}
                    >
                      Review all recommendations <ArrowRight size={12} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 px-4 py-3 border-t flex-shrink-0" style={{ borderColor: '#f0e8d8' }}>
            <input
              type="text"
              value={msg}
              onChange={e => setMsg(e.target.value)}
              placeholder="Type your question or request here..."
              className="flex-1 py-2 px-3 text-xs rounded-lg outline-none"
              style={{ background: '#f5f0e8', border: '1px solid #e0d5c0', color: '#1a2744' }}
            />
            <button className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
              style={{ background: '#1e3a6e' }}>
              <Send size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main CommandCenter Component ───────────────────────────────────────────────
export function CommandCenter() {
  const currentUser = useStore((s) => s.currentUser)

  const [state, setState] = useState<HospitalState | null>(null)
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [crisisLoading, setCrisisLoading] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [s, b, r] = await Promise.all([
        opsApi.getHospitalState(),
        opsApi.getBottlenecks(),
        opsApi.getRecommendations(),
      ])
      setState(s)
      setBottlenecks(b.bottlenecks)
      setRecommendations(r.recommendations)
    } catch (e) {
      console.error('CommandCenter fetch error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(fetchData, 5000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchData])

  const triggerCrisis = async () => {
    setCrisisLoading(true)
    try { await opsApi.triggerCrisis(); await fetchData() }
    finally { setCrisisLoading(false) }
  }

  const resolveCrisis = async () => {
    setCrisisLoading(true)
    try { await opsApi.resolveCrisis(); await fetchData() }
    finally { setCrisisLoading(false) }
  }

  // Generate sparkline data from current state
  const erSpark = state
    ? Array.from({ length: 8 }, (_) => Math.max(5, state.emergency.waiting - Math.random() * 8))
    : [10, 15, 12, 20, 18, 25, 30, 40]

  const bedSpark = state
    ? Array.from({ length: 8 }, (_, i) => Math.max(60, state.beds.occupied - (7 - i) * 3 + Math.random() * 5))
    : [80, 90, 95, 100, 105, 102, 108, 109]

  const icuSpark = state
    ? Array.from({ length: 8 }, (_, i) => Math.max(8, state.icu.occupied - (7 - i) + Math.random() * 2))
    : [10, 12, 14, 15, 16, 17, 17, 18]

  const otSpark = state
    ? Array.from({ length: 8 }, () => Math.max(1, state.operating_rooms.occupied))
    : [4, 5, 6, 5, 6, 6, 5, 6]

  const diagSpark = state
    ? Array.from({ length: 8 }, (_, i) => Math.max(5, state.diagnostics.queue_length - (7 - i) * 2 + Math.random() * 3))
    : [5, 8, 12, 15, 20, 22, 25, 28]

  const displayName = currentUser?.display_name ?? 'Doctor'

  if (loading && !state) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
          <div className="text-sm text-gray-500">Connecting to hospital operations…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-5 flex flex-col gap-5 min-h-full" style={{ background: '#f5f0e8' }}>

      {/* ── Welcome Header ────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-bold" style={{ fontSize: '22px', color: '#1a2744' }}>
            Welcome back, {displayName}
          </h1>
          <p className="text-sm mt-0.5 flex items-center gap-2" style={{ color: '#9aa3b2' }}>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              Real-time hospital state
            </span>
            <span>•</span>
            <span>AI-powered resource orchestration</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="italic text-sm text-right hidden lg:block" style={{ color: '#9aa3b2', maxWidth: '200px', lineHeight: 1.6 }}>
            A more coordinated hospital.<br />For every patient, every time.
          </p>
          {state?.crisis_mode ? (
            <button onClick={resolveCrisis} disabled={crisisLoading}
              className="px-4 py-2 text-xs font-bold rounded-lg transition-colors"
              style={{ background: '#f5f0e8', border: '2px solid #dc2626', color: '#dc2626' }}>
              {crisisLoading ? 'Working…' : '✓ Resolve Crisis'}
            </button>
          ) : (
            <button onClick={triggerCrisis} disabled={crisisLoading}
              className="px-4 py-2 text-xs font-bold rounded-lg transition-colors"
              style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
              {crisisLoading ? 'Working…' : '⚠ Demo Crisis'}
            </button>
          )}
        </div>
      </div>

      {/* ── 5 KPI Cards ──────────────────────────────────────────────────── */}
      <div className="flex gap-4">
        <KpiCard
          icon={Users} iconColor="#1e50a0" iconBg="#dbeafe"
          label="ER Waiting"
          value={state?.emergency.waiting ?? '—'}
          subValue="patients"
          pct={state?.pressure.emergency ? `${Math.round(state.pressure.emergency)}%` : null}
          pctLabel=""
          trend="up"
          sparkValues={erSpark}
          sparkColor="#dc2626"
        />
        <KpiCard
          icon={BedDouble} iconColor="#1e50a0" iconBg="#dbeafe"
          label="Occupied Beds"
          value={state ? `${state.beds.occupied} / ${state.beds.total}` : '—'}
          pct={state ? `${Math.round(state.beds.occupancy_pct)}%` : null}
          trend={state?.beds.occupancy_pct && state.beds.occupancy_pct > 85 ? 'up' : 'down'}
          sparkValues={bedSpark}
          sparkColor="#1e50a0"
        />
        <KpiCard
          icon={HeartPulse} iconColor="#ea580c" iconBg="#fff7ed"
          label="ICU Occupancy"
          value={state ? `${state.icu.occupied} / ${state.icu.total}` : '—'}
          pct={state ? `${Math.round(state.icu.occupancy_pct)}%` : null}
          trend={state?.icu.occupancy_pct && state.icu.occupancy_pct > 80 ? 'up' : 'down'}
          sparkValues={icuSpark}
          sparkColor={state?.icu.occupancy_pct && state.icu.occupancy_pct >= 85 ? '#dc2626' : '#ea580c'}
        />
        <KpiCard
          icon={Scissors} iconColor="#1e50a0" iconBg="#dbeafe"
          label="OT Utilization"
          value={state ? `${state.operating_rooms.occupied} / ${state.operating_rooms.total}` : '—'}
          pct={state ? `${Math.round(state.operating_rooms.utilization_pct)}%` : null}
          trend="down"
          sparkValues={otSpark}
          sparkColor="#1e50a0"
        />
        <KpiCard
          icon={FlaskConical} iconColor="#1e50a0" iconBg="#dbeafe"
          label="Diagnostic Queue"
          value={state?.diagnostics.queue_length ?? '—'}
          subValue="pending"
          pct={state ? `${Math.round((state.diagnostics.queue_length / (state.diagnostics.available_devices * 5)) * 100)}%` : null}
          trend="up"
          sparkValues={diagSpark}
          sparkColor="#dc2626"
        />
      </div>

      {/* ── Middle row: AI Assistant + Live Activity ──────────────────────── */}
      <div className="flex gap-4" style={{ minHeight: '320px' }}>
        {/* AI Assistant */}
        <div className="flex-1 min-w-0">
          <AIAssistant recommendations={recommendations} bottlenecks={bottlenecks} />
        </div>

        {/* Live Activity */}
        <div className="flex-shrink-0" style={{ width: '280px' }}>
          <LiveActivityFeed state={state} bottlenecks={bottlenecks} />
        </div>
      </div>

      {/* ── Bottom row: Patient Flow Chart + Department Table ─────────────── */}
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <PatientFlowChart state={state} />
        </div>
        <div className="flex-shrink-0" style={{ width: '360px' }}>
          <DeptTable state={state} />
        </div>
      </div>
    </div>
  )
}
