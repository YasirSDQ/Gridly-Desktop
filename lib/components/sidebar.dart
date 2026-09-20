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
      width: 256,
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
          child: Consumer<AppProvider>(
            builder: (context, provider, _) {
              return Column(
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
                              colors: [Color(0xFF8B5CF6), Color(0xFF6366F1)],
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
                    padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 4.0),
                    child: InkWell(
                      onTap: () => _showAddRemoteDialog(context),
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
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
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 8),

                  // Accounts List
                  if (provider.remotes.isNotEmpty) ...[
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 4.0),
                      child: Text(
                        'ACCOUNTS',
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.35),
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.2,
                        ),
                      ),
                    ),
                    ...provider.remotes.map((remote) {
                      final isActive = remote.name == provider.currentRemote;
                      return Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 2.0),
                        child: InkWell(
                          onTap: () {
                            final rcloneService = context.read<RCloneService>();
                            provider.navigateTo(remote.name, '', rcloneService);
                          },
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            decoration: BoxDecoration(
                              color: isActive
                                  ? const Color(0xFF6366F1).withOpacity(0.2)
                                  : Colors.transparent,
                              borderRadius: BorderRadius.circular(10),
                              border: isActive
                                  ? Border.all(color: const Color(0xFF6366F1).withOpacity(0.3))
                                  : null,
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 28,
                                  height: 28,
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      colors: isActive
                                          ? [const Color(0xFF6366F1), const Color(0xFF8B5CF6)]
                                          : [Colors.white24, Colors.white12],
                                    ),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Icon(
                                    _getRemoteIcon(remote.type),
                                    color: Colors.white,
                                    size: 15,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        remote.name,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          color: isActive ? Colors.white : Colors.white70,
                                          fontSize: 13,
                                          fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                                        ),
                                      ),
                                      Text(
                                        remote.type.toUpperCase(),
                                        style: TextStyle(
                                          color: Colors.white.withOpacity(0.35),
                                          fontSize: 9,
                                          letterSpacing: 0.5,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                // Remove button
                                InkWell(
                                  onTap: () => _confirmRemoveAccount(context, provider, remote.name),
                                  borderRadius: BorderRadius.circular(4),
                                  child: Padding(
                                    padding: const EdgeInsets.all(4),
                                    child: Icon(
                                      Icons.link_off,
                                      size: 14,
                                      color: Colors.white.withOpacity(0.25),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    }),
                    const SizedBox(height: 8),
                  ],

                  // Divider
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0),
                    child: Divider(color: Colors.white.withOpacity(0.08), height: 1),
                  ),

                  const SizedBox(height: 8),

                  // Nav Items
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8.0),
                    child: Column(
                      children: [
                        _NavItem(
                          icon: Icons.folder_open,
                          label: 'My Drive',
                          isSelected: provider.currentTab == 'drive',
                          onTap: () {
                            provider.switchTab('drive');
                            if (provider.currentRemote.isNotEmpty) {
                              final rcloneService = context.read<RCloneService>();
                              provider.navigateTo(provider.currentRemote, '', rcloneService);
                            }
                          },
                        ),
                        const SizedBox(height: 4),
                        _NavItem(
                          icon: Icons.swap_horiz,
                          label: 'Transfers',
                          isSelected: provider.currentTab == 'transfers',
                          onTap: () {
                            provider.switchTab('transfers');
                          },
                        ),
                        const SizedBox(height: 4),
                        _NavItem(
                          icon: Icons.settings,
                          label: 'Settings',
                          isSelected: provider.currentTab == 'settings',
                          onTap: () {
                            provider.switchTab('settings');
                          },
                        ),
                      ],
                    ),
                  ),

                  const Spacer(),

                  // Storage Info for active remote
                  if (provider.remotes.isNotEmpty) _buildStorageCard(context, provider),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildStorageCard(BuildContext context, AppProvider provider) {
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
      margin: const EdgeInsets.all(12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.storage, size: 14, color: Color(0xFF8B5CF6)),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  activeAccount.name,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              GestureDetector(
                onTap: () async {
                  final rcloneService = context.read<RCloneService>();
                  await provider.loadRemotes(rcloneService);
                },
                child: Icon(Icons.refresh, size: 14, color: Colors.white.withOpacity(0.4)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            height: 5,
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
                      colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                totalBytes > 0 ? '$pctString% used' : 'Storage unknown',
                style: TextStyle(
                  color: Colors.white.withOpacity(0.6),
                  fontSize: 11,
                ),
              ),
              if (totalBytes > 0)
                Text(
                  '${_formatBytes(activeAccount.usedBytes)} / ${_formatBytes(activeAccount.totalBytes)}',
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.4),
                    fontSize: 10,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  IconData _getRemoteIcon(String type) {
    switch (type.toLowerCase()) {
      case 'drive': return Icons.add_to_drive;
      case 'dropbox': return Icons.cloud;
      case 's3': return Icons.storage;
      case 'onedrive': return Icons.cloud_circle;
      default: return Icons.cloud_outlined;
    }
  }

  void _confirmRemoveAccount(BuildContext context, AppProvider provider, String name) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(color: Colors.white.withOpacity(0.1)),
        ),
        title: const Text('Remove Account', style: TextStyle(color: Colors.white, fontSize: 16)),
        content: Text(
          'Remove "$name" from Gridly? The remote will be deleted from rclone config.',
          style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: Colors.white54)),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final rcloneService = context.read<RCloneService>();
              await rcloneService.deleteConfig(name);
              if (context.mounted) {
                await provider.loadRemotes(rcloneService);
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red.shade700,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Remove', style: TextStyle(color: Colors.white)),
          ),
        ],
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
    if (bytes <= 0) return '0 B';
    const suffixes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    var i = (bytes > 0) ? (log(bytes.toDouble().abs()) / log(1024)).floor() : 0;
    i = i.clamp(0, suffixes.length - 1);
    return '${(bytes / (pow(1024.0, i))).toStringAsFixed(1)} ${suffixes[i]}';
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
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF6366F1).withOpacity(0.15) : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            Icon(
              icon,
              size: 18,
              color: isSelected ? const Color(0xFF8B5CF6) : Colors.white.withOpacity(0.55),
            ),
            const SizedBox(width: 10),
            Text(
              label,
              style: TextStyle(
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                fontSize: 13,
                color: isSelected ? const Color(0xFFA5B4FC) : Colors.white.withOpacity(0.6),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
