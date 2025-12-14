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

// Simple in-memory session store (use database in production)
const sessions: { [key: string]: { userId: string } } = {};

// Auth middleware
const auth = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token || !sessions[token]) return res.status(401).send('Unauthorized');
  req.userId = sessions[token].userId;
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

// API endpoints for management
app.get('/api/env', auth, (req, res) => {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    const env = fs.readFileSync(envPath, 'utf8');
    const vars = env.split('\n').filter(line => line.trim() && line.includes('=')).map(line => {
      const [key, ...value] = line.split('=');
      return { key: key.trim(), value: value.join('=').trim() };
    });
    res.json(vars);
  } catch (e) {
    res.status(500).send('Error reading env');
  }
});

app.post('/api/env', auth, (req, res) => {
  const { key, value } = req.body;
  try {
    const envPath = path.join(__dirname, '..', '.env');
    let env = fs.readFileSync(envPath, 'utf8');
    const lines = env.split('\n');
    const idx = lines.findIndex(line => line.startsWith(key + '='));
    if (idx >= 0) {
      lines[idx] = `${key}=${value}`;
    } else {
      lines.push(`${key}=${value}`);
    }
    fs.writeFileSync(envPath, lines.join('\n'));
    res.json({ success: true });
  } catch (e) {
    res.status(500).send('Error writing env');
  }
});

app.post('/api/restart', auth, (req, res) => {
  res.json({ message: 'Restarting bot...' });
  setTimeout(() => process.exit(0), 1000);
});

app.post('/api/update', auth, (req, res) => {
  res.json({ message: 'Updating bot...' });
  // Simulate update
});

// Mock data for other features
app.get('/api/timeouts', auth, (req, res) => {
  res.json([
    { id: 1, user: 'User1', reason: 'Spam', duration: '1h' },
    { id: 2, user: 'User2', reason: 'Offensive', duration: '30m' },
  ]);
});

app.get('/api/bans', auth, (req, res) => {
  res.json([
    { id: 1, user: 'User3', reason: 'Toxic' },
  ]);
});

app.get('/api/warns', auth, (req, res) => {
  res.json([
    { id: 1, user: 'User4', reason: 'Mild offense', count: 1 },
  ]);
});

app.get('/api/roles', auth, (req, res) => {
  res.json([
    { id: 1, name: 'Admin', color: '#ff0000' },
    { id: 2, name: 'Member', color: '#00ff00' },
  ]);
});

app.listen(port, () => {
  console.log(`Auth server listening on port ${port}`);
});

export default app;
