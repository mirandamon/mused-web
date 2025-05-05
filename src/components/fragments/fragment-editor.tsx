// src/components/fragments/fragment-editor.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Music2, Mic, Upload, Check, Play, Pause, Layers, Volume2, VolumeX, Plus, Minus } from 'lucide-react'; // Added Volume, Plus, Minus icons
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import SoundSelectionSheetWrapper from './sound-selection-sheet'; // Updated import
import type { Pad, PadSound, Sound } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ref, getDownloadURL } from "firebase/storage"; // Correct Firebase Storage imports
import { storage } from "@/lib/firebase/clientApp"; // Import storage instance
import { Slider } from "@/components/ui/slider"; // Import Slider

// --- Expanded Color Palette ---
// Added more shades and distinct colors
const colorPalette: string[] = [
  // Reds
  'bg-red-500', 'bg-red-600',
  // Oranges
  'bg-orange-500', 'bg-orange-600',
  // Ambers
  'bg-amber-500', 'bg-amber-600',
  // Yellows
  'bg-yellow-500', 'bg-yellow-600',
  // Limes
  'bg-lime-500', 'bg-lime-600',
  // Greens
  'bg-green-500', 'bg-green-600',
  // Emeralds
  'bg-emerald-500', 'bg-emerald-600',
  // Teals
  'bg-teal-500', 'bg-teal-600',
  // Cyans
  'bg-cyan-500', 'bg-cyan-600',
  // Skys
  'bg-sky-500', 'bg-sky-600',
  // Blues
  'bg-blue-500', 'bg-blue-600',
  // Indigos
  'bg-indigo-500', 'bg-indigo-600',
  // Violets
  'bg-violet-500', 'bg-violet-600',
  // Purples
  'bg-purple-500', 'bg-purple-600',
  // Fuchsias
  'bg-fuchsia-500', 'bg-fuchsia-600',
  // Pinks
  'bg-pink-500', 'bg-pink-600',
  // Roses
  'bg-rose-500', 'bg-rose-600',
];

interface FragmentEditorProps {
  initialPads?: Pad[];
  originalAuthor?: string;
  originalFragmentId?: string;
}

// Updated defaultPads to match new Pad structure
const defaultPads: Pad[] = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  sounds: [], // Start with an empty array of sounds
  isActive: false, // Default to inactive
  currentSoundIndex: 0, // Initialize index
}));

// --- Client-side Color Management ---
// Check if running in a browser environment before accessing window
const isBrowser = typeof window !== 'undefined';

// Initialize global maps safely
let globalSoundColorMap = isBrowser ? (window as any).__globalSoundColorMap || new Map<string, string>() : new Map<string, string>();

// Assign to window object if running in browser for persistence across loads/renders
if (isBrowser) {
  (window as any).__globalSoundColorMap = globalSoundColorMap;
  // No need to store the available pool globally, derive it when needed
}


// Helper function to get a unique color for a new sound ID
const getUniqueRandomColor = (): string => {
    if (!isBrowser) return 'bg-muted'; // Should not be called server-side

    const assignedColors = new Set(globalSoundColorMap.values());
    const availableColors = colorPalette.filter(color => !assignedColors.has(color));

    if (availableColors.length > 0) {
        // Pick randomly from the available unique colors
        const randomIndex = Math.floor(Math.random() * availableColors.length);
        // console.log(`Assigning unique color: ${availableColors[randomIndex]}`);
        return availableColors[randomIndex];
    } else {
        // Fallback: All unique colors are used, reuse randomly from the full palette
        console.warn("Unique color palette exhausted, reusing colors.");
        const randomIndex = Math.floor(Math.random() * colorPalette.length);
        return colorPalette[randomIndex];
    }
};

// Helper to get or assign a consistent (and unique if new) color for a sound ID
// MUST BE CALLED ON THE CLIENT SIDE (e.g., within useEffect or event handlers)
export const getOrAssignSoundColor = (soundId: string): string => {
    if (!isBrowser) {
        // This function should not be called on the server.
        console.warn("Attempted to call getOrAssignSoundColor on the server.");
        return 'bg-muted'; // Default color
    }

    // Ensure global map is up-to-date from window object
    globalSoundColorMap = (window as any).__globalSoundColorMap || globalSoundColorMap;

    if (globalSoundColorMap.has(soundId)) {
        return globalSoundColorMap.get(soundId)!; // Return existing color
    } else {
        // Assign a new *unique* color
        const newColor = getUniqueRandomColor(); // Use the updated helper
        globalSoundColorMap.set(soundId, newColor); // Store the assignment globally

        // Update window object
        (window as any).__globalSoundColorMap = globalSoundColorMap;

        console.log(`Assigned color ${newColor} to new sound ${soundId}`);
        return newColor;
    }
};


