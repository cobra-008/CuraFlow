/**
 * CuraFlow Command Center
 * Hospital Operations Command & Orchestration Layer
 *
 * Design: Restrained, dense, professional operations-centre aesthetic.
 * Font: IBM Plex Sans. No decorative effects. Colour = operational state only.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { opsApi, type HospitalState, type Bottleneck, type Recommendation } from '../../services/opsApi'
import { ApprovalCenter } from './ApprovalCenter'
import { SimulationView } from './SimulationView'
import { AgentOpsView } from './AgentOpsView'
import { SystemHealthView } from './SystemHealthView'

// ── Design tokens (operations colours) ────────────────────────────────────────
// Normal: #1a7a4a (deep green)
// Attention: #b07d2a (muted amber)
// Critical: #c0392b (deep red)
// Info: #1e4a7a (deep blue)

type OpsView = 'command' | 'approvals' | 'simulation' | 'agents' | 'system'

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

function priorityColor(p: string) {
  if (p === 'critical') return 'border-red-600 bg-red-900/10'
  if (p === 'high') return 'border-orange-600 bg-orange-900/10'
  if (p === 'medium') return 'border-amber-600/60 bg-amber-900/10'
  return 'border-slate-600 bg-slate-800/40'
}

function priorityLabel(p: string) {
  if (p === 'critical') return 'CRITICAL'
  if (p === 'high') return 'HIGH'
  if (p === 'medium') return 'MEDIUM'
  return 'LOW'
}

function MetricBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="h-1 bg-slate-800 rounded-sm overflow-hidden">
      <div className={`h-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function UtilGauge({ label, value, sublabel }: { label: string; value: number; sublabel?: string }) {
  const color = value >= 90 ? 'bg-red-500' : value >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
  const textColor = value >= 90 ? 'text-red-400' : value >= 75 ? 'text-amber-400' : 'text-emerald-400'
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</span>
        <span className={`font-mono text-lg font-bold ${textColor}`}>{value.toFixed(0)}<span className="text-xs font-normal text-slate-500">%</span></span>
      </div>
      <MetricBar value={value} color={color} />
      {sublabel && <span className="text-[10px] text-slate-600">{sublabel}</span>}
    </div>
  )
}

function TimestampPill({ ts }: { ts: string }) {
  const dt = new Date(ts)
  const secs = Math.floor((Date.now() - dt.getTime()) / 1000)
  const label = secs < 10 ? 'Just now' : secs < 60 ? `${secs}s ago` : `${Math.floor(secs / 60)}m ago`
  return <span className="text-[10px] text-slate-600 font-mono">{label}</span>
}

// ── Stat Block ────────────────────────────────────────────────────────────────

function StatBlock({
  label, value, sub, alert
}: { label: string; value: string | number; sub?: string; alert?: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 px-3 py-2.5 border rounded-sm ${alert ? 'border-amber-800/40 bg-amber-950/10' : 'border-slate-800 bg-slate-900/40'}`}>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</span>
      <span className={`font-mono text-xl font-bold leading-tight ${alert ? 'text-amber-300' : 'text-slate-100'}`}>{value}</span>
      {sub && <span className="text-[10px] text-slate-600">{sub}</span>}
    </div>
  )
}

// ── Bottleneck Row ────────────────────────────────────────────────────────────

function BottleneckRow({ bn }: { bn: Bottleneck }) {
  const label = bn.bottleneck_type.replace(/_/g, ' ').toUpperCase()
  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-800/60 last:border-0">
      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
        bn.severity === 'critical' ? 'bg-red-500' :
        bn.severity === 'high' ? 'bg-orange-500' : 'bg-amber-400'
      }`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-200 truncate">{label}</span>
          <span className={`text-[10px] font-mono font-bold uppercase ${severityColor(bn.severity)}`}>{bn.severity}</span>
        </div>
        <div className="flex gap-3 mt-0.5">
          <span className="text-[10px] text-slate-500">
            Value: <span className="text-slate-300 font-mono">{bn.current_value?.toFixed(1)}</span>
          </span>
          <span className="text-[10px] text-slate-500">
            Threshold: <span className="text-slate-300 font-mono">{bn.threshold_value}</span>
          </span>
          <span className="text-[10px] text-slate-500">
            Status: <span className="text-slate-400 uppercase">{bn.status}</span>
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Recommendation Card ───────────────────────────────────────────────────────

function RecommendationCard({
  rec,
  onAction,
}: {
  rec: Recommendation
  onAction: (id: string) => void
}) {
  return (
    <div className={`border rounded-sm p-3 ${priorityColor(rec.priority)}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <span className="text-[10px] font-mono text-slate-500 mt-0.5 flex-shrink-0">
            {String(rec.recommendation_number).padStart(2, '0')}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-100">{rec.title}</span>
              <span className={`text-[10px] font-bold font-mono ${
                rec.priority === 'critical' ? 'text-red-400' :
                rec.priority === 'high' ? 'text-orange-400' : 'text-amber-400'
              }`}>{priorityLabel(rec.priority)}</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed line-clamp-2">{rec.summary}</p>
          </div>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <button
            onClick={() => onAction(rec.id)}
            className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider bg-blue-900/40 text-blue-300 border border-blue-700/50 rounded-sm hover:bg-blue-900/60 transition-colors"
          >
            Review
          </button>
        </div>
      </div>

      {rec._is_synthetic && (
        <div className="mt-2 text-[9px] text-slate-600 font-mono">
          SYNTHETIC — prototype recommendation, not for clinical use
        </div>
      )}
    </div>
  )
}

// ── Hospital Timeline (minimal sparkline) ─────────────────────────────────────

function TimelineBar({ label, values, color }: { label: string; values: number[]; color: string }) {
  const max = Math.max(...values, 1)
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-500 w-20 flex-shrink-0 truncate">{label}</span>
      <div className="flex items-end gap-px flex-1 h-6">
        {values.map((v, i) => (
          <div
            key={i}
            className={`flex-1 ${color} opacity-80`}
            style={{ height: `${Math.max(4, (v / max) * 24)}px` }}
          />
        ))}
      </div>
    </div>
  )
}

// ── Main Command Center ───────────────────────────────────────────────────────

export function CommandCenter() {
  const [view, setView] = useState<OpsView>('command')
  const [state, setState] = useState<HospitalState | null>(null)
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null)
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
      // keep stale state on error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(fetchData, 15000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
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

  const handleReviewRec = (id: string) => {
    const rec = recommendations.find(r => r.id === id)
    if (rec) {
      setSelectedRec(rec)
      setView('approvals')
    }
  }

  // ── Nav ───────────────────────────────────────────────────────────────────
  const navItems: { id: OpsView; label: string }[] = [
    { id: 'command', label: 'Command Center' },
    { id: 'approvals', label: `Approvals${recommendations.filter(r=>r.status==='pending').length > 0 ? ` (${recommendations.filter(r=>r.status==='pending').length})` : ''}` },
    { id: 'simulation', label: 'Simulation' },
    { id: 'agents', label: 'Agents' },
    { id: 'system', label: 'System' },
  ]

  const criticalCount = bottlenecks.filter(b => b.severity === 'critical').length
  const highCount = bottlenecks.filter(b => b.severity === 'high').length

  return (
    <div className="flex flex-col h-full bg-[#07090f] text-slate-200" style={{ fontFamily: "'IBM Plex Sans', 'IBM Plex Mono', system-ui, sans-serif" }}>

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-slate-800/60 bg-[#070b14]">
        <div className="px-4 py-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold tracking-[0.15em] uppercase text-slate-300">CURAFLOW</span>
              <span className="text-[9px] text-slate-600 uppercase tracking-widest">Hospital Operations Command</span>
            </div>
            {state?.crisis_mode && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-900/30 border border-red-700/50 rounded-sm">
                <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-red-300 uppercase tracking-wider">Crisis Mode</span>
              </div>
            )}
            {state?.is_synthetic && (
              <span className="text-[9px] text-slate-600 font-mono border border-slate-800 px-1.5 py-0.5 rounded-sm">
                SYNTHETIC DATA
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {lastUpdated && <TimestampPill ts={lastUpdated} />}
            {state?.crisis_mode ? (
              <button
                onClick={resolveCrisis}
                disabled={crisisLoading}
                className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700 rounded-sm hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                {crisisLoading ? 'Working…' : 'Resolve Crisis'}
              </button>
            ) : (
              <button
                onClick={triggerCrisis}
                disabled={crisisLoading}
                className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider bg-red-900/30 text-red-300 border border-red-800/50 rounded-sm hover:bg-red-900/50 transition-colors disabled:opacity-50"
                title="Activate hospital crisis demo scenario (synthetic)"
              >
                {crisisLoading ? 'Working…' : 'Demo Crisis'}
              </button>
            )}
          </div>
        </div>

        {/* Nav */}
        <div className="flex border-t border-slate-800/40 px-4">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wider border-b-2 transition-colors ${
                view === item.id
                  ? 'border-blue-500 text-slate-200'
                  : 'border-transparent text-slate-500 hover:text-slate-400'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-auto">

        {view === 'command' && (
          <CommandView
            state={state}
            bottlenecks={bottlenecks}
            recommendations={recommendations}
            loading={loading}
            criticalCount={criticalCount}
            highCount={highCount}
            onReviewRec={handleReviewRec}
          />
        )}

        {view === 'approvals' && (
          <ApprovalCenter
            recommendations={recommendations}
            initialSelectedRec={selectedRec}
            onDecision={fetchData}
          />
        )}

        {view === 'simulation' && <SimulationView />}
        {view === 'agents' && <AgentOpsView />}
        {view === 'system' && <SystemHealthView />}
      </div>
    </div>
  )
}

