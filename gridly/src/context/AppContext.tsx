import { createContext, useContext, useReducer, useEffect, useRef, type ReactNode } from 'react'
import type { DriveAccount, TransferJob, RcloneConfig, ToastMessage, ViewMode } from '../types'
import { storage, getDefaultRcloneConfig } from '../services/storage'
import { initializeTransfers, formatBytes } from '../services/rclone'

interface AppState {
  accounts: DriveAccount[]
  transfers: TransferJob[]
  rcloneConfig: RcloneConfig
  toasts: ToastMessage[]
  currentView: ViewMode
  isLoading: boolean
  selectedAccountId: string | null
  authModalOpen: boolean
  transferModalOpen: boolean
  transferConfig?: {
    sourceAccountId?: string;
    sourcePath?: string;
    destAccountId?: string;
    destPath?: string;
    sourceType?: 'folder' | 'file' | 'root';
    isSharedWithMe?: boolean;
    sharedItem?: any;
    parentSharedFolderId?: string;
    sourceFileId?: string;
  }
  browserAccountId: string | null
  browserPath: string
  searchQuery: string
}

type Action =
  | { type: 'SET_ACCOUNTS'; payload: DriveAccount[] }
  | { type: 'ADD_ACCOUNT'; payload: DriveAccount }
  | { type: 'REMOVE_ACCOUNT'; payload: string }
  | { type: 'UPDATE_ACCOUNT'; payload: { id: string; updates: Partial<DriveAccount> } }
  | { type: 'SET_TRANSFERS'; payload: TransferJob[] }
  | { type: 'ADD_TRANSFER'; payload: TransferJob }
  | { type: 'UPDATE_TRANSFER'; payload: { id: string; updates: Partial<TransferJob> } }
  | { type: 'SET_RCLONE_CONFIG'; payload: RcloneConfig }
  | { type: 'ADD_TOAST'; payload: ToastMessage }
  | { type: 'REMOVE_TOAST'; payload: string }
  | { type: 'SET_VIEW'; payload: ViewMode }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SELECTED_ACCOUNT'; payload: string | null }
  | { type: 'SET_AUTH_MODAL'; payload: boolean }
  | { type: 'SET_TRANSFER_MODAL'; payload: boolean | { sourceAccountId?: string; sourcePath?: string; destAccountId?: string; destPath?: string; sourceType?: 'folder' | 'file' | 'root'; isSharedWithMe?: boolean; sharedItem?: any; parentSharedFolderId?: string; sourceFileId?: string } }
  | { type: 'SET_BROWSER'; payload: { accountId: string | null; path: string } }
  | { type: 'SET_SEARCH_QUERY'; payload: string }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_ACCOUNTS':
      return { ...state, accounts: action.payload }
    case 'ADD_ACCOUNT':
      return { ...state, accounts: [...state.accounts, action.payload] }
    case 'REMOVE_ACCOUNT':
      return { ...state, accounts: state.accounts.filter(a => a.id !== action.payload) }
    case 'UPDATE_ACCOUNT':
      return {
        ...state,
        accounts: state.accounts.map(a =>
          a.id === action.payload.id ? { ...a, ...action.payload.updates } : a
        ),
      }
    case 'SET_TRANSFERS':
      return { ...state, transfers: action.payload }
    case 'ADD_TRANSFER':
      return { ...state, transfers: [action.payload, ...state.transfers] }
    case 'UPDATE_TRANSFER':
      return {
        ...state,
        transfers: state.transfers.map(t =>
          t.id === action.payload.id ? { ...t, ...action.payload.updates } : t
        ),
      }
    case 'SET_RCLONE_CONFIG':
      return { ...state, rcloneConfig: action.payload }
    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.payload] }
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) }
    case 'SET_VIEW':
      return { ...state, currentView: action.payload }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'SET_SELECTED_ACCOUNT':
      return { ...state, selectedAccountId: action.payload }
    case 'SET_AUTH_MODAL':
      return { ...state, authModalOpen: action.payload }
    case 'SET_TRANSFER_MODAL':
      if (typeof action.payload === 'boolean') {
        return { ...state, transferModalOpen: action.payload, transferConfig: action.payload ? state.transferConfig : undefined }
      } else {
        return { ...state, transferModalOpen: true, transferConfig: action.payload }
      }
    case 'SET_BROWSER':
      return { ...state, browserAccountId: action.payload.accountId, browserPath: action.payload.path }
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload }
    default:
      return state
  }
}

