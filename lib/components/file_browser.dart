import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';

import '../models/models.dart';
import '../services/rclone_service.dart';

class FileBrowser extends StatefulWidget {
  const FileBrowser({super.key});

  @override
  State<FileBrowser> createState() => _FileBrowserState();
}

class _FileBrowserState extends State<FileBrowser> {
  final TextEditingController _searchController = TextEditingController();
  String _viewMode = 'grid'; // grid or list
  
  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<AppProvider>(
      builder: (context, provider, _) {
        return Column(
          children: [
            // Top bar with breadcrumbs and actions
            _buildTopBar(provider),
            
            // Search and filter bar
            _buildFilterBar(provider),
            
            // File grid/list
            Expanded(
              child: _buildFileList(provider),
            ),
          ],
        );
      },
    );
  }

  Widget _buildTopBar(AppProvider provider) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: Colors.white.withOpacity(0.05),
            width: 1,
          ),
        ),
      ),
      child: Row(
        children: [
          // Breadcrumb navigation
          Expanded(
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.arrow_back, size: 20),
                  color: Colors.white.withOpacity(0.7),
                  onPressed: () {
                    final rcloneService = context.read<RCloneService>();
                    final provider = context.read<AppProvider>();
                    if (provider.currentPath.isNotEmpty) {
                      final parts = provider.currentPath.split('/');
                      parts.removeLast();
                      final newPath = parts.join('/');
                      provider.navigateTo(provider.currentRemote, newPath, rcloneService);
                    }
                  },
                  tooltip: 'Go Up',
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        Text(
                          provider.currentRemote.isEmpty 
                              ? 'Select a remote' 
                              : '${provider.currentRemote}:${provider.currentPath}',
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.9),
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          const SizedBox(width: 16),
          
          // View mode toggle
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(
                value: 'grid',
                icon: Icon(Icons.grid_view, size: 18),
              ),
              ButtonSegment(
                value: 'list',
                icon: Icon(Icons.view_list, size: 18),
              ),
            ],
            selected: {_viewMode},
            onSelectionChanged: (Set<String> selection) {
              setState(() => _viewMode = selection.first);
            },
            style: ButtonStyle(
              backgroundColor: WidgetStateProperty.all(
                Colors.white.withOpacity(0.05),
              ),
            ),
          ),
          
          const SizedBox(width: 16),
          
          // Action buttons
          PopupMenuButton<String>(
            icon: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                ),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.add, color: Colors.white, size: 20),
            ),
            onSelected: (value) {
              switch (value) {
                case 'new_folder':
                  _showNewFolderDialog(context, provider);
                  break;
                case 'upload':
                  // Handle upload
                  break;
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: 'new_folder',
                child: Row(
                  children: [
                    Icon(Icons.create_new_folder, size: 18),
                    SizedBox(width: 12),
                    Text('New Folder'),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'upload',
                child: Row(
                  children: [
                    Icon(Icons.upload_file, size: 18),
                    SizedBox(width: 12),
                    Text('Upload Files'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFilterBar(AppProvider provider) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search files...',
                prefixIcon: const Icon(Icons.search, size: 20),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 18),
                        onPressed: () {
                          _searchController.clear();
                        },
                      )
                    : null,
              ),
              onChanged: (value) {
                setState(() {});
              },
            ),
          ),
          const SizedBox(width: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.05),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.white.withOpacity(0.1)),
            ),
            child: Text(
              '${provider.folderCount} Folders • ${provider.fileCount} Files',
              style: TextStyle(
                color: Colors.white.withOpacity(0.7),
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          const SizedBox(width: 16),
          PopupMenuButton<String>(
            icon: const Icon(Icons.sort, size: 20),
            onSelected: (value) {},
            itemBuilder: (context) => [
              const PopupMenuItem(value: 'name', child: Text('Name')),
              const PopupMenuItem(value: 'size', child: Text('Size')),
              const PopupMenuItem(value: 'date', child: Text('Date Modified')),
              const PopupMenuItem(value: 'type', child: Text('Type')),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFileList(AppProvider provider) {
    // Error state
    if (provider.error != null && provider.currentRemote.isNotEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 52, color: Colors.red.withOpacity(0.5)),
            const SizedBox(height: 16),
            const Text('Could not load files', style: TextStyle(color: Colors.white70, fontSize: 16)),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 40),
              child: Text(provider.error!,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white.withOpacity(0.35), fontSize: 12)),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: () {
                final rcloneService = context.read<RCloneService>();
                provider.navigateTo(provider.currentRemote, provider.currentPath, rcloneService);
              },
              icon: const Icon(Icons.refresh, size: 16),
              label: const Text('Retry'),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6366F1)),
            ),
          ],
        ),
      );
    }
    if (provider.isLoading) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF6366F1)),
            ),
            SizedBox(height: 16),
            Text('Loading files...', style: TextStyle(color: Colors.white54)),
          ],
        ),
      );
    }

    // No remote selected
    if (provider.currentRemote.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [const Color(0xFF6366F1).withOpacity(0.2), const Color(0xFF8B5CF6).withOpacity(0.1)],
                ),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Icon(Icons.add_to_drive, size: 40, color: Colors.white.withOpacity(0.3)),
            ),
            const SizedBox(height: 20),
            const Text(
              'No account connected',
              style: TextStyle(color: Colors.white70, fontSize: 18, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            Text(
              'Click "Add Account" to connect a cloud drive',
              style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 14),
            ),
          ],
        ),
      );
    }

    final files = provider.currentFiles;

    if (files.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.folder_open,
              size: 64,
              color: Colors.white.withOpacity(0.2),
            ),
            const SizedBox(height: 16),
            Text(
              'This folder is empty',
              style: TextStyle(
                color: Colors.white.withOpacity(0.5),
                fontSize: 16,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Upload files or create a new folder',
              style: TextStyle(
                color: Colors.white.withOpacity(0.3),
                fontSize: 14,
              ),
            ),
          ],
        ),
      );
    }
    
    if (_viewMode == 'grid') {
      return GridView.builder(
        padding: const EdgeInsets.all(24),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 5,
          crossAxisSpacing: 16,
          mainAxisSpacing: 16,
          childAspectRatio: 0.85,
        ),
        itemCount: files.length,
        itemBuilder: (context, index) {
          final file = files[index];
          return _FileCard(file: file);
        },
      );
    } else {
      return ListView.builder(
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: files.length,
        itemBuilder: (context, index) {
          final file = files[index];
          return _FileListItem(file: file);
        },
      );
    }
  }

  void _showNewFolderDialog(BuildContext context, AppProvider provider) {
    final nameController = TextEditingController();
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B).withOpacity(0.9),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: Colors.white.withOpacity(0.1)),
        ),
        title: const Text(
          'New Folder',
          style: TextStyle(color: Colors.white),
        ),
        content: TextField(
          controller: nameController,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Folder Name',
            labelStyle: TextStyle(color: Colors.white70),
          ),
          style: const TextStyle(color: Colors.white),
          onSubmitted: (_) {
            Navigator.pop(context);
            // Create folder
          },
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              if (nameController.text.isNotEmpty) {
                // Create folder with rclone
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF6366F1),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            child: const Text('Create'),
          ),
        ],
      ),
    );
  }
}

