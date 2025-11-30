'use client';

import { useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  Reply,
  MoreVertical,
  Pin,
  CheckCircle,
  Edit2,
  Trash2,
  Send,
  AtSign,
  X,
} from 'lucide-react';
import { commentsApi, Comment, CreateCommentDto } from '@/src/lib/enterprise-api';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Textarea } from '@/src/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/src/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';

interface CommentsSectionProps {
  className?: string;
  resourceType: 'portal' | 'widget';
  resourceId: string;
  currentUserId?: string;
}

export function CommentsSection({
  className,
  resourceType,
  resourceId,
  currentUserId,
}: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  useEffect(() => {
    loadComments();
  }, [resourceType, resourceId]);

  const loadComments = async () => {
    try {
      const data = await commentsApi.getByResource(resourceType, resourceId);
      // Sort: pinned first, then by date
      const sorted = data.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setComments(sorted);
    } catch (error) {
      console.error('Failed to load comments:', error);
      toast.error('Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const addComment = async (parentId?: string) => {
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const data: CreateCommentDto = {
        content: newComment,
        resourceType,
        resourceId,
        parentId,
        mentions: extractMentions(newComment),
      };

      await commentsApi.create(data);
      setNewComment('');
      setReplyingTo(null);
      toast.success('Comment added');
      loadComments();
    } catch (error) {
      console.error('Failed to add comment:', error);
      toast.error('Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@(\w+)/g;
    const matches = text.match(mentionRegex);
    return matches ? matches.map((m) => m.slice(1)) : [];
  };

  const pinnedComments = comments.filter((c) => c.isPinned && !c.parentId);
  const regularComments = comments.filter((c) => !c.isPinned && !c.parentId);

  return (
    <Card className={cn('p-6', className)}>
      <div className="flex items-center gap-2 mb-6">
        <MessageCircle className="h-5 w-5 text-blue-500" />
        <h3 className="text-lg font-semibold">Comments</h3>
        <Badge variant="secondary">{comments.length}</Badge>
      </div>

      {/* New Comment Input */}
      <div className="mb-6">
        <CommentInput
          value={newComment}
          onChange={setNewComment}
          onSubmit={() => addComment()}
          submitting={submitting}
          placeholder="Write a comment..."
        />
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-gray-200 rounded"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No comments yet.</p>
          <p className="text-sm">Be the first to leave a comment!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Pinned Comments */}
          {pinnedComments.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Pin className="h-4 w-4" />
                <span>Pinned</span>
              </div>
              {pinnedComments.map((comment) => (
                <CommentCard
                  key={comment.id}
                  comment={comment}
                  currentUserId={currentUserId}
                  onReply={setReplyingTo}
                  replyingTo={replyingTo}
                  newComment={newComment}
                  setNewComment={setNewComment}
                  onSubmitReply={addComment}
                  submitting={submitting}
                  onRefresh={loadComments}
                  allComments={comments}
                />
              ))}
            </div>
          )}

          {/* Regular Comments */}
          {regularComments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              onReply={setReplyingTo}
              replyingTo={replyingTo}
              newComment={newComment}
              setNewComment={setNewComment}
              onSubmitReply={addComment}
              submitting={submitting}
              onRefresh={loadComments}
              allComments={comments}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

interface CommentCardProps {
  comment: Comment;
  currentUserId?: string;
  onReply: (commentId: string | null) => void;
  replyingTo: string | null;
  newComment: string;
  setNewComment: (value: string) => void;
  onSubmitReply: (parentId: string) => void;
  submitting: boolean;
  onRefresh: () => void;
  allComments: Comment[];
  depth?: number;
}

function CommentCard({
  comment,
  currentUserId,
  onReply,
  replyingTo,
  newComment,
  setNewComment,
  onSubmitReply,
  submitting,
  onRefresh,
  allComments,
  depth = 0,
}: CommentCardProps) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);

  const isOwner = currentUserId === comment.authorId;
  const replies = allComments.filter((c) => c.parentId === comment.id);

  const getInitials = (author: Comment['author']) => {
    if (author.firstName && author.lastName) {
      return `${author.firstName[0]}${author.lastName[0]}`.toUpperCase();
    }
    return author.email[0].toUpperCase();
  };

  const getAuthorName = (author: Comment['author']) => {
    if (author.firstName && author.lastName) {
      return `${author.firstName} ${author.lastName}`;
    }
    return author.email;
  };

  const handleEdit = async () => {
    if (!editContent.trim()) return;

    try {
      await commentsApi.update(comment.id, editContent);
      setEditing(false);
      toast.success('Comment updated');
      onRefresh();
    } catch (error) {
      console.error('Failed to update comment:', error);
      toast.error('Failed to update comment');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      await commentsApi.delete(comment.id);
      toast.success('Comment deleted');
      onRefresh();
    } catch (error) {
      console.error('Failed to delete comment:', error);
      toast.error('Failed to delete comment');
    }
  };

  const handlePin = async () => {
    try {
      await commentsApi.togglePin(comment.id);
      toast.success(comment.isPinned ? 'Comment unpinned' : 'Comment pinned');
      onRefresh();
    } catch (error) {
      console.error('Failed to toggle pin:', error);
      toast.error('Failed to toggle pin');
    }
  };

  const handleResolve = async () => {
    try {
      await commentsApi.toggleResolved(comment.id);
      toast.success(
        comment.isResolved ? 'Comment reopened' : 'Comment resolved'
      );
      onRefresh();
    } catch (error) {
      console.error('Failed to toggle resolve:', error);
      toast.error('Failed to toggle resolve');
    }
  };

  const highlightMentions = (text: string) => {
    return text.replace(
      /@(\w+)/g,
      '<span class="text-blue-500 font-medium">@$1</span>'
    );
  };

  return (
    <div className={cn('group', depth > 0 && 'ml-8 border-l-2 pl-4')}>
      <div
        className={cn(
          'rounded-lg p-4 transition-colors',
          comment.isResolved ? 'bg-green-50 border border-green-200' : 'bg-gray-50',
          comment.isPinned && !comment.isResolved && 'bg-yellow-50 border border-yellow-200'
        )}
      >
        <div className="flex items-start gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
              {getInitials(comment.author)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">
                {getAuthorName(comment.author)}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(comment.createdAt).toLocaleString()}
              </span>
              {comment.isEdited && (
                <span className="text-xs text-gray-400">(edited)</span>
              )}
              {comment.isPinned && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Pin className="h-3 w-3" />
                  Pinned
                </Badge>
              )}
              {comment.isResolved && (
                <Badge
                  variant="outline"
                  className="text-xs gap-1 border-green-500 text-green-700"
                >
                  <CheckCircle className="h-3 w-3" />
                  Resolved
                </Badge>
              )}
            </div>

            {editing ? (
              <div className="space-y-2">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[80px]"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleEdit}>
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(false);
                      setEditContent(comment.content);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p
                className="text-sm text-gray-700 whitespace-pre-wrap"
                dangerouslySetInnerHTML={{
                  __html: highlightMentions(comment.content),
                }}
              />
            )}

            {!editing && (
              <div className="flex items-center gap-2 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() =>
                    onReply(replyingTo === comment.id ? null : comment.id)
                  }
                >
                  <Reply className="h-3 w-3" />
                  Reply
                </Button>

                {replies.length > 0 && (
                  <span className="text-xs text-gray-500">
                    {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                  </span>
                )}
              </div>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handlePin}>
                <Pin className="h-4 w-4 mr-2" />
                {comment.isPinned ? 'Unpin' : 'Pin'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleResolve}>
                <CheckCircle className="h-4 w-4 mr-2" />
                {comment.isResolved ? 'Reopen' : 'Resolve'}
              </DropdownMenuItem>
              {isOwner && (
                <>
                  <DropdownMenuItem onClick={() => setEditing(true)}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Reply Input */}
      {replyingTo === comment.id && (
        <div className="mt-2 ml-11">
          <CommentInput
            value={newComment}
            onChange={setNewComment}
            onSubmit={() => onSubmitReply(comment.id)}
            onCancel={() => onReply(null)}
            submitting={submitting}
            placeholder={`Reply to ${getAuthorName(comment.author)}...`}
            autoFocus
          />
        </div>
      )}

      {/* Nested Replies */}
      {replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {replies.map((reply) => (
            <CommentCard
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              onReply={onReply}
              replyingTo={replyingTo}
              newComment={newComment}
              setNewComment={setNewComment}
              onSubmitReply={onSubmitReply}
              submitting={submitting}
              onRefresh={onRefresh}
              allComments={allComments}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CommentInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  submitting: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

function CommentInput({
  value,
  onChange,
  onSubmit,
  onCancel,
  submitting,
  placeholder = 'Write a comment...',
  autoFocus = false,
}: CommentInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
    }
    if (e.key === 'Escape' && onCancel) {
      onCancel();
    }
  };

  return (
    <div className="space-y-2">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="min-h-[80px] resize-none"
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <AtSign className="h-3 w-3" />
          <span>Use @name to mention someone</span>
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="sm"
            onClick={onSubmit}
            disabled={submitting || !value.trim()}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            {submitting ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}
