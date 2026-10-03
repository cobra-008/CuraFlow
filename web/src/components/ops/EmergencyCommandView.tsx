import { useState, useEffect } from "react"
import { AlertTriangle, Clock, Ambulance, BedDouble, Activity, Users, Flame, ShieldAlert, ArrowRight } from "lucide-react"

interface TriagePatient {
  id: string
  name: string
  age: number
  gender: string
  complaint: string
  esiLevel: 1 | 2 | 3 | 4 | 5
  waitTimeMin: number
  status: "waiting" | "triage" | "treatment"
}

interface AmbulanceArrival {
  id: string
  unit: string
  etaMin: number
  type: string
  acuity: "high" | "medium" | "low"
}

export function EmergencyCommandView() {
  const [patients, setPatients] = useState<TriagePatient[]>([
    { id: "e1", name: "Ravi S.", age: 54, gender: "M", complaint: "Severe chest pain, diaphoresis", esiLevel: 1, waitTimeMin: 0, status: "treatment" },
    { id: "e2", name: "Anjali K.", age: 29, gender: "F", complaint: "Motor vehicle accident, head trauma", esiLevel: 2, waitTimeMin: 5, status: "triage" },
    { id: "e3", name: "Mohammed A.", age: 62, gender: "M", complaint: "Shortness of breath, COPD exac.", esiLevel: 2, waitTimeMin: 12, status: "waiting" },
    { id: "e4", name: "Priya M.", age: 41, gender: "F", complaint: "Abdominal pain, suspected appendicitis", esiLevel: 3, waitTimeMin: 35, status: "waiting" },
    { id: "e5", name: "Sunil V.", age: 19, gender: "M", complaint: "Ankle sprain", esiLevel: 4, waitTimeMin: 65, status: "waiting" },
    { id: "e6", name: "Geeta R.", age: 33, gender: "F", complaint: "Mild allergic reaction", esiLevel: 5, waitTimeMin: 80, status: "waiting" },
  ])

  const [ambulances, setAmbulances] = useState<AmbulanceArrival[]>([
    { id: "a1", unit: "Medic 14", etaMin: 4, type: "Cardiac Arrest", acuity: "high" },
    { id: "a2", unit: "Rescue 9", etaMin: 12, type: "Blunt Trauma", acuity: "high" },
    { id: "a3", unit: "BLS 22", etaMin: 25, type: "Elderly Fall", acuity: "medium" },
  ])

  const esiColors = {
    1: { bg: "#fef2f2", text: "#dc2626", border: "#fecaca", label: "Level 1: Resuscitation" },
    2: { bg: "#fff7ed", text: "#ea580c", border: "#fed7aa", label: "Level 2: Emergent" },
    3: { bg: "#fef9c3", text: "#ca8a04", border: "#fde047", label: "Level 3: Urgent" },
    4: { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0", label: "Level 4: Less Urgent" },
    5: { bg: "#f1f5f9", text: "#64748b", border: "#e2e8f0", label: "Level 5: Non-Urgent" },
  }

  // Update wait times every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setPatients(prev => prev.map(p => ({ ...p, waitTimeMin: p.waitTimeMin + 1 })))
      setAmbulances(prev => prev.map(a => ({ ...a, etaMin: Math.max(0, a.etaMin - 1) })))
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="p-6 h-full flex flex-col gap-6 overflow-y-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ER Coordinator & Triage</h1>
          <p className="text-sm text-slate-500 mt-1">Manage inflow, severity triage, and bottleneck resolution</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 border border-slate-200">
            <Users size={16} className="text-blue-600" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Waiting</span>
              <span className="text-sm font-bold text-slate-800">{patients.filter(p => p.status === "waiting").length} Patients</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 border border-slate-200">
            <Clock size={16} className="text-orange-600" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Avg Wait (L3)</span>
              <span className="text-sm font-bold text-slate-800">42 mins</span>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 flex-1">
        
        {/* Triage Board */}
        <div className="xl:col-span-2 flex flex-col gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Activity className="text-blue-600" size={20} />
                ESI Triage Board
              </h2>
              <button className="text-sm font-bold text-blue-600 hover:text-blue-800">New Patient Entry</button>
            </div>
            
            <div className="space-y-3 overflow-y-auto pr-1" style={{ maxHeight: "calc(100vh - 280px)" }}>
              {patients.sort((a, b) => a.esiLevel - b.esiLevel || b.waitTimeMin - a.waitTimeMin).map(p => (
                <div key={p.id} className="flex flex-wrap md:flex-nowrap items-center gap-4 p-4 rounded-xl border transition-all" style={{ background: esiColors[p.esiLevel].bg, borderColor: esiColors[p.esiLevel].border }}>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#fff", color: esiColors[p.esiLevel].text, border: `2px solid ${esiColors[p.esiLevel].text}` }}>
                    <span className="font-black text-xl">{p.esiLevel}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-800 flex items-center gap-2">
                      {p.name} <span className="text-xs font-normal text-slate-500">{p.age}y {p.gender}</span>
                    </div>
                    <div className="text-sm font-semibold mt-0.5" style={{ color: esiColors[p.esiLevel].text }}>
                      {p.complaint}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200">
                      <Clock size={12} className={p.waitTimeMin > 60 ? "text-red-500" : "text-slate-500"} />
                      <span className={`text-xs font-bold ${p.waitTimeMin > 60 ? "text-red-600" : "text-slate-700"}`}>{p.waitTimeMin}m wait</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white" style={{ color: p.status === 'treatment' ? '#16a34a' : p.status === 'triage' ? '#ea580c' : '#64748b' }}>
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar: Ambulances & Bed Heatmap */}
        <div className="flex flex-col gap-6">
          
          {/* Ambulance Tracker */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Ambulance className="text-red-500" size={20} />
              Incoming EMS
            </h2>
            <div className="space-y-3">
              {ambulances.map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-10 rounded-full ${a.acuity === 'high' ? 'bg-red-500' : 'bg-amber-500'}`} />
                    <div>
                      <div className="font-bold text-slate-800 text-sm">{a.unit}</div>
                      <div className="text-xs font-semibold text-red-600 mt-0.5">{a.type}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-slate-800">{a.etaMin}m</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">ETA</div>
                  </div>
                </div>
              ))}
              {ambulances.length === 0 && (
                <div className="text-center p-4 text-sm text-slate-500">No incoming EMS reported</div>
              )}
            </div>
          </div>

          {/* Bed Availability Heatmap */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex-1">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <BedDouble className="text-purple-600" size={20} />
              ER Bed Availability
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-red-200 bg-red-50 flex flex-col justify-between">
                <span className="text-xs font-bold text-red-800 uppercase">Resuscitation (L1)</span>
                <div className="flex items-end justify-between mt-2">
                  <span className="text-2xl font-black text-red-600">0/2</span>
                  <span className="text-[10px] font-bold bg-red-200 text-red-800 px-1.5 py-0.5 rounded">FULL</span>
                </div>
              </div>
              <div className="p-3 rounded-xl border border-orange-200 bg-orange-50 flex flex-col justify-between">
                <span className="text-xs font-bold text-orange-800 uppercase">Trauma / Acute (L2)</span>
                <div className="flex items-end justify-between mt-2">
                  <span className="text-2xl font-black text-orange-600">1/4</span>
                  <span className="text-[10px] font-bold bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded">1 AVAIL</span>
                </div>
              </div>
              <div className="p-3 rounded-xl border border-yellow-200 bg-yellow-50 flex flex-col justify-between">
                <span className="text-xs font-bold text-yellow-800 uppercase">Urgent (L3)</span>
                <div className="flex items-end justify-between mt-2">
                  <span className="text-2xl font-black text-yellow-600">3/10</span>
                  <span className="text-[10px] font-bold bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded">3 AVAIL</span>
                </div>
              </div>
              <div className="p-3 rounded-xl border border-green-200 bg-green-50 flex flex-col justify-between">
                <span className="text-xs font-bold text-green-800 uppercase">Fast Track (L4-5)</span>
                <div className="flex items-end justify-between mt-2">
                  <span className="text-2xl font-black text-green-600">5/8</span>
                  <span className="text-[10px] font-bold bg-green-200 text-green-800 px-1.5 py-0.5 rounded">OPEN</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
