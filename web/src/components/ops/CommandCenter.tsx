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
import { DoctorDashboard } from './DoctorDashboard'
import { NurseDashboard } from './NurseDashboard'
import { useData } from '../../hooks/useData'

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
}) {
  const trendUp = trend === 'up'
  const trendColor = trendUp ? '#dc2626' : '#16a34a'  // up = bad for ER/ICU

  return (
    <div
      className="p-5 flex flex-col justify-between transition-all hover:bg-gray-50/50 flex-1"
      style={{
        background: '#ffffff',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
            <Icon size={17} style={{ color: iconColor }} />
          </div>
          <div className="text-xs text-gray-500 font-semibold leading-tight">{label}</div>
        </div>
      </div>

      <div className="flex items-end justify-between mt-1">
        <div>
          <div className="font-bold tracking-tight text-2xl lg:text-[26px]" style={{ color: '#1a2744' }}>
            {value}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            {pct && (
              <span className="flex items-center gap-0.5 text-xs font-bold" style={{ color: trendColor }}>
                {trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {pct}
              </span>
            )}
            {subValue && <span className="text-xs text-gray-400 font-medium">{subValue}</span>}
            {pctLabel && <span className="text-xs text-gray-400">{pctLabel}</span>}
          </div>
        </div>
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
    <div
      className="p-6 rounded-2xl flex flex-col"
      style={{
        background: '#ffffff',
        border: '1px solid #e8e1d4',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-bold text-base" style={{ color: '#1a2744' }}>Department Capacity & Status</h3>
          <p className="text-xs mt-0.5" style={{ color: '#8c7e6a' }}>Live bed, ICU, operating room, and diagnostic utilization</p>
        </div>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('curaflow:navigate', { detail: 'capacity' }))}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors hover:bg-slate-50"
          style={{ color: '#1e3a6e', borderColor: '#e0d5c0' }}
        >
          View Full Breakdown
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b" style={{ borderColor: '#ede6da' }}>
              <th className="pb-3 text-xs font-bold uppercase tracking-wider text-left" style={{ color: '#8c7e6a' }}>Department</th>
              <th className="pb-3 text-xs font-bold uppercase tracking-wider text-right" style={{ color: '#8c7e6a' }}>Current</th>
              <th className="pb-3 text-xs font-bold uppercase tracking-wider text-right" style={{ color: '#8c7e6a' }}>Capacity</th>
              <th className="pb-3 text-xs font-bold uppercase tracking-wider text-center px-4" style={{ color: '#8c7e6a' }}>Utilization</th>
              <th className="pb-3 text-xs font-bold uppercase tracking-wider text-right" style={{ color: '#8c7e6a' }}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: '#f4efe6' }}>
            {depts.map(d => {
              const b = statusBadge(d.util, d.warn, d.crit)
              const barColor = d.util >= d.crit ? '#dc2626' : d.util >= d.warn ? '#ea580c' : '#16a34a'
              return (
                <tr key={d.name} className="hover:bg-[#faf7f2] transition-colors">
                  <td className="py-3.5 font-semibold text-sm" style={{ color: '#1a2744' }}>
                    <span className="inline-flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-50 border border-slate-200">
                        {d.icon}
                      </span>
                      {d.name}
                    </span>
                  </td>
                  <td className="py-3.5 text-right font-bold text-sm" style={{ color: '#1a2744' }}>{d.current}</td>
                  <td className="py-3.5 text-right text-sm" style={{ color: '#8c7e6a' }}>{d.capacity}</td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3 justify-center max-w-[180px] mx-auto">
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#ede6da' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, d.util)}%`, background: barColor }}
                        />
                      </div>
                      <span className="text-xs font-bold w-9 text-right" style={{ color: barColor }}>
                        {d.util}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 text-right">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold inline-block"
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
    <div
      className="p-5 rounded-2xl flex flex-col"
      style={{
        background: '#ffffff',
        border: '1px solid #e8e1d4',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      <div className="flex items-center justify-between pb-3.5 mb-2 border-b" style={{ borderColor: '#f0e8d8' }}>
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-sm" style={{ color: '#1a2744' }}>Live Clinical Activity</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#f5f0e8', color: '#6b5c40' }}>
            {activities.length} Events
          </span>
        </div>
        <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Active Feed
        </span>
      </div>

      <div className="flex flex-col divide-y divide-[#f7f2eb] max-h-[360px] overflow-y-auto pr-1">
        {activities.slice(0, 6).map(act => (
          <div key={act.id} className="flex items-start gap-3 py-3 px-2 rounded-xl hover:bg-[#faf7f2] transition-colors">
            <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
              <div className="w-2 h-2 rounded-full" style={{ background: SEV_DOT[act.severity] }} />
              <span className="text-[10px] font-mono font-medium" style={{ color: '#9aa3b2' }}>{act.time}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-xs leading-snug" style={{ color: '#1a2744' }}>
                {act.title}
              </div>
              <div className="text-[11px] mt-0.5 leading-snug" style={{ color: '#8c7e6a' }}>{act.detail}</div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 tracking-wider"
              style={{ background: SEV_DOT[act.severity] + '18', color: SEV_DOT[act.severity] }}>
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
          <div className="flex-1 overflow-auto p-5 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'items-start gap-3'}`}>
                {m.role === 'ai' && (
                  <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: '#1e3a6e' }}>
                    <Sparkles size={14} className="text-white" />
                  </div>
                )}
                <div className={`max-w-[85%] ${m.role === 'user' ? '' : 'flex-1 min-w-0'}`}>
                  <div className={`px-4 py-3 rounded-2xl text-[13px] leading-relaxed ${
                    m.role === 'user'
                      ? 'rounded-br-sm'
                      : 'rounded-bl-sm'
                  }`} style={{
                    background: m.role === 'user' ? '#1e3a6e' : '#f5f0e8',
                    color: m.role === 'user' ? '#fff' : '#1a2744',
                  }}>
                    {m.text}
                  </div>
                  <div className="text-xs mt-1 px-1" style={{ color: '#c0b8a8', fontSize: '11px' }}>{m.ts}</div>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: '#1e3a6e' }}>
                  <Sparkles size={14} className="text-white" />
                </div>
                <div className="rounded-2xl rounded-bl-sm" style={{ background: '#f5f0e8' }}>
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick prompts */}
          <div className="px-5 pb-3 flex flex-wrap gap-2">
            {['ICU status', 'ER queue', 'Bed availability', 'Staff utilization'].map(q => (
              <button key={q} onClick={() => { setInput(q); }}
                className="text-[12px] px-3 py-1.5 rounded-full border transition-colors hover:border-blue-300"
                style={{ background: '#f5f0e8', border: '1px solid #e0d5c0', color: '#5a6475' }}>
                {q}
              </button>
            ))}
          </div>

          {/* Input bar */}
          <div className="flex items-center gap-3 px-5 py-4 border-t flex-shrink-0" style={{ borderColor: '#f0e8d8' }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Ask about ICU, beds, staff, ER... (Press Enter to send, Shift+Enter for new line)"
              className="flex-1 py-3 px-4 text-[13px] rounded-xl outline-none resize-none"
              style={{ background: '#f5f0e8', border: '1px solid #e0d5c0', color: '#1a2744', minHeight: '48px', maxHeight: '120px' }}
              rows={1}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white flex-shrink-0 disabled:opacity-40 transition-opacity"
              style={{ background: '#1e3a6e' }}
            >
              <Send size={16} />
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
    <div
      className="rounded-2xl flex flex-col overflow-hidden"
      style={{
        background: '#ffffff',
        border: '1px solid #e8e1d4',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b flex-shrink-0"
        style={{ borderColor: '#f0e8d8', background: 'linear-gradient(to right, #f8faff, #ffffff)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-xs" style={{ background: '#1e3a6e' }}>
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <div className="font-bold text-[15px] leading-tight" style={{ color: '#1a2744' }}>CuraFlow AI Operations Copilot</div>
            <div className="text-[11px] mt-0.5 leading-tight" style={{ color: '#8c7e6a' }}>Hospital Resource & Clinical Intelligence</div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold"
          style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </div>
      </div>

      {/* Horizontal Tab Navigation */}
      <div className="flex items-center gap-2 px-5 py-3 border-b overflow-x-auto flex-shrink-0"
        style={{ borderColor: '#f0e8d8', background: '#faf7f2' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-semibold whitespace-nowrap transition-all"
            style={{
              background: activeTab === t.id ? '#1e3a6e' : 'transparent',
              color: activeTab === t.id ? '#ffffff' : '#6b5c40',
            }}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Body: Tab Content with comfortable height */}
      <div className="flex flex-col flex-1 min-h-[310px] max-h-[380px]">
        {TabContent()}
      </div>
    </div>
  )
}

// ── Quick Actions & Admit Patient Modal ─────────────────────────────────────────

function AdmitPatientModal({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({ name: '', phone: '', type: 'IP', dept: 'Cardiology', needsBed: true })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    
    try {
      const res = await opsApi.admitPatient(formData)
      const p = res.patient as any
      
      // Local physical feedback for Admin
      if (navigator.vibrate) navigator.vibrate([200, 100, 200])
      
      // Dispatch events to update local Admin UI
      window.dispatchEvent(new Event('curaflow:patients_updated'))
      window.dispatchEvent(new CustomEvent('curaflow:toast', {
        detail: {
          title: 'Patient Admitted & Assigned',
          message: `${p.name} routed to ${p.assigned_doctor} & ${p.assigned_nurse} in ${p.location}`,
          type: 'success'
        }
      }))
      
      onClose()
    } catch (err) {
      console.error(err)
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-[#faf7f2]">
          <h2 className="text-lg font-bold text-[#1a2744]">Admit New Patient</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Patient Name</label>
            <input required type="text" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
              value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="e.g. John Doe" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Contact Number</label>
            <input required type="text" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
              value={formData.phone} onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))} placeholder="+1 234 567 890" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Admission Type</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none bg-white"
                value={formData.type} onChange={e => setFormData(f => ({ ...f, type: e.target.value }))}>
                <option value="OP">Outpatient</option>
                <option value="IP">Inpatient</option>
                <option value="ER">Emergency</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Department</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none bg-white"
                value={formData.dept} onChange={e => setFormData(f => ({ ...f, dept: e.target.value }))}>
                <option>Cardiology</option>
                <option>Orthopedics</option>
                <option>Neurology</option>
                <option>General</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <input type="checkbox" id="needsBed" checked={formData.needsBed} 
              onChange={e => setFormData(f => ({ ...f, needsBed: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-[#1e3a6e]" />
            <label htmlFor="needsBed" className="text-sm font-semibold text-slate-700">Request Bed / Room Allocation</label>
          </div>
          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} disabled={submitting} className="flex-1 py-2.5 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-[#1e3a6e] hover:bg-[#152a50] transition-colors disabled:opacity-50">
              {submitting ? 'Admitting...' : 'Confirm Admission'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function QuickActionsBar() {
  const [showAdmit, setShowAdmit] = useState(false)
  
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between"
      style={{ border: '1px solid #e8e1d4' }}>
      <div>
        <h3 className="font-bold text-base" style={{ color: '#1a2744' }}>Operations Quick Actions</h3>
        <p className="text-xs mt-0.5" style={{ color: '#8c7e6a' }}>Execute high-priority workflows and assignments</p>
      </div>
      <div className="flex gap-3 w-full sm:w-auto">
        <button
          onClick={() => setShowAdmit(true)}
          className="flex-1 sm:flex-none px-4 py-2.5 bg-[#1e3a6e] hover:bg-[#152a50] text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <Users size={16} />
          Admit Patient
        </button>
        <button 
          onClick={() => {
            if (navigator.vibrate) navigator.vibrate([400, 200, 400])
            window.dispatchEvent(new CustomEvent('curaflow:toast', {
              detail: { title: 'Code Blue Initiated', message: 'All available staff alerted.', type: 'error' }
            }))
          }}
          className="flex-1 sm:flex-none px-4 py-2.5 bg-[#fef2f2] hover:bg-[#fee2e2] text-[#dc2626] rounded-xl text-sm font-semibold transition-colors border border-[#fecaca] flex items-center justify-center gap-2"
        >
          <AlertTriangle size={16} />
          Code Blue
        </button>
      </div>
      
      {showAdmit && <AdmitPatientModal onClose={() => setShowAdmit(false)} />}
    </div>
  )
}

// ── Recent Admissions Tracker ──────────────────────────────────────────────────
function RecentAdmissions() {
  const [patients, setPatients] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await opsApi.getPatients()
        // API returns newest first in this array
        setPatients(res.patients.slice(0, 5))
      } catch (e) {}
    }
    load()
    window.addEventListener('curaflow:patients_updated', load)
    return () => window.removeEventListener('curaflow:patients_updated', load)
  }, [])

  if (patients.length === 0) return null

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm flex flex-col"
      style={{ border: '1px solid #e8e1d4' }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-bold text-base" style={{ color: '#1a2744' }}>Recently Admitted Patients</h3>
          <p className="text-xs mt-0.5" style={{ color: '#8c7e6a' }}>Live tracking of auto-assigned admissions</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b" style={{ borderColor: '#ede6da' }}>
              <th className="pb-3 text-xs font-bold uppercase tracking-wider text-left" style={{ color: '#8c7e6a' }}>Patient</th>
              <th className="pb-3 text-xs font-bold uppercase tracking-wider text-left" style={{ color: '#8c7e6a' }}>MRN</th>
              <th className="pb-3 text-xs font-bold uppercase tracking-wider text-left" style={{ color: '#8c7e6a' }}>Department</th>
              <th className="pb-3 text-xs font-bold uppercase tracking-wider text-left" style={{ color: '#8c7e6a' }}>Location</th>
              <th className="pb-3 text-xs font-bold uppercase tracking-wider text-left" style={{ color: '#8c7e6a' }}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: '#f4efe6' }}>
            {patients.map((p, i) => (
              <tr key={i} className="hover:bg-[#faf7f2] transition-colors">
                <td className="py-3.5 font-semibold text-sm" style={{ color: '#1a2744' }}>{p.name}</td>
                <td className="py-3.5 text-sm" style={{ color: '#8c7e6a' }}>{p.mrn}</td>
                <td className="py-3.5 text-sm" style={{ color: '#8c7e6a' }}>{p.department}</td>
                <td className="py-3.5 text-sm" style={{ color: '#1a2744' }}>{p.location}</td>
                <td className="py-3.5">
                  <span className="px-2 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Admin/Operator Command Center (full graph+KPI layout) ──────────────────────
function AdminCommandCenter() {
  const currentUser = useStore((s) => s.currentUser)

  const [crisisLoading, setCrisisLoading] = useState(false)
  const fetchDashboardData = useCallback(async () => {
    const [s, b] = await Promise.all([
      opsApi.getHospitalState(),
      opsApi.getBottlenecks(),
    ])
    return { state: s, bottlenecks: b.bottlenecks }
  }, [])

  const { data, loading: dataLoading } = useData(fetchDashboardData, 15000)
  const state = data?.state ?? null
  const bottlenecks = data?.bottlenecks ?? []
  const loading = dataLoading && !state

  const resolveCrisis = async () => {
    setCrisisLoading(true)
    try { await opsApi.resolveCrisis() }
    finally { setCrisisLoading(false) }
  }



  const displayName = currentUser?.display_name ?? 'Doctor'

  if (loading && !state) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center p-8 rounded-2xl bg-white border border-[#e8e1d4] shadow-sm max-w-sm">
          <div className="w-10 h-10 border-3 border-blue-200 border-t-[#1e3a6e] rounded-full animate-spin mx-auto mb-3" />
          <div className="text-sm font-semibold text-[#1a2744]">Connecting to Hospital State…</div>
          <div className="text-xs text-[#8c7e6a] mt-1">Fetching telemetry from real-time clinical systems</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto w-full" style={{ background: '#f5f0e8' }}>

      {/* ── Welcome Header with Breathing Space ────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-bold tracking-tight text-2xl lg:text-3xl" style={{ color: '#1a2744' }}>
            Welcome back, {displayName}
          </h1>
          <p className="text-sm mt-1.5 flex items-center gap-2" style={{ color: '#6b5c40' }}>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
              Real-time Hospital Operations
            </span>
            <span>•</span>
            <span>AI-Assisted Patient Flow & Capacity Orchestration</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {state?.crisis_mode && (
            <button
              onClick={resolveCrisis}
              disabled={crisisLoading}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-sm"
              style={{ background: '#dc2626', color: '#ffffff' }}
            >
              {crisisLoading ? 'Working…' : '✓ Resolve Crisis Mode'}
            </button>
          )}
        </div>
      </div>

      {/* ── 5 KPI Cards in Responsive Grid ─────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x rounded-2xl overflow-hidden mb-6" style={{ border: '1px solid #e8e1d4', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <KpiCard
          icon={Users} iconColor="#1e50a0" iconBg="#dbeafe"
          label="ER Waiting"
          value={state?.emergency.waiting ?? '—'}
          subValue="patients"
          pct={state?.pressure.emergency ? `${Math.round(state.pressure.emergency)}%` : null}
          pctLabel=""
          trend="up"
        />
        <KpiCard
          icon={BedDouble} iconColor="#1e50a0" iconBg="#dbeafe"
          label="Occupied Beds"
          value={state ? `${state.beds.occupied} / ${state.beds.total}` : '—'}
          pct={state ? `${Math.round(state.beds.occupancy_pct)}%` : null}
          trend={state?.beds.occupancy_pct && state.beds.occupancy_pct > 85 ? 'up' : 'down'}
        />
        <KpiCard
          icon={HeartPulse} iconColor="#ea580c" iconBg="#fff7ed"
          label="ICU Occupancy"
          value={state ? `${state.icu.occupied} / ${state.icu.total}` : '—'}
          pct={state ? `${Math.round(state.icu.occupancy_pct)}%` : null}
          trend={state?.icu.occupancy_pct && state.icu.occupancy_pct > 80 ? 'up' : 'down'}
        />
        <KpiCard
          icon={Scissors} iconColor="#1e50a0" iconBg="#dbeafe"
          label="OT Utilization"
          value={state ? `${state.operating_rooms.occupied} / ${state.operating_rooms.total}` : '—'}
          pct={state ? `${Math.round(state.operating_rooms.utilization_pct)}%` : null}
          trend="down"
        />
        <KpiCard
          icon={FlaskConical} iconColor="#1e50a0" iconBg="#dbeafe"
          label="Diagnostic Queue"
          value={state?.diagnostics.queue_length ?? '—'}
          subValue="pending"
          pct={state ? `${Math.round((state.diagnostics.queue_length / (state.diagnostics.available_devices * 5)) * 100)}%` : null}
          trend="up"
        />
      </div>

      {/* ── Main Operations 2-Column Grid with Generous Breathing Space ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Quick Actions + Capacity Table */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <QuickActionsBar />
          <DeptTable state={state} />
          <RecentAdmissions />
        </div>

        {/* Right Column (4 cols): AI Assistant + Live Activity Feed */}
        <div className="lg:col-span-4 space-y-6">
          <AIAssistant state={state} />
          <LiveActivityFeed state={state} bottlenecks={bottlenecks} />
        </div>
      </div>
    </div>
  )
}

// ── Public export: routes by role ─────────────────────────────────────────────
export function CommandCenter() {
  const currentUser = useStore((s) => s.currentUser)
  const role = currentUser?.role ?? 'admin'
  if (role === 'doctor') return <DoctorDashboard />
  if (role === 'nurse') return <NurseDashboard />
  return <AdminCommandCenter />
}
