const express = require('express');
const path = require('path');
const app = express();
const port = 8594;

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// Route for the root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`Website server running on port ${port}`);
  console.log(`Access the website at: http://localhost:${port}`);
});
