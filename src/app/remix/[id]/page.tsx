// src/app/remix/[id]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import FragmentEditor from '@/components/fragments/fragment-editor';
import { placeholderFragments } from '@/lib/placeholder-data'; // Use placeholder data
import { useEffect, useState } from 'react';
import type { Fragment, Pad } from '@/lib/types'; // Import Pad type
import { Skeleton } from '@/components/ui/skeleton';

export default function RemixFragmentPage() {
  const params = useParams();
  const fragmentId = params.id as string;
  const [originalFragment, setOriginalFragment] = useState<Fragment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFragment = () => {
      // TODO: Replace with actual data fetching logic using fragmentId
      const foundFragment = placeholderFragments.find(f => f.id === fragmentId);

       // Ensure the found fragment's pads conform to the new structure
      // This might involve mapping if the source data isn't already updated
      const processedFragment = foundFragment ? {
          ...foundFragment,
          pads: foundFragment.pads.map((pad): Pad => ({ // Explicitly type the mapped pad
              id: pad.id,
              // Ensure 'sounds' is an array, handle cases where it might be missing
              sounds: Array.isArray(pad.sounds) ? pad.sounds.map(s => ({
                  soundId: s.soundId,
                  soundName: s.soundName || 'Unknown', // Ensure name exists
                  soundUrl: s.soundUrl,
                  source: s.source,
                  color: s.color || '', // Ensure color exists (or handle default assignment)
              })) : [],
              isActive: pad.isActive
          }))
      } : null;


      setOriginalFragment(processedFragment);
      setLoading(false);
    };

    if (fragmentId) {
      const timer = setTimeout(fetchFragment, 500);
      return () => clearTimeout(timer);
    } else {
       setLoading(false);
    }
  }, [fragmentId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center">
        <h1 className="text-3xl font-bold mb-8">Remixing Fragment...</h1>
        <div className="flex flex-col items-center space-y-4 w-full max-w-md">
           <Skeleton className="h-8 w-3/4 mb-4" />
           <div className="grid grid-cols-4 gap-2 w-full aspect-square">
            {Array.from({ length: 16 }).map((_, i) => (
              <Skeleton key={i} className="w-full h-full rounded-lg bg-muted" />
            ))}
          </div>
          <Skeleton className="h-10 w-1/4 mt-4" />
        </div>
      </div>
    );
  }

  if (!originalFragment) {
    return <p className="text-center text-destructive">Fragment not found.</p>;
  }

  return (
    <div className="flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-8">Remixing: {originalFragment.title || `Fragment by ${originalFragment.author}`}</h1>
      {/* Pass the processed pads data */}
      <FragmentEditor
         initialPads={originalFragment.pads}
         originalAuthor={originalFragment.author}
         originalFragmentId={originalFragment.id}
      />
    </div>
  );
}
