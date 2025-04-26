'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Music2, Mic, Upload, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast"; // Import useToast

// Define the types for sound sources and pads
type SoundSource = 'prerecorded' | 'live';
interface Pad {
  id: number;
  sound?: string; // URL or identifier for the sound
  source?: SoundSource;
  isActive: boolean;
}

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
  const { toast } = useToast(); // Initialize toast

  const handlePadClick = (id: number) => {
    setSelectedPadId(id);
    // TODO: Implement sound selection/recording logic here
    // For now, just toggle the active state for visual feedback
    setPads(currentPads =>
      currentPads.map(pad =>
        pad.id === id ? { ...pad, isActive: !pad.isActive, sound: `sound_${id}`, source: 'prerecorded' } : pad
      )
    );
     toast({
      title: "Pad Updated",
      description: `Pad ${id + 1} ${pads.find(p=>p.id === id)?.isActive ? 'deactivated.' : 'activated with placeholder sound.'}`,
    });
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
    // TODO: Implement pre-recorded sound upload/selection logic
    toast({
      title: "Select Sound",
      description: "Sound selection feature not yet implemented. Tap a pad to assign placeholder.",
    });
  }

   const handlePostFragment = async () => {
    // TODO: Implement actual fragment posting logic (Server Action)
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
     // For now, just reset pads
    // setPads(defaultPads);
  };


  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-4 gap-2 md:gap-3 aspect-square mb-6">
          {pads.map((pad) => (
            <button
              key={pad.id}
              onClick={() => handlePadClick(pad.id)}
              className={cn(
                "relative w-full h-full rounded-lg border-2 transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                pad.isActive ? 'bg-accent border-accent shadow-md scale-105' : 'bg-secondary border-border hover:bg-muted hover:border-primary/50',
                selectedPadId === pad.id && !pad.isActive ? 'ring-2 ring-ring ring-offset-2' : '',
                 // Animate appearance
                "animate-in fade-in zoom-in-95"
              )}
              style={{ animationDelay: `${pad.id * 20}ms` }} // Stagger animation
              aria-label={`Pad ${pad.id + 1} ${pad.isActive ? 'Active' : 'Inactive'}`}
            >
              {pad.isActive && (
                 <div className="absolute inset-0 flex items-center justify-center">
                    {pad.source === 'live' ? <Mic className="w-1/2 h-1/2 text-accent-foreground opacity-70"/> : <Music2 className="w-1/2 h-1/2 text-accent-foreground opacity-70" />}
                 </div>
              )}
            </button>
          ))}
        </div>
         <div className="flex justify-center space-x-4">
          <Button variant="outline" onClick={handleUploadClick}>
             <Upload className="mr-2 h-4 w-4" />
             Sounds
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
  );
}
