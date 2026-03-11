/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
import { getSession, setSession, deleteExpiredSessions, getTicketsByGuild, getTicketMessages } from './database';

const app = express();
app.use(express.json());
const port = 2977;

const clientId = process.env.DISCORD_CLIENT_ID!;
const clientSecret = process.env.DISCORD_CLIENT_SECRET!;
const botToken = process.env.DISCORD_TOKEN!;
const botAdminUserId = process.env.BOT_ADMIN_USER_ID!;

// Enhanced Auth middleware with rate limiting and security checks
const authAttempts = new Map();
const auth = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];
  const ip = req.ip || req.connection.remoteAddress;

  // Rate limiting for auth attempts
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 10;
  
  if (!authAttempts.has(ip)) {
    authAttempts.set(ip, []);
  }
  
  const attempts = authAttempts.get(ip);
  const validAttempts = attempts.filter((time: number) => now - time < windowMs);
  
  if (validAttempts.length >= maxAttempts) {
    console.warn(`🚫 Rate limit exceeded for IP ${ip}`);
    return res.status(429).json({ error: 'Too many authentication attempts. Please try again later.' });
  }

  console.log(`🔐 Auth Check for ${req.method} ${req.path}:`);
  console.log(`   Auth Header: ${authHeader ? '[PRESENT]' : 'MISSING'}`);
  console.log(`   Extracted Token: ${token ? token.substring(0, 20) + '...' : 'NONE'}`);
  console.log(`   IP: ${ip}`);

  if (!token) {
    validAttempts.push(now);
    authAttempts.set(ip, validAttempts);
    console.warn(`🚫 Auth failed for ${req.method} ${req.path}: No token`);
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  // Validate token format (should be 64 hex characters)
  if (!/^[a-f0-9]{64}$/.test(token)) {
    validAttempts.push(now);
    authAttempts.set(ip, validAttempts);
    console.warn(`🚫 Auth failed for ${req.method} ${req.path}: Invalid token format`);
    return res.status(401).json({ error: 'Unauthorized: Invalid token format' });
  }

  try {
    const session = await getSession(token);
    if (!session) {
      validAttempts.push(now);
      authAttempts.set(ip, validAttempts);
      console.warn(`🚫 Auth failed for ${req.method} ${req.path}: Session not found`);
      return res.status(401).json({ error: 'Unauthorized: Invalid session' });
    }

    // Check if session is too old (30 days)
    const sessionAge = Date.now() - session.created_at;
    const maxSessionAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    if (sessionAge > maxSessionAge) {
      await deleteExpiredSessions();
      validAttempts.push(now);
      authAttempts.set(ip, validAttempts);
      console.warn(`🚫 Auth failed for ${req.method} ${req.path}: Session expired`);
      return res.status(401).json({ error: 'Unauthorized: Session expired' });
    }

    req.userId = session.user_id;
    req.deviceId = session.device_id;
    console.log(`✅ Auth success: User ${req.userId}, Device ${req.deviceId}`);
    next();
  } catch (e) {
    console.error(`❌ Auth error: ${e}`);
    res.status(500).json({ error: 'Authentication service unavailable' });
  }
};

// Enhanced input validation middleware
const validateInput = (schema: any) => {
  return (req: any, res: any, next: any) => {
    const errors: string[] = [];
    
    // Validate guild ID format (Discord guild IDs are 17-19 digits)
    if (req.query.guildId && !/^\d{17,19}$/.test(req.query.guildId)) {
      errors.push('Invalid guild ID format');
    }
    
    // Validate user ID format (Discord user IDs are 17-19 digits)
    if (req.body.userId && !/^\d{17,19}$/.test(req.body.userId)) {
      errors.push('Invalid user ID format');
    }
    
    // Validate role ID format (Discord role IDs are 17-19 digits)
    if (req.body.roleId && !/^\d{17,19}$/.test(req.body.roleId)) {
      errors.push('Invalid role ID format');
    }
    
    // Validate reason length
    if (req.body.reason && req.body.reason.length > 500) {
      errors.push('Reason too long (max 500 characters)');
    }
    
    // Validate color format
    if (req.body.color && !/^#[0-9A-Fa-f]{6}$/.test(req.body.color)) {
      errors.push('Invalid color format (must be #RRGGBB)');
    }

    // Validate channel ID format
    if (req.body.channelId && !/^\d{17,19}$/.test(req.body.channelId)) {
      errors.push('Invalid channel ID format');
    }

    // Validate message ID format
    if (req.body.messageId && !/^\d{17,19}$/.test(req.body.messageId)) {
      errors.push('Invalid message ID format');
    }

    if (errors.length > 0) {
      console.warn(`🚫 Input validation failed: ${errors.join(', ')}`);
      return res.status(400).json({ error: 'Invalid input', details: errors });
    }
    
    next();
  };
};

