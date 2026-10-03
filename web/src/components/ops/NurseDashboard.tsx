import { useState, useEffect, useCallback } from "react"
import { User, Clock, Send, BellRing, CheckCircle2, AlertTriangle, Edit3, Save, X, ChevronDown, ChevronUp } from "lucide-react"
import { useStore } from "../../store"
import type { DoctorPatient } from "./DoctorDashboard"

// ── Utilities ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = "curaflow_doctor_patients"

function loadPatients(): DoctorPatient[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

// ── Nurse Status Badge ────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: DoctorPatient["status"] }) {
  const map = {
    waiting: { label: "Waiting", bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
    "in-progress": { label: "In Progress", bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
    done: { label: "Done", bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
    discharged: { label: "Discharged", bg: "#f1f5f9", color: "#64748b", border: "#e2e8f0" },
  }
  const s = map[status]
  return <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border" style={{ background: s.bg, color: s.color, borderColor: s.border }}>{s.label}</span>
}

// ── Patient row for Nurse ─────────────────────────────────────────────────────
function NursePatientRow({ patient, nurseCallActive, onSendUpdate, onUpdateTime, onMarkDischarged }: {
  patient: DoctorPatient
  nurseCallActive: boolean
  onSendUpdate: (id: string, note: string) => void
  onUpdateTime: (id: string, time: string) => void
  onMarkDischarged: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(nurseCallActive)
  const [noteText, setNoteText] = useState("")
  const [timeEdit, setTimeEdit] = useState(patient.appointmentTime)
  const [editingTime, setEditingTime] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => { if (nurseCallActive) setExpanded(true) }, [nurseCallActive])

  const handleSendNote = async () => {
    if (!noteText.trim()) return
    setSending(true)
    setTimeout(() => {
      onSendUpdate(patient.id, noteText.trim())
      setNoteText("")
      setSending(false)
    }, 400)
  }

  const handleSaveTime = () => {
    onUpdateTime(patient.id, timeEdit)
    setEditingTime(false)
  }

  const isDone = patient.status === "done" || patient.status === "discharged"

  return (
    <div className="rounded-2xl border transition-all duration-300" style={{ background: nurseCallActive ? "#fffbeb" : "#ffffff", borderColor: nurseCallActive ? "#fde68a" : isDone ? "#e2e8f0" : "#e8e1d4", boxShadow: nurseCallActive ? "0 0 0 2px #fde68a" : "0 1px 4px rgba(0,0,0,0.04)" }}>
      {/* Nurse-call alert banner */}
      {nurseCallActive && (
        <div className="flex items-center gap-2 px-5 py-2 rounded-t-2xl" style={{ background: "#fef3c7", borderBottom: "1px solid #fde68a" }}>
          <AlertTriangle size={14} style={{ color: "#b45309" }} />
          <span className="text-xs font-bold" style={{ color: "#92400e" }}>Doctor has called for your assistance!</span>
        </div>
      )}

      <div className="flex items-center gap-3 px-5 py-4 flex-wrap">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#f3e8ff" }}>
          <User size={18} style={{ color: "#7c3aed" }} />
        </div>
        {/* Name */}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm" style={{ color: "#1a2744" }}>
            {patient.name}
            <span className="ml-2 text-xs font-normal" style={{ color: "#8c7e6a" }}>{patient.age} yrs · {patient.gender} · {patient.ward}</span>
          </div>
          <div className="text-xs mt-0.5" style={{ color: "#6b5c40" }}>{patient.problem}</div>
        </div>
        {/* Time slot — editable */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {editingTime ? (
            <div className="flex items-center gap-1">
              <input type="time" value={timeEdit} onChange={e => setTimeEdit(e.target.value)} className="text-xs px-2 py-1 rounded-lg border" style={{ borderColor: "#e0d5c0", color: "#1a2744" }} />
              <button onClick={handleSaveTime} className="p-1.5 rounded-lg" style={{ background: "#1e3a6e", color: "#fff" }}><Save size={13} /></button>
              <button onClick={() => setEditingTime(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X size={13} /></button>
            </div>
          ) : (
            <button onClick={() => setEditingTime(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: "#fef3c7", border: "1px solid #fde68a" }}>
              <Clock size={13} style={{ color: "#b45309" }} />
              <span className="text-xs font-bold" style={{ color: "#92400e" }}>{patient.appointmentTime}</span>
              <Edit3 size={11} style={{ color: "#b45309" }} />
            </button>
          )}
        </div>
        <StatusBadge status={patient.status} />
        {!isDone && (
          <button onClick={() => onMarkDischarged(patient.id)} className="text-xs font-bold px-3 py-1.5 rounded-xl border transition-all" style={{ background: "transparent", color: "#64748b", borderColor: "#e2e8f0" }}>
            Discharge
          </button>
        )}
        <button onClick={() => setExpanded(e => !e)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && !isDone && (
        <div className="px-5 pb-5 border-t" style={{ borderColor: "#f0e8d8" }}>
          {patient.nurseNote && (
            <div className="mt-4 mb-3 p-3 rounded-xl text-xs" style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a" }}>
              <b>Last update sent:</b> {patient.nurseNote}
            </div>
          )}
          <div className="mt-4">
            <label className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: "#6b5c40" }}>Send Patient Update to Doctor</label>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              rows={3}
              placeholder="Enter patient observation, vitals, treatment done, etc..."
              className="w-full px-4 py-3 text-sm rounded-xl outline-none resize-none"
              style={{ background: "#f5f0e8", border: "1px solid #e0d5c0", color: "#1a2744" }}
            />
            <button
              onClick={handleSendNote}
              disabled={!noteText.trim() || sending}
              className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
              style={{ background: "#1e3a6e", color: "#fff" }}
            >
              <Send size={14} />
              {sending ? "Sending..." : "Update Doctor"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main NurseDashboard ───────────────────────────────────────────────────────
export function NurseDashboard() {
  const currentUser = useStore(s => s.currentUser)
  const pushToast = useStore(s => s.pushToast)
  const [patients, setPatients] = useState<DoctorPatient[]>(loadPatients)
  const [nurseCallMap, setNurseCallMap] = useState<Record<string, boolean>>({})

  // Re-sync with localStorage on mount & tab focus
  useEffect(() => {
    const sync = () => setPatients(loadPatients())
    window.addEventListener("focus", sync)
    const interval = setInterval(sync, 4000)
    return () => { window.removeEventListener("focus", sync); clearInterval(interval) }
  }, [])

  // Listen for doctor "call nurse" events
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const { patientId, patientName } = e.detail as { patientId: string; patientName?: string }
      setNurseCallMap(prev => ({ ...prev, [patientId]: true }))
      pushToast({ severity: "warning", title: "Doctor Called!", message: `Doctor needs you for ${patientName ?? "a patient"}.` })
    }
    window.addEventListener("curaflow:call_nurse", handler as EventListener)
    return () => window.removeEventListener("curaflow:call_nurse", handler as EventListener)
  }, [pushToast])

  const handleSendUpdate = useCallback((patientId: string, note: string) => {
    // Update localStorage so doctor sees it
    const all = loadPatients()
    const updated = all.map(p => p.id === patientId ? { ...p, nurseNote: note, nurseNoteAt: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) } : p)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    setPatients(updated)
    // Dispatch event so DoctorDashboard can react if open in same tab
    window.dispatchEvent(new CustomEvent("curaflow:nurse_update", { detail: { patientId, note } }))
    // Clear nurse-call indicator
    setNurseCallMap(prev => ({ ...prev, [patientId]: false }))
    pushToast({ severity: "info", title: "Update Sent", message: "Doctor has been notified." })
  }, [pushToast])

  const handleUpdateTime = useCallback((patientId: string, time: string) => {
    const all = loadPatients()
    const updated = all.map(p => p.id === patientId ? { ...p, appointmentTime: time } : p)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    setPatients(updated)
    window.dispatchEvent(new CustomEvent("curaflow:nurse_update", { detail: { patientId, time } }))
    pushToast({ severity: "info", title: "Schedule Updated", message: `Appointment time updated for patient.` })
  }, [pushToast])

  const handleMarkDischarged = useCallback((patientId: string) => {
    const all = loadPatients()
    const updated = all.map(p => p.id === patientId ? { ...p, status: "discharged" as const } : p)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    setPatients(updated)
    window.dispatchEvent(new CustomEvent("curaflow:nurse_update", { detail: { patientId, status: "discharged" } }))
    const pt = patients.find(p => p.id === patientId)
    pushToast({ severity: "info", title: "Patient Discharged", message: `${pt?.name ?? "Patient"} marked as discharged.` })
  }, [patients, pushToast])

  const active = patients.filter(p => p.status !== "discharged")
  const done = patients.filter(p => p.status === "done")
  const nurseCallCount = Object.values(nurseCallMap).filter(Boolean).length

  return (
    <div className="p-6 lg:p-8 space-y-6" style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-bold text-2xl lg:text-3xl" style={{ color: "#1a2744" }}>
            Nurse Dashboard — {currentUser?.display_name ?? "Nurse"}
          </h1>
          <p className="text-sm mt-1.5 flex items-center gap-2" style={{ color: "#6b5c40" }}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            Manage patient attendance, update doctors, schedule appointments
          </p>
        </div>
        <div className="flex items-center gap-3">
          {nurseCallCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl animate-pulse" style={{ background: "#fef3c7", border: "1px solid #fde68a" }}>
              <BellRing size={14} style={{ color: "#b45309" }} />
              <span className="text-xs font-bold" style={{ color: "#92400e" }}>{nurseCallCount} Doctor Call{nurseCallCount > 1 ? "s" : ""}</span>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}>
            <User size={14} style={{ color: "#1d4ed8" }} />
            <span className="text-xs font-bold" style={{ color: "#1e40af" }}>{active.length} Active</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
            <CheckCircle2 size={14} style={{ color: "#16a34a" }} />
            <span className="text-xs font-bold" style={{ color: "#15803d" }}>{done.length} Done</span>
          </div>
        </div>
      </div>

      {/* ── Schedule table header ──────────────────────────────────── */}
      <div className="hidden md:grid grid-cols-12 gap-2 px-5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#8c7e6a" }}>
        <div className="col-span-4">Patient</div>
        <div className="col-span-2">Ward</div>
        <div className="col-span-2 text-center">Time Slot</div>
        <div className="col-span-2 text-center">Status</div>
        <div className="col-span-2 text-right">Actions</div>
      </div>

      {/* ── Patient rows ──────────────────────────────────────────── */}
      <div className="space-y-3">
        {patients.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed" style={{ borderColor: "#e0d5c0", background: "#faf7f2" }}>
            <CheckCircle2 size={32} style={{ color: "#a3b8a0" }} className="mb-3" />
            <p className="text-sm font-semibold" style={{ color: "#6b5c40" }}>No patients assigned yet</p>
          </div>
        )}
        {/* Doctor-called patients first */}
        {patients.filter(p => nurseCallMap[p.id]).map(p => (
          <NursePatientRow key={p.id} patient={p} nurseCallActive onSendUpdate={handleSendUpdate} onUpdateTime={handleUpdateTime} onMarkDischarged={handleMarkDischarged} />
        ))}
        {/* Rest */}
        {patients.filter(p => !nurseCallMap[p.id]).map(p => (
          <NursePatientRow key={p.id} patient={p} nurseCallActive={false} onSendUpdate={handleSendUpdate} onUpdateTime={handleUpdateTime} onMarkDischarged={handleMarkDischarged} />
        ))}
      </div>

      {/* ── Info footer ───────────────────────────────────────────── */}
      <div className="flex items-center gap-4 pt-2 flex-wrap text-[11px]" style={{ color: "#a09080" }}>
        <span>• Click the clock icon to edit appointment time — doctor is notified automatically</span>
        <span>• Use "Update Doctor" to push post-attendance notes in real time</span>
        <span>• "Discharge" removes patient from doctor's active list after 5 seconds</span>
      </div>
    </div>
  )
}
