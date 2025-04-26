import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Music, Search } from "lucide-react";
import { presetSounds, marketplaceSounds } from "@/lib/placeholder-sounds";
import type { Sound } from "@/lib/types";
import { cn } from "@/lib/utils";
import React, { useState } from "react"; // Import React and useState

interface SoundSelectionSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSound: (sound: Sound) => void;
  selectedPadId: number | null;
}

export default function SoundSelectionSheet({
  isOpen,
  onOpenChange,
  onSelectSound,
  selectedPadId
}: SoundSelectionSheetProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSoundSelect = (sound: Sound) => {
    onSelectSound(sound);
    onOpenChange(false); // Close sheet after selection
  };

  // Filter sounds based on search term (simple implementation)
  const filteredPresetSounds = presetSounds.filter(sound =>
    sound.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredMarketplaceSounds = marketplaceSounds.filter(sound =>
    sound.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sound.author?.toLowerCase().includes(searchTerm.toLowerCase())
  );


  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[75vh] flex flex-col p-4">
        <SheetHeader className="mb-4">
          <SheetTitle>Select Sound for Pad {selectedPadId !== null ? selectedPadId + 1 : ''}</SheetTitle>
          <SheetDescription>Choose from presets or explore the marketplace.</SheetDescription>
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

        <ScrollArea className="flex-1 -mx-4">
           <div className="px-4 space-y-6">
            {/* Featured & Preset Sounds */}
            {(filteredPresetSounds.length > 0 || searchTerm === '') && (
              <section>
                <h3 className="text-lg font-semibold mb-3 px-2">Featured & Presets</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredPresetSounds.map((sound) => (
                    <SoundTile key={sound.id} sound={sound} onSelect={handleSoundSelect} />
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
                    <SoundTile key={sound.id} sound={sound} onSelect={handleSoundSelect} />
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
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}


// Sound Tile Component
interface SoundTileProps {
  sound: Sound;
  onSelect: (sound: Sound) => void;
}

function SoundTile({ sound, onSelect }: SoundTileProps) {
  return (
    <button
      onClick={() => onSelect(sound)}
      className={cn(
        "relative group overflow-hidden rounded-lg border aspect-square flex flex-col justify-end p-3 text-left transition-all duration-300 ease-in-out hover:shadow-lg hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        "bg-card text-card-foreground", // Base background/text
         sound.patternStyle // Apply dynamic background animation style
      )}
    >
      {/* Subtle pattern overlay if needed, or rely purely on animated background */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent z-0" />

      <div className="relative z-10">
         <Music className="w-5 h-5 mb-1 text-white/80 opacity-70 group-hover:opacity-100 transition-opacity"/>
         <p className="font-semibold text-sm text-white truncate">{sound.name}</p>
         {sound.author && <p className="text-xs text-white/70 truncate">{sound.author}</p>}
      </div>
    </button>
  );
}
