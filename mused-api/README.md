# Mused API

This Node.js application provides API endpoints for the Mused project, initially focusing on fetching sounds metadata from Firestore.

## Setup

1.  **Install Dependencies:**
    ```bash
    npm install
    ```
2.  **Configure Firebase Admin SDK:**
    *   Go to your Firebase Project Settings > Service accounts.
    *   Click "Generate new private key" and download the JSON file. **Treat this file securely.**
    *   **Option 1 (Recommended for most environments):** Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to the *absolute path* of the downloaded service account key file.
        ```bash
        export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/serviceAccountKey.json"
        ```
    *   **Option 2 (Alternative, e.g., for some hosting platforms):**
        *   Encode the *content* of the service account key JSON file to Base64.
        *   Create a `.env` file by copying `.env.example`.
        *   Set `FIREBASE_SERVICE_ACCOUNT_BASE64` in your `.env` file to the Base64 encoded string.
        *   Ensure `FIREBASE_PROJECT_ID` is also set in `.env`.
3.  **Environment Variables:**
    *   Create a `.env` file (copy from `.env.example` if needed).
    *   Set the `PORT` (defaults to 3001 if not set).
    *   Configure Firebase credentials as described above.

## Running the API

*   **Development (with auto-reload):**
    ```bash
    npm run dev
    ```
*   **Production:**
    ```bash
    npm start
    ```

The API will typically run on `http://localhost:3001`.

## API Endpoints

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
          "created_at": "2023-10-27T10:00:00.000Z" // ISO String format
        },
        // ... more sounds
      ],
      "nextPageCursor": "sound_doc_id_N" // ID of the last sound in the list, or null if no more pages
    }
    ```
*   **Error (500 Internal Server Error):**
    ```json
    {
      "error": "Failed to fetch sounds",
      "details": "..." // Specific error message
    }
    ```
