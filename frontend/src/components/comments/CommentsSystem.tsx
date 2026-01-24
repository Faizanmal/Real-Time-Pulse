'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, Send, Trash2, Reply, ThumbsUp, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Comment {
  id: string;
  entityType: string;
  entityId: string;
  content: string;
  author: string;
  authorId: string;
  likes: number;
  replies: Comment[];
  createdAt: string;
  updatedAt: string;
}

export default function CommentsSystem() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [selectedEntityType, setSelectedEntityType] = useState('all');

  const fetchComments = useCallback(async () => {
    try {
      const url = selectedEntityType === 'all'
        ? '/api/comments'
        : `/api/comments?entityType=${selectedEntityType}`;
      const response = await fetch(url);
      const data = await response.json();
      setComments(data);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  }, [selectedEntityType]);

  useEffect(() => {
    fetchComments();
  }, [selectedEntityType, fetchComments]);

  const createComment = async () => {
    try {
      await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'dashboard',
          entityId: 'default',
          content: newComment
        })
      });
      setNewComment('');
      fetchComments();
    } catch (error) {
      console.error('Failed to create comment:', error);
    }
  };

  const replyToComment = async (commentId: string) => {
    try {
      await fetch(`/api/comments/${commentId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyContent })
      });
      setReplyingTo(null);
      setReplyContent('');
      fetchComments();
    } catch (error) {
      console.error('Failed to reply to comment:', error);
    }
  };

  const likeComment = async (commentId: string) => {
    try {
      await fetch(`/api/comments/${commentId}/like`, { method: 'POST' });
      fetchComments();
    } catch (error) {
      console.error('Failed to like comment:', error);
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
      fetchComments();
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  const entityTypes = ['all', 'dashboard', 'chart', 'report', 'dataset'];

  const CommentCard = ({ comment, depth = 0 }: { comment: Comment; depth?: number }) => (
    <Card className={`${depth > 0 ? 'ml-8 mt-2' : ''}`}>
      <CardContent className="pt-4">
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4" />
              </div>
              <div>
                <div className="font-semibold text-sm">{comment.author}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(comment.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
            <div className="flex gap-1">
              <Badge variant="outline">{comment.entityType}</Badge>
            </div>
          </div>
          <p className="text-sm">{comment.content}</p>
          <div className="flex gap-2 pt-2 border-t">
            <Button size="sm" variant="ghost" onClick={() => likeComment(comment.id)}>
              <ThumbsUp className="h-3 w-3 mr-1" />
              {comment.likes}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setReplyingTo(comment.id)}>
              <Reply className="h-3 w-3 mr-1" />
              Reply
            </Button>
            <Button size="sm" variant="ghost" onClick={() => deleteComment(comment.id)}>
              <Trash2 className="h-3 w-3 mr-1" />
              Delete
            </Button>
          </div>
          {replyingTo === comment.id && (
            <div className="flex gap-2 pt-2">
              <Input
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Write a reply..."
                className="flex-1"
              />
              <Button size="sm" onClick={() => replyToComment(comment.id)}>
                <Send className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => setReplyingTo(null)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      </CardContent>
      {comment.replies && comment.replies.length > 0 && (
        <div className="px-4 pb-4">
          {comment.replies.map((reply) => (
            <CommentCard key={reply.id} comment={reply} depth={depth + 1} />
          ))}
        </div>
      )}
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MessageCircle className="h-8 w-8" />
            Comments
          </h1>
          <p className="text-muted-foreground">Collaborate with team comments</p>
        </div>
      </div>

      <div className="flex gap-2">
        {entityTypes.map((type) => (
          <Button
            key={type}
            variant={selectedEntityType === type ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedEntityType(type)}
          >
            {type}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Comment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              rows={3}
              className="flex-1"
            />
            <Button onClick={createComment} disabled={!newComment.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {comments.map((comment) => (
          <CommentCard key={comment.id} comment={comment} />
        ))}
      </div>

      {comments.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No comments yet. Be the first to comment!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
