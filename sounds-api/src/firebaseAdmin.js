// src/firebaseAdmin.js
const admin = require('firebase-admin');
require('dotenv').config();

const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
const projectId = process.env.FIREBASE_PROJECT_ID;
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

let serviceAccount;

try {
    if (serviceAccountBase64) {
        console.log("Initializing Firebase Admin with Base64 credentials...");
        if (!projectId) {
            throw new Error("FIREBASE_PROJECT_ID is required when using Base64 credentials.");
        }
        const decodedServiceAccount = Buffer.from(serviceAccountBase64, 'base64').toString('utf-8');
        serviceAccount = JSON.parse(decodedServiceAccount);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: projectId,
        });
    } else if (serviceAccountPath) {
        console.log(`Initializing Firebase Admin with credentials file: ${serviceAccountPath}`);
        // The SDK will automatically pick up the credentials from the environment variable
        admin.initializeApp();
    } else {
        throw new Error('Firebase Admin credentials not found. Set either GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_BASE64 environment variables.');
    }

    console.log("Firebase Admin SDK initialized successfully.");
} catch (error) {
    console.error("Error initializing Firebase Admin SDK:", error.message);
    // Optionally exit or handle the error appropriately
    // process.exit(1);
}

const db = admin.firestore();

module.exports = { admin, db };
