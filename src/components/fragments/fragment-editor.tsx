'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Music2, Mic, Upload, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import SoundSelectionSheet from './sound-selection-sheet'; // Import the new sheet component
import type { Pad, Sound } from '@/lib/types';

interface FragmentEditorProps {
  initialPads?: Pad[];
  originalAuthor?: string;
  originalFragmentId?: string;
}

const defaultPads: Pad[] = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  isActive: false,
}));

export default function FragmentEditor({ initialPads = defaultPads, originalAuthor, originalFragmentId }: FragmentEditorProps) {
  const [pads, setPads] = useState<Pad[]>(initialPads);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedPadId, setSelectedPadId] = useState<number | null>(null);
  const [isSoundSheetOpen, setIsSoundSheetOpen] = useState(false);
  const { toast } = useToast();
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartTimeRef = useRef<number>(0);

  const LONG_PRESS_DURATION = 500; // milliseconds

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

      // If the press was short, handle as a simple toggle or other action
      const pressDuration = Date.now() - touchStartTimeRef.current;
      if (pressDuration < LONG_PRESS_DURATION) {
         // Short press action: e.g., toggle activation or select for quick actions
         // For now, let's just log it or prepare for a different interaction
          console.log(`Short press on pad ${id + 1}`);
          // Optionally toggle pad active state here for immediate feedback if desired
          // setPads(currentPads =>
          //   currentPads.map(pad =>
          //     pad.id === id ? { ...pad, isActive: !pad.isActive } : pad
          //   )
          // );
          // toast({ title: `Pad ${id + 1} selected` });
      }
    }
     touchStartTimeRef.current = 0; // Reset start time
  };

   const handlePadTouchStart = (id: number) => handlePadMouseDown(id);
   const handlePadTouchEnd = (id: number) => handlePadMouseUp(id);

  // Clear timer if mouse leaves the button before timeout
  const handlePadMouseLeave = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
     touchStartTimeRef.current = 0; // Reset start time
  };

  const handleSelectSound = (sound: Sound) => {
    if (selectedPadId === null) return;

    setPads(currentPads =>
      currentPads.map(pad =>
        pad.id === selectedPadId ? {
            ...pad,
            isActive: true, // Activate pad when sound is assigned
            sound: sound.name,
            soundUrl: sound.previewUrl, // Store sound details
            source: sound.type === 'preset' ? 'prerecorded' : 'prerecorded' // Treat marketplace as prerecorded for now
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
    setIsRecording(!isRecording);
     toast({
      title: isRecording ? "Recording Stopped" : "Recording Started",
      description: isRecording ? "Stopped live recording." : "Started live recording. Tap a pad to assign.",
    });
    // TODO: Implement actual recording logic
  };

  const handleUploadClick = () => {
    // This might be deprecated in favor of the long-press sheet, or used for bulk upload?
     // For now, opens the sheet targeting no specific pad (or the last selected one?)
     setSelectedPadId(null); // Or keep track of last active pad
     setIsSoundSheetOpen(true);
    toast({
      title: "Select Sound",
      description: "Opening sound library.",
    });
  }

   const handlePostFragment = async () => {
    // TODO: Implement actual fragment posting logic (Server Action)
    const activePads = pads.filter(p => p.isActive);
    if (activePads.length === 0) {
        toast({
            variant: "destructive",
            title: "Empty Fragment",
            description: "Add at least one sound to a pad before posting.",
        });
        return;
    }

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

    // Optionally redirect or clear state after posting
     // Consider clearing pads only if it's NOT a remix session?
     // setPads(defaultPads);
  };


  return (
    <>
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-4 gap-2 md:gap-3 aspect-square mb-6">
            {pads.map((pad) => (
              <button
                key={pad.id}
                onMouseDown={() => handlePadMouseDown(pad.id)}
                onMouseUp={() => handlePadMouseUp(pad.id)}
                onMouseLeave={handlePadMouseLeave}
                onTouchStart={() => handlePadTouchStart(pad.id)}
                onTouchEnd={() => handlePadTouchEnd(pad.id)}
                className={cn(
                  "relative w-full h-full rounded-lg border-2 transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 active:scale-95", // Added active scale
                  pad.isActive ? 'bg-accent border-accent shadow-md scale-105' : 'bg-secondary border-border hover:bg-muted hover:border-primary/50',
                  selectedPadId === pad.id ? 'ring-2 ring-ring ring-offset-2' : '', // Indicate selection for sheet target
                   // Animate appearance
                  "animate-in fade-in zoom-in-95"
                )}
                style={{ animationDelay: `${pad.id * 20}ms` }} // Stagger animation
                aria-label={`Pad ${pad.id + 1} ${pad.isActive ? `Active with ${pad.sound}` : 'Inactive'}. Long press to change sound.`}
              >
                {pad.isActive && (
                   <div className="absolute inset-0 flex flex-col items-center justify-center p-1 overflow-hidden">
                      {pad.source === 'live' ? <Mic className="w-1/2 h-1/2 text-accent-foreground opacity-70 mb-1"/> : <Music2 className="w-1/2 h-1/2 text-accent-foreground opacity-70 mb-1" />}
                      <span className="text-xs text-accent-foreground opacity-90 truncate w-full text-center">{pad.sound}</span>
                   </div>
                )}
                 {/* Visual indicator for long press? Maybe subtle background pulse? */}
              </button>
            ))}
          </div>
           <div className="flex justify-center space-x-4">
             {/* Keep Upload button if it serves a different purpose, or remove */}
            <Button variant="outline" onClick={handleUploadClick}>
               <Upload className="mr-2 h-4 w-4" />
               Sounds Lib
             </Button>
             <Button
               variant={isRecording ? "destructive" : "outline"}
               onClick={handleRecordClick}
             >
               <Mic className="mr-2 h-4 w-4" />
               {isRecording ? 'Stop Recording' : 'Record Live'}
             </Button>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end p-4">
          <Button onClick={handlePostFragment}>
             <Check className="mr-2 h-4 w-4" />
             Post Fragment
          </Button>
        </CardFooter>
      </Card>

       {/* Sound Selection Sheet */}
       <SoundSelectionSheet
         isOpen={isSoundSheetOpen}
         onOpenChange={setIsSoundSheetOpen}
         onSelectSound={handleSelectSound}
         selectedPadId={selectedPadId}
       />
     </>
  );
}
