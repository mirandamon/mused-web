// src/components/fragments/fragment-editor.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Music2, Mic, Upload, Check, Play, Pause, Settings2, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import SoundSelectionSheet from './sound-selection-sheet';
import type { Pad, PadSound, Sound } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { presetSounds, marketplaceSounds } from '@/lib/placeholder-sounds';
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

// Helper function to get a random color from the palette
const getRandomColor = (availableColorsPool: string[]): string => {
    if (availableColorsPool.length === 0) {
        console.warn("Color palette exhausted, reusing colors.");
        // Simple reset, could be improved
        availableColorsPool.push(...colorPalette);
    }
    const randomIndex = Math.floor(Math.random() * availableColorsPool.length);
    return availableColorsPool.splice(randomIndex, 1)[0];
};

// Combine sounds for easier lookup
const allSounds: Sound[] = [...presetSounds, ...marketplaceSounds];

export default function FragmentEditor({ initialPads: rawInitialPads, originalAuthor, originalFragmentId }: FragmentEditorProps) {
  const [pads, setPads] = useState<Pad[]>(defaultPads);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedPadId, setSelectedPadId] = useState<number | null>(null);
  const [currentSelectedPadData, setCurrentSelectedPadData] = useState<Pad | null>(null);
  const [isSoundSheetOpen, setIsSoundSheetOpen] = useState(false);
  // soundColorMap stores the assigned color for each unique sound ID
  const [soundColorMap, setSoundColorMap] = useState<{ [soundId: string]: string }>({});
  // availableColorsRef stores the mutable pool of colors to pick from
  const availableColorsRef = useRef<string[]>([...colorPalette]);
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

  const LONG_PRESS_DURATION = 500; // milliseconds
  const SWIPE_THRESHOLD = 30; // Reduced threshold for better sensitivity

   // Initialize pads and color map from initialPads prop
   useEffect(() => {
     const initialColorMap: { [soundId: string]: string } = {};
     const processedPads = (rawInitialPads || defaultPads).map(rawPad => {
        const processedSounds: PadSound[] = [];
        (rawPad.sounds || []).forEach(padSound => {
            if (!padSound.soundId) return; // Skip if no soundId

            let color = padSound.color; // Use provided color if exists
            if (initialColorMap[padSound.soundId]) {
                // If this soundId already has a color assigned in this init run, use it
                color = initialColorMap[padSound.soundId];
            } else if (!color || !colorPalette.includes(color)) {
                // If no valid color provided AND no color assigned yet, pick a new one
                color = getRandomColor(availableColorsRef.current);
                initialColorMap[padSound.soundId] = color; // Store the new assignment
            } else {
                // If a valid color *was* provided and not yet assigned, store it and remove from pool
                initialColorMap[padSound.soundId] = color;
                const colorIndex = availableColorsRef.current.indexOf(color);
                if (colorIndex > -1) {
                    availableColorsRef.current.splice(colorIndex, 1);
                }
            }

            // Add the sound with its determined color
             const fullSound = allSounds.find(s => s.id === padSound.soundId);
            processedSounds.push({
                ...padSound,
                soundName: padSound.soundName || fullSound?.name || 'Unknown', // Ensure name exists
                color: color!, // Ensure color is assigned
            });
        });

        // Update rawPad with processed sounds and derive isActive state
        return {
            ...rawPad,
            sounds: processedSounds,
            // A pad is active if isActive is explicitly true OR it has sounds.
            isActive: rawPad.isActive || processedSounds.length > 0,
            currentSoundIndex: rawPad.currentSoundIndex ?? 0, // Initialize index
        };
     });

     setPads(processedPads);
     setSoundColorMap(initialColorMap);
   }, [rawInitialPads]);


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
          // Short press action: Toggle pad active state
           setPads(currentPads => {
              const updatedPads = currentPads.map(pad => {
                 if (pad.id === id) {
                     // Toggle only if it has sounds or is already active
                     // const newState = (pad.sounds.length > 0 || pad.isActive) ? !pad.isActive : false;
                     // Let's always allow toggling isActive, visual state will handle display
                     const newState = !pad.isActive;
                     return { ...pad, isActive: newState };
                 }
                 return pad;
               });
               return updatedPads;
           });
      }
    }
     // Reset timing and swipe flags regardless
     touchStartTimeRef.current = 0;
     // Don't reset swipeHandledRef here, let the next mousedown/touchstart do it
     // swipeHandledRef.current = false;
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
            // Short press action: Toggle pad active state
             setPads(currentPads => {
                const updatedPads = currentPads.map(pad => {
                   if (pad.id === id) {
                       // Always allow toggling isActive.
                       const newState = !pad.isActive;
                       return { ...pad, isActive: newState };
                   }
                   return pad;
                 });
                 return updatedPads;
             });
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
             console.log(`Swipe detected on Pad ${padId}. Direction: ${direction > 0 ? 'Right (Prev)' : 'Left (Next)'}. New Index: ${newIndex}`);
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
           let assignedColor = soundColorMap[sound.id];
           if (!assignedColor) {
             assignedColor = getRandomColor(availableColorsRef.current);
             setSoundColorMap(prevMap => ({ ...prevMap, [sound.id]: assignedColor! }));
           }
           const newPadSound: PadSound = {
             soundId: sound.id,
             soundName: sound.name,
             soundUrl: sound.previewUrl,
             source: sound.type === 'preset' ? 'prerecorded' : 'prerecorded', // Placeholder
             color: assignedColor!,
           };
           newSounds = [...pad.sounds, newPadSound];
           newCurrentIndex = newSounds.length - 1; // Focus the newly added sound
           toastMessage = `${sound.name} added to Pad ${selectedPadId + 1}.`;
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

     // Keep the sheet open for potential multiple changes
     // setIsSoundSheetOpen(false); // Keep sheet open
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
     // User clicks "Sounds" button - intended to OPEN the sheet, not necessarily assign.
     // Don't require a pad to be selected first.
     // setSelectedPadId(null); // Keep selectedPadId if already long-pressed
     // setCurrentSelectedPadData(null);
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
    const hasSound = pads.some(p => p.isActive && p.sounds.length > 0);
    if (!hasSound) {
        setTimeout(() => {
            toast({
                variant: "destructive",
                title: "Empty Fragment",
                description: "Add at least one sound to an active pad before posting.",
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
             // In a real app, play the audio for the sound at padToPlay.currentSoundIndex
             const soundToPlay = padToPlay.sounds[padToPlay.currentSoundIndex ?? 0];
             console.log(`Beat: ${nextBeat}, Pad ${padToPlay.id}, Playing Sound: ${soundToPlay?.soundName}`);
             // Example: playAudio(soundToPlay.soundUrl);
        }
        return nextBeat; // Update the current beat for the next interval
      });
    }, beatDuration);
  }, [bpm, pads]); // Dependencies: bpm and pads array

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
              const isPadActive = pad.isActive; // Active state is now independent of having sounds
              const hasSounds = pad.sounds.length > 0;
              const currentSoundIndex = pad.currentSoundIndex ?? 0;
              const currentSound = hasSounds ? pad.sounds[currentSoundIndex] : null;

              // Determine background color based on the *currently selected* sound in multi-sound pads
              const bgColorClass = isPadActive && currentSound
                ? currentSound.color // Use color of current sound if active and sound exists
                : isPadActive ? 'bg-secondary/70' // Active but no sound (e.g., preparing to assign)
                : 'bg-secondary'; // Inactive

              const borderColorClass = isPadActive ? 'border-transparent' : 'border-border/50';
              const isCurrentBeat = isPlaying && currentBeat === pad.id;
              const row = Math.floor(pad.id / 4);
              const delay = `${row * 100}ms`; // Stagger animation

              // Determine content based on pad state
              const padContent = () => {
                 // --- Dots Indicator for multiple sounds ---
                 const dotsIndicator = pad.sounds.length > 1 && (
                    <div className="absolute top-1.5 left-0 right-0 flex justify-center items-center space-x-1 pointer-events-none z-10">
                       {pad.sounds.map((s, idx) => (
                         <div
                           key={idx}
                           className={cn(
                              "rounded-full transition-all duration-300 ease-out",
                              // Active dot is larger, filled white, with border matching sound color
                              idx === currentSoundIndex
                                ? `w-2 h-2 opacity-100 bg-white border-2`
                                : `w-1.5 h-1.5 opacity-60 bg-transparent border`, // Inactive dots smaller, transparent bg
                              idx === currentSoundIndex ? s.color.replace('bg-','border-') : s.color.replace('bg-','border-').replace('-500','-300').replace('-600','-400') // Border color from sound
                           )}
                           style={{
                             // Use inline style for dynamic border color based on the sound's color class
                             borderColor: idx === currentSoundIndex ? `var(--color-${s.color.split('-')[1]})` : `var(--color-${s.color.split('-')[1]}-muted)`, // Crude way to get color name - needs refinement
                             // Transform scale for active dot
                             transform: idx === currentSoundIndex ? 'scale(1.1)' : 'scale(1)',
                           }}
                         />
                       ))}
                     </div>
                 );

                 // --- Pad State Visuals ---
                 if (!isPadActive) {
                    // Inactive pad: faint dot in the center
                    return <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="w-3 h-3 rounded-full bg-muted-foreground/20"></div></div>;
                 }
                 if (!hasSounds) {
                     // Active but no sounds: pulsing dot indicating readiness
                     return <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="w-3 h-3 rounded-full bg-primary/40 animate-pulse"></div></div>;
                 }

                 // Active pad with sound(s): Show current sound info and dots if multiple
                 const soundToDisplay = currentSound; // This is the sound at currentSoundIndex
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
                  onMouseLeave={() => handlePadMouseLeave(pad.id)} // Pass pad.id
                  onTouchStart={(e) => handlePadTouchStart(pad.id, e)}
                  onTouchEnd={() => handlePadTouchEnd(pad.id)} // Pass pad.id
                  onTouchMove={handlePadTouchMove} // Add touch move handler for swipe
                  className={cn(
                    "relative w-full h-full rounded-lg border-2 transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 active:scale-95 cursor-pointer",
                    "touch-pan-y", // Allow vertical scroll, prevent horizontal page scroll during swipe
                    bgColorClass,
                    borderColorClass,
                    isPadActive ? 'shadow-md' : 'hover:bg-muted hover:border-primary/50',
                    selectedPadId === pad.id ? 'ring-2 ring-ring ring-offset-2' : '',
                    isCurrentBeat ? 'ring-4 ring-offset-2 ring-accent shadow-lg scale-105 z-10' : '', // Ensure current beat is on top
                    "opacity-0 animate-wave-fall", // Initial animation
                    "overflow-hidden" // Crucial for containing content and animations
                  )}
                   style={{ animationDelay: delay }}
                   aria-label={`Pad ${pad.id + 1}. Status: ${
                      isPadActive
                        ? hasSounds
                          ? `${pad.sounds.length} sound${pad.sounds.length > 1 ? 's' : ''}. Current: ${currentSound?.soundName || 'None'}`
                          : 'Active, no sound'
                        : 'Inactive'
                    }. Short press to toggle activity. Long press to manage sounds.${
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
                        {/* Changed Upload icon to Layers for multi-sound context */}
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
       <SoundSelectionSheet
         isOpen={isSoundSheetOpen}
         onOpenChange={handleSheetOpenChange}
         onToggleSound={handleToggleSound}
         selectedPadId={selectedPadId}
         currentPadSounds={currentSelectedPadData?.sounds || []}
         allSounds={allSounds}
       />
     </TooltipProvider>
  );
}
