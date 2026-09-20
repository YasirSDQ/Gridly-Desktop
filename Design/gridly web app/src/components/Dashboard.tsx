import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { 
  browseFiles, 
  browseSharedFiles,
  transferSharedItemsToDrive,
  formatBytes, 
  getPublicLink,
  getDirectDownloadLinks,
  DirectDownloadLinks,
  getGoogleDriveFileId,
  deleteMultipleDriveItems,
  renameDriveItem,
  createDriveFolder,
  copyOrMoveDriveItems,
  getSubfolders,
  getClientFolderCache
} from '../services/rclone'
import type { DriveFile, DriveClipboard } from '../types'
import { disconnectAccount, syncAccountStorage } from '../services/auth'
import { storage } from '../services/storage'

export interface DashboardProps {
  initialSection?: 'my-drive' | 'shared-with-me'
}

export default function Dashboard({ initialSection }: DashboardProps = {}) {
  const { state, dispatch, addToast, setView } = useApp()
  
  // App state & active account
  const activeAccount = state.selectedAccountId 
    ? state.accounts.find(a => a.id === state.selectedAccountId) || state.accounts[0]
    : state.accounts[0];

  // Active Drive Section: 'my-drive' or 'shared-with-me'
  const [activeSection, setActiveSection] = useState<'my-drive' | 'shared-with-me'>(() => {
    return initialSection || (state.currentView === 'shared' ? 'shared-with-me' : 'my-drive')
  })

  const [files, setFiles] = useState<DriveFile[]>([])
  const [path, setPath] = useState<{ id: string; name: string }[]>(() => {
    const isShared = (initialSection || (state.currentView === 'shared' ? 'shared-with-me' : 'my-drive')) === 'shared-with-me'
    return isShared ? [{ id: 'shared-root', name: 'Shared with me' }] : [{ id: 'root', name: 'My Drive' }]
  })
  const [loading, setLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const prevAccountRef = useRef<string | undefined>(activeAccount?.id)
  
  // Selection state
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set())
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  
  // Modals & Panels - side panel is closed by default and only opens when user clicks "Show info" / details button
  const [accountToDelete, setAccountToDelete] = useState<{id: string, name: string} | null>(null)
  const [showDetailsPanel, setShowDetailsPanel] = useState(false)
  
  // Transfer to My Drive Modal (Direct cloud-to-cloud transfer from Shared With Me into My Drive)
  const [transferToDriveModal, setTransferToDriveModal] = useState<{
    isOpen: boolean;
    items: DriveFile[];
    destFolderId: string;
    destFolderName: string;
    loading: boolean;
    folders: DriveFile[];
    loadingFolders: boolean;
    isCreatingFolder: boolean;
    newFolderName: string;
    creatingFolderLoading: boolean;
    customSubfolder: string;
    folderSearch: string;
  }>({
    isOpen: false,
    items: [],
    destFolderId: 'root',
    destFolderName: 'My Drive (Root)',
    loading: false,
    folders: [],
    loadingFolders: false,
    isCreatingFolder: false,
    newFolderName: '',
    creatingFolderLoading: false,
    customSubfolder: '',
    folderSearch: '',
  })
  
  // Delete Modal
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    items: DriveFile[];
    loading: boolean;
  }>({ isOpen: false, items: [], loading: false })

  // Rename Modal
  const [renameModal, setRenameModal] = useState<{
    isOpen: boolean;
    item: DriveFile | null;
    newName: string;
    loading: boolean;
  }>({ isOpen: false, item: null, newName: '', loading: false })

  // New Folder Modal
  const [newFolderModal, setNewFolderModal] = useState<{
    isOpen: boolean;
    folderName: string;
    loading: boolean;
  }>({ isOpen: false, folderName: '', loading: false })

  // Copy / Move GUI Modal
  const [organizeModal, setOrganizeModal] = useState<{
    isOpen: boolean;
    operation: 'copy' | 'move';
    items: DriveFile[];
    targetAccountId: string;
    targetFolderId: string;
    targetFolderPath: { id: string; name: string }[];
    selectedDestFolderId: string;
    selectedDestFolderName: string;
    loading: boolean;
    subfolders: DriveFile[];
    loadingFolders: boolean;
    searchQuery: string;
    isCreatingFolder: boolean;
    newFolderName: string;
    creatingFolderLoading: boolean;
  }>({
    isOpen: false,
    operation: 'move',
    items: [],
    targetAccountId: '',
    targetFolderId: 'root',
    targetFolderPath: [{ id: 'root', name: 'My Drive' }],
    selectedDestFolderId: 'root',
    selectedDestFolderName: 'My Drive',
    loading: false,
    subfolders: [],
    loadingFolders: false,
    searchQuery: '',
    isCreatingFolder: false,
    newFolderName: '',
    creatingFolderLoading: false,
  })

  // Direct Download Link Modal (Google Drive usercontent link generator)
  const [directLinkModal, setDirectLinkModal] = useState<{
    isOpen: boolean;
    file: DriveFile | null;
    loading: boolean;
    links: DirectDownloadLinks | null;
    error?: string;
    copiedField?: string | null;
  }>({
    isOpen: false,
    file: null,
    loading: false,
    links: null,
    copiedField: null,
  })

  // Active opening / loading states to guarantee no duplicate navigation or clicks
  const [navigatingFolderId, setNavigatingFolderId] = useState<string | null>(null)
  const [openingFileId, setOpeningFileId] = useState<string | null>(null)

  // Media Player / File Preview Modal
  const [mediaPlayerModal, setMediaPlayerModal] = useState<{
    isOpen: boolean;
    file: DriveFile | null;
    streamUrl: string;
    loading: boolean;
  }>({
    isOpen: false,
    file: null,
    streamUrl: '',
    loading: false,
  })

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: DriveFile | null;
  } | null>(null)

  // Starred items (stored in localStorage for quick persistence)
  const [starredIds, setStarredIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('gridly_starred_files')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })

  // Clipboard state for Ctrl+C, Ctrl+X, Ctrl+V
  const [clipboard, setClipboard] = useState<DriveClipboard | null>(() => storage.getClipboard())
  const [isPasting, setIsPasting] = useState(false)

  // Synchronize clipboard across events / windows
  useEffect(() => {
    const syncClip = () => {
      setClipboard(storage.getClipboard())
    }
    window.addEventListener('focus', syncClip)
    window.addEventListener('storage', syncClip)
    return () => {
      window.removeEventListener('focus', syncClip)
      window.removeEventListener('storage', syncClip)
    }
  }, [])

  const fileContainerRef = useRef<HTMLDivElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const newFolderInputRef = useRef<HTMLInputElement>(null)

  const currentFolderId = path[path.length - 1].id;

  // Save starred files to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('gridly_starred_files', JSON.stringify(Array.from(starredIds)))
    } catch {
      // Ignore
    }
  }, [starredIds])

  // Synchronize section from props and global currentView
  useEffect(() => {
    if (initialSection && initialSection !== activeSection) {
      setActiveSection(initialSection)
      if (initialSection === 'shared-with-me') {
        setPath([{ id: 'shared-root', name: 'Shared with me' }])
        loadFiles('shared-root', false, 'shared-with-me')
      } else {
        setPath([{ id: 'root', name: activeAccount?.name || 'My Drive' }])
        loadFiles('root', false, 'my-drive')
      }
      setSelectedFileIds(new Set())
      setLastSelectedId(null)
    }
  }, [initialSection])

  useEffect(() => {
    if (state.currentView === 'shared' && activeSection !== 'shared-with-me') {
      setActiveSection('shared-with-me')
      setPath([{ id: 'shared-root', name: 'Shared with me' }])
      loadFiles('shared-root', false, 'shared-with-me')
      setSelectedFileIds(new Set())
      setLastSelectedId(null)
    } else if (state.currentView === 'dashboard' && activeSection !== 'my-drive') {
      setActiveSection('my-drive')
      setPath([{ id: 'root', name: activeAccount?.name || 'My Drive' }])
      loadFiles('root', false, 'my-drive')
      setSelectedFileIds(new Set())
      setLastSelectedId(null)
    }
  }, [state.currentView])

  // Consolidated navigation & account loading effect (prevents double-fetching & race conditions)
  useEffect(() => {
    if (!activeAccount) return

    if (prevAccountRef.current !== activeAccount.id) {
      prevAccountRef.current = activeAccount.id
      if (activeSection === 'shared-with-me') {
        setPath([{ id: 'shared-root', name: 'Shared with me' }])
        loadFiles('shared-root', false, 'shared-with-me')
      } else {
        setPath([{ id: 'root', name: activeAccount.name || 'My Drive' }])
        loadFiles('root', false, 'my-drive')
      }
      setSelectedFileIds(new Set())
      setLastSelectedId(null)
      return
    }

    loadFiles(currentFolderId)
    setSelectedFileIds(new Set())
    setLastSelectedId(null)
  }, [activeAccount?.id, currentFolderId, activeSection])

  // Close context menu on global click or scroll
  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null)
    window.addEventListener('click', handleGlobalClick)
    window.addEventListener('scroll', handleGlobalClick, true)
    return () => {
      window.removeEventListener('click', handleGlobalClick)
      window.removeEventListener('scroll', handleGlobalClick, true)
    }
  }, [])

  // Auto focus modal inputs
  useEffect(() => {
    if (renameModal.isOpen && renameInputRef.current) {
      setTimeout(() => {
        renameInputRef.current?.focus()
        renameInputRef.current?.select()
      }, 50)
    }
  }, [renameModal.isOpen])

  useEffect(() => {
    if (newFolderModal.isOpen && newFolderInputRef.current) {
      setTimeout(() => {
        newFolderInputRef.current?.focus()
        newFolderInputRef.current?.select()
      }, 50)
    }
  }, [newFolderModal.isOpen])

  const loadFiles = async (
    folderId: string, 
    forceRefresh: boolean = false, 
    sectionOverride?: 'my-drive' | 'shared-with-me'
  ) => {
    if (!activeAccount) return
    const currentSection = sectionOverride || activeSection

    if (currentSection === 'shared-with-me') {
      const isRoot = !folderId || folderId === 'shared-root' || folderId === 'root' || folderId === '/'
      const cacheKey = `${activeAccount.id}:shared:${isRoot ? 'root' : folderId}`
      const cached = getClientFolderCache(cacheKey)

      if (cached && !forceRefresh) {
        setFiles(cached.files)
        setLoading(false)
        setIsSyncing(true)
      } else {
        setLoading(true)
      }

      try {
        const currentFolderItem = path.find(p => p.id === folderId)
        const result = await browseSharedFiles(
          activeAccount,
          folderId,
          currentFolderItem?.name || (isRoot ? 'Shared with me' : 'Folder'),
          path,
          forceRefresh
        )
        setFiles(result.files)
        if (isRoot && (path.length !== 1 || path[0].id !== 'shared-root')) {
          setPath([{ id: 'shared-root', name: 'Shared with me' }])
        }
      } catch (err: any) {
        if (err.message && err.message.includes("didn't find section in config file")) {
          dispatch({ type: 'REMOVE_ACCOUNT', payload: activeAccount.id })
          addToast('warning', 'Account Removed', `Account ${activeAccount.name} was removed because it is no longer authenticated.`)
          dispatch({ type: 'SET_SELECTED_ACCOUNT', payload: null })
        } else {
          addToast('error', 'Failed to load shared files', err.message || 'Error loading shared files')
        }
      } finally {
        setLoading(false)
        setIsSyncing(false)
        setNavigatingFolderId(null)
      }
      return
    }

    const rclonePath = (folderId === 'root' || folderId === '/') ? '' : folderId
    const cacheKey = `${activeAccount.id}:${rclonePath}`
    const cached = getClientFolderCache(cacheKey)

    // Instant SWR Display: If folder data is already cached, show it in 0ms!
    if (cached && !forceRefresh) {
      setFiles(cached.files)
      setLoading(false)
      setIsSyncing(true)
    } else {
      setLoading(true)
    }

    try {
      const result = await browseFiles(activeAccount, folderId, forceRefresh)
      setFiles(result.files)
      if (folderId === 'root' && (path.length !== 1 || path[0].id !== 'root')) {
        setPath([{ id: 'root', name: 'My Drive' }])
      }
    } catch (err: any) {
      if (err.message && err.message.includes("didn't find section in config file")) {
         dispatch({ type: 'REMOVE_ACCOUNT', payload: activeAccount.id })
         addToast('warning', 'Account Removed', `Account ${activeAccount.name} was removed because it is no longer authenticated.`)
         dispatch({ type: 'SET_SELECTED_ACCOUNT', payload: null })
      } else {
         addToast('error', 'Failed to load files', err.message)
      }
    } finally {
      setLoading(false)
      setIsSyncing(false)
      setNavigatingFolderId(null)
    }
  }

  // Filtered files based on active search query
  const trimmedSearch = (state.searchQuery || '').trim().toLowerCase()
  const displayFiles = trimmedSearch
    ? files.filter(f => 
        f.name.toLowerCase().includes(trimmedSearch) ||
        (f.mimeType && f.mimeType.toLowerCase().includes(trimmedSearch)) ||
        (f.path && f.path.toLowerCase().includes(trimmedSearch))
      )
    : files

  // Selected files array
  const selectedFiles = files.filter(f => selectedFileIds.has(f.id || f.path))
  const isAllSelected = displayFiles.length > 0 && displayFiles.every(f => selectedFileIds.has(f.id || f.path))
  const isSomeSelected = displayFiles.some(f => selectedFileIds.has(f.id || f.path)) && !isAllSelected
  const primarySelectedFile = selectedFiles.length === 1 ? selectedFiles[0] : null

  // Selection handlers
  const handleSelectFile = (file: DriveFile, e: React.MouseEvent) => {
    const fileId = file.id || file.path

    if (e.shiftKey && lastSelectedId) {
      // Range selection
      const lastIndex = displayFiles.findIndex(f => (f.id || f.path) === lastSelectedId)
      const currentIndex = displayFiles.findIndex(f => (f.id || f.path) === fileId)
      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex)
        const end = Math.max(lastIndex, currentIndex)
        const newSet = new Set(selectedFileIds)
        for (let i = start; i <= end; i++) {
          newSet.add(displayFiles[i].id || displayFiles[i].path)
        }
        setSelectedFileIds(newSet)
        return
      }
    }

    if (e.ctrlKey || e.metaKey) {
      // Toggle single item in multi-selection
      const newSet = new Set(selectedFileIds)
      if (newSet.has(fileId)) {
        newSet.delete(fileId)
      } else {
        newSet.add(fileId)
      }
      setSelectedFileIds(newSet)
      setLastSelectedId(fileId)
      return
    }

    // Single click selects item
    setSelectedFileIds(new Set([fileId]))
    setLastSelectedId(fileId)
  }

  const handleToggleCheckbox = (file: DriveFile, e: React.MouseEvent) => {
    e.stopPropagation()
    const fileId = file.id || file.path

    if (e.shiftKey && lastSelectedId) {
      // Shift-click checkbox performs range selection
      const lastIndex = displayFiles.findIndex(f => (f.id || f.path) === lastSelectedId)
      const currentIndex = displayFiles.findIndex(f => (f.id || f.path) === fileId)
      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex)
        const end = Math.max(lastIndex, currentIndex)
        const newSet = new Set(selectedFileIds)
        for (let i = start; i <= end; i++) {
          newSet.add(displayFiles[i].id || displayFiles[i].path)
        }
        setSelectedFileIds(newSet)
        return
      }
    }

    const newSet = new Set(selectedFileIds)
    if (newSet.has(fileId)) {
      newSet.delete(fileId)
    } else {
      newSet.add(fileId)
    }
    setSelectedFileIds(newSet)
    setLastSelectedId(fileId)
  }

  const handleSelectAll = () => {
    if (isAllSelected) {
      const newSet = new Set(selectedFileIds)
      displayFiles.forEach(f => newSet.delete(f.id || f.path))
      setSelectedFileIds(newSet)
    } else {
      const newSet = new Set(selectedFileIds)
      displayFiles.forEach(f => newSet.add(f.id || f.path))
      setSelectedFileIds(newSet)
      if (displayFiles.length > 0) {
        setLastSelectedId(displayFiles[0].id || displayFiles[0].path)
      }
    }
  }

  const handleClearSelection = () => {
    setSelectedFileIds(new Set())
    setLastSelectedId(null)
  }

  // Helper to ensure path never has consecutive duplicate folder IDs
  const sanitizePath = (p: { id: string; name: string }[]) => {
    const cleaned: { id: string; name: string }[] = []
    for (const item of p) {
      if (cleaned.length === 0 || cleaned[cleaned.length - 1].id !== item.id) {
        cleaned.push(item)
      }
    }
    return cleaned
  }

  const handleNavigate = (folder: DriveFile) => {
    if (!folder.isFolder) return
    const folderIdentifier = activeSection === 'shared-with-me' ? (folder.id || folder.path) : folder.path
    
    // Prevent duplicate navigation if already in this folder or actively opening it
    if (navigatingFolderId === folderIdentifier) return
    if (path.length > 0 && path[path.length - 1].id === folderIdentifier) return

    setNavigatingFolderId(folderIdentifier)
    setPath(prev => {
      if (prev.length > 0 && prev[prev.length - 1].id === folderIdentifier) {
        return prev
      }
      return sanitizePath([...prev, { id: folderIdentifier, name: folder.name }])
    })
  }

  const navigateUp = (index: number) => {
    if (index < 0 || index >= path.length - 1) return
    const target = path[index]
    if (navigatingFolderId === target.id) return
    setNavigatingFolderId(target.id)
    setPath(prev => sanitizePath(prev.slice(0, index + 1)))
  }

  const isVideoOrAudio = (file?: DriveFile | null) => {
    if (!file) return false
    const name = (file.name || '').toLowerCase()
    const mime = (file.mimeType || '').toLowerCase()
    return (
      mime.startsWith('video/') ||
      mime.startsWith('audio/') ||
      /\.(mp4|mkv|webm|avi|mov|wmv|flv|m4v|3gp|mp3|wav|ogg|flac|aac|m4a|wma)$/i.test(name)
    )
  }

  const isImageFile = (file?: DriveFile | null) => {
    if (!file) return false
    const name = (file.name || '').toLowerCase()
    const mime = (file.mimeType || '').toLowerCase()
    return (
      mime.startsWith('image/') ||
      /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/i.test(name)
    )
  }

  const handleOpenFileOrMedia = async (file: DriveFile) => {
    const fileKey = file.id || file.path
    if (openingFileId === fileKey) return // Prevent multi-clicks

    setOpeningFileId(fileKey)

    if (!activeAccount) {
      addToast('error', 'No Active Account', 'Please select a Google Drive account first.')
      setOpeningFileId(null)
      return
    }

    if (isVideoOrAudio(file) || isImageFile(file)) {
      const streamUrl = `/api/stream/${activeAccount.rcloneRemote}/${file.path}`
      setMediaPlayerModal({
        isOpen: true,
        file,
        streamUrl,
        loading: true,
      })
      setTimeout(() => {
        setOpeningFileId(prev => (prev === fileKey ? null : prev))
      }, 800)
    } else {
      try {
        await handleDownload(file)
      } finally {
        setTimeout(() => {
          setOpeningFileId(prev => (prev === fileKey ? null : prev))
        }, 1200)
      }
    }
  }

  const handleSwitchSection = (section: 'my-drive' | 'shared-with-me') => {
    if (section === activeSection) return
    setActiveSection(section)
    setView(section === 'shared-with-me' ? 'shared' : 'dashboard')
    if (section === 'shared-with-me') {
      setPath([{ id: 'shared-root', name: 'Shared with me' }])
      loadFiles('shared-root', false, 'shared-with-me')
    } else {
      setPath([{ id: 'root', name: activeAccount?.name || 'My Drive' }])
      loadFiles('root', false, 'my-drive')
    }
    setSelectedFileIds(new Set())
    setLastSelectedId(null)
  }

  const openTransferToMyDriveModal = async (itemsToTransfer?: DriveFile[]) => {
    const targetItems = itemsToTransfer && itemsToTransfer.length > 0 ? itemsToTransfer : selectedFiles
    if (targetItems.length === 0) {
      addToast('info', 'No Files Selected', 'Please select at least one file or folder to transfer to your My Drive.')
      return
    }

    setTransferToDriveModal({
      isOpen: true,
      items: targetItems,
      destFolderId: 'root',
      destFolderName: 'My Drive (Root)',
      loading: false,
      folders: [],
      loadingFolders: true,
      isCreatingFolder: false,
      newFolderName: '',
      creatingFolderLoading: false,
      customSubfolder: '',
      folderSearch: '',
    })

    if (!activeAccount) return

    try {
      const subdirs = await getSubfolders(activeAccount, '')
      setTransferToDriveModal(prev => ({
        ...prev,
        folders: subdirs,
        loadingFolders: false
      }))
    } catch {
      setTransferToDriveModal(prev => ({
        ...prev,
        folders: [],
        loadingFolders: false
      }))
    }
  }

  const handleCreateFolderInTransferToDrive = async () => {
    const name = transferToDriveModal.newFolderName?.trim()
    if (!name) {
      addToast('warning', 'Folder Name Required', 'Please enter a name for the new folder.')
      return
    }
    if (!activeAccount) {
      addToast('error', 'No Active Account', 'Please select a Google Drive account first.')
      return
    }

    setTransferToDriveModal(prev => ({ ...prev, creatingFolderLoading: true }))
    try {
      const parentPath = transferToDriveModal.destFolderId === 'root' ? '' : transferToDriveModal.destFolderId
      const createdPath = await createDriveFolder(activeAccount, parentPath, name)
      addToast('success', 'Folder Created', `Created folder "${name}" in My Drive.`)

      // Refresh folders list
      const subdirs = await getSubfolders(activeAccount, '')
      setTransferToDriveModal(prev => ({
        ...prev,
        folders: subdirs,
        destFolderId: createdPath,
        destFolderName: name,
        isCreatingFolder: false,
        newFolderName: '',
        creatingFolderLoading: false,
      }))
    } catch (err: any) {
      addToast('error', 'Failed to Create Folder', err.message || 'Could not create folder in My Drive')
      setTransferToDriveModal(prev => ({ ...prev, creatingFolderLoading: false }))
    }
  }

  const handleTransferToMyDrive = async (
    itemsToTransfer: DriveFile[], 
    destFolder: string,
    customSubfolder?: string
  ) => {
    if (!activeAccount) {
      addToast('error', 'No Active Account', 'Please select a Google Drive account first.')
      return
    }

    setTransferToDriveModal(prev => ({ ...prev, loading: true }))

    try {
      const cleanBase = (destFolder === 'root' || !destFolder) ? '' : destFolder.replace(/^\/+|\/+$/g, '')
      const cleanSub = customSubfolder?.trim().replace(/^\/+|\/+$/g, '') || ''
      const finalDest = [cleanBase, cleanSub].filter(Boolean).join('/')

      const currentSharedFolderId = path.length > 0 ? path[path.length - 1].id : undefined

      const res = await transferSharedItemsToDrive(
        activeAccount,
        activeAccount,
        itemsToTransfer,
        finalDest,
        currentSharedFolderId
      )

      if (res.jobids && res.jobids.length > 0) {
        addToast(
          'success',
          'Transfer Started',
          `Transferring ${itemsToTransfer.length} shared item${itemsToTransfer.length > 1 ? 's' : ''} directly into your My Drive.`
        )
      } else {
        addToast(
          'success',
          'Transfer Complete',
          `Successfully copied ${itemsToTransfer.length} shared item${itemsToTransfer.length > 1 ? 's' : ''} into your My Drive.`
        )
      }

      setTransferToDriveModal(prev => ({ ...prev, isOpen: false, loading: false }))
      setSelectedFileIds(new Set())
      setLastSelectedId(null)
    } catch (err: any) {
      addToast('error', 'Transfer Failed', err.message || 'Could not transfer shared items to My Drive')
      setTransferToDriveModal(prev => ({ ...prev, loading: false }))
    }
  }

  // Right-click context menu handler with "Shift+Mouse Right key to select required files" support
  const handleContextMenu = (e: React.MouseEvent, item: DriveFile | null) => {
    e.preventDefault()
    e.stopPropagation()

    if (item) {
      const itemId = item.id || item.path

      // Shift + Right Mouse Button: multi-selection / range selection
      if (e.shiftKey) {
        if (lastSelectedId) {
          const lastIndex = displayFiles.findIndex(f => (f.id || f.path) === lastSelectedId)
          const currentIndex = displayFiles.findIndex(f => (f.id || f.path) === itemId)
          if (lastIndex !== -1 && currentIndex !== -1) {
            const start = Math.min(lastIndex, currentIndex)
            const end = Math.max(lastIndex, currentIndex)
            const newSet = new Set(selectedFileIds)
            for (let i = start; i <= end; i++) {
              newSet.add(displayFiles[i].id || displayFiles[i].path)
            }
            setSelectedFileIds(newSet)
            setLastSelectedId(itemId)
            setContextMenu(null)
            return
          }
        }

        // Toggle / add this item to selection
        const newSet = new Set(selectedFileIds)
        if (newSet.has(itemId)) {
          newSet.delete(itemId)
        } else {
          newSet.add(itemId)
        }
        setSelectedFileIds(newSet)
        setLastSelectedId(itemId)
        setContextMenu(null)
        return
      }

      // Normal Right Click (without Shift):
      // If right-clicked item is ALREADY part of selection, keep all selected files intact!
      if (!selectedFileIds.has(itemId)) {
        setSelectedFileIds(new Set([itemId]))
        setLastSelectedId(itemId)
      }
    }

    // Keep context menu within viewport
    const menuWidth = 230
    const menuHeight = item ? 440 : 220
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10)
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10)

    setContextMenu({ x, y, item })
  }

  // Organize Modal Subfolders loader
  const loadDestSubfolders = useCallback(async (accountId: string, folderId: string) => {
    const targetAcc = state.accounts.find(a => a.id === accountId) || activeAccount
    if (!targetAcc) return
    setOrganizeModal(prev => ({ ...prev, loadingFolders: true }))
    try {
      const folders = await getSubfolders(targetAcc, folderId)
      setOrganizeModal(prev => ({ ...prev, subfolders: folders, loadingFolders: false }))
    } catch {
      setOrganizeModal(prev => ({ ...prev, subfolders: [], loadingFolders: false }))
    }
  }, [state.accounts, activeAccount])

  // Open Move or Copy Modal
  const openOrganizeModal = (operation: 'copy' | 'move', targetItems?: DriveFile[]) => {
    const items = targetItems || selectedFiles
    if (items.length === 0) return
    const acc = activeAccount || state.accounts[0]
    if (!acc) return

    setOrganizeModal({
      isOpen: true,
      operation,
      items,
      targetAccountId: acc.id,
      targetFolderId: 'root',
      targetFolderPath: [{ id: 'root', name: acc.name || 'My Drive' }],
      selectedDestFolderId: 'root',
      selectedDestFolderName: acc.name || 'My Drive',
      loading: false,
      subfolders: [],
      loadingFolders: true,
      searchQuery: '',
      isCreatingFolder: false,
      newFolderName: '',
      creatingFolderLoading: false,
    })

    loadDestSubfolders(acc.id, 'root')
  }

  const handleSelectDestSubfolder = (folder: DriveFile) => {
    setOrganizeModal(prev => ({
      ...prev,
      selectedDestFolderId: folder.path,
      selectedDestFolderName: folder.name,
    }))
  }

  const handleEnterDestFolder = (folder: DriveFile) => {
    setOrganizeModal(prev => ({
      ...prev,
      targetFolderId: folder.path,
      targetFolderPath: [...prev.targetFolderPath, { id: folder.path, name: folder.name }],
      selectedDestFolderId: folder.path,
      selectedDestFolderName: folder.name,
      searchQuery: '',
      isCreatingFolder: false,
    }))
    loadDestSubfolders(organizeModal.targetAccountId, folder.path)
  }

  const handleNavigateDestBreadcrumb = (index: number) => {
    const newPath = organizeModal.targetFolderPath.slice(0, index + 1)
    const targetItem = newPath[newPath.length - 1]
    setOrganizeModal(prev => ({
      ...prev,
      targetFolderId: targetItem.id,
      targetFolderPath: newPath,
      selectedDestFolderId: targetItem.id,
      selectedDestFolderName: targetItem.name,
      searchQuery: '',
      isCreatingFolder: false,
    }))
    loadDestSubfolders(organizeModal.targetAccountId, targetItem.id)
  }

  const handleChangeTargetAccount = (newAccountId: string) => {
    const targetAcc = state.accounts.find(a => a.id === newAccountId)
    if (!targetAcc) return
    setOrganizeModal(prev => ({
      ...prev,
      targetAccountId: newAccountId,
      targetFolderId: 'root',
      targetFolderPath: [{ id: 'root', name: targetAcc.name || 'My Drive' }],
      selectedDestFolderId: 'root',
      selectedDestFolderName: targetAcc.name || 'My Drive',
      searchQuery: '',
      isCreatingFolder: false,
    }))
    loadDestSubfolders(newAccountId, 'root')
  }

  const handleCreateDestFolder = async () => {
    const name = organizeModal.newFolderName.trim()
    if (!name) return
    const targetAcc = state.accounts.find(a => a.id === organizeModal.targetAccountId) || activeAccount
    if (!targetAcc) return

    setOrganizeModal(prev => ({ ...prev, creatingFolderLoading: true }))
    try {
      const createdPath = await createDriveFolder(targetAcc, organizeModal.targetFolderId, name)
      addToast('success', 'Folder Created', `Created folder "${name}" in destination`)
      const folders = await getSubfolders(targetAcc, organizeModal.targetFolderId)
      setOrganizeModal(prev => ({
        ...prev,
        subfolders: folders,
        selectedDestFolderId: createdPath,
        selectedDestFolderName: name,
        isCreatingFolder: false,
        newFolderName: '',
        creatingFolderLoading: false,
      }))
    } catch (err: any) {
      addToast('error', 'Failed to Create Folder', err.message || 'Could not create folder')
      setOrganizeModal(prev => ({ ...prev, creatingFolderLoading: false }))
    }
  }

  const isDestInvalid = () => {
    if (organizeModal.operation !== 'move') return false
    if (organizeModal.targetAccountId !== activeAccount?.id) return false
    const destPath = organizeModal.selectedDestFolderId.replace(/^\/+|\/+$/g, '')
    if (!destPath || destPath === 'root') return false

    return organizeModal.items.some(item => {
      if (!item.isFolder) return false
      const itemPath = item.path.replace(/^\/+|\/+$/g, '')
      return destPath === itemPath || destPath.startsWith(itemPath + '/')
    })
  }

  const isAlreadyInDest = () => {
    if (organizeModal.targetAccountId !== activeAccount?.id) return false
    const destPath = organizeModal.selectedDestFolderId === 'root' ? 'root' : organizeModal.selectedDestFolderId.replace(/^\/+|\/+$/g, '')
    const curFolder = currentFolderId === 'root' ? 'root' : currentFolderId.replace(/^\/+|\/+$/g, '')
    return destPath === curFolder
  }

  const confirmCopyOrMove = async () => {
    if (!activeAccount || organizeModal.items.length === 0) return
    const targetAcc = state.accounts.find(a => a.id === organizeModal.targetAccountId) || activeAccount
    const destFolder = organizeModal.selectedDestFolderId

    setOrganizeModal(prev => ({ ...prev, loading: true }))
    try {
      const res = await copyOrMoveDriveItems(
        activeAccount,
        organizeModal.items,
        destFolder,
        organizeModal.operation,
        targetAcc
      )

      if (res.succeeded > 0) {
        const destLabel = organizeModal.selectedDestFolderName || (destFolder === 'root' ? 'My Drive' : destFolder)
        addToast(
          'success',
          organizeModal.operation === 'move' ? 'Items Moved' : 'Items Copied',
          `Successfully ${organizeModal.operation === 'move' ? 'moved' : 'copied'} ${res.succeeded} item(s) to "${destLabel}"`
        )
      }

      if (res.failed > 0) {
        addToast(
          'warning',
          'Partial Operation',
          `${res.failed} item(s) could not be ${organizeModal.operation}d: ${res.errors.join(', ')}`
        )
      }

      await loadFiles(currentFolderId)
      setSelectedFileIds(new Set())
      setLastSelectedId(null)

      syncAccountStorage(activeAccount.id, activeAccount.rcloneRemote).catch(() => {})
      if (targetAcc.id !== activeAccount.id) {
        syncAccountStorage(targetAcc.id, targetAcc.rcloneRemote).catch(() => {})
      }

      setOrganizeModal(prev => ({ ...prev, isOpen: false, loading: false }))
    } catch (err: any) {
      addToast('error', `${organizeModal.operation === 'move' ? 'Move' : 'Copy'} Failed`, err.message || 'Operation failed')
      setOrganizeModal(prev => ({ ...prev, loading: false }))
    }
  }

  // Transfer action
  const handleTransfer = (targetItems?: DriveFile[]) => {
    if (!activeAccount) return
    const items = targetItems || selectedFiles
    
    if (items.length === 0) {
      // Transfer current folder if nothing selected
      const isShared = activeSection === 'shared-with-me'
      const folderPath = currentFolderId === 'root' ? 'root' : currentFolderId
      dispatch({ 
        type: 'SET_TRANSFER_MODAL', 
        payload: { 
          sourceAccountId: activeAccount.id, 
          sourcePath: isShared ? `shared:${path[path.length - 1]?.name || 'root'}` : folderPath,
          sourceType: folderPath === 'root' ? 'root' : 'folder',
          isSharedWithMe: isShared,
          sourceFileId: isShared && currentFolderId !== 'shared-root' && currentFolderId !== 'root' ? currentFolderId : undefined,
          parentSharedFolderId: currentFolderId === 'shared-root' || currentFolderId === 'root' ? undefined : currentFolderId
        } 
      })
      return
    }

    const firstItem = items[0]
    const isItemShared = activeSection === 'shared-with-me' || Boolean(firstItem.sharedWithMe)
    const itemPath = firstItem.path || (currentFolderId === 'root' ? firstItem.name : `${currentFolderId}/${firstItem.name}`)
    
    dispatch({ 
      type: 'SET_TRANSFER_MODAL', 
      payload: { 
        sourceAccountId: activeAccount.id, 
        sourcePath: isItemShared ? `shared:${firstItem.name}` : itemPath,
        sourceType: firstItem.isFolder ? 'folder' : 'file',
        isSharedWithMe: isItemShared,
        sharedItem: firstItem,
        sourceFileId: firstItem.id,
        parentSharedFolderId: currentFolderId === 'shared-root' || currentFolderId === 'root' ? undefined : currentFolderId
      } 
    })

    if (items.length > 1) {
      addToast('info', 'Batch Transfer Notice', `Transfer modal prepared with "${firstItem.name}". (You can also transfer parent folder "${path[path.length - 1].name}" to move all items).`)
    }
  }

  // Delete action (opens modal)
  const openDeleteModal = (itemsToDelete?: DriveFile[]) => {
    const items = itemsToDelete || selectedFiles
    if (items.length === 0) return
    setDeleteModal({
      isOpen: true,
      items,
      loading: false
    })
  }

  const confirmDelete = async () => {
    if (!activeAccount || deleteModal.items.length === 0) return
    setDeleteModal(prev => ({ ...prev, loading: true }))
    
    try {
      const items = deleteModal.items.map(i => ({ path: i.path, isFolder: i.isFolder }))
      const res = await deleteMultipleDriveItems(activeAccount, items)
      
      if (res.failed === 0) {
        addToast('success', 'Items Deleted', `Successfully deleted ${res.succeeded} item(s)`)
      } else {
        addToast('warning', 'Partial Deletion', `Deleted ${res.succeeded} items, ${res.failed} failed: ${res.errors.join(', ')}`)
      }

      // Refresh storage and reload files
      syncAccountStorage(activeAccount.id, activeAccount.rcloneRemote).catch(() => {})
      setSelectedFileIds(new Set())
      setLastSelectedId(null)
      await loadFiles(currentFolderId)
      setDeleteModal({ isOpen: false, items: [], loading: false })
    } catch (err: any) {
      addToast('error', 'Delete Failed', err.message || 'Could not delete item(s)')
      setDeleteModal(prev => ({ ...prev, loading: false }))
    }
  }

  // Rename action (opens modal)
  const openRenameModal = (item?: DriveFile) => {
    const target = item || primarySelectedFile
    if (!target) return
    setRenameModal({
      isOpen: true,
      item: target,
      newName: target.name,
      loading: false
    })
  }

  const confirmRename = async () => {
    if (!activeAccount || !renameModal.item || !renameModal.newName.trim()) return
    const trimmed = renameModal.newName.trim()
    if (trimmed === renameModal.item.name) {
      setRenameModal({ isOpen: false, item: null, newName: '', loading: false })
      return
    }

    setRenameModal(prev => ({ ...prev, loading: true }))
    try {
      await renameDriveItem(activeAccount, renameModal.item.path, trimmed, renameModal.item.isFolder)
      addToast('success', 'Renamed', `Successfully renamed to "${trimmed}"`)
      await loadFiles(currentFolderId)
      setRenameModal({ isOpen: false, item: null, newName: '', loading: false })
      setSelectedFileIds(new Set())
    } catch (err: any) {
      addToast('error', 'Rename Failed', err.message || 'Could not rename item')
      setRenameModal(prev => ({ ...prev, loading: false }))
    }
  }

  // New Folder action
  const openNewFolderModal = () => {
    setNewFolderModal({
      isOpen: true,
      folderName: 'New Folder',
      loading: false
    })
  }

  const confirmCreateFolder = async () => {
    if (!activeAccount || !newFolderModal.folderName.trim()) return
    const name = newFolderModal.folderName.trim()
    setNewFolderModal(prev => ({ ...prev, loading: true }))
    try {
      await createDriveFolder(activeAccount, currentFolderId, name)
      addToast('success', 'Folder Created', `Created folder "${name}"`)
      await loadFiles(currentFolderId)
      setNewFolderModal({ isOpen: false, folderName: '', loading: false })
    } catch (err: any) {
      addToast('error', 'Create Folder Failed', err.message || 'Could not create folder')
      setNewFolderModal(prev => ({ ...prev, loading: false }))
    }
  }

  // Open Direct Download Link modal (Google Drive usercontent direct link viewer)
  const openDirectLinkModal = async (fileToInspect?: DriveFile) => {
    const target = fileToInspect || primarySelectedFile
    if (!target || !activeAccount) return

    setDirectLinkModal({
      isOpen: true,
      file: target,
      loading: true,
      links: null,
      error: undefined,
      copiedField: null,
    })

    try {
      const links = await getDirectDownloadLinks(activeAccount, target)
      setDirectLinkModal(prev => ({
        ...prev,
        loading: false,
        links,
      }))
    } catch (err: any) {
      setDirectLinkModal(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Could not resolve Google Drive file ID',
      }))
    }
  }

  // Quick Copy Direct Download Link to clipboard
  const handleCopyDirectLink = async (targetFile?: DriveFile, bypassWarning: boolean = false) => {
    const target = targetFile || primarySelectedFile
    if (!target || !activeAccount) return
    try {
      const links = await getDirectDownloadLinks(activeAccount, target)
      const url = bypassWarning ? links.directLinkBypass : links.directLink
      await navigator.clipboard.writeText(url)
      addToast(
        'success',
        'Direct Link Copied',
        `Google Drive direct download link copied to clipboard:\n${url}`
      )
    } catch (err: any) {
      addToast('error', 'Failed to Copy Link', err.message || 'Could not retrieve direct link')
    }
  }

  // Download action (uses direct drive.usercontent.google.com link)
  const handleDownload = async (fileToDownload?: DriveFile, bypassWarning: boolean = false) => {
    const target = fileToDownload || primarySelectedFile
    if (!target || !activeAccount) return
    try {
      addToast('info', 'Preparing Download', `Generating direct download link for "${target.name}"...`)
      const links = await getDirectDownloadLinks(activeAccount, target)
      const url = bypassWarning ? links.directLinkBypass : links.directLink
      if (url) {
        window.open(url, '_blank')
        addToast('success', 'Download Started', `Opened direct download link for "${target.name}"`)
        return
      }
    } catch {
      // Fallback to getPublicLink
    }

    try {
      const url = await getPublicLink(activeAccount, target.path, target.id)
      if (url) {
        window.open(url, '_blank')
        addToast('success', 'Download Opened', `Opening link for "${target.name}"`)
      } else {
        addToast('error', 'Download Failed', 'Could not generate a download link')
      }
    } catch (err: any) {
      addToast('error', 'Download Failed', err.message || 'Unknown error')
    }
  }

  // Copy to clipboard (Ctrl+C)
  const handleCopy = useCallback((itemsToCopy?: DriveFile[]) => {
    const targets = itemsToCopy && itemsToCopy.length > 0 ? itemsToCopy : selectedFiles
    if (!targets || targets.length === 0 || !activeAccount) return

    const clip: DriveClipboard = {
      operation: 'copy',
      sourceAccountId: activeAccount.id,
      sourceAccountName: activeAccount.name,
      items: targets.map(f => ({
        id: f.id,
        path: f.path,
        name: f.name,
        isFolder: f.isFolder,
        size: f.size
      })),
      copiedAt: Date.now()
    }

    setClipboard(clip)
    storage.setClipboard(clip)
    addToast('info', 'Copied to Clipboard', `Copied ${targets.length} item(s). Press Ctrl+V to paste in any folder or drive.`)
  }, [selectedFiles, activeAccount, addToast])

  // Cut to clipboard (Ctrl+X)
  const handleCut = useCallback((itemsToCut?: DriveFile[]) => {
    const targets = itemsToCut && itemsToCut.length > 0 ? itemsToCut : selectedFiles
    if (!targets || targets.length === 0 || !activeAccount) return

    const clip: DriveClipboard = {
      operation: 'move',
      sourceAccountId: activeAccount.id,
      sourceAccountName: activeAccount.name,
      items: targets.map(f => ({
        id: f.id,
        path: f.path,
        name: f.name,
        isFolder: f.isFolder,
        size: f.size
      })),
      copiedAt: Date.now()
    }

    setClipboard(clip)
    storage.setClipboard(clip)
    addToast('info', 'Cut to Clipboard', `Cut ${targets.length} item(s). Press Ctrl+V to paste/move into any folder or drive.`)
  }, [selectedFiles, activeAccount, addToast])

  // Paste from clipboard (Ctrl+V)
  const handlePaste = useCallback(async (targetFolderOverride?: string) => {
    const clip = clipboard || storage.getClipboard()
    if (!clip || !clip.items || clip.items.length === 0) {
      addToast('info', 'Clipboard Empty', 'No items in clipboard. Select items and press Ctrl+C to copy or Ctrl+X to cut.')
      return
    }

    if (!activeAccount) return
    const targetFolder = targetFolderOverride !== undefined ? targetFolderOverride : currentFolderId
    const cleanDst = (targetFolder === 'root' || !targetFolder || targetFolder === '/') ? '' : targetFolder.replace(/^\/+|\/+$/g, '')
    const sourceAcc = state.accounts.find(a => a.id === clip.sourceAccountId) || activeAccount

    // Prevent pasting into self or same parent folder when moving in same account
    if (clip.operation === 'move' && sourceAcc.id === activeAccount.id) {
      const isSameFolder = clip.items.every(item => {
        const itemClean = item.path.replace(/^\/+/, '')
        const itemParent = itemClean.split('/').slice(0, -1).join('/')
        return itemParent === cleanDst
      })

      if (isSameFolder) {
        addToast('info', 'Already in Destination', 'The item(s) are already in this folder.')
        return
      }

      const isRecursive = clip.items.some(item => {
        if (!item.isFolder) return false
        const itemClean = item.path.replace(/^\/+|\/+$/g, '')
        return cleanDst === itemClean || cleanDst.startsWith(itemClean + '/')
      })

      if (isRecursive) {
        addToast('error', 'Invalid Operation', 'Cannot move a folder into itself or any of its subfolders.')
        return
      }
    }

    setIsPasting(true)
    const summary = clip.items.length === 1 ? `"${clip.items[0].name}"` : `${clip.items.length} items`
    const destDisplay = cleanDst ? `/${cleanDst}` : 'My Drive'

    addToast(
      'info',
      `${clip.operation === 'move' ? 'Moving' : 'Copying'} ${summary}`,
      `Transfer started to ${activeAccount.name}:${destDisplay}. Tracking progress in Transfers.`
    )

    try {
      const res = await copyOrMoveDriveItems(
        sourceAcc,
        clip.items,
        targetFolder,
        clip.operation,
        activeAccount
      )

      // Immediately sync state transfers
      dispatch({ type: 'SET_TRANSFERS', payload: storage.getTransfers() })

      if (res.succeeded > 0) {
        addToast(
          'success',
          `${clip.operation === 'move' ? 'Moved' : 'Copied'} Successfully`,
          `Transferred ${res.succeeded} item(s) to ${destDisplay}. Check Transfers for progress/logs.`
        )

        if (clip.operation === 'move') {
          setClipboard(null)
          storage.setClipboard(null)
        }

        await loadFiles(currentFolderId)
        setSelectedFileIds(new Set())
        setLastSelectedId(null)

        syncAccountStorage(activeAccount.id, activeAccount.rcloneRemote).catch(() => {})
        if (sourceAcc.id !== activeAccount.id) {
          syncAccountStorage(sourceAcc.id, sourceAcc.rcloneRemote).catch(() => {})
        }
      }

      if (res.failed > 0) {
        addToast('error', 'Transfer Issues', `${res.failed} item(s) failed: ${res.errors.join(', ')}`)
      }
    } catch (err: any) {
      addToast('error', 'Paste Operation Failed', err.message || 'Unknown error occurred')
    } finally {
      setIsPasting(false)
    }
  }, [clipboard, activeAccount, currentFolderId, state.accounts, addToast, loadFiles, dispatch])

  // Star toggle
  const toggleStar = (file: DriveFile) => {
    const id = file.id || file.path
    setStarredIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        addToast('info', 'Unstarred', `Removed "${file.name}" from Starred`)
      } else {
        next.add(id)
        addToast('success', 'Starred', `Added "${file.name}" to Starred`)
      }
      return next
    })
  }

  // Copy Path/Name to clipboard
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    addToast('success', 'Copied', `${label} copied to clipboard`)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selectedFiles.length > 0) {
          e.preventDefault()
          handleCopy(selectedFiles)
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        if (selectedFiles.length > 0) {
          e.preventDefault()
          handleCut(selectedFiles)
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        handlePaste()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        const newSet = new Set(selectedFileIds)
        displayFiles.forEach(f => newSet.add(f.id || f.path))
        setSelectedFileIds(newSet)
        if (displayFiles.length > 0) {
          setLastSelectedId(displayFiles[0].id || displayFiles[0].path)
        }
      } else if (e.key === 'Escape') {
        if (contextMenu) {
          setContextMenu(null)
        } else if (selectedFileIds.size > 0) {
          handleClearSelection()
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedFiles.length > 0) {
          e.preventDefault()
          openDeleteModal()
        }
      } else if (e.key === 'F2') {
        if (primarySelectedFile) {
          e.preventDefault()
          openRenameModal(primarySelectedFile)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [displayFiles, selectedFileIds, selectedFiles, primarySelectedFile, contextMenu, handleCopy, handleCut, handlePaste])

  const confirmDisconnect = async () => {
    if (!accountToDelete) return;
    try {
      await disconnectAccount(accountToDelete.id)
      dispatch({ type: 'REMOVE_ACCOUNT', payload: accountToDelete.id })
      addToast('info', 'Account Disconnected', `${accountToDelete.name} has been removed`)
      dispatch({ type: 'SET_SELECTED_ACCOUNT', payload: null })
    } catch (err: any) {
      addToast('error', 'Disconnect Failed', err.message)
    } finally {
      setAccountToDelete(null)
    }
  }

  if (state.accounts.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
        <i className="fa-brands fa-google-drive text-6xl mb-4 opacity-50" />
        <h2 className="text-xl font-medium text-white mb-2">No Accounts Connected</h2>
        <p className="mb-6">Connect a Google Drive account to start browsing your files.</p>
        <button 
          onClick={() => dispatch({ type: 'SET_AUTH_MODAL', payload: true })}
          className="px-6 py-3 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition-colors"
        >
          Connect Account
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full select-none" onContextMenu={(e) => handleContextMenu(e, null)}>
      {/* Main File Browser */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tier 1: Sleek Slim Top Bar */}
        <div className="h-14 px-6 flex items-center justify-between gap-4 border-b border-white/5 bg-[#0e1017]/85 backdrop-blur-md shrink-0">
          {/* Left: Modern Segmented Section Switcher & Status */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-1 p-0.5 bg-white/5 border border-white/10 rounded-xl shrink-0">
              <button
                onClick={() => handleSwitchSection('my-drive')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeSection === 'my-drive'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
                title="View My Drive files"
              >
                <i className="fa-brands fa-google-drive text-xs" />
                <span>My Drive</span>
              </button>
              <button
                onClick={() => handleSwitchSection('shared-with-me')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeSection === 'shared-with-me'
                    ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
                title="View files and folders shared with me"
              >
                <i className="fa-solid fa-user-group text-xs" />
                <span>Shared with me</span>
              </button>
            </div>

            <div className="h-4 w-px bg-white/10 hidden sm:block shrink-0" />

            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 truncate">
              {activeSection === 'shared-with-me' ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                  <span className="truncate">Files shared by other accounts</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  <span className="truncate font-medium text-slate-300">{activeAccount?.name || 'My Drive'}</span>
                </>
              )}
            </div>
          </div>

          {/* Right: Quick Action Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Select All Toggle Button */}
            <button
              onClick={handleSelectAll}
              disabled={displayFiles.length === 0}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40 ${
                isAllSelected 
                  ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' 
                  : isSomeSelected 
                  ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' 
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
              title="Select / Deselect all files (Ctrl+A)"
            >
              <i className={`fa-solid ${
                isAllSelected ? 'fa-square-check text-indigo-400' : isSomeSelected ? 'fa-square-minus text-indigo-400' : 'fa-square'
              } text-xs`} />
              <span className="hidden sm:inline">{isAllSelected ? 'Deselect all' : 'Select all'}</span>
            </button>

            {/* New Folder Button (only in My Drive) */}
            {activeSection === 'my-drive' && (
              <button
                onClick={openNewFolderModal}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-medium flex items-center gap-1.5 transition-colors"
                title="Create new folder"
              >
                <i className="fa-solid fa-folder-plus text-indigo-400" />
                <span className="hidden sm:inline">New folder</span>
              </button>
            )}

            {/* Refresh Button */}
            <button 
              onClick={() => loadFiles(currentFolderId, true)}
              className="px-2.5 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
              title="Refresh from Google Drive"
            >
              <i className={`fa-solid fa-rotate-right text-xs ${(loading || isSyncing) ? 'fa-spin text-indigo-400' : ''}`} />
              {isSyncing && <span className="text-[11px] text-indigo-400 animate-pulse hidden sm:inline">Syncing...</span>}
            </button>

            <div className="w-px h-5 bg-white/10 mx-0.5" />

            {/* Details Panel Toggle */}
            <button
              onClick={() => setShowDetailsPanel(prev => !prev)}
              className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-colors ${
                showDetailsPanel 
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' 
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
              title={showDetailsPanel ? "Hide details panel" : "Show details / info"}
            >
              <i className="fa-solid fa-circle-info text-xs" />
            </button>

            {/* Grid / List View Toggle */}
            <div className="flex items-center bg-white/5 rounded-xl border border-white/10 p-0.5">
              <button 
                onClick={() => setViewMode('list')}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                  viewMode === 'list' ? 'text-indigo-400 bg-indigo-500/20' : 'text-slate-400 hover:text-white'
                }`}
                title="List view"
              >
                <i className="fa-solid fa-list text-xs" />
              </button>
              <button 
                onClick={() => setViewMode('grid')}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                  viewMode === 'grid' ? 'text-indigo-400 bg-indigo-500/20' : 'text-slate-400 hover:text-white'
                }`}
                title="Grid view"
              >
                <i className="fa-solid fa-grip text-xs" />
              </button>
            </div>
          </div>
        </div>

        {/* Tier 2: Dedicated Path Section Under Topbar */}
        <div className="h-11 px-6 border-b border-white/5 bg-[#090b10] flex items-center justify-between shrink-0 text-xs">
          {selectedFiles.length === 0 ? (
            /* Standard Path / Breadcrumb View */
            <>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                {/* Up One Level Button if inside nested folder */}
                {path.length > 1 && (
                  <button
                    onClick={() => navigateUp(path.length - 2)}
                    className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors shrink-0"
                    title="Go up one folder"
                  >
                    <i className="fa-solid fa-arrow-up text-xs" />
                  </button>
                )}

                {/* Breadcrumbs trail */}
                <div className="flex items-center gap-1 whitespace-nowrap text-slate-400">
                  {path.map((p, i) => (
                    <div key={`${p.id}-${i}`} className="flex items-center whitespace-nowrap">
                      {i > 0 && <i className="fa-solid fa-chevron-right text-[9px] text-slate-600 mx-1.5" />}
                      <button
                        onClick={() => navigateUp(i)}
                        disabled={i === path.length - 1}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                          i === path.length - 1
                            ? 'text-white font-semibold bg-white/5 cursor-default'
                            : 'hover:text-slate-200 hover:bg-white/5'
                        }`}
                      >
                        {i === 0 && (
                          activeSection === 'shared-with-me' ? (
                            <i className="fa-solid fa-user-group text-sky-400 text-xs" />
                          ) : (
                            <i className="fa-brands fa-google-drive text-indigo-400 text-xs" />
                          )
                        )}
                        <span>{p.name}</span>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Loading indicator when navigating/opening folder */}
                {(loading || navigatingFolderId) && (
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 text-[11px] font-medium animate-pulse border border-indigo-500/30 shrink-0">
                    <i className="fa-solid fa-circle-notch fa-spin text-[10px] text-indigo-400" />
                    <span>Opening folder...</span>
                  </div>
                )}

                <div className="w-1 h-1 rounded-full bg-slate-600 mx-1 shrink-0" />

                <span className="text-[11px] text-slate-500 whitespace-nowrap">
                  {displayFiles.length} item{displayFiles.length === 1 ? '' : 's'}
                </span>
              </div>

              {/* Right side of path bar */}
              <div className="flex items-center gap-2 text-slate-500 text-[11px] shrink-0">
                <span className="hidden md:inline">
                  {activeSection === 'shared-with-me' ? 'External Drive' : 'Cloud Drive'}
                </span>
              </div>
            </>
          ) : (
            /* Contextual Selection Action Bar */
            <>
              <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
                <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 font-semibold text-xs border border-indigo-500/30 flex items-center gap-1.5 shrink-0">
                  <i className="fa-solid fa-check-double text-[11px]" />
                  {selectedFiles.length} selected
                </span>

                <span className="text-slate-400 text-xs truncate hidden sm:inline">
                  in <span className="text-white font-medium">{path[path.length - 1]?.name || 'Root'}</span>
                </span>
              </div>

              {/* Selection Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {activeSection === 'shared-with-me' ? (
                  <>
                    <button
                      onClick={() => openTransferToMyDriveModal()}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                      title="Transfer selected shared items into personal My Drive"
                    >
                      <i className="fa-brands fa-google-drive text-[11px]" />
                      <span>Transfer to My Drive</span>
                    </button>

                    <button
                      onClick={() => handleTransfer()}
                      className="px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors"
                      title="Transfer selected items to another Google Drive account"
                    >
                      <i className="fa-solid fa-right-left text-[11px]" />
                      <span>Transfer to Other...</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleTransfer()}
                    className="px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors"
                    title="Transfer selected items to another Google Drive account"
                  >
                    <i className="fa-solid fa-right-left text-[11px]" />
                    <span>Transfer</span>
                  </button>
                )}

                <button
                  onClick={() => openDeleteModal()}
                  className="px-2.5 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  title="Delete selected (Del)"
                >
                  <i className="fa-regular fa-trash-can text-[11px]" />
                  <span>Delete</span>
                </button>

                <button
                  onClick={() => setShowDetailsPanel(!showDetailsPanel)}
                  className={`px-2 py-1 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    showDetailsPanel 
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' 
                      : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                  }`}
                  title={showDetailsPanel ? "Hide details panel" : "Show details / info panel"}
                >
                  <i className="fa-solid fa-circle-info text-[11px]" />
                  <span className="hidden sm:inline">{showDetailsPanel ? 'Hide' : 'Details'}</span>
                </button>

                <button
                  onClick={handleClearSelection}
                  className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white text-xs transition-colors"
                  title="Clear selection (Esc)"
                >
                  <i className="fa-solid fa-xmark text-sm" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Active Search Filter Banner */}
        {state.searchQuery && (
          <div className="px-6 py-2 bg-indigo-500/10 border-b border-indigo-500/20 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-xs">
              <i className="fa-solid fa-magnifying-glass text-indigo-400" />
              <span className="text-slate-300">
                Search results for <span className="text-white font-semibold">"{state.searchQuery}"</span>:
              </span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono text-[11px] font-semibold border border-indigo-500/30">
                {displayFiles.length} item{displayFiles.length === 1 ? '' : 's'}
              </span>
            </div>
            <button
              onClick={() => dispatch({ type: 'SET_SEARCH_QUERY', payload: '' })}
              className="text-xs text-indigo-400 hover:text-white flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-indigo-500/20 transition-colors font-medium"
              title="Clear search filter (Esc)"
            >
              <i className="fa-solid fa-xmark text-xs" />
              <span>Clear Filter</span>
            </button>
          </div>
        )}

        {/* File Grid/List Canvas */}
        <div 
          ref={fileContainerRef}
          className="flex-1 overflow-y-auto px-6 py-6 relative outline-none"
          onClick={(e) => { 
            if (e.target === e.currentTarget) {
              handleClearSelection()
            }
          }}
          onContextMenu={(e) => {
            if (e.target === e.currentTarget) {
              handleContextMenu(e, null)
            }
          }}
        >
          {loading && files.length === 0 ? (
            <div className="w-full">
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 content-start">
                  {[...Array(12)].map((_, i) => (
                    <div key={i} className="h-40 rounded-2xl bg-white/[0.03] border border-white/[0.05] p-4 flex flex-col justify-between animate-pulse">
                      <div className="flex items-center justify-between">
                        <div className="w-9 h-9 rounded-xl bg-white/5" />
                        <div className="w-4 h-4 rounded-full bg-white/5" />
                      </div>
                      <div className="space-y-2">
                        <div className="h-3.5 bg-white/10 rounded w-3/4" />
                        <div className="h-2.5 bg-white/5 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="h-12 rounded-xl bg-white/[0.03] border border-white/[0.05] px-4 flex items-center justify-between animate-pulse">
                      <div className="flex items-center gap-3 w-1/3">
                        <div className="w-6 h-6 rounded-lg bg-white/5" />
                        <div className="h-3.5 bg-white/10 rounded w-40" />
                      </div>
                      <div className="h-3 bg-white/5 rounded w-20" />
                      <div className="h-3 bg-white/5 rounded w-24" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <motion.div 
              layout
              className={
                viewMode === 'grid' 
                  ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 content-start' 
                  : 'flex flex-col gap-1.5'
              }
            >
              <AnimatePresence>
                {displayFiles.map(file => {
                  const id = file.id || file.path
                  const isSelected = selectedFileIds.has(id)
                  const isStarred = starredIds.has(id)
                  const isCut = clipboard?.operation === 'move' && 
                    clipboard.sourceAccountId === activeAccount?.id && 
                    clipboard.items.some(it => (it.id && it.id === file.id) || it.path === file.path)

                  const isFolderOpening = file.isFolder && (navigatingFolderId === id || navigatingFolderId === file.path)
                  const isFileOpening = !file.isFolder && (openingFileId === id || openingFileId === file.path)
                  const isMedia = !file.isFolder && isVideoOrAudio(file)

                  if (viewMode === 'grid') {
                    return (
                      <motion.div
                        key={id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        whileHover={{ scale: 1.02 }}
                        onClick={(e) => {
                          if (isFolderOpening || isFileOpening) return
                          handleSelectFile(file, e)
                        }}
                        onMouseDown={(e) => {
                          if (e.button === 2 && e.shiftKey) {
                            handleContextMenu(e, file)
                          }
                        }}
                        onDoubleClick={() => {
                          if (isFolderOpening || isFileOpening) return
                          if (file.isFolder) {
                            handleNavigate(file)
                          } else {
                            handleOpenFileOrMedia(file)
                          }
                        }}
                        onContextMenu={(e) => handleContextMenu(e, file)}
                        className={`
                          group relative rounded-2xl p-4 flex flex-col items-center justify-between text-center h-44 border transition-all duration-200 select-none
                          ${isFolderOpening || isFileOpening ? 'cursor-wait bg-indigo-500/15 border-indigo-500/70 ring-1 ring-indigo-500/50' : 'cursor-pointer'}
                          ${isCut ? 'opacity-40 border-dashed border-amber-500/50' : ''}
                          ${isSelected 
                            ? 'bg-indigo-500/15 border-indigo-500/60 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/50' 
                            : !isFolderOpening && !isFileOpening ? 'bg-white/[0.04] border-white/5 hover:bg-white/[0.08] hover:border-white/10' : ''
                          }
                        `}
                      >
                        {/* Top Bar inside Card: Selection Checkbox & Star */}
                        <div className="w-full flex items-center justify-between mb-1 z-10">
                          {/* Selection Checkbox (always visible if selected, shows on hover if not) */}
                          <div
                            onClick={(e) => handleToggleCheckbox(file, e)}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                              isSelected 
                                ? 'bg-indigo-500 text-white shadow-sm' 
                                : 'border border-white/20 text-transparent group-hover:text-white/40 hover:!text-white hover:border-indigo-400 bg-black/20'
                            }`}
                            title="Select file"
                          >
                            <i className="fa-solid fa-check text-[11px]" />
                          </div>

                          {/* Star icon */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleStar(file)
                            }}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-opacity ${
                              isStarred ? 'text-amber-400 opacity-100' : 'text-slate-500 opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-amber-400'
                            }`}
                            title={isStarred ? 'Unstar' : 'Star'}
                          >
                            <i className={`fa-${isStarred ? 'solid' : 'regular'} fa-star text-xs`} />
                          </button>
                        </div>

                        {/* File Icon */}
                        <div className="flex-1 flex items-center justify-center w-full relative">
                          {isFolderOpening ? (
                            <div className="flex flex-col items-center justify-center gap-2">
                              <i className="fa-solid fa-circle-notch fa-spin text-4xl text-indigo-400 drop-shadow-md" />
                              <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider animate-pulse">
                                Opening folder...
                              </span>
                            </div>
                          ) : isFileOpening ? (
                            <div className="flex flex-col items-center justify-center gap-2">
                              <i className="fa-solid fa-circle-notch fa-spin text-4xl text-emerald-400 drop-shadow-md" />
                              <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider animate-pulse">
                                {isMedia ? 'Playing media...' : 'Opening file...'}
                              </span>
                            </div>
                          ) : (
                            <i className={`
                              fa-solid ${file.isFolder ? 'fa-folder text-indigo-400' : file.icon || 'fa-file-lines text-slate-400'} 
                              text-5xl drop-shadow-md group-hover:scale-110 transition-transform duration-300
                            `} />
                          )}
                        </div>

                        {/* File Name & Size */}
                        <div className="w-full mt-2">
                          <p className="font-medium text-xs text-slate-200 truncate w-full group-hover:text-white" title={file.name}>
                            {file.name}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                            {isFolderOpening ? (
                              <span className="text-indigo-400 font-medium">Opening...</span>
                            ) : isFileOpening ? (
                              <span className="text-emerald-400 font-medium">{isMedia ? 'Buffering player...' : 'Opening...'}</span>
                            ) : (
                              file.isFolder ? 'Folder' : formatBytes(file.size)
                            )}
                          </p>
                        </div>
                      </motion.div>
                    )
                  }

                  // List View Mode
                  return (
                    <motion.div
                      key={id}
                      layout
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      onClick={(e) => {
                        if (isFolderOpening || isFileOpening) return
                        handleSelectFile(file, e)
                      }}
                      onMouseDown={(e) => {
                        if (e.button === 2 && e.shiftKey) {
                          handleContextMenu(e, file)
                        }
                      }}
                      onDoubleClick={() => {
                        if (isFolderOpening || isFileOpening) return
                        if (file.isFolder) {
                          handleNavigate(file)
                        } else {
                          handleOpenFileOrMedia(file)
                        }
                      }}
                      onContextMenu={(e) => handleContextMenu(e, file)}
                      className={`
                        group flex items-center gap-3.5 px-4 py-2.5 rounded-xl border transition-all duration-150 select-none
                        ${isFolderOpening || isFileOpening ? 'cursor-wait bg-indigo-500/15 border-indigo-500/50' : 'cursor-pointer'}
                        ${isCut ? 'opacity-40 border-dashed border-amber-500/50' : ''}
                        ${isSelected 
                          ? 'bg-indigo-500/15 border-indigo-500/50 shadow-sm shadow-indigo-500/10' 
                          : !isFolderOpening && !isFileOpening ? 'bg-white/[0.02] border-white/5 hover:bg-white/[0.06] hover:border-white/10' : ''
                        }
                      `}
                    >
                      {/* Checkbox */}
                      <div
                        onClick={(e) => handleToggleCheckbox(file, e)}
                        className={`w-5 h-5 rounded-md shrink-0 flex items-center justify-center transition-colors ${
                          isSelected 
                            ? 'bg-indigo-500 text-white shadow-sm' 
                            : 'border border-white/20 text-transparent group-hover:text-white/40 hover:!text-white hover:border-indigo-400 bg-black/20'
                        }`}
                      >
                        <i className="fa-solid fa-check text-[10px]" />
                      </div>

                      {/* Icon */}
                      {isFolderOpening ? (
                        <div className="w-5 flex items-center justify-center shrink-0">
                          <i className="fa-solid fa-circle-notch fa-spin text-sm text-indigo-400" />
                        </div>
                      ) : isFileOpening ? (
                        <div className="w-5 flex items-center justify-center shrink-0">
                          <i className="fa-solid fa-circle-notch fa-spin text-sm text-emerald-400" />
                        </div>
                      ) : (
                        <i className={`fa-solid ${file.isFolder ? 'fa-folder text-indigo-400' : file.icon || 'fa-file-lines text-slate-400'} text-lg w-5 text-center shrink-0`} />
                      )}

                      {/* Name */}
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-200 truncate group-hover:text-white">{file.name}</span>
                        {isFolderOpening && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold uppercase tracking-wider animate-pulse shrink-0 flex items-center gap-1">
                            <i className="fa-solid fa-circle-notch fa-spin text-[8px]" />
                            <span>Opening...</span>
                          </span>
                        )}
                        {isFileOpening && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold uppercase tracking-wider animate-pulse shrink-0 flex items-center gap-1">
                            <i className="fa-solid fa-circle-notch fa-spin text-[8px]" />
                            <span>{isMedia ? 'Playing...' : 'Opening...'}</span>
                          </span>
                        )}
                        {isStarred && <i className="fa-solid fa-star text-amber-400 text-xs shrink-0" />}
                      </div>

                      {/* Modified Date */}
                      <span className="text-xs text-slate-500 w-36 shrink-0 hidden md:block">
                        {new Date(file.modifiedTime).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>

                      {/* Size */}
                      <span className="text-xs text-slate-400 w-24 text-right shrink-0">
                        {file.isFolder ? '—' : formatBytes(file.size)}
                      </span>

                      {/* Action trigger button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleContextMenu(e, file)
                        }}
                        className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        title="More options"
                      >
                        <i className="fa-solid fa-ellipsis-vertical text-xs" />
                      </button>
                    </motion.div>
                  )
                })}
              </AnimatePresence>

              {/* Empty Folder State */}
              {files.length === 0 && (
                <div 
                  className="col-span-full py-24 flex flex-col items-center justify-center text-slate-500"
                  onContextMenu={(e) => handleContextMenu(e, null)}
                >
                  <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center mb-4 text-slate-600">
                    {activeSection === 'shared-with-me' ? (
                      <i className="fa-solid fa-user-group text-3xl opacity-50 text-sky-400" />
                    ) : (
                      <i className="fa-regular fa-folder-open text-3xl opacity-50" />
                    )}
                  </div>
                  {activeSection === 'shared-with-me' ? (
                    <>
                      <p className="text-base font-semibold text-slate-300 mb-1">No shared files or folders found</p>
                      <p className="text-xs text-slate-500 mb-4 max-w-sm text-center">
                        Files and folders shared with your Google Drive account will appear here.
                      </p>
                      <button
                        onClick={() => loadFiles('shared-root', true)}
                        className="px-4 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-xs font-semibold flex items-center gap-2 transition-colors"
                      >
                        <i className="fa-solid fa-arrows-rotate" />
                        <span>Refresh Shared Items</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-base font-semibold text-slate-300 mb-1">This folder is empty</p>
                      <p className="text-xs text-slate-500 mb-4">Right-click or use the button above to create folders or transfer items.</p>
                      <button
                        onClick={openNewFolderModal}
                        className="px-4 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-2 transition-colors"
                      >
                        <i className="fa-solid fa-plus" />
                        <span>Create Folder</span>
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* No Search Results State */}
              {files.length > 0 && displayFiles.length === 0 && (
                <div className="col-span-full py-24 flex flex-col items-center justify-center text-slate-500">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-3 text-indigo-400">
                    <i className="fa-solid fa-magnifying-glass text-2xl" />
                  </div>
                  <p className="text-base font-semibold text-white mb-1">No files match "{state.searchQuery}"</p>
                  <p className="text-xs text-slate-400 mb-4">Check for typos or clear your search to see all {files.length} items in this folder.</p>
                  <button
                    onClick={() => dispatch({ type: 'SET_SEARCH_QUERY', payload: '' })}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 transition-colors"
                  >
                    <i className="fa-solid fa-rotate-left" />
                    <span>Clear Search Filter</span>
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Right Details Drawer */}
      <AnimatePresence>
        {showDetailsPanel && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-l border-white/5 bg-[#0d0f14]/80 backdrop-blur-xl flex flex-col overflow-hidden shrink-0 z-10"
          >
            <div className="w-80 h-full flex flex-col">
              {/* Drawer Header */}
              <div className="h-16 flex items-center justify-between px-5 border-b border-white/5 shrink-0">
                <div className="flex items-center gap-2 overflow-hidden">
                  <i className={`fa-solid ${
                    selectedFiles.length > 1 
                      ? 'fa-layer-group text-purple-400' 
                      : selectedFiles.length === 1 && primarySelectedFile
                      ? (primarySelectedFile.isFolder ? 'fa-folder text-indigo-400' : 'fa-file-lines text-slate-400')
                      : 'fa-folder-open text-sky-400'
                  }`} />
                  <h2 className="font-bold truncate text-sm text-white">
                    {selectedFiles.length > 1 
                      ? `${selectedFiles.length} items selected` 
                      : selectedFiles.length === 1 && primarySelectedFile
                      ? primarySelectedFile.name
                      : path[path.length - 1]?.name || 'Folder Info'}
                  </h2>
                </div>
                <button 
                  onClick={() => setShowDetailsPanel(false)}
                  className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center shrink-0 transition-colors text-slate-400 hover:text-white"
                  title="Close panel"
                >
                  <i className="fa-solid fa-xmark text-sm" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-5">
                {selectedFiles.length === 1 && primarySelectedFile ? (
                  <>
                    {/* Preview / Large Icon */}
                    {primarySelectedFile.mimeType?.startsWith('image/') ? (
                      <div className="w-full aspect-square rounded-2xl bg-black/50 border border-white/10 flex items-center justify-center mb-6 overflow-hidden relative">
                        <img 
                          src={`/api/stream/${activeAccount.rcloneRemote}/${primarySelectedFile.path}`} 
                          alt={primarySelectedFile.name} 
                          className="max-w-full max-h-full object-contain" 
                        />
                      </div>
                    ) : primarySelectedFile.mimeType?.startsWith('video/') ? (
                      <div className="w-full aspect-square rounded-2xl bg-black/50 border border-white/10 flex flex-col items-center justify-center mb-6 overflow-hidden relative">
                        <video 
                          controls 
                          src={`/api/stream/${activeAccount.rcloneRemote}/${primarySelectedFile.path}`} 
                          className="max-w-full max-h-full" 
                        />
                      </div>
                    ) : (
                      <div className="w-full aspect-square rounded-2xl bg-gradient-to-br from-white/5 to-white/10 border border-white/10 flex items-center justify-center mb-6 shadow-inner relative overflow-hidden group">
                        <i className={`fa-solid ${primarySelectedFile.isFolder ? 'fa-folder text-indigo-400' : 'fa-file-lines text-slate-400'} text-6xl transform group-hover:scale-110 transition-transform duration-300`} />
                      </div>
                    )}

                    {/* Properties Info */}
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 border-b border-white/5 pb-2">Properties</h3>
                    
                    <div className="space-y-3 text-xs mb-6 bg-white/[0.02] p-3.5 rounded-xl border border-white/5">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Type</span>
                        <span className="text-white font-medium">{primarySelectedFile.isFolder ? 'Folder' : primarySelectedFile.mimeType || 'File'}</span>
                      </div>
                      {!primarySelectedFile.isFolder && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Size</span>
                          <span className="text-white font-medium">{formatBytes(primarySelectedFile.size)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-slate-500">Modified</span>
                        <span className="text-white font-medium text-right">
                          {new Date(primarySelectedFile.modifiedTime).toLocaleString(undefined, { 
                            year: 'numeric', month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Path</span>
                        <span className="text-slate-300 font-mono text-[11px] truncate max-w-[170px]" title={primarySelectedFile.path}>
                          {primarySelectedFile.path || '/'}
                        </span>
                      </div>
                    </div>

                    {/* Primary Actions */}
                    <div className="flex flex-col gap-2.5">
                      {primarySelectedFile.isFolder ? (
                        <button 
                          onClick={() => handleNavigate(primarySelectedFile)} 
                          disabled={navigatingFolderId === (primarySelectedFile.id || primarySelectedFile.path)}
                          className="w-full py-2.5 rounded-xl bg-indigo-500 text-white font-semibold hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 text-xs disabled:opacity-60 cursor-pointer"
                        >
                          {navigatingFolderId === (primarySelectedFile.id || primarySelectedFile.path) ? (
                            <>
                              <i className="fa-solid fa-circle-notch fa-spin" />
                              <span>Opening Folder...</span>
                            </>
                          ) : (
                            <>
                              <i className="fa-solid fa-folder-open" />
                              <span>Open Folder</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <>
                          {isVideoOrAudio(primarySelectedFile) ? (
                            <button 
                              onClick={() => handleOpenFileOrMedia(primarySelectedFile)} 
                              disabled={openingFileId === (primarySelectedFile.id || primarySelectedFile.path)}
                              className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 text-xs cursor-pointer disabled:opacity-60"
                            >
                              {openingFileId === (primarySelectedFile.id || primarySelectedFile.path) ? (
                                <>
                                  <i className="fa-solid fa-circle-notch fa-spin" />
                                  <span>Playing Media...</span>
                                </>
                              ) : (
                                <>
                                  <i className="fa-solid fa-circle-play text-sm" />
                                  <span>Play Media</span>
                                </>
                              )}
                            </button>
                          ) : isImageFile(primarySelectedFile) ? (
                            <button 
                              onClick={() => handleOpenFileOrMedia(primarySelectedFile)} 
                              disabled={openingFileId === (primarySelectedFile.id || primarySelectedFile.path)}
                              className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 text-xs cursor-pointer disabled:opacity-60"
                            >
                              {openingFileId === (primarySelectedFile.id || primarySelectedFile.path) ? (
                                <>
                                  <i className="fa-solid fa-circle-notch fa-spin" />
                                  <span>Opening Preview...</span>
                                </>
                              ) : (
                                <>
                                  <i className="fa-solid fa-eye text-sm" />
                                  <span>View Image</span>
                                </>
                              )}
                            </button>
                          ) : null}

                          <button 
                            onClick={() => handleDownload(primarySelectedFile)} 
                            className="w-full py-2.5 rounded-xl bg-indigo-500 text-white font-semibold hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 text-xs cursor-pointer"
                          >
                            <i className="fa-solid fa-download" />
                            Download
                          </button>

                          {/* Direct Download Link Card */}
                          <div className="bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent p-3 rounded-xl border border-indigo-500/20 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-300">
                                <i className="fa-solid fa-link text-[10px]" />
                                <span>Direct Download Link</span>
                              </div>
                              <button
                                onClick={() => openDirectLinkModal(primarySelectedFile)}
                                className="text-[10px] text-indigo-400 hover:text-indigo-200 transition-colors flex items-center gap-1 font-medium"
                                title="View links & bypass virus scan warning"
                              >
                                <span>Options</span>
                                <i className="fa-solid fa-arrow-up-right-from-square text-[9px]" />
                              </button>
                            </div>
                            
                            <div className="text-[10px] text-slate-300 font-mono bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/5 break-all select-all">
                              {`https://drive.usercontent.google.com/download?id=${primarySelectedFile.id || '...'}&export=download&authuser=0`}
                            </div>

                            <div className="flex gap-1.5 pt-0.5">
                              <button
                                onClick={() => handleCopyDirectLink(primarySelectedFile)}
                                className="flex-1 py-1.5 px-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/30 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors"
                                title="Copy direct download link"
                              >
                                <i className="fa-regular fa-copy text-[10px]" />
                                <span>Copy Link</span>
                              </button>
                              <button
                                onClick={() => openDirectLinkModal(primarySelectedFile)}
                                className="py-1.5 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
                                title="Open direct link generator"
                              >
                                <i className="fa-solid fa-sliders text-[10px]" />
                              </button>
                            </div>
                          </div>
                        </>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => openOrganizeModal('move', [primarySelectedFile])}
                          className="py-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 font-semibold hover:bg-indigo-500/30 transition-colors flex items-center justify-center gap-1.5 border border-indigo-500/30 text-xs"
                        >
                          <i className="fa-solid fa-arrows-up-down-left-right text-[11px]" />
                          Move to...
                        </button>
                        <button 
                          onClick={() => openOrganizeModal('copy', [primarySelectedFile])}
                          className="py-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 font-semibold hover:bg-emerald-500/30 transition-colors flex items-center justify-center gap-1.5 border border-emerald-500/30 text-xs"
                        >
                          <i className="fa-regular fa-clone text-[11px]" />
                          Copy to...
                        </button>
                      </div>

                      <button 
                        onClick={() => handleTransfer([primarySelectedFile])} 
                        className="w-full py-2.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold hover:bg-purple-500/30 transition-colors flex items-center justify-center gap-2 text-xs"
                      >
                        <i className="fa-solid fa-right-left" />
                        Transfer to Drive
                      </button>

                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => openRenameModal(primarySelectedFile)}
                          className="py-2 rounded-xl bg-white/5 text-slate-200 font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5 border border-white/5 text-xs"
                        >
                          <i className="fa-solid fa-pen text-[11px]" />
                          Rename
                        </button>
                        <button 
                          onClick={() => toggleStar(primarySelectedFile)}
                          className="py-2 rounded-xl bg-white/5 text-slate-200 font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5 border border-white/5 text-xs"
                        >
                          <i className={`fa-${starredIds.has(primarySelectedFile.id || primarySelectedFile.path) ? 'solid text-amber-400' : 'regular'} fa-star text-[11px]`} />
                          Star
                        </button>
                      </div>

                      <button 
                        onClick={() => openDeleteModal([primarySelectedFile])}
                        className="w-full py-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2 text-xs mt-1 font-medium"
                      >
                        <i className="fa-regular fa-trash-can" />
                        Delete File
                      </button>
                    </div>
                  </>
                ) : selectedFiles.length > 1 ? (
                  /* Multiple Selection Summary */
                  <div className="flex flex-col gap-4">
                    <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-center">
                      <div className="w-12 h-12 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-2 text-xl">
                        <i className="fa-solid fa-layer-group" />
                      </div>
                      <h4 className="font-bold text-white text-base">{selectedFiles.length} items selected</h4>
                      <p className="text-xs text-slate-400 mt-1">
                        {selectedFiles.filter(f => f.isFolder).length} folders, {selectedFiles.filter(f => !f.isFolder).length} files
                      </p>
                      <p className="text-xs font-medium text-indigo-300 mt-2">
                        Total Size: {formatBytes(selectedFiles.reduce((acc, f) => acc + (f.size || 0), 0))}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => openOrganizeModal('move')}
                          className="py-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 font-semibold hover:bg-indigo-500/30 transition-colors flex items-center justify-center gap-1.5 border border-indigo-500/30 text-xs"
                        >
                          <i className="fa-solid fa-arrows-up-down-left-right text-[11px]" />
                          Move ({selectedFiles.length})
                        </button>
                        <button 
                          onClick={() => openOrganizeModal('copy')}
                          className="py-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 font-semibold hover:bg-emerald-500/30 transition-colors flex items-center justify-center gap-1.5 border border-emerald-500/30 text-xs"
                        >
                          <i className="fa-regular fa-clone text-[11px]" />
                          Copy ({selectedFiles.length})
                        </button>
                      </div>

                      <button 
                        onClick={() => handleTransfer()}
                        className="w-full py-2.5 rounded-xl bg-purple-500 text-white font-semibold hover:bg-purple-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 text-xs"
                      >
                        <i className="fa-solid fa-right-left" />
                        Transfer Selected ({selectedFiles.length})
                      </button>

                      <button 
                        onClick={() => openDeleteModal()}
                        className="w-full py-2.5 rounded-xl bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25 transition-colors flex items-center justify-center gap-2 text-xs font-semibold"
                      >
                        <i className="fa-regular fa-trash-can" />
                        Delete Selected ({selectedFiles.length})
                      </button>

                      <button 
                        onClick={handleClearSelection}
                        className="w-full py-2 rounded-xl bg-white/5 text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2 text-xs border border-white/5"
                      >
                        <i className="fa-solid fa-xmark" />
                        Deselect All
                      </button>
                    </div>

                    {/* Selected Items List */}
                    <div className="mt-2">
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Selected Items:</h5>
                      <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
                        {selectedFiles.map(f => (
                          <div key={f.id || f.path} className="flex items-center gap-2 p-1.5 rounded-lg bg-white/[0.03] text-xs">
                            <i className={`fa-solid ${f.isFolder ? 'fa-folder text-indigo-400' : 'fa-file-lines text-slate-400'} text-xs shrink-0`} />
                            <span className="truncate text-slate-300 flex-1">{f.name}</span>
                            <button
                              onClick={() => {
                                const newSet = new Set(selectedFileIds)
                                newSet.delete(f.id || f.path)
                                setSelectedFileIds(newSet)
                              }}
                              className="text-slate-500 hover:text-white p-0.5"
                            >
                              <i className="fa-solid fa-xmark text-[10px]" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Current Folder Overview (when no items are selected) */
                  <div className="flex flex-col gap-5">
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center mx-auto mb-3 text-2xl border border-sky-500/20">
                        <i className="fa-regular fa-folder-open" />
                      </div>
                      <h4 className="font-bold text-white text-base truncate">{path[path.length - 1]?.name || 'My Drive'}</h4>
                      <p className="text-xs text-slate-400 mt-1 font-mono truncate">
                        {currentFolderId === 'root' ? 'root' : currentFolderId}
                      </p>
                    </div>

                    <div className="space-y-3 text-xs bg-white/[0.02] p-4 rounded-xl border border-white/5">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 border-b border-white/5 pb-2">Folder Stats</h3>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Total Items</span>
                        <span className="text-white font-medium">{files.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Subfolders</span>
                        <span className="text-white font-medium">{files.filter(f => f.isFolder).length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Files</span>
                        <span className="text-white font-medium">{files.filter(f => !f.isFolder).length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Total Size</span>
                        <span className="text-white font-medium">{formatBytes(files.reduce((acc, f) => acc + (f.size || 0), 0))}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      <button
                        onClick={openNewFolderModal}
                        className="w-full py-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                      >
                        <i className="fa-solid fa-folder-plus text-indigo-400" />
                        <span>Create New Folder</span>
                      </button>

                      <button
                        onClick={() => handleTransfer()}
                        className="w-full py-2.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                      >
                        <i className="fa-solid fa-right-left text-purple-400" />
                        <span>Transfer This Folder</span>
                      </button>

                      <button
                        onClick={() => loadFiles(currentFolderId)}
                        className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
                      >
                        <i className="fa-solid fa-rotate-right" />
                        <span>Refresh Contents</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right-Click Context Menu (Google Drive styled) */}
      <AnimatePresence>
        {contextMenu && (
          <div 
            className="fixed z-[200]" 
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.12 }}
              className="w-60 bg-[#161820]/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl py-1.5 px-1.5 text-xs text-slate-200 select-none ring-1 ring-black/50"
            >
              {contextMenu.item ? (
                /* Context menu for file / folder */
                <>
                  <div className="px-3 py-1.5 text-[11px] text-slate-400 font-semibold truncate border-b border-white/5 flex items-center gap-2">
                    <i className={`fa-solid ${contextMenu.item.isFolder ? 'fa-folder text-indigo-400' : 'fa-file text-slate-400'}`} />
                    <span className="truncate">{contextMenu.item.name}</span>
                  </div>

                  {contextMenu.item.isFolder ? (
                    <button
                      onClick={() => {
                        const item = contextMenu.item!
                        setContextMenu(null)
                        handleNavigate(item)
                      }}
                      className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 hover:bg-white/10 hover:text-white transition-colors text-left cursor-pointer"
                    >
                      <i className="fa-solid fa-folder-open text-indigo-400 w-4" />
                      <span>Open Folder</span>
                    </button>
                  ) : isVideoOrAudio(contextMenu.item) ? (
                    <button
                      onClick={() => {
                        const item = contextMenu.item!
                        setContextMenu(null)
                        handleOpenFileOrMedia(item)
                      }}
                      className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 hover:bg-emerald-500/20 text-emerald-300 hover:text-emerald-200 transition-colors text-left font-medium cursor-pointer"
                    >
                      <i className="fa-solid fa-circle-play text-emerald-400 w-4" />
                      <span>Play Media</span>
                    </button>
                  ) : isImageFile(contextMenu.item) ? (
                    <button
                      onClick={() => {
                        const item = contextMenu.item!
                        setContextMenu(null)
                        handleOpenFileOrMedia(item)
                      }}
                      className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 hover:bg-indigo-500/20 text-indigo-300 hover:text-indigo-200 transition-colors text-left font-medium cursor-pointer"
                    >
                      <i className="fa-solid fa-eye text-indigo-400 w-4" />
                      <span>View Image</span>
                    </button>
                  ) : null}

                  {/* Download Option in Context Menu */}
                  <button
                    onClick={() => {
                      handleDownload(contextMenu.item!)
                      setContextMenu(null)
                    }}
                    className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 hover:bg-emerald-500/20 text-emerald-300 hover:text-emerald-200 transition-colors text-left font-medium"
                  >
                    <i className="fa-solid fa-download text-emerald-400 w-4" />
                    <span>Download</span>
                  </button>

                  {!contextMenu.item.isFolder && (
                    <>
                      <button
                        onClick={() => {
                          const item = contextMenu.item!
                          setContextMenu(null)
                          openDirectLinkModal(item)
                        }}
                        className="w-full px-3 py-2 rounded-xl flex items-center justify-between hover:bg-indigo-500/20 text-indigo-300 hover:text-indigo-200 transition-colors text-left font-medium"
                        title="View direct usercontent download link & bypass options"
                      >
                        <div className="flex items-center gap-2.5">
                          <i className="fa-solid fa-link text-indigo-400 w-4" />
                          <span>Direct Download Link</span>
                        </div>
                        <i className="fa-solid fa-chevron-right text-[10px] text-indigo-400/60" />
                      </button>

                      <button
                        onClick={() => {
                          const item = contextMenu.item!
                          setContextMenu(null)
                          handleCopyDirectLink(item)
                        }}
                        className="w-full px-3 py-2 rounded-xl flex items-center justify-between hover:bg-white/10 hover:text-white transition-colors text-left"
                        title="Copy direct download link (drive.usercontent.google.com)"
                      >
                        <div className="flex items-center gap-2.5">
                          <i className="fa-regular fa-copy text-indigo-400 w-4" />
                          <span>Copy Direct Link</span>
                        </div>
                        <span className="text-[9px] text-slate-500 font-mono">Direct URL</span>
                      </button>
                    </>
                  )}

                  <div className="h-px bg-white/10 my-1 mx-1" />

                  {/* Copy (Ctrl+C) */}
                  <button
                    onClick={() => {
                      const items = selectedFiles.length > 1 && selectedFiles.some(f => (f.id || f.path) === (contextMenu.item!.id || contextMenu.item!.path))
                        ? selectedFiles
                        : [contextMenu.item!]
                      handleCopy(items)
                      setContextMenu(null)
                    }}
                    className="w-full px-3 py-2 rounded-xl flex items-center justify-between hover:bg-white/10 hover:text-white transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <i className="fa-regular fa-copy text-indigo-400 w-4" />
                      <span>Copy</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">Ctrl+C</span>
                  </button>

                  {/* Cut (Ctrl+X) */}
                  <button
                    onClick={() => {
                      const items = selectedFiles.length > 1 && selectedFiles.some(f => (f.id || f.path) === (contextMenu.item!.id || contextMenu.item!.path))
                        ? selectedFiles
                        : [contextMenu.item!]
                      handleCut(items)
                      setContextMenu(null)
                    }}
                    className="w-full px-3 py-2 rounded-xl flex items-center justify-between hover:bg-white/10 hover:text-white transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <i className="fa-solid fa-scissors text-amber-400 w-4" />
                      <span>Cut</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">Ctrl+X</span>
                  </button>

                  {/* Paste (Ctrl+V) */}
                  {clipboard && clipboard.items.length > 0 && (
                    <button
                      onClick={() => {
                        const target = contextMenu.item!.isFolder ? contextMenu.item!.path : undefined
                        handlePaste(target)
                        setContextMenu(null)
                      }}
                      className="w-full px-3 py-2 rounded-xl flex items-center justify-between hover:bg-sky-500/20 text-sky-300 hover:text-sky-200 transition-colors text-left font-medium"
                    >
                      <div className="flex items-center gap-2.5">
                        <i className="fa-regular fa-clipboard text-sky-400 w-4" />
                        <span>Paste {contextMenu.item!.isFolder ? `into "${contextMenu.item!.name}"` : 'here'}</span>
                      </div>
                      <span className="text-[10px] text-sky-400/80 font-mono">Ctrl+V</span>
                    </button>
                  )}

                  <div className="h-px bg-white/10 my-1 mx-1" />

                  {activeSection === 'shared-with-me' ? (
                    <>
                      <button
                        onClick={() => {
                          const contextItems = selectedFiles.length > 1 && selectedFiles.some(f => (f.id || f.path) === (contextMenu.item!.id || contextMenu.item!.path))
                            ? selectedFiles
                            : [contextMenu.item!]
                          setContextMenu(null)
                          openTransferToMyDriveModal(contextItems)
                        }}
                        className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 hover:text-white transition-colors text-left font-semibold border border-indigo-500/30"
                      >
                        <i className="fa-brands fa-google-drive text-indigo-400 w-4" />
                        <span>Transfer to My Drive {selectedFiles.length > 1 && selectedFiles.some(f => (f.id || f.path) === (contextMenu.item!.id || contextMenu.item!.path)) ? `(${selectedFiles.length})` : ''}</span>
                      </button>

                      <button
                        onClick={() => {
                          const contextItems = selectedFiles.length > 1 && selectedFiles.some(f => (f.id || f.path) === (contextMenu.item!.id || contextMenu.item!.path))
                            ? selectedFiles
                            : [contextMenu.item!]
                          handleTransfer(contextItems)
                          setContextMenu(null)
                        }}
                        className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 hover:bg-purple-500/20 text-purple-300 hover:text-purple-200 transition-colors text-left font-medium"
                      >
                        <i className="fa-solid fa-right-left text-purple-400 w-4" />
                        <span>Transfer to Another Account...</span>
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Move Option in Context Menu */}
                      <button
                        onClick={() => {
                          const contextItems = selectedFiles.length > 1 && selectedFiles.some(f => (f.id || f.path) === (contextMenu.item!.id || contextMenu.item!.path))
                            ? selectedFiles
                            : [contextMenu.item!]
                          setContextMenu(null)
                          openOrganizeModal('move', contextItems)
                        }}
                        className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 hover:bg-indigo-500/20 text-indigo-300 hover:text-indigo-200 transition-colors text-left font-medium"
                      >
                        <i className="fa-solid fa-arrows-up-down-left-right text-indigo-400 w-4" />
                        <span>Move to... {selectedFiles.length > 1 && selectedFiles.some(f => (f.id || f.path) === (contextMenu.item!.id || contextMenu.item!.path)) ? `(${selectedFiles.length})` : ''}</span>
                      </button>

                      {/* Copy Option in Context Menu */}
                      <button
                        onClick={() => {
                          const contextItems = selectedFiles.length > 1 && selectedFiles.some(f => (f.id || f.path) === (contextMenu.item!.id || contextMenu.item!.path))
                            ? selectedFiles
                            : [contextMenu.item!]
                          setContextMenu(null)
                          openOrganizeModal('copy', contextItems)
                        }}
                        className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 hover:bg-emerald-500/20 text-emerald-300 hover:text-emerald-200 transition-colors text-left font-medium"
                      >
                        <i className="fa-regular fa-clone text-emerald-400 w-4" />
                        <span>Copy to... {selectedFiles.length > 1 && selectedFiles.some(f => (f.id || f.path) === (contextMenu.item!.id || contextMenu.item!.path)) ? `(${selectedFiles.length})` : ''}</span>
                      </button>

                      <button
                        onClick={() => {
                          const contextItems = selectedFiles.length > 1 && selectedFiles.some(f => (f.id || f.path) === (contextMenu.item!.id || contextMenu.item!.path))
                            ? selectedFiles
                            : [contextMenu.item!]
                          handleTransfer(contextItems)
                          setContextMenu(null)
                        }}
                        className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 hover:bg-purple-500/20 text-purple-300 hover:text-purple-200 transition-colors text-left font-medium"
                      >
                        <i className="fa-solid fa-right-left text-purple-400 w-4" />
                        <span>Transfer to Drive {selectedFiles.length > 1 && selectedFiles.some(f => (f.id || f.path) === (contextMenu.item!.id || contextMenu.item!.path)) ? `(${selectedFiles.length})` : ''}</span>
                      </button>
                    </>
                  )}

                  <div className="h-px bg-white/10 my-1 mx-1" />

                  <button
                    onClick={() => {
                      openRenameModal(contextMenu.item!)
                      setContextMenu(null)
                    }}
                    className="w-full px-3 py-2 rounded-xl flex items-center justify-between hover:bg-white/10 hover:text-white transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <i className="fa-solid fa-pen text-slate-400 w-4" />
                      <span>Rename</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">F2</span>
                  </button>

                  <button
                    onClick={() => {
                      toggleStar(contextMenu.item!)
                      setContextMenu(null)
                    }}
                    className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 hover:bg-white/10 hover:text-white transition-colors text-left"
                  >
                    <i className={`fa-${starredIds.has(contextMenu.item.id || contextMenu.item.path) ? 'solid text-amber-400' : 'regular text-slate-400'} fa-star w-4`} />
                    <span>{starredIds.has(contextMenu.item.id || contextMenu.item.path) ? 'Remove Star' : 'Add to Starred'}</span>
                  </button>

                  <button
                    onClick={() => {
                      copyToClipboard(contextMenu.item!.name, 'File name')
                      setContextMenu(null)
                    }}
                    className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 hover:bg-white/10 hover:text-white transition-colors text-left"
                  >
                    <i className="fa-regular fa-copy text-slate-400 w-4" />
                    <span>Copy Name</span>
                  </button>

                  {/* Show Info Option in Context Menu */}
                  <button
                    onClick={() => {
                      setShowDetailsPanel(true)
                      setContextMenu(null)
                    }}
                    className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 hover:bg-sky-500/20 text-sky-300 hover:text-sky-200 transition-colors text-left font-medium"
                  >
                    <i className="fa-solid fa-circle-info text-sky-400 w-4" />
                    <span>{contextMenu.item.isFolder ? 'Folder info' : 'File info'}</span>
                  </button>

                  <div className="h-px bg-white/10 my-1 mx-1" />

                  <button
                    onClick={() => {
                      const contextItems = selectedFiles.length > 1 && selectedFiles.some(f => (f.id || f.path) === (contextMenu.item!.id || contextMenu.item!.path))
                        ? selectedFiles
                        : [contextMenu.item!]
                      openDeleteModal(contextItems)
                      setContextMenu(null)
                    }}
                    className="w-full px-3 py-2 rounded-xl flex items-center justify-between hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors text-left font-medium"
                  >
                    <div className="flex items-center gap-2.5">
                      <i className="fa-regular fa-trash-can w-4" />
                      <span>Delete {selectedFiles.length > 1 && selectedFiles.some(f => (f.id || f.path) === (contextMenu.item!.id || contextMenu.item!.path)) ? `(${selectedFiles.length})` : ''}</span>
                    </div>
                    <span className="text-[10px] text-red-400/60 font-mono">Del</span>
                  </button>
                </>
              ) : (
                /* Context menu on background / empty area (Google Drive style) */
                <>
                  {/* Paste (Ctrl+V) if clipboard has items */}
                  {clipboard && clipboard.items.length > 0 && (
                    <button
                      onClick={() => {
                        handlePaste()
                        setContextMenu(null)
                      }}
                      className="w-full px-3 py-2 rounded-xl flex items-center justify-between hover:bg-sky-500/20 text-sky-300 hover:text-sky-200 transition-colors text-left font-medium"
                    >
                      <div className="flex items-center gap-2.5">
                        <i className="fa-regular fa-clipboard text-sky-400 w-4" />
                        <span>Paste ({clipboard.items.length} item{clipboard.items.length > 1 ? 's' : ''})</span>
                      </div>
                      <span className="text-[10px] text-sky-400/80 font-mono">Ctrl+V</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      openNewFolderModal()
                      setContextMenu(null)
                    }}
                    className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 hover:bg-white/10 hover:text-white transition-colors text-left font-medium"
                  >
                    <i className="fa-solid fa-folder-plus text-indigo-400 w-4" />
                    <span>New folder</span>
                  </button>

                  <button
                    onClick={() => {
                      loadFiles(currentFolderId)
                      setContextMenu(null)
                    }}
                    className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 hover:bg-white/10 hover:text-white transition-colors text-left"
                  >
                    <i className="fa-solid fa-rotate-right text-slate-400 w-4" />
                    <span>Refresh</span>
                  </button>

                  <div className="h-px bg-white/10 my-1 mx-1" />

                  <button
                    onClick={() => {
                      handleTransfer()
                      setContextMenu(null)
                    }}
                    className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 hover:bg-purple-500/20 text-purple-300 hover:text-purple-200 transition-colors text-left font-medium"
                  >
                    <i className="fa-solid fa-right-left text-purple-400 w-4" />
                    <span>Transfer this folder</span>
                  </button>

                  {/* Show Folder Info Option in background context menu */}
                  <button
                    onClick={() => {
                      setShowDetailsPanel(true)
                      setContextMenu(null)
                    }}
                    className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 hover:bg-sky-500/20 text-sky-300 hover:text-sky-200 transition-colors text-left font-medium"
                  >
                    <i className="fa-solid fa-circle-info text-sky-400 w-4" />
                    <span>Folder info</span>
                  </button>

                  <button
                    onClick={() => {
                      handleSelectAll()
                      setContextMenu(null)
                    }}
                    className="w-full px-3 py-2 rounded-xl flex items-center justify-between hover:bg-white/10 hover:text-white transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <i className="fa-solid fa-check-double text-slate-400 w-4" />
                      <span>Select all</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">Ctrl+A</span>
                  </button>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModal.isOpen && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" 
              onClick={() => !deleteModal.loading && setDeleteModal({ isOpen: false, items: [], loading: false })} 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-[#13151c] rounded-3xl p-6 shadow-2xl border border-red-500/30"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                  <i className="fa-solid fa-trash-can text-xl" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Delete from Google Drive</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {deleteModal.items.length === 1 
                      ? `Delete "${deleteModal.items[0].name}"?` 
                      : `Delete ${deleteModal.items.length} selected items?`}
                  </p>
                </div>
              </div>

              <div className="bg-white/[0.03] rounded-xl p-3 mb-5 border border-white/5 max-h-36 overflow-y-auto">
                <p className="text-xs text-slate-300 leading-relaxed mb-2">
                  {deleteModal.items.some(i => i.isFolder) ? (
                    <span className="text-amber-400 font-medium block mb-1">
                      ⚠️ Selected folders and all their nested contents will be permanently deleted.
                    </span>
                  ) : null}
                  Are you sure you want to permanently remove this content from your connected Google Drive?
                </p>
                <div className="space-y-1 mt-2">
                  {deleteModal.items.slice(0, 5).map(item => (
                    <div key={item.id || item.path} className="flex items-center gap-2 text-xs text-slate-400">
                      <i className={`fa-solid ${item.isFolder ? 'fa-folder text-indigo-400' : 'fa-file text-slate-500'} text-[11px]`} />
                      <span className="truncate">{item.name}</span>
                    </div>
                  ))}
                  {deleteModal.items.length > 5 && (
                    <p className="text-[11px] text-slate-500 italic pl-5">
                      ...and {deleteModal.items.length - 5} more items
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={deleteModal.loading}
                  onClick={() => setDeleteModal({ isOpen: false, items: [], loading: false })}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-xs border border-white/10 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteModal.loading}
                  onClick={confirmDelete}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-500/25 transition-colors disabled:opacity-50"
                >
                  {deleteModal.loading ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-regular fa-trash-can text-xs" />
                      <span>Delete permanently</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rename Modal */}
      <AnimatePresence>
        {renameModal.isOpen && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" 
              onClick={() => !renameModal.loading && setRenameModal({ isOpen: false, item: null, newName: '', loading: false })} 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-[#13151c] rounded-3xl p-6 shadow-2xl border border-indigo-500/30"
            >
              <div className="flex items-center gap-3.5 mb-5">
                <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <i className="fa-solid fa-pen text-lg" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Rename</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Enter a new name for this item</p>
                </div>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); confirmRename(); }}>
                <div className="mb-6">
                  <label className="block text-xs font-semibold text-slate-300 mb-2">Item Name</label>
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={renameModal.newName}
                    onChange={(e) => setRenameModal(prev => ({ ...prev, newName: e.target.value }))}
                    disabled={renameModal.loading}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={renameModal.loading}
                    onClick={() => setRenameModal({ isOpen: false, item: null, newName: '', loading: false })}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-xs border border-white/10 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={renameModal.loading || !renameModal.newName.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 transition-colors disabled:opacity-50"
                  >
                    {renameModal.loading ? (
                      <>
                        <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                        <span>Renaming...</span>
                      </>
                    ) : (
                      <span>Save Changes</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Folder Modal */}
      <AnimatePresence>
        {newFolderModal.isOpen && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" 
              onClick={() => !newFolderModal.loading && setNewFolderModal({ isOpen: false, folderName: '', loading: false })} 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-[#13151c] rounded-3xl p-6 shadow-2xl border border-indigo-500/30"
            >
              <div className="flex items-center gap-3.5 mb-5">
                <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <i className="fa-solid fa-folder-plus text-lg" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">New Folder</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Create a folder in {path[path.length - 1].name}</p>
                </div>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); confirmCreateFolder(); }}>
                <div className="mb-6">
                  <label className="block text-xs font-semibold text-slate-300 mb-2">Folder Name</label>
                  <input
                    ref={newFolderInputRef}
                    type="text"
                    value={newFolderModal.folderName}
                    onChange={(e) => setNewFolderModal(prev => ({ ...prev, folderName: e.target.value }))}
                    disabled={newFolderModal.loading}
                    placeholder="e.g. Work Documents"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={newFolderModal.loading}
                    onClick={() => setNewFolderModal({ isOpen: false, folderName: '', loading: false })}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-xs border border-white/10 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={newFolderModal.loading || !newFolderModal.folderName.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 transition-colors disabled:opacity-50"
                  >
                    {newFolderModal.loading ? (
                      <>
                        <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <span>Create Folder</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Account Disconnect Modal */}
      <AnimatePresence>
        {accountToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" 
              onClick={() => setAccountToDelete(null)} 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#13151c] rounded-3xl p-8 shadow-2xl border border-red-500/20"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                  <i className="fa-solid fa-triangle-exclamation text-2xl" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Disconnect Drive</h3>
                  <p className="text-sm text-slate-400 mt-1">Are you sure you want to remove this account?</p>
                </div>
              </div>
              
              <p className="text-slate-300 text-sm mb-8 leading-relaxed">
                This will remove <span className="font-bold text-white px-1.5 py-0.5 rounded bg-white/10">{accountToDelete.name}</span> from your dashboard. 
                <br/><br/>
                Don't worry, your actual files on Google Drive will remain completely untouched. You can reconnect it later at any time.
              </p>

              <div className="flex items-center gap-3 w-full">
                <button
                  onClick={() => setAccountToDelete(null)}
                  className="flex-1 py-3 rounded-xl bg-white/5 text-white font-semibold hover:bg-white/10 transition-colors border border-white/5 text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDisconnect}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 text-xs"
                >
                  <i className="fa-solid fa-unlink" />
                  Disconnect
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Organize / Move / Copy Modal with GUI Folder Picker */}
      <AnimatePresence>
        {organizeModal.isOpen && (
          <div className="fixed inset-0 z-[260] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/85 backdrop-blur-md" 
              onClick={() => !organizeModal.loading && setOrganizeModal(prev => ({ ...prev, isOpen: false }))} 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              className="relative w-full max-w-xl bg-[#12141c] rounded-3xl shadow-2xl border border-white/10 flex flex-col overflow-hidden max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#161924]">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-base ${
                    organizeModal.operation === 'move' 
                      ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' 
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    <i className={`fa-${organizeModal.operation === 'move' ? 'solid fa-arrows-up-down-left-right' : 'regular fa-clone'}`} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white capitalize">
                      {organizeModal.operation} {organizeModal.items.length === 1 ? `"${organizeModal.items[0]?.name}"` : `${organizeModal.items.length} Items`}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Select destination folder {organizeModal.operation === 'move' ? 'to move into' : 'to create a copy in'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={organizeModal.loading}
                  onClick={() => setOrganizeModal(prev => ({ ...prev, isOpen: false }))}
                  className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                >
                  <i className="fa-solid fa-xmark text-sm" />
                </button>
              </div>

              {/* Destination Drive Account Picker */}
              <div className="px-6 py-3 border-b border-white/5 bg-[#141722] flex items-center justify-between gap-3 text-xs shrink-0">
                <span className="text-slate-400 font-medium">Target Drive:</span>
                <div className="flex items-center gap-2">
                  <select
                    value={organizeModal.targetAccountId}
                    onChange={(e) => handleChangeTargetAccount(e.target.value)}
                    disabled={organizeModal.loading || organizeModal.loadingFolders}
                    className="bg-[#1c202d] border border-white/10 text-white rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500 text-xs cursor-pointer"
                  >
                    {state.accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.email || 'Google Drive'}) {acc.id === activeAccount?.id ? '★ Current' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Folder Breadcrumbs & Actions Bar */}
              <div className="px-6 py-3 border-b border-white/5 bg-[#0f1118] flex items-center justify-between gap-3 shrink-0">
                {/* Breadcrumbs */}
                <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none text-xs flex-1">
                  {organizeModal.targetFolderPath.map((segment, idx) => (
                    <div key={segment.id + idx} className="flex items-center gap-1.5 shrink-0">
                      {idx > 0 && <span className="text-slate-600">/</span>}
                      <button
                        onClick={() => handleNavigateDestBreadcrumb(idx)}
                        disabled={organizeModal.loading || organizeModal.loadingFolders}
                        className={`px-2 py-1 rounded-lg transition-colors flex items-center gap-1.5 ${
                          idx === organizeModal.targetFolderPath.length - 1
                            ? 'bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <i className={`fa-solid ${idx === 0 ? 'fa-hard-drive text-[11px]' : 'fa-folder text-[11px]'}`} />
                        <span>{segment.name}</span>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Inline New Folder Toggle */}
                <button
                  onClick={() => setOrganizeModal(prev => ({ ...prev, isCreatingFolder: !prev.isCreatingFolder, newFolderName: '' }))}
                  disabled={organizeModal.loading || organizeModal.loadingFolders}
                  className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-medium transition-colors flex items-center gap-1.5 border border-white/10 shrink-0"
                  title="Create folder in this location"
                >
                  <i className="fa-solid fa-folder-plus text-indigo-400" />
                  <span>New Folder</span>
                </button>
              </div>

              {/* Inline Create Folder Input */}
              {organizeModal.isCreatingFolder && (
                <div className="px-6 py-2.5 bg-indigo-500/10 border-b border-indigo-500/20 flex items-center gap-2 shrink-0">
                  <i className="fa-solid fa-folder-plus text-indigo-400 text-xs shrink-0" />
                  <input
                    type="text"
                    value={organizeModal.newFolderName}
                    onChange={(e) => setOrganizeModal(prev => ({ ...prev, newFolderName: e.target.value }))}
                    placeholder="Enter folder name..."
                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateDestFolder()
                      if (e.key === 'Escape') setOrganizeModal(prev => ({ ...prev, isCreatingFolder: false }))
                    }}
                  />
                  <button
                    onClick={handleCreateDestFolder}
                    disabled={organizeModal.creatingFolderLoading || !organizeModal.newFolderName.trim()}
                    className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors shrink-0"
                  >
                    {organizeModal.creatingFolderLoading ? (
                      <i className="fa-solid fa-circle-notch fa-spin" />
                    ) : (
                      'Create'
                    )}
                  </button>
                  <button
                    onClick={() => setOrganizeModal(prev => ({ ...prev, isCreatingFolder: false }))}
                    className="px-2 py-1.5 text-slate-400 hover:text-white text-xs transition-colors shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Search Filter within subfolders */}
              {organizeModal.subfolders.length > 3 && (
                <div className="px-6 py-2 border-b border-white/5 bg-[#12141c] shrink-0">
                  <div className="relative">
                    <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs" />
                    <input
                      type="text"
                      value={organizeModal.searchQuery}
                      onChange={(e) => setOrganizeModal(prev => ({ ...prev, searchQuery: e.target.value }))}
                      placeholder="Filter folders here..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/5 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* Current Destination Selection Summary Badge */}
              <div className="px-6 py-2.5 bg-[#171a26] border-b border-white/5 flex items-center justify-between text-xs shrink-0">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="text-slate-400">Target Folder:</span>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/10 text-indigo-300 font-medium truncate">
                    <i className="fa-solid fa-folder-open text-[11px]" />
                    <span className="truncate">{organizeModal.selectedDestFolderName || 'My Drive'}</span>
                  </div>
                </div>
                {organizeModal.selectedDestFolderId !== organizeModal.targetFolderId && (
                  <button
                    onClick={() => setOrganizeModal(prev => ({
                      ...prev,
                      selectedDestFolderId: prev.targetFolderId,
                      selectedDestFolderName: prev.targetFolderPath[prev.targetFolderPath.length - 1]?.name || 'Current Folder'
                    }))}
                    className="text-[11px] text-indigo-400 hover:underline shrink-0"
                  >
                    Select current directory
                  </button>
                )}
              </div>

              {/* Subfolders List (GUI Folder Browser) */}
              <div className="flex-1 overflow-y-auto p-4 space-y-1 min-h-[220px] max-h-[340px]">
                {organizeModal.loadingFolders ? (
                  <div className="h-44 flex flex-col items-center justify-center text-slate-400 gap-2">
                    <i className="fa-solid fa-circle-notch fa-spin text-indigo-400 text-2xl" />
                    <span className="text-xs">Loading folders...</span>
                  </div>
                ) : (
                  <>
                    {/* Current folder option */}
                    <div
                      onClick={() => setOrganizeModal(prev => ({
                        ...prev,
                        selectedDestFolderId: prev.targetFolderId,
                        selectedDestFolderName: prev.targetFolderPath[prev.targetFolderPath.length - 1]?.name || 'Current Folder'
                      }))}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer text-xs transition-all border ${
                        organizeModal.selectedDestFolderId === organizeModal.targetFolderId
                          ? 'bg-indigo-500/20 text-indigo-200 border-indigo-500/40 shadow-sm'
                          : 'bg-white/[0.02] text-slate-300 hover:bg-white/5 border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
                          <i className="fa-solid fa-folder-open text-xs" />
                        </div>
                        <span className="font-semibold">
                          [This Folder] {organizeModal.targetFolderPath[organizeModal.targetFolderPath.length - 1]?.name}
                        </span>
                      </div>
                      {organizeModal.selectedDestFolderId === organizeModal.targetFolderId && (
                        <i className="fa-solid fa-check text-indigo-400" />
                      )}
                    </div>

                    {/* Subfolders list */}
                    {organizeModal.subfolders
                      .filter(f => !organizeModal.searchQuery || f.name.toLowerCase().includes(organizeModal.searchQuery.toLowerCase()))
                      .map(folder => {
                        const isSelected = organizeModal.selectedDestFolderId === folder.path
                        const cleanFp = folder.path.replace(/^\/+|\/+$/g, '')
                        const isDisabled = organizeModal.operation === 'move' && organizeModal.targetAccountId === activeAccount?.id && organizeModal.items.some(item => {
                          if (!item.isFolder) return false
                          const itemPath = item.path.replace(/^\/+|\/+$/g, '')
                          return cleanFp === itemPath || cleanFp.startsWith(itemPath + '/')
                        })

                        return (
                          <div
                            key={folder.path}
                            onClick={() => !isDisabled && handleSelectDestSubfolder(folder)}
                            onDoubleClick={() => !isDisabled && handleEnterDestFolder(folder)}
                            className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all border ${
                              isDisabled
                                ? 'opacity-40 cursor-not-allowed bg-transparent border-transparent'
                                : isSelected
                                ? 'bg-indigo-500/20 text-indigo-200 border-indigo-500/40 shadow-sm cursor-pointer'
                                : 'bg-white/[0.02] text-slate-300 hover:bg-white/5 border-white/5 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                                <i className="fa-solid fa-folder text-xs" />
                              </div>
                              <span className="truncate font-medium">{folder.name}</span>
                              {isDisabled && (
                                <span className="text-[10px] text-red-400/80 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 shrink-0">
                                  Cannot move into self
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {isSelected && !isDisabled && (
                                <i className="fa-solid fa-check text-indigo-400 text-xs mr-1" />
                              )}
                              <button
                                type="button"
                                disabled={isDisabled}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEnterDestFolder(folder)
                                }}
                                className="px-2 py-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-[11px]"
                                title="Open folder to browse subfolders"
                              >
                                <span>Open</span>
                                <i className="fa-solid fa-chevron-right text-[9px]" />
                              </button>
                            </div>
                          </div>
                        )
                      })}

                    {organizeModal.subfolders.length === 0 && (
                      <div className="py-8 text-center text-slate-500">
                        <i className="fa-regular fa-folder text-3xl mb-2 text-slate-600 block" />
                        <p className="text-xs">No subfolders inside this location.</p>
                        <p className="text-[11px] text-slate-600 mt-1">You can select this folder as destination, or create a new folder above.</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Status / Validation Warnings */}
              {isDestInvalid() && (
                <div className="px-6 py-2.5 bg-red-500/10 border-t border-red-500/20 flex items-center gap-2 text-xs text-red-400">
                  <i className="fa-solid fa-triangle-exclamation" />
                  <span>Cannot move a folder into itself or any of its subfolders.</span>
                </div>
              )}

              {isAlreadyInDest() && (
                <div className="px-6 py-2.5 bg-amber-500/10 border-t border-amber-500/20 flex items-center gap-2 text-xs text-amber-300">
                  <i className="fa-solid fa-circle-info" />
                  <span>Selected items are already in this destination folder.</span>
                </div>
              )}

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-white/10 bg-[#151722] flex items-center justify-between shrink-0">
                <div className="text-xs text-slate-400 truncate max-w-[220px]">
                  <span>Dest: </span>
                  <span className="text-slate-200 font-mono text-[11px]">
                    {organizeModal.selectedDestFolderId === 'root' ? '/' : `/${organizeModal.selectedDestFolderId}`}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={organizeModal.loading}
                    onClick={() => setOrganizeModal(prev => ({ ...prev, isOpen: false }))}
                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-xs border border-white/10 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={organizeModal.loading || organizeModal.loadingFolders || isDestInvalid() || isAlreadyInDest()}
                    onClick={confirmCopyOrMove}
                    className={`px-5 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      organizeModal.operation === 'move'
                        ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-indigo-500/25'
                        : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/25'
                    }`}
                  >
                    {organizeModal.loading ? (
                      <>
                        <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                        <span>{organizeModal.operation === 'move' ? 'Moving...' : 'Copying...'}</span>
                      </>
                    ) : (
                      <>
                        <i className={`fa-${organizeModal.operation === 'move' ? 'solid fa-arrows-up-down-left-right' : 'regular fa-clone'} text-xs`} />
                        <span>{organizeModal.operation === 'move' ? 'Move Here' : 'Copy Here'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Direct Download Link Modal (drive.usercontent.google.com direct link) */}
        {directLinkModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[#161822] border border-white/10 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-[#191b26]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <i className="fa-solid fa-link text-base" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>Direct Download Link</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                        Google Drive
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Direct usercontent download links for fast downloading &amp; sharing
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDirectLinkModal(prev => ({ ...prev, isOpen: false }))}
                  className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                  title="Close"
                >
                  <i className="fa-solid fa-xmark text-sm" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-5">
                {/* File summary pill */}
                {directLinkModal.file && (
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                        <i className={`fa-solid ${directLinkModal.file.isFolder ? 'fa-folder text-indigo-400' : 'fa-file text-slate-400'}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate max-w-sm" title={directLinkModal.file.name}>
                          {directLinkModal.file.name}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{formatBytes(directLinkModal.file.size)}</span>
                          <span>•</span>
                          <span className="truncate max-w-[180px]">{activeAccount?.name || 'Google Drive'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Loading State */}
                {directLinkModal.loading && (
                  <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
                    <i className="fa-solid fa-circle-notch fa-spin text-2xl text-indigo-400" />
                    <div className="text-sm font-medium text-slate-300">Retrieving Google Drive File ID...</div>
                    <div className="text-xs text-slate-500">Querying Google Drive metadata</div>
                  </div>
                )}

                {/* Error State */}
                {directLinkModal.error && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-start gap-3">
                    <i className="fa-solid fa-triangle-exclamation text-base text-red-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-semibold">Unable to resolve Google Drive direct link</div>
                      <div>{directLinkModal.error}</div>
                    </div>
                  </div>
                )}

                {/* Links Content */}
                {!directLinkModal.loading && directLinkModal.links && (
                  <div className="space-y-4">
                    {/* Primary Direct Download Link (Exact user requested format) */}
                    <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 space-y-2.5 relative">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                            Direct Download Link
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/30 text-indigo-200 font-semibold">
                            Exact Format
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">drive.usercontent.google.com</span>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        Direct download URL hosted on Google Drive Usercontent servers:
                      </p>

                      <div className="bg-black/50 border border-white/10 rounded-lg p-2.5 text-xs text-indigo-200 font-mono break-all select-all selection:bg-indigo-500 selection:text-white">
                        {directLinkModal.links.directLink}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={async () => {
                            await navigator.clipboard.writeText(directLinkModal.links!.directLink)
                            setDirectLinkModal(prev => ({ ...prev, copiedField: 'direct' }))
                            addToast('success', 'Link Copied', 'Direct download link copied to clipboard')
                            setTimeout(() => setDirectLinkModal(prev => ({ ...prev, copiedField: null })), 2000)
                          }}
                          className="flex-1 py-2 px-3 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-sm shadow-indigo-500/25"
                        >
                          {directLinkModal.copiedField === 'direct' ? (
                            <>
                              <i className="fa-solid fa-check text-emerald-300" />
                              <span className="text-emerald-300 font-semibold">Copied to Clipboard!</span>
                            </>
                          ) : (
                            <>
                              <i className="fa-regular fa-copy" />
                              <span>Copy Direct Link</span>
                            </>
                          )}
                        </button>
                        <a
                          href={directLinkModal.links.directLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2 px-4 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium text-xs flex items-center gap-2 transition-colors border border-white/10"
                        >
                          <i className="fa-solid fa-download" />
                          <span>Open / Download</span>
                        </a>
                      </div>
                    </div>

                    {/* Virus Warning Bypass Link for Large Files (>100MB) */}
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                            Direct Link (Virus Scan Bypass)
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/30 text-amber-200 font-semibold">
                            confirm=t
                          </span>
                        </div>
                        <span className="text-[11px] text-amber-400 font-medium">For files &gt; 100MB</span>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        For large files (videos, archives, ISOs), Google Drive displays a <em className="text-amber-200 not-italic">"Google Drive can't scan this file for viruses"</em> prompt. Appending <code className="bg-black/40 px-1.5 py-0.5 rounded text-amber-300 font-mono text-[11px]">&amp;confirm=t</code> automatically bypasses that prompt to begin downloading instantly:
                      </p>

                      <div className="bg-black/50 border border-white/10 rounded-lg p-2.5 text-xs text-amber-200 font-mono break-all select-all">
                        {directLinkModal.links.directLinkBypass}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={async () => {
                            await navigator.clipboard.writeText(directLinkModal.links!.directLinkBypass)
                            setDirectLinkModal(prev => ({ ...prev, copiedField: 'bypass' }))
                            addToast('success', 'Bypass Link Copied', 'Direct link with virus scan bypass copied')
                            setTimeout(() => setDirectLinkModal(prev => ({ ...prev, copiedField: null })), 2000)
                          }}
                          className="flex-1 py-2 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 font-medium text-xs flex items-center justify-center gap-2 transition-colors"
                        >
                          {directLinkModal.copiedField === 'bypass' ? (
                            <>
                              <i className="fa-solid fa-check text-emerald-300" />
                              <span className="text-emerald-300 font-semibold">Copied to Clipboard!</span>
                            </>
                          ) : (
                            <>
                              <i className="fa-regular fa-copy" />
                              <span>Copy Bypass Link</span>
                            </>
                          )}
                        </button>
                        <a
                          href={directLinkModal.links.directLinkBypass}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2 px-4 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium text-xs flex items-center gap-2 transition-colors border border-white/10"
                        >
                          <i className="fa-solid fa-bolt text-amber-400" />
                          <span>Direct Download</span>
                        </a>
                      </div>
                    </div>

                    {/* Google Drive File ID & Viewer */}
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Google Drive File ID</span>
                        <div className="flex items-center gap-2">
                          <code className="text-slate-200 font-mono bg-black/30 px-2 py-0.5 rounded border border-white/5 text-[11px] select-all">
                            {directLinkModal.links.fileId}
                          </code>
                          <button
                            type="button"
                            onClick={async () => {
                              await navigator.clipboard.writeText(directLinkModal.links!.fileId)
                              setDirectLinkModal(prev => ({ ...prev, copiedField: 'fileId' }))
                              addToast('success', 'File ID Copied', directLinkModal.links!.fileId)
                              setTimeout(() => setDirectLinkModal(prev => ({ ...prev, copiedField: null })), 2000)
                            }}
                            className="p-1 text-slate-400 hover:text-white transition-colors"
                            title="Copy File ID"
                          >
                            {directLinkModal.copiedField === 'fileId' ? (
                              <i className="fa-solid fa-check text-emerald-400 text-xs" />
                            ) : (
                              <i className="fa-regular fa-copy text-xs" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                        <span className="text-slate-400">Web Viewer Link</span>
                        <div className="flex items-center gap-2">
                          <a
                            href={directLinkModal.links.publicViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:text-indigo-300 text-xs flex items-center gap-1 font-medium"
                          >
                            <span>drive.google.com/file/...</span>
                            <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-white/10 bg-[#191b26] flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setDirectLinkModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs transition-colors border border-white/10"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transfer to My Drive Modal (Shared with me -> My Drive) */}
      <AnimatePresence>
        {transferToDriveModal.isOpen && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg bg-[#14161f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-indigo-500/10 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-lg">
                    <i className="fa-brands fa-google-drive" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Transfer to My Drive</h3>
                    <p className="text-xs text-slate-400">Copy shared items directly into your personal Google Drive</p>
                  </div>
                </div>
                <button
                  onClick={() => setTransferToDriveModal(prev => ({ ...prev, isOpen: false }))}
                  className="w-8 h-8 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                >
                  <i className="fa-solid fa-xmark text-sm" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                {/* Selected Items Summary */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Selected Item{transferToDriveModal.items.length > 1 ? 's' : ''} ({transferToDriveModal.items.length})
                  </label>
                  <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 max-h-36 overflow-y-auto space-y-2 divide-y divide-white/5">
                    {transferToDriveModal.items.map((it, idx) => (
                      <div key={idx} className={`flex items-center justify-between gap-3 text-xs ${idx > 0 ? 'pt-2' : ''}`}>
                        <div className="flex items-center gap-2.5 truncate">
                          <i className={`fa-solid ${it.isFolder ? 'fa-folder text-indigo-400' : 'fa-file text-slate-400'} text-sm shrink-0`} />
                          <span className="text-white font-medium truncate">{it.name}</span>
                        </div>
                        <span className="text-slate-400 shrink-0 font-mono text-[11px]">
                          {it.isFolder ? 'Folder' : formatBytes(it.size)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Destination in My Drive */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Destination in {activeAccount?.name || 'My Drive'}
                    </label>
                    <button
                      type="button"
                      onClick={() => setTransferToDriveModal(prev => ({ 
                        ...prev, 
                        isCreatingFolder: !prev.isCreatingFolder,
                        newFolderName: prev.isCreatingFolder ? '' : prev.newFolderName
                      }))}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 transition-all shadow-sm cursor-pointer"
                    >
                      <i className={`fa-solid ${transferToDriveModal.isCreatingFolder ? 'fa-xmark' : 'fa-folder-plus'} text-xs`} />
                      <span>{transferToDriveModal.isCreatingFolder ? 'Cancel Folder' : '+ New Folder'}</span>
                    </button>
                  </div>

                  {/* Folder Creation Form */}
                  <AnimatePresence>
                    {transferToDriveModal.isCreatingFolder && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/40 space-y-2.5 overflow-hidden"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-xs">
                              <i className="fa-solid fa-folder-plus" />
                            </div>
                            <span className="text-xs font-semibold text-white">Create New Folder</span>
                          </div>
                          <span className="text-[10px] text-indigo-300 font-mono">
                            Inside: /{transferToDriveModal.destFolderId === 'root' ? '' : transferToDriveModal.destFolderName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={transferToDriveModal.newFolderName}
                            onChange={(e) => setTransferToDriveModal(prev => ({ ...prev, newFolderName: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleCreateFolderInTransferToDrive()
                              } else if (e.key === 'Escape') {
                                setTransferToDriveModal(prev => ({ ...prev, isCreatingFolder: false, newFolderName: '' }))
                              }
                            }}
                            placeholder="Enter new folder name..."
                            disabled={transferToDriveModal.creatingFolderLoading}
                            autoFocus
                            className="flex-1 px-3 py-2 rounded-lg bg-slate-900/90 border border-indigo-500/30 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                          />
                          <button
                            type="button"
                            onClick={handleCreateFolderInTransferToDrive}
                            disabled={transferToDriveModal.creatingFolderLoading || !transferToDriveModal.newFolderName?.trim()}
                            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0 shadow-md shadow-indigo-600/30 cursor-pointer"
                          >
                            {transferToDriveModal.creatingFolderLoading ? (
                              <>
                                <i className="fa-solid fa-circle-notch fa-spin text-[10px]" />
                                <span>Creating...</span>
                              </>
                            ) : (
                              <>
                                <i className="fa-solid fa-check text-[10px]" />
                                <span>Create & Select</span>
                              </>
                            )}
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Creates this folder directly in your Google Drive and selects it as the transfer target.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setTransferToDriveModal(prev => ({ ...prev, destFolderId: 'root', destFolderName: 'My Drive (Root)' }))}
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between text-xs transition-all cursor-pointer ${
                        transferToDriveModal.destFolderId === 'root'
                          ? 'bg-indigo-600/20 border-indigo-500/50 text-white ring-1 ring-indigo-500/40'
                          : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <i className="fa-brands fa-google-drive text-indigo-400 text-sm" />
                        <span className="font-medium">My Drive (Root directory)</span>
                      </div>
                      {transferToDriveModal.destFolderId === 'root' && (
                        <i className="fa-solid fa-check text-indigo-400 text-xs" />
                      )}
                    </button>

                    {/* Subfolders in My Drive */}
                    {transferToDriveModal.loadingFolders ? (
                      <div className="py-3 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                        <i className="fa-solid fa-spinner fa-spin text-xs text-indigo-400" />
                        <span>Loading folders in My Drive...</span>
                      </div>
                    ) : transferToDriveModal.folders.length > 0 ? (
                      <div className="space-y-2 pl-2 border-l border-white/10">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[11px] text-slate-400 font-medium">Or select existing folder:</span>
                          <span className="text-[10px] text-slate-500">{transferToDriveModal.folders.length} folder{transferToDriveModal.folders.length > 1 ? 's' : ''}</span>
                        </div>

                        {/* Folder filter search if more than 3 folders */}
                        {transferToDriveModal.folders.length > 3 && (
                          <div className="relative">
                            <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-[10px]" />
                            <input
                              type="text"
                              value={transferToDriveModal.folderSearch}
                              onChange={(e) => setTransferToDriveModal(prev => ({ ...prev, folderSearch: e.target.value }))}
                              placeholder="Filter folders..."
                              className="w-full pl-7 pr-2.5 py-1.5 rounded-lg bg-slate-900/70 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        )}

                        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                          {transferToDriveModal.folders
                            .filter(f => !transferToDriveModal.folderSearch || f.name.toLowerCase().includes(transferToDriveModal.folderSearch.toLowerCase()))
                            .map(f => (
                              <button
                                key={f.id || f.path}
                                type="button"
                                onClick={() => setTransferToDriveModal(prev => ({ 
                                  ...prev, 
                                  destFolderId: f.path || f.name, 
                                  destFolderName: f.name 
                                }))}
                                className={`w-full px-3 py-2 rounded-lg border text-left flex items-center justify-between text-xs transition-colors cursor-pointer ${
                                  transferToDriveModal.destFolderId === (f.path || f.name)
                                    ? 'bg-indigo-600/20 border-indigo-500/50 text-white ring-1 ring-indigo-500/40'
                                    : 'bg-white/[0.02] border-white/5 text-slate-300 hover:bg-white/[0.05]'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <i className="fa-solid fa-folder text-amber-400 text-xs shrink-0" />
                                  <span className="truncate">{f.name}</span>
                                </div>
                                {transferToDriveModal.destFolderId === (f.path || f.name) && (
                                  <i className="fa-solid fa-check text-indigo-400 text-xs shrink-0" />
                                )}
                              </button>
                            ))}
                        </div>
                      </div>
                    ) : null}

                    {/* Optional custom nested subfolder path */}
                    <div className="pt-2 border-t border-white/5">
                      <label className="text-[11px] text-slate-400 block mb-1">
                        Optional: Specify nested subfolder (will be created if it doesn't exist)
                      </label>
                      <div className="relative">
                        <i className="fa-solid fa-folder-tree absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs" />
                        <input
                          type="text"
                          value={transferToDriveModal.customSubfolder}
                          onChange={(e) => setTransferToDriveModal(prev => ({ ...prev, customSubfolder: e.target.value }))}
                          placeholder="e.g. Received/2026 or SharedBackups (optional)"
                          className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-900/60 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Destination Preview Card */}
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <i className="fa-solid fa-location-dot text-indigo-400 shrink-0" />
                        <span className="text-slate-300 truncate">
                          Target: <strong className="text-white">/{transferToDriveModal.destFolderId === 'root' ? '' : transferToDriveModal.destFolderName}{transferToDriveModal.customSubfolder ? `/${transferToDriveModal.customSubfolder.replace(/^\/+/, '')}` : ''}</strong>
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300 font-semibold uppercase tracking-wider shrink-0">
                        Target Ready
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 flex items-start gap-2.5 text-xs text-indigo-200">
                  <i className="fa-solid fa-circle-info text-indigo-400 mt-0.5 shrink-0" />
                  <span>Transfers run directly on the cloud server. Copies are placed into your chosen My Drive location without using your local device storage.</span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setTransferToDriveModal(prev => ({ ...prev, isOpen: false }))}
                  disabled={transferToDriveModal.loading}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleTransferToMyDrive(
                    transferToDriveModal.items, 
                    transferToDriveModal.destFolderId === 'root' ? '' : transferToDriveModal.destFolderId,
                    transferToDriveModal.customSubfolder
                  )}
                  disabled={transferToDriveModal.loading}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {transferToDriveModal.loading ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                      <span>Starting Transfer...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-brands fa-google-drive text-xs" />
                      <span>Transfer into My Drive</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Media Player / File Preview Modal */}
      <AnimatePresence>
        {mediaPlayerModal.isOpen && mediaPlayerModal.file && (
          <div 
            className="fixed inset-0 z-[230] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md"
            onClick={() => setMediaPlayerModal({ isOpen: false, file: null, streamUrl: '', loading: false })}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl bg-[#11131a] border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ring-1 ring-black/50"
            >
              {/* Player Header */}
              <div className="px-5 py-3.5 border-b border-white/10 bg-[#161922] flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-base shrink-0">
                    <i className={`fa-solid ${
                      isVideoOrAudio(mediaPlayerModal.file) 
                        ? (mediaPlayerModal.file.name.match(/\.(mp3|wav|ogg|flac|aac|m4a|wma)$/i) ? 'fa-music' : 'fa-video') 
                        : (isImageFile(mediaPlayerModal.file) ? 'fa-image' : 'fa-play')
                    }`} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate" title={mediaPlayerModal.file.name}>
                      {mediaPlayerModal.file.name}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span>{formatBytes(mediaPlayerModal.file.size)}</span>
                      <span>•</span>
                      <span className="text-emerald-400 font-medium">Cloud Stream Ready</span>
                      {mediaPlayerModal.loading && (
                        <>
                          <span>•</span>
                          <span className="text-amber-400 font-medium flex items-center gap-1">
                            <i className="fa-solid fa-circle-notch fa-spin text-[9px]" />
                            <span>Buffering...</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleDownload(mediaPlayerModal.file!)}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white border border-white/10 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Download original file"
                  >
                    <i className="fa-solid fa-download text-xs" />
                    <span className="hidden sm:inline">Download</span>
                  </button>

                  <a
                    href={mediaPlayerModal.streamUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs transition-colors"
                    title="Open stream in dedicated tab"
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square text-xs" />
                  </a>

                  <button
                    onClick={() => setMediaPlayerModal({ isOpen: false, file: null, streamUrl: '', loading: false })}
                    className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer ml-1"
                    title="Close player"
                  >
                    <i className="fa-solid fa-xmark text-sm" />
                  </button>
                </div>
              </div>

              {/* Player Body */}
              <div className="flex-1 bg-black flex items-center justify-center relative min-h-[300px] overflow-hidden">
                {/* Buffering Indicator */}
                {mediaPlayerModal.loading && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-sm pointer-events-none">
                    <i className="fa-solid fa-circle-notch fa-spin text-4xl text-emerald-400" />
                    <div className="text-center">
                      <p className="text-xs font-semibold text-white">Buffering Media Stream...</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Streaming directly from Google Drive</p>
                    </div>
                  </div>
                )}

                {/* Media Renderer */}
                {isVideoOrAudio(mediaPlayerModal.file) ? (
                  mediaPlayerModal.file.name.match(/\.(mp3|wav|ogg|flac|aac|m4a|wma)$/i) ? (
                    <div className="w-full p-8 flex flex-col items-center justify-center gap-6">
                      <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-indigo-500/20 border border-emerald-500/30 flex items-center justify-center shadow-2xl">
                        <i className="fa-solid fa-music text-5xl text-emerald-400 animate-pulse" />
                      </div>
                      <audio 
                        src={mediaPlayerModal.streamUrl}
                        controls 
                        autoPlay 
                        className="w-full max-w-md outline-none"
                        onWaiting={() => setMediaPlayerModal(prev => ({ ...prev, loading: true }))}
                        onCanPlay={() => setMediaPlayerModal(prev => ({ ...prev, loading: false }))}
                        onPlaying={() => setMediaPlayerModal(prev => ({ ...prev, loading: false }))}
                      />
                    </div>
                  ) : (
                    <video
                      src={mediaPlayerModal.streamUrl}
                      controls
                      autoPlay
                      playsInline
                      className="w-full max-h-[68vh] bg-black object-contain outline-none"
                      onWaiting={() => setMediaPlayerModal(prev => ({ ...prev, loading: true }))}
                      onCanPlay={() => setMediaPlayerModal(prev => ({ ...prev, loading: false }))}
                      onPlaying={() => setMediaPlayerModal(prev => ({ ...prev, loading: false }))}
                      onError={() => {
                        setMediaPlayerModal(prev => ({ ...prev, loading: false }))
                        addToast('warning', 'Direct Stream Note', 'If playback does not start automatically, you can download or open in a new tab.')
                      }}
                    />
                  )
                ) : isImageFile(mediaPlayerModal.file) ? (
                  <img
                    src={mediaPlayerModal.streamUrl}
                    alt={mediaPlayerModal.file.name}
                    className="max-w-full max-h-[72vh] object-contain select-none"
                    onLoad={() => setMediaPlayerModal(prev => ({ ...prev, loading: false }))}
                  />
                ) : (
                  <div className="p-8 text-center text-slate-400">
                    <i className="fa-solid fa-file text-5xl mb-3 text-slate-600" />
                    <p className="text-sm font-semibold text-white">Preview not available for this file type</p>
                    <p className="text-xs text-slate-500 mt-1">Please download the file to view its contents.</p>
                  </div>
                )}
              </div>

              {/* Player Footer Bar */}
              <div className="px-5 py-2.5 bg-[#14161f] border-t border-white/10 flex items-center justify-between text-xs text-slate-400 shrink-0">
                <span className="flex items-center gap-1.5 text-[11px]">
                  <i className="fa-solid fa-bolt text-amber-400 text-[10px]" />
                  <span>High-speed byte-range seeking supported</span>
                </span>
                <span className="text-[11px] text-slate-500">
                  Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-mono text-[10px]">Esc</kbd> to close
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
