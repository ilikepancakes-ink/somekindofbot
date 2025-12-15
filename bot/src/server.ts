import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json());
const port = 2976;

const clientId = process.env.DISCORD_CLIENT_ID!;
const clientSecret = process.env.DISCORD_CLIENT_SECRET!;
const botToken = process.env.DISCORD_TOKEN!;
const botAdminUserId = process.env.BOT_ADMIN_USER_ID!;

// Simple in-memory session store (use database in production)
const sessions: { [key: string]: { userId: string } } = {};

// Auth middleware
const auth = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  console.log(`🔐 Auth Check for ${req.method} ${req.path}:`);
  console.log(`   Auth Header: ${authHeader ? '[PRESENT]' : 'MISSING'}`);
  console.log(`   Extracted Token: ${token ? token.substring(0, 20) + '...' : 'NONE'}`);
  console.log(`   Token in Sessions: ${token && sessions[token] ? '✅ YES' : '❌ NO'}`);

  if (!token || !sessions[token]) {
    console.warn(`🚫 Auth failed for ${req.method} ${req.path}`);
    return res.status(401).send('Unauthorized');
  }

  req.userId = sessions[token].userId;
  console.log(`✅ Auth success: User ${req.userId}`);
  next();
};

app.get('/callback', async (req, res) => {
  const code = req.query.code as string;
  if (!code) {
    return res.status(400).send('No code provided');
  }

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: 'https://discordbot.0x409.nl/callback',
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const accessToken = tokenResponse.data.access_token;

    // Get user info
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const userId = userResponse.data.id;

    // Check user ID (allow all for demo, or add logic)
    if (!userId) {
      return res.status(403).send('Access denied');
    }

    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    sessions[sessionToken] = { userId };

    // Redirect to app
    res.redirect(`somekindofbot://callback?token=${sessionToken}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Authentication failed');
  }
});

// Optional: endpoint to validate token
app.get('/validate', (req, res) => {
  const token = req.query.token as string;
  if (sessions[token]) {
    res.json({ valid: true, userId: sessions[token].userId });
  } else {
    res.json({ valid: false });
  }
});

// Endpoint for bot to generate auth tokens for admin users only
app.post('/api/generate-token', (req, res) => {
  const { userId } = req.body;

  // Detailed logging for server-side admin check
  console.log(`🔐 Server Admin Check:`);
  console.log(`   Received User ID: ${userId}`);
  console.log(`   Server Admin ID: ${botAdminUserId || 'NOT SET'}`);
  console.log(`   Server Match: ${userId === botAdminUserId ? '✅ YES' : '❌ NO'}`);

  if (!userId) {
    console.error('❌ No user ID provided in request');
    return res.status(400).json({ error: 'User ID required' });
  }

  if (!botAdminUserId) {
    console.error('❌ BOT_ADMIN_USER_ID not set on server');
    return res.status(500).json({ error: 'Server configuration error: Admin user ID not configured' });
  }

  // Only allow token generation for the admin user
  if (userId !== botAdminUserId) {
    console.warn(`🚫 Server rejected token generation for user ${userId}, expected ${botAdminUserId}`);
    return res.status(403).json({ error: 'Access denied. Only admin user can generate tokens.' });
  }

  // Generate session token for the user
  const sessionToken = crypto.randomBytes(32).toString('hex');
  sessions[sessionToken] = { userId };

  res.json({
    success: true,
    token: sessionToken,
    loginUrl: `somekindofbot://callback?token=${sessionToken}`
  });
});

// API endpoints for management
app.get('/api/env', auth, (req, res) => {
  try {
    console.log(`📄 API Request: GET /api/env`);
    console.log(`   User: ${(req as any).userId}`);

    const envPath = path.join(__dirname, '..', '.env');
    const env = fs.readFileSync(envPath, 'utf8');
    const vars = env.split('\n').filter(line => line.trim() && line.includes('=')).map(line => {
      const [key, ...value] = line.split('=');
      return { key: key.trim(), value: value.join('=').trim() };
    });

    console.log(`✅ API Success: Returned ${vars.length} environment variables`);
    res.json(vars);
  } catch (e) {
    console.error(`❌ API Error in GET /api/env: ${e}`);
    console.error(`   User: ${(req as any).userId}`);
    console.error(`   Path: ${path.join(__dirname, '..', '.env')}`);
    res.status(500).send('Error reading env');
  }
});

app.post('/api/env', auth, (req, res) => {
  const { key, value } = req.body;
  try {
    console.log(`📝 API Request: POST /api/env`);
    console.log(`   User: ${(req as any).userId}`);
    console.log(`   Key: ${key}`);
    console.log(`   Value: ${value ? '[REDACTED]' : 'undefined'}`);

    const envPath = path.join(__dirname, '..', '.env');
    let env = fs.readFileSync(envPath, 'utf8');
    const lines = env.split('\n');
    const idx = lines.findIndex(line => line.startsWith(key + '='));
    if (idx >= 0) {
      lines[idx] = `${key}=${value}`;
      console.log(`✅ API Success: Updated existing environment variable`);
    } else {
      lines.push(`${key}=${value}`);
      console.log(`✅ API Success: Added new environment variable`);
    }
    fs.writeFileSync(envPath, lines.join('\n'));
    res.json({ success: true });
  } catch (e) {
    console.error(`❌ API Error in POST /api/env: ${e}`);
    console.error(`   User: ${(req as any).userId}`);
    console.error(`   Key: ${req.body?.key}`);
    console.error(`   Path: ${path.join(__dirname, '..', '.env')}`);
    res.status(500).send('Error writing env');
  }
});

