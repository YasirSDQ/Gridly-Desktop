import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/rclone_service.dart';
import '../models/models.dart';

class TransferModal extends StatefulWidget {
  final FileItem? preSelectedSource;
  final String? sourceRemote;

  const TransferModal({super.key, this.preSelectedSource, this.sourceRemote});

  @override
  State<TransferModal> createState() => _TransferModalState();
}

class _TransferModalState extends State<TransferModal> {
  String? _sourceRemote;
  String _sourcePath = '';
  FileItem? _selectedSourceItem;

  String? _destRemote;
  String _destPath = '';

  bool _isCopy = true;
  bool _serverSide = true;

  @override
  void initState() {
    super.initState();
    _sourceRemote = widget.sourceRemote;
    if (widget.preSelectedSource != null) {
      _selectedSourceItem = widget.preSelectedSource;
      _sourcePath = _selectedSourceItem!.path; // Wait, actually path is full path. If it's a file, the path is its path.
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      child: Container(
        width: 900,
        height: 600,
        decoration: BoxDecoration(
          color: const Color(0xFF0F172A),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withOpacity(0.1)),
        ),
        child: Column(
          children: [
            // Header
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                border: Border(bottom: BorderSide(color: Colors.white.withOpacity(0.1))),
              ),
              child: Row(
                children: [
                  const Icon(Icons.swap_horiz, color: Color(0xFF6366F1), size: 24),
                  const SizedBox(width: 12),
                  const Text(
                    'New Transfer',
                    style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white54),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
            
            // Body
            Expanded(
              child: Row(
                children: [
                  // Source Explorer
                  Expanded(
                    child: _buildExplorerPanel(
                      title: 'Source',
                      currentRemote: _sourceRemote,
                      currentPath: _sourcePath,
                      onRemoteChanged: (val) => setState(() { _sourceRemote = val; _sourcePath = ''; _selectedSourceItem = null; }),
                      onPathChanged: (path, item) => setState(() { _sourcePath = path; _selectedSourceItem = item; }),
                      selectedItem: _selectedSourceItem,
                    ),
                  ),
                  
                  // Divider
                  Container(width: 1, color: Colors.white.withOpacity(0.1)),
                  
                  // Destination Explorer
                  Expanded(
                    child: _buildExplorerPanel(
                      title: 'Destination',
                      currentRemote: _destRemote,
                      currentPath: _destPath,
                      onRemoteChanged: (val) => setState(() { _destRemote = val; _destPath = ''; }),
                      onPathChanged: (path, _) => setState(() => _destPath = path),
                    ),
                  ),
                ],
              ),
            ),
            
            // Footer & Options
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: Colors.white.withOpacity(0.1))),
                color: Colors.white.withOpacity(0.02),
              ),
              child: Row(
                children: [
                  // Options
                  Checkbox(
                    value: _isCopy,
                    onChanged: (v) => setState(() => _isCopy = v ?? true),
                    activeColor: const Color(0xFF6366F1),
                  ),
                  const Text('Copy', style: TextStyle(color: Colors.white)),
                  const SizedBox(width: 16),
                  Checkbox(
                    value: !_isCopy,
                    onChanged: (v) => setState(() => _isCopy = !(v ?? true)),
                    activeColor: const Color(0xFF6366F1),
                  ),
                  const Text('Move', style: TextStyle(color: Colors.white)),
                  const SizedBox(width: 32),
                  Checkbox(
                    value: _serverSide,
                    onChanged: (v) => setState(() => _serverSide = v ?? true),
                    activeColor: const Color(0xFF6366F1),
                  ),
                  const Text('Server-side (if possible)', style: TextStyle(color: Colors.white)),
                  
                  const Spacer(),
                  
                  // Action buttons
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Cancel', style: TextStyle(color: Colors.white54)),
                  ),
                  const SizedBox(width: 16),
                  ElevatedButton.icon(
                    onPressed: (_sourceRemote == null || _destRemote == null)
                        ? null
                        : () {
                            // TODO: Dispatch transfer job
                            Navigator.pop(context);
                          },
                    icon: const Icon(Icons.send, size: 18),
                    label: const Text('Start Transfer'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF6366F1),
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                      disabledBackgroundColor: Colors.white.withOpacity(0.1),
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

  Widget _buildExplorerPanel({
    required String title,
    required String? currentRemote,
    required String currentPath,
    required ValueChanged<String?> onRemoteChanged,
    required Function(String, FileItem?) onPathChanged,
    FileItem? selectedItem,
  }) {
    final provider = context.watch<AppProvider>();
    final remotes = provider.remotes;

    return Column(
      children: [
        // Panel Header
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: currentRemote,
                decoration: InputDecoration(
                  filled: true,
                  fillColor: Colors.white.withOpacity(0.05),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
                dropdownColor: const Color(0xFF1E293B),
                hint: const Text('Select Drive', style: TextStyle(color: Colors.white54)),
                items: remotes.map((r) => DropdownMenuItem(
                  value: r.name,
                  child: Text(r.name, style: const TextStyle(color: Colors.white)),
                )).toList(),
                onChanged: onRemoteChanged,
              ),
            ],
          ),
        ),
        
        // Path input / breadcrumbs
        if (currentRemote != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(border: Border(bottom: BorderSide(color: Colors.white.withOpacity(0.05)))),
            child: Row(
              children: [
                Icon(Icons.folder, color: Colors.white.withOpacity(0.5), size: 16),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    currentPath.isEmpty ? '/' : '/$currentPath',
                    style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 13),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (currentPath.isNotEmpty)
                  IconButton(
                    icon: const Icon(Icons.arrow_upward, size: 16, color: Colors.white54),
                    onPressed: () {
                      final parts = currentPath.split('/');
                      parts.removeLast();
                      onPathChanged(parts.join('/'), null);
                    },
                  ),
              ],
            ),
          ),
          
        // File list
        Expanded(
          child: currentRemote == null
              ? Center(child: Text('Select a drive to browse', style: TextStyle(color: Colors.white.withOpacity(0.3))))
              : _MiniExplorer(
                  remote: currentRemote,
                  path: currentPath,
                  onItemTap: (item) {
                    if (item.isDir) {
                      onPathChanged(item.path, item);
                    } else {
                      onPathChanged(item.path, item);
                    }
                  },
                  selectedPath: selectedItem?.path ?? currentPath,
                ),
        ),
      ],
    );
  }
}

