import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';

import '../models/models.dart';
import '../components/transfer_modal.dart';

class TransfersView extends StatefulWidget {
  const TransfersView({super.key});

  @override
  State<TransfersView> createState() => _TransfersViewState();
}

class _TransfersViewState extends State<TransfersView> {
  String _filter = 'all'; // all, active, completed

  @override
  Widget build(BuildContext context) {
    return Consumer<AppProvider>(
      builder: (context, provider, _) {
        final transfers = provider.activeTransfers;
        
        return Container(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                children: [
                  const Icon(
                    Icons.swap_horiz,
                    color: Color(0xFF6366F1),
                    size: 28,
                  ),
                  const SizedBox(width: 16),
                  const Text(
                    'Transfers Manager',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const Spacer(),
                  // New Transfer Button
                  ElevatedButton.icon(
                    onPressed: () {
                      showDialog(
                        context: context,
                        builder: (context) => const TransferModal(),
                      );
                    },
                    icon: const Icon(Icons.add, size: 18),
                    label: const Text('New Transfer'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF6366F1),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ],
              ),
              
              const SizedBox(height: 32),
              
              // Filter tabs
              Row(
                children: [
                  _FilterChip(
                    label: 'All',
                    isSelected: _filter == 'all',
                    onTap: () => setState(() => _filter = 'all'),
                  ),
                  const SizedBox(width: 12),
                  _FilterChip(
                    label: 'Active',
                    isSelected: _filter == 'active',
                    onTap: () => setState(() => _filter = 'active'),
                  ),
                  const SizedBox(width: 12),
                  _FilterChip(
                    label: 'Completed',
                    isSelected: _filter == 'completed',
                    onTap: () => setState(() => _filter = 'completed'),
                  ),
                ],
              ),
              
              const SizedBox(height: 24),
              
              // Stats
              if (transfers.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 32),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                    ),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _StatItem(
                        label: 'Total Transfers',
                        value: transfers.length.toString(),
                      ),
                      Container(
                        height: 48,
                        width: 1,
                        color: Colors.white.withOpacity(0.2),
                      ),
                      _StatItem(
                        label: 'Active',
                        value: transfers.where((t) => t.state == 'RUNNING').length.toString(),
                      ),
                      Container(
                        height: 48,
                        width: 1,
                        color: Colors.white.withOpacity(0.2),
                      ),
                      _StatItem(
                        label: 'Completed',
                        value: transfers.where((t) => t.state == 'DONE').length.toString(),
                      ),
                    ],
                  ),
                ),
              
              const SizedBox(height: 32),
              
              // Transfer list
              Expanded(
                child: transfers.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(24),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.05),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                Icons.swap_horiz,
                                size: 64,
                                color: Colors.white.withOpacity(0.2),
                              ),
                            ),
                            const SizedBox(height: 24),
                            Text(
                              'No active transfers',
                              style: TextStyle(
                                color: Colors.white.withOpacity(0.5),
                                fontSize: 16,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        itemCount: transfers.length,
                        itemBuilder: (context, index) {
                          final transfer = transfers[index];
                          // filter logic
                          if (_filter == 'active' && transfer.state == 'DONE') return const SizedBox.shrink();
                          if (_filter == 'completed' && transfer.state != 'DONE') return const SizedBox.shrink();
                          
                          return _TransferCard(transfer: transfer);
                        },
                      ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected
              ? const Color(0xFF6366F1).withOpacity(0.2)
              : Colors.white.withOpacity(0.05),
          border: Border.all(
            color: isSelected ? const Color(0xFF6366F1) : Colors.transparent,
          ),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : Colors.white.withOpacity(0.6),
            fontSize: 14,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
      ),
    );
  }
}

class _StatItem extends StatelessWidget {
  final String label;
  final String value;

  const _StatItem({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 28,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          label,
          style: TextStyle(
            color: Colors.white.withOpacity(0.8),
            fontSize: 13,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

class _TransferCard extends StatelessWidget {
  final TransferJob transfer;

  const _TransferCard({required this.transfer});

  @override
  Widget build(BuildContext context) {
    final isComplete = transfer.state == 'DONE' || transfer.percent >= 100;
    final isError = transfer.state == 'ERROR' || transfer.error.isNotEmpty;
    
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.03),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isError
              ? Colors.red.withOpacity(0.3)
              : Colors.white.withOpacity(0.08),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  gradient: isComplete
                      ? const LinearGradient(colors: [Color(0xFF10B981), Color(0xFF34D399)])
                      : isError
                          ? const LinearGradient(colors: [Color(0xFFEF4444), Color(0xFFF87171)])
                          : const LinearGradient(colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)]),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  isComplete ? Icons.check_circle : isError ? Icons.error : Icons.sync,
                  color: Colors.white,
                  size: 24,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      transfer.method.toUpperCase(),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${transfer.source} → ${transfer.destination}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.6),
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
              if (!isComplete && !isError)
                Text(
                  '${transfer.percent.toStringAsFixed(1)}%',
                  style: const TextStyle(
                    color: Color(0xFF6366F1),
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
            ],
          ),
          
          const SizedBox(height: 16),
          
          // Progress bar
          if (!isComplete && !isError)
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: LinearProgressIndicator(
                value: transfer.percent / 100,
                backgroundColor: Colors.white.withOpacity(0.05),
                valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF6366F1)),
                minHeight: 8,
              ),
            ),
          
          if (isError)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.red.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                transfer.error,
                style: const TextStyle(color: Colors.red, fontSize: 13),
              ),
            ),
          
          const SizedBox(height: 16),
          
          // Stats
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  if (!isComplete && !isError) ...[
                    _InfoChip(icon: Icons.speed, label: transfer.formattedSpeed),
                    const SizedBox(width: 16),
                    _InfoChip(icon: Icons.access_time, label: transfer.formattedEta),
                    const SizedBox(width: 16),
                  ],
                  _InfoChip(icon: Icons.storage, label: _formatBytes(transfer.bytes)),
                ],
              ),
              Text(
                DateFormat('MMM dd, HH:mm').format(transfer.startTime),
                style: TextStyle(
                  color: Colors.white.withOpacity(0.4),
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatBytes(int bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    int unitIndex = 0;
    double size = bytes.toDouble();
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return '${size.toStringAsFixed(1)} ${units[unitIndex]}';
  }
}

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;

  const _InfoChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: Colors.white.withOpacity(0.4)),
        const SizedBox(width: 6),
        Text(
          label,
          style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 12),
        ),
      ],
    );
  }
}
