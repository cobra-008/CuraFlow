import { PipelineCanvas } from '../canvas/PipelineCanvas'
import { useStore } from '../../store'
import { MessageSquareCode } from 'lucide-react'
import { AgentFindings } from '../execution/AgentFindings'
import { Sidebar as MissionPrompter } from '../Sidebar'

export function OrchestrationView() {
  const panelOpen = useStore((s) => s.panelOpen)
  const executionStatus = useStore((s) => s.executionStatus)
  const pipelineGenerated = useStore((s) => s.pipelineGenerated)

  // Removed auto-generation on mount so the user can enter a prompt first

  const hasExecuted = pipelineGenerated || executionStatus !== 'idle'


  return (
    <div className="flex flex-1 overflow-hidden h-full w-full">
      <main className="flex-1 min-w-0 relative overflow-hidden h-full">
        <PipelineCanvas />
      </main>
      
      {/* Right Panel: Typing Box & Agent Output */}
      <aside className="w-80 2xl:w-[400px] flex-shrink-0 bg-white border-l border-[var(--border-a)] flex flex-col overflow-hidden">
        
        {/* The Typing Box (Workflow Prompter) */}
        <MissionPrompter />
        
        {/* The Agent Output (appears below the typing box after execution) */}
        {hasExecuted && panelOpen && (
           <div className="flex-1 overflow-hidden flex flex-col border-t border-[var(--border-a)] bg-slate-50/50">
             <div className="px-4 py-2.5 border-b border-[var(--border-a)] flex-shrink-0 flex items-center justify-between bg-white">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <MessageSquareCode size={14} className="text-blue-500" /> Agent Output
                </span>
             </div>
             <div className="flex-1 overflow-hidden bg-white">
               <AgentFindings />
             </div>
           </div>
        )}
      </aside>
    </div>
  )
}
