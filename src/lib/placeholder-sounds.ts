// src/lib/placeholder-sounds.ts
import type { Sound } from './types';

export const presetSounds: Sound[] = [
  { id: 'preset-kick-1', name: 'Deep Kick', type: 'preset', patternStyle: 'bg-gradient-to-br from-blue-500/20 to-purple-600/20 animate-gradient-xy' },
  { id: 'preset-snare-1', name: 'Crisp Snare', type: 'preset', patternStyle: 'bg-gradient-to-br from-green-400/20 to-cyan-500/20 animate-gradient-xy' },
  { id: 'preset-hihat-1', name: 'Open Hi-Hat', type: 'preset', patternStyle: 'bg-gradient-to-br from-yellow-400/20 to-orange-500/20 animate-gradient-xy' },
  { id: 'preset-bass-1', name: 'Synth Bass', type: 'preset', patternStyle: 'bg-gradient-to-br from-indigo-500/20 to-violet-600/20 animate-gradient-xy' },
  { id: 'preset-lead-1', name: 'Pluck Lead', type: 'preset', patternStyle: 'bg-gradient-to-br from-pink-500/20 to-red-500/20 animate-gradient-xy' },
  { id: 'preset-pad-1', name: 'Ambient Pad', type: 'preset', patternStyle: 'bg-gradient-to-br from-teal-400/20 to-blue-500/20 animate-gradient-xy' },
];

export const marketplaceSounds: Sound[] = [
  { id: 'mkt-clap-1', name: '80s Clap', type: 'marketplace', author: 'RetroSounds', patternStyle: 'bg-gradient-to-tl from-rose-400/20 to-orange-300/20 animate-gradient-xy-slow' },
  { id: 'mkt-perc-1', name: 'Tribal Perc', type: 'marketplace', author: 'WorldBeats', patternStyle: 'bg-gradient-to-tl from-lime-400/20 to-emerald-500/20 animate-gradient-xy-slow' },
  { id: 'mkt-fx-1', name: 'Riser FX', type: 'marketplace', author: 'FXMaster', patternStyle: 'bg-gradient-to-tl from-sky-400/20 to-indigo-500/20 animate-gradient-xy-slow' },
  { id: 'mkt-vox-1', name: 'Vocal Chop', type: 'marketplace', author: 'Vocalize', patternStyle: 'bg-gradient-to-tl from-fuchsia-500/20 to-purple-600/20 animate-gradient-xy-slow' },
  { id: 'mkt-kick-2', name: 'Hard Kick', type: 'marketplace', author: 'TechnoHead', patternStyle: 'bg-gradient-to-tl from-red-500/20 to-orange-500/20 animate-gradient-xy-slow' },
  { id: 'mkt-snare-2', name: 'LoFi Snare', type: 'marketplace', author: 'ChillBeats', patternStyle: 'bg-gradient-to-tl from-amber-300/20 to-yellow-400/20 animate-gradient-xy-slow' },
  { id: 'mkt-bass-2', name: 'Wobble Bass', type: 'marketplace', author: 'DubStepper', patternStyle: 'bg-gradient-to-tl from-cyan-400/20 to-blue-600/20 animate-gradient-xy-slow' },
   { id: 'mkt-lead-2', name: 'Saw Lead', type: 'marketplace', author: 'EDMProducer', patternStyle: 'bg-gradient-to-tl from-violet-500/20 to-pink-500/20 animate-gradient-xy-slow' },
   // Add more for scrolling demonstration
   { id: 'mkt-kick-3', name: 'Soft Kick', type: 'marketplace', author: 'AcousticDrums', patternStyle: 'bg-gradient-to-tl from-blue-500/20 to-purple-600/20 animate-gradient-xy-slow' },
   { id: 'mkt-snare-3', name: 'Rim Shot', type: 'marketplace', author: 'JazzDrums', patternStyle: 'bg-gradient-to-tl from-green-400/20 to-cyan-500/20 animate-gradient-xy-slow' },
   { id: 'mkt-hihat-2', name: 'Closed Hat', type: 'marketplace', author: 'DrumMachine', patternStyle: 'bg-gradient-to-tl from-yellow-400/20 to-orange-500/20 animate-gradient-xy-slow' },
   { id: 'mkt-bass-3', name: 'Upright Bass', type: 'marketplace', author: 'Jazz Trio', patternStyle: 'bg-gradient-to-tl from-indigo-500/20 to-violet-600/20 animate-gradient-xy-slow' },

];
