/**
 * CuraFlow Modern Approval & Command Center
 * Human-in-the-Loop (HITL) Protocol for AI Recommendations & Staff Interventions
 * Theme-matched, concise, high-contrast, premium UI
 */

import { useState, useEffect } from 'react'
import { Check, X, Edit3, ShieldAlert, Sparkles, TrendingUp, AlertTriangle, Bot, CheckCircle, FileText, CheckCircle2 } from 'lucide-react'
import { opsApi, type Recommendation } from '../../services/opsApi'

function PriorityBadge({ priority }: { priority: string }) {
  const p = (priority || '').toLowerCase()
  const style = p === 'critical'
    ? 'bg-rose-50 text-rose-700 border-rose-200'
    : p === 'high'
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : p === 'medium'
    ? 'bg-blue-50 text-blue-700 border-blue-200'
    : 'bg-slate-50 text-slate-600 border-slate-200'

  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${style}`}>
      {priority}
    </span>
  )
}

function ConfidenceGauge({ value }: { value: number }) {
  const pct = Math.round((value || 0) * 100)
  const color = pct >= 80 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200'
  
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${color}`}>
      <Sparkles size={13} />
      <span>{pct}% AI Confidence</span>
    </div>
  )
}

export function ApprovalCenter({
  recommendations = [],
  initialSelectedRec,
  onDecision,
}: {
  recommendations: Recommendation[]
  initialSelectedRec?: Recommendation | null
  onDecision?: () => void
}) {
  const [selected, setSelected] = useState<Recommendation | null>(initialSelectedRec ?? recommendations[0] ?? null)
  const [deciding, setDeciding] = useState(false)
  const [decidedMap, setDecidedMap] = useState<Record<string, 'approved' | 'modified' | 'rejected'>>({})
  const [modifyMode, setModifyMode] = useState(false)
  const [decisionReason, setDecisionReason] = useState('')
  const [customActionNotes, setCustomActionNotes] = useState<Record<string, string>>({})

  useEffect(() => {
    if (initialSelectedRec) {
      setSelected(initialSelectedRec)
    } else if (!selected && recommendations.length > 0) {
      setSelected(recommendations[0])
    }
  }, [initialSelectedRec, recommendations])

  const decide = async (decision: 'approve' | 'modify' | 'reject') => {
    if (!selected) return
    setDeciding(true)
    try {
      const modifications = modifyMode ? Object.entries(customActionNotes).map(([actionId, note]) => ({
        modification_type: 'action_note',
        action_id: actionId,
        modified_value: note,
      })) : undefined

      await opsApi.decide(
        selected.id,
        decision,
        decisionReason || (decision === 'approve' ? 'Approved by Admin' : 'Rejected by Admin'),
        modifications
      )
      setDecidedMap(d => ({ ...d, [selected.id]: (decision === 'approve' ? 'approved' : decision === 'modify' ? 'modified' : 'rejected') }))
      setModifyMode(false)
      onDecision?.()
    } catch (e) {
      console.error('Decision failed', e)
    } finally {
      setDeciding(false)
    }
  }

  const rec = selected
  const decidedStatus = rec ? decidedMap[rec.id] : undefined
  const pendingCount = recommendations.filter(r => !decidedMap[r.id]).length

  return (
    <div className="flex h-full bg-[#f8f6f0] overflow-hidden" style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      
      {/* ── Left Sidebar: Recommendations Queue ───────────────────────── */}
      <div className="w-80 flex-shrink-0 border-r border-[#e8e1d4] bg-white flex flex-col h-full shadow-sm">
        <div className="p-4 border-b border-[#e8e1d4] bg-[#fcfaf7]">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-[#1a2744] flex items-center gap-2">
              <ShieldAlert size={16} className="text-amber-600" />
              Pending Approvals
            </h2>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-[#1e3a6e] text-white rounded-full">
              {pendingCount}
            </span>
          </div>
          <p className="text-[11px] text-[#8c7e6a] mt-1">
            Human-in-the-Loop AI Governance Ledger
          </p>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#f2ebd9]">
          {recommendations.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#8c7e6a]">
              <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500 opacity-60" />
              No pending recommendations requiring action.
            </div>
          ) : (
            recommendations.map(r => {
              const status = decidedMap[r.id]
              const isSelected = selected?.id === r.id
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    setSelected(r)
                    setModifyMode(false)
                    setDecisionReason('')
                  }}
                  className={`w-full text-left p-4 transition-all relative ${
                    isSelected
                      ? 'bg-[#f0f4f9] border-l-4 border-l-[#1e3a6e]'
                      : 'hover:bg-[#faf8f3]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-mono text-[#8c7e6a]">
                      REC-{String(r.recommendation_number).padStart(3, '0')}
                    </span>
                    <PriorityBadge priority={r.priority} />
                  </div>

                  <h4 className="text-xs font-bold text-[#1a2744] line-clamp-1 leading-snug">
                    {r.title}
                  </h4>

                  <p className="text-[11px] text-[#6b5c40] mt-1 line-clamp-2 leading-relaxed">
                    {r.summary}
                  </p>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#f0e8d8] text-[10px] text-[#8c7e6a]">
                    <span className="flex items-center gap-1 font-medium">
                      <Bot size={11} className="text-[#1e3a6e]" /> {r.agent_id}
                    </span>
                    {status ? (
                      <span className={`font-bold uppercase ${
                        status === 'approved' ? 'text-emerald-700' : status === 'modified' ? 'text-blue-700' : 'text-rose-600'
                      }`}>
                        ✓ {status}
                      </span>
                    ) : (
                      <span className="text-amber-700 font-semibold">Awaiting Decision</span>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ── Main Detail Workspace ────────────────────────────────────── */}
      {rec ? (
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {/* Hero Header Card */}
          <div className="bg-white rounded-2xl border border-[#e8e1d4] p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="text-xs font-mono font-bold text-[#6b5c40] bg-[#f5f0e8] px-2.5 py-1 rounded-lg">
                    REC-{String(rec.recommendation_number).padStart(3, '0')}
                  </span>
                  <PriorityBadge priority={rec.priority} />
                  <ConfidenceGauge value={rec.confidence} />
                  <span className="text-xs text-[#8c7e6a] bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg font-mono">
                    Agent: <strong className="text-[#1a2744]">{rec.agent_id}</strong>
                  </span>
                </div>
                
                <h1 className="text-xl font-bold text-[#1a2744]">
                  {rec.title}
                </h1>
                <p className="text-sm text-[#475569] mt-1 leading-relaxed">
                  {rec.summary}
                </p>
              </div>

              {decidedStatus && (
                <div className={`px-4 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
                  decidedStatus === 'approved' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                  decidedStatus === 'modified' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                  'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  <CheckCircle size={16} />
                  Decision Recorded: {decidedStatus.toUpperCase()}
                </div>
              )}
            </div>

            {/* Concise Proposed Actions */}
            <div className="mt-5 pt-4 border-t border-[#f0e8d8]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#6b5c40] mb-3 flex items-center gap-1.5">
                <FileText size={14} className="text-[#1e3a6e]" />
                Proposed Action Plan ({rec.actions.length} Steps)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {rec.actions.map((act, idx) => (
                  <div key={act.id || idx} className="p-3 bg-[#faf8f3] rounded-xl border border-[#e8e1d4] flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-[#1e3a6e] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#1a2744] leading-snug">
                        {act.action_description}
                      </p>
                      {modifyMode && (
                        <input
                          type="text"
                          placeholder="Optional modification note..."
                          value={customActionNotes[act.id] || ''}
                          onChange={e => setCustomActionNotes({ ...customActionNotes, [act.id]: e.target.value })}
                          className="mt-2 w-full text-xs px-3 py-1.5 bg-white border border-[#d6cbb5] rounded-lg outline-none focus:border-[#1e3a6e]"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Grid: AI Intelligence & Operational Impact */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Card 1: Expected Impact (Stat Callouts) */}
            <div className="bg-white rounded-2xl border border-[#e8e1d4] p-5 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#6b5c40] mb-4 flex items-center gap-1.5">
                <TrendingUp size={15} className="text-emerald-600" />
                Predicted Operational Impact
              </h3>

              <div className="grid grid-cols-2 gap-3">
                {Object.entries(rec.expected_impact || {}).map(([k, v]) => {
                  const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                  const valStr = typeof v === 'number' && (k.includes('pct') || k.includes('percent'))
                    ? `+${v.toFixed(1)}%`
                    : typeof v === 'number' && k.includes('minutes')
                    ? `−${v} min`
                    : String(v)

                  return (
                    <div key={k} className="p-3.5 rounded-xl bg-[#f0fdf4] border border-[#bbf7d0]">
                      <span className="text-[11px] font-semibold text-emerald-800 block truncate">{label}</span>
                      <span className="text-lg font-extrabold text-emerald-700 mt-1 block font-mono">
                        {valStr}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Card 2: Clinical Rationale & Risk Assessment */}
            <div className="bg-white rounded-2xl border border-[#e8e1d4] p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#6b5c40] mb-2 flex items-center gap-1.5">
                  <Bot size={15} className="text-[#1e3a6e]" />
                  AI Clinical Reasoning
                </h3>
                <p className="text-xs text-[#374151] leading-relaxed bg-[#fcfaf7] p-3 rounded-xl border border-[#f0e8d8]">
                  {rec.why_explanation}
                </p>
              </div>

              {rec.counterfactual_scenario && (
                <div>
                  <h4 className="text-xs font-bold text-rose-800 mb-1 flex items-center gap-1">
                    <AlertTriangle size={13} /> Risk If Rejected:
                  </h4>
                  <div className="flex items-center gap-4 text-xs font-semibold text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                    <span>Predicted Saturation: <strong>{rec.counterfactual_scenario.predicted_saturation_pct?.toFixed(0)}%</strong></span>
                    <span>Delay Penalty: <strong>+{rec.counterfactual_scenario.expected_delay_minutes} min</strong></span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Decision Panel (Sticky Bottom Control Bar) */}
          {!decidedStatus && (
            <div className="bg-white rounded-2xl border border-[#e8e1d4] p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1a2744]">
                  Staff Decision Required
                </span>
                <span className="text-xs text-[#8c7e6a]">
                  Recorded in audit ledger upon action
                </span>
              </div>

              <input
                type="text"
                placeholder="Optional audit log note / clinical rationale..."
                value={decisionReason}
                onChange={e => setDecisionReason(e.target.value)}
                className="w-full text-xs px-4 py-2.5 bg-[#fcfaf7] border border-[#e8e1d4] rounded-xl outline-none focus:border-[#1e3a6e]"
              />

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => decide('approve')}
                  disabled={deciding}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Check size={16} />
                  {deciding ? 'Processing...' : 'Approve & Execute Recommendation'}
                </button>

                <button
                  onClick={() => setModifyMode(m => !m)}
                  disabled={deciding}
                  className={`px-5 py-3 rounded-xl font-semibold text-xs border transition-all ${
                    modifyMode ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-slate-50 text-[#1a2744] border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Edit3 size={15} className="inline mr-1" />
                  {modifyMode ? 'Cancel Edit' : 'Modify Actions'}
                </button>

                <button
                  onClick={() => decide('reject')}
                  disabled={deciding}
                  className="px-6 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-semibold text-xs transition-all flex items-center gap-1 disabled:opacity-50"
                >
                  <X size={16} />
                  Reject
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#8c7e6a]">
          <ShieldAlert size={40} className="mb-3 text-[#1e3a6e] opacity-40" />
          <h3 className="font-bold text-sm text-[#1a2744]">Select a Recommendation to Review</h3>
          <p className="text-xs text-[#6b5c40] mt-1 max-w-sm">
            Choose an item from the left panel to inspect AI confidence scores, operational metrics, and execute approval.
          </p>
        </div>
      )}
    </div>
  )
}
