# Mused

This is a NextJS starter in Firebase Studio for the Mused app.

## Getting Started

1.  **Install Dependencies**:
    ```bash
    npm install
    # or
    yarn install
    # or
    pnpm install
    ```

2.  **Set up Firebase**:
    *   Go to your Firebase project settings: [https://console.firebase.google.com/project/mused-5ef9f/settings/general/](https://console.firebase.google.com/project/mused-5ef9f/settings/general/)
    *   Under "Your apps", find or create a Web app (`</>`).
    *   Copy the `firebaseConfig` object values.
    *   Rename `.env.example` to `.env` (if `.env.example` exists) or create a `.env` file.
    *   Paste your Firebase config values into the `.env` file, replacing the placeholders:

        ```dotenv
        # Firebase configuration - Replace with your actual project config
        NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_API_KEY"
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN"
        NEXT_PUBLIC_FIREBASE_PROJECT_ID="mused-5ef9f"
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_STORAGE_BUCKET"
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_MESSAGING_SENDER_ID"
        NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_APP_ID"
        NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="YOUR_MEASUREMENT_ID" # Optional

        # Google AI API Key (if used)
        # GOOGLE_GENAI_API_KEY="YOUR_GOOGLE_GENAI_API_KEY"
        ```

3.  **Run the Development Server**:
    ```bash
    npm run dev
    # or
    yarn dev
    # or
    pnpm dev
    ```

4.  Open [http://localhost:9002](http://localhost:9002) with your browser to see the result.

## Project Structure

*   `src/app/`: Contains the main application routes using Next.js App Router.
*   `src/components/`: Reusable UI components.
    *   `src/components/ui/`: ShadCN UI components.
    *   `src/components/fragments/`: Components related to music fragments.
    *   `src/components/layout/`: Layout components like Header.
*   `src/lib/`: Utility functions, type definitions, and Firebase setup.
    *   `src/lib/firebase/clientApp.ts`: Firebase client initialization.
    *   `src/lib/placeholder-data.ts`: Placeholder data for development.
    *   `src/lib/types.ts`: TypeScript type definitions.
*   `src/hooks/`: Custom React hooks.
*   `src/ai/`: Genkit AI-related code (if used).
*   `public/`: Static assets.
*   `styles/`: Global styles (`globals.css`).

## Key Features Implemented

*   **Fragment Creation**: 4x4 grid interface (`/create`).
*   **Home Feed**: Displays fragments (`/`).
*   **Remix Flow**: Remix existing fragments (`/remix/[id]`).
*   **Sound Selection**: Sheet for adding/removing sounds to pads.
*   **Multi-Sound Pads**: Support for multiple sounds per pad with swipe interaction.
*   **Playback**: Play/pause functionality with BPM control and visual beat indicator.
*   **Styling**: Uses ShadCN UI, Tailwind CSS, and custom themes based on proposal.

## Firebase Integration

This project is configured to connect to the Firebase project `mused-5ef9f`. Ensure your `.env` file is correctly populated with your project's specific web app configuration details as described in the "Set up Firebase" section above.

You can now import and use Firebase services (like Firestore, Auth, Storage) from `src/lib/firebase/clientApp.ts` throughout your application.
