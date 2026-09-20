# Gridly Desktop - Advanced Google Drive Manager

A modern, full-featured Windows desktop application for managing Google Drive and other cloud storage providers, built with **Flutter (Dart)** and powered by **rclone**.

## 🚀 Features

### Core Capabilities
- **Multi-Cloud Support**: Google Drive, OneDrive, Dropbox, Amazon S3, Box, and 50+ other providers via rclone
- **Server-Side Transfers**: Copy/move files between cloud providers without using local bandwidth
- **Automatic rclone Management**: Downloads and installs rclone v1.68.2 on first run
- **Real-Time Transfer Monitoring**: Track transfers with progress, speed, and ETA
- **Custom Remote Configuration**: Add and manage multiple cloud accounts

### Modern Desktop Experience
- **Native Windows Integration**: Custom title bar, window controls, and system tray support
- **Dark Theme UI**: Glass-morphism design with indigo/purple gradient accents
- **Grid & List Views**: Flexible file browsing options
- **Search & Sort**: Find and organize files easily
- **Context Menus**: Right-click actions for all file operations

### File Operations
- Browse, upload, download, copy, move, delete
- Create folders and organize files
- Multi-select operations
- Drag-and-drop support (coming soon)

## 📁 Project Structure

```
gridly/
├── lib/
│   ├── main.dart              # App entry point with window configuration
│   ├── models/
│   │   └── models.dart        # Data models (RemoteConfig, FileItem, TransferJob)
│   ├── services/
│   │   └── rclone_service.dart # rclone integration and daemon management
│   ├── providers/
│   │   └── app_provider.dart  # State management
│   ├── components/
│   │   ├── custom_title_bar.dart
│   │   ├── sidebar.dart
│   │   ├── file_browser.dart
│   │   └── transfer_panel.dart
│   └── screens/
│       └── main_screen.dart
├── assets/
│   ├── icons/
│   └── images/
├── windows/                   # Windows-specific configuration
├── pubspec.yaml              # Dependencies and configuration
└── README.md
```

## 🛠️ Tech Stack

- **Framework**: Flutter 3.x (Dart)
- **State Management**: Provider
- **HTTP Client**: Dio, http
- **Window Management**: bitsdojo_window, window_manager
- **File Operations**: process_run, file, path_provider
- **UI Components**: google_fonts, fl_chart, shimmer
- **Backend**: rclone v1.68.2 (auto-installed)

## 📦 Installation

### Prerequisites

1. **Flutter SDK** (3.0.0 or higher)
   ```bash
   # Download from https://flutter.dev/docs/get-started/install
   ```

2. **Windows Development Setup**
   - Visual Studio 2022 with C++ Desktop Development workload
   - Windows 10 SDK

### Setup Steps

1. **Clone the repository**
   ```bash
   cd gridly
   ```

2. **Install dependencies**
   ```bash
   flutter pub get
   ```

3. **Run in development mode**
   ```bash
   flutter run -d windows
   ```

4. **Build production executable**
   ```bash
   flutter build windows --release
   ```
   
   The executable will be at: `build/windows/runner/Release/gridly.exe`

## 🎯 How It Works

### rclone Integration

1. **Auto-Installation**: On first launch, the app downloads rclone v1.68.2 from GitHub releases
2. **Daemon Mode**: Starts rclone in RC (remote control) mode on port 5572
3. **API Communication**: All file operations are performed via rclone's HTTP API
4. **Server-Side Transfers**: When copying between remotes, rclone handles the transfer directly

### Architecture

```
┌─────────────────┐     HTTP API      ┌─────────────────┐
│   Flutter UI    │ ◄──────────────► │   rclone daemon │
│                 │                   │                 │
│ - File Browser  │                   │ - Cloud APIs    │
│ - Transfer Panel│                   │ - File Ops      │
│ - Sidebar       │                   │ - Transfers     │
└─────────────────┘                   └─────────────────┘
                                              │
                                              ▼
                                     ┌─────────────────┐
                                     │  Cloud Providers│
                                     │  (GDrive, S3,   │
                                     │   OneDrive, etc)│
                                     └─────────────────┘
```

## 🎨 UI Design

### Color Scheme
- **Background**: `#0F172A` (Slate 900)
- **Surface**: `#1E293B` (Slate 800)
- **Primary**: `#6366F1` (Indigo 500)
- **Secondary**: `#8B5CF6` (Violet 500)
- **Error**: `#EF4444` (Red 500)

### Design Principles
- **Glass-morphism**: Subtle transparency and blur effects
- **Neon Gradients**: Indigo to purple gradient accents
- **Smooth Animations**: Framer Motion-inspired transitions
- **Responsive Layout**: Adapts to window size changes

## 🔧 Configuration

### Adding a New Remote

1. Click the "+" button in the Sidebar
2. Select the provider type (Google Drive, OneDrive, etc.)
3. Follow the OAuth authentication flow
4. Name your remote configuration
5. Start managing your cloud storage!

### rclone Configuration

The app stores rclone configuration in:
- **Windows**: `%APPDATA%\gridly\rclone\`
- Config file: `rclone.conf`

You can also manually edit this file for advanced configurations.

## 🐛 Troubleshooting

### Common Issues

**1. rclone fails to start**
- Check if port 5572 is available
- Ensure Windows Defender isn't blocking the app
- Try running as administrator

**2. OAuth authentication fails**
- Ensure you have internet connectivity
- Check that your system time is correct
- Try re-authorizing the remote

**3. Transfers are slow**
- Server-side transfers should be instant (no local bandwidth)
- If downloading/uploading, check your internet connection
- Some providers have rate limits

**4. Build errors on Windows**
```bash
# Clean and rebuild
flutter clean
flutter pub get
flutter build windows --release
```

## 📝 Development

### Running in Debug Mode

```bash
flutter run -d windows --debug
```

### Hot Reload

Press `r` in the terminal while the app is running to hot reload changes.

### Building for Distribution

```bash
# Release build
flutter build windows --release

# The output is in build/windows/runner/Release/
# You can distribute gridly.exe along with required DLLs
```

### Creating an Installer (Optional)

Use tools like:
- **Inno Setup**
- **Advanced Installer**
- **WiX Toolset**

To create a professional Windows installer.

## 📄 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🙏 Acknowledgments

- [rclone](https://rclone.org/) - The powerful command-line cloud storage tool
- [Flutter](https://flutter.dev/) - Google's UI toolkit
- [Gridly Web](https://github.com/YasirSDQ/Gridly) - Original web application concept

---

**Built with ❤️ using Flutter and rclone**
