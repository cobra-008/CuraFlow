import { Activity, ArrowRight, UserCheck, Clock, CheckCircle, AlertTriangle } from 'lucide-react'
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
        <div className="flex justify-between items-center mb-8">
          <h3 className="font-semibold text-slate-700 text-lg">Live Pipeline Saturation</h3>
          <span className="text-xs font-medium bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /> Live Updating</span>
        </div>
        
        {state ? (
          <div className="flex-1 w-full flex items-center justify-between relative px-10 py-12 bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
            {/* Connecting line background */}
            <div className="absolute top-1/2 left-12 right-12 h-2 bg-slate-200 -translate-y-1/2 rounded-full z-0" />
            
            {/* The Nodes */}
            {steps.map((step, idx) => {
              const fillPct = step.capacity > 0 ? Math.min(100, Math.max(5, (step.count / step.capacity) * 100)) : 0
              const isCrit = step.status === 'critical'
              const isWarn = step.status === 'warning'
              const colorCls = isCrit ? 'text-red-500 stroke-red-500' : isWarn ? 'text-amber-500 stroke-amber-500' : 'text-emerald-500 stroke-emerald-500'
              const shadowCls = isCrit ? 'shadow-red-500/40' : isWarn ? 'shadow-amber-500/30' : 'shadow-emerald-500/20'
              
              return (
                <div key={idx} className="relative z-10 flex flex-col items-center group">
                  <div className={`w-[90px] h-[90px] bg-white border-[6px] border-white rounded-full shadow-lg ${shadowCls} flex items-center justify-center relative transition-shadow duration-500 ${isCrit ? 'animate-pulse' : ''}`}>
                    {/* Ring progress */}
                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                      <circle cx="50%" cy="50%" r="38" className="fill-none stroke-slate-100" strokeWidth="6" />
                      <circle cx="50%" cy="50%" r="38" className={`fill-none ${colorCls}`} strokeWidth="6" strokeDasharray="239" strokeDashoffset={239 - (239 * fillPct) / 100} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease-in-out' }} />
                    </svg>
                    <span className="font-bold text-slate-800 text-xl relative z-10">{step.count}</span>
                  </div>
                  
                  <div className="absolute top-28 flex flex-col items-center w-40">
                    <div className="font-bold text-slate-700 text-[13px] text-center">{step.name}</div>
                    <div className={`text-[11px] font-semibold mt-1 ${colorCls.split(' ')[0]}`}>{fillPct.toFixed(0)}% CAPACITY</div>
                    {isCrit && <div className="text-[10px] uppercase font-bold text-white bg-red-500 px-2 py-0.5 rounded-full mt-2 flex items-center gap-1"><AlertTriangle size={10} /> Bottleneck</div>}
                  </div>
                </div>
              )
            })}
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

