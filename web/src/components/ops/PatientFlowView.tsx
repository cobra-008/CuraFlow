import { Activity, ArrowRight, UserCheck, Clock, CheckCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { opsApi, type HospitalState } from '../../services/opsApi'

export function PatientFlowView() {
  const [state, setState] = useState<HospitalState | null>(null)

  useEffect(() => {
    let mounted = true
    const fetchState = async () => {
      try {
        const data = await opsApi.getHospitalState()
        if (mounted) setState(data)
      } catch (err) {
        console.error(err)
      }
    }
    fetchState()
    const interval = setInterval(fetchState, 5000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const steps = state ? [
    { name: 'Triage (ER)', count: state.emergency.waiting, waitTime: `${Math.round(state.emergency.waiting * 4.5)}m`, status: state.emergency.demand_score > 80 ? 'critical' : state.emergency.demand_score > 50 ? 'warning' : 'optimal', capacity: state.emergency.capacity, icon: UserCheck },
    { name: 'Diagnostics', count: state.diagnostics.queue_length, waitTime: `${Math.round(state.diagnostics.queue_length * 8.5)}m`, status: state.diagnostics.queue_length > 10 ? 'critical' : state.diagnostics.queue_length > 5 ? 'warning' : 'optimal', capacity: state.diagnostics.total_devices * 3, icon: Activity },
    { name: 'Treatment (OT)', count: state.operating_rooms.occupied, waitTime: state.operating_rooms.utilization_pct > 80 ? '45m' : '15m', status: state.operating_rooms.utilization_pct > 90 ? 'critical' : state.operating_rooms.utilization_pct > 75 ? 'warning' : 'optimal', capacity: state.operating_rooms.total, icon: Activity },
    { name: 'ICU', count: state.icu.occupied, waitTime: state.icu.occupancy_pct > 90 ? '120m' : '10m', status: state.icu.occupancy_pct > 85 ? 'critical' : state.icu.occupancy_pct > 70 ? 'warning' : 'optimal', capacity: state.icu.total, icon: Activity },
    { name: 'Ward (Beds)', count: state.beds.occupied, waitTime: '-', status: state.beds.occupancy_pct > 90 ? 'critical' : state.beds.occupancy_pct > 80 ? 'warning' : 'optimal', capacity: state.beds.total, icon: CheckCircle }
  ] : []

  const totalPatients = state ? state.emergency.waiting + state.diagnostics.queue_length + state.operating_rooms.occupied + state.icu.occupied + state.beds.occupied : 0

  return (
    <div className="p-6 h-full flex flex-col gap-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      <header className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Patient Flow Analysis</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time tracking of patient journeys through departments</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-medium flex items-center gap-2 border border-blue-100 shadow-sm transition-all duration-300">
            <Activity size={18} />
            <span>Total Patients: {totalPatients || '...'}</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {steps.map((step, idx) => (
          <div key={idx} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className={`absolute top-0 left-0 w-full h-1 ${
              step.status === 'optimal' ? 'bg-emerald-500' :
              step.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
            }`} />
            
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-semibold text-slate-700">{step.name}</h3>
              <div className="bg-slate-50 p-2 rounded-lg text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600 transition-colors">
                <step.icon size={18} />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-3xl font-bold text-slate-800">{step.count}</div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">Patients</div>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <Clock size={14} className={
                  step.status === 'optimal' ? 'text-emerald-500' :
                  step.status === 'warning' ? 'text-amber-500' : 'text-red-500'
                } />
                <span className={`font-medium ${
                  step.status === 'optimal' ? 'text-emerald-600' :
                  step.status === 'warning' ? 'text-amber-600' : 'text-red-600'
                }`}>Avg Wait: {step.waitTime}</span>
              </div>
            </div>

            {idx < steps.length - 1 && (
              <div className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 w-8 h-8 bg-white border border-gray-100 rounded-full items-center justify-center text-slate-300">
                <ArrowRight size={16} />
              </div>
            )}
          </div>
        ))}
        {steps.length === 0 && (
          <div className="col-span-5 h-32 flex items-center justify-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
             Fetching metrics...
          </div>
        )}
      </div>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-semibold text-slate-700 text-lg">Department Throughput Summary</h3>
          <span className="text-xs font-medium bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /> Live
          </span>
        </div>

        {state ? (
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Department', 'Current Load', 'Capacity', 'Avg Wait', 'Status'].map(h => (
                    <th key={h} className="pb-3 text-xs font-bold uppercase tracking-wider text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {steps.map((step, idx) => {
                  const fillPct = step.capacity > 0 ? Math.min(100, Math.round((step.count / step.capacity) * 100)) : 0
                  const barColor = step.status === 'optimal' ? '#16a34a' : step.status === 'warning' ? '#d97706' : '#dc2626'
                  const badgeBg  = step.status === 'optimal' ? '#f0fdf4' : step.status === 'warning' ? '#fffbeb' : '#fef2f2'
                  const badgeTxt = step.status === 'optimal' ? '#15803d' : step.status === 'warning' ? '#92400e' : '#dc2626'
                  const badgeLabel = step.status === 'optimal' ? 'Optimal' : step.status === 'warning' ? 'Elevated' : 'Critical'
                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 font-semibold text-sm text-slate-700">{step.name}</td>
                      <td className="py-3.5 text-sm font-bold text-slate-800">{step.count}</td>
                      <td className="py-3.5 text-sm text-slate-500">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${fillPct}%`, background: barColor }} />
                          </div>
                          <span className="text-xs font-semibold" style={{ color: barColor }}>{fillPct}%</span>
                        </div>
                      </td>
                      <td className="py-3.5 text-sm text-slate-600 font-medium">{step.waitTime}</td>
                      <td className="py-3.5">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: badgeBg, color: badgeTxt }}>
                          {badgeLabel}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <div className="text-center flex flex-col items-center">
              <Activity size={32} className="mb-3 text-slate-300 animate-pulse" />
              <p>Fetching real-time data...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
