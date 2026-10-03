import { useCallback, useEffect, useState } from 'react'
import { Building2, Loader2, Plus, RefreshCw } from 'lucide-react'
import { createOrg, fetchOrgs, updateOrg, type Organization } from '../../services/api'
import { EmptyState, StatusBadge, timeAgo } from './shared'

export function OrgsView() {
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [creating, setCreating] = useState(false)
  const [provisioningSlug, setProvisioningSlug] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError('')
    try {
      setOrgs(await fetchOrgs())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load organizations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    if (!provisioningSlug) return
    let cancelled = false
    const poll = setInterval(async () => {
      try {
        const list = await fetchOrgs()
        if (cancelled) return
        setOrgs(list)
        const org = list.find((o) => o.slug === provisioningSlug)
        if (org && org.status !== 'provisioning') setProvisioningSlug(null)
      } catch { /* transient */ }
    }, 2500)
    const giveUp = setTimeout(() => { if (!cancelled) setProvisioningSlug(null) }, 90_000)
    return () => { cancelled = true; clearInterval(poll); clearTimeout(giveUp) }
  }, [provisioningSlug])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setCreating(true)
    try {
      const org = await createOrg(newName.trim(), newSlug.trim().toLowerCase())
      setOrgs((prev) => [...prev, org])
      setProvisioningSlug(org.slug)
      setNewName(''); setNewSlug(''); setShowCreate(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create organization')
    } finally {
      setCreating(false)
    }
  }

  async function toggleStatus(org: Organization) {
    setBusy((prev) => ({ ...prev, [org.id]: true }))
    setError('')
    try {
      const updated = await updateOrg(org.id, { status: org.status === 'disabled' ? 'active' : 'disabled' })
      setOrgs((prev) => prev.map((o) => (o.id === org.id ? { ...o, ...updated } : o)))
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not update ${org.name}`)
    } finally {
      setBusy((prev) => { const next = { ...prev }; delete next[org.id]; return next })
    }
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors'
  const inputStyle = { background: '#f5f0e8', border: '1px solid #e8e1d4', color: '#1a2744' }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Building2 size={15} style={{ color: '#7c3aed' }} />
          <h2 className="text-sm font-semibold" style={{ color: '#1a2744' }}>Organizations</h2>
          <span className="text-[11px]" style={{ color: '#9aa3b2' }}>{orgs.length} total</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-slate-100"
            style={{ color: '#6b5c40', border: '1px solid #e8e1d4', background: '#f5f0e8' }}
          >
            <RefreshCw size={12} /> Refresh
          </button>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors hover:opacity-90"
            style={{ background: '#1e3a6e' }}
          >
            <Plus size={12} /> New Organization
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
      )}

      {provisioningSlug && (
        <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
          <Loader2 size={13} className="text-blue-600 animate-spin flex-shrink-0" />
          <div className="text-xs text-blue-700 leading-snug">
            Provisioning <strong>{provisioningSlug}</strong> — creating the tenant database and wiring Hasura.
            This usually takes a few seconds; it will go <strong>active</strong> automatically.
          </div>
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="flex items-end gap-3 mb-4 p-4 rounded-xl"
          style={{ background: '#fff', border: '1px solid #e8e1d4' }}
        >
          <div className="flex-1">
            <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#6b5c40' }}>
              Hospital Name
            </label>
            <input
              required value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="Acme General Hospital" className={inputCls} style={inputStyle}
            />
          </div>
          <div className="flex-1">
            <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#6b5c40' }}>
              Slug (a-z, 0-9, hyphens)
            </label>
            <input
              required value={newSlug} onChange={(e) => setNewSlug(e.target.value)}
              pattern="[a-z0-9][a-z0-9-]*" placeholder="acme-general" className={inputCls} style={inputStyle}
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-60"
            style={{ background: '#1e3a6e' }}
          >
            {creating && <Loader2 size={12} className="animate-spin" />}
            Create
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-14">
          <Loader2 size={20} className="animate-spin" style={{ color: '#1e3a6e' }} />
        </div>
      ) : orgs.length === 0 ? (
        <EmptyState message="No organizations yet." />
      ) : (
        <div className="space-y-2">
          {orgs.map((o) => (
            <div
              key={o.id}
              className="flex items-center gap-3 p-4 rounded-xl transition-shadow hover:shadow-sm"
              style={{ background: '#ffffff', border: '1px solid #e8e1d4' }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#ede9f7', border: '1px solid #c4b5fd' }}
              >
                <Building2 size={16} style={{ color: '#7c3aed' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold truncate" style={{ color: '#1a2744' }}>{o.name}</span>
                  <StatusBadge status={o.status} />
                </div>
                <div className="text-[11px] font-mono mt-0.5" style={{ color: '#9aa3b2' }}>
                  {o.slug}
                  {o.hasura_source && <> · source: {o.hasura_source}</>}
                  {' · created '}{timeAgo(o.created_at)}
                </div>
              </div>
              {o.slug !== 'carer' && o.status !== 'provisioning' && (
                <button
                  onClick={() => toggleStatus(o)}
                  disabled={!!busy[o.id]}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 ${
                    o.status === 'disabled'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                  }`}
                >
                  {busy[o.id] && <Loader2 size={12} className="animate-spin" />}
                  {o.status === 'disabled' ? 'Enable' : 'Disable'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
