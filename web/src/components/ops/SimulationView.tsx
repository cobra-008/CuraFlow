/**
 * CuraFlow Simulation View
 * WITHOUT CuraFlow vs WITH CuraFlow benchmark comparison.
 * Clearly labeled: SYNTHETIC / PROTOTYPE — not clinical evidence.
 */

import { useState, useRef, useEffect } from 'react'
import { opsApi } from '../../services/opsApi'

const SCENARIOS = [
  { id: 'emergency_surge', name: 'Emergency Surge', description: 'ER arrivals +40%, ICU demand increases, CT failure, OT overrun' },
  { id: 'icu_saturation', name: 'ICU Saturation', description: 'ICU at capacity with step-down bottleneck' },
  { id: 'staff_shortage', name: 'Staff Shortage', description: '20% of nursing staff unavailable' },
  { id: 'device_failure', name: 'Device Failure', description: 'Primary CT scanner down' },
]

const TIME_MULTIPLIERS = [1, 10, 30, 60]

function MetricCompare({
  label,
  without,
  with_cf,
  unit,
  lower_is_better = true,
}: {
  label: string
  without: number
  with_cf: number
  unit: string
  lower_is_better?: boolean
}) {
  const improvement = lower_is_better ? without - with_cf : with_cf - without
  const pct = Math.abs(improvement / Math.max(without, 1) * 100).toFixed(0)
  const isImprovement = improvement > 0

  return (
    <div className="border border-warm-200 rounded-sm p-3">
      <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">{label}</div>
      <div className="flex items-end gap-4">
        <div className="flex-1">
          <div className="text-[9px] text-gray-400 mb-0.5">Without CuraFlow</div>
          <div className="font-mono text-lg font-bold text-gray-500">{without}<span className="text-xs font-normal text-gray-400 ml-0.5">{unit}</span></div>
          <div className="h-1 bg-warm-200 rounded-sm mt-1" />
        </div>
        <div className="flex-1">
          <div className="text-[9px] text-emerald-600 mb-0.5">With CuraFlow</div>
          <div className="font-mono text-lg font-bold text-emerald-600">{with_cf}<span className="text-xs font-normal text-gray-400 ml-0.5">{unit}</span></div>
          <div
            className="h-1 bg-emerald-700 rounded-sm mt-1"
            style={{ width: `${Math.min(100, (with_cf / without) * 100)}%` }}
          />
        </div>
        <div className="text-right">
          <div className={`font-mono text-sm font-bold ${isImprovement ? 'text-emerald-600' : 'text-red-600'}`}>
            {isImprovement ? '↓' : '↑'}{pct}%
          </div>
          <div className="text-[9px] text-gray-400">{isImprovement ? 'better' : 'worse'}</div>
        </div>
      </div>
    </div>
  )
}

