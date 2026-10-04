import { useEffect, useState } from 'react'
import { Loader2, Clock } from 'lucide-react'
import { loginUser, signupUser, setToken, fetchPublicOrgs, fetchDemoCredentials, type AuthUser, type PublicOrg } from '../services/api'

interface Props {
  onAuth: (user: AuthUser) => void
}

export function AuthScreen({ onAuth }: Props) {
  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')      // post-signup "awaiting approval" message

  const [demoCreds, setDemoCreds] = useState<{ doctor_count: number; nurse_count: number; credentials: any[] } | null>(null)

  useEffect(() => {
    fetchDemoCredentials().then(setDemoCreds).catch(() => {})
  }, [])

  // Login fields
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Signup fields
  const [signupUsername, setSignupUsername] = useState('')
  const [signupDisplayName, setSignupDisplayName] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupConfirm, setSignupConfirm] = useState('')
  const [signupOrgId, setSignupOrgId] = useState('')
  const [signupRole, setSignupRole] = useState<'doctor' | 'nurse' | 'er_coordinator' | 'ot_manager' | 'approver' | 'admin'>('doctor')

  // Quick Demo Login helper
  async function fillAndLogin(u: string, p: string) {
    setLoginUsername(u)
    setLoginPassword(p)
    setError('')
    setNotice('')
    setLoading(true)
    try {
      const res = await loginUser(u, p)
      setToken(res.token)
      onAuth(res.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  // Org picker (multi-tenancy): the hospital this account belongs to.
  const [orgs, setOrgs] = useState<PublicOrg[]>([])
  useEffect(() => {
    fetchPublicOrgs()
      .then((list) => {
        setOrgs(list)
        if (list.length === 1) setSignupOrgId(list[0].id)
      })
      .catch(() => setOrgs([]))
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    setLoading(true)
    try {
      const res = await loginUser(loginUsername.trim(), loginPassword)
      setToken(res.token)
      onAuth(res.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    if (signupPassword !== signupConfirm) {
      setError('Passwords do not match')
      return
    }
    if (!signupOrgId) {
      setError('Select your organization')
      return
    }
    setLoading(true)
    try {
      // No token comes back -- the account is pending until an admin approves it.
      const res = await signupUser(
        signupUsername.trim(), signupPassword, signupDisplayName.trim(), signupOrgId, signupRole)
      setNotice(res.message || 'Account created. Awaiting approval by your organization admin.')
      setTab('login')
      setLoginUsername(signupUsername.trim())
      setSignupUsername(''); setSignupDisplayName(''); setSignupPassword(''); setSignupConfirm('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none transition-colors'
  const labelCls = 'block text-xs font-semibold mb-1.5'

  return (
    <div className="auth-screen h-screen overflow-y-auto flex" style={{ background: '#f5f0e8' }}>
      {/* Left side: sidebar background */}
      <div className="hidden md:flex flex-col items-start justify-end p-10 flex-shrink-0" style={{
        width: '360px',
        backgroundImage: 'url(/sidebar-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
        <div style={{ background: 'rgba(255,248,235,0.88)', borderRadius: '12px', padding: '20px', maxWidth: '280px' }}>
          <div className="flex items-center gap-3 mb-3">
            <img src="/logo.jpeg" alt="CuraFlow" className="w-10 h-10 rounded-xl object-cover shadow-sm" />
            <div>
              <div className="font-bold" style={{ color: '#1a2744' }}>CuraFlow</div>
              <div className="text-xs" style={{ color: '#6b5c40' }}>Hospital Operations Orchestration</div>
            </div>
          </div>
          <p className="text-sm italic" style={{ color: '#5a4530' }}>A more coordinated hospital.<br />For every patient, every time.</p>
        </div>
      </div>

      {/* Right side: login form */}
      <div className="flex-1 flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm h-fit my-auto">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.jpeg" alt="CuraFlow" className="w-16 h-16 rounded-2xl object-cover mb-3 shadow-md" />
          <h1 className="text-xl font-bold" style={{ color: '#1a2744' }}>CuraFlow</h1>
          <p className="text-xs mt-0.5" style={{ color: '#9aa3b2' }}>Hospital Operations Command Center</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6" style={{ background: '#ffffff', border: '1px solid #e8e1d4', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-lg mb-6" style={{ background: '#f5f0e8' }}>
            {(['login', 'signup'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); setNotice('') }}
                className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all`}
                style={{
                  background: tab === t ? '#1e3a6e' : 'transparent',
                  color: tab === t ? '#fff' : '#9aa3b2',
                }}
              >
                {t === 'login' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          {notice && (
            <div className="flex items-start gap-2 mb-4 p-3 rounded-lg" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
              <Clock size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#d97706' }} />
              <p className="text-xs leading-snug" style={{ color: '#92400e' }}>{notice}</p>
            </div>
          )}

          {tab === 'login' ? (
            <div className="space-y-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className={labelCls}>Username</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    autoComplete="username"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="Enter username"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Password</label>
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter password"
                    className={inputCls}
                  />
                </div>
                {error && <p className="text-xs font-medium" style={{ color: '#dc2626' }}>{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm transition-opacity hover:opacity-90"
                  style={{ background: '#1e3a6e' }}
                >
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  Sign in
                </button>
              </form>

              {/* Quick Persona Demo Logins */}
              <div className="pt-3 border-t" style={{ borderColor: '#eee6da' }}>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-between">
                  <span>Quick Demo Logins</span>
                  <span className="text-[10px] font-normal text-slate-400">1-click sign in</span>
                </div>
                
                {demoCreds ? (
                  <div className="mb-3 text-[10px] text-slate-500 flex justify-between">
                    <span>Active Doctors: <strong>{demoCreds.doctor_count}</strong></span>
                    <span>Active Nurses: <strong>{demoCreds.nurse_count}</strong></span>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => fillAndLogin('admin', 'admin')}
                    disabled={loading}
                    className="px-2 py-1.5 rounded-lg border text-left text-xs hover:border-blue-700 hover:bg-blue-50/50 transition-all"
                    style={{ borderColor: '#e2d8c7', background: '#faf7f2' }}
                  >
                    <div className="font-bold text-slate-800 flex items-center gap-1">
                      <span>👑</span> Admin
                    </div>
                    <div className="text-[10px] text-slate-400">Director</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => fillAndLogin('doctor1', 'password123')}
                    disabled={loading}
                    className="px-2 py-1.5 rounded-lg border text-left text-xs hover:border-blue-700 hover:bg-blue-50/50 transition-all"
                    style={{ borderColor: '#e2d8c7', background: '#faf7f2' }}
                  >
                    <div className="font-bold text-slate-800 flex items-center gap-1">
                      <span>🩺</span> Doctor
                    </div>
                    <div className="text-[10px] text-slate-400">Chief MD</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => fillAndLogin('nurse1', 'password123')}
                    disabled={loading}
                    className="px-2 py-1.5 rounded-lg border text-left text-xs hover:border-blue-700 hover:bg-blue-50/50 transition-all"
                    style={{ borderColor: '#e2d8c7', background: '#faf7f2' }}
                  >
                    <div className="font-bold text-slate-800 flex items-center gap-1">
                      <span>👩‍⚕️</span> Nurse
                    </div>
                    <div className="text-[10px] text-slate-400">Charge Nurse</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => fillAndLogin('er_coord', 'password123')}
                    disabled={loading}
                    className="px-2 py-1.5 rounded-lg border text-left text-xs hover:border-blue-700 hover:bg-blue-50/50 transition-all"
                    style={{ borderColor: '#e2d8c7', background: '#faf7f2' }}
                  >
                    <div className="font-bold text-slate-800 flex items-center gap-1">
                      <span>🚨</span> ER Coord
                    </div>
                    <div className="text-[10px] text-slate-400">Emergency</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => fillAndLogin('ot_mgr', 'password123')}
                    disabled={loading}
                    className="px-2 py-1.5 rounded-lg border text-left text-xs hover:border-blue-700 hover:bg-blue-50/50 transition-all"
                    style={{ borderColor: '#e2d8c7', background: '#faf7f2' }}
                  >
                    <div className="font-bold text-slate-800 flex items-center gap-1">
                      <span>🏥</span> OT Mgr
                    </div>
                    <div className="text-[10px] text-slate-400">Surgical</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => fillAndLogin('approver', 'approver')}
                    disabled={loading}
                    className="px-2 py-1.5 rounded-lg border text-left text-xs hover:border-blue-700 hover:bg-blue-50/50 transition-all"
                    style={{ borderColor: '#e2d8c7', background: '#faf7f2' }}
                  >
                    <div className="font-bold text-slate-800 flex items-center gap-1">
                      <span>📋</span> Approver
                    </div>
                    <div className="text-[10px] text-slate-400">Clinical</div>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className={labelCls}>Organization</label>
                <select
                  required
                  value={signupOrgId}
                  onChange={(e) => setSignupOrgId(e.target.value)}
                  className={inputCls}
                >
                  <option value="" disabled>Select your hospital…</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Role</label>
                <select
                  value={signupRole}
                  onChange={(e) => setSignupRole(e.target.value as any)}
                  className={inputCls}
                >
                  <option value="doctor">Doctor</option>
                  <option value="nurse">Nurse</option>
                  <option value="er_coordinator">ER Coordinator</option>
                  <option value="ot_manager">OT Manager</option>
                  <option value="approver">Clinical Approver</option>
                  <option value="admin">Administrator</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Your account needs approval by {signupRole === 'admin' ? 'the platform admin' : "your organization's admin"} before you can sign in.
                </p>
              </div>
              <div>
                <label className={labelCls}>Username</label>
                <input
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  value={signupUsername}
                  onChange={(e) => setSignupUsername(e.target.value)}
                  placeholder="Choose a username"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Display name</label>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  value={signupDisplayName}
                  onChange={(e) => setSignupDisplayName(e.target.value)}
                  placeholder="Dr. Jane Smith"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Password</label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="Create a password"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Confirm password</label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={signupConfirm}
                  onChange={(e) => setSignupConfirm(e.target.value)}
                  placeholder="Repeat password"
                  className={inputCls}
                />
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: '#1e3a6e' }}
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                Create account
              </button>
            </form>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}
