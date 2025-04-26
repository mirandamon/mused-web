// src/lib/types.ts

export type SoundSource = 'prerecorded' | 'live';

export interface Pad {
  id: number;
  sound?: string; // URL or identifier for the sound
  source?: SoundSource;
  isActive: boolean;
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