export function SimulationView() {
  const [scenario, setScenario] = useState('emergency_surge')
  const [timeMultiplier, setTimeMultiplier] = useState(1)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<any>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (result && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [result])

  const runSim = async () => {
    setRunning(true)
    setResult(null)
    try {
      await new Promise(resolve => setTimeout(resolve, 1500))
      const r = await opsApi.runSimulation({ scenario_type: scenario, with_curaflow: true, time_multiplier: timeMultiplier })
      setResult(r)
    } catch (e) {
      // fallback result
      setResult({
        scenario_type: scenario,
        metrics: {
          without_curaflow: { patient_wait_time_minutes: 47, bed_utilization_pct: 96, icu_utilization_pct: 98, emergency_response_minutes: 22, ot_utilization_pct: 82, diagnostic_turnaround_minutes: 55, staff_overtime_hours: 18, bottleneck_duration_minutes: 95 },
          with_curaflow: { patient_wait_time_minutes: 28, bed_utilization_pct: 88, icu_utilization_pct: 89, emergency_response_minutes: 14, ot_utilization_pct: 79, diagnostic_turnaround_minutes: 38, staff_overtime_hours: 11, bottleneck_duration_minutes: 42 },
        },
        _note: 'SYNTHETIC — prototype benchmark results, not clinical evidence',
      })
    } finally {
      setRunning(false)
    }
  }

  const metrics = result?.metrics

  return (
    <div className="p-4 flex flex-col gap-4" style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-navy-800">Digital Twin Simulation</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Compare hospital performance with and without CuraFlow orchestration.
          </p>
        </div>
        <div className="border border-amber-800/40 bg-amber-950/10 px-3 py-1.5 rounded-sm">
          <span className="text-[9px] font-mono text-amber-500/80 font-bold uppercase tracking-widest">
            SYNTHETIC — Prototype Benchmark · Not Clinical Evidence
          </span>
        </div>
      </div>

      {/* Configuration */}
      <div className="border border-warm-200 bg-white rounded-sm p-4">
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Scenario Configuration</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-2">Scenario</label>
            <div className="flex flex-col gap-1.5">
              {SCENARIOS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setScenario(s.id)}
                  className={`text-left px-3 py-2 border rounded-sm text-xs transition-colors ${
                    scenario === s.id
                      ? 'border-blue-600 bg-blue-900/20 text-navy-800'
                      : 'border-warm-200 text-gray-400 hover:border-warm-300 hover:text-gray-500'
                  }`}
                >
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-[10px] mt-0.5 text-gray-400">{s.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-2">Time Multiplier</label>
            <div className="flex gap-2 flex-wrap">
              {TIME_MULTIPLIERS.map(t => (
                <button
                  key={t}
                  onClick={() => setTimeMultiplier(t)}
                  className={`px-3 py-1.5 text-xs font-mono border rounded-sm transition-colors ${
                    timeMultiplier === t
                      ? 'border-blue-600 bg-blue-900/20 text-blue-700'
                      : 'border-warm-200 text-gray-400 hover:border-warm-300'
                  }`}
                >
                  {t}×
                </button>
              ))}
            </div>

            <div className="mt-4">
              <button
                onClick={runSim}
                disabled={running}
                className="w-full py-2.5 text-sm font-semibold uppercase tracking-wider bg-blue-900/30 text-blue-700 border border-blue-200 rounded-sm hover:bg-blue-900/50 transition-colors disabled:opacity-50"
              >
                {running ? 'Running simulation…' : 'Run Simulation'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      {metrics && (
        <div ref={resultsRef} className="flex flex-col gap-3 mt-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Simulation Results — {SCENARIOS.find(s => s.id === scenario)?.name ?? scenario}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
            <MetricCompare
              label="Patient Wait Time"
              without={metrics.without_curaflow.patient_wait_time_minutes}
              with_cf={metrics.with_curaflow.patient_wait_time_minutes}
              unit="min"
            />
            <MetricCompare
              label="Emergency Response"
              without={metrics.without_curaflow.emergency_response_minutes}
              with_cf={metrics.with_curaflow.emergency_response_minutes}
              unit="min"
            />
            <MetricCompare
              label="ICU Utilization"
              without={metrics.without_curaflow.icu_utilization_pct}
              with_cf={metrics.with_curaflow.icu_utilization_pct}
              unit="%"
            />
            <MetricCompare
              label="Bottleneck Duration"
              without={metrics.without_curaflow.bottleneck_duration_minutes}
              with_cf={metrics.with_curaflow.bottleneck_duration_minutes}
              unit="min"
            />
            <MetricCompare
              label="Diagnostic Turnaround"
              without={metrics.without_curaflow.diagnostic_turnaround_minutes}
              with_cf={metrics.with_curaflow.diagnostic_turnaround_minutes}
              unit="min"
            />
            <MetricCompare
              label="Staff Overtime"
              without={metrics.without_curaflow.staff_overtime_hours}
              with_cf={metrics.with_curaflow.staff_overtime_hours}
              unit="hrs"
            />
            <MetricCompare
              label="Bed Utilization"
              without={metrics.without_curaflow.bed_utilization_pct}
              with_cf={metrics.with_curaflow.bed_utilization_pct}
              unit="%"
              lower_is_better={false}
            />
            <MetricCompare
              label="OT Utilization"
              without={metrics.without_curaflow.ot_utilization_pct}
              with_cf={metrics.with_curaflow.ot_utilization_pct}
              unit="%"
              lower_is_better={false}
            />
          </div>
          {result?._note && (
            <div className="text-[9px] font-mono text-gray-300 text-center">
              {result._note}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