const initialState: AppState = {
  accounts: [],
  transfers: [],
  rcloneConfig: getDefaultRcloneConfig(),
  toasts: [],
  currentView: 'home',
  isLoading: false,
  selectedAccountId: null,
  authModalOpen: false,
  transferModalOpen: false,
  browserAccountId: null,
  browserPath: '/',
  searchQuery: '',
}

interface AppContextType {
  state: AppState
  dispatch: React.Dispatch<Action>
  addToast: (type: ToastMessage['type'], title: string, message: string, action?: ToastMessage['action']) => void
  setView: (view: ViewMode) => void
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  // Load initial data from localStorage
  useEffect(() => {
    initializeTransfers()
    
    const accounts = storage.getAccounts()
    const transfers = storage.getTransfers()
    const config = storage.getRcloneConfig()

    dispatch({ type: 'SET_ACCOUNTS', payload: accounts })
    dispatch({ type: 'SET_TRANSFERS', payload: transfers })
    dispatch({ type: 'SET_RCLONE_CONFIG', payload: config })
  }, [])

  const prevTransfersRef = useRef<Map<string, { status: string; sourcePath: string; transferredBytes: number }>>(new Map())
  const isInitialTransferLoadRef = useRef(true)

  // Poll transfers from localStorage every second to keep UI in sync with background tasks
  useEffect(() => {
    const interval = setInterval(() => {
      const latestTransfers = storage.getTransfers()

      // If initial load, prime the ref with existing transfers without spamming notifications
      if (isInitialTransferLoadRef.current) {
        latestTransfers.forEach(t => {
          prevTransfersRef.current.set(t.id, {
            status: t.status,
            sourcePath: t.sourcePath,
            transferredBytes: t.transferredBytes || 0
          })
        })
        isInitialTransferLoadRef.current = false
      } else {
        // Detect transitions for background toast notifications
        latestTransfers.forEach(t => {
          const prev = prevTransfersRef.current.get(t.id)
          if (prev) {
            const wasActive = prev.status === 'running' || prev.status === 'queued'
            if (wasActive && t.status === 'completed') {
              const fileName = t.sourcePath?.split('/').pop()?.replace(/^shared:/, '') || 'File transfer'
              addToast(
                'success',
                'Transfer Completed! 🎉',
                `"${fileName}" has completed successfully (${formatBytes(t.transferredBytes || t.totalBytes || 0)} transferred).`,
                {
                  label: 'View in Transfers',
                  onClick: () => dispatch({ type: 'SET_VIEW', payload: 'transfers' })
                }
              )
            } else if (wasActive && t.status === 'error') {
              const fileName = t.sourcePath?.split('/').pop()?.replace(/^shared:/, '') || 'File transfer'
              addToast(
                'error',
                'Transfer Failed ❌',
                `"${fileName}" encountered an error: ${t.error || 'Transfer was interrupted or failed'}.`,
                {
                  label: 'View Details',
                  onClick: () => dispatch({ type: 'SET_VIEW', payload: 'transfers' })
                }
              )
            }
          }
          // Update ref
          prevTransfersRef.current.set(t.id, {
            status: t.status,
            sourcePath: t.sourcePath,
            transferredBytes: t.transferredBytes || 0
          })
        })
      }

      // Only update if stringified versions differ to avoid infinite re-renders
      if (JSON.stringify(latestTransfers) !== JSON.stringify(state.transfers)) {
        dispatch({ type: 'SET_TRANSFERS', payload: latestTransfers })
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [state.transfers])

  // Sync accounts to localStorage
  useEffect(() => {
    storage.saveAccounts(state.accounts)
  }, [state.accounts])

  // Auto-remove toasts
  useEffect(() => {
    state.toasts.forEach(toast => {
      const timer = setTimeout(() => {
        dispatch({ type: 'REMOVE_TOAST', payload: toast.id })
      }, toast.duration)
      return () => clearTimeout(timer)
    })
  }, [state.toasts])

  const addToast = (type: ToastMessage['type'], title: string, message: string, action?: ToastMessage['action']) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    dispatch({
      type: 'ADD_TOAST',
      payload: { id, type, title, message, duration: 6000, action },
    })
  }

  const setView = (view: ViewMode) => {
    dispatch({ type: 'SET_VIEW', payload: view })
  }

  return (
    <AppContext.Provider value={{ state, dispatch, addToast, setView }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within AppProvider')
  return context
}
