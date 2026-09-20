import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { createTransfer, startTransfer, browseFiles, browseSharedFiles, transferSharedItemsToDrive, formatBytes } from '../services/rclone'
import type { DriveFile } from '../types'

interface FileItemProps {
  file: DriveFile
  isSelected: boolean
  onSelect: () => void
  onOpen?: () => void
}

function ItemRow({ file, isSelected, onSelect, onOpen }: FileItemProps) {
  return (
    <div
      className={`group flex items-center justify-between p-2.5 rounded-xl border transition-all ${
        isSelected
          ? 'bg-indigo-500/15 border-indigo-500/40 shadow-sm'
          : 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10'
      }`}
    >
      <div 
        onClick={file.isFolder && onOpen ? onOpen : onSelect}
        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          file.isFolder ? 'bg-amber-500/15 text-amber-400' : 'bg-indigo-500/15 text-indigo-400'
        }`}>
          <i className={`fa-solid ${
            file.isFolder 
              ? 'fa-folder' 
              : file.mimeType?.includes('image')
              ? 'fa-file-image'
              : file.mimeType?.includes('video')
              ? 'fa-file-video'
              : file.mimeType?.includes('pdf')
              ? 'fa-file-pdf'
              : file.mimeType?.includes('zip') || file.mimeType?.includes('compressed')
              ? 'fa-file-zipper'
              : 'fa-file-lines'
          } text-sm`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-medium truncate ${isSelected ? 'text-indigo-300 font-semibold' : 'text-slate-200 group-hover:text-white'}`}>
            {file.name}
          </p>
          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
            {file.isFolder ? (
              <span>Folder</span>
            ) : (
              <>
                <span>{formatBytes(file.size || 0)}</span>
                {file.modifiedTime && (
                  <>
                    <span>•</span>
                    <span>{new Date(file.modifiedTime).toLocaleDateString()}</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onSelect()
          }}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
            isSelected
              ? 'bg-indigo-500 text-white shadow-sm'
              : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
          }`}
          title={file.isFolder ? 'Select this folder' : 'Select this file'}
        >
          <i className={`fa-solid ${isSelected ? 'fa-circle-check' : 'fa-check'} text-[11px]`} />
          <span>{isSelected ? 'Selected' : 'Select'}</span>
        </button>

        {file.isFolder && onOpen && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onOpen()
            }}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            title="Open folder to view contents"
          >
            <i className="fa-solid fa-chevron-right text-xs" />
          </button>
        )}
      </div>
    </div>
  )
}

export default function TransferModal() {
  const { state, dispatch, addToast } = useApp()

  // Tabs / Stepper
  const [activeStep, setActiveStep] = useState<'source' | 'dest' | 'options'>('source')

  // Accounts
  const [sourceId, setSourceId] = useState(state.transferConfig?.sourceAccountId || state.accounts[0]?.id || '')
  const [destId, setDestId] = useState(
    state.transferConfig?.destAccountId ||
    (state.accounts.find(a => a.id !== (state.transferConfig?.sourceAccountId || state.accounts[0]?.id))?.id || '')
  )

  // Source Selection
  const [sourceBrowsePath, setSourceBrowsePath] = useState('root')
  const [selectedSourcePath, setSelectedSourcePath] = useState(state.transferConfig?.sourcePath || 'root')
  const [selectedSourceName, setSelectedSourceName] = useState(
    state.transferConfig?.sourcePath && state.transferConfig.sourcePath !== 'root'
      ? state.transferConfig.sourcePath.split('/').pop() || 'Selected Item'
      : 'Drive Root'
  )
  const [selectedSourceType, setSelectedSourceType] = useState<'folder' | 'file' | 'root'>(
    state.transferConfig?.sourceType || (state.transferConfig?.sourcePath && state.transferConfig.sourcePath !== 'root' ? 'folder' : 'root')
  )

  // Destination Selection
  const [destBrowsePath, setDestBrowsePath] = useState('root')
  const [selectedDestPath, setSelectedDestPath] = useState('root')
  const [destSubfolder, setDestSubfolder] = useState('')

  // Source Section Switcher: My Drive vs Shared with me
  const [sourceSection, setSourceSection] = useState<'my-drive' | 'shared-with-me'>('my-drive')
  const [sourceSharedFolderId, setSourceSharedFolderId] = useState('shared-root')
  const [sourceSharedFolderName, setSourceSharedFolderName] = useState('Shared with me')
  const [sourceSharedBreadcrumbs, setSourceSharedBreadcrumbs] = useState<{ id: string; name: string }[]>([
    { id: 'shared-root', name: 'Shared with me' }
  ])
  const [sourceSharedFiles, setSourceSharedFiles] = useState<DriveFile[]>([])
  const [sourceSharedLoading, setSourceSharedLoading] = useState(false)
  const [selectedSharedItem, setSelectedSharedItem] = useState<DriveFile | null>(null)

  // Transfer Structure & Options (Key user requirement)
  const [transferMode, setTransferMode] = useState<'with_folder' | 'contents_only'>('with_folder')
  const [operation, setOperation] = useState<'copy' | 'move' | 'sync'>('copy')
  const [flags, setFlags] = useState<string[]>([
    '--drive-server-side-across-configs',
    '--server-side-across-configs'
  ])

  // File lists & loading states
  const [sourceFiles, setSourceFiles] = useState<DriveFile[]>([])
  const [sourceBreadcrumbs, setSourceBreadcrumbs] = useState<{ id: string; name: string }[]>([{ id: 'root', name: 'Root' }])
  const [sourceLoading, setSourceLoading] = useState(false)
  const [sourceSearch, setSourceSearch] = useState('')

  const [destFiles, setDestFiles] = useState<DriveFile[]>([])
  const [destBreadcrumbs, setDestBreadcrumbs] = useState<{ id: string; name: string }[]>([{ id: 'root', name: 'Root' }])
  const [destLoading, setDestLoading] = useState(false)
  const [destSearch, setDestSearch] = useState('')

  const [creating, setCreating] = useState(false)

  // Initialize or reset when modal opens
  useEffect(() => {
    if (state.transferModalOpen) {
      if (state.transferConfig?.sourceAccountId) {
        setSourceId(state.transferConfig.sourceAccountId)
      } else if (!sourceId && state.accounts.length > 0) {
        setSourceId(state.accounts[0].id)
      }

      const isSharedConfig = Boolean(
        state.transferConfig?.isSharedWithMe ||
        state.transferConfig?.sourcePath?.startsWith('shared:') ||
        state.transferConfig?.sharedItem
      )
      if (isSharedConfig) {
        setSourceSection('shared-with-me')
        if (state.transferConfig?.sharedItem) {
          setSelectedSharedItem(state.transferConfig.sharedItem)
          setSelectedSourceName(state.transferConfig.sharedItem.name)
          setSelectedSourcePath(`shared:${state.transferConfig.sharedItem.name}`)
          setSelectedSourceType(state.transferConfig.sharedItem.isFolder ? 'folder' : 'file')
        } else if (state.transferConfig?.sourcePath) {
          const name = state.transferConfig.sourcePath.replace(/^shared:/, '')
          setSelectedSourceName(name)
          setSelectedSourcePath(state.transferConfig.sourcePath)
          setSelectedSourceType(state.transferConfig.sourceType || 'folder')
        }
        if (state.transferConfig?.parentSharedFolderId) {
          setSourceSharedFolderId(state.transferConfig.parentSharedFolderId)
        }
      } else {
        setSourceSection('my-drive')
        setSelectedSharedItem(null)
        if (state.transferConfig?.sourcePath) {
          const p = state.transferConfig.sourcePath
          setSelectedSourcePath(p)
          const name = p === 'root' ? 'Drive Root' : p.split('/').pop() || 'Selected Item'
          setSelectedSourceName(name)
          setSelectedSourceType(state.transferConfig.sourceType || (p === 'root' ? 'root' : 'folder'))
        }
      }

      if (state.transferConfig?.destAccountId) {
        setDestId(state.transferConfig.destAccountId)
      } else if (!destId && state.accounts.length > 1) {
        const other = state.accounts.find(a => a.id !== (state.transferConfig?.sourceAccountId || state.accounts[0]?.id))
        if (other) setDestId(other.id)
      }

      if (state.transferConfig?.destPath) {
        setSelectedDestPath(state.transferConfig.destPath)
      }
    }
  }, [state.transferModalOpen, state.transferConfig, state.accounts])

  // Load Source Files (My Drive)
  useEffect(() => {
    if (!state.transferModalOpen || !sourceId || sourceSection !== 'my-drive') return
    const account = state.accounts.find(a => a.id === sourceId)
    if (!account) return

    let isMounted = true
    const load = async () => {
      setSourceLoading(true)
      try {
        const res = await browseFiles(account, sourceBrowsePath)
        if (isMounted) {
          setSourceFiles(res.files || [])
          setSourceBreadcrumbs(res.path || [{ id: 'root', name: account.name }])
        }
      } catch {
        if (isMounted) {
          setSourceFiles([])
        }
      } finally {
        if (isMounted) setSourceLoading(false)
      }
    }
    load()
    return () => { isMounted = false }
  }, [sourceId, sourceBrowsePath, sourceSection, state.transferModalOpen, state.accounts])

  // Load Shared with me files
  useEffect(() => {
    if (!state.transferModalOpen || !sourceId || sourceSection !== 'shared-with-me') return
    const account = state.accounts.find(a => a.id === sourceId)
    if (!account) return

    let isMounted = true
    const load = async () => {
      setSourceSharedLoading(true)
      try {
        const res = await browseSharedFiles(
          account,
          sourceSharedFolderId,
          sourceSharedFolderName,
          sourceSharedBreadcrumbs
        )
        if (isMounted) {
          setSourceSharedFiles(res.files || [])
          setSourceSharedBreadcrumbs(res.path || [{ id: 'shared-root', name: 'Shared with me' }])
        }
      } catch {
        if (isMounted) {
          setSourceSharedFiles([])
        }
      } finally {
        if (isMounted) setSourceSharedLoading(false)
      }
    }
    load()
    return () => { isMounted = false }
  }, [sourceId, sourceSharedFolderId, sourceSection, state.transferModalOpen, state.accounts])

  // Load Destination Files (Folders only)
  useEffect(() => {
    if (!state.transferModalOpen || !destId) return
    const account = state.accounts.find(a => a.id === destId)
    if (!account) return

    let isMounted = true
    const load = async () => {
      setDestLoading(true)
      try {
        const res = await browseFiles(account, destBrowsePath)
        if (isMounted) {
          // Keep only folders for destination
          setDestFiles((res.files || []).filter(f => f.isFolder))
          setDestBreadcrumbs(res.path || [{ id: 'root', name: account.name }])
        }
      } catch {
        if (isMounted) {
          setDestFiles([])
        }
      } finally {
        if (isMounted) setDestLoading(false)
      }
    }
    load()
    return () => { isMounted = false }
  }, [destId, destBrowsePath, state.transferModalOpen, state.accounts])

  if (!state.transferModalOpen) return null

  const handleClose = () => {
    dispatch({ type: 'SET_TRANSFER_MODAL', payload: false })
    setActiveStep('source')
    setSourceBrowsePath('root')
    setDestBrowsePath('root')
    setSourceSearch('')
    setDestSearch('')
    setDestSubfolder('')
  }

  // Calculate the target destination path based on user's transfer mode
  const computeFinalPaths = () => {
    const cleanDestBase = selectedDestPath === 'root' || !selectedDestPath ? '' : selectedDestPath.replace(/^\/+|\/+$/g, '')
    const cleanSub = destSubfolder.trim().replace(/^\/+|\/+$/g, '')
    const destinationTargetFolder = [cleanDestBase, cleanSub].filter(Boolean).join('/')

    if (sourceSection === 'shared-with-me') {
      return {
        sourcePath: `shared:${selectedSourceName || 'item'}`,
        destPath: destinationTargetFolder || 'root',
        destinationFolderPreview: destinationTargetFolder || 'Drive Root'
      }
    }

    let effectiveDest = destinationTargetFolder

    if (selectedSourceType === 'folder') {
      if (transferMode === 'with_folder') {
        // "With Folder": Creates folder inside destinationTargetFolder
        effectiveDest = destinationTargetFolder ? `${destinationTargetFolder}/${selectedSourceName}` : selectedSourceName
      } else {
        // "Contents Only": Unpacks files and subfolders directly inside destinationTargetFolder
        effectiveDest = destinationTargetFolder || 'root'
      }
    } else if (selectedSourceType === 'file') {
      // File will be placed inside destinationTargetFolder
      effectiveDest = destinationTargetFolder || 'root'
    } else {
      // Root
      effectiveDest = destinationTargetFolder || 'root'
    }

    return {
      sourcePath: selectedSourcePath,
      destPath: effectiveDest || 'root',
      destinationFolderPreview: destinationTargetFolder || 'Drive Root'
    }
  }

  const { sourcePath: finalSourcePath, destPath: finalDestPath } = computeFinalPaths()

  const handleCreate = async () => {
    if (!sourceId || !destId) {
      addToast('warning', 'Missing Accounts', 'Please select both source and destination accounts')
      return
    }
    if (sourceId === destId && selectedSourcePath === finalDestPath) {
      addToast('error', 'Invalid Selection', 'Source and destination folder cannot be identical in the same account')
      return
    }

    const sourceAccount = state.accounts.find(a => a.id === sourceId)
    const destAccount = state.accounts.find(a => a.id === destId)
    if (!sourceAccount || !destAccount) {
      addToast('error', 'Error', 'Account not found')
      return
    }

    // Special handler for Shared with Me items
    const isShared = sourceSection === 'shared-with-me' || 
                     selectedSourcePath.startsWith('shared:') || 
                     Boolean(selectedSharedItem)

    if (isShared) {
      if (!selectedSharedItem && !selectedSourcePath.startsWith('shared:')) {
        addToast('warning', 'Selection Required', 'Please select a file or folder from Shared with me to transfer')
        return
      }

      setCreating(true)
      try {
        const cleanDestBase = selectedDestPath === 'root' || !selectedDestPath ? '' : selectedDestPath.replace(/^\/+|\/+$/g, '')
        const cleanSub = destSubfolder.trim().replace(/^\/+|\/+$/g, '')
        const destinationTargetFolder = [cleanDestBase, cleanSub].filter(Boolean).join('/')

        if (selectedSharedItem) {
          const res = await transferSharedItemsToDrive(
            sourceAccount,
            destAccount,
            [selectedSharedItem],
            destinationTargetFolder,
            sourceSharedFolderId === 'shared-root' ? undefined : sourceSharedFolderId,
            selectedSourceType === 'folder' ? transferMode : undefined
          )

          if (res.success) {
            addToast(
              'success',
              'Transfer Started',
              `Direct cloud-to-cloud transfer of "${selectedSharedItem.name}" to ${destAccount.name} initiated.`
            )
            handleClose()
            dispatch({ type: 'SET_VIEW', payload: 'transfers' })
          }
        } else {
          // Shared item with path
          const transfer = await createTransfer(
            sourceAccount,
            destAccount,
            finalSourcePath,
            finalDestPath,
            operation,
            flags,
            {
              sourceType: selectedSourceType,
              transferMode: selectedSourceType === 'folder' ? transferMode : (selectedSourceType === 'file' ? 'file' : 'contents_only'),
              isSharedSource: true,
              sourceFileId: selectedSharedItem?.id || state.transferConfig?.sourceFileId || state.transferConfig?.sharedItem?.id,
              parentSharedFolderId: sourceSharedFolderId === 'shared-root' ? undefined : (sourceSharedFolderId || state.transferConfig?.parentSharedFolderId)
            }
          )

          await startTransfer(transfer.id)

          addToast(
            'success',
            'Transfer Started',
            `Cloud-to-cloud transfer started from Shared with me to ${destAccount.name}`
          )
          handleClose()
          dispatch({ type: 'SET_VIEW', payload: 'transfers' })
        }
      } catch (err: any) {
        addToast('error', 'Transfer Failed', err?.message || 'Could not transfer shared item')
      } finally {
        setCreating(false)
      }
      return
    }

    setCreating(true)
    try {
      const transfer = await createTransfer(
        sourceAccount,
        destAccount,
        finalSourcePath,
        finalDestPath,
        operation,
        flags,
        {
          sourceType: selectedSourceType,
          transferMode: selectedSourceType === 'folder' ? transferMode : (selectedSourceType === 'file' ? 'file' : 'contents_only'),
          isSharedSource: Boolean(state.transferConfig?.isSharedWithMe || finalSourcePath.startsWith('shared:')),
          sourceFileId: selectedSharedItem?.id || state.transferConfig?.sourceFileId || state.transferConfig?.sharedItem?.id,
          parentSharedFolderId: sourceSharedFolderId === 'shared-root' ? undefined : (sourceSharedFolderId || state.transferConfig?.parentSharedFolderId)
        }
      )

      // Start the transfer immediately
      await startTransfer(transfer.id)

      addToast(
        'success',
        'Transfer Started',
        `${operation.toUpperCase()} transfer started from ${sourceAccount.name} to ${destAccount.name}`
      )
      handleClose()
      dispatch({ type: 'SET_VIEW', payload: 'transfers' })
    } catch (err: any) {
      addToast('error', 'Transfer Failed', err?.message || 'Could not create transfer job')
    } finally {
      setCreating(false)
    }
  }

  const toggleFlag = (flag: string) => {
    setFlags(prev => prev.includes(flag) ? prev.filter(f => f !== flag) : [...prev, flag])
  }

  const sourceAccount = state.accounts.find(a => a.id === sourceId)
  const destAccount = state.accounts.find(a => a.id === destId)

  const filteredSourceFiles = sourceFiles.filter(f => 
    f.name.toLowerCase().includes(sourceSearch.toLowerCase())
  )

  const filteredSharedFiles = sourceSharedFiles.filter(f => 
    f.name.toLowerCase().includes(sourceSearch.toLowerCase())
  )

  const filteredDestFiles = destFiles.filter(f => 
    f.name.toLowerCase().includes(destSearch.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={handleClose} />

      <div className="relative w-full max-w-3xl glass-card rounded-2xl p-6 animate-slide-up border border-indigo-500/25 max-h-[92vh] flex flex-col bg-[#0f1117] text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <i className="fa-solid fa-arrow-right-arrow-left text-sm" />
              </div>
              <h3 className="text-xl font-bold text-white">Create Transfer</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Select files or folders from Source Drive and transfer them to your Destination Drive
            </p>
          </div>
          <button 
            onClick={handleClose} 
            className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <i className="fa-solid fa-xmark text-lg" />
          </button>
        </div>

        {/* Persistent Pipeline Summary */}
        <div className="mt-3.5 p-3 rounded-xl bg-white/[0.03] border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-slate-400">Source:</span>
            <span className="font-semibold text-white truncate">{sourceAccount?.name || 'Select'}</span>
            <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-mono text-[11px] truncate max-w-[150px]">
              {selectedSourceName}
            </span>
          </div>

          <i className="fa-solid fa-arrow-right text-slate-600 hidden sm:block" />

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-slate-400">Destination:</span>
            <span className="font-semibold text-white truncate">{destAccount?.name || 'Select'}</span>
            <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-mono text-[11px] truncate max-w-[150px]">
              {selectedDestPath === 'root' ? 'Root' : selectedDestPath.split('/').pop()}
            </span>
          </div>

          {selectedSourceType === 'folder' && (
            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-white/10 text-slate-300 border border-white/10">
              {transferMode === 'with_folder' ? 'With Folder' : 'Contents Only'}
            </span>
          )}
        </div>

        {/* Step Navigation Tabs */}
        <div className="flex items-center gap-2 mt-4 border-b border-white/10 pb-3 shrink-0">
          <button
            type="button"
            onClick={() => setActiveStep('source')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              activeStep === 'source'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">1</span>
            <span>Source Drive & Items</span>
            {selectedSourcePath && <i className="fa-solid fa-circle-check text-green-400 text-[11px]" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveStep('dest')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              activeStep === 'dest'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">2</span>
            <span>Destination Drive & Folder</span>
            {destId && <i className="fa-solid fa-circle-check text-green-400 text-[11px]" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveStep('options')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              activeStep === 'options'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">3</span>
            <span>Transfer Options & Start</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto py-4 pr-1 min-h-[360px]">
          <AnimatePresence mode="wait">
            {/* STEP 1: SOURCE SELECTION */}
            {activeStep === 'source' && (
              <motion.div
                key="step-source"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4"
              >
                {/* Source Drive Account */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                    1. Select Source Drive Account
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {state.accounts.map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => {
                          setSourceId(acc.id)
                          setSourceBrowsePath('root')
                          setSelectedSourcePath('root')
                          setSelectedSourceName('Drive Root')
                          setSelectedSourceType('root')
                        }}
                        className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${
                          sourceId === acc.id
                            ? 'bg-indigo-500/20 border-indigo-500/50 shadow-md shadow-indigo-500/10'
                            : 'bg-white/[0.02] border-white/5 hover:bg-white/5'
                        }`}
                      >
                        <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                          <i className="fa-brands fa-google-drive text-base" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate">{acc.name}</p>
                          <p className="text-[11px] text-slate-400 truncate">{acc.email}</p>
                        </div>
                        {sourceId === acc.id && (
                          <i className="fa-solid fa-circle-check text-indigo-400 text-sm" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Source Browser & Item Picker */}
                {sourceId && (
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                    {/* Source Mode Switcher: My Drive vs Shared with me */}
                    <div className="flex items-center gap-1.5 p-1 bg-white/5 border border-white/10 rounded-xl">
                      <button
                        type="button"
                        onClick={() => {
                          setSourceSection('my-drive')
                          setSelectedSharedItem(null)
                          setSelectedSourcePath('root')
                          setSelectedSourceName('Drive Root')
                          setSelectedSourceType('root')
                        }}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                          sourceSection === 'my-drive'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <i className="fa-brands fa-google-drive text-[11px]" />
                        <span>My Drive</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSourceSection('shared-with-me')
                          setSelectedSharedItem(null)
                          setSelectedSourcePath('')
                          setSelectedSourceName('')
                          setSelectedSourceType('file')
                        }}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                          sourceSection === 'shared-with-me'
                            ? 'bg-sky-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <i className="fa-solid fa-user-group text-[11px]" />
                        <span>Shared with me</span>
                      </button>
                    </div>

                    {sourceSection === 'shared-with-me' ? (
                      /* Shared with me file picker */
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <i className="fa-solid fa-user-group text-sky-400" />
                            <span>2. Select Shared Item to Transfer</span>
                          </label>
                          <span className="text-[11px] text-sky-400 font-medium">
                            Cloud-to-Cloud Copy
                          </span>
                        </div>

                        {/* Breadcrumbs for Shared with me */}
                        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-900/60 border border-white/5">
                          <div className="flex items-center gap-1 overflow-x-auto text-xs py-0.5 no-scrollbar">
                            {sourceSharedBreadcrumbs.map((crumb, idx) => (
                              <div key={crumb.id} className="flex items-center shrink-0">
                                {idx > 0 && <i className="fa-solid fa-chevron-right text-[10px] text-slate-600 mx-1.5" />}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSourceSharedFolderId(crumb.id)
                                    setSourceSharedFolderName(crumb.name)
                                  }}
                                  className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                                    sourceSharedFolderId === crumb.id
                                      ? 'bg-sky-500/20 text-sky-300 font-semibold'
                                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                                  }`}
                                >
                                  {idx === 0 ? <i className="fa-solid fa-user-group mr-1.5 text-[10px] text-sky-400" /> : null}
                                  {crumb.name}
                                </button>
                              </div>
                            ))}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {sourceSharedFolderId !== 'shared-root' && (
                              <button
                                type="button"
                                onClick={() => {
                                  const parent = sourceSharedBreadcrumbs[sourceSharedBreadcrumbs.length - 2] || { id: 'shared-root', name: 'Shared with me' }
                                  setSourceSharedFolderId(parent.id)
                                  setSourceSharedFolderName(parent.name)
                                }}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs"
                                title="Go up one folder level"
                              >
                                <i className="fa-solid fa-arrow-up" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                const acc = state.accounts.find(a => a.id === sourceId)
                                if (acc) {
                                  setSourceSharedLoading(true)
                                  browseSharedFiles(acc, sourceSharedFolderId, sourceSharedFolderName, sourceSharedBreadcrumbs)
                                    .then(res => {
                                      setSourceSharedFiles(res.files || [])
                                      setSourceSharedBreadcrumbs(res.path || [{ id: 'shared-root', name: 'Shared with me' }])
                                    })
                                    .finally(() => setSourceSharedLoading(false))
                                }
                              }}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs"
                              title="Refresh shared items"
                            >
                              <i className={`fa-solid fa-arrows-rotate ${sourceSharedLoading ? 'fa-spin' : ''}`} />
                            </button>
                          </div>
                        </div>

                        {/* Quick select current shared folder button */}
                        {sourceSharedFolderId !== 'shared-root' && (
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/25">
                            <div className="flex items-center gap-2 text-xs text-sky-200">
                              <i className="fa-solid fa-folder-open text-sky-400" />
                              <span>Inside shared folder: <strong className="text-white">{sourceSharedFolderName}</strong></span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSharedItem({
                                  id: sourceSharedFolderId,
                                  name: sourceSharedFolderName,
                                  path: `shared:${sourceSharedFolderName}`,
                                  isFolder: true,
                                  sharedWithMe: true
                                } as any)
                                setSelectedSourceName(sourceSharedFolderName)
                                setSelectedSourcePath(`shared:${sourceSharedFolderName}`)
                                setSelectedSourceType('folder')
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                selectedSharedItem?.id === sourceSharedFolderId
                                  ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30'
                                  : 'bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 border border-sky-500/40'
                              }`}
                            >
                              <i className={`fa-solid ${selectedSharedItem?.id === sourceSharedFolderId ? 'fa-check' : 'fa-folder-check'} text-[11px]`} />
                              <span>{selectedSharedItem?.id === sourceSharedFolderId ? 'Folder Selected' : `Select "${sourceSharedFolderName}"`}</span>
                            </button>
                          </div>
                        )}

                        {/* Search box */}
                        <div className="relative">
                          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs" />
                          <input
                            type="text"
                            value={sourceSearch}
                            onChange={(e) => setSourceSearch(e.target.value)}
                            placeholder="Search shared files and folders..."
                            className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-900/60 border border-white/5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50"
                          />
                        </div>

                        {/* Shared Files List */}
                        <div className="h-56 overflow-y-auto space-y-1.5 pr-1">
                          {sourceSharedLoading ? (
                            <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-500">
                              <i className="fa-solid fa-spinner fa-spin text-sky-400 text-lg" />
                              <span className="text-xs">Loading shared items...</span>
                            </div>
                          ) : filteredSharedFiles.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                              {sourceSearch ? 'No matching shared items found' : 'No items shared with this account'}
                            </div>
                          ) : (
                            filteredSharedFiles.map((file) => {
                              const isSelected = selectedSharedItem?.id === file.id || selectedSourceName === file.name

                              return (
                                <ItemRow
                                  key={file.id || file.name}
                                  file={file}
                                  isSelected={isSelected}
                                  onSelect={() => {
                                    setSelectedSharedItem(file)
                                    setSelectedSourceName(file.name)
                                    setSelectedSourcePath(`shared:${file.name}`)
                                    setSelectedSourceType(file.isFolder ? 'folder' : 'file')
                                  }}
                                  onOpen={file.isFolder ? () => {
                                    setSourceSharedFolderId(file.id)
                                    setSourceSharedFolderName(file.name)
                                  } : undefined}
                                />
                              )
                            })
                          )}
                        </div>

                        {/* Active Selected Source Card for Shared */}
                        <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                              <i className={`fa-solid ${
                                selectedSourceType === 'folder' ? 'fa-folder' : 'fa-file-lines'
                              }`} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">
                                Selected Shared Item: <span className="text-sky-300">{selectedSourceName || 'None chosen'}</span>
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {selectedSharedItem
                                  ? `${selectedSourceType === 'folder' ? 'Shared Folder' : 'Shared File'} • Direct cloud copy from Shared with me into target Drive`
                                  : 'Click "Select" on any item above to choose it for transfer'}
                              </p>
                            </div>
                          </div>
                          {selectedSharedItem && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30 shrink-0">
                              {selectedSourceType}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* My Drive file picker */
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            2. Select Folder or File to Transfer
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSourcePath('root')
                                setSelectedSourceName('Entire Drive Root')
                                setSelectedSourceType('root')
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                                selectedSourceType === 'root'
                                  ? 'bg-indigo-500 text-white font-semibold'
                                  : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              <i className="fa-solid fa-database text-[11px]" />
                              Select Entire Drive (Root)
                            </button>
                            {sourceBrowsePath !== 'root' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSourcePath(sourceBrowsePath)
                                  setSelectedSourceName(sourceBrowsePath.split('/').pop() || 'Current Folder')
                                  setSelectedSourceType('folder')
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                                  selectedSourcePath === sourceBrowsePath && selectedSourceType === 'folder'
                                    ? 'bg-indigo-500 text-white font-semibold'
                                    : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                <i className="fa-solid fa-folder-check text-[11px]" />
                                Select Current Folder
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Breadcrumbs bar */}
                        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-900/60 border border-white/5">
                          <div className="flex items-center gap-1 overflow-x-auto text-xs py-0.5">
                            {sourceBreadcrumbs.map((crumb, idx) => (
                              <div key={crumb.id} className="flex items-center shrink-0">
                                {idx > 0 && <i className="fa-solid fa-chevron-right text-[10px] text-slate-600 mx-1.5" />}
                                <button
                                  type="button"
                                  onClick={() => setSourceBrowsePath(crumb.id)}
                                  className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                                    sourceBrowsePath === crumb.id
                                      ? 'bg-indigo-500/20 text-indigo-300 font-semibold'
                                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                                  }`}
                                >
                                  {idx === 0 ? <i className="fa-solid fa-house mr-1 text-[10px]" /> : null}
                                  {crumb.name}
                                </button>
                              </div>
                            ))}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {sourceBrowsePath !== 'root' && (
                              <button
                                type="button"
                                onClick={() => {
                                  const parts = sourceBrowsePath.split('/')
                                  parts.pop()
                                  setSourceBrowsePath(parts.length ? parts.join('/') : 'root')
                                }}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs"
                                title="Go up one folder level"
                              >
                                <i className="fa-solid fa-arrow-up" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSourceBrowsePath(curr => curr + ' ')} // triggers re-fetch
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs"
                              title="Refresh folder"
                            >
                              <i className="fa-solid fa-arrows-rotate" />
                            </button>
                          </div>
                        </div>

                        {/* Search box */}
                        <div className="relative">
                          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs" />
                          <input
                            type="text"
                            value={sourceSearch}
                            onChange={(e) => setSourceSearch(e.target.value)}
                            placeholder="Search files and folders in current directory..."
                            className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-900/60 border border-white/5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
                          />
                        </div>

                        {/* Files / Folders List */}
                        <div className="h-56 overflow-y-auto space-y-1.5 pr-1">
                          {sourceLoading ? (
                            <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-500">
                              <i className="fa-solid fa-spinner fa-spin text-indigo-400 text-lg" />
                              <span className="text-xs">Loading files...</span>
                            </div>
                          ) : filteredSourceFiles.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                              {sourceSearch ? 'No matching files or folders' : 'This folder is empty'}
                            </div>
                          ) : (
                            filteredSourceFiles.map((file) => {
                              const itemPath = sourceBrowsePath === 'root' ? file.name : `${sourceBrowsePath}/${file.name}`
                              const isSelected = selectedSourcePath === itemPath

                              return (
                                <ItemRow
                                  key={file.id || file.name}
                                  file={file}
                                  isSelected={isSelected}
                                  onSelect={() => {
                                    setSelectedSourcePath(itemPath)
                                    setSelectedSourceName(file.name)
                                    setSelectedSourceType(file.isFolder ? 'folder' : 'file')
                                  }}
                                  onOpen={file.isFolder ? () => setSourceBrowsePath(itemPath) : undefined}
                                />
                              )
                            })
                          )}
                        </div>

                        {/* Active Selected Source Card */}
                        <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                              <i className={`fa-solid ${
                                selectedSourceType === 'root' ? 'fa-database' : selectedSourceType === 'folder' ? 'fa-folder' : 'fa-file-lines'
                              }`} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">
                                Selected Source: <span className="text-indigo-300">{selectedSourceName}</span>
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {selectedSourceType === 'root'
                                  ? 'Entire Drive (All files and subfolders)'
                                  : selectedSourceType === 'folder'
                                  ? `Folder: ${selectedSourcePath} (Includes all subfolders & files)`
                                  : `Single File: ${selectedSourcePath}`}
                              </p>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                            {selectedSourceType}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 2: DESTINATION SELECTION */}
            {activeStep === 'dest' && (
              <motion.div
                key="step-dest"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4"
              >
                {/* Destination Drive Account */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                    1. Select Destination Drive Account
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {state.accounts.map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => {
                          setDestId(acc.id)
                          setDestBrowsePath('root')
                          setSelectedDestPath('root')
                        }}
                        className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${
                          destId === acc.id
                            ? 'bg-purple-500/20 border-purple-500/50 shadow-md shadow-purple-500/10'
                            : 'bg-white/[0.02] border-white/5 hover:bg-white/5'
                        }`}
                      >
                        <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                          <i className="fa-brands fa-google-drive text-base" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate">{acc.name}</p>
                          <p className="text-[11px] text-slate-400 truncate">{acc.email}</p>
                        </div>
                        {destId === acc.id && (
                          <i className="fa-solid fa-circle-check text-purple-400 text-sm" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Destination Folder Browser */}
                {destId && (
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        2. Select Destination Target Folder
                      </label>
                      <button
                        type="button"
                        onClick={() => setSelectedDestPath(destBrowsePath)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-500 text-white hover:bg-purple-600 transition-colors flex items-center gap-1.5 self-start"
                      >
                        <i className="fa-solid fa-check text-[11px]" />
                        Target Current Folder ({destBrowsePath === 'root' ? 'Root' : destBrowsePath.split('/').pop()})
                      </button>
                    </div>

                    {/* Breadcrumbs bar */}
                    <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-900/60 border border-white/5">
                      <div className="flex items-center gap-1 overflow-x-auto text-xs py-0.5">
                        {destBreadcrumbs.map((crumb, idx) => (
                          <div key={crumb.id} className="flex items-center shrink-0">
                            {idx > 0 && <i className="fa-solid fa-chevron-right text-[10px] text-slate-600 mx-1.5" />}
                            <button
                              type="button"
                              onClick={() => setDestBrowsePath(crumb.id)}
                              className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                                destBrowsePath === crumb.id
                                  ? 'bg-purple-500/20 text-purple-300 font-semibold'
                                  : 'text-slate-400 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              {idx === 0 ? <i className="fa-solid fa-house mr-1 text-[10px]" /> : null}
                              {crumb.name}
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {destBrowsePath !== 'root' && (
                          <button
                            type="button"
                            onClick={() => {
                              const parts = destBrowsePath.split('/')
                              parts.pop()
                              setDestBrowsePath(parts.length ? parts.join('/') : 'root')
                            }}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs"
                            title="Go up one folder level"
                          >
                            <i className="fa-solid fa-arrow-up" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDestBrowsePath(curr => curr + ' ')}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs"
                          title="Refresh folder"
                        >
                          <i className="fa-solid fa-arrows-rotate" />
                        </button>
                      </div>
                    </div>

                    {/* Search box */}
                    <div className="relative">
                      <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs" />
                      <input
                        type="text"
                        value={destSearch}
                        onChange={(e) => setDestSearch(e.target.value)}
                        placeholder="Search folders..."
                        className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-900/60 border border-white/5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50"
                      />
                    </div>

                    {/* Folders List */}
                    <div className="h-44 overflow-y-auto space-y-1.5 pr-1">
                      {destLoading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-500">
                          <i className="fa-solid fa-spinner fa-spin text-purple-400 text-lg" />
                          <span className="text-xs">Loading folders...</span>
                        </div>
                      ) : filteredDestFiles.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                          No subfolders found. You can transfer directly into this folder or root.
                        </div>
                      ) : (
                        filteredDestFiles.map((folder) => {
                          const folderPath = destBrowsePath === 'root' ? folder.name : `${destBrowsePath}/${folder.name}`
                          const isSelected = selectedDestPath === folderPath

                          return (
                            <ItemRow
                              key={folder.id || folder.name}
                              file={folder}
                              isSelected={isSelected}
                              onSelect={() => setSelectedDestPath(folderPath)}
                              onOpen={() => setDestBrowsePath(folderPath)}
                            />
                          )
                        })
                      )}
                    </div>

                    {/* Optional custom subfolder input */}
                    <div className="pt-2 border-t border-white/5">
                      <label className="text-[11px] text-slate-400 block mb-1">
                        Optional: Create or specify a nested subfolder inside destination
                      </label>
                      <input
                        type="text"
                        value={destSubfolder}
                        onChange={(e) => setDestSubfolder(e.target.value)}
                        placeholder="e.g. Backups_2026 or Archives (optional)"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900/60 border border-white/10 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    {/* Active Selected Destination Card */}
                    <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                          <i className="fa-solid fa-folder-tree" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">
                            Selected Destination: <span className="text-purple-300">{destAccount?.name}</span>
                          </p>
                          <p className="text-[10px] text-slate-400 truncate font-mono">
                            Target Path: /{selectedDestPath === 'root' ? '' : selectedDestPath}
                            {destSubfolder ? `/${destSubfolder}` : ''}
                          </p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                        Target Ready
                      </span>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 3: OPTIONS & START */}
            {activeStep === 'options' && (
              <motion.div
                key="step-options"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-5"
              >
                {/* Structure Options: "With Folder" vs "Contents Only" */}
                {selectedSourceType === 'folder' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                        <i className="fa-solid fa-folder-tree text-indigo-400" />
                        Transfer Structure Mode
                      </label>
                      <span className="text-[10px] text-indigo-400 font-medium">Choose how folder is placed</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Option 1: Transfer with Folder */}
                      <button
                        type="button"
                        onClick={() => setTransferMode('with_folder')}
                        className={`p-4 rounded-xl border text-left transition-all relative ${
                          transferMode === 'with_folder'
                            ? 'bg-indigo-500/20 border-indigo-500/60 shadow-lg shadow-indigo-500/15'
                            : 'bg-white/[0.02] border-white/10 hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <i className="fa-solid fa-folder-tree text-indigo-400 text-lg" />
                            <p className="text-sm font-bold text-white">Transfer with Folder</p>
                          </div>
                          {transferMode === 'with_folder' && (
                            <i className="fa-solid fa-circle-check text-indigo-400" />
                          )}
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          Creates the folder <span className="text-indigo-300 font-semibold font-mono">"{selectedSourceName}"</span> at destination. All files and subfolders will be placed inside it.
                        </p>
                        <div className="mt-2.5 pt-2 border-t border-white/5 text-[10px] text-slate-400 font-mono">
                          ➔ {finalDestPath}
                        </div>
                      </button>

                      {/* Option 2: Contents Only */}
                      <button
                        type="button"
                        onClick={() => setTransferMode('contents_only')}
                        className={`p-4 rounded-xl border text-left transition-all relative ${
                          transferMode === 'contents_only'
                            ? 'bg-purple-500/20 border-purple-500/60 shadow-lg shadow-purple-500/15'
                            : 'bg-white/[0.02] border-white/10 hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <i className="fa-solid fa-folder-open text-purple-400 text-lg" />
                            <p className="text-sm font-bold text-white">Folder Contents Only</p>
                          </div>
                          {transferMode === 'contents_only' && (
                            <i className="fa-solid fa-circle-check text-purple-400" />
                          )}
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          Transfers all files and subfolders directly inside destination without creating the top-level <span className="text-purple-300 font-semibold font-mono">"{selectedSourceName}"</span> folder.
                        </p>
                        <div className="mt-2.5 pt-2 border-t border-white/5 text-[10px] text-slate-400 font-mono">
                          ➔ {finalDestPath}
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Operation Type */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Server-to-Server Operation
                    </label>
                    <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      Real Cloud-to-Cloud Direct
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setOperation('copy')}
                      className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden ${
                        operation === 'copy'
                          ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border-indigo-500/50 text-white shadow-lg shadow-indigo-500/10'
                          : 'bg-white/[0.02] border-white/5 text-slate-400 hover:border-white/15'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${operation === 'copy' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-slate-400'}`}>
                            <i className="fa-solid fa-copy text-sm" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">Server-to-Server Copy</p>
                            <span className="text-[10px] text-indigo-400 font-medium">⚡ Direct Cloud Duplicate</span>
                          </div>
                        </div>
                        <i className={`fa-solid ${operation === 'copy' ? 'fa-circle-dot text-indigo-400' : 'fa-circle text-slate-600'} text-sm shrink-0`} />
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                        Safely duplicate files directly across Google Drive accounts on cloud servers with zero local download.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOperation('move')}
                      className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden ${
                        operation === 'move'
                          ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/10 border-amber-500/50 text-white shadow-lg shadow-amber-500/10'
                          : 'bg-white/[0.02] border-white/5 text-slate-400 hover:border-white/15'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${operation === 'move' ? 'bg-amber-500/20 text-amber-300' : 'bg-white/5 text-slate-400'}`}>
                            <i className="fa-solid fa-arrow-right-arrow-left text-sm" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">Server-to-Server Move</p>
                            <span className="text-[10px] text-amber-400 font-medium">⚡ Cloud Migration & Purge</span>
                          </div>
                        </div>
                        <i className={`fa-solid ${operation === 'move' ? 'fa-circle-dot text-amber-400' : 'fa-circle text-slate-600'} text-sm shrink-0`} />
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                        Transfers files directly between Google Drive clouds and automatically removes source files once verified.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Cloud Acceleration & Transfer Optimization */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                    Cloud Acceleration & Duplicate Handling
                  </label>
                  <div className="space-y-2.5">
                    {/* Real Server-to-Server Status */}
                    <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                        <i className="fa-solid fa-bolt text-sm" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-emerald-300">Google Cloud Direct Server-to-Server (Active)</p>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-mono font-medium border border-emerald-500/30">
                            0 MB Local Bandwidth
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                          Multi-threaded direct pipe between Google Drive cloud servers. Files never touch your local computer, saving data and maximizing speed.
                        </p>
                      </div>
                    </div>

                    {/* Skip Existing Files */}
                    <button
                      type="button"
                      onClick={() => toggleFlag('--ignore-existing')}
                      className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                        flags.includes('--ignore-existing')
                          ? 'bg-indigo-500/15 border-indigo-500/35 text-white'
                          : 'bg-white/[0.02] border-white/5 text-slate-400 hover:border-white/15'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        flags.includes('--ignore-existing') ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-slate-500'
                      }`}>
                        <i className="fa-solid fa-forward text-sm" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-white">Skip Existing Files (--ignore-existing)</p>
                          <i className={`fa-solid ${flags.includes('--ignore-existing') ? 'fa-square-check text-indigo-400' : 'fa-square text-slate-600'} text-base shrink-0`} />
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                          Skips any file that already exists at the destination folder with matching size, saving significant time and quota.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Final Review Summary Card */}
                <div className="p-4 rounded-xl bg-slate-900/90 border border-white/10 space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <i className="fa-solid fa-clipboard-check text-indigo-400" />
                      Transfer Execution Summary
                    </p>
                    <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                      ⚡ Server-to-Server Ready
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                      <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                        {sourceSection === 'shared-with-me' ? 'Source (Shared with me)' : 'Source Cloud'}
                      </span>
                      <span className="text-white font-semibold text-xs">{sourceAccount?.name}</span>
                      <span className={`${sourceSection === 'shared-with-me' ? 'text-sky-400' : 'text-indigo-400'} block font-mono text-[11px] truncate mt-0.5`}>
                        {sourceSection === 'shared-with-me' ? `shared:${selectedSourceName}` : (finalSourcePath || 'root')} ({selectedSourceType})
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                      <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Destination Cloud</span>
                      <span className="text-white font-semibold text-xs">{destAccount?.name}</span>
                      <span className="text-purple-400 block font-mono text-[11px] truncate mt-0.5">
                        {finalDestPath || 'root'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/5 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Operation</span>
                      <span className={`font-bold uppercase ${operation === 'copy' ? 'text-indigo-300' : 'text-amber-300'}`}>
                        Server-to-Server {operation}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Duplicate Handling</span>
                      <span className="text-slate-300 font-medium">
                        {flags.includes('--ignore-existing') ? '✓ Skip Existing' : 'Overwrite'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Local Data Consumed</span>
                      <span className="text-emerald-400 font-mono font-medium">0 MB (Direct Cloud)</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Navigation Bar */}
        <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-3 shrink-0">
          <div>
            {activeStep !== 'source' ? (
              <button
                type="button"
                onClick={() => setActiveStep(activeStep === 'options' ? 'dest' : 'source')}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <i className="fa-solid fa-arrow-left text-[11px]" />
                Back
              </button>
            ) : (
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {activeStep === 'source' && (
              <button
                type="button"
                onClick={() => setActiveStep('dest')}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2"
              >
                <span>Continue to Destination</span>
                <i className="fa-solid fa-arrow-right text-[11px]" />
              </button>
            )}

            {activeStep === 'dest' && (
              <button
                type="button"
                onClick={() => setActiveStep('options')}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2"
              >
                <span>Continue to Options</span>
                <i className="fa-solid fa-arrow-right text-[11px]" />
              </button>
            )}

            {activeStep === 'options' && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !sourceId || !destId}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin" />
                    <span>Initiating Transfer...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-bolt text-xs" />
                    <span>Start Server-to-Server {operation.toUpperCase()}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
