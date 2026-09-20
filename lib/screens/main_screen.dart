import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:bitsdojo_window/bitsdojo_window.dart';

import '../models/models.dart';
import '../services/rclone_service.dart';
import '../components/sidebar.dart';
import '../components/file_browser.dart';
import '../components/transfer_panel.dart';
import '../components/custom_title_bar.dart';

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  bool _isTransferPanelOpen = false;
  
  @override
  void initState() {
    super.initState();
    _initializeApp();
  }
  
  Future<void> _initializeApp() async {
    final rcloneService = context.read<RCloneService>();
    try {
      await rcloneService.initialize();
      await rcloneService.startDaemon();
      
      if (mounted) {
        await context.read<AppProvider>().loadRemotes(rcloneService);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to initialize: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: WindowBorder(
        color: const Color(0xFF0F172A),
        child: Column(
          children: [
            const CustomTitleBar(),
            Expanded(
              child: Row(
                children: [
                  const Sidebar(),
                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            const Color(0xFF0F172A),
                            const Color(0xFF1E293B),
                            const Color(0xFF0F172A),
                          ],
                        ),
                      ),
                      child: const FileBrowser(),
                    ),
                  ),
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 300),
                    width: _isTransferPanelOpen ? 400 : 0,
                    child: _isTransferPanelOpen 
                        ? TransferPanel(onClose: () {
                            setState(() => _isTransferPanelOpen = false);
                          })
                        : const SizedBox.shrink(),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          setState(() => _isTransferPanelOpen = !_isTransferPanelOpen);
        },
        icon: const Icon(Icons.swap_horiz),
        label: Text(_isTransferPanelOpen ? 'Hide' : 'Transfers'),
        backgroundColor: const Color(0xFF6366F1),
      ),
    );
  }
}
