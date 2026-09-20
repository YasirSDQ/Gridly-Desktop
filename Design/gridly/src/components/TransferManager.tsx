import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { cancelTransfer, deleteTransfer, startTransfer, formatBytes } from '../services/rclone'
import { storage } from '../services/storage'

export default function TransferManager() {
  const { state, dispatch, addToast } = useApp()
  const [filter, setFilter] = useState<'all' | 'running' | 'completed'>('all')
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  // Live-sync transfers from storage periodically while mounted
  useEffect(() => {
    const sync = () => {
      const stored = storage.getTransfers()
      dispatch({ type: 'SET_TRANSFERS', payload: stored })
    }
    sync()
    const interval = setInterval(sync, 1000)
    window.addEventListener('storage', sync)
    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', sync)
    }
  }, [dispatch])

  const transfers = state.transfers.filter(t => {
    if (filter === 'running') return t.status === 'running' || t.status === 'queued'
    if (filter === 'completed') return t.status === 'completed' || t.status === 'error'
    return true
  })

  // Clear completed and cancelled transfers
  const clearFinished = () => {
    const finishedTransfers = state.transfers.filter(t => t.status === 'completed' || t.status === 'error' || t.status === 'cancelled')
    if (finishedTransfers.length === 0) return
    finishedTransfers.forEach(t => deleteTransfer(t.id))
    const remaining = storage.getTransfers()
    dispatch({ type: 'SET_TRANSFERS', payload: remaining })
    addToast('info', 'History Cleared', `Removed ${finishedTransfers.length} finished transfer record(s)`)
  }

  // Calculate high-level stats
  const activeCount = state.transfers.filter(t => t.status === 'running' || t.status === 'queued').length
  const completedCount = state.transfers.filter(t => t.status === 'completed').length
  const totalTransferredBytes = state.transfers.reduce((acc, t) => acc + (t.transferredBytes || (t.status === 'completed' ? t.totalBytes : 0)), 0)
  const currentSpeed = state.transfers.filter(t => t.status === 'running').reduce((acc, t) => acc + (t.speed || 0), 0)

  const formatEta = (seconds: number) => {
    if (!seconds || seconds <= 0 || !isFinite(seconds)) return '--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60)
      return `${hrs}h ${mins % 60}m`
    }
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  }

  return (
    <div className="flex h-full w-full bg-[#0a0a0a]">
      <div className="flex-1 flex flex-col min-w-0 p-6 md:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-3xl font-black tracking-tight text-white">Transfers</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Server-to-Server Direct
              </span>
            </div>
            <p className="text-slate-400 text-sm">Real-time cloud-to-cloud file transfers between Google Drive accounts.</p>
          </div>

          <div className="flex items-center gap-3">
            {state.transfers.some(t => t.status === 'completed' || t.status === 'error' || t.status === 'cancelled') && (
              <button 
                onClick={clearFinished}
                className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-medium border border-white/10 transition-colors flex items-center gap-1.5"
                title="Remove finished and errored transfers from history"
              >
                <i className="fa-regular fa-trash-can text-slate-400 text-xs" />
                Clear History
              </button>
            )}

            <button
              onClick={() => dispatch({ type: 'SET_TRANSFER_MODAL', payload: true })}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2"
            >
              <i className="fa-solid fa-bolt" />
              New Server-to-Server Transfer
            </button>
          </div>
        </div>

        {/* Real-time Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-8">
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
            <p className="text-xs text-slate-400 mb-1">Active Transfers</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-white">{activeCount}</p>
              {activeCount > 0 && <span className="text-[10px] text-indigo-400 font-mono">running</span>}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
            <p className="text-xs text-slate-400 mb-1">Completed</p>
            <p className="text-2xl font-bold text-emerald-400">{completedCount}</p>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
            <p className="text-xs text-slate-400 mb-1">Total Cloud Volume</p>
            <p className="text-2xl font-bold text-purple-300">{formatBytes(totalTransferredBytes)}</p>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
            <p className="text-xs text-slate-400 mb-1">Live Cloud Throughput</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-cyan-300">
                {currentSpeed > 0 ? `${formatBytes(currentSpeed)}/s` : '0 B/s'}
              </p>
              {currentSpeed > 0 && <span className="text-[10px] text-emerald-400 font-mono">active</span>}
            </div>
          </div>
        </div>

        {/* Filter Navigation */}
        <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-4">
          <button 
            onClick={() => setFilter('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'all' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            All Transfers ({state.transfers.length})
          </button>
          <button 
            onClick={() => setFilter('running')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'running' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Running ({state.transfers.filter(t => t.status === 'running' || t.status === 'queued').length})
          </button>
          <button 
            onClick={() => setFilter('completed')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'completed' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Completed ({state.transfers.filter(t => t.status === 'completed' || t.status === 'error').length})
          </button>
        </div>

        {/* Transfer Item List */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          <AnimatePresence>
            {transfers.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-16 flex flex-col items-center justify-center text-slate-500 text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 text-emerald-400">
                  <i className="fa-solid fa-bolt text-2xl" />
                </div>
                <p className="text-lg font-bold text-white mb-1.5">No transfers found</p>
                <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
                  Initiate a fast server-to-server copy or move between your Google Drive accounts with zero local bandwidth consumption.
                </p>
                <button
                  onClick={() => dispatch({ type: 'SET_TRANSFER_MODAL', payload: true })}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2"
                >
                  <i className="fa-solid fa-bolt" />
                  Create Server-to-Server Transfer
                </button>
              </motion.div>
            ) : (
              transfers.map((t) => {
                const srcAccount = state.accounts.find(a => a.id === t.sourceAccountId)
                const dstAccount = state.accounts.find(a => a.id === t.destAccountId)
                const srcLabel = t.sourcePath === 'root' || !t.sourcePath ? 'Drive Root' : t.sourcePath.split("/").pop()
                const isLogsOpen = expandedLogId === t.id
                const hasSkipExisting = t.flags?.includes('--ignore-existing')

                return (
                  <motion.div
                    key={t.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-4 group transition-colors hover:border-white/20"
                  >
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      {/* Icon */}
                      <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                        <i className={`fa-solid ${
                          t.status === 'completed' ? 'fa-check text-emerald-400' :
                          t.status === 'running' ? 'fa-bolt text-indigo-400' :
                          t.status === 'error' ? 'fa-xmark text-red-400' :
                          'fa-clock text-slate-400'
                        } text-lg`} />
                      </div>
                      
                      {/* Main Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between mb-1.5 gap-2">
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <h4 className="font-bold text-white text-sm truncate">{srcLabel}</h4>

                            {/* Operation Badge */}
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              t.operation === 'move'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            }`}>
                              {t.operation}
                            </span>

                            {/* Server-to-Server Cloud Badge */}
                            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 font-medium border border-emerald-500/30 whitespace-nowrap flex items-center gap-1">
                              <i className="fa-solid fa-bolt text-[9px]" />
                              Server-to-Server
                            </span>

                            {/* Skip Existing Badge */}
                            {hasSkipExisting && (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/15 text-cyan-300 font-medium border border-cyan-500/30 whitespace-nowrap flex items-center gap-1">
                                <i className="fa-solid fa-forward text-[9px]" />
                                Skip Existing
                              </span>
                            )}

                            {t.transferMode === 'with_folder' && (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 font-medium border border-purple-500/30 whitespace-nowrap">
                                With Folder
                              </span>
                            )}
                            {t.transferMode === 'contents_only' && (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300 font-medium border border-blue-500/30 whitespace-nowrap">
                                Contents Only
                              </span>
                            )}
                          </div>

                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full shrink-0 ${
                            t.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            t.status === 'running' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                            t.status === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                            'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                          }`}>
                            {t.status}
                          </span>
                        </div>
                        
                        {/* Source -> Destination Pipeline */}
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400 mb-3">
                          <span className="text-white font-medium">{srcAccount?.name || t.sourceAccountId}</span>
                          <span className="text-slate-500 font-mono text-[11px]">({t.sourcePath || 'root'})</span>
                          <i className="fa-solid fa-arrow-right text-slate-600 text-[10px] mx-1" />
                          <span className="text-purple-300 font-medium">{dstAccount?.name || t.destAccountId}</span>
                          <span className="text-slate-500 font-mono text-[11px]">({t.destPath || 'root'})</span>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-2 relative">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${t.progress}%` }}
                            className={`h-full absolute left-0 top-0 ${
                              t.status === 'completed' ? 'bg-emerald-500' : 
                              t.status === 'error' ? 'bg-red-500' : 
                              'bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400'
                            }`} 
                          />
                        </div>
                        
                        {/* Real-time stats row */}
                        <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 font-mono gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-bold">{Math.round(t.progress)}%</span>
                            <span>•</span>
                            <span>{formatBytes(t.transferredBytes || 0)} / {formatBytes(t.totalBytes || 0)}</span>
                          </div>

                          {t.status === 'running' && (
                            <div className="flex items-center gap-3 text-slate-300">
                              <span className="text-cyan-300 flex items-center gap-1">
                                <i className="fa-solid fa-gauge-high text-[10px]" />
                                {formatBytes(t.speed || 0)}/s
                              </span>
                              <span className="text-slate-400 flex items-center gap-1">
                                <i className="fa-solid fa-hourglass-half text-[10px]" />
                                ETA: {formatEta(t.eta)}
                              </span>
                            </div>
                          )}

                          {t.status === 'completed' && (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <i className="fa-solid fa-circle-check text-[10px]" />
                              Direct Cloud Transfer Verified
                            </span>
                          )}

                          {t.status === 'error' && (
                            <span className="text-red-400 truncate max-w-xs" title={t.error || 'Transfer failed'}>
                              {t.error || 'Failed'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        <button
                          onClick={() => setExpandedLogId(isLogsOpen ? null : t.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors flex items-center gap-1.5 ${
                            isLogsOpen ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-white/5 text-slate-400 hover:text-white'
                          }`}
                          title="View transfer execution logs"
                        >
                          <i className="fa-solid fa-terminal text-[10px]" />
                          Logs
                        </button>

                        {t.status === 'running' && (
                          <button 
                            onClick={() => {
                              cancelTransfer(t.id)
                              addToast('warning', 'Transfer Cancelled', 'The transfer was cancelled.')
                            }}
                            className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex items-center justify-center"
                            title="Cancel Transfer"
                          >
                            <i className="fa-solid fa-xmark text-xs" />
                          </button>
                        )}

                        {(t.status === 'error' || t.status === 'completed') && (
                          <button
                            onClick={async () => {
                              try {
                                const isRetry = t.status === 'error'
                                addToast('info', isRetry ? 'Retrying Transfer' : 'Re-running Transfer', `Starting ${t.sourcePath}...`)
                                storage.updateTransfer(t.id, {
                                  status: 'queued',
                                  progress: 0,
                                  transferredBytes: 0,
                                  error: null,
                                  logs: [
                                    ...(t.logs || []),
                                    { timestamp: Date.now(), level: 'info', message: isRetry ? 'Retrying transfer job...' : 'Re-running transfer job...' }
                                  ]
                                })
                                await startTransfer(t.id)
                                addToast('success', 'Transfer Started', 'Transfer is running in the background.')
                              } catch (err: any) {
                                addToast('error', 'Transfer Failed', err.message || 'Could not start transfer')
                              }
                            }}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
                            title={t.status === 'error' ? 'Retry this transfer' : 'Re-run this transfer'}
                          >
                            <i className="fa-solid fa-rotate-right text-[10px]" />
                            <span>{t.status === 'error' ? 'Retry' : 'Re-run'}</span>
                          </button>
                        )}

                        {t.status !== 'running' && (
                          <button 
                            onClick={() => {
                              deleteTransfer(t.id)
                              addToast('info', 'Record Deleted', 'Transfer record removed')
                            }}
                            className="w-8 h-8 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
                            title="Delete Transfer Record"
                          >
                            <i className="fa-regular fa-trash-can text-xs" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expandable Live Execution Logs */}
                    {isLogsOpen && (
                      <div className="mt-2 p-3 rounded-xl bg-black/60 border border-white/5 font-mono text-[11px] text-slate-300 max-h-48 overflow-y-auto space-y-1">
                        <div className="flex items-center justify-between pb-1 mb-1 border-b border-white/5 text-[10px] text-slate-500 font-bold uppercase">
                          <span>Execution Logs (ID: {t.id.slice(0, 8)})</span>
                          <span>{t.logs?.length || 0} entries</span>
                        </div>
                        {(!t.logs || t.logs.length === 0) ? (
                          <p className="text-slate-500 italic">No logs recorded yet.</p>
                        ) : (
                          t.logs.map((log, idx) => (
                            <div key={idx} className="flex items-start gap-2 leading-tight">
                              <span className="text-slate-600 shrink-0">
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </span>
                              <span className={`shrink-0 uppercase font-bold text-[10px] ${
                                log.level === 'error' ? 'text-red-400' :
                                log.level === 'warn' ? 'text-amber-400' :
                                'text-indigo-400'
                              }`}>
                                [{log.level}]
                              </span>
                              <span className="text-slate-300 break-all">{log.message}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </motion.div>
                )
              })
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
