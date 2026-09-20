---
title: Gridly
emoji: 🚀
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 3000
---

# Gridly - Advanced Google Drive Manager

A modern, high-tech web application for managing multiple Google Drive accounts using **rclone** as the engine. Gridly connects to rclone's Remote Control (RC) API to provide a beautiful interface for browsing, transferring, and managing your Google Drive files.

![Gridly](https://img.shields.io/badge/Gridly-v2.0-indigo)
![rclone](https://img.shields.io/badge/rclone-1.60+-blue)
![RC API](https://img.shields.io/badge/RC%20API-HTTP-green)
![License](https://img.shields.io/badge/license-MIT-orange)

## 🚀 How It Works

Gridly uses **rclone** as the backend engine:

1. **You run rclone** in Remote Control (RC) mode: `rclone rcd`
2. **Gridly connects** to rclone via its HTTP API (default: `http://localhost:5572`)
3. **rclone handles** all OAuth authentication with Google
4. **Gridly provides** a beautiful UI for browsing and managing files
5. **Transfers happen** server-side via Google's infrastructure (no download/upload!)

## ✨ Features

### 🔌 rclone RC API Integration
- **Real rclone integration** via Remote Control HTTP API
- **Automatic connection detection** - Gridly checks if rclone is running
- **Live status monitoring** - See rclone connection status in real-time
- **Full API coverage** - Browse, transfer, sync, and manage files

### 🔐 Google Drive via rclone
- **rclone handles OAuth** - Secure authentication through rclone's built-in flow
- **Multiple accounts** - Connect unlimited Google Drive accounts
- **Token management** - rclone securely stores and refreshes tokens
- **Server-side transfers** - Zero bandwidth usage on your device

### 📁 File Management
- **Browse files** via rclone RC API (`operations/list`)
- **Real-time storage info** via `operations/about`
- **Folder navigation** with breadcrumb trail
- **File selection** for targeted transfers

### ⚡ Transfer Engine
- **Copy/Move/Sync** operations via rclone RC API
- **Real-time progress** monitoring via `core/stats`
- **Job tracking** via `job/status`
- **Pause/Resume/Cancel** transfers
- **Detailed logs** for each transfer

### 🎨 Modern UI/UX
- Dark theme with glass-morphism effects
- Neon glow animations
- Responsive design for all devices
- Real-time transfer progress updates

## 📋 Prerequisites

- **Node.js 18+** and npm
- **rclone 1.60+** installed on your system
- A Google account

## 🔧 Setup

### 1. Install rclone

**macOS:**
```bash
brew install rclone
```

**Linux:**
```bash
curl https://rclone.org/install.sh | sudo bash
```

**Windows:**
Download from [rclone.org/downloads](https://rclone.org/downloads/)

### 2. Clone and Install Gridly

```bash
git clone <repository-url>
cd gridly
npm install
```

### 3. Start rclone RC Daemon

Open a terminal and run:

```bash
rclone rcd --rc-addr=localhost:5572 --rc-no-auth
```

**With authentication (recommended for production):**
```bash
rclone rcd --rc-addr=localhost:5572 --rc-user=gridly --rc-pass=yourpassword
```

**Important:** Keep this terminal running while using Gridly.

### 4. Configure Gridly (Optional)

If you're using rclone with authentication, create a `.env` file:

```bash
VITE_RCLONE_URL=http://localhost:5572
VITE_RCLONE_USERNAME=gridly
VITE_RCLONE_PASSWORD=yourpassword
```

### 5. Start Gridly

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## 🎯 Usage

### Connect Google Drive

1. Click **"Connect Drive"** in Gridly
2. Enter a remote name (e.g., `mydrive`)
3. Choose access scope (default: `drive` for full access)
4. Click **"Connect via rclone"**
5. **rclone opens a browser** for Google OAuth
6. Sign in and grant permissions
7. Your account appears in the dashboard!

### Browse Files

1. Click **"Browse"** on any connected account
2. Navigate through your Google Drive folders
3. Files are listed via rclone RC API (`operations/list`)
4. Select files/folders for transfer

### Create Transfers

1. Click **"New Transfer"**
2. Select source and destination accounts
3. Choose operation type (copy/move/sync)
4. Specify folder paths
5. Click **"Start Transfer"**
6. Gridly calls rclone RC API (`sync/copy`, `sync/move`, or `sync/sync`)
7. Monitor progress in real-time via `core/stats`

### Monitor Transfers

- View real-time progress in the Transfer Manager
- Pause, resume, or cancel transfers
- View detailed logs for each transfer
- See transfer speed and ETA

### Export rclone Config

1. Go to Settings
2. Click **"Copy rclone Config to Clipboard"**
3. Paste into your `~/.config/rclone/rclone.conf`

## 🏗️ Architecture

```
┌─────────────────┐
│   Gridly Web    │
│   (React UI)    │
└────────┬────────┘
         │ HTTP API
         │ (JSON-RPC)
         ▼
┌─────────────────┐
│  rclone rcd     │
│  (RC Daemon)    │
└────────┬────────┘
         │ OAuth 2.0
         │ + API calls
         ▼
┌─────────────────┐
│  Google Drive   │
│  (Cloud API)    │
└─────────────────┘
```

### Key Components

- **`src/services/rcloneRC.ts`** - rclone RC API client
- **`src/services/rclone.ts`** - High-level rclone operations
- **`src/services/auth.ts`** - Account management via rclone
- **`src/components/AuthModal.tsx`** - rclone-based OAuth flow
- **`src/components/FileBrowser.tsx`** - File browser using rclone RC API
- **`src/components/TransferManager.tsx`** - Transfer monitoring

## 🔒 Security

- **rclone manages tokens** - Gridly never sees your Google credentials
- **OAuth 2.0** - Industry-standard authentication via rclone
- **Local communication** - Gridly talks to rclone on localhost
- **Optional authentication** - Secure rclone RC API with username/password

### Production Considerations

For production deployment:
1. Use HTTPS for rclone RC API
2. Enable rclone RC authentication (`--rc-user` and `--rc-pass`)
3. Consider running rclone on a secure network
4. Use environment variables for credentials

## 🐛 Troubleshooting

### "rclone daemon not detected"

**Solution:** Make sure rclone is running:
```bash
rclone rcd --rc-addr=localhost:5572
```

Check if it's accessible:
```bash
curl http://localhost:5572/core/version
```

### "Failed to connect to rclone"

**Solutions:**
1. Verify rclone is running
2. Check the RC address matches (default: `localhost:5572`)
3. If using authentication, verify credentials in `.env`
4. Check firewall settings

### "OAuth flow doesn't start"

**Solutions:**
1. Make sure rclone can open a browser (or provide the URL manually)
2. Check rclone logs for errors
3. Try running `rclone config` manually first to test

### "Transfer fails"

**Solutions:**
1. Check rclone logs for detailed error messages
2. Verify both accounts are properly connected
3. Ensure you have sufficient storage space
4. Check Google Drive API quotas

## 📊 rclone RC API Endpoints Used

Gridly uses these rclone RC API endpoints:

- `core/version` - Check rclone version
- `core/stats` - Get transfer statistics
- `config/create` - Create new remote (triggers OAuth)
- `config/delete` - Delete remote
- `config/listremotes` - List all remotes
- `operations/list` - List files in a remote
- `operations/about` - Get storage information
- `sync/copy` - Copy between remotes
- `sync/move` - Move between remotes
- `sync/sync` - Sync between remotes
- `job/status` - Get job status
- `job/list` - List active jobs

## 🚀 Deployment

### Build for Production

```bash
npm run build
```

The output will be in the `dist/` directory.

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM nginx:alpine
COPY --from=0 /app/dist /usr/share/nginx/html
EXPOSE 80
```

**Note:** You'll also need to run rclone in a separate container or on the host.

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_RCLONE_URL` | rclone RC API URL | `http://localhost:5572` |
| `VITE_RCLONE_USERNAME` | rclone RC username | (empty) |
| `VITE_RCLONE_PASSWORD` | rclone RC password | (empty) |

## 🤝 Contributing

Contributions are welcome! Please read the contributing guidelines first.

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- [rclone](https://rclone.org/) - The swiss army knife of cloud storage
- [Google Drive API](https://developers.google.com/drive/api) - Cloud storage API
- [React](https://reactjs.org/) - UI library
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework

## 📞 Support

For issues and questions:
1. Check the troubleshooting section above
2. Review rclone documentation: https://rclone.org/docs/
3. Open an issue on GitHub

---

**Built with ❤️ using React, TypeScript, and rclone**
