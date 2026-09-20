import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:window_manager/window_manager.dart';
import 'package:bitsdojo_window/bitsdojo_window.dart';
import 'package:google_fonts/google_fonts.dart';
import 'services/rclone_service.dart';
import 'models/models.dart';
import 'screens/main_screen.dart';
import 'components/custom_title_bar.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Configure window for Windows desktop - matching webapp design
  await windowManager.ensureInitialized();
  
  WindowOptions windowOptions = const WindowOptions(
    size: Size(1400, 900),
    minimumSize: Size(1000, 700),
    center: true,
    backgroundColor: Colors.transparent,
    skipTaskbar: false,
    titleBarStyle: TitleBarStyle.hidden,
    windowButtonVisibility: false,
  );
  
  await windowManager.waitUntilReadyToShow(windowOptions, () async {
    await windowManager.show();
    await windowManager.focus();
  });

  runApp(const GridlyDesktopApp());
  
  doWhenWindowReady(() {
    final win = appWindow;
    const initialSize = Size(1400, 900);
    win.minSize = const Size(1000, 700);
    win.size = initialSize;
    win.alignment = Alignment.center;
    win.title = "Gridly Desktop - Advanced Drive Manager";
    win.show();
  });
}

class GridlyDesktopApp extends StatelessWidget {
  const GridlyDesktopApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AppProvider()),
        Provider<RCloneService>(
          create: (_) => RCloneService(),
          dispose: (_, service) => service.dispose(),
        ),
      ],
      child: MaterialApp(
        title: 'Gridly Desktop',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          brightness: Brightness.dark,
gridly-desktop-with-rclone-integration-5dfd5
          primaryColor: const Color(0xFF6366F1),
          scaffoldBackgroundColor: const Color(0xFF0A0A0A),
          colorScheme: const ColorScheme.dark(
            primary: Color(0xFF6366F1),
            secondary: Color(0xFF8B5CF6),
            tertiary: Color(0xFF06B6D4),
            surface: Color(0xFF0F172A),
            background: Color(0xFF0A0A0A),
            error: Color(0xFFEF4444),
          ),
          fontFamily: 'Inter',
          cardTheme: CardTheme(
            color: const Color(0xFF0F172A).withOpacity(0.6),
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(color: Colors.white.withOpacity(0.05)),
=======
          primaryColor: const Color(0xFF6366F1), // primary
          scaffoldBackgroundColor: const Color(0xFF0F172A),
          colorScheme: const ColorScheme.dark(
            primary: Color(0xFF6366F1), // primary
            secondary: Color(0xFF8B5CF6), // secondary
            tertiary: Color(0xFF06B6D4), // accent
            surface: Color(0xFF1E293B),
            background: Color(0xFF0F172A),
            error: Color(0xFFEF4444),
          ),
          textTheme: GoogleFonts.interTextTheme(Theme.of(context).textTheme).apply(
            bodyColor: Colors.white,
            displayColor: Colors.white,
          ),
          cardTheme: CardThemeData(
            color: const Color(0xFF1E293B).withOpacity(0.4),
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(
                color: const Color(0xFF6366F1).withOpacity(0.15),
              ),
main
            ),
          ),
          appBarTheme: const AppBarTheme(
            backgroundColor: Colors.transparent,
            elevation: 0,
          ),
          inputDecorationTheme: InputDecorationTheme(
            filled: true,
 gridly-desktop-with-rclone-integration-5dfd5
            fillColor: Colors.white.withOpacity(0.05),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(999),
              borderSide: BorderSide.none,
=======
            fillColor: const Color(0xFF1E293B).withOpacity(0.6),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
main
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(999),
              borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(999),
              borderSide: const BorderSide(color: Color(0xFF6366F1), width: 2),
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          ),
        ),
        home: const MainScreen(),
      ),
    );
  }
}
