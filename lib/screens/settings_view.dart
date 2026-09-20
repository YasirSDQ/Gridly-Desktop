import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as path;
import '../models/models.dart';

class SettingsView extends StatefulWidget {
  const SettingsView({super.key});

  @override
  State<SettingsView> createState() => _SettingsViewState();
}

class _SettingsViewState extends State<SettingsView> {
  bool _serverSideCopy = true;
  bool _checksum = false;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.settings,
                color: Color(0xFF6366F1),
                size: 28,
              ),
              const SizedBox(width: 16),
              const Text(
                'Settings',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 32),
          
          _buildSettingsGroup(
            title: 'Transfer Options',
            children: [
              _buildSwitchSetting(
                title: 'Server-side Copy',
                subtitle: 'Attempt to copy files server-side if supported by remote',
                value: _serverSideCopy,
                onChanged: (v) => setState(() => _serverSideCopy = v),
              ),
              const Divider(color: Colors.white10, height: 1),
              _buildSwitchSetting(
                title: 'Checksum',
                subtitle: 'Verify checksums during transfer (slower)',
                value: _checksum,
                onChanged: (v) => setState(() => _checksum = v),
              ),
            ],
          ),
          
          const SizedBox(height: 24),
          
          _buildSettingsGroup(
            title: 'Cache Settings',
            children: [
              Consumer<AppProvider>(
                builder: (context, provider, child) {
                  return _buildSwitchSetting(
                    title: 'Enable Cache Saving',
                    subtitle: 'Save remote data locally for instant loading on startup',
                    value: provider.cacheEnabled,
                    onChanged: (v) => provider.setCacheEnabled(v),
                  );
                },
              ),
              Consumer<AppProvider>(
                builder: (context, provider, child) {
                  return FutureBuilder<Map<String, dynamic>>(
                    future: provider.getCacheDetails(),
                    builder: (context, snapshot) {
                      final size = snapshot.data?['size'] ?? 0;
                      final count = snapshot.data?['count'] ?? 0;
                      final sizeMB = (size / 1024 / 1024).toStringAsFixed(2);
                      return ListTile(
                        title: const Text('Cache Details', style: TextStyle(color: Colors.white)),
                        subtitle: Text('Size: $sizeMB MB ($count folders cached)', style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 12)),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            TextButton.icon(
                              onPressed: () async {
                                try {
                                  final path = await provider.exportCache();
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text('Cache exported to: $path'), backgroundColor: Colors.green),
                                    );
                                  }
                                } catch (e) {
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
                                    );
                                  }
                                }
                              },
                              icon: const Icon(Icons.download, size: 16, color: Color(0xFF818CF8)),
                              label: const Text('Export', style: TextStyle(color: Color(0xFF818CF8))),
                            ),
                            const SizedBox(width: 8),
                            TextButton.icon(
                              onPressed: () async {
                                // Assume they want to import from Downloads/GridlyCache.json
                                importDialog(context, provider);
                              },
                              icon: const Icon(Icons.upload, size: 16, color: Color(0xFF818CF8)),
                              label: const Text('Import', style: TextStyle(color: Color(0xFF818CF8))),
                            ),
                          ],
                        ),
                      );
                    }
                  );
                }
              ),
              const Divider(color: Colors.white10, height: 1),
              Consumer<AppProvider>(
                builder: (context, provider, child) {
                  return Material(
                    color: Colors.transparent,
                    child: ListTile(
                      title: const Text('Clear Local Cache', style: TextStyle(color: Colors.white)),
                      subtitle: Text('Removes all saved file lists and accounts from device', style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 12)),
                      trailing: ElevatedButton(
                        onPressed: () => _confirmClearCache(context, provider),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white.withOpacity(0.1),
                          foregroundColor: Colors.white,
                          elevation: 0,
                        ),
                        child: const Text('Clear'),
                      ),
                    ),
                  );
                }
              ),
            ],
          ),
          
          const SizedBox(height: 24),
          
          _buildSettingsGroup(
            title: 'About Gridly',
            children: [
              ListTile(
                title: const Text('Version', style: TextStyle(color: Colors.white)),
                subtitle: Text('1.0.0', style: TextStyle(color: Colors.white.withOpacity(0.6))),
              ),
            ],
          ),
        ],
      ),
    );
  }
  
  void _confirmClearCache(BuildContext context, AppProvider provider) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(color: Colors.white.withOpacity(0.1)),
        ),
        title: const Text('Clear Local Cache', style: TextStyle(color: Colors.white, fontSize: 16)),
        content: Text(
          'Are you sure you want to clear the local cache? This will remove all instantly-loading folders and accounts.',
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
              await provider.clearCache();
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Cache cleared successfully'), backgroundColor: Color(0xFF6366F1)),
                );
                // Trigger rebuild of the future builder
                setState(() {});
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red.shade700,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Clear', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void importDialog(BuildContext context, AppProvider provider) async {
    try {
      // Typically we'd use a file picker here, but for simplicity we assume the default location
      // so it works perfectly across platforms without native compilation restarts.
      final downloadsDir = await getDownloadsDirectory();
      if (downloadsDir == null) throw Exception("Could not find downloads directory");
      final pathStr = path.join(downloadsDir.path, 'GridlyCache.json');
      
      await provider.importCache(pathStr);
      
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Cache imported successfully!'), backgroundColor: Colors.green),
        );
        setState(() {}); // refresh details
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
        );
      }
    }
  }

  Widget _buildSettingsGroup({required String title, required List<Widget> children}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: TextStyle(
            color: const Color(0xFF6366F1),
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 12),
        Container(
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.03),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.white.withOpacity(0.08)),
          ),
          child: Column(children: children),
        ),
      ],
    );
  }
  
  Widget _buildSwitchSetting({
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return SwitchListTile(
      title: Text(title, style: const TextStyle(color: Colors.white)),
      subtitle: Text(subtitle, style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 12)),
      value: value,
      onChanged: onChanged,
      activeColor: const Color(0xFF6366F1),
    );
  }
}
