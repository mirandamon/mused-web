# Mused API (Firebase Cloud Functions)

This Node.js application, running as a Firebase Cloud Function, provides API endpoints for the Mused project.

## Project Structure

*   `firebase.json`: Configures Firebase deployment, specifying the `functions` directory as the source.
*   `.firebaserc`: Links this directory to your Firebase project (`mused-5ef9f`).
*   `functions/`: Contains the source code for the Cloud Function.
    *   `index.js`: The main entry point for the Cloud Function, setting up the Express app.
    *   `package.json`: Node.js dependencies for the function.
    *   `src/`: Contains the API logic (routes, Firebase Admin setup).
        *   `firebaseAdmin.js`: Initializes the Firebase Admin SDK.
        *   `routes/`: Express route handlers (e.g., `sounds.js`, `fragments.js`).

## Setup (Local Development)

1.  **Install Firebase CLI:** If you haven't already, install the Firebase CLI globally:
    ```bash
    npm install -g firebase-tools
    ```
2.  **Login to Firebase:**
    ```bash
    firebase login
    ```
3.  **Navigate to Functions Directory:**
    ```bash
    cd functions
    ```
4.  **Install Dependencies:**
    ```bash
    npm install
    ```
5.  **Configure Firebase Admin SDK (for Local Emulation):**
    *   The local emulator often uses the credentials you logged in with via the CLI.
    *   Alternatively, download a service account key for your `mused-5ef9f` project:
        *   Go to Firebase Project Settings > Service accounts.
        *   Click "Generate new private key". **Treat this file securely.**
        *   Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to the *absolute path* of the downloaded file:
            ```bash
            export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/serviceAccountKey.json"
            ```
    *   **Note:** This key is generally *not* needed for deployed functions, only for local testing/emulation if the default login credentials aren't sufficient.

## Running Locally with Firebase Emulators

1.  **Navigate to the root `mused-api` directory** (the one containing `firebase.json`).
2.  **Start the Emulators:** It's recommended to emulate Firestore as well if your API interacts with it.
    ```bash
    firebase emulators:start --only functions,firestore
    ```
    *   The Functions emulator will typically run your API at `http://localhost:5001/mused-5ef9f/us-central1/api`. Check the emulator startup logs for the exact URL.
    *   The Firestore emulator will run on a different port (usually 8080).

## Deployment

1.  **Navigate to the root `mused-api` directory.**
2.  **Deploy:**
    ```bash
    firebase deploy --only functions
    ```
3.  **API URL:** After deployment, the CLI will output the public URL for your API function, typically like: `https://us-central1-mused-5ef9f.cloudfunctions.net/api`

## API Endpoints

The base URL will be your deployed function URL (e.g., `https://us-central1-mused-5ef9f.cloudfunctions.net/api`).

### GET /sounds

Fetches a paginated list of sounds from the `sounds` collection in Firestore. Includes signed download URLs for playable audio.

**Query Parameters:**

*   `limit` (optional, number): The maximum number of sounds to return per page. Defaults to 20. Max 50.
*   `startAfter` (optional, string): The document ID of the last sound from the previous page, used for pagination.

**Response:**

*   **Success (200 OK):**
    ```json
    {
      "sounds": [
        {
          "id": "sound_doc_id_1",
          "name": "Deep Kick",
          "owner_user_id": "user_id_abc",
          "source_type": "predefined",
          "source_url": "gs://mused-5ef9f.appspot.com/sounds/deep_kick.wav", // Original gs:// path
          "downloadUrl": "https://storage.googleapis.com/...", // Signed URL
          "created_at": "2023-10-27T10:00:00.000Z" // ISO String format or null
        },
        // ... more sounds
      ],
      "nextPageCursor": "sound_doc_id_N" // ID of the last sound in the list, or null if no more pages
    }
    ```
*   **Error (e.g., 500 Internal Server Error):**
    ```json
    {
      "error": "Failed to fetch sounds",
      "details": "..." // Specific error message
    }
    ```

### GET /fragments

Fetches a paginated list of fragments from the `fragments` collection. Resolves sound information and provides signed download URLs for sounds within each fragment's pads.

**Query Parameters:**

*   `limit` (optional, number): The maximum number of fragments to return per page. Defaults to 10. Max 30.
*   `startAfter` (optional, string): The document ID of the last fragment from the previous page, used for pagination.

**Response:**

