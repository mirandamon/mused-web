// src/lib/types.ts

export type SoundSource = 'prerecorded' | 'live' | 'uploaded' | 'predefined'; // Added API types

// Interface for storing information about a single sound assigned to a pad
export interface PadSound {
  soundId: string;
  soundName: string; // Store name directly for easier access
  soundUrl?: string; // Original source path (e.g., from Firestore, gs://)
  downloadUrl?: string; // Playable URL (e.g., signed URL from Storage)
  source?: SoundSource;
  color?: string; // Color associated with this specific soundId - Made optional
}

export interface Pad {
  id: number;
  sounds: PadSound[]; // Array to hold multiple sounds
  isActive: boolean; // State of the pad (used for playback logic, sent to API)
  currentSoundIndex?: number; // Index of the sound currently displayed/focused (UI state, sent to API)
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: Date | string; // Allow ISO string from API
}

export interface Fragment {
  id: string;
  author: string;
  authorId?: string; // Added author ID from API
  authorAvatar?: string; // Optional: URL to author's avatar
  timestamp: Date | string; // Allow ISO string from API
  pads: Pad[];
  likes: number;
  comments: Comment[]; // Comments fetched separately
  commentsCount?: number; // Added comment count from API
  title?: string; // Optional title for the fragment
  bpm?: number; // Beats per minute for playback
  originalAuthor?: string; // If it's a remix
  originalAuthorId?: string; // Added original author ID from API
  originalFragmentId?: string; // If it's a remix
  columns?: number; // Added columns
  rows?: number; // Added rows
  viewCount?: number; // Added view count from API
}

// Updated Sound type to better match API and frontend usage
export interface Sound {
  id: string;
  name: string;
  // type is derived client-side or based on context, not directly from API's source_type usually
  type: 'preset' | 'marketplace' | 'recorded' | 'uploaded' | 'predefined';
  owner_user_id?: string; // From API
  source_type?: SoundSource; // From API
  source_url?: string; // From API (Storage path, gs://)
  downloadUrl?: string; // From API (Signed download URL, HTTPS)
  created_at?: string; // From API (ISO string)
  author?: string; // For marketplace/API sounds (derived from owner_user_id or pre-set)
  previewUrl?: string; // Explicit preview URL (potentially same as downloadUrl or source_url AFTER resolution)
  patternStyle?: string; // Optional class for background pattern/animation
}