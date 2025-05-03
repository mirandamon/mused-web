// src/lib/types.ts

export type SoundSource = 'prerecorded' | 'live' | 'uploaded' | 'predefined'; // Added API types

// Interface for storing information about a single sound assigned to a pad
export interface PadSound {
  soundId: string;
  soundName: string; // Store name directly for easier access
  soundUrl?: string; // Original source path (e.g., from Firestore)
  downloadUrl?: string; // Playable URL (e.g., signed URL from Storage)
  source?: SoundSource;
  color?: string; // Color associated with this specific soundId - Made optional
}

export interface Pad {
  id: number;
  sounds: PadSound[]; // Array to hold multiple sounds
  isActive: boolean; // A pad is active if it has at least one sound and is toggled on
  currentSoundIndex?: number; // Index of the sound currently displayed/focused in case of multiple sounds
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: Date;
}

export interface Fragment {
  id: string;
  author: string;
  authorAvatar?: string; // Optional: URL to author's avatar
  timestamp: Date;
  pads: Pad[];
  likes: number;
  comments: Comment[];
  title?: string; // Optional title for the fragment
  bpm?: number; // Beats per minute for playback
  originalAuthor?: string; // If it's a remix
  originalFragmentId?: string; // If it's a remix
}

// Updated Sound type to better match API and frontend usage
export interface Sound {
  id: string;
  name: string;
  type: 'preset' | 'marketplace' | 'recorded' | 'uploaded' | 'predefined'; // More specific type based on source_type or frontend context
  owner_user_id?: string; // From API
  source_type?: SoundSource; // From API
  source_url?: string; // From API (Storage path)
  downloadUrl?: string; // From API (Signed download URL)
  created_at?: string; // From API (ISO string)
  author?: string; // For marketplace/API sounds (derived from owner_user_id)
  previewUrl?: string; // Explicit preview URL (potentially same as downloadUrl or source_url)
  patternStyle?: string; // Optional class for background pattern/animation
}


