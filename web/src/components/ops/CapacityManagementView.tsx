import { Bed, Users, TrendingUp, AlertTriangle } from 'lucide-react'

export function CapacityManagementView() {
  const wards = [
    { name: 'Intensive Care Unit', total: 40, occupied: 38, type: 'critical' },
    { name: 'General Ward A', total: 120, occupied: 95, type: 'normal' },
    { name: 'General Ward B', total: 100, occupied: 82, type: 'normal' },
    { name: 'Pediatrics', total: 50, occupied: 30, type: 'normal' },
    { name: 'Maternity', total: 60, occupied: 45, type: 'normal' },
    { name: 'Emergency Observation', total: 30, occupied: 28, type: 'warning' },
  ]

  return (
    <div className="p-6 h-full flex flex-col gap-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      <header className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Capacity Management</h1>
          <p className="text-sm text-slate-500 mt-1">Bed availability and ward utilization</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-medium flex items-center gap-2 border border-indigo-100 shadow-sm">
            <Bed size={18} />
            <span>Total Beds: 400</span>
          </div>
          <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg font-medium flex items-center gap-2 border border-emerald-100 shadow-sm">
            <Users size={18} />
            <span>Available: 82</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {wards.map((ward, i) => {
          const utilPct = Math.round((ward.occupied / ward.total) * 100)
          const isHigh = utilPct > 85
          const isCrit = utilPct > 95
          
          return (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">{ward.name}</h3>
                  <p className="text-xs text-slate-400 font-medium tracking-wider uppercase mt-1">{ward.total} Total Beds</p>
                </div>
                <div className={`p-2 rounded-lg ${isCrit ? 'bg-red-50 text-red-600' : isHigh ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {isCrit ? <AlertTriangle size={20} /> : <TrendingUp size={20} />}
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between items-end mb-2">
                  <div className="text-3xl font-black text-slate-800 tracking-tight">{utilPct}%</div>
                  <div className="text-sm font-medium text-slate-500 mb-1">{ward.occupied} occupied</div>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${isCrit ? 'bg-red-500' : isHigh ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${utilPct}%` }}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center text-sm pt-4 border-t border-slate-50">
                <span className="text-slate-500">Available Beds</span>
                <span className={`font-bold ${isCrit ? 'text-red-600' : 'text-slate-700'}`}>{ward.total - ward.occupied}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
