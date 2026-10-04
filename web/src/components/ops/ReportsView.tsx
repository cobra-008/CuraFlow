import { BarChart3, Download, Calendar, Filter, Activity, Clock, Zap } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

const throughputData = [
  { day: 'Mon', waitTime: 45, target: 40 },
  { day: 'Tue', waitTime: 38, target: 40 },
  { day: 'Wed', waitTime: 52, target: 40 },
  { day: 'Thu', waitTime: 35, target: 40 },
  { day: 'Fri', waitTime: 65, target: 40 },
  { day: 'Sat', waitTime: 48, target: 40 },
  { day: 'Sun', waitTime: 42, target: 40 },
]

const capacityData = [
  { time: '08:00', icu: 85, ward: 72 },
  { time: '12:00', icu: 92, ward: 78 },
  { time: '16:00', icu: 98, ward: 85 },
  { time: '20:00', icu: 90, ward: 82 },
  { time: '00:00', icu: 88, ward: 79 },
  { time: '04:00', icu: 86, ward: 75 },
]

const aiImpactData = [
  { date: 'Oct 1', manual: 120, automated: 45 },
  { date: 'Oct 2', manual: 110, automated: 60 },
  { date: 'Oct 3', manual: 95, automated: 85 },
  { date: 'Oct 4', manual: 85, automated: 110 },
  { date: 'Oct 5', manual: 70, automated: 135 },
]

export function ReportsView() {
  return (
    <div className="p-6 min-h-full flex flex-col gap-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      <header className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-gray-100 shrink-0">
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

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col flex-1 overflow-y-auto">
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

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          
          {/* Chart 1: Daily ER Wait Times vs Target */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-700 flex items-center gap-2"><Clock size={16} className="text-blue-500" /> ER Wait Times vs SLA</h3>
              <span className="text-xs font-semibold px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md">On Track</span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={throughputData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                  <Bar dataKey="waitTime" name="Actual Wait (min)" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
                  <Bar dataKey="target" name="SLA Target" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Real-time Capacity Pressure */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-700 flex items-center gap-2"><Activity size={16} className="text-rose-500" /> Capacity Saturation Trend</h3>
              <span className="text-xs font-semibold px-2 py-1 bg-rose-100 text-rose-700 rounded-md">Critical ICU</span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={capacityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIcu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorWard" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                  <Area type="monotone" dataKey="icu" name="ICU Occupancy %" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorIcu)" />
                  <Area type="monotone" dataKey="ward" name="Ward Occupancy %" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorWard)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: CuraFlow Automation Impact */}
          <div className="xl:col-span-2 bg-slate-900 border border-slate-800 shadow-xl shadow-slate-900/10 rounded-xl p-6 text-white mt-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2"><Zap size={18} className="text-amber-400" /> CuraFlow Orchestration Impact</h3>
                <p className="text-xs text-slate-400 mt-1">Manual coordinator interventions vs AI-automated task assignments</p>
              </div>
              <div className="text-left md:text-right bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                <div className="text-2xl font-black text-emerald-400">65%</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mt-0.5">Automation Rate</div>
              </div>
            </div>
            <div className="h-72 relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={aiImpactData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAuto" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <Tooltip 
                    cursor={{ stroke: '#475569', strokeWidth: 1, strokeDasharray: '4 4' }} 
                    contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155', color: '#f8fafc' }} 
                    itemStyle={{ color: '#e2e8f0', fontSize: '13px' }} 
                    labelStyle={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '13px', paddingTop: '20px' }} />
                  <Area type="monotone" dataKey="manual" name="Manual Tasks" stroke="#64748b" strokeWidth={2} fill="transparent" />
                  <Area type="monotone" dataKey="automated" name="AI-Automated Tasks" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorAuto)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  )
}
