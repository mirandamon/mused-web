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

       let urlToFetch = downloadUrl; // Prioritize provided downloadUrl

       // If no valid downloadUrl, and originalUrl exists and is gs://, try resolving it.
       if ((!urlToFetch || !urlToFetch.startsWith('http')) && originalUrl && originalUrl.startsWith('gs://')) {
           console.log(`Post loadAudio: Resolving gs:// URL: ${originalUrl}`);
            try {
                const storageRef = ref(storage, originalUrl);
                urlToFetch = await getDownloadURL(storageRef);
                console.log(`Post loadAudio: Resolved ${originalUrl} to ${urlToFetch}`);
            } catch (resolveError) {
                console.error(`Post loadAudio: Failed to resolve gs:// URL ${originalUrl}:`, resolveError);
                 setTimeout(() => {
                   toast({
                     variant: "destructive",
                     title: "Audio Load Error",
                     description: `Could not resolve sound URL: ${originalUrl.split('/').pop() || 'Unknown'}.`,
                   });
                 }, 0);
                return null; // Stop if resolution failed
            }
       } else if (!urlToFetch || !urlToFetch.startsWith('http')) {
           console.error(`Post loadAudio: Invalid or non-HTTPS URL provided or resolved: ${urlToFetch || originalUrl}`);
           return null;
       }

        // **Check Cache:** Use the RESOLVED urlToFetch as the cache key.
        if (globalAudioBuffers[urlToFetch]) {
            // console.log(`Post loadAudio: Returning cached buffer for ${urlToFetch}`);
            return globalAudioBuffers[urlToFetch];
        }

      // **Fetch and Decode Audio:**
      console.log(`Post loadAudio: Attempting to fetch audio from: ${urlToFetch}`);
      try {
          const response = await fetch(urlToFetch);
          if (!response.ok) {
               console.error(`Post loadAudio: HTTP error! status: ${response.status} for URL ${urlToFetch}`);
               // Handle specific errors like 403 or 404
               if (response.status === 403) {
                   console.warn(`Post loadAudio: Permission denied for ${urlToFetch}. Check Storage rules.`);
               } else if (response.status === 404) {
                   console.warn(`Post loadAudio: Sound file not found at ${urlToFetch}.`);
               }
               return null; // Don't throw, just return null on fetch error
          }
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await globalAudioContext.decodeAudioData(arrayBuffer);

          // **Cache the buffer:** Use the RESOLVED urlToFetch as the key.
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
               // If initialFragment has no pads array (shouldn't happen with API), create default empty pads
               const defaultEmptyPads = Array.from({ length: (initialFragment?.rows || 4) * (initialFragment?.columns || 4) }, (_, i) => ({
                   id: i,
                   sounds: [],
                   isActive: false,
                   currentSoundIndex: 0
               }));
               setFragment(currentFragment => ({ ...currentFragment, pads: defaultEmptyPads }));
               return;
           }

           // Ensure the pads array has the correct length (e.g., 16 for 4x4)
           // The API response should already provide this structure.
           const expectedPadCount = (initialFragment.rows || 4) * (initialFragment.columns || 4);
           if (initialFragment.pads.length !== expectedPadCount) {
                console.warn(`FragmentPost: Mismatched pad count. Expected ${expectedPadCount}, got ${initialFragment.pads.length}. Will use API data.`);
                // Potentially pad the array if needed, but API should handle this.
           }

           console.log("FragmentPost: Processing initial pads received from API:", initialFragment.pads);

           const processedPadsPromises = initialFragment.pads.map(async (pad): Promise<Pad> => {
               // API already provides isActive and currentSoundIndex, use them directly
               const processedSoundsPromises = (pad.sounds || []).map(async (sound): Promise<PadSound> => {
                   const assignedColor = getOrAssignSoundColor(sound.soundId); // Assign color client-side

                   // Preload audio using the downloadUrl provided by the API
                   // loadAudio will internally handle resolution if downloadUrl is missing but soundUrl (gs://) exists
                   if (sound.downloadUrl || sound.soundUrl) {
                       loadAudio(sound.soundUrl || sound.downloadUrl || '', sound.downloadUrl);
                   } else {
                       console.warn(`Post Process: Sound ${sound.soundName} missing both downloadUrl and soundUrl. Cannot preload.`);
                   }

                   return {
                       ...sound,
                       color: assignedColor // Ensure color is assigned
                   };
               });
               const processedSounds = await Promise.all(processedSoundsPromises);

               // Ensure isActive reflects if sounds are present, even if API sends false (edge case)
               const derivedIsActive = (pad.isActive !== undefined ? pad.isActive : false) && processedSounds.length > 0;

               return {
                   ...pad, // Contains id, isActive, currentSoundIndex from API
                   sounds: processedSounds,
                   isActive: derivedIsActive, // Use API's state, but ensure it's false if no sounds
               };
           });
           const processedPads = await Promise.all(processedPadsPromises);
           console.log("FragmentPost: Finished processing pads:", processedPads);
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
    // Calculate duration for each beat based on BPM
    const beatDuration = (60 / bpm) * 1000;


      // Helper function to play sounds for the current beat index
      const playBeatSounds = (beatIndex: number) => {
        // Find the pad corresponding to the beat index
        // Ensure fragment.pads exists and is an array
        const padToPlay = fragment?.pads?.[beatIndex];

        // Check if the pad exists, is active, and has sounds
        if (padToPlay?.isActive && padToPlay.sounds?.length > 0) {
            console.log(`Playing beat ${beatIndex}, Pad ${padToPlay.id}`);
            // Play ALL sounds assigned to this active pad
            padToPlay.sounds.forEach(soundToPlay => {
                // *** Use resolved downloadUrl for playing ***
                const urlToUse = soundToPlay?.downloadUrl;

                if (urlToUse && urlToUse.startsWith('http')) {
                    const buffer = globalAudioBuffers[urlToUse]; // Check cache with HTTPS URL
                    if (buffer) {
                       playSound(buffer);
                       // console.log(`Playing cached sound for beat ${beatIndex}: ${soundToPlay.soundName}`);
                    } else {
                        // Attempt to load if not found (might be slightly delayed)
                        console.warn(`Post Playback: Buffer for ${urlToUse} not found, attempting load...`);
                        // Pass original soundUrl for cache key, urlToUse (HTTPS) for fetching
                        loadAudio(soundToPlay.soundUrl || urlToUse, urlToUse).then(loadedBuffer => {
                            if (loadedBuffer) {
                               playSound(loadedBuffer);
                               // console.log(`Loaded and played sound for beat ${beatIndex}: ${soundToPlay.soundName}`);
                            } else {
                               console.error(`Post Playback: Buffer for ${urlToUse} could not be loaded on demand.`);
                            }
                        });
                    }
                } else {
                    // Log if no valid URL is found for the sound to be played
                    console.warn(`Post Playback Beat: ${beatIndex}, Sound: ${soundToPlay?.soundName} - No valid download URL found. Original: ${soundToPlay?.soundUrl}`);
                }
            });
        } else {
            // console.log(`Skipping beat ${beatIndex}, Pad ${padToPlay?.id}, Active: ${padToPlay?.isActive}, Sounds: ${padToPlay?.sounds?.length}`);
        }
      };

      // Play the first beat immediately
      playBeatSounds(0);

    // Set up interval for subsequent beats
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
           {/* Grid visualization */}
           <div className={`grid grid-cols-${fragment.columns || 4} gap-1 p-4 w-full h-full max-w-[200px] max-h-[200px] mx-auto`}>
             {/* Ensure fragment.pads is defined and has the correct length before mapping */}
             {(fragment.pads || Array.from({ length: (fragment.rows || 4) * (fragment.columns || 4) }, (_, i) => ({ id: i, sounds: [], isActive: false, currentSoundIndex: 0 }))).map(pad => {
                // Determine if pad is active (has sounds and is toggled on)
                const isPadActive = pad.isActive === true && pad.sounds && pad.sounds.length > 0;

                // Get the currently selected sound for color/tooltip, if active
                const currentSoundIndex = pad.currentSoundIndex ?? 0;
                const currentSound: PadSound | undefined = isPadActive ? pad.sounds?.[currentSoundIndex] : undefined;

                // Determine display color: Use current sound's color if active, otherwise default
                const displayColor = currentSound?.color;
                const bgColorClass = displayColor
                  ? displayColor // Use the specific sound's color
                  : isPadActive // If active but no color (edge case), use a neutral indicator
                    ? 'bg-gradient-to-br from-primary/30 to-secondary/30'
                    : 'bg-muted/40'; // Inactive or no sounds

                // Check if this pad corresponds to the current beat during playback
                const isCurrentBeat = isPlaying && currentBeat === pad.id;

               return (
                 <Tooltip key={pad.id} delayDuration={200}>
                    <TooltipTrigger asChild>
                        {/* The div representing the pad */}
                        <div
                            className={cn(
                            "relative w-full h-full rounded transition-all duration-100 border border-transparent", // Added base border
                            bgColorClass,
                             // Highlight if active AND it's the current beat
                            isPadActive && isCurrentBeat ? 'ring-2 ring-offset-1 ring-accent scale-[1.08] shadow-md border-accent/50' : '',
                             // Subtle border if pad is active but not the current beat
                            isPadActive && !isCurrentBeat ? 'border-foreground/10' : 'border-background/10',
                            // Visual cue for multiple sounds using Layers icon
                            isPadActive && pad.sounds && pad.sounds.length > 1 && "flex items-center justify-center"
                            )}
                        >
                             {/* Icon for multiple sounds */}
                            {isPadActive && pad.sounds && pad.sounds.length > 1 && <Layers className="w-1/2 h-1/2 text-white/50 absolute" />}
                            {/* Optional: Dim the background slightly if > 1 sound to make Layers icon pop? */}
                            {isPadActive && pad.sounds && pad.sounds.length > 1 && <div className="absolute inset-0 bg-black/10 rounded"></div>}
                        </div>
                    </TooltipTrigger>
                     {/* Tooltip shows sound details only if the pad is active */}
                     {isPadActive && (
                        <TooltipContent side="top" className="bg-background text-foreground text-xs p-2 max-w-[150px]">
                            {pad.sounds?.length === 1 && currentSound ? (
                                <p>{currentSound.soundName}</p>
                            ) : pad.sounds && pad.sounds.length > 1 && currentSound ? (
                                <>
                                <ul className="list-none p-0 m-0 space-y-1">
                                {pad.sounds.map((s, idx) => (
                                    <li key={s.soundId} className={cn("flex items-center", idx === currentSoundIndex ? "font-semibold" : "")}>
                                        <div className={`w-3 h-3 rounded-sm mr-2 shrink-0 ${s.color || 'bg-muted'}`}></div>
                                        <span className="truncate">{s.soundName}</span>
                                    </li>
                                ))}
                                </ul>
                                 <p className="text-xs text-muted-foreground mt-1 pt-1 border-t border-border/50">Current: {currentSound?.soundName}</p>
                                </>
                            ) : (
                              <p className="text-muted-foreground italic">Pad Active</p> // Fallback if active but sound data issue
                            )}
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
