// functions/src/routes/fragments.js
const express = require('express');
const { db, admin, storage } = require('../firebaseAdmin'); // Ensure db, admin, and storage are imported

const router = express.Router();
const FRAGMENTS_COLLECTION = 'fragments';
const SOUNDS_COLLECTION = 'sounds';
const DEFAULT_LIMIT = 10; // Lower default for fragments as they are larger
const MAX_LIMIT = 30;
const URL_EXPIRATION_MS = 60 * 60 * 1000; // 1 hour

// --- Helper Function to Get Signed URL (Copied & adapted from sounds.js) ---
async function getSignedUrl(filePath) {
    if (!storage || !filePath || !filePath.startsWith('gs://')) {
        console.warn(`getSignedUrl: Invalid filePath provided: ${filePath}`);
        return null;
    }

    try {
        const bucket = storage.bucket(); // Use default bucket
        // Firebase Storage SDK ref() handles the gs:// prefix correctly.
        // Extract path after the bucket name.
        const pathWithoutBucket = filePath.substring(filePath.indexOf('/', 5) + 1); // Find first slash after gs://

        const file = bucket.file(pathWithoutBucket);

        // Check if the file exists before trying to get a URL
        const [exists] = await file.exists();
        if (!exists) {
            console.warn(`File not found in storage at path: ${pathWithoutBucket} (from ${filePath})`);
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


// --- Input Validation Helper (for POST) ---
const validateFragmentInput = (data) => {
    const errors = [];
    if (!data || typeof data !== 'object') {
        errors.push("Invalid request body.");
        return errors;
    }
     // Expecting `pads` to contain ALL 16 pads now for saving state correctly
    if (!Array.isArray(data.pads) || data.pads.length !== 16) { // Validate all 16 pads are present
        errors.push("Field 'pads' must be an array containing exactly 16 pad objects.");
    } else {
        data.pads.forEach((pad, index) => {
            if (pad.id !== index) { // Verify pad ID matches its index
                 errors.push(`Pad at index ${index} has incorrect 'id' ${pad.id}.`);
            }
            if (typeof pad.id !== 'number') errors.push(`Pad at index ${index} is missing a numeric 'id'.`);
            if (!Array.isArray(pad.sounds)) errors.push(`Pad ${pad.id} is missing a 'sounds' array.`);
            else {
                pad.sounds.forEach((sound, sIndex) => {
                    if (!sound.soundId || typeof sound.soundId !== 'string') {
                        errors.push(`Sound at index ${sIndex} in Pad ${pad.id} is missing a valid 'soundId'.`);
                    }
                    // soundUrl is the *original* path (gs://), crucial for saving.
                    if (!sound.soundUrl || typeof sound.soundUrl !== 'string' || !sound.soundUrl.startsWith('gs://')) {
                         errors.push(`Sound '${sound.soundName || sound.soundId}' in Pad ${pad.id} is missing a valid 'soundUrl' (original gs:// storage path).`);
                    }
                });
            }
             // Check for required state properties
            if (typeof pad.isActive !== 'boolean') errors.push(`Pad ${pad.id} is missing boolean 'isActive' state.`);
            if (typeof pad.currentSoundIndex !== 'number') errors.push(`Pad ${pad.id} is missing numeric 'currentSoundIndex'.`);
        });
    }
    if (typeof data.bpm !== 'number' || data.bpm <= 0) {
        errors.push("Field 'bpm' must be a positive number.");
    }
    // Add more validation as needed (title, remix info, etc.)

    return errors;
};

// --- POST /fragments ---
router.post('/', async (req, res) => {
    const inputData = req.body;

    // --- 1. Validate Input ---
    const validationErrors = validateFragmentInput(inputData);
    if (validationErrors.length > 0) {
        console.warn("Fragment validation failed:", validationErrors);
        return res.status(400).json({ error: "Invalid input data.", details: validationErrors });
    }

    try {
        if (!db) {
            console.error("Firestore database instance is not available for fragments POST.");
            return res.status(500).json({ error: 'Database connection failed' });
        }

        // --- 2. Transform Pad Data ---
        // Create pad_sounds map { "padIndex": ["soundId1", ...] } - ONLY for pads with sounds
        const padSoundsMap = inputData.pads.reduce((acc, pad) => {
            if (pad.sounds && pad.sounds.length > 0) {
                const soundIds = pad.sounds.map(sound => sound.soundId).filter(id => !!id);
                if (soundIds.length > 0) {
                  acc[pad.id.toString()] = soundIds;
                }
            }
            return acc;
        }, {});

        // Create pad_state map { "padIndex": {isActive, currentSoundIndex} } - FOR ALL PADS
        const padStateMap = inputData.pads.reduce((acc, pad) => {
            acc[pad.id.toString()] = {
               isActive: pad.isActive, // Directly use the value from input
               currentSoundIndex: pad.currentSoundIndex ?? 0, // Default to 0 if undefined
            };
             return acc;
        }, {});


        // --- 3. Construct Firestore Document ---
        const now = admin.firestore.FieldValue.serverTimestamp();
        const newFragmentData = {
            // **Temporary Author Info - Replace with actual Auth data later**
            author_id: "0", // Placeholder
            author_name: "Staff", // Placeholder
            bpm: inputData.bpm,
            columns: inputData.columns || 4, // Default to 4 if not provided
            rows: inputData.rows || 4, // Default to 4 if not provided
            title: inputData.title || null, // Use null if empty/not provided
            original_author_id: inputData.originalAuthorId || null, // For remixes
            original_fragment_id: inputData.originalFragmentId || null, // For remixes
            created_at: now,
            updated_at: now,
            likes: 0, // Initialize likes
            comments_count: 0, // Initialize comments count
            view_count: 0, // Initialize view count
            pad_sounds: padSoundsMap, // Map of sound IDs for pads *with* sounds
            pad_state: padStateMap, // Map of state for *all* pads
            // Add other relevant fields from inputData if necessary
        };

        // --- 4. Add Document to Firestore ---
        const docRef = await db.collection(FRAGMENTS_COLLECTION).add(newFragmentData);

        console.log("Fragment created successfully with ID:", docRef.id);

        // --- 5. Return Success Response ---
        res.status(201).json({ message: "Fragment created successfully", fragmentId: docRef.id });

    } catch (error) {
        console.error("Error creating fragment:", error);
        res.status(500).json({ error: 'Failed to create fragment', details: error.message });
    }
});


// --- GET /fragments ---
router.get('/', async (req, res) => {
    let { limit, startAfter } = req.query;

    limit = parseInt(limit, 10);
    if (isNaN(limit) || limit <= 0) {
        limit = DEFAULT_LIMIT;
    }
    limit = Math.min(limit, MAX_LIMIT); // Enforce max limit

    try {
        if (!db) {
            console.error("Firestore database instance is not available for fragments GET.");
            return res.status(500).json({ error: 'Database connection failed' });
        }

        // --- 1. Query Fragments ---
        let query = db.collection(FRAGMENTS_COLLECTION)
                      .orderBy('created_at', 'desc')
                      .limit(limit);

        if (startAfter) {
            const startAfterDoc = await db.collection(FRAGMENTS_COLLECTION).doc(startAfter).get();
            if (!startAfterDoc.exists) {
                return res.status(404).json({ error: 'Pagination cursor not found.' });
            }
            query = query.startAfter(startAfterDoc);
        }

        const fragmentSnapshot = await query.get();
        if (fragmentSnapshot.empty) {
            return res.status(200).json({ fragments: [], nextPageCursor: null });
        }

        // --- 2. Gather All Unique Sound IDs ---
        const allSoundIds = new Set();
        fragmentSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.pad_sounds) {
                Object.values(data.pad_sounds).forEach(soundIdArray => {
                    if (Array.isArray(soundIdArray)) {
                        soundIdArray.forEach(id => allSoundIds.add(id));
                    }
                });
            }
        });

        // --- 3. Fetch Sound Data in Batches ---
        const soundIdsArray = Array.from(allSoundIds);
        const soundDataMap = new Map();
        const soundUrlPromises = []; // Store promises for getting signed URLs for sounds

        // Firestore 'in' query limit is 30, fetch in batches if needed
        const MAX_IN_QUERY_SIZE = 30;
        for (let i = 0; i < soundIdsArray.length; i += MAX_IN_QUERY_SIZE) {
             const batchIds = soundIdsArray.slice(i, i + MAX_IN_QUERY_SIZE);
             if (batchIds.length > 0) {
                 console.log(`Fetching sound data batch: ${batchIds.join(', ')}`);
                 const soundQuery = db.collection(SOUNDS_COLLECTION).where(admin.firestore.FieldPath.documentId(), 'in', batchIds);
                 const soundSnapshot = await soundQuery.get();
                 soundSnapshot.forEach(doc => {
                     const soundDocData = doc.data();
                     soundDataMap.set(doc.id, {
                         id: doc.id,
                         name: soundDocData.name || 'Unnamed Sound',
                         source_url: soundDocData.source_url, // Original gs:// path
                         source_type: soundDocData.source_type,
                         owner_user_id: soundDocData.owner_user_id,
                         // other sound fields if needed
                     });
                     // Start fetching signed URL for this sound
                     if (soundDocData.source_url) {
                        soundUrlPromises.push(
                            getSignedUrl(soundDocData.source_url).then(url => ({ id: doc.id, downloadUrl: url }))
                        );
                     } else {
                        soundUrlPromises.push(Promise.resolve({ id: doc.id, downloadUrl: null })); // Resolve immediately if no source_url
                     }
                 });
             }
         }

         // Wait for all sound URL promises to resolve
         const soundUrlResults = await Promise.all(soundUrlPromises);
         const soundDownloadUrls = soundUrlResults.reduce((acc, result) => {
             if (result) {
                 acc[result.id] = result.downloadUrl;
             }
             return acc;
         }, {});


        // --- 4. Process Fragments and Build Response ---
        const fragments = fragmentSnapshot.docs.map(doc => {
            const data = doc.data();
            const rows = data.rows || 4;
            const columns = data.columns || 4;
            const totalPads = rows * columns;

            // Reconstruct the full pads array (0 to totalPads - 1)
            const pads = Array.from({ length: totalPads }, (_, i) => {
                const padIndexStr = i.toString();
                const soundIdsForPad = data.pad_sounds?.[padIndexStr] || [];
                // Get state from pad_state map, provide default if missing
                const stateForPad = data.pad_state?.[padIndexStr] || { isActive: false, currentSoundIndex: 0 };

                // Resolve sound details for this pad
                const padSounds = soundIdsForPad
                    .map(soundId => {
                        const soundInfo = soundDataMap.get(soundId);
                        if (!soundInfo) {
                            console.warn(`Fragment ${doc.id}, Pad ${i}: Sound info for ID ${soundId} not found.`);
                            return null; // Skip if sound data couldn't be fetched
                        }
                        return {
                            soundId: soundInfo.id,
                            soundName: soundInfo.name,
                            soundUrl: soundInfo.source_url, // Original gs:// path
                            downloadUrl: soundDownloadUrls[soundId] || null, // The resolved HTTPS URL
                            source: soundInfo.source_type || 'uploaded', // Map API source type
                            // color will be assigned client-side
                        };
                    })
                    .filter(ps => ps !== null); // Filter out sounds that couldn't be resolved

                return {
                    id: i, // The index of the pad (0 to totalPads-1)
                    sounds: padSounds,
                    // Use isActive from pad_state, but ensure it's false if no sounds exist
                    isActive: (stateForPad.isActive === true) && (padSounds.length > 0),
                    currentSoundIndex: stateForPad.currentSoundIndex ?? 0, // Use index from pad_state
                };
            });


            // Convert Timestamps to ISO strings
            const createdAtISO = data.created_at?.toDate ? data.created_at.toDate().toISOString() : null;
            const updatedAtISO = data.updated_at?.toDate ? data.updated_at.toDate().toISOString() : null;


            return {
                id: doc.id,
                author: data.author_name || 'Unknown Author', // Use author_name
                authorAvatar: null, // Fetch/resolve avatar URL on client if needed
                authorId: data.author_id, // Include author ID
                timestamp: createdAtISO, // Use created_at for timestamp
                pads: pads, // The fully reconstructed pads array
                likes: data.likes || 0,
                comments: [], // Comments need separate fetching/subcollection query on client or API
                commentsCount: data.comments_count || 0,
                title: data.title || null,
                bpm: data.bpm || 120,
                originalAuthor: data.original_author_id ? 'FetchAuthorNameLater' : null, // Resolve name later if needed
                originalAuthorId: data.original_author_id || null,
                originalFragmentId: data.original_fragment_id || null,
                columns: columns,
                rows: rows,
                viewCount: data.view_count || 0,
            };
        });

        // --- 5. Determine Next Page Cursor ---
        const lastVisible = fragmentSnapshot.docs[fragmentSnapshot.docs.length - 1];
        const nextPageCursor = lastVisible ? lastVisible.id : null;

        // --- 6. Send Response ---
        res.status(200).json({ fragments, nextPageCursor });

    } catch (error) {
        console.error("Error fetching fragments:", error);
        res.status(500).json({ error: 'Failed to fetch fragments', details: error.message });
    }
});


module.exports = router;