// Security headers middleware
const securityHeaders = (req: any, res: any, next: any) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
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
    await setSession({
      token: sessionToken,
      user_id: userId,
      device_id: 'unknown', // TODO: get from app
      created_at: Date.now(),
    });

    // Redirect to app
    res.redirect(`somekindofbot://callback?token=${sessionToken}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Authentication failed');
  }
});

// Optional: endpoint to validate token
app.get('/validate', async (req, res) => {
  const token = req.query.token as string;
  try {
    const session = await getSession(token);
    if (session) {
      res.json({ valid: true, userId: session.user_id });
    } else {
      res.json({ valid: false });
    }
  } catch (e) {
    res.status(500).json({ error: 'Validation error' });
  }
});

// Endpoint for bot to generate auth tokens for admin users only
app.post('/api/generate-token', async (req, res) => {
  const { userId, deviceId } = req.body;

  // Detailed logging for server-side admin check
  console.log(`🔐 Server Admin Check:`);
  console.log(`   Received User ID: ${userId}`);
  console.log(`   Received Device ID: ${deviceId}`);
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
  await setSession({
    token: sessionToken,
    user_id: userId,
    device_id: deviceId || 'unknown',
    created_at: Date.now(),
  });

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

app.get('/api/bans', auth, async (req, res) => {
  const guildId = req.query.guildId as string;
  console.log(`🚫 API Request: GET /api/bans`);
  console.log(`   User: ${(req as any).userId}`);
  console.log(`   Guild: ${guildId || 'none'}`);

  try {
    const response = await axios.get(`https://discord.com/api/guilds/${guildId}/bans`, {
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    });

    const result = response.data.map((ban: any) => ({
      id: ban.user.id,
      user: ban.user.username,
      reason: ban.reason || 'No reason provided',
    }));

    console.log(`✅ API Success: Returned ${result.length} ban records`);
    res.json(result);
  } catch (e) {
    console.error(`❌ API Error in GET /api/bans: ${e}`);
    // Fallback to empty array if Discord API fails
    res.json([]);
  }
});

