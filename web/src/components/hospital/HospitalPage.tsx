import { useEffect, useState, useCallback } from 'react'
import {
  ArrowLeft, RefreshCw, BedDouble, Users, Stethoscope,
  Scissors, Activity, AlertTriangle, TrendingUp, Building2,
  Loader2, MessageSquarePlus, Send, X
} from 'lucide-react'
import { useStore } from '../../store'
import { fetchHospitalStats } from '../../services/api'

// ── Types ──────────────────────────────────────────────────────────────────────

interface HospitalStats {
  beds: { total: number; available: number; occupied: number; cleaning: number }
  staff: { total: number; online: number; standby: number; offline: number; by_role: Record<string, number> }
  doctors: { total_slots: number; available: number; booked: number; specializations: Record<string, number> }
  ot: { total: number; in_progress: number; scheduled: number; completed: number }
  patients: { admitted: number; waiting: number; discharge_ready: number }
  visits: { total_today: number; emergency: number; opd: number }
  claims: { pending: number; approved: number; under_review: number; rejected: number }
  departments: { name: string; capacity: number; occupied: number }[]
}

interface AiMessage { role: 'user' | 'assistant'; content: string }

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, sub, color, detail
}: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; color: string; detail?: string
}) {
  return (
    <div className={`rounded-2xl border bg-[var(--bg-surface)] border-[var(--border)] p-4 flex flex-col gap-3 hover:border-${color}-500/40 transition-colors`}>
      <div className="flex items-center justify-between">
        <div className={`w-9 h-9 rounded-xl bg-${color}-500/10 flex items-center justify-center text-${color}-400`}>
          {icon}
        </div>
        {detail && (
          <span className="text-[10px] text-slate-500 bg-[var(--bg-raised)] px-2 py-0.5 rounded-full border border-[var(--border)]">
            {detail}
          </span>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-100 leading-tight">{value}</div>
        <div className="text-xs text-slate-400 mt-0.5">{label}</div>
        {sub && <div className="text-[10px] text-slate-500 mt-1">{sub}</div>}
      </div>
    </div>
  )
}

// ── Mini Bar ──────────────────────────────────────────────────────────────────

function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-xs font-semibold text-slate-200">{value}<span className="text-slate-500">/{max}</span></span>
      </div>
      <div className="h-1.5 bg-[var(--bg-raised)] rounded-full overflow-hidden">
        <div
          className={`h-full bg-${color}-500 rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── AI Data Entry Chatbox ─────────────────────────────────────────────────────

function AiDataEntry({ onClose }: { onClose: () => void }) {
  const setPrompt = useStore(s => s.setPrompt)
  const setActiveView = useStore(s => s.setActiveView)
  const generatePipeline = useStore(s => s.generatePipeline)

  const [messages, setMessages] = useState<AiMessage[]>([
    {
      role: 'assistant',
      content: `Hi! I can help you add or update hospital data. Just describe what you want to update in plain language.\n\nExamples:\n• "Add 5 new beds in the ICU ward, all available"\n• "Update the Cardiology department capacity to 60"\n• "Mark 3 beds in ward B as under maintenance"\n\nGo ahead and type your request!`
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function send() {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)
    
    // Add a slight delay for realistic UX, then route to Orchestrator
    setTimeout(() => {
      setPrompt(`Update hospital data: ${userMsg}`)
      setActiveView('orchestrator')
      generatePipeline()
      onClose()
    }, 800)
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-a)] rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col" style={{ maxHeight: '70vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <MessageSquarePlus size={15} className="text-emerald-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-100">AI Data Entry</div>
              <div className="text-[10px] text-slate-500">Describe changes in plain language</div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-[var(--bg-raised)] text-slate-300 border border-[var(--border)] rounded-bl-md'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-[var(--bg-raised)] border border-[var(--border)] rounded-2xl rounded-bl-md px-4 py-3">
                <Loader2 size={14} className="animate-spin text-slate-400" />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[var(--border)] flex-shrink-0">
          <div className="flex items-center gap-2 bg-[var(--bg-raised)] border border-[var(--border-a)] rounded-xl px-4 py-2.5 focus-within:border-blue-500/50 transition-colors">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Describe what you want to add or update…"
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none"
              autoFocus
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
            >
              <Send size={14} className="text-white" />
            </button>
          </div>
          <p className="text-[10px] text-slate-600 mt-2 text-center">
            AI will preview changes before saving to the database
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function HospitalPage() {
  const setActiveView = useStore(s => s.setActiveView)
  const [stats, setStats] = useState<HospitalStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiOpen, setAiOpen] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchHospitalStats()
      setStats(data)
      setLastUpdated(new Date())
    } catch {
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  const beds = stats?.beds
  const staff = stats?.staff
  const ot = stats?.ot
  const patients = stats?.patients

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg-base)]">
      {aiOpen && <AiDataEntry onClose={() => setAiOpen(false)} />}

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveView('orchestrator')}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors group"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
              Dashboard
            </button>
            <div className="w-px h-4 bg-[var(--border)]" />
            <div>
              <h1 className="text-lg font-bold text-slate-100">Hospital Overview</h1>
              <p className="text-xs text-slate-500">
                Live operational status
                {lastUpdated && ` · Updated ${lastUpdated.toLocaleTimeString()}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAiOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
            >
              <MessageSquarePlus size={13} />
              Add / Edit Data
            </button>
            <button
              onClick={fetchStats}
              disabled={loading}
              className="w-8 h-8 rounded-xl border border-[var(--border-a)] bg-[var(--bg-raised)] hover:bg-[var(--bg-hover)] text-slate-400 flex items-center justify-center transition-colors"
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {loading && !stats && (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-blue-500" />
          </div>
        )}

        {!loading && !stats && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <AlertTriangle size={32} className="text-amber-400" />
            <p className="text-slate-400 text-sm">Could not load hospital stats. Is the backend running?</p>
            <button onClick={fetchStats} className="text-xs text-blue-400 hover:text-blue-300">Retry</button>
          </div>
        )}

        {stats && (
          <div className="space-y-6">
            {/* Primary KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={<BedDouble size={17} />}
                label="Beds Available"
                value={`${beds?.available ?? 0}/${beds?.total ?? 0}`}
                sub={`${beds?.occupied ?? 0} occupied · ${beds?.cleaning ?? 0} cleaning`}
                color="blue"
                detail={beds ? `${Math.round(((beds.occupied) / beds.total) * 100)}% capacity` : undefined}
              />
              <StatCard
                icon={<Users size={17} />}
                label="Staff Online"
                value={`${staff?.online ?? 0}`}
                sub={`${staff?.standby ?? 0} standby · ${staff?.offline ?? 0} offline`}
                color="emerald"
                detail={`${staff?.total ?? 0} total`}
              />
              <StatCard
                icon={<Scissors size={17} />}
                label="OT Status"
                value={`${ot?.in_progress ?? 0}/${(ot?.total ?? 0)}`}
                sub={`${ot?.scheduled ?? 0} scheduled · ${ot?.completed ?? 0} completed`}
                color="violet"
                detail="in surgery"
              />
              <StatCard
                icon={<Activity size={17} />}
                label="Patients Admitted"
                value={patients?.admitted ?? 0}
                sub={`${patients?.discharge_ready ?? 0} ready to discharge · ${patients?.waiting ?? 0} waiting`}
                color="rose"
                detail={`${stats.visits?.total_today ?? 0} visits today`}
              />
            </div>

            {/* Bed breakdown + Doctor slots side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Bed breakdown */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BedDouble size={15} className="text-blue-400" />
                  <span className="text-sm font-semibold text-slate-200">Bed Status Breakdown</span>
                </div>
                <div className="space-y-3">
                  <MiniBar label="Occupied" value={beds?.occupied ?? 0} max={beds?.total ?? 1} color="rose" />
                  <MiniBar label="Available" value={beds?.available ?? 0} max={beds?.total ?? 1} color="emerald" />
                  <MiniBar label="Cleaning / Turnover" value={beds?.cleaning ?? 0} max={beds?.total ?? 1} color="amber" />
                </div>
              </div>

              {/* Doctor slots by specialization */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Stethoscope size={15} className="text-violet-400" />
                  <span className="text-sm font-semibold text-slate-200">Doctor Slots (Today)</span>
                </div>
                <div className="space-y-3">
                  {Object.entries(stats.doctors?.specializations ?? {}).slice(0, 5).map(([spec, cnt]) => (
                    <MiniBar
                      key={spec}
                      label={spec}
                      value={cnt}
                      max={stats.doctors.total_slots}
                      color="violet"
                    />
                  ))}
                  {Object.keys(stats.doctors?.specializations ?? {}).length === 0 && (
                    <p className="text-xs text-slate-500">No slots loaded</p>
                  )}
                </div>
              </div>
            </div>

            {/* Department occupancy */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Building2 size={15} className="text-teal-400" />
                <span className="text-sm font-semibold text-slate-200">Department Occupancy</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(stats.departments ?? []).map(dept => (
                  <div key={dept.name} className="bg-[var(--bg-raised)] rounded-xl p-3 border border-[var(--border)]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-300">{dept.name}</span>
                      <span className="text-[10px] text-slate-500">{dept.occupied}/{dept.capacity}</span>
                    </div>
                    <div className="h-1.5 bg-[var(--bg-base)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          dept.capacity > 0 && dept.occupied / dept.capacity > 0.9
                            ? 'bg-rose-500' : dept.capacity > 0 && dept.occupied / dept.capacity > 0.7
                            ? 'bg-amber-500' : 'bg-teal-500'
                        }`}
                        style={{ width: `${dept.capacity > 0 ? Math.min(100, Math.round((dept.occupied / dept.capacity) * 100)) : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Staff by role + Claims */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Users size={15} className="text-emerald-400" />
                  <span className="text-sm font-semibold text-slate-200">Staff by Role (Active Shift)</span>
                </div>
                <div className="space-y-3">
                  {Object.entries(staff?.by_role ?? {}).map(([role, cnt]) => (
                    <div key={role} className="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0">
                      <span className="text-xs text-slate-400">{role}</span>
                      <span className="text-xs font-semibold text-slate-200">{cnt}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={15} className="text-amber-400" />
                  <span className="text-sm font-semibold text-slate-200">Claims Status</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Pending', value: stats.claims?.pending ?? 0, color: 'text-amber-400' },
                    { label: 'Approved', value: stats.claims?.approved ?? 0, color: 'text-emerald-400' },
                    { label: 'Under Review', value: stats.claims?.under_review ?? 0, color: 'text-blue-400' },
                    { label: 'Rejected', value: stats.claims?.rejected ?? 0, color: 'text-rose-400' },
                  ].map(item => (
                    <div key={item.label} className="bg-[var(--bg-raised)] rounded-xl p-3 border border-[var(--border)] text-center">
                      <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
                      <div className="text-[10px] text-slate-500 mt-1">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
