// src/components/fragments/fragment-editor.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Music2, Mic, Upload, Check, Play, Pause, Settings2, Layers } from 'lucide-react'; // Added Layers icon
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import SoundSelectionSheet from './sound-selection-sheet';
import type { Pad, PadSound, Sound } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { presetSounds, marketplaceSounds } from '@/lib/placeholder-sounds';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Import Tooltip components


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

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState<number | null>(null);
  const [bpm, setBpm] = useState<number>(120);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const LONG_PRESS_DURATION = 500; // milliseconds

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
            // This handles activating a pad just by adding a sound.
            isActive: rawPad.isActive || processedSounds.length > 0,
        };
     });

     setPads(processedPads);
     setSoundColorMap(initialColorMap);
   }, [rawInitialPads]);


  const handlePadMouseDown = (id: number) => {
     touchStartTimeRef.current = Date.now();
     longPressTimerRef.current = setTimeout(() => {
      setSelectedPadId(id);
      // No need to set currentSelectedPadData here, useEffect will handle it
      // const padData = pads.find(p => p.id === id) || null;
      // setCurrentSelectedPadData(padData);
      setIsSoundSheetOpen(true);
      longPressTimerRef.current = null;
    }, LONG_PRESS_DURATION);
  };

   const handlePadMouseUp = (id: number) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;

      const pressDuration = Date.now() - touchStartTimeRef.current;
      if (pressDuration < LONG_PRESS_DURATION) {
          // Short press action: Toggle pad active state
           let padStatusMessage = "";
           setPads(currentPads => {
              const updatedPads = currentPads.map(pad => {
                 if (pad.id === id) {
                     const newState = !pad.isActive;
                     padStatusMessage = `Pad ${id + 1} ${newState ? 'Activated' : 'Deactivated'}`;
                     return { ...pad, isActive: newState };
                 }
                 return pad;
               });
               return updatedPads;
           });
           if (padStatusMessage) {
                // Wrap toast call in setTimeout to avoid state update during render
                setTimeout(() => {
                    toast({ title: padStatusMessage });
                }, 0);
           }
      }
    }
     touchStartTimeRef.current = 0; // Reset start time
  };

   const handlePadTouchStart = (id: number) => handlePadMouseDown(id);
   const handlePadTouchEnd = (id: number) => handlePadMouseUp(id);

  const handlePadMouseLeave = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
     touchStartTimeRef.current = 0;
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

         if (soundIndex > -1) {
           // Sound exists, remove it
           newSounds = pad.sounds.filter((_, index) => index !== soundIndex);
           toastMessage = `${sound.name} removed from Pad ${selectedPadId + 1}.`;
         } else {
           // Sound doesn't exist, add it
           let assignedColor = soundColorMap[sound.id];
           if (!assignedColor) {
             assignedColor = getRandomColor(availableColorsRef.current);
             // Update color map in a separate effect or via a direct state update if needed immediately
             // For now, we assume the color map update happens correctly outside this scope or is handled later
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
           toastMessage = `${sound.name} added to Pad ${selectedPadId + 1}.`;
         }

         // Return the updated pad state
         return { ...pad, sounds: newSounds, isActive: newSounds.length > 0 ? true : pad.isActive };
       });
       return updatedPads; // Return the full updated pads array
     });

     // Show toast *after* the state update has been queued
     if (toastMessage) {
        // Wrap toast call in setTimeout to avoid state update during render
        setTimeout(() => {
          toast({ title: "Sound Updated", description: toastMessage });
        }, 0);
     }

     // Note: Sheet closing is handled by the Sheet component itself via onOpenChange
     // setIsSoundSheetOpen(false); // Do not close sheet automatically
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
     // Wrap toast call in setTimeout
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
     // Wrap toast call in setTimeout
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
    // A fragment is postable if at least one pad is active *and* has sounds
    const hasSound = pads.some(p => p.isActive && p.sounds.length > 0);
    if (!hasSound) {
        // Wrap toast call in setTimeout
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

    // Wrap toast call in setTimeout
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

        // If pad is active and has sounds, play them (requires audio implementation)
        if (padToPlay?.isActive && padToPlay.sounds.length > 0) {
             console.log(`Beat: ${nextBeat}, Playing Sounds: ${padToPlay.sounds.map(s => s.soundName).join(', ')}`);
             // --- Placeholder for actual audio playback ---
             // You would likely use Web Audio API or a library like Howler.js here
             padToPlay.sounds.forEach(sound => {
                 if (sound.soundUrl) {
                     // Example: using Audio object (simple, but limited)
                     // const audio = new Audio(sound.soundUrl);
                     // audio.play().catch(e => console.error("Error playing sound:", e));
                     // Note: Repeatedly creating Audio objects might not be efficient
                 }
             });
             // --- End Placeholder ---
        } else {
           // Optional: Log inactive beats or do nothing
           // console.log(`Beat: ${nextBeat}, Inactive or No Sound`);
        }
        return nextBeat; // Update the current beat for the next interval
      });
    }, beatDuration);
  }, [bpm, pads]); // Dependencies: bpm and pads array

  const handlePlayPause = () => {
    if (isPlaying) {
      stopPlayback();
       // Wrap toast call in setTimeout
       setTimeout(() => {
           toast({
             title: "Playback Paused",
           });
       }, 0);
    } else {
      startPlayback();
       // Wrap toast call in setTimeout
       setTimeout(() => {
           toast({
             title: "Playback Started",
             description: `Playing at ${bpm} BPM`,
           });
       }, 0);
    }
  };

  const handleBpmChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newBpm = parseInt(event.target.value, 10);
    if (!isNaN(newBpm) && newBpm > 0 && newBpm <= 300) { // Set reasonable BPM limits
      setBpm(newBpm);
    } else if (event.target.value === '') {
       setBpm(120); // Reset to default if input is cleared
    }
    // If currently playing, the interval will update automatically due to useEffect dependency
  };

  // Effect to manage playback interval cleanup and updates
  useEffect(() => {
    // If playing, ensure the interval reflects the current state (BPM, pads)
    if (isPlaying) {
      startPlayback(); // This will clear the old interval and start a new one
    } else {
       stopPlayback(); // Ensure stopped if isPlaying becomes false
    }
    // Cleanup function to stop playback when the component unmounts or dependencies change significantly
    return stopPlayback;
  }, [isPlaying, bpm, startPlayback, stopPlayback]); // Added startPlayback and stopPlayback to dependencies

   const handleSheetOpenChange = (open: boolean) => {
     setIsSoundSheetOpen(open);
     if (!open) {
       setSelectedPadId(null); // Reset selected pad when sheet closes
       // setCurrentSelectedPadData(null); // Let the useEffect handle this
     }
   };


  return (
    <TooltipProvider> {/* Wrap with TooltipProvider */}
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-4 gap-2 md:gap-3 aspect-square mb-6">
            {pads.map((pad, index) => {
              const isPadActive = pad.isActive && pad.sounds.length > 0;
              // Determine background: If multiple sounds, use a gradient or neutral? Let's use neutral for now.
              // If one sound, use its color. If inactive or no sounds, use secondary.
              const bgColorClass = isPadActive
                ? pad.sounds.length === 1
                    ? pad.sounds[0].color // Use the color of the single sound
                    : 'bg-gradient-to-br from-muted to-secondary' // Gradient/Neutral for multiple sounds
                : pad.isActive ? 'bg-secondary/70' : 'bg-secondary'; // Dimmer for active but no sound, normal secondary for inactive
              const borderColorClass = isPadActive ? 'border-transparent' : 'border-border';
              const isCurrentBeat = isPlaying && currentBeat === pad.id;
              const row = Math.floor(index / 4);
              const delay = `${row * 100}ms`; // Animation delay based on row

              // Determine content based on pad state
              const padContent = () => {
                 if (!pad.isActive) {
                    // Inactive Pad: Subtle indicator
                    return <div className="absolute inset-0 flex items-center justify-center"><div className="w-3 h-3 rounded-full bg-muted-foreground/20"></div></div>;
                 }
                 if (pad.sounds.length === 0) {
                     // Active, No Sound: Pulsing dot to indicate readiness
                     return <div className="absolute inset-0 flex items-center justify-center"><div className="w-3 h-3 rounded-full bg-primary/30 animate-pulse"></div></div>;
                 }
                 if (pad.sounds.length === 1) {
                     // Single Sound: Show icon and truncated name
                     const sound = pad.sounds[0];
                     return (
                         <Tooltip>
                            {/* Add asChild prop and wrap children in a div */}
                            <TooltipTrigger asChild className="absolute inset-0 flex flex-col items-center justify-center p-1 overflow-hidden w-full h-full">
                                <div> {/* Wrap content in a div */}
                                    {/* Consistent white text on colored background */}
                                    {sound.source === 'live' ? <Mic className="w-1/2 h-1/2 text-white/90 opacity-80 mb-1"/> : <Music2 className="w-1/2 h-1/2 text-white/90 opacity-80 mb-1" />}
                                    <span className="text-xs text-white/90 opacity-90 truncate w-full text-center">{sound.soundName}</span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-background text-foreground">
                                <p>{sound.soundName}</p>
                            </TooltipContent>
                        </Tooltip>
                     );
                 }
                 // Multiple Sounds: Show Layers icon and count
                 return (
                     <Tooltip>
                        {/* Add asChild prop and wrap children in a div */}
                        <TooltipTrigger asChild className="absolute inset-0 flex flex-col items-center justify-center p-1 overflow-hidden w-full h-full">
                           <div> {/* Wrap content in a div */}
                                <Layers className="w-1/2 h-1/2 text-white opacity-90 mb-1" />
                                <span className="text-xs text-white opacity-90">{pad.sounds.length} Sounds</span>
                                {/* Optional: Carousel Dots for multiple sounds indicator */}
                                {/* <div className="flex space-x-1 mt-1">
                                    {pad.sounds.map((s, idx) => (
                                    <div key={idx} className={`w-1.5 h-1.5 rounded-full ${s.color.replace('bg-','border-').replace('-500','-300')} border opacity-80`}></div>
                                    ))}
                                </div> */}
                           </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-background text-foreground text-xs p-2 max-w-[150px]">
                            <ul className="list-none p-0 m-0 space-y-1">
                                {pad.sounds.map((s) => (
                                    <li key={s.soundId} className="flex items-center">
                                        <div className={`w-3 h-3 rounded-sm mr-2 shrink-0 ${s.color}`}></div>
                                        <span className="truncate">{s.soundName}</span>
                                    </li>
                                ))}
                            </ul>
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
                  onTouchStart={() => handlePadTouchStart(pad.id)}
                  onTouchEnd={() => handlePadTouchEnd(pad.id)}
                  className={cn(
                    "relative w-full h-full rounded-lg border-2 transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 active:scale-95",
                    bgColorClass, // Dynamic background based on state and sounds
                    borderColorClass,
                    isPadActive ? 'shadow-md' : 'hover:bg-muted hover:border-primary/50', // Style for active vs inactive pads
                    selectedPadId === pad.id ? 'ring-2 ring-ring ring-offset-2' : '', // Highlight selected pad
                    isCurrentBeat ? 'ring-4 ring-offset-2 ring-accent shadow-lg scale-105' : '', // Highlight playing beat
                    "opacity-0 animate-wave-fall", // Apply animation
                  )}
                   style={{ animationDelay: delay }} // Stagger animation
                  aria-label={`Pad ${pad.id + 1}. Status: ${pad.isActive ? (pad.sounds.length > 0 ? `${pad.sounds.length} sound${pad.sounds.length > 1 ? 's' : ''}` : 'Active, no sound') : 'Inactive'}. Short press to toggle activity. Long press to change sound${pad.sounds.length > 1 ? 's' : ''}.`}
                >
                  {padContent()} {/* Render the appropriate content */}
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
         onToggleSound={handleToggleSound} // Use the new handler
         selectedPadId={selectedPadId}
         currentPadSounds={currentSelectedPadData?.sounds || []} // Pass the array of sounds
         allSounds={allSounds} // Pass all available sounds
       />
     </TooltipProvider> // Close TooltipProvider
  );
}

    
