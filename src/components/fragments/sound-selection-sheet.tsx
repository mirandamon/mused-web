import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Music, Search, XCircle, CheckCircle, AlertTriangle } from "lucide-react"; // Added AlertTriangle
import type { Sound, PadSound } from "@/lib/types";
import { cn } from "@/lib/utils";
import React, { useState, useMemo, useEffect } from "react";
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge";
import { presetSounds } from "@/lib/placeholder-sounds"; // Import only presets statically
import { useQuery, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Skeleton } from "../ui/skeleton"; // Import Skeleton
import { Alert, AlertDescription, AlertTitle } from "../ui/alert"; // Import Alert

interface SoundSelectionSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleSound: (sound: Sound) => void;
  selectedPadId: number | null;
  currentPadSounds: PadSound[];
  // Removed allSounds prop, will derive it internally
}

const queryClient = new QueryClient();

// Define the structure of the API response
interface SoundsApiResponse {
    sounds: Sound[];
    nextPageCursor: string | null;
}

// Function to fetch sounds from the API
const fetchSounds = async (): Promise<Sound[]> => {
    const apiUrl = process.env.NEXT_PUBLIC_MUSED_API_URL || 'http://localhost:3001';
    // TODO: Implement pagination later if needed. Fetching first 50 for now.
    const response = await fetch(`${apiUrl}/api/sounds?limit=50`);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch sounds');
    }
    const data: SoundsApiResponse = await response.json();
    // Map API response to frontend Sound type, providing defaults for missing fields
    return data.sounds.map(apiSound => ({
        ...apiSound,
        type: apiSound.source_type === 'predefined' ? 'preset' : 'marketplace', // Map source_type
        previewUrl: apiSound.source_url || '', // Use source_url as previewUrl, default to empty string
        author: apiSound.owner_user_id || 'Unknown', // Use owner_user_id as author
        // Generate a placeholder patternStyle based on ID or type for visual variety
        patternStyle: generatePatternStyle(apiSound.id),
    }));
};

// Helper to generate some visual variety for API sounds
const generatePatternStyle = (id: string): string => {
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const styles = [
        'bg-gradient-to-tl from-rose-400/20 to-orange-300/20 animate-gradient-xy-slow',
        'bg-gradient-to-tl from-lime-400/20 to-emerald-500/20 animate-gradient-xy-slow',
        'bg-gradient-to-tl from-sky-400/20 to-indigo-500/20 animate-gradient-xy-slow',
        'bg-gradient-to-tl from-fuchsia-500/20 to-purple-600/20 animate-gradient-xy-slow',
        'bg-gradient-to-tl from-red-500/20 to-orange-500/20 animate-gradient-xy-slow',
        'bg-gradient-to-tl from-amber-300/20 to-yellow-400/20 animate-gradient-xy-slow',
        'bg-gradient-to-tl from-cyan-400/20 to-blue-600/20 animate-gradient-xy-slow',
        'bg-gradient-to-tl from-violet-500/20 to-pink-500/20 animate-gradient-xy-slow',
    ];
    return styles[hash % styles.length];
}


// Wrapper component to provide QueryClient
export default function SoundSelectionSheetWrapper(props: SoundSelectionSheetProps) {
    return (
        <QueryClientProvider client={queryClient}>
            <SoundSelectionSheet {...props} />
        </QueryClientProvider>
    );
}


