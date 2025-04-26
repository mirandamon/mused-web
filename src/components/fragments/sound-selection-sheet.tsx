import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Music, Search, XCircle, CheckCircle } from "lucide-react"; // Added CheckCircle
import type { Sound, PadSound } from "@/lib/types";
import { cn } from "@/lib/utils";
import React, { useState, useEffect, useMemo } from "react";
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge"; // Import Badge

interface SoundSelectionSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleSound: (sound: Sound) => void; // Renamed from onSelectSound to onToggleSound
  selectedPadId: number | null;
  currentPadSounds: PadSound[]; // Changed from currentPadSoundId to currentPadSounds array
  allSounds: Sound[];
}

export default function SoundSelectionSheet({
  isOpen,
  onOpenChange,
  onToggleSound, // Use the new prop name
  selectedPadId,
  currentPadSounds, // Use the new prop name
  allSounds
}: SoundSelectionSheetProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Get the IDs of currently selected sounds for quick lookup
  const currentSelectedSoundIds = useMemo(() => {
    return new Set(currentPadSounds.map(s => s.soundId));
  }, [currentPadSounds]);

  // Function to handle selecting/deselecting a sound tile
  const handleSoundToggle = (sound: Sound) => {
    onToggleSound(sound);
    // Do NOT close the sheet automatically, allow multiple selections/deselections
    // onOpenChange(false);
  };

  // Filter sounds based on search term
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
     if (isOpen) {
       setSearchTerm('');
     }
   }, [isOpen]);

  // Placeholder for removing *all* sounds - might need adjustment
  const handleRemoveAllSounds = () => {
      if (selectedPadId === null) return;
      // Call onToggleSound for each currently selected sound to remove them
      currentPadSounds.forEach(padSound => {
          const fullSound = allSounds.find(s => s.id === padSound.soundId);
          if (fullSound) {
              onToggleSound(fullSound);
          }
      });
      // Optionally close the sheet after removing all
      // onOpenChange(false);
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
                    Current Selection{currentPadSounds.length > 1 ? 's' : ''} ({currentPadSounds.length})
                </h4>
                {currentPadSounds.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={handleRemoveAllSounds} className="text-destructive hover:text-destructive-foreground hover:bg-destructive h-7 px-2">
                        <XCircle className="mr-1 h-4 w-4"/> Remove All
                    </Button>
                )}
             </div>
             {currentPadSounds.length > 0 ? (
                <ScrollArea className="h-24 border rounded-lg bg-muted/30 p-2"> {/* Make this area scrollable if many sounds */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {currentPadSounds.map((padSound) => {
                            // Find the full sound object for display properties
                            const fullSound = allSounds.find(s => s.id === padSound.soundId);
                            if (!fullSound) return null; // Should not happen if data is consistent
                            return (
                                <div key={padSound.soundId} className="relative">
                                     {/* Use a simplified tile or just text+color */}
                                     <Badge
                                        variant="secondary"
                                        className={cn(
                                            "flex items-center justify-between w-full h-auto py-1 px-2 text-left",
                                            padSound.color // Apply background color
                                         )}
                                        style={{ color: 'hsl(var(--accent-foreground))' }} // Ensure text contrast
                                     >
                                        <span className="text-xs font-medium truncate flex-1 mr-1">{padSound.soundName}</span>
                                         {/* Add a small remove button per selected sound */}
                                         <button
                                             onClick={() => handleSoundToggle(fullSound)}
                                             className="p-0.5 rounded-full bg-background/30 hover:bg-background/50 text-white/80 hover:text-white focus:outline-none focus:ring-1 focus:ring-ring"
                                             aria-label={`Remove ${padSound.soundName}`}
                                         >
                                             <XCircle className="h-3 w-3"/>
                                         </button>
                                     </Badge>
                                     {/*
                                     // Alternative: Use SoundTile component (might be too large)
                                     <SoundTile
                                         sound={fullSound}
                                         onSelect={() => handleSoundToggle(fullSound)} // Toggle on click
                                         isSelected // Always marked as selected here
                                         isCurrentSelectionTile // Add a prop to maybe simplify the display
                                     />
                                     // Add a remove button overlay?
                                     <button
                                         onClick={() => handleSoundToggle(fullSound)}
                                         className="absolute top-0 right-0 p-0.5 bg-destructive text-destructive-foreground rounded-bl-md rounded-tr-md z-10 opacity-80 hover:opacity-100"
                                         aria-label={`Remove ${fullSound.name}`}
                                     >
                                         <XCircle className="w-3 h-3"/>
                                     </button>
                                      */}
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
             ) : (
                <p className="text-sm text-muted-foreground px-2">No sounds assigned to Pad {selectedPadId + 1}.</p>
             )}
             <Separator className="my-4"/>
           </div>
         )}


        <ScrollArea className="flex-1 -mx-4">
           <div className="px-4 space-y-6">
            {(filteredPresetSounds.length > 0 || searchTerm === '') && (
              <section>
                <h3 className="text-lg font-semibold mb-3 px-2">Featured & Presets</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredPresetSounds.map((sound) => (
                    <SoundTile
                        key={sound.id}
                        sound={sound}
                        onSelect={handleSoundToggle} // Use toggle handler
                        isSelected={currentSelectedSoundIds.has(sound.id)} // Check if ID is in the set
                    />
                  ))}
                </div>
                {filteredPresetSounds.length === 0 && searchTerm !== '' && (
                    <p className="text-muted-foreground text-sm px-2">No preset sounds match your search.</p>
                )}
              </section>
            )}

            {(filteredMarketplaceSounds.length > 0 || searchTerm === '') && (
              <section>
                <h3 className="text-lg font-semibold mb-3 px-2">Marketplace</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredMarketplaceSounds.map((sound) => (
                     <SoundTile
                        key={sound.id}
                        sound={sound}
                        onSelect={handleSoundToggle} // Use toggle handler
                        isSelected={currentSelectedSoundIds.has(sound.id)} // Check if ID is in the set
                    />
                  ))}
                </div>
                {filteredMarketplaceSounds.length === 0 && searchTerm !== '' && (
                  <p className="text-muted-foreground text-sm px-2">No marketplace sounds match your search.</p>
                )}
                 {searchTerm === '' && (
                    <div className="text-center mt-4">
                        <Button variant="outline" disabled>Load More...</Button>
                    </div>
                 )}
              </section>
            )}
             {filteredSounds.length === 0 && searchTerm !== '' && (
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
  isCurrentSelectionTile?: boolean; // Optional flag for tiles in the "Current Selection" area
}

function SoundTile({ sound, onSelect, isSelected = false, isCurrentSelectionTile = false }: SoundTileProps) {
  return (
    <button
      onClick={() => onSelect(sound)}
      className={cn(
        "relative group overflow-hidden rounded-lg border aspect-square flex flex-col justify-end p-3 text-left transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        "bg-card text-card-foreground",
         sound.patternStyle,
         isSelected
           ? "ring-2 ring-accent ring-offset-2 shadow-lg scale-[1.03]"
           : "hover:shadow-lg hover:scale-[1.03]",
         // Add styles specific to current selection tile if needed
         isCurrentSelectionTile && "border-primary"
      )}
      // Disable button functionality for display-only tiles? Not needed if using Badge above.
      // disabled={isCurrentSelectionTile}
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
