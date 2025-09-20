import { useQuery } from '@tanstack/react-query';

import { fetchFragmentById, fetchFragments } from '@/lib/api';
import type { Fragment } from '@/lib/types';

export function useFragments() {
  return useQuery<Fragment[]>({
    queryKey: ['fragments'],
    queryFn: fetchFragments,
    staleTime: 1000 * 60 * 2,
  });
}

export function useFragment(fragmentId: string | undefined) {
  return useQuery<Fragment>({
    queryKey: ['fragment', fragmentId],
    queryFn: () => {
      if (!fragmentId) {
        throw new Error('Missing fragment id');
      }
      return fetchFragmentById(fragmentId);
    },
    enabled: Boolean(fragmentId),
  });
}
