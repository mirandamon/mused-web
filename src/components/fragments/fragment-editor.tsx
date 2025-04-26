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
  const SWIPE_THRESHOLD = 40; // Minimum pixels moved horizontally to trigger swipe

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
                     const newState = (pad.sounds.length > 0 || pad.isActive) ? !pad.isActive : false;
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
      currentSwipingPadIdRef.current = id;
      handlePadMouseDown(id); // Also trigger long press logic
   };

   const handlePadTouchEnd = (id: number, event: React.TouchEvent<HTMLButtonElement>) => {
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
                       const newState = (pad.sounds.length > 0 || pad.isActive) ? !pad.isActive : false;
                       return { ...pad, isActive: newState };
                   }
                   return pad;
                 });
                 return updatedPads;
             });
        }
     }

     // Reset swipe and timing state
     touchStartXRef.current = 0;
     currentSwipingPadIdRef.current = null;
     touchStartTimeRef.current = 0;
     // Don't reset swipeHandledRef immediately, wait for next touch start
   };


   const handlePadTouchMove = (event: React.TouchEvent<HTMLButtonElement>) => {
     if (!touchStartXRef.current || currentSwipingPadIdRef.current === null || swipeHandledRef.current) {
       return; // No swipe started, wrong pad, or already handled
     }

     const currentX = event.touches[0].clientX;
     const deltaX = currentX - touchStartXRef.current;
     const padId = currentSwipingPadIdRef.current;

     if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
       // Swipe detected
       if (longPressTimerRef.current) {
         clearTimeout(longPressTimerRef.current); // Cancel long press if swipe occurs
         longPressTimerRef.current = null;
       }
       swipeHandledRef.current = true; // Mark swipe as handled

       setPads(currentPads => {
         return currentPads.map(pad => {
           if (pad.id === padId && pad.sounds.length > 1) {
             const direction = deltaX > 0 ? -1 : 1; // Swipe right = previous (-1), Swipe left = next (+1)
             let newIndex = (pad.currentSoundIndex ?? 0) + direction;
             // Loop back around
             if (newIndex < 0) newIndex = pad.sounds.length - 1;
             if (newIndex >= pad.sounds.length) newIndex = 0;

             return { ...pad, currentSoundIndex: newIndex };
           }
           return pad;
         });
       });

       // Reset touch start X to prevent multiple swipes from one drag
       touchStartXRef.current = currentX;
     }
   };


  const handlePadMouseLeave = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
     // Reset swipe and timing state on mouse leave
     touchStartXRef.current = 0;
     currentSwipingPadIdRef.current = null;
     touchStartTimeRef.current = 0;
     swipeHandledRef.current = false; // Reset swipe flag fully
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
         return { ...pad, sounds: newSounds, isActive: newSounds.length > 0, currentSoundIndex: newCurrentIndex };
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
     // setIsSoundSheetOpen(false);
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
     setSelectedPadId(null);
     setCurrentSelectedPadData(null);
     setIsSoundSheetOpen(true);
     setTimeout(() => {
        toast({
          title: "Select Sound",
          description: "Opening sound library. Long press a pad first to assign sounds.",
        });
     }, 0);
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

    await new Promise(resolve => setTimeout(resolve, 1000));

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
             console.log(`Beat: ${nextBeat}, Playing Sounds: ${padToPlay.sounds.map(s => s.soundName).join(', ')}`);
             padToPlay.sounds.forEach(sound => {
                 if (sound.soundUrl) {
                     // Actual audio playback needed here
                 }
             });
        }
        return nextBeat; // Update the current beat for the next interval
      });
    }, beatDuration);
  }, [bpm, pads]); // Dependencies: bpm and pads array

  const handlePlayPause = () => {
    if (isPlaying) {
      stopPlayback();
      // Remove toast for pause
      // setTimeout(() => {
      //     toast({
      //       title: "Playback Paused",
      //     });
      // }, 0);
    } else {
      startPlayback();
      // Remove toast for play
      // setTimeout(() => {
      //     toast({
      //       title: "Playback Started",
      //       description: `Playing at ${bpm} BPM`,
      //     });
      // }, 0);
    }
  };

  const handleBpmChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newBpm = parseInt(event.target.value, 10);
    if (!isNaN(newBpm) && newBpm > 0 && newBpm <= 300) {
      setBpm(newBpm);
    } else if (event.target.value === '') {
       setBpm(120);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      startPlayback();
    } else {
       stopPlayback();
    }
    return stopPlayback;
  }, [isPlaying, bpm, startPlayback, stopPlayback]);

   const handleSheetOpenChange = (open: boolean) => {
     setIsSoundSheetOpen(open);
     if (!open) {
       setSelectedPadId(null);
     }
   };


  return (
    <TooltipProvider>
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-4 gap-2 md:gap-3 aspect-square mb-6">
            {pads.map((pad) => {
              const isPadActive = pad.isActive && pad.sounds.length > 0;
              const currentSoundIndex = pad.currentSoundIndex ?? 0;
              const currentSound = pad.sounds[currentSoundIndex];

              // Determine background color based on the *currently selected* sound in multi-sound pads
              const bgColorClass = isPadActive && currentSound
                ? currentSound.color
                : pad.isActive ? 'bg-secondary/70' : 'bg-secondary';

              const borderColorClass = isPadActive ? 'border-transparent' : 'border-border';
              const isCurrentBeat = isPlaying && currentBeat === pad.id;
              const row = Math.floor(pad.id / 4);
              const delay = `${row * 100}ms`;

              // Determine content based on pad state
              const padContent = () => {
                 // Dots Indicator for multiple sounds
                 const dotsIndicator = pad.sounds.length > 1 && (
                    <div className="absolute top-1.5 left-0 right-0 flex justify-center items-center space-x-1 pointer-events-none">
                       {pad.sounds.map((s, idx) => (
                         <div
                           key={idx}
                           className={cn(
                              "rounded-full transition-all duration-200",
                              idx === currentSoundIndex ? `w-1.5 h-1.5 opacity-100` : `w-1 h-1 opacity-50`,
                              s.color.replace('bg-','border-').replace('-500','-300').replace('-600','-400') + ' border' // Use border color derived from sound color
                           )}
                           style={{
                             backgroundColor: idx === currentSoundIndex ? 'white' : 'transparent', // Fill active dot
                             // Add slight scale effect
                             transform: idx === currentSoundIndex ? 'scale(1.2)' : 'scale(1)',
                           }}
                         />
                       ))}
                     </div>
                 );


                 if (!pad.isActive) {
                    return <div className="absolute inset-0 flex items-center justify-center"><div className="w-3 h-3 rounded-full bg-muted-foreground/20"></div></div>;
                 }
                 if (pad.sounds.length === 0) {
                     return <div className="absolute inset-0 flex items-center justify-center"><div className="w-3 h-3 rounded-full bg-primary/30 animate-pulse"></div></div>;
                 }

                 // Always show the current sound (single or multi)
                 const soundToDisplay = currentSound; // This will be the sound at currentSoundIndex
                 if (!soundToDisplay) return null; // Should not happen if sounds array is not empty

                 const soundIcon = soundToDisplay.source === 'live' ? Mic : Music2;
                 const soundName = soundToDisplay.soundName;


                 return (
                     <Tooltip>
                         {/* Use div for TooltipTrigger when it's not interactive */}
                         <TooltipTrigger asChild>
                            <div // Changed from button to div
                                className="absolute inset-0 flex flex-col items-center justify-center p-1 pt-4 overflow-hidden w-full h-full cursor-grab active:cursor-grabbing" // Add grab cursor
                            >
                                {dotsIndicator} {/* Render dots above the icon/text */}
                                {React.createElement(soundIcon, { className: "w-1/2 h-1/2 text-white/90 opacity-80 mb-1 mt-1 flex-shrink-0" })}
                                <span className="text-xs text-white/90 opacity-90 truncate w-full text-center">{soundName}</span>
                            </div>
                         </TooltipTrigger>
                         <TooltipContent side="top" className="bg-background text-foreground">
                           {pad.sounds.length > 1 ? (
                               <ul className="list-none p-0 m-0 space-y-1 max-w-[150px]">
                                   {pad.sounds.map((s, idx) => (
                                       <li key={s.soundId} className={cn("flex items-center", idx === currentSoundIndex ? "font-semibold" : "")}>
                                           <div className={`w-3 h-3 rounded-sm mr-2 shrink-0 ${s.color}`}></div>
                                           <span className="truncate">{s.soundName}</span>
                                       </li>
                                   ))}
                               </ul>
                           ) : (
                                <p>{soundName}</p>
                           )}
                           {pad.sounds.length > 1 && <p className="text-xs text-muted-foreground mt-1">Swipe to cycle</p>}
                         </TooltipContent>
                     </Tooltip>
                 );
              };

              return (
                <button
                  key={pad.id}
                  onMouseDown={() => handlePadMouseDown(pad.id)}
                  onMouseUp={() => handlePadMouseUp(pad.id)}
                  onMouseLeave={handlePadMouseLeave}
                  onTouchStart={(e) => handlePadTouchStart(pad.id, e)}
                  onTouchEnd={(e) => handlePadTouchEnd(pad.id, e)}
                  onTouchMove={handlePadTouchMove} // Add touch move handler for swipe
                  className={cn(
                    "relative w-full h-full rounded-lg border-2 transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 active:scale-95",
                    bgColorClass,
                    borderColorClass,
                    isPadActive ? 'shadow-md' : 'hover:bg-muted hover:border-primary/50',
                    selectedPadId === pad.id ? 'ring-2 ring-ring ring-offset-2' : '',
                    isCurrentBeat ? 'ring-4 ring-offset-2 ring-accent shadow-lg scale-105' : '',
                    "opacity-0 animate-wave-fall",
                    "overflow-hidden" // Ensure content doesn't overflow during swipe/animation
                  )}
                   style={{ animationDelay: delay }}
                  aria-label={`Pad ${pad.id + 1}. Status: ${pad.isActive ? (pad.sounds.length > 0 ? `${pad.sounds.length} sound${pad.sounds.length > 1 ? 's' : ''}` : 'Active, no sound') : 'Inactive'}. Short press to toggle activity. Long press to change sound${pad.sounds.length > 1 ? 's' : ''}. ${pad.sounds.length > 1 ? 'Swipe to cycle sounds.' : ''}`}
                >
                  {padContent()}
                </button>
              );
            })}
          </div>
           {/* Playback and Sound Controls */}
           <div className="flex justify-between items-center space-x-4">
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
                           <Upload className="mr-2 h-4 w-4" />
                           Sounds
                         </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Open Sound Library</p>
                        <p className="text-xs text-muted-foreground">(Long press a pad first)</p>
                    </TooltipContent>
                 </Tooltip>
                 <Tooltip>
                    <TooltipTrigger asChild>
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={handleRecordClick}
                           disabled // Disable until implemented
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

