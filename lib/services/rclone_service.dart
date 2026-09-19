import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as path;
import 'package:dio/dio.dart';
import 'package:archive/archive.dart';
import 'package:process_run/process_run.dart';
import 'package:file/file.dart' as fs;
import 'package:file/local.dart';

class RCloneService {
  static const String rcloneVersion = 'v1.68.2';
  static const int rcPort = 5572;
  
  final Dio _dio = Dio();
  final fs.FileSystem _fs = const LocalFileSystem();
  
  String? _rclonePath;
  Process? _rcloneProcess;
  bool _isRunning = false;
  bool _isInitialized = false;
  
  bool get isRunning => _isRunning;
  bool get isInitialized => _isInitialized;
  String? get rclonePath => _rclonePath;
  
  Future<void> initialize() async {
    if (_isInitialized) return;
    
    await _installRClone();
    _isInitialized = true;
  }
  
  Future<void> _installRClone() async {
    final appDir = await getApplicationSupportDirectory();
    final rcloneDir = Directory(path.join(appDir.path, 'rclone'));
    
    if (!await rcloneDir.exists()) {
      await rcloneDir.create(recursive: true);
    }
    
    final exePath = Platform.isWindows 
        ? path.join(rcloneDir.path, 'rclone.exe')
        : path.join(rcloneDir.path, 'rclone');
    
    if (await _fs.file(exePath).exists()) {
      _rclonePath = exePath;
      return;
    }
    
    // Download rclone
    final os = Platform.isWindows ? 'windows' : (Platform.isMacOS ? 'osx' : 'linux');
    final arch = Platform.isWindows ? 'amd64' : (Platform.isMacOS ? 'arm64' : 'amd64');
    final zipName = 'rclone-$rcloneVersion-$os-$arch.zip';
    final downloadUrl = 'https://github.com/rclone/rclone/releases/download/$rcloneVersion/$zipName';
    
    final tempDir = await getTemporaryDirectory();
    final zipPath = path.join(tempDir.path, zipName);
    final zipFile = _fs.file(zipPath);
    
    try {
      await _dio.download(downloadUrl, zipPath, onReceiveProgress: (received, total) {
        if (total != -1) {
          final progress = (received / total * 100).toStringAsFixed(1);
          print('Downloading rclone: $progress%');
        }
      });
      
      // Extract
      final bytes = await zipFile.readAsBytes();
      final archive = ZipDecoder().decodeBytes(bytes);
      
      for (final file in archive) {
        final filename = file.name;
        if (file.isFile) {
          final data = file.content as List<int>;
          final extractedPath = path.join(rcloneDir.path, path.basename(filename));
          await _fs.file(extractedPath).writeAsBytes(data);
          
          if (extractedPath.endsWith(Platform.isWindows ? 'rclone.exe' : 'rclone')) {
            _rclonePath = extractedPath;
            if (!Platform.isWindows) {
              await Process.run('chmod', ['+x', extractedPath]);
            }
          }
        }
      }
      
      await zipFile.delete();
      print('RClone installed at: $_rclonePath');
    } catch (e) {
      print('Error installing rclone: $e');
      rethrow;
    }
  }
  
  Future<void> startDaemon() async {
    if (_isRunning || _rclonePath == null) return;
    
    try {
      _rcloneProcess = await Process.start(
        _rclonePath!,
        ['rcd', '--rc-addr=:$rcPort', '--rc-user=admin', '--rc-pass=gridly2024'],
        runInShell: true,
      );
      
      _isRunning = true;
      
      // Wait for daemon to start
      await Future.delayed(const Duration(seconds: 2));
      
      print('RClone daemon started on port $rcPort');
    } catch (e) {
      print('Error starting rclone daemon: $e');
      _isRunning = false;
      rethrow;
    }
  }
  
  Future<void> stopDaemon() async {
    if (!_isRunning || _rcloneProcess == null) return;
    
    try {
      _rcloneProcess!.kill();
      _rcloneProcess = null;
      _isRunning = false;
      print('RClone daemon stopped');
    } catch (e) {
      print('Error stopping rclone daemon: $e');
    }
  }
  
