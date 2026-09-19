// rclone Remote Control (RC) API client
// Connects to a running rclone daemon via `rclone rcd`

export interface RcloneRCConfig {
  url: string           // e.g., http://localhost:5572
  username?: string
  password?: string
}

// Get current RC config from localStorage
export function getRCConfig(): RcloneRCConfig {
  return {
    url: '/api/rc',
    username: '',
    password: '',
  }
}

export function saveRCConfig(config: RcloneRCConfig): void {
  // no-op, managed by backend now
}

// Cache rclone running status for 30s to avoid redundant network pings
let cachedRunning: { val: boolean; time: number } | null = null

// Check if rclone RC is configured and reachable
export function isRCConfigured(): boolean {
  return true
}

// Make RC API call
export async function rcCall<T = any>(
  endpoint: string,
  params: Record<string, any> = {},
  configOverride?: RcloneRCConfig,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const baseUrl = typeof window !== 'undefined' ? '' : 'http://localhost:3000'
  const url = `${baseUrl}/api/rc/${endpoint}`
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    let errorMessage = `rclone RC error: ${response.status} ${response.statusText}`
    try {
      const errorData = await response.json()
      if (errorData.error) errorMessage = errorData.error
      if (errorData.path) errorMessage += ` (path: ${errorData.path})`
    } catch {}
    throw new Error(errorMessage)
  }

  // Some endpoints return empty responses
  const text = await response.text()
  if (!text) return {} as T
  return JSON.parse(text) as T
}

export async function isRcloneRunning(): Promise<boolean> {
  const now = Date.now()
  if (cachedRunning && now - cachedRunning.time < 30000) {
    return cachedRunning.val
  }
  try {
    await rcCall('core/version')
    cachedRunning = { val: true, time: now }
    return true
  } catch {
    cachedRunning = { val: false, time: now }
    return false
  }
}

// ============== Core Endpoints ==============

export async function getVersion(): Promise<{ version: string; decomposed: number[]; isGit: boolean; isBeta: boolean; os: string; arch: string }> {
  return rcCall('core/version')
}

export async function getStats(): Promise<{
  bytes: number
  errors: number
  fatalError: number
  retryError: number
  checks: number
  transferredFiles: number
  speed: number
  eta: number
  transferring?: Array<{
    name: string
    size: number
    bytes: number
    eta: number
    speed: number
    group: string
  }>
  checking?: string[]
}> {
  return rcCall('core/stats')
}

export async function resetStats(): Promise<void> {
  await rcCall('core/stats-reset')
}

export async function getPID(): Promise<{ pid: number }> {
  return rcCall('core/pid')
}

export async function getMemoryStats(): Promise<any> {
  return rcCall('core/memstats')
}

export async function quit(): Promise<void> {
  await rcCall('core/quit')
}

// ============== Config Endpoints ==============

export async function listRemotes(): Promise<{ remotes: string[] }> {
  return rcCall('config/listremotes')
}

export async function dumpConfig(): Promise<Record<string, Record<string, string>>> {
  return rcCall('config/dump')
}

export async function getRemoteConfig(remoteName: string): Promise<Record<string, string>> {
  return rcCall('config/get', { name: remoteName })
}

export async function createRemote(name: string, type: string, parameters: Record<string, string>): Promise<void> {
  await rcCall('config/create', { name, type, parameters })
}

export async function deleteRemote(name: string): Promise<void> {
  await rcCall('config/delete', { name })
}

export async function updateRemote(name: string, parameters: Record<string, string>): Promise<void> {
  await rcCall('config/update', { name, parameters })
}

// ============== Operations Endpoints ==============

export interface RcloneFile {
  Path: string
  Name: string
  Size: number
  MimeType: string
  ModTime: string
  IsDir: boolean
  ID?: string
}

export async function listFiles(
  fs: string,
  remote: string = '',
  opt?: { recurse?: boolean; dirsOnly?: boolean; filesOnly?: boolean },
  forceRefresh?: boolean
): Promise<{ list: RcloneFile[] }> {
  return rcCall(
    'operations/list',
    {
      fs,
      remote,
      opt: opt || {},
    },
    undefined,
    forceRefresh ? { 'x-refresh': 'true' } : undefined
  )
}

export async function statFile(
  fs: string,
  remote: string
): Promise<{ item: RcloneFile }> {
  return rcCall('operations/stat', {
    fs,
    remote,
  })
}

export async function getAbout(fs: string): Promise<{
  total: number
  used: number
  free: number
  trashed?: number
  other?: number
}> {
  return rcCall('operations/about', { fs })
}

export async function copyFile(
  srcFs: string,
  srcRemote: string,
  dstFs: string,
  dstRemote: string,
  _options?: Record<string, any>
): Promise<{ jobid: number }> {
  const { _config, ...restOptions } = _options || {}
  return rcCall('operations/copyfile', {
    srcFs,
    srcRemote,
    dstFs,
    dstRemote,
    _async: true,
    _config: {
      ServerSideAcrossConfigs: true,
      ..._config,
    },
    ...restOptions,
  })
}

