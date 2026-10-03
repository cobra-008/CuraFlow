import { useEffect, useState, useCallback, useRef } from 'react'
import { opsApi, type HospitalState, type Bottleneck, type Recommendation } from '../../services/opsApi'

// ── Design tokens ─────────────────────────────────────────────────────────────
// Normal: #1a7a4a (deep green) -> text-emerald-400
// Attention: #b07d2a (muted amber) -> text-amber-400
// Critical: #c0392b (deep red) -> text-red-500
// Info: #1e4a7a (deep blue) -> text-blue-400

function pressureColor(label: string) {
  if (label === 'CRITICAL') return 'text-red-500'
  if (label === 'HIGH') return 'text-orange-400'
  if (label === 'ELEVATED') return 'text-amber-400'
  if (label === 'MODERATE') return 'text-yellow-400'
  return 'text-emerald-400'
}

function severityColor(sev: string) {
  if (sev === 'critical') return 'text-red-400'
  if (sev === 'high') return 'text-orange-400'
  if (sev === 'moderate') return 'text-amber-400'
  return 'text-slate-400'
}



function MetricBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="h-1 bg-slate-800 overflow-hidden w-full">
      <div className={`h-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function TimestampPill({ ts }: { ts: string }) {
  const dt = new Date(ts)
  const secs = Math.floor((Date.now() - dt.getTime()) / 1000)
  const label = secs < 10 ? 'Just now' : secs < 60 ? `${secs}s ago` : `${Math.floor(secs / 60)}m ago`
  return <span className="text-[10px] text-slate-500 font-mono">{label}</span>
}

export function CommandCenter() {
  const [state, setState] = useState<HospitalState | null>(null)
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string>('')
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
      setLastUpdated(new Date().toISOString())
    } catch (e) {
      console.error('Failed to fetch ops data:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(fetchData, 2000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchData])

  const triggerCrisis = async () => {
    setCrisisLoading(true)
    try {
      await opsApi.triggerCrisis()
      await fetchData()
    } finally {
      setCrisisLoading(false)
    }
  }

  const resolveCrisis = async () => {
    setCrisisLoading(true)
    try {
      await opsApi.resolveCrisis()
      await fetchData()
    } finally {
      setCrisisLoading(false)
    }
  }



  const criticalCount = bottlenecks.filter(b => b.severity === 'critical').length
  const highCount = bottlenecks.filter(b => b.severity === 'high').length

  return (
    <div className="flex flex-col flex-1 w-full min-w-0 h-full bg-[#060b18] text-slate-200" style={{ fontFamily: "'IBM Plex Sans', 'IBM Plex Mono', system-ui, sans-serif" }}>

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-slate-800 bg-[#0a1628]">
        <div className="px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[12px] font-bold tracking-[0.2em] uppercase text-slate-100">CURAFLOW</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest">Hospital Operations Command</span>
            </div>
            <div className="h-6 w-px bg-slate-800 mx-2" />
            <div className="flex items-center gap-3">
              {state?.is_synthetic ? (
                <span className="text-[10px] text-slate-400 font-mono border border-slate-700 px-2 py-0.5 uppercase tracking-wider">
                  SYNTHETIC ENVIRONMENT
                </span>
              ) : (
                <span className="text-[10px] text-emerald-400 font-mono border border-emerald-900 px-2 py-0.5 uppercase tracking-wider">
                  PRODUCTION
                </span>
              )}
              <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                DEMO HOSPITAL · 120 BEDS
              </span>
              <span className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider">
                SYSTEM HEALTH · NOMINAL
              </span>
            </div>
            {state?.crisis_mode && (
              <div className="flex items-center gap-2 px-2 py-0.5 bg-red-950/50 border border-red-900/50">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-none" />
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">CRISIS MODE</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {lastUpdated && <TimestampPill ts={lastUpdated} />}
            {state?.crisis_mode ? (
              <button
                onClick={resolveCrisis}
                disabled={crisisLoading}
                className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                {crisisLoading ? 'WORKING…' : 'RESOLVE CRISIS'}
              </button>
            ) : (
              <button
                onClick={triggerCrisis}
                disabled={crisisLoading}
                className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-red-950/50 text-red-400 border border-red-900/50 hover:bg-red-900/50 transition-colors disabled:opacity-50"
              >
                {crisisLoading ? 'WORKING…' : 'DEMO CRISIS'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-auto">
        <CommandView
          state={state}
          bottlenecks={bottlenecks}
          recommendations={recommendations}
          loading={loading}
          criticalCount={criticalCount}
          highCount={highCount}
        />
      </div>
    </div>
  )
}

function CommandView({
  state,
  bottlenecks,
  recommendations,
  loading,
  criticalCount,
  highCount,
}: {
  state: HospitalState | null
  bottlenecks: Bottleneck[]
  recommendations: Recommendation[]
  loading: boolean
  criticalCount: number
  highCount: number
}) {
  if (loading && !state) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 font-mono text-sm uppercase tracking-widest">
        Connecting to hospital state engine…
      </div>
    )
  }

  if (!state) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 font-mono text-sm uppercase tracking-widest">
        Hospital state unavailable. Ensure the mock server is running.
      </div>
    )
  }

  const pressure = state.pressure

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 h-full items-start">
      
      {/* ── Column 1: Hospital Operational State ───────────────────────────── */}
      <div className="flex flex-col gap-6">
        <div className="border border-slate-800 bg-[#0a1628]">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Hospital Operational State</span>
            <span className={`text-[11px] font-mono font-bold uppercase tracking-widest ${pressureColor(pressure.label)}`}>
              {pressure.overall.toFixed(0)} / 100
            </span>
          </div>
          <div className="p-4">
            <h2 className={`text-xl font-bold uppercase tracking-wide leading-tight mb-4 ${pressureColor(pressure.label)}`}>
              {pressure.label} OPERATIONAL PRESSURE
            </h2>
            <div className="flex flex-col gap-2 font-mono text-xs text-slate-400 uppercase">
              {pressure.icu > 80 && <div>· ICU CAPACITY CONSTRAINED</div>}
              {pressure.emergency > 80 && <div>· ER VOLUME ELEVATED</div>}
              {state.diagnostics.queue_length > 10 && <div>· DIAGNOSTIC BACKLOG INCREASING</div>}
              {state.staff.utilization_pct > 80 && <div>· STAFF UTILIZATION HIGH</div>}
              {pressure.overall < 70 && <div>· ALL SYSTEMS NOMINAL</div>}
            </div>
          </div>
          <div className="border-t border-slate-800 p-4 flex flex-col gap-3">
             <UtilBar label="Emergency" value={pressure.emergency} />
             <UtilBar label="ICU" value={pressure.icu} />
             <UtilBar label="Beds" value={pressure.beds} />
             <UtilBar label="Staff" value={pressure.staff} />
          </div>
        </div>

        {/* DECISION PIPELINE */}
        <DecisionTrace state={state} bottlenecks={bottlenecks} recommendations={recommendations} />
      </div>

      {/* ── Column 2: Capacity Overview ─────────────────────────────────────── */}
      <div className="flex flex-col gap-6">
        <div className="border border-slate-800 bg-[#0a1628]">
          <div className="px-4 py-3 border-b border-slate-800">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Capacity Overview</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                  <th className="py-3 px-4 font-normal">Resource</th>
                  <th className="py-3 px-4 font-normal text-right">Current</th>
                  <th className="py-3 px-4 font-normal text-right">Capacity</th>
                  <th className="py-3 px-4 font-normal text-right">Util</th>
                  <th className="py-3 px-4 font-normal">State</th>
                </tr>
              </thead>
              <tbody className="text-xs font-mono text-slate-300">
                <CapacityRow name="Beds" current={state.beds.occupied} max={state.beds.total} util={state.beds.occupancy_pct} threshold={85} />
                <CapacityRow name="ICU" current={state.icu.occupied} max={state.icu.total} util={state.icu.occupancy_pct} threshold={80} />
                <CapacityRow name="ER" current={state.emergency.waiting} max={state.emergency.capacity} util={(state.emergency.waiting/state.emergency.capacity)*100} threshold={75} />
                <CapacityRow name="Staff" current={state.staff.on_duty} max={state.staff.total} util={state.staff.utilization_pct} threshold={80} />
                <CapacityRow name="OT" current={state.operating_rooms.occupied} max={state.operating_rooms.total} util={state.operating_rooms.utilization_pct} threshold={90} />
                <CapacityRow name="Diag" current={state.diagnostics.queue_length} max={state.diagnostics.available_devices * 5} util={(state.diagnostics.queue_length / (state.diagnostics.available_devices * 5))*100} threshold={80} />
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Column 3: Patient Flow & Active Bottlenecks ───────────────────── */}
      <div className="flex flex-col gap-6">
        {/* Hospital Flow */}
        <div className="border border-slate-800 bg-[#0a1628]">
          <div className="px-4 py-3 border-b border-slate-800">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Hospital Flow</span>
          </div>
          <div className="p-4 flex flex-col gap-2">
            <FlowStage name="ER Intake" val={state.emergency.waiting} total={state.emergency.capacity} />
            <div className="w-px h-3 bg-slate-700 ml-5" />
            <FlowStage name="Admission" val={state.beds.occupied} total={state.beds.total} />
            <div className="w-px h-3 bg-slate-700 ml-5" />
            <FlowStage name="ICU Transfer" val={state.icu.occupied} total={state.icu.total} />
            <div className="w-px h-3 bg-slate-700 ml-5" />
            <FlowStage name="Diagnostics" val={state.diagnostics.queue_length} total={state.diagnostics.available_devices * 5} />
            <div className="w-px h-3 bg-slate-700 ml-5" />
            <FlowStage name="Discharge" val={Math.floor(state.beds.total * 0.05)} total={Math.floor(state.beds.total * 0.1)} />
          </div>
        </div>

        {/* Bottlenecks */}
        <div className="border border-slate-800 bg-[#0a1628]">
          <div className="px-4 py-3 border-b border-slate-800 flex justify-between items-center">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Active Bottlenecks</span>
            <div className="flex gap-2">
               {criticalCount > 0 && <span className="text-[10px] font-mono text-red-500 font-bold">{criticalCount} CRIT</span>}
               {highCount > 0 && <span className="text-[10px] font-mono text-orange-400 font-bold">{highCount} HIGH</span>}
            </div>
          </div>
          <div className="flex flex-col divide-y divide-slate-800/50">
            {bottlenecks.length === 0 ? (
              <div className="p-4 text-xs font-mono text-slate-500 uppercase">No active bottlenecks</div>
            ) : (
              bottlenecks.map(bn => <BottleneckRow key={bn.id} bn={bn} />)
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function UtilBar({ label, value }: { label: string; value: number }) {
  const color = value >= 90 ? 'bg-red-500' : value >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
  const textColor = value >= 90 ? 'text-red-400' : value >= 75 ? 'text-amber-400' : 'text-emerald-400'
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline font-mono">
        <span className="text-[10px] uppercase text-slate-500">{label}</span>
        <span className={`text-[11px] font-bold ${textColor}`}>{value.toFixed(0)}%</span>
      </div>
      <MetricBar value={value} color={color} />
    </div>
  )
}

function CapacityRow({ name, current, max, util, threshold }: { name: string; current: number; max: number; util: number; threshold: number }) {
  const isHigh = util >= threshold
  const isCrit = util >= 95
  const statusColor = isCrit ? 'text-red-400' : isHigh ? 'text-amber-400' : 'text-emerald-400'
  const statusText = isCrit ? 'CRITICAL' : isHigh ? 'ELEVATED' : 'NOMINAL'
  
  return (
    <tr className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/20">
      <td className="py-3 px-4">{name}</td>
      <td className="py-3 px-4 text-right text-slate-100">{current}</td>
      <td className="py-3 px-4 text-right text-slate-500">{max}</td>
      <td className={`py-3 px-4 text-right ${statusColor}`}>{util.toFixed(1)}%</td>
      <td className={`py-3 px-4 ${statusColor} text-[10px]`}>{statusText}</td>
    </tr>
  )
}

function FlowStage({ name, val, total }: { name: string, val: number, total: number }) {
  const pct = total > 0 ? (val / total) * 100 : 0
  const color = pct >= 90 ? 'border-red-900 bg-red-950/30' : pct >= 75 ? 'border-amber-900 bg-amber-950/30' : 'border-slate-800 bg-slate-900/30'
  const textColor = pct >= 90 ? 'text-red-400' : pct >= 75 ? 'text-amber-400' : 'text-emerald-400'
  
  return (
    <div className={`border ${color} p-3 flex justify-between items-center`}>
      <span className="text-[11px] font-bold uppercase tracking-widest text-slate-300">{name}</span>
      <div className="flex items-baseline gap-2 font-mono">
        <span className={`text-[12px] ${textColor}`}>{val}</span>
        <span className="text-[10px] text-slate-600">/ {total}</span>
      </div>
    </div>
  )
}

function BottleneckRow({ bn }: { bn: Bottleneck }) {
  const label = bn.bottleneck_type.replace(/_/g, ' ').toUpperCase()
  return (
    <div className="flex flex-col gap-1 p-4">
      <div className="flex justify-between items-baseline">
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-200">{label}</span>
        <span className={`text-[10px] font-mono font-bold ${severityColor(bn.severity)}`}>{bn.severity.toUpperCase()}</span>
      </div>
      <div className="text-[11px] text-slate-500">{bn.description || 'No detailed assessment provided.'}</div>
    </div>
  )
}

function DecisionTrace({ state, bottlenecks, recommendations }: { state: HospitalState | null, bottlenecks: Bottleneck[], recommendations: Recommendation[] }) {
  const ts = state ? new Date(state.timestamp).getTime() : 0
  const isRecent = Date.now() - ts < 45000 
  const hasBottlenecks = bottlenecks.length > 0
  const hasRecs = recommendations.length > 0
  
  const totalCount = recommendations.length
  const pendingCount = recommendations.filter(r => r.status === 'pending').length
  const executableCount = recommendations.filter(r => r.status === 'approved' || r.status === 'modified').length

  let approvalDesc = 'Awaiting human decision'
  let approvalStatus = 'pending'
  if (totalCount > 0) {
    if (pendingCount === 0) {
      approvalDesc = `DONE — ${totalCount} decisions complete`
      approvalStatus = 'done'
    } else {
      approvalDesc = `WAITING — ${pendingCount} remaining`
      approvalStatus = 'waiting'
    }
  }

  let executeDesc = 'Execution pending'
  let executeStatus = 'pending'
  if (totalCount > 0) {
    if (executableCount > 0) {
      executeDesc = `${executableCount} logged`
      executeStatus = pendingCount === 0 ? 'done' : 'waiting'
    } else if (pendingCount === 0) {
      executeDesc = 'No actions to execute'
      executeStatus = 'done'
    }
  }

  const executableRecs = recommendations.filter(r => r.status === 'approved' || r.status === 'modified')
  let verifyDesc = 'PENDING — awaiting execution'
  let verifyStatus = 'pending'

  if (totalCount > 0 && executableCount > 0) {
    const measuring = executableRecs.some(r => r.verification?.outcome === 'PENDING')
    const hasSuccess = executableRecs.some(r => r.verification?.outcome === 'SUCCESS')
    const hasPartial = executableRecs.some(r => r.verification?.outcome === 'PARTIAL')
    const hasFailed = executableRecs.some(r => r.verification?.outcome === 'FAILED')
    const hasNotMeasurable = executableRecs.some(r => r.verification?.outcome === 'NOT_MEASURABLE')
    const anyVerified = hasSuccess || hasPartial || hasFailed || hasNotMeasurable

    if (measuring) {
      verifyDesc = 'MEASURING — active'
      verifyStatus = 'waiting'
    } else if (anyVerified) {
      verifyStatus = pendingCount === 0 ? 'done' : 'waiting'
      if (hasFailed) verifyDesc = 'FAILED'
      else if (hasPartial) verifyDesc = 'PARTIAL'
      else if (hasSuccess) verifyDesc = 'SUCCESS'
      else if (hasNotMeasurable) verifyDesc = 'NOT MEASURABLE'
    }
  } else if (totalCount > 0 && pendingCount === 0) {
    verifyDesc = 'No actions to verify'
    verifyStatus = 'done'
  }

  const stages = [
    { label: 'OBSERVE', desc: 'Hospital state updated', status: isRecent ? 'done' : 'waiting' },
    { label: 'PREDICT', desc: 'Demand forecast generated', status: isRecent ? 'done' : 'waiting' },
    { label: 'DETECT', desc: 'Bottlenecks identified', status: hasBottlenecks ? 'done' : (isRecent ? 'pending' : 'waiting') },
    { label: 'OPTIMIZE', desc: 'CP-SAT constraints solved', status: hasRecs ? 'done' : (hasBottlenecks ? 'pending' : 'waiting') },
    { label: 'RECOMMEND', desc: 'Plan ready', status: hasRecs ? 'done' : (hasBottlenecks ? 'pending' : 'waiting') },
    { label: 'APPROVAL', desc: approvalDesc, status: approvalStatus },
    { label: 'EXECUTE', desc: executeDesc, status: executeStatus },
    { label: 'VERIFY', desc: verifyDesc, status: verifyStatus },
  ]

  return (
    <div className="border border-slate-800 bg-[#0a1628]">
      <div className="px-4 py-3 border-b border-slate-800 flex justify-between items-center">
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Decision Pipeline</span>
      </div>
      <div className="p-4 flex flex-col">
        {stages.map((s, i) => (
          <div key={s.label} className="flex items-start gap-4 h-12">
            <div className="flex flex-col items-center h-full">
              <div className={`w-2 h-2 mt-1 flex-shrink-0 ${
                s.status === 'done' ? 'bg-emerald-500' :
                s.status === 'waiting' ? 'bg-amber-400 animate-pulse' :
                'bg-slate-800'
              }`} />
              {i < stages.length - 1 && (
                <div className={`w-px flex-1 my-1 ${
                  s.status === 'done' ? 'bg-emerald-900' : 'bg-slate-800'
                }`} />
              )}
            </div>
            <div className="flex flex-col -mt-0.5">
              <span className={`text-[10px] font-bold font-mono uppercase tracking-widest ${
                s.status === 'done' ? 'text-emerald-400' :
                s.status === 'waiting' ? 'text-amber-400' :
                'text-slate-600'
              }`}>{s.label}</span>
              <span className={`text-[10px] font-mono uppercase ${
                s.status === 'done' ? 'text-slate-400' :
                s.status === 'waiting' ? 'text-amber-500/70' :
                'text-slate-700'
              }`}>{s.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
