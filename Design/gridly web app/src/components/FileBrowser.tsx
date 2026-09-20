import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { browseFiles, formatBytes } from '../services/rclone'
import type { DriveFile } from '../types'

export default function FileBrowser() {
  const { state, dispatch, addToast } = useApp()
  const [files, setFiles] = useState<DriveFile[]>([])
  const [path, setPath] = useState<{ id: string; name: string }[]>([{ id: 'root', name: 'My Drive' }])
  const [loading, setLoading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'date'>('name')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')

  const account = state.accounts.find(a => a.id === state.browserAccountId)

  useEffect(() => {
    if (state.browserAccountId) {
      loadFiles(state.browserPath || 'root')
    }
  }, [state.browserAccountId, state.browserPath])

  const loadFiles = async (folderId: string = 'root') => {
    if (!account) return
    setLoading(true)
    try {
      const result = await browseFiles(account, folderId)
      setFiles(result.files)
      setPath(result.path)
    } catch {
      addToast('error', 'Browse Failed', 'Could not load files from this account')
    } finally {
      setLoading(false)
    }
  }

  const navigateToFolder = (folderPath: string, folderName?: string) => {
    const displayPath = folderPath === '' || folderPath === 'root'
      ? [{ id: 'root', name: account?.name || 'My Drive' }]
      : [...path, { id: folderPath, name: folderName || folderPath }]
    setPath(displayPath)
    dispatch({ type: 'SET_BROWSER', payload: { accountId: state.browserAccountId, path: folderPath } })
    setSelectedFiles(new Set())
    loadFiles(folderPath)
  }

  const navigateToPathIndex = (index: number) => {
    const targetPath = path.slice(0, index + 1)
    setPath(targetPath)
    const folderId = targetPath[targetPath.length - 1].id
    dispatch({ type: 'SET_BROWSER', payload: { accountId: state.browserAccountId, path: folderId } })
    setSelectedFiles(new Set())
    loadFiles(folderId)
  }

  const goUp = () => {
    if (path.length <= 1) return
    navigateToPathIndex(path.length - 2)
  }

  const toggleFileSelection = (fileId: string) => {
    const newSelection = new Set(selectedFiles)
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId)
    } else {
      newSelection.add(fileId)
    }
    setSelectedFiles(newSelection)
  }

  const selectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(files.map(f => f.id)))
    }
  }

  const handleTransferSelected = () => {
    if (!account) return
    if (selectedFiles.size === 0) {
      addToast('warning', 'No Selection', 'Please select files or folders to transfer')
      return
    }
    const firstSelectedId = Array.from(selectedFiles)[0]
    const item = files.find(f => f.id === firstSelectedId)
    const currentFolder = state.browserPath || 'root'
    const itemPath = item ? (currentFolder === '/' || currentFolder === 'root' ? item.name : `${currentFolder.replace(/^\/+/, '')}/${item.name}`) : currentFolder
    const isShared = Boolean(item?.sharedWithMe || (state as any).browserSection === 'shared-with-me' || currentFolder.startsWith('shared:'))
    
    dispatch({ 
      type: 'SET_TRANSFER_MODAL', 
      payload: {
        sourceAccountId: account.id,
        sourcePath: isShared ? `shared:${item?.name || itemPath}` : (item?.path || itemPath),
        sourceType: item?.isFolder ? 'folder' : 'file',
        isSharedWithMe: isShared,
        sharedItem: item,
        sourceFileId: item?.id,
        parentSharedFolderId: currentFolder === 'root' || currentFolder === '/' || currentFolder === 'shared-root' ? undefined : currentFolder
      } 
    })
  }

  const sortedFiles = [...files].sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1
    if (!a.isFolder && b.isFolder) return 1

    switch (sortBy) {
      case 'name': return a.name.localeCompare(b.name)
      case 'size': return b.size - a.size
      case 'date': return new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()
      default: return 0
    }
  })

  if (!state.browserAccountId || !account) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => dispatch({ type: 'SET_BROWSER', payload: { accountId: null, path: '/' } })} />

      <div className="relative w-full max-w-5xl max-h-[85vh] glass-card rounded-2xl flex flex-col border border-indigo-500/20 animate-slide-up">
        {/* Header */}
        <div className="p-4 border-b border-slate-700/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <i className="fa-brands fa-google-drive text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{account.name}</h3>
              <p className="text-xs text-slate-400">{account.email}</p>
            </div>
          </div>
          <button
            onClick={() => dispatch({ type: 'SET_BROWSER', payload: { accountId: null, path: '/' } })}
            className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
          >
            <i className="fa-solid fa-xmark text-lg" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-3 border-b border-slate-700/30 flex items-center justify-between gap-3 flex-wrap">
          {/* Navigation */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={goUp}
              disabled={path.length <= 1}
              className="px-3 py-1.5 rounded-lg bg-slate-800/50 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
            >
              <i className="fa-solid fa-arrow-up" />
            </button>
            <button
              onClick={() => navigateToFolder('root')}
              className="px-3 py-1.5 rounded-lg bg-slate-800/50 text-slate-400 hover:text-white transition-colors text-sm"
            >
              <i className="fa-solid fa-house" />
            </button>
            {/* Breadcrumb */}
            <div className="flex items-center gap-1 text-sm">
              {path.map((p, i) => (
                <span key={p.id} className="flex items-center gap-1">
                  {i > 0 && <i className="fa-solid fa-chevron-right text-slate-600 text-xs" />}
                  <button
                    onClick={() => navigateToPathIndex(i)}
                    className={`px-2 py-1 rounded transition-colors ${
                      i === path.length - 1
                        ? 'bg-indigo-500/20 text-indigo-300 font-medium'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {p.name}
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button onClick={selectAll} className="px-3 py-1.5 rounded-lg bg-slate-800/50 text-slate-400 hover:text-white transition-colors text-xs">
              {selectedFiles.size === files.length ? 'Deselect All' : 'Select All'}
            </button>
            <div className="flex rounded-lg overflow-hidden border border-slate-700/50">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 text-xs ${viewMode === 'list' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800/50 text-slate-400'} transition-colors`}
              >
                <i className="fa-solid fa-list" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 text-xs ${viewMode === 'grid' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800/50 text-slate-400'} transition-colors`}
              >
                <i className="fa-solid fa-grip" />
              </button>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'size' | 'date')}
              className="px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 text-xs focus:outline-none"
            >
              <option value="name">Sort: Name</option>
              <option value="size">Sort: Size</option>
              <option value="date">Sort: Date</option>
            </select>
            {selectedFiles.size > 0 && (
              <button
                onClick={handleTransferSelected}
                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-medium flex items-center gap-1.5"
              >
                <i className="fa-solid fa-right-left" />
                Transfer ({selectedFiles.size})
              </button>
            )}
          </div>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <i className="fa-solid fa-spinner fa-spin text-indigo-400 text-3xl mb-3" />
                <p className="text-sm text-slate-400">Loading files from Google Drive...</p>
              </div>
            </div>
          ) : viewMode === 'list' ? (
            <div className="space-y-1">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs text-slate-500 uppercase tracking-wider">
                <div className="col-span-1"></div>
                <div className="col-span-5">Name</div>
                <div className="col-span-2">Size</div>
                <div className="col-span-3">Modified</div>
                <div className="col-span-1">Type</div>
              </div>

              {sortedFiles.map((file) => (
                <div
                  key={file.id}
                  className={`grid grid-cols-12 gap-2 px-3 py-2.5 rounded-lg items-center cursor-pointer transition-all ${
                    selectedFiles.has(file.id)
                      ? 'bg-indigo-500/10 border border-indigo-500/20'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                  onClick={() => file.isFolder ? navigateToFolder(file.path, file.name) : toggleFileSelection(file.id)}
                >
                  <div className="col-span-1">
                    <input
                      type="checkbox"
                      checked={selectedFiles.has(file.id)}
                      onChange={() => toggleFileSelection(file.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div className="col-span-5 flex items-center gap-2">
                    <i className={`fa-solid ${file.icon} ${file.isFolder ? 'text-indigo-400' : 'text-slate-400'}`} />
                    <span className="text-sm text-white truncate">{file.name}</span>
                  </div>
                  <div className="col-span-2 text-xs text-slate-400">
                    {file.isFolder ? '—' : formatBytes(file.size)}
                  </div>
                  <div className="col-span-3 text-xs text-slate-500">
                    {new Date(file.modifiedTime).toLocaleDateString()}
                  </div>
                  <div className="col-span-1">
                    {file.isFolder ? (
                      <span className="text-xs text-indigo-400">Folder</span>
                    ) : (
                      <span className="text-xs text-slate-500">File</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {sortedFiles.map((file) => (
                <div
                  key={file.id}
                  className={`p-3 rounded-xl text-center cursor-pointer transition-all ${
                    selectedFiles.has(file.id)
                      ? 'bg-indigo-500/10 border border-indigo-500/20'
                      : 'bg-slate-800/30 border border-transparent hover:border-slate-700/50'
                  }`}
                  onClick={() => file.isFolder ? navigateToFolder(file.path, file.name) : toggleFileSelection(file.id)}
                >
                  <div className={`w-12 h-12 mx-auto mb-2 rounded-lg flex items-center justify-center ${
                    file.isFolder ? 'bg-indigo-500/20' : 'bg-slate-700/30'
                  }`}>
                    <i className={`fa-solid ${file.icon} text-xl ${file.isFolder ? 'text-indigo-400' : 'text-slate-400'}`} />
                  </div>
                  <p className="text-xs text-white truncate">{file.name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {file.isFolder ? 'Folder' : formatBytes(file.size)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {!loading && files.length === 0 && (
            <div className="text-center py-20">
              <i className="fa-solid fa-folder-open text-slate-600 text-4xl mb-3" />
              <p className="text-sm text-slate-400">This folder is empty</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-700/30 flex items-center justify-between text-xs text-slate-500">
          <span>{files.length} items • {files.filter(f => f.isFolder).length} folders, {files.filter(f => !f.isFolder).length} files</span>
          <span>{selectedFiles.size} selected</span>
        </div>
      </div>
    </div>
  )
}
