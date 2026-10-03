import { useState, useEffect } from 'react'
import { Header } from '../Header'
import { CommandCenter } from '../ops/CommandCenter'
import { ApprovalCenter } from '../ops/ApprovalCenter'
import { SimulationView } from '../ops/SimulationView'
import { AgentOpsView } from '../ops/AgentOpsView'
import { SystemHealthView } from '../ops/SystemHealthView'
import { ShieldCheck, Activity, Settings, Database, ActivitySquare, AlertTriangle, Workflow, Network, Server, UserSquare2, BedDouble, BriefcaseMedical } from 'lucide-react'

// Placeholder components for new views
const PlaceholderView = ({ title, status = 'NOT CONFIGURED' }: { title: string, status?: string }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#0a0e1a] text-slate-400">
    <AlertTriangle className="w-12 h-12 text-amber-500 mb-4 opacity-50" />
    <h2 className="text-xl font-bold text-slate-200 mb-2 uppercase tracking-widest">{title}</h2>
    <div className="text-xs font-mono bg-slate-800/50 border border-slate-700 px-3 py-1.5 rounded-sm text-slate-400 uppercase">
      {status}
    </div>
    <p className="text-sm mt-4 max-w-md text-slate-500">
      This module is part of the CuraFlow clinical operations platform. It requires backend integration and configuration before live deployment.
    </p>
  </div>
)

export function CuraFlowShell() {
  const [activeRoute, setActiveRoute] = useState<string>('command')
  
  useEffect(() => {
    const handleNavigate = (e: CustomEvent) => {
      if (e.detail) setActiveRoute(e.detail)
    }
    window.addEventListener('curaflow:navigate', handleNavigate as EventListener)
    return () => window.removeEventListener('curaflow:navigate', handleNavigate as EventListener)
  }, [])
  
  // Minimal routing based on state instead of react-router for simplicity in prototype
  const renderView = () => {
    switch (activeRoute) {
      case 'command': return <CommandCenter />
      case 'capacity': return <PlaceholderView title="Capacity Management" status="SIMULATED" />
      case 'flow': return <PlaceholderView title="Patient Flow & Queues" status="NOT CONFIGURED" />
      case 'orchestrator': return <PlaceholderView title="Decision Pipeline" status="PLANNED" />
      case 'approvals': return <ApprovalCenter recommendations={[]} />
      case 'simulation': return <SimulationView />
      case 'resources': return <PlaceholderView title="Resources & Allocation" status="SIMULATED" />
      case 'emergency': return <PlaceholderView title="Emergency Command" status="SIMULATED" />
      
      case 'agents': return <AgentOpsView />
      case 'policies': return <PlaceholderView title="Policy Engine" status="NOT CONFIGURED" />
      case 'integrations': return <PlaceholderView title="Integrations & FHIR" status="NOT CONFIGURED" />
      case 'audit': return <PlaceholderView title="Operational Audit Ledger" status="PLANNED" />
      case 'system': return <SystemHealthView />
      default: return <CommandCenter />
    }
  }

  const NavItem = ({ id, label, icon: Icon, alert = false }: any) => {
    const active = activeRoute === id
    return (
      <button 
        onClick={() => setActiveRoute(id)}
        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left ${
          active 
            ? 'bg-slate-800/80 text-emerald-400 font-bold border-l-2 border-emerald-500' 
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border-l-2 border-transparent'
        }`}
      >
        <Icon size={16} className={active ? 'text-emerald-400' : 'text-slate-500'} />
        <span className="flex-1 tracking-wide">{label}</span>
        {alert && <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />}
      </button>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#050810] text-slate-300 font-sans">
      <Header />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Left Navigation */}
        <aside className="w-64 bg-[#0a0e1a] border-r border-slate-800/60 flex flex-col flex-shrink-0">
          <div className="overflow-y-auto flex-1 py-4">
            
            <div className="mb-6">
              <div className="px-4 text-[10px] font-bold text-slate-600 tracking-[0.2em] mb-2 uppercase">Operations</div>
              <NavItem id="command" label="Command Center" icon={Activity} />
              <NavItem id="capacity" label="Capacity" icon={BedDouble} />
              <NavItem id="flow" label="Patient Flow" icon={Workflow} />
              <NavItem id="orchestrator" label="Orchestration" icon={ActivitySquare} />
              <NavItem id="approvals" label="Approvals" icon={ShieldCheck} alert />
              <NavItem id="simulation" label="Simulation" icon={Database} />
              <NavItem id="resources" label="Resources" icon={BriefcaseMedical} />
              <NavItem id="emergency" label="Emergency" icon={AlertTriangle} />
            </div>

            <div>
              <div className="px-4 text-[10px] font-bold text-slate-600 tracking-[0.2em] mb-2 uppercase">Administration</div>
              <NavItem id="agents" label="Agents" icon={Server} />
              <NavItem id="policies" label="Policies" icon={ShieldCheck} />
              <NavItem id="integrations" label="Integrations" icon={Network} />
              <NavItem id="audit" label="Audit Ledger" icon={UserSquare2} />
              <NavItem id="system" label="System Health" icon={Settings} />
            </div>

          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden flex flex-col bg-[#050810]">
          {renderView()}
        </main>
      </div>
    </div>
  )
}