// ── Command View (main dashboard) ─────────────────────────────────────────────

function CommandView({
  state,
  bottlenecks,
  recommendations,
  loading,
  criticalCount,
  highCount,
  onReviewRec,
}: {
  state: HospitalState | null
  bottlenecks: Bottleneck[]
  recommendations: Recommendation[]
  loading: boolean
  criticalCount: number
  highCount: number
  onReviewRec: (id: string) => void
}) {
  if (loading && !state) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-600 text-sm">
        Connecting to hospital state engine…
      </div>
    )
  }

  if (!state) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-600 text-sm">
        Hospital state unavailable. Ensure the mock server is running.
      </div>
    )
  }

  const pressure = state.pressure

  // Synthetic timeline data
  const timelineValues = Array.from({ length: 12 }, (_, i) =>
    Math.max(0, Math.min(100, 60 + Math.sin(i * 0.8) * 20 + (state.crisis_mode ? 20 : 0)))
  )

  return (
    <div className="p-4 grid grid-cols-12 gap-3">

      {/* ── Column 1: Hospital State + Pressure ─────────────────────────────── */}
      <div className="col-span-12 xl:col-span-3 flex flex-col gap-3">

        {/* Hospital State header */}
        <div className="border border-slate-800 bg-[#0a0e1a] rounded-sm">
          <div className="px-3 py-2 border-b border-slate-800/60">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Hospital State</span>
          </div>
          <div className="p-3 grid grid-cols-2 gap-2">
            <StatBlock
              label="Beds"
              value={`${state.beds.occupancy_pct.toFixed(0)}%`}
              sub={`${state.beds.occupied}/${state.beds.total} occupied`}
              alert={state.beds.occupancy_pct >= 88}
            />
            <StatBlock
              label="ICU"
              value={`${state.icu.occupancy_pct.toFixed(0)}%`}
              sub={`${state.icu.occupied}/${state.icu.total} occupied`}
              alert={state.icu.occupancy_pct >= 85}
            />
            <StatBlock
              label="Staff"
              value={`${state.staff.utilization_pct.toFixed(0)}%`}
              sub={`${state.staff.available} available`}
              alert={state.staff.utilization_pct >= 80}
            />
            <StatBlock
              label="ER Waiting"
              value={state.emergency.waiting}
              sub={`/ ${state.emergency.capacity} capacity`}
              alert={state.emergency.waiting > 12}
            />
            <StatBlock
              label="OT Rooms"
              value={`${state.operating_rooms.utilization_pct.toFixed(0)}%`}
              sub={`${state.operating_rooms.available} available`}
            />
            <StatBlock
              label="Diag Queue"
              value={state.diagnostics.queue_length}
              sub={`${state.diagnostics.available_devices} devices free`}
              alert={state.diagnostics.queue_length > 12}
            />
          </div>
        </div>

        {/* Operational Pressure */}
        <div className="border border-slate-800 bg-[#0a0e1a] rounded-sm">
          <div className="px-3 py-2 border-b border-slate-800/60 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Operational Pressure</span>
            <span className={`text-[10px] font-bold font-mono uppercase ${pressureColor(pressure.label)}`}>
              {pressure.label}
            </span>
          </div>
          <div className="p-3 flex flex-col gap-2.5">
            <UtilGauge
              label="Emergency"
              value={pressure.emergency}
              sublabel={pressure.emergency >= 70 ? 'Above threshold' : undefined}
            />
            <UtilGauge
              label="ICU"
              value={pressure.icu}
              sublabel={pressure.icu >= 85 ? 'Critical zone' : undefined}
            />
            <UtilGauge label="Beds" value={pressure.beds} />
            <UtilGauge label="Staff" value={pressure.staff} />
            <div className="pt-1 border-t border-slate-800/60">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Overall</span>
                <span className={`text-base font-mono font-bold ${pressureColor(pressure.label)}`}>
                  {pressure.overall.toFixed(0)}<span className="text-xs text-slate-500 font-normal">/100</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottlenecks */}
        <div className="border border-slate-800 bg-[#0a0e1a] rounded-sm">
          <div className="px-3 py-2 border-b border-slate-800/60 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Active Bottlenecks</span>
            <div className="flex gap-2">
              {criticalCount > 0 && (
                <span className="text-[10px] font-mono text-red-400 font-bold">{criticalCount} CRITICAL</span>
              )}
              {highCount > 0 && (
                <span className="text-[10px] font-mono text-orange-400 font-bold">{highCount} HIGH</span>
              )}
              {bottlenecks.length === 0 && (
                <span className="text-[10px] font-mono text-emerald-400">NONE</span>
              )}
            </div>
          </div>
          <div className="p-3">
            {bottlenecks.length === 0 ? (
              <p className="text-xs text-slate-600 text-center py-2">No active bottlenecks</p>
            ) : (
              bottlenecks.map(bn => <BottleneckRow key={bn.id} bn={bn} />)
            )}
          </div>
        </div>
      </div>

      {/* ── Column 2: Timeline + Quick Stats ────────────────────────────────── */}
      <div className="col-span-12 xl:col-span-5 flex flex-col gap-3">

        {/* Hospital Timeline */}
        <div className="border border-slate-800 bg-[#0a0e1a] rounded-sm">
          <div className="px-3 py-2 border-b border-slate-800/60">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Hospital Timeline — Last 3 Hours</span>
          </div>
          <div className="p-3 flex flex-col gap-2">
            <TimelineBar
              label="ER Arrivals"
              values={timelineValues.map(v => v * 0.3 + (state.emergency.waiting * 2))}
              color="bg-red-500"
            />
            <TimelineBar
              label="ICU Demand"
              values={timelineValues.map(v => v * state.icu.occupancy_pct / 100)}
              color="bg-orange-500"
            />
            <TimelineBar
              label="CT Queue"
              values={timelineValues.map((_, i) => Math.max(0, state.diagnostics.queue_length + (i - 6)))}
              color="bg-blue-500"
            />
            <TimelineBar
              label="OT Activity"
              values={timelineValues.map(v => v * state.operating_rooms.utilization_pct / 100)}
              color="bg-purple-500"
            />
            <TimelineBar
              label="Staff Avail"
              values={timelineValues.map(v => 100 - (v * state.staff.utilization_pct / 100))}
              color="bg-slate-500"
            />
            <div className="flex justify-between mt-1">
              {['3h', '2h 30m', '2h', '1h 30m', '1h', '30m', 'Now'].map((t, i) => (
                <span key={i} className="text-[9px] text-slate-700">{t}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Resource Breakdown Table */}
        <div className="border border-slate-800 bg-[#0a0e1a] rounded-sm">
          <div className="px-3 py-2 border-b border-slate-800/60">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Resource Summary</span>
          </div>
          <div className="p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left text-[10px] text-slate-500 px-3 py-2 font-semibold uppercase tracking-wider">Resource</th>
                  <th className="text-right text-[10px] text-slate-500 px-3 py-2 font-semibold uppercase tracking-wider">Total</th>
                  <th className="text-right text-[10px] text-slate-500 px-3 py-2 font-semibold uppercase tracking-wider">In Use</th>
                  <th className="text-right text-[10px] text-slate-500 px-3 py-2 font-semibold uppercase tracking-wider">Free</th>
                  <th className="text-right text-[10px] text-slate-500 px-3 py-2 font-semibold uppercase tracking-wider">Util%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {[
                  { label: 'General Beds', total: state.beds.total - state.icu.total,
                    used: state.beds.occupied - state.icu.occupied,
                    free: state.beds.available,
                    util: ((state.beds.occupied - state.icu.occupied) / (state.beds.total - state.icu.total) * 100).toFixed(0) },
                  { label: 'ICU Beds', total: state.icu.total, used: state.icu.occupied,
                    free: state.icu.available,
                    util: state.icu.occupancy_pct.toFixed(0) },
                  { label: 'Operating Rooms', total: state.operating_rooms.total,
                    used: state.operating_rooms.occupied,
                    free: state.operating_rooms.available,
                    util: state.operating_rooms.utilization_pct.toFixed(0) },
                  { label: 'Diagnostic Devices', total: state.diagnostics.total_devices,
                    used: state.diagnostics.total_devices - state.diagnostics.available_devices,
                    free: state.diagnostics.available_devices,
                    util: (((state.diagnostics.total_devices - state.diagnostics.available_devices) / Math.max(state.diagnostics.total_devices, 1)) * 100).toFixed(0) },
                  { label: 'Staff (On Duty)', total: state.staff.on_duty,
                    used: state.staff.on_duty - state.staff.available,
                    free: state.staff.available,
                    util: state.staff.utilization_pct.toFixed(0) },
                ].map(row => {
                  const util = Number(row.util)
                  const utilColor = util >= 90 ? 'text-red-400' : util >= 75 ? 'text-amber-400' : 'text-slate-300'
                  return (
                    <tr key={row.label} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-3 py-2 text-slate-300">{row.label}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-400">{row.total}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-300">{row.used}</td>
                      <td className="px-3 py-2 text-right font-mono text-emerald-400">{row.free}</td>
                      <td className={`px-3 py-2 text-right font-mono font-bold ${utilColor}`}>{row.util}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Predictions strip */}
        <PredictionsStrip state={state} />
      </div>

      {/* ── Column 3: Recommendations ────────────────────────────────────────── */}
      <div className="col-span-12 xl:col-span-4 flex flex-col gap-3">
        <div className="border border-slate-800 bg-[#0a0e1a] rounded-sm flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-slate-800/60 flex items-center justify-between flex-shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Active Recommendations</span>
            <span className="text-[10px] font-mono text-slate-500">{recommendations.length} active</span>
          </div>
          <div className="p-3 flex flex-col gap-2 overflow-auto">
            {recommendations.length === 0 ? (
              <p className="text-xs text-slate-600 text-center py-4">No active recommendations</p>
            ) : (
              recommendations.map(rec => (
                <RecommendationCard
                  key={rec.id}
                  rec={rec}
                  onAction={onReviewRec}
                />
              ))
            )}
          </div>
        </div>

        {/* AI Decision Trace */}
        <DecisionTrace state={state} bottlenecks={bottlenecks} recommendations={recommendations} />
      </div>
    </div>
  )
}

// ── Predictions Strip ─────────────────────────────────────────────────────────

function PredictionsStrip({ state }: { state: HospitalState }) {
  const [preds, setPreds] = useState<{ type: string; value: number; confidence: number; horizon: string }[]>([])

  useEffect(() => {
    opsApi.getPredictions().then(r => {
      const grouped: Record<string, typeof r.predictions[0][]> = {}
      r.predictions.forEach(p => {
        if (!grouped[p.prediction_type]) grouped[p.prediction_type] = []
        grouped[p.prediction_type].push(p)
      })
      const summary = Object.entries(grouped).map(([type, ps]) => ({
        type,
        value: ps[0]?.predicted_value ?? 0,
        confidence: ps[0]?.confidence ?? 0.7,
        horizon: '1h',
      })).slice(0, 4)
      setPreds(summary)
    }).catch(() => {})
  }, [state])

  if (!preds.length) return null

  const typeLabel: Record<string, string> = {
    icu_demand: 'ICU Demand',
    bed_occupancy: 'Bed Occ%',
    er_arrivals: 'ER Queue',
    discharges: 'Discharges',
    staff_demand: 'Staff Demand',
    diagnostic_demand: 'Diag Queue',
  }

  return (
    <div className="border border-slate-800 bg-[#0a0e1a] rounded-sm">
      <div className="px-3 py-2 border-b border-slate-800/60 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Predictions — Next Hour</span>
        <span className="text-[9px] font-mono text-slate-600">SYNTHETIC / STATISTICAL</span>
      </div>
      <div className="p-3 grid grid-cols-2 gap-2">
        {preds.map(p => (
          <div key={p.type} className="border border-slate-800/60 rounded-sm px-2 py-1.5">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider">{typeLabel[p.type] ?? p.type}</div>
            <div className="font-mono text-base font-bold text-slate-200 mt-0.5">{p.value.toFixed(1)}</div>
            <div className="text-[9px] text-slate-600 font-mono">conf: {(p.confidence * 100).toFixed(0)}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── AI Decision Trace ─────────────────────────────────────────────────────────

function DecisionTrace({ state, bottlenecks, recommendations }: { state: HospitalState | null, bottlenecks: Bottleneck[], recommendations: Recommendation[] }) {
  const ts = state ? new Date(state.timestamp).getTime() : 0
  const isRecent = Date.now() - ts < 45000 // consider observe done if state < 45s old
  const hasBottlenecks = bottlenecks.length > 0
  const hasRecs = recommendations.length > 0
  
  const pendingRecs = recommendations.some(r => r.status === 'pending')
  const decidedRecs = recommendations.some(r => r.status === 'approved' || r.status === 'modified' || r.status === 'rejected')
  const executeDone = recommendations.some(r => r.status === 'approved' || r.status === 'modified')

  const stages = [
    { label: 'OBSERVE', desc: 'Hospital state updated', status: isRecent ? 'done' : 'waiting' },
    { label: 'PREDICT', desc: 'Demand forecast generated', status: isRecent ? 'done' : 'waiting' },
    { label: 'DETECT', desc: 'Bottlenecks identified', status: hasBottlenecks ? 'done' : (isRecent ? 'pending' : 'waiting') },
    { label: 'OPTIMIZE', desc: 'CP-SAT constraints solved', status: hasRecs ? 'done' : (hasBottlenecks ? 'pending' : 'waiting') },
    { label: 'RECOMMEND', desc: 'Plan with explanations ready', status: hasRecs ? 'done' : (hasBottlenecks ? 'pending' : 'waiting') },
    { label: 'APPROVAL', desc: 'Awaiting human decision', status: pendingRecs ? 'waiting' : (decidedRecs ? 'done' : 'pending') },
    { label: 'EXECUTE', desc: 'Execution logged', status: executeDone ? 'done' : 'pending' },
    { label: 'VERIFY', desc: 'Outcome measurement', status: executeDone ? 'done' : 'pending' },
  ]

  return (
    <div className="border border-slate-800 bg-[#0a0e1a] rounded-sm">
      <div className="px-3 py-2 border-b border-slate-800/60">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">AI Decision Pipeline</span>
      </div>
      <div className="p-3 flex flex-col gap-1">
        {stages.map((s, i) => (
          <div key={s.label} className="flex items-start gap-2">
            <div className="flex flex-col items-center">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-0.5 ${
                s.status === 'done' ? 'bg-emerald-500' :
                s.status === 'waiting' ? 'bg-amber-400 animate-pulse' :
                'bg-slate-700'
              }`} />
              {i < stages.length - 1 && (
                <div className={`w-px flex-1 mt-0.5 ${
                  s.status === 'done' ? 'bg-emerald-800' : 'bg-slate-800'
                }`} style={{ minHeight: '8px' }} />
              )}
            </div>
            <div className="pb-1">
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-bold font-mono uppercase ${
                  s.status === 'done' ? 'text-emerald-400' :
                  s.status === 'waiting' ? 'text-amber-400' :
                  'text-slate-600'
                }`}>{s.label}</span>
              </div>
              <span className={`text-[10px] ${
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
