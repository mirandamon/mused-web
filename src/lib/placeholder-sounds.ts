// src/lib/placeholder-sounds.ts
import type { Sound } from './types';

// Only define preset sounds statically
// Add placeholder downloadUrls for local testing.
// In a real scenario, these might point to public URLs or require signed URLs like the API sounds.
export const presetSounds: Sound[] = [
  { id: 'preset-kick-1', name: 'Deep Kick', type: 'preset', downloadUrl: '/sounds/preset-kick-1.wav', patternStyle: 'bg-gradient-to-br from-blue-500/20 to-purple-600/20 animate-gradient-xy' },
  { id: 'preset-snare-1', name: 'Crisp Snare', type: 'preset', downloadUrl: '/sounds/preset-snare-1.wav', patternStyle: 'bg-gradient-to-br from-green-400/20 to-cyan-500/20 animate-gradient-xy' },
  { id: 'preset-hihat-1', name: 'Open Hi-Hat', type: 'preset', downloadUrl: '/sounds/preset-hihat-1.wav', patternStyle: 'bg-gradient-to-br from-yellow-400/20 to-orange-500/20 animate-gradient-xy' },
  { id: 'preset-bass-1', name: 'Synth Bass', type: 'preset', downloadUrl: '/sounds/preset-bass-1.wav', patternStyle: 'bg-gradient-to-br from-indigo-500/20 to-violet-600/20 animate-gradient-xy' },
  { id: 'preset-lead-1', name: 'Pluck Lead', type: 'preset', downloadUrl: '/sounds/preset-lead-1.wav', patternStyle: 'bg-gradient-to-br from-pink-500/20 to-red-500/20 animate-gradient-xy' },
  { id: 'preset-pad-1', name: 'Ambient Pad', type: 'preset', downloadUrl: '/sounds/preset-pad-1.wav', patternStyle: 'bg-gradient-to-br from-teal-400/20 to-blue-500/20 animate-gradient-xy' },
];

// marketplaceSounds are now fetched from the API via SoundSelectionSheet
// export const marketplaceSounds: Sound[] = [ ... ]; // Removed
