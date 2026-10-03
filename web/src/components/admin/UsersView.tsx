import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, Users } from 'lucide-react'
import { fetchUsers, updateUser, type ManagedUser, type UserRole } from '../../services/api'
import { Avatar, EmptyState, RoleBadge, StatusBadge, timeAgo } from './shared'

interface Props {
  currentUserId: string
  isSuper: boolean
  orgNames: Record<string, string>
  showOrgColumn: boolean
}

export function UsersView({ currentUserId, isSuper, orgNames, showOrgColumn }: Props) {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setError('')
    try {
      setUsers(await fetchUsers())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function change(user: ManagedUser, fields: { role?: UserRole; status?: 'active' | 'disabled' }) {
    setBusy((prev) => ({ ...prev, [user.id]: true }))
    setError('')
    try {
      const updated = await updateUser(user.id, fields)
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...updated } : u)))
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not update ${user.username}`)
    } finally {
      setBusy((prev) => { const next = { ...prev }; delete next[user.id]; return next })
    }
  }

  async function remove(user: ManagedUser) {
    if (!confirm(`Are you sure you want to disable ${user.display_name}?`)) return
    setBusy((prev) => ({ ...prev, [user.id]: true }))
    setError('')
    try {
      await updateUser(user.id, { status: 'disabled' })
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not disable ${user.username}`)
    } finally {
      setBusy((prev) => { const next = { ...prev }; delete next[user.id]; return next })
    }
  }

  function canManage(u: ManagedUser): boolean {
    if (u.id === currentUserId) return false
    if (u.role === 'super_admin') return false
    if (u.role === 'admin' && !isSuper) return false
    if (u.status === 'pending' || u.status === 'rejected') return false
    return true
  }

  const roleOptions: UserRole[] = isSuper
    ? ['doctor', 'nurse', 'er_coordinator', 'ot_manager', 'approver', 'admin']
    : ['doctor', 'nurse', 'er_coordinator', 'ot_manager', 'approver']

  const roleLabels: Record<string, string> = {
    doctor: 'Doctor', nurse: 'Nurse', er_coordinator: 'ER Coordinator',
    ot_manager: 'OT Manager', approver: 'Approver', admin: 'Admin',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users size={15} style={{ color: '#1e3a6e' }} />
          <h2 className="text-sm font-semibold" style={{ color: '#1a2744' }}>Users</h2>
          <span className="text-[11px]" style={{ color: '#9aa3b2' }}>{users.length} total</span>
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
        <EmptyState message="No users found." />
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
                  <StatusBadge status={u.status} />
                  {u.id === currentUserId && (
                    <span className="text-[10px] font-medium" style={{ color: '#9aa3b2' }}>(you)</span>
                  )}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: '#9aa3b2' }}>
                  @{u.username}
                  {showOrgColumn && u.org_id && <> · {orgNames[u.org_id] ?? u.org_id.slice(0, 8)}</>}
                  {' · joined '}{timeAgo(u.created_at)}
                </div>
              </div>

              {canManage(u) && (
                <>
                  <select
                    value={u.role}
                    disabled={!!busy[u.id]}
                    onChange={(e) => change(u, { role: e.target.value as UserRole })}
                    className="px-2 py-1.5 rounded-lg text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
                    style={{ background: '#f5f0e8', border: '1px solid #e8e1d4', color: '#1a2744' }}
                  >
                    {roleOptions.map((r) => (
                      <option key={r} value={r}>{roleLabels[r] ?? r}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => change(u, { status: u.status === 'disabled' ? 'active' : 'disabled' })}
                    disabled={!!busy[u.id]}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 ${
                      u.status === 'disabled'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                    }`}
                  >
                    {busy[u.id] && <Loader2 size={12} className="animate-spin" />}
                    {u.status === 'disabled' ? 'Enable' : 'Disable'}
                  </button>
                  <button
                    onClick={() => remove(u)}
                    disabled={!!busy[u.id]}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                    style={{ background: '#fff', border: '1px solid #e8e1d4', color: '#9aa3b2' }}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
