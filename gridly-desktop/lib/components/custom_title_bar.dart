import 'package:flutter/material.dart';
import 'package:bitsdojo_window/bitsdojo_window.dart';

class CustomTitleBar extends StatelessWidget {
  const CustomTitleBar({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 40,
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        border: Border(
          bottom: BorderSide(
            color: Colors.white.withOpacity(0.05),
            width: 1,
          ),
        ),
      ),
      child: Row(
        children: [
          // App icon and title
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                    ),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Icon(
                    Icons.grid_on,
                    size: 16,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(width: 10),
                const Text(
                  'Gridly Desktop',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          
          const Spacer(),
          
          // Window controls
          WindowTitleBarBox(
            child: Row(
              children: [
                _WindowButton(
                  icon: Icons.remove,
                  onPressed: () => appWindow.minimize(),
                ),
                _WindowButton(
                  icon: Icons.crop_square,
                  onPressed: () => appWindow.maximizeOrRestore(),
                ),
                _WindowButton(
                  icon: Icons.close,
                  isClose: true,
                  onPressed: () => appWindow.close(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _WindowButton extends StatelessWidget {
  final IconData icon;
  final bool isClose;
  final VoidCallback onPressed;

  const _WindowButton({
    required this.icon,
    this.isClose = false,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        onTap: onPressed,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          width: 46,
          height: 40,
          alignment: Alignment.center,
          color: isClose 
              ? Colors.transparent 
              : Colors.white.withOpacity(0.0),
          child: Icon(
            icon,
            size: 16,
            color: isClose 
                ? Colors.white 
                : Colors.white.withOpacity(0.7),
          ),
        ),
      ),
    );
  }
}