class _MiniExplorer extends StatefulWidget {
  final String remote;
  final String path;
  final Function(FileItem) onItemTap;
  final String selectedPath;

  const _MiniExplorer({
    required this.remote,
    required this.path,
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
    if (oldWidget.remote != widget.remote || oldWidget.path != widget.path) {
      _loadFiles();
    }
  }

  Future<void> _loadFiles() async {
    setState(() { _isLoading = true; _error = null; });
    try {
      final service = context.read<RCloneService>();
      final rawFiles = await service.listFiles(widget.remote, widget.path);
      
      if (mounted) {
        setState(() {
          _files = rawFiles.map((f) => FileItem.fromJson(f)).toList();
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
              color: isSelected ? const Color(0xFF6366F1).withOpacity(0.2) : Colors.transparent,
              border: Border(bottom: BorderSide(color: Colors.white.withOpacity(0.02))),
            ),
            child: Row(
              children: [
                Icon(
                  item.isDir ? Icons.folder : Icons.insert_drive_file,
                  color: item.isDir ? const Color(0xFF60A5FA) : Colors.white54,
                  size: 20,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    item.name,
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (isSelected)
                  const Icon(Icons.check, color: Color(0xFF6366F1), size: 16),
              ],
            ),
          ),
        );
      },
    );
  }
}
