// src/lib/placeholder-data.ts
import type { Fragment, Pad, PadSound } from './types';
import { presetSounds, marketplaceSounds } from './placeholder-sounds';

const allSounds = [...presetSounds, ...marketplaceSounds];

const colorPalette: string[] = [
  'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
  'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
  'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
  'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
  'bg-rose-500',
  'bg-red-600', 'bg-orange-600', 'bg-blue-600', 'bg-green-600', 'bg-purple-600',
];

const soundColorMap: { [soundId: string]: string } = {};
let availableColors = [...colorPalette];

const getRandomColor = (): string => {
  if (availableColors.length === 0) availableColors = [...colorPalette];
  const randomIndex = Math.floor(Math.random() * availableColors.length);
  return availableColors.splice(randomIndex, 1)[0];
};

const getSoundColor = (soundId: string): string => {
  if (!soundColorMap[soundId]) {
    soundColorMap[soundId] = getRandomColor();
  }
  return soundColorMap[soundId];
};

// Updated function to generate pads with potentially multiple sounds and currentSoundIndex
const generatePads = (activeIndices: number[], soundMapping: { [index: number]: string | string[] }): Pad[] => {
  return Array.from({ length: 16 }, (_, i) => {
    const isActiveInitially = activeIndices.includes(i);
    const soundInput = soundMapping[i]; // Can be single ID or array of IDs
    const padSounds: PadSound[] = [];

    if (soundInput) { // Process sounds regardless of initial isActive status
      const soundIds = Array.isArray(soundInput) ? soundInput : [soundInput];
      soundIds.forEach(soundId => {
        const sound = allSounds.find(s => s.id === soundId);
        if (sound) {
          const color = getSoundColor(soundId);
          padSounds.push({
            soundId: soundId,
            soundName: sound.name,
            soundUrl: sound.previewUrl,
            source: sound.type === 'preset' ? 'prerecorded' : 'prerecorded',
            color: color,
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
