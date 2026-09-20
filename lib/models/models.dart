import 'package:flutter/foundation.dart';
import 'dart:async';
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class RemoteConfig {
  final String name;
  final String type;
  final int totalBytes;
  final int usedBytes;
  final bool isExpired;
  final Map<String, dynamic> options;

  RemoteConfig({
    required this.name,
    required this.type,
    this.totalBytes = 0,
    this.usedBytes = 0,
    this.isExpired = false,
    this.options = const {},
  });

  factory RemoteConfig.fromJson(Map<String, dynamic> json) {
    return RemoteConfig(
      name: json['name'] ?? '',
      type: json['type'] ?? 'drive',
      isExpired: json['isExpired'] ?? false,
      options: json['options'] ?? {},
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'type': type,
      'isExpired': isExpired,
      'options': options,
    };
  }
}

class FileItem {
  final String name;
  final String path;
  final int size;
  final String mimeType;
  final bool isDir;
  final DateTime? modified;
  final String? iconUrl;

  FileItem({
    required this.name,
    required this.path,
    this.size = 0,
    this.mimeType = '',
    this.isDir = false,
    this.modified,
    this.iconUrl,
  });

  factory FileItem.fromJson(Map<String, dynamic> json) {
    return FileItem(
      name: json['name'] ?? '',
      path: json['path'] ?? '',
      size: json['size'] ?? 0,
      mimeType: json['mimeType'] ?? '',
      isDir: json['isDir'] ?? false,
      modified: json['modified'] != null 
          ? DateTime.tryParse(json['modified']) 
          : null,
      iconUrl: json['iconUrl'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'path': path,
      'size': size,
      'mimeType': mimeType,
      'isDir': isDir,
      'modified': modified?.toIso8601String(),
      'iconUrl': iconUrl,
    };
  }

  String get formattedSize {
    if (isDir) return '--';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    int unitIndex = 0;
    double size = this.size.toDouble();

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return '${size.toStringAsFixed(1)} ${units[unitIndex]}';
  }
}

class TransferJob {
  final String id;
  final String method;
  final String source;
  final String destination;
  final String state;
  final double percent;
  final int speed;
  final int bytes;
  final int eta;
  final String error;
  final DateTime startTime;

  TransferJob({
    required this.id,
    required this.method,
    required this.source,
    required this.destination,
    required this.state,
    this.percent = 0,
    this.speed = 0,
    this.bytes = 0,
    this.eta = 0,
    this.error = '',
    required this.startTime,
  });

  factory TransferJob.fromJson(Map<String, dynamic> json) {
    return TransferJob(
      id: json['id']?.toString() ?? '',
      method: json['method'] ?? '',
      source: json['source'] ?? '',
      destination: json['destination'] ?? '',
      state: json['state'] ?? 'UNKNOWN',
      percent: (json['percent'] ?? 0).toDouble(),
      speed: json['speed'] ?? 0,
      bytes: json['bytes'] ?? 0,
      eta: json['eta'] ?? 0,
      error: json['error'] ?? '',
      startTime: json['startTime'] != null
          ? DateTime.tryParse(json['startTime']) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  TransferJob copyWith({
    String? state,
    double? percent,
    int? speed,
    int? bytes,
    int? eta,
    String? error,
  }) {
    return TransferJob(
      id: id,
      method: method,
      source: source,
      destination: destination,
      state: state ?? this.state,
      percent: percent ?? this.percent,
      speed: speed ?? this.speed,
      bytes: bytes ?? this.bytes,
      eta: eta ?? this.eta,
      error: error ?? this.error,
      startTime: startTime,
    );
  }

  String get formattedSpeed {
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    int unitIndex = 0;
    double spd = speed.toDouble();

    while (spd >= 1024 && unitIndex < units.length - 1) {
      spd /= 1024;
      unitIndex++;
    }

    return '${spd.toStringAsFixed(1)} ${units[unitIndex]}';
  }

  String get formattedEta {
    if (eta <= 0) return '--';

    final hours = eta ~/ 3600;
    final minutes = (eta % 3600) ~/ 60;
    final seconds = eta % 60;

    if (hours > 0) {
      return '${hours}h ${minutes}m';
    } else if (minutes > 0) {
      return '${minutes}m ${seconds}s';
    } else {
      return '${seconds}s';
    }
  }
}

class AppProvider extends ChangeNotifier {
  List<RemoteConfig> _remotes = [];
  List<FileItem> _currentFiles = [];
  List<TransferJob> _activeTransfers = [];

  String _currentRemote = '';
  String _currentPath = '';
  String _currentTab = 'drive'; // 'drive', 'transfers', 'settings'
  bool _isLoading = false;
  bool _requiresReauth = false;
  bool _cacheEnabled = true;
  bool _isSharedWithMe = false;
  String? _error;
  
  Timer? _refreshTimer;
  dynamic _lastRcloneService;

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  List<RemoteConfig> get remotes => _remotes;
  List<FileItem> get currentFiles => _currentFiles;
  List<TransferJob> get activeTransfers => _activeTransfers;
  String get currentRemote => _currentRemote;
  String get currentPath => _currentPath;
  String get currentTab => _currentTab;
  int get fileCount => _currentFiles.where((f) => !f.isDir).length;
  int get folderCount => _currentFiles.where((f) => f.isDir).length;
  
  bool get isLoading => _isLoading;
  bool get requiresReauth => _requiresReauth;
  String? get error => _error;
  bool get cacheEnabled => _cacheEnabled;
  bool get isSharedWithMe => _isSharedWithMe;

  Future<void> initCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      
      _cacheEnabled = prefs.getBool('settings_cache_enabled') ?? true;
      if (!_cacheEnabled) return;
      
      _currentRemote = prefs.getString('cached_current_remote') ?? '';
      _currentPath = prefs.getString('cached_current_path') ?? '';
      
      final remotesStr = prefs.getString('cached_remotes');
      if (remotesStr != null) {
        final List decoded = jsonDecode(remotesStr);
        _remotes = decoded.map((e) => RemoteConfig.fromJson(e)).toList();
      }

      if (_currentRemote.isNotEmpty) {
        final filesStr = prefs.getString('cached_files_${_currentRemote}_$_currentPath');
        if (filesStr != null) {
          final List decoded = jsonDecode(filesStr);
          _currentFiles = decoded.map((e) => FileItem.fromJson(e)).toList();
        }
      }
      
      notifyListeners();
    } catch (e) {
      print('Failed to load cache: $e');
    }
  }

