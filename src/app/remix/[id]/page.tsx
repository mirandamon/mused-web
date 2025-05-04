// src/app/remix/[id]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import FragmentEditor, { getOrAssignSoundColor } from '@/components/fragments/fragment-editor'; // Import the helper
import { placeholderFragments } from '@/lib/placeholder-data'; // Use placeholder data
import { useEffect, useState } from 'react';
import type { Fragment, Pad, PadSound } from '@/lib/types'; // Import Pad type
import { Skeleton } from '@/components/ui/skeleton';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase/clientApp'; // Import client storage instance

export default function RemixFragmentPage() {
  const params = useParams();
  const fragmentId = params.id as string;
  const [originalFragment, setOriginalFragment] = useState<Fragment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Clear color map on initial load of remix page to ensure fresh state
  useEffect(() => {
     if (typeof window !== 'undefined') {
        // Clear the global map when starting a remix
        globalSoundColorMap = new Map<string, string>();
        globalAvailableColorsPool = [...colorPalette]; // Reset pool too
        console.log("Remix Page: Cleared global color map.");
     }
     // This effect should run only once when the component mounts
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);


  useEffect(() => {
    const fetchAndProcessFragment = async () => {
      setLoading(true);
      setError(null);
      // Clear existing color map before processing new fragment
      // This is now handled in the initial useEffect, but good to keep in mind
      // if (typeof window !== 'undefined') { globalSoundColorMap = new Map(); }

      try {
        // TODO: Replace with actual data fetching logic using fragmentId
        const foundFragment = placeholderFragments.find(f => f.id === fragmentId);

        if (!foundFragment) {
          setError("Fragment not found.");
          setLoading(false);
          return;
        }

        // Process pads: resolve gs:// URLs and assign colors
        const processedPadsPromises = foundFragment.pads.map(async (pad): Promise<Pad> => {
          const processedSoundsPromises = (pad.sounds || [])
            .filter(s => s.soundId) // Ensure soundId exists
            .map(async (s): Promise<PadSound> => {
              let playableUrl = s.downloadUrl; // Prioritize existing downloadUrl
              const originalSourceUrl = s.soundUrl; // Keep gs:// or relative path

              // If no playable URL and soundUrl is gs://, resolve it
              if (!playableUrl && originalSourceUrl && originalSourceUrl.startsWith('gs://')) {
                try {
                  const storageRef = ref(storage, originalSourceUrl);
                  playableUrl = await getDownloadURL(storageRef);
                  console.log(`Remix Load: Resolved ${originalSourceUrl} to ${playableUrl}`);
                } catch (resolveError) {
                  console.error(`Remix Load: Failed to resolve gs:// URL ${originalSourceUrl}:`, resolveError);
                  // Keep playableUrl as undefined, handle potential playback issues later
                }
              }
               // Fallback for presets if downloadUrl is missing/invalid
               else if (!playableUrl && s.source === 'predefined' && originalSourceUrl && originalSourceUrl.startsWith('/')) {
                   playableUrl = originalSourceUrl; // Use relative path for presets
               }


              if (!playableUrl) {
                console.warn(`Remix Load: Sound ${s.soundName || s.soundId} missing valid playable URL. Original: ${originalSourceUrl}`);
              }

              // Assign color on the client side *during* processing
              const assignedColor = getOrAssignSoundColor(s.soundId);

              return {
                soundId: s.soundId,
                soundName: s.soundName || 'Unknown Sound',
                soundUrl: originalSourceUrl, // Keep original path
                downloadUrl: playableUrl,   // Store the *resolved* or original valid URL
                source: s.source || (originalSourceUrl?.startsWith('gs://') ? 'uploaded' : 'predefined'), // Infer source
                color: assignedColor,
              };
            });

          const processedSounds = await Promise.all(processedSoundsPromises);

          return {
            id: pad.id,
            sounds: processedSounds,
            isActive: pad.isActive || processedSounds.length > 0, // Recalculate isActive based on having sounds
            currentSoundIndex: pad.currentSoundIndex ?? 0,
          };
        });

        const processedPads = await Promise.all(processedPadsPromises);

        setOriginalFragment({
          ...foundFragment,
          pads: processedPads,
        });

      } catch (err: any) {
        console.error("Error fetching or processing fragment:", err);
        setError(err.message || "Failed to load fragment data.");
      } finally {
        setLoading(false);
      }
    };

    if (fragmentId) {
      fetchAndProcessFragment();
    } else {
      setError("No fragment ID specified.");
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

  if (error) {
      return <p className="text-center text-destructive">{error}</p>;
  }

  if (!originalFragment) {
    // This case might happen if fetch completes but fragment is null unexpectedly
    return <p className="text-center text-destructive">Could not load fragment data.</p>;
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

// These need to be declared globally or imported if defined elsewhere
// Assuming they are globally available for simplicity here.
let globalSoundColorMap = new Map<string, string>();
const colorPalette: string[] = [
  'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
  'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
  'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
  'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
  'bg-rose-500',
  'bg-red-600', 'bg-orange-600', 'bg-blue-600', 'bg-green-600', 'bg-purple-600',
];
let globalAvailableColorsPool = [...colorPalette];
