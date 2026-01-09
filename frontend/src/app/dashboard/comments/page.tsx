'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { commentsApi, type Comment } from '@/lib/api/index';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  MessageSquare, Send, RefreshCw, Edit, Trash2, Reply,
  MoreVertical, Clock, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CommentItemProps {
  comment: Comment;
  onReply: (parentId: string) => void;
  onEdit: (comment: Comment) => void;
  onDelete: (id: string) => void;
  depth?: number;
}

function CommentItem({ comment, onReply, onEdit, onDelete, depth = 0 }: CommentItemProps) {
  const [showReplies, setShowReplies] = useState(depth < 2);
  const hasReplies = comment.replies && comment.replies.length > 0;

  return (
    <div className={`${depth > 0 ? 'ml-8 border-l-2 border-gray-200 dark:border-gray-700 pl-4' : ''}`}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex gap-3 py-3"
      >
        <Avatar className="h-8 w-8">
          <AvatarImage src={comment.user?.avatar} />
          <AvatarFallback>
            {comment.user?.name?.charAt(0) || 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{comment.user?.name || 'Anonymous'}</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(comment.createdAt).toLocaleString()}
              </span>
              {comment.updatedAt !== comment.createdAt && (
                <Badge variant="secondary" className="text-xs">edited</Badge>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onReply(comment.id)}>
                  <Reply className="h-4 w-4 mr-2" />
                  Reply
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(comment)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(comment.id)} className="text-red-600">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>
          
          {hasReplies && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-xs"
              onClick={() => setShowReplies(!showReplies)}
            >
              {showReplies ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Hide replies ({comment.replies!.length})
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Show replies ({comment.replies!.length})
                </>
              )}
            </Button>
          )}
        </div>
      </motion.div>

      {hasReplies && showReplies && (
        <AnimatePresence>
          {comment.replies!.map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}

export default function CommentsPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<Comment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Default entity for demo - in real app, this would come from context or props
  const entityId = 'demo';

  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await commentsApi.getByPortal(entityId);
      setComments(data);
    } catch (error) {
      console.error('Failed to load comments:', error);
      toast.error('Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleSubmit = async () => {
    if (!newComment.trim()) {
      toast.error('Please enter a comment');
      return;
    }

    setSubmitting(true);
    try {
      if (editingComment) {
        await commentsApi.update(editingComment.id, { content: newComment });
        toast.success('Comment updated');
        setEditingComment(null);
      } else {
        await commentsApi.create({
          portalId: entityId,
          content: newComment,
          parentId: replyTo || undefined,
        });
        toast.success(replyTo ? 'Reply added' : 'Comment added');
        setReplyTo(null);
      }
      setNewComment('');
      loadComments();
    } catch (error) {
      console.error('Submit failed:', error);
      toast.error('Failed to submit comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = (parentId: string) => {
    setReplyTo(parentId);
    setEditingComment(null);
    textareaRef.current?.focus();
  };

  const handleEdit = (comment: Comment) => {
    setEditingComment(comment);
    setNewComment(comment.content);
    setReplyTo(null);
    textareaRef.current?.focus();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      await commentsApi.delete(id);
      toast.success('Comment deleted');
      loadComments();
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('Failed to delete comment');
    }
  };

  const handleCancel = () => {
    setNewComment('');
    setReplyTo(null);
    setEditingComment(null);
  };

  const stats = {
    total: comments.length,
    withReplies: comments.filter(c => c.replies && c.replies.length > 0).length,
    totalReplies: comments.reduce((sum, c) => sum + (c.replies?.length || 0), 0),
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-purple-500" />
            Comments & Discussion
          </h1>
          <p className="text-muted-foreground mt-1">
            Collaborate and discuss with your team
          </p>
        </div>
        <Button variant="outline" onClick={loadComments} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Comments</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">With Replies</p>
                <p className="text-2xl font-bold">{stats.withReplies}</p>
              </div>
              <Reply className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Replies</p>
                <p className="text-2xl font-bold">{stats.totalReplies}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Comment Input */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-lg">
                {editingComment ? 'Edit Comment' : replyTo ? 'Reply to Comment' : 'Add Comment'}
              </CardTitle>
              {(replyTo || editingComment) && (
                <CardDescription>
                  {replyTo && 'Replying to a comment'}
                  {editingComment && 'Editing your comment'}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                ref={textareaRef}
                placeholder="Write your comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <div className="flex gap-2">
                {(replyTo || editingComment) && (
                  <Button variant="outline" onClick={handleCancel}>
                    Cancel
                  </Button>
                )}
                <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {editingComment ? 'Update' : replyTo ? 'Reply' : 'Comment'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Comments List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Discussion</CardTitle>
              <CardDescription>
                {comments.length} comment{comments.length !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {comments.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No comments yet</h3>
                  <p className="text-muted-foreground">Be the first to start the discussion</p>
                </div>
              ) : (
                <div className="divide-y">
                  <AnimatePresence>
                    {comments.map(comment => (
                      <CommentItem
                        key={comment.id}
                        comment={comment}
                        onReply={handleReply}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
