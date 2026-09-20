// Authentication service using rclone for Google Drive connection
import type { DriveAccount } from '../types'
import { storage, generateId } from './storage'
import * as rcloneRC from './rcloneRC'

// Connect a Google Drive account via rclone
export async function connectGoogleDriveAccount(
  remoteName: string,
  options: {
    client_id?: string
    client_secret?: string
    root_folder_id?: string
    scope?: string
  } = {}
): Promise<DriveAccount> {
  // Create the remote in rclone - this triggers OAuth flow
  await rcloneRC.setupGoogleDriveRemote(remoteName, options)

  // Wait a moment for OAuth to complete
  // In practice, rclone opens a browser and waits for user to authenticate
  // The config/create endpoint blocks until OAuth is complete
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Get storage info from rclone
  const fs = `${remoteName}:`
  let usedBytes = 0
  let totalBytes = 0

  try {
    const about = await rcloneRC.getAbout(fs)
    usedBytes = about.used || 0
    totalBytes = about.total || 0
  } catch (error) {
    console.warn('Could not get storage info:', error)
  }

  // List root to count files/folders
  let fileCount = 0
  let folderCount = 0

  try {
    const rootFiles = await rcloneRC.listFiles(fs, '', { recurse: false })
    fileCount = rootFiles.list?.filter(f => !f.IsDir).length || 0
    folderCount = rootFiles.list?.filter(f => f.IsDir).length || 0
  } catch (error) {
    console.warn('Could not list root files:', error)
  }

  // Create account object
  const account: DriveAccount = {
    id: generateId(),
    name: remoteName,
    email: `${remoteName}@drive.rclone`, // rclone doesn't expose email directly
    accessToken: '', // Not used - rclone manages tokens
    refreshToken: '', // Not used - rclone manages tokens
    tokenExpiry: 0, // Not used - rclone manages tokens
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(remoteName)}&background=6366f1&color=fff&size=128`,
    usedBytes,
    totalBytes,
    fileCount,
    folderCount,
    rcloneRemote: remoteName,
    status: 'connected',
    addedAt: Date.now(),
    lastSynced: Date.now(),
  }

  // Save to storage
  storage.addAccount(account)

  return account
}

// Disconnect account (delete rclone remote)
export async function disconnectAccount(accountId: string): Promise<void> {
  const accounts = storage.getAccounts()
  const account = accounts.find(a => a.id === accountId)
  
  if (account) {
    try {
      // Delete the remote from rclone
      await rcloneRC.deleteRemote(account.rcloneRemote)
    } catch (error) {
      console.warn('Could not delete rclone remote:', error)
    }
  }

  storage.removeAccount(accountId)
}

// Refresh account info from rclone
export async function refreshAccountInfo(accountId: string): Promise<void> {
  const accounts = storage.getAccounts()
  const account = accounts.find(a => a.id === accountId)
  
  if (!account) return

  const fs = `${account.rcloneRemote}:`

  try {
    // Get storage info
    const about = await rcloneRC.getAbout(fs)
    
    // List root files
    const rootFiles = await rcloneRC.listFiles(fs, '', { recurse: false })
    const fileCount = rootFiles.list?.filter(f => !f.IsDir).length || 0
    const folderCount = rootFiles.list?.filter(f => f.IsDir).length || 0

    // Update account
    const updates = {
      usedBytes: about.used || account.usedBytes,
      totalBytes: about.total || account.totalBytes,
      fileCount,
      folderCount,
      lastSynced: Date.now(),
      status: 'connected' as const,
    }

    storage.updateAccount(accountId, updates)
  } catch (error) {
    console.error('Failed to refresh account:', error)
    storage.updateAccount(accountId, { status: 'error' })
    throw error
  }
}

// Test connection to a remote
export async function testRemote(account: DriveAccount): Promise<{ success: boolean; message: string }> {
  try {
    const fs = `${account.rcloneRemote}:`
    await rcloneRC.getAbout(fs)
    return {
      success: true,
      message: `Successfully connected to ${account.rcloneRemote}`,
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to connect: ${error.message}`,
    }
  }
}

// Check if rclone RC is running
export async function isRcloneRunning(): Promise<boolean> {
  return rcloneRC.isRcloneRunning()
}

// Get rclone version
export async function getRcloneVersion(): Promise<string | null> {
  try {
    const version = await rcloneRC.getVersion()
    return version.version
  } catch {
    return null
  }
}

// List all configured remotes in rclone
export async function listRcloneRemotes(): Promise<string[]> {
  try {
    const result = await rcloneRC.listRemotes()
    return result.remotes || []
  } catch {
    return []
  }
}

// Validate remote name (rclone requirements)
export function isValidRemoteName(name: string): boolean {
  // rclone remote names must be alphanumeric with underscores/hyphens
  return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)
}

export async function syncAccountStorage(accountId: string, remoteName: string): Promise<boolean> {
  const accounts = storage.getAccounts()
  const index = accounts.findIndex(a => a.id === accountId)
  if (index === -1) return false
  
  try {
    const about = await rcloneRC.getAbout(`${remoteName}:`)
    if (about.used !== undefined) {
      accounts[index].usedBytes = about.used || 0
      accounts[index].totalBytes = about.total || Math.max(about.used * 2, 1)
      storage.saveAccounts(accounts)
      return true
    }
  } catch (error) {
    console.warn('Background sync failed:', error)
  }
  return false
}
