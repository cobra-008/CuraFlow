import { useEffect, useState } from 'react'
import { Building2, UserCheck, Users, X, ShieldCheck } from 'lucide-react'
import { useStore } from '../../store'
import { fetchOrgs, fetchPendingUsers } from '../../services/api'
import { PendingUsersView } from './PendingUsersView'
import { UsersView } from './UsersView'
import { OrgsView } from './OrgsView'

type AdminTab = 'pending' | 'users' | 'orgs'

export function AdminPage({ onClose }: { onClose?: () => void }) {
  const currentUser = useStore((s) => s.currentUser)
  const isSuper = currentUser?.role === 'super_admin'
  const [tab, setTab] = useState<AdminTab>('pending')
  const [pendingCount, setPendingCount] = useState(0)
  const [orgNames, setOrgNames] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isSuper) return
    fetchOrgs()
      .then((orgs) => setOrgNames(Object.fromEntries(orgs.map((o) => [o.id, o.name]))))
      .catch(() => setOrgNames({}))
  }, [isSuper])

  useEffect(() => {
    let cancelled = false
    const poll = () =>
      fetchPendingUsers()
        .then((us) => { if (!cancelled) setPendingCount(us.length) })
        .catch(() => {})
    poll()
    const id = setInterval(poll, 15000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  if (!currentUser) return null

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode; badge?: number; show: boolean }[] = [
    { id: 'pending', label: 'Pending Sign-ups', icon: <UserCheck size={13} />, badge: pendingCount, show: true },
    { id: 'users',   label: 'Users',             icon: <Users size={13} />,     show: true },
    { id: 'orgs',    label: 'Organizations',     icon: <Building2 size={13} />, show: isSuper },
  ]

  return (
    <div className="flex flex-col h-full" style={{ background: '#f5f0e8', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 flex-shrink-0"
        style={{ background: '#1e3a6e', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <ShieldCheck size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">Administration</h1>
            <p className="text-[11px] text-blue-200">
              {isSuper ? 'Platform-wide · All Organizations' : 'Manage your organization'}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex-shrink-0 px-6 pt-4 pb-0">
        <div
          className="flex items-center gap-1 p-1 rounded-xl w-fit"
          style={{ background: '#ffffff', border: '1px solid #e8e1d4' }}
        >
          {tabs.filter((t) => t.show).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: tab === t.id ? '#1e3a6e' : 'transparent',
                color: tab === t.id ? '#ffffff' : '#6b5c40',
              }}
            >
              {t.icon} {t.label}
              {!!t.badge && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{
                    background: tab === t.id ? 'rgba(255,255,255,0.25)' : '#fef3c7',
                    color: tab === t.id ? '#ffffff' : '#92400e',
                  }}
                >
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {tab === 'pending' && (
          <PendingUsersView orgNames={orgNames} showOrgColumn={isSuper} />
        )}
        {tab === 'users' && (
          <UsersView
            currentUserId={currentUser.id}
            isSuper={isSuper}
            orgNames={orgNames}
            showOrgColumn={isSuper}
          />
        )}
        {tab === 'orgs' && isSuper && <OrgsView />}
      </div>
    </div>
  )
}
