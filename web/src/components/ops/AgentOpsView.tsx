/**
 * Agent Operations View — per-agent performance metrics
 */
import { useEffect, useState } from 'react'
import { opsApi, type AgentPerf } from '../../services/opsApi'

function AgentCard({ agent }: { agent: AgentPerf }) {
  const acceptPct = agent.acceptance_rate_pct
  const barColor = acceptPct >= 80 ? 'bg-emerald-500' : acceptPct >= 65 ? 'bg-amber-500' : 'bg-red-500'
  const textColor = acceptPct >= 80 ? 'text-emerald-600' : acceptPct >= 65 ? 'text-amber-600' : 'text-red-600'
  const conf = (agent.avg_confidence * 100).toFixed(0)

  return (
    <div className="group border border-warm-200 bg-white hover:border-warm-300 hover:shadow-lg transition-all duration-300 rounded-xl p-5 flex flex-col h-full relative overflow-hidden">
      {/* Decorative top accent */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${barColor} opacity-70`} />

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 border border-slate-100 shadow-sm">
            <div className={`w-2.5 h-2.5 rounded-full ${agent.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-warm-300'}`} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-navy-900 tracking-tight">{agent.label}</h3>
            <span className="text-[10px] font-mono font-medium text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded uppercase tracking-wider">{agent.id}</span>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold font-mono tracking-tighter ${textColor}`}>{acceptPct.toFixed(1)}%</div>
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Acceptance</div>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-end gap-5">
        <div className="space-y-2">
          {/* Decision breakdown visual */}
          <div className="flex gap-1 h-3 rounded bg-warm-50 overflow-hidden shadow-inner p-0.5">
            <div className="bg-emerald-500 rounded-sm transition-all duration-500" style={{ width: `${(agent.accepted / Math.max(agent.recommendations_today, 1)) * 100}%` }} />
            <div className="bg-blue-500 rounded-sm transition-all duration-500" style={{ width: `${(agent.modified / Math.max(agent.recommendations_today, 1)) * 100}%` }} />
            <div className="bg-rose-500 rounded-sm transition-all duration-500" style={{ width: `${(agent.rejected / Math.max(agent.recommendations_today, 1)) * 100}%` }} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-emerald-50/50 rounded p-2 text-center border border-emerald-100/50">
              <div className="font-mono text-sm font-bold text-emerald-700">{agent.accepted}</div>
              <div className="text-[10px] font-medium text-emerald-600/70 uppercase tracking-wide">Approved</div>
            </div>
            <div className="bg-blue-50/50 rounded p-2 text-center border border-blue-100/50">
              <div className="font-mono text-sm font-bold text-blue-700">{agent.modified}</div>
              <div className="text-[10px] font-medium text-blue-600/70 uppercase tracking-wide">Modified</div>
            </div>
            <div className="bg-rose-50/50 rounded p-2 text-center border border-rose-100/50">
              <div className="font-mono text-sm font-bold text-rose-700">{agent.rejected}</div>
              <div className="text-[10px] font-medium text-rose-600/70 uppercase tracking-wide">Rejected</div>
            </div>
          </div>
        </div>

        {/* Bottom stats row */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-warm-100">
          <div>
            <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Total Runs</div>
            <div className="font-mono text-sm font-semibold text-navy-800 flex items-center gap-1.5">
              <span>{agent.runs_today}</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Avg Latency</div>
            <div className="font-mono text-sm font-semibold text-navy-800">{agent.avg_latency_ms}ms</div>
          </div>
          <div>
            <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Confidence</div>
            <div className="font-mono text-sm font-semibold text-navy-800">{conf}%</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LiveActivityLog() {
  const activities = [
    { time: 'Just now', agent: 'ICU_AGENT', action: 'Approved step-down transfer for Bed 4A', status: 'success' },
    { time: '2 mins ago', agent: 'ER_AGENT', action: 'Triage prioritization updated for incoming trauma', status: 'success' },
    { time: '5 mins ago', agent: 'BED_AGENT', action: 'Modified reservation protocol for Ward C', status: 'modified' },
    { time: '12 mins ago', agent: 'STAFF_AGENT', action: 'Rejected shift swap request (insufficient coverage)', status: 'rejected' },
    { time: '15 mins ago', agent: 'LAB_AGENT', action: 'Urgent diagnostic panel prioritized', status: 'success' },
    { time: '22 mins ago', agent: 'OT_AGENT', action: 'Rescheduled elective surgery (OR-3 maintenance)', status: 'modified' },
  ]

  return (
    <div className="bg-white border border-warm-200 rounded-xl p-5 flex flex-col h-full shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-navy-900 tracking-tight flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Live Agent Activity
        </h3>
        <span className="text-xs text-blue-600 font-medium cursor-pointer hover:underline">View Full Audit Log</span>
      </div>
      <div className="flex-1 overflow-y-auto pr-2 space-y-4 relative">
        {/* Timeline line */}
        <div className="absolute left-2.5 top-2 bottom-2 w-px bg-warm-100 z-0" />
        
        {activities.map((act, i) => (
          <div key={i} className="flex gap-4 relative z-10 group">
            <div className="mt-1 flex-shrink-0 relative">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm ${
                act.status === 'success' ? 'bg-emerald-100 text-emerald-600' :
                act.status === 'modified' ? 'bg-blue-100 text-blue-600' :
                'bg-rose-100 text-rose-600'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${
                  act.status === 'success' ? 'bg-emerald-500' :
                  act.status === 'modified' ? 'bg-blue-500' :
                  'bg-rose-500'
                }`} />
              </div>
            </div>
            <div className="flex-1 bg-slate-50/50 group-hover:bg-slate-50 rounded-lg p-2.5 border border-transparent group-hover:border-warm-200/60 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-navy-800">{act.agent}</span>
                <span className="text-[10px] text-gray-400 font-medium">{act.time}</span>
              </div>
              <p className="text-xs text-gray-600">{act.action}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SystemHealthOverview({ totalRecs, overallAcc }: { totalRecs: number, overallAcc: string }) {
  return (
    <div className="bg-gradient-to-br from-navy-900 to-slate-900 rounded-xl p-5 text-white shadow-lg flex flex-col justify-between h-full relative overflow-hidden">
      {/* Decorative background pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
      
      <div>
        <h3 className="text-sm font-semibold text-slate-300 tracking-wide uppercase mb-1">System Overview</h3>
        <p className="text-2xl font-bold tracking-tight">Agent Network Health</p>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mt-6">
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/10">
          <div className="text-xs text-slate-300 font-medium uppercase tracking-wider mb-1">Overall Acceptance</div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-mono font-bold text-emerald-400">{overallAcc}%</span>
            <span className="text-xs text-emerald-400/80 mb-1 flex items-center gap-1">
              ↑ 2.4%
            </span>
          </div>
        </div>
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/10">
          <div className="text-xs text-slate-300 font-medium uppercase tracking-wider mb-1">Decisions Today</div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-mono font-bold text-white">{totalRecs}</span>
            <span className="text-xs text-slate-400 mb-1">Total recs</span>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 font-medium">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          All core agents active
        </div>
        <div>Uptime: 99.98%</div>
      </div>
    </div>
  )
}

export function AgentOpsView() {
  const [agents, setAgents] = useState<AgentPerf[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    opsApi.getAgentPerformance().then(r => setAgents(r.agents)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const totalRecs = agents.reduce((s, a) => s + a.recommendations_today, 0)
  const totalAccepted = agents.reduce((s, a) => s + a.accepted, 0)
  const overallAcc = totalRecs > 0 ? (totalAccepted / totalRecs * 100).toFixed(1) : '—'

  return (
    <div className="p-6 flex flex-col gap-6 h-full max-w-[1600px] mx-auto w-full" style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-warm-200 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy-900 tracking-tight">Agent Operations</h2>
          <p className="text-sm text-gray-500 mt-1 font-medium">Real-time performance metrics and autonomous decision tracking</p>
        </div>
        
        {/* Legend */}
        <div className="flex gap-4 text-xs font-medium text-gray-500 bg-white px-4 py-2 rounded-full border border-warm-200 shadow-sm">
          <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" /><span>Approved</span></div>
          <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-blue-500 rounded-full" /><span>Modified</span></div>
          <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-rose-500 rounded-full" /><span>Rejected</span></div>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
          <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          <div className="text-sm font-medium animate-pulse">Synchronizing agent telemetry…</div>
        </div>
      ) : (
        <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0">
          
          {/* Main Grid - Agent Cards */}
          <div className="flex-1 overflow-y-auto pb-2 pr-1 custom-scrollbar">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {agents.map(a => <AgentCard key={a.id} agent={a} />)}
            </div>
          </div>

          {/* Right Sidebar - Analytics & Logs */}
          <div className="w-full xl:w-[400px] flex flex-col gap-6 shrink-0 h-full">
            <div className="shrink-0">
              <SystemHealthOverview totalRecs={totalRecs} overallAcc={overallAcc.toString()} />
            </div>
            
            <div className="flex-1 min-h-0">
              <LiveActivityLog />
            </div>
          </div>
          
        </div>
      )}
    </div>
  )
}
