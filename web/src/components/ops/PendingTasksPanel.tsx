import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, Clock, ShieldAlert, Bot, Check, AlertCircle } from 'lucide-react'

import { opsApi, type ScheduledTask } from '../../services/opsApi'

interface Props {
  roleFilter?: string
  deptFilter?: string
  title?: string
}

export function PendingTasksPanel({ roleFilter, deptFilter, title = "Agent Recommendations & Pending Task Approvals" }: Props) {
  const [tasks, setTasks] = useState<ScheduledTask[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'pending' | 'scheduled' | 'all'>('pending')

  const fetchTasks = useCallback(async () => {
    try {
      const res = await opsApi.getTasks(undefined, roleFilter, deptFilter)
      setTasks(res.tasks || [])
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
    } finally {
      setLoading(false)
    }
  }, [roleFilter, deptFilter])

  useEffect(() => {
    fetchTasks()
    const handleUpdate = () => fetchTasks()
    window.addEventListener('curaflow:tasks_updated', handleUpdate)
    window.addEventListener('curaflow:task_created', handleUpdate)
    return () => {
      window.removeEventListener('curaflow:tasks_updated', handleUpdate)
      window.removeEventListener('curaflow:task_created', handleUpdate)
    }
  }, [fetchTasks])

  const handleDecision = async (taskId: string, decision: 'approve' | 'reject') => {
    setProcessingId(taskId)
    try {
      await opsApi.approveTask(taskId, decision)
      await fetchTasks()
    } catch (err) {
      console.error('Task decision failed:', err)
      alert('Failed to update task decision. Please try again.')
    } finally {
      setProcessingId(null)
    }
  }

  const pendingTasks = tasks.filter(t => t.status === 'PENDING_APPROVAL')
  const scheduledTasks = tasks.filter(t => t.status === 'SCHEDULED')
  const displayTasks = activeTab === 'pending' ? pendingTasks : activeTab === 'scheduled' ? scheduledTasks : tasks

  const urgencyColor = (u: string) => {
    switch (u?.toUpperCase()) {
      case 'CRITICAL': return 'bg-red-50 text-red-700 border-red-200'
      case 'HIGH': return 'bg-orange-50 text-orange-700 border-orange-200'
      case 'MEDIUM': return 'bg-amber-50 text-amber-700 border-amber-200'
      default: return 'bg-slate-50 text-slate-700 border-slate-200'
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e8e1d4] p-5 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
            <ShieldAlert size={18} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-[#1a2744] flex items-center gap-2">
              {title}
              {pendingTasks.length > 0 && (
                <span className="px-2 py-0.5 text-xs bg-amber-500 text-white font-bold rounded-full animate-pulse">
                  {pendingTasks.length} Require Approval
                </span>
              )}
            </h3>
            <p className="text-xs text-[#8c7e6a] mt-0.5">
              Human-in-the-Loop Protocol: Agent interventions require explicit staff approval before execution
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center bg-[#fafaf9] p-1 rounded-xl border border-[#e8e1d4] text-xs font-semibold">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'pending' ? 'bg-[#1e3a6e] text-white shadow-sm' : 'text-[#6b5c40] hover:text-[#1a2744]'}`}
          >
            Pending ({pendingTasks.length})
          </button>
          <button
            onClick={() => setActiveTab('scheduled')}
            className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'scheduled' ? 'bg-[#1e3a6e] text-white shadow-sm' : 'text-[#6b5c40] hover:text-[#1a2744]'}`}
          >
            Approved / Scheduled ({scheduledTasks.length})
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'all' ? 'bg-[#1e3a6e] text-white shadow-sm' : 'text-[#6b5c40] hover:text-[#1a2744]'}`}
          >
            All ({tasks.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
          <Clock size={16} className="animate-spin text-[#1e3a6e]" /> Loading agent tasks...
        </div>
      ) : displayTasks.length === 0 ? (
        <div className="py-8 text-center bg-[#fafaf9] rounded-xl border border-dashed border-[#e8e1d4] text-xs text-[#8c7e6a]">
          {activeTab === 'pending' ? 'No pending tasks awaiting staff approval.' : 'No scheduled tasks found.'}
        </div>
      ) : (
        <div className="space-y-3">
          {displayTasks.map((task) => (
            <div
              key={task.id}
              className={`p-4 rounded-xl border transition-all ${
                task.status === 'PENDING_APPROVAL'
                  ? 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
                  : task.status === 'SCHEDULED'
                  ? 'bg-emerald-50/30 border-emerald-200'
                  : 'bg-slate-50 border-slate-200 opacity-70'
              }`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-bold text-[#1a2744]">{task.title}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${urgencyColor(task.urgency)}`}>
                      {task.urgency}
                    </span>
                    <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-100 flex items-center gap-1">
                      <Bot size={11} /> {task.source_agent}
                    </span>
                    <span className="text-[10px] font-medium text-[#6b5c40] bg-[#f5f0e8] px-2 py-0.5 rounded-md">
                      Dept: {task.department}
                    </span>
                  </div>

                  <p className="text-xs text-[#374151] leading-relaxed mb-2">
                    {task.description}
                  </p>

                  <div className="flex items-center gap-4 text-[11px] text-[#6b5c40]">
                    <span>Assigned to: <strong className="text-[#1a2744]">{task.assigned_staff_id || task.assigned_role}</strong></span>
                    <span>Created: {new Date(task.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                {/* HITL Approval Controls */}
                <div className="flex items-center gap-2 self-center flex-shrink-0">
                  {task.status === 'PENDING_APPROVAL' ? (
                    <>
                      <button
                        onClick={() => handleDecision(task.id, 'approve')}
                        disabled={processingId === task.id}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                      >
                        <Check size={14} />
                        {processingId === task.id ? 'Processing...' : 'Approve & Schedule'}
                      </button>
                      <button
                        onClick={() => handleDecision(task.id, 'reject')}
                        disabled={processingId === task.id}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                      >
                        <XCircle size={14} />
                        Reject
                      </button>
                    </>
                  ) : task.status === 'SCHEDULED' ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200">
                      <CheckCircle size={14} />
                      Approved & Scheduled
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold">
                      <AlertCircle size={14} />
                      Rejected
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
