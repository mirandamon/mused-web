// src/routes/sounds.js
const express = require('express');
const { db } = require('../firebaseAdmin');

const router = express.Router();

const SOUNDS_COLLECTION = 'sounds';
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

router.get('/', async (req, res) => {
    let { limit, startAfter } = req.query;

    limit = parseInt(limit, 10);
    if (isNaN(limit) || limit <= 0) {
        limit = DEFAULT_LIMIT;
    }
    limit = Math.min(limit, MAX_LIMIT); // Enforce max limit

    try {
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
        snapshot.forEach(doc => {
            const data = doc.data();
            sounds.push({
                id: doc.id,
                ...data,
                // Convert Firestore Timestamp to ISO string or preferred format
                created_at: data.created_at?.toDate().toISOString(),
            });
        });

        // Determine the cursor for the next page
        const lastVisible = snapshot.docs[snapshot.docs.length - 1];
        const nextPageCursor = lastVisible ? lastVisible.id : null;

        res.status(200).json({
            sounds,
            nextPageCursor,
        });

    } catch (error) {
        console.error("Error fetching sounds:", error);
        res.status(500).json({ error: 'Failed to fetch sounds', details: error.message });
    }
});

module.exports = router;
