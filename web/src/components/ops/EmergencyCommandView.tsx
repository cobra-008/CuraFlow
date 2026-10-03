import { AlertTriangle, ShieldAlert, Radio, PhoneCall } from 'lucide-react'

export function EmergencyCommandView() {
  return (
    <div className="p-6 h-full flex flex-col gap-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      <header className="flex justify-between items-center bg-red-50 p-5 rounded-2xl shadow-sm border border-red-100">
        <div>
          <h1 className="text-2xl font-bold text-red-900">Emergency Command</h1>
          <p className="text-sm text-red-700 mt-1">Disaster response and mass casualty incident management</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm animate-pulse">
            <Radio size={18} />
            <span>STANDBY MODE</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <ShieldAlert className="text-red-500" size={20} />
            Active Incident Feed
          </h2>
          <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200 p-6 flex flex-col items-center justify-center text-center">
            <AlertTriangle size={48} className="text-slate-300 mb-4" />
            <h3 className="text-slate-600 font-semibold mb-1">No Active Incidents</h3>
            <p className="text-slate-400 text-sm max-w-md">The hospital is operating under normal protocols. In the event of a mass casualty or external disaster, this feed will populate with real-time dispatch and resource routing data.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4">
          <h2 className="text-lg font-bold text-slate-800 mb-2">Quick Actions</h2>
          
          <button className="w-full flex items-center gap-3 bg-red-50 hover:bg-red-100 text-red-700 p-4 rounded-xl transition-colors border border-red-100 font-semibold text-left">
            <div className="bg-white p-2 rounded-lg shadow-sm"><AlertTriangle size={20} className="text-red-600" /></div>
            Initiate Code Triage
          </button>
          
          <button className="w-full flex items-center gap-3 bg-amber-50 hover:bg-amber-100 text-amber-700 p-4 rounded-xl transition-colors border border-amber-100 font-semibold text-left">
            <div className="bg-white p-2 rounded-lg shadow-sm"><ShieldAlert size={20} className="text-amber-600" /></div>
            Activate Surge Capacity
          </button>
          
          <button className="w-full flex items-center gap-3 bg-blue-50 hover:bg-blue-100 text-blue-700 p-4 rounded-xl transition-colors border border-blue-100 font-semibold text-left">
            <div className="bg-white p-2 rounded-lg shadow-sm"><PhoneCall size={20} className="text-blue-600" /></div>
            Broadcast Staff Recall
          </button>

        </div>

      </div>
    </div>
  )
}
