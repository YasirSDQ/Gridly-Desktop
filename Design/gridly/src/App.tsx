import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AppProvider, useApp } from './context/AppContext'
import { storage } from './services/storage'

import LandingPage from './components/LandingPage'
import Dashboard from './components/Dashboard'
import TransferManager from './components/TransferManager'
import SettingsPanel from './components/SettingsPanel'
import AuthModal from './components/AuthModal'
import TransferModal from './components/TransferModal'
import Toast from './components/Toast'

import { formatBytes } from './services/rclone'

// Sidebar Navigation Items
const NAV_ITEMS = [
  { id: 'dashboard', label: 'My Drive', icon: 'fa-brands fa-google-drive' },
  { id: 'shared', label: 'Shared with me', icon: 'fa-solid fa-user-group' },
  { id: 'transfers', label: 'Transfers', icon: 'fa-solid fa-right-left' },
  { id: 'settings', label: 'Settings', icon: 'fa-solid fa-gear' }
]

function AppContent() {
  const { state, setView, addToast, dispatch } = useApp()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [isRefreshingStorage, setIsRefreshingStorage] = useState(false)
  const [accountToUnlink, setAccountToUnlink] = useState<{id: string, name: string} | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Global '/' keyboard shortcut to focus search
  useEffect(() => {
    const handleGlobalSlash = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }
    }
    window.addEventListener('keydown', handleGlobalSlash)
    return () => window.removeEventListener('keydown', handleGlobalSlash)
  }, [])

  // Auto-redirect logic
  useEffect(() => {
    if (state.currentView === 'home' && state.accounts.length > 0) {
      setView('dashboard')
    } else if (state.currentView !== 'home' && state.accounts.length === 0) {
      setView('home')
    }
  }, [state.accounts.length, state.currentView, setView])

  // Sync storage logic
  useEffect(() => {
    const active = state.accounts[0]
    if (active && (!active.totalBytes || active.totalBytes === 0)) {
      import('./services/auth').then(({ syncAccountStorage }) => {
        syncAccountStorage(active.id, active.rcloneRemote).then((updated) => {
          if (updated) {
            const accounts = storage.getAccounts()
            dispatch({ type: 'SET_ACCOUNTS', payload: accounts })
          }
        })
      })
    }
  }, [state.accounts[0]?.id])

  // Check for OAuth callback results
  useEffect(() => {
    const successData = sessionStorage.getItem('gridly_auth_success')
    const errorData = sessionStorage.getItem('gridly_auth_error')

    if (successData) {
      const { email, name } = JSON.parse(successData)
      addToast('success', 'Account Connected!', `${name} (${email}) has been added successfully`)
      sessionStorage.removeItem('gridly_auth_success')
      setView('dashboard')
    }
    
    if (errorData) {
      addToast('error', 'Authentication Failed', errorData)
      sessionStorage.removeItem('gridly_auth_error')
    }

    // Reload accounts from storage
    const accounts = storage.getAccounts()
    dispatch({ type: 'SET_ACCOUNTS', payload: accounts })
  }, [])

  if (state.currentView === 'home') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-indigo-500/30">
        <LandingPage />
        <AuthModal />
        <Toast />
      </div>
    )
  }

  const activeAccount = state.selectedAccountId 
    ? state.accounts.find(a => a.id === state.selectedAccountId) || state.accounts[0]
    : state.accounts[0]

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-hidden flex font-sans selection:bg-indigo-500/30">
      {/* Sidebar */}
      <motion.div 
        initial={{ x: -250 }}
        animate={{ x: 0 }}
        className="w-64 border-r border-white/5 bg-white/5 backdrop-blur-xl flex flex-col p-4 hidden md:flex"
      >
        <div className="flex items-center gap-3 px-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center">
            <i className="fa-solid fa-cloud text-white text-sm" />
          </div>
          <span className="text-xl font-black tracking-tight text-white">Gridly</span>
        </div>

        <button 
          onClick={() => dispatch({ type: 'SET_AUTH_MODAL', payload: true })}
          className="flex items-center gap-3 bg-white text-slate-900 px-4 py-3 rounded-2xl font-bold hover:scale-105 transition-transform mb-8 shadow-lg shadow-white/10"
        >
          <i className="fa-solid fa-plus text-lg" />
          Add Account
        </button>
        
        <nav className="flex flex-col gap-2 flex-1">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id as any)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                state.currentView === item.id 
                  ? 'bg-indigo-500/20 text-indigo-300 shadow-inner' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <i className={`${item.icon} w-5`} />
              {item.label}
            </button>
          ))}
        </nav>

        {activeAccount && (
          <div className="mt-auto p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-database text-indigo-400" />
                <span className="text-sm font-semibold truncate">{activeAccount.name}</span>
              </div>
              <button 
                onClick={async () => {
                  setIsRefreshingStorage(true);
                  try {
                    const { syncAccountStorage } = await import('./services/auth');
                    const updated = await syncAccountStorage(activeAccount.id, activeAccount.rcloneRemote);
                    if (updated) {
                      const accounts = storage.getAccounts();
                      dispatch({ type: 'SET_ACCOUNTS', payload: accounts });
                      addToast('success', 'Storage Refreshed', 'Quota info is up to date.');
                    } else {
                      addToast('info', 'No Changes', 'Storage quota is unchanged or failed to sync.');
                    }
                  } catch (e) {
                    addToast('error', 'Sync Failed', 'Failed to refresh storage quota.');
                  } finally {
                    setIsRefreshingStorage(false);
                  }
                }}
                disabled={isRefreshingStorage}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                title="Refresh Storage Quota"
              >
                <i className={`fa-solid fa-arrows-rotate text-[10px] ${isRefreshingStorage ? 'fa-spin' : ''}`} />
              </button>
            </div>
            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden mt-3">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500" 
                style={{ width: `${(activeAccount.usedBytes / (activeAccount.totalBytes || Math.max(activeAccount.usedBytes, 1))) * 100}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-2 flex justify-between">
              <span>{Math.round((activeAccount.usedBytes / (activeAccount.totalBytes || Math.max(activeAccount.usedBytes, 1))) * 100) || 0}% used</span>
              <span className="text-[10px] opacity-70">
                {formatBytes(activeAccount.usedBytes)} / {activeAccount.totalBytes ? formatBytes(activeAccount.totalBytes) : 'Unlimited'}
              </span>
            </p>
          </div>
        )}
      </motion.div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a]">
        {/* Top Bar */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-white/5 backdrop-blur-md z-50">
          <div className="flex-1 max-w-2xl relative group">
            <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-400 transition-colors" />
            <input 
              ref={searchInputRef}
              type="text" 
              value={state.searchQuery || ''}
              onChange={(e) => dispatch({ type: 'SET_SEARCH_QUERY', payload: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  dispatch({ type: 'SET_SEARCH_QUERY', payload: '' })
                  searchInputRef.current?.blur()
                }
              }}
              placeholder="Search in Gridly... (Press '/' to focus)"
              className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-11 pr-10 text-white focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all placeholder:text-slate-500 text-sm"
            />
            {state.searchQuery && (
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: 'SET_SEARCH_QUERY', payload: '' })
                  searchInputRef.current?.focus()
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white flex items-center justify-center text-xs transition-colors"
                title="Clear search (Esc)"
              >
                <i className="fa-solid fa-xmark text-[10px]" />
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-4 ml-4">
            {activeAccount && (
              <div className="flex items-center gap-2 pr-4 border-r border-white/10">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-medium text-slate-400 hidden sm:block">Connected to rclone</span>
              </div>
            )}
            <div className="relative">
              <div 
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-white shadow-lg cursor-pointer hover:scale-105 transition-transform"
              >
                {activeAccount?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              
              <AnimatePresence>
                {showProfileMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 top-12 w-64 bg-slate-900 border border-slate-700/50 rounded-2xl shadow-xl z-50 overflow-hidden"
                    >
                      <div className="p-4 border-b border-slate-700/50">
                        <p className="text-sm font-bold text-white">Connected Accounts</p>
                      </div>
                      <div className="max-h-64 overflow-y-auto p-2">
                        {state.accounts.map(acc => (
                          <div 
                            key={acc.id} 
                            onClick={() => {
                              dispatch({ type: 'SET_SELECTED_ACCOUNT', payload: acc.id })
                              setShowProfileMenu(false)
                            }}
                            className={`p-2 flex items-center justify-between rounded-xl cursor-pointer transition-colors group ${activeAccount?.id === acc.id ? 'bg-indigo-500/10 border border-indigo-500/20' : 'hover:bg-slate-800/50'}`}
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <i className="fa-brands fa-google-drive text-indigo-400" />
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm font-medium text-white truncate">{acc.name}</span>
                                <span className="text-[10px] text-slate-400 truncate">{acc.email}</span>
                              </div>
                            </div>
                            <button 
                              onClick={async (e) => {
                                e.stopPropagation();
                                setAccountToUnlink({ id: acc.id, name: acc.name });
                              }}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                            >
                              <i className="fa-solid fa-unlink" />
                            </button>
                          </div>
                        ))}
                        {state.accounts.length === 0 && (
                          <div className="p-4 text-center text-sm text-slate-500">
                            No accounts connected
                          </div>
                        )}
                      </div>
                      <div className="p-2 border-t border-slate-700/50">
                        <button 
                          onClick={() => {
                            setShowProfileMenu(false)
                            dispatch({ type: 'SET_AUTH_MODAL', payload: true })
                          }}
                          className="w-full py-2 rounded-xl text-sm font-medium text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                        >
                          <i className="fa-solid fa-plus" />
                          Add Account
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* View Routing */}
        <div className="flex-1 relative overflow-y-auto">
          {(state.currentView === 'dashboard' || state.currentView === 'shared') && (
            <Dashboard initialSection={state.currentView === 'shared' ? 'shared-with-me' : 'my-drive'} />
          )}
          {state.currentView === 'transfers' && <TransferManager />}
          {state.currentView === 'settings' && <SettingsPanel />}
        </div>
      </div>

      {/* Global Modals */}
      <AuthModal />
      <TransferModal />
      <Toast />

      {/* Unlink Confirmation Modal */}
      <AnimatePresence>
        {accountToUnlink && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-6">
                <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-4 mx-auto">
                  <i className="fa-solid fa-unlink text-xl" />
                </div>
                <h3 className="text-lg font-semibold text-white text-center mb-2">Disconnect Account</h3>
                <p className="text-slate-400 text-sm text-center mb-6">
                  Are you sure you want to disconnect <strong>{accountToUnlink.name}</strong>? You will need to re-authenticate to access it again.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setAccountToUnlink(null)}
                    className="flex-1 py-2 rounded-xl text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      const id = accountToUnlink.id;
                      const name = accountToUnlink.name;
                      setAccountToUnlink(null);
                      const { disconnectAccount } = await import('./services/auth');
                      await disconnectAccount(id);
                      dispatch({ type: 'REMOVE_ACCOUNT', payload: id });
                      setShowProfileMenu(false);
                      addToast('info', 'Disconnected', `Removed ${name}`);
                    }}
                    className="flex-1 py-2 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}
