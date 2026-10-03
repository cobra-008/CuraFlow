import { useState, useEffect, useCallback, useRef } from 'react'
import {
  LayoutDashboard, Activity, Bed, GitBranch, FlaskConical,
  Package, AlertTriangle, Bot, BarChart3, Settings,
  ChevronRight, Clock
} from 'lucide-react'
import { CommandCenter } from '../ops/CommandCenter'
import { ApprovalCenter } from '../ops/ApprovalCenter'
import { SimulationView } from '../ops/SimulationView'
import { AgentOpsView } from '../ops/AgentOpsView'
import { SystemHealthView } from '../ops/SystemHealthView'
import { PatientFlowView } from '../ops/PatientFlowView'
import { CapacityManagementView } from '../ops/CapacityManagementView'
import { OrchestrationView } from '../ops/OrchestrationView'
import { ResourcesView } from '../ops/ResourcesView'
import { EmergencyCommandView } from '../ops/EmergencyCommandView'
import { ReportsView } from '../ops/ReportsView'
import { SettingsView } from '../ops/SettingsView'
import { TopBar } from '../TopBar'
import { opsApi, type HospitalState, type Bottleneck, type Recommendation } from '../../services/opsApi'

// ── Placeholder View ───────────────────────────────────────────────────────────
const PlaceholderView = ({ title, status = 'NOT CONFIGURED' }: { title: string; status?: string }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
    <div className="w-16 h-16 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mb-4">
      <AlertTriangle size={28} className="text-amber-500" />
    </div>
    <h2 className="text-lg font-bold text-navy-900 mb-2">{title}</h2>
    <span className="text-xs font-semibold uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
      {status}
    </span>
    <p className="text-sm text-gray-500 mt-4 max-w-md">
      This module is part of the CuraFlow clinical operations platform. It requires backend integration and configuration before live deployment.
    </p>
  </div>
)

// ── Nav items config ───────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    items: [
      { id: 'command',       label: 'Command Center',     icon: LayoutDashboard },
      { id: 'flow',          label: 'Patient Flow',        icon: Activity },
      { id: 'capacity',      label: 'Capacity Management', icon: Bed },
      { id: 'orchestration', label: 'Orchestration',       icon: GitBranch },
      { id: 'simulation',    label: 'Simulation',          icon: FlaskConical },
      { id: 'resources',     label: 'Resources',           icon: Package },
      { id: 'emergency',     label: 'Emergency',           icon: AlertTriangle },
      { id: 'agents',        label: 'Agents',              icon: Bot },
      { id: 'reports',       label: 'Reports',             icon: BarChart3 },
      { id: 'settings',      label: 'Settings',            icon: Settings },
    ],
  },
]

