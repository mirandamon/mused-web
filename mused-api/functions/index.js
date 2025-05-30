// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin'); // Although initialized in firebaseAdmin, often needed here too
const express = require('express');
const cors = require('cors');
const soundsRouter = require('./src/routes/sounds');
const fragmentsRouter = require('./src/routes/fragments'); // Ensure fragments router is imported

// Initialize Firebase Admin SDK (runs when function cold starts)
// If firebaseAdmin.js is required elsewhere, this ensures initialization.
if (admin.apps.length === 0) {
  try {
    admin.initializeApp();
    console.log("Firebase Admin SDK initialized in index.js.");
  } catch (error) {
    console.error("Error initializing Firebase Admin SDK in index.js:", error.message);
  }
}


const app = express();

// Enable CORS for all origins (adjust for production in Firebase settings or code)
// Example: app.use(cors({ origin: 'YOUR_NEXTJS_APP_URL' }));
app.use(cors({ origin: true })); // Allows all origins, suitable for development

// Parse JSON request bodies
app.use(express.json());

// Import routes (ensure the path is correct relative to index.js)
// db might be needed by routes directly, but firebaseAdmin usually exports it
// const { db } = require('./src/firebaseAdmin');

// API Routes - The base URL will be the function URL (e.g., .../api)
app.use('/sounds', soundsRouter); // Mount soundsRouter at /sounds
app.use('/fragments', fragmentsRouter); // Mount fragmentsRouter at /fragments

// Root endpoint for testing the base path of the 'api' function
app.get('/', (req, res) => {
    res.status(200).send('Mused API base endpoint reached successfully!');
});


// Basic Error Handling (Consider more robust logging/reporting)
app.use((err, req, res, next) => {
    console.error("Error occurred in API:", err.stack);
    res.status(500).json({ error: 'Something broke!', details: err.message });
});

// Export the Express app as an HTTPS Cloud Function named 'api'
// The resulting URL will be like: https://<region>-<project-id>.cloudfunctions.net/api
exports.api = functions.https.onRequest(app);