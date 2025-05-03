// functions/src/routes/sounds.js
const express = require('express');
const { db, storage } = require('../firebaseAdmin'); // Ensure db and storage are imported correctly

const router = express.Router();

const SOUNDS_COLLECTION = 'sounds';
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const URL_EXPIRATION_MS = 60 * 60 * 1000; // 1 hour

// Helper function to get signed URL
async function getSignedUrl(filePath) {
    if (!storage || !filePath) return null;

    try {
        const bucket = storage.bucket(); // Use default bucket
        // Ensure filePath doesn't start with a slash for gcs
        const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
        const file = bucket.file(cleanPath);

        // Check if the file exists before trying to get a URL
        const [exists] = await file.exists();
        if (!exists) {
            console.warn(`File not found in storage: ${cleanPath}`);
            return null;
        }

        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + URL_EXPIRATION_MS,
        });
        return url;
    } catch (error) {
        console.error(`Error getting signed URL for ${filePath}:`, error.message);
        return null; // Return null if there's an error
    }
}

router.get('/', async (req, res) => {
    let { limit, startAfter } = req.query;

    limit = parseInt(limit, 10);
    if (isNaN(limit) || limit <= 0) {
        limit = DEFAULT_LIMIT;
    }
    limit = Math.min(limit, MAX_LIMIT); // Enforce max limit

    try {
        if (!db) {
             console.error("Firestore database instance is not available.");
             return res.status(500).json({ error: 'Database connection failed' });
        }

        let query = db.collection(SOUNDS_COLLECTION)
                      .orderBy('created_at', 'desc') // Example ordering, adjust as needed
                      .limit(limit);

        if (startAfter) {
            // Fetch the document snapshot to start after
            const startAfterDoc = await db.collection(SOUNDS_COLLECTION).doc(startAfter).get();
            if (!startAfterDoc.exists) {
                return res.status(404).json({ error: 'Pagination cursor not found.' });
            }
            query = query.startAfter(startAfterDoc);
        }

        const snapshot = await query.get();

        const sounds = [];
        const urlPromises = []; // Store promises for getting signed URLs

        snapshot.forEach(doc => {
            const data = doc.data();
            // Ensure created_at exists and is a Timestamp before converting
            const createdAtISO = data.created_at && typeof data.created_at.toDate === 'function'
                ? data.created_at.toDate().toISOString()
                : null; // Handle cases where it might be missing or not a Timestamp

            const soundData = {
                id: doc.id,
                ...data,
                created_at: createdAtISO, // Use the potentially null ISO string
            };

            sounds.push(soundData);
            // Add promise to fetch download URL if source_url exists
            if (data.source_url) {
                urlPromises.push(getSignedUrl(data.source_url).then(url => ({ id: doc.id, downloadUrl: url })));
            } else {
                 urlPromises.push(Promise.resolve({ id: doc.id, downloadUrl: null })); // Resolve immediately if no source_url
            }
        });

        // Wait for all signed URL promises to resolve
        const urlResults = await Promise.all(urlPromises);
        const downloadUrlsMap = urlResults.reduce((acc, result) => {
             if (result) { // Check if result is not null/undefined
                acc[result.id] = result.downloadUrl;
             }
             return acc;
        }, {});


        // Add downloadUrl to each sound object
        const soundsWithUrls = sounds.map(sound => ({
            ...sound,
            downloadUrl: downloadUrlsMap[sound.id] || null, // Assign fetched URL or null
        }));

        // Determine the cursor for the next page
        const lastVisible = snapshot.docs[snapshot.docs.length - 1];
        const nextPageCursor = lastVisible ? lastVisible.id : null;

        res.status(200).json({
            sounds: soundsWithUrls, // Return sounds with download URLs
            nextPageCursor,
        });

    } catch (error) {
        console.error("Error fetching sounds:", error);
        // Log the detailed error for debugging in Cloud Functions logs
        res.status(500).json({ error: 'Failed to fetch sounds', details: error.message });
    }
});

module.exports = router;
