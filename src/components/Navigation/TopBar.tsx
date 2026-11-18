import React from 'react';
import {
  Search,
  Bell,
  Moon,
  Sun,
  Plus,
  ArrowLeft,
} from 'lucide-react';
import { useFootball } from '../../context/FootballContext';

import { scrollToTopInstant } from '../../utils/scroll';

interface TopBarProps {
  onOpenCreatePost?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenCreatePost }) => {
  const {
    activeTab,
    setActiveTab,
    canGoBack,
    goBack,
    unreadNotificationsCount,
    setNotificationsModalOpen,
    setSearchModalOpen,
    theme,
    setTheme,
  } = useFootball();

  const handleCreatePostClick = () => {
    if (onOpenCreatePost) {
      onOpenCreatePost();
      return;
    }
    if (activeTab !== 'home') {
      setActiveTab('home');
      scrollToTopInstant();
    }
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('futfield:focus-composer'));
    }, 60);
  };

  return (
    <header className="sticky top-0 z-30 w-full bg-white/95 dark:bg-[#090D12]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-white/10">
      <div className="h-[2px] w-full club-accent-bar opacity-85" />
      <div className="px-3 sm:px-5 h-14 flex items-center justify-between gap-2">
        {/* Left: Back Button (when navigable) + Create Post Button */}
        <div className="flex items-center gap-1.5 shrink-0">
          {canGoBack && (
            <button
              onClick={() => {
                goBack();
                scrollToTopInstant();
              }}
              className="min-h-[44px] px-3 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 flex items-center gap-1 text-slate-900 dark:text-white text-xs font-extrabold transition-all active:scale-95 whitespace-nowrap shrink-0"
              title="Go back to where you last left off"
              aria-label="Go back"
            >
              <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Back</span>
            </button>
          )}
          <button
            onClick={handleCreatePostClick}
            className="min-h-[44px] min-w-[44px] rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 flex items-center justify-center text-slate-900 dark:text-white transition-all active:scale-95"
            title="Create football post"
            aria-label="Create football post"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Center: FUTFIELD Brand Title */}
        <button
          onClick={() => {
            setActiveTab('home');
            scrollToTopInstant();
          }}
          className="min-h-[44px] px-2 cursor-pointer group flex items-center gap-2 select-none whitespace-nowrap shrink-0"
          aria-label="FUTFIELD Home"
        >
          <img
            src="/futfield-logo.jpg"
            alt="FUTFIELD Official Logo"
            referrerPolicy="no-referrer"
            className="w-7 h-7 rounded-lg object-contain ring-1 ring-slate-200 dark:ring-white/10 transition-transform group-hover:scale-105"
          />
          <span className="font-display text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
            FUT<span className="text-emerald-600 dark:text-[#00E676]">FIELD</span>
          </span>
        </button>

        {/* Right: Actions (Light/Dark + Search + Bell) */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-white/75 dark:hover:text-white dark:hover:bg-white/10 transition-colors"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle color theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>

          <button
            onClick={() => setSearchModalOpen(true)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-white/75 dark:hover:text-white dark:hover:bg-white/10 rounded-full transition-colors"
            title="Search football posts, teams, players & videos"
            aria-label="Global search"
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            onClick={() => setNotificationsModalOpen(true)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-900 dark:text-white rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors relative"
            title="Notifications & Match Alerts"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#00E676] ring-2 ring-white dark:ring-[#090D12]" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
