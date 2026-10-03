import { PipelineCanvas } from '../canvas/PipelineCanvas'
import { useStore } from '../../store'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { AgentFindings } from '../execution/AgentFindings'

export function OrchestrationView() {
  const panelOpen = useStore((s) => s.panelOpen)
  const [outputCollapsed, setOutputCollapsed] = useState(false)

  return (
    <div className="flex flex-1 overflow-hidden h-full w-full">
      <main className="flex-1 min-w-0 relative overflow-hidden h-full">
        <PipelineCanvas />
      </main>
      {panelOpen && (
        outputCollapsed ? (
          <button
            onClick={() => setOutputCollapsed(false)}
            title="Show Agent Output"
            className="w-7 flex-shrink-0 bg-white border-l border-[var(--border-a)] flex items-center justify-center hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft size={14} className="text-slate-500" />
          </button>
        ) : (
          <aside className="w-80 2xl:w-96 flex-shrink-0 bg-white border-l border-[var(--border-a)] flex flex-col overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[var(--border-a)] flex-shrink-0 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Agent Output</span>
              <button
                onClick={() => setOutputCollapsed(true)}
                title="Collapse Agent Output"
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 -mr-1"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <AgentFindings />
            </div>
          </aside>
        )
      )}
    </div>
  )
}
