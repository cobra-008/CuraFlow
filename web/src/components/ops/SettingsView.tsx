import { useState } from 'react'
import { User, KeyRound, CheckCircle2, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useStore } from '../../store'
import { changePassword } from '../../services/api'

// ── CuraFlow theme tokens ─────────────────────────────────────────────────────
const CF = {
  bg: '#f5f0e8',
  card: '#ffffff',
  border: '#e8e1d4',
  navy: '#1e3a6e',
  textMain: '#1a2744',
  textSub: '#6b5c40',
  textMuted: '#9aa3b2',
}

export function SettingsView() {
  const currentUser = useStore((s) => s.currentUser)

  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const initials = currentUser
    ? currentUser.display_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const roleLabel =
    currentUser?.role === 'super_admin' ? 'Platform · Super Admin'
    : currentUser?.role === 'admin' ? 'Hospital Admin'
    : currentUser?.role === 'er_coordinator' ? 'ER Coordinator'
    : currentUser?.role === 'ot_manager' ? 'OT Manager'
    : currentUser?.role === 'nurse' ? 'Nurse'
    : currentUser?.role === 'doctor' ? 'Doctor'
    : currentUser?.role === 'approver' ? 'Operations Manager'
    : 'Clinical Staff'

  const pwdStrength = (() => {
    if (!newPwd) return null
    if (newPwd.length < 8) return { label: 'Too short', color: '#ef4444', width: '20%' }
    if (newPwd.length < 10) return { label: 'Weak', color: '#f97316', width: '40%' }
    if (!/[A-Z]/.test(newPwd) || !/[0-9]/.test(newPwd)) return { label: 'Fair', color: '#eab308', width: '60%' }
    if (newPwd.length >= 12) return { label: 'Strong', color: '#22c55e', width: '100%' }
    return { label: 'Good', color: '#3b82f6', width: '80%' }
  })()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (newPwd !== confirmPwd) {
      setError('New passwords do not match.')
      return
    }
    if (newPwd.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }

    setLoading(true)
    try {
      const res = await changePassword(currentPwd, newPwd)
      setSuccess(res.message)
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="p-6 h-full flex flex-col items-center justify-start"
      style={{ fontFamily: "'Inter', system-ui, sans-serif", background: CF.bg }}
    >
      <div className="w-full max-w-lg space-y-5">

        {/* Page Title */}
        <div className="mb-2">
          <h1 className="text-2xl font-bold" style={{ color: CF.textMain }}>Account Settings</h1>
          <p className="text-sm mt-1" style={{ color: CF.textMuted }}>Manage your profile and security credentials</p>
        </div>

        {/* ── Account Details Card ────────────────────────────────────── */}
        <div className="rounded-2xl p-6" style={{ background: CF.card, border: `1px solid ${CF.border}` }}>
          <div className="flex items-center gap-2 mb-5">
            <User size={16} style={{ color: CF.navy }} />
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: CF.textSub }}>Account Details</h2>
          </div>

          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
              style={{ background: CF.navy }}
            >
              {initials}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="text-lg font-bold truncate" style={{ color: CF.textMain }}>
                {currentUser?.display_name ?? '—'}
              </div>
              <div className="text-sm font-medium mt-0.5" style={{ color: CF.textMuted }}>
                @{currentUser?.username ?? '—'}
              </div>
              <div className="mt-2">
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: '#e8f0fe', color: CF.navy, border: `1px solid #c7d7fb` }}
                >
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Read-only username field */}
          <div className="mt-5 pt-5" style={{ borderTop: `1px solid ${CF.border}` }}>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: CF.textSub }}>
              Username
            </label>
            <div
              className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm font-medium"
              style={{ background: CF.bg, border: `1px solid ${CF.border}`, color: CF.textMain }}
            >
              <User size={14} style={{ color: CF.textMuted, flexShrink: 0 }} />
              {currentUser?.username ?? '—'}
              <span
                className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                style={{ background: '#e8e1d4', color: CF.textSub }}
              >
                Read-only
              </span>
            </div>
            <p className="text-xs mt-1.5" style={{ color: CF.textMuted }}>
              Username cannot be changed. Contact your administrator if needed.
            </p>
          </div>
        </div>

        {/* ── Change Password Card ────────────────────────────────────── */}
        <div className="rounded-2xl p-6" style={{ background: CF.card, border: `1px solid ${CF.border}` }}>
          <div className="flex items-center gap-2 mb-5">
            <KeyRound size={16} style={{ color: CF.navy }} />
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: CF.textSub }}>Update Password</h2>
          </div>

          {/* Feedback banners */}
          {success && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-medium text-emerald-700">
              <CheckCircle2 size={15} className="flex-shrink-0" />
              {success}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 text-sm font-medium text-red-700">
              <AlertCircle size={15} className="flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: CF.textSub }}>
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  required
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  placeholder="Enter your current password"
                  className="w-full px-3 py-2.5 pr-10 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: CF.bg,
                    border: `1px solid ${CF.border}`,
                    color: CF.textMain,
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = CF.navy }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = CF.border }}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: CF.textMuted }}
                >
                  {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: CF.textSub }}>
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  required
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full px-3 py-2.5 pr-10 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: CF.bg,
                    border: `1px solid ${CF.border}`,
                    color: CF.textMain,
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = CF.navy }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = CF.border }}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: CF.textMuted }}
                >
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {/* Strength indicator */}
              {pwdStrength && (
                <div className="mt-2">
                  <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: CF.border }}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: pwdStrength.width, background: pwdStrength.color }}
                    />
                  </div>
                  <p className="text-[11px] mt-1 font-medium" style={{ color: pwdStrength.color }}>
                    {pwdStrength.label}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: CF.textSub }}>
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3 py-2.5 pr-10 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: CF.bg,
                    border: confirmPwd && confirmPwd !== newPwd ? '1px solid #fca5a5' : `1px solid ${CF.border}`,
                    color: CF.textMain,
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = confirmPwd && confirmPwd !== newPwd ? '#fca5a5' : CF.navy }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = confirmPwd && confirmPwd !== newPwd ? '#fca5a5' : CF.border }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: CF.textMuted }}
                >
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {confirmPwd && confirmPwd !== newPwd && (
                <p className="text-[11px] mt-1 text-red-500 font-medium">Passwords do not match</p>
              )}
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={loading || !currentPwd || !newPwd || !confirmPwd}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: CF.navy }}
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                {loading ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  )
}
