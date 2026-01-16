const express = require('express');
const path = require('path');
const axios = require('axios');
const OAuth = require('oauth-1.0a');
const crypto = require('crypto');
const app = express();
const port = 8594;

const { getFMUser, setFMUser } = require('../bot/src/database');

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

// Last.fm OAuth callback
app.get('/callback', async (req, res) => {
  const { token, user_id } = req.query;

  if (!token || !user_id) {
    return res.status(400).send('Missing token or user_id');
  }

  try {
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

    const headers = oauth.toHeader(oauth.authorize(request_data));

    const response = await axios.post(request_data.url, request_data.data, { headers });

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
    res.status(500).send('Failed to connect Last.fm account.');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Website server running on port ${port}`);
  console.log(`Access the website at: http://localhost:${port}`);
});
