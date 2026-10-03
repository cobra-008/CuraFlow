/**
 * System Health View — component status, data quality, audit events
 */
import { useEffect, useState } from 'react'
import { opsApi, type SystemComponent, type DataSource } from '../../services/opsApi'

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    healthy: 'bg-emerald-50 text-emerald-600 border-emerald-700/40',
    degraded: 'bg-amber-900/30 text-amber-600 border-amber-200',
    disconnected: 'bg-warm-100 text-gray-400 border-warm-300',
    failed: 'bg-red-900/30 text-red-600 border-red-700/40',
  }
  return (
    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 border rounded-sm font-mono ${map[status] ?? map.disconnected}`}>
      {status}
    </span>
  )
}

function ComponentRow({ c }: { c: SystemComponent }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-warm-200/40 last:border-0">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
        c.status === 'healthy' ? 'bg-emerald-500' :
        c.status === 'degraded' ? 'bg-amber-400' :
        c.status === 'failed' ? 'bg-red-500' :
        'bg-warm-200'
      }`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-navy-700">{c.name}</span>
          <span className="text-[10px] text-gray-400 uppercase">{c.type}</span>
          <StatusPill status={c.status} />
        </div>
        {c.note && <div className="text-[10px] text-gray-400 mt-0.5">{c.note}</div>}
      </div>
      {c.latency_ms !== null && (
        <span className="font-mono text-[11px] text-gray-400">{c.latency_ms}ms</span>
      )}
    </div>
  )
}

function DataSourceRow({ s }: { s: DataSource }) {
  const freshColor = s.freshness_label === 'LIVE' ? 'text-emerald-600' :
    s.freshness_label === 'STALE' ? 'text-amber-600' : 'text-gray-400'

  return (
    <div className="flex items-center gap-3 py-2 border-b border-warm-200/40 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-navy-700">{s.name}</span>
          <StatusPill status={s.status} />
          <span className={`text-[9px] font-mono font-bold ${freshColor}`}>{s.freshness_label}</span>
        </div>
        {s.note && <div className="text-[10px] text-gray-400 mt-0.5">{s.note}</div>}
      </div>
      <div className="text-right flex-shrink-0">
        <div className="font-mono text-[11px] text-gray-500">{s.completeness_pct}%</div>
        <div className="text-[9px] text-gray-400">complete</div>
      </div>
    </div>
  )
}

export function SystemHealthView() {
  const [health, setHealth] = useState<{ overall_status: string; components: SystemComponent[] } | null>(null)
  const [quality, setQuality] = useState<{ sources: DataSource[]; overall_confidence: number } | null>(null)
  const [audit, setAudit] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      opsApi.getSystemHealth(),
      opsApi.getDataQuality(),
      opsApi.getAuditEvents(20),
    ]).then(([h, q, a]) => {
      setHealth(h)
      setQuality(q)
      setAudit(a.events ?? [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading system health…</div>
  }

  return (
    <div className="p-4 flex flex-col gap-4" style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-navy-800">System Health</h2>
          <p className="text-xs text-gray-400 mt-0.5">Infrastructure, data sources, and audit ledger</p>
        </div>
        {health && <StatusPill status={health.overall_status} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Components */}
        <div className="border border-warm-200 bg-white rounded-sm">
          <div className="px-3 py-2 border-b border-warm-200">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">System Components</span>
          </div>
          <div className="p-3">
            {health?.components.map(c => <ComponentRow key={c.name} c={c} />) ?? <div className="text-xs text-gray-400">No data</div>}
          </div>
        </div>

        {/* Data quality */}
        <div className="border border-warm-200 bg-white rounded-sm">
          <div className="px-3 py-2 border-b border-warm-200 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Data Sources</span>
            {quality && (
              <span className="text-[10px] font-mono text-gray-400">
                AI Confidence: <span className={`font-bold ${quality.overall_confidence >= 0.8 ? 'text-emerald-600' : quality.overall_confidence >= 0.65 ? 'text-amber-600' : 'text-red-600'}`}>
                  {(quality.overall_confidence * 100).toFixed(0)}%
                </span>
              </span>
            )}
          </div>
          <div className="p-3">
            {quality?.sources.map(s => <DataSourceRow key={s.name} s={s} />) ?? <div className="text-xs text-gray-400">No data</div>}
          </div>
        </div>
      </div>

      {/* Audit ledger */}
      <div className="border border-warm-200 bg-white rounded-sm">
        <div className="px-3 py-2 border-b border-warm-200 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Audit Ledger</span>
          <span className="text-[9px] text-gray-400 font-mono">Append-only — immutable</span>
        </div>
        {audit.length === 0 ? (
          <div className="p-4 text-xs text-gray-400 text-center">No audit events yet. Events are created when you approve/reject recommendations.</div>
        ) : (
          <div className="divide-y divide-slate-800/40">
            {audit.map((evt: any) => (
              <div key={evt.id} className="px-3 py-2 flex items-start gap-3">
                <span className="text-[10px] font-mono text-gray-400 flex-shrink-0 mt-0.5">
                  {new Date(evt.event_timestamp).toLocaleTimeString()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold text-navy-700 font-mono uppercase">
                      {evt.event_type}
                    </span>
                    <span className="text-[10px] text-gray-400">{evt.resource_type}/{evt.resource_id?.slice(0, 8)}…</span>
                    {evt.actor_type === 'human' && (
                      <span className="text-[9px] text-blue-600 font-mono">HUMAN</span>
                    )}
                  </div>
                  {evt.reason && <div className="text-[10px] text-gray-400 mt-0.5">{evt.reason}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
