import { useState, useEffect } from 'react'
import { Activity, AlertTriangle, ArrowRight, BrainCircuit, Users, BedDouble } from 'lucide-react'
import clsx from 'clsx'
import { useStore } from '../../store'

export function SimulationEngine() {
  const [erPatients, setErPatients] = useState(15)
  const [bedsAvailable, setBedsAvailable] = useState(30)
  const [prob, setProb] = useState(0)
  const [loading, setLoading] = useState(false)

  const generatePipeline = useStore(s => s.generatePipeline)
  const setActiveView = useStore(s => s.setActiveView)
  const setPrompt = useStore(s => s.setPrompt)

  useEffect(() => {
    const timer = setTimeout(() => {
      runSimulation()
    }, 300)
    return () => clearTimeout(timer)
  }, [erPatients, bedsAvailable])

  const runSimulation = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('hospilot_token')
      const res = await fetch('/api/hospital/predict_and_escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          er_override: erPatients,
          beds_override: bedsAvailable
        })
      })
      const data = await res.json()
      if (data.surge_probability !== undefined) {
        setProb(data.surge_probability)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleEscalate = () => {
    setPrompt(`CRITICAL: Surge probability is ${Math.round(prob * 100)}% with ${erPatients} ER patients and ${bedsAvailable} beds available. Allocate resources immediately.`)
    setActiveView('orchestrator')
    generatePipeline()
  }

  const isSurge = prob > 0.75

  return (
    <div className="bg-[#101726] border border-white/5 rounded-2xl p-6 shadow-xl mb-8 relative overflow-hidden">
      {/* Background Heatmap Effect */}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none transition-colors duration-1000"
        style={{
          background: `radial-gradient(circle at 80% 50%, ${isSurge ? '#ef4444' : prob > 0.4 ? '#f59e0b' : '#3b82f6'}, transparent 60%)`
        }}
      />

      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
          <BrainCircuit size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">"What-If" Simulation Engine</h2>
          <p className="text-xs text-slate-400 font-medium">RL Predictive Forecasting Model</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
        
        {/* Sliders */}
        <div className="lg:col-span-2 space-y-8 bg-white/5 p-6 rounded-2xl border border-white/5 backdrop-blur-sm">
          <div>
            <div className="flex justify-between items-center mb-4">
              <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Users size={16} className="text-amber-400" /> ER Patient Load
              </label>
              <span className="text-amber-400 font-bold bg-amber-400/10 px-3 py-1 rounded-full text-xs">
                {erPatients} Patients
              </span>
            </div>
            <input 
              type="range" min="0" max="150" 
              value={erPatients} onChange={e => setErPatients(parseInt(e.target.value))}
              className="w-full accent-amber-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <BedDouble size={16} className="text-blue-400" /> Available ICU/Ward Beds
              </label>
              <span className="text-blue-400 font-bold bg-blue-400/10 px-3 py-1 rounded-full text-xs">
                {bedsAvailable} Beds
              </span>
            </div>
            <input 
              type="range" min="0" max="100" 
              value={bedsAvailable} onChange={e => setBedsAvailable(parseInt(e.target.value))}
              className="w-full accent-blue-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Results Panel */}
        <div className={clsx(
          "p-6 rounded-2xl border flex flex-col justify-between transition-all duration-500",
          isSurge ? "bg-red-500/10 border-red-500/30" : "bg-emerald-500/10 border-emerald-500/20"
        )}>
          <div>
            <div className="text-sm text-slate-400 font-medium mb-1">Predicted Bottleneck</div>
            <div className="flex items-end gap-3 mb-4">
              <span className={clsx("text-5xl font-black tracking-tighter", isSurge ? "text-red-400" : "text-emerald-400")}>
                {Math.round(prob * 100)}%
              </span>
              <span className="text-slate-500 text-sm font-medium mb-2 uppercase">Risk Score</span>
            </div>
            
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" /> Analyzing...
              </div>
            ) : isSurge ? (
              <div className="flex items-start gap-2 text-red-300 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                <span>Critical surge predicted. Automated orchestration pipeline recommended.</span>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-emerald-300 text-sm bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
                <Activity size={16} className="flex-shrink-0 mt-0.5" />
                <span>Hospital capacity stable. No immediate escalations required.</span>
              </div>
            )}
          </div>

          <button
            disabled={!isSurge}
            onClick={handleEscalate}
            className={clsx(
              "w-full mt-6 py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all",
              isSurge 
                ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20" 
                : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
            )}
          >
            Deploy AI Task Force <ArrowRight size={16} />
          </button>
        </div>

      </div>
    </div>
  )
}
