// Types for the Gridly application

export interface DriveAccount {
  id: string
  name: string
  email: string
  accessToken: string
  refreshToken: string
  tokenExpiry: number
  avatar: string
  usedBytes: number
  totalBytes: number
  fileCount: number
  folderCount: number
  rcloneRemote: string
  status: 'connected' | 'syncing' | 'error' | 'disconnected'
  addedAt: number
  lastSynced: number | null
}

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  size: number
  modifiedTime: string
  parents: string[]
  isFolder: boolean
  icon: string
  path: string
  sharedWithMe?: boolean
  sharedBy?: string
}

export interface TransferJob {
  id: string
  jobid?: number // The rclone async job ID
  sourceAccountId: string
  destAccountId: string
  sourcePath: string
  destPath: string
  operation: 'copy' | 'move' | 'sync'
  flags: string[]
  status: 'queued' | 'running' | 'paused' | 'completed' | 'error' | 'cancelled'
  progress: number
  totalFiles: number
  transferredFiles: number
  totalBytes: number
  transferredBytes: number
  speed: number // bytes per second
  eta: number // seconds
  startedAt: number | null
  completedAt: number | null
  error: string | null
  rcloneCommand: string
  logs: TransferLog[]
  transferMode?: 'with_folder' | 'contents_only' | 'file'
  sourceType?: 'folder' | 'file' | 'root'
  isSharedSource?: boolean
  sourceFileId?: string
  parentSharedFolderId?: string
}

export interface TransferLog {
  timestamp: number
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
}

export interface RcloneConfig {
  bufferSize: string
  checkers: number
  transfers: number
  logLevel: 'DEBUG' | 'INFO' | 'NOTICE' | 'ERROR'
  logFile: string
  bwLimit: string
  retries: number
  retriesSleep: string
  lowLevelRetries: number
  timeout: string
  contimeout: string
  driveServerSide: boolean
  driveUseTrash: boolean
  driveStopOnUploadLimit: boolean
}

export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message: string
  duration: number
  action?: {
    label: string
    onClick: () => void
  }
}

export type ViewMode = 'home' | 'dashboard' | 'shared' | 'transfers' | 'settings' | 'browser'

export interface DriveClipboard {
  operation: 'copy' | 'move'
  sourceAccountId: string
  sourceAccountName: string
  items: {
    id: string
    path: string
    name: string
    isFolder: boolean
    size?: number
  }[]
  copiedAt: number
}
