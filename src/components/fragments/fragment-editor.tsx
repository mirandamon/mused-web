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
import { presetSounds } from '@/lib/placeholder-sounds'; // Keep preset sounds static
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

// Global map to track assigned colors for sound IDs to ensure consistency
const globalSoundColorMap = new Map<string, string>();
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
export const getOrAssignSoundColor = (soundId: string): string => {
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
        return newColor;
    }
};


export default function FragmentEditor({ initialPads: rawInitialPads, originalAuthor, originalFragmentId }: FragmentEditorProps) {
  const [pads, setPads] = useState<Pad[]>(defaultPads);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedPadId, setSelectedPadId] = useState<number | null>(null);
  const [currentSelectedPadData, setCurrentSelectedPadData] = useState<Pad | null>(null);
  const [isSoundSheetOpen, setIsSoundSheetOpen] = useState(false);
  // Removed local soundColorMap and availableColorsRef - use global helpers now
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


   // Initialize pads using global color helper
   useEffect(() => {
       const processedPads = (rawInitialPads || defaultPads).map(rawPad => {
           const processedSounds: PadSound[] = (rawPad.sounds || [])
               .filter(ps => ps.soundId) // Ensure soundId exists
               .map(padSound => {
                   const assignedColor = getOrAssignSoundColor(padSound.soundId!); // Use global helper
                   const fullSound = presetSounds.find(s => s.id === padSound.soundId);
                   return {
                       ...padSound,
                       soundName: padSound.soundName || fullSound?.name || 'Unknown',
                       soundUrl: padSound.soundUrl, // Keep original path (might be gs:// or relative)
                       downloadUrl: padSound.downloadUrl, // Keep playable URL (should be http/https)
                       color: assignedColor, // Apply consistent color
                   };
               });

           return {
               ...rawPad,
               sounds: processedSounds,
               isActive: rawPad.isActive || processedSounds.length > 0,
               currentSoundIndex: rawPad.currentSoundIndex ?? 0,
           };
       });
       setPads(processedPads);
   }, [rawInitialPads]);


  // --- Audio Loading ---
   const loadAudio = useCallback(async (url: string): Promise<AudioBuffer | null> => {
      if (!audioContextRef.current || !url) return null;
      // Use the URL itself as the key for caching
      if (audioBuffersRef.current[url]) return audioBuffersRef.current[url];

      // Check if the URL is a valid HTTP/HTTPS URL
      let fetchUrl = url;
      if (!url.startsWith('http')) {
          // If it's a relative path (like preset sounds), construct the full URL
          if (url.startsWith('/') && typeof window !== 'undefined') {
              fetchUrl = window.location.origin + url;
          } else {
              // If it's not HTTP and not a relative path starting with '/', it's likely an invalid format (e.g., gs://)
              console.error(`Editor: Invalid audio URL format: ${url}`);
              setTimeout(() => { // Use setTimeout to avoid updating state during render
                  toast({
                      variant: "destructive",
                      title: "Audio Load Error",
                      description: `Invalid sound URL format for ${url.split('/').pop() || 'Unknown sound'}. Cannot load.`,
                  });
              }, 0);
              return null; // Cannot fetch this URL
          }
      }

      console.log(`Editor: Attempting to load audio from: ${fetchUrl}`);
      try {
          const response = await fetch(fetchUrl);
          if (!response.ok) {
              console.error(`Editor: HTTP error! status: ${response.status} for URL ${fetchUrl}`);
              throw new Error(`HTTP error! status: ${response.status}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
          audioBuffersRef.current[url] = audioBuffer; // Cache the buffer using the original valid URL as key
          console.log(`Editor: Audio loaded and decoded successfully: ${url}`);
          return audioBuffer;
      } catch (error) {
          console.error(`Editor: Error loading or decoding audio file ${url} (fetching from ${fetchUrl}):`, error);
          setTimeout(() => { // Use setTimeout to avoid updating state during render
              toast({
                  variant: "destructive",
                  title: "Audio Load Error",
                  description: `Could not load sound: ${url.split('/').pop()?.split('?')[0] || 'Unknown sound'}.`,
              });
          }, 0);
          return null;
      }
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []); // Removed toast from dependency array

   // Preload sounds when pads data changes
   useEffect(() => {
       pads.forEach(pad => {
           pad.sounds.forEach(sound => {
               // *** CRITICAL: Always prioritize downloadUrl for loading ***
               const urlToLoad = sound.downloadUrl;
               if (urlToLoad) {
                   loadAudio(urlToLoad); // Start loading using the playable URL
               } else if (sound.soundUrl && sound.soundUrl.startsWith('/')) {
                   // Fallback for preset sounds if downloadUrl is missing but soundUrl is relative
                   loadAudio(sound.soundUrl);
               } else {
                  // Log if no playable URL is found, don't attempt to load invalid formats
                  if (sound.soundUrl && !sound.soundUrl.startsWith('http') && !sound.soundUrl.startsWith('/')) {
                    // console.warn(`Pad ${pad.id}, Sound ${sound.soundName}: Invalid soundUrl format (${sound.soundUrl}), cannot preload.`);
                  } else if (!sound.soundUrl) {
                    // console.warn(`Pad ${pad.id}, Sound ${sound.soundName}: Missing playable URL (downloadUrl).`);
                  }
               }
           });
       });
   }, [pads, loadAudio]);


   // --- Audio Playback ---
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
               // *** CRITICAL: Always prioritize downloadUrl for playback ***
               const urlToPlay = soundToPlay?.downloadUrl;
               if (urlToPlay) {
                   const buffer = audioBuffersRef.current[urlToPlay]; // Use downloadUrl as cache key
                   if (buffer) {
                       playSound(buffer);
                   } else {
                       loadAudio(urlToPlay).then(loadedBuffer => {
                           if (loadedBuffer) playSound(loadedBuffer);
                       });
                   }
               } else {
                 // Fallback for preset sounds if downloadUrl missing
                 const fallbackUrl = soundToPlay?.soundUrl;
                 if (fallbackUrl && fallbackUrl.startsWith('/')) {
                    const buffer = audioBuffersRef.current[fallbackUrl];
                    if (buffer) playSound(buffer);
                    else loadAudio(fallbackUrl).then(b => b && playSound(b));
                 } else {
                    console.warn(`Pad ${id}: No playable URL found for sound ${soundToPlay?.soundName}`);
                 }
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
                  // *** CRITICAL: Always prioritize downloadUrl for playback ***
                  const urlToPlay = soundToPlay?.downloadUrl;
                  if (urlToPlay) {
                      const buffer = audioBuffersRef.current[urlToPlay]; // Use downloadUrl as cache key
                      if (buffer) {
                          playSound(buffer);
                      } else {
                          loadAudio(urlToPlay).then(loadedBuffer => {
                              if (loadedBuffer) playSound(loadedBuffer);
                          });
                      }
                  } else {
                     // Fallback for preset sounds if downloadUrl missing
                     const fallbackUrl = soundToPlay?.soundUrl;
                     if (fallbackUrl && fallbackUrl.startsWith('/')) {
                         const buffer = audioBuffersRef.current[fallbackUrl];
                         if (buffer) playSound(buffer);
                         else loadAudio(fallbackUrl).then(b => b && playSound(b));
                     } else {
                         console.warn(`Pad ${id} (touch): No playable URL found for sound ${soundToPlay?.soundName}`);
                     }
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
   const handleToggleSound = (sound: Sound) => {
     if (selectedPadId === null) return;

     let toastMessage = ""; // Define toastMessage outside setPads

     setPads(currentPads => {
       const updatedPads = currentPads.map(pad => {
         if (pad.id !== selectedPadId) return pad;

         const soundIndex = pad.sounds.findIndex(s => s.soundId === sound.id);
         let newSounds: PadSound[];
         let newCurrentIndex = pad.currentSoundIndex ?? 0;

         if (soundIndex > -1) {
           // Sound exists, remove it
           newSounds = pad.sounds.filter((_, index) => index !== soundIndex);
           toastMessage = `${sound.name} removed from Pad ${selectedPadId + 1}.`;
           // Adjust currentSoundIndex if the removed sound was the last one or before the current one
           if (newSounds.length === 0) {
              newCurrentIndex = 0;
           } else if (newCurrentIndex >= newSounds.length) {
              newCurrentIndex = newSounds.length - 1;
           }
         } else {
           // Sound doesn't exist, add it
           const assignedColor = getOrAssignSoundColor(sound.id); // Get consistent color

           const newPadSound: PadSound = {
             soundId: sound.id,
             soundName: sound.name,
             // *** CRITICAL: Store BOTH URLs ***
             soundUrl: sound.source_url, // Store original path (e.g., gs:// or relative)
             downloadUrl: sound.downloadUrl || sound.previewUrl, // Store playable URL (http/https)
             source: sound.source_type || sound.type, // Use source_type or derived type
             color: assignedColor!, // Use the determined color
           };
           newSounds = [...pad.sounds, newPadSound];
           newCurrentIndex = newSounds.length - 1; // Focus the newly added sound
           toastMessage = `${sound.name} added to Pad ${selectedPadId + 1}.`;

           // Preload the newly added sound using the playable URL
           const urlToLoad = newPadSound.downloadUrl; // Prioritize downloadUrl
           if (urlToLoad) {
              loadAudio(urlToLoad);
           } else if (newPadSound.soundUrl && newPadSound.soundUrl.startsWith('/')) {
              // Fallback for presets if downloadUrl is missing
              loadAudio(newPadSound.soundUrl);
           } else {
              console.warn(`Added sound ${newPadSound.soundName} but no playable URL found.`);
           }
         }

         // Return the updated pad state
         // Activate pad if adding first sound, keep active unless removing last sound
         const newIsActive = newSounds.length > 0;
         return { ...pad, sounds: newSounds, isActive: newIsActive, currentSoundIndex: newCurrentIndex };
       });
       return updatedPads; // Return the full updated pads array
     });

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
     setTimeout(() => {
        toast({
            title: isRecording ? "Recording Stopped" : "Live Recording (Not Implemented)",
            description: isRecording ? "Stopped live recording mode." : "Tap a pad to assign live audio (feature coming soon).",
            variant: "default",
        });
     }, 0);
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
        handlePlayPause();
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
             // *** CRITICAL: Always prioritize downloadUrl for playback ***
             const urlToPlay = soundToPlay?.downloadUrl;

             if (urlToPlay) {
                const buffer = audioBuffersRef.current[urlToPlay]; // Use downloadUrl as cache key
                if (buffer) {
                   playSound(buffer);
                } else {
                    // Sound not loaded yet, attempt to load and play if successful
                    // This might cause slight delay on first playback if not preloaded
                    loadAudio(urlToPlay).then(loadedBuffer => {
                        if (loadedBuffer) playSound(loadedBuffer);
                        else console.warn(`Editor: Buffer for ${urlToPlay} could not be loaded on demand.`);
                    });
                }
             } else {
                 // Fallback for preset sounds if downloadUrl missing
                 const fallbackUrl = soundToPlay?.soundUrl;
                 if (fallbackUrl && fallbackUrl.startsWith('/')) {
                     const buffer = audioBuffersRef.current[fallbackUrl];
                     if (buffer) playSound(buffer);
                     else loadAudio(fallbackUrl).then(b => b && playSound(b));
                 } else {
                     // console.log(`Beat: ${nextBeat}, Pad ${padToPlay.id}, Sound: ${soundToPlay?.soundName} - No playable URL`);
                 }
             }
        }
        return nextBeat; // Update the current beat for the next interval
      });
    }, beatDuration);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, pads, playSound, loadAudio]); // Removed toast dependency


  const handlePlayPause = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
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
              const bgColorClass = currentSound
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
                         // Determine border color dynamically based on the sound's assigned color
                         // Using inline style as Tailwind class generation might be complex/limited
                         const soundColorValue = s.color.match(/bg-([a-z]+)-(\d+)/); // Extract color name and shade
                         let borderColorStyle = {};
                         if (soundColorValue) {
                             // Simple mapping, could be more sophisticated
                             const shade = parseInt(soundColorValue[2], 10);
                             const borderShade = idx === currentSoundIndex ? Math.min(900, shade + 100) : Math.max(300, shade - 100);
                             // Construct CSS variable name if using CSS vars, or apply directly if not
                             // Example assuming CSS vars like --color-red-700 exist
                             // borderColorStyle = { borderColor: `hsl(var(--${soundColorValue[1]}-${borderShade}))` };
                             // Direct Tailwind color usage for simplicity here (might need adjustments):
                             const borderClass = `border-${soundColorValue[1]}-${borderShade}`;
                             // Using inline style with placeholder value if dynamic class doesn't work
                             borderColorStyle = { borderColor: 'currentColor' }; // Placeholder

                         }

                         return (
                           <div
                             key={idx}
                             className={cn(
                               "rounded-full transition-all duration-300 ease-out",
                               idx === currentSoundIndex
                                 ? `w-2 h-2 opacity-100 bg-white border-2` // Active dot
                                 : `w-1.5 h-1.5 opacity-60 bg-transparent border`, // Inactive dot
                               // Apply border color class dynamically if possible, otherwise rely on inline style
                               // s.color.replace('bg-','border-').replace('-500','-300').replace('-600','-400') // Example attempt
                             )}
                             style={{
                               ...borderColorStyle, // Apply dynamic border color
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
                                               {/* Use the sound's own color for the square */}
                                               <div className={`w-3 h-3 rounded-sm mr-2 shrink-0 ${s.color}`}></div>
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
