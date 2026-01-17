require('dotenv').config({ path: '../bot/.env' });
const express = require('express');
const path = require('path');
const axios = require('axios');
const OAuth = require('oauth-1.0a');
const crypto = require('crypto');
const app = express();
const port = 8594;

const { getFMUser, setFMUser, getFMRequestToken, setFMRequestToken } = require('../bot/dist/database');

// Last.fm OAuth setup
const oauth = OAuth({
  consumer: {
    key: process.env.LASTFM_API_KEY,
    secret: process.env.LASTFM_API_SECRET
  },
  signature_method: 'HMAC-SHA1',
  hash_function(base_string, key) {
    return crypto.createHmac('sha1', key).update(base_string).digest('base64');
  },
});

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// Route for the root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Get Last.fm request token
app.get('/auth/:user_id', async (req, res) => {
  const user_id = req.params.user_id;

  try {
    // Get request token
    const request_data = {
      url: 'https://ws.audioscrobbler.com/2.0/',
      method: 'POST',
      data: {
        method: 'auth.getRequestToken',
        api_key: process.env.LASTFM_API_KEY,
      },
    };

    const headers = oauth.toHeader(oauth.authorize(request_data));

    const params = new URLSearchParams(request_data.data);
    const response = await axios.post(request_data.url, params.toString(), {
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // Parse XML response
    const xml = response.data;
    const tokenMatch = xml.match(/<oauth_token>(.*?)<\/oauth_token>/);
    const secretMatch = xml.match(/<oauth_token_secret>(.*?)<\/oauth_token_secret>/);

    if (!tokenMatch || !secretMatch) {
      throw new Error('Invalid response from Last.fm');
    }

    const request_token = tokenMatch[1];
    const request_token_secret = secretMatch[1];

    // Store
    await setFMRequestToken({
      discord_user_id: user_id,
      request_token,
      request_token_secret
    });

    // Return auth URL
    const authUrl = `https://www.last.fm/api/auth/?api_key=${process.env.LASTFM_API_KEY}&cb=https://c18h24o2.0x409.nl/callback?user_id=${user_id}`;

    res.json({ authUrl });
  } catch (error) {
    console.error(error);
    res.status(500).send('Failed to get request token');
  }
});

// Last.fm OAuth callback
app.get('/callback', async (req, res) => {
  const { token, user_id } = req.query;

  if (!token || !user_id) {
    return res.status(400).send('Missing token or user_id');
  }

  try {
    // Get stored request token
    const stored = await getFMRequestToken(user_id);
    if (!stored || stored.request_token !== token) {
      return res.status(400).send('Invalid or expired token');
    }

    // Get session key
    const request_data = {
      url: 'https://ws.audioscrobbler.com/2.0/',
      method: 'POST',
      data: {
        method: 'auth.getSession',
        token: token,
        api_key: process.env.LASTFM_API_KEY,
      },
    };

    const headers = oauth.toHeader(oauth.authorize(request_data, { key: token, secret: stored.request_token_secret }));

    const params = new URLSearchParams(request_data.data);
    const response = await axios.post(request_data.url, params.toString(), {
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const sessionKey = response.data.session.key;
    const username = response.data.session.name;

    // Store in database
    await setFMUser({
      discord_user_id: user_id,
      lastfm_username: username,
      session_key: sessionKey,
    });

    res.send('Last.fm account connected successfully! You can close this window.');
  } catch (error) {
    console.error(error);
    res.status(500).send(`Failed to connect Last.fm account.\n\n${error.stack}`);
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Website server running on port ${port}`);
  console.log(`Access the website at: http://localhost:${port}`);
});
