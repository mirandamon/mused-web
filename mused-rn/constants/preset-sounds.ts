import { Sound } from '@/lib/types';

export const PRESET_SOUNDS: Sound[] = [
  {
    id: 'preset-808-bass',
    name: '808 Bass Drum',
    type: 'preset',
    asset: require('@/assets/sounds/roland-808-bass-drum.wav'),
  },
  {
    id: 'preset-808-snare',
    name: '808 Snare',
    type: 'preset',
    asset: require('@/assets/sounds/roland-808-snare-drum.wav'),
  },
  {
    id: 'preset-808-hihat',
    name: '808 Hi-Hat',
    type: 'preset',
    asset: require('@/assets/sounds/roland-808-hi-hat.wav'),
  },
  {
    id: 'preset-808-clap',
    name: '808 Clap',
    type: 'preset',
    asset: require('@/assets/sounds/roland-808-hand-clap.wav'),
  },
  {
    id: 'preset-808-tom',
    name: '808 Tom',
    type: 'preset',
    asset: require('@/assets/sounds/roland-808-tom-drum.wav'),
  },
];