class _FileCard extends StatelessWidget {
  final FileItem file;

  const _FileCard({required this.file});

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        onDoubleTap: () {
          if (file.isDir) {
            final rcloneService = context.read<RCloneService>();
            final provider = context.read<AppProvider>();
            final newPath = provider.currentPath.isEmpty ? file.name : '${provider.currentPath}/${file.name}';
            provider.navigateTo(provider.currentRemote, newPath, rcloneService);
          }
        },
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.05),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: Colors.white.withOpacity(0.1),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Icon area
              Expanded(
                child: Center(
                  child: Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      gradient: file.isDir
                          ? const LinearGradient(
                              colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                            )
                          : const LinearGradient(
                              colors: [Color(0xFF3B82F6), Color(0xFF06B6D4)],
                            ),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      file.isDir ? Icons.folder : Icons.insert_drive_file,
                      color: Colors.white,
                      size: 32,
                    ),
                  ),
                ),
              ),
              
              // File info
              Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      file.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      file.formattedSize,
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.4),
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FileListItem extends StatelessWidget {
  final FileItem file;

  const _FileListItem({required this.file});

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('MMM dd, yyyy HH:mm');
    
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: Colors.white.withOpacity(0.1),
        ),
      ),
      child: Row(
        children: [
          // Icon
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              gradient: file.isDir
                  ? const LinearGradient(
                      colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                    )
                  : const LinearGradient(
                      colors: [Color(0xFF3B82F6), Color(0xFF06B6D4)],
                    ),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              file.isDir ? Icons.folder : Icons.insert_drive_file,
              color: Colors.white,
              size: 22,
            ),
          ),
          
          const SizedBox(width: 16),
          
          // Name
          Expanded(
            flex: 3,
            child: Text(
              file.name,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          
          // Size
          Expanded(
            flex: 1,
            child: Text(
              file.formattedSize,
              style: TextStyle(
                color: Colors.white.withOpacity(0.5),
                fontSize: 13,
              ),
            ),
          ),
          
          // Type
          Expanded(
            flex: 1,
            child: Text(
              file.isDir ? 'Folder' : (file.mimeType.split('/').last),
              style: TextStyle(
                color: Colors.white.withOpacity(0.5),
                fontSize: 13,
              ),
            ),
          ),
          
          // Modified
          Expanded(
            flex: 2,
            child: Text(
              file.modified != null 
                  ? dateFormat.format(file.modified!) 
                  : '--',
              style: TextStyle(
                color: Colors.white.withOpacity(0.5),
                fontSize: 13,
              ),
            ),
          ),
          
          // Actions
          PopupMenuButton<String>(
            icon: Icon(
              Icons.more_vert,
              color: Colors.white.withOpacity(0.3),
              size: 20,
            ),
            onSelected: (value) {
              // Handle actions
            },
            itemBuilder: (context) => [
              const PopupMenuItem(value: 'open', child: Text('Open')),
              const PopupMenuItem(value: 'download', child: Text('Download')),
              const PopupMenuItem(value: 'rename', child: Text('Rename')),
              const PopupMenuItem(value: 'move', child: Text('Move')),
              const PopupMenuItem(value: 'copy', child: Text('Copy')),
              const PopupMenuItem(
                value: 'delete',
                child: Row(
                  children: [
                    Icon(Icons.delete, size: 18, color: Colors.red),
                    SizedBox(width: 8),
                    Text('Delete', style: TextStyle(color: Colors.red)),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
