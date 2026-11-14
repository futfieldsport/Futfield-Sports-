import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Heart,
  MessageCircle,
  Share2,
  Gift,
  CheckCircle2,
  Sparkles,
  Trophy,
  Flame,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { VideoItem } from '../../types/football';
import { haptics } from '../../utils/haptics';

interface DailyHighlightReelProps {
  isOpen: boolean;
  onClose: () => void;
  initialIndex?: number;
}

export const DailyHighlightReel: React.FC<DailyHighlightReelProps> = ({
  isOpen,
  onClose,
  initialIndex = 0,
}) => {
  const {
    dailyHighlightClips,
    toggleLikeVideo,
    isCreatorConnected,
    toggleConnectCreator,
    openCreatorProfile,
    sendGiftToCreator,
    openMatchRoom,
    matches,
    dataSavingMode,
  } = useFootball();

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0); // 0 to 100%
  const [isPausedByUser, setIsPausedByUser] = useState(false);
  const [heartBurst, setHeartBurst] = useState(false);
  const [showGiftDrawer, setShowGiftDrawer] = useState(false);
  const [giftSentSuccess, setGiftSentSuccess] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const STORY_DURATION_MS = 6000; // 6s per story clip if video doesn't provide time

  const currentClip: VideoItem | undefined = dailyHighlightClips[currentIndex] || dailyHighlightClips[0];
  const isConnected = currentClip ? isCreatorConnected(currentClip.creator.handle) : false;

  // Reset or change clip (respecting Stadium Low-Data Mode)
  useEffect(() => {
    if (isOpen) {
      setProgress(0);
      setIsPlaying(!dataSavingMode);
    }
  }, [currentIndex, isOpen, dataSavingMode]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // Story progress timer
  useEffect(() => {
    if (!isOpen || !isPlaying || isPausedByUser) return;

    const interval = 50; // update every 50ms
    const step = (interval / STORY_DURATION_MS) * 100;

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          handleNextClip();
          return 0;
        }
        return prev + step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [isOpen, isPlaying, isPausedByUser, currentIndex]);

  const handleNextClip = () => {
    if (currentIndex < dailyHighlightClips.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrevClip = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setProgress(0);
    }
  };

  const handleTapScreen = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    if (clickX < rect.width * 0.35) {
      handlePrevClip();
    } else if (clickX > rect.width * 0.65) {
      handleNextClip();
    } else {
      setIsPlaying(prev => !prev);
    }
  };

  const handleLike = () => {
    if (!currentClip) return;
    haptics.like();
    toggleLikeVideo(currentClip.id);
    setHeartBurst(true);
    setTimeout(() => setHeartBurst(false), 900);
  };

  const handleConnect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentClip) return;
    toggleConnectCreator(currentClip.creator.handle, {
      name: currentClip.creator.name,
      avatar: currentClip.creator.avatar,
    });
  };

  const handleSendGift = async (gift: { id: string; name: string; icon: string; price: number }) => {
    if (!currentClip) return;
    await sendGiftToCreator(currentClip.creator.handle, currentClip.creator.name, gift, undefined, currentClip.id);
    setShowGiftDrawer(false);
    setGiftSentSuccess(`Sent ${gift.name} to ${currentClip.creator.name}!`);
    setTimeout(() => setGiftSentSuccess(null), 2500);
  };

  if (!isOpen || !currentClip) return null;

  const stadiumGifts = [
    { id: 'ball', name: 'Match Ball', icon: '⚽', price: 1.00 },
    { id: 'flare', name: 'Ultra Flare', icon: '🔥', price: 2.00 },
    { id: 'strike', name: 'Thunder Strike', icon: '⚡', price: 3.00 },
    { id: 'trophy', name: 'Golden Trophy', icon: '🏆', price: 5.00 },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center backdrop-blur-md">
      {/* Mobile Frame Container */}
      <div className="relative w-full max-w-[440px] h-full sm:h-[92vh] sm:rounded-3xl overflow-hidden bg-black flex flex-col shadow-2xl border border-white/10 select-none">
        {/* Story Progress Segmented Bars */}
        <div className="absolute top-2 inset-x-2 z-30 flex items-center gap-1.5 px-1">
          {dailyHighlightClips.map((clip, idx) => {
            const isCompleted = idx < currentIndex;
            const isCurrent = idx === currentIndex;
            return (
              <div
                key={clip.id}
                className="flex-1 h-1.5 rounded-full bg-white/25 overflow-hidden backdrop-blur-sm"
              >
                <div
                  className="h-full bg-gradient-to-r from-[#00E676] to-emerald-400 rounded-full transition-all duration-75"
                  style={{
                    width: isCompleted ? '100%' : isCurrent ? `${progress}%` : '0%',
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Top Header Overlay */}
        <div className="absolute top-6 inset-x-0 z-30 px-3 flex items-center justify-between text-white bg-gradient-to-b from-black/80 via-black/40 to-transparent pb-6 pt-1">
          {/* Creator & Story Info */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => {
                onClose();
                openCreatorProfile({
                  handle: currentClip.creator.handle,
                  name: currentClip.creator.name,
                  avatar: currentClip.creator.avatar,
                });
              }}
              className="flex items-center gap-2 group text-left"
            >
              <img
                src={currentClip.creator.avatar}
                alt={currentClip.creator.name}
                className="w-9 h-9 rounded-full object-cover ring-2 ring-[#00E676] shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black truncate text-white group-hover:text-[#00E676] transition-colors">
                    {currentClip.creator.name}
                  </span>
                  {currentClip.creator.isVerified && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#00E676] fill-[#00E676]/20 shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-white/70">
                  <span className="text-amber-400 font-bold flex items-center gap-0.5">
                    <Flame className="w-3 h-3 fill-amber-400" /> #{currentIndex + 1} Trending
                  </span>
                  <span>•</span>
                  <span>Daily Reel</span>
                </div>
              </div>
            </button>

            {/* Clickable Connect Button */}
            <button
              onClick={handleConnect}
              className={`ml-2 px-2.5 py-1 rounded-full text-[10px] font-black transition-all flex items-center gap-1 shrink-0 ${
                isConnected
                  ? 'bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/40'
                  : 'bg-[#00E676] text-black hover:bg-emerald-400'
              }`}
            >
              {isConnected ? '✓ Connected' : '+ Connect'}
            </button>
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-1 text-white">
            <button
              onClick={() => setIsMuted(prev => !prev)}
              className="p-2 rounded-full bg-black/40 backdrop-blur-md text-white/90 hover:text-white"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-[#00E676]" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-black/40 backdrop-blur-md text-white/90 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video / Visual Viewport */}
        <div
          className="relative flex-1 w-full bg-black flex items-center justify-center cursor-pointer"
          onClick={handleTapScreen}
          onMouseDown={() => setIsPausedByUser(true)}
          onMouseUp={() => setIsPausedByUser(false)}
          onTouchStart={() => setIsPausedByUser(true)}
          onTouchEnd={() => setIsPausedByUser(false)}
        >
          {currentClip.videoUrl ? (
            <video
              ref={videoRef}
              src={currentClip.videoUrl}
              poster={currentClip.thumbnailUrl}
              autoPlay
              playsInline
              loop
              muted={isMuted}
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src={currentClip.thumbnailUrl}
              alt={currentClip.title}
              className="w-full h-full object-cover"
            />
          )}

          {/* Pause Indicator overlay */}
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
              <div className="p-4 rounded-full bg-black/60 text-white backdrop-blur-md">
                <Play className="w-8 h-8 fill-white" />
              </div>
            </div>
          )}

          {/* Heart Burst Reaction on Double Tap / Like */}
          {heartBurst && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-ping">
              <Heart className="w-24 h-24 text-rose-500 fill-rose-500 drop-shadow-2xl" />
            </div>
          )}

          {/* Toast on gift sent */}
          {giftSentSuccess && (
            <div className="absolute top-20 inset-x-4 z-40 bg-emerald-500/90 text-black font-extrabold text-xs py-2 px-3 rounded-2xl text-center shadow-lg animate-bounce">
              {giftSentSuccess}
            </div>
          )}

          {/* Navigation Tap Hints (semi-transparent) */}
          <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 hover:opacity-80 transition-opacity pointer-events-none">
            <div className="p-2 rounded-full bg-black/50 text-white">
              <ChevronLeft className="w-5 h-5" />
            </div>
          </div>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 hover:opacity-80 transition-opacity pointer-events-none">
            <div className="p-2 rounded-full bg-black/50 text-white">
              <ChevronRight className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Bottom Details & Engagement Bar */}
        <div className="absolute bottom-0 inset-x-0 z-30 p-4 bg-gradient-to-t from-black via-black/75 to-transparent space-y-3 pointer-events-auto">
          {/* Match Title & Club Tag */}
          <div className="space-y-1 pr-14">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-[#00E676] text-black font-extrabold text-[10px]">
                ⚽ {currentClip.clubTag || 'Matchday Highlight'}
              </span>
              <span className="text-[10px] text-white/70 font-mono">
                {currentClip.views.toLocaleString()} views
              </span>
            </div>
            <h2 className="text-sm font-extrabold text-white leading-tight drop-shadow-md line-clamp-2">
              {currentClip.title}
            </h2>
            <p className="text-xs text-white/80 line-clamp-2 drop-shadow">
              {currentClip.description}
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3">
              {/* Like Button */}
              <button
                onClick={handleLike}
                className="flex items-center gap-1.5 text-white hover:text-rose-400 transition-colors"
              >
                <Heart
                  className={`w-6 h-6 ${
                    currentClip.isLiked ? 'text-rose-500 fill-rose-500' : 'text-white'
                  }`}
                />
                <span className="text-xs font-bold">{currentClip.likes}</span>
              </button>

              {/* Gift / Tip Creator Button */}
              <button
                onClick={() => setShowGiftDrawer(prev => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black text-xs shadow-md hover:scale-105 active:scale-95 transition-all"
              >
                <Gift className="w-3.5 h-3.5" />
                <span>Tip Creator</span>
              </button>
            </div>

            {/* Tap to Explore All User Clips */}
            <button
              onClick={() => {
                onClose();
                openCreatorProfile({
                  handle: currentClip.creator.handle,
                  name: currentClip.creator.name,
                  avatar: currentClip.creator.avatar,
                });
              }}
              className="text-[11px] font-bold text-[#00E676] hover:underline flex items-center gap-1"
            >
              <span>See Creator Clips</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Gift Selector Drawer */}
        {showGiftDrawer && (
          <div className="absolute inset-x-0 bottom-0 z-40 p-4 rounded-t-3xl bg-slate-900/95 border-t border-amber-500/30 backdrop-blur-xl space-y-3 animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                  <Gift className="w-4 h-4 text-amber-400" />
                  Send Virtual Matchday Gift
                </h4>
                <p className="text-[10px] text-white/60">
                  Directly rewards {currentClip.creator.name} via FUTFIELD Monetization
                </p>
              </div>
              <button
                onClick={() => setShowGiftDrawer(false)}
                className="p-1 rounded-full text-white/60 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {stadiumGifts.map(g => (
                <button
                  key={g.id}
                  onClick={() => handleSendGift(g)}
                  className="p-2.5 rounded-2xl bg-white/5 border border-white/10 hover:border-amber-400 hover:bg-amber-400/10 flex flex-col items-center gap-1 transition-all active:scale-95 group"
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform">{g.icon}</span>
                  <span className="text-[10px] font-bold text-white truncate max-w-full">{g.name}</span>
                  <span className="text-[10px] font-black text-[#00E676]">${g.price.toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Compact Story Avatar Bar rendered at the top of Video Hub & Home Feed
export const DailyHighlightStoryBar: React.FC = () => {
  const { dailyHighlightClips, setShowDailyHighlightReel } = useFootball();

  if (dailyHighlightClips.length === 0) return null;

  return (
    <div className="py-2.5 px-3 bg-white dark:bg-[#161b22] border-b border-slate-200/80 dark:border-white/5">
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-1.5">
          <span className="p-1 rounded-lg bg-emerald-500/10 text-[#00E676]">
            <TrendingUp className="w-3.5 h-3.5" />
          </span>
          <span className="text-xs font-black text-slate-900 dark:text-white tracking-tight">
            Daily Highlight Reel
          </span>
          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-500/20 text-amber-500 border border-amber-500/30">
            Top 5 Trending
          </span>
        </div>
        <button
          onClick={() => {
            haptics.light();
            setShowDailyHighlightReel(true);
          }}
          className="text-[11px] font-bold text-[#00E676] hover:underline flex items-center gap-0.5"
        >
          <span>Watch Reel</span>
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
        {dailyHighlightClips.map((clip, idx) => (
          <button
            key={clip.id}
            onClick={() => {
              haptics.light();
              setShowDailyHighlightReel(true);
            }}
            className="flex flex-col items-center gap-1 shrink-0 group focus:outline-none"
          >
            <div className="relative p-0.5 rounded-full bg-gradient-to-tr from-[#00E676] via-sky-400 to-amber-400 group-hover:scale-105 transition-transform shadow-sm">
              <div className="w-14 h-14 rounded-full overflow-hidden p-0.5 bg-white dark:bg-black">
                <img
                  src={clip.thumbnailUrl || clip.creator.avatar}
                  alt={clip.title}
                  className="w-full h-full rounded-full object-cover group-hover:scale-110 transition-transform"
                />
              </div>
              <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full bg-black text-[9px] font-black text-[#00E676] border border-[#00E676]">
                #{idx + 1}
              </span>
            </div>
            <span className="text-[10px] font-bold text-slate-700 dark:text-white/80 max-w-[64px] truncate text-center">
              {clip.creator.name.split(' ')[0]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
