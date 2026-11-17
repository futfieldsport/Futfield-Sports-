import React from 'react';
import { Home, Calendar, Video, LayoutGrid, User } from 'lucide-react';
import { useFootball, MainTab } from '../../context/FootballContext';
import { FutfieldTubeLogo } from '../Videos/FutfieldTubeLogo';
import { haptics } from '../../utils/haptics';
import { scrollToTopInstant } from '../../utils/scroll';

interface BottomTabBarProps {
  embedded?: boolean;
}

const TubeNavIcon: React.FC<{ className?: string }> = () => (
  <FutfieldTubeLogo size={20} />
);

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ embedded }) => {
  const { activeTab, setActiveTab, matches, navigateToProfile } = useFootball();

  const liveMatchesCount = matches.filter(m => m.status === 'LIVE').length;

  const tabs: { id: MainTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'scores', label: 'Scores', icon: Calendar },
    { id: 'videos', label: 'Tube', icon: TubeNavIcon },
    { id: 'studio', label: 'Studio', icon: Video },
    { id: 'menu', label: 'Menu', icon: LayoutGrid },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <nav
      aria-label="Primary navigation"
      className={`${
        embedded ? 'relative w-full' : 'fixed bottom-0 left-0 right-0 z-40'
      } bg-white/95 dark:bg-[#090D12]/95 backdrop-blur-lg border-t border-slate-200/80 dark:border-white/10 pb-safe`}
    >
      <div className="max-w-2xl mx-auto grid grid-cols-6 items-center h-16 px-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                haptics.light();
                scrollToTopInstant();
                if (tab.id === 'profile') {
                  navigateToProfile();
                } else {
                  setActiveTab(tab.id);
                }
              }}
              className={`relative min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all active:scale-95 whitespace-nowrap ${
                isActive
                  ? 'text-emerald-700 dark:text-[#00E676] font-extrabold'
                  : 'text-slate-500 hover:text-slate-900 dark:text-white/60 dark:hover:text-white font-medium'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <span className="absolute top-0.5 w-6 h-[2.5px] rounded-full bg-emerald-600 dark:bg-[#00E676]" />
              )}
              <div className="relative flex items-center justify-center">
                <Icon
                  className={`w-5 h-5 transition-colors ${
                    isActive ? 'stroke-[2.5]' : 'stroke-[1.9]'
                  }`}
                />
                {tab.id === 'scores' && liveMatchesCount > 0 && (
                  <span
                    className="absolute -top-1 -right-2.5 min-w-[15px] h-[15px] px-1 rounded-full bg-[#00E676] text-black text-[9px] font-black flex items-center justify-center tabular-nums shadow-xs"
                    title={`${liveMatchesCount} live matches`}
                  >
                    {liveMatchesCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight leading-none mt-0.5">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
