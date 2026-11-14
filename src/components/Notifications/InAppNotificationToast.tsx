import React from 'react';
import { useFootball } from '../../context/FootballContext';
import { Bell, Flame, MessageCircle, Trophy, Heart, Zap, X } from 'lucide-react';

export const InAppNotificationToast: React.FC = () => {
  const { activeToastNotification, dismissToastNotification, setNotificationsModalOpen } = useFootball();

  if (!activeToastNotification) return null;

  const getIcon = () => {
    switch (activeToastNotification.type) {
      case 'goal':
      case 'match_start':
        return <Flame className="w-4 h-4 text-orange-500 animate-bounce" />;
      case 'reply':
      case 'comment':
        return <MessageCircle className="w-4 h-4 text-blue-500" />;
      case 'like':
        return <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />;
      case 'system':
      case 'trending':
        return <Zap className="w-4 h-4 text-[#00E676]" />;
      default:
        return <Bell className="w-4 h-4 text-[#00E676]" />;
    }
  };

  return (
    <div className="absolute top-12 left-3 right-3 z-50 animate-in slide-in-from-top-4 fade-in duration-200">
      <div
        onClick={() => {
          dismissToastNotification();
          setNotificationsModalOpen(true);
        }}
        className="cursor-pointer rounded-2xl bg-slate-900/95 dark:bg-[#161f28]/95 backdrop-blur-xl border border-white/15 p-3 shadow-2xl flex items-center justify-between gap-3 text-white ring-1 ring-[#00E676]/30"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
            {getIcon()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xs text-white truncate">
                {activeToastNotification.title}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] animate-pulse shrink-0" />
            </div>
            <p className="text-[11px] text-white/70 truncate leading-snug">
              {activeToastNotification.body}
            </p>
          </div>
        </div>

        <button
          onClick={e => {
            e.stopPropagation();
            dismissToastNotification();
          }}
          className="p-1 rounded-full hover:bg-white/10 text-white/50 hover:text-white shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
