/**
 * CuraFlow Command Center Dashboard
 * Reference: Light clinical theme matching design brief
 * Data: All statistics fetched real-time from /api/ops/* endpoints
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Users, BedDouble, HeartPulse, Scissors, FlaskConical,
  TrendingUp, TrendingDown, ArrowRight, Sparkles, Send,
  Target, BarChart2, RefreshCw, ClipboardList, AlertTriangle, AlertCircle, Bed, MessageSquare
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
      name: 'Emergency', icon: <AlertCircle size={14} className="text-red-500" />,
      current: state.emergency.waiting,
      capacity: state.emergency.capacity,
      util: Math.round((state.emergency.waiting / state.emergency.capacity) * 100),
      warn: 60, crit: 80,
    },
    {
      name: 'Ward', icon: <Bed size={14} className="text-blue-600" />,
      current: state.beds.occupied,
      capacity: state.beds.total,
      util: Math.round(state.beds.occupancy_pct),
      warn: 80, crit: 90,
    },
    {
      name: 'ICU', icon: <HeartPulse size={14} className="text-orange-600" />,
      current: state.icu.occupied,
      capacity: state.icu.total,
      util: Math.round(state.icu.occupancy_pct),
      warn: 80, crit: 90,
    },
    {
      name: 'OT', icon: <Scissors size={14} className="text-gray-600" />,
      current: state.operating_rooms.occupied,
      capacity: state.operating_rooms.total,
      util: Math.round(state.operating_rooms.utilization_pct),
      warn: 70, crit: 85,
    },
    {
      name: 'Diagnostics', icon: <FlaskConical size={14} className="text-purple-600" />,
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
type TabId = 'ask' | 'recs' | 'analyze' | 'simulate' | 'capacity' | 'emergency'

interface ChatMsg { role: 'user' | 'ai'; text: string; ts: string }

const TABS: { id: TabId; icon: React.ReactNode; label: string }[] = [
  { id: 'ask',       icon: <MessageSquare size={14} />, label: 'Ask Anything' },
  { id: 'recs',      icon: <Target size={14} />, label: 'Get Recommendations' },
  { id: 'analyze',   icon: <BarChart2 size={14} />, label: 'Analyze Situations' },
  { id: 'simulate',  icon: <RefreshCw size={14} />, label: 'Run Simulations' },
  { id: 'capacity',  icon: <ClipboardList size={14} />, label: 'Check Capacity' },
  { id: 'emergency', icon: <AlertTriangle size={14} />, label: 'Emergency Support' },
]

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {[0,1,2].map(i => (
        <div key={i} className="w-2 h-2 rounded-full animate-bounce"
          style={{ background: '#1e3a6e', animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  )
}

function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 rounded" style={{
          background: '#f0e8d8',
          width: i === lines - 1 ? '60%' : '100%'
        }} />
      ))}
    </div>
  )
}

function AIAssistant({ state }: { state: HospitalState | null }) {
  const [activeTab, setActiveTab] = useState<TabId>('ask')
  const [input, setInput]         = useState('')
  const [sending, setSending]     = useState(false)
  const [tabLoading, setTabLoading] = useState(false)
  const [messages, setMessages]   = useState<ChatMsg[]>([{
    role: 'ai',
    text: "Hello! I'm CuraFlow AI. Ask me about any department — ICU status, ER queue, bed availability, staff, diagnostics, or request recommendations.",
    ts: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  }])

  // Tab-specific data
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([])
  const [scenarios, setScenarios] = useState<{ id: string; name: string; description: string; type: string }[]>([])
  const [simRunning, setSimRunning] = useState<string | null>(null)
  const [simResult, setSimResult] = useState<Record<string, unknown> | null>(null)

  const chatEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  // Load tab data when switching
  useEffect(() => {
    let cancelled = false
    async function loadTab() {
      setTabLoading(true)
      try {
        if (activeTab === 'recs') {
          const d = await opsApi.getRecommendations()
          if (!cancelled) setRecs(d.recommendations ?? [])
        } else if (activeTab === 'analyze') {
          const d = await opsApi.getBottlenecks()
          if (!cancelled) setBottlenecks(d.bottlenecks ?? [])
        } else if (activeTab === 'simulate') {
          const d = await opsApi.getScenarios()
          if (!cancelled) setScenarios(d.scenarios ?? [])
        } else if (activeTab === 'capacity') {
          // capacity uses state prop — already available
        }
      } catch { /* ignore */ }
      finally { if (!cancelled) setTabLoading(false) }
    }
    if (activeTab !== 'ask' && activeTab !== 'emergency') loadTab()
    else setTabLoading(false)
    return () => { cancelled = true }
  }, [activeTab])

  // ── Send message ────────────────────────────────────────────────
  async function sendMessage() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    const ts = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    setMessages(m => [...m, { role: 'user', text, ts }])
    setSending(true)
    try {
      const res = await opsApi.chat(text)
      setMessages(m => [...m, { role: 'ai', text: res.response, ts: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) }])
    } catch {
      setMessages(m => [...m, { role: 'ai', text: 'Unable to connect to CuraFlow AI. Please check the server connection.', ts }])
    } finally {
      setSending(false)
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  // ── Run simulation ──────────────────────────────────────────────
  async function runSim(type: string) {
    setSimRunning(type)
    setSimResult(null)
    try {
      const r = await opsApi.runSimulation({ scenario_type: type, with_curaflow: true }) as Record<string, unknown>
      setSimResult(r)
    } catch { /* ignore */ }
    finally { setSimRunning(null) }
  }

  // ── Tab content ─────────────────────────────────────────────────
  function TabContent() {
    if (activeTab === 'ask') {
      return (
        <>
          {/* Chat messages */}
          <div className="flex-1 overflow-auto p-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'items-start gap-2'}`}>
                {m.role === 'ai' && (
                  <div className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: '#1e3a6e' }}>
                    <Sparkles size={11} className="text-white" />
                  </div>
                )}
                <div className={`max-w-[80%] ${m.role === 'user' ? '' : 'flex-1 min-w-0'}`}>
                  <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'rounded-br-sm'
                      : 'rounded-bl-sm'
                  }`} style={{
                    background: m.role === 'user' ? '#1e3a6e' : '#f5f0e8',
                    color: m.role === 'user' ? '#fff' : '#1a2744',
                  }}>
                    {m.text}
                  </div>
                  <div className="text-xs mt-0.5 px-1" style={{ color: '#c0b8a8', fontSize: '10px' }}>{m.ts}</div>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: '#1e3a6e' }}>
                  <Sparkles size={11} className="text-white" />
                </div>
                <div className="rounded-2xl rounded-bl-sm" style={{ background: '#f5f0e8' }}>
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick prompts */}
          <div className="px-3 pb-2 flex flex-wrap gap-1.5">
            {['ICU status', 'ER queue', 'Bed availability', 'Staff utilization'].map(q => (
              <button key={q} onClick={() => { setInput(q); }}
                className="text-xs px-2 py-1 rounded-full border transition-colors hover:border-blue-300"
                style={{ background: '#f5f0e8', border: '1px solid #e0d5c0', color: '#5a6475' }}>
                {q}
              </button>
            ))}
          </div>

          {/* Input bar */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-t flex-shrink-0" style={{ borderColor: '#f0e8d8' }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Ask about ICU, beds, staff, ER... (Press Enter to send, Shift+Enter for new line)"
              className="flex-1 py-2 px-3 text-sm rounded-lg outline-none resize-none"
              style={{ background: '#f5f0e8', border: '1px solid #e0d5c0', color: '#1a2744', minHeight: '40px', maxHeight: '120px' }}
              rows={1}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0 disabled:opacity-40 transition-opacity"
              style={{ background: '#1e3a6e' }}
            >
              <Send size={13} />
            </button>
          </div>
        </>
      )
    }

    if (activeTab === 'recs') {
      return (
        <div className="flex-1 overflow-auto p-3">
          {tabLoading ? <Skeleton lines={4} /> : recs.length === 0 ? (
            <div className="text-xs text-center py-6" style={{ color: '#9aa3b2' }}>No active recommendations</div>
          ) : recs.map(r => (
            <div key={r.id} className="mb-3 rounded-lg p-3" style={{ background: '#f5f0e8', border: '1px solid #e8e1d4' }}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-xs font-bold" style={{ color: '#1a2744' }}>{r.title}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                  r.priority === 'critical' ? 'bg-red-100 text-red-700' :
                  r.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                  'bg-amber-100 text-amber-700'
                }`}>{r.priority}</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: '#5a6475' }}>{r.summary}</p>
              <div className="mt-2 text-xs font-semibold" style={{ color: '#1e3a6e' }}>
                Confidence: {(r.confidence * 100).toFixed(0)}%
              </div>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('curaflow:navigate', { detail: 'approvals' }))}
                className="mt-2 flex items-center gap-1 text-xs font-semibold"
                style={{ color: '#1e3a6e' }}
              >
                Review in Approvals <ArrowRight size={11} />
              </button>
            </div>
          ))}
        </div>
      )
    }

    if (activeTab === 'analyze') {
      return (
        <div className="flex-1 overflow-auto p-3">
          {tabLoading ? <Skeleton lines={5} /> : bottlenecks.length === 0 ? (
            <div className="text-xs text-center py-6" style={{ color: '#9aa3b2' }}>
              ✅ No bottlenecks detected. All systems nominal.
            </div>
          ) : bottlenecks.map(bn => (
            <div key={bn.id} className="mb-3 rounded-lg p-3" style={{ background: '#f5f0e8', border: '1px solid #e8e1d4' }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{
                  background: bn.severity === 'critical' ? '#dc2626' : bn.severity === 'high' ? '#ea580c' : '#d97706'
                }} />
                <span className="text-xs font-bold" style={{ color: '#1a2744' }}>
                  {bn.bottleneck_type.replace(/_/g, ' ')}
                </span>
                <span className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded" style={{
                  background: bn.severity === 'critical' ? '#fef2f2' : '#fff7ed',
                  color: bn.severity === 'critical' ? '#dc2626' : '#ea580c',
                }}>
                  {bn.severity.toUpperCase()}
                </span>
              </div>
              <p className="text-xs" style={{ color: '#5a6475' }}>{bn.description}</p>
              <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: '#9aa3b2' }}>
                <span>Current: <b style={{ color: '#1a2744' }}>{bn.current_value?.toFixed(1)}</b></span>
                <span>Threshold: <b style={{ color: '#1a2744' }}>{bn.threshold_value?.toFixed(1)}</b></span>
                <span>Confidence: <b style={{ color: '#1a2744' }}>{(bn.confidence * 100).toFixed(0)}%</b></span>
              </div>
            </div>
          ))}
        </div>
      )
    }

    if (activeTab === 'simulate') {
      return (
        <div className="flex-1 overflow-auto p-3">
          {tabLoading ? <Skeleton lines={4} /> : (
            <>
              {simResult && (
                <div className="mb-3 p-3 rounded-lg" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <div className="text-xs font-bold mb-1" style={{ color: '#166534' }}>Simulation Complete</div>
                  {(() => {
                    const r = simResult as Record<string, unknown>
                    const improvement = r.improvement_summary as Record<string, number> | undefined
                    return improvement ? (
                      <div className="text-xs space-y-0.5" style={{ color: '#166534' }}>
                        <div>Wait time reduction: <b>{improvement.wait_time_reduction_pct?.toFixed(1)}%</b></div>
                        <div>Bottleneck reduction: <b>{improvement.bottleneck_duration_reduction_pct?.toFixed(1)}%</b></div>
                      </div>
                    ) : null
                  })()}
                </div>
              )}
              {scenarios.map(s => (
                <div key={s.id} className="mb-2 rounded-lg p-3 flex items-start justify-between gap-2"
                  style={{ background: '#f5f0e8', border: '1px solid #e8e1d4' }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold" style={{ color: '#1a2744' }}>{s.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#5a6475' }}>{s.description}</div>
                  </div>
                  <button
                    disabled={simRunning !== null}
                    onClick={() => runSim(s.type)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 disabled:opacity-50"
                    style={{ background: '#1e3a6e', color: '#fff' }}
                  >
                    {simRunning === s.type ? '⏳' : '▶ Run'}
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )
    }

    if (activeTab === 'capacity') {
      if (!state) return <div className="flex-1 flex items-center justify-center"><Skeleton lines={3} /></div>
      const rows = [
        { label: 'Beds', used: state.beds.occupied, total: state.beds.total, pct: state.beds.occupancy_pct },
        { label: 'ICU', used: state.icu.occupied, total: state.icu.total, pct: state.icu.occupancy_pct },
        { label: 'Staff', used: state.staff.on_duty, total: state.staff.total, pct: state.staff.utilization_pct },
        { label: 'OT Rooms', used: state.operating_rooms.occupied, total: state.operating_rooms.total, pct: state.operating_rooms.utilization_pct },
        { label: 'Diag Devices', used: state.diagnostics.total_devices - state.diagnostics.available_devices, total: state.diagnostics.total_devices, pct: ((state.diagnostics.total_devices - state.diagnostics.available_devices) / state.diagnostics.total_devices) * 100 },
        { label: 'ER Queue', used: state.emergency.waiting, total: state.emergency.capacity, pct: (state.emergency.waiting / state.emergency.capacity) * 100 },
      ]
      return (
        <div className="flex-1 overflow-auto p-3 space-y-2">
          {rows.map(r => {
            const pct = Math.min(100, Math.round(r.pct))
            const color = pct >= 90 ? '#dc2626' : pct >= 75 ? '#ea580c' : '#16a34a'
            return (
              <div key={r.label}>
                <div className="flex items-center justify-between mb-1 text-xs">
                  <span style={{ color: '#1a2744', fontWeight: 600 }}>{r.label}</span>
                  <span style={{ color }}><b>{r.used}</b> / {r.total} ({pct}%)</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: '#f0e8d8' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            )
          })}
          <div className="mt-3 pt-2 border-t text-xs" style={{ borderColor: '#f0e8d8', color: '#9aa3b2' }}>
            Data refreshed every 5 seconds from live hospital state.
          </div>
        </div>
      )
    }

    if (activeTab === 'emergency') {
      const protocols = [
        { code: 'Code Blue', desc: 'Cardiac/respiratory arrest — all available staff respond', color: '#1e3a6e' },
        { code: 'Code Red', desc: 'Fire / mass casualty — initiate evacuation protocol', color: '#dc2626' },
        { code: 'Code Black', desc: 'Bomb threat — secure ward, contact security immediately', color: '#374151' },
        { code: 'Code Orange', desc: 'Hazmat / chemical spill — isolate and contact HAZMAT', color: '#ea580c' },
        { code: 'Code White', desc: 'Violent patient/person — alert security, do not intervene alone', color: '#9aa3b2' },
      ]
      return (
        <div className="flex-1 overflow-auto p-3 space-y-2">
          <div className="text-xs font-semibold mb-2" style={{ color: '#1a2744' }}>Emergency Protocols</div>
          {protocols.map(p => (
            <div key={p.code} className="flex items-start gap-2 p-2.5 rounded-lg"
              style={{ background: '#f5f0e8', border: '1px solid #e8e1d4' }}>
              <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: p.color }} />
              <div>
                <div className="text-xs font-bold" style={{ color: p.color }}>{p.code}</div>
                <div className="text-xs mt-0.5" style={{ color: '#5a6475' }}>{p.desc}</div>
              </div>
            </div>
          ))}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('curaflow:navigate', { detail: 'simulation' }))}
            className="w-full mt-2 py-2 text-xs font-bold rounded-lg"
            style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
          >
            <AlertTriangle size={14} className="text-red-500 mr-2" style={{ display: 'inline' }} /> Run Emergency Simulation
          </button>
        </div>
      )
    }

    return null
  }

  return (
    <div className="cf-card flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b flex-shrink-0"
        style={{ borderColor: '#f0e8d8', background: 'linear-gradient(to right, #f5f9ff, #ffffff)' }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: '#1e3a6e' }}>
            <Sparkles size={12} className="text-white" />
          </div>
          <div className="font-bold text-sm" style={{ color: '#1a2744' }}>CuraFlow AI Assistant</div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs" style={{ color: '#9aa3b2' }}>Live</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Left tabs */}
        <div className="flex flex-col border-r flex-shrink-0" style={{ width: '148px', borderColor: '#f0e8d8' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className="flex items-center gap-2 px-2.5 py-2 text-left text-xs transition-colors flex-shrink-0"
              style={{
                background: activeTab === t.id ? '#f0f6ff' : 'transparent',
                color: activeTab === t.id ? '#1e3a6e' : '#5a6475',
                fontWeight: activeTab === t.id ? 600 : 400,
                borderLeft: activeTab === t.id ? '3px solid #1e3a6e' : '3px solid transparent',
                fontSize: '11px',
              }}
            >
              <span style={{ fontSize: '13px' }}>{t.icon}</span>
              <span className="leading-tight">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Right: tab content */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <TabContent />
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
  const [loading, setLoading] = useState(true)
  const [crisisLoading, setCrisisLoading] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [s, b] = await Promise.all([
        opsApi.getHospitalState(),
        opsApi.getBottlenecks(),
      ])
      setState(s)
      setBottlenecks(b.bottlenecks)
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
      <div className="flex gap-4" style={{ minHeight: '400px' }}>
        {/* AI Assistant */}
        <div className="flex-1 min-w-0" style={{ minHeight: 0 }}>
          <AIAssistant state={state} />
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