function SoundSelectionSheet({
  isOpen,
  onOpenChange,
  onToggleSound,
  selectedPadId,
  currentPadSounds,
}: SoundSelectionSheetProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch marketplace sounds using Tanstack Query
   const { data: apiSounds = [], isLoading, isError, error } = useQuery<Sound[], Error>({
     queryKey: ['sounds', 'marketplace'],
     queryFn: fetchSounds,
     staleTime: Infinity, // Keep data fresh indefinitely, fetch only once per session
     enabled: isOpen, // Only fetch when the sheet is open
     refetchOnWindowFocus: false, // Don't refetch on window focus
   });

  // Combine preset and fetched sounds
  const allSounds = useMemo(() => [...presetSounds, ...apiSounds], [apiSounds]);

  // Get the IDs of currently selected sounds for quick lookup
  const currentSelectedSoundIds = useMemo(() => {
    return new Set(currentPadSounds.map(s => s.soundId));
  }, [currentPadSounds]);

  // Function to handle selecting/deselecting a sound tile
  const handleSoundToggle = (sound: Sound) => {
    onToggleSound(sound);
    // Keep the sheet open for multiple changes
  };

  // Filter all sounds based on search term
  const filteredSounds = useMemo(() => {
     if (!searchTerm) return allSounds;
     const lowerCaseSearch = searchTerm.toLowerCase();
     return allSounds.filter(sound =>
        sound.name.toLowerCase().includes(lowerCaseSearch) ||
        sound.author?.toLowerCase().includes(lowerCaseSearch) ||
        sound.type.toLowerCase().includes(lowerCaseSearch)
     );
  }, [searchTerm, allSounds]);


  const filteredPresetSounds = filteredSounds.filter(s => s.type === 'preset');
  const filteredMarketplaceSounds = filteredSounds.filter(s => s.type === 'marketplace');

   useEffect(() => {
     // Clear search term when sheet opens
     if (isOpen) {
       setSearchTerm('');
     }
   }, [isOpen]);

  // Placeholder for removing *all* sounds - needs adjustment if needed
  const handleRemoveAllSounds = () => {
      if (selectedPadId === null) return;
      currentPadSounds.forEach(padSound => {
          const fullSound = allSounds.find(s => s.id === padSound.soundId);
          if (fullSound) {
              onToggleSound(fullSound);
          }
      });
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col p-4">
        <SheetHeader className="mb-4 pr-8">
          <SheetTitle>Manage Sounds {selectedPadId !== null ? `for Pad ${selectedPadId + 1}` : ''}</SheetTitle>
          <SheetDescription>Tap sounds to add or remove them from the selected pad.</SheetDescription>
           <div className="relative mt-4">
             <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
             <Input
               placeholder="Search sounds..."
               className="pl-10"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
           </div>
        </SheetHeader>

         {/* Current Selections Section */}
         {selectedPadId !== null && (
           <div className="mb-4 px-2">
             <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium text-muted-foreground">
                    Current Selection{currentPadSounds.length !== 1 ? 's' : ''} ({currentPadSounds.length})
                </h4>
                {currentPadSounds.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={handleRemoveAllSounds} className="text-destructive hover:text-destructive-foreground hover:bg-destructive h-7 px-2">
                        <XCircle className="mr-1 h-4 w-4"/> Remove All
                    </Button>
                )}
             </div>
             {currentPadSounds.length > 0 ? (
                <ScrollArea className="h-24 border rounded-lg bg-muted/30 p-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {currentPadSounds.map((padSound) => {
                            const fullSound = allSounds.find(s => s.id === padSound.soundId);
                            if (!fullSound) return null;
                            return (
                                <div key={padSound.soundId} className="relative">
                                     <Badge
                                        variant="secondary"
                                        className={cn(
                                            "flex items-center justify-between w-full h-auto py-1 px-2 text-left",
                                            padSound.color // Apply background color
                                         )}
                                        style={{ color: 'hsl(var(--accent-foreground))' }} // Ensure text contrast
                                     >
                                        <span className="text-xs font-medium truncate flex-1 mr-1">{padSound.soundName}</span>
                                         <button
                                             onClick={() => handleSoundToggle(fullSound)}
                                             className="p-0.5 rounded-full bg-background/30 hover:bg-background/50 text-white/80 hover:text-white focus:outline-none focus:ring-1 focus:ring-ring"
                                             aria-label={`Remove ${padSound.soundName}`}
                                         >
                                             <XCircle className="h-3 w-3"/>
                                         </button>
                                     </Badge>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
             ) : (
                <p className="text-sm text-muted-foreground px-2">No sounds assigned to Pad {selectedPadId === null ? '' : selectedPadId + 1}.</p>
             )}
             <Separator className="my-4"/>
           </div>
         )}


        <ScrollArea className="flex-1 -mx-4">
           <div className="px-4 space-y-6">
            {/* Preset Sounds Section */}
            {(filteredPresetSounds.length > 0 || searchTerm === '') && (
              <section>
                <h3 className="text-lg font-semibold mb-3 px-2">Featured & Presets</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredPresetSounds.map((sound) => (
                    <SoundTile
                        key={sound.id}
                        sound={sound}
                        onSelect={handleSoundToggle}
                        isSelected={currentSelectedSoundIds.has(sound.id)}
                    />
                  ))}
                </div>
                {filteredPresetSounds.length === 0 && searchTerm !== '' && (
                    <p className="text-muted-foreground text-sm px-2">No preset sounds match your search.</p>
                )}
              </section>
            )}

             {/* Marketplace Sounds Section */}
             <section>
                 <h3 className="text-lg font-semibold mb-3 px-2">Marketplace</h3>
                 {isLoading && (
                     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                         {Array.from({ length: 8 }).map((_, index) => (
                             <SoundTileSkeleton key={index} />
                         ))}
                     </div>
                 )}
                 {isError && (
                     <Alert variant="destructive" className="mt-4">
                         <AlertTriangle className="h-4 w-4" />
                         <AlertTitle>Error Fetching Sounds</AlertTitle>
                         <AlertDescription>
                             {error?.message || 'Could not load sounds from the marketplace. Please try again later.'}
                         </AlertDescription>
                     </Alert>
                 )}
                 {!isLoading && !isError && (
                    <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {filteredMarketplaceSounds.map((sound) => (
                                <SoundTile
                                    key={sound.id}
                                    sound={sound}
                                    onSelect={handleSoundToggle}
                                    isSelected={currentSelectedSoundIds.has(sound.id)}
                                />
                            ))}
                        </div>
                        {filteredMarketplaceSounds.length === 0 && searchTerm !== '' && !isLoading && (
                            <p className="text-muted-foreground text-sm px-2 mt-2">No marketplace sounds match your search.</p>
                        )}
                        {filteredMarketplaceSounds.length === 0 && searchTerm === '' && !isLoading && apiSounds.length === 0 && (
                            <p className="text-muted-foreground text-sm px-2 mt-2">No sounds found in the marketplace yet.</p>
                        )}
                        {/* TODO: Add Load More Button for pagination later */}
                        {/* {searchTerm === '' && !isLoading && nextPageCursor && (
                            <div className="text-center mt-4">
                                <Button variant="outline" disabled>Load More...</Button>
                            </div>
                        )} */}
                    </>
                 )}
             </section>

             {/* Fallback if search yields no results across both sections */}
             {filteredPresetSounds.length === 0 && filteredMarketplaceSounds.length === 0 && searchTerm !== '' && !isLoading && (
                <p className="text-center text-muted-foreground mt-6">No sounds found matching "{searchTerm}".</p>
             )}
          </div>
        </ScrollArea>

        <SheetFooter className="mt-4 p-4 border-t">
            <Button onClick={() => onOpenChange(false)}>Done</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}


