import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/rclone_service.dart';
import '../models/models.dart';

class AuthModal extends StatefulWidget {
  const AuthModal({super.key});

  @override
  State<AuthModal> createState() => _AuthModalState();
}

enum AuthState { input, loading, success, error }

class _AuthModalState extends State<AuthModal> with SingleTickerProviderStateMixin {
  final TextEditingController _nameController = TextEditingController();
  late final RCloneService _rcloneService;

  AuthState _state = AuthState.input;
  String _statusMessage = '';
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _rcloneService = context.read<RCloneService>();
  }

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
    
    _pulseAnimation = Tween<double>(begin: 1.0, end: 1.05).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _nameController.dispose();
    _pulseController.dispose();
    _rcloneService.cancelAuthorize();
    super.dispose();
  }

  Future<void> _openUrl(String url) async {
    if (Platform.isWindows) {
      try {
        await Process.run('cmd', ['/c', 'start', '', url], runInShell: false);
        return;
      } catch (e) {
        print('[AUTH] cmd start failed: $e');
      }
    }
    try {
      final uri = Uri.parse(url);
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (e) {
      print('[AUTH] launchUrl failed: $e');
    }
  }

  Future<void> _handleConnect() async {
    final remoteName = _nameController.text.trim();
    if (remoteName.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a name for this drive.'), backgroundColor: Colors.orange),
      );
      return;
    }

    setState(() {
      _state = AuthState.loading;
      _statusMessage = 'Initiating secure connection...';
    });

    try {
      await _rcloneService.generateDriveLoginCode(
        (url) async {
          if (mounted) {
            setState(() {
              _statusMessage = 'Waiting for browser authorization...';
            });
          }
          await _openUrl(url);
        },
        (token) {
          _createConfigWithToken(token);
        },
      );

      // Wait for callback up to 120 seconds
      for (int i = 0; i < 120; i++) {
        await Future.delayed(const Duration(seconds: 1));
        if (!mounted || _state != AuthState.loading) return;
      }

      if (mounted && _state == AuthState.loading) {
        setState(() {
          _state = AuthState.error;
          _statusMessage = 'Connection timed out. Please try again.';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _state = AuthState.error;
          _statusMessage = e.toString();
        });
      }
    }
  }

  Future<void> _createConfigWithToken(String tokenStr) async {
    final remoteName = _nameController.text.trim();
    if (remoteName.isEmpty) return;
    
    setState(() {
      _statusMessage = 'Finalizing configuration...';
    });

    try {
      bool apiSuccess = false;
      try {
        await _rcloneService.createConfigViaApi(remoteName, 'drive', {
          'scope': 'drive',
          'token': tokenStr,
          'config_is_local': 'false',
        });
        apiSuccess = true;
      } catch (e) {}

      if (!apiSuccess) {
        await _rcloneService.createConfig(remoteName, 'drive', {
          'scope': 'drive',
          'token': tokenStr,
          'config_is_local': 'false',
        });
      }

      if (mounted) {
        final provider = context.read<AppProvider>();
        await provider.loadRemotes(_rcloneService);
        if (mounted) {
          setState(() {
            _state = AuthState.success;
            _statusMessage = 'Connected Successfully!';
          });
          
          await Future.delayed(const Duration(seconds: 2));
          if (mounted) {
            Navigator.pop(context);
          }
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _state = AuthState.error;
          _statusMessage = 'Error saving config: $e';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
      child: Container(
        width: 480,
        decoration: BoxDecoration(
          color: const Color(0xFF0F172A).withOpacity(0.95),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: Colors.white.withOpacity(0.08)),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF6366F1).withOpacity(0.15),
              blurRadius: 60,
              spreadRadius: -10,
              offset: const Offset(0, 20),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.only(left: 32, right: 24, top: 24, bottom: 16),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          const Color(0xFF6366F1).withOpacity(0.2),
                          const Color(0xFF8B5CF6).withOpacity(0.2),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFF6366F1).withOpacity(0.3)),
                    ),
                    child: const Icon(Icons.cloud_sync, color: Color(0xFFA5B4FC), size: 24),
                  ),
                  const SizedBox(width: 16),
                  const Expanded(
                    child: Text(
                      'Connect Drive',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        letterSpacing: -0.5,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close, color: Colors.white38),
                    splashRadius: 20,
                  ),
                ],
              ),
            ),
            
            Divider(color: Colors.white.withOpacity(0.05), height: 1),

            // Body
            Padding(
              padding: const EdgeInsets.all(32),
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 400),
                transitionBuilder: (child, animation) {
                  return FadeTransition(
                    opacity: animation,
                    child: SlideTransition(
                      position: Tween<Offset>(
                        begin: const Offset(0, 0.05),
                        end: Offset.zero,
                      ).animate(animation),
                      child: child,
                    ),
                  );
                },
                child: _buildStateContent(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStateContent() {
    switch (_state) {
      case AuthState.input:
        return _buildInputState();
      case AuthState.loading:
        return _buildLoadingState();
      case AuthState.success:
        return _buildSuccessState();
      case AuthState.error:
        return _buildErrorState();
    }
  }

  Widget _buildInputState() {
    return Column(
      key: const ValueKey('input'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text(
          'Choose a memorable name for this drive connection. You will be redirected to your browser to authorize access securely.',
          style: TextStyle(color: Colors.white54, fontSize: 14, height: 1.5),
        ),
        const SizedBox(height: 24),
        Container(
          decoration: BoxDecoration(
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.2),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: TextField(
            controller: _nameController,
            style: const TextStyle(color: Colors.white, fontSize: 15),
            decoration: InputDecoration(
              hintText: 'e.g. MyPersonalDrive',
              hintStyle: const TextStyle(color: Colors.white24),
              filled: true,
              fillColor: const Color(0xFF1E293B),
              prefixIcon: const Icon(Icons.drive_file_rename_outline, color: Colors.white38, size: 20),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFF6366F1), width: 1.5),
              ),
            ),
          ),
        ),
        const SizedBox(height: 32),
        ElevatedButton(
          onPressed: _handleConnect,
          style: ElevatedButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 18),
            backgroundColor: const Color(0xFF6366F1),
            foregroundColor: Colors.white,
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          child: const Text(
            'Connect Google Drive',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.5,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildLoadingState() {
    return Column(
      key: const ValueKey('loading'),
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: 20),
        ScaleTransition(
          scale: _pulseAnimation,
          child: Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: const Color(0xFF6366F1).withOpacity(0.1),
              border: Border.all(color: const Color(0xFF6366F1).withOpacity(0.3), width: 2),
            ),
            child: const Center(
              child: SizedBox(
                width: 30,
                height: 30,
                child: CircularProgressIndicator(
                  color: Color(0xFF818CF8),
                  strokeWidth: 3,
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 32),
        Text(
          _statusMessage,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 16,
            fontWeight: FontWeight.w500,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 12),
        const Text(
          'Please complete the authorization in the browser window that just opened.',
          style: TextStyle(
            color: Colors.white38,
            fontSize: 13,
            height: 1.5,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 20),
      ],
    );
  }

  Widget _buildSuccessState() {
    return Column(
      key: const ValueKey('success'),
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: 20),
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: const Color(0xFF10B981).withOpacity(0.1),
            border: Border.all(color: const Color(0xFF10B981).withOpacity(0.3), width: 2),
          ),
          child: const Icon(
            Icons.check_rounded,
            color: Color(0xFF34D399),
            size: 40,
          ),
        ),
        const SizedBox(height: 32),
        Text(
          _statusMessage,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 32),
      ],
    );
  }

  Widget _buildErrorState() {
    return Column(
      key: const ValueKey('error'),
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Icon(Icons.error_outline, color: Color(0xFFEF4444), size: 60),
        const SizedBox(height: 24),
        const Text(
          'Authentication Failed',
          style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 12),
        Text(
          _statusMessage,
          style: const TextStyle(color: Colors.redAccent, fontSize: 13),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 32),
        OutlinedButton(
          onPressed: () => setState(() => _state = AuthState.input),
          style: OutlinedButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 16),
            foregroundColor: Colors.white,
            side: BorderSide(color: Colors.white.withOpacity(0.2)),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
          child: const Text('Try Again'),
        ),
      ],
    );
  }
}
