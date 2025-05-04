// src/components/fragments/fragment-editor.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Music2, Mic, Upload, Check, Play, Pause, Settings2, Layers, Volume2, VolumeX } from 'lucide-react'; // Added Volume icons
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import SoundSelectionSheetWrapper from './sound-selection-sheet'; // Updated import
import type { Pad, PadSound, Sound } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getStorage, ref, getDownloadURL } from "firebase/storage"; // Correct Firebase Storage imports
import { storage } from "@/lib/firebase/clientApp"; // Import storage instance

// Define a palette of Tailwind background color classes
const colorPalette: string[] = [
  'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
  'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
  'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
  'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
  'bg-rose-500',
  'bg-red-600', 'bg-orange-600', 'bg-blue-600', 'bg-green-600', 'bg-purple-600',
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
// Global map to track assigned colors for sound IDs to ensure consistency
let globalSoundColorMap = new Map<string, string>();
// Global pool of available colors
let globalAvailableColorsPool = [...colorPalette];

// Helper function to get a random color from the palette
const getRandomColor = (): string => {
    if (globalAvailableColorsPool.length === 0) {
        console.warn("Color palette exhausted, reusing colors.");
        // Simple reset, could be improved
        globalAvailableColorsPool = [...colorPalette];
    }
    const randomIndex = Math.floor(Math.random() * globalAvailableColorsPool.length);
    return globalAvailableColorsPool[randomIndex]; // Don't remove, just pick
};

// Helper to get or assign a consistent color for a sound ID
// MUST BE CALLED ON THE CLIENT SIDE (e.g., within useEffect or event handlers)
export const getOrAssignSoundColor = (soundId: string): string => {
    if (typeof window === 'undefined') {
        // This function should not be called on the server.
        // Return a default or handle gracefully if accidentally called.
        console.warn("Attempted to call getOrAssignSoundColor on the server.");
        return 'bg-muted'; // Default color
    }

    // Get map/pool from window if available (to persist across re-renders if needed)
    globalSoundColorMap = (window as any).globalSoundColorMap || globalSoundColorMap;
    globalAvailableColorsPool = (window as any).globalAvailableColorsPool || globalAvailableColorsPool;


    if (globalSoundColorMap.has(soundId)) {
        return globalSoundColorMap.get(soundId)!; // Return existing color
    } else {
        // Assign a new color
        if (globalAvailableColorsPool.length === 0) {
            console.warn("Color palette exhausted, reusing colors.");
            globalAvailableColorsPool = [...colorPalette]; // Reset pool
        }
        // Select a random color but don't remove it from the pool permanently
        const newColor = getRandomColor();
        globalSoundColorMap.set(soundId, newColor); // Store the assignment globally

        // Update window object
        (window as any).globalSoundColorMap = globalSoundColorMap;
        (window as any).globalAvailableColorsPool = globalAvailableColorsPool;

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
       if (typeof window !== 'undefined' && !isAudioContextInitialized.current) {
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
    * @param gsOrPath The gs:// URL or storage path.
    * @returns Promise resolving to the HTTPS URL or null if resolution fails.
    */
   const resolveGsUrlToDownloadUrl = useCallback(async (gsOrPath: string): Promise<string | null> => {
     if (!gsOrPath || !gsOrPath.startsWith('gs://')) {
       console.warn(`resolveGsUrlToDownloadUrl: Provided path is not a gs:// URL: ${gsOrPath}`);
       return null; // Only handle gs:// URLs
     }
     try {
       const storageRef = ref(storage, gsOrPath); // Use ref from firebase/storage
       const downloadUrl = await getDownloadURL(storageRef);
       console.log(`Resolved ${gsOrPath} to ${downloadUrl}`);
       return downloadUrl;
     } catch (error) {
       console.error(`Failed to get download URL for ${gsOrPath}:`, error);
       // Use setTimeout to avoid calling toast during render phase
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
   }, [storage]); // Dependency on storage instance (and toast via setTimeout)

   const loadAudio = useCallback(async (originalUrl: string, downloadUrl?: string): Promise<AudioBuffer | null> => {
       if (!audioContextRef.current) {
         console.warn("loadAudio: Audio context not ready.");
         return null;
       }

       // **Determine the URL to fetch:** Prioritize provided downloadUrl, resolve originalUrl if needed.
       let fetchUrl = downloadUrl; // Start with the potentially already resolved URL

       // If no downloadUrl provided or it's invalid, and originalUrl is gs://, try resolving it.
       if ((!fetchUrl || !fetchUrl.startsWith('http')) && originalUrl && originalUrl.startsWith('gs://')) {
           console.log(`loadAudio: Resolving gs:// URL: ${originalUrl}`);
           fetchUrl = await resolveGsUrlToDownloadUrl(originalUrl);
           if (!fetchUrl) {
               console.error(`loadAudio: Failed to resolve gs:// URL ${originalUrl}. Cannot load audio.`);
               return null; // Stop if resolution failed
           }
       } else if (originalUrl && originalUrl.startsWith('/') && typeof window !== 'undefined') {
           // Handle legacy relative paths (potential presets)
           fetchUrl = window.location.origin + originalUrl;
           console.warn(`loadAudio: Using relative path (potential preset): ${fetchUrl}`);
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
       if (audioBuffersRef.current[fetchUrl]) {
         // console.log(`loadAudio: Returning cached buffer for ${fetchUrl}`);
         return audioBuffersRef.current[fetchUrl];
       }

       // **Fetch and Decode Audio:**
       console.log(`loadAudio: Attempting to fetch audio from: ${fetchUrl}`);
       try {
         const response = await fetch(fetchUrl);
         if (!response.ok) {
           console.error(`loadAudio: HTTP error! status: ${response.status} for URL ${fetchUrl}`);
           // Handle 404 for potentially removed presets
           if (response.status === 404 && originalUrl.startsWith('/')) {
               console.warn(`loadAudio: Preset sound likely removed (${originalUrl}).`);
           }
           return null; // Don't throw, just return null on fetch error
         }
         const arrayBuffer = await response.arrayBuffer();
         const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

         // **Cache the buffer:** Use the RESOLVED fetchUrl as the key.
         audioBuffersRef.current[fetchUrl] = audioBuffer;
         // Optionally, also cache by original gs:// URL if needed, but primary should be HTTPS
         // if (originalUrl && originalUrl !== fetchUrl) {
         //   audioBuffersRef.current[originalUrl] = audioBuffer;
         // }

         console.log(`loadAudio: Audio loaded and decoded successfully: ${fetchUrl}`);
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
     }, [resolveGsUrlToDownloadUrl]); // Dependencies: context and the resolver function

   // Initialize pads and assign colors on the client side
   useEffect(() => {
       // Initialize window objects if they don't exist
       if (typeof window !== 'undefined') {
           if (!(window as any).globalSoundColorMap) {
               (window as any).globalSoundColorMap = new Map<string, string>();
           }
           if (!(window as any).globalAvailableColorsPool) {
               (window as any).globalAvailableColorsPool = [...colorPalette];
           }
           // Assign the global refs from the window object
           globalSoundColorMap = (window as any).globalSoundColorMap;
           globalAvailableColorsPool = (window as any).globalAvailableColorsPool;
       }

       // Function to process pads and sounds
       const processPadsAsync = async () => {
            const processedPadsPromises = (rawInitialPads || defaultPads).map(async (rawPad): Promise<Pad> => {
                const processedSoundsPromises = (rawPad.sounds || [])
                    .filter(ps => ps.soundId) // Ensure soundId exists
                    .map(async (padSound): Promise<PadSound | null> => {
                        // Assign color here, on the client, using the global helper
                        const assignedColor = getOrAssignSoundColor(padSound.soundId!);

                        // Determine playable URL: Prioritize existing downloadUrl, then resolve soundUrl (gs://)
                        let playableUrl = padSound.downloadUrl;
                        const originalSourceUrl = padSound.soundUrl; // Could be gs:// or potentially removed preset path

                        // **Resolve gs:// URL if necessary**
                        if (!playableUrl && originalSourceUrl && originalSourceUrl.startsWith('gs://')) {
                             console.log(`Initial Pad Load: Resolving gs:// URL: ${originalSourceUrl}`);
                             playableUrl = await resolveGsUrlToDownloadUrl(originalSourceUrl);
                             if (!playableUrl) {
                                 console.warn(`Initial Pad Load: Failed to resolve gs:// URL ${originalSourceUrl}. Sound may not play.`);
                                 // Keep playableUrl as null/undefined
                             }
                        } else if (!playableUrl && originalSourceUrl && originalSourceUrl.startsWith('/')) {
                            // Legacy preset path - might be invalid now
                            console.warn(`Initial Pad Load: Found relative path ${originalSourceUrl}. Assuming preset (might be removed). Using path as potential playable URL.`);
                            playableUrl = originalSourceUrl; // Use relative path directly (might 404)
                        }


                        if (!playableUrl) {
                           console.warn(`Initial Pad Load: Sound ${padSound.soundName || padSound.soundId} missing valid playable URL. Original: ${originalSourceUrl}`);
                        } else {
                           // Preload audio using the resolved URL
                           // Use originalSourceUrl as the first argument for potential caching key, and playableUrl as the second
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
            setPads(finalPads);
        };

        // Only run processing if rawInitialPads exists or it's the initial mount
        // And ensure color map is handled correctly based on context (new vs remix)
         if (rawInitialPads) {
            console.log("Preserving color map for remix/initial load.");
            processPadsAsync();
         } else if (pads === defaultPads) { // Only reset/process if pads are still default (fresh load)
             if (typeof window !== 'undefined') {
                 (window as any).globalSoundColorMap = new Map<string, string>();
                 (window as any).globalAvailableColorsPool = [...colorPalette];
                 globalSoundColorMap = (window as any).globalSoundColorMap;
                 globalAvailableColorsPool = (window as any).globalAvailableColorsPool;
                 console.log("Color map reset for new fragment.");
             }
             // Process default pads (will be empty sounds but ensures state structure is correct)
             // No need to await here as default pads have no sounds needing resolution
              setPads(defaultPads);
         }

   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [rawInitialPads]); // Re-run only when rawInitialPads change

   // Preload sounds when pads data changes (ensure URLs are resolved)
   // This might be redundant if initial load covers it, but good for dynamic changes.
   useEffect(() => {
       pads.forEach(pad => {
           pad.sounds.forEach(sound => {
               // Use the resolved downloadUrl if available, otherwise load needs to handle gs://
               const urlToLoad = sound.downloadUrl || sound.soundUrl;
               if (urlToLoad) {
                  // console.log(`Editor Preloading sound: ${sound.soundName} from ${urlToLoad}`);
                  // Pass original soundUrl for potential caching, downloadUrl for fetching
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
                    const buffer = audioBuffersRef.current[urlToUse]; // Check cache using HTTPS URL
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
                 // Optionally, try resolving the original soundUrl again on demand if needed
                 // if (soundToPlay?.soundUrl?.startsWith('gs://')) { ... }
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
                       const buffer = audioBuffersRef.current[urlToUse];
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
   const handleToggleSound = async (sound: Sound) => {
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
       let playableUrl = sound.downloadUrl || sound.previewUrl; // Prefer direct URLs from API
       const originalSourceUrl = sound.source_url; // Keep the original path (likely gs://)

       // **Resolve gs:// URL if necessary before adding**
       if (!playableUrl && originalSourceUrl && originalSourceUrl.startsWith('gs://')) {
           console.warn(`Adding sound: Playable URL missing for ${originalSourceUrl}, attempting resolve...`);
           playableUrl = await resolveGsUrlToDownloadUrl(originalSourceUrl);
           if (!playableUrl) {
               // Error toast is handled inside resolveGsUrlToDownloadUrl
               return; // Stop if URL resolution fails
           }
           console.log(`Resolved gs:// to download URL during add: ${playableUrl}`);
       }

       // **Final validation: Ensure we have a valid HTTPS URL**
       if (!playableUrl || !playableUrl.startsWith('http')) {
           console.error(`Cannot add sound "${sound.name}": Missing or invalid playable URL (requires HTTPS). Original: ${originalSourceUrl}, Resolved Attempt: ${playableUrl}`);
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
   };

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

    playbackIntervalRef.current = setInterval(() => {
      setCurrentBeat(prevBeat => {
        const nextBeat = (prevBeat !== null ? prevBeat + 1 : 0) % 16; // Loop through 0-15
        const padToPlay = pads[nextBeat];

        if (padToPlay?.isActive && padToPlay.sounds.length > 0) {
             const soundToPlay = padToPlay.sounds[padToPlay.currentSoundIndex ?? 0];
             // *** Use resolved downloadUrl first for playing ***
             const urlToUse = soundToPlay?.downloadUrl; // Get best URL

             if (urlToUse && urlToUse.startsWith('http')) {
                const buffer = audioBuffersRef.current[urlToUse]; // Check cache with HTTPS URL
                if (buffer) {
                   playSound(buffer);
                } else {
                    // Sound not loaded yet, attempt to load and play if successful
                     console.warn(`Playback: Buffer for ${urlToUse} not found, attempting load...`);
                     // Pass original soundUrl for cache key, urlToUse (HTTPS) for fetching
                    loadAudio(soundToPlay.soundUrl || urlToUse, urlToUse).then(loadedBuffer => {
                        if (loadedBuffer) playSound(loadedBuffer);
                        else console.error(`Playback: Buffer for ${urlToUse} could not be loaded on demand.`);
                    });
                }
             } else {
                  // Log if no valid URL found for the sound to be played
                  console.warn(`Beat: ${nextBeat}, Pad ${padToPlay.id}, Sound: ${soundToPlay?.soundName} - No valid download URL found. Original: ${soundToPlay?.soundUrl}`);
             }
        }
        return nextBeat; // Update the current beat for the next interval
      });
    }, beatDuration);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleBpmChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newBpm = parseInt(event.target.value, 10);
    if (!isNaN(newBpm) && newBpm > 0 && newBpm <= 300) {
      setBpm(newBpm);
    } else if (event.target.value === '') {
       setBpm(120); // Reset to default if input is cleared
    }
  };

  // Effect to restart or stop playback if bpm or pads change while playing
  useEffect(() => {
    if (isPlaying) {
      startPlayback(); // Restart playback with new settings
    }
    // Cleanup function to stop playback when component unmounts or dependencies change
    return () => stopPlayback();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
              const currentSound = hasSounds ? pad.sounds[currentSoundIndex] : null;

              // Use the CONSISTENT color from the CURRENTLY selected sound for the pad background
              // Ensure color exists before applying
              const bgColorClass = currentSound?.color
                ? currentSound.color // Use the sound's assigned color
                : hasSounds ? 'bg-secondary/70' // Pad has sounds but somehow no current sound
                : 'bg-secondary'; // Pad has no sounds

              const borderColorClass = hasSounds ? 'border-transparent' : 'border-border/50';
              const isCurrentBeat = isPlaying && currentBeat === pad.id;
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
                         // Potentially adjust border intensity based on active state (requires more complex logic or CSS vars)
                         // const dotBgColorClass = s.color || 'bg-muted'; // Not used directly now

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
                    selectedPadId === pad.id ? 'ring-2 ring-ring ring-offset-2' : '',
                    isCurrentBeat && isPadUIToggledActive ? 'ring-4 ring-offset-2 ring-accent shadow-lg scale-105 z-10' : '', // Highlight only if toggled active
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

               <Popover>
                  <PopoverTrigger asChild>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Playback Settings">
                              <Settings2 className="h-5 w-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Playback Settings</p>
                        </TooltipContent>
                    </Tooltip>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-4">
                     <div className="grid gap-4">
                       <div className="space-y-2">
                         <h4 className="font-medium leading-none">Playback</h4>
                         <p className="text-sm text-muted-foreground">
                           Adjust the tempo.
                         </p>
                       </div>
                       <div className="grid gap-2">
                         <Label htmlFor="bpm-input">BPM</Label>
                         <Input
                           id="bpm-input"
                           type="number"
                           min="1"
                           max="300"
                           step="1"
                           value={bpm}
                           onChange={handleBpmChange}
                           className="h-8"
                         />
                       </div>
                     </div>
                  </PopoverContent>
                </Popover>
               <span className="text-sm text-muted-foreground tabular-nums w-16 text-center">{bpm} BPM</span>
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
