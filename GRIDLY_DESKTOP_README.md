# Gridly Desktop - Advanced Google Drive Manager

## 🎯 Project Overview

**Gridly Desktop** is a full-featured Windows desktop application built with **Flutter (Dart)** that brings the powerful Gridly webapp experience to your desktop. It leverages **rclone** for efficient cloud-to-cloud file management with zero local bandwidth usage.

## ✨ Key Features

### Modern Design (Matching Webapp)
- **Dark Theme**: Deep black (#0A0A0A) background with indigo/purple gradients
- **Glass-morphism Effects**: Translucent panels with backdrop blur
- **Neon Glows**: Subtle gradient shadows and glowing accents
- **Grid Pattern**: 50px subtle grid overlay matching webapp design
- **Custom Title Bar**: Native Windows integration with gradient logo
- **Smooth Animations**: Framer Motion-inspired transitions

### Core Functionality
- **Auto rclone Management**: Downloads and installs rclone v1.68.2 on first run
- **Server-Side Transfers**: Copy/move between clouds without local bandwidth
- **Multi-Cloud Support**: Google Drive, OneDrive, Dropbox, S3, and 50+ providers via rclone
- **Real-time Monitoring**: Track transfers with progress, speed, and ETA
- **Grid/List Views**: Flexible file browsing options
- **Search & Sort**: Find and organize files easily
- **Storage Statistics**: Visual quota display with refresh capability

### Desktop Integration
- **Native Window Controls**: Custom minimize, maximize, close buttons
- **Custom Title Bar**: Branded header with connection status
- **Optimized Size**: 1400x900 default window (matching webapp layout)
- **Minimum Size**: 1000x700 for responsive design

## 🏗️ Architecture

```
lib/
├── main.dart                    # App entry point with window config
├── components/
│   ├── custom_title_bar.dart    # Custom Windows title bar
│   ├── sidebar.dart             # Navigation & storage stats
│   ├── file_browser.dart        # File grid/list view
│   └── transfer_panel.dart      # Transfer monitoring
├── screens/
│   └── main_screen.dart         # Main app layout
├── services/
│   └── rclone_service.dart      # rclone integration
├── providers/
│   └── app_provider.dart        # State management
└── models/
    └── models.dart              # Data models
```

## 🎨 Design System

### Colors (Matching Webapp)
```dart
Background: #0A0A0A (deep black)
Surface: #0F172A (slate)
Primary: #6366F1 (indigo)
Secondary: #8B5CF6 (purple)
Tertiary: #06B6D4 (cyan)
Error: #EF4444 (red)
Success: #10B981 (green)
```

### UI Components
- **Sidebar**: Glass-morphism with gradient logo, "Add Account" button, nav items, storage card
- **Title Bar**: 52px height, gradient icon, "Gridly ADVANCED DRIVE MANAGER" text, connection status
- **Navigation**: Indigo-tinted active states, hover effects
- **Storage Card**: Progress bar with gradient, usage percentage, bytes display
- **File Browser**: Grid/List toggle, search bar, file operations
- **Transfer Panel**: Real-time progress, speed, ETA tracking

## 🚀 Getting Started

### Prerequisites
- Flutter SDK 3.x or higher
- Windows 10/11 (for building Windows executable)
- Git

### Installation

1. **Clone the repository:**
```bash
cd /workspace
```

2. **Install dependencies:**
```bash
flutter pub get
```

3. **Run in development mode:**
```bash
flutter run -d windows
```

### Building for Production

```bash
flutter build windows --release
```

The executable will be located at:
```
build/windows/runner/Release/gridly.exe
```

## 📦 Dependencies

```yaml
dependencies:
  flutter: sdk: flutter
  provider: ^6.1.1          # State management
  dio: ^5.4.0               # HTTP client for rclone API
  window_manager: ^0.3.8    # Window control
  bitsdojo_window: ^0.1.6   # Custom window decorations
  path_provider: ^2.1.2     # File system paths
  path: ^1.8.3              # Path manipulation
  archive: ^3.4.10          # ZIP extraction for rclone
  http: ^1.2.0              # HTTP utilities
```

## 🔧 Configuration

### Window Settings (main.dart)
```dart
WindowOptions(
  size: Size(1400, 900),
  minimumSize: Size(1000, 700),
  titleBarStyle: TitleBarStyle.hidden,
  backgroundColor: Colors.transparent,
)
```

### Theme Configuration
- Font Family: Inter
- Rounded corners: 16px (cards), 999px (inputs)
- Border opacity: 0.05-0.1
- Backdrop blur: 20px

## 🎯 Component Breakdown

### CustomTitleBar
- Height: 52px
- Gradient logo with neon glow
- "Gridly" + "ADVANCED DRIVE MANAGER" text
- Connection status indicator (green pulse)
- Native window controls

### Sidebar
- Width: 260px
- Glass-morphism background
- Logo and title section
- "Add Account" gradient button
- Navigation items (My Drive, Shared, Transfers, Settings)
- Storage statistics card with progress bar

### FileBrowser
- Search bar with rounded design
- Grid/List view toggle
- File/folder cards with icons
- Context menu support
- Selection handling

### TransferPanel
- Animated slide-in/out
- Transfer job list
- Progress indicators
- Speed and ETA display
- Cancel functionality

## 🔌 rclone Integration

The app automatically:
1. Downloads rclone v1.68.2 for Windows
2. Extracts to app data directory
3. Starts rclone daemon on app launch
4. Manages daemon lifecycle
5. Provides full RC API access

### API Endpoints Used
- `/rc/config` - List remotes
- `/rc/config/create` - Create remote
- `/rc/fs/ls` - List files
- `/rc/fs/copy` - Copy files
- `/rc/fs/move` - Move files
- `/rc/fs/delete` - Delete files
- `/rc/fs/mkdir` - Create folder
- `/rc/sync/between` - Sync remotes
- `/core/stats` - Transfer statistics

## 🎨 Design Highlights

### Matching Webapp Design Elements
1. **Color Palette**: Identical indigo/purple/cyan gradients
2. **Typography**: Inter font family, bold headings
3. **Spacing**: Consistent 8px grid system
4. **Borders**: Subtle white borders with low opacity
5. **Shadows**: Neon glow effects on interactive elements
6. **Animations**: Smooth transitions on hover/state changes
7. **Icons**: Material Icons matching FontAwesome from webapp

### Desktop Enhancements
- Native window management
- Custom title bar with branding
- Optimized for desktop screen sizes
- Keyboard shortcuts ready
- System tray integration potential

## 📝 Usage Guide

### Adding a Cloud Account
1. Click "Add Account" button in sidebar
2. Configure remote name and type
3. Follow OAuth flow for provider
4. Account appears in sidebar with storage stats

### Browsing Files
1. Select account from sidebar
2. Navigate folders by clicking
3. Switch between Grid/List views
4. Use search bar to find files

### Transferring Files
1. Select files/folders
2. Right-click for context menu
3. Choose Copy/Move operation
4. Select destination
5. Monitor progress in Transfer Panel

## 🐛 Troubleshooting

### Common Issues

**rclone not found:**
- Ensure internet connection on first launch
- Check app data directory permissions
- Manually download rclone if needed

**Window not appearing:**
- Check Flutter Windows desktop prerequisites
- Verify Visual Studio C++ tools installed
- Run `flutter doctor -v` for diagnostics

**Connection failed:**
- Ensure rclone daemon is running
- Check RC API port configuration
- Verify remote credentials

## 📄 License

This project is based on the Gridly webapp (https://github.com/YasirSDQ/Gridly) and adapted for desktop use with Flutter and rclone.

## 🤝 Contributing

Contributions welcome! Areas for improvement:
- Additional cloud provider integrations
- Enhanced transfer scheduling
- Sync folder automation
- Plugin architecture
- Multi-language support

## 📞 Support

For issues or questions:
1. Check README.md and SETUP_WINDOWS.md
2. Review rclone documentation: https://rclone.org
3. Report bugs via GitHub issues

---

**Built with ❤️ using Flutter & rclone**  
*Gridly Desktop - Advanced Drive Manager for Windows*
