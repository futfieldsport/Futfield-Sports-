import React, { useState, useEffect } from 'react';
import { X, Send, Heart, MessageCircle, CornerDownRight } from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { VideoItem } from '../../types/football';
import { fetchVideoCommentsFromServer, addVideoCommentOnServer } from '../../services/supabaseClient';
import { haptics } from '../../utils/haptics';
import { useHaptics } from '../../hooks/useHaptics';

interface VideoCommentItem {
  id: string;
  author: {
    name: string;
    handle: string;
    avatar: string;
    isVerified?: boolean;
  };
  text: string;
  timestamp: string;
  likes: number;
  isLiked?: boolean;
  replies?: VideoCommentItem[];
}

interface VideoCommentsDrawerProps {
  video: VideoItem;
  isOpen: boolean;
  onClose: () => void;
}

export const VideoCommentsDrawer: React.FC<VideoCommentsDrawerProps> = ({
  video,
  isOpen,
  onClose,
}) => {
  const { user, addFanPoints, addNotification, navigateToProfile } = useFootball();
  const { triggerMessage } = useHaptics();
  const [commentInput, setCommentInput] = useState('');
  const [replyTarget, setReplyTarget] = useState<{ parentId: string; authorName: string } | null>(null);
  const [comments, setComments] = useState<VideoCommentItem[]>(() => {
    try {
      const stored = localStorage.getItem(`futfield_vcomments_${video.id}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Load from server
  useEffect(() => {
    if (isOpen && video?.id) {
      fetchVideoCommentsFromServer(video.id).then(list => {
        if (Array.isArray(list) && list.length > 0) {
          setComments(list);
          try {
            localStorage.setItem(`futfield_vcomments_${video.id}`, JSON.stringify(list));
          } catch {}
        }
      });
    }
  }, [isOpen, video?.id]);

  if (!isOpen) return null;

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;

    const author = {
      name: user.name,
      handle: user.handle,
      avatar: user.avatar,
      isVerified: user.isAuthenticated,
    };

    const parentId = replyTarget ? replyTarget.parentId : undefined;

    const res = await addVideoCommentOnServer(video.id, author, commentInput.trim(), parentId);

    const newComment: VideoCommentItem = res?.comment || {
      id: `vc_${Date.now()}`,
      author,
      text: commentInput.trim(),
      timestamp: 'Just now',
      likes: 0,
      isLiked: false,
      replies: [],
    };

    let updated: VideoCommentItem[];
    if (parentId) {
      updated = comments.map(c => {
        if (c.id === parentId) {
          return {
            ...c,
            replies: [...(c.replies || []), newComment],
          };
        }
        return c;
      });
    } else {
      updated = [newComment, ...comments];
    }

    setComments(updated);
    try {
      localStorage.setItem(`futfield_vcomments_${video.id}`, JSON.stringify(updated));
    } catch {}

    setCommentInput('');
    setReplyTarget(null);
    triggerMessage();
    addFanPoints(5, 'Commented on football reel');
    addNotification({
      title: parentId ? 'Reply Sent!' : 'Comment Published!',
      body: 'Your tactical insight was shared on the Reel.',
      type: 'comment',
    });
  };

  const toggleLikeComment = (commentId: string) => {
    haptics.like();
    setComments(prev => {
      const next = prev.map(c => {
        if (c.id === commentId) {
          const isLiked = !c.isLiked;
          return {
            ...c,
            isLiked,
            likes: isLiked ? c.likes + 1 : Math.max(0, c.likes - 1),
          };
        }
        return c;
      });
      try {
        localStorage.setItem(`futfield_vcomments_${video.id}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-[#161b22] border border-slate-200 dark:border-white/10 rounded-t-3xl sm:rounded-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50 dark:bg-[#0d1117] shrink-0">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-[#00E676]" />
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
              Comments ({comments.length})
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-white/70 hover:text-black dark:hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Comments List */}
        <div className="p-4 overflow-y-auto space-y-3.5 flex-1 no-scrollbar min-h-[220px]">
          {comments.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="text-2xl">💬</div>
              <h4 className="font-bold text-white text-sm">No comments yet</h4>
              <p className="text-xs text-white/40 max-w-xs mx-auto">
                Be the first to share your thoughts on this football moment!
              </p>
            </div>
          ) : (
            comments.map(c => (
              <div key={c.id} className="space-y-1.5">
                <div className="flex items-start gap-3 text-xs">
                  <img
                    src={c.author?.avatar || user.avatar}
                    alt={c.author?.name || 'Supporter'}
                    onClick={() => {
                      onClose();
                      navigateToProfile(c.author?.handle || c.author?.name || 'Supporter');
                    }}
                    className="w-8 h-8 rounded-full object-cover ring-1 ring-white/10 shrink-0 mt-0.5 cursor-pointer hover:opacity-80 transition-opacity"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        onClick={() => {
                          onClose();
                          navigateToProfile(c.author?.handle || c.author?.name || 'Supporter');
                        }}
                        className="font-bold text-white truncate cursor-pointer hover:underline"
                      >
                        {c.author?.name || 'Supporter'}
                      </span>
                      <span className="text-[10px] text-white/40 font-mono">{c.timestamp}</span>
                    </div>
                    <p className="text-white/80 mt-1 leading-relaxed break-words">{c.text}</p>
                  </div>
                  <button
                    onClick={() => toggleLikeComment(c.id)}
                    className={`flex flex-col items-center gap-0.5 pt-1 transition-colors ${
                      c.isLiked ? 'text-rose-500' : 'text-white/40 hover:text-white'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${c.isLiked ? 'fill-rose-500' : ''}`} />
                    <span className="text-[10px] font-mono">{c.likes}</span>
                  </button>
                </div>

                {/* Reply trigger button */}
                <div className="pl-11 flex items-center gap-3 text-[10px] text-white/40">
                  <button
                    onClick={() => setReplyTarget({ parentId: c.id, authorName: c.author?.name || 'Supporter' })}
                    className="hover:text-[#00E676] font-semibold"
                  >
                    Reply
                  </button>
                </div>

                {/* Nested Sub-replies */}
                {c.replies && c.replies.length > 0 && (
                  <div className="pl-10 space-y-1.5 border-l-2 border-white/10 ml-4">
                    {c.replies.map(r => (
                      <div key={r.id} className="flex items-start gap-2 text-xs">
                        <CornerDownRight className="w-3.5 h-3.5 text-white/40 shrink-0 mt-1" />
                        <div className="flex-1 bg-white/5 p-2 rounded-xl">
                          <span className="font-bold text-[10px] text-white block">
                            {r.author?.name || 'Supporter'}
                          </span>
                          <p className="text-white/80 text-[11px] mt-0.5">{r.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSendComment}
          className="p-3 bg-slate-50 dark:bg-[#0d1117] border-t border-slate-200 dark:border-white/10 flex items-center gap-2 shrink-0"
        >
          <img
            src={user.avatar}
            alt={user.name}
            className="w-8 h-8 rounded-full object-cover ring-1 ring-[#00E676]/40 shrink-0"
          />
          <div className="flex-1 flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5">
            <input
              type="text"
              placeholder={
                replyTarget
                  ? `Replying to @${replyTarget.authorName}...`
                  : 'Add a football comment...'
              }
              value={commentInput}
              onChange={e => setCommentInput(e.target.value)}
              className="flex-1 bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus:outline-none"
            />
            {replyTarget && (
              <button
                type="button"
                onClick={() => setReplyTarget(null)}
                className="text-[10px] text-white/40 hover:text-white"
              >
                Cancel
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={!commentInput.trim()}
            className="p-2 rounded-xl bg-[#00E676] text-black font-bold disabled:opacity-40 hover:bg-[#00c864] transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
