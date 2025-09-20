import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { PRESET_SOUNDS } from '@/constants/preset-sounds';
import { fetchSounds } from '@/lib/api';
import type { Sound } from '@/lib/types';

export function useSoundLibrary() {
  const query = useQuery<Sound[]>({
    queryKey: ['sounds'],
    queryFn: fetchSounds,
    staleTime: 1000 * 60 * 5,
  });

  const sounds = useMemo(() => {
    if (query.data) {
      return [...PRESET_SOUNDS, ...query.data];
    }
    return PRESET_SOUNDS;
  }, [query.data]);

  return {
    ...query,
    sounds,
  };
}
