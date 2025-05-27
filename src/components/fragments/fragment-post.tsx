
// src/components/fragments/fragment-post.tsx
'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, GitFork, Play, Pause, Layers, Volume2, VolumeX } from 'lucide-react';
import type { Fragment, Pad, PadSound, Comment } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getOrAssignSoundColor } from './fragment-editor';
import { getStorage, ref, getDownloadURL } from "firebase/storage";
import { storage } from '@/lib/firebase/clientApp';

interface FragmentPostProps {
  fragment: Fragment;
}

const globalAudioBuffers: { [url: string]: AudioBuffer } = {};
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
            console.log("Global AudioContext initialized for FragmentPost.");
        } catch (e) {
            console.error("Web Audio API is not supported in this browser (FragmentPost).", e);
        }
    }
};


export default function FragmentPost({ fragment: initialFragment }: FragmentPostProps) {
  const [fragment, setFragment] = useState<Fragment>(initialFragment);
  const [isLiked, setIsLiked] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<Comment[]>(initialFragment.comments || []);
  const [likeCount, setLikeCount] = useState(initialFragment.likes || 0);
  const [currentBeat, setCurrentBeat] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(isBrowser && globalGainNode ? globalGainNode.gain.value < 0.1 : false);

  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
     initializeGlobalAudioContext();
     if (isBrowser && globalGainNode) {
        setIsMuted(globalGainNode.gain.value < 0.1);
     }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


   const loadAudio = useCallback(async (httpUrl: string): Promise<AudioBuffer | null> => {
       if (!isBrowser || !globalAudioContext) {
           console.warn("Post loadAudio: Audio context not ready.");
           initializeGlobalAudioContext();
           if (!globalAudioContext) return null;
       }
       if (!httpUrl || !httpUrl.startsWith('http')) {
           console.error(`Post loadAudio: Invalid HTTPS URL provided: ${httpUrl}`);
           setTimeout(() => {
               toast({
                   variant: "destructive",
                   title: "Audio Load Error",
                   description: `Cannot load sound from invalid URL: ${httpUrl ? httpUrl.split('/').pop()?.split('?')[0] : 'Unknown'}.`,
               });
           },0);
           return null;
       }

       const cacheKey = httpUrl;
       if (globalAudioBuffers[cacheKey]) {
           return globalAudioBuffers[cacheKey];
       }

       console.log(`Post loadAudio: Attempting to fetch audio from: ${httpUrl}`);
       try {
           const response = await fetch(httpUrl);
           if (!response.ok) {
               console.error(`Post loadAudio: HTTP error! status: ${response.status} for URL ${httpUrl}`);
               if (response.status === 403) console.warn(`Post loadAudio: Permission denied for ${httpUrl}.`);
               else if (response.status === 404) console.warn(`Post loadAudio: Sound file not found at ${httpUrl}.`);
               else { // Generic error for other statuses
                    toast({
                        variant: "destructive",
                        title: `Audio Load Error (${response.status})`,
                        description: `Could not load: ${httpUrl.split('/').pop()?.split('?')[0] || 'Unknown sound'}.`,
                    });
               }
               return null;
           }
           const arrayBuffer = await response.arrayBuffer();
           const audioBuffer = await globalAudioContext.decodeAudioData(arrayBuffer);
           globalAudioBuffers[cacheKey] = audioBuffer;
           console.log(`Post loadAudio: Audio loaded and decoded successfully: ${httpUrl}`);
           return audioBuffer;
       } catch (error: any) {
           console.error(`Post loadAudio: Error loading or decoding audio file ${httpUrl}:`, error);
           setTimeout(() => {
               toast({
                   variant: "destructive",
                   title: "Audio Load Error",
                   description: `Could not load sound for playback: ${httpUrl.split('/').pop()?.split('?')[0] || 'Unknown'}. ${error.message}`
               });
           },0);
           return null;
       }
   }, [toast]);

   useEffect(() => {
       const processFragmentPads = async () => {
           if (!initialFragment?.pads) {
               console.warn("FragmentPost: Initial fragment or pads missing.");
               const defaultPadCount = (initialFragment?.rows || 4) * (initialFragment?.columns || 4);
               const defaultEmptyPads = Array.from({ length: defaultPadCount }, (_, i) => ({
                   id: i, sounds: [], isActive: false, currentSoundIndex: 0
               }));
               setFragment(currentFrag => ({ ...currentFrag, pads: defaultEmptyPads }));
               return;
           }

           console.log("FragmentPost: Processing initial pads:", initialFragment.pads);

           const processedPadsPromises = initialFragment.pads.map(async (pad): Promise<Pad> => {
               const processedSoundsPromises = (pad.sounds || []).map(async (sound): Promise<PadSound> => {
                   const assignedColor = getOrAssignSoundColor(sound.soundId); // Assign color on client
                   if (sound.downloadUrl && sound.downloadUrl.startsWith('http')) {
                       loadAudio(sound.downloadUrl); // Preload audio
                   } else {
                       console.warn(`Post Process: Sound ${sound.soundName || sound.soundId} missing valid HTTP downloadUrl. Original gsPath: ${sound.soundUrl}`);
                       if (sound.soundUrl && sound.soundUrl.startsWith('gs://')) {
                           console.log(`Post Process: Attempting to resolve gs:// path for ${sound.soundName || sound.soundId}`);
                           try {
                               const storageRef = ref(storage, sound.soundUrl);
                               const resolvedUrl = await getDownloadURL(storageRef);
                               if (resolvedUrl) {
                                   loadAudio(resolvedUrl);
                                   return { ...sound, color: assignedColor, downloadUrl: resolvedUrl };
                               }
                           } catch (e) {
                               console.error(`Post Process: Failed to resolve gs:// path ${sound.soundUrl}`, e);
                           }
                       }
                   }
                   return { ...sound, color: assignedColor };
               });
               const processedSounds = await Promise.all(processedSoundsPromises);
               // For feed display, isActive from API (editor's toggle) is still important for initial state.
               // Playback logic will decide if it *actually* plays based on having sounds.
               return { ...pad, sounds: processedSounds, isActive: pad.isActive };
           });
           const finalPads = await Promise.all(processedPadsPromises);
           console.log("FragmentPost: Finished processing pads. New fragment state:", {...initialFragment, pads: finalPads });
           setFragment({ ...initialFragment, pads: finalPads });
       };

       processFragmentPads();
   }, [initialFragment, loadAudio]);


   const playSound = useCallback((buffer: AudioBuffer) => {
       if (!globalAudioContext || !globalGainNode || (globalGainNode.gain.value < 0.01)) return;

       if (globalAudioContext.state === 'suspended') {
           globalAudioContext.resume().catch(e => console.error("Error resuming audio context on playSound:", e));
       }

       const source = globalAudioContext.createBufferSource();
       source.buffer = buffer;
       source.connect(globalGainNode);
       source.start(0);
   }, []);

   const handleToggleMute = () => {
       if (!globalAudioContext || !globalGainNode) return;
       const currentGain = globalGainNode.gain.value;
       const isCurrentlyMuted = currentGain < 0.01;
       const targetGain = isCurrentlyMuted ? 1.0 : 0.0001;
       const newMutedState = !isCurrentlyMuted;

       globalGainNode.gain.exponentialRampToValueAtTime(targetGain, globalAudioContext.currentTime + 0.1);
       setIsMuted(newMutedState);
       console.log(newMutedState ? "Global Audio Muted via Post" : "Global Audio Unmuted via Post");
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

  const stopPlayback = useCallback(() => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
    setIsPlaying(false);
    setCurrentBeat(null);
    console.log(`Post ${fragment.id}: Playback stopped.`);
  }, [fragment.id]);

  const startPlayback = useCallback(() => {
      if (!globalAudioContext) {
          console.error("Post startPlayback: Audio context not initialized.");
          return;
      }
      if (!fragment || !fragment.pads || fragment.pads.length === 0) {
          console.warn(`Post ${fragment?.id}: No pads to play.`);
          return;
      }

      console.log(`Post ${fragment.id}: Attempting to start playback.`);
      globalAudioContext.resume().then(() => {
          console.log(`Post ${fragment.id}: Audio context resumed. Current state: ${globalAudioContext?.state}`);
          if (playbackIntervalRef.current) {
            clearInterval(playbackIntervalRef.current);
          }
          setIsPlaying(true);
          setCurrentBeat(0); // Start from the first beat (pad index 0)

          const bpm = fragment?.bpm || 120;
          const beatDuration = (60 / bpm) * 1000;
          console.log(`Post ${fragment.id}: BPM ${bpm}, Beat Duration ${beatDuration}ms.`);

          const playBeatSounds = (beatIndex: number) => { // beatIndex is the pad.id (0-15)
              const padToPlay = fragment.pads.find(p => p.id === beatIndex); // Find pad by its ID

              // For feed playback, play if the pad has sounds, regardless of its saved `isActive` (editor toggle)
              // The saved `isActive` is more for sequencer logic in editor/remix.
              if (padToPlay && padToPlay.sounds && padToPlay.sounds.length > 0) {
                  console.log(`Post ${fragment.id}: Playing Beat/Pad ID ${beatIndex}, Sounds: ${padToPlay.sounds.length}`);
                  padToPlay.sounds.forEach(soundToPlay => {
                      const urlToUse = soundToPlay?.downloadUrl;
                      if (urlToUse && urlToUse.startsWith('http')) {
                          const buffer = globalAudioBuffers[urlToUse];
                          if (buffer) {
                              playSound(buffer);
                              // console.log(`Post ${fragment.id}: Playing cached sound ${soundToPlay.soundName} from ${urlToUse}`);
                          } else {
                              console.warn(`Post ${fragment.id}: Playback - Buffer for ${soundToPlay.soundName} (${urlToUse}) not found, attempting load...`);
                              loadAudio(urlToUse).then(loadedBuffer => {
                                  if (loadedBuffer) {
                                    playSound(loadedBuffer);
                                    // console.log(`Post ${fragment.id}: Loaded and played sound ${soundToPlay.soundName} on demand.`);
                                  } else {
                                     console.error(`Post ${fragment.id}: Playback - Buffer for ${soundToPlay.soundName} (${urlToUse}) could not be loaded on demand.`);
                                  }
                              });
                          }
                      } else {
                          console.warn(`Post ${fragment.id}: Playback Beat/Pad ID ${beatIndex}, Sound ${soundToPlay?.soundName} - No valid HTTP download URL. Original: ${soundToPlay?.soundUrl}, Download: ${soundToPlay?.downloadUrl}`);
                      }
                  });
              } else {
                  // console.log(`Post ${fragment.id}: Skipping Beat/Pad ID ${beatIndex} - Pad ${padToPlay?.id} has no sounds or was not found.`);
              }
          };

          playBeatSounds(0); // Play sounds for the first beat (pad ID 0) immediately

          playbackIntervalRef.current = setInterval(() => {
            setCurrentBeat(prevBeat => {
              const nextBeatRaw = (prevBeat !== null ? prevBeat + 1 : 0);
              // Total pads in a 4x4 grid is 16 (0-15)
              const totalPadsInGrid = (fragment.rows || 4) * (fragment.columns || 4);
              const nextBeatId = nextBeatRaw % totalPadsInGrid;

              if (nextBeatRaw >= totalPadsInGrid && totalPadsInGrid > 0) {
                  // console.log(`Post ${fragment.id}: Playback loop finished, restarting from beat 0.`);
              }
              playBeatSounds(nextBeatId); // Pass the pad ID
              return nextBeatId; // This is the ID of the pad to be highlighted next
            });
          }, beatDuration);
          console.log(`Post ${fragment.id}: Playback interval set.`);
      }).catch(e => console.error(`Post ${fragment.id}: Error resuming audio context for playback:`, e));
  }, [fragment, playSound, loadAudio, stopPlayback]);

  const handlePlayPause = () => {
     console.log(`Post ${fragment.id}: handlePlayPause called. isPlaying: ${isPlaying}`);
     if (isPlaying) {
       stopPlayback();
     } else {
       startPlayback();
     }
  };

  useEffect(() => {
    // Cleanup playback on component unmount or if fragment changes
    return () => {
      stopPlayback();
    };
  }, [stopPlayback, fragment?.id]); // fragment.id ensures cleanup if a different fragment is somehow rendered by this instance


  const handleCommentSubmit = (e: React.FormEvent) => {
     e.preventDefault();
     if (!newComment.trim()) return;
     const commentToAdd: Comment = {
        id: `comment-${Date.now()}`,
        author: "CurrentUser", // Placeholder
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
    <TooltipProvider>
      <Card className="overflow-hidden shadow-md transition-shadow hover:shadow-lg">
        <CardHeader className="flex flex-row items-center space-x-3 p-4 bg-card">
          <Avatar>
            <AvatarImage src={fragment.authorAvatar || `https://placehold.co/40x40.png`} alt={fragment.author} data-ai-hint="avatar person" />
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

        <CardContent className="p-0 aspect-square bg-secondary/30 flex items-center justify-center">
           {/* Ensure fragment.pads is available before mapping */}
           <div className={`grid grid-cols-${fragment.columns || 4} gap-1 p-4 w-full h-full max-w-[200px] max-h-[200px] mx-auto`}>
             {(fragment.pads && fragment.pads.length > 0 ? fragment.pads : Array.from({ length: (fragment.rows || 4) * (fragment.columns || 4) }, (_, i) => ({ id: i, sounds: [], isActive: initialFragment?.pads?.find(p=>p.id===i)?.isActive || false, currentSoundIndex: 0 }))).map(pad => {
                // For feed display, a pad is visually "active" if it has sounds.
                // The editor's `isActive` toggle is respected by the API for what's in `pad_sounds`,
                // but for playback on feed, if sounds are present, we want to show them.
                const hasSounds = pad.sounds && pad.sounds.length > 0;
                const currentSoundIndex = pad.currentSoundIndex ?? 0;
                const currentSound: PadSound | undefined = hasSounds ? pad.sounds?.[currentSoundIndex] : undefined;
                const displayColor = currentSound?.color; // Color from client-side processing

                const bgColorClass = displayColor
                  ? displayColor // Use the sound's assigned color
                  : hasSounds
                    ? 'bg-gradient-to-br from-primary/30 to-secondary/30' // Pad has sounds, but no specific color (e.g., if first sound has no color yet)
                    : 'bg-muted/40'; // Pad has no sounds

                // A pad is highlighted if it's the current beat AND it has sounds to play.
                const isCurrentPlayingBeat = isPlaying && currentBeat === pad.id;
                const shouldHighlight = hasSounds && isCurrentPlayingBeat;

               return (
                 <Tooltip key={pad.id} delayDuration={200}>
                    <TooltipTrigger asChild>
                        <div
                            className={cn(
                            "relative w-full h-full rounded transition-all duration-100 border border-transparent",
                            bgColorClass,
                            shouldHighlight ? 'ring-2 ring-offset-1 ring-accent scale-[1.08] shadow-md border-accent/50' : '',
                            hasSounds && !shouldHighlight ? 'border-foreground/10' : 'border-background/10', // Subtle border if has sounds but not current beat
                            hasSounds && pad.sounds && pad.sounds.length > 1 && "flex items-center justify-center" // For multi-sound icon
                            )}
                        >
                            {/* Show layers icon if multiple sounds and pad has sounds */}
                            {hasSounds && pad.sounds && pad.sounds.length > 1 && <Layers className="w-1/2 h-1/2 text-white/50 absolute" />}
                            {hasSounds && pad.sounds && pad.sounds.length > 1 && <div className="absolute inset-0 bg-black/10 rounded"></div>}
                            {/* If single sound or no sound, div is just colored */}
                        </div>
                    </TooltipTrigger>
                     {hasSounds && ( // Only show tooltip if pad has sounds
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
                              <p className="text-muted-foreground italic">Pad has sounds</p> // Fallback if currentSound is somehow undefined
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
                {fragment.commentsCount || comments.length}
              </Button>
            </div>
            <Link href={`/remix/${fragment.id}`} passHref>
               <Button variant="outline" size="sm">
                  <GitFork className="mr-2 h-4 w-4" />
                  Remix
               </Button>
            </Link>
          </div>

           {showComments && (
             <div className="w-full space-y-4 pt-4 border-t">
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
    </TooltipProvider>
  );
}
