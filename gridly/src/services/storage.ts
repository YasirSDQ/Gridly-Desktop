// LocalStorage persistence service
import type { DriveAccount, TransferJob, RcloneConfig, DriveClipboard } from '../types'

const KEYS = {
  ACCOUNTS: 'gridly_accounts',
  TRANSFERS: 'gridly_transfers',
  RCLONE_CONFIG: 'gridly_rclone_config',
  AUTH_STATE: 'gridly_auth_state',
  SETTINGS: 'gridly_settings',
  CLIPBOARD: 'gridly_clipboard',
}

export const storage = {
  // Accounts
  getAccounts(): DriveAccount[] {
    try {
      const data = localStorage.getItem(KEYS.ACCOUNTS)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  },

  saveAccounts(accounts: DriveAccount[]): void {
    localStorage.setItem(KEYS.ACCOUNTS, JSON.stringify(accounts))
  },

  addAccount(account: DriveAccount): void {
    const accounts = this.getAccounts()
    accounts.push(account)
    this.saveAccounts(accounts)
  },

  removeAccount(id: string): void {
    const accounts = this.getAccounts().filter(a => a.id !== id)
    this.saveAccounts(accounts)
  },

  updateAccount(id: string, updates: Partial<DriveAccount>): void {
    const accounts = this.getAccounts().map(a =>
      a.id === id ? { ...a, ...updates } : a
    )
    this.saveAccounts(accounts)
  },

  // Transfers
  getTransfers(): TransferJob[] {
    try {
      const data = localStorage.getItem(KEYS.TRANSFERS)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  },

  saveTransfers(transfers: TransferJob[]): void {
    localStorage.setItem(KEYS.TRANSFERS, JSON.stringify(transfers))
  },

  addTransfer(transfer: TransferJob): void {
    const transfers = this.getTransfers()
    transfers.unshift(transfer)
    this.saveTransfers(transfers)
  },

  updateTransfer(id: string, updates: Partial<TransferJob>): void {
    const transfers = this.getTransfers().map(t =>
      t.id === id ? { ...t, ...updates } : t
    )
    this.saveTransfers(transfers)
  },

  removeTransfer(id: string): void {
    const transfers = this.getTransfers().filter(t => t.id !== id)
    this.saveTransfers(transfers)
  },

  // Rclone Config
  getRcloneConfig(): RcloneConfig {
    try {
      const data = localStorage.getItem(KEYS.RCLONE_CONFIG)
      return data ? JSON.parse(data) : getDefaultRcloneConfig()
    } catch {
      return getDefaultRcloneConfig()
    }
  },

  saveRcloneConfig(config: RcloneConfig): void {
    localStorage.setItem(KEYS.RCLONE_CONFIG, JSON.stringify(config))
  },

  // Auth State
  getAuthState(): { isAuthenticated: boolean; lastLogin: number | null } {
    try {
      const data = localStorage.getItem(KEYS.AUTH_STATE)
      return data ? JSON.parse(data) : { isAuthenticated: false, lastLogin: null }
    } catch {
      return { isAuthenticated: false, lastLogin: null }
    }
  },

  saveAuthState(state: { isAuthenticated: boolean; lastLogin: number | null }): void {
    localStorage.setItem(KEYS.AUTH_STATE, JSON.stringify(state))
  },

  // Clipboard (Ctrl+C, Ctrl+X, Ctrl+V)
  getClipboard(): DriveClipboard | null {
    try {
      const data = sessionStorage.getItem(KEYS.CLIPBOARD) || localStorage.getItem(KEYS.CLIPBOARD)
      return data ? JSON.parse(data) : null
    } catch {
      return null
    }
  },

  setClipboard(clipboard: DriveClipboard | null): void {
    if (clipboard) {
      sessionStorage.setItem(KEYS.CLIPBOARD, JSON.stringify(clipboard))
      localStorage.setItem(KEYS.CLIPBOARD, JSON.stringify(clipboard))
    } else {
      sessionStorage.removeItem(KEYS.CLIPBOARD)
      localStorage.removeItem(KEYS.CLIPBOARD)
    }
  },

  // Clear all
  clearAll(): void {
    Object.values(KEYS).forEach(key => localStorage.removeItem(key))
  },
}

export function getDefaultRcloneConfig(): RcloneConfig {
  return {
    bufferSize: '16M',
    checkers: 8,
    transfers: 4,
    logLevel: 'INFO',
    logFile: '',
    bwLimit: '0',
    retries: 3,
    retriesSleep: '10s',
    lowLevelRetries: 10,
    timeout: '5m',
    contimeout: '1m',
    driveServerSide: true,
    driveUseTrash: true,
    driveStopOnUploadLimit: false,
  }
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}
