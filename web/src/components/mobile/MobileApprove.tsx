import { useEffect, useState, useRef } from 'react'
import { Check, X, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { fetchAllPendingApprovals, decideApproval, type AllPendingApproval } from '../../services/api'
import clsx from 'clsx'

export function MobileApprove() {
  const [approvals, setApprovals] = useState<AllPendingApproval[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  
  const startX = useRef(0)
  const currentId = approvals.length > 0 ? approvals[0].id : null
  const currentCard = approvals.length > 0 ? approvals[0] : null

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAllPendingApprovals()
      setApprovals(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load approvals')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleAction = async (id: string, decision: 'approved' | 'rejected') => {
    // Optimistic UI update
    setApprovals(prev => prev.filter(a => a.id !== id))
    setSwipeOffset(0)
    try {
      await decideApproval(id, decision)
    } catch (err) {
      console.error(err)
      loadData() // Re-fetch on error
    }
  }

  const onTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    if ('touches' in e) {
      startX.current = e.touches[0].clientX
    } else {
      startX.current = e.clientX
    }
    setIsDragging(true)
  }

  const onTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return
    const currentX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const diff = currentX - startX.current
    setSwipeOffset(diff)
  }

  const onTouchEnd = () => {
    if (!isDragging || !currentId) return
    setIsDragging(false)
    
    if (swipeOffset > 100) {
      handleAction(currentId, 'approved')
    } else if (swipeOffset < -100) {
      handleAction(currentId, 'rejected')
    } else {
      setSwipeOffset(0)
    }
  }

  if (loading && approvals.length === 0) {
    return (
      <div className="flex-1 bg-[#0a0f18] flex flex-col items-center justify-center p-6 text-white min-h-screen">
        <Loader2 size={32} className="animate-spin text-blue-500 mb-4" />
        <p className="text-slate-400 font-medium">Fetching active alerts...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-[#0a0f18] min-h-screen flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 flex items-center justify-between border-b border-white/5 bg-white/5 backdrop-blur-md sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-bold text-white tracking-wide">Duty Queue</h1>
          <p className="text-xs text-blue-400 font-medium">{approvals.length} Action{approvals.length !== 1 ? 's' : ''} Pending</p>
        </div>
        <button onClick={loadData} className="p-2 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 transition-all">
          <RefreshCw size={18} className="text-slate-300" />
        </button>
      </div>

      <div className="flex-1 relative flex flex-col items-center justify-center p-6 w-full max-w-md mx-auto">
        {error ? (
          <div className="text-center">
            <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
            <p className="text-red-400 mb-4">{error}</p>
            <button onClick={loadData} className="px-6 py-2 bg-white/10 rounded-full text-white">Retry</button>
          </div>
        ) : approvals.length === 0 ? (
          <div className="text-center space-y-4">
            <div className="w-24 h-24 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(20,184,166,0.1)]">
              <Check size={40} className="text-teal-400" />
            </div>
            <h2 className="text-xl font-bold text-white">All Clear</h2>
            <p className="text-slate-400">No pending actions require your attention.</p>
          </div>
        ) : (
          <>
            {/* Background stacked cards for visual depth */}
            {approvals.length > 1 && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-48px)] aspect-[4/5] bg-slate-800 rounded-3xl opacity-50 scale-95 -z-10 translate-y-4" />
            )}
            {approvals.length > 2 && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-48px)] aspect-[4/5] bg-slate-800/50 rounded-3xl opacity-30 scale-90 -z-20 translate-y-8" />
            )}
            
            {/* Active Card */}
            <div 
              className={clsx(
                "w-full aspect-[4/5] max-h-[65vh] bg-[#1a2235] border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden relative cursor-grab select-none z-10",
                isDragging ? 'cursor-grabbing transition-none' : 'transition-transform duration-300'
              )}
              style={{
                transform: `translateX(${swipeOffset}px) rotate(${swipeOffset * 0.05}deg)`,
                opacity: 1 - Math.abs(swipeOffset) / 500,
              }}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onMouseDown={onTouchStart}
              onMouseMove={onTouchMove}
              onMouseUp={onTouchEnd}
              onMouseLeave={onTouchEnd}
            >
              {/* Swipe Overlays */}
              <div className={clsx("absolute inset-0 bg-green-500/20 flex items-center justify-start p-8 transition-opacity duration-200 pointer-events-none", swipeOffset > 20 ? 'opacity-100' : 'opacity-0')}>
                <div className="border-4 border-green-500 text-green-500 text-3xl font-black p-4 rounded-xl transform -rotate-12">APPROVE</div>
              </div>
              <div className={clsx("absolute inset-0 bg-red-500/20 flex items-center justify-end p-8 transition-opacity duration-200 pointer-events-none", swipeOffset < -20 ? 'opacity-100' : 'opacity-0')}>
                <div className="border-4 border-red-500 text-red-500 text-3xl font-black p-4 rounded-xl transform rotate-12">REJECT</div>
              </div>

              {/* Card Content */}
              <div className="flex-1 p-6 flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <AlertCircle size={20} className="text-blue-400" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-blue-400 uppercase tracking-widest">{currentCard?.action_type.replace(/_/g, ' ')}</div>
                    <div className="text-sm text-slate-400">{new Date(currentCard?.created_at || '').toLocaleTimeString()}</div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-2">
                  {currentCard?.action_type === 'icu_admission_request' && (
                    <>
                      <h2 className="text-2xl font-bold text-white mb-2">ICU Admission Needed</h2>
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                        <div className="text-sm text-slate-400 mb-1">Patient Token</div>
                        <div className="text-xl font-mono text-slate-200">{String(currentCard?.payload?.patient_token).slice(0,8)}</div>
                      </div>
                      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                        <div className="text-sm font-semibold text-amber-500 mb-2">Clinical Reason</div>
                        <div className="text-amber-100/90 leading-relaxed">{String(currentCard?.payload?.reason)}</div>
                      </div>
                      {currentCard?.payload?.ventilator_dependent && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 text-red-400 text-sm font-medium">
                          <AlertCircle size={16} /> Ventilator Required
                        </div>
                      )}
                    </>
                  )}
                  {currentCard?.action_type === 'bed_reservation' && (
                    <>
                      <h2 className="text-2xl font-bold text-white mb-2">Confirm Bed Assignment</h2>
                      <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-3">
                        <div>
                          <div className="text-sm text-blue-400 mb-1">Assigned Bed</div>
                          <div className="text-2xl font-bold text-blue-100">{String(currentCard?.payload?.bed_id)}</div>
                        </div>
                      </div>
                      {Array.isArray(currentCard?.payload?.summary) && (
                        <div className="space-y-2 mt-4">
                          <div className="text-sm font-semibold text-slate-300">Action Summary:</div>
                          {currentCard.payload.summary.map((s: any, i: number) => (
                            <div key={i} className="flex gap-2 text-sm text-slate-400 leading-relaxed">
                              <span className="text-blue-500 mt-1">•</span> {s}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {currentCard?.action_type !== 'icu_admission_request' && currentCard?.action_type !== 'bed_reservation' && (
                    <>
                      <h2 className="text-xl font-bold text-white mb-4 capitalize">{currentCard?.action_type.replace(/_/g, ' ')}</h2>
                      <pre className="text-xs text-slate-300 bg-black/30 p-4 rounded-xl overflow-x-auto">
                        {JSON.stringify(currentCard?.payload, null, 2)}
                      </pre>
                    </>
                  )}
                </div>
              </div>

              {/* Bottom Actions Hint */}
              <div className="p-6 pt-0 flex justify-between items-center gap-4">
                <button 
                  onClick={() => currentId && handleAction(currentId, 'rejected')}
                  className="w-16 h-16 rounded-full bg-red-500/10 border-2 border-red-500/50 flex items-center justify-center text-red-500 hover:bg-red-500/20 hover:scale-105 active:scale-95 transition-all"
                >
                  <X size={28} />
                </button>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center flex-1">
                  Swipe to decide
                </div>
                <button 
                  onClick={() => currentId && handleAction(currentId, 'approved')}
                  className="w-16 h-16 rounded-full bg-green-500/10 border-2 border-green-500/50 flex items-center justify-center text-green-500 hover:bg-green-500/20 hover:scale-105 active:scale-95 transition-all"
                >
                  <Check size={28} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
