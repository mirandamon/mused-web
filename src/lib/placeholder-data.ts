// src/lib/placeholder-data.ts
import type { Fragment, Pad, PadSound, Sound } from './types';
import { presetSounds } from './placeholder-sounds'; // Import only presets

// Only use preset sounds for initial static data population.
const allStaticSounds: Sound[] = [...presetSounds];

// Note: Color assignment is now done on the client-side in components like FragmentEditor and FragmentPost
// const colorPalette: string[] = [ ... ]; // No longer needed here
// import { getOrAssignSoundColor } from '@/components/fragments/fragment-editor'; // DO NOT IMPORT CLIENT CODE

// Updated function to generate pads with potentially multiple sounds and currentSoundIndex
const generatePads = (activeIndices: number[], soundMapping: { [index: number]: string | string[] }): Pad[] => {
  return Array.from({ length: 16 }, (_, i) => {
    const isActiveInitially = activeIndices.includes(i);
    const soundInput = soundMapping[i]; // Can be single ID or array of IDs
    const padSounds: PadSound[] = [];

    if (soundInput) { // Process sounds regardless of initial isActive status
      const soundIds = Array.isArray(soundInput) ? soundInput : [soundInput];
      soundIds.forEach(soundId => {
        // Look for the sound in the static presets first
        const sound = allStaticSounds.find(s => s.id === soundId);
        // const color = getOrAssignSoundColor(soundId); // REMOVED: Color assignment moved to client

        if (sound) {
          // Preset sound found
          const playableUrl = sound.downloadUrl || sound.source_url;
          if (!playableUrl) {
              console.warn(`Placeholder Data: Preset sound ${soundId} missing playable URL.`);
          }

          padSounds.push({
            soundId: soundId,
            soundName: sound.name,
            soundUrl: sound.source_url, // Keep original path if exists
            downloadUrl: playableUrl, // Use downloadUrl or relative source_url for playback
            source: 'predefined', // Presets are 'predefined'
            // color: color, // REMOVED
          });
        } else {
          // If not found in presets, assume it's a marketplace/API sound placeholder
          padSounds.push({
            soundId: soundId,
            soundName: soundId.replace(/^(preset-|mkt-)/, '').replace('-', ' ') || 'Market Sound', // Generate a fallback name
            soundUrl: undefined, // API will provide original path (e.g., gs://)
            downloadUrl: undefined, // API *must* provide playable HTTPS URL
            source: 'uploaded', // Assume marketplace sounds are 'uploaded' or similar
            // color: color, // REMOVED
          });
        }
      });
    }

    // A pad is active if explicitly in activeIndices *and* has sounds loaded
    const isActive = isActiveInitially && padSounds.length > 0;

    return {
      id: i,
      sounds: padSounds,
      isActive: isActive,
      currentSoundIndex: 0, // Default to the first sound
    };
  });
};


// --- Sound Mappings (Can now include arrays for multiple sounds) ---
const frag1SoundMap = {
  0: 'preset-kick-1', 2: 'preset-snare-1', 5: 'preset-hihat-1', 7: 'preset-hihat-1',
  8: 'preset-kick-1', 10: 'preset-snare-1', 13: ['preset-bass-1', 'mkt-fx-1'], // Multiple sounds on pad 13
  15: 'preset-bass-1',
};
const frag2SoundMap = {
  1: 'mkt-kick-2', 3: 'mkt-snare-2', 4: 'mkt-hihat-2', 6: 'mkt-hihat-2',
  9: 'mkt-bass-2', 11: 'mkt-bass-2', 12: 'mkt-vox-1', 14: 'mkt-vox-1',
};
const frag3SoundMap = { // Remix of frag1
  0: 'preset-kick-1', 1: 'mkt-clap-1', 2: 'preset-snare-1', 3: 'mkt-clap-1',
  5: 'preset-hihat-1', 6: 'mkt-perc-1', 9: 'preset-bass-1', 10: ['mkt-fx-1', 'preset-lead-1'], // Multiple sounds
  13: ['preset-bass-1', 'mkt-fx-1'], // Kept multiple sounds from frag1
  14: 'mkt-fx-1',
};
const frag4SoundMap = {
  4: 'mkt-lead-2', 5: 'mkt-lead-2', 6: 'preset-pad-1', 7: 'preset-pad-1',
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

