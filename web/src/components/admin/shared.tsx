import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import type { UserRole } from '../../services/api'

// ── CuraFlow theme tokens ──────────────────────────────────────────────────────
// bg: #f5f0e8  card: #ffffff  border: #e8e1d4  primary: #1e3a6e
// text-main: #1a2744  text-sub: #6b5c40  text-muted: #9aa3b2

export function SavableNumber({
  value, onSave, min = 0, placeholder, disabled, width = 'w-16',
}: {
  value: number | null
  onSave: (raw: string) => void
  min?: number
  placeholder?: string
  disabled?: boolean
  width?: string
}) {
  const committed = value === null || value === undefined ? '' : String(value)
  const [draft, setDraft] = useState(committed)
  useEffect(() => { setDraft(committed) }, [committed])
  const dirty = draft.trim() !== committed

  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        min={min}
        value={draft}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && dirty) onSave(draft) }}
        className={`${width} px-2 py-1 rounded-md border text-xs text-slate-700 text-right placeholder-slate-400 focus:outline-none focus:border-blue-500 disabled:opacity-50`}
        style={{ background: '#f5f0e8', borderColor: dirty ? '#f59e0b' : '#e8e1d4' }}
      />
      {dirty && (
        <button
          onClick={() => onSave(draft)}
          disabled={disabled}
          title="Apply change"
          className="flex items-center gap-0.5 px-1.5 py-1 rounded-md text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50"
        >
          <Check size={11} /> Save
        </button>
      )}
    </span>
  )
}

export const ROLE_STYLES: Record<UserRole, { label: string; cls: string }> = {
  super_admin:    { label: 'Super Admin',    cls: 'bg-purple-100 text-purple-700 border-purple-200' },
  admin:          { label: 'Admin',          cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  approver:       { label: 'Approver',       cls: 'bg-teal-100 text-teal-700 border-teal-200' },
  doctor:         { label: 'Doctor',         cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  er_coordinator: { label: 'ER Coordinator', cls: 'bg-red-100 text-red-700 border-red-200' },
  ot_manager:     { label: 'OT Manager',     cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  nurse:          { label: 'Nurse',          cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
}

export const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  pending:      { label: 'Pending',      cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  active:       { label: 'Active',       cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rejected:     { label: 'Rejected',     cls: 'bg-red-100 text-red-700 border-red-200' },
  disabled:     { label: 'Disabled',     cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  provisioning: { label: 'Provisioning', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
}

export function RoleBadge({ role }: { role: UserRole }) {
  const s = ROLE_STYLES[role] ?? ROLE_STYLES.doctor
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-semibold ${s.cls}`}>
      {s.label}
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { label: status, cls: 'bg-slate-100 text-slate-500 border-slate-200' }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-semibold ${s.cls}`}>
      {s.label}
    </span>
  )
}

export function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

export function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
      style={{ background: '#1e3a6e' }}
    >
      {initials}
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
        <Check size={20} className="text-slate-300" />
      </div>
      <p className="text-sm font-medium text-slate-500">{message}</p>
    </div>
  )
}