  Future<void> _saveCache() async {
    if (!_cacheEnabled) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('cached_current_remote', _currentRemote);
      await prefs.setString('cached_current_path', _currentPath);
      
      final remotesStr = jsonEncode(_remotes.map((e) => e.toJson()).toList());
      await prefs.setString('cached_remotes', remotesStr);
      
      if (_currentRemote.isNotEmpty && _currentFiles.isNotEmpty) {
        final filesStr = jsonEncode(_currentFiles.map((e) => e.toJson()).toList());
        await prefs.setString('cached_files_${_currentRemote}_$_currentPath', filesStr);
      }
    } catch (e) {
      print('Failed to save cache: $e');
    }
  }

  Future<void> setCacheEnabled(bool value) async {
    _cacheEnabled = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('settings_cache_enabled', value);
    if (!value) {
      await clearCache();
    } else {
      await _saveCache();
    }
    notifyListeners();
  }

  Future<void> clearCache() async {
    final prefs = await SharedPreferences.getInstance();
    final keys = prefs.getKeys();
    for (String key in keys) {
      if (key.startsWith('cached_')) {
        await prefs.remove(key);
      }
    }
  }

  void switchTab(String tab) {
    if (_currentTab != tab) {
      _currentTab = tab;
      notifyListeners();
    }
  }

  Future<void> loadRemotes(dynamic rcloneService) async {
    setLoading(true);
    try {
      final configs = await rcloneService.listConfigs();
      final List<RemoteConfig> newRemotes = [];

      for (final c in configs) {
        final name = c['name'];
        final type = c['type'] ?? 'unknown';
        final about = await rcloneService.getAbout(name);

        newRemotes.add(RemoteConfig(
          name: name,
          type: type,
          totalBytes: about['total'] ?? 0,
          usedBytes: about['used'] ?? 0,
          isExpired: about['isExpired'] == true,
        ));
      }
      _remotes = newRemotes;

      if (_remotes.isNotEmpty) {
        // If current remote is still valid, keep it; otherwise switch to first
        final stillExists = _remotes.any((r) => r.name == _currentRemote);
        if (!stillExists || _currentRemote.isEmpty) {
          await navigateTo(_remotes.first.name, '', rcloneService);
        } else {
          // Refresh current view
          await navigateTo(_currentRemote, _currentPath, rcloneService);
        }
      } else {
        // No remotes left — clear state
        _currentRemote = '';
        _currentPath = '';
        _currentFiles = [];
        _requiresReauth = false;
        setError(null);
        _saveCache();
      }
    } catch (e) {
      setError(e.toString());
    } finally {
      setLoading(false);
    }
  }

