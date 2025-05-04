// src/lib/placeholder-data.ts
import type { Fragment, Pad, PadSound, Sound } from './types';
// Removed import of presetSounds

// Note: Color assignment is now done on the client-side in components like FragmentEditor and FragmentPost

// Updated function to generate pads with potentially multiple sounds and currentSoundIndex
// Assumes all sound IDs map to sounds available via the API.
const generatePads = (activeIndices: number[], soundMapping: { [index: number]: string | string[] }): Pad[] => {
  return Array.from({ length: 16 }, (_, i) => {
    const isActiveInitially = activeIndices.includes(i);
    const soundInput = soundMapping[i]; // Can be single ID or array of IDs
    const padSounds: PadSound[] = [];

    if (soundInput) { // Process sounds regardless of initial isActive status
      const soundIds = Array.isArray(soundInput) ? soundInput : [soundInput];
      soundIds.forEach(soundId => {
        // Assume it's a marketplace/API sound placeholder
        // Name and URLs will be populated later by API fetch/resolution logic in components
        padSounds.push({
          soundId: soundId,
          soundName: soundId.replace(/^(mkt-)/, '').replace('-', ' ') || 'API Sound', // Generate a fallback name
          soundUrl: undefined, // API will provide original path (e.g., gs://)
          downloadUrl: undefined, // API *must* provide playable HTTPS URL or resolution logic must handle gs://
          source: 'uploaded', // Assume marketplace sounds are 'uploaded' or similar
          // color: // REMOVED - Handled client-side
        });
      });
    }

    // A pad is active if explicitly in activeIndices *and* has sounds loaded
    // Consider if isActive should just be true if it has sounds, regardless of activeIndices for placeholders?
    // For now, sticking to the original logic: must be in activeIndices.
    const isActive = isActiveInitially && padSounds.length > 0;

    return {
      id: i,
      sounds: padSounds,
      isActive: isActive,
      currentSoundIndex: 0, // Default to the first sound
    };
  });
};


// --- Sound Mappings (Remove preset- IDs, use only API/marketplace IDs) ---
// NOTE: These IDs MUST correspond to actual sound IDs in your Firestore 'sounds' collection.
const frag1SoundMap = {
  0: 'mkt-kick-1', 2: 'mkt-snare-1', 5: 'mkt-hihat-1', 7: 'mkt-hihat-1',
  8: 'mkt-kick-1', 10: 'mkt-snare-1', 13: ['mkt-bass-1', 'mkt-fx-1'], // Multiple sounds on pad 13
  15: 'mkt-bass-1',
};
const frag2SoundMap = {
  1: 'mkt-kick-2', 3: 'mkt-snare-2', 4: 'mkt-hihat-2', 6: 'mkt-hihat-2',
  9: 'mkt-bass-2', 11: 'mkt-bass-2', 12: 'mkt-vox-1', 14: 'mkt-vox-1',
};
const frag3SoundMap = { // Remix of frag1 (using API IDs)
  0: 'mkt-kick-1', 1: 'mkt-clap-1', 2: 'mkt-snare-1', 3: 'mkt-clap-1',
  5: 'mkt-hihat-1', 6: 'mkt-perc-1', 9: 'mkt-bass-1', 10: ['mkt-fx-1', 'mkt-lead-1'], // Multiple sounds
  13: ['mkt-bass-1', 'mkt-fx-1'], // Kept multiple sounds from frag1
  14: 'mkt-fx-1',
};
const frag4SoundMap = {
  4: 'mkt-lead-2', 5: 'mkt-lead-2', 6: 'mkt-pad-1', 7: 'mkt-pad-1',
};

// --- Placeholder Fragments ---
export const placeholderFragments: Fragment[] = [
  {
    id: 'frag-1',
    author: 'SynthWaveKid',
    authorAvatar: 'https://picsum.photos/seed/frag1/40/40',
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    pads: generatePads([0, 2, 5, 7, 8, 10, 13, 15], frag1SoundMap), // Active indices passed here
    likes: 12,
    comments: [
      { id: 'c1-1', author: 'BeatMaster', text: 'Nice groove!', timestamp: new Date(Date.now() - 1000 * 60 * 2) },
      { id: 'c1-2', author: 'LoopQueen', text: 'Love the layered sound on pad 13!', timestamp: new Date(Date.now() - 1000 * 60 * 1) },
    ],
    title: 'Neon Drive Beat',
    bpm: 110,
  },
  {
    id: 'frag-2',
    author: 'LoFiDreamer',
    authorAvatar: 'https://picsum.photos/seed/frag2/40/40',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    pads: generatePads([1, 3, 4, 6, 9, 11, 12, 14], frag2SoundMap), // Active indices
    likes: 45,
    comments: [
       { id: 'c2-1', author: 'ChillHopFan', text: 'So chill!', timestamp: new Date(Date.now() - 1000 * 60 * 30) },
    ],
    title: 'Rainy Day Loop',
    bpm: 90,
  },
  {
    id: 'frag-3',
    author: 'RemixNinja',
    authorAvatar: 'https://picsum.photos/seed/frag3/40/40',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8),
    pads: generatePads([0, 1, 2, 3, 5, 6, 9, 10, 13, 14], frag3SoundMap), // Active indices
    likes: 8,
    comments: [],
    originalAuthor: 'SynthWaveKid',
    originalFragmentId: 'frag-1',
    title: 'Neon Drive Remix V2',
    bpm: 125,
  },
   {
    id: 'frag-4',
    author: 'AcousticSoul',
    authorAvatar: 'https://picsum.photos/seed/frag4/40/40',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
    pads: generatePads([4, 5, 6, 7], frag4SoundMap), // Active indices
    likes: 22,
    comments: [
       { id: 'c4-1', author: 'ListenerX', text: 'Simple but effective', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5) },
    ],
    title: 'Simple Chords',
    bpm: 80,
  },
];