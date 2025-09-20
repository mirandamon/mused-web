import { useMemo, useRef } from 'react';

import { SOUND_COLORS } from '@/lib/colors';

export function useSoundColors() {
  const colorMapRef = useRef<Map<string, string>>(new Map());
  const availableRef = useRef(0);

  const assignColor = useMemo(
    () =>
      (soundId: string) => {
        const currentMap = colorMapRef.current;
        if (currentMap.has(soundId)) {
          return currentMap.get(soundId)!;
        }

        const paletteIndex = availableRef.current % SOUND_COLORS.length;
        const nextColor = SOUND_COLORS[paletteIndex];
        availableRef.current += 1;
        currentMap.set(soundId, nextColor);
        return nextColor;
      },
    []
  );

  return assignColor;
}
