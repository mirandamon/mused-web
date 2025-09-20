import { Pad } from '@/lib/types';

export const GRID_SIZE = 16;

export function createEmptyPads(): Pad[] {
  return Array.from({ length: GRID_SIZE }, (_, index) => ({
    id: index,
    sounds: [],
    isActive: false,
    currentSoundIndex: 0,
  }));
}