// ── Sidebar content ────────────────────────────────────────────────────────────
function Sidebar({
  activeRoute,
  setActiveRoute,
  hospitalState,
  bottlenecks,
  recommendations,
}: {
  activeRoute: string
  setActiveRoute: (r: string) => void
  hospitalState: HospitalState | null
  bottlenecks: Bottleneck[]
  recommendations: Recommendation[]
}) {
  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })

  const pendingRecs = recommendations.filter(r => r.status === 'pending')
  const criticalBotCount = bottlenecks.filter(b => b.severity === 'critical').length
  const pressure = hospitalState?.pressure

  const priorities = [
    criticalBotCount > 0 ? `Manage ICU saturation` : null,
    hospitalState?.emergency.waiting && hospitalState.emergency.waiting > 15 ? 'Reduce ER waiting time' : null,
    hospitalState?.diagnostics.queue_length && hospitalState.diagnostics.queue_length > 10 ? 'Clear diagnostic backlog' : null,
    'Prepare for emergencies',
  ].filter(Boolean) as string[]

  return (
    <aside
      className="flex flex-col flex-shrink-0 overflow-hidden"
      style={{
        width: '230px',
        backgroundImage: 'url(/sidebar-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        boxShadow: '2px 0 16px rgba(0,0,0,0.12)',
      }}
    >
      {/* Overlay for readability */}
      <div className="flex flex-col flex-1 overflow-y-auto" style={{ background: 'rgba(255,248,235,0.82)' }}>

        {/* Logo */}
        <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: 'rgba(180,150,100,0.3)' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#1e3a6e' }}>
              <span className="text-white font-bold text-xs">CF</span>
            </div>
            <div>
              <div className="font-bold text-sm" style={{ color: '#1a2744' }}>CuraFlow</div>
              <div className="text-2xs leading-tight" style={{ color: '#6b5c40', fontSize: '10px' }}>Hospital Operations Orchestration</div>
            </div>
          </div>
        </div>

        {/* Mission Briefing */}
        <div className="px-3 py-2.5 border-b" style={{ borderColor: 'rgba(180,150,100,0.25)' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Clock size={12} style={{ color: '#6b5c40' }} />
              <span className="font-bold uppercase tracking-widest" style={{ fontSize: '10px', color: '#6b5c40' }}>Mission Briefing</span>
            </div>
            <div className="text-right">
              <div className="font-bold text-xs" style={{ color: '#1a2744' }}>{timeStr}</div>
              <div style={{ fontSize: '9px', color: '#6b5c40' }}>{dateStr}</div>
            </div>
          </div>

          {/* Live badge + pressure status */}
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-bold text-white" style={{ background: '#dc2626', fontSize: '9px' }}>
              <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-white inline-block" />
              LIVE
            </span>
            <span className="text-xs font-semibold" style={{ color: pressure?.label === 'CRITICAL' ? '#dc2626' : pressure?.label === 'HIGH' ? '#ea580c' : '#d97706' }}>
              {pressure ? `${pressure.label} Operational Pressure` : 'Loading…'}
            </span>
          </div>

          {/* Bullet issues */}
          <ul className="space-y-0.5" style={{ fontSize: '11px', color: '#5a4530' }}>
            {hospitalState?.icu.occupancy_pct && hospitalState.icu.occupancy_pct > 80 && (
              <li className="flex items-start gap-1.5">
                <span className="mt-1 w-1 h-1 rounded-full flex-shrink-0" style={{ background: '#dc2626' }} />
                ER waiting time increased
              </li>
            )}
            {hospitalState?.icu.occupancy_pct && hospitalState.icu.occupancy_pct > 70 && (
              <li className="flex items-start gap-1.5">
                <span className="mt-1 w-1 h-1 rounded-full flex-shrink-0" style={{ background: '#ea580c' }} />
                ICU capacity constrained
              </li>
            )}
            {hospitalState?.diagnostics.queue_length && hospitalState.diagnostics.queue_length > 8 && (
              <li className="flex items-start gap-1.5">
                <span className="mt-1 w-1 h-1 rounded-full flex-shrink-0" style={{ background: '#d97706' }} />
                Diagnostic backlog increasing
              </li>
            )}
          </ul>
        </div>

        {/* Key Priorities */}
        <div className="px-3 py-2.5 border-b" style={{ borderColor: 'rgba(180,150,100,0.25)' }}>
          <div className="font-bold uppercase tracking-widest mb-2" style={{ fontSize: '10px', color: '#6b5c40' }}>Key Priorities</div>
          <ol className="space-y-1.5">
            {priorities.map((p, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                  style={{ background: '#1e3a6e', fontSize: '9px' }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: '11px', color: '#3a2e1e' }}>{p}</span>
              </li>
            ))}
          </ol>

          {pendingRecs.length > 0 && (
            <button
              onClick={() => setActiveRoute('approvals')}
              className="mt-2.5 w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: '#1e3a6e', color: '#ffffff' }}
            >
              <span>View All Priorities</span>
              <ChevronRight size={14} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-2">
          {NAV_GROUPS[0].items.map(({ id, label, icon: Icon }) => {
            const active = activeRoute === id
            const hasAlert = id === 'approvals' || (id === 'command' && pendingRecs.length > 0)
            return (
              <button
                key={id}
                onClick={() => setActiveRoute(id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg mb-0.5 text-left transition-all"
                style={{
                  background: active ? 'rgba(30, 58, 110, 0.14)' : 'transparent',
                  color: active ? '#1e3a6e' : '#3d2e1a',
                  fontWeight: active ? 600 : 400,
                  fontSize: '13px',
                }}
              >
                <Icon size={15} style={{ color: active ? '#1e3a6e' : '#6b5040', flexShrink: 0 }} />
                <span className="flex-1">{label}</span>
                {hasAlert && pendingRecs.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-red-500 text-white text-2xs flex items-center justify-center font-bold" style={{ fontSize: '9px' }}>
                    {pendingRecs.length}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Footer tagline */}
        <div className="px-4 py-3 text-center border-t" style={{ borderColor: 'rgba(180,150,100,0.25)' }}>
          <div style={{ fontSize: '10px', color: '#6b5040', lineHeight: 1.5 }}>
            Connected Resources<br />Coordinated Care
          </div>
        </div>
      </div>
    </aside>
  )
}

// ── CuraFlowShell ──────────────────────────────────────────────────────────────
export function CuraFlowShell() {
  const [activeRoute, setActiveRoute] = useState<string>('command')
  const [hospitalState, setHospitalState] = useState<HospitalState | null>(null)
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchSidebarData = useCallback(async () => {
    try {
      const [s, b, r] = await Promise.all([
        opsApi.getHospitalState(),
        opsApi.getBottlenecks(),
        opsApi.getRecommendations(),
      ])
      setHospitalState(s)
      setBottlenecks(b.bottlenecks)
      setRecommendations(r.recommendations)
    } catch (e) {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchSidebarData()
    intervalRef.current = setInterval(fetchSidebarData, 10000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchSidebarData])

  useEffect(() => {
    const handleNavigate = (e: CustomEvent) => {
      if (e.detail) setActiveRoute(e.detail)
    }
    window.addEventListener('curaflow:navigate', handleNavigate as EventListener)
    return () => window.removeEventListener('curaflow:navigate', handleNavigate as EventListener)
  }, [])

  const renderView = () => {
    switch (activeRoute) {
      case 'command':       return <CommandCenter />
      case 'approvals':     return <ApprovalCenter recommendations={recommendations} />
      case 'simulation':    return <SimulationView />
      case 'agents':        return <AgentOpsView />
      case 'system':        return <SystemHealthView />
      case 'capacity':      return <CapacityManagementView />
      case 'flow':          return <PatientFlowView />
      case 'orchestration': return <OrchestrationView />
      case 'resources':     return <ResourcesView />
      case 'emergency':     return <EmergencyCommandView />
      case 'reports':       return <ReportsView />
      case 'settings':      return <SettingsView />
      default:              return <CommandCenter />
    }
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif", background: '#f5f0e8' }}>
      {/* Sidebar */}
      <Sidebar
        activeRoute={activeRoute}
        setActiveRoute={setActiveRoute}
        hospitalState={hospitalState}
        bottlenecks={bottlenecks}
        recommendations={recommendations}
      />

      {/* Right: TopBar + Content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto" style={{ background: '#f5f0e8' }}>
          {renderView()}
        </main>
      </div>
    </div>
  )
}
