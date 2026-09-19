# Gridly - Setup Guide

This guide will help you set up Gridly with real rclone integration for Google Drive management.

## Quick Start (5 minutes)

### Step 1: Install rclone

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

Verify installation:
```bash
rclone version
```

### Step 2: Clone and Install Gridly

```bash
git clone <repository-url>
cd gridly
npm install
```

### Step 3: Start rclone RC Daemon

Open a terminal and run:

```bash
rclone rcd --rc-addr=localhost:5572 --rc-no-auth
```

You should see:
```
NOTICE: Serving remote control on http://localhost:5572/
```

**Keep this terminal running!**

### Step 4: Start Gridly

In another terminal:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Step 5: Connect Your Google Drive

1. Click **"Connect Drive"**
2. Enter a remote name (e.g., `mydrive`)
3. Click **"Connect via rclone"**
4. rclone opens your browser for Google OAuth
5. Sign in and grant permissions
6. Your account appears in Gridly!

## Detailed Setup

### rclone RC Daemon Options

**Basic (no authentication):**
```bash
rclone rcd --rc-addr=localhost:5572 --rc-no-auth
```

**With authentication (recommended):**
```bash
rclone rcd --rc-addr=localhost:5572 --rc-user=gridly --rc-pass=secretpassword
```

**With HTTPS:**
```bash
rclone rcd --rc-addr=localhost:5572 --rc-cert=cert.pem --rc-key=key.pem
```

**Serve web GUI:**
```bash
rclone rcd --rc-addr=localhost:5572 --rc-serve
```

### Configure Gridly

If using rclone authentication, create `.env`:

```bash
VITE_RCLONE_URL=http://localhost:5572
VITE_RCLONE_USERNAME=gridly
VITE_RCLONE_PASSWORD=secretpassword
```

### Advanced rclone Configuration

**Custom Google OAuth credentials:**

If you want to use your own Google OAuth client:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. When connecting in Gridly, expand "Advanced Options"
4. Enter your Client ID and Client Secret

**Service Account:**

For automated/server use:

1. Create a service account in Google Cloud Console
2. Download the JSON key file
3. In Gridly, enter the path to the JSON file in "Service Account File"

## How It Works

```
┌──────────────┐
│   Browser    │
│   (Gridly)   │
└──────┬───────┘
       │ HTTP
       │ POST /config/create
       ▼
┌──────────────┐
│   rclone     │
│   rcd        │
└──────┬───────┘
       │ OAuth 2.0
       ▼
┌──────────────┐
│   Google     │
│   Drive API  │
└──────────────┘
```

1. **Gridly** sends requests to **rclone RC API**
2. **rclone** handles OAuth with Google
3. **rclone** stores tokens securely
4. **Gridly** uses rclone to browse/transfer files
5. **Transfers** happen server-side (no download!)

## rclone RC API Commands

Gridly uses these rclone RC API endpoints:

### Core
- `POST /core/version` - Get rclone version
- `POST /core/stats` - Get transfer statistics
- `POST /core/pid` - Get process ID

### Config
- `POST /config/create` - Create new remote (triggers OAuth)
- `POST /config/delete` - Delete remote
- `POST /config/listremotes` - List all remotes
- `POST /config/dump` - Dump all config

### Operations
- `POST /operations/list` - List files
- `POST /operations/about` - Get storage info
- `POST /operations/copyfile` - Copy single file
- `POST /operations/movefile` - Move single file

### Sync
- `POST /sync/copy` - Copy between remotes
- `POST /sync/move` - Move between remotes
- `POST /sync/sync` - Sync between remotes

### Jobs
- `POST /job/status` - Get job status
- `POST /job/list` - List active jobs
- `POST /job/stop` - Stop a job

## Troubleshooting

### rclone daemon not detected

**Check if rclone is running:**
```bash
curl http://localhost:5572/core/version
```

**Expected response:**
```json
{"decomposed":[1,65,2],"isGit":false,"isBeta":false,"os":"linux","arch":"amd64","version":"1.65.2"}
```

**If not running:**
```bash
rclone rcd --rc-addr=localhost:5572
```

### OAuth flow doesn't start

**Manual OAuth:**
```bash
rclone config
```
Then follow the prompts to add a Google Drive remote.

**Headless server:**
```bash
rclone authorize "drive"
```
This provides a URL to open in another browser.

### Connection refused

**Check port:**
```bash
netstat -tlnp | grep 5572
```

**Check firewall:**
```bash
sudo ufw allow 5572
```

### Authentication failed

**Reset rclone config:**
```bash
rm ~/.config/rclone/rclone.conf
```

**Re-authorize:**
```bash
rclone config
```

### Transfer fails

**Check rclone logs:**
Look at the terminal where rclone is running.

**Test manually:**
```bash
rclone ls mydrive:
```

**Check quotas:**
Google Drive has API quotas. Wait if you hit limits.

## Production Deployment

### Docker Compose

```yaml
version: '3.8'
services:
  rclone:
    image: rclone/rclone:latest
    command: rcd --rc-addr=0.0.0.0:5572 --rc-user=gridly --rc-pass=secret
    volumes:
      - rclone-config:/config/rclone
    ports:
      - "5572:5572"
  
  gridly:
    build: .
    environment:
      - VITE_RCLONE_URL=http://rclone:5572
      - VITE_RCLONE_USERNAME=gridly
      - VITE_RCLONE_PASSWORD=secret
    ports:
      - "80:80"
    depends_on:
      - rclone

volumes:
  rclone-config:
```

### systemd Service

**`/etc/systemd/system/rclone-rc.service`:**
```ini
[Unit]
Description=rclone Remote Control Daemon
After=network.target

[Service]
Type=simple
User=youruser
ExecStart=/usr/bin/rclone rcd --rc-addr=localhost:5572 --rc-user=gridly --rc-pass=secret
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Enable and start:**
```bash
sudo systemctl enable rclone-rc
sudo systemctl start rclone-rc
```

## Security Best Practices

1. **Use authentication** - Always use `--rc-user` and `--rc-pass`
2. **Limit access** - Bind to `localhost` or specific IP
3. **Use HTTPS** - For production, use `--rc-cert` and `--rc-key`
4. **Firewall rules** - Only allow necessary ports
5. **Environment variables** - Store credentials in `.env`, not in code
6. **Regular updates** - Keep rclone and Gridly updated

## API Limits

**Google Drive API:**
- 12,000 queries per 100 seconds per user
- 1,000,000,000 queries per day

**rclone RC API:**
- No inherent limits
- Depends on your system resources

## Next Steps

1. ✅ Install rclone
2. ✅ Start rclone RC daemon
3. ✅ Install and start Gridly
4. ✅ Connect your Google Drive
5. 🎉 Start browsing and transferring files!

## Support

- **rclone docs:** https://rclone.org/docs/
- **rclone forum:** https://forum.rclone.org/
- **Gridly issues:** https://github.com/your-repo/gridly/issues

---

**Need help?** Check the [README.md](./README.md) or open an issue on GitHub.
