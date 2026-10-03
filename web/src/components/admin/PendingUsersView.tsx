import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Loader2, RefreshCw, UserCheck } from 'lucide-react'
import { fetchPendingUsers, approveUser, rejectUser, type ManagedUser } from '../../services/api'
import { Avatar, EmptyState, RoleBadge, timeAgo } from './shared'

interface Props {
  orgNames: Record<string, string>
  showOrgColumn: boolean
}

export function PendingUsersView({ orgNames, showOrgColumn }: Props) {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<Record<string, 'approve' | 'reject'>>({})
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setError('')
    try {
      setUsers(await fetchPendingUsers())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load pending users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 15000)
    return () => clearInterval(id)
  }, [refresh])

  async function decide(user: ManagedUser, action: 'approve' | 'reject') {
    setBusy((prev) => ({ ...prev, [user.id]: action }))
    setError('')
    try {
      await (action === 'approve' ? approveUser(user.id) : rejectUser(user.id))
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not ${action} ${user.username}`)
    } finally {
      setBusy((prev) => { const next = { ...prev }; delete next[user.id]; return next })
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <UserCheck size={15} style={{ color: '#d97706' }} />
          <h2 className="text-sm font-semibold" style={{ color: '#1a2744' }}>Pending Sign-ups</h2>
          {users.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-[10px] font-bold text-amber-700">
              {users.length}
            </span>
          )}
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-slate-100"
          style={{ color: '#6b5c40', border: '1px solid #e8e1d4', background: '#f5f0e8' }}
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-14">
          <Loader2 size={20} className="animate-spin" style={{ color: '#1e3a6e' }} />
        </div>
      ) : users.length === 0 ? (
        <EmptyState message="No accounts waiting for approval." />
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 p-4 rounded-xl transition-shadow hover:shadow-sm"
              style={{ background: '#ffffff', border: '1px solid #e8e1d4' }}
            >
              <Avatar name={u.display_name} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold truncate" style={{ color: '#1a2744' }}>{u.display_name}</span>
                  <RoleBadge role={u.role} />
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: '#9aa3b2' }}>
                  @{u.username}
                  {showOrgColumn && u.org_id && <> · {orgNames[u.org_id] ?? u.org_id.slice(0, 8)}</>}
                  {' · requested '}{timeAgo(u.created_at)}
                </div>
              </div>
              <button
                onClick={() => decide(u, 'reject')}
                disabled={!!busy[u.id]}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-red-50 disabled:opacity-50"
                style={{ color: '#dc2626', borderColor: '#fca5a5', background: '#fff5f5' }}
              >
                {busy[u.id] === 'reject' ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                Reject
              </button>
              <button
                onClick={() => decide(u, 'approve')}
                disabled={!!busy[u.id]}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-emerald-50 disabled:opacity-50"
                style={{ color: '#059669', borderColor: '#6ee7b7', background: '#f0fdf4' }}
              >
                {busy[u.id] === 'approve' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                Approve
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
