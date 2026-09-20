import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/rclone_service.dart';
import '../models/models.dart';

enum TransferStep { source, destination, options }

class TransferModal extends StatefulWidget {
  final FileItem? preSelectedSource;
  final String? sourceRemote;

  const TransferModal({super.key, this.preSelectedSource, this.sourceRemote});

  @override
  State<TransferModal> createState() => _TransferModalState();
}

class _TransferModalState extends State<TransferModal> {
  TransferStep _currentStep = TransferStep.source;

  String? _sourceRemote;
  String _sourcePath = '';
  FileItem? _selectedSourceItem;
  bool _srcShared = false;

  String? _destRemote;
  String _destPath = '';
  bool _dstShared = false;

  bool _isCopy = true;
  bool _ignoreExisting = false;

  @override
  void initState() {
    super.initState();
    _sourceRemote = widget.sourceRemote;
    if (widget.preSelectedSource != null) {
      _selectedSourceItem = widget.preSelectedSource;
      if (_selectedSourceItem!.isDir) {
        _sourcePath = _selectedSourceItem!.path;
      } else {
        final parts = _selectedSourceItem!.path.split('/');
        if (parts.length > 1) {
          parts.removeLast();
          _sourcePath = parts.join('/');
        } else {
          _sourcePath = '';
        }
      }
    }
  }

  void _nextStep() {
    if (_currentStep == TransferStep.source) {
      if (_sourceRemote == null) return;
      setState(() => _currentStep = TransferStep.destination);
    } else if (_currentStep == TransferStep.destination) {
      if (_destRemote == null) return;
      setState(() => _currentStep = TransferStep.options);
    }
  }

