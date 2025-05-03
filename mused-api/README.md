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
        *   `routes/`: Express route handlers (e.g., `sounds.js`).

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

### GET /api/sounds

Fetches a paginated list of sounds from the `sounds` collection in Firestore.

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
          "source_url": "/sounds/deep_kick.wav",
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
