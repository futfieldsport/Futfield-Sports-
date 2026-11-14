import React, { useState } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  X,
  Volume2,
  VolumeX,
  Radio,
  MessageSquare,
  Trophy,
  Activity,
  Heart,
} from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { AppNotification } from '../../types/football';
import { useHaptics } from '../../hooks/useHaptics';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose }) => {
  const {
    notifications,
    markNotificationAsRead,
    markAllNotificationsRead,
    unreadNotificationsCount,
    addFanPoints,
    goalSoundEnabled,
    setGoalSoundEnabled,
  } = useFootball();

  const [activeFilter, setActiveFilter] = useState<'all' | 'match' | 'social' | 'system'>('all');
  const { triggerNotificationToggle, triggerLight } = useHaptics();

  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredNotifications = notifications.filter(n => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'match') return n.type === 'goal' || n.type === 'match_start';
    if (activeFilter === 'social') return n.type === 'reply' || n.type === 'follow';
    return n.type === 'trending';
  });

  const toggleSound = () => {
    triggerNotificationToggle();
    setGoalSoundEnabled(!goalSoundEnabled);
  };

  const getNotificationIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'goal':
        return <span className="text-base">⚽</span>;
      case 'match_start':
        return <Activity className="w-4 h-4 text-[#00E676]" />;
      case 'reply':
        return <MessageSquare className="w-4 h-4 text-sky-400" />;
      case 'trending':
        return <Trophy className="w-4 h-4 text-amber-400" />;
      case 'follow':
        return <Heart className="w-4 h-4 text-rose-400" />;
      default:
        return <Bell className="w-4 h-4 text-slate-600 dark:text-white/70" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#161b22] border border-slate-200 dark:border-white/10 rounded-t-3xl sm:rounded-2xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-[#0d1117]">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center text-[#00E676]">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Notifications</span>
                {unreadNotificationsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#00E676] text-black text-[10px] font-black tabular-nums">
                    {unreadNotificationsCount} new
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-white/50">Live match events, goal alerts &amp; banter</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {unreadNotificationsCount > 0 && (
              <button
                onClick={() => {
                  triggerNotificationToggle();
                  markAllNotificationsRead();
                }}
                className="min-h-[44px] px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white/80 hover:text-black dark:hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                title="Mark all notifications as read"
              >
                <CheckCheck className="w-3.5 h-3.5 text-[#00E676]" />
                <span>Mark read</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white/70 hover:text-black dark:hover:text-white flex items-center justify-center transition-colors"
              aria-label="Close notifications"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Preference Bar */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-black/40 border-b border-slate-200 dark:border-white/5 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-700 dark:text-white/70">
            <Radio className="w-3.5 h-3.5 text-[#00E676]" />
            <span>Instant Goal Alerts Audio</span>
          </div>
          <button
            onClick={toggleSound}
            className={`min-h-[36px] px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-all ${
              goalSoundEnabled
                ? 'bg-[#00E676]/20 text-emerald-800 dark:text-[#00E676] border border-[#00E676]/40'
                : 'bg-slate-200/60 dark:bg-white/5 text-slate-600 dark:text-white/50 border border-slate-300 dark:border-white/10'
            }`}
          >
            {goalSoundEnabled ? (
              <>
                <Volume2 className="w-3 h-3" /> Enabled
              </>
            ) : (
              <>
                <VolumeX className="w-3 h-3" /> Muted
              </>
            )}
          </button>
        </div>

        {/* Category Pills */}
        <div className="px-4 py-2 border-b border-slate-200 dark:border-white/5 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
          {(
            [
              { id: 'all', label: 'All Alerts' },
              { id: 'match', label: 'Live Matches' },
              { id: 'social', label: 'Banter & Replies' },
              { id: 'system', label: 'Rewards' },
            ] as const
          ).map(tab => (
              <button
              key={tab.id}
              onClick={() => {
                triggerLight();
                setActiveFilter(tab.id);
              }}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                activeFilter === tab.id
                  ? 'bg-[#00E676] text-black shadow-md shadow-[#00E676]/20'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/5 text-slate-600 dark:text-white/60 hover:text-black dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1 no-scrollbar">
          {filteredNotifications.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 dark:text-white/40 mx-auto">
                <Bell className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">No notifications right now</h4>
                <p className="text-xs text-slate-500 dark:text-white/40 max-w-xs mx-auto leading-relaxed">
                  When your followed teams score, matches kickoff, or fellow fans reply to your posts, you will receive real-time alerts right here.
                </p>
              </div>
            </div>
          ) : (
            filteredNotifications.map(item => (
              <div
                key={item.id}
                onClick={() => markNotificationAsRead(item.id)}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                  item.isRead
                    ? 'bg-slate-50/80 dark:bg-white/[0.02] border-slate-200 dark:border-white/5 text-slate-700 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/5'
                    : 'bg-[#00E676]/10 dark:bg-[#00E676]/5 border-[#00E676]/40 dark:border-[#00E676]/30 text-slate-900 dark:text-white shadow-sm'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  {getNotificationIcon(item.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h5 className="font-bold text-xs text-slate-900 dark:text-white truncate">{item.title}</h5>
                    <span className="text-[10px] text-slate-500 dark:text-white/40 font-mono shrink-0">
                      {item.time}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-white/70 mt-0.5 line-clamp-2 leading-relaxed">
                    {item.body}
                  </p>
                </div>

                {!item.isRead && (
                  <span className="w-2 h-2 rounded-full bg-[#00E676] shrink-0 mt-2 shadow-[0_0_8px_#00E676]" />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