  void _prevStep() {
    if (_currentStep == TransferStep.options) {
      setState(() => _currentStep = TransferStep.destination);
    } else if (_currentStep == TransferStep.destination) {
      setState(() => _currentStep = TransferStep.source);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      child: Container(
        width: 900,
        height: 700,
        decoration: BoxDecoration(
          color: const Color(0xFF0B1120), // Darker background
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withOpacity(0.08)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.5),
              blurRadius: 30,
              spreadRadius: 5,
            )
          ],
        ),
        child: Column(
          children: [
            _buildHeader(),
            _buildStepper(),
            Expanded(
              child: _buildBody(),
            ),
            _buildFooter(),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: Colors.white.withOpacity(0.05))),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFF6366F1).withOpacity(0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.swap_horiz, color: Color(0xFF818CF8), size: 28),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Create Transfer',
                  style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Text(
                  'Select files or folders from Source Drive and transfer them to your Destination Drive',
                  style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 13),
                ),
                const SizedBox(height: 16),
                // Mini summary bar
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.02),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.white.withOpacity(0.05)),
                  ),
                  child: Row(
                    children: [
                      Text('Source: ', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12)),
                      Text(_sourceRemote ?? 'Select', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: const Color(0xFF6366F1).withOpacity(0.2), borderRadius: BorderRadius.circular(4)),
                        child: Text(_selectedSourceItem?.name ?? 'Drive Root', style: const TextStyle(color: Color(0xFF818CF8), fontSize: 10)),
                      ),
                      const Expanded(child: Icon(Icons.arrow_forward, color: Colors.white24, size: 16)),
                      Text('Destination: ', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12)),
                      Text(_destRemote ?? 'Select', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: Colors.pink.withOpacity(0.2), borderRadius: BorderRadius.circular(4)),
                        child: Text(_destPath.isEmpty ? 'Root' : _destPath.split('/').last, style: TextStyle(color: Colors.pink[300], fontSize: 10)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.close, color: Colors.white54),
            onPressed: () => Navigator.pop(context),
          ),
        ],
      ),
    );
  }

  Widget _buildStepper() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Row(
        children: [
          _buildStepPill(
            stepNum: 1,
            title: 'Source Drive & Items',
            isActive: _currentStep == TransferStep.source,
            isCompleted: _currentStep.index > 0,
          ),
          const SizedBox(width: 12),
          _buildStepPill(
            stepNum: 2,
            title: 'Destination Drive & Folder',
            isActive: _currentStep == TransferStep.destination,
            isCompleted: _currentStep.index > 1,
          ),
          const SizedBox(width: 12),
          _buildStepPill(
            stepNum: 3,
            title: 'Transfer Options & Start',
            isActive: _currentStep == TransferStep.options,
            isCompleted: false,
          ),
        ],
      ),
    );
  }

  Widget _buildStepPill({required int stepNum, required String title, required bool isActive, required bool isCompleted}) {
    final bgColor = isActive 
        ? const Color(0xFF6366F1).withOpacity(0.2) 
        : (isCompleted ? Colors.green.withOpacity(0.1) : Colors.white.withOpacity(0.03));
    final textColor = isActive 
        ? const Color(0xFF818CF8) 
        : (isCompleted ? Colors.green : Colors.white54);
    final borderColor = isActive ? const Color(0xFF6366F1).withOpacity(0.5) : Colors.transparent;

    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: borderColor),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 20, height: 20,
              decoration: BoxDecoration(
                color: isCompleted ? Colors.green : (isActive ? const Color(0xFF6366F1) : Colors.white.withOpacity(0.1)),
                shape: BoxShape.circle,
              ),
              child: Center(
                child: isCompleted 
                    ? const Icon(Icons.check, size: 12, color: Colors.white)
                    : Text('$stepNum', style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
              ),
            ),
            const SizedBox(width: 8),
            Text(title, style: TextStyle(color: textColor, fontSize: 12, fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }

  Widget _buildBody() {
    switch (_currentStep) {
      case TransferStep.source:
        return _buildSourceStep();
      case TransferStep.destination:
        return _buildDestinationStep();
      case TransferStep.options:
        return _buildOptionsStep();
    }
  }

  Widget _buildSourceStep() {
    return _buildExplorerView(
      title: '1. SELECT SOURCE DRIVE ACCOUNT',
      isSource: true,
      currentRemote: _sourceRemote,
      currentPath: _sourcePath,
      isShared: _srcShared,
      onRemoteChanged: (val) => setState(() { _sourceRemote = val; _sourcePath = ''; _selectedSourceItem = null; }),
      onPathChanged: (path, item) => setState(() { _sourcePath = path; _selectedSourceItem = item; }),
      onSharedChanged: (val) => setState(() { _srcShared = val; _sourcePath = ''; _selectedSourceItem = null; }),
      selectedItem: _selectedSourceItem,
    );
  }

  Widget _buildDestinationStep() {
    return _buildExplorerView(
      title: '1. SELECT DESTINATION DRIVE ACCOUNT',
      isSource: false,
      currentRemote: _destRemote,
      currentPath: _destPath,
      isShared: _dstShared,
      onRemoteChanged: (val) => setState(() { _destRemote = val; _destPath = ''; }),
      onPathChanged: (path, _) => setState(() => _destPath = path),
      onSharedChanged: (val) => setState(() { _dstShared = val; _destPath = ''; }),
    );
  }

  Widget _buildExplorerView({
    required String title,
    required bool isSource,
    required String? currentRemote,
    required String currentPath,
    required bool isShared,
    required ValueChanged<String?> onRemoteChanged,
    required Function(String, FileItem?) onPathChanged,
    required ValueChanged<bool> onSharedChanged,
    FileItem? selectedItem,
  }) {
    final provider = context.watch<AppProvider>();
    final remotes = provider.remotes;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
          const SizedBox(height: 12),
          // Remote Selector Row
          SizedBox(
            height: 60,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: remotes.length,
              itemBuilder: (context, index) {
                final r = remotes[index];
                final isSelected = currentRemote == r.name;
                return GestureDetector(
                  onTap: () => onRemoteChanged(r.name),
                  child: Container(
                    width: 220,
                    margin: const EdgeInsets.only(right: 12),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isSelected ? const Color(0xFF6366F1).withOpacity(0.1) : Colors.white.withOpacity(0.02),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: isSelected ? const Color(0xFF6366F1) : Colors.white.withOpacity(0.05)),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.cloud_circle, color: isSelected ? const Color(0xFF818CF8) : Colors.white54, size: 28),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(r.name, style: TextStyle(color: isSelected ? Colors.white : Colors.white70, fontWeight: FontWeight.bold)),
                              Text('${r.name}@drive.rclone', style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 10)),
                            ],
                          ),
                        ),
                        if (isSelected) const Icon(Icons.check_circle, color: Color(0xFF6366F1), size: 16),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 16),
          // Shared toggle
          if (currentRemote != null) ...[
            Container(
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.02),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: () => onSharedChanged(false),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        decoration: BoxDecoration(
                          color: !isShared ? const Color(0xFF6366F1) : Colors.transparent,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.cloud, color: !isShared ? Colors.white : Colors.white54, size: 16),
                            const SizedBox(width: 8),
                            Text('My Drive', style: TextStyle(color: !isShared ? Colors.white : Colors.white54, fontSize: 12, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                    ),
                  ),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => onSharedChanged(true),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        decoration: BoxDecoration(
                          color: isShared ? const Color(0xFF6366F1) : Colors.transparent,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.people, color: isShared ? Colors.white : Colors.white54, size: 16),
                            const SizedBox(width: 8),
                            Text('Shared with me', style: TextStyle(color: isShared ? Colors.white : Colors.white54, fontSize: 12, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Text(isSource ? '2. SELECT FOLDER OR FILE TO TRANSFER' : '2. SELECT FOLDER TO TRANSFER INTO', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
                const Spacer(),
                if (isSource)
                  ElevatedButton.icon(
                    onPressed: () => onPathChanged('', null),
                    icon: const Icon(Icons.folder_special, size: 14),
                    label: const Text('Select Entire Drive (Root)'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF6366F1).withOpacity(0.2),
                      foregroundColor: const Color(0xFF818CF8),
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      minimumSize: Size.zero,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            // File Explorer
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF151E32),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white.withOpacity(0.05)),
                ),
                child: Column(
                  children: [
                    // Breadcrumbs
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        border: Border(bottom: BorderSide(color: Colors.white.withOpacity(0.05))),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.home, color: const Color(0xFF818CF8).withOpacity(0.8), size: 16),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              currentRemote + (currentPath.isEmpty ? '' : '/$currentPath'),
                              style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (currentPath.isNotEmpty)
                            IconButton(
                              icon: const Icon(Icons.arrow_upward, size: 16, color: Colors.white54),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(),
                              onPressed: () {
                                final parts = currentPath.split('/');
                                parts.removeLast();
                                onPathChanged(parts.join('/'), null);
                              },
                            ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: _MiniExplorer(
                        remote: currentRemote,
                        path: currentPath,
                        isShared: isShared,
                        isSource: isSource,
                        onItemTap: (item) {
                          if (item.isDir) {
                            onPathChanged(item.path, isSource ? item : null);
                          } else {
                            if (isSource) onPathChanged(currentPath, item);
                          }
                        },
                        selectedPath: selectedItem?.path ?? currentPath,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildOptionsStep() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
          Text('SERVER-TO-SERVER OPERATION', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _isCopy = true),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: _isCopy ? const Color(0xFF6366F1).withOpacity(0.1) : Colors.white.withOpacity(0.02),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: _isCopy ? const Color(0xFF6366F1) : Colors.white.withOpacity(0.05)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.copy, color: _isCopy ? const Color(0xFF818CF8) : Colors.white54, size: 20),
                            const SizedBox(width: 8),
                            Text('Server-to-Server Copy', style: TextStyle(color: _isCopy ? Colors.white : Colors.white70, fontWeight: FontWeight.bold)),
                            const Spacer(),
                            if (_isCopy) const Icon(Icons.radio_button_checked, color: Color(0xFF6366F1), size: 18) else const Icon(Icons.radio_button_unchecked, color: Colors.white24, size: 18),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text('Safely duplicate files directly across Google Drive accounts on cloud servers with zero local download.', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 11)),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _isCopy = false),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: !_isCopy ? const Color(0xFF6366F1).withOpacity(0.1) : Colors.white.withOpacity(0.02),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: !_isCopy ? const Color(0xFF6366F1) : Colors.white.withOpacity(0.05)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.drive_file_move, color: !_isCopy ? const Color(0xFF818CF8) : Colors.white54, size: 20),
                            const SizedBox(width: 8),
                            Text('Server-to-Server Move', style: TextStyle(color: !_isCopy ? Colors.white : Colors.white70, fontWeight: FontWeight.bold)),
                            const Spacer(),
                            if (!_isCopy) const Icon(Icons.radio_button_checked, color: Color(0xFF6366F1), size: 18) else const Icon(Icons.radio_button_unchecked, color: Colors.white24, size: 18),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text('Transfers files directly between Google Drive clouds and automatically removes source files once verified.', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 11)),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Text('CLOUD ACCELERATION & DUPLICATE HANDLING', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.green.withOpacity(0.05),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.green.withOpacity(0.2)),
            ),
            child: Row(
              children: [
                const Icon(Icons.bolt, color: Colors.green, size: 24),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Google Cloud Direct Server-to-Server (Active)', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      Text('Multi-threaded direct pipe between Google Drive cloud servers. Files never touch your local computer, saving data and maximizing speed.', style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 11)),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: Colors.green.withOpacity(0.2), borderRadius: BorderRadius.circular(4)),
                  child: const Text('0 MB Local Bandwidth', style: TextStyle(color: Colors.green, fontSize: 10, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: () => setState(() => _ignoreExisting = !_ignoreExisting),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.02),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white.withOpacity(0.05)),
              ),
              child: Row(
                children: [
                  Icon(Icons.fast_forward, color: Colors.white.withOpacity(0.7), size: 20),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Skip Existing Files (--ignore-existing)', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 4),
                        Text('Skips any file that already exists at the destination folder with matching size, saving significant time and quota.', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 11)),
                      ],
                    ),
                  ),
                  Checkbox(
                    value: _ignoreExisting,
                    onChanged: (v) => setState(() => _ignoreExisting = v ?? false),
                    activeColor: const Color(0xFF6366F1),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          // Summary
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF6366F1).withOpacity(0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.receipt_long, color: Color(0xFF818CF8), size: 16),
                    const SizedBox(width: 8),
                    const Text('TRANSFER EXECUTION SUMMARY', style: TextStyle(color: Color(0xFF818CF8), fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1)),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: Colors.green.withOpacity(0.2), borderRadius: BorderRadius.circular(4)),
                      child: const Row(
                        children: [
                          Icon(Icons.bolt, color: Colors.green, size: 12),
                          SizedBox(width: 4),
                          Text('Server-to-Server Ready', style: TextStyle(color: Colors.green, fontSize: 10, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('SOURCE CLOUD', style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 9, fontWeight: FontWeight.bold)),
                          Text(_sourceRemote ?? '', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          Text(_selectedSourceItem?.name ?? 'root', style: const TextStyle(color: Color(0xFF818CF8), fontSize: 12)),
                        ],
                      ),
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('DESTINATION CLOUD', style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 9, fontWeight: FontWeight.bold)),
                          Text(_destRemote ?? '', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          Text(_destPath.isEmpty ? 'root' : _destPath, style: TextStyle(color: Colors.pink[300], fontSize: 12)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Operation', style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 9)),
                        Text(_isCopy ? 'SERVER-TO-SERVER COPY' : 'SERVER-TO-SERVER MOVE', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Duplicate Handling', style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 9)),
                        Text(_ignoreExisting ? 'Skip' : 'Overwrite', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Local Data Consumed', style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 9)),
                        const Text('0 MB (Direct Cloud)', style: TextStyle(color: Colors.green, fontSize: 11, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
      ),
    );
  }

  Widget _buildFooter() {
    bool isNextDisabled = false;
    if (_currentStep == TransferStep.source && _sourceRemote == null) isNextDisabled = true;
    if (_currentStep == TransferStep.destination && _destRemote == null) isNextDisabled = true;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.02),
        border: Border(top: BorderSide(color: Colors.white.withOpacity(0.05))),
      ),
      child: Row(
        children: [
          if (_currentStep != TransferStep.source)
            TextButton.icon(
              onPressed: _prevStep,
              icon: const Icon(Icons.arrow_back, size: 16, color: Colors.white70),
              label: const Text('Back', style: TextStyle(color: Colors.white70)),
            )
          else
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel', style: TextStyle(color: Colors.white54)),
            ),
          const Spacer(),
          if (_currentStep != TransferStep.options)
            ElevatedButton(
              onPressed: isNextDisabled ? null : _nextStep,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF6366F1),
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                disabledBackgroundColor: Colors.white.withOpacity(0.1),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(_currentStep == TransferStep.source ? 'Continue to Destination' : 'Continue to Options', style: const TextStyle(color: Colors.white)),
                  const SizedBox(width: 8),
                  const Icon(Icons.arrow_forward, size: 16, color: Colors.white),
                ],
              ),
            )
          else
            ElevatedButton(
              onPressed: () {
                String finalDstPath = _destPath;
                if (_selectedSourceItem != null && _selectedSourceItem!.isDir) {
                  finalDstPath = _destPath.isEmpty 
                      ? _selectedSourceItem!.name 
                      : '$_destPath/${_selectedSourceItem!.name}';
                }
                
                context.read<AppProvider>().startTransferAndPoll(
                  context.read<RCloneService>(),
                  srcRemote: _sourceRemote!,
                  srcPath: _sourcePath,
                  dstRemote: _destRemote!,
                  dstPath: finalDstPath,
                  isCopy: _isCopy,
                  isFile: _selectedSourceItem != null ? !_selectedSourceItem!.isDir : false,
                  serverSide: true, // Always true for this advanced UI
                  ignoreExisting: _ignoreExisting,
                  srcShared: _srcShared,
                  dstShared: _dstShared,
                );
                Navigator.pop(context);
                context.read<AppProvider>().switchTab('transfers');
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF6366F1),
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.bolt, size: 18, color: Colors.white),
                  const SizedBox(width: 8),
                  Text(_isCopy ? 'Start Server-to-Server COPY' : 'Start Server-to-Server MOVE', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _MiniExplorer extends StatefulWidget {
  final String remote;
  final String path;
  final bool isShared;
  final bool isSource;
  final Function(FileItem) onItemTap;
  final String selectedPath;

  const _MiniExplorer({
    required this.remote,
    required this.path,
    required this.isShared,
    required this.isSource,
    required this.onItemTap,
    required this.selectedPath,
  });

  @override
  State<_MiniExplorer> createState() => _MiniExplorerState();
}

class _MiniExplorerState extends State<_MiniExplorer> {
  List<FileItem> _files = [];
  bool _isLoading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadFiles();
  }

  @override
  void didUpdateWidget(covariant _MiniExplorer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.remote != widget.remote || oldWidget.path != widget.path || oldWidget.isShared != widget.isShared) {
      _loadFiles();
    }
  }

  Future<void> _loadFiles() async {
    setState(() { _isLoading = true; _error = null; });
    try {
      final service = context.read<RCloneService>();
      final rawFiles = await service.listFiles(widget.remote, widget.path, shared: widget.isShared);
      
      if (mounted) {
        setState(() {
          _files = rawFiles.map((f) => FileItem.fromJson(f)).toList();
          if (!widget.isSource) {
            _files = _files.where((f) => f.isDir).toList(); // Destinations can only be folders
          }
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() { _error = e.toString(); _isLoading = false; });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Center(child: CircularProgressIndicator(valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF6366F1))));
    if (_error != null) return Center(child: Text(_error!, style: const TextStyle(color: Colors.red)));
    if (_files.isEmpty) return Center(child: Text('Empty folder', style: TextStyle(color: Colors.white.withOpacity(0.3))));

    return ListView.builder(
      itemCount: _files.length,
      itemBuilder: (context, index) {
        final item = _files[index];
        final isSelected = item.path == widget.selectedPath;
        
        return InkWell(
          onTap: () => widget.onItemTap(item),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: isSelected ? const Color(0xFF6366F1).withOpacity(0.1) : Colors.transparent,
              border: Border(bottom: BorderSide(color: Colors.white.withOpacity(0.02))),
            ),
            child: Row(
              children: [
                Icon(
                  item.isDir ? Icons.folder : Icons.insert_drive_file,
                  color: item.isDir ? const Color(0xFFFBBF24) : Colors.white54,
                  size: 24,
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.name,
                        style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(item.isDir ? 'Folder' : '${(item.size / 1024 / 1024).toStringAsFixed(2)} MB', style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 10)),
                    ],
                  ),
                ),
                if (widget.isSource || item.isDir)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: isSelected ? const Color(0xFF6366F1) : Colors.white.withOpacity(0.05),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Row(
                      children: [
                        if (isSelected) const Icon(Icons.check, size: 12, color: Colors.white),
                        if (isSelected) const SizedBox(width: 4),
                        Text(
                          isSelected ? 'Selected' : 'Select',
                          style: TextStyle(color: isSelected ? Colors.white : Colors.white70, fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                        if (item.isDir && !isSelected) const SizedBox(width: 4),
                        if (item.isDir && !isSelected) const Icon(Icons.chevron_right, size: 14, color: Colors.white54),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}
