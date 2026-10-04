import { useState, useEffect, useCallback } from 'react'
import { LogOut, Clock, AlertTriangle, CheckCircle2, ChevronRight, Pill, FileText, DollarSign, RefreshCw } from 'lucide-react'

import { opsApi, type OutgoingPatient } from '../../services/opsApi'

interface Props {
  deptFilter?: string
  title?: string
}

const STAGES = [
  { id: 'CLINICAL_CLEARANCE', label: '1. Clinical Order', icon: FileText, color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { id: 'PHARMACY_CLEARANCE', label: '2. Meds & Pharmacy', icon: Pill, color: 'text-purple-700 bg-purple-50 border-purple-200' },
  { id: 'BILLING_SETTLEMENT', label: '3. Billing Settlement', icon: DollarSign, color: 'text-amber-700 bg-amber-50 border-amber-200' },
  { id: 'PATIENT_EXIT', label: '4. Ready for Checkout', icon: LogOut, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
]

export function OutgoingPatientManager({ deptFilter, title = "Outgoing Patients & Discharge Queue Management" }: Props) {
  const [patients, setPatients] = useState<OutgoingPatient[]>([])
  const [metrics, setMetrics] = useState({ total_active_discharges: 0, delayed_discharges: 0, avg_turnaround_mins: 0 })
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [stageFilter, setStageFilter] = useState<string>('ALL')

  const fetchOutgoing = useCallback(async () => {
    try {
      const res = await opsApi.getOutgoingPatients(deptFilter)
      setPatients(res.outgoing_patients || [])
      if (res.metrics) setMetrics(res.metrics)
    } catch (err) {
      console.error('Failed to fetch outgoing patients:', err)
    } finally {
      setLoading(false)
    }
  }, [deptFilter])

  useEffect(() => {
    fetchOutgoing()
    const handleUpdate = () => fetchOutgoing()
    window.addEventListener('curaflow:outgoing_updated', handleUpdate)
    window.addEventListener('curaflow:patients_updated', handleUpdate)
    return () => {
      window.removeEventListener('curaflow:outgoing_updated', handleUpdate)
      window.removeEventListener('curaflow:patients_updated', handleUpdate)
    }
  }, [fetchOutgoing])

  const handleAdvanceStage = async (outgoingId: string, nextStage: string) => {
    setProcessingId(outgoingId)
    try {
      await opsApi.processOutgoingStage(outgoingId, nextStage)
      await fetchOutgoing()
    } catch (err) {
      console.error('Failed to advance discharge stage:', err)
    } finally {
      setProcessingId(null)
    }
  }

  const handleCompleteDischarge = async (outgoingId: string) => {
    setProcessingId(outgoingId)
    try {
      await opsApi.completeOutgoingDischarge(outgoingId)
      window.dispatchEvent(new Event('curaflow:patients_updated'))
      await fetchOutgoing()
    } catch (err) {
      console.error('Failed to finalize discharge:', err)
    } finally {
      setProcessingId(null)
    }
  }

  const activePatients = patients.filter(p => p.discharge_stage !== 'DISCHARGED')
  const displayPatients = stageFilter === 'ALL'
    ? activePatients
    : stageFilter === 'DELAYED'
    ? activePatients.filter(p => p.is_delayed)
    : activePatients.filter(p => p.discharge_stage === stageFilter)

  return (
    <div className="bg-white rounded-2xl border border-[#e8e1d4] p-5 shadow-sm mb-6">
      {/* ── Header & KPI Metrics Bar ──────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 pb-4 border-b border-[#f0e8d8]">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <LogOut size={18} />
            </div>
            <h3 className="font-bold text-sm text-[#1a2744] flex items-center gap-2">
              {title}
              {metrics.delayed_discharges > 0 && (
                <span className="px-2.5 py-0.5 text-xs bg-rose-600 text-white font-bold rounded-full animate-pulse flex items-center gap-1">
                  <AlertTriangle size={12} /> {metrics.delayed_discharges} Bottlenecks
                </span>
              )}
            </h3>
          </div>
          <p className="text-xs text-[#8c7e6a] mt-1">
            4-Stage Discharge Acceleration, Automated Housekeeping Bed Release & Delay Tracking
          </p>
        </div>

        {/* Live Metrics Cards */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="px-3.5 py-2 rounded-xl bg-blue-50 border border-blue-200">
            <span className="text-[10px] font-bold uppercase text-blue-800 block">Active Discharges</span>
            <span className="text-sm font-extrabold text-blue-900">{metrics.total_active_discharges} Patients</span>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200">
            <span className="text-[10px] font-bold uppercase text-rose-800 block">Stage Delays (&gt;30m)</span>
            <span className="text-sm font-extrabold text-rose-900">{metrics.delayed_discharges} Stalled</span>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
            <span className="text-[10px] font-bold uppercase text-emerald-800 block">Avg Discharge Time</span>
            <span className="text-sm font-extrabold text-emerald-900">{metrics.avg_turnaround_mins} min</span>
          </div>
        </div>
      </div>

      {/* ── Stage Filter Controls ───────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center bg-[#fafaf9] p-1 rounded-xl border border-[#e8e1d4] text-xs font-semibold flex-wrap">
          <button
            onClick={() => setStageFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg transition-all ${stageFilter === 'ALL' ? 'bg-[#1e3a6e] text-white shadow-sm' : 'text-[#6b5c40] hover:text-[#1a2744]'}`}
          >
            All Active ({activePatients.length})
          </button>
          <button
            onClick={() => setStageFilter('DELAYED')}
            className={`px-3 py-1.5 rounded-lg transition-all ${stageFilter === 'DELAYED' ? 'bg-rose-600 text-white shadow-sm' : 'text-rose-700 hover:text-rose-900'}`}
          >
            Delayed ({activePatients.filter(p => p.is_delayed).length})
          </button>
          {STAGES.map(s => {
            const count = activePatients.filter(p => p.discharge_stage === s.id).length
            return (
              <button
                key={s.id}
                onClick={() => setStageFilter(s.id)}
                className={`px-3 py-1.5 rounded-lg transition-all ${stageFilter === s.id ? 'bg-[#1e3a6e] text-white shadow-sm' : 'text-[#6b5c40] hover:text-[#1a2744]'}`}
              >
                {s.label.split('.')[1]} ({count})
              </button>
            )
          })}
        </div>

        <button
          onClick={fetchOutgoing}
          className="p-2 rounded-xl border border-[#e8e1d4] text-[#6b5c40] hover:text-[#1a2744] hover:bg-[#fafaf9]"
          title="Refresh Queue"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* ── Outgoing Patient Cards List ──────────────────────────────── */}
      {loading ? (
        <div className="py-8 text-center text-xs text-[#8c7e6a] flex items-center justify-center gap-2">
          <Clock size={16} className="animate-spin text-[#1e3a6e]" /> Loading discharge queue...
        </div>
      ) : displayPatients.length === 0 ? (
        <div className="py-8 text-center bg-[#fafaf9] rounded-xl border border-dashed border-[#e8e1d4] text-xs text-[#8c7e6a]">
          No outgoing patients found for the selected filter.
        </div>
      ) : (
        <div className="space-y-3">
          {displayPatients.map((patient) => {
            const isDelayed = patient.is_delayed
            const currentStageObj = STAGES.find(s => s.id === patient.discharge_stage) || STAGES[0]

            return (
              <div
                key={patient.id}
                className={`p-4 rounded-xl border transition-all ${
                  isDelayed
                    ? 'bg-rose-50/40 border-rose-200'
                    : 'bg-[#fcfaf7] border-[#e8e1d4] hover:border-[#d6cbb5]'
                }`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  
                  {/* Patient Details & Status */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-sm text-[#1a2744]">{patient.name}</span>
                      <span className="text-xs font-mono text-[#8c7e6a] bg-white border border-[#e8e1d4] px-2 py-0.5 rounded-md">
                        {patient.mrn}
                      </span>
                      <span className="text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
                        Ward: {patient.ward} ({patient.bed_number || 'Bed TBA'})
                      </span>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${currentStageObj.color}`}>
                        Current Stage: {currentStageObj.label}
                      </span>
                    </div>

                    <div className="text-xs text-[#6b5c40] mt-1 flex items-center gap-4 flex-wrap">
                      <span>Doctor: <strong>{patient.assigned_doctor}</strong></span>
                      <span>Nurse: <strong>{patient.assigned_nurse}</strong></span>
                      <span className="flex items-center gap-1 font-mono text-[#1a2744]">
                        <Clock size={12} className="text-[#8c7e6a]" /> Elapsed: <strong>{patient.total_elapsed_mins} min</strong>
                      </span>
                      {patient.follow_up_date && (
                        <span className="text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium">
                          Follow-up Scheduled: {patient.follow_up_date}
                        </span>
                      )}
                    </div>

                    {/* Delay Alert Banner */}
                    {isDelayed && (
                      <div className="mt-2.5 p-2.5 rounded-lg bg-rose-100/70 border border-rose-200 flex items-center gap-2 text-xs font-semibold text-rose-900">
                        <AlertTriangle size={14} className="text-rose-700 flex-shrink-0" />
                        <span>Discharge Bottleneck: {patient.delay_reason || 'Elapsed time exceeds 30 minute stage threshold.'}</span>
                      </div>
                    )}

                    {/* Stage Progress Pills */}
                    <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-[#f0e8d8] text-[11px]">
                      <div className={`p-1.5 rounded-lg border text-center font-bold ${patient.clinical_cleared ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-50 text-slate-500'}`}>
                        {patient.clinical_cleared ? '✓ Clinical Cleared' : '1. Clinical Pending'}
                      </div>
                      <div className={`p-1.5 rounded-lg border text-center font-bold ${patient.pharmacy_cleared ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-50 text-slate-500'}`}>
                        {patient.pharmacy_cleared ? '✓ Meds Cleared' : '2. Pharmacy Pending'}
                      </div>
                      <div className={`p-1.5 rounded-lg border text-center font-bold ${patient.billing_cleared ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-50 text-slate-500'}`}>
                        {patient.billing_cleared ? '✓ Billing Cleared' : '3. Billing Pending'}
                      </div>
                      <div className={`p-1.5 rounded-lg border text-center font-bold ${patient.discharge_stage === 'PATIENT_EXIT' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-slate-50 text-slate-500'}`}>
                        4. Exit & Bed Release
                      </div>
                    </div>
                  </div>

                  {/* Stage Action Controls */}
                  <div className="flex flex-col items-end justify-center gap-2 flex-shrink-0 self-center">
                    {patient.discharge_stage === 'CLINICAL_CLEARANCE' && (
                      <button
                        onClick={() => handleAdvanceStage(patient.id, 'PHARMACY_CLEARANCE')}
                        disabled={processingId === patient.id}
                        className="px-3.5 py-2 bg-[#1e3a6e] hover:bg-[#152a52] text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center gap-1 disabled:opacity-50"
                      >
                        Clear Clinical & Send to Pharmacy <ChevronRight size={14} />
                      </button>
                    )}

                    {patient.discharge_stage === 'PHARMACY_CLEARANCE' && (
                      <button
                        onClick={() => handleAdvanceStage(patient.id, 'BILLING_SETTLEMENT')}
                        disabled={processingId === patient.id}
                        className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center gap-1 disabled:opacity-50"
                      >
                        Clear Pharmacy Meds <ChevronRight size={14} />
                      </button>
                    )}

                    {patient.discharge_stage === 'BILLING_SETTLEMENT' && (
                      <button
                        onClick={() => handleAdvanceStage(patient.id, 'PATIENT_EXIT')}
                        disabled={processingId === patient.id}
                        className="px-3.5 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center gap-1 disabled:opacity-50"
                      >
                        Clear Billing & Insurance <ChevronRight size={14} />
                      </button>
                    )}

                    {patient.discharge_stage === 'PATIENT_EXIT' && (
                      <button
                        onClick={() => handleCompleteDischarge(patient.id)}
                        disabled={processingId === patient.id}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <CheckCircle2 size={15} />
                        {processingId === patient.id ? 'Finalizing...' : 'Finalize Checkout & Release Bed'}
                      </button>
                    )}
                  </div>

                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
