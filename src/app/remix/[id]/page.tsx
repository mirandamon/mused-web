// src/app/remix/[id]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import FragmentEditor, { getOrAssignSoundColor } from '@/components/fragments/fragment-editor'; // Import the helper
import { placeholderFragments } from '@/lib/placeholder-data'; // Use placeholder data
import { useEffect, useState } from 'react';
import type { Fragment, Pad, PadSound } from '@/lib/types'; // Import Pad type
import { Skeleton } from '@/components/ui/skeleton';

export default function RemixFragmentPage() {
  const params = useParams();
  const fragmentId = params.id as string;
  const [originalFragment, setOriginalFragment] = useState<Fragment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFragment = () => {
      // TODO: Replace with actual data fetching logic using fragmentId
      // For now, find the fragment from placeholder data
      const foundFragment = placeholderFragments.find(f => f.id === fragmentId);

      // Process the found fragment's pads to ensure correct structure and playable URLs
      // And assign colors on the client side
      const processedFragment = foundFragment ? {
          ...foundFragment,
          pads: foundFragment.pads.map((pad): Pad => {
              const processedSounds: PadSound[] = (pad.sounds || [])
                  .filter(s => s.soundId) // Ensure soundId exists
                  .map(s => {
                      // Prioritize downloadUrl if it's a valid HTTPS URL or relative path
                      let playableUrl = (s.downloadUrl && (s.downloadUrl.startsWith('http') || s.downloadUrl.startsWith('/'))) ? s.downloadUrl : undefined;

                      // Fallback for presets: use relative soundUrl if downloadUrl is missing/invalid
                      if (!playableUrl && s.source === 'predefined' && s.soundUrl && s.soundUrl.startsWith('/')) {
                          playableUrl = s.soundUrl;
                      }

                      if (!playableUrl) {
                          console.warn(`Remix Load: Sound ${s.soundName || s.soundId} missing valid playable URL.`);
                      }

                      return {
                          soundId: s.soundId,
                          soundName: s.soundName || 'Unknown Sound',
                          soundUrl: s.soundUrl, // Keep original path (gs:// or relative)
                          downloadUrl: playableUrl, // Store the *validated* playable URL
                          source: s.source,
                          // Assign color on the client side
                          color: getOrAssignSoundColor(s.soundId),
                      };
                  });

              return {
                  id: pad.id,
                  sounds: processedSounds,
                  isActive: pad.isActive,
                  currentSoundIndex: pad.currentSoundIndex ?? 0, // Ensure currentSoundIndex is initialized
              };
          })
      } : null;


      setOriginalFragment(processedFragment);
      setLoading(false);
    };

    if (fragmentId) {
      // Simulate network delay for loading state
      setLoading(true);
      // Clear existing color map before processing new fragment
      // This might need a more robust solution if colors should persist across remixes
      // but for now, ensures fresh assignment per remix load.
      if (typeof window !== 'undefined') {
         // Accessing client-side map directly - consider moving map management if needed elsewhere
         // This assumes fragment-editor's map is accessible or recreated here.
         // A cleaner approach might involve a shared state or context for colors.
         // For now, relying on re-initialization within getOrAssignSoundColor potentially.
      }
      const timer = setTimeout(fetchFragment, 500); // Simulate 500ms loading
      return () => clearTimeout(timer);
    } else {
       setLoading(false); // No fragmentId, stop loading
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

