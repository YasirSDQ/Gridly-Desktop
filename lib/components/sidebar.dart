import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/rclone_service.dart';
import '../providers/app_provider.dart';

class Sidebar extends StatelessWidget {
  const Sidebar({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 260,
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        backdropFilter: BlurFilter.blur(sigmaX: 20, sigmaY: 20),
        border: Border(
          right: BorderSide(
            color: Colors.white.withOpacity(0.05),
            width: 1,
          ),
        ),
      ),
      child: Column(
        children: [
          // App logo and title - matching webapp sidebar
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                    ),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.cloud,
                    size: 18,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(width: 10),
                const Text(
                  'Gridly',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    letterSpacing: -0.5,
                  ),
                ),
              ],
            ),
          ),
          
          // Add Account button - matching webapp design
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Container(
              width: double.infinity,
              height: 48,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Colors.white, Color(0xFFF8FAFC)],
                ),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.white.withOpacity(0.1),
                    blurRadius: 10,
                    spreadRadius: 2,
                  ),
                ],
              ),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () => _showAddRemoteDialog(context),
                  borderRadius: BorderRadius.circular(16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.add,
                        color: Color(0xFF0F172A),
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'Add Account',
                        style: TextStyle(
                          color: Color(0xFF0F172A),
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          
          const SizedBox(height: 24),
          
          // Navigation items - matching webapp design
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Column(
              children: [
                _NavButton(
                  icon: Icons.folder,
                  label: 'My Drive',
                  isActive: true,
                  onTap: () {},
                ),
                const SizedBox(height: 8),
                _NavButton(
                  icon: Icons.people_outline,
                  label: 'Shared with me',
                  isActive: false,
                  onTap: () {},
                ),
                const SizedBox(height: 8),
                _NavButton(
                  icon: Icons.swap_horiz,
                  label: 'Transfers',
                  isActive: false,
                  onTap: () {},
                ),
                const SizedBox(height: 8),
                _NavButton(
                  icon: Icons.settings,
                  label: 'Settings',
                  isActive: false,
                  onTap: () {},
                ),
              ],
            ),
          ),
          
          const Spacer(),
          
          // Storage stats card - matching webapp design
          Consumer<AppProvider>(
            builder: (context, provider, _) {
              final remotes = provider.remotes;
              if (remotes.isEmpty) {
                return const SizedBox.shrink();
              }
              
              final activeRemote = remotes.first;
              final usedBytes = activeRemote.stats?.bytesUsed ?? 0;
              final totalBytes = activeRemote.stats?.totalBytes ?? usedBytes;
              final usagePercent = totalBytes > 0 ? (usedBytes / totalBytes * 100) : 0;
              
              return Padding(
                padding: const EdgeInsets.all(16),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.05),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: Colors.white.withOpacity(0.1),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(
                            Icons.storage,
                            color: Color(0xFF6366F1),
                            size: 16,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              activeRemote.name,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.refresh, size: 14),
                            color: Colors.white38,
                            onPressed: () => _refreshStorage(context, activeRemote),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(999),
                        child: LinearProgressIndicator(
                          value: usagePercent / 100,
                          backgroundColor: Colors.white.withOpacity(0.1),
                          valueColor: const AlwaysStoppedAnimation<Color>(
                            LinearGradient(
                              colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                            ),
                          ),
                          minHeight: 6,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            '${usagePercent.toStringAsFixed(0)}% used',
                            style: const TextStyle(
                              color: Colors.white60,
                              fontSize: 11,
                            ),
                          ),
                          Text(
                            '${_formatBytes(usedBytes)} / ${_formatBytes(totalBytes)}',
                            style: const TextStyle(
                              color: Colors.white38,
                              fontSize: 10,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
  
  void _refreshStorage(BuildContext context, RemoteConfig remote) {
    // TODO: Implement storage refresh
  }
  
  static String _formatBytes(int bytes) {
    if (bytes == 0) return '0 B';
    const suffixes = ['B', 'KB', 'MB', 'GB', 'TB'];
    var i = 0;
    double size = bytes.toDouble();
    while (size >= 1024 && i < suffixes.length - 1) {
      size /= 1024;
      i++;
    }
    return '${size.toStringAsFixed(1)} ${suffixes[i]}';
  }
  
  void _showAddRemoteDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: const Color(0xFF0F172A),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: Colors.white.withOpacity(0.1)),
        ),
        title: const Text(
          'Add Cloud Account',
          style: TextStyle(color: Colors.white),
        ),
        content: const Text(
          'Configure a new cloud storage remote using rclone.',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(dialogContext);
              // TODO: Open rclone config wizard
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF6366F1),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            child: const Text('Configure'),
          ),
        ],
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isActive;
  final VoidCallback onTap;
  
  const _NavButton({
    required this.icon,
    required this.label,
    required this.isActive,
    required this.onTap,
  });
  
  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: isActive 
                ? const Color(0xFF6366F1).withOpacity(0.2)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Icon(
                icon,
                color: isActive ? const Color(0xFF818CF8) : Colors.white54,
                size: 20,
              ),
              const SizedBox(width: 12),
              Text(
                label,
                style: TextStyle(
                  color: isActive ? const Color(0xFFA5B4FC) : Colors.white,
                  fontSize: 14,
                  fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
