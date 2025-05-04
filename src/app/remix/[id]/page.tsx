// src/app/remix/[id]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import FragmentEditor, { getOrAssignSoundColor } from '@/components/fragments/fragment-editor'; // Import the helper
import { placeholderFragments } from '@/lib/placeholder-data'; // Use placeholder data
import { useEffect, useState, useCallback } from 'react';
import type { Fragment, Pad, PadSound } from '@/lib/types'; // Import Pad type
import { Skeleton } from '@/components/ui/skeleton';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase/clientApp'; // Import client storage instance
import { useToast } from "@/hooks/use-toast"; // Import useToast

// Define a palette of Tailwind background color classes
const colorPalette: string[] = [
  'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
  'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
  'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
  'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
  'bg-rose-500',
  'bg-red-600', 'bg-orange-600', 'bg-blue-600', 'bg-green-600', 'bg-purple-600',
];

// Declare global color management variables (ensure they are initialized)
let globalSoundColorMap = typeof window !== 'undefined' ? (window as any).globalSoundColorMap || new Map<string, string>() : new Map<string, string>();
let globalAvailableColorsPool = typeof window !== 'undefined' ? (window as any).globalAvailableColorsPool || [...colorPalette] : [...colorPalette];

// Assign to window object if running in browser for persistence across loads
if (typeof window !== 'undefined') {
  (window as any).globalSoundColorMap = globalSoundColorMap;
  (window as any).globalAvailableColorsPool = globalAvailableColorsPool;
}

export default function RemixFragmentPage() {
  const params = useParams();
  const fragmentId = params.id as string;
  const [originalFragment, setOriginalFragment] = useState<Fragment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast(); // Get toast function

  // Clear color map on initial load of remix page to ensure fresh state
  useEffect(() => {
     if (typeof window !== 'undefined') {
        // Clear the global map when starting a remix
        globalSoundColorMap = new Map<string, string>();
        globalAvailableColorsPool = [...colorPalette]; // Reset pool too
        // Update window object
        (window as any).globalSoundColorMap = globalSoundColorMap;
        (window as any).globalAvailableColorsPool = globalAvailableColorsPool;
        console.log("Remix Page: Cleared global color map.");
     }
     // This effect should run only once when the component mounts
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

    /**
     * Asynchronously resolves a gs:// URL or path to an HTTPS download URL.
     * @param gsOrPath The gs:// URL or storage path.
     * @returns Promise resolving to the HTTPS URL or null if resolution fails.
     */
    const resolveGsUrlToDownloadUrl = useCallback(async (gsOrPath: string): Promise<string | null> => {
      if (!gsOrPath || !gsOrPath.startsWith('gs://')) {
        console.warn(`Remix resolveGsUrl: Path is not gs:// URL: ${gsOrPath}`);
        return null;
      }
      try {
        const storageRef = ref(storage, gsOrPath);
        const downloadUrl = await getDownloadURL(storageRef);
        console.log(`Remix Resolved ${gsOrPath} to ${downloadUrl}`);
        return downloadUrl;
      } catch (error) {
        console.error(`Remix Failed to get download URL for ${gsOrPath}:`, error);
        setTimeout(() => {
           toast({
             variant: "destructive",
             title: "URL Resolution Error",
             description: `Could not get playable URL for ${gsOrPath.split('/').pop() || 'sound'}.`,
           });
        }, 0);
        return null;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toast]); // Depend on toast

  useEffect(() => {
    const fetchAndProcessFragment = async () => {
      setLoading(true);
      setError(null);
      // Color map is cleared in the initial useEffect

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
            .map(async (s): Promise<PadSound | null> => { // Allow null return
              let playableUrl = s.downloadUrl; // Prioritize existing downloadUrl
              const originalSourceUrl = s.soundUrl; // Keep gs:// or potentially invalid relative path

              // **Resolve gs:// URL if necessary**
              if (!playableUrl && originalSourceUrl && originalSourceUrl.startsWith('gs://')) {
                  console.log(`Remix Load: Resolving gs:// URL: ${originalSourceUrl}`);
                  playableUrl = await resolveGsUrlToDownloadUrl(originalSourceUrl);
                  if (!playableUrl) {
                    console.warn(`Remix Load: Failed to resolve gs:// URL ${originalSourceUrl}. Sound may not play.`);
                    // Keep playableUrl as null/undefined
                  }
              } else if (!playableUrl && originalSourceUrl && originalSourceUrl.startsWith('/')) {
                   // Handle legacy relative paths (potential presets) - These likely won't work anymore
                   console.warn(`Remix Load: Found relative path ${originalSourceUrl} for potentially removed preset. Attempting to use.`);
                   playableUrl = originalSourceUrl; // Use relative path (might 404)
              }

              if (!playableUrl) {
                console.warn(`Remix Load: Sound ${s.soundName || s.soundId} missing valid playable URL. Original: ${originalSourceUrl}`);
                 // Option: Skip sounds that cannot be resolved or played
                 // return null;
              }

              // Assign color on the client side *during* processing
              const assignedColor = getOrAssignSoundColor(s.soundId);

              return {
                soundId: s.soundId,
                soundName: s.soundName || 'Unknown Sound',
                soundUrl: originalSourceUrl, // Keep original path
                downloadUrl: playableUrl,   // Store the *resolved* or original valid URL
                // Infer source based on URL or assume 'uploaded' if gs://
                source: s.source || (originalSourceUrl?.startsWith('gs://') ? 'uploaded' : 'marketplace'),
                color: assignedColor,
              };
            });

          const processedSounds = (await Promise.all(processedSoundsPromises)).filter(s => s !== null) as PadSound[]; // Filter out nulls

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fragmentId, resolveGsUrlToDownloadUrl]); // Add resolver as dependency

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
