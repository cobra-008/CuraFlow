import { useState, useRef, useEffect } from 'react'
import {
  Bell, CheckCheck, Trash2, X, AlertTriangle, ShieldAlert,
  Bot, Activity, CheckCircle2, ChevronRight, Sparkles
} from 'lucide-react'
import { useStore, type AppNotification } from '../../store'

function formatTimeAgo(ts: number) {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function NotificationDropdown() {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread' | 'alerts' | 'approvals'>('all')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const notifications = useStore((s) => s.notifications)
  const markAsRead = useStore((s) => s.markNotificationAsRead)
  const markAllAsRead = useStore((s) => s.markAllNotificationsAsRead)
  const clearNotifications = useStore((s) => s.clearNotifications)
  const dismissNotification = useStore((s) => s.dismissNotification)

  const unreadCount = notifications.filter((n) => !n.read).length
  const hasCritical = notifications.some((n) => !n.read && n.severity === 'critical')

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  // Filtered notifications
  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.read
    if (filter === 'alerts') return n.type === 'bottleneck' || n.type === 'crisis' || n.severity === 'critical'
    if (filter === 'approvals') return n.type === 'approval'
    return true
  })

  function handleAction(n: AppNotification) {
    markAsRead(n.id)
    if (n.actionRoute) {
      window.dispatchEvent(new CustomEvent('curaflow:navigate', { detail: n.actionRoute }))
    }
    setOpen(false)
  }

  function getIcon(n: AppNotification) {
    if (n.severity === 'critical' || n.type === 'crisis') {
      return <ShieldAlert size={16} className="text-red-600 flex-shrink-0" />
    }
    if (n.type === 'approval') {
      return <Bot size={16} className="text-indigo-600 flex-shrink-0" />
    }
    if (n.severity === 'warning') {
      return <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
    }
    if (n.severity === 'success') {
      return <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
    }
    return <Activity size={16} className="text-blue-600 flex-shrink-0" />
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl transition-all"
        style={{
          background: open ? 'rgba(30, 58, 110, 0.12)' : '#f5f0e8',
          border: open ? '1px solid #1e3a6e' : '1px solid #e0d5c0',
        }}
        title="Notifications & Clinical Alerts"
      >
        <Bell size={16} style={{ color: open ? '#1e3a6e' : '#1a2744' }} />
        {unreadCount > 0 && (
          <span
            className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-white flex items-center justify-center font-bold text-[10px] shadow-sm ${
              hasCritical ? 'bg-red-600 animate-pulse' : 'bg-[#1e3a6e]'
            }`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col border animate-in fade-in slide-in-from-top-2 duration-150"
          style={{
            background: '#ffffff',
            borderColor: '#e2d8c7',
            boxShadow: '0 12px 36px -4px rgba(30, 58, 110, 0.18)',
            maxHeight: '520px',
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ background: '#fdfbf7', borderColor: '#eee6da' }}>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm" style={{ color: '#1a2744' }}>Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck size={13} />
                  <span>Mark all read</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 px-3 py-2 border-b text-[11px] font-medium" style={{ background: '#f8f4ec', borderColor: '#eee6da' }}>
            {(['all', 'unread', 'alerts', 'approvals'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className="px-2.5 py-1 rounded-lg capitalize transition-all"
                style={{
                  background: filter === tab ? '#1e3a6e' : 'transparent',
                  color: filter === tab ? '#ffffff' : '#6b5c40',
                  fontWeight: filter === tab ? 600 : 500,
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-3">
                  <Sparkles size={22} className="text-amber-600" />
                </div>
                <div className="text-sm font-bold text-slate-800 mb-1">All Caught Up</div>
                <p className="text-xs text-slate-500 max-w-xs">
                  {filter === 'unread' ? 'No unread notifications at this time.' : 'No active alerts in this category.'}
                </p>
              </div>
            ) : (
              filtered.map((n) => (
                <div
                  key={n.id}
                  className={`p-3.5 flex items-start gap-3 transition-colors ${
                    !n.read ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Status icon badge */}
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{
                      background:
                        n.severity === 'critical'
                          ? '#fee2e2'
                          : n.type === 'approval'
                          ? '#e0e7ff'
                          : n.severity === 'warning'
                          ? '#fef3c7'
                          : '#e0f2fe',
                    }}
                  >
                    {getIcon(n)}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <div className="text-xs font-bold truncate" style={{ color: '#1a2744' }}>
                        {n.title}
                      </div>
                      <span className="text-[10px] text-slate-400 flex-shrink-0">
                        {formatTimeAgo(n.timestamp)}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-snug break-words">
                      {n.message}
                    </p>

                    {/* Action button */}
                    <div className="mt-2 flex items-center justify-between">
                      {n.actionRoute ? (
                        <button
                          onClick={() => handleAction(n)}
                          className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg text-white transition-opacity hover:opacity-90 shadow-sm"
                          style={{
                            background: n.severity === 'critical' ? '#dc2626' : '#1e3a6e',
                          }}
                        >
                          <span>{n.actionLabel || 'View Details'}</span>
                          <ChevronRight size={12} />
                        </button>
                      ) : (
                        <span />
                      )}

                      {!n.read && (
                        <button
                          onClick={() => markAsRead(n.id)}
                          className="text-[10px] font-semibold text-slate-500 hover:text-blue-700"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Dismiss */}
                  <button
                    onClick={() => dismissNotification(n.id)}
                    className="text-slate-400 hover:text-slate-600 p-1 flex-shrink-0"
                    title="Dismiss"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-2.5 border-t bg-slate-50 flex items-center justify-between text-xs" style={{ borderColor: '#eee6da' }}>
              <span className="text-[11px] text-slate-400 font-medium">
                {notifications.length} notification{notifications.length === 1 ? '' : 's'} recorded
              </span>
              <button
                onClick={clearNotifications}
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-red-600 transition-colors"
              >
                <Trash2 size={12} />
                <span>Clear All</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
