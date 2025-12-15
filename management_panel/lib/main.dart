import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:app_links/app_links.dart';
import 'package:http/http.dart' as http;
import 'package:flutter/services.dart';
import 'dart:async';
import 'dart:convert';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Management Panel',
      theme: ThemeData(
        primarySwatch: Colors.blue,
      ),
      home: const HomePage(),
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

  @override
  void initState() {
    super.initState();
    _handleIncomingLinks();
    _handleInitialLink();
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

  void _handleLink(Uri uri) {
    if (uri.scheme == 'somekindofbot' && uri.host == 'callback') {
      final token = uri.queryParameters['token'];
      if (token != null) {
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

  void _loginWithToken() {
    final token = _tokenController.text.trim();
    if (token.isEmpty) return;

    setState(() {
      _token = token;
    });
  }
}

class ManagementScreen extends StatefulWidget {
  final String token;

  const ManagementScreen({required this.token});

  @override
  _ManagementScreenState createState() => _ManagementScreenState();
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

  @override
  void initState() {
    super.initState();
    _loadServers();
    _loadData();
    _setupTouchBar();
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

  void _setupTouchBar() {
    const platform = MethodChannel('com.example.management_panel/touchbar');
    // Notify native side that user is logged in
    platform.invokeMethod('setLoginStatus', true);
    platform.setMethodCallHandler((call) async {
      if (!mounted) return;
      switch (call.method) {
        case 'showMembers':
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Members accessed from Touch Bar')));
          break;
        case 'selectServer':
          final serverId = call.arguments as String;
          setState(() {
            selectedServerId = serverId;
          });
          _loadData();
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Server switched to $serverId from Touch Bar')));
          break;
        case 'updateBot':
          try {
            const baseUrl = 'https://discordbot.0x409.nl';
            await http.post(Uri.parse('$baseUrl/api/update'), headers: {'Authorization': 'Bearer ${widget.token}'});
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Updating from Touch Bar...')));
          } catch (e) {
            print('❌ API Error in Touch Bar updateBot: $e');
            print('   URL: https://discordbot.0x409.nl/api/update');
            print('   Token: ${widget.token.substring(0, 20)}...');
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to update bot from Touch Bar')));
          }
          break;
        case 'restartBot':
          try {
            const baseUrl = 'https://discordbot.0x409.nl';
            await http.post(Uri.parse('$baseUrl/api/restart'), headers: {'Authorization': 'Bearer ${widget.token}'});
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Restarting from Touch Bar...')));
          } catch (e) {
            print('❌ API Error in Touch Bar restartBot: $e');
            print('   URL: https://discordbot.0x409.nl/api/restart');
            print('   Token: ${widget.token.substring(0, 20)}...');
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to restart bot from Touch Bar')));
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
                title: const Text('Bot Management'),
                bottom: const TabBar(
                  tabs: [
                    Tab(text: 'Timeouts'),
                    Tab(text: 'Bans'),
                    Tab(text: 'Warns'),
                    Tab(text: 'Roles'),
                    Tab(text: 'Members'),
                    Tab(text: 'Env Vars'),
                    Tab(text: 'Actions'),
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
                  _buildActions(),
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
          trailing: editable ? IconButton(
            icon: const Icon(Icons.edit),
            onPressed: () => _editRole(item),
          ) : null,
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
            onPressed: () => _editEnv(item),
          ),
        );
      },
    );
  }

  void _editEnv(Map<String, dynamic> item) {
    final controller = TextEditingController(text: item['value']);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
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

  void _editRole(Map<String, dynamic> item) {
    final nameController = TextEditingController(text: item['name']);
    final colorController = TextEditingController(text: item['color']);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
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
              item['name'] = nameController.text;
              item['color'] = colorController.text;
              // For now, no API to update roles, just update locally
              setState(() {});
              Navigator.pop(context);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  Widget _buildActions() {
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
            child: const Text('Update Bot'),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.blue),
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
            child: const Text('Restart Bot'),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.blue),
          ),
        ],
      ),
    );
  }
}
