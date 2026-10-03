import { useState, useEffect, useRef } from 'react'
import { Search, Bell, ChevronDown, LogOut, Settings, ShieldCheck } from 'lucide-react'
import { useStore } from '../store'

export function TopBar() {
  const currentUser = useStore((s) => s.currentUser)
  const logout = useStore((s) => s.logout)
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

  const [now, setNow] = useState(new Date())
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchVal, setSearchVal] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  // Click outside to close menu
  useEffect(() => {
    if (!menuOpen) return
    const fn = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [menuOpen])

  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })

  const initials = currentUser
    ? currentUser.display_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const roleLabel =
    currentUser?.role === 'super_admin' ? 'Platform · Super Admin'
    : currentUser?.role === 'admin' ? 'Hospital Admin'
    : currentUser?.role === 'approver' ? 'Operations Manager'
    : 'Clinical Staff'

  return (
    <header className="flex-shrink-0 flex items-center gap-4 px-5 h-14 border-b" style={{
      background: '#ffffff',
      borderColor: '#e8e1d4',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>

      {/* Search */}
      <div className="flex-1 max-w-sm relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9aa3b2' }} />
        <input
          type="text"
          value={searchVal}
          onChange={e => setSearchVal(e.target.value)}
          placeholder="Search patient, bed, staff, equipment..."
          className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg outline-none transition-all"
          style={{
            background: '#f5f0e8',
            border: '1px solid #e0d5c0',
            color: '#1a2744',
            fontSize: '13px',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = '#1e3a6e' }}
          onBlur={e => { e.currentTarget.style.borderColor = '#e0d5c0' }}
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* DateTime */}
      <div className="text-right hidden md:block">
        <div className="font-bold text-sm" style={{ color: '#1a2744' }}>{timeStr}</div>
        <div className="text-xs" style={{ color: '#9aa3b2' }}>{dateStr}</div>
      </div>

      {/* Notification bell */}
      <div className="relative">
        <button
          className="relative w-9 h-9 flex items-center justify-center rounded-lg transition-colors"
          style={{ background: '#f5f0e8', border: '1px solid #e0d5c0' }}
          title="Notifications"
        >
          <Bell size={16} style={{ color: '#1a2744' }} />
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center font-bold"
            style={{ fontSize: '9px' }}>
            3
          </span>
        </button>
      </div>

      {/* User profile */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-colors"
          style={{
            background: menuOpen ? '#f0e8d8' : '#f5f0e8',
            border: '1px solid #e0d5c0',
          }}
        >
          {/* Avatar */}
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
            style={{ background: '#1e3a6e' }}>
            {initials}
          </div>
          <div className="hidden sm:block text-left">
            <div className="font-semibold text-sm leading-tight" style={{ color: '#1a2744' }}>
              {currentUser?.display_name ?? 'Unknown'}
            </div>
            <div className="text-xs leading-tight" style={{ color: '#9aa3b2' }}>
              {roleLabel}
            </div>
          </div>
          <ChevronDown size={13} style={{ color: '#9aa3b2', flexShrink: 0, transform: menuOpen ? 'rotate(180deg)' : '' }} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl overflow-hidden z-50"
            style={{ background: '#fff', border: '1px solid #e0d5c0', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
            <div className="px-3 py-2.5 border-b" style={{ borderColor: '#f0e8d8' }}>
              <div className="font-semibold text-sm" style={{ color: '#1a2744' }}>{currentUser?.display_name}</div>
              <div className="text-xs" style={{ color: '#9aa3b2' }}>{roleLabel}</div>
            </div>

            {isAdmin && (
              <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-blue-50"
                style={{ color: '#1e3a6e' }}>
                <ShieldCheck size={14} />
                Admin Panel
              </button>
            )}
            <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-gray-50"
              style={{ color: '#5a6475' }}>
              <Settings size={14} />
              Settings
            </button>
            <button
              onClick={() => { setMenuOpen(false); logout() }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-red-50"
              style={{ color: '#dc2626' }}>
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
