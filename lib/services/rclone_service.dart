import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as path;
import 'package:dio/dio.dart';
import 'package:archive/archive.dart';
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
    // 1. Check project-local rclone directory first (bundled with the app)
    final localRclone = Platform.isWindows
        ? r'd:\Data\Softwares\Programs\Project Tools Scripts\Projects\Desktop App\Gridly-Desktop\rclone\rclone.exe'
        : '';
    if (Platform.isWindows && await _fs.file(localRclone).exists()) {
      _rclonePath = localRclone;
      print('Using local rclone: $_rclonePath');
      return;
    }

    // 2. Check if rclone is on PATH
    try {
      final whichResult = await Process.run('where', ['rclone'], runInShell: true);
      if (whichResult.exitCode == 0) {
        final found = whichResult.stdout.toString().trim().split('\n').first.trim();
        if (found.isNotEmpty) {
          _rclonePath = found;
          print('Using system rclone: $_rclonePath');
          return;
        }
      }
    } catch (_) {}

    // 3. Check AppData install
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
      print('Using AppData rclone: $_rclonePath');
      return;
    }

    // 4. Download rclone
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
          print('Downloading rclone: ${(received / total * 100).toStringAsFixed(1)}%');
        }
      });
      final bytes = await zipFile.readAsBytes();
      final archive = ZipDecoder().decodeBytes(bytes);
      for (final file in archive) {
        if (file.isFile) {
          final data = file.content as List<int>;
          final extractedPath = path.join(rcloneDir.path, path.basename(file.name));
          await _fs.file(extractedPath).writeAsBytes(data);
          if (extractedPath.endsWith(Platform.isWindows ? 'rclone.exe' : 'rclone')) {
            _rclonePath = extractedPath;
            if (!Platform.isWindows) await Process.run('chmod', ['+x', extractedPath]);
          }
        }
      }
      await zipFile.delete();
      print('RClone downloaded to: $_rclonePath');
    } catch (e) {
      print('Error downloading rclone: $e');
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
        'Authorization': 'Basic ${base64Encode(utf8.encode('admin:gridly2024'))}',
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
    final result = await _makeRequest('/config/dump');
    
    final List<Map<String, dynamic>> configs = [];
    result.forEach((name, data) {
      if (data is Map) {
        configs.add({
          'name': name,
          'type': data['type'] ?? 'unknown',
        });
      }
    });
    
    return configs;
  }
  
  Future<void> createConfig(String name, String type, Map<String, String> params) async {
    // Build config commands
    final configArgs = <String>[];
    configArgs.addAll(['config', 'create', name, type]);
    
    for (final entry in params.entries) {
      configArgs.add(entry.key);
      configArgs.add(entry.value);
    }
    
    if (_rclonePath != null) {
      await Process.run(_rclonePath!, configArgs, runInShell: true);
      // Reload the config into the running daemon
      try { await _makeRequest('/config/reload'); } catch (_) {}
    }
  }
  
  Future<void> deleteConfig(String name) async {
    if (_rclonePath != null) {
      await Process.run(_rclonePath!, ['config', 'delete', name], runInShell: true);
      try { await _makeRequest('/config/reload'); } catch (_) {}
    }
  }

  // Create config via RC API so the running daemon picks it up immediately
  // Parameters must be flat (rclone RC API format)
  Future<void> createConfigViaApi(String name, String type, Map<String, String> params) async {
    final Map<String, dynamic> body = {
      'name': name,
      'type': type,
      ...params,  // flat, not nested
    };
    await _makeRequest('/config/create', body);
  }

  Process? _authorizeProcess;
  bool _urlAlreadySent = false;
  void Function(String)? _onTokenCallback;

  Future<void> generateDriveLoginCode(
    void Function(String url) onUrlReceived,
    void Function(String token) onTokenReceived,
  ) async {
    if (_rclonePath == null) throw Exception('RClone not found. Path: $_rclonePath');

    _authorizeProcess?.kill();
    _urlAlreadySent = false;
    _onTokenCallback = onTokenReceived;

    print('[AUTH] Starting rclone authorize at: $_rclonePath');

    _authorizeProcess = await Process.start(
      _rclonePath!,
      ['authorize', 'drive'],
      runInShell: true, // keep consistent with daemon — shell handles PATH & pipes correctly
    );

    final stdoutStream = _authorizeProcess!.stdout.transform(utf8.decoder);
    final stderrStream = _authorizeProcess!.stderr.transform(utf8.decoder);

    String accumulated = '';
    final urlRegex = RegExp(r'http://127\.0\.0\.1:\d+/auth\?[^\s"<]+');
    final tokenJsonRegex = RegExp(r'\{[^{}]*"access_token"[^{}]*\}', dotAll: true);

    void processChunk(String chunk) {
      print('[AUTH OUTPUT] $chunk');
      accumulated += chunk;

      if (!_urlAlreadySent) {
        final urlMatch = urlRegex.firstMatch(accumulated);
        if (urlMatch != null) {
          _urlAlreadySent = true;
          final url = urlMatch.group(0)!.trimRight();
          print('[AUTH] URL found: $url');
          onUrlReceived(url);
        }
      }

      if (accumulated.contains('access_token')) {
        final tokenMatch = tokenJsonRegex.firstMatch(accumulated);
        if (tokenMatch != null) {
          final maybeJson = tokenMatch.group(0)!;
          try {
            jsonDecode(maybeJson);
            print('[AUTH] Token found!');
            _onTokenCallback?.call(maybeJson);
            _onTokenCallback = null;
            accumulated = '';
          } catch (_) {}
        }
      }
    }

    stderrStream.listen(processChunk, onError: (e) => print('[AUTH STDERR ERR] $e'));
    stdoutStream.listen(processChunk, onError: (e) => print('[AUTH STDOUT ERR] $e'));
  }
  
  void cancelAuthorize() {
    _authorizeProcess?.kill();
    _authorizeProcess = null;
  }
  
  // File operations
  Future<List<Map<String, dynamic>>> listFiles(String remote, String path) async {
    // /operations/list is the correct RC endpoint (not listfiles)
    // Keep params simple — don't nest under 'opt'
    final result = await _makeRequest('/operations/list', {
      'fs': '$remote:',
      'remote': path,
    });

    final files = result['list'] as List? ?? [];
    return files.map<Map<String, dynamic>>((f) {
      return {
        'name': f['Name'] ?? '',
        'path': f['Path'] ?? '',
        'size': (f['Size'] is int) ? f['Size'] : 0,
        'mimeType': f['MimeType'] ?? '',
        'isDir': f['IsDir'] ?? false,
        'modified': f['ModTime'] ?? '',
      };
    }).toList();
  }
  
  Future<Map<String, dynamic>> getAbout(String remote) async {
    try {
      final result = await _makeRequest('/operations/about', {
        'fs': '$remote:',
      });
      return {
        'total': result['total'] ?? 0,
        'used': result['used'] ?? 0,
        'free': result['free'] ?? 0,
      };
    } catch (e) {
      // Some remotes don't support about (e.g. local without right flags, or specific cloud providers)
      return {'total': 0, 'used': 0, 'free': 0};
    }
  }

  Future<Map<String, dynamic>> getStats(String remote, String path) async {
    final result = await _makeRequest('/operations/stats', {
      'fs': '$remote:',
      'remote': path,
    });
    
    return {
      'count': result['count'] ?? 0,
      'bytes': result['bytes'] ?? 0,
    };
  }
  
  Future<void> createFolder(String remote, String path) async {
    await _makeRequest('/operations/mkdir', {
      'fs': '$remote:',
      'remote': path,
    });
  }
  
  Future<void> deleteFile(String remote, String path) async {
    await _makeRequest('/operations/deletefile', {
      'fs': '$remote:',
      'remote': path,
    });
  }
  
  Future<void> deleteFolder(String remote, String path) async {
    await _makeRequest('/operations/purge', {
      'fs': '$remote:',
      'remote': path,
    });
  }
  
  Future<void> rename(String remote, String oldPath, String newPath) async {
    await _makeRequest('/operations/move', {
      'srcFs': '$remote:',
      'srcRemote': oldPath,
      'dstFs': '$remote:',
      'dstRemote': newPath,
    });
  }
  
  Future<void> copy(String srcRemote, String srcPath, String dstRemote, String dstPath) async {
    await _makeRequest('/operations/copy', {
      'srcFs': '$srcRemote:',
      'srcRemote': srcPath,
      'dstFs': '$dstRemote:',
      'dstRemote': dstPath,
    });
  }
  
  Future<void> move(String srcRemote, String srcPath, String dstRemote, String dstPath) async {
    await _makeRequest('/operations/move', {
      'srcFs': '$srcRemote:',
      'srcRemote': srcPath,
      'dstFs': '$dstRemote:',
      'dstRemote': dstPath,
    });
  }
  
  Future<String> getDownloadUrl(String remote, String path) async {
    return 'http://admin:gridly2024@localhost:$rcPort/rc/operations/cat?fs=$remote:&remote=${Uri.encodeComponent(path)}';
  }
  
  Future<Map<String, dynamic>> search(String remote, String query) async {
    final result = await _makeRequest('/operations/search', {
      'fs': '$remote:',
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
    bool isFile = true,
  }) async {
    String endpoint;
    Map<String, dynamic> params;
    
    if (isFile) {
      endpoint = isCopy ? '/operations/copyfile' : '/operations/movefile';
      params = {
        'srcFs': '$srcFs:',
        'srcRemote': srcRemote,
        'dstFs': '$dstFs:',
        'dstRemote': dstRemote,
        '_async': true,
      };
    } else {
      endpoint = isCopy ? '/sync/copy' : '/sync/move';
      params = {
        'srcFs': '$srcFs:$srcRemote',
        'dstFs': '$dstFs:$dstRemote',
        '_async': true,
      };
    }
    
    final result = await _makeRequest(endpoint, params);
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
