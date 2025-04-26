'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, GitFork, Play, Pause } from 'lucide-react';
import type { Fragment, Comment } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast"; // Import useToast

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

  const { toast } = useToast(); // Initialize toast

  const handleLike = () => {
    // TODO: Implement actual like logic (Server Action)
    setIsLiked(!isLiked);
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
     toast({
      title: isLiked ? "Unliked Fragment" : "Liked Fragment",
      description: `You ${isLiked ? 'unliked' : 'liked'} ${fragment.author}'s fragment.`,
    });
  };

  const handlePlayPause = () => {
     // TODO: Implement actual audio playback logic
    setIsPlaying(!isPlaying);
     toast({
      title: isPlaying ? "Playback Paused" : "Playback Started",
      description: `${isPlaying ? 'Paused' : 'Playing'} ${fragment.author}'s fragment.`,
    });
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
     e.preventDefault();
     if (!newComment.trim()) return;

     // TODO: Implement actual comment submission logic (Server Action)
     const commentToAdd: Comment = {
        id: `comment-${Date.now()}`, // Temporary ID
        author: "CurrentUser", // Replace with actual user
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
    <Card className="overflow-hidden shadow-md transition-shadow hover:shadow-lg">
      <CardHeader className="flex flex-row items-center space-x-3 p-4 bg-card">
        <Avatar>
          <AvatarImage src={fragment.authorAvatar} alt={fragment.author} />
          <AvatarFallback>{fragment.author.substring(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <CardTitle className="text-sm font-medium">{fragment.author}</CardTitle>
           {fragment.originalAuthor && (
             <p className="text-xs text-muted-foreground">
               Remixed from <span className="font-medium text-primary">{fragment.originalAuthor}</span>
             </p>
           )}
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(fragment.timestamp, { addSuffix: true })}
          </p>
        </div>
         <Button variant="ghost" size="icon" onClick={handlePlayPause} aria-label={isPlaying ? "Pause fragment" : "Play fragment"}>
           {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
         </Button>
      </CardHeader>

      {/* Placeholder for visual representation of the fragment */}
      <CardContent className="p-0 aspect-square bg-secondary/30 flex items-center justify-center">
        {/* Simple grid visualization */}
         <div className="grid grid-cols-4 gap-1 p-4 w-full h-full max-w-[200px] max-h-[200px] mx-auto">
           {fragment.pads.map(pad => (
             <div
               key={pad.id}
               className={cn(
                 "w-full h-full rounded transition-colors duration-300",
                 pad.isActive ? 'bg-accent/70' : 'bg-muted/50'
               )}
                style={{ animation: isPlaying && pad.isActive ? `pulse 1s infinite ${pad.id * 0.05}s` : 'none' }} // Simple pulse animation
             />
           ))}
         </div>
         <style jsx>{`
           @keyframes pulse {
             0%, 100% { opacity: 0.7; }
             50% { opacity: 1; transform: scale(1.05); }
           }
         `}</style>
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
  );
}
