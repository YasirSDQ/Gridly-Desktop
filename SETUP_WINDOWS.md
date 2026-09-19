# Gridly Desktop - Windows Setup Guide

## Quick Start for Windows Development

### 1. Install Prerequisites

#### Flutter SDK
1. Download Flutter SDK from: https://docs.flutter.dev/get-started/install/windows
2. Extract to `C:\src\flutter` (or your preferred location)
3. Add Flutter to PATH:
   ```powershell
   setx PATH "%PATH%;C:\src\flutter\bin"
   ```
4. Restart your terminal and verify:
   ```bash
   flutter --version
   ```

#### Visual Studio 2022
1. Download Visual Studio 2022 Community: https://visualstudio.microsoft.com/
2. During installation, select **"Desktop development with C++"** workload
3. Ensure these components are selected:
   - MSVC v143 - VS 2022 C++ x64/x86 build tools
   - Windows 10/11 SDK
   - C++ CMake tools for Windows

### 2. Clone and Setup

```powershell
# Navigate to project directory
cd gridly

# Get Flutter dependencies
flutter pub get

# Check your setup
flutter doctor
```

### 3. Run the Application

```powershell
# Run in debug mode
flutter run -d windows

# Or run in release mode
flutter run -d windows --release
```

### 4. Build Production Executable

```powershell
# Build release version
flutter build windows --release

# The executable will be at:
# build\windows\runner\Release\gridly.exe
```

### 5. Create Distribution Package

The release folder contains everything needed:

```
build\windows\runner\Release\
├── gridly.exe              # Main executable
├── data\                   # Flutter assets
├── flutter_windows.dll     # Flutter engine
└── [other DLLs]            # Required libraries
```

You can:
1. Zip the entire Release folder
2. Create an installer using Inno Setup or WiX
3. Use advanced installers like Advanced Installer

## First Run Experience

When you first run Gridly Desktop:

1. **rclone Auto-Installation**: The app will automatically download rclone v1.68.2 (~50MB)
2. **Daemon Startup**: rclone starts in background on port 5572
3. **Ready to Use**: You can now add cloud remotes!

## Adding Your First Remote

### Google Drive

1. Click the **"+"** button in the left sidebar
2. Select **"Google Drive"**
3. Choose authentication method:
   - **OAuth** (recommended): Opens browser for secure login
   - **Service Account**: For G Suite/Workspace users
4. Name your remote (e.g., "MyDrive")
5. Start managing your files!

### Other Providers

Gridly supports 50+ providers including:
- Microsoft OneDrive
- Dropbox
- Amazon S3
- Google Cloud Storage
- Box
- Mega
- pCloud
- And many more...

## Troubleshooting

### "Flutter command not found"
- Ensure Flutter is in your PATH
- Restart your terminal after installing Flutter
- Run: `flutter doctor` to diagnose issues

### Build fails with C++ errors
- Verify Visual Studio 2022 is installed with C++ workload
- Run Visual Studio Installer and repair installation
- Make sure Windows SDK is installed

### rclone won't start
- Check if port 5572 is already in use
- Temporarily disable Windows Defender Firewall
- Try running as Administrator

### OAuth authentication fails
- Ensure your system time is correct
- Check internet connectivity
- Clear browser cache and try again
- Some corporate networks block OAuth - try from home network

### App crashes on startup
```powershell
# Clean and rebuild
flutter clean
flutter pub get
flutter build windows --release
```

## Advanced Configuration

### Custom rclone Config Location

By default, rclone config is stored at:
```
%APPDATA%\gridly\rclone\rclone.conf
```

You can manually edit this file to add advanced configurations.

### Environment Variables

Set these before running if needed:
```powershell
$env:RCLONE_CONFIG = "C:\path\to\custom\rclone.conf"
$env:RCLONE_RC_ADDR = "localhost:5572"
```

### Running Multiple Instances

To run multiple instances with different configs:
```powershell
# Instance 1
$env:RCLONE_CONFIG = "C:\configs\config1.conf"
.\gridly.exe

# Instance 2 (in new terminal)
$env:RCLONE_CONFIG = "C:\configs\config2.conf"
.\gridly.exe
```

## Performance Tips

1. **Server-Side Transfers**: Always copy between remotes of the same provider for instant transfers
2. **Batch Operations**: Select multiple files for bulk operations
3. **Transfer Panel**: Monitor all transfers in real-time
4. **Grid View**: Use grid view for quick visual browsing
5. **Search**: Use the search bar to quickly find files

## Security Notes

- All credentials are stored securely by rclone
- OAuth tokens are encrypted in rclone.conf
- The app runs locally - no data is sent to third parties
- rclone daemon only accepts connections from localhost

## Updates

To update Gridly Desktop:

```powershell
# Pull latest changes (if using git)
git pull

# Update dependencies
flutter pub upgrade

# Rebuild
flutter build windows --release
```

## Support

For issues and feature requests:
- GitHub Issues: [Link to repo]
- Documentation: See README.md
- rclone docs: https://rclone.org/docs/

---

**Happy Cloud Managing! 🚀**
