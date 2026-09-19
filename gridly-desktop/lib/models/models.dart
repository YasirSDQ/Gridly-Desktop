import 'package:flutter/foundation.dart';

class RemoteConfig {
  final String name;
  final String type;
  final Map<String, dynamic> options;

  RemoteConfig({
    required this.name,
    required this.type,
    this.options = const {},
  });

  factory RemoteConfig.fromJson(Map<String, dynamic> json) {
    return RemoteConfig(
      name: json['name'] ?? '',
      type: json['type'] ?? 'drive',
      options: json['options'] ?? {},
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'type': type,
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
  bool _isLoading = false;
  String? _error;
  
  List<RemoteConfig> get remotes => _remotes;
  List<FileItem> get currentFiles => _currentFiles;
  List<TransferJob> get activeTransfers => _activeTransfers;
  String get currentRemote => _currentRemote;
  String get currentPath => _currentPath;
  bool get isLoading => _isLoading;
  String? get error => _error;
  
  Future<void> loadRemotes() async {
    // Will be implemented with service
    notifyListeners();
  }
  
  void navigateTo(String remote, String path) {
    _currentRemote = remote;
    _currentPath = path;
    notifyListeners();
  }
  
  void setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }
  
  void setError(String? error) {
    _error = error;
    notifyListeners();
  }
  
  void addTransfer(TransferJob job) {
    _activeTransfers.add(job);
    notifyListeners();
  }
  
  void updateTransfer(String id, Map<String, dynamic> updates) {
    final index = _activeTransfers.indexWhere((t) => t.id == id);
    if (index != -1) {
      notifyListeners();
    }
  }
  
  void removeTransfer(String id) {
    _activeTransfers.removeWhere((t) => t.id == id);
    notifyListeners();
  }
}
