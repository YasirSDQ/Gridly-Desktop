import 'package:flutter/material.dart';
import 'package:bitsdojo_window/bitsdojo_window.dart';

class CustomTitleBar extends StatelessWidget {
  const CustomTitleBar({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 52,
      decoration: BoxDecoration(
        color: const Color(0xFF0A0A0A).withOpacity(0.8),
        border: Border(
          bottom: BorderSide(
            color: Colors.white.withOpacity(0.05),
            width: 1,
          ),
        ),
      ),
      child: Row(
        children: [
          // App icon and title - matching webapp design
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF6366F1), Color(0xFF8B5CF6), Color(0xFF06B6D4)],
                    ),
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF6366F1).withOpacity(0.3),
                        blurRadius: 10,
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.cloud,
                    size: 18,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(width: 12),
                const Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Gridly',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        letterSpacing: -0.5,
                      ),
                    ),
                    Text(
                      'ADVANCED DRIVE MANAGER',
                      style: TextStyle(
                        color: Colors.white38,
                        fontSize: 9,
                        fontWeight: FontWeight.w500,
                        letterSpacing: 1,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          
          const Spacer(),
          
          // Connection status indicator (like webapp)
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: Colors.green,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.green.withOpacity(0.5),
                        blurRadius: 6,
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 6),
                const Text(
                  'Connected to rclone',
                  style: TextStyle(
                    color: Colors.green,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          
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
          width: 50,
          height: 52,
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
