import { BarChart3, Download, Calendar, Filter } from 'lucide-react'

export function ReportsView() {
  return (
    <div className="p-6 h-full flex flex-col gap-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      <header className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reports & Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Operational metrics and historical performance</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white text-slate-700 px-4 py-2 rounded-lg font-medium flex items-center gap-2 border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors">
            <Calendar size={18} />
            <span>Last 30 Days</span>
          </button>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm hover:bg-blue-700 transition-colors">
            <Download size={18} />
            <span>Export Report</span>
          </button>
        </div>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col flex-1">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="text-blue-500" size={20} />
            Key Performance Indicators
          </h2>
          <button className="text-slate-500 hover:text-slate-700 p-2"><Filter size={18} /></button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {['Avg ER Wait Time', 'ICU Utilization', 'Discharge Efficiency', 'Staff Overtime'].map((metric, i) => (
            <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="text-sm font-medium text-slate-500 mb-1">{metric}</div>
              <div className="text-2xl font-bold text-slate-800">
                {i === 0 ? '42 min' : i === 1 ? '87%' : i === 2 ? '94%' : '12 hrs'}
              </div>
              <div className={`text-xs font-medium mt-2 ${i === 1 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {i === 1 ? '+2.4% vs last month' : '-5.1% vs last month'}
              </div>
            </div>
          ))}
        </div>

        <div className="flex-1 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
          <BarChart3 size={48} className="text-slate-300 mb-3" />
          <p className="font-medium text-slate-500">Analytics Engine Initializing...</p>
          <p className="text-sm mt-1 text-center max-w-sm">Historical charts and deep-dive operational analytics will be rendered here once the data pipeline completes syncing.</p>
        </div>
      </div>
    </div>
  )
}
