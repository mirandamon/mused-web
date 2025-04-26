// src/lib/placeholder-data.ts
import type { Fragment, Pad } from './types';

const generatePads = (activeIndices: number[]): Pad[] => {
  return Array.from({ length: 16 }, (_, i) => ({
    id: i,
    isActive: activeIndices.includes(i),
    sound: activeIndices.includes(i) ? `sound_${i}` : undefined,
    source: activeIndices.includes(i) ? 'prerecorded' : undefined,
  }));
};

export const placeholderFragments: Fragment[] = [
  {
    id: 'frag-1',
    author: 'SynthWaveKid',
    authorAvatar: 'https://picsum.photos/seed/frag1/40/40',
    timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
    pads: generatePads([0, 2, 5, 7, 8, 10, 13, 15]),
    likes: 12,
    comments: [
      { id: 'c1-1', author: 'BeatMaster', text: 'Nice groove!', timestamp: new Date(Date.now() - 1000 * 60 * 2) },
      { id: 'c1-2', author: 'LoopQueen', text: 'Love the bassline pads', timestamp: new Date(Date.now() - 1000 * 60 * 1) },
    ],
    title: 'Neon Drive Beat',
  },
  {
    id: 'frag-2',
    author: 'LoFiDreamer',
    authorAvatar: 'https://picsum.photos/seed/frag2/40/40',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    pads: generatePads([1, 3, 4, 6, 9, 11, 12, 14]),
    likes: 45,
    comments: [
       { id: 'c2-1', author: 'ChillHopFan', text: 'So chill!', timestamp: new Date(Date.now() - 1000 * 60 * 30) },
    ],
    title: 'Rainy Day Loop',
  },
  {
    id: 'frag-3',
    author: 'RemixNinja',
    authorAvatar: 'https://picsum.photos/seed/frag3/40/40',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8), // 8 hours ago
    pads: generatePads([0, 1, 2, 3, 5, 6, 9, 10, 13, 14]), // Remix pads based on frag-1
    likes: 8,
    comments: [],
    originalAuthor: 'SynthWaveKid', // Mark as remix
    originalFragmentId: 'frag-1',
    title: 'Neon Drive Remix',
  },
   {
    id: 'frag-4',
    author: 'AcousticSoul',
    authorAvatar: 'https://picsum.photos/seed/frag4/40/40',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    pads: generatePads([4, 5, 6, 7]),
    likes: 22,
    comments: [
       { id: 'c4-1', author: 'ListenerX', text: 'Simple but effective', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5) },
    ],
    title: 'Guitar Chord Strum',
  },
];
