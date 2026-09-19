# Gridly Desktop

**Gridly Desktop** is a modern, full-featured Google Drive and cloud storage manager built with Flutter for Windows. It leverages the powerful `rclone` backend for efficient server-side file transfers and multi-cloud management.

## Features

### Core Capabilities
- **Multi-Cloud Support**: Manage Google Drive, OneDrive, Dropbox, S3, and 50+ other cloud providers
- **Server-Side Transfers**: Copy/move files between clouds without using local bandwidth
- **Real-time Transfer Monitoring**: Track progress, speed, and ETA for all operations
- **Modern Dark UI**: Beautiful glass-morphism design with gradient accents
- **Custom Window Controls**: Native Windows title bar integration
- **Auto rclone Management**: Automatic download and setup of rclone binary

### File Management
- Grid and List view modes
- Breadcrumb navigation
- Search and filter capabilities
- Sort by name, size, date, type
- Create folders, rename, move, copy, delete
- Context menus for quick actions

### Transfer System
- Parallel transfers with job queue
- Progress tracking with percentage, speed, and ETA
- Transfer history and statistics
- Error handling and retry support

## Technology Stack

- **Framework**: Flutter 3.x (Dart)
- **Backend**: rclone v1.68.2 (auto-installed)
- **State Management**: Provider
- **HTTP Client**: Dio, http
- **UI Components**: Custom Material 3 design
- **Window Management**: bitsdojo_window, window_manager

## Project Structure

```
gridly-desktop/
├── lib/
│   ├── main.dart                 # App entry point
│   ├── models/
│   │   └── models.dart           # Data models (FileItem, TransferJob, etc.)
│   ├── services/
│   │   └── rclone_service.dart   # rclone API integration
│   ├── providers/
│   │   └── app_provider.dart     # State management
│   ├── screens/
│   │   └── main_screen.dart      # Main application screen
│   └── components/
│       ├── custom_title_bar.dart # Custom window controls
│       ├── sidebar.dart          # Remote connections panel
│       ├── file_browser.dart     # File grid/list view
│       └── transfer_panel.dart   # Transfer monitoring
├── assets/
│   ├── icons/
│   └── images/
├── windows/                      # Windows-specific build files
├── pubspec.yaml                  # Dependencies
└── README.md                     # This file
```

## Installation

### Prerequisites

1. **Flutter SDK** (3.0 or higher)
   ```bash
   # Download from https://flutter.dev/docs/get-started/install
   ```

2. **Windows 10/11** (64-bit)

### Setup

1. **Clone or navigate to the project**:
   ```bash
   cd gridly-desktop
   ```

2. **Install dependencies**:
   ```bash
   flutter pub get
   ```

3. **Run in development mode**:
   ```bash
   flutter run -d windows
   ```

### Build for Production

```bash
# Build Windows executable
flutter build windows --release

# The executable will be at:
# build/windows/runner/Release/gridly_desktop.exe
```

## Usage

### First Launch

1. On first launch, Gridly Desktop will automatically download and install rclone
2. The app will start the rclone daemon in the background
3. You'll see the main interface with an empty remotes list

### Adding a Remote (Google Drive)

1. Click the **+** button in the Remotes panel
2. Follow the rclone configuration wizard:
   - Choose `drive` for Google Drive
   - Authenticate with your Google account
   - Configure advanced options if needed
3. Your remote will appear in the sidebar

### Managing Files

- **Navigate**: Click on a remote to browse its contents
- **Upload**: Use the + menu → Upload Files
- **New Folder**: Use the + menu → New Folder
- **Download**: Right-click file → Download
- **Transfer**: Select files/folders and choose Copy/Move to transfer between remotes

### Server-Side Transfers

The key advantage of Gridly Desktop is server-side transfers:

1. Select files in Remote A
2. Right-click → Copy/Move
3. Choose destination in Remote B
4. The transfer happens directly between clouds (no local bandwidth used)

### Monitoring Transfers

- Click the **Transfers** FAB or button to open the transfer panel
- View active, completed, and failed transfers
- See real-time progress, speed, and ETA

## Configuration

### rclone Settings

rclone configuration is stored in:
- Windows: `%APPDATA%\rclone\rclone.conf`

You can manually edit this file or use the built-in config wizard.

### App Data

Application data is stored in:
- Windows: `%APPDATA%\Gridly Desktop\`

## Troubleshooting

### rclone Download Fails

If rclone fails to download automatically:
1. Manually download from https://github.com/rclone/rclone/releases
2. Extract to `%APPDATA%\Gridly Desktop\rclone\`
3. Restart the app

### Connection Issues

If you can't connect to remotes:
1. Check your internet connection
2. Verify rclone daemon is running (check task manager)
3. Try re-authenticating the remote

### Transfer Stuck

If a transfer appears stuck:
1. Check the error message in the transfer panel
2. Retry the operation
3. Check source/destination permissions

## Development

### Running in Debug Mode

```bash
flutter run -d windows --debug
```

### Hot Reload

Press `r` in the terminal while running to hot reload changes.

### Building Debug Version

```bash
flutter build windows --debug
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.

## Acknowledgments

- [rclone](https://rclone.org/) - The amazing cloud sync tool
- [Flutter](https://flutter.dev/) - Google's UI toolkit
- [Gridly Web](https://github.com/YasirSDQ/Gridly) - Inspiration for this desktop version

## Support

For issues and feature requests, please open an issue on the GitHub repository.

---

**Built with ❤️ using Flutter and rclone**