  Future<void> navigateTo(
      String remote, String path, dynamic rcloneService, {bool? shared}) async {
    if (shared != null) {
      _isSharedWithMe = shared;
    }
    
    // If we're navigating to a DIFFERENT path or mode, try to load cache immediately for instant UI update
    if (_currentRemote != remote || _currentPath != path) {
       _currentFiles = [];
       if (_cacheEnabled) {
         try {
           final prefs = await SharedPreferences.getInstance();
           final filesStr = prefs.getString('cached_files_${remote}_$path');
           if (filesStr != null) {
             final List decoded = jsonDecode(filesStr);
             _currentFiles = decoded.map((e) => FileItem.fromJson(e)).toList();
           }
         } catch (e) {
           print('Error loading cache for navigation: $e');
         }
       }
    }
    _currentRemote = remote;
    _currentPath = path;
    _currentTab = 'drive';
    _requiresReauth = false;

    setLoading(true);
    try {
      final files = await rcloneService.listFiles(remote, path, shared: _isSharedWithMe);
      _currentFiles = files.map((f) => FileItem.fromJson(f)).toList();

      // Sort: Folders first, then alphabetically
      _currentFiles.sort((a, b) {
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;
        return a.name.toLowerCase().compareTo(b.name.toLowerCase());
      });
      
      setError(null);
      _saveCache();
      _setupAutoRefresh(rcloneService);
    } catch (e) {
      setError(e.toString());
    } finally {
      setLoading(false);
    }
  }

  void _setupAutoRefresh(dynamic rcloneService) {
    _refreshTimer?.cancel();
    _lastRcloneService = rcloneService;
    _refreshTimer = Timer.periodic(const Duration(seconds: 5), (_) async {
      if (_currentRemote.isNotEmpty && _currentTab == 'drive' && !_requiresReauth) {
        try {
          final files = await _lastRcloneService.listFiles(_currentRemote, _currentPath, shared: _isSharedWithMe);
          _currentFiles = files.map((f) => FileItem.fromJson(f)).toList();

          _currentFiles.sort((a, b) {
            if (a.isDir && !b.isDir) return -1;
            if (!a.isDir && b.isDir) return 1;
            return a.name.toLowerCase().compareTo(b.name.toLowerCase());
          });
          
          _saveCache();
          notifyListeners();
        } catch (e) {
          // Ignore background refresh errors unless it's an auth error
          _checkAuthError(e.toString());
        }
      }
    });
  }

  void setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  void _checkAuthError(String errStr) {
    final lowerErr = errStr.toLowerCase();
    if (lowerErr.contains('expired') ||
        lowerErr.contains('oauth') ||
        lowerErr.contains('token') ||
        lowerErr.contains('auth')) {
      _requiresReauth = true;
      notifyListeners();
    }
  }

  void setError(String? error) {
    _error = error;
    if (error != null) {
      _checkAuthError(error);
    }
    notifyListeners();
  }

  void addTransfer(TransferJob job) {
    _activeTransfers.add(job);
    notifyListeners();
  }

  void updateTransfer(String id, Map<String, dynamic> updates) {
    final index = _activeTransfers.indexWhere((t) => t.id == id);
    if (index != -1) {
      final old = _activeTransfers[index];
      _activeTransfers[index] = old.copyWith(
        state: updates['state'],
        percent: updates['percent']?.toDouble(),
        speed: updates['speed'],
        bytes: updates['bytes'],
        eta: updates['eta'],
        error: updates['error'],
      );
      notifyListeners();
    }
  }

  Future<void> startTransferAndPoll(
    dynamic rcloneService, {
    required String srcRemote,
    required String srcPath,
    required String dstRemote,
    required String dstPath,
    required bool isCopy,
    required bool isFile,
    required bool serverSide,
  }) async {
    try {
      final jobId = await rcloneService.startTransfer(
        srcFs: srcRemote,
        srcRemote: srcPath,
        dstFs: dstRemote,
        dstRemote: dstPath,
        isCopy: isCopy,
        isFile: isFile,
      );

      final job = TransferJob(
        id: jobId,
        method: isCopy ? 'Copy' : 'Move',
        source: '$srcRemote:$srcPath',
        destination: '$dstRemote:$dstPath',
        state: 'RUNNING',
        startTime: DateTime.now(),
      );
      addTransfer(job);

      _pollTransfer(jobId, rcloneService);
    } catch (e) {
      print('Transfer failed to start: $e');
    }
  }

  void _pollTransfer(String jobId, dynamic rcloneService) async {
    bool isDone = false;
    while (!isDone) {
      await Future.delayed(const Duration(seconds: 1));
      try {
        final status = await rcloneService.getTransferStatus(jobId);
        updateTransfer(jobId, status);

        if (status['state'] == 'DONE' ||
            status['state'] == 'ERROR' ||
            status['percent'] >= 100) {
          isDone = true;
        }
      } catch (e) {
        print('Polling error: $e');
        updateTransfer(jobId, {'state': 'ERROR', 'error': e.toString()});
        isDone = true;
      }
    }
  }

  void removeTransfer(String id) {
    _activeTransfers.removeWhere((t) => t.id == id);
    notifyListeners();
  }
}
