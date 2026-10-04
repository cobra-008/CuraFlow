import { Activity, ArrowRight, UserCheck, Clock, CheckCircle, Zap } from 'lucide-react'
import { useCallback } from 'react'
import { opsApi, type HospitalState } from '../../services/opsApi'
import { useData } from '../../hooks/useData'


function formatWaitTime(patients: number, throughputPerHr: number): string {
  if (patients === 0 || throughputPerHr === 0) return '-'
  
  // Calculate wait time based on throughput instead of a linear multiplier
  const waitHours = patients / throughputPerHr
  
  if (waitHours > 24) return '> 24 hours'
  if (waitHours >= 1) return `${Math.floor(waitHours)}h ${Math.round((waitHours % 1) * 60)}m`
  return `${Math.round(waitHours * 60)}m`
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-pulse h-40">
      <div className="flex justify-between items-start mb-4">
        <div className="h-4 bg-slate-200 rounded w-24"></div>
        <div className="w-8 h-8 bg-slate-200 rounded-lg"></div>
      </div>
      <div className="space-y-4">
        <div className="h-8 bg-slate-200 rounded w-16"></div>
        <div className="h-4 bg-slate-200 rounded w-20"></div>
      </div>
    </div>
  )
}

function SkeletonTable() {
  return (
    <div className="animate-pulse space-y-4 p-4">
      {[1,2,3,4,5].map(i => (
        <div key={i} className="flex gap-4">
          <div className="h-4 bg-slate-200 rounded w-32"></div>
          <div className="h-4 bg-slate-200 rounded w-16"></div>
          <div className="h-4 bg-slate-200 rounded flex-1"></div>
          <div className="h-4 bg-slate-200 rounded w-20"></div>
        </div>
      ))}
    </div>
  )
}

export function PatientFlowView() {
  // Use custom hook with a slower polling interval and visibility checks
  const fetchHospitalState = useCallback(() => opsApi.getHospitalState(), [])
  const { data: state, loading } = useData<HospitalState>(fetchHospitalState, 15000)

  // Pre-calculate derived metrics with realistic throughput bounds
  const steps = state ? [
    { 
      name: 'Triage (ER)', 
      count: state.emergency.waiting, 
      waitTime: formatWaitTime(state.emergency.waiting, 15), // Assumes 15 patients/hr triage throughput
      status: state.emergency.demand_score > 80 ? 'critical' : state.emergency.demand_score > 50 ? 'warning' : 'optimal', 
      capacity: state.emergency.capacity, 
      icon: UserCheck,
      aiAction: state.emergency.waiting > 50 ? 'Divert Level 4/5 to Urgent Care' : null
    },
    { 
      name: 'Diagnostics', 
      count: state.diagnostics.queue_length, 
      waitTime: formatWaitTime(state.diagnostics.queue_length, state.diagnostics.available_devices * 4), // 4 scans/hr per device
      status: state.diagnostics.queue_length > 15 ? 'critical' : state.diagnostics.queue_length > 8 ? 'warning' : 'optimal', 
      capacity: state.diagnostics.total_devices * 3, 
      icon: Activity,
      aiAction: state.diagnostics.queue_length > 30 ? 'Prioritize In-Patient Scans' : null
    },
    { 
      name: 'Treatment (OT)', 
      count: state.operating_rooms.occupied, 
      waitTime: state.operating_rooms.utilization_pct > 80 ? '45m' : '15m', 
      status: state.operating_rooms.utilization_pct > 90 ? 'critical' : state.operating_rooms.utilization_pct > 75 ? 'warning' : 'optimal', 
      capacity: state.operating_rooms.total, 
      icon: Activity,
      aiAction: state.operating_rooms.utilization_pct > 90 ? 'Reschedule Elective Surgeries' : null
    },
    { 
      name: 'ICU', 
      count: state.icu.occupied, 
      waitTime: state.icu.occupancy_pct > 90 ? '120m' : '10m', 
      status: state.icu.occupancy_pct > 85 ? 'critical' : state.icu.occupancy_pct > 70 ? 'warning' : 'optimal', 
      capacity: state.icu.total, 
      icon: Activity,
      aiAction: state.icu.occupancy_pct > 85 ? 'Accelerate Step-Down Transfers' : null
    },
    { 
      name: 'Ward (Beds)', 
      count: state.beds.occupied, 
      waitTime: '-', 
      status: state.beds.occupancy_pct > 90 ? 'critical' : state.beds.occupancy_pct > 80 ? 'warning' : 'optimal', 
      capacity: state.beds.total, 
      icon: CheckCircle,
      aiAction: state.beds.occupancy_pct > 90 ? 'Deploy Discharge Task Force' : null
    }
  ] : []

  const totalPatients = state ? state.emergency.waiting + state.diagnostics.queue_length + state.operating_rooms.occupied + state.icu.occupied + state.beds.occupied : 0

  return (
    <div className="p-6 h-full flex flex-col gap-6 font-sans">
      <header className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Patient Flow Analysis</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time tracking of patient journeys through departments</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-medium flex items-center gap-2 border border-blue-100 shadow-sm">
            <Activity size={18} />
            <span>Total Patients: {loading && !state ? '...' : totalPatients}</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {loading && !state ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : steps.map((step, idx) => (
          <div key={idx} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden group">
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
              <div className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 w-8 h-8 bg-white border border-slate-100 rounded-full items-center justify-center text-slate-300">
                <ArrowRight size={16} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-semibold text-slate-700 text-lg">Department Throughput Summary</h3>
          <span className="text-xs font-medium bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /> Live
          </span>
        </div>

        {loading && !state ? (
          <SkeletonTable />
        ) : (
          <div className="overflow-x-auto overflow-y-auto flex-1">
            <table className="w-full text-left min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Department', 'Current Load', 'Capacity', 'Avg Wait', 'Status', 'AI Insight'].map(h => (
                    <th key={h} className="pb-3 text-xs font-bold uppercase tracking-wider text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {steps.map((step, idx) => {
                  const fillPct = step.capacity > 0 ? Math.min(100, Math.round((step.count / step.capacity) * 100)) : 0
                  
                  // Refactored to Tailwind classes instead of inline styles
                  const isOptimal = step.status === 'optimal'
                  const isWarning = step.status === 'warning'
                  const barColorClass = isOptimal ? 'bg-emerald-600' : isWarning ? 'bg-amber-500' : 'bg-red-600'
                  const pctColorClass = isOptimal ? 'text-emerald-600' : isWarning ? 'text-amber-500' : 'text-red-600'
                  const badgeBgClass = isOptimal ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : isWarning ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'
                  const badgeLabel = isOptimal ? 'Optimal' : isWarning ? 'Elevated' : 'Critical'

                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 font-semibold text-sm text-slate-700">{step.name}</td>
                      <td className="py-3.5 text-sm font-bold text-slate-800">{step.count}</td>
                      <td className="py-3.5 text-sm text-slate-500 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${barColorClass}`} style={{ width: `${fillPct}%` }} />
                          </div>
                          <span className={`text-xs font-semibold ${pctColorClass}`}>{fillPct}%</span>
                        </div>
                      </td>
                      <td className="py-3.5 text-sm text-slate-600 font-medium">{step.waitTime}</td>
                      <td className="py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${badgeBgClass}`}>
                          {badgeLabel}
                        </span>
                      </td>
                      <td className="py-3.5">
                        {step.aiAction ? (
                          <button className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors">
                            <Zap size={12} className="text-indigo-500" /> {step.aiAction}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium italic">No action required</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