export async function moveFile(
  srcFs: string,
  srcRemote: string,
  dstFs: string,
  dstRemote: string,
  _options?: Record<string, any>
): Promise<{ jobid: number }> {
  const { _config, ...restOptions } = _options || {}
  return rcCall('operations/movefile', {
    srcFs,
    srcRemote,
    dstFs,
    dstRemote,
    _async: true,
    _config: {
      ServerSideAcrossConfigs: true,
      ..._config,
    },
    ...restOptions,
  })
}

export async function deleteFile(fs: string, remote: string): Promise<void> {
  await rcCall('operations/deletefile', { fs, remote })
}

export async function purge(fs: string, remote: string): Promise<void> {
  await rcCall('operations/purge', { fs, remote })
}

export async function renameFile(fs: string, srcRemote: string, dstRemote: string, _options?: Record<string, any>): Promise<void> {
  const { _config, ...restOptions } = _options || {}
  await rcCall('operations/movefile', {
    srcFs: fs,
    srcRemote,
    dstFs: fs,
    dstRemote,
    _config: {
      ServerSideAcrossConfigs: true,
      ..._config,
    },
    ...restOptions,
  })
}

export async function renameDir(remoteName: string, srcPath: string, dstPath: string, _options?: Record<string, any>): Promise<void> {
  const { _config, ...restOptions } = _options || {}
  await rcCall('sync/move', {
    srcFs: `${remoteName}:${srcPath}`,
    dstFs: `${remoteName}:${dstPath}`,
    _config: {
      ServerSideAcrossConfigs: true,
      ..._config,
    },
    ...restOptions,
  })
}

export async function mkdir(fs: string, remote: string): Promise<void> {
  await rcCall('operations/mkdir', { fs, remote })
}

export async function rmdir(fs: string, remote: string): Promise<void> {
  await rcCall('operations/rmdir', { fs, remote })
}

// ============== Sync Endpoints ==============

export interface SyncResult {
  // Job ID for async operations
}

export async function syncCopy(srcFs: string, dstFs: string, _options?: Record<string, any>): Promise<{ jobid: number }> {
  const { _config, ...restOptions } = _options || {}
  return rcCall('sync/copy', {
    srcFs,
    dstFs,
    _async: true,
    _config: {
      ServerSideAcrossConfigs: true,
      ..._config,
    },
    ...restOptions,
  })
}

export async function syncMove(srcFs: string, dstFs: string, _options?: Record<string, any>): Promise<{ jobid: number }> {
  const { _config, ...restOptions } = _options || {}
  return rcCall('sync/move', {
    srcFs,
    dstFs,
    _async: true,
    _config: {
      ServerSideAcrossConfigs: true,
      ..._config,
    },
    ...restOptions,
  })
}

export async function syncSync(srcFs: string, dstFs: string, _options?: Record<string, any>): Promise<{ jobid: number }> {
  const { _config, ...restOptions } = _options || {}
  return rcCall('sync/sync', {
    srcFs,
    dstFs,
    _async: true,
    _config: {
      ServerSideAcrossConfigs: true,
      ..._config,
    },
    ...restOptions,
  })
}

// ============== Job Endpoints ==============

export async function getJobStatus(jobid: number): Promise<{
  duration: number
  endTime: string
  error: string
  finished: boolean
  id: number
  output: any
  startTime: string
  success: boolean
}> {
  return rcCall('job/status', { jobid })
}

export async function waitForJob(jobid: number, timeoutMs = 3600000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const status = await getJobStatus(jobid)
      if (status.finished) {
        if (!status.success) {
          throw new Error(status.error || 'Operation failed')
        }
        return
      }
    } catch (err: any) {
      if (err?.message && err.message.toLowerCase().includes('job not found')) {
        // Job has finished and expired from memory
        return
      }
      throw err
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  // If the job is still running after timeoutMs, don't crash the operation; let background polling track it
  try {
    const finalCheck = await getJobStatus(jobid)
    if (!finalCheck.finished) {
      return
    }
  } catch {
    // Ignore error on final check
  }
  throw new Error('Operation timed out')
}

export async function getJobList(): Promise<{ jobids: number[] }> {
  return rcCall('job/list')
}

export async function stopJob(jobid: number): Promise<void> {
  await rcCall('job/stop', { jobid })
}

// ============== Test Connection ==============

export async function testConnection(): Promise<{ success: boolean; version?: string; error?: string }> {
  try {
    const version = await getVersion()
    return {
      success: true,
      version: version.version,
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    }
  }
}

// ============== Google Drive Setup ==============

// Create a Google Drive remote via rclone
// This will trigger the OAuth flow in rclone
export async function setupGoogleDriveRemote(
  remoteName: string,
  options: {
    client_id?: string
    client_secret?: string
    service_account_file?: string
    root_folder_id?: string
    scope?: string
  } = {}
): Promise<void> {
  const params: Record<string, string> = {
    type: 'drive',
    scope: options.scope || 'drive',
    server_side_across_configs: 'true',
  }

  if (options.client_id) params.client_id = options.client_id
  if (options.client_secret) params.client_secret = options.client_secret
  if (options.service_account_file) params.service_account_credentials = options.service_account_file
  if (options.root_folder_id) params.root_folder_id = options.root_folder_id

  await createRemote(remoteName, 'drive', params)
}

export async function getPublicLink(fs: string, remote: string): Promise<string> {
  const result = await rcCall('operations/publiclink', { fs, remote })
  return result.url
}
