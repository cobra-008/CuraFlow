import { useEffect, useState, useCallback, useRef } from 'react'
import {
  ArrowLeft, RefreshCw, BedDouble, Users, Stethoscope,
  Scissors, Activity, AlertTriangle, TrendingUp, Building2,
  Loader2, Send, Zap, CheckCircle2, ShieldAlert, BarChart3, BrainCircuit, Sparkles, AlertCircle
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

// ── Glass Stat Card ──────────────────────────────────────────────────────────

function GlassStatCard({
  icon, label, value, sub, color, detail
}: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: React.ReactNode; color: string; detail?: string
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-[var(--border-a)] bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg-base)] p-5 shadow-lg group hover:shadow-${color}-500/10 transition-all duration-300`}>
      {/* Background glow */}
      <div className={`absolute -top-10 -right-10 w-32 h-32 bg-${color}-500/10 rounded-full blur-3xl group-hover:bg-${color}-500/20 transition-all duration-500`} />
      
      <div className="relative z-10 flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl bg-${color}-500/20 flex items-center justify-center text-${color}-400 border border-${color}-500/20 shadow-[0_0_15px_rgba(0,0,0,0)] group-hover:shadow-${color}-500/20 transition-all`}>
          {icon}
        </div>
        {detail && (
          <span className="text-[10px] font-medium text-slate-400 bg-[var(--bg-raised)] px-2.5 py-1 rounded-full border border-[var(--border)] tracking-wide">
            {detail}
          </span>
        )}
      </div>
      <div className="relative z-10">
        <div className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-400 tracking-tight">{value}</div>
        <div className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider">{label}</div>
        {sub && <div className="text-[11px] text-slate-500 mt-2 font-medium">{sub}</div>}
      </div>
    </div>
  )
}

// ── Progress Bar ──────────────────────────────────────────────────────────────

function ProgressBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-medium text-slate-400 group-hover:text-slate-300 transition-colors">{label}</span>
        <span className="text-[11px] font-bold text-slate-200">{value} <span className="text-slate-500 font-normal">/ {max}</span></span>
      </div>
      <div className="h-2 bg-[var(--bg-base)] rounded-full overflow-hidden border border-[var(--border)]">
        <div
          className={`h-full bg-gradient-to-r from-${color}-600 to-${color}-400 rounded-full transition-all duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export function HospitalPage() {
  const setActiveView = useStore(s => s.setActiveView)
  const currentUser = useStore(s => s.currentUser)
  const setPrompt = useStore(s => s.setPrompt)
  const generatePipeline = useStore(s => s.generatePipeline)
  
  const [stats, setStats] = useState<HospitalStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [commandInput, setCommandInput] = useState('')

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

  const role = currentUser?.role || 'admin'
  const showBeds = ['super_admin', 'admin', 'er_coordinator', 'nurse'].includes(role)
  const showStaff = ['super_admin', 'admin', 'nurse'].includes(role)
  const showOT = ['super_admin', 'admin', 'ot_manager'].includes(role)
  const showPatients = ['super_admin', 'admin', 'er_coordinator', 'doctor'].includes(role)
  const showDoctors = ['super_admin', 'admin', 'doctor'].includes(role)
  const showClaims = ['super_admin', 'admin'].includes(role)

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault()
    if (!commandInput.trim()) return
    setPrompt(commandInput)
    setActiveView('orchestrator')
    generatePipeline()
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg-base)] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[var(--bg-raised)] via-[var(--bg-base)] to-[var(--bg-base)] text-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Header & Command Center */}
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold tracking-widest uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                System Online
              </span>
              {lastUpdated && <span className="text-[10px] text-slate-500 font-medium">SYNCED {lastUpdated.toLocaleTimeString()}</span>}
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              Operations Command Center
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
              Real-time EHR/EMR orchestration. Monitor resources, forecast load, and allocate dynamic capabilities autonomously.
            </p>
          </div>

          <div className="flex-1 w-full xl:max-w-lg flex items-center gap-3">
            <form onSubmit={handleCommand} className="relative flex-1 group">
              <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity duration-500"></div>
              <div className="relative flex items-center bg-[var(--bg-surface)] border border-[var(--border-a)] rounded-full px-4 py-2.5 shadow-lg focus-within:border-blue-500/50 focus-within:bg-[#0d1b32] transition-all">
                <Sparkles size={16} className="text-blue-400 mr-3 animate-pulse" />
                <input
                  type="text"
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  placeholder="Ask AI to reallocate resources or predict load..."
                  className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-slate-100 placeholder:text-slate-500"
                />
                <button type="submit" disabled={!commandInput.trim()} className="ml-2 w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white disabled:opacity-50 transition-colors">
                  <Send size={14} className="-ml-0.5" />
                </button>
              </div>
            </form>
            <button onClick={fetchStats} className="w-12 h-12 rounded-full border border-[var(--border-a)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors shadow-lg">
              <RefreshCw size={18} className={loading ? 'animate-spin text-blue-400' : ''} />
            </button>
          </div>
        </div>

        {loading && !stats && (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
              <Loader2 size={40} className="animate-spin text-blue-500 relative z-10" />
            </div>
            <p className="text-slate-400 text-sm font-medium animate-pulse">Syncing hospital telemetry...</p>
          </div>
        )}

        {!loading && !stats && (
          <div className="flex flex-col items-center justify-center py-32 gap-4 border border-[var(--border-a)] rounded-3xl bg-[var(--bg-surface)]">
            <AlertTriangle size={48} className="text-amber-500 opacity-80" />
            <h3 className="text-lg font-bold text-slate-200">Telemetry Disconnected</h3>
            <p className="text-slate-400 text-sm">Could not load hospital stats. Ensure the backend orchestration layer is active.</p>
            <button onClick={fetchStats} className="mt-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-full text-sm font-semibold transition-colors">Retry Connection</button>
          </div>
        )}

        {stats && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
            
            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {showBeds && <GlassStatCard
                icon={<BedDouble size={20} />}
                label="Bed Availability"
                value={`${beds?.available ?? 0} / ${beds?.total ?? 0}`}
                sub={<span className="flex gap-2"><span className="text-rose-400">{beds?.occupied ?? 0} Occupied</span><span className="text-amber-400">{beds?.cleaning ?? 0} Turnaround</span></span>}
                color="blue"
                detail={beds ? `${Math.round(((beds.occupied) / beds.total) * 100)}% Cap` : undefined}
              />}
              {showStaff && <GlassStatCard
                icon={<Users size={20} />}
                label="Staff Allocation"
                value={staff?.online ?? 0}
                sub={<span className="flex gap-2"><span className="text-emerald-400">Active Shift</span><span className="text-amber-400">{staff?.standby ?? 0} Standby</span></span>}
                color="emerald"
                detail={`${staff?.total ?? 0} Total`}
              />}
              {showOT && <GlassStatCard
                icon={<Scissors size={20} />}
                label="OT Roster"
                value={`${ot?.in_progress ?? 0} / ${(ot?.total ?? 0)}`}
                sub={<span className="flex gap-2"><span className="text-violet-400">In Surgery</span><span>{ot?.scheduled ?? 0} Scheduled</span></span>}
                color="violet"
                detail="Live"
              />}
              {showPatients && <GlassStatCard
                icon={<Activity size={20} />}
                label="Patient Load"
                value={patients?.admitted ?? 0}
                sub={<span className="flex flex-col gap-0.5"><span className="text-rose-400">{patients?.waiting ?? 0} Emergency Wait</span><span className="text-emerald-400">{patients?.discharge_ready ?? 0} Ready for D/C</span></span>}
                color="rose"
                detail={`${stats.visits?.total_today ?? 0} Visits`}
              />}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: Beds & Departments */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Advanced Bed Tracking */}
                {showBeds && (
                  <div className="rounded-3xl border border-[var(--border-a)] bg-[var(--bg-surface)] overflow-hidden shadow-xl">
                    <div className="px-6 py-5 border-b border-[var(--border)] flex items-center justify-between bg-gradient-to-r from-[var(--bg-surface)] to-[var(--bg-base)]">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10"><BedDouble size={18} className="text-blue-400" /></div>
                        <h2 className="text-base font-bold text-slate-100">Automated Bed Tracking</h2>
                      </div>
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                        <CheckCircle2 size={14} /> Tracking Active
                      </span>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-5">
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Global Capacity</h4>
                          <ProgressBar label="Occupied Beds" value={beds?.occupied ?? 0} max={beds?.total ?? 1} color="rose" />
                          <ProgressBar label="Available Beds" value={beds?.available ?? 0} max={beds?.total ?? 1} color="emerald" />
                          <ProgressBar label="Cleaning / Maintenance" value={beds?.cleaning ?? 0} max={beds?.total ?? 1} color="amber" />
                        </div>
                        <div className="space-y-4">
                           <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Department Heatmap</h4>
                           <div className="grid grid-cols-2 gap-3">
                             {(stats.departments ?? []).map(dept => {
                               const ratio = dept.capacity > 0 ? dept.occupied / dept.capacity : 0
                               const isHigh = ratio > 0.85
                               const isMed = ratio > 0.6
                               return (
                                 <div key={dept.name} className={`p-3 rounded-xl border transition-colors ${isHigh ? 'bg-rose-500/10 border-rose-500/30' : isMed ? 'bg-amber-500/10 border-amber-500/30' : 'bg-[var(--bg-raised)] border-[var(--border)]'}`}>
                                    <div className="text-xs font-semibold text-slate-300 truncate mb-1">{dept.name}</div>
                                    <div className="flex items-end justify-between">
                                      <div className={`text-lg font-bold ${isHigh ? 'text-rose-400' : isMed ? 'text-amber-400' : 'text-emerald-400'}`}>{dept.occupied}</div>
                                      <div className="text-[10px] text-slate-500 mb-0.5">/ {dept.capacity}</div>
                                    </div>
                                 </div>
                               )
                             })}
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Staff & Doctor Roster */}
                {(showStaff || showDoctors) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {showDoctors && (
                      <div className="rounded-3xl border border-[var(--border-a)] bg-[var(--bg-surface)] p-6 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5"><Stethoscope size={100} /></div>
                        <div className="flex items-center gap-3 mb-6 relative z-10">
                          <div className="p-2 rounded-lg bg-violet-500/10"><Stethoscope size={18} className="text-violet-400" /></div>
                          <h2 className="text-base font-bold text-slate-100">Doctor Slots</h2>
                        </div>
                        <div className="space-y-4 relative z-10">
                          {Object.entries(stats.doctors?.specializations ?? {}).slice(0, 5).map(([spec, cnt]) => (
                            <ProgressBar key={spec} label={spec} value={cnt} max={stats.doctors.total_slots} color="violet" />
                          ))}
                          {Object.keys(stats.doctors?.specializations ?? {}).length === 0 && (
                            <div className="text-sm text-slate-500 italic">Roster pending alignment...</div>
                          )}
                        </div>
                      </div>
                    )}

                    {showStaff && (
                      <div className="rounded-3xl border border-[var(--border-a)] bg-[var(--bg-surface)] p-6 shadow-xl">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="p-2 rounded-lg bg-emerald-500/10"><Users size={18} className="text-emerald-400" /></div>
                          <h2 className="text-base font-bold text-slate-100">Dynamic Staffing</h2>
                        </div>
                        <div className="space-y-3">
                          {Object.entries(staff?.by_role ?? {}).map(([r, cnt]) => (
                            <div key={r} className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] hover:border-emerald-500/30 transition-colors">
                              <span className="text-sm font-medium text-slate-300 capitalize">{r.replace('_', ' ')}</span>
                              <span className="text-sm font-bold text-emerald-400">{cnt} <span className="text-xs text-slate-500 font-normal ml-1">Active</span></span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column: Predictive AI & Escalations */}
              <div className="space-y-6">
                
                {/* RL Prediction Engine */}
                <div className="rounded-3xl border border-blue-500/30 bg-gradient-to-b from-[#0a152e] to-[var(--bg-surface)] p-6 shadow-[0_0_30px_rgba(59,130,246,0.1)] relative overflow-hidden">
                  {/* Neural bg */}
                  <div className="absolute top-0 right-0 p-6 opacity-[0.03]"><BrainCircuit size={120} /></div>
                  
                  <div className="flex items-center justify-between mb-6 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.4)]">
                        <BrainCircuit size={18} className="text-blue-400" />
                      </div>
                      <h2 className="text-base font-bold text-slate-100">AI Forecasting</h2>
                    </div>
                    <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-ping"></span>
                  </div>
                  
                  <div className="relative z-10">
                    <div className="mb-4">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">ER Surge Probability</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400">78%</span>
                        <span className="text-xs font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">High Risk</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="text-sm text-slate-300 border-l-2 border-blue-500 pl-3">
                        Model predicts a capacity crunch in the ICU within 4 hours based on current admission velocity.
                      </div>
                      <button 
                        onClick={() => {
                          setPrompt("Trigger emergency escalation workflow for ICU surge.")
                          setActiveView('orchestrator')
                          generatePipeline()
                        }}
                        className="w-full py-2.5 mt-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 rounded-xl text-xs font-bold text-blue-300 transition-all flex items-center justify-center gap-2"
                      >
                        <Zap size={14} /> Auto-Resolve Surge
                      </button>
                    </div>
                  </div>
                </div>

                {/* Escalation Feed */}
                <div className="rounded-3xl border border-[var(--border-a)] bg-[var(--bg-surface)] p-6 shadow-xl flex-1">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg bg-amber-500/10"><ShieldAlert size={18} className="text-amber-400" /></div>
                    <h2 className="text-base font-bold text-slate-100">Active Workflows</h2>
                  </div>
                  <div className="space-y-4">
                    
                    {/* Simulated live feed */}
                    <div className="flex gap-3 items-start group cursor-default">
                      <div className="mt-1 w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                      <div>
                        <div className="text-sm font-semibold text-slate-200 group-hover:text-rose-300 transition-colors">Trauma Case Incoming</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">ETA 4 mins. ER team alerted.</div>
                      </div>
                    </div>
                    
                    <div className="flex gap-3 items-start group cursor-default">
                      <div className="mt-1 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                      <div>
                        <div className="text-sm font-semibold text-slate-200 group-hover:text-emerald-300 transition-colors">Bed Auction Resolved</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">Ward B won allocation for Patient #1094.</div>
                      </div>
                    </div>

                    <div className="flex gap-3 items-start group cursor-default">
                      <div className="mt-1 w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                      <div>
                        <div className="text-sm font-semibold text-slate-200 group-hover:text-blue-300 transition-colors">Staff Reallocation</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">2 Nurses shifted from OPD to ER.</div>
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
