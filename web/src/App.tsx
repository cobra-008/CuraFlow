import { useEffect, useState } from 'react'
import { useStore } from './store'
import { AuthScreen } from './components/AuthScreen'
import { CuraFlowShell } from './components/shell/CuraFlowShell'
import { useSessionWebSocket } from './hooks/useSessionWebSocket'
import { ApprovalModal } from './components/execution/ApprovalModal'
import { PatientIdentificationModal } from './components/execution/PatientIdentificationModal'

import { getToken, setToken, getMe, type AuthUser } from './services/api'
import { Loader2 } from 'lucide-react'

// Embedded in the widget's overlay iframe -- a widget_init handshake carrying a
// fresh token is expected shortly (see below), so the boot-check must not
// conclude "not logged in" the instant it doesn't find one already in localStorage.
const isEmbedded = typeof window !== 'undefined' && window.self !== window.top

function AppShell() {
  useSessionWebSocket()   // opens WS to /ws/{sessionId} whenever a session is active

  const loadAgentRegistry = useStore((s) => s.loadAgentRegistry)
  useEffect(() => { loadAgentRegistry() }, [loadAgentRegistry])

  const sessionId = useStore((s) => s.sessionId)
  const patientIdentificationPending = useStore((s) => s.patientIdentificationPending)
  const patientIdentificationCount = useStore((s) => s.patientIdentificationCount)
  const clearPatientIdentification = useStore((s) => s.clearPatientIdentification)
  const activeView = useStore((s) => s.activeView)
  const currentUser = useStore((s) => s.currentUser)
  const setActiveView = useStore((s) => s.setActiveView)

  const isApprover = currentUser?.role === 'approver'
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

  useEffect(() => {
    if (activeView === 'approvals' && !isApprover) setActiveView('command')
    if (activeView === 'admin' && !isAdmin) setActiveView('command')
  }, [activeView, isApprover, isAdmin, setActiveView])

  return (
    <>
      <CuraFlowShell />
      {activeView === 'orchestrator' && <ApprovalModal />}
      {patientIdentificationPending && sessionId && (
        <PatientIdentificationModal
          sessionId={sessionId}
          expectedCount={patientIdentificationCount}
          autonomous={false}
          onConfirm={clearPatientIdentification}
          onCancel={clearPatientIdentification}
        />
      )}
    </>
  )
}

export default function App() {
  const setCurrentUser = useStore((s) => s.setCurrentUser)
  const currentUser = useStore((s) => s.currentUser)
  const loadSession = useStore((s) => s.loadSession)
  const setActiveView = useStore((s) => s.setActiveView)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function onWidgetInit(e: MessageEvent) {
      if (e.data?.type !== 'widget_init') return
      const { token, sessionId } = e.data
      if (token) {
        setToken(token)
        try {
          const user = await getMe()
          if (cancelled) return
          setCurrentUser(user)
        } catch (_) {
          if (!cancelled) setChecking(false)
          return
        }
      }
      // Idempotent: only (re)load if this is a DIFFERENT session than the iframe is
      // already tracking. Re-expanding the same live session must NOT call loadSession —
      // that does a destructive snapshot rebuild and wipes the live WS-driven state.
      if (sessionId && sessionId !== useStore.getState().sessionId) {
        loadSession(sessionId)
      }
      setActiveView('orchestrator')
      setChecking(false)
    }
    window.addEventListener('message', onWidgetInit)
    return () => { cancelled = true; window.removeEventListener('message', onWidgetInit) }
  }, [setCurrentUser, loadSession, setActiveView])

  useEffect(() => {
    const token = getToken()
    if (!token) {
      // Embedded: a fresh token is likely already on its way via widget_init
      // (postMessage necessarily arrives after this synchronous check runs) --
      // hold the loader instead of flashing AuthScreen and racing the user into
      // signing in as someone else. Give up after a few seconds in case the
      // parent page never sends the handshake (standalone iframe, broken embed).
      // Not embedded: there's no handshake coming, resolve immediately as before.
      if (isEmbedded) {
        const timeout = setTimeout(() => setChecking(false), 4000)
        return () => clearTimeout(timeout)
      }
      setChecking(false)
      return
    }
    getMe()
      .then((user: AuthUser) => {
        setCurrentUser(user)
        setChecking(false)
        if (user.role === 'approver') {
          setActiveView('approvals')
        } else if (user.role === 'super_admin' || user.role === 'admin') {
          setActiveView('orchestrator')
          const savedId = localStorage.getItem('hospilot_session_id')
          if (savedId) loadSession(savedId)
        } else {
          setActiveView('hospital')
          const savedId = localStorage.getItem('hospilot_session_id')
          if (savedId) loadSession(savedId)
        }
      })
      .catch(() => {
        setChecking(false)
      })
  }, [setCurrentUser, loadSession, setActiveView])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f5f0e8' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#1e3a6e' }}>
            <span className="text-white font-bold text-lg">CF</span>
          </div>
          <Loader2 size={20} className="animate-spin" style={{ color: '#1e3a6e' }} />
          <div className="text-sm" style={{ color: '#9aa3b2' }}>Loading CuraFlow…</div>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return <AuthScreen onAuth={(user) => setCurrentUser(user)} />
  }

  return <AppShell />
}
