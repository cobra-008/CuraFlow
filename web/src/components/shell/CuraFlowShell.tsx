import { useState, useEffect, useCallback, useRef } from 'react'
import { useStore } from '../../store'
import {
  LayoutDashboard, Activity, Bed, GitBranch, FlaskConical,
  Package, AlertTriangle, Bot, BarChart3, Settings,
  ChevronRight
} from 'lucide-react'
import { CommandCenter } from '../ops/CommandCenter'
import { ApprovalCenter } from '../ops/ApprovalCenter'
import { MobileApprovalsView } from '../ops/MobileApprovalsView'
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
import { Toaster } from '../execution/Toaster'
import { useNotificationPipeline } from '../../hooks/useNotificationPipeline'
import { opsApi, type HospitalState, type Bottleneck, type Recommendation } from '../../services/opsApi'


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
  const currentUser = useStore(s => s.currentUser)
  const role = currentUser?.role || 'nurse'

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
        width: '240px',
        backgroundImage: 'url(/sidebar-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        boxShadow: '2px 0 16px rgba(0,0,0,0.06)',
      }}
    >
      {/* Overlay for readability & warm theme */}
      <div className="flex flex-col flex-1 overflow-y-auto" style={{ background: 'rgba(255,249,240,0.88)' }}>

        {/* Logo Header */}
        <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: 'rgba(180,150,100,0.2)' }}>
          <div className="flex items-center gap-3">
            <img src="/logo.jpeg" alt="CuraFlow" className="w-9 h-9 rounded-xl object-cover shadow-sm" />
            <div>
              <div className="font-bold text-base leading-tight" style={{ color: '#1a2744' }}>CuraFlow</div>
              <div className="text-[11px] font-medium leading-tight mt-0.5" style={{ color: '#6b5c40' }}>Hospital Orchestration</div>
            </div>
          </div>

          {/* Clean Operational Status Capsule */}
          <div className="mt-3.5 flex items-center justify-between px-3 py-2 rounded-xl"
            style={{ background: 'rgba(255, 255, 255, 0.7)', border: '1px solid rgba(180,150,100,0.25)' }}>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ background: pressure?.label === 'CRITICAL' ? '#dc2626' : pressure?.label === 'HIGH' ? '#ea580c' : '#16a34a' }} />
                <span className="relative inline-flex rounded-full h-2 w-2"
                  style={{ background: pressure?.label === 'CRITICAL' ? '#dc2626' : pressure?.label === 'HIGH' ? '#ea580c' : '#16a34a' }} />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: pressure?.label === 'CRITICAL' ? '#dc2626' : pressure?.label === 'HIGH' ? '#ea580c' : '#16a34a' }}>
                {pressure?.label ?? 'NORMAL'}
              </span>
            </div>
            {pendingRecs.length > 0 && (
              <button
                onClick={() => setActiveRoute('approvals')}
                className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full text-white transition-opacity hover:opacity-90"
                style={{ background: '#1e3a6e' }}
                title="Pending recommendations"
              >
                {pendingRecs.length} Approvals
              </button>
            )}
          </div>
        </div>

        {/* Navigation Items with Generous Padding */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_GROUPS[0].items.filter(item => {
            // Apply RBAC filters based on CuraFlow_RBAC_Design.md
            if (role === 'super_admin' || role === 'admin') return true;
            if (role === 'er_coordinator') return ['emergency', 'command', 'flow', 'capacity', 'orchestration', 'reports', 'settings'].includes(item.id);
            if (role === 'ot_manager') return ['command', 'resources', 'capacity', 'reports', 'settings'].includes(item.id);
            if (role === 'doctor') return ['command', 'flow', 'capacity', 'reports', 'settings'].includes(item.id);
            if (role === 'nurse') return ['command', 'capacity', 'resources', 'reports', 'settings'].includes(item.id);
            return false;
          }).map(({ id, label, icon: Icon }) => {
            const active = activeRoute === id
            const hasAlert = id === 'approvals' || (id === 'command' && pendingRecs.length > 0)
            return (
              <button
                key={id}
                onClick={() => setActiveRoute(id)}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all"
                style={{
                  background: active ? 'rgba(30, 58, 110, 0.12)' : 'transparent',
                  color: active ? '#1e3a6e' : '#3d2e1a',
                  fontWeight: active ? 600 : 500,
                  fontSize: '13.5px',
                  border: active ? '1px solid rgba(30, 58, 110, 0.2)' : '1px solid transparent',
                }}
              >
                <Icon size={16} style={{ color: active ? '#1e3a6e' : '#6b5040', flexShrink: 0 }} />
                <span className="flex-1 truncate">{label}</span>
                {hasAlert && pendingRecs.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                    {pendingRecs.length}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Bottom Priorities Capsule */}
        {priorities.length > 0 && (
          <div className="p-3 mx-3 mb-3 rounded-xl border"
            style={{ background: 'rgba(255, 255, 255, 0.65)', borderColor: 'rgba(180,150,100,0.25)' }}>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#6b5c40' }}>
              Key Operational Priority
            </div>
            <div className="text-xs font-semibold truncate" style={{ color: '#1a2744' }}>
              {priorities[0]}
            </div>
            {pendingRecs.length > 0 && (
              <button
                onClick={() => setActiveRoute('approvals')}
                className="mt-2 w-full flex items-center justify-between text-[11px] font-semibold text-blue-800 hover:underline"
              >
                <span>Review Recommendations</span>
                <ChevronRight size={12} />
              </button>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-3 text-center border-t" style={{ borderColor: 'rgba(180,150,100,0.2)' }}>
          <div className="text-[11px] font-medium" style={{ color: '#8a7458' }}>
            Connected Resources · Coordinated Care
          </div>
        </div>
      </div>
    </aside>
  )
}

// ── CuraFlowShell ──────────────────────────────────────────────────────────────
export function CuraFlowShell() {
  const currentUser = useStore(s => s.currentUser)
  const role = currentUser?.role || 'nurse'
  
  const [activeRoute, setActiveRoute] = useState<string>('command')
  const [hospitalState, setHospitalState] = useState<HospitalState | null>(null)
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Automated notification pipeline hook
  useNotificationPipeline(hospitalState)

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
    // Orchestration needs full h-full for the ReactFlow canvas — no scroll wrapper
    if (activeRoute === 'orchestration') return <OrchestrationView />
    // All other views scroll normally inside a full-height scroll container
    return (
      <div className="flex-1 overflow-auto h-full">
        {(() => { switch (activeRoute) {
          case 'command':    return <CommandCenter />
          case 'approvals':  return (role === 'doctor' || role === 'nurse')
                               ? <MobileApprovalsView recommendations={recommendations} />
                               : <ApprovalCenter recommendations={recommendations} />
          case 'simulation': return <SimulationView />
          case 'agents':     return <AgentOpsView />
          case 'system':     return <SystemHealthView />
          case 'capacity':   return <CapacityManagementView />
          case 'flow':       return <PatientFlowView />
          case 'resources':  return <ResourcesView />
          case 'emergency':  return <EmergencyCommandView />
          case 'reports':    return <ReportsView />
          case 'settings':   return <SettingsView />
          default:           return <CommandCenter />
        }})()}
      </div>
    )
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
        <main className="flex-1 min-h-0 overflow-hidden flex flex-col" style={{ background: '#f5f0e8' }}>
          {renderView()}
        </main>
      </div>

      {/* Global transient notification popups */}
      <Toaster />
    </div>
  )
}