  Future<Map<String, dynamic>> _makeRequest(String endpoint, [Map<String, dynamic>? params]) async {
    final url = 'http://localhost:$rcPort$endpoint';
    final response = await http.post(
      Uri.parse(url),
      headers: {
        'Content-Type': 'application/json',
      },
      body: jsonEncode(params ?? {}),
    ).timeout(const Duration(seconds: 30));
    
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('RClone API error: ${response.statusCode} - ${response.body}');
    }
  }
  
  // Config operations
  Future<List<Map<String, dynamic>>> listConfigs() async {
    final result = await _makeRequest('/config/list', {'opt': {'showPass': false}});
    final configs = result['remotes'] as List? ?? [];
    
    return configs.map((name) {
      return {'name': name, 'type': 'unknown'};
    }).toList();
  }
  
  Future<void> createConfig(String name, String type, Map<String, String> params) async {
    // Build config commands
    final configArgs = <String>[];
    configArgs.addAll(['config', 'create', name, type]);
    
    for (final entry in params.entries) {
      configArgs.add(entry.key);
      configArgs.add(entry.value);
    }
    
    configArgs.add('done');
    
    if (_rclonePath != null) {
      await Process.run(_rclonePath!, configArgs, runInShell: true);
    }
  }
  
  Future<void> deleteConfig(String name) async {
    if (_rclonePath != null) {
      await Process.run(_rclonePath!, ['config', 'delete', name], runInShell: true);
    }
  }
  
  // File operations
  Future<List<Map<String, dynamic>>> listFiles(String remote, String path) async {
    final result = await _makeRequest('/operations/listfiles', {
      'fs': remote,
      'remote': path,
      'recurse': false,
      'showHidden': true,
    });
    
    final files = result['list'] as List? ?? [];
    return files.map((f) {
      return {
        'name': f['Name'] ?? '',
        'path': f['Path'] ?? '',
        'size': f['Size'] ?? 0,
        'mimeType': f['MimeType'] ?? '',
        'isDir': f['IsDir'] ?? false,
        'modified': f['ModTime'] ?? '',
      };
    }).toList();
  }
  
  Future<Map<String, dynamic>> getStats(String remote, String path) async {
    final result = await _makeRequest('/operations/stats', {
      'fs': remote,
      'remote': path,
    });
    
    return {
      'count': result['count'] ?? 0,
      'bytes': result['bytes'] ?? 0,
    };
  }
  
  Future<void> createFolder(String remote, String path) async {
    await _makeRequest('/operations/mkdir', {
      'fs': remote,
      'remote': path,
    });
  }
  
  Future<void> deleteFile(String remote, String path) async {
    await _makeRequest('/operations/deletefile', {
      'fs': remote,
      'remote': path,
    });
  }
  
  Future<void> deleteFolder(String remote, String path) async {
    await _makeRequest('/operations/purge', {
      'fs': remote,
      'remote': path,
    });
  }
  
  Future<void> rename(String remote, String oldPath, String newPath) async {
    await _makeRequest('/operations/move', {
      'fs': remote,
      'remote': oldPath,
      'dstFs': remote,
      'dstRemote': newPath,
    });
  }
  
  Future<void> copy(String srcRemote, String srcPath, String dstRemote, String dstPath) async {
    await _makeRequest('/operations/copy', {
      'srcFs': srcRemote,
      'srcRemote': srcPath,
      'dstFs': dstRemote,
      'dstRemote': dstPath,
    });
  }
  
  Future<void> move(String srcRemote, String srcPath, String dstRemote, String dstPath) async {
    await _makeRequest('/operations/move', {
      'srcFs': srcRemote,
      'srcRemote': srcPath,
      'dstFs': dstRemote,
      'dstRemote': dstPath,
    });
  }
  
  Future<String> getDownloadUrl(String remote, String path) async {
    return 'http://admin:gridly2024@localhost:$rcPort/rc/operations/cat?fs=$remote&remote=${Uri.encodeComponent(path)}';
  }
  
  Future<Map<String, dynamic>> search(String remote, String query) async {
    final result = await _makeRequest('/operations/search', {
      'fs': remote,
      'query': query,
    });
    
    return result;
  }
  
  // Transfer operations with progress
  Future<String> startTransfer({
    required String srcFs,
    required String srcRemote,
    required String dstFs,
    required String dstRemote,
    required bool isCopy,
  }) async {
    final jobType = isCopy ? 'copy' : 'move';
    final result = await _makeRequest('/sync/$jobType', {
      'srcFs': '$srcFs:$srcRemote',
      'dstFs': '$dstFs:$dstRemote',
    });
    
    return result['jobid']?.toString() ?? '0';
  }
  
  Future<Map<String, dynamic>> getTransferStatus(String jobId) async {
    final result = await _makeRequest('/job/status', {'jobid': int.parse(jobId)});
    return {
      'state': result['state'] ?? 'UNKNOWN',
      'percent': result['percent'] ?? 0,
      'speed': result['speed'] ?? 0,
      'bytes': result['bytes'] ?? 0,
      'eta': result['eta'] ?? 0,
      'error': result['error'] ?? '',
    };
  }
  
  Future<List<Map<String, dynamic>>> listTransfers() async {
    final result = await _makeRequest('/job/list');
    final jobs = result['jobs'] as List? ?? [];
    
    return jobs.map((j) {
      return {
        'id': j['id'] ?? 0,
        'method': j['method'] ?? '',
        'startTime': j['startTime'] ?? '',
        'state': j['state'] ?? '',
        'percent': j['percent'] ?? 0,
      };
    }).toList();
  }
  
  void dispose() {
    stopDaemon();
  }
}
