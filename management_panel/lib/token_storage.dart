import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:crypto/crypto.dart';
import 'dart:convert';
import 'dart:io';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import 'package:path_provider/path_provider.dart';

class TokenStorage {
  static const String _tokenKey = 'auth_token';
  static final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();
  static Database? _database;

  static Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  static Future<Database> _initDatabase() async {
    final documentsDirectory = await getApplicationDocumentsDirectory();
    final path = join(documentsDirectory.path, 'tokens.db');
    return await openDatabase(
      path,
      version: 1,
      onCreate: _onCreate,
    );
  }

  static Future<void> _onCreate(Database db, int version) async {
    await db.execute('''
      CREATE TABLE device_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_fingerprint TEXT UNIQUE,
        token TEXT,
        created_at INTEGER,
        last_used INTEGER
      )
    ''');
  }

  static Future<String> _getDeviceFingerprint() async {
    final deviceInfo = DeviceInfoPlugin();
    String fingerprint = '';

    try {
      if (Platform.isAndroid) {
        final androidInfo = await deviceInfo.androidInfo;
        fingerprint = '${androidInfo.id}_${androidInfo.serialNumber}';
      } else if (Platform.isIOS) {
        final iosInfo = await deviceInfo.iosInfo;
        fingerprint = '${iosInfo.identifierForVendor}_${iosInfo.name}';
      } else if (Platform.isWindows) {
        // For Windows, use a combination of system info
        fingerprint = 'windows_device_${DateTime.now().millisecondsSinceEpoch}';
      } else if (Platform.isLinux) {
        // For Linux, use a combination of system info
        fingerprint = 'linux_device_${DateTime.now().millisecondsSinceEpoch}';
      } else if (Platform.isMacOS) {
        final macInfo = await deviceInfo.macOsInfo;
        fingerprint = '${macInfo.systemGUID}_${macInfo.computerName}';
      } else {
        // Fallback for other platforms
        fingerprint = 'unknown_device_${DateTime.now().millisecondsSinceEpoch}';
      }
    } catch (e) {
      // Fallback if device info fails
      fingerprint = 'fallback_device_${DateTime.now().millisecondsSinceEpoch}';
    }

    // Hash the fingerprint for consistency
    final bytes = utf8.encode(fingerprint);
    final hash = sha256.convert(bytes);
    return hash.toString();
  }

  static Future<void> saveToken(String token) async {
    try {
      // Save to secure storage
      await _secureStorage.write(key: _tokenKey, value: token);

      // Save to local database with device fingerprint
      final deviceFingerprint = await _getDeviceFingerprint();
      final db = await database;

      await db.insert(
        'device_tokens',
        {
          'device_fingerprint': deviceFingerprint,
          'token': token,
          'created_at': DateTime.now().millisecondsSinceEpoch,
          'last_used': DateTime.now().millisecondsSinceEpoch,
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );

      print('🔐 Token saved securely for device: $deviceFingerprint');
    } catch (e) {
      print('❌ Error saving token: $e');
      throw e;
    }
  }

  static Future<String?> getToken() async {
    try {
      // First try to get from secure storage
      final secureToken = await _secureStorage.read(key: _tokenKey);
      if (secureToken != null) {
        // Verify against database
        final deviceFingerprint = await _getDeviceFingerprint();
        final db = await database;

        final result = await db.query(
          'device_tokens',
          where: 'device_fingerprint = ?',
          whereArgs: [deviceFingerprint],
        );

        if (result.isNotEmpty && result.first['token'] == secureToken) {
          // Update last used timestamp
          await db.update(
            'device_tokens',
            {'last_used': DateTime.now().millisecondsSinceEpoch},
            where: 'device_fingerprint = ?',
            whereArgs: [deviceFingerprint],
          );

          print('🔐 Token retrieved securely for device: $deviceFingerprint');
          return secureToken;
        } else {
          // Token mismatch - clear insecure data
          await clearToken();
          print('⚠️ Token mismatch detected - cleared insecure data');
          return null;
        }
      }
    } catch (e) {
      print('❌ Error retrieving token: $e');
    }
    return null;
  }

  static Future<void> clearToken() async {
    try {
      // Clear from secure storage
      await _secureStorage.delete(key: _tokenKey);

      // Clear from local database
      final deviceFingerprint = await _getDeviceFingerprint();
      final db = await database;

      await db.delete(
        'device_tokens',
        where: 'device_fingerprint = ?',
        whereArgs: [deviceFingerprint],
      );

      print('🗑️ Token cleared from device: $deviceFingerprint');
    } catch (e) {
      print('❌ Error clearing token: $e');
      throw e;
    }
  }

  static Future<List<Map<String, dynamic>>> getAllDeviceTokens() async {
    final db = await database;
    return await db.query('device_tokens', orderBy: 'last_used DESC');
  }

  static Future<void> migrateOldTokens() async {
    try {
      // Check if there are any tokens in the old insecure storage
      // This is a migration helper for existing installations
      final oldToken = await _secureStorage.read(key: 'old_token_key'); // Adjust key as needed
      if (oldToken != null && oldToken.isNotEmpty) {
        await saveToken(oldToken);
        await _secureStorage.delete(key: 'old_token_key');
        print('✅ Migrated old token to secure storage');
      }
    } catch (e) {
      print('⚠️ Migration check failed: $e');
    }
  }
}
