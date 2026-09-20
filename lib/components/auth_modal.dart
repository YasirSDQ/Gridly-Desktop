import 'dart:convert';
import 'package:flutter/material.dart';
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
  
  bool _loadingCode = false;
  bool _loadingSubmit = false;

  @override
  void dispose() {
    _nameController.dispose();
    _codeController.dispose();
    // In case the user closes the modal while authorize is running
    context.read<RCloneService>().cancelAuthorize();
    super.dispose();
  }

  Future<void> _handleGenerateCode() async {
    setState(() => _loadingCode = true);
    
    try {
      final rcloneService = context.read<RCloneService>();
      
      await rcloneService.generateDriveLoginCode(
        (url) async {
          final uri = Uri.parse(url);
          if (await canLaunchUrl(uri)) {
            await launchUrl(uri);
          } else {
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Could not open browser. Check rclone logs.')),
              );
            }
          }
          if (mounted) setState(() => _loadingCode = false);
        },
        (token) {
          // If we receive the token from the stdout stream (e.g. after successful auth)
          _createConfigWithToken(token);
        },
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error generating code: $e')),
        );
        setState(() => _loadingCode = false);
      }
    }
  }

  Future<void> _handleSubmitUrl() async {
    final codeValue = _codeController.text.trim();
    final remoteName = _nameController.text.trim();
    
    if (remoteName.isEmpty || codeValue.isEmpty) return;
    
    setState(() => _loadingSubmit = true);
    
    try {
      if (codeValue.startsWith('{') && codeValue.endsWith('}')) {
        // It's a JSON token directly
        await _createConfigWithToken(codeValue);
      } else if (codeValue.startsWith('http://127.0.0.1')) {
        // It's the callback URL. Hit it so rclone gets the code.
        try {
          await http.get(Uri.parse(codeValue)).timeout(const Duration(seconds: 5));
        } catch (e) {
          // It might throw because rclone closes the connection immediately
        }
        
        // If we don't get a response (modal doesn't close) in 3 seconds, reset the button
        await Future.delayed(const Duration(seconds: 3));
        if (mounted) {
          setState(() => _loadingSubmit = false);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Auth process did not return a token. Please click "GENERATE" again.'), backgroundColor: Colors.red),
          );
        }
      } else {
        throw Exception('Invalid input. Please paste the callback URL or JSON token.');
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
      final rcloneService = context.read<RCloneService>();
      await rcloneService.createConfig(remoteName, 'drive', {
        'scope': 'drive',
        'token': tokenStr,
      });
      
      if (mounted) {
        await context.read<AppProvider>().loadRemotes(rcloneService);
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Successfully connected Google Drive as $remoteName'),
            backgroundColor: const Color(0xFF10B981),
          ),
        );
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
      insetPadding: const EdgeInsets.all(16),
      child: Container(
        width: 500,
        decoration: BoxDecoration(
          color: const Color(0xFF0F172A).withOpacity(0.95), // dark blue/slate
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withOpacity(0.1)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.5),
              blurRadius: 20,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B).withOpacity(0.8),
                borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                border: Border(bottom: BorderSide(color: Colors.white.withOpacity(0.1))),
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
                    child: const Icon(Icons.add_to_drive, color: Color(0xFF818CF8), size: 24),
                  ),
                  const SizedBox(width: 16),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Connect Google Drive',
                          style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                        Text(
                          'using rclone headless auth',
                          style: TextStyle(color: Colors.white54, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close, color: Colors.white54, size: 20),
                    hoverColor: Colors.white.withOpacity(0.1),
                  ),
                ],
              ),
            ),

            // Content
            Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Remote Name
                  const Text('Remote Name (e.g., mydrive)', style: TextStyle(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.w500)),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _nameController,
                    decoration: InputDecoration(
                      hintText: 'Enter remote name',
                      hintStyle: const TextStyle(color: Colors.white30),
                      filled: true,
                      fillColor: const Color(0xFF0F172A),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: Colors.white.withOpacity(0.2)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: Color(0xFF6366F1)),
                      ),
                    ),
                    style: const TextStyle(color: Colors.white),
                  ),
                  const SizedBox(height: 20),

                  // Red Warning banner
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF43F5E).withOpacity(0.1),
                      border: Border.all(color: const Color(0xFFF43F5E).withOpacity(0.2)),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Center(
                      child: Text(
                        'Please Paste the Code URL, Follow Below Steps',
                        style: TextStyle(color: Color(0xFFFB7185), fontSize: 14, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Big card
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B).withOpacity(0.5),
                      border: Border.all(color: Colors.white.withOpacity(0.1)),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Input and Submit
                        TextField(
                          controller: _codeController,
                          decoration: InputDecoration(
                            hintText: 'Enter Login URL (http://...) or JSON Token',
                            hintStyle: const TextStyle(color: Colors.white30),
                            filled: true,
                            fillColor: const Color(0xFF0F172A),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: BorderSide(color: Colors.white.withOpacity(0.2)),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
                            ),
                          ),
                          style: const TextStyle(color: Colors.white, fontSize: 14),
                        ),
                        const SizedBox(height: 12),
                        ElevatedButton(
                          onPressed: _loadingSubmit ? null : _handleSubmitUrl,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF2563EB), // blue-600
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            elevation: 4,
                            shadowColor: const Color(0xFF2563EB).withOpacity(0.5),
                          ),
                          child: Text(
                            _loadingSubmit ? 'SUBMITTING...' : 'SUBMIT CODE URL',
                            style: const TextStyle(fontWeight: FontWeight.bold, letterSpacing: 0.5),
                          ),
                        ),

                        const SizedBox(height: 24),
                        const Divider(color: Colors.white12),
                        const SizedBox(height: 16),

                        // Generate Login Code section
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.bolt, color: Color(0xFFFACC15), size: 20), // yellow
                            const SizedBox(width: 8),
                            const Text(
                              'Click on Button to Get Login Code',
                              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(width: 8),
                            const Icon(Icons.bolt, color: Color(0xFFFACC15), size: 20),
                          ],
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: _loadingCode ? null : _handleGenerateCode,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFE11D48), // rose-600
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            elevation: 4,
                            shadowColor: const Color(0xFFE11D48).withOpacity(0.5),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              if (_loadingCode)
                                const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                              else
                                const Icon(Icons.code, size: 20),
                              const SizedBox(width: 8),
                              Text(
                                _loadingCode ? 'GENERATING...' : 'CLICK HERE GENERATE LOGIN CODE',
                                style: const TextStyle(fontWeight: FontWeight.bold, letterSpacing: 0.5),
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 20),
                        
                        // Instructions
                        const Text('1. Click the Generate Login Code button above.', style: TextStyle(color: Colors.white60, fontSize: 12)),
                        const SizedBox(height: 4),
                        const Text('2. A new tab will open Google\'s login page. Approve access.', style: TextStyle(color: Colors.white60, fontSize: 12)),
                        const SizedBox(height: 4),
                        const Text('3. You will be redirected to an empty or error page (127.0.0.1).', style: TextStyle(color: Colors.white60, fontSize: 12)),
                        const SizedBox(height: 4),
                        RichText(
                          text: const TextSpan(
                            style: TextStyle(color: Colors.white60, fontSize: 12),
                            children: [
                              TextSpan(text: '4. '),
                              TextSpan(text: 'Copy the entire URL', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                              TextSpan(text: ' from your browser\'s address bar.'),
                            ],
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text('5. Paste it into the input field above and click Submit.', style: TextStyle(color: Colors.white60, fontSize: 12)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
