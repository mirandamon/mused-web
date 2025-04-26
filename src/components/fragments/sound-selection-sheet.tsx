import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Music, Search, XCircle } from "lucide-react";
import type { Sound } from "@/lib/types";
import { cn } from "@/lib/utils";
import React, { useState, useEffect, useMemo } from "react";
import { Separator } from "../ui/separator";

interface SoundSelectionSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSound: (sound: Sound) => void;
  selectedPadId: number | null;
  currentPadSoundId?: string | null; // ID of the sound currently assigned to the pad
  allSounds: Sound[]; // All available sounds for lookup
}

export default function SoundSelectionSheet({
  isOpen,
  onOpenChange,
  onSelectSound,
  selectedPadId,
  currentPadSoundId,
  allSounds
}: SoundSelectionSheetProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Find the full Sound object for the currentPadSoundId
  const currentSelectedSound = useMemo(() => {
    if (!currentPadSoundId) return null;
    return allSounds.find(sound => sound.id === currentPadSoundId) || null;
  }, [currentPadSoundId, allSounds]);

  const handleSoundSelect = (sound: Sound) => {
    onSelectSound(sound);
    onOpenChange(false); // Close the sheet after selection
  };

  // Filter sounds based on search term (simple implementation)
  const filteredSounds = useMemo(() => {
     if (!searchTerm) return allSounds; // Return all if no search term
     const lowerCaseSearch = searchTerm.toLowerCase();
     return allSounds.filter(sound =>
        sound.name.toLowerCase().includes(lowerCaseSearch) ||
        sound.author?.toLowerCase().includes(lowerCaseSearch) ||
        sound.type.toLowerCase().includes(lowerCaseSearch)
     );
  }, [searchTerm, allSounds]);


  // Separate filtered sounds into preset and marketplace
  const filteredPresetSounds = filteredSounds.filter(s => s.type === 'preset');
  const filteredMarketplaceSounds = filteredSounds.filter(s => s.type === 'marketplace');

   // Reset search term when sheet opens
   useEffect(() => {
     if (isOpen) {
       setSearchTerm('');
     }
   }, [isOpen]);

  // Placeholder for removing sound - this needs implementation in FragmentEditor
  const handleRemoveSound = () => {
      // This function should likely call a prop passed down from FragmentEditor
      // to update the pad state, removing the sound.
      console.log("Remove sound clicked - needs implementation in parent");
       // Example: onRemoveSound(selectedPadId);
       onOpenChange(false); // Close sheet after removing
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col p-4">
        <SheetHeader className="mb-4 pr-8"> {/* Add padding-right to avoid close button overlap */}
          <SheetTitle>Select Sound {selectedPadId !== null ? `for Pad ${selectedPadId + 1}` : ''}</SheetTitle>
          <SheetDescription>Choose from presets or explore the marketplace. Tap a sound to assign it.</SheetDescription>
           <div className="relative mt-4">
             <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
             <Input
               placeholder="Search sounds by name, author, or type..."
               className="pl-10"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
           </div>
        </SheetHeader>

         {/* Current Selection Section */}
         {selectedPadId !== null && currentSelectedSound && (
           <div className="mb-4 px-2">
             <h4 className="text-sm font-medium text-muted-foreground mb-2">Current Selection</h4>
             <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                <SoundTile
                    sound={currentSelectedSound}
                    onSelect={() => {}} // No action on click here
                    isSelected // Add isSelected prop
                />
                <Button variant="ghost" size="sm" onClick={handleRemoveSound} className="text-destructive hover:text-destructive-foreground hover:bg-destructive">
                  <XCircle className="mr-2 h-4 w-4"/> Remove
                </Button>
             </div>
             <Separator className="my-4"/>
           </div>
         )}
         {/* If pad is selected but has no sound */}
          {selectedPadId !== null && !currentSelectedSound && (
            <div className="mb-4 px-2">
                <p className="text-sm text-muted-foreground px-2">No sound assigned to Pad {selectedPadId + 1}.</p>
                 <Separator className="my-4"/>
            </div>
          )}


        <ScrollArea className="flex-1 -mx-4">
           <div className="px-4 space-y-6">
            {/* Preset Sounds */}
            {(filteredPresetSounds.length > 0 || searchTerm === '') && (
              <section>
                <h3 className="text-lg font-semibold mb-3 px-2">Featured & Presets</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredPresetSounds.map((sound) => (
                    <SoundTile
                        key={sound.id}
                        sound={sound}
                        onSelect={handleSoundSelect}
                        isSelected={sound.id === currentPadSoundId} // Highlight if selected
                    />
                  ))}
                </div>
                {filteredPresetSounds.length === 0 && searchTerm !== '' && (
                    <p className="text-muted-foreground text-sm px-2">No preset sounds match your search.</p>
                )}
              </section>
            )}

            {/* Sound Marketplace */}
            {(filteredMarketplaceSounds.length > 0 || searchTerm === '') && (
              <section>
                <h3 className="text-lg font-semibold mb-3 px-2">Marketplace</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredMarketplaceSounds.map((sound) => (
                     <SoundTile
                        key={sound.id}
                        sound={sound}
                        onSelect={handleSoundSelect}
                        isSelected={sound.id === currentPadSoundId} // Highlight if selected
                    />
                  ))}
                   {/* TODO: Implement infinite scroll */}
                </div>
                {filteredMarketplaceSounds.length === 0 && searchTerm !== '' && (
                  <p className="text-muted-foreground text-sm px-2">No marketplace sounds match your search.</p>
                )}
                 {searchTerm === '' && (
                    <div className="text-center mt-4">
                        <Button variant="outline" disabled>Load More...</Button> {/* Placeholder for infinite scroll */}
                    </div>
                 )}
              </section>
            )}
             {filteredSounds.length === 0 && searchTerm !== '' && (
                <p className="text-center text-muted-foreground mt-6">No sounds found matching "{searchTerm}".</p>
             )}
          </div>
        </ScrollArea>

         {/* Optional Footer */}
         {/* <SheetFooter className="mt-4 p-4 border-t">
           <Button onClick={() => onOpenChange(false)}>Close</Button>
         </SheetFooter> */}
      </SheetContent>
    </Sheet>
  );
}


