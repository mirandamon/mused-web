// src/components/fragments/fragment-post.tsx
'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, GitFork, Play, Pause, Layers, Volume2, VolumeX } from 'lucide-react'; // Added Layers, Volume icons
import type { Fragment, Pad, PadSound, Comment } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Import Tooltip components
// Import the client-side color helper
import { getOrAssignSoundColor } from './fragment-editor';
import { ref, getDownloadURL } from "firebase/storage"; // Correct Firebase Storage imports
import { storage } from "@/lib/firebase/clientApp"; // Import client storage instance

interface FragmentPostProps {
  fragment: Fragment;
}

// Global map to cache audio buffers across different post components
// Ensure this map is accessible within the component's scope or managed via context/global state
const globalAudioBuffers: { [url: string]: AudioBuffer } = {};

// --- Client-side Audio Context Initialization ---
// Check if running in a browser environment before accessing window
const isBrowser = typeof window !== 'undefined';

let globalAudioContext: AudioContext | null = null;
let globalGainNode: GainNode | null = null;
let isGlobalAudioContextInitialized = false;

const initializeGlobalAudioContext = () => {
    if (isBrowser && !isGlobalAudioContextInitialized) {
        try {
            globalAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            globalGainNode = globalAudioContext.createGain();
            globalGainNode.connect(globalAudioContext.destination);
            isGlobalAudioContextInitialized = true;
            console.log("Global AudioContext initialized.");
        } catch (e) {
            console.error("Web Audio API is not supported in this browser.", e);
            // Potentially show a global error message once
        }
    }
};


