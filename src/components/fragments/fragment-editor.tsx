// src/components/fragments/fragment-editor.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Music2, Mic, Upload, Check, Play, Pause, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import SoundSelectionSheet from './sound-selection-sheet';
import type { Pad, Sound } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { presetSounds, marketplaceSounds } from '@/lib/placeholder-sounds'; // Import sounds for lookup

// Define a palette of Tailwind background color classes
const colorPalette: string[] = [
  'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
  'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
  'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
  'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
  'bg-rose-500',
  // Add darker/lighter variants if needed, ensure they contrast with accent foreground
  'bg-red-600', 'bg-orange-600', 'bg-blue-600', 'bg-green-600', 'bg-purple-600',
];

interface FragmentEditorProps {
  initialPads?: Pad[];
  originalAuthor?: string;
  originalFragmentId?: string;
}

const defaultPads: Pad[] = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  isActive: false,
}));

// Helper function to get a random color from the palette
const getRandomColor = (): string => {
  return colorPalette[Math.floor(Math.random() * colorPalette.length)];
};

// Combine sounds for easier lookup
const allSounds = [...presetSounds, ...marketplaceSounds];

export default function FragmentEditor({ initialPads = defaultPads, originalAuthor, originalFragmentId }: FragmentEditorProps) {
  const [pads, setPads] = useState<Pad[]>(initialPads);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedPadId, setSelectedPadId] = useState<number | null>(null);
  const [currentSelectedPadData, setCurrentSelectedPadData] = useState<Pad | null>(null); // Store full pad data for the sheet
  const [isSoundSheetOpen, setIsSoundSheetOpen] = useState(false);
  const [soundColorMap, setSoundColorMap] = useState<{ [soundId: string]: string }>({});
  const { toast } = useToast();
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartTimeRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState<number | null>(null);
  const [bpm, setBpm] = useState<number>(120);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const LONG_PRESS_DURATION = 500; // milliseconds

   // Initialize color map from initial pads
   useEffect(() => {
     const initialColorMap: { [soundId: string]: string } = {};
     let availableColors = [...colorPalette]; // Create a mutable copy

     initialPads.forEach(pad => {
       if (pad.isActive && pad.soundId && !initialColorMap[pad.soundId]) {
         // Assign existing color if provided, otherwise pick a new one
         let color = pad.color;
         if (!color || !colorPalette.includes(color)) {
            if (availableColors.length === 0) availableColors = [...colorPalette]; // Replenish if needed
            const randomIndex = Math.floor(Math.random() * availableColors.length);
            color = availableColors.splice(randomIndex, 1)[0];
         } else {
            // Remove used color from available pool if it exists
            const colorIndex = availableColors.indexOf(color);
            if (colorIndex > -1) {
                availableColors.splice(colorIndex, 1);
            }
         }
         initialColorMap[pad.soundId] = color;
       }
     });

     // Also update pads state to ensure colors are applied if they weren't in initialPads prop
     setPads(currentPads => currentPads.map(pad => {
        if (pad.isActive && pad.soundId && initialColorMap[pad.soundId]) {
            return { ...pad, color: initialColorMap[pad.soundId] };
        }
        return pad;
     }));

     setSoundColorMap(initialColorMap);
   }, [initialPads]);


  const handlePadMouseDown = (id: number) => {
     touchStartTimeRef.current = Date.now();
     longPressTimerRef.current = setTimeout(() => {
      setSelectedPadId(id);
      const padData = pads.find(p => p.id === id) || null; // Find the pad data
      setCurrentSelectedPadData(padData); // Set current pad data for the sheet
      setIsSoundSheetOpen(true);
      longPressTimerRef.current = null; // Clear timer after triggering long press
    }, LONG_PRESS_DURATION);
  };

   const handlePadMouseUp = (id: number) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;

      const pressDuration = Date.now() - touchStartTimeRef.current;
      if (pressDuration < LONG_PRESS_DURATION) {
          // Short press action: Toggle pad active state
          setPads(currentPads =>
            currentPads.map(pad =>
              pad.id === id ? {
                ...pad,
                isActive: !pad.isActive,
                // Keep sound/color when toggling for potential reactivation
             } : pad
            )
          );
          const targetPad = pads.find(p => p.id === id);
          // Only show toast if a sound is assigned or if activating
          if (targetPad?.soundId || !targetPad?.isActive) {
             toast({ title: `Pad ${id + 1} ${targetPad?.isActive ? 'Deactivated' : 'Activated'}` });
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

  const handleSelectSound = (sound: Sound) => {
    if (selectedPadId === null) return;

    let soundColor = soundColorMap[sound.id];

    // If sound is new, assign a random color
    if (!soundColor) {
        let availableColors = [...colorPalette];
        // Make sure to not pick a color already assigned to another sound
        const assignedColors = Object.values(soundColorMap);
        availableColors = availableColors.filter(c => !assignedColors.includes(c));

        if (availableColors.length === 0) availableColors = [...colorPalette]; // Replenish if needed (less ideal)
        const randomIndex = Math.floor(Math.random() * availableColors.length);
        soundColor = availableColors[randomIndex]; // Don't splice, just pick
        setSoundColorMap(prevMap => ({
            ...prevMap,
            [sound.id]: soundColor,
        }));
    }


    setPads(currentPads =>
      currentPads.map(pad =>
        pad.id === selectedPadId ? {
            ...pad,
            isActive: true, // Ensure pad is active
            sound: sound.name,
            soundId: sound.id, // Store unique sound ID
            soundUrl: sound.previewUrl,
            source: sound.type === 'preset' ? 'prerecorded' : 'prerecorded', // Placeholder source
            color: soundColor, // Assign the color class
        } : pad
      )
    );

    toast({
      title: "Sound Assigned",
      description: `${sound.name} assigned to Pad ${selectedPadId + 1}.`,
    });

    setSelectedPadId(null); // Reset selected pad ID
    setCurrentSelectedPadData(null); // Reset current pad data
  };


  const handleRecordClick = () => {
    // Placeholder for future live recording assignment
    setIsRecording(!isRecording);
     toast({
      title: isRecording ? "Recording Stopped" : "Live Recording (Not Implemented)",
      description: isRecording ? "Stopped live recording mode." : "Tap a pad to assign live audio (feature coming soon).",
      variant: "default",
    });
  };

  const handleUploadClick = () => {
     // Opens the sheet without a pre-selected pad target
     setSelectedPadId(null);
     setCurrentSelectedPadData(null); // No current pad when opened via button
     setIsSoundSheetOpen(true);
     toast({
       title: "Select Sound",
       description: "Opening sound library. Long press a pad first to assign.",
     });
  }

   const handlePostFragment = async () => {
    if (isPlaying) {
        handlePlayPause(); // Stop playback before posting
    }
    const activePads = pads.filter(p => p.isActive && p.soundId); // Ensure pad has a sound
    if (activePads.length === 0) {
        toast({
            variant: "destructive",
            title: "Empty Fragment",
            description: "Add at least one sound to a pad before posting.",
        });
        return;
    }

    // TODO: Implement actual fragment posting logic (Server Action)
    // The 'pads' state now includes the 'color' and 'soundId'
    console.log("Posting Fragment:", { pads, bpm, originalAuthor, originalFragmentId });

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    toast({
      title: "Fragment Posted!",
      description: originalFragmentId ? `Your remix of ${originalAuthor}'s fragment is live.` : "Your new fragment is live.",
      action: (
         <Button variant="outline" size="sm" onClick={() => window.location.href = '/'}>
            View Feed
         </Button>
      ),
    });
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

    const beatDuration = (60 / bpm) * 1000; // milliseconds per beat

    playbackIntervalRef.current = setInterval(() => {
      setCurrentBeat(prevBeat => {
        const nextBeat = (prevBeat !== null ? prevBeat + 1 : 0) % 16;
        // TODO: Trigger sound playback for pads[nextBeat] if it's active
        // console.log(`Beat: ${nextBeat}, Sound: ${pads[nextBeat]?.sound}`);
        const padToPlay = pads[nextBeat];
        if (padToPlay?.isActive && padToPlay.soundUrl) {
             // Basic audio playback - needs more robust implementation
             // Consider using Web Audio API for better control & timing
             // const audio = new Audio(padToPlay.soundUrl);
             // audio.play().catch(e => console.error("Error playing sound:", e));
        }

        return nextBeat;
      });
    }, beatDuration);
  }, [bpm, pads]); // Include pads dependency for sound lookup

  const handlePlayPause = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  };

  const handleBpmChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newBpm = parseInt(event.target.value, 10);
    if (!isNaN(newBpm) && newBpm > 0 && newBpm <= 300) { // Basic validation
      setBpm(newBpm);
    } else if (event.target.value === '') {
       // Allow clearing the input, maybe set a default or keep last valid value?
       // For now, let's reset to 120 if cleared incorrectly, or handle NaN better
       setBpm(120);
    }
  };

  // Effect to handle changes in isPlaying or bpm
  useEffect(() => {
    if (isPlaying) {
      // Restart interval with new BPM if it changed while playing
      startPlayback();
    } else {
       // Ensure interval is cleared if isPlaying becomes false
       stopPlayback();
    }
    // Cleanup function to clear interval on component unmount or when dependencies change
    return stopPlayback;
  }, [isPlaying, bpm, startPlayback, stopPlayback]);

   const handleSheetOpenChange = (open: boolean) => {
     setIsSoundSheetOpen(open);
     if (!open) {
       // Clear selection when sheet closes
       setSelectedPadId(null);
       setCurrentSelectedPadData(null);
     }
   };


  return (
    <>
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-4 gap-2 md:gap-3 aspect-square mb-6">
            {pads.map((pad, index) => {
              // Use pad.color directly if available, otherwise fallback
              const assignedColor = pad.isActive && pad.color ? pad.color : null;
              const bgColorClass = assignedColor || 'bg-secondary'; // Fallback to secondary
              const borderColorClass = assignedColor ? 'border-transparent' : 'border-border';
              const isCurrentBeat = isPlaying && currentBeat === pad.id;
              const row = Math.floor(index / 4); // Calculate row index (0-3)
              const delay = `${row * 100}ms`; // Stagger animation based on row

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
                    bgColorClass,
                    borderColorClass,
                    pad.isActive && pad.soundId ? 'shadow-md' : 'hover:bg-muted hover:border-primary/50', // Only shadow if active+sound
                    selectedPadId === pad.id ? 'ring-2 ring-ring ring-offset-2' : '',
                    isCurrentBeat ? 'ring-4 ring-offset-2 ring-accent shadow-lg scale-105' : '',
                    "opacity-0 animate-wave-fall",
                  )}
                   style={{ animationDelay: delay }}
                  aria-label={`Pad ${pad.id + 1} ${pad.isActive && pad.sound ? `Active with ${pad.sound}` : 'Inactive'}. Long press to change sound.`}
                >
                  {pad.isActive && pad.sound && (
                     <div className="absolute inset-0 flex flex-col items-center justify-center p-1 overflow-hidden">
                        {/* Consistent white text for better contrast on various colors */}
                        {pad.source === 'live' ? <Mic className="w-1/2 h-1/2 text-white/90 opacity-80 mb-1"/> : <Music2 className="w-1/2 h-1/2 text-white/90 opacity-80 mb-1" />}
                        <span className="text-xs text-white/90 opacity-90 truncate w-full text-center">{pad.sound}</span>
                     </div>
                  )}
                  {/* Empty state indicator for inactive pads */}
                  {!pad.isActive && <div className="absolute inset-0 flex items-center justify-center"><div className="w-3 h-3 rounded-full bg-muted-foreground/20"></div></div>}
                  {/* Active but no sound indicator */}
                  {pad.isActive && !pad.sound && <div className="absolute inset-0 flex items-center justify-center"><div className="w-3 h-3 rounded-full bg-primary/30 animate-pulse"></div></div>}
                </button>
              );
            })}
          </div>
           <div className="flex justify-between items-center space-x-4">
             {/* Left Controls: Play/Pause and BPM */}
             <div className="flex items-center space-x-2">
               <Button variant="ghost" size="icon" onClick={handlePlayPause} aria-label={isPlaying ? "Pause fragment" : "Play fragment"}>
                 {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
               </Button>

               <Popover>
                  <PopoverTrigger asChild>
                     <Button variant="ghost" size="icon" aria-label="Playback Settings">
                       <Settings2 className="h-5 w-5" />
                     </Button>
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
               <span className="text-sm text-muted-foreground tabular-nums">{bpm} BPM</span>
             </div>

             {/* Right Controls: Sound Lib and Record */}
             <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={handleUploadClick}>
                   <Upload className="mr-2 h-4 w-4" />
                   Sounds
                 </Button>
                 <Button
                   variant="outline"
                   size="sm"
                   onClick={handleRecordClick}
                   disabled // Disable until implemented
                 >
                   <Mic className="mr-2 h-4 w-4" />
                   Record
                 </Button>
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

       <SoundSelectionSheet
         isOpen={isSoundSheetOpen}
         onOpenChange={handleSheetOpenChange} // Use controlled state handler
         onSelectSound={handleSelectSound}
         selectedPadId={selectedPadId}
         currentPadSoundId={currentSelectedPadData?.soundId} // Pass the sound ID of the selected pad
         allSounds={allSounds} // Pass all sounds for lookup
       />
     </>
  );
}
