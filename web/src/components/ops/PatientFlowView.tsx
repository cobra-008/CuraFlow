import { Activity, ArrowRight, UserCheck, Clock, CheckCircle } from 'lucide-react'

export function PatientFlowView() {
  const steps = [
    { name: 'Triage', count: 12, waitTime: '15m', status: 'optimal' },
    { name: 'Consultation', count: 8, waitTime: '45m', status: 'warning' },
    { name: 'Diagnostics', count: 15, waitTime: '90m', status: 'critical' },
    { name: 'Treatment', count: 6, waitTime: '30m', status: 'optimal' },
    { name: 'Discharge', count: 10, waitTime: '20m', status: 'optimal' }
  ]

  return (
    <div className="p-6 h-full flex flex-col gap-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      <header className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Patient Flow Analysis</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time tracking of patient journeys through departments</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-medium flex items-center gap-2 border border-blue-100 shadow-sm">
            <Activity size={18} />
            <span>Total Patients: 142</span>
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
                {idx === 0 ? <UserCheck size={18} /> : idx === steps.length - 1 ? <CheckCircle size={18} /> : <Activity size={18} />}
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
      </div>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-slate-700 mb-6 text-lg">Flow Efficiency Trends</h3>
        <div className="h-full flex items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <div className="text-center">
            <Activity size={32} className="mx-auto mb-3 text-slate-300" />
            <p>Real-time flow visualization map</p>
            <p className="text-xs mt-1">Connecting to tracking systems...</p>
          </div>
        </div>
      </div>
    </div>
  )
}
