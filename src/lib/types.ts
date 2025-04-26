// src/lib/types.ts

export type SoundSource = 'prerecorded' | 'live';

// Interface for storing information about a single sound assigned to a pad
export interface PadSound {
  soundId: string;
  soundName: string; // Store name directly for easier access
  soundUrl?: string;
  source?: SoundSource;
  color: string; // Color associated with this specific soundId
}

export interface Pad {
  id: number;
  sounds: PadSound[]; // Array to hold multiple sounds
  isActive: boolean; // A pad is active if it has at least one sound and is toggled on
  currentSoundIndex?: number; // Index of the sound currently displayed/focused in case of multiple sounds
  // Removed single sound properties: sound?, soundId?, soundUrl?, source?, color?
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

// Type for Sounds in the library/marketplace remains the same
export interface Sound {
  id: string;
  name: string;
  type: 'preset' | 'marketplace';
  author?: string; // For marketplace sounds
  previewUrl?: string; // Optional URL for sound preview
  patternStyle?: string; // Optional class for background pattern/animation
}

