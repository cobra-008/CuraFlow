import { useEffect } from 'react'
import { AlertTriangle, AlertCircle, ArrowUpCircle, X } from 'lucide-react'
import { useStore } from '../../store'
import type { Toast } from '../../store'

const STYLES: Record<Toast['severity'], { border: string; icon: typeof AlertCircle; iconColor: string }> = {
  info:     { border: '#3b82f6', icon: AlertCircle,   iconColor: '#3b82f6' },
  warning:  { border: '#f59e0b', icon: AlertTriangle, iconColor: '#d97706' },
  critical: { border: '#ef4444', icon: ArrowUpCircle, iconColor: '#dc2626' },
}

function ToastCard({ toast }: { toast: Toast }) {
  const dismissToast = useStore((s) => s.dismissToast)
  const s = STYLES[toast.severity]
  const Icon = s.icon

  useEffect(() => {
    // Auto-dismiss within 5s (even if sticky, dismiss after 8s so screen is never jammed)
    const delay = toast.sticky ? 8000 : 5000
    const t = setTimeout(() => dismissToast(toast.id), delay)
    return () => clearTimeout(t)
  }, [toast.id, toast.sticky, dismissToast])

  return (
    <div
      className="w-80 max-w-[calc(100vw-2rem)] rounded-xl border bg-white dark:bg-slate-900 shadow-xl px-3.5 py-3 flex items-start gap-2.5 backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-right-3"
      style={{
        borderColor: s.border + '40',
        borderLeftColor: s.border,
        borderLeftWidth: 4,
      }}
    >
      <Icon size={17} className="flex-shrink-0 mt-0.5" style={{ color: s.iconColor }} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-tight">
          {toast.title}
        </div>
        {toast.message ? (
          <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug mt-1 break-words">
            {toast.message}
          </div>
        ) : null}
      </div>
      <button
        onClick={() => dismissToast(toast.id)}
        className="text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 transition-colors flex-shrink-0 p-0.5 rounded"
        title="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export function Toaster() {
  const toasts = useStore((s) => s.toasts)
  const clearToasts = useStore((s) => s.clearToasts)

  if (toasts.length === 0) return null

  // Show at most the 3 latest toasts
  const visible = toasts.slice(-3)

  return (
    <div className="fixed top-16 right-4 z-[9999] flex flex-col items-end gap-2 pointer-events-none">
      {toasts.length > 1 && (
        <button
          onClick={clearToasts}
          className="pointer-events-auto text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-full shadow-sm transition-colors mb-0.5"
        >
          Dismiss All ({toasts.length})
        </button>
      )}
      {visible.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastCard toast={t} />
        </div>
      ))}
    </div>
  )
}

