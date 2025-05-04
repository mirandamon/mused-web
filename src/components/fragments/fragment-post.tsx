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
import { getStorage, ref, getDownloadURL } from 'firebase/storage'; // Correct Firebase Storage imports
import { storage } from "@/lib/firebase/clientApp"; // Import client storage instance

interface FragmentPostProps {
  fragment: Fragment;
}

// Global map to cache audio buffers across different post components
const globalAudioBuffers: { [url: string]: AudioBuffer } = {};
// Global audio context (potentially shared, or manage per component instance)
let globalAudioContext: AudioContext | null = null;
let globalGainNode: GainNode | null = null;
let isGlobalAudioContextInitialized = false;

const initializeGlobalAudioContext = () => {
    if (typeof window !== 'undefined' && !isGlobalAudioContextInitialized) {
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
  const [fragment, setFragment] = useState<Fragment>(initialFragment); // State to hold processed fragment
  const [isLiked, setIsLiked] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<Comment[]>(initialFragment.comments || []); // Ensure comments is an array
  const [likeCount, setLikeCount] = useState(initialFragment.likes || 0); // Ensure likes is a number
  const [currentBeat, setCurrentBeat] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false); // Mute state for this post

  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Ensure global audio context is initialized on mount
  useEffect(() => {
     initializeGlobalAudioContext();
     // Check initial mute state if global gain node exists
     if (globalGainNode) {
        setIsMuted(globalGainNode.gain.value < 0.5); // Approximate check
     }
  }, []);

   /**
    * Asynchronously resolves a gs:// URL or path to an HTTPS download URL.
    * @param gsOrPath The gs:// URL or storage path.
    * @returns Promise resolving to the HTTPS URL or null if resolution fails.
    */
    const resolveGsUrlToDownloadUrl = useCallback(async (gsOrPath: string): Promise<string | null> => {
      if (!gsOrPath || !gsOrPath.startsWith('gs://')) {
        console.warn(`Post resolveGsUrl: Provided path is not a gs:// URL: ${gsOrPath}`);
        return null; // Only handle gs:// URLs
      }
      try {
        const storageRef = ref(storage, gsOrPath); // Use ref from firebase/storage
        const downloadUrl = await getDownloadURL(storageRef);
        console.log(`Post Resolved ${gsOrPath} to ${downloadUrl}`);
        return downloadUrl;
      } catch (error) {
        console.error(`Post Failed to get download URL for ${gsOrPath}:`, error);
        // Use setTimeout to avoid calling toast during render phase
        setTimeout(() => {
           toast({
             variant: "destructive",
             title: "URL Resolution Error",
             description: `Could not get playable URL for ${gsOrPath.split('/').pop() || 'sound'}.`,
           });
        }, 0);
        return null;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storage]); // Dependency on storage instance (and toast via setTimeout)

   // Process fragment pads on mount to resolve gs:// URLs and assign colors
   useEffect(() => {
       const processFragmentAsync = async () => {
            if (!initialFragment?.pads) {
                console.warn("FragmentPost: Initial fragment or pads missing.");
                return;
            }
           const processedPadsPromises = initialFragment.pads.map(async (pad): Promise<Pad> => {
               const processedSoundsPromises = (pad.sounds || []).map(async (sound): Promise<PadSound | null> => {
                   let playableUrl = sound.downloadUrl; // Already resolved URL from API?
                   const originalSourceUrl = sound.soundUrl; // Original path (gs:// or relative)

                   // **Resolve gs:// URL if necessary**
                   if (!playableUrl && originalSourceUrl && originalSourceUrl.startsWith('gs://')) {
                        console.log(`Post Load: Resolving gs:// URL: ${originalSourceUrl}`);
                        playableUrl = await resolveGsUrlToDownloadUrl(originalSourceUrl);
                        if (!playableUrl) {
                           console.warn(`Post Load: Failed to resolve gs:// URL ${originalSourceUrl}. Sound may not play.`);
                        }
                   } else if (!playableUrl && originalSourceUrl && originalSourceUrl.startsWith('/')) {
                       // Legacy preset path - might be invalid
                       console.warn(`Post Load: Found relative path ${originalSourceUrl}. Assuming preset (might be removed). Using path as potential playable URL.`);
                       playableUrl = originalSourceUrl; // Use relative path (might 404)
                   }

                    if (!playableUrl) {
                        console.warn(`Post Load: Sound ${sound.soundName || sound.soundId} missing valid playable URL. Original: ${originalSourceUrl}`);
                    } else {
                       // Preload audio after potential resolution
                       // Pass original for cache key, playable for fetching
                       loadAudio(originalSourceUrl || playableUrl, playableUrl);
                    }

                   return {
                       ...sound,
                       soundUrl: originalSourceUrl, // Keep original path
                       downloadUrl: playableUrl, // Store resolved or original playable URL
                       // Assign color on the client using the imported helper
                       color: sound.color || getOrAssignSoundColor(sound.soundId)
                   };
               });
               const processedSounds = (await Promise.all(processedSoundsPromises)).filter(s => s !== null) as PadSound[];

               return {
                   ...pad,
                   sounds: processedSounds,
               };
           });
           const processedPads = await Promise.all(processedPadsPromises);
           setFragment({ ...initialFragment, pads: processedPads });
       };

       processFragmentAsync();
       // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [initialFragment, resolveGsUrlToDownloadUrl]); // Re-run when initialFragment or resolver changes


  // --- Audio Loading (uses global cache) ---
   const loadAudio = useCallback(async (originalUrl: string, downloadUrl?: string): Promise<AudioBuffer | null> => {
       if (!globalAudioContext) {
          console.warn("Post loadAudio: Audio context not ready.");
          return null;
       }
        if (!originalUrl && !downloadUrl) {
            console.warn("Post loadAudio: Both originalUrl and downloadUrl are missing.");
            return null;
        }

       // **Determine the URL to fetch:** Prioritize provided downloadUrl, resolve originalUrl if needed.
       let fetchUrl = downloadUrl; // Start with the potentially already resolved URL

       // If no downloadUrl provided or it's invalid, and originalUrl is gs://, try resolving it.
       if ((!fetchUrl || !fetchUrl.startsWith('http')) && originalUrl && originalUrl.startsWith('gs://')) {
           console.log(`Post loadAudio: Resolving gs:// URL: ${originalUrl}`);
           fetchUrl = await resolveGsUrlToDownloadUrl(originalUrl);
           if (!fetchUrl) {
               console.error(`Post loadAudio: Failed to resolve gs:// URL ${originalUrl}. Cannot load audio.`);
               return null; // Stop if resolution failed
           }
       } else if (originalUrl && originalUrl.startsWith('/') && typeof window !== 'undefined') {
           // Handle legacy relative paths (potential presets)
           fetchUrl = window.location.origin + originalUrl;
           console.warn(`Post loadAudio: Using relative path (potential preset): ${fetchUrl}`);
       } else if (!fetchUrl || !fetchUrl.startsWith('http')) {
            // If after all checks, fetchUrl is still invalid, log error and exit.
            console.error(`Post loadAudio: Invalid or non-HTTP(S) URL provided: ${fetchUrl || originalUrl}`);
             setTimeout(() => {
               toast({
                   variant: "destructive",
                   title: "Audio Load Error",
                   description: `Cannot load sound from invalid URL: ${fetchUrl || originalUrl}`,
               });
             }, 0);
            return null;
        }

       // **Check Cache:** Use the RESOLVED fetchUrl as the primary cache key.
       if (globalAudioBuffers[fetchUrl]) {
           // console.log(`Post loadAudio: Returning cached buffer for ${fetchUrl}`);
           return globalAudioBuffers[fetchUrl];
       }


      // **Fetch and Decode Audio:**
      console.log(`Post loadAudio: Attempting to fetch audio from: ${fetchUrl}`);
      try {
          const response = await fetch(fetchUrl);
          if (!response.ok) {
               console.error(`Post loadAudio: HTTP error! status: ${response.status} for URL ${fetchUrl}`);
               // Handle 404 for potentially removed presets
               if (response.status === 404 && originalUrl?.startsWith('/')) {
                  console.warn(`Post loadAudio: Preset sound likely removed (${originalUrl}).`);
               }
               return null; // Don't throw, just return null on fetch error
          }
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await globalAudioContext.decodeAudioData(arrayBuffer);

          // **Cache the buffer:** Use the RESOLVED fetchUrl as the key.
          globalAudioBuffers[fetchUrl] = audioBuffer;
          // Optionally, also cache by original gs:// URL if needed
          // if (originalUrl && originalUrl !== fetchUrl) {
          //    globalAudioBuffers[originalUrl] = audioBuffer;
          // }

          console.log(`Post loadAudio: Audio loaded and decoded successfully: ${fetchUrl}`);
          return audioBuffer;
      } catch (error: any) {
          console.error(`Post loadAudio: Error loading or decoding audio file ${originalUrl || downloadUrl} (fetching from ${fetchUrl}):`, error);
           setTimeout(() => {
             toast({
               variant: "destructive",
               title: "Audio Load Error",
               description: `Could not load sound for playback: ${(originalUrl || downloadUrl || '').split('/').pop()?.split('?')[0] || 'Unknown'}. ${error.message}`
             });
          }, 0);
          return null;
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolveGsUrlToDownloadUrl]); // Dependency on toast

  // Preload sounds for this fragment when it becomes visible or data changes
  useEffect(() => {
      fragment?.pads?.forEach(pad => {
          pad.sounds?.forEach(sound => {
              // Prioritize downloadUrl, fallback to soundUrl (which might be gs://)
              const urlToLoad = sound.downloadUrl || sound.soundUrl;
              if (urlToLoad) {
                  // console.log(`Post Preloading: ${sound.soundName} using URL: ${urlToLoad}`);
                  // Pass original soundUrl for potential caching, downloadUrl for fetching
                  loadAudio(sound.soundUrl || urlToLoad, sound.downloadUrl);
              } else {
                  // Log if no URL found for preloading
                  console.warn(`Post Preloading: Sound ${sound.soundName} missing any URL (downloadUrl or soundUrl).`);
              }
          });
      });
  }, [fragment?.pads, loadAudio]);

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
       const isCurrentlyMuted = currentGain < 0.5; // Check if effectively muted
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
          // Don't toast here, initialize might handle it or console log
          console.error("Post startPlayback: Audio context not initialized.");
          return;
      }
      if (globalAudioContext.state === 'suspended') {
           globalAudioContext.resume();
      }

    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
    }
    setIsPlaying(true);
    setCurrentBeat(0);

    const bpm = fragment?.bpm || 120;
    const beatDuration = (60 / bpm) * 1000;

    playbackIntervalRef.current = setInterval(() => {
      setCurrentBeat(prevBeat => {
        const nextBeat = (prevBeat !== null ? prevBeat + 1 : 0) % 16;
        const padToPlay = fragment?.pads?.[nextBeat]; // Safely access pads

        if (padToPlay?.isActive && padToPlay.sounds?.length > 0) {
            const soundToPlay = padToPlay.sounds[padToPlay.currentSoundIndex ?? 0];
            // *** Use resolved downloadUrl first for playing ***
            const urlToUse = soundToPlay?.downloadUrl; // Get best available URL

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
                 console.warn(`Post Playback Beat: ${nextBeat}, Sound: ${soundToPlay?.soundName} - No valid download URL found. Original: ${soundToPlay?.soundUrl}`);
            }
        }
        return nextBeat;
      });
    }, beatDuration);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fragment?.bpm, fragment?.pads, playSound, loadAudio]); // Depend on fragment parts

  const handlePlayPause = () => {
     if (isPlaying) {
       stopPlayback();
     } else {
       startPlayback();
     }
  };

  useEffect(() => {
    // Cleanup interval on unmount or when fragment changes
    return () => {
      stopPlayback();
    };
  }, [stopPlayback, fragment?.id]); // Add fragment.id to dependencies


  const handleCommentSubmit = (e: React.FormEvent) => {
     e.preventDefault();
     if (!newComment.trim()) return;

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
            <AvatarImage src={fragment.authorAvatar || `https://picsum.photos/seed/${fragment.id}/40/40`} alt={fragment.author} data-ai-hint="avatar person" />
            <AvatarFallback>{fragment.author.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <CardTitle className="text-sm font-medium">{fragment.title || 'Untitled Fragment'}</CardTitle>
            <p className="text-xs text-muted-foreground">
               By {fragment.author}
               {fragment.originalAuthor && (
                 <> • Remixed from <span className="font-medium text-primary">{fragment.originalAuthor}</span></>
               )}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(fragment.timestamp), { addSuffix: true })} {/* Ensure timestamp is Date */}
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
           <div className="grid grid-cols-4 gap-1 p-4 w-full h-full max-w-[200px] max-h-[200px] mx-auto">
             {fragment.pads?.map(pad => { // Safe access to pads
                const isPadActive = pad.isActive && pad.sounds?.length > 0; // Safe access to sounds
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
                {comments.length}
              </Button>
            </div>
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
               <ScrollArea className="h-40 w-full pr-4">
                 <div className="space-y-3">
                   {comments.length > 0 ? comments.map((comment) => (
                     <div key={comment.id} className="text-sm flex space-x-2">
                       <span className="font-semibold">{comment.author}:</span>
                       <span className="flex-1">{comment.text}</span>
                        <span className="text-xs text-muted-foreground self-end">
                          {formatDistanceToNow(new Date(comment.timestamp), { addSuffix: true })} {/* Ensure Date */}
                        </span>
                     </div>
                   )) : <p className="text-sm text-muted-foreground">No comments yet.</p>}
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
