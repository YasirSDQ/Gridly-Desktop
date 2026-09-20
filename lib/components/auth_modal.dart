import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

import '../services/rclone_service.dart';
import '../models/models.dart';

class AuthModal extends StatefulWidget {
  const AuthModal({super.key});

  @override
  State<AuthModal> createState() => _AuthModalState();
}

class _AuthModalState extends State<AuthModal> {
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _codeController = TextEditingController();
  late final RCloneService _rcloneService;

  bool _loadingCode = false;
  bool _loadingSubmit = false;
  String? _authUrl; // the URL to show the user

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _rcloneService = context.read<RCloneService>();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _codeController.dispose();
    _rcloneService.cancelAuthorize();
    super.dispose();
  }

  // Open URL: try url_launcher first, fall back to Windows start command
  Future<void> _openUrl(String url) async {
    final uri = Uri.parse(url);
    bool launched = false;
    try {
      launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {}

    if (!launched && Platform.isWindows) {
      try {
        await Process.run('cmd', ['/c', 'start', '', url], runInShell: false);
      } catch (_) {}
    }
  }

  Future<void> _handleGenerateCode() async {
    final remoteName = _nameController.text.trim();
    if (remoteName.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a Remote Name first.'), backgroundColor: Colors.orange),
      );
      return;
    }

    setState(() {
      _loadingCode = true;
      _authUrl = null;
    });

    try {
      await _rcloneService.generateDriveLoginCode(
        (url) async {
          // URL received — show it and open browser
          if (mounted) {
            setState(() {
              _authUrl = url;
              _loadingCode = false;
            });
          }
          await _openUrl(url);
        },
        (token) {
          // Token received automatically after browser auth
          _createConfigWithToken(token);
        },
      );

      // Safety timeout: reset button after 60s if URL never received
      await Future.delayed(const Duration(seconds: 60));
      if (mounted && _loadingCode) {
        setState(() => _loadingCode = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Auth timed out. Please try again.'),
            backgroundColor: Colors.orange,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
        setState(() => _loadingCode = false);
      }
    }
  }

  Future<void> _handleSubmitUrl() async {
    final codeValue = _codeController.text.trim();
    final remoteName = _nameController.text.trim();

    if (remoteName.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a Remote Name.'), backgroundColor: Colors.orange),
      );
      return;
    }
    if (codeValue.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please paste the callback URL or JSON token.'), backgroundColor: Colors.orange),
      );
      return;
    }

    setState(() => _loadingSubmit = true);

    try {
      if (codeValue.startsWith('{')) {
        // Direct JSON token
        await _createConfigWithToken(codeValue);
      } else if (codeValue.startsWith('http://127.0.0.1') || codeValue.startsWith('http://localhost')) {
        // Callback URL — hit it so rclone captures the auth code
        try {
          await http.get(Uri.parse(codeValue)).timeout(const Duration(seconds: 10));
        } catch (_) {
          // Expected: rclone closes the connection immediately
        }

        // Wait up to 10s for the token callback to fire
        for (int i = 0; i < 10; i++) {
          await Future.delayed(const Duration(seconds: 1));
          if (!mounted || !_loadingSubmit) return; // token came in and closed modal
        }

        if (mounted) {
          setState(() => _loadingSubmit = false);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Did not receive token. Try clicking Generate again.'),
              backgroundColor: Colors.red,
            ),
          );
        }
      } else {
        throw Exception('Invalid input. Paste the callback URL (http://127.0.0.1:...) or JSON token.');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
        );
        setState(() => _loadingSubmit = false);
      }
    }
  }

  Future<void> _createConfigWithToken(String tokenStr) async {
    final remoteName = _nameController.text.trim();
    if (remoteName.isEmpty) return;

    try {
      // Try RC API first (daemon picks it up immediately)
      bool apiSuccess = false;
      try {
        await _rcloneService.createConfigViaApi(remoteName, 'drive', {
          'scope': 'drive',
          'token': tokenStr,
        });
        apiSuccess = true;
      } catch (_) {}

      // Fall back to subprocess + reload
      if (!apiSuccess) {
        await _rcloneService.createConfig(remoteName, 'drive', {
          'scope': 'drive',
          'token': tokenStr,
        });
      }

      if (mounted) {
        final provider = context.read<AppProvider>();
        await provider.loadRemotes(_rcloneService);
        if (mounted) {
          Navigator.pop(context);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('✅ Connected "$remoteName" successfully!'),
              backgroundColor: const Color(0xFF10B981),
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error adding account: $e'), backgroundColor: Colors.red),
        );
        setState(() => _loadingSubmit = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
      child: Container(
        width: 520,
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.85,
        ),
        decoration: BoxDecoration(
          color: const Color(0xFF0F172A),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withOpacity(0.1)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.5),
              blurRadius: 30,
              offset: const Offset(0, 15),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                border: Border(bottom: BorderSide(color: Colors.white.withOpacity(0.08))),
              ),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: const Color(0xFF6366F1).withOpacity(0.2),
                      border: Border.all(color: const Color(0xFF6366F1).withOpacity(0.3)),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.add_to_drive, color: Color(0xFF818CF8), size: 22),
                  ),
                  const SizedBox(width: 14),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Connect Google Drive',
                            style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold)),
                        Text('Headless auth via rclone',
                            style: TextStyle(color: Colors.white38, fontSize: 12)),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close, color: Colors.white38, size: 18),
                  ),
                ],
              ),
            ),

            // Scrollable body
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(22),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Step 1: Remote Name
                    _SectionLabel(label: 'STEP 1 — NAME YOUR ACCOUNT'),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _nameController,
                      style: const TextStyle(color: Colors.white),
                      decoration: _inputDecoration('e.g.  mydrive'),
                    ),

                    const SizedBox(height: 20),

                    // Step 2: Generate
                    _SectionLabel(label: 'STEP 2 — GENERATE LOGIN URL'),
                    const SizedBox(height: 8),
                    ElevatedButton.icon(
                      onPressed: _loadingCode ? null : _handleGenerateCode,
                      icon: _loadingCode
                          ? const SizedBox(width: 16, height: 16,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : const Icon(Icons.code, size: 18),
                      label: Text(_loadingCode ? 'WAITING FOR RCLONE...' : 'GENERATE LOGIN CODE',
                          style: const TextStyle(fontWeight: FontWeight.bold, letterSpacing: 0.5)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFE11D48),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),

                    // Show the auth URL if we have it
                    if (_authUrl != null) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E3A5F),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFF3B82F6).withOpacity(0.4)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.link, color: Color(0xFF60A5FA), size: 16),
                                const SizedBox(width: 8),
                                const Text('Auth URL (opened in browser)',
                                    style: TextStyle(color: Color(0xFF60A5FA), fontSize: 12, fontWeight: FontWeight.w600)),
                                const Spacer(),
                                GestureDetector(
                                  onTap: () {
                                    Clipboard.setData(ClipboardData(text: _authUrl!));
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text('URL copied!')),
                                    );
                                  },
                                  child: const Icon(Icons.copy, color: Color(0xFF60A5FA), size: 16),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(_authUrl!,
                                style: const TextStyle(color: Colors.white54, fontSize: 11),
                                overflow: TextOverflow.ellipsis),
                            const SizedBox(height: 8),
                            GestureDetector(
                              onTap: () => _openUrl(_authUrl!),
                              child: const Text('Click here to open manually →',
                                  style: TextStyle(color: Color(0xFF818CF8), fontSize: 12,
                                      decoration: TextDecoration.underline)),
                            ),
                          ],
                        ),
                      ),
                    ],

                    const SizedBox(height: 20),
                    Divider(color: Colors.white.withOpacity(0.07)),
                    const SizedBox(height: 14),

                    // Step 3: Paste callback URL
                    _SectionLabel(label: 'STEP 3 — PASTE CALLBACK URL'),
                    const SizedBox(height: 6),
                    Text(
                      'After approving in the browser, you\'ll be redirected to a 127.0.0.1 URL. Copy the full URL from the address bar and paste it below.',
                      style: TextStyle(color: Colors.white.withOpacity(0.45), fontSize: 12, height: 1.5),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _codeController,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      decoration: _inputDecoration('http://127.0.0.1:53682/?code=...&state=...'),
                    ),
                    const SizedBox(height: 10),
                    ElevatedButton(
                      onPressed: _loadingSubmit ? null : _handleSubmitUrl,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF6366F1),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: Text(
                        _loadingSubmit ? 'CONNECTING...' : 'SUBMIT & CONNECT',
                        style: const TextStyle(fontWeight: FontWeight.bold, letterSpacing: 0.5),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: Colors.white24, fontSize: 13),
      filled: true,
      fillColor: const Color(0xFF1E293B),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: Colors.white.withOpacity(0.12)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFF6366F1), width: 1.5),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel({required this.label});

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: TextStyle(
        color: Colors.white.withOpacity(0.35),
        fontSize: 10,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.2,
      ),
    );
  }
}
