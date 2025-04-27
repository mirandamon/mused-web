// src/index.js
require('dotenv').config(); // Load environment variables first
const express = require('express');
const cors = require('cors');
const soundsRouter = require('./routes/sounds');
// Ensure Firebase Admin is initialized here (it logs status)
require('./firebaseAdmin');

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors()); // Enable CORS for all origins (adjust for production)
app.use(express.json()); // Parse JSON request bodies

// Routes
app.get('/', (req, res) => {
    res.send('Mused API is running!');
});

app.use('/api/sounds', soundsRouter);

// Basic Error Handling (Optional: Add more robust error handling)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start Server
app.listen(port, () => {
    console.log(`Mused API server listening on port ${port}`);
});
