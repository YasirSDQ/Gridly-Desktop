import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { isRcloneRunning } from '../services/auth'
import type { ViewMode } from '../types'

export default function Header() {
  const { state, dispatch, setView } = useApp()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [rcloneConnected, setRcloneConnected] = useState(false)

  // Check rclone connection status
  useEffect(() => {
    const checkConnection = async () => {
      const connected = await isRcloneRunning()
      setRcloneConnected(connected)
    }
    checkConnection()
    const interval = setInterval(checkConnection, 5000)
    return () => clearInterval(interval)
  }, [])

  const navItems: { id: ViewMode; label: string; icon: string }[] = [
    { id: 'home', label: 'Home', icon: 'fa-house' },
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-gauge-high' },
    { id: 'transfers', label: 'Transfers', icon: 'fa-arrows-rotate' },
    { id: 'settings', label: 'Settings', icon: 'fa-gear' },
  ]

  const activeTransfers = state.transfers.filter(t => t.status === 'running').length

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-indigo-500/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('home')}>
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-500 flex items-center justify-center neon-glow">
                <i className="fa-solid fa-cubes text-white text-lg" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-slate-950 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Gridly
              </h1>
              <p className="text-[10px] text-slate-400 -mt-1 tracking-wider">ADVANCED DRIVE MANAGER</p>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                  state.currentView === item.id
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <i className={`fa-solid ${item.icon} text-xs`} />
                {item.label}
                {item.id === 'transfers' && activeTransfers > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-bold">
                    {activeTransfers}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Status & Actions */}
          <div className="hidden md:flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
              rcloneConnected 
                ? 'bg-green-500/10 border-green-500/20' 
                : 'bg-yellow-500/10 border-yellow-500/20'
            }`}>
              <div className={`w-2 h-2 rounded-full animate-pulse ${
                rcloneConnected ? 'bg-green-400' : 'bg-yellow-400'
              }`} />
              <span className={`text-xs font-medium ${
                rcloneConnected ? 'text-green-400' : 'text-yellow-400'
              }`}>
                {rcloneConnected ? 'rclone Connected' : 'rclone Offline'}
              </span>
            </div>
            {state.accounts.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                <i className="fa-solid fa-users text-indigo-400 text-xs" />
                <span className="text-xs text-indigo-300 font-medium">{state.accounts.length} accounts</span>
              </div>
            )}
            <button
              onClick={() => dispatch({ type: 'SET_AUTH_MODAL', payload: true })}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium hover:from-indigo-500 hover:to-purple-500 transition-all duration-300 neon-glow"
            >
              <i className="fa-solid fa-plus mr-2" />
              Connect Drive
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <i className={`fa-solid ${mobileMenuOpen ? 'fa-xmark' : 'fa-bars'} text-xl`} />
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-indigo-500/10 animate-fade-in">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { setView(item.id); setMobileMenuOpen(false); }}
                className={`w-full px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-3 ${
                  state.currentView === item.id
                    ? 'bg-indigo-500/20 text-indigo-300'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <i className={`fa-solid ${item.icon}`} />
                {item.label}
              </button>
            ))}
            <button
              onClick={() => { dispatch({ type: 'SET_AUTH_MODAL', payload: true }); setMobileMenuOpen(false); }}
              className="w-full mt-3 px-4 py-3 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium"
            >
              <i className="fa-solid fa-plus mr-2" />
              Connect Drive
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
