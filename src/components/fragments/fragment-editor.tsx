// src/components/fragments/fragment-editor.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Music2, Mic, Upload, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import SoundSelectionSheet from './sound-selection-sheet';
import type { Pad, Sound } from '@/lib/types';

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

export default function FragmentEditor({ initialPads = defaultPads, originalAuthor, originalFragmentId }: FragmentEditorProps) {
  const [pads, setPads] = useState<Pad[]>(initialPads);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedPadId, setSelectedPadId] = useState<number | null>(null);
  const [isSoundSheetOpen, setIsSoundSheetOpen] = useState(false);
  const [soundColorMap, setSoundColorMap] = useState<{ [soundId: string]: string }>({});
  const { toast } = useToast();
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartTimeRef = useRef<number>(0);

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

         // Ensure the initialPad itself has the color property set correctly
         // This seems redundant if initialPads *should* have the color, but acts as a fallback/correction
         if (!pad.color || pad.color !== color) {
            console.warn(`Correcting color for pad ${pad.id} with sound ${pad.soundId}`);
            // This won't directly mutate initialPads, might need a state update if correction is needed
             // For now, we just ensure the map is correct. The rendering logic will use the map.
         }
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
   }, [initialPads]); // Rerun if initialPads change (e.g., navigating between remix pages)


  const handlePadMouseDown = (id: number) => {
     touchStartTimeRef.current = Date.now();
     longPressTimerRef.current = setTimeout(() => {
      setSelectedPadId(id);
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
                // Clear sound/color if toggling off? Optional behavior.
                // sound: pad.isActive ? undefined : pad.sound,
                // soundId: pad.isActive ? undefined : pad.soundId,
                // color: pad.isActive ? undefined : pad.color,
             } : pad
            )
          );
          const targetPad = pads.find(p => p.id === id);
          toast({ title: `Pad ${id + 1} ${targetPad?.isActive ? 'Deactivated' : 'Activated'}` });
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
        soundColor = getRandomColor();
        setSoundColorMap(prevMap => ({
            ...prevMap,
            [sound.id]: soundColor,
        }));
    }

    setPads(currentPads =>
      currentPads.map(pad =>
        pad.id === selectedPadId ? {
            ...pad,
            isActive: true, // Activate pad
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
     setSelectedPadId(null); // Allow selecting pad *after* choosing sound? Or require long press.
     setIsSoundSheetOpen(true);
     toast({
       title: "Select Sound",
       description: "Opening sound library. Long press a pad first to assign.",
     });
  }

   const handlePostFragment = async () => {
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
    console.log("Posting Fragment:", { pads, originalAuthor, originalFragmentId });

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

    // Optionally clear state after posting (maybe not for remix?)
    // if (!originalFragmentId) {
    //   setPads(defaultPads);
    //   setSoundColorMap({});
    // }
  };


  return (
    <>
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-4 gap-2 md:gap-3 aspect-square mb-6">
            {pads.map((pad) => {
              const assignedColor = pad.isActive && pad.soundId ? soundColorMap[pad.soundId] : null;
              const bgColorClass = assignedColor || 'bg-secondary'; // Fallback to secondary if no color
              const borderColorClass = assignedColor ? 'border-transparent' : 'border-border'; // Transparent border if colored

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
                    bgColorClass, // Apply dynamic background color
                    borderColorClass, // Apply dynamic border color
                    pad.isActive ? 'shadow-md scale-105' : 'hover:bg-muted hover:border-primary/50',
                    selectedPadId === pad.id ? 'ring-2 ring-ring ring-offset-2' : '',
                    "animate-in fade-in zoom-in-95"
                  )}
                  style={{ animationDelay: `${pad.id * 20}ms` }}
                  aria-label={`Pad ${pad.id + 1} ${pad.isActive ? `Active with ${pad.sound}` : 'Inactive'}. Long press to change sound.`}
                >
                  {pad.isActive && pad.sound && (
                     <div className="absolute inset-0 flex flex-col items-center justify-center p-1 overflow-hidden">
                         {/* Use a consistent foreground color that works on all background colors */}
                        {pad.source === 'live' ? <Mic className="w-1/2 h-1/2 text-white/90 opacity-80 mb-1"/> : <Music2 className="w-1/2 h-1/2 text-white/90 opacity-80 mb-1" />}
                        <span className="text-xs text-white/90 opacity-90 truncate w-full text-center">{pad.sound}</span>
                     </div>
                  )}
                </button>
              );
            })}
          </div>
           <div className="flex justify-center space-x-4">
            <Button variant="outline" onClick={handleUploadClick}>
               <Upload className="mr-2 h-4 w-4" />
               Sounds Lib
             </Button>
             <Button
               variant="outline" // Keep outline, maybe change icon color if needed
               onClick={handleRecordClick}
               disabled // Disable until implemented
             >
               <Mic className="mr-2 h-4 w-4" />
               {isRecording ? 'Stop Recording' : 'Record Live'}
             </Button>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end p-4">
          <Button onClick={handlePostFragment}>
             <Check className="mr-2 h-4 w-4" />
             {originalFragmentId ? 'Post Remix' : 'Post Fragment'}
          </Button>
        </CardFooter>
      </Card>

       <SoundSelectionSheet
         isOpen={isSoundSheetOpen}
         onOpenChange={setIsSoundSheetOpen}
         onSelectSound={handleSelectSound}
         selectedPadId={selectedPadId}
       />
     </>
  );
}
