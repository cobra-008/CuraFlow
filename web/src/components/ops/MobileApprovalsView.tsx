import { Check, X, Stethoscope } from 'lucide-react'
import { type Recommendation } from '../../services/opsApi'

export function MobileApprovalsView({ recommendations }: { recommendations: Recommendation[] }) {
  const pending = recommendations.filter(r => r.status === 'pending')

  if (pending.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
          <Check className="text-emerald-500" size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-800">All Caught Up!</h2>
        <p className="text-slate-500 mt-2">No pending clinical or operational approvals require your attention.</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col gap-6 max-w-md mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
      <header className="flex justify-between items-center mb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Approvals</h1>
          <p className="text-sm text-slate-500 mt-1">{pending.length} tasks require action</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto space-y-4 pb-10">
        {pending.map((rec) => (
          <div key={rec.id} className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden relative">
            
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <span className="px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-bold rounded-lg flex items-center gap-1.5 uppercase tracking-wider">
                  <Stethoscope size={12} /> Clinical
                </span>
                <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                  rec.priority === 'critical' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  {rec.priority.toUpperCase()}
                </span>
              </div>
              
              <h3 className="font-bold text-slate-800 text-lg mb-2 leading-tight">{rec.title}</h3>
              <p className="text-sm text-slate-600 line-clamp-3 mb-4">{rec.summary}</p>
              
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-xs text-slate-500 font-semibold mb-1">AI Recommendation Context:</p>
                <ul className="text-xs text-slate-600 space-y-1 pl-4 list-disc">
                  <li>Current vitals stable.</li>
                  <li>Bed shortage in ICU step-down.</li>
                </ul>
              </div>
            </div>

            {/* Mobile swipe-like action buttons */}
            <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100">
              <button className="py-4 flex flex-col items-center justify-center text-red-500 hover:bg-red-50 transition-colors font-semibold">
                <X size={24} className="mb-1" /> Reject
              </button>
              <button className="py-4 flex flex-col items-center justify-center text-emerald-500 hover:bg-emerald-50 transition-colors font-semibold">
                <Check size={24} className="mb-1" /> Approve
              </button>
            </div>
            
          </div>
        ))}
      </div>
    </div>
  )
}
