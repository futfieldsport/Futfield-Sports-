import React, { useState, useEffect } from 'react';
import { X, Send, Flame, MessageCircle, CornerDownRight } from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { FutubeShout, VideoItem } from '../../types/football';
import {
  fetchFutubeShouts,
  postFutubeShout,
  cheerFutubeShout,
} from '../../services/supabaseClient';
import { haptics } from '../../utils/haptics';
import { useHaptics } from '../../hooks/useHaptics';

interface VideoCommentsDrawerProps {
  video: VideoItem;
  isOpen: boolean;
  onClose: () => void;
}

function formatShoutTime(iso?: string): string {
  if (!iso) return 'Just now';
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return iso;
  const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export const VideoCommentsDrawer: React.FC<VideoCommentsDrawerProps> = ({
  video,
  isOpen,
  onClose,
}) => {
  const { user, addFanPoints, addNotification, openFanZone } = useFootball();
  const { triggerMessage } = useHaptics();
  const [shoutInput, setShoutInput] = useState('');
  const [sortMode, setSortMode] = useState<'newest' | 'top_cheers'>('newest');
  const [replyTarget, setReplyTarget] = useState<{ parentId: string; authorName: string } | null>(
    null
  );
  const [shouts, setShouts] = useState<FutubeShout[]>([]);

  useEffect(() => {
    if (isOpen && video?.id) {
      fetchFutubeShouts(video.id, sortMode, user.id).then((list) => {
        if (Array.isArray(list)) {
          setShouts(list);
        }
      });
    }
  }, [isOpen, video?.id, sortMode, user.id]);

  if (!isOpen) return null;

  const handleSendShout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shoutInput.trim()) return;

    const parentId = replyTarget ? replyTarget.parentId : null;
    const res = await postFutubeShout(video.id, {
      userId: user.id,
      authorName: user.name,
      authorHandle: user.handle,
      authorAvatar: user.avatar,
      text: shoutInput.trim(),
      parentId,
    });

    const newShout: FutubeShout = res?.shout || {
      id: `sh_${Date.now()}`,
      videoId: video.id,
      userId: user.id,
      authorName: user.name,
      authorHandle: user.handle,
      authorAvatar: user.avatar,
      text: shoutInput.trim(),
      parentId,
      cheers: 0,
      hasCheered: false,
      createdAt: new Date().toISOString(),
      replies: [],
    };

    if (parentId) {
      setShouts((prev) =>
        prev.map((s) =>
          s.id === parentId ? { ...s, replies: [...(s.replies || []), newShout] } : s
        )
      );
    } else {
      setShouts((prev) => [newShout, ...prev]);
    }

    setShoutInput('');
    setReplyTarget(null);
    triggerMessage();
    addFanPoints(5, 'Shared a Shout on Futfield Tube');
    addNotification({
      title: parentId ? 'Reply Sent!' : 'Shout Published!',
      body: 'Your reaction is live in Shouts.',
      type: 'comment',
    });
  };

  const handleCheerShout = async (shoutId: string) => {
    haptics.like();
    setShouts((prev) =>
      prev.map((s) => {
        if (s.id === shoutId) {
          const next = !s.hasCheered;
          return {
            ...s,
            hasCheered: next,
            cheers: next ? s.cheers + 1 : Math.max(0, s.cheers - 1),
          };
        }
        return s;
      })
    );
    await cheerFutubeShout(shoutId, user.id);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-[#161b22] border border-slate-200 dark:border-white/10 rounded-t-3xl sm:rounded-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50 dark:bg-[#0d1117] shrink-0">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-[#00C853]" />
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
              Shouts ({shouts.length})
            </h3>
            <div className="flex items-center gap-1 ml-2">
              {(['newest', 'top_cheers'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSortMode(m)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    sortMode === m
                      ? 'bg-[#00C853] text-black'
                      : 'bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-white/70'
                  }`}
                >
                  {m === 'newest' ? 'Newest' : 'Top Cheers'}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-white/70 hover:text-black dark:hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shouts List */}
        <div className="p-4 overflow-y-auto space-y-3.5 flex-1 no-scrollbar min-h-[220px]">
          {shouts.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="text-2xl">💬</div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">No Shouts yet</h4>
              <p className="text-xs text-slate-500 dark:text-white/40 max-w-xs mx-auto">
                Be the first supporter to drop a Shout on this clip!
              </p>
            </div>
          ) : (
            shouts.map((s) => (
              <div key={s.id} className="space-y-1.5">
                <div className="flex items-start gap-3 text-xs">
                  <img
                    src={s.authorAvatar || user.avatar}
                    alt={s.authorName || 'Supporter'}
                    onClick={() => {
                      onClose();
                      openFanZone(s.authorHandle || s.authorName || 'Supporter');
                    }}
                    className="w-8 h-8 rounded-full object-cover ring-1 ring-white/10 shrink-0 mt-0.5 cursor-pointer hover:opacity-80 transition-opacity"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        onClick={() => {
                          onClose();
                          openFanZone(s.authorHandle || s.authorName || 'Supporter');
                        }}
                        className="font-bold text-slate-900 dark:text-white truncate cursor-pointer hover:text-[#00C853]"
                      >
                        {s.authorName || 'Supporter'}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-white/40 font-mono">
                        {formatShoutTime(s.createdAt)}
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-white/80 mt-1 leading-relaxed break-words">
                      {s.text}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCheerShout(s.id)}
                    className={`flex flex-col items-center gap-0.5 pt-1 transition-colors ${
                      s.hasCheered
                        ? 'text-[#00C853]'
                        : 'text-slate-400 dark:text-white/40 hover:text-[#00C853]'
                    }`}
                    title="Cheer Shout"
                  >
                    <Flame className={`w-3.5 h-3.5 ${s.hasCheered ? 'fill-current' : ''}`} />
                    <span className="text-[10px] font-mono">{s.cheers || 0}</span>
                  </button>
                </div>

                {/* Reply button */}
                <div className="pl-11 flex items-center gap-3 text-[10px] text-slate-400 dark:text-white/40">
                  <button
                    type="button"
                    onClick={() =>
                      setReplyTarget({ parentId: s.id, authorName: s.authorName || 'Supporter' })
                    }
                    className="hover:text-[#00C853] font-semibold"
                  >
                    Reply
                  </button>
                </div>

                {/* Nested Replies */}
                {s.replies && s.replies.length > 0 && (
                  <div className="pl-10 space-y-1.5 border-l-2 border-[#00C853]/30 ml-4">
                    {s.replies.map((r) => (
                      <div key={r.id} className="flex items-start gap-2 text-xs">
                        <CornerDownRight className="w-3.5 h-3.5 text-[#00C853] shrink-0 mt-1" />
                        <div className="flex-1 bg-slate-100 dark:bg-white/5 p-2 rounded-xl">
                          <span className="font-bold text-[10px] text-slate-900 dark:text-white block">
                            {r.authorName || 'Supporter'}
                          </span>
                          <p className="text-slate-700 dark:text-white/80 text-[11px] mt-0.5">
                            {r.text}
                          </p>
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
          onSubmit={handleSendShout}
          className="p-3 bg-slate-50 dark:bg-[#0d1117] border-t border-slate-200 dark:border-white/10 flex items-center gap-2 shrink-0"
        >
          <img
            src={user.avatar}
            alt={user.name}
            className="w-8 h-8 rounded-full object-cover ring-1 ring-[#00C853]/40 shrink-0"
          />
          <div className="flex-1 flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5">
            <input
              type="text"
              placeholder={
                replyTarget ? `Replying to @${replyTarget.authorName}...` : 'Add a football Shout...'
              }
              value={shoutInput}
              onChange={(e) => setShoutInput(e.target.value)}
              className="flex-1 bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus:outline-none"
            />
            {replyTarget && (
              <button
                type="button"
                onClick={() => setReplyTarget(null)}
                className="text-[10px] text-slate-400 dark:text-white/40 hover:text-white"
              >
                Cancel
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={!shoutInput.trim()}
            className="p-2 rounded-xl bg-[#00C853] text-black font-bold disabled:opacity-40 hover:bg-[#00b248] transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