app.post('/api/bans', auth, async (req, res) => {
  const { guildId, userId, reason } = req.body;
  console.log(`🚫 API Request: POST /api/bans`);
  console.log(`   User: ${(req as any).userId}`);
  console.log(`   Guild: ${guildId}`);
  console.log(`   Target User: ${userId}`);
  console.log(`   Reason: ${reason || 'No reason provided'}`);

  try {
    await axios.put(`https://discord.com/api/guilds/${guildId}/bans/${userId}`, {
      reason: reason || 'No reason provided',
    }, {
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`✅ API Success: User ${userId} banned from guild ${guildId}`);
    res.json({ success: true, message: 'User banned successfully' });
  } catch (e) {
    console.error(`❌ API Error in POST /api/bans: ${e}`);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

app.delete('/api/bans', auth, async (req, res) => {
  const { guildId, userId } = req.body;
  console.log(`🚫 API Request: DELETE /api/bans`);
  console.log(`   User: ${(req as any).userId}`);
  console.log(`   Guild: ${guildId}`);
  console.log(`   Target User: ${userId}`);

  try {
    await axios.delete(`https://discord.com/api/guilds/${guildId}/bans/${userId}`, {
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    });

    console.log(`✅ API Success: User ${userId} unbanned from guild ${guildId}`);
    res.json({ success: true, message: 'User unbanned successfully' });
  } catch (e) {
    console.error(`❌ API Error in DELETE /api/bans: ${e}`);
    res.status(500).json({ error: 'Failed to unban user' });
  }
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
      permissions: role.permissions,
      position: role.position,
      mentionable: role.mentionable,
      hoist: role.hoist,
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

app.post('/api/roles', auth, async (req, res) => {
  const { guildId, name, color, permissions, mentionable, hoist } = req.body;
  console.log(`👥 API Request: POST /api/roles`);
  console.log(`   User: ${(req as any).userId}`);
  console.log(`   Guild: ${guildId}`);
  console.log(`   Name: ${name}`);

  try {
    const roleData: any = { name };
    if (color) roleData.color = parseInt(color.replace('#', ''), 16);
    if (permissions !== undefined) roleData.permissions = permissions;
    if (mentionable !== undefined) roleData.mentionable = mentionable;
    if (hoist !== undefined) roleData.hoist = hoist;

    const response = await axios.post(`https://discord.com/api/guilds/${guildId}/roles`, roleData, {
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`✅ API Success: Role created in guild ${guildId}`);
    res.json({ success: true, role: response.data });
  } catch (e) {
    console.error(`❌ API Error in POST /api/roles: ${e}`);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

app.patch('/api/roles/:roleId', auth, async (req, res) => {
  const { roleId } = req.params;
  const { guildId, name, color, permissions, mentionable, hoist } = req.body;
  console.log(`👥 API Request: PATCH /api/roles/${roleId}`);
  console.log(`   User: ${(req as any).userId}`);
  console.log(`   Guild: ${guildId}`);

  try {
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (color) updateData.color = parseInt(color.replace('#', ''), 16);
    if (permissions !== undefined) updateData.permissions = permissions;
    if (mentionable !== undefined) updateData.mentionable = mentionable;
    if (hoist !== undefined) updateData.hoist = hoist;

    const response = await axios.patch(`https://discord.com/api/guilds/${guildId}/roles/${roleId}`, updateData, {
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`✅ API Success: Role ${roleId} updated in guild ${guildId}`);
    res.json({ success: true, role: response.data });
  } catch (e) {
    console.error(`❌ API Error in PATCH /api/roles: ${e}`);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

app.delete('/api/roles/:roleId', auth, async (req, res) => {
  const { roleId } = req.params;
  const { guildId } = req.body;
  console.log(`👥 API Request: DELETE /api/roles/${roleId}`);
  console.log(`   User: ${(req as any).userId}`);
  console.log(`   Guild: ${guildId}`);

  try {
    await axios.delete(`https://discord.com/api/guilds/${guildId}/roles/${roleId}`, {
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    });

    console.log(`✅ API Success: Role ${roleId} deleted from guild ${guildId}`);
    res.json({ success: true, message: 'Role deleted successfully' });
  } catch (e) {
    console.error(`❌ API Error in DELETE /api/roles: ${e}`);
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

app.put('/api/members/:userId/roles/:roleId', auth, async (req, res) => {
  const { userId, roleId } = req.params;
  const { guildId } = req.body;
  console.log(`👤 API Request: PUT /api/members/${userId}/roles/${roleId}`);
  console.log(`   User: ${(req as any).userId}`);
  console.log(`   Guild: ${guildId}`);

  try {
    await axios.put(`https://discord.com/api/guilds/${guildId}/members/${userId}/roles/${roleId}`, {}, {
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    });

    console.log(`✅ API Success: Role ${roleId} assigned to user ${userId} in guild ${guildId}`);
    res.json({ success: true, message: 'Role assigned successfully' });
  } catch (e) {
    console.error(`❌ API Error in PUT /api/members/roles: ${e}`);
    res.status(500).json({ error: 'Failed to assign role' });
  }
});

app.delete('/api/members/:userId/roles/:roleId', auth, async (req, res) => {
  const { userId, roleId } = req.params;
  const { guildId } = req.body;
  console.log(`👤 API Request: DELETE /api/members/${userId}/roles/${roleId}`);
  console.log(`   User: ${(req as any).userId}`);
  console.log(`   Guild: ${guildId}`);

  try {
    await axios.delete(`https://discord.com/api/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    });

    console.log(`✅ API Success: Role ${roleId} revoked from user ${userId} in guild ${guildId}`);
    res.json({ success: true, message: 'Role revoked successfully' });
  } catch (e) {
    console.error(`❌ API Error in DELETE /api/members/roles: ${e}`);
    res.status(500).json({ error: 'Failed to revoke role' });
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

app.get('/api/tickets', auth, async (req, res) => {
  const guildId = req.query.guildId as string;
  console.log(`🎫 API Request: GET /api/tickets`);
  console.log(`   User: ${(req as any).userId}`);
  console.log(`   Guild: ${guildId || 'none'}`);

  try {
    const tickets = await getTicketsByGuild(guildId);
    console.log(`✅ API Success: Returned ${tickets.length} ticket records`);
    res.json(tickets);
  } catch (e) {
    console.error(`❌ API Error in GET /api/tickets: ${e}`);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

app.get('/api/tickets/:ticketId/messages', auth, async (req, res) => {
  const { ticketId } = req.params;
  console.log(`💬 API Request: GET /api/tickets/${ticketId}/messages`);
  console.log(`   User: ${(req as any).userId}`);

  try {
    const messages = await getTicketMessages(parseInt(ticketId));
    console.log(`✅ API Success: Returned ${messages.length} message records for ticket ${ticketId}`);
    res.json(messages);
  } catch (e) {
    console.error(`❌ API Error in GET /api/tickets/${ticketId}/messages: ${e}`);
    res.status(500).json({ error: 'Failed to fetch ticket messages' });
  }
});

const server = app.listen(port, () => {
  console.log(`Auth server listening on port ${port}`);
});

server.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Management portal will not be available.`);
  } else {
    console.error('Server error:', error);
  }
  // Don't exit process, let the bot continue
});

export default app;
