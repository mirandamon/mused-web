export type SoundSource =
  | 'prerecorded'
  | 'live'
  | 'uploaded'
  | 'predefined'
  | 'preset'
  | 'marketplace'
  | 'recorded';

export interface PadSound {
  soundId: string;
  soundName: string;
  soundUrl?: string;
  downloadUrl?: string;
  source?: SoundSource;
  color?: string;
}

export interface Pad {
  id: number;
  sounds: PadSound[];
  isActive: boolean;
  currentSoundIndex?: number;
}

export interface Fragment {
  id: string;
  author: string;
  pads: Pad[];
  bpm?: number;
  title?: string;
  likes?: number;
  comments?: unknown[];
  originalAuthor?: string;
  originalAuthorId?: string;
  originalFragmentId?: string;
  columns?: number;
  rows?: number;
}
