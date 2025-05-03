// src/components/fragments/fragment-post.tsx
'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, GitFork, Play, Pause, Layers, Volume2, VolumeX } from 'lucide-react'; // Added Layers, Volume icons
import type { Fragment, Comment, PadSound } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Import Tooltip components

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


export default function FragmentPost({ fragment }: FragmentPostProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<Comment[]>(fragment.comments);
  const [likeCount, setLikeCount] = useState(fragment.likes);
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

  // --- Audio Loading (uses global cache) ---
  const loadAudio = useCallback(async (url: string): Promise<AudioBuffer | null> => {
      if (!globalAudioContext || !url) return null;
      if (globalAudioBuffers[url]) return globalAudioBuffers[url]; // Return cached buffer

      console.log(`Post: Attempting to load audio from: ${url}`);
      try {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await globalAudioContext.decodeAudioData(arrayBuffer);
          globalAudioBuffers[url] = audioBuffer; // Cache globally
          console.log(`Post: Audio loaded and decoded successfully: ${url}`);
          return audioBuffer;
      } catch (error) {
          console.error(`Post: Error loading or decoding audio file ${url}:`, error);
          // Avoid spamming toasts for every post if the same sound fails
          // toast({ variant: "destructive", title: "Audio Load Error", description: `Could not load sound: ${url}` });
          return null;
      }
  }, []);

  // Preload sounds for this fragment when it becomes visible or data changes
  useEffect(() => {
      fragment.pads.forEach(pad => {
          pad.sounds.forEach(sound => {
              if (sound.downloadUrl) {
                  loadAudio(sound.downloadUrl); // Start loading
              }
          });
      });
  }, [fragment.pads, loadAudio]);

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
     toast({
      title: isLiked ? "Unliked Fragment" : "Liked Fragment",
      description: `You ${isLiked ? 'unliked' : 'liked'} ${fragment.author}'s fragment.`,
    });
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
          toast({ variant: "destructive", title: "Audio Error", description: "Audio context not initialized." });
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

    const bpm = fragment.bpm || 120;
    const beatDuration = (60 / bpm) * 1000;

    playbackIntervalRef.current = setInterval(() => {
      setCurrentBeat(prevBeat => {
        const nextBeat = (prevBeat !== null ? prevBeat + 1 : 0) % 16;
        const padToPlay = fragment.pads[nextBeat];

        if (padToPlay?.isActive && padToPlay.sounds.length > 0) {
            const soundToPlay = padToPlay.sounds[padToPlay.currentSoundIndex ?? 0];
            if (soundToPlay?.downloadUrl) {
               const buffer = globalAudioBuffers[soundToPlay.downloadUrl];
               if (buffer) {
                  playSound(buffer);
               } else {
                   // Attempt to load if not found (might be slightly delayed)
                   loadAudio(soundToPlay.downloadUrl).then(loadedBuffer => {
                       if (loadedBuffer) playSound(loadedBuffer);
                   });
               }
            }
        }
        return nextBeat;
      });
    }, beatDuration);
  }, [fragment.bpm, fragment.pads, playSound, loadAudio, toast]); // Added toast

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
  }, [stopPlayback, fragment.id]); // Add fragment.id to dependencies


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
      toast({
        title: "Comment Added",
        description: "Your comment has been posted.",
      });
  }


  return (
    <TooltipProvider> {/* Wrap with TooltipProvider */}
      <Card className="overflow-hidden shadow-md transition-shadow hover:shadow-lg">
        <CardHeader className="flex flex-row items-center space-x-3 p-4 bg-card">
          <Avatar>
            <AvatarImage src={fragment.authorAvatar} alt={fragment.author} data-ai-hint="avatar person" />
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
              {formatDistanceToNow(fragment.timestamp, { addSuffix: true })}
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
             {fragment.pads.map(pad => {
                const isPadActive = pad.isActive && pad.sounds.length > 0;
                 // Use the current sound's color if available
                 const currentSound: PadSound | undefined = pad.sounds[pad.currentSoundIndex ?? 0];
                 const displayColor = isPadActive && currentSound ? currentSound.color : undefined;

                 const bgColorClass = displayColor
                     ? displayColor // Use the specific sound's color
                     : isPadActive
                         ? 'bg-gradient-to-br from-muted to-secondary' // Neutral/gradient for multiple sounds or if first sound lacks color
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
                             pad.sounds.length > 1 && "flex items-center justify-center"
                            )}
                        >
                             {/* Icon for multiple sounds */}
                            {pad.sounds.length > 1 && <Layers className="w-1/2 h-1/2 text-white/70 absolute" />}
                            {/* Optional: Dim the background slightly if > 1 sound to make Layers icon pop? */}
                            {pad.sounds.length > 1 && <div className="absolute inset-0 bg-black/10 rounded"></div>}
                        </div>
                    </TooltipTrigger>
                     {/* Tooltip shows sound details */}
                     {isPadActive && (
                        <TooltipContent side="top" className="bg-background text-foreground text-xs p-2 max-w-[150px]">
                            {pad.sounds.length === 1 ? (
                                // Show single sound name
                                <p>{pad.sounds[0].soundName}</p>
                            ) : (
                                // List multiple sounds
                                <>
                                <ul className="list-none p-0 m-0 space-y-1">
                                {pad.sounds.map((s, idx) => (
                                    <li key={s.soundId} className={cn("flex items-center", idx === (pad.currentSoundIndex ?? 0) ? "font-semibold" : "")}>
                                        <div className={`w-3 h-3 rounded-sm mr-2 shrink-0 ${s.color}`}></div>
                                        <span className="truncate">{s.soundName}</span>
                                    </li>
                                ))}
                                </ul>
                                 <p className="text-xs text-muted-foreground mt-1 pt-1 border-t border-border/50">Current: {currentSound?.soundName}</p>
                                </>
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
                          {formatDistanceToNow(comment.timestamp, { addSuffix: true })}
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

