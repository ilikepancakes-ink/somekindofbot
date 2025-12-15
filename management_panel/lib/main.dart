import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';
import 'package:app_links/app_links.dart';
import 'package:http/http.dart' as http;
import 'package:flutter/services.dart';
import 'dart:async';
import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import 'l10n/app_localizations.dart';
import 'providers/settings_provider.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => SettingsProvider()),
      ],
      child: Consumer<SettingsProvider>(
        builder: (context, settings, child) {
          return MaterialApp(
            title: 'Management Panel',
            theme: ThemeData(
              primarySwatch: Colors.blue,
              brightness: Brightness.light,
            ),
            darkTheme: ThemeData(
              primarySwatch: Colors.blue,
              brightness: Brightness.dark,
            ),
            themeMode: settings.themeMode,
            locale: settings.locale,
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: const [
              Locale('en'),
              Locale('nl'),
              Locale('ru'),
            ],
            home: const HomePage(),
          );
        },
      ),
    );
  }
}

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final TextEditingController _tokenController = TextEditingController();
  String? _token;
  StreamSubscription<Uri?>? _sub;
  final _appLinks = AppLinks();
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();
  Database? _database;
  String? _deviceId;

  @override
  void initState() {
    super.initState();
    _initApp();
    _handleIncomingLinks();
    _handleInitialLink();
  }

  Future<void> _initApp() async {
    await _initDatabase();
    await _loadDeviceId();
    await _loadToken();
  }

  Future<void> _initDatabase() async {
    final databasesPath = await getDatabasesPath();
    final path = join(databasesPath, 'tokens.db');
    _database = await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) {
        return db.execute(
          'CREATE TABLE tokens (device_id TEXT PRIMARY KEY, token TEXT)',
        );
      },
    );
  }

  Future<void> _loadDeviceId() async {
    final deviceInfo = DeviceInfoPlugin();
    if (defaultTargetPlatform == TargetPlatform.iOS) {
      final iosInfo = await deviceInfo.iosInfo;
      _deviceId = iosInfo.identifierForVendor;
    } else if (defaultTargetPlatform == TargetPlatform.android) {
      final androidInfo = await deviceInfo.androidInfo;
      _deviceId = androidInfo.id;
    } else if (defaultTargetPlatform == TargetPlatform.windows) {
      final windowsInfo = await deviceInfo.windowsInfo;
      _deviceId = windowsInfo.deviceId;
    } else if (defaultTargetPlatform == TargetPlatform.linux) {
      final linuxInfo = await deviceInfo.linuxInfo;
      _deviceId = linuxInfo.machineId;
    } else {
      _deviceId = 'unknown';
    }
  }

  Future<void> _loadToken() async {
    // First try secure storage
    String? token = await _secureStorage.read(key: 'auth_token');
    if (token == null && _database != null) {
      // Fallback to DB
      final maps = await _database!.query('tokens', where: 'device_id = ?', whereArgs: [_deviceId]);
      if (maps.isNotEmpty) {
        token = maps.first['token'] as String?;
      }
    }
    if (token != null) {
      setState(() {
        _token = token;
      });
    }
  }

  Future<void> _saveToken(String token) async {
    // Try secure storage first, fall back to DB
    try {
      await _secureStorage.write(key: 'auth_token', value: token);
    } catch (e) {
      // Secure storage failed, continue with DB storage
    }

    // Always save to DB for persistence
    if (_database != null && _deviceId != null) {
      await _database!.insert(
        'tokens',
        {'device_id': _deviceId, 'token': token},
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  void _handleIncomingLinks() {
    _sub = _appLinks.uriLinkStream.listen((Uri? uri) {
      if (uri != null) {
        _handleLink(uri);
      }
    });
  }

  void _handleInitialLink() async {
    try {
      final uri = await _appLinks.getInitialLink();
      if (uri != null) {
        _handleLink(uri);
      }
    } catch (e) {
      // Handle error
    }
  }

  void _handleLink(Uri uri) async {
    if (uri.scheme == 'somekindofbot' && uri.host == 'callback') {
      final token = uri.queryParameters['token'];
      if (token != null) {
        await _saveToken(token);
        setState(() {
          _token = token;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Bot Management'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: _token != null
            ? ManagementScreen(token: _token!)
            : Column(
                children: [
                  const Text(
                    'Use the /generate-token command in Discord to get your auth token.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 16),
                  ),
                  const SizedBox(height: 20),
                  TextField(
                    controller: _tokenController,
                    decoration: const InputDecoration(
                      labelText: 'Auth Token',
                      hintText: 'Paste your auth token here',
                    ),
                    enabled: true,
                    readOnly: false,
                    keyboardType: TextInputType.text,
                    textInputAction: TextInputAction.done,
                    autofocus: true,
                    onChanged: (value) {
                      print('Token input changed: ${value.length} characters');
                    },
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: _loginWithToken,
                    child: const Text('Login'),
                  ),
                ],
              ),
      ),
    );
  }

  void _loginWithToken() async {
    final token = _tokenController.text.trim();
    if (token.isEmpty) return;

    await _saveToken(token);
    setState(() {
      _token = token;
    });
  }
}

class ManagementScreen extends StatefulWidget {
  final String token;

  const ManagementScreen({super.key, required this.token});

  @override
  State<ManagementScreen> createState() => _ManagementScreenState();
}

class _ManagementScreenState extends State<ManagementScreen> {
  List<Map<String, dynamic>> timeouts = [];
  List<Map<String, dynamic>> bans = [];
  List<Map<String, dynamic>> warns = [];
  List<Map<String, dynamic>> roles = [];
  List<Map<String, dynamic>> members = [];
  List<Map<String, dynamic>> envVars = [];
  List<Map<String, dynamic>> servers = [];
  String? selectedServerId;
  Timer? _refreshTimer;
  bool _isLoading = true;
  String? _errorMessage;
  bool _touchBarSetup = false;

  @override
  void initState() {
    super.initState();
    _loadServers();
    _loadData();
    _startAutoRefresh();
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  void _startAutoRefresh() {
    // Refresh server data every 30 seconds
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (timer) {
      _loadServers();
      _loadData();
    });
  }

  void _setupTouchBar(BuildContext buildContext) {
    const platform = MethodChannel('com.example.management_panel/touchbar');
    // Notify native side that user is logged in
    platform.invokeMethod('setLoginStatus', true);
    platform.setMethodCallHandler((call) async {
      if (!mounted) return;
      switch (call.method) {
        case 'showMembers':
          ScaffoldMessenger.of(buildContext).showSnackBar(const SnackBar(content: Text('Members accessed from Touch Bar')));
          break;
        case 'selectServer':
          final serverId = call.arguments as String;
          setState(() {
            selectedServerId = serverId;
          });
          _loadData();
          ScaffoldMessenger.of(buildContext).showSnackBar(SnackBar(content: Text('Server switched to $serverId from Touch Bar')));
          break;
        case 'updateBot':
          try {
            const baseUrl = 'https://discordbot.0x409.nl';
            await http.post(Uri.parse('$baseUrl/api/update'), headers: {'Authorization': 'Bearer ${widget.token}'});
            ScaffoldMessenger.of(buildContext).showSnackBar(const SnackBar(content: Text('Updating from Touch Bar...')));
          } catch (e) {
            print('❌ API Error in Touch Bar updateBot: $e');
            print('   URL: https://discordbot.0x409.nl/api/update');
            print('   Token: ${widget.token.substring(0, 20)}...');
            ScaffoldMessenger.of(buildContext).showSnackBar(const SnackBar(content: Text('Failed to update bot from Touch Bar')));
          }
          break;
        case 'restartBot':
          try {
            const baseUrl = 'https://discordbot.0x409.nl';
            await http.post(Uri.parse('$baseUrl/api/restart'), headers: {'Authorization': 'Bearer ${widget.token}'});
            ScaffoldMessenger.of(buildContext).showSnackBar(const SnackBar(content: Text('Restarting from Touch Bar...')));
          } catch (e) {
            print('❌ API Error in Touch Bar restartBot: $e');
            print('   URL: https://discordbot.0x409.nl/api/restart');
            print('   Token: ${widget.token.substring(0, 20)}...');
            ScaffoldMessenger.of(buildContext).showSnackBar(const SnackBar(content: Text('Failed to restart bot from Touch Bar')));
          }
          break;
      }
    });
  }

  Future<void> _loadData() async {
    const baseUrl = 'https://discordbot.0x409.nl';
    final headers = {'Authorization': 'Bearer ${widget.token}'};
    final guildParam = selectedServerId != null ? '?guildId=$selectedServerId' : '';

    try {
      final res1 = await http.get(Uri.parse('$baseUrl/api/timeouts$guildParam'), headers: headers);
      timeouts = List<Map<String, dynamic>>.from(jsonDecode(res1.body));

      final res2 = await http.get(Uri.parse('$baseUrl/api/bans$guildParam'), headers: headers);
      bans = List<Map<String, dynamic>>.from(jsonDecode(res2.body));

      final res3 = await http.get(Uri.parse('$baseUrl/api/warns$guildParam'), headers: headers);
      warns = List<Map<String, dynamic>>.from(jsonDecode(res3.body));

      final res4 = await http.get(Uri.parse('$baseUrl/api/roles$guildParam'), headers: headers);
      roles = List<Map<String, dynamic>>.from(jsonDecode(res4.body));

      final res5 = await http.get(Uri.parse('$baseUrl/api/members$guildParam'), headers: headers);
      members = List<Map<String, dynamic>>.from(jsonDecode(res5.body));

      final res6 = await http.get(Uri.parse('$baseUrl/api/env'), headers: headers);
      envVars = List<Map<String, dynamic>>.from(jsonDecode(res6.body));

      setState(() {});
    } catch (e) {
      print('❌ API Error in _loadData: $e');
      print('   URL: $baseUrl');
      print('   Guild: $selectedServerId');
      print('   Token: ${widget.token.substring(0, 20)}...');
    }
  }

  Future<void> _loadServers() async {
    const baseUrl = 'https://discordbot.0x409.nl';
    final headers = {'Authorization': 'Bearer ${widget.token}'};

    try {
      print('🌐 Loading servers from API...');
      final res = await http.get(Uri.parse('$baseUrl/api/guilds'), headers: headers);
      servers = List<Map<String, dynamic>>.from(jsonDecode(res.body));
      if (servers.isNotEmpty) {
        selectedServerId = servers[0]['id'];
      }
      _isLoading = false;
      _errorMessage = null;
      print('✅ Successfully loaded ${servers.length} servers');
      setState(() {});
    } catch (e) {
      print('❌ API Error in _loadServers: $e');
      print('   URL: $baseUrl/api/guilds');
      print('   Token: ${widget.token.substring(0, 20)}...');

      _isLoading = false;
      _errorMessage = 'Failed to load servers. Please check your connection and try again.';
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_touchBarSetup) {
      _setupTouchBar(context);
      _touchBarSetup = true;
    }

    // Show loading spinner while initially loading
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    // Show error message if loading failed
    if (_errorMessage != null) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 64, color: Colors.red),
              const SizedBox(height: 16),
              Text(_errorMessage!, textAlign: TextAlign.center, style: const TextStyle(fontSize: 16)),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () {
                  setState(() {
                    _isLoading = true;
                    _errorMessage = null;
                  });
                  _loadServers();
                },
                child: const Text('Retry'),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () async {
                  // Show debug logs on Touch Bar
                  const platform = MethodChannel('com.example.management_panel/touchbar');
                  await platform.invokeMethod('showDebugLogs', {'error': _errorMessage});
                },
                style: ElevatedButton.styleFrom(backgroundColor: Colors.orange),
                child: const Text('Debug Logs'),
              ),
              const SizedBox(height: 16),
              TextButton(
                onPressed: () {
                  // Go back to login screen
                  Navigator.of(context).pushReplacement(
                    MaterialPageRoute(builder: (_) => const HomePage()),
                  );
                },
                child: const Text('Back to Login'),
              ),
            ],
          ),
        ),
      );
    }

    // Show main interface if servers loaded successfully
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(8.0),
          child: DropdownButton<String>(
            value: selectedServerId,
            onChanged: (value) {
              setState(() {
                selectedServerId = value;
              });
              _loadData();
            },
            items: servers.map((server) {
              return DropdownMenuItem<String>(
                value: server['id'],
                child: Text(server['name']),
              );
            }).toList(),
          ),
        ),
        Expanded(
          child: DefaultTabController(
            length: 7,
            child: Scaffold(
              appBar: AppBar(
                title: Text(AppLocalizations.of(context)?.appTitle ?? 'Bot Management'),
                actions: [
                  IconButton(
                    icon: const Icon(Icons.settings),
                    onPressed: () => _showSettingsDialog(context),
                  ),
                ],
                bottom: TabBar(
                  tabs: [
                    Tab(text: AppLocalizations.of(context)?.timeoutsTab ?? 'Timeouts'),
                    Tab(text: AppLocalizations.of(context)?.bansTab ?? 'Bans'),
                    Tab(text: AppLocalizations.of(context)?.warnsTab ?? 'Warns'),
                    Tab(text: AppLocalizations.of(context)?.rolesTab ?? 'Roles'),
                    Tab(text: AppLocalizations.of(context)?.membersTab ?? 'Members'),
                    Tab(text: AppLocalizations.of(context)?.envVarsTab ?? 'Env Vars'),
                    Tab(text: AppLocalizations.of(context)?.actionsTab ?? 'Actions'),
                  ],
                ),
              ),
              body: TabBarView(
                children: [
                  _buildList('Timeouts', timeouts),
                  _buildList('Bans', bans),
                  _buildList('Warns', warns),
                  _buildList('Roles', roles, editable: true),
                  _buildList('Members', members),
                  _buildEnvList(),
                  _buildActions(context),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildList(String title, List<Map<String, dynamic>> items, {bool editable = false}) {
    return ListView.builder(
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        return ListTile(
          title: Text(item['user'] ?? item['name'] ?? 'Item ${item['id']}'),
          subtitle: Text(item.toString()),
          trailing: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (editable)
                IconButton(
                  icon: const Icon(Icons.edit),
                  onPressed: () => _editRole(context, item),
                ),
              if (title == 'Bans')
                IconButton(
                  icon: const Icon(Icons.undo),
                  tooltip: 'Unban',
                  onPressed: () => _unbanUser(context, item),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildEnvList() {
    return ListView.builder(
      itemCount: envVars.length,
      itemBuilder: (context, index) {
        final item = envVars[index];
        return ListTile(
          title: Text(item['key']),
          subtitle: Text(item['value']),
          trailing: IconButton(
            icon: const Icon(Icons.edit),
            onPressed: () => _editEnv(context, item),
          ),
        );
      },
    );
  }

  void _editEnv(BuildContext context, Map<String, dynamic> item) {
    final controller = TextEditingController(text: item['value']);
    showDialog(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: Text('Edit ${item['key']}'),
        content: TextField(
          controller: controller,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              try {
                item['value'] = controller.text;
                const baseUrl = 'https://discordbot.0x409.nl';
                await http.post(
                  Uri.parse('$baseUrl/api/env'),
                  headers: {'Authorization': 'Bearer ${widget.token}', 'Content-Type': 'application/json'},
                  body: jsonEncode({'key': item['key'], 'value': item['value']}),
                );
                Navigator.pop(context);
                _loadData();
              } catch (e) {
                print('❌ API Error in _editEnv: $e');
                print('   Key: ${item['key']}');
                print('   URL: https://discordbot.0x409.nl/api/env');
                print('   Token: ${widget.token.substring(0, 20)}...');
                // Show error to user but don't close dialog
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Failed to save environment variable')),
                );
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  void _editRole(BuildContext context, Map<String, dynamic> item) {
    final nameController = TextEditingController(text: item['name']);
    final colorController = TextEditingController(text: item['color']);
    showDialog(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: Text('Edit Role ${item['id']}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              decoration: const InputDecoration(labelText: 'Name'),
            ),
            TextField(
              controller: colorController,
              decoration: const InputDecoration(labelText: 'Color'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              try {
                const baseUrl = 'https://discordbot.0x409.nl';
                await http.patch(
                  Uri.parse('$baseUrl/api/roles/${item['id']}'),
                  headers: {'Authorization': 'Bearer ${widget.token}', 'Content-Type': 'application/json'},
                  body: jsonEncode({
                    'guildId': selectedServerId,
                    'name': nameController.text,
                    'color': colorController.text,
                  }),
                );
                Navigator.pop(context);
                _loadData();
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Role updated successfully')));
              } catch (e) {
                print('❌ API Error in _editRole: $e');
                print('   URL: https://discordbot.0x409.nl/api/roles/${item['id']}');
                print('   Token: ${widget.token.substring(0, 20)}...');
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to update role')));
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  void _unbanUser(BuildContext context, Map<String, dynamic> item) {
    showDialog(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: const Text('Unban User'),
        content: Text('Are you sure you want to unban ${item['user']}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              try {
                const baseUrl = 'https://discordbot.0x409.nl';
                await http.delete(
                  Uri.parse('$baseUrl/api/bans'),
                  headers: {'Authorization': 'Bearer ${widget.token}', 'Content-Type': 'application/json'},
                  body: jsonEncode({
                    'guildId': selectedServerId,
                    'userId': item['id'],
                  }),
                );
                Navigator.pop(context);
                _loadData();
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('User unbanned successfully')));
              } catch (e) {
                print('❌ API Error in _unbanUser: $e');
                print('   URL: https://discordbot.0x409.nl/api/bans');
                print('   Token: ${widget.token.substring(0, 20)}...');
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to unban user')));
              }
            },
            child: const Text('Unban'),
          ),
        ],
      ),
    );
  }

  void _showSettingsDialog(BuildContext context) {
    final settings = Provider.of<SettingsProvider>(context, listen: false);
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return Consumer<SettingsProvider>(
          builder: (context, settings, child) {
            return AlertDialog(
              title: Text(AppLocalizations.of(context)?.settings ?? 'Settings'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Theme Section
                  Text(
                    AppLocalizations.of(context)?.theme ?? 'Theme',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  DropdownButton<ThemeMode>(
                    value: settings.themeMode,
                    onChanged: (ThemeMode? newMode) {
                      if (newMode != null) {
                        settings.setThemeMode(newMode);
                      }
                    },
                    items: [
                      DropdownMenuItem(
                        value: ThemeMode.system,
                        child: Text(AppLocalizations.of(context)?.systemMode ?? 'System Mode'),
                      ),
                      DropdownMenuItem(
                        value: ThemeMode.light,
                        child: Text(AppLocalizations.of(context)?.lightMode ?? 'Light Mode'),
                      ),
                      DropdownMenuItem(
                        value: ThemeMode.dark,
                        child: Text(AppLocalizations.of(context)?.darkMode ?? 'Dark Mode'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  // Language Section
                  Text(
                    AppLocalizations.of(context)?.language ?? 'Language',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  DropdownButton<Locale>(
                    value: settings.locale,
                    onChanged: (Locale? newLocale) {
                      if (newLocale != null) {
                        settings.setLocale(newLocale);
                      }
                    },
                    items: const [
                      DropdownMenuItem(
                        value: Locale('en'),
                        child: Text('English'),
                      ),
                      DropdownMenuItem(
                        value: Locale('nl'),
                        child: Text('Nederlands'),
                      ),
                      DropdownMenuItem(
                        value: Locale('ru'),
                        child: Text('Русский'),
                      ),
                    ],
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Close'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Widget _buildActions(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          ElevatedButton(
            onPressed: () async {
              try {
                const baseUrl = 'https://discordbot.0x409.nl';
                await http.post(Uri.parse('$baseUrl/api/update'), headers: {'Authorization': 'Bearer ${widget.token}'});
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Updating...')));
                }
              } catch (e) {
                print('❌ API Error in _buildActions updateBot: $e');
                print('   URL: https://discordbot.0x409.nl/api/update');
                print('   Token: ${widget.token.substring(0, 20)}...');
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to update bot')));
                }
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.blue),
            child: const Text('Update Bot'),
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: () async {
              try {
                const baseUrl = 'https://discordbot.0x409.nl';
                await http.post(Uri.parse('$baseUrl/api/restart'), headers: {'Authorization': 'Bearer ${widget.token}'});
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Restarting...')));
                }
              } catch (e) {
                print('❌ API Error in _buildActions restartBot: $e');
                print('   URL: https://discordbot.0x409.nl/api/restart');
                print('   Token: ${widget.token.substring(0, 20)}...');
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to restart bot')));
                }
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.blue),
            child: const Text('Restart Bot'),
          ),
        ],
      ),
    );
  }
}
