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
import 'package:path/path.dart' as p;
import 'package:local_auth/local_auth.dart';
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
  final LocalAuthentication _localAuth = LocalAuthentication();
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
    final path = p.join(databasesPath, 'tokens.db');
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
      // On macOS and iOS, require biometric authentication before using existing token
      if (defaultTargetPlatform == TargetPlatform.macOS || defaultTargetPlatform == TargetPlatform.iOS) {
        try {
          final canAuthenticateWithBiometrics = await _localAuth.canCheckBiometrics;
          final canAuthenticate = canAuthenticateWithBiometrics || await _localAuth.isDeviceSupported();

          if (canAuthenticate) {
            final authenticated = await _localAuth.authenticate(
              localizedReason: 'Authenticate to access your saved token',
              options: const AuthenticationOptions(
                biometricOnly: false, // Allow fallback to password
                useErrorDialogs: true,
                stickyAuth: true,
              ),
            );

            if (authenticated) {
              setState(() {
                _token = token;
              });
            }
            // If not authenticated, don't set _token (stay on login screen)
          } else {
            // If no biometrics available, still allow access (fallback)
            setState(() {
              _token = token;
            });
          }
        } catch (e) {
          // If authentication fails or is not available, still allow access
          print('Biometric authentication failed or not available: $e');
          setState(() {
            _token = token;
          });
        }
      } else {
        // On other platforms, just set the token
        setState(() {
          _token = token;
        });
      }
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
  List<Map<String, dynamic>> tickets = [];
  List<Map<String, dynamic>> ticketMessages = [];
  String? selectedServerId;
  String? selectedTicketId;
  Timer? _refreshTimer;
  bool _isLoading = true;
  bool _isRefreshing = false;
  String? _errorMessage;
  bool _touchBarSetup = false;

  @override
  void initState() {
    super.initState();
    _initializeData();
    _startAutoRefresh();
  }

  Future<void> _initializeData() async {
    await _loadServers();
    _loadData();
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
            _isRefreshing = true;
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

      _isRefreshing = false;
      setState(() {});
    } catch (e) {
      print('❌ API Error in _loadData: $e');
      print('   URL: $baseUrl');
      print('   Guild: $selectedServerId');
      print('   Token: ${widget.token.substring(0, 20)}...');
      _isRefreshing = false;
      setState(() {});
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

    final screenSize = MediaQuery.of(context).size;
    final isSmallScreen = screenSize.width < 600;
    final isTablet = screenSize.width >= 600 && screenSize.width < 1200;
    final isLargeScreen = screenSize.width >= 1200;

    // Show main interface if servers loaded successfully
    return Column(
      children: [
        Padding(
          padding: EdgeInsets.all(isSmallScreen ? 4.0 : 8.0),
          child: DropdownButton<String>(
            value: selectedServerId,
            onChanged: (value) {
              setState(() {
                selectedServerId = value;
                _isRefreshing = true;
              });
              _loadData();
            },
            items: servers.map((server) {
              return DropdownMenuItem<String>(
                value: server['id'],
                child: Text(
                  server['name'],
                  style: TextStyle(
                    fontSize: isSmallScreen ? 14 : isTablet ? 16 : 18,
                  ),
                ),
              );
            }).toList(),
          ),
        ),
        Expanded(
          child: DefaultTabController(
            length: 9,
            child: Scaffold(
              appBar: AppBar(
                title: Text(
                  AppLocalizations.of(context)?.appTitle ?? 'Bot Management',
                  style: TextStyle(
                    fontSize: isSmallScreen ? 16 : isTablet ? 18 : 20,
                  ),
                ),
                actions: [
                  IconButton(
                    iconSize: isSmallScreen ? 20 : isTablet ? 24 : 28,
                    icon: const Icon(Icons.settings),
                    onPressed: () => _showSettingsDialog(context),
                  ),
                ],
                bottom: TabBar(
                  isScrollable: isSmallScreen,
                  labelPadding: EdgeInsets.symmetric(
                    horizontal: isSmallScreen ? 8 : isTablet ? 12 : 16,
                    vertical: isSmallScreen ? 4 : 8,
                  ),
                  tabs: [
                    Tab(
                      child: Text(
                        AppLocalizations.of(context)?.timeoutsTab ?? 'Timeouts',
                        style: TextStyle(
                          fontSize: isSmallScreen ? 12 : isTablet ? 14 : 16,
                        ),
                      ),
                    ),
                    Tab(
                      child: Text(
                        AppLocalizations.of(context)?.bansTab ?? 'Bans',
                        style: TextStyle(
                          fontSize: isSmallScreen ? 12 : isTablet ? 14 : 16,
                        ),
                      ),
                    ),
                    Tab(
                      child: Text(
                        AppLocalizations.of(context)?.warnsTab ?? 'Warns',
                        style: TextStyle(
                          fontSize: isSmallScreen ? 12 : isTablet ? 14 : 16,
                        ),
                      ),
                    ),
                    Tab(
                      child: Text(
                        AppLocalizations.of(context)?.rolesTab ?? 'Roles',
                        style: TextStyle(
                          fontSize: isSmallScreen ? 12 : isTablet ? 14 : 16,
                        ),
                      ),
                    ),
                    Tab(
                      child: Text(
                        AppLocalizations.of(context)?.membersTab ?? 'Members',
                        style: TextStyle(
                          fontSize: isSmallScreen ? 12 : isTablet ? 14 : 16,
                        ),
                      ),
                    ),
                    Tab(
                      child: Text(
                        AppLocalizations.of(context)?.envVarsTab ?? 'Env Vars',
                        style: TextStyle(
                          fontSize: isSmallScreen ? 12 : isTablet ? 14 : 16,
                        ),
                      ),
                    ),
                    Tab(
                      child: Text(
                        AppLocalizations.of(context)?.actionsTab ?? 'Actions',
                        style: TextStyle(
                          fontSize: isSmallScreen ? 12 : isTablet ? 14 : 16,
                        ),
                      ),
                    ),
                    Tab(text: 'Tickets'),
                    Tab(text: 'Status'),
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
                  _buildTickets(context),
                  _buildStatus(context),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildList(String title, List<Map<String, dynamic>> items, {bool editable = false}) {
    if (_isRefreshing) {
      return const Center(child: CircularProgressIndicator());
    }

    final screenSize = MediaQuery.of(context).size;
    final isSmallScreen = screenSize.width < 600;
    final isTablet = screenSize.width >= 600 && screenSize.width < 1200;

    return ListView.builder(
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        return ListTile(
          contentPadding: EdgeInsets.symmetric(
            horizontal: isSmallScreen ? 12 : isTablet ? 16 : 20,
            vertical: isSmallScreen ? 8 : 12,
          ),
          title: Text(
            item['user'] ?? item['name'] ?? 'Item ${item['id']}',
            style: TextStyle(
              fontSize: isSmallScreen ? 14 : isTablet ? 16 : 18,
            ),
          ),
          subtitle: Text(
            item.toString(),
            style: TextStyle(
              fontSize: isSmallScreen ? 12 : isTablet ? 14 : 16,
            ),
          ),
          trailing: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (editable)
                IconButton(
                  iconSize: isSmallScreen ? 18 : isTablet ? 22 : 24,
                  icon: const Icon(Icons.edit),
                  onPressed: () => _editRole(context, item),
                ),
              if (title == 'Bans')
                IconButton(
                  iconSize: isSmallScreen ? 18 : isTablet ? 22 : 24,
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
    final screenSize = MediaQuery.of(context).size;
    final isSmallScreen = screenSize.width < 600;
    final isTablet = screenSize.width >= 600 && screenSize.width < 1200;

    return ListView.builder(
      itemCount: envVars.length,
      itemBuilder: (context, index) {
        final item = envVars[index];
        return ListTile(
          contentPadding: EdgeInsets.symmetric(
            horizontal: isSmallScreen ? 12 : isTablet ? 16 : 20,
            vertical: isSmallScreen ? 8 : 12,
          ),
          title: Text(
            item['key'],
            style: TextStyle(
              fontSize: isSmallScreen ? 14 : isTablet ? 16 : 18,
            ),
          ),
          subtitle: Text(
            item['value'],
            style: TextStyle(
              fontSize: isSmallScreen ? 12 : isTablet ? 14 : 16,
            ),
          ),
          trailing: IconButton(
            iconSize: isSmallScreen ? 18 : isTablet ? 22 : 24,
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

  Widget _buildTickets(BuildContext context) {
    final screenSize = MediaQuery.of(context).size;
    final isSmallScreen = screenSize.width < 600;

    if (selectedTicketId == null) {
      return FutureBuilder<List<Map<String, dynamic>>>(
        future: _loadTickets(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          } else if (snapshot.hasError) {
            return Center(child: Text('Error: ${snapshot.error}'));
          } else if (snapshot.hasData) {
            final tickets = snapshot.data!;
            return ListView.builder(
              itemCount: tickets.length,
              itemBuilder: (context, index) {
                final ticket = tickets[index];
                final createdAt = DateTime.fromMillisecondsSinceEpoch(ticket['created_at']);
                return ListTile(
                  title: Text('Ticket #${ticket['id']}'),
                  subtitle: Text('Created: ${createdAt.toString()}'),
                  onTap: () {
                    setState(() {
                      selectedTicketId = ticket['id'].toString();
                    });
                    _loadTicketMessages(ticket['id']);
                  },
                );
              },
            );
          } else {
            return const Center(child: Text('No tickets found'));
          }
        },
      );
    } else {
      return Column(
        children: [
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () {
                  setState(() {
                    selectedTicketId = null;
                    ticketMessages = [];
                  });
                },
              ),
              Text('Ticket #$selectedTicketId', style: TextStyle(fontSize: isSmallScreen ? 16 : 18, fontWeight: FontWeight.bold)),
            ],
          ),
          Expanded(
            child: ListView.builder(
              itemCount: ticketMessages.length,
              itemBuilder: (context, index) {
                final message = ticketMessages[index];
                final createdAt = DateTime.fromMillisecondsSinceEpoch(message['created_at']);
                return Card(
                  margin: EdgeInsets.symmetric(
                    horizontal: isSmallScreen ? 8 : 16,
                    vertical: 4,
                  ),
                  child: Padding(
                    padding: EdgeInsets.all(isSmallScreen ? 8 : 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              message['author_username'],
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: isSmallScreen ? 14 : 16,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              createdAt.toString(),
                              style: TextStyle(
                                fontSize: isSmallScreen ? 12 : 14,
                                color: Colors.grey,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          message['content'],
                          style: TextStyle(fontSize: isSmallScreen ? 14 : 16),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      );
    }
  }

  Future<List<Map<String, dynamic>>> _loadTickets() async {
    const baseUrl = 'https://discordbot.0x409.nl';
    final headers = {'Authorization': 'Bearer ${widget.token}'};
    final guildParam = selectedServerId != null ? '?guildId=$selectedServerId' : '';

    try {
      final response = await http.get(Uri.parse('$baseUrl/api/tickets$guildParam'), headers: headers);
      final tickets = List<Map<String, dynamic>>.from(jsonDecode(response.body));
      setState(() {
        this.tickets = tickets;
      });
      return tickets;
    } catch (e) {
      print('❌ API Error in _loadTickets: $e');
      return [];
    }
  }

  Future<void> _loadTicketMessages(int ticketId) async {
    const baseUrl = 'https://discordbot.0x409.nl';
    final headers = {'Authorization': 'Bearer ${widget.token}'};

    try {
      final response = await http.get(Uri.parse('$baseUrl/api/tickets/$ticketId/messages'), headers: headers);
      final messages = List<Map<String, dynamic>>.from(jsonDecode(response.body));
      setState(() {
        ticketMessages = messages;
      });
    } catch (e) {
      print('❌ API Error in _loadTicketMessages: $e');
      setState(() {
        ticketMessages = [];
      });
    }
  }

  Widget _buildActions(BuildContext context) {
    final screenSize = MediaQuery.of(context).size;
    final isSmallScreen = screenSize.width < 600;
    final isTablet = screenSize.width >= 600 && screenSize.width < 1200;

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(
            width: isSmallScreen ? 150 : isTablet ? 200 : 250,
            height: isSmallScreen ? 45 : isTablet ? 50 : 55,
            child: ElevatedButton(
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
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blue,
                textStyle: TextStyle(
                  fontSize: isSmallScreen ? 14 : isTablet ? 16 : 18,
                ),
              ),
              child: const Text('Update Bot'),
            ),
          ),
          SizedBox(height: isSmallScreen ? 15 : 20),
          SizedBox(
            width: isSmallScreen ? 150 : isTablet ? 200 : 250,
            height: isSmallScreen ? 45 : isTablet ? 50 : 55,
            child: ElevatedButton(
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
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blue,
                textStyle: TextStyle(
                  fontSize: isSmallScreen ? 14 : isTablet ? 16 : 18,
                ),
              ),
              child: const Text('Restart Bot'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatus(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _checkStatuses(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        } else if (snapshot.hasError) {
          return Center(child: Text('Error: ${snapshot.error}'));
        } else if (snapshot.hasData) {
          final statuses = snapshot.data!;
          return ListView.builder(
            itemCount: statuses.length,
            itemBuilder: (context, index) {
              final status = statuses[index];
              return ListTile(
                title: Text(status['name']),
                subtitle: Text(status['ping'] != null ? '${status['ping']} ms' : 'N/A'),
                trailing: Icon(
                  status['status'] == 'online' ? Icons.check_circle : Icons.error,
                  color: status['status'] == 'online' ? Colors.green : Colors.red,
                ),
              );
            },
          );
        } else {
          return const Center(child: Text('No data'));
        }
      },
    );
  }

  Future<List<Map<String, dynamic>>> _checkStatuses() async {
    List<Map<String, dynamic>> statuses = [];

    // Ping endpoints
    final endpoints = [
      {'name': 'Bot Server API', 'url': 'https://discordbot.0x409.nl/api/guilds'},
      {'name': 'Discord Gateway', 'url': 'https://discord.com/api/v10/gateway'},
      {'name': 'Discord Status', 'url': 'https://discordstatus.com/api/v2/status.json'},
      {'name': 'Own Router (Google DNS)', 'url': 'https://8.8.8.8'}, // Placeholder for own router
    ];

    for (final endpoint in endpoints) {
      final start = DateTime.now().millisecondsSinceEpoch;
      try {
        final response = await http.get(Uri.parse(endpoint['url']!), headers: endpoint['url']!.contains('discordbot') ? {'Authorization': 'Bearer ${widget.token}'} : {});
        final ping = DateTime.now().millisecondsSinceEpoch - start;
        statuses.add({
          'name': endpoint['name']!,
          'status': response.statusCode == 200 ? 'online' : 'offline',
          'ping': ping,
        });
      } catch (e) {
        statuses.add({
          'name': endpoint['name']!,
          'status': 'offline',
          'ping': null,
        });
      }
    }

    // Check Discord services
    final discordServices = [
      {'name': 'Discord.com', 'url': 'https://discord.com'},
      {'name': 'Discord.gg', 'url': 'https://discord.gg'},
    ];

    for (final service in discordServices) {
      final start = DateTime.now().millisecondsSinceEpoch;
      try {
        final response = await http.get(Uri.parse(service['url']!));
        final ping = DateTime.now().millisecondsSinceEpoch - start;
        statuses.add({
          'name': service['name']!,
          'status': response.statusCode == 200 ? 'online' : 'offline',
          'ping': ping,
        });
      } catch (e) {
        statuses.add({
          'name': service['name']!,
          'status': 'offline',
          'ping': null,
        });
      }
    }

    // Check Discord Bot API (already included in endpoints)

    return statuses;
  }
}
