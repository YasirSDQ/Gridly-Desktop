// rclone configuration for Gridly
// Gridly uses rclone as the engine for all Google Drive operations

export const RCLONE_INFO = {
  // Minimum required rclone version
  MIN_VERSION: '1.60.0',
  RECOMMENDED_VERSION: '1.65.0',
  
  // Default RC API settings
  DEFAULT_RC_PORT: 5572,
  DEFAULT_RC_ADDR: 'localhost:5572',
  
  // rclone command to start the RC daemon
  get START_COMMAND() {
    const config = getRCConfig()
    const auth = config.username && config.password 
      ? `--rc-user ${config.username} --rc-pass ${config.password}`
      : ''
    return `rclone rcd --rc-addr=${config.url.replace(/^https?:\/\//, '')} ${auth} --rc-no-auth`
  },
}

interface RCConfig {
  url: string
  username: string
  password: string
}

function getRCConfig(): RCConfig {
  try {
    const data = localStorage.getItem('gridly_rc_config')
    if (data) return JSON.parse(data)
  } catch {}
  return {
    url: 'http://localhost:5572',
    username: '',
    password: '',
  }
}

// Instructions for setting up rclone
export function getSetupInstructions(): { steps: Array<{ title: string; command?: string; description: string }> } {
  const config = getRCConfig()
  const authFlag = config.username && config.password 
    ? `--rc-user ${config.username} --rc-pass ${config.password}`
    : '--rc-no-auth'
  
  return {
    steps: [
      {
        title: 'Install rclone',
        description: 'Download and install rclone from rclone.org',
        command: 'curl https://rclone.org/install.sh | sudo bash',
      },
      {
        title: 'Start rclone RC daemon',
        description: 'Run rclone in remote control mode. This exposes an HTTP API that Gridly uses.',
        command: `rclone rcd --rc-addr=${config.url.replace(/^https?:\/\//, '')} ${authFlag}`,
      },
      {
        title: 'Verify connection',
        description: 'Gridly will automatically detect the running rclone daemon.',
      },
      {
        title: 'Connect Google Drive',
        description: 'Click "Connect Drive" in Gridly. rclone will open a browser for Google OAuth.',
      },
    ],
  }
}

// Google Drive specific rclone config options
export const DRIVE_CONFIG_OPTIONS = [
  { key: 'client_id', label: 'Client ID', description: 'Leave blank to use rclone\'s default', optional: true },
  { key: 'client_secret', label: 'Client Secret', description: 'Leave blank to use rclone\'s default', optional: true },
  { key: 'scope', label: 'Scope', description: 'Access scope', default: 'drive', options: ['drive', 'drive.readonly', 'drive.file', 'drive.appfolder', 'drive.metadata.readonly'] },
  { key: 'root_folder_id', label: 'Root Folder ID', description: 'ID of the root folder (leave blank for My Drive)', optional: true },
  { key: 'service_account_file', label: 'Service Account File', description: 'Path to service account JSON (optional)', optional: true },
]
