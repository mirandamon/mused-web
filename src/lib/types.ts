{// src/lib/types.ts

export type SoundSource = 'prerecorded' | 'live';

export interface Pad {
  id: number;
  sound?: string; // Name or identifier for the sound
  soundId?: string; // Unique ID of the sound
  soundUrl?: string; // Optional: URL for playback
  source?: SoundSource;
  isActive: boolean;
  color?: string; // Assigned color class (e.g., 'bg-red-500')
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
  originalAuthor?: string; // If it's a remix
  originalFragmentId?: string; // If it's a remix
}

// New Type for Sounds
export interface Sound {
  id: string;
  name: string;
  type: 'preset' | 'marketplace';
  author?: string; // For marketplace sounds
  previewUrl?: string; // Optional URL for sound preview
  patternStyle?: string; // Optional class for background pattern/animation
}