// Sound Tile Component
interface SoundTileProps {
  sound: Sound;
  onSelect: (sound: Sound) => void;
  isSelected?: boolean; // Optional prop to indicate selection
}

function SoundTile({ sound, onSelect, isSelected = false }: SoundTileProps) {
  return (
    <button
      onClick={() => onSelect(sound)}
      className={cn(
        "relative group overflow-hidden rounded-lg border aspect-square flex flex-col justify-end p-3 text-left transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        "bg-card text-card-foreground", // Base background/text
         sound.patternStyle, // Apply dynamic background animation style
         isSelected
           ? "ring-2 ring-accent ring-offset-2 shadow-lg scale-[1.03]" // Style for selected tile
           : "hover:shadow-lg hover:scale-[1.03]", // Hover style for non-selected tile
         // Disable hover effect if it's the 'current selection' display tile
         // Update: Allow clicking selected tile to re-select/confirm
         // isSelected && 'pointer-events-none'
      )}
      // Disable the button behavior if it's just for display (Current Selection tile)
      disabled={isSelected && onSelect === (() => {})} // Rough check if it's display only
    >
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent z-0" />

      <div className="relative z-10">
         <Music className="w-5 h-5 mb-1 text-white/80 opacity-70 group-hover:opacity-100 transition-opacity"/>
         <p className="font-semibold text-sm text-white truncate">{sound.name}</p>
         {sound.author && <p className="text-xs text-white/70 truncate">{sound.author}</p>}
      </div>
       {/* Optional: Add a visual cue for selection, like a checkmark */}
       {/* {isSelected && (
         <div className="absolute top-2 right-2 z-10 p-1 bg-accent rounded-full">
           <Check className="w-3 h-3 text-accent-foreground" />
         </div>
       )} */}
    </button>
  );
}
