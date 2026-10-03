import { Network, Database, BrainCircuit, Search, ArrowRightCircle } from 'lucide-react'
import { useState } from 'react'

export function OrchestrationView() {
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setIsSearching(true)
    setTimeout(() => setIsSearching(false), 1500)
  }

  return (
    <div className="p-6 h-full flex flex-col gap-6">
      <header className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-[var(--border-a)]">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Orchestration & RAG Pipeline</h1>
          <p className="text-sm text-slate-500 mt-1">Retrieval-Augmented Generation for clinical operations</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-purple-50 text-purple-700 px-4 py-2 rounded-lg font-medium flex items-center gap-2 border border-purple-200 shadow-sm">
            <Network size={18} />
            <span>RAG Active</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        
        {/* RAG Query Interface */}
        <div className="lg:col-span-1 bg-white rounded-3xl shadow-sm border border-[var(--border-a)] p-6 flex flex-col">
          <h2 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2">
            <BrainCircuit className="text-purple-600" size={20} />
            Ask the Orchestrator
          </h2>
          
          <form onSubmit={handleSearch} className="mb-6">
            <div className="relative">
              <input 
                type="text" 
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="E.g., What is the protocol for ICU overflow?"
                className="w-full bg-white border border-purple-300 text-navy-900 text-sm rounded-full focus:ring-purple-500 focus:border-purple-500 block p-3.5 pr-10 outline-none transition-all shadow-sm"
              />
              <button type="submit" className="absolute inset-y-0 right-0 flex items-center pr-4">
                <Search size={18} className={`${isSearching ? 'text-purple-500 animate-pulse' : 'text-slate-400'}`} />
              </button>
            </div>
          </form>

          <div className="flex-1 bg-white rounded-3xl border border-slate-200 p-5 overflow-y-auto shadow-sm">
            {isSearching ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3">
                <BrainCircuit size={32} className="animate-pulse text-purple-400" />
                <p className="text-sm font-medium">Querying vector database...</p>
              </div>
            ) : query && !isSearching ? (
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-2xl border border-[var(--border-a)] shadow-sm text-sm text-navy-800">
                  <p className="font-bold mb-1 text-purple-700">Synthesized Answer:</p>
                  <p className="leading-relaxed">Based on standard clinical protocols, when ICU reaches 95% capacity, step-down units should be prepared for stable patient transfer. Notifications have been automatically routed to the step-down nursing station.</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100 text-xs text-navy-700">
                  <p className="font-bold mb-1 text-purple-800">Sources Retrieved (RAG):</p>
                  <ul className="list-disc pl-4 space-y-1 text-purple-800/80">
                    <li>Hospital Policy Doc: ICU-04-Overflow (Similarity: 0.94)</li>
                    <li>Recent Memo: Winter Capacity Management (Similarity: 0.88)</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                <Search size={24} className="text-slate-300" />
                <p className="text-sm text-center px-4">Enter a query to search clinical protocols and operations knowledge base.</p>
              </div>
            )}
          </div>
        </div>

        {/* Pipeline Architecture Diagram */}
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-[var(--border-a)] p-6 flex flex-col">
          <h2 className="text-lg font-bold text-navy-900 mb-6 flex items-center gap-2">
            <Network className="text-slate-600" size={20} />
            RAG Pipeline Architecture
          </h2>
          
          <div className="flex-1 flex items-center justify-center bg-[#faf9f6] rounded-3xl border border-dashed border-[var(--border-a)] p-8 relative">
            <div className="flex items-center w-full justify-between max-w-2xl relative z-10">
              
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 bg-white rounded-full border border-blue-200 flex items-center justify-center shadow-sm z-10 relative">
                  <Search className="text-blue-500" size={24} />
                </div>
                <span className="font-bold text-sm text-navy-800">User Query</span>
              </div>

              <ArrowRightCircle className="text-slate-300 w-8 h-8 z-10 relative bg-[#faf9f6] rounded-full" />

              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 bg-white rounded-full border border-emerald-200 flex items-center justify-center shadow-sm z-10 relative">
                  <Database className="text-emerald-500" size={24} />
                </div>
                <span className="font-bold text-sm text-navy-800">Vector DB (Retrieval)</span>
              </div>

              <ArrowRightCircle className="text-slate-300 w-8 h-8 z-10 relative bg-[#faf9f6] rounded-full" />

              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 bg-white rounded-full border border-purple-200 flex items-center justify-center shadow-sm z-10 relative">
                  <BrainCircuit className="text-purple-500" size={24} />
                </div>
                <span className="font-bold text-sm text-navy-800">LLM (Generation)</span>
              </div>

            </div>
            
            {/* Connecting line */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[2px] bg-slate-200 z-0"></div>
          </div>
        </div>

      </div>
    </div>
  )
}