// Sound Tile Component
interface SoundTileProps {
  sound: Sound;
  onSelect: (sound: Sound) => void;
  isSelected?: boolean;
}

function SoundTile({ sound, onSelect, isSelected = false }: SoundTileProps) {
  return (
    <button
      onClick={() => onSelect(sound)}
      className={cn(
        "relative group overflow-hidden rounded-lg border aspect-square flex flex-col justify-end p-3 text-left transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        "bg-card text-card-foreground",
         sound.patternStyle || 'bg-gradient-to-br from-muted to-secondary', // Use pattern or default
         isSelected
           ? "ring-2 ring-accent ring-offset-2 shadow-lg scale-[1.03]"
           : "hover:shadow-lg hover:scale-[1.03]"
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent z-0" />

      <div className="relative z-10">
         <Music className="w-5 h-5 mb-1 text-white/80 opacity-70 group-hover:opacity-100 transition-opacity"/>
         <p className="font-semibold text-sm text-white truncate">{sound.name}</p>
         {sound.author && <p className="text-xs text-white/70 truncate">{sound.author}</p>}
      </div>
      {/* Visual cue for selection (Checkmark) */}
       {isSelected && (
         <div className="absolute top-1.5 right-1.5 z-10 p-0.5 bg-accent/80 rounded-full backdrop-blur-sm">
           <CheckCircle className="w-4 h-4 text-accent-foreground" />
         </div>
       )}
    </button>
  );
}

// Skeleton Loader for Sound Tile
function SoundTileSkeleton() {
    return (
        <Skeleton className="relative group overflow-hidden rounded-lg border aspect-square flex flex-col justify-end p-3">
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent z-0" />
            <div className="relative z-10 space-y-1.5">
                <Skeleton className="w-5 h-5 bg-muted/50" />
                <Skeleton className="w-3/4 h-4 bg-muted/50" />
                <Skeleton className="w-1/2 h-3 bg-muted/50" />
            </div>
        </Skeleton>
    );
}
