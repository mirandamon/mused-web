// functions/src/firebaseAdmin.js
const admin = require('firebase-admin');

try {
    // When deployed to Cloud Functions, initializeApp() uses default credentials
    // No need for service account keys or GOOGLE_APPLICATION_CREDENTIALS env var here.
    admin.initializeApp();
    console.log("Firebase Admin SDK initialized successfully for Cloud Functions.");
} catch (error) {
    console.error("Error initializing Firebase Admin SDK:", error.message);
    // In a real Cloud Function, errors here might prevent deployment or cause runtime issues.
}

const db = admin.firestore();

module.exports = { admin, db };
