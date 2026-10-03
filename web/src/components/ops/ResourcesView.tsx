import { Package, Truck, Layers, Activity } from 'lucide-react'

export function ResourcesView() {
  const inventory = [
    { item: 'Ventilators', total: 45, inUse: 42, status: 'critical' },
    { item: 'Portable X-Ray', total: 12, inUse: 10, status: 'warning' },
    { item: 'Infusion Pumps', total: 150, inUse: 90, status: 'optimal' },
    { item: 'Defibrillators', total: 30, inUse: 15, status: 'optimal' },
    { item: 'Dialysis Machines', total: 20, inUse: 18, status: 'warning' }
  ]

  return (
    <div className="p-6 h-full flex flex-col gap-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      <header className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Resources & Allocation</h1>
          <p className="text-sm text-slate-500 mt-1">Medical equipment tracking and supply chain</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg font-medium flex items-center gap-2 border border-emerald-100 shadow-sm">
            <Truck size={18} />
            <span>Deliveries on track</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Package className="text-slate-600" size={20} />
            Critical Equipment Inventory
          </h2>
          
          <div className="space-y-4">
            {inventory.map((inv, idx) => {
              const utilPct = Math.round((inv.inUse / inv.total) * 100)
              const colorClass = inv.status === 'critical' ? 'bg-red-500' : inv.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
              const textClass = inv.status === 'critical' ? 'text-red-600' : inv.status === 'warning' ? 'text-amber-600' : 'text-emerald-600'
              
              return (
                <div key={idx} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-slate-700">{inv.item}</span>
                    <span className={`text-sm font-bold ${textClass}`}>{utilPct}% Utilized</span>
                  </div>
                  <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden mb-2">
                    <div className={`h-full ${colorClass} rounded-full`} style={{ width: `${utilPct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 font-medium">
                    <span>{inv.inUse} In Use</span>
                    <span>{inv.total} Total</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Layers className="text-slate-600" size={20} />
            Supply Chain Insights
          </h2>
          <div className="flex-1 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 p-8 text-center space-y-4">
            <Activity size={32} className="text-slate-300" />
            <div>
              <p className="font-medium text-slate-500">Resource allocation is currently stable.</p>
              <p className="text-sm mt-1">Predictive models show no immediate shortages for the next 48 hours.</p>
            </div>
            <button className="mt-4 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
              View Detailed Ledger
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
