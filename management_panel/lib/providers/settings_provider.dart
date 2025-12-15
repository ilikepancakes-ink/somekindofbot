import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class SettingsProvider extends ChangeNotifier {
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();
  Database? _database;

  ThemeMode _themeMode = ThemeMode.system;
  Locale _locale = const Locale('en');

  ThemeMode get themeMode => _themeMode;
  Locale get locale => _locale;

  SettingsProvider() {
    _initDatabase();
    _loadSettings();
  }

  Future<void> _initDatabase() async {
    final databasesPath = await getDatabasesPath();
    final path = join(databasesPath, 'settings.db');
    _database = await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) {
        return db.execute(
          'CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)',
        );
      },
    );
  }

  Future<void> _loadSettings() async {
    String? themeString;
    String? localeString;

    // Try secure storage first
    try {
      themeString = await _secureStorage.read(key: 'theme_mode');
      localeString = await _secureStorage.read(key: 'locale');
    } catch (e) {
      // Fall back to SQLite if secure storage fails
      if (_database != null) {
        final themeResult = await _database!.query('settings', where: 'key = ?', whereArgs: ['theme_mode']);
        final localeResult = await _database!.query('settings', where: 'key = ?', whereArgs: ['locale']);

        if (themeResult.isNotEmpty) {
          themeString = themeResult.first['value'] as String?;
        }
        if (localeResult.isNotEmpty) {
          localeString = localeResult.first['value'] as String?;
        }
      }
    }

    if (themeString != null) {
      switch (themeString) {
        case 'light':
          _themeMode = ThemeMode.light;
          break;
        case 'dark':
          _themeMode = ThemeMode.dark;
          break;
        case 'system':
        default:
          _themeMode = ThemeMode.system;
          break;
      }
    }

    if (localeString != null) {
      _locale = Locale(localeString);
    }

    notifyListeners();
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    _themeMode = mode;
    String themeString;
    switch (mode) {
      case ThemeMode.light:
        themeString = 'light';
        break;
      case ThemeMode.dark:
        themeString = 'dark';
        break;
      case ThemeMode.system:
      default:
        themeString = 'system';
        break;
    }

    // Try secure storage first, fall back to SQLite
    try {
      await _secureStorage.write(key: 'theme_mode', value: themeString);
    } catch (e) {
      if (_database != null) {
        await _database!.insert(
          'settings',
          {'key': 'theme_mode', 'value': themeString},
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }
    }

    notifyListeners();
  }

  Future<void> setLocale(Locale locale) async {
    _locale = locale;

    // Try secure storage first, fall back to SQLite
    try {
      await _secureStorage.write(key: 'locale', value: locale.languageCode);
    } catch (e) {
      if (_database != null) {
        await _database!.insert(
          'settings',
          {'key': 'locale', 'value': locale.languageCode},
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }
    }

    notifyListeners();
  }
}