*   **Success (200 OK):**
    ```json
    {
      "fragments": [
        {
          "id": "fragment_doc_id_1",
          "author": "Staff", // Resolved author name
          "authorId": "0", // Author's user ID
          "authorAvatar": null, // Placeholder, client resolves avatar
          "timestamp": "2023-10-28T12:00:00.000Z", // Creation date (ISO String)
          "title": "My Awesome Beat",
          "bpm": 120,
          "likes": 15,
          "commentsCount": 3,
          "viewCount": 100,
          "originalAuthor": null, // Or resolved name if remix
          "originalAuthorId": null, // Or original author ID
          "originalFragmentId": null, // Or original fragment ID
          "columns": 4,
          "rows": 4,
          "pads": [
            {
              "id": 0,
              "sounds": [
                {
                  "soundId": "sound_doc_id_1",
                  "soundName": "Deep Kick",
                  "soundUrl": "gs://mused-5ef9f.appspot.com/sounds/deep_kick.wav", // Original gs:// path
                  "downloadUrl": "https://storage.googleapis.com/...", // Signed URL for playback
                  "source": "uploaded" // Or 'predefined', 'recorded'
                }
              ],
              "isActive": true,
              "currentSoundIndex": 0
            },
             { // Example of a pad with multiple sounds
              "id": 2,
              "sounds": [
                { "soundId": "sound_doc_id_1", "soundName": "Deep Kick", /*...*/ "downloadUrl": "..." },
                { "soundId": "sound_doc_clap", "soundName": "808 Clap", /*...*/ "downloadUrl": "..." }
              ],
              "isActive": true,
              "currentSoundIndex": 1 // Example index
            },
            // ... other pads (including empty pads with `sounds: []`)
          ]
        },
        // ... more fragments
      ],
      "nextPageCursor": "fragment_doc_id_N" // ID of the last fragment, or null
    }
    ```
*   **Error (e.g., 404 Not Found, 500 Internal Server Error):**
    ```json
    {
      "error": "Failed to fetch fragments",
      "details": "..." // Specific error message
    }
    ```

### POST /fragments

Creates a new music fragment document in the `fragments` collection.

**Request Body:**

```json
{
  "pads": [
    {
      "id": 0, // Pad index (0-15 for 4x4)
      "sounds": [
        {
          "soundId": "sound_doc_id_1", // Firestore document ID from 'sounds' collection
          "soundName": "Deep Kick", // Included for debugging/display convenience
          "soundUrl": "gs://mused-5ef9f.appspot.com/sounds/deep_kick.wav" // **Important:** Original gs:// path required
        },
        // ... more sounds for this pad if applicable
      ],
      "isActive": true, // State of the pad (used for playback logic)
      "currentSoundIndex": 0 // Index of the currently selected sound
    },
    // ... include ALL pads (0-15) in the array, even if sounds: []
    // The API will filter which ones to save in `pad_sounds` map
  ],
  "bpm": 120, // Beats per minute
  "title": "My Awesome Beat", // Optional title
  "columns": 4, // Optional, defaults to 4
  "rows": 4, // Optional, defaults to 4
  "originalAuthorId": null, // Or string if it's a remix
  "originalFragmentId": null // Or string if it's a remix
}
```

**Response:**

*   **Success (201 Created):**
    ```json
    {
      "message": "Fragment created successfully",
      "fragmentId": "new_fragment_doc_id"
    }
    ```
*   **Error (400 Bad Request):** If validation fails.
    ```json
    {
      "error": "Invalid input data.",
      "details": ["Field 'pads' must be a non-empty array.", "..."]
    }
    ```
*   **Error (500 Internal Server Error):** If Firestore operation fails.
    ```json
    {
      "error": "Failed to create fragment",
      "details": "..." // Specific error message
    }
    ```

**Firestore Document Structure (`fragments` collection):**

```json
{
  "author_id": "0", // Placeholder, replace with actual auth user ID
  "author_name": "Staff", // Placeholder, replace with actual auth user name
  "bpm": 120,
  "columns": 4,
  "rows": 4,
  "title": "My Awesome Beat", // or null
  "original_author_id": null, // or string
  "original_fragment_id": null, // or string
  "created_at": Timestamp(...), // Firestore Timestamp
  "updated_at": Timestamp(...), // Firestore Timestamp
  "likes": 0,
  "comments_count": 0,
  "view_count": 0,
  "pad_sounds": { // Map: pad index (string) -> array of sound IDs
    "0": ["sound_doc_id_1"],
    "2": ["sound_doc_id_1", "sound_doc_clap"],
    // Only pads with sounds are included here
  },
   "pad_state": { // Map: pad index (string) -> UI state object
      "0": {"isActive": true, "currentSoundIndex": 0},
      "2": {"isActive": true, "currentSoundIndex": 1},
       // Includes state for pads listed in `pad_sounds`
   }
}
```