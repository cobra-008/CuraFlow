/**
 * CuraFlow Approval Center
 * Human-in-the-loop: APPROVE / MODIFY / REJECT
 * Shows full explainability: WHY, CONSTRAINTS, ALTERNATIVES, COUNTERFACTUAL
 */

import { useState, useEffect } from 'react'
import { opsApi, type Recommendation } from '../../services/opsApi'

function priorityBadge(p: string) {
  const map: Record<string, string> = {
    critical: 'bg-red-900/30 text-red-600 border-red-200',
    high: 'bg-orange-50 text-orange-700 border-orange-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    low: 'bg-warm-100 text-gray-500 border-warm-300',
  }
  return map[p] ?? map.low
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = value * 100
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 65 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-warm-100 rounded-sm overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-gray-500 w-8 text-right">{pct.toFixed(0)}%</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-warm-200 rounded-sm">
      <div className="px-3 py-2 border-b border-warm-200 bg-warm-50/30">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{title}</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

function RecListItem({
  rec,
  selected,
  onClick,
}: {
  rec: Recommendation
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 border-b border-warm-200 transition-colors ${
        selected ? 'bg-blue-50 border-l-2 border-l-slate-500' : 'hover:bg-warm-50'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="text-[10px] font-mono text-gray-400 mt-0.5">
          {String(rec.recommendation_number).padStart(2, '0')}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-navy-800 truncate">{rec.title}</span>
            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 border rounded-sm ${priorityBadge(rec.priority)}`}>
              {rec.priority}
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed line-clamp-1">{rec.summary}</p>
        </div>
      </div>
    </button>
  )
}

interface ModifyState {
  action_index: number
  modified_description: string
  reason: string
}

export function ApprovalCenter({
  recommendations,
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
  const [modifyState, setModifyState] = useState<ModifyState>({
    action_index: 0,
    modified_description: '',
    reason: '',
  })
  const [decisionReason, setDecisionReason] = useState('')
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    if (initialSelectedRec) setSelected(initialSelectedRec)
  }, [initialSelectedRec])

  const decide = async (decision: 'approve' | 'modify' | 'reject') => {
    if (!selected) return
    setDeciding(true)
    try {
      const modifications = modifyMode && modifyState.modified_description ? [{
        modification_type: 'action_description',
        original_value: selected.actions[modifyState.action_index]?.action_description,
        modified_value: modifyState.modified_description,
        reason: modifyState.reason,
      }] : undefined

      await opsApi.decide(
        selected.id,
        decision,
        decision === 'reject' ? rejectReason : decisionReason,
        modifications
      )
      setDecidedMap(d => ({ ...d, [selected.id]: (decision === 'approve' ? 'approved' : decision === 'modify' ? 'modified' : 'rejected') as 'approved' | 'modified' | 'rejected' }))
      setModifyMode(false)
      onDecision?.()
    } catch (e) {
      // handle error
    } finally {
      setDeciding(false)
    }
  }

  const rec = selected
  const decidedStatus = rec ? decidedMap[rec.id] : undefined

  return (
    <div className="flex h-full" style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      {/* Recommendation list */}
      <div className="w-72 flex-shrink-0 border-r border-warm-200 flex flex-col">
        <div className="px-3 py-2 border-b border-warm-200 flex-shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Pending Approval ({recommendations.filter(r => !decidedMap[r.id]).length})
          </span>
        </div>
        <div className="flex-1 overflow-auto">
          {recommendations.length === 0 ? (
            <div className="p-4 text-xs text-gray-400 text-center">No recommendations pending</div>
          ) : (
            recommendations.map(r => (
              <RecListItem
                key={r.id}
                rec={r}
                selected={selected?.id === r.id}
                onClick={() => { setSelected(r); setModifyMode(false); setDecisionReason(''); setRejectReason('') }}
              />
            ))
          )}
        </div>
      </div>

      {/* Detail panel */}
      {rec ? (
        <div className="flex-1 min-w-0 overflow-auto p-4 flex flex-col gap-3">

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono text-gray-400">REC-{String(rec.recommendation_number).padStart(3, '0')}</span>
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 border rounded-sm ${priorityBadge(rec.priority)}`}>
                  {rec.priority}
                </span>
                {decidedStatus && (
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${
                    decidedStatus === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    decidedStatus === 'modified' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                    'bg-red-50 text-red-600 border border-red-200'
                  }`}>
                    {decidedStatus}
                  </span>
                )}
                {rec._is_synthetic && (
                  <span className="text-[9px] font-mono text-gray-400 border border-warm-200 px-1 py-0.5 rounded-sm">
                    SYNTHETIC
                  </span>
                )}
              </div>
              <h2 className="text-base font-semibold text-navy-900 mt-1">{rec.title}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{rec.summary}</p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className="text-[10px] text-gray-400 font-mono">
                Agent: <span className="text-gray-500">{rec.agent_id}</span>
              </span>
              <span className="text-[10px] text-gray-400 font-mono">
                Expires: <span className="text-gray-500">{new Date(rec.expires_at).toLocaleTimeString()}</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

            {/* WHY */}
            <Section title="Why this recommendation">
              <p className="text-xs text-navy-700 leading-relaxed">{rec.why_explanation}</p>
              <div className="mt-3">
                <div className="text-[10px] text-gray-400 mb-1.5">Confidence</div>
                <ConfidenceBar value={rec.confidence} />
              </div>
              {rec.data_freshness_seconds !== undefined && (
                <div className="mt-2 text-[10px] text-gray-400 font-mono">
                  Data freshness: {rec.data_freshness_seconds}s ago
                </div>
              )}
            </Section>

            {/* Expected Impact */}
            <Section title="Expected Impact">
              <div className="flex flex-col gap-1.5">
                {Object.entries(rec.expected_impact).map(([k, v]) => {
                  const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                  return (
                    <div key={k} className="flex justify-between items-center">
                      <span className="text-[11px] text-gray-500">{label}</span>
                      <span className="font-mono text-sm text-emerald-600 font-bold">
                        {typeof v === 'number' && (k.includes('pct') || k.includes('percent'))
                          ? `${v.toFixed(1)}%`
                          : typeof v === 'number' && k.includes('minutes')
                          ? `−${v} min`
                          : String(v)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </Section>

            {/* Actions */}
            <Section title="Proposed Actions">
              <div className="flex flex-col gap-2">
                {rec.actions.map((action, idx) => (
                  <div key={action.id} className="flex items-start gap-2">
                    <span className="text-[10px] font-mono text-gray-400 mt-0.5 flex-shrink-0">{idx + 1}.</span>
                    <div className="flex-1">
                      {modifyMode && modifyState.action_index === idx ? (
                        <input
                          className="w-full bg-warm-100 border border-warm-300 rounded-sm px-2 py-1 text-xs text-navy-800 focus:outline-none focus:border-blue-600"
                          value={modifyState.modified_description}
                          onChange={e => setModifyState(s => ({ ...s, modified_description: e.target.value }))}
                        />
                      ) : (
                        <span className="text-xs text-navy-700">{action.action_description}</span>
                      )}
                      {modifyMode && (
                        <button
                          className="text-[9px] text-blue-600 mt-0.5"
                          onClick={() => setModifyState(s => ({ ...s, action_index: idx, modified_description: action.action_description }))}
                        >
                          {modifyState.action_index === idx ? 'Editing' : 'Edit this'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Constraints */}
            <Section title="Constraints Satisfied">
              <div className="flex flex-col gap-1">
                {rec.constraints_satisfied.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full flex-shrink-0" />
                    <span className="text-xs text-navy-700">{c}</span>
                  </div>
                ))}
              </div>
            </Section>

            {/* Alternatives rejected */}
            <Section title="Alternatives Considered">
              <div className="flex flex-col gap-2">
                {rec.alternatives_rejected.map((alt, i) => (
                  <div key={i} className="border border-warm-200 rounded-sm px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-red-500/60 rounded-full flex-shrink-0" />
                      <span className="text-xs font-semibold text-navy-700">{alt.option}</span>
                      <span className="text-[9px] text-red-600 font-mono uppercase">REJECTED</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5 pl-3">{alt.reason}</p>
                  </div>
                ))}
              </div>
            </Section>

            {/* Counterfactual */}
            {rec.counterfactual_scenario && (
              <Section title="Counterfactual — If Rejected">
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Predicted saturation</span>
                    <span className="font-mono text-sm font-bold text-red-600">
                      {rec.counterfactual_scenario.predicted_saturation_pct?.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Expected delay</span>
                    <span className="font-mono text-sm font-bold text-red-600">
                      +{rec.counterfactual_scenario.expected_delay_minutes} min
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-gray-400 border-t border-warm-200 pt-1.5">
                    Alternative: {rec.counterfactual_scenario.alternative_description}
                  </div>
                </div>
              </Section>
            )}
          </div>

          {/* Decision panel */}
          {!decidedStatus && (
            <div className="border border-warm-300 bg-white rounded-sm p-4 mt-1">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Decision Required</div>

              {modifyMode && (
                <div className="mb-3">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Modification reason</label>
                  <input
                    className="w-full bg-warm-100 border border-warm-300 rounded-sm px-3 py-1.5 text-xs text-navy-800 focus:outline-none focus:border-blue-600"
                    placeholder="Explain your modification…"
                    value={modifyState.reason}
                    onChange={e => setModifyState(s => ({ ...s, reason: e.target.value }))}
                  />
                </div>
              )}

              {!modifyMode && (
                <div className="mb-3">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Reason (optional)</label>
                  <input
                    className="w-full bg-warm-100 border border-warm-300 rounded-sm px-3 py-1.5 text-xs text-navy-800 focus:outline-none focus:border-blue-600"
                    placeholder="Add context for the audit log…"
                    value={decisionReason}
                    onChange={e => setDecisionReason(e.target.value)}
                  />
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => decide('reject')}
                  disabled={deciding}
                  className="flex-1 py-2 text-xs font-semibold uppercase tracking-wider bg-red-50 text-red-600 border border-red-200 rounded-sm hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  onClick={() => setModifyMode(m => !m)}
                  disabled={deciding}
                  className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider border rounded-sm transition-colors disabled:opacity-50 ${
                    modifyMode
                      ? 'bg-blue-50 text-blue-200 border-blue-600'
                      : 'bg-warm-100 text-navy-700 border-warm-300 hover:bg-warm-200'
                  }`}
                >
                  {modifyMode ? 'Cancel Modify' : 'Modify'}
                </button>
                <button
                  onClick={() => decide(modifyMode ? 'modify' : 'approve')}
                  disabled={deciding}
                  className="flex-1 py-2 text-xs font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-sm hover:bg-emerald-900/50 transition-colors disabled:opacity-50"
                >
                  {deciding ? 'Processing…' : modifyMode ? 'Submit Modification' : 'Approve'}
                </button>
              </div>

              <p className="text-[9px] text-gray-300 mt-2 text-center">
                All decisions are recorded in the audit ledger. Consequential actions execute only after approval.
              </p>
            </div>
          )}

          {decidedStatus && (
            <div className={`border rounded-sm p-3 text-center ${
              decidedStatus === 'approved' ? 'border-emerald-200 bg-emerald-50' :
              decidedStatus === 'modified' ? 'border-blue-200 bg-blue-50' :
              'border-red-200 bg-red-50'
            }`}>
              <span className={`text-sm font-semibold ${
                decidedStatus === 'approved' ? 'text-emerald-700' :
                decidedStatus === 'modified' ? 'text-blue-700' :
                'text-red-600'
              }`}>
                Recommendation {decidedStatus}. Decision recorded in audit log.
              </span>
            </div>
          )}

          {rec.verification && (
            <div className="border border-warm-300 bg-white rounded-sm p-4 mt-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 border-b border-warm-200 pb-2">
                Execution & Verification
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] text-gray-400 mb-1">Execution</div>
                  <div className="text-sm font-semibold text-navy-700">Completed</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 mb-1">Verification</div>
                  <div className={`text-sm font-bold uppercase ${
                    rec.verification.outcome === 'SUCCESS' ? 'text-emerald-600' :
                    rec.verification.outcome === 'PARTIAL' ? 'text-amber-600' :
                    rec.verification.outcome === 'FAILED' ? 'text-red-600' :
                    'text-blue-600 animate-pulse'
                  }`}>
                    {rec.verification.outcome === 'PENDING' ? 'Measuring...' : rec.verification.outcome}
                  </div>
                </div>
              </div>
              
              {rec.verification.outcome !== 'PENDING' && rec.verification.actual_impact && (
                <div className="mt-4 pt-3 border-t border-warm-200">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Metrics Analysis</div>
                  <div className="flex flex-col gap-2">
                    {Object.entries(rec.verification.expected_impact).map(([k, expectedVal]) => {
                      const actualVal = rec.verification!.actual_impact![k]
                      const variance = rec.verification!.variance![k]
                      const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                      return (
                        <div key={k} className="flex justify-between items-center text-xs">
                          <span className="text-gray-500">{label}</span>
                          <div className="flex gap-4 font-mono text-sm">
                            <div className="flex flex-col items-end">
                              <span className="text-[9px] text-gray-400">Expected</span>
                              <span className="text-gray-500">{expectedVal}</span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-[9px] text-gray-400">Actual</span>
                              <span className="text-navy-800">{actualVal?.toFixed(1) ?? 'N/A'}</span>
                            </div>
                            <div className="flex flex-col items-end min-w-[50px]">
                              <span className="text-[9px] text-gray-400">Variance</span>
                              <span className={`font-bold ${variance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                {variance > 0 ? '+' : ''}{variance?.toFixed(1) ?? 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Select a recommendation to review
        </div>
      )}
    </div>
  )
}