export default function FragmentEditor({ initialPads: rawInitialPads, originalAuthor, originalFragmentId }: FragmentEditorProps) {
  const [pads, setPads] = useState<Pad[]>(defaultPads);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedPadId, setSelectedPadId] = useState<number | null>(null);
  const [currentSelectedPadData, setCurrentSelectedPadData] = useState<Pad | null>(null);
  const [isSoundSheetOpen, setIsSoundSheetOpen] = useState(false);
  const { toast } = useToast();
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartTimeRef = useRef<number>(0);
  const touchStartXRef = useRef<number>(0); // For swipe detection
  const currentSwipingPadIdRef = useRef<number | null>(null); // Track which pad is being swiped
  const swipeHandledRef = useRef<boolean>(false); // Flag to prevent click after swipe

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState<number | null>(null);
  const [bpm, setBpm] = useState<number>(120);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- Web Audio API State ---
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBuffersRef = useRef<{ [url: string]: AudioBuffer }>({}); // Cache decoded audio buffers
  const isAudioContextInitialized = useRef(false);
  const [isMuted, setIsMuted] = useState(false); // Mute state
  const gainNodeRef = useRef<GainNode | null>(null); // Gain node for volume control

  const LONG_PRESS_DURATION = 500; // milliseconds
  const SWIPE_THRESHOLD = 30; // Reduced threshold for better sensitivity

   // Initialize Audio Context safely on the client
   useEffect(() => {
       if (isBrowser && !isAudioContextInitialized.current) {
           try {
               audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
               gainNodeRef.current = audioContextRef.current.createGain();
               gainNodeRef.current.connect(audioContextRef.current.destination);
               isAudioContextInitialized.current = true;
               console.log("AudioContext initialized.");
           } catch (e) {
               console.error("Web Audio API is not supported in this browser.", e);
               // Use setTimeout to avoid state update during render error
               setTimeout(() => {
                 toast({
                     variant: "destructive",
                     title: "Audio Error",
                     description: "Your browser doesn't support the necessary audio features.",
                 });
               }, 0);
           }
       }
       // Ensure cleanup on unmount
       return () => {
           if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
               audioContextRef.current.close().catch(console.error);
               isAudioContextInitialized.current = false;
               console.log("AudioContext closed.");
           }
       };
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []); // Run only once on mount

    /**
     * Asynchronously resolves a gs:// URL or path to an HTTPS download URL.
     * Uses ref() and getDownloadURL() from firebase/storage.
     * @param gsOrPath The gs:// URL or storage path.
     * @returns Promise resolving to the HTTPS URL or null if resolution fails.
     */
    const resolveGsUrlToDownloadUrl = useCallback(async (gsOrPath: string): Promise<string | null> => {
        if (!gsOrPath) {
          console.warn(`resolveGsUrlToDownloadUrl: Provided path is empty.`);
          return null;
        }

        // Check if it's already an HTTPS URL
        if (gsOrPath.startsWith('https://')) {
          // console.log(`resolveGsUrlToDownloadUrl: Path is already HTTPS: ${gsOrPath}`);
          return gsOrPath;
        }

        // Check if it's a gs:// URL
        if (!gsOrPath.startsWith('gs://')) {
           console.warn(`resolveGsUrlToDownloadUrl: Provided path is not a gs:// URL: ${gsOrPath}`);
           return null; // Only resolve gs:// URLs for now
        }

        try {
          const storageRef = ref(storage, gsOrPath); // ref() handles gs:// URL
          const downloadUrl = await getDownloadURL(storageRef);
          console.log(`Resolved ${gsOrPath} to ${downloadUrl}`);
          return downloadUrl;
        } catch (error: any) {
          console.error(`Failed to get download URL for ${gsOrPath}:`, error.code, error.message);
          // Use setTimeout to avoid calling toast during render phase
          setTimeout(() => {
             toast({
               variant: "destructive",
               title: "URL Resolution Error",
               description: `Could not get playable URL for ${gsOrPath.split('/').pop() || 'sound'}. Check storage permissions.`,
             });
          }, 0);
          return null; // Return null on failure
        }
     // eslint-disable-next-line react-hooks/exhaustive-deps
     }, [toast]); // Depend on toast

   const loadAudio = useCallback(async (originalUrl: string, downloadUrl?: string): Promise<AudioBuffer | null> => {
       if (!audioContextRef.current) {
         console.warn("loadAudio: Audio context not ready.");
         return null;
       }

       // **Determine the URL to fetch:** Prioritize provided downloadUrl, resolve originalUrl if needed.
       let fetchUrl = downloadUrl; // Start with the potentially already resolved URL

       // If no downloadUrl provided or it's invalid, and originalUrl exists and is gs://, try resolving it.
       if ((!fetchUrl || !fetchUrl.startsWith('http')) && originalUrl && originalUrl.startsWith('gs://')) {
           console.log(`loadAudio: Resolving gs:// URL: ${originalUrl}`);
           fetchUrl = await resolveGsUrlToDownloadUrl(originalUrl); // Await the resolution
           if (!fetchUrl) {
               console.error(`loadAudio: Failed to resolve gs:// URL ${originalUrl}. Cannot load audio.`);
               return null; // Stop if resolution failed
           }
       } else if ((!fetchUrl || !fetchUrl.startsWith('http')) && originalUrl) {
           // Handle cases where originalUrl might be a relative path (legacy presets, now likely invalid) or other format
           console.warn(`loadAudio: URL is not gs:// and not already a valid HTTPS URL. Attempting to use as-is: ${originalUrl}`);
           // If it's relative, prepend origin (though presets are gone, this logic might catch edge cases)
           if (originalUrl.startsWith('/') && typeof window !== 'undefined') {
                fetchUrl = window.location.origin + originalUrl;
           } else {
                fetchUrl = originalUrl; // Use as-is, might fail
           }
           // If still not HTTP(S), error out
            if (!fetchUrl || !fetchUrl.startsWith('http')) {
                console.error(`loadAudio: Invalid or non-HTTP(S) URL provided or resolved: ${fetchUrl || originalUrl}`);
                setTimeout(() => {
                  toast({
                      variant: "destructive",
                      title: "Audio Load Error",
                      description: `Cannot load sound from invalid URL: ${fetchUrl || originalUrl}`,
                  });
                }, 0);
               return null;
            }
       } else if (!fetchUrl || !fetchUrl.startsWith('http')) {
           // If after all checks, fetchUrl is still invalid, log error and exit.
           console.error(`loadAudio: Invalid or non-HTTP(S) URL provided: ${fetchUrl || originalUrl}`);
            setTimeout(() => {
              toast({
                  variant: "destructive",
                  title: "Audio Load Error",
                  description: `Cannot load sound from invalid URL: ${fetchUrl || originalUrl}`,
              });
            }, 0);
           return null;
       }

       // **Check Cache:** Use the RESOLVED fetchUrl as the primary cache key.
       const cacheKey = fetchUrl; // Use the final URL to fetch as the cache key
       if (audioBuffersRef.current[cacheKey]) {
         // console.log(`loadAudio: Returning cached buffer for ${cacheKey}`);
         return audioBuffersRef.current[cacheKey];
       }

       // **Fetch and Decode Audio:**
       console.log(`loadAudio: Attempting to fetch audio from: ${fetchUrl}`);
       try {
         const response = await fetch(fetchUrl);
         if (!response.ok) {
           console.error(`loadAudio: HTTP error! status: ${response.status} for URL ${fetchUrl}`);
           // Handle specific errors like 404 or 403 (permissions)
           if (response.status === 403) {
               console.warn(`loadAudio: Permission denied for ${fetchUrl}. Check Storage rules.`);
           } else if (response.status === 404) {
               console.warn(`loadAudio: Sound file not found at ${fetchUrl}.`);
           }
           return null; // Don't throw, just return null on fetch error
         }
         const arrayBuffer = await response.arrayBuffer();
         const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

         // **Cache the buffer:** Use the RESOLVED fetchUrl as the key.
         audioBuffersRef.current[cacheKey] = audioBuffer;

         console.log(`loadAudio: Audio loaded and decoded successfully: ${cacheKey}`);
         return audioBuffer;
       } catch (error: any) {
         console.error(`loadAudio: Error loading or decoding audio file ${originalUrl} (fetching from ${fetchUrl}):`, error);
         setTimeout(() => {
           toast({
             variant: "destructive",
             title: "Audio Load Error",
             description: `Could not load sound: ${originalUrl.split('/').pop()?.split('?')[0] || 'Unknown'}. ${error.message}`,
           });
         }, 0);
         return null;
       }
     // eslint-disable-next-line react-hooks/exhaustive-deps
     }, [resolveGsUrlToDownloadUrl, toast]); // Dependencies: context and the resolver function


   // Initialize pads and assign colors on the client side
   useEffect(() => {
       // Initialize window objects if they don't exist
       if (isBrowser) {
           if (!(window as any).__globalSoundColorMap) {
               (window as any).__globalSoundColorMap = new Map<string, string>();
           }
           // Assign the global ref from the window object
           globalSoundColorMap = (window as any).__globalSoundColorMap;
       }

       // Function to process pads and sounds
       const processPadsAsync = async () => {
            const padsToProcess = rawInitialPads || defaultPads;
            console.log("Processing initial pads:", padsToProcess);

            const processedPadsPromises = padsToProcess.map(async (rawPad): Promise<Pad> => {
                const processedSoundsPromises = (rawPad.sounds || [])
                    .filter(ps => ps.soundId) // Ensure soundId exists
                    .map(async (padSound): Promise<PadSound | null> => {
                        // Assign color here, on the client, using the global helper
                        const assignedColor = getOrAssignSoundColor(padSound.soundId!);

                        // Determine playable URL: Prioritize existing downloadUrl, then resolve soundUrl
                        let playableUrl = padSound.downloadUrl;
                        const originalSourceUrl = padSound.soundUrl; // Could be gs:// or other path

                        // **Resolve URL if necessary**
                        if (!playableUrl && originalSourceUrl) {
                             console.log(`Initial Pad Load: Resolving URL: ${originalSourceUrl}`);
                             playableUrl = await resolveGsUrlToDownloadUrl(originalSourceUrl);
                             if (!playableUrl) {
                                 console.warn(`Initial Pad Load: Failed to resolve URL ${originalSourceUrl}. Sound may not play.`);
                                 // Keep playableUrl as null/undefined
                             }
                        }

                        if (!playableUrl) {
                           console.warn(`Initial Pad Load: Sound ${padSound.soundName || padSound.soundId} missing valid playable URL. Original: ${originalSourceUrl}`);
                        } else {
                           // Preload audio using the resolved URL
                           // Pass originalSourceUrl as the first argument for potential caching key, and playableUrl as the second
                           loadAudio(originalSourceUrl || playableUrl, playableUrl);
                        }

                        return {
                            ...padSound,
                            soundName: padSound.soundName || 'Unknown', // Keep existing name or default
                            soundUrl: originalSourceUrl, // Keep original gs:// or relative path
                            downloadUrl: playableUrl,    // Store the *resolved* or original valid URL
                            color: assignedColor,      // Apply consistent color
                            source: padSound.source || (originalSourceUrl?.startsWith('gs://') ? 'uploaded' : 'predefined'), // Infer source if missing
                        };
                    });

                const processedSounds = (await Promise.all(processedSoundsPromises)).filter(s => s !== null) as PadSound[];

                return {
                    ...rawPad,
                    sounds: processedSounds,
                    isActive: rawPad.isActive || processedSounds.length > 0,
                    currentSoundIndex: rawPad.currentSoundIndex ?? 0,
                };
            });

            const finalPads = await Promise.all(processedPadsPromises);
            console.log("Finished processing initial pads:", finalPads);
            setPads(finalPads);
        };

        // Only run processing if rawInitialPads exists or it's the initial mount
        // Ensure color map is handled correctly based on context (new vs remix)
         if (rawInitialPads) {
            console.log("Processing rawInitialPads (remix/load).");
            processPadsAsync();
         } else if (pads === defaultPads) { // Only reset/process if pads are still default (fresh load)
             if (isBrowser) {
                 (window as any).__globalSoundColorMap = new Map<string, string>();
                 globalSoundColorMap = (window as any).__globalSoundColorMap;
                 console.log("Color map reset for new fragment.");
             }
             // Set default pads immediately, no async processing needed for empty sounds
             setPads(defaultPads);
         }

   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [rawInitialPads, resolveGsUrlToDownloadUrl, loadAudio]); // Include resolvers/loaders


   // Preload sounds when pads data changes (ensure URLs are resolved)
   // This might be redundant if initial load covers it, but good for dynamic changes.
   useEffect(() => {
       pads.forEach(pad => {
           pad.sounds.forEach(sound => {
               // Use the resolved downloadUrl if available, otherwise load needs to handle original url
               const urlToLoad = sound.downloadUrl || sound.soundUrl;
               if (urlToLoad) {
                  // Pass original soundUrl for cache key, downloadUrl for fetching
                  loadAudio(sound.soundUrl || urlToLoad, sound.downloadUrl);
               } else {
                  console.warn(`Editor Pad ${pad.id}, Sound ${sound.soundName}: Missing any URL (downloadUrl/soundUrl) for preloading.`);
               }
           });
       });
   }, [pads, loadAudio]);


     const playSound = useCallback((buffer: AudioBuffer) => {
       if (!audioContextRef.current || !gainNodeRef.current || isMuted) return;

       // Resume context if suspended (required by browser policy)
       if (audioContextRef.current.state === 'suspended') {
           audioContextRef.current.resume();
       }

       const source = audioContextRef.current.createBufferSource();
       source.buffer = buffer;
       source.connect(gainNodeRef.current); // Connect to gain node instead of destination
       source.start(0);
   }, [isMuted]); // Depend on isMuted state

   const handleToggleMute = () => {
       setIsMuted(prevMuted => {
           const newMuted = !prevMuted;
           if (gainNodeRef.current && audioContextRef.current) {
               // Use exponential ramp for smoother transition
               gainNodeRef.current.gain.exponentialRampToValueAtTime(
                   newMuted ? 0.0001 : 1.0, // Target near zero for mute
                   audioContextRef.current.currentTime + 0.1 // Ramp over 0.1 seconds
               );
               console.log(newMuted ? "Audio Muted" : "Audio Unmuted");
           }
           return newMuted;
       });
   };


  const handlePadMouseDown = (id: number) => {
     touchStartTimeRef.current = Date.now();
     swipeHandledRef.current = false; // Reset swipe flag on new press
     longPressTimerRef.current = setTimeout(() => {
      // Long press detected
      swipeHandledRef.current = true; // Prevent click/swipe after long press ends
      setSelectedPadId(id);
      setIsSoundSheetOpen(true);
      longPressTimerRef.current = null;
      // Clear touch start refs to prevent accidental swipe/click after sheet opens
      touchStartXRef.current = 0;
      currentSwipingPadIdRef.current = null;
    }, LONG_PRESS_DURATION);
  };

   const handlePadMouseUp = (id: number) => {
    if (longPressTimerRef.current) {
      // If timer is still running, it's a short press (potential click)
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;

      const pressDuration = Date.now() - touchStartTimeRef.current;
      // Check if it wasn't a swipe AND was shorter than long press duration
      if (!swipeHandledRef.current && pressDuration < LONG_PRESS_DURATION) {
          // Short press action: Play sound if pad is active
          const pad = pads.find(p => p.id === id);
           if (pad?.isActive && pad.sounds.length > 0) {
               const soundToPlay = pad.sounds[pad.currentSoundIndex ?? 0];
               // *** Use resolved downloadUrl first for playing ***
               const urlToUse = soundToPlay?.downloadUrl; // Get the resolved URL

               if (urlToUse && urlToUse.startsWith('http')) {
                    const cacheKey = urlToUse; // Use resolved URL as cache key
                    const buffer = audioBuffersRef.current[cacheKey]; // Check cache using HTTPS URL
                    if (buffer) {
                       playSound(buffer);
                   } else {
                       console.warn(`Buffer for ${urlToUse} not found, attempting load...`);
                       // Pass original soundUrl for cache key, urlToUse (HTTPS) for fetching
                       loadAudio(soundToPlay.soundUrl || urlToUse, urlToUse).then(loadedBuffer => {
                           if (loadedBuffer) playSound(loadedBuffer);
                           else console.error(`Failed to load buffer on demand for ${urlToUse}`);
                       });
                   }
               } else {
                 console.warn(`Pad ${id}: No valid download URL found for sound ${soundToPlay?.soundName}. Original: ${soundToPlay?.soundUrl}`);
               }
           }
      }
    }
     // Reset timing and swipe flags regardless
     touchStartTimeRef.current = 0;
     // Don't reset swipeHandledRef here, let the next mousedown/touchstart do it
  };

   const handlePadTouchStart = (id: number, event: React.TouchEvent<HTMLButtonElement>) => {
      touchStartXRef.current = event.touches[0].clientX;
      currentSwipingPadIdRef.current = id; // Set the pad being touched
      handlePadMouseDown(id); // Also trigger long press logic
   };

   const handlePadTouchEnd = (id: number) => {
     if (longPressTimerRef.current) {
       clearTimeout(longPressTimerRef.current); // Cancel long press if touch ends early
       longPressTimerRef.current = null;
     }

     // If a swipe wasn't handled during touchMove, process potential click on touchEnd
     if (!swipeHandledRef.current) {
        const pressDuration = Date.now() - touchStartTimeRef.current;
        if (pressDuration < LONG_PRESS_DURATION) {
             // Short press action: Play sound if pad is active
             const pad = pads.find(p => p.id === id);
              if (pad?.isActive && pad.sounds.length > 0) {
                  const soundToPlay = pad.sounds[pad.currentSoundIndex ?? 0];
                  // *** Use resolved downloadUrl first for playing ***
                  const urlToUse = soundToPlay?.downloadUrl;
                  if (urlToUse && urlToUse.startsWith('http')) {
                       const cacheKey = urlToUse; // Use resolved URL as cache key
                       const buffer = audioBuffersRef.current[cacheKey];
                       if (buffer) {
                        playSound(buffer);
                      } else {
                           console.warn(`Buffer for ${urlToUse} not found (touch), attempting load...`);
                           // Pass original soundUrl for cache key, urlToUse (HTTPS) for fetching
                          loadAudio(soundToPlay.soundUrl || urlToUse, urlToUse).then(loadedBuffer => {
                              if (loadedBuffer) playSound(loadedBuffer);
                              else console.error(`Failed to load buffer on demand for ${urlToUse} (touch)`);
                          });
                      }
                  } else {
                     console.warn(`Pad ${id} (touch): No valid download URL found for sound ${soundToPlay?.soundName}. Original: ${soundToPlay?.soundUrl}`);
                  }
              }
        }
     }

     // Reset swipe and timing state AFTER checking for click
     touchStartXRef.current = 0;
     currentSwipingPadIdRef.current = null;
     touchStartTimeRef.current = 0;
     // swipeHandledRef is reset on touchStart/mouseDown
   };


   const handlePadTouchMove = (event: React.TouchEvent<HTMLButtonElement>) => {
     // Ensure we have a starting X and a target pad ID, and haven't already handled a swipe/longpress
     if (!touchStartXRef.current || currentSwipingPadIdRef.current === null || swipeHandledRef.current) {
       return;
     }

     const currentX = event.touches[0].clientX;
     const deltaX = currentX - touchStartXRef.current;
     const padId = currentSwipingPadIdRef.current; // ID of the pad where touch started

     // Check if movement exceeds the threshold
     if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
       // Swipe detected!
       if (longPressTimerRef.current) {
         clearTimeout(longPressTimerRef.current); // Cancel long press timer if swipe starts
         longPressTimerRef.current = null;
       }
       swipeHandledRef.current = true; // Mark swipe as handled for this touch sequence

       setPads(currentPads => {
         return currentPads.map(pad => {
           if (pad.id === padId && pad.sounds.length > 1) {
             // Determine direction: positive deltaX = swipe right (previous sound), negative = swipe left (next sound)
             const direction = deltaX > 0 ? -1 : 1;
             let newIndex = (pad.currentSoundIndex ?? 0) + direction;

             // Handle wrap-around
             if (newIndex < 0) {
               newIndex = pad.sounds.length - 1;
             } else if (newIndex >= pad.sounds.length) {
               newIndex = 0;
             }
             // console.log(`Swipe detected on Pad ${padId}. Direction: ${direction > 0 ? 'Right (Prev)' : 'Left (Next)'}. New Index: ${newIndex}`);
             return { ...pad, currentSoundIndex: newIndex };
           }
           return pad; // Return unchanged pad if it's not the one being swiped or has <= 1 sound
         });
       });

       // Reset the starting X coordinate for the *next* potential swipe within the same touch drag
       // This allows continuous swiping left/right without lifting the finger
       touchStartXRef.current = currentX;
     }
   };


  const handlePadMouseLeave = (id: number) => {
    // If mouse leaves the pad, cancel potential long press and reset swipe state for THIS pad
    if (longPressTimerRef.current && currentSwipingPadIdRef.current === id) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
     // Reset swipe state only if leaving the pad that touch started on
    if(currentSwipingPadIdRef.current === id) {
        touchStartXRef.current = 0;
        currentSwipingPadIdRef.current = null;
        touchStartTimeRef.current = 0;
        swipeHandledRef.current = false; // Reset swipe flag fully when leaving pad
    }
  };

   // Handles selecting or deselecting a sound from the sheet
   const handleToggleSound = useCallback(async (sound: Sound) => {
     if (selectedPadId === null) return;

     let toastMessage = "";
     const padIndex = pads.findIndex(p => p.id === selectedPadId);
     if (padIndex === -1) return; // Pad not found

     const currentPad = pads[padIndex];
     const soundIndexInPad = currentPad.sounds.findIndex(s => s.soundId === sound.id);

     let newSounds: PadSound[];
     let newCurrentIndex = currentPad.currentSoundIndex ?? 0;

     if (soundIndexInPad > -1) {
       // --- Sound exists, remove it ---
       newSounds = currentPad.sounds.filter((_, index) => index !== soundIndexInPad);
       toastMessage = `${sound.name} removed from Pad ${selectedPadId + 1}.`;

       // Adjust currentSoundIndex
       if (newSounds.length === 0) {
         newCurrentIndex = 0;
       } else if (newCurrentIndex >= newSounds.length) {
         newCurrentIndex = newSounds.length - 1;
       }
     } else {
       // --- Sound doesn't exist, add it ---
       const assignedColor = getOrAssignSoundColor(sound.id); // Get consistent color ON CLIENT
       const originalSourceUrl = sound.source_url; // Keep the original path (e.g., gs://)
       // **Resolve URL if necessary before adding**
       let playableUrl = sound.downloadUrl; // Use pre-resolved URL from API first

       if (!playableUrl && originalSourceUrl) {
           console.warn(`Adding sound: Playable URL missing for ${originalSourceUrl}, attempting resolve...`);
           playableUrl = await resolveGsUrlToDownloadUrl(originalSourceUrl); // Await resolution
           if (!playableUrl) {
               // Error toast is handled inside resolveGsUrlToDownloadUrl
               return; // Stop if URL resolution fails
           }
           console.log(`Resolved URL during add: ${playableUrl}`);
       }

       // **Final validation: Ensure we have a valid HTTPS URL**
       // Now playableUrl should contain the resolved URL if it was gs://
       if (!playableUrl || !playableUrl.startsWith('http')) {
           console.error(`Cannot add sound "${sound.name}": Missing or invalid playable URL (requires HTTPS). Found: ${playableUrl}`);
            setTimeout(() => { // Avoid updating state during render
               toast({
                   variant: "destructive",
                   title: "Cannot Add Sound",
                   description: `Sound "${sound.name}" is missing a valid playable URL.`,
               });
           }, 0);
           return; // Stop if no valid playable URL
       }

       const newPadSound: PadSound = {
         soundId: sound.id,
         soundName: sound.name,
         soundUrl: originalSourceUrl, // Store original path (e.g., gs://)
         downloadUrl: playableUrl,    // Store *validated* playable URL
         source: sound.source_type || sound.type, // Use source_type from API or frontend type
         color: assignedColor!,
       };

       newSounds = [...currentPad.sounds, newPadSound];
       newCurrentIndex = newSounds.length - 1; // Focus the newly added sound
       toastMessage = `${sound.name} added to Pad ${selectedPadId + 1}.`;

       // Preload the newly added sound using the validated playable URL
       // Pass original for cache key, playable for fetching
       loadAudio(originalSourceUrl || playableUrl, playableUrl);
     }

     // --- Update the state ---
     const newIsActive = newSounds.length > 0;
     const updatedPad = { ...currentPad, sounds: newSounds, isActive: newIsActive, currentSoundIndex: newCurrentIndex };

     // Update the pads array immutably
     setPads(currentPads => currentPads.map(p => p.id === selectedPadId ? updatedPad : p));

     // Show toast *after* the state update has been queued
     if (toastMessage) {
       setTimeout(() => {
         toast({ title: "Sound Updated", description: toastMessage });
       }, 0);
     }
   }, [selectedPadId, pads, resolveGsUrlToDownloadUrl, loadAudio, toast]);

   // Update currentSelectedPadData whenever selectedPadId or pads change
    useEffect(() => {
        if (selectedPadId !== null) {
        const padData = pads.find(p => p.id === selectedPadId) || null;
        setCurrentSelectedPadData(padData);
        } else {
        setCurrentSelectedPadData(null);
        }
    }, [selectedPadId, pads]);


  const handleRecordClick = () => {
    setIsRecording(!isRecording);
     // Removed toast message
  };

  const handleUploadClick = () => {
     // User clicks "Sounds" button - opens the sheet.
     setIsSoundSheetOpen(true);
     // Toast if no pad is selected via long-press yet
     if (selectedPadId === null) {
         setTimeout(() => {
            toast({
              title: "Select a Pad",
              description: "Long press a pad first to manage its sounds.",
              variant: "default"
            });
         }, 0);
     }
  }

   const handlePostFragment = async () => {
    if (isPlaying) {
        handlePlayPause(); // Stop playback before posting
    }
    const hasSound = pads.some(p => p.sounds.length > 0); // Check if any pad has sounds, regardless of active state
    if (!hasSound) {
        setTimeout(() => {
            toast({
                variant: "destructive",
                title: "Empty Fragment",
                description: "Add at least one sound to a pad before posting.",
            });
        }, 0);
        return;
    }

    console.log("Posting Fragment:", { pads, bpm, originalAuthor, originalFragmentId });

    // TODO: Implement actual saving logic here
    // 1. Prepare data for saving (ensure soundUrl is the original gs:// path or identifier, not the temporary downloadUrl)
    const padsToSave = pads.map(pad => ({
        ...pad,
        sounds: pad.sounds.map(sound => ({
            soundId: sound.soundId,
            soundName: sound.soundName,
            soundUrl: sound.soundUrl, // Save the ORIGINAL gs:// path
            source: sound.source,
            // Color is a UI concern, maybe don't save it, or save assigned color ID?
        })),
        // Ensure currentSoundIndex is saved if needed for default state on load
    }));
    const fragmentData = {
        pads: padsToSave,
        bpm,
        author: "CurrentUser", // Replace with actual auth user ID/name
        timestamp: new Date(), // Use server timestamp in real implementation
        ...(originalFragmentId && { originalFragmentId, originalAuthor }), // Add remix info if applicable
        // Add title if you have an input for it
    };

    console.log("Data to save:", fragmentData);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Show success toast after simulated post
    setTimeout(() => {
        toast({
          title: "Fragment Posted!",
          description: originalFragmentId ? `Your remix of ${originalAuthor}'s fragment is live.` : "Your new fragment is live.",
          action: (
             <Button variant="outline" size="sm" onClick={() => window.location.href = '/'}>
                View Feed
             </Button>
          ),
        });
    }, 0);
  };

  // --- Playback Logic ---

  const stopPlayback = useCallback(() => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
    setIsPlaying(false);
    setCurrentBeat(null);
  }, []);

  const startPlayback = useCallback(() => {
     if (!audioContextRef.current) {
        console.error("Editor: Audio context not initialized for playback.");
        return;
     }
      // Resume context if suspended (required by browser policy on user interaction)
      if (audioContextRef.current.state === 'suspended') {
           audioContextRef.current.resume();
      }

    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
    }
    setIsPlaying(true);
    setCurrentBeat(0); // Start from the first beat

      const beatDuration = (60 / bpm) * 1000; // Calculate duration based on BPM

      // Helper function to play all sounds for a given pad index
      const playPadSounds = (padIndex: number) => {
        const padToPlay = pads.find(pad => pad.id === padIndex);
        if (padToPlay?.isActive && padToPlay.sounds.length > 0) {
          // Play ALL sounds assigned to this pad
          padToPlay.sounds.forEach(soundToPlay => {
            const urlToUse = soundToPlay?.downloadUrl; // Use resolved URL
            if (urlToUse && urlToUse.startsWith('http')) {
              const cacheKey = urlToUse; // Use resolved URL as cache key
              const buffer = audioBuffersRef.current[cacheKey];
              if (buffer) {
                playSound(buffer);
              } else {
                console.warn(`Playback: Buffer for ${urlToUse} not found, attempting load...`);
                loadAudio(soundToPlay.soundUrl || urlToUse, urlToUse).then(loadedBuffer => {
                  if (loadedBuffer) playSound(loadedBuffer);
                  else console.error(`Playback: Buffer for ${urlToUse} could not be loaded on demand.`);
                });
              }
            } else {
              console.warn(`Beat: ${padIndex}, Pad ${padToPlay.id}, Sound: ${soundToPlay?.soundName} - No valid download URL. Original: ${soundToPlay?.soundUrl}`);
            }
          });
        } else {
           // console.log(`Not playing beat: ${padIndex}`);
        }
      };

      // Play the first beat immediately
      playPadSounds(0);

      // Start the interval for subsequent beats
      playbackIntervalRef.current = setInterval(() => {
        setCurrentBeat(prevBeat => {
          const nextBeat = (prevBeat !== null ? prevBeat + 1 : 0) % 16; // Loop through 0-15
          playPadSounds(nextBeat); // Play sounds for the next beat's pad
          return nextBeat; // Update the current beat for the next interval
        });
      }, beatDuration);
  }, [bpm, pads, playSound, loadAudio]);


  const handlePlayPause = () => {
    if (isPlaying) {
      stopPlayback();
      // No toast for pausing
    } else {
      startPlayback();
      // No toast for playing
    }
  };


  // Effect to restart or stop playback if bpm or pads change while playing
  useEffect(() => {
    if (isPlaying) {
      startPlayback(); // Restart playback with new settings
    }
    // Cleanup function to stop playback when component unmounts or dependencies change
    return () => stopPlayback();
  }, [isPlaying, bpm, pads, startPlayback, stopPlayback]); // Re-run if isPlaying, bpm, or pads change

   const handleSheetOpenChange = (open: boolean) => {
     setIsSoundSheetOpen(open);
     if (!open) {
       // Deselect pad when sheet closes, unless a long press is ongoing
       if (!longPressTimerRef.current) {
          setSelectedPadId(null);
       }
     }
   };

   // --- BPM Control ---
   const MIN_BPM = 40;
   const MAX_BPM = 240;

   const handleBpmSliderChange = (value: number[]) => {
      setBpm(value[0]);
   };

   const incrementBpm = () => {
      setBpm(prev => Math.min(prev + 1, MAX_BPM));
   }

   const decrementBpm = () => {
      setBpm(prev => Math.max(prev - 1, MIN_BPM));
   }

   // Prevent popover close when clicking +/- buttons
   const handlePopoverInteraction = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
   }


  return (
    <TooltipProvider>
      <Card className="w-full max-w-md shadow-lg rounded-xl overflow-hidden">
        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-4 gap-2 md:gap-3 aspect-square mb-6">
            {pads.map((pad) => {
              const hasSounds = pad.sounds.length > 0;
              // Use isActive toggle state for visual dimming, but color comes from sound
              const isPadUIToggledActive = pad.isActive;
              const currentSoundIndex = pad.currentSoundIndex ?? 0;
              const currentSound = hasSounds ? pad.sounds[currentSoundIndex] : null;              // Use the CONSISTENT color from the CURRENTLY selected sound for the pad background
              // Ensure color exists before applying
              const bgColorClass = currentSound?.color
                ? currentSound.color // Use the sound's assigned color
                : hasSounds ? 'bg-secondary/70' // Pad has sounds but somehow no current sound
                : 'bg-secondary'; // Pad has no sounds

              const borderColorClass = hasSounds ? 'border-transparent' : 'border-border/50';
              // This now checks if the pad is being played during playback, regardless of whether it has any sound assigned to it.
              const isCurrentBeat = isPlaying && currentBeat === pad.id;
              // const isPadUIToggledActive = pad.isActive;
              const row = Math.floor(pad.id / 4);
              const delay = `${row * 100}ms`; // Stagger animation

              // Determine content based on pad state
              const padContent = () => {
                 // --- Dots Indicator for multiple sounds ---
                 const dotsIndicator = pad.sounds.length > 1 && (
                    <div className="absolute top-1.5 left-0 right-0 flex justify-center items-center space-x-1 pointer-events-none z-10">
                       {pad.sounds.map((s, idx) => {
                         // Ensure color exists on the sound object
                         const dotBorderColorClass = s.color ? s.color.replace('bg-', 'border-') : 'border-muted-foreground/50';

                         return (
                           <div
                             key={idx}
                             className={cn(
                               "rounded-full transition-all duration-300 ease-out border", // Always add border base class
                               idx === currentSoundIndex
                                 ? `w-2 h-2 opacity-100 bg-white border-2` // Active dot
                                 : `w-1.5 h-1.5 opacity-60 bg-transparent`, // Inactive dot
                               dotBorderColorClass // Apply the border color class
                             )}
                             style={{
                               transform: idx === currentSoundIndex ? 'scale(1.1)' : 'scale(1)',
                             }}
                           />
                         );
                       })}
                     </div>
                 );

                 // --- Pad State Visuals ---
                 // If no sounds, show placeholder
                 if (!hasSounds) {
                     return <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="w-3 h-3 rounded-full bg-muted-foreground/20"></div></div>;
                 }
                 // If pad has sounds but is toggled off (isActive=false)
                 if (!isPadUIToggledActive) {
                      return (
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-1 pt-5 text-white/50 overflow-hidden w-full h-full pointer-events-none bg-black/30 backdrop-blur-sm rounded-lg">
                             {dotsIndicator}
                             <Pause className="w-[45%] h-[45%] opacity-50 mb-0.5 flex-shrink-0" />
                             <span className="text-xs opacity-70 truncate w-full text-center mt-1">Inactive</span>
                         </div>
                      );
                 }

                 // Pad has sounds and is toggled ON
                 const soundToDisplay = currentSound;
                 if (!soundToDisplay) return null; // Should not happen if hasSounds is true

                 const soundIcon = soundToDisplay.source === 'live' ? Mic : Music2;
                 const soundName = soundToDisplay.soundName;

                 return (
                     <Tooltip delayDuration={300}>
                         <TooltipTrigger asChild>
                             {/* The interactive element for swipe/press is the main button,
                                but the visual content is inside this div */}
                             <div
                                className="absolute inset-0 flex flex-col items-center justify-center p-1 pt-5 text-white/90 overflow-hidden w-full h-full pointer-events-none" // Make non-interactive itself
                             >
                                {dotsIndicator} {/* Render dots above the icon/text */}
                                {/* Icon and Text */}
                                {React.createElement(soundIcon, { className: "w-[45%] h-[45%] opacity-80 mb-0.5 flex-shrink-0" })}
                                <span className="text-xs opacity-90 truncate w-full text-center mt-1">{soundName}</span>
                            </div>
                         </TooltipTrigger>
                         <TooltipContent side="top" className="bg-background text-foreground">
                           {/* Tooltip content shows list if multiple sounds, or just the name */}
                           {pad.sounds.length > 1 ? (
                               <div className='max-w-[150px]'>
                                   <ul className="list-none p-0 m-0 space-y-1 ">
                                       {pad.sounds.map((s, idx) => (
                                           <li key={s.soundId} className={cn("flex items-center", idx === currentSoundIndex ? "font-semibold" : "")}>
                                               {/* Use the sound's own color for the square, ensure color exists */}
                                               <div className={`w-3 h-3 rounded-sm mr-2 shrink-0 ${s.color || 'bg-muted'}`}></div>
                                               <span className="truncate">{s.soundName}</span>
                                           </li>
                                       ))}
                                   </ul>
                                    <p className="text-xs text-muted-foreground mt-1 pt-1 border-t border-border/50">Swipe pad L/R to cycle</p>
                               </div>
                           ) : (
                                <p>{soundName}</p> // Single sound name
                           )}
                         </TooltipContent>
                     </Tooltip>
                 );
              };

              return (
                <button
                  key={pad.id}
                  onMouseDown={() => handlePadMouseDown(pad.id)}
                  onMouseUp={() => handlePadMouseUp(pad.id)}
                  onMouseLeave={() => handlePadMouseLeave(pad.id)}
                  onTouchStart={(e) => handlePadTouchStart(pad.id, e)}
                  onTouchEnd={() => handlePadTouchEnd(pad.id)}
                  onTouchMove={handlePadTouchMove}
                   onClick={() => {
                      // Toggle isActive state on short click IF pad has sounds
                       const pressDuration = Date.now() - touchStartTimeRef.current;
                       if (!swipeHandledRef.current && pressDuration < LONG_PRESS_DURATION && hasSounds) {
                         setPads(currentPads =>
                           currentPads.map(p =>
                             p.id === pad.id ? { ...p, isActive: !p.isActive } : p
                           )
                         );
                         // Removed toast for activation/deactivation
                       }
                    }}
                  className={cn(
                    "relative w-full h-full rounded-lg border-2 transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 active:scale-95 cursor-pointer",
                    "touch-pan-y", // Allow vertical scrolling, disable horizontal panning on pad
                    bgColorClass, // Apply the background color based on the *current* sound
                    borderColorClass,
                    hasSounds ? 'shadow-md' : 'hover:bg-muted hover:border-primary/50', // Shadow if sounds exist
                    selectedPadId === pad.id ? 'ring-2 ring-ring ring-offset-2' : '', // Highlight current selected pad (in long-press)
                    isCurrentBeat && isPadUIToggledActive ? 'ring-4 ring-offset-2 ring-accent shadow-lg scale-105 z-10' : '', // Highlight only if toggled active AND during playback
                    "opacity-0 animate-wave-fall",
                    "overflow-hidden" // Needed for absolute positioned overlays/dots
                  )}
                   style={{ animationDelay: delay }}
                   aria-label={`Pad ${pad.id + 1}. Status: ${
                      hasSounds
                        ? `${isPadUIToggledActive ? 'Active' : 'Inactive'}, ${pad.sounds.length} sound${pad.sounds.length > 1 ? 's' : ''}. Current: ${currentSound?.soundName || 'None'}`
                        : 'No sounds'
                    }. Short press to ${hasSounds ? 'toggle activity' : 'do nothing'}. Long press to manage sounds.${
                      pad.sounds.length > 1 ? ' Swipe left/right to cycle sounds.' : ''
                    }`}
                >
                  {padContent()}
                </button>
              );
            })}
          </div>
           {/* Playback and Sound Controls */}
           <div className="flex justify-between items-center space-x-4 mt-6">
             {/* Left side: Playback controls */}
             <div className="flex items-center space-x-2">
                <Tooltip>
                     <TooltipTrigger asChild>
                         <Button variant="ghost" size="icon" onClick={handleToggleMute} aria-label={isMuted ? "Unmute" : "Mute"}>
                             {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                         </Button>
                     </TooltipTrigger>
                     <TooltipContent>
                         <p>{isMuted ? "Unmute" : "Mute"}</p>
                     </TooltipContent>
                </Tooltip>

               <Tooltip>
                 <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handlePlayPause} aria-label={isPlaying ? "Pause fragment" : "Play fragment"}>
                      {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    </Button>
                 </TooltipTrigger>
                 <TooltipContent>
                   <p>{isPlaying ? "Pause" : "Play"}</p>
                 </TooltipContent>
               </Tooltip>

                {/* BPM Control Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                      <Tooltip>
                          <TooltipTrigger asChild>
                               <Button variant="ghost" className="tabular-nums w-24 justify-start px-2">
                                  {bpm} BPM
                               </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                              <p>Adjust Tempo (BPM)</p>
                          </TooltipContent>
                      </Tooltip>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-4" onOpenAutoFocus={(e) => e.preventDefault()}> {/* Prevent focus steal */}
                      <div className="grid gap-4">
                          <div className="space-y-2">
                              <h4 className="font-medium leading-none">Tempo</h4>
                              <p className="text-sm text-muted-foreground">
                                Adjust the playback speed (beats per minute).
                              </p>
                          </div>
                          <div className="grid gap-2">
                              <div className="flex items-center justify-between">
                                 <Label htmlFor="bpm-slider" className="text-sm font-medium">BPM</Label>
                                 <span className="text-sm font-semibold tabular-nums w-12 text-right">{bpm}</span>
                              </div>
                              <Slider
                                  id="bpm-slider"
                                  min={MIN_BPM}
                                  max={MAX_BPM}
                                  step={1}
                                  value={[bpm]}
                                  onValueChange={handleBpmSliderChange}
                                  className="my-2"
                              />
                              <div className="flex justify-between items-center mt-2">
                                  {/* Use onPointerDownCapture to prevent Popover from closing */}
                                  <Button
                                      variant="outline" size="icon" className="h-8 w-8"
                                      onClick={decrementBpm}
                                      disabled={bpm <= MIN_BPM}
                                      onPointerDownCapture={handlePopoverInteraction} // Changed event
                                  >
                                      <Minus className="h-4 w-4" aria-hidden="true" />
                                      <span className="sr-only">Decrease BPM</span>
                                  </Button>
                                  <Button
                                       variant="outline" size="icon" className="h-8 w-8"
                                       onClick={incrementBpm}
                                       disabled={bpm >= MAX_BPM}
                                       onPointerDownCapture={handlePopoverInteraction} // Changed event
                                  >
                                      <Plus className="h-4 w-4" aria-hidden="true" />
                                       <span className="sr-only">Increase BPM</span>
                                  </Button>
                              </div>
                          </div>
                      </div>
                  </PopoverContent>
                </Popover>

             </div>

             {/* Right side: Sound selection/recording */}
             <div className="flex items-center space-x-2">
                 <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={handleUploadClick}>
                           <Layers className="mr-2 h-4 w-4" />
                           Sounds
                         </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Manage Sounds</p>
                        <p className="text-xs text-muted-foreground">(Long press a pad first)</p>
                    </TooltipContent>
                 </Tooltip>
                 <Tooltip>
                    <TooltipTrigger asChild>
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={handleRecordClick}
                           disabled // Disable live recording until implemented
                         >
                           <Mic className="mr-2 h-4 w-4" />
                           Record
                         </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Live Recording (Coming Soon)</p>
                    </TooltipContent>
                 </Tooltip>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end p-4 border-t mt-4">
          <Button onClick={handlePostFragment} disabled={isPlaying}>
             <Check className="mr-2 h-4 w-4" />
             {originalFragmentId ? 'Post Remix' : 'Post Fragment'}
          </Button>
        </CardFooter>
      </Card>

       {/* Sound Selection Sheet */}
       <SoundSelectionSheetWrapper
         isOpen={isSoundSheetOpen}
         onOpenChange={handleSheetOpenChange}
         onToggleSound={handleToggleSound}
         selectedPadId={selectedPadId}
         currentPadSounds={currentSelectedPadData?.sounds || []}
         // allSounds prop removed - fetched inside the sheet component
       />
     </TooltipProvider>
  );
}
