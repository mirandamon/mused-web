// src/components/fragments/fragment-post.tsx
'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, GitFork, Play, Pause, Layers } from 'lucide-react'; // Added Layers
import type { Fragment, Comment } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Import Tooltip components

interface FragmentPostProps {
  fragment: Fragment;
}

export default function FragmentPost({ fragment }: FragmentPostProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<Comment[]>(fragment.comments);
  const [likeCount, setLikeCount] = useState(fragment.likes);
  const [currentBeat, setCurrentBeat] = useState<number | null>(null);

  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

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
             // TODO: Trigger actual sound playback for all sounds in padToPlay.sounds
             // console.log(`Post Beat: ${nextBeat}, Sounds: ${padToPlay.sounds.map(s => s.soundName).join(', ')}`);
        }
        return nextBeat;
      });
    }, beatDuration);
  }, [fragment.bpm, fragment.pads]); // Depend on fragment's bpm and pads

  const handlePlayPause = () => {
     if (isPlaying) {
       stopPlayback();
       toast({
         title: "Playback Paused",
         description: `Paused ${fragment.author}'s fragment.`,
       });
     } else {
       startPlayback();
       toast({
         title: "Playback Started",
         description: `Playing ${fragment.author}'s fragment at ${fragment.bpm || 120} BPM.`,
       });
     }
  };

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);


  const handleCommentSubmit = (e: React.FormEvent) => {
     e.preventDefault();
     if (!newComment.trim()) return;

     const commentToAdd: Comment = {
        id: `comment-${Date.now()}`,
        author: "CurrentUser",
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
            <AvatarImage src={fragment.authorAvatar} alt={fragment.author} />
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
           <Button variant="ghost" size="icon" onClick={handlePlayPause} aria-label={isPlaying ? "Pause fragment" : "Play fragment"}>
             {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
           </Button>
        </CardHeader>

        {/* Visual representation */}
        <CardContent className="p-0 aspect-square bg-secondary/30 flex items-center justify-center">
           <div className="grid grid-cols-4 gap-1 p-4 w-full h-full max-w-[200px] max-h-[200px] mx-auto">
             {fragment.pads.map(pad => {
                const isPadActive = pad.isActive && pad.sounds.length > 0;
                // Background: Use first sound's color, a gradient for multiple, or muted/inactive color
                const bgColorClass = isPadActive
                    ? pad.sounds.length === 1
                        ? pad.sounds[0].color
                        : 'bg-gradient-to-br from-muted to-secondary' // Neutral/gradient for multiple sounds
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
                             // Add subtle indicator for multiple sounds
                             pad.sounds.length > 1 && "flex items-center justify-center"
                            )}
                        >
                             {/* Icon for multiple sounds */}
                            {pad.sounds.length > 1 && <Layers className="w-1/2 h-1/2 text-white/70 absolute" />}
                            {/* Optional: Dim the background slightly if > 1 sound to make Layers icon pop? */}
                            {/* {pad.sounds.length > 1 && <div className="absolute inset-0 bg-black/10 rounded"></div>} */}
                        </div>
                    </TooltipTrigger>
                     {/* Tooltip shows sound details */}
                     {isPadActive && (
                        <TooltipContent side="top" className="bg-background text-foreground text-xs p-2">
                            {pad.sounds.length === 1 ? (
                                <p>{pad.sounds[0].soundName}</p>
                            ) : (
                                <ul className="list-none p-0 m-0 space-y-1">
                                {pad.sounds.map((s) => (
                                    <li key={s.soundId} className="flex items-center">
                                        <div className={`w-3 h-3 rounded-sm mr-2 ${s.color}`}></div>
                                        {s.soundName}
                                    </li>
                                ))}
                                </ul>
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
