import 'package:flutter/material.dart';

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
