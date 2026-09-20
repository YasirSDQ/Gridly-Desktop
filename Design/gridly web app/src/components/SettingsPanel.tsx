import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { storage } from '../services/storage'
import { formatBytes, invalidateClientFolderCache, isRcloneAvailable } from '../services/rclone'
import { disconnectAccount, syncAccountStorage } from '../services/auth'
import * as rcloneRC from '../services/rcloneRC'
import type { RcloneConfig } from '../types'

export default function SettingsPanel() {
  const { state, dispatch, addToast } = useApp()
  const [config, setConfig] = useState<RcloneConfig>(state.rcloneConfig)
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null)
  const [accountToDisconnect, setAccountToDisconnect] = useState<{ id: string; name: string } | null>(null)
  const [showClearAllModal, setShowClearAllModal] = useState(false)
  const [rcloneConnected, setRcloneConnected] = useState(false)
  const [rcloneVersion, setRcloneVersion] = useState('')
  const [cacheCleared, setCacheCleared] = useState(false)

  useEffect(() => {
    const checkRclone = async () => {
      const connected = await isRcloneAvailable()
      setRcloneConnected(connected)
      if (connected) {
        try {
          const version = await rcloneRC.getVersion()
          setRcloneVersion(version.version)
        } catch {}
      }
    }
    checkRclone()
  }, [])

  const handleTogglePreference = (key: keyof RcloneConfig) => {
    const updated = { ...config, [key]: !config[key] }
    setConfig(updated)
    storage.saveRcloneConfig(updated)
    dispatch({ type: 'SET_RCLONE_CONFIG', payload: updated })
    addToast('success', 'Preference Updated', 'Your preference has been saved.')
  }

  const handleSyncAccount = async (accountId: string, remoteName: string) => {
    setSyncingAccountId(accountId)
    try {
      const success = await syncAccountStorage(accountId, remoteName)
      if (success) {
        const updatedAccounts = storage.getAccounts()
        dispatch({ type: 'SET_ACCOUNTS', payload: updatedAccounts })
        addToast('success', 'Storage Synchronized', 'Updated storage quotas from Google Drive.')
      } else {
        addToast('warning', 'Sync Notice', 'Could not refresh storage quota at this moment.')
      }
    } catch (err: any) {
      addToast('error', 'Sync Failed', err.message || 'Error communicating with Google Drive.')
    } finally {
      setSyncingAccountId(null)
    }
  }

  const handleConfirmDisconnect = async () => {
    if (!accountToDisconnect) return
    const { id, name } = accountToDisconnect
    try {
      await disconnectAccount(id)
      const updatedAccounts = storage.getAccounts()
      dispatch({ type: 'SET_ACCOUNTS', payload: updatedAccounts })
      if (state.selectedAccountId === id) {
        dispatch({ type: 'SET_SELECTED_ACCOUNT', payload: updatedAccounts[0]?.id || null })
      }
      invalidateClientFolderCache(id)
      addToast('info', 'Account Disconnected', `${name} has been disconnected.`)
    } catch (err: any) {
      addToast('error', 'Disconnect Error', err.message || 'Failed to disconnect account.')
    } finally {
      setAccountToDisconnect(null)
    }
  }

  const handleClearCache = async () => {
    invalidateClientFolderCache()
    setCacheCleared(true)
    setTimeout(() => setCacheCleared(false), 2500)
    addToast('success', 'Cache Cleared', 'Folder cache has been flushed. Files will reload fresh from Google Drive.')
  }

  const handleConfirmClearAll = () => {
    storage.clearAll()
    invalidateClientFolderCache()
    dispatch({ type: 'SET_ACCOUNTS', payload: [] })
    dispatch({ type: 'SET_TRANSFERS', payload: [] })
    dispatch({ type: 'SET_SELECTED_ACCOUNT', payload: null })
    setShowClearAllModal(false)
    addToast('warning', 'All Data Cleared', 'All accounts and preferences have been reset.')
  }

  return (
    <section className="pt-24 pb-20 px-4 sm:px-6 lg:px-8 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Page Header */}
        <div>
          <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Settings</h2>
          <p className="text-slate-400">Manage your connected Google Drive accounts, transfer speeds, and app preferences.</p>
        </div>

        {/* 1. Connected Accounts Manager */}
        <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2.5">
                <i className="fa-brands fa-google-drive text-blue-400 text-xl" />
                Connected Accounts
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {state.accounts.length === 0 
                  ? 'No accounts connected yet' 
                  : `${state.accounts.length} Google Drive ${state.accounts.length === 1 ? 'account' : 'accounts'} active`}
              </p>
            </div>

            <button
              onClick={() => dispatch({ type: 'SET_AUTH_MODAL', payload: true })}
              className="px-3.5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
            >
              <i className="fa-solid fa-plus text-xs" />
              <span>Connect Account</span>
            </button>
          </div>

          {state.accounts.length === 0 ? (
            <div className="py-8 text-center rounded-xl bg-slate-900/40 border border-dashed border-white/10">
              <i className="fa-brands fa-google-drive text-4xl text-slate-600 mb-3" />
              <p className="text-sm font-medium text-slate-300">No Google Drive accounts connected</p>
              <p className="text-xs text-slate-500 mt-1 mb-4">Connect an account to start transferring and managing your files.</p>
              <button
                onClick={() => dispatch({ type: 'SET_AUTH_MODAL', payload: true })}
                className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold inline-flex items-center gap-2"
              >
                <i className="fa-solid fa-plus" /> Connect Google Drive
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {state.accounts.map((acc) => {
                const totalBytes = acc.totalBytes || 15 * 1024 * 1024 * 1024
                const usedBytes = acc.usedBytes || 0
                const percent = Math.min(100, Math.round((usedBytes / totalBytes) * 100))
                const isSyncing = syncingAccountId === acc.id

                return (
                  <div 
                    key={acc.id} 
                    className="p-4 rounded-xl bg-slate-900/50 border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {/* Account Identity */}
                      <div className="flex items-center gap-3">
                        <img 
                          src={acc.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(acc.name)}&background=4f46e5&color=fff`} 
                          alt={acc.name} 
                          className="w-10 h-10 rounded-full border border-white/10 object-cover" 
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-white">{acc.name}</h4>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Connected
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{acc.rcloneRemote}: (Remote)</p>
                        </div>
                      </div>

                      {/* Storage Quota Bar */}
                      <div className="sm:w-64 flex flex-col justify-center">
                        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                          <span>{formatBytes(usedBytes)} used</span>
                          <span className="font-semibold text-slate-300">{percent}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              percent > 90 ? 'bg-rose-500' : percent > 75 ? 'bg-amber-500' : 'bg-indigo-500'
                            }`}
                            style={{ width: `${Math.max(3, percent)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1">Total: {formatBytes(totalBytes)}</span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleSyncAccount(acc.id, acc.rcloneRemote)}
                          disabled={isSyncing}
                          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                          title="Refresh storage quota from Google Drive"
                        >
                          <i className={`fa-solid fa-rotate text-xs ${isSyncing ? 'fa-spin text-indigo-400' : ''}`} />
                          <span>{isSyncing ? 'Syncing...' : 'Sync Quota'}</span>
                        </button>

                        <button
                          onClick={() => setAccountToDisconnect({ id: acc.id, name: acc.name })}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-medium flex items-center gap-1.5 transition-colors"
                          title="Disconnect account"
                        >
                          <i className="fa-solid fa-link-slash text-xs" />
                          <span>Disconnect</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 2. Cloud Transfer & Performance */}
        <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md">
          <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2.5">
            <i className="fa-solid fa-bolt text-amber-400 text-lg" />
            Cloud Transfer & Performance
          </h3>
          <p className="text-xs text-slate-400 mb-5">Configure how file operations are handled across your drives.</p>

          <div className="space-y-3">
            {/* Server to Server */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-white/5">
              <div className="space-y-1 pr-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-white font-medium">Direct Cloud-to-Cloud Transfers (Server-to-Server)</p>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                    ⚡ High Speed
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Transfers files directly within Google's cloud network. Does not consume your computer's internet data or download files locally.
                </p>
              </div>
              <button
                onClick={() => handleTogglePreference('driveServerSide')}
                className={`w-12 h-6 rounded-full transition-all duration-300 shrink-0 ${
                  config.driveServerSide ? 'bg-indigo-500' : 'bg-slate-700'
                }`}
                title={config.driveServerSide ? 'Enabled' : 'Disabled'}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-transform duration-300 ${
                  config.driveServerSide ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* Trash on delete */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-white/5">
              <div className="space-y-1 pr-4">
                <p className="text-sm text-white font-medium">Move to Google Drive Trash on Delete</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Deleted files and folders are safely moved to your Google Drive Trash bin where you can restore them, instead of being permanently erased.
                </p>
              </div>
              <button
                onClick={() => handleTogglePreference('driveUseTrash')}
                className={`w-12 h-6 rounded-full transition-all duration-300 shrink-0 ${
                  config.driveUseTrash ? 'bg-indigo-500' : 'bg-slate-700'
                }`}
                title={config.driveUseTrash ? 'Enabled' : 'Disabled'}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-transform duration-300 ${
                  config.driveUseTrash ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* 3. Speed & Navigation Cache */}
        <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2.5">
                  <i className="fa-solid fa-gauge-high text-cyan-400 text-lg" />
                  Instant Navigation Cache
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/20">
                  Active (0ms)
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
                Caches folder listings in memory so you can browse back and forth instantly without waiting for network reloads. Click below if you want to force a fresh reload from Google Drive.
              </p>
            </div>

            <button
              onClick={handleClearCache}
              disabled={cacheCleared}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold flex items-center justify-center gap-2 transition-colors shrink-0 disabled:opacity-75"
            >
              <i className={`fa-solid ${cacheCleared ? 'fa-check text-emerald-400' : 'fa-arrows-rotate text-cyan-400'}`} />
              <span>{cacheCleared ? 'Cache Cleared!' : 'Clear Cache & Refresh'}</span>
            </button>
          </div>
        </div>

        {/* 4. Danger Zone */}
        <div className="p-6 rounded-2xl bg-rose-500/[0.03] border border-rose-500/20 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-rose-300 flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation" />
                Reset & Disconnect
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Disconnect all Google Drive accounts and reset local settings to defaults. (Your files on Google Drive will NOT be deleted).
              </p>
            </div>

            <button
              onClick={() => setShowClearAllModal(true)}
              className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition-colors shrink-0"
            >
              <i className="fa-solid fa-trash" />
              <span>Reset All Accounts & Data</span>
            </button>
          </div>
        </div>

        {/* 5. Diagnostic Engine Info (Cleanly Collapsible for Power Users) */}
        <details className="group p-4 rounded-xl bg-slate-900/30 border border-white/5">
          <summary className="text-xs text-slate-500 hover:text-slate-300 font-medium cursor-pointer flex items-center gap-2 select-none">
            <i className="fa-solid fa-circle-info text-slate-500 group-open:rotate-90 transition-transform" />
            <span>Diagnostic & Connection Status</span>
            <span className="ml-auto text-[10px] text-slate-600 font-mono">
              {rcloneConnected ? `Engine v${rcloneVersion}` : 'Checking...'}
            </span>
          </summary>
          <div className="mt-4 pt-3 border-t border-white/5 space-y-2 text-xs text-slate-400">
            <div className="flex justify-between items-center py-1">
              <span>Rclone Daemon Status</span>
              <span className={`font-mono text-[11px] ${rcloneConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
                {rcloneConnected ? `Connected (v${rcloneVersion})` : 'Connecting...'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span>Server-Side Transfer Mode</span>
              <span className="font-mono text-[11px] text-indigo-300">Enabled (Direct Cloud Ingress)</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span>Pacer Optimization</span>
              <span className="font-mono text-[11px] text-cyan-300">MinSleep: 10ms, Burst: 200</span>
            </div>
          </div>
        </details>

      </div>

      {/* Disconnect Single Account Confirmation Modal */}
      {accountToDisconnect && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-white/10 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 text-xl">
              <i className="fa-solid fa-link-slash" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-white">Disconnect {accountToDisconnect.name}?</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                This will unlink this Google Drive account from the application. Your files on Google Drive will remain safe and unaffected.
              </p>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setAccountToDisconnect(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDisconnect}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold transition-colors"
              >
                Disconnect Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {showClearAllModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-white/10 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 text-xl">
              <i className="fa-solid fa-triangle-exclamation" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-white">Reset All Accounts & Data?</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                This will disconnect all linked Google Drive accounts and clear local transfer history. Your actual files on Google Drive will NOT be deleted.
              </p>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowClearAllModal(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClearAll}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold transition-colors"
              >
                Yes, Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
