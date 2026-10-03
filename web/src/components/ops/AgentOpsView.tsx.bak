/**
 * Agent Operations View — per-agent performance metrics
 */
import { useEffect, useState } from 'react'
import { opsApi, type AgentPerf } from '../../services/opsApi'

function AgentCard({ agent }: { agent: AgentPerf }) {
  const acceptPct = agent.acceptance_rate_pct
  const barColor = acceptPct >= 80 ? 'bg-emerald-500' : acceptPct >= 65 ? 'bg-amber-500' : 'bg-red-500'
  const conf = (agent.avg_confidence * 100).toFixed(0)

  return (
    <div className="border border-warm-200 bg-white rounded-sm p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${agent.status === 'active' ? 'bg-emerald-500' : 'bg-warm-300'}`} />
          <span className="text-xs font-semibold text-navy-800">{agent.label}</span>
          <span className="text-[9px] font-mono text-gray-400 uppercase">{agent.id}</span>
        </div>
        <span className={`text-[10px] font-bold font-mono ${
          acceptPct >= 80 ? 'text-emerald-600' : acceptPct >= 65 ? 'text-amber-600' : 'text-red-600'
        }`}>{acceptPct.toFixed(1)}% acc.</span>
      </div>

      <div className="flex flex-col gap-1.5">
        {/* Acceptance bar */}
        <div className="h-1 bg-warm-100 rounded-sm overflow-hidden">
          <div className={`h-full ${barColor}`} style={{ width: `${acceptPct}%` }} />
        </div>

        {/* Decision breakdown */}
        <div className="flex gap-1 h-1.5 rounded-sm overflow-hidden">
          <div className="bg-emerald-600" style={{ width: `${(agent.accepted / Math.max(agent.recommendations_today, 1)) * 100}%` }} />
          <div className="bg-blue-600" style={{ width: `${(agent.modified / Math.max(agent.recommendations_today, 1)) * 100}%` }} />
          <div className="bg-red-700" style={{ width: `${(agent.rejected / Math.max(agent.recommendations_today, 1)) * 100}%` }} />
        </div>

        <div className="grid grid-cols-3 gap-0 text-center border border-warm-200/40 rounded-sm overflow-hidden">
          <div className="py-1 border-r border-warm-200/40">
            <div className="text-[9px] text-gray-400 uppercase">Approved</div>
            <div className="font-mono text-xs font-bold text-emerald-600">{agent.accepted}</div>
          </div>
          <div className="py-1 border-r border-warm-200/40">
            <div className="text-[9px] text-gray-400 uppercase">Modified</div>
            <div className="font-mono text-xs font-bold text-blue-600">{agent.modified}</div>
          </div>
          <div className="py-1">
            <div className="text-[9px] text-gray-400 uppercase">Rejected</div>
            <div className="font-mono text-xs font-bold text-red-600">{agent.rejected}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-0 text-center mt-0.5">
          <div>
            <div className="text-[9px] text-gray-400">Runs</div>
            <div className="font-mono text-[11px] text-gray-500">{agent.runs_today}</div>
          </div>
          <div>
            <div className="text-[9px] text-gray-400">Latency</div>
            <div className="font-mono text-[11px] text-gray-500">{agent.avg_latency_ms}ms</div>
          </div>
          <div>
            <div className="text-[9px] text-gray-400">Confidence</div>
            <div className="font-mono text-[11px] text-gray-500">{conf}%</div>
          </div>
        </div>
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
    <div className="p-4 flex flex-col gap-4" style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-navy-800">Agent Operations</h2>
          <p className="text-xs text-gray-400 mt-0.5">Per-agent recommendation performance — today's session</p>
        </div>
        <div className="border border-warm-200 rounded-sm px-3 py-2 text-right">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider">Overall Acceptance</div>
          <div className="font-mono text-xl font-bold text-emerald-600">{overallAcc}%</div>
          <div className="text-[10px] text-gray-400">{totalRecs} recommendations total</div>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm text-center py-8">Loading agent data…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {agents.map(a => <AgentCard key={a.id} agent={a} />)}
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 text-[10px] text-gray-400">
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-emerald-600 rounded-sm" /><span>Approved</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-blue-600 rounded-sm" /><span>Modified</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-red-700 rounded-sm" /><span>Rejected</span></div>
      </div>
    </div>
  )
}