export default function FragmentPost({ fragment: initialFragment }: FragmentPostProps) {
  // Use the initialFragment directly, assuming processing happens before render or within useEffect
  const [fragment, setFragment] = useState<Fragment>(initialFragment);
  const [isLiked, setIsLiked] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  // Use comments count from API, actual comments need separate fetch
  const [comments, setComments] = useState<Comment[]>([]);
  const [likeCount, setLikeCount] = useState(initialFragment.likes || 0);
  const [currentBeat, setCurrentBeat] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false); // Mute state for this post

  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Ensure global audio context is initialized on mount
  useEffect(() => {
     initializeGlobalAudioContext();
     // Check initial mute state if global gain node exists
     if (globalGainNode) {
        setIsMuted(globalGainNode.gain.value < 0.1); // Check if gain is near zero
     }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // --- Audio Loading (uses global cache) ---
   const loadAudio = useCallback(async (originalUrl: string, downloadUrl?: string): Promise<AudioBuffer | null> => {
        if (!isBrowser) return null; // Don't run on server
        if (!globalAudioContext) {
            console.warn("Post loadAudio: Audio context not ready.");
            initializeGlobalAudioContext(); // Attempt lazy initialization
            if (!globalAudioContext) return null;
        }

       const urlToFetch = downloadUrl || originalUrl; // Use downloadUrl if available, otherwise assume originalUrl might be HTTPS already (or needs resolving - though API provides it now)

        // **Check Cache:** Use the RESOLVED fetchUrl as the primary cache key.
        if (globalAudioBuffers[urlToFetch]) {
            // console.log(`Post loadAudio: Returning cached buffer for ${urlToFetch}`);
            return globalAudioBuffers[urlToFetch];
        }

       // Basic check if urlToFetch is valid HTTPS
       if (!urlToFetch || !urlToFetch.startsWith('http')) {
           console.error(`Post loadAudio: Invalid or non-HTTPS URL provided: ${urlToFetch}. Original was: ${originalUrl}`);
           // No toast here, error handled during fetch attempt or playback
           return null;
       }


      // **Fetch and Decode Audio:**
      console.log(`Post loadAudio: Attempting to fetch audio from: ${urlToFetch}`);
      try {
          const response = await fetch(urlToFetch);
          if (!response.ok) {
               console.error(`Post loadAudio: HTTP error! status: ${response.status} for URL ${urlToFetch}`);
               return null; // Don't throw, just return null on fetch error
          }
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await globalAudioContext.decodeAudioData(arrayBuffer);

          // **Cache the buffer:** Use the RESOLVED fetchUrl as the key.
          globalAudioBuffers[urlToFetch] = audioBuffer;

          console.log(`Post loadAudio: Audio loaded and decoded successfully: ${urlToFetch}`);
          return audioBuffer;
      } catch (error: any) {
          console.error(`Post loadAudio: Error loading or decoding audio file ${originalUrl || downloadUrl} (fetching from ${urlToFetch}):`, error);
           setTimeout(() => {
             toast({
               variant: "destructive",
               title: "Audio Load Error",
               description: `Could not load sound for playback: ${(originalUrl || downloadUrl || '').split('/').pop()?.split('?')[0] || 'Unknown'}. ${error.message}`
             });
          }, 0);
          return null;
      }
   }, [toast]); // Dependency on toast

    // Process fragment pads on mount or when initialFragment changes
    // Assign colors and preload audio
   useEffect(() => {
       const processFragmentPads = async () => {
           if (!initialFragment?.pads) {
               console.warn("FragmentPost: Initial fragment or pads missing.");
               return;
           }

           const processedPadsPromises = initialFragment.pads.map(async (pad): Promise<Pad> => {
               const processedSoundsPromises = (pad.sounds || []).map(async (sound): Promise<PadSound> => { // Assume sound is valid if present
                   const assignedColor = getOrAssignSoundColor(sound.soundId); // Assign color client-side

                   // Preload audio using the downloadUrl provided by the API
                   if (sound.downloadUrl) {
                       loadAudio(sound.soundUrl || sound.downloadUrl, sound.downloadUrl);
                   } else {
                       console.warn(`Post Process: Sound ${sound.soundName} missing downloadUrl. Cannot preload.`);
                   }

                   return {
                       ...sound,
                       color: assignedColor // Ensure color is assigned
                   };
               });
               const processedSounds = await Promise.all(processedSoundsPromises);

               return {
                   ...pad,
                   sounds: processedSounds,
               };
           });
           const processedPads = await Promise.all(processedPadsPromises);
           // Update the local fragment state with processed pads
           setFragment(currentFragment => ({ ...currentFragment, pads: processedPads }));
       };

       processFragmentPads();
       // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [initialFragment, loadAudio]); // Re-run only when initialFragment or loadAudio changes


   // --- Audio Playback (uses global context/gain) ---
   const playSound = useCallback((buffer: AudioBuffer) => {
       if (!globalAudioContext || !globalGainNode) return;
       if (globalGainNode.gain.value < 0.1) return; // Don't play if muted

       if (globalAudioContext.state === 'suspended') {
           globalAudioContext.resume();
       }

       const source = globalAudioContext.createBufferSource();
       source.buffer = buffer;
       source.connect(globalGainNode);
       source.start(0);
   }, []);

   // --- Global Mute Control ---
   const handleToggleMute = () => {
       if (!globalAudioContext || !globalGainNode) return;

       const currentGain = globalGainNode.gain.value;
       const isCurrentlyMuted = currentGain < 0.1; // Check if effectively muted
       const targetGain = isCurrentlyMuted ? 1.0 : 0.0001; // Target 1 for unmute, near 0 for mute
       const newMutedState = !isCurrentlyMuted;

       globalGainNode.gain.exponentialRampToValueAtTime(
           targetGain,
           globalAudioContext.currentTime + 0.1 // Ramp over 0.1 seconds
       );

       setIsMuted(newMutedState); // Update local state for UI icon
       console.log(newMutedState ? "Global Audio Muted" : "Global Audio Unmuted");
   };


  const handleLike = () => {
    // TODO: Implement actual API call for liking/unliking
    setIsLiked(!isLiked);
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
     setTimeout(() => {
        toast({
            title: isLiked ? "Unliked Fragment" : "Liked Fragment",
            description: `You ${isLiked ? 'unliked' : 'liked'} ${fragment.author}'s fragment.`,
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
      if (!globalAudioContext) {
          console.error("Post startPlayback: Audio context not initialized.");
          return;
      }
      if (globalAudioContext.state === 'suspended') {
           globalAudioContext.resume().catch(e => console.error("Error resuming audio context:", e));
      }

    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
    }
    setIsPlaying(true);
    setCurrentBeat(0);

    const bpm = fragment?.bpm || 120;
    // Calculate beat duration based on 16 beats per fragment loop
    const loopDurationMs = (60 / bpm) * 16 * 1000;
    const beatDuration = loopDurationMs / 16;


      // Helper function to play sounds for the current beat index
      const playBeatSounds = (beatIndex: number) => {
        const padToPlay = fragment?.pads?.[beatIndex]; // Find the pad corresponding to the beat index

        if (padToPlay?.isActive && padToPlay.sounds?.length > 0) {
            // Play ALL sounds assigned to this active pad
            padToPlay.sounds.forEach(soundToPlay => {
                // *** Use resolved downloadUrl for playing ***
                const urlToUse = soundToPlay?.downloadUrl;

                if (urlToUse && urlToUse.startsWith('http')) {
                    const buffer = globalAudioBuffers[urlToUse]; // Check cache with HTTPS URL
                    if (buffer) {
                       playSound(buffer);
                    } else {
                        // Attempt to load if not found (might be slightly delayed)
                        console.warn(`Post Playback: Buffer for ${urlToUse} not found, attempting load...`);
                        // Pass original soundUrl for cache key, urlToUse (HTTPS) for fetching
                        loadAudio(soundToPlay.soundUrl || urlToUse, urlToUse).then(loadedBuffer => {
                            if (loadedBuffer) playSound(loadedBuffer);
                            else console.error(`Post Playback: Buffer for ${urlToUse} could not be loaded on demand.`);
                        });
                    }
                } else {
                    // Log if no valid URL is found for the sound to be played
                    console.warn(`Post Playback Beat: ${beatIndex}, Sound: ${soundToPlay?.soundName} - No valid download URL found. Original: ${soundToPlay?.soundUrl}`);
                }
            });
        }
      };

      // Play the first beat immediately
      playBeatSounds(0);


    playbackIntervalRef.current = setInterval(() => {
      setCurrentBeat(prevBeat => {
        const nextBeat = (prevBeat !== null ? prevBeat + 1 : 0) % 16; // Loop 0-15
        playBeatSounds(nextBeat);
        return nextBeat;
      });
    }, beatDuration);
  }, [fragment?.bpm, fragment?.pads, playSound, loadAudio]); // Depend on fragment parts, playSound, loadAudio

  const handlePlayPause = () => {
     if (isPlaying) {
       stopPlayback();
     } else {
       startPlayback();
     }
  };

  // Cleanup interval on unmount or when fragment changes
  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback, fragment?.id]); // Add fragment.id to dependencies


  const handleCommentSubmit = (e: React.FormEvent) => {
     e.preventDefault();
     if (!newComment.trim()) return;

     // TODO: Implement actual API call to submit comment
     const commentToAdd: Comment = {
        id: `comment-${Date.now()}`,
        author: "CurrentUser", // Replace with actual user later
        text: newComment,
        timestamp: new Date(),
     };
     setComments(prev => [...prev, commentToAdd]);
     setNewComment('');
     setTimeout(() => {
        toast({
            title: "Comment Added",
            description: "Your comment has been posted.",
        });
     }, 0);
  }


  return (
    <TooltipProvider> {/* Wrap with TooltipProvider */}
      <Card className="overflow-hidden shadow-md transition-shadow hover:shadow-lg">
        <CardHeader className="flex flex-row items-center space-x-3 p-4 bg-card">
          <Avatar>
            {/* Use placeholder image with hint */}
            <AvatarImage src={fragment.authorAvatar || `https://picsum.photos/seed/${fragment.id}/40/40`} alt={fragment.author} data-ai-hint="avatar person" />
            <AvatarFallback>{fragment.author?.substring(0, 2).toUpperCase() || '??'}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <CardTitle className="text-sm font-medium">{fragment.title || 'Untitled Fragment'}</CardTitle>
            <p className="text-xs text-muted-foreground">
               By {fragment.author || 'Unknown Author'}
               {fragment.originalAuthor && (
                 <> • Remixed from <span className="font-medium text-primary">{fragment.originalAuthor}</span></>
               )}
            </p>
            <p className="text-xs text-muted-foreground">
              {fragment.timestamp ? formatDistanceToNow(new Date(fragment.timestamp), { addSuffix: true }) : 'Recently'}
               {fragment.bpm && ` • ${fragment.bpm} BPM`}
            </p>
          </div>
           <Tooltip>
              <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleToggleMute} aria-label={isMuted ? "Unmute" : "Mute"}>
                      {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </Button>
              </TooltipTrigger>
              <TooltipContent>
                  <p>{isMuted ? "Unmute" : "Mute"}</p>
              </TooltipContent>
           </Tooltip>
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
        </CardHeader>

        {/* Visual representation */}
        <CardContent className="p-0 aspect-square bg-secondary/30 flex items-center justify-center">
           {/* Adjust grid visualization based on fragment.columns/rows if needed */}
           <div className={`grid grid-cols-${fragment.columns || 4} gap-1 p-4 w-full h-full max-w-[200px] max-h-[200px] mx-auto`}>
             {fragment.pads?.map(pad => { // Iterate through processed pads
                const isPadActive = pad.isActive && pad.sounds?.length > 0;
                 // Use the current sound's color if available, ensure it exists
                 const currentSound: PadSound | undefined = pad.sounds?.[pad.currentSoundIndex ?? 0]; // Safe access
                 const displayColor = isPadActive && currentSound?.color ? currentSound.color : undefined;

                 const bgColorClass = displayColor
                     ? displayColor // Use the specific sound's color
                     : isPadActive
                         ? 'bg-gradient-to-br from-muted to-secondary' // Neutral/gradient if active but no color
                         : 'bg-muted/50'; // Inactive or no sound color

               const isCurrentBeat = isPlaying && currentBeat === pad.id;

               return (
                 <Tooltip key={pad.id}>
                    <TooltipTrigger asChild>
                        <div
                            className={cn(
                            "relative w-full h-full rounded transition-all duration-100",
                            bgColorClass,
                            isCurrentBeat ? 'ring-2 ring-offset-1 ring-accent scale-[1.08] shadow-md' : '', // Beat highlight
                             // Add subtle indicator for multiple sounds using Layers icon
                             pad.sounds?.length > 1 && "flex items-center justify-center" // Safe access
                            )}
                        >
                             {/* Icon for multiple sounds */}
                            {pad.sounds?.length > 1 && <Layers className="w-1/2 h-1/2 text-white/70 absolute" />} {/* Safe access */}
                            {/* Optional: Dim the background slightly if > 1 sound to make Layers icon pop? */}
                            {pad.sounds?.length > 1 && <div className="absolute inset-0 bg-black/10 rounded"></div>} {/* Safe access */}
                        </div>
                    </TooltipTrigger>
                     {/* Tooltip shows sound details */}
                     {isPadActive && (
                        <TooltipContent side="top" className="bg-background text-foreground text-xs p-2 max-w-[150px]">
                            {pad.sounds?.length === 1 && currentSound ? ( // Safe access
                                // Show single sound name
                                <p>{currentSound.soundName}</p>
                            ) : pad.sounds?.length > 1 && currentSound ? ( // Safe access
                                // List multiple sounds
                                <>
                                <ul className="list-none p-0 m-0 space-y-1">
                                {pad.sounds.map((s, idx) => (
                                    <li key={s.soundId} className={cn("flex items-center", idx === (pad.currentSoundIndex ?? 0) ? "font-semibold" : "")}>
                                        {/* Ensure color exists for the dot */}
                                        <div className={`w-3 h-3 rounded-sm mr-2 shrink-0 ${s.color || 'bg-muted'}`}></div>
                                        <span className="truncate">{s.soundName}</span>
                                    </li>
                                ))}
                                </ul>
                                 <p className="text-xs text-muted-foreground mt-1 pt-1 border-t border-border/50">Current: {currentSound?.soundName}</p>
                                </>
                            ): null}
                        </TooltipContent>
                    )}
                 </Tooltip>
               );
             })}
           </div>
        </CardContent>

        <CardFooter className="flex flex-col items-start p-4 space-y-3">
          <div className="flex w-full justify-between items-center">
            <div className="flex space-x-2">
              <Button variant="ghost" size="sm" onClick={handleLike} aria-pressed={isLiked}>
                <Heart className={cn("mr-2 h-4 w-4", isLiked ? 'fill-destructive text-destructive' : '')} />
                {likeCount}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowComments(!showComments)} aria-expanded={showComments}>
                <MessageCircle className="mr-2 h-4 w-4" />
                {fragment.commentsCount || comments.length} {/* Show API count or local count */}
              </Button>
            </div>
            {/* Disable remix if it's already a remix? Or allow chain remixing? */}
            <Link href={`/remix/${fragment.id}`} passHref>
               <Button variant="outline" size="sm">
                  <GitFork className="mr-2 h-4 w-4" />
                  Remix
               </Button>
            </Link>
          </div>

           {/* Comment Section */}
           {showComments && (
             <div className="w-full space-y-4 pt-4 border-t">
               {/* TODO: Fetch actual comments here */}
               <ScrollArea className="h-40 w-full pr-4">
                 <div className="space-y-3">
                   {comments.length > 0 ? comments.map((comment) => (
                     <div key={comment.id} className="text-sm flex space-x-2">
                       <span className="font-semibold">{comment.author}:</span>
                       <span className="flex-1">{comment.text}</span>
                        <span className="text-xs text-muted-foreground self-end">
                           {comment.timestamp ? formatDistanceToNow(new Date(comment.timestamp), { addSuffix: true }) : ''}
                        </span>
                     </div>
                   )) : <p className="text-sm text-muted-foreground">No comments yet. (Fetching...)</p>}
                 </div>
               </ScrollArea>
               <form onSubmit={handleCommentSubmit} className="flex space-x-2">
                 <Textarea
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="flex-1 h-10 min-h-[40px] resize-none"
                    rows={1}
                 />
                 <Button type="submit" size="sm" disabled={!newComment.trim()}>Post</Button>
               </form>
             </div>
           )}
        </CardFooter>
      </Card>
    </TooltipProvider> // Close TooltipProvider
  );
}