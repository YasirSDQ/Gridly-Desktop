import 'dart:ui';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/rclone_service.dart';
import 'auth_modal.dart';

class Sidebar extends StatelessWidget {
  const Sidebar({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 256, // w-64
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        border: Border(
          right: BorderSide(
            color: Colors.white.withOpacity(0.05),
            width: 1,
          ),
        ),
      ),
      child: ClipRRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Column(
            children: [
              // Logo
              Padding(
                padding: const EdgeInsets.all(16.0),
                child: Row(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          begin: Alignment.topRight,
                          end: Alignment.bottomLeft,
                          colors: [
                            Color(0xFF8B5CF6), // purple
                            Color(0xFF6366F1), // indigo
                          ],
                        ),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.cloud, color: Colors.white, size: 16),
                    ),
                    const SizedBox(width: 12),
                    const Text(
                      'Gridly',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -0.5,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),

              // Add Account Button
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                child: InkWell(
                  onTap: () => _showAddRemoteDialog(context),
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.white.withOpacity(0.1),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.add, color: Colors.grey[900], size: 18),
                        const SizedBox(width: 8),
                        Text(
                          'Add Account',
                          style: TextStyle(
                            color: Colors.grey[900],
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 16),

              // Nav Items
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16.0),
                  child: Column(
                    children: [
                      _NavItem(
                        icon: Icons.add_to_drive,
                        label: 'My Drive',
                        isSelected: true,
                        onTap: () {},
                      ),
                      const SizedBox(height: 8),
                      _NavItem(
                        icon: Icons.people,
                        label: 'Shared with me',
                        isSelected: false,
                        onTap: () {},
                      ),
                      const SizedBox(height: 8),
                      _NavItem(
                        icon: Icons.swap_horiz,
                        label: 'Transfers',
                        isSelected: false,
                        onTap: () {},
                      ),
                      const SizedBox(height: 8),
                      _NavItem(
                        icon: Icons.settings,
                        label: 'Settings',
                        isSelected: false,
                        onTap: () {},
                      ),
                    ],
                  ),
                ),
              ),

              // Storage Info for active remote
              Consumer<AppProvider>(
                builder: (context, provider, _) {
                  final remotes = provider.remotes;
                  if (remotes.isEmpty) return const SizedBox.shrink();
                  
                  final activeAccount = remotes.firstWhere(
                    (r) => r.name == provider.currentRemote,
                    orElse: () => remotes.first,
                  );
                  
                  final usedBytes = activeAccount.usedBytes.toDouble();
                  final totalBytes = activeAccount.totalBytes.toDouble();
                  final pct = totalBytes > 0 ? (usedBytes / totalBytes).clamp(0.0, 1.0) : 0.0;
                  final pctString = (pct * 100).toStringAsFixed(1);
                  
                  return Container(
                    margin: const EdgeInsets.all(16),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.05),
                      border: Border.all(color: Colors.white.withOpacity(0.1)),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.storage, size: 16, color: Color(0xFF8B5CF6)),
                            const SizedBox(width: 8),
                            Expanded(
                              child: InkWell(
                                onTap: () {
                                  final rcloneService = context.read<RCloneService>();
                                  provider.navigateTo(activeAccount.name, '', rcloneService);
                                },
                                child: Text(
                                  activeAccount.name,
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Container(
                          height: 6,
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(3),
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(3),
                            child: FractionallySizedBox(
                              alignment: Alignment.centerLeft,
                              widthFactor: pct,
                              child: Container(
                                decoration: const BoxDecoration(
                                  gradient: LinearGradient(
                                    colors: [
                                      Color(0xFF6366F1),
                                      Color(0xFF8B5CF6),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              totalBytes > 0 ? '$pctString% used' : 'Unknown',
                              style: TextStyle(
                                color: Colors.white.withOpacity(0.7),
                                fontSize: 12,
                              ),
                            ),
                            Text(
                              totalBytes > 0 ? '${_formatBytes(activeAccount.usedBytes)} / ${_formatBytes(activeAccount.totalBytes)}' : '',
                              style: TextStyle(
                                color: Colors.white.withOpacity(0.5),
                                fontSize: 10,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showAddRemoteDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => const AuthModal(),
    );
  }

  String _formatBytes(int bytes) {
    if (bytes <= 0) return "0 B";
    const suffixes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    var i = (bytes > 0) ? (bytes.toDouble().abs().log() / 1024.toDouble().log()).floor() : 0;
    return '${(bytes / (1024.0.pow(i))).toStringAsFixed(1)} ${suffixes[i]}';
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _NavItem({
    required this.icon,
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF6366F1).withOpacity(0.2) : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(
              icon,
              size: 20,
              color: isSelected ? const Color(0xFF8B5CF6) : Colors.white.withOpacity(0.6),
            ),
            const SizedBox(width: 12),
            Text(
              label,
              style: TextStyle(
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                color: isSelected ? const Color(0xFFA5B4FC) : Colors.white.withOpacity(0.6),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
