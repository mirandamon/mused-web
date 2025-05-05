// functions/src/routes/fragments.js
const express = require('express');
const { db, admin } = require('../firebaseAdmin'); // Ensure db and admin are imported

const router = express.Router();
const FRAGMENTS_COLLECTION = 'fragments';

// --- Input Validation Helper (Basic Example) ---
// You might want to use a library like Joi or Zod for more robust validation
const validateFragmentInput = (data) => {
    const errors = [];
    if (!data || typeof data !== 'object') {
        errors.push("Invalid request body.");
        return errors;
    }
    if (!Array.isArray(data.pads) || data.pads.length === 0) {
        errors.push("Field 'pads' must be a non-empty array.");
    } else {
        // Basic validation for pads structure
        data.pads.forEach((pad, index) => {
            if (typeof pad.id !== 'number') errors.push(`Pad at index ${index} is missing a numeric 'id'.`);
            if (!Array.isArray(pad.sounds)) errors.push(`Pad ${pad.id} is missing a 'sounds' array.`);
            else {
                pad.sounds.forEach((sound, sIndex) => {
                    if (!sound.soundId || typeof sound.soundId !== 'string') {
                        errors.push(`Sound at index ${sIndex} in Pad ${pad.id} is missing a valid 'soundId'.`);
                    }
                    // soundUrl is the *original* path (gs://), not the download URL
                    if (!sound.soundUrl || typeof sound.soundUrl !== 'string') {
                         errors.push(`Sound '${sound.soundName || sound.soundId}' in Pad ${pad.id} is missing a valid 'soundUrl' (original storage path).`);
                    }
                });
            }
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
            console.error("Firestore database instance is not available for fragments.");
            return res.status(500).json({ error: 'Database connection failed' });
        }

        // --- 2. Transform Pad Data ---
        // Create the pad_sounds map: { "padIndex": ["soundId1", "soundId2", ...] }
        // Only include pads that have sounds. Store only the sound ID.
        const padSoundsMap = inputData.pads.reduce((acc, pad) => {
            if (pad.sounds && pad.sounds.length > 0) {
                // Map sound objects to just their soundId
                acc[pad.id.toString()] = pad.sounds.map(sound => sound.soundId).filter(id => !!id); // Filter out any null/undefined ids
            }
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
            view_count: 0,
            pad_sounds: padSoundsMap, // The transformed map
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

module.exports = router;
