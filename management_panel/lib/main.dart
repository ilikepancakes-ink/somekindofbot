import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:app_links/app_links.dart';
import 'package:http/http.dart' as http;
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
  final TextEditingController _botIdController = TextEditingController();
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
                  TextField(
                    controller: _botIdController,
                    decoration: const InputDecoration(
                      labelText: 'Bot ID',
                    ),
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: _signIn,
                    child: const Text('Sign In with Discord'),
                  ),
                ],
              ),
      ),
    );
  }

  void _signIn() async {
    final botId = _botIdController.text.trim();
    if (botId.isEmpty) return;

    const redirectUri = 'https://discordbot.0x409.nl/callback';
    final url =
        'https://discord.com/api/oauth2/authorize?client_id=$botId&redirect_uri=${Uri.encodeComponent(redirectUri)}&response_type=code&scope=identify';

    if (await canLaunchUrl(Uri.parse(url))) {
      await launchUrl(Uri.parse(url));
    }
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
  List<Map<String, dynamic>> envVars = [];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    const baseUrl = 'https://discordbot.0x409.nl';
    final headers = {'Authorization': 'Bearer ${widget.token}'};

    try {
      final res1 = await http.get(Uri.parse('$baseUrl/api/timeouts'), headers: headers);
      timeouts = List<Map<String, dynamic>>.from(jsonDecode(res1.body));

      final res2 = await http.get(Uri.parse('$baseUrl/api/bans'), headers: headers);
      bans = List<Map<String, dynamic>>.from(jsonDecode(res2.body));

      final res3 = await http.get(Uri.parse('$baseUrl/api/warns'), headers: headers);
      warns = List<Map<String, dynamic>>.from(jsonDecode(res3.body));

      final res4 = await http.get(Uri.parse('$baseUrl/api/roles'), headers: headers);
      roles = List<Map<String, dynamic>>.from(jsonDecode(res4.body));

      final res5 = await http.get(Uri.parse('$baseUrl/api/env'), headers: headers);
      envVars = List<Map<String, dynamic>>.from(jsonDecode(res5.body));

      setState(() {});
    } catch (e) {
      // Handle error
    }
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 6,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Bot Management'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Timeouts'),
              Tab(text: 'Bans'),
              Tab(text: 'Warns'),
              Tab(text: 'Roles'),
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
            _buildList('Roles', roles),
            _buildEnvList(),
            _buildActions(),
          ],
        ),
      ),
    );
  }

  Widget _buildList(String title, List<Map<String, dynamic>> items) {
    return ListView.builder(
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        return ListTile(
          title: Text(item['user'] ?? item['name'] ?? 'Item ${item['id']}'),
          subtitle: Text(item.toString()),
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
              item['value'] = controller.text;
              const baseUrl = 'https://discordbot.0x409.nl';
              await http.post(
                Uri.parse('$baseUrl/api/env'),
                headers: {'Authorization': 'Bearer ${widget.token}', 'Content-Type': 'application/json'},
                body: jsonEncode({'key': item['key'], 'value': item['value']}),
              );
              Navigator.pop(context);
              _loadData();
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
              const baseUrl = 'https://discordbot.0x409.nl';
              await http.post(Uri.parse('$baseUrl/api/update'), headers: {'Authorization': 'Bearer ${widget.token}'});
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Updating...')));
              }
            },
            child: const Text('Update Bot'),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.blue),
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: () async {
              const baseUrl = 'https://discordbot.0x409.nl';
              await http.post(Uri.parse('$baseUrl/api/restart'), headers: {'Authorization': 'Bearer ${widget.token}'});
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Restarting...')));
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