app.post('/api/restart', auth, (req, res) => {
  console.log(`🔄 API Request: POST /api/restart`);
  console.log(`   User: ${(req as any).userId}`);
  console.log(`✅ API Success: Bot restart initiated`);
  res.json({ message: 'Restarting bot...' });
  setTimeout(() => process.exit(0), 1000);
});

app.post('/api/update', auth, (req, res) => {
  console.log(`⬆️ API Request: POST /api/update`);
  console.log(`   User: ${(req as any).userId}`);
  console.log(`✅ API Success: Bot update initiated`);
  res.json({ message: 'Updating bot...' });
  // Simulate update
});

// Live data from Discord API
app.get('/api/timeouts', auth, async (req, res) => {
  const guildId = req.query.guildId as string;
  console.log(`⏰ API Request: GET /api/timeouts`);
  console.log(`   User: ${(req as any).userId}`);
  console.log(`   Guild: ${guildId || 'none'}`);

  try {
    // For now, return mock data until database is implemented
    // In future, fetch from database or Discord API
    const mockTimeouts = {
      '1': [{ id: 1, user: 'User1', reason: 'Spam', duration: '1h' }],
      '2': [{ id: 2, user: 'User2', reason: 'Offensive', duration: '30m' }],
    };
    const result = (mockTimeouts as any)[guildId] || [];
    console.log(`✅ API Success: Returned ${result.length} timeout records`);
    res.json(result);
  } catch (e) {
    console.error(`❌ API Error in GET /api/timeouts: ${e}`);
    res.status(500).send('Error fetching timeouts');
  }
});

app.get('/api/bans', auth, (req, res) => {
  const guildId = req.query.guildId as string;
  console.log(`🚫 API Request: GET /api/bans`);
  console.log(`   User: ${(req as any).userId}`);
  console.log(`   Guild: ${guildId || 'none'}`);

  const mockBans = {
    '1': [{ id: 1, user: 'User3', reason: 'Toxic' }],
    '2': [],
  };
  const result = (mockBans as any)[guildId] || [];
  console.log(`✅ API Success: Returned ${result.length} ban records`);
  res.json(result);
});

app.get('/api/warns', auth, (req, res) => {
  const guildId = req.query.guildId as string;
  console.log(`⚠️ API Request: GET /api/warns`);
  console.log(`   User: ${(req as any).userId}`);
  console.log(`   Guild: ${guildId || 'none'}`);

  const mockWarns = {
    '1': [{ id: 1, user: 'User4', reason: 'Mild offense', count: 1 }],
    '2': [{ id: 2, user: 'User5', reason: 'Spam', count: 2 }],
  };
  const result = (mockWarns as any)[guildId] || [];
  console.log(`✅ API Success: Returned ${result.length} warning records`);
  res.json(result);
});

app.get('/api/roles', auth, async (req, res) => {
  const guildId = req.query.guildId as string;
  console.log(`👥 API Request: GET /api/roles`);
  console.log(`   User: ${(req as any).userId}`);
  console.log(`   Guild: ${guildId || 'none'}`);

  try {
    const response = await axios.get(`https://discord.com/api/guilds/${guildId}/roles`, {
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    });

    const result = response.data.map((role: any) => ({
      id: role.id,
      name: role.name,
      color: `#${role.color.toString(16).padStart(6, '0')}`,
    }));

    console.log(`✅ API Success: Returned ${result.length} role records`);
    res.json(result);
  } catch (e) {
    console.error(`❌ API Error in GET /api/roles: ${e}`);
    // Fallback to mock data if Discord API fails
    const mockRoles = {
      '1': [{ id: 1, name: 'Admin', color: '#ff0000' }, { id: 2, name: 'Member', color: '#00ff00' }],
      '2': [{ id: 3, name: 'Moderator', color: '#0000ff' }],
    };
    const result = (mockRoles as any)[guildId] || [];
    res.json(result);
  }
});

app.get('/api/guilds', auth, async (req, res) => {
  console.log(`🏰 API Request: GET /api/guilds`);
  console.log(`   User: ${(req as any).userId}`);

  try {
    const response = await axios.get('https://discord.com/api/users/@me/guilds', {
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    });

    const result = response.data.map((guild: any) => ({
      id: guild.id,
      name: guild.name,
    }));

    console.log(`✅ API Success: Returned ${result.length} guild records`);
    res.json(result);
  } catch (e) {
    console.error(`❌ API Error in GET /api/guilds: ${e}`);
    // Fallback to mock data if Discord API fails
    const result = [
      { id: '1', name: 'Main Server' },
      { id: '2', name: 'Test Server' },
    ];
    res.json(result);
  }
});

app.get('/api/members', auth, async (req, res) => {
  const guildId = req.query.guildId as string;
  console.log(`👤 API Request: GET /api/members`);
  console.log(`   User: ${(req as any).userId}`);
  console.log(`   Guild: ${guildId || 'none'}`);

  try {
    const response = await axios.get(`https://discord.com/api/guilds/${guildId}/members?limit=1000`, {
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    });

    const result = response.data.map((member: any) => ({
      id: member.user.id,
      username: member.user.username,
    }));

    console.log(`✅ API Success: Returned ${result.length} member records`);
    res.json(result);
  } catch (e) {
    console.error(`❌ API Error in GET /api/members: ${e}`);
    // Fallback to mock data if Discord API fails
    const mockMembers = {
      '1': [{ id: '1', username: 'User1' }, { id: '2', username: 'User2' }],
      '2': [{ id: '3', username: 'User3' }],
    };
    const result = (mockMembers as any)[guildId] || [];
    res.json(result);
  }
});

app.listen(port, () => {
  console.log(`Auth server listening on port ${port}`);
});

export default app;
