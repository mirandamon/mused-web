export type SoundSource = 'prerecorded' | 'live' | 'uploaded' | 'predefined' | 'marketplace';

export interface PadSound {
  soundId: string;
  soundName: string;
  soundUrl?: string;
  downloadUrl?: string;
  source?: SoundSource;
  color?: string;
  asset?: number;
  localUri?: string;
}

export interface Pad {
  id: number;
  sounds: PadSound[];
  isActive: boolean;
  currentSoundIndex?: number;
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: Date | string;
}

export interface Fragment {
  id: string;
  author: string;
  authorId?: string;
  authorAvatar?: string;
  timestamp: Date | string;
  pads: Pad[];
  likes: number;
  comments: Comment[];
  commentsCount?: number;
  title?: string;
  bpm?: number;
  originalAuthor?: string;
  originalAuthorId?: string;
  originalFragmentId?: string;
  columns?: number;
  rows?: number;
  viewCount?: number;
}

export interface Sound {
  id: string;
  name: string;
  type: 'preset' | 'marketplace' | 'recorded' | 'uploaded' | 'predefined';
  owner_user_id?: string;
  source_type?: SoundSource;
  source_url?: string;
  downloadUrl?: string;
  created_at?: string;
  author?: string;
  previewUrl?: string;
  patternStyle?: string;
  asset?: number;
}
