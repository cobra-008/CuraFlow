import { useState, useEffect, useCallback } from "react"
import { User, Clock, ClipboardList, BellRing, CheckCircle2, LogOut, Stethoscope, ChevronDown, ChevronUp, X, AlertTriangle, FileText, Activity, Pill } from "lucide-react"
import { useStore } from "../../store"

function SyringeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <polyline points="7 6 8.5 10 12 12 10 8.5 6 7 7 6" />
      <path d="M11 11l4 4" />
      <path d="M17 7l-1 1" />
      <path d="M16 2l6 6" />
      <path d="M2 22l4.5-4.5" />
    </svg>
  )
}

export interface DoctorPatient {
  id: string
  name: string
  age: number
  gender: "M" | "F" | "Other"
  problem: string
  medicalHistory: string
  allergies?: string[]
  vitals?: { bp: string, hr: number, temp: number, spo2: number }
  appointmentTime: string
  ward: string
  room?: string
  bed?: string
  nurseNote?: string
  nurseNoteAt?: string
  status: string
  nurseCalled?: boolean
}

import { opsApi } from '../../services/opsApi'
import { PendingTasksPanel } from './PendingTasksPanel'


// ── Doctor Status Badge ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string, bg: string, color: string, border: string }> = {
    waiting: { label: "Waiting", bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
    "in-progress": { label: "In Progress", bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
    done: { label: "Done", bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
    discharged: { label: "Discharged", bg: "#f1f5f9", color: "#64748b", border: "#e2e8f0" },
    admitted: { label: "Admitted", bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  }
  const s = map[(status || '').toLowerCase()] || { label: status || 'Unknown', bg: "#f1f5f9", color: "#64748b", border: "#e2e8f0" }
  return <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border" style={{ background: s.bg, color: s.color, borderColor: s.border }}>{s.label}</span>
}

function PatientCard({ patient, onCallNurse, onStatusChange, onDismissDischarge }: {
  patient: DoctorPatient
  onCallNurse: (id: string) => void
  onStatusChange: (id: string, status: string) => void
  onDismissDischarge: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isDischarged = patient.status === "discharged"
  return (
    <div className="rounded-2xl border transition-all duration-300" style={{ background: isDischarged ? "#f8fafc" : "#ffffff", borderColor: isDischarged ? "#e2e8f0" : patient.nurseNote ? "#bfdbfe" : "#e8e1d4", boxShadow: isDischarged ? "none" : "0 1px 6px rgba(0,0,0,0.05)", opacity: isDischarged ? 0.7 : 1 }}>
      <div className="flex items-center gap-3 px-5 py-4 flex-wrap">
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#dbeafe" }}>
          <User size={18} style={{ color: "#1e40af" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm leading-tight" style={{ color: "#1a2744" }}>
            {patient.name}
            <span className="ml-2 text-xs font-normal" style={{ color: "#8c7e6a" }}>{patient.age} yrs · {patient.gender} · {patient.ward} {patient.room ? `· Rm ${patient.room}-${patient.bed}` : ''}</span>
          </div>
          {patient.allergies && patient.allergies.length > 0 && (
            <div className="flex gap-1 mt-1 mb-0.5">
              {patient.allergies.map(a => (
                <span key={a} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-100 flex items-center gap-0.5">
                  <AlertTriangle size={10} /> {a}
                </span>
              ))}
            </div>
          )}
          <div className="text-xs mt-0.5 font-medium" style={{ color: "#dc4a00" }}>{patient.problem}</div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl flex-shrink-0" style={{ background: "#fef3c7", border: "1px solid #fde68a" }}>
          <Clock size={13} style={{ color: "#b45309" }} />
          <span className="text-xs font-bold" style={{ color: "#92400e" }}>{patient.appointmentTime}</span>
        </div>
        <StatusBadge status={patient.status} />
        {!isDischarged && (
          <button onClick={() => onCallNurse(patient.id)} title="Call Nurse" className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-xs transition-all" style={{ background: patient.nurseCalled ? "#f0fdf4" : "#eff6ff", color: patient.nurseCalled ? "#16a34a" : "#1d4ed8", border: `1px solid ${patient.nurseCalled ? "#bbf7d0" : "#bfdbfe"}` }}>
            <SyringeIcon size={15} />
            {patient.nurseCalled ? "Called" : "Call Nurse"}
          </button>
        )}
        {isDischarged && (
          <button onClick={() => onDismissDischarge(patient.id)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0" title="Remove discharged patient">
            <X size={15} style={{ color: "#94a3b8" }} />
          </button>
        )}
        <button onClick={() => setExpanded(e => !e)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
      {patient.nurseNote && !isDischarged && (
        <div className="mx-5 mb-3 flex items-start gap-2 px-3 py-2.5 rounded-xl" style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}>
          <BellRing size={14} style={{ color: "#1d4ed8", flexShrink: 0, marginTop: 1 }} />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold" style={{ color: "#1e40af" }}>Nurse Update</span>
            {patient.nurseNoteAt && <span className="ml-1.5 text-[11px]" style={{ color: "#93c5fd" }}>at {patient.nurseNoteAt}</span>}
            <div className="text-xs mt-0.5" style={{ color: "#1e3a8a" }}>{patient.nurseNote}</div>
          </div>
        </div>
      )}
      {expanded && (
        <div className="px-5 pb-4 border-t" style={{ borderColor: "#f0e8d8" }}>
          <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl p-4" style={{ background: "#fafaf9", border: "1px solid #e8e1d4" }}>
              <div className="flex items-center gap-1.5 mb-2"><ClipboardList size={14} style={{ color: "#6b5c40" }} /><span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#6b5c40" }}>Medical History</span></div>
              <p className="text-sm leading-relaxed" style={{ color: "#374151" }}>{patient.medicalHistory}</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: "#f0f9ff", border: "1px solid #bae6fd" }}>
              <div className="flex items-center gap-1.5 mb-2"><Activity size={14} style={{ color: "#0369a1" }} /><span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#0369a1" }}>Latest Vitals</span></div>
              {patient.vitals ? (
                <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                  <div><span className="text-slate-500">BP:</span> <strong className={parseInt(patient.vitals.bp) > 130 ? "text-red-600" : ""}>{patient.vitals.bp}</strong></div>
                  <div><span className="text-slate-500">HR:</span> <strong className={patient.vitals.hr > 100 ? "text-red-600" : ""}>{patient.vitals.hr} bpm</strong></div>
                  <div><span className="text-slate-500">Temp:</span> <strong className={patient.vitals.temp > 37.5 ? "text-orange-600" : ""}>{patient.vitals.temp} °C</strong></div>
                  <div><span className="text-slate-500">SpO2:</span> <strong className={patient.vitals.spo2 < 95 ? "text-red-600" : ""}>{patient.vitals.spo2}%</strong></div>
                </div>
              ) : <p className="text-sm text-slate-500">No vitals recorded</p>}
            </div>
            <div className="rounded-xl p-4 md:col-span-2" style={{ background: "#fff8f5", border: "1px solid #fddccc" }}>
              <div className="flex items-center gap-1.5 mb-2"><Stethoscope size={14} style={{ color: "#b45309" }} /><span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#b45309" }}>Current Complaint</span></div>
              <p className="text-sm leading-relaxed" style={{ color: "#374151" }}>{patient.problem}</p>
            </div>
          </div>
          {!isDischarged && (
            <div className="mt-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-t pt-4" style={{ borderColor: "#f0e8d8" }}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold" style={{ color: "#6b5c40" }}>Mark as:</span>
                {(["waiting", "in-progress", "done", "discharged"] as DoctorPatient["status"][]).map(s => (
                  <button key={s} onClick={() => onStatusChange(patient.id, s)} className="text-xs font-bold px-3 py-1.5 rounded-lg border transition-all" style={{ background: patient.status === s ? "#1e3a6e" : "transparent", color: patient.status === s ? "#fff" : "#1a2744", borderColor: "#e0d5c0" }}>
                    {s === "in-progress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border bg-white hover:bg-slate-50 transition-all text-slate-700 border-slate-200">
                  <FileText size={14} className="text-blue-600" /> Order Lab
                </button>
                <button className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border bg-white hover:bg-slate-50 transition-all text-slate-700 border-slate-200">
                  <Pill size={14} className="text-purple-600" /> Prescription
                </button>
                <button onClick={() => onStatusChange(patient.id, "discharged")} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border bg-red-50 hover:bg-red-100 transition-all text-red-700 border-red-200">
                  <LogOut size={14} /> Discharge Order
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function DoctorDashboard() {
  const currentUser = useStore(s => s.currentUser)
  const pushToast = useStore(s => s.pushToast)
  const [patients, setPatients] = useState<any[]>([])
  const [dischargedQueue, setDischargedQueue] = useState<string[]>([])

  const loadPatients = async () => {
    try {
      const res = await opsApi.getPatients()
      setPatients(res.patients)
    } catch (e) {}
  }

  useEffect(() => {
    loadPatients()
    window.addEventListener("curaflow:patients_updated", loadPatients)
    return () => window.removeEventListener("curaflow:patients_updated", loadPatients)
  }, [])

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const { patientId, note, time, status } = e.detail as { patientId: string; note?: string; time?: string; status?: string }
      setPatients(prev => prev.map(p => {
        if (p.id !== patientId) return p
        const updated = { ...p }
        if (note) { updated.nurseNote = note; updated.nurseNoteAt = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) }
        if (time) updated.appointmentTime = time
        if (status) updated.status = status
        return updated
      }))
      pushToast({ severity: "info", title: "Nurse Update Received", message: note || "Patient details updated by nurse." })
    }
    window.addEventListener("curaflow:nurse_update", handler as EventListener)
    return () => window.removeEventListener("curaflow:nurse_update", handler as EventListener)
  }, [pushToast])

  useEffect(() => {
    patients.filter(p => p.status === "discharged").forEach(p => {
      if (!dischargedQueue.includes(p.id)) {
        setDischargedQueue(q => [...q, p.id])
        pushToast({ severity: "info", title: `${p.name} Discharged`, message: "Patient record will be removed in 5 seconds." })
        setTimeout(() => {
          setPatients(prev => prev.filter(x => x.id !== p.id))
          setDischargedQueue(q => q.filter(id => id !== p.id))
        }, 5000)
      }
    })
  }, [patients, dischargedQueue, pushToast])

  const handleCallNurse = useCallback(async (id: string) => {
    setPatients(prev => prev.map(p => p.id === id ? { ...p, nurseCalled: true } : p))
    const patient = patients.find(p => p.id === id)
    pushToast({ severity: "info", title: "Calling Nurse...", message: `Summoning nurse for ${patient?.name ?? "patient"}.` })
    try {
      await opsApi.callNurse(id)
    } catch (e) {
      pushToast({ severity: "critical", title: "Error", message: "Failed to call nurse." })
      setPatients(prev => prev.map(p => p.id === id ? { ...p, nurseCalled: false } : p))
    }
  }, [patients, pushToast])

  const handleStatusChange = useCallback((id: string, status: DoctorPatient["status"]) => {
    setPatients(prev => prev.map(p => p.id === id ? { ...p, status } : p))
  }, [])
  const handleDismissDischarge = useCallback((id: string) => {
    setPatients(prev => prev.filter(p => p.id !== id))
  }, [])

  const activePts = patients.filter(p => p.status !== "discharged")
  const waiting = activePts.filter(p => p.status === "waiting").length
  const inProgress = activePts.filter(p => p.status === "in-progress").length

  return (
    <div className="p-6 lg:p-8 space-y-6" style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-bold text-2xl lg:text-3xl" style={{ color: "#1a2744" }}>Dr. {currentUser?.display_name ?? "Doctor"}'s Dashboard</h1>
          <p className="text-sm mt-1.5 flex items-center gap-2" style={{ color: "#6b5c40" }}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            Today's patient schedule · Click a row to expand details
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}><Clock size={14} style={{ color: "#b45309" }} /><span className="text-xs font-bold" style={{ color: "#92400e" }}>{waiting} Waiting</span></div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}><Stethoscope size={14} style={{ color: "#1d4ed8" }} /><span className="text-xs font-bold" style={{ color: "#1e40af" }}>{inProgress} In Progress</span></div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}><CheckCircle2 size={14} style={{ color: "#16a34a" }} /><span className="text-xs font-bold" style={{ color: "#15803d" }}>{activePts.filter(p => p.status === "done").length} Done</span></div>
        </div>
      </div>

      {/* ── Human-in-the-Loop Agent Task Approvals ────────────────────── */}
      <PendingTasksPanel roleFilter="doctor" title="Doctor & Clinical Task Approvals (HITL)" />

      {dischargedQueue.length > 0 && (

        <div className="flex items-center gap-3 px-5 py-3 rounded-2xl" style={{ background: "#f1f5f9", border: "1px solid #e2e8f0" }}>
          <LogOut size={16} style={{ color: "#64748b" }} />
          <span className="text-sm" style={{ color: "#475569" }}>
            <strong>{patients.filter(p => dischargedQueue.includes(p.id)).map(p => p.name).join(", ")}</strong> discharged — record{dischargedQueue.length > 1 ? "s" : ""} will be removed in 5 seconds.
          </span>
        </div>
      )}
      <div className="space-y-3">
        {activePts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed" style={{ borderColor: "#e0d5c0", background: "#faf7f2" }}>
            <CheckCircle2 size={32} style={{ color: "#a3b8a0" }} className="mb-3" />
            <p className="text-sm font-semibold" style={{ color: "#6b5c40" }}>All patients attended for today</p>
          </div>
        )}
        {activePts.map(p => (
          <PatientCard key={p.id} patient={p} onCallNurse={handleCallNurse} onStatusChange={handleStatusChange} onDismissDischarge={handleDismissDischarge} />
        ))}
      </div>
      <div className="flex items-center gap-4 pt-2 flex-wrap">
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8c7e6a" }}>Legend:</span>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full" style={{ background: "#1d4ed8" }} /><span className="text-[11px]" style={{ color: "#6b5c40" }}>Nurse Update</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full" style={{ background: "#b45309" }} /><span className="text-[11px]" style={{ color: "#6b5c40" }}>Complaint</span></div>
        <span className="text-[11px] ml-auto flex items-center gap-1" style={{ color: "#a09080" }}><SyringeIcon size={12} /> = Call Nurse</span>
      </div>
    </div>
  )
}
