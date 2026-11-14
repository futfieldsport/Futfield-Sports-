import React, { useState, useEffect, useCallback } from 'react';
import { Layers, Video, MessageSquare, Crown, Zap } from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { haptics } from '../../utils/haptics';
import { FREE_TIER_DAILY_LIMITS, getDailyUsageCounts } from '../../utils/dailyLimits';

interface DailyUsageTrackerProps {
  onUpgradeClick?: () => void;
}

export const DailyUsageTracker: React.FC<DailyUsageTrackerProps> = ({ onUpgradeClick }) => {
  const { user, setPricingModalOpen } = useFootball();
  const [usage, setUsage] = useState({ posts: 0, videos: 0, chats: 0 });

  const isProUser = Boolean(user.isPro || (user.membershipTier && user.membershipTier !== 'free'));

  const syncUsage = useCallback(() => {
    const counts = getDailyUsageCounts(user.id);
    setUsage({
      posts: counts.posts,
      videos: counts.videos,
      chats: counts.chats,
    });
  }, [user.id]);

  useEffect(() => {
    syncUsage();
    const handleEvent = () => syncUsage();
    window.addEventListener('futfield:daily-limit-updated', handleEvent);
    window.addEventListener('storage', handleEvent);
    return () => {
      window.removeEventListener('futfield:daily-limit-updated', handleEvent);
      window.removeEventListener('storage', handleEvent);
    };
  }, [syncUsage]);

  const maxPosts = FREE_TIER_DAILY_LIMITS.post;
  const maxVideos = FREE_TIER_DAILY_LIMITS.video;
  const maxChats = FREE_TIER_DAILY_LIMITS.chat;

  const postPercent = isProUser ? 100 : Math.min(100, (usage.posts / maxPosts) * 100);
  const videoPercent = isProUser ? 100 : Math.min(100, (usage.videos / maxVideos) * 100);
  const chatPercent = isProUser ? 100 : Math.min(100, (usage.chats / maxChats) * 100);

  return (
    <div className="rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-[#00E676]">
            <Layers className="w-5 h-5" />
          </span>
          <div>
            <h3 className="font-display text-sm font-black text-slate-900 dark:text-white tracking-tight">
              Daily Usage &amp; Free Tier Allowances
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-white/55">
              {isProUser ? 'Unlimited Pro Pass Active' : 'Live usage today · Resets midnight UTC'}
            </span>
          </div>
        </div>

        {isProUser ? (
          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 shrink-0 whitespace-nowrap">
            <Crown className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            Unlimited Pro
          </span>
        ) : (
          <button
            onClick={() => {
              haptics.light();
              if (onUpgradeClick) {
                onUpgradeClick();
              } else {
                setPricingModalOpen(true);
              }
            }}
            className="min-h-[40px] px-3.5 py-1.5 rounded-full bg-[#00E676] hover:bg-[#00c864] text-black font-extrabold text-xs shadow-sm transition-all active:scale-95 flex items-center gap-1 shrink-0 whitespace-nowrap"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Go Unlimited</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Posts Allowance */}
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/8 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-white">
              <Layers className="w-3.5 h-3.5 text-emerald-700 dark:text-[#00E676]" />
              <span>Posts / Images</span>
            </div>
            <span className="text-xs font-mono tabular-nums font-bold text-slate-700 dark:text-white/80">
              {isProUser ? 'Unlimited' : `${usage.posts} / ${maxPosts}`}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
            <div
              className={`h-full transition-all ${
                usage.posts >= maxPosts && !isProUser ? 'bg-rose-500' : 'bg-[#00E676]'
              }`}
              style={{ width: `${postPercent}%` }}
            />
          </div>
          <span className="text-[11px] text-slate-500 dark:text-white/55 tabular-nums block">
            {isProUser ? 'Unlimited posts unlocked' : `${Math.max(0, maxPosts - usage.posts)} left today on Free`}
          </span>
        </div>

        {/* Reels Allowance */}
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/8 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-white">
              <Video className="w-3.5 h-3.5 text-blue-500" />
              <span>PitchReels</span>
            </div>
            <span className="text-xs font-mono tabular-nums font-bold text-slate-700 dark:text-white/80">
              {isProUser ? 'Unlimited' : `${usage.videos} / ${maxVideos}`}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
            <div
              className={`h-full transition-all ${
                usage.videos >= maxVideos && !isProUser ? 'bg-rose-500' : 'bg-blue-500'
              }`}
              style={{ width: `${videoPercent}%` }}
            />
          </div>
          <span className="text-[11px] text-slate-500 dark:text-white/55 tabular-nums block">
            {isProUser ? 'Unlimited 9:16 PitchReels unlocked' : `${Math.max(0, maxVideos - usage.videos)} left today on Free`}
          </span>
        </div>

        {/* Chat Allowance */}
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/8 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-white">
              <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
              <span>Match Room Chat</span>
            </div>
            <span className="text-xs font-mono tabular-nums font-bold text-slate-700 dark:text-white/80">
              {isProUser ? 'Unlimited' : `${usage.chats} / ${maxChats}`}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
            <div
              className={`h-full transition-all ${
                usage.chats >= maxChats && !isProUser ? 'bg-rose-500' : 'bg-amber-500'
              }`}
              style={{ width: `${chatPercent}%` }}
            />
          </div>
          <span className="text-[11px] text-slate-500 dark:text-white/55 tabular-nums block">
            {isProUser ? 'Unlimited live room banter unlocked' : `${Math.max(0, maxChats - usage.chats)} left today on Free`}
          </span>
        </div>
      </div>
    </div>
  );
};
