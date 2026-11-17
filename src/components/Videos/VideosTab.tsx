import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  BellOff,
  Check,
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  Crown,
  Download,
  Flag,
  Flame,
  FolderPlus,
  Gauge,
  Maximize2,
  MessageCircle,
  Minimize2,
  Pause,
  PictureInPicture2,
  Play,
  Plus,
  Radio,
  Search,
  Send,
  Share2,
  Subtitles,
  ThumbsDown,
  Trash2,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { useFootball, normalizeVideoItem } from '../../context/FootballContext';
import {
  FutubeCaptionCue,
  FutubeShout,
  MatchdayPack,
  VideoItem,
} from '../../types/football';
import {
  cheerFutubeShout,
  fetchFutubeCaptions,
  fetchFutubeShouts,
  fetchFutubeVideoDetail,
  fetchFutubeVideos,
  fetchLiveMatchChat,
  fetchMatchdayPacks,
  postFutubeShout,
  postLiveMatchChat,
  recordFutubeWatchOnServer,
  reportFutubeVideo,
  saveToMatchdayPack,
  toggleFutubeAlert,
  toggleFutubeBooOnServer,
  toggleFutubeCheerOnServer,
  toggleFutubeConnect,
} from '../../services/supabaseClient';
import { buildShareUrl, downloadVideoFile } from '../../utils/share';
import { haptics } from '../../utils/haptics';
import { FutfieldTubeLogo, playCrowdCheerSound } from './FutfieldTubeLogo';
import { FanZoneProfileView } from './FanZoneProfileView';
import { FanZoneBattlePanel } from './FanZoneBattlePanel';
import { FutfieldTubeUploadModal } from './FutfieldTubeUploadModal';
import { VideoCommentsDrawer } from './VideoCommentsDrawer';

const TUBE_CATEGORIES = [
  'All',
  'Premier League',
  'La Liga',
  'Goals',
  'Skills',
  'Memes',
  'Fan Reactions',
  'Transfer News',
  'Quick Kicks',
];

const QUICK_FOOTBALL_EMOJIS = ['🔥', '⚽', '🏆', '👏', '😂', '❤️', '🥅', '⚡'];

interface FloatingCheerBurst {
  id: string;
  leftPct: number;
  delayMs: number;
  scale: number;
}

function formatCompact(n: number): string {
  const num = Number(n || 0);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(num);
}

function formatRelativeTime(iso?: string): string {
  if (!iso) return 'Just now';
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return iso;
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return `${Math.floor(diffSec / 604800)}w ago`;
}

function formatMediaTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const VideosTab: React.FC = () => {
  const {
    user,
    videos: contextVideos,
    tubeSubView,
    setTubeSubView,
    tubeWatchVideoId,
    setTubeWatchVideoId,
    tubeFanZoneHandle,
    openFanZone,
    openTubeUpload,
    openQuickKicks,
    openShareSheet,
    deleteVideo,
    addFanPoints,
    addNotification,
    registerBackHandler,
    setPricingModalOpen,
  } = useFootball();

  const isProUser = Boolean(
    user.isPro || user.membershipTier === 'pro' || user.membershipTier === 'vip'
  );

  // Feed catalog state (API-backed with infinite scroll + live context merge)
  const [feedVideos, setFeedVideos] = useState<VideoItem[]>(contextVideos);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortMode, setSortMode] = useState<'goals_boost' | 'on_fire' | 'newest'>('goals_boost');
  const [loadingFeed, setLoadingFeed] = useState<boolean>(false);
  const [hasMoreFeed, setHasMoreFeed] = useState<boolean>(false);
  const [feedOffset, setFeedOffset] = useState<number>(0);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  // Floating screen-wide Cheer flame burst particles
  const [cheerBursts, setCheerBursts] = useState<FloatingCheerBurst[]>([]);

  // Active watch detail state
  const [watchDetailVideo, setWatchDetailVideo] = useState<VideoItem | null>(null);
  const [upNextVideos, setUpNextVideos] = useState<VideoItem[]>([]);
  const [autoplayNext, setAutoplayNext] = useState<boolean>(true);
  const [descExpanded, setDescExpanded] = useState<boolean>(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Player controls state (Watch Page) — sound strictly ON by default
  const watchVideoRef = useRef<HTMLVideoElement | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [durationSec, setDurationSec] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5 | 2>(1);
  const [qualityPref, setQualityPref] = useState<'720p' | '1080p'>(
    isProUser ? '1080p' : '720p'
  );
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [seekOverlay, setSeekOverlay] = useState<'back' | 'forward' | null>(null);
  const lastTapRef = useRef<{ time: number; side: 'left' | 'right' }>({ time: 0, side: 'right' });
  const watchTouchStartYRef = useRef<number | null>(null);

  // Auto-captions (English + Pidgin)
  const [captions, setCaptions] = useState<FutubeCaptionCue[]>([]);
  const [captionMode, setCaptionMode] = useState<'off' | 'english' | 'pidgin'>('english');

  // 5-second genuine watch counter tracking
  const accumulatedPlayRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);
  const watchRecordedIdsRef = useRef<Set<string>>(new Set());

  // Shouts (comments) state on Watch Page
  const [shouts, setShouts] = useState<FutubeShout[]>([]);
  const [shoutSort, setShoutSort] = useState<'newest' | 'top_cheers'>('newest');
  const [shoutInput, setShoutInput] = useState<string>('');
  const [replyTarget, setReplyTarget] = useState<{ parentId: string; authorName: string } | null>(
    null
  );
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const shoutInputRef = useRef<HTMLInputElement | null>(null);

  // Matchday Packs & Report inline drawers
  const [showPackPicker, setShowPackPicker] = useState<boolean>(false);
  const [packs, setPacks] = useState<MatchdayPack[]>([]);
  const [newPackName, setNewPackName] = useState<string>('Weekend Bangers');
  const [showReportBox, setShowReportBox] = useState<boolean>(false);

  // Squad-only Match Live Chat state
  const [liveChatMessages, setLiveChatMessages] = useState<
    Array<{ id: string; userName: string; userAvatar: string; text: string; createdAt: string }>
  >([]);
  const [liveChatIsSquad, setLiveChatIsSquad] = useState<boolean>(false);
  const [liveChatInput, setLiveChatInput] = useState<string>('');
  const [showMatchLiveChat, setShowMatchLiveChat] = useState<boolean>(false);

  // Quick Kicks vertical feed state
  const [quickKickIndex, setQuickKickIndex] = useState<number>(0);
  const [quickKickMuted, setQuickKickMuted] = useState<boolean>(false);
  const [quickKickPaused, setQuickKickPaused] = useState<boolean>(false);
  const [quickKickTime, setQuickKickTime] = useState<number>(0);
  const [quickKickDur, setQuickKickDur] = useState<number>(0);
  const [shoutsDrawerVideo, setShoutsDrawerVideo] = useState<VideoItem | null>(null);
  const quickKickVideoRef = useRef<HTMLVideoElement | null>(null);
  const kickTouchStartYRef = useRef<number | null>(null);
  const kickPlaySecondsRef = useRef<number>(0);
  const kickLastTickRef = useRef<number>(0);

  // Hardware/Header Back handler
  useEffect(() => {
    const handler = () => {
      if (shoutsDrawerVideo) {
        setShoutsDrawerVideo(null);
        return true;
      }
      if (tubeSubView !== 'feed') {
        setTubeSubView('feed');
        return true;
      }
      return false;
    };
    registerBackHandler(handler);
    return () => registerBackHandler(null);
  }, [tubeSubView, shoutsDrawerVideo, registerBackHandler, setTubeSubView]);

  // Trigger screen-wide 🔥 Cheer animation burst
  const triggerCheerBurst = useCallback(() => {
    const now = Date.now();
    const particles: FloatingCheerBurst[] = Array.from({ length: 14 }).map((_, idx) => ({
      id: `ch_${now}_${idx}`,
      leftPct: 6 + ((idx * 7 + (now % 9)) % 88),
      delayMs: (idx % 5) * 75,
      scale: 0.85 + (idx % 4) * 0.22,
    }));
    setCheerBursts(particles);
    setTimeout(() => {
      setCheerBursts([]);
    }, 1500);
  }, []);

  // Keep local feed synced with context updates (new uploads, deletes, SSE)
  useEffect(() => {
    if (contextVideos.length > 0 && selectedCategory === 'All' && !searchQuery.trim()) {
      setFeedVideos((prev) => {
        const map = new Map<string, VideoItem>();
        contextVideos.forEach((v) => map.set(v.id, v));
        prev.forEach((v) => {
          if (!map.has(v.id) && contextVideos.some((cv) => cv.id === v.id)) {
            map.set(v.id, v);
          }
        });
        return Array.from(map.values());
      });
    }
  }, [contextVideos, selectedCategory, searchQuery]);

  // Fetch paginated Futfield Tube feed from backend
  const loadFeedPage = useCallback(
    async (reset: boolean) => {
      setLoadingFeed(true);
      const nextOffset = reset ? 0 : feedOffset;
      const res = await fetchFutubeVideos({
        category: selectedCategory,
        search: searchQuery.trim() || undefined,
        sort: sortMode,
        offset: nextOffset,
        limit: 12,
        userId: user.id,
      });
      setLoadingFeed(false);

      const normalized = res.videos.map((v) => normalizeVideoItem(v));
      if (reset) {
        if (normalized.length > 0 || searchQuery.trim() || selectedCategory !== 'All') {
          setFeedVideos(normalized);
        } else {
          setFeedVideos(contextVideos);
        }
        setFeedOffset(normalized.length);
      } else {
        setFeedVideos((prev) => {
          const existing = new Set(prev.map((x) => x.id));
          return [...prev, ...normalized.filter((x) => !existing.has(x.id))];
        });
        setFeedOffset(nextOffset + normalized.length);
      }
      setHasMoreFeed(res.hasMore);
    },
    [selectedCategory, searchQuery, sortMode, feedOffset, user.id, contextVideos]
  );

  useEffect(() => {
    if (tubeSubView !== 'feed') return;
    const t = setTimeout(() => {
      loadFeedPage(true);
    }, 160);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, searchQuery, sortMode, tubeSubView]);

  // Infinite Scroll observer
  useEffect(() => {
    if (tubeSubView !== 'feed' || !hasMoreFeed || loadingFeed) return;
    const target = loadMoreSentinelRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMoreFeed && !loadingFeed) {
          loadFeedPage(false);
        }
      },
      { rootMargin: '160px' }
    );
    obs.observe(target);
    return () => obs.disconnect();
  }, [tubeSubView, hasMoreFeed, loadingFeed, loadFeedPage]);

  // Merged list of available videos for lookup
  const allKnownVideos = useMemo(() => {
    const map = new Map<string, VideoItem>();
    contextVideos.forEach((v) => map.set(v.id, v));
    feedVideos.forEach((v) => map.set(v.id, v));
    if (watchDetailVideo) map.set(watchDetailVideo.id, watchDetailVideo);
    return Array.from(map.values());
  }, [contextVideos, feedVideos, watchDetailVideo]);

  // Currently watched video on /tube/watch/:id
  const activeWatchVideo = useMemo(() => {
    const byId = allKnownVideos.find((v) => v.id === tubeWatchVideoId);
    return byId || watchDetailVideo || allKnownVideos.find((v) => !v.isQuickKick) || allKnownVideos[0] || null;
  }, [allKnownVideos, tubeWatchVideoId, watchDetailVideo]);

  // Quick Kicks list (vertical 9:16 max 60s)
  const quickKicksList = useMemo(() => {
    const kicks = allKnownVideos.filter(
      (v) => v.isQuickKick || v.aspectRatio === '9:16' || v.videoKind === 'short'
    );
    return kicks.length > 0 ? kicks : allKnownVideos;
  }, [allKnownVideos]);

  // Sync active Quick Kick index when entering Quick Kicks view with a target ID
  useEffect(() => {
    if (tubeSubView !== 'kicks' || !tubeWatchVideoId) return;
    const idx = quickKicksList.findIndex((k) => k.id === tubeWatchVideoId);
    if (idx >= 0) setQuickKickIndex(idx);
  }, [tubeSubView, tubeWatchVideoId, quickKicksList]);

  const activeQuickKick = quickKicksList[quickKickIndex] || quickKicksList[0] || null;

  // Load Watch detail, Up Next, Shouts, Captions & Squad Live Chat when watching a clip
  useEffect(() => {
    if (tubeSubView !== 'watch' || !activeWatchVideo?.id) return;
    const targetId = activeWatchVideo.id;
    accumulatedPlayRef.current = 0;
    lastTickRef.current = 0;
    setCurrentTime(0);
    setDescExpanded(false);
    setShowPackPicker(false);
    setShowReportBox(false);
    setConfirmDeleteId(null);

    fetchFutubeVideoDetail(targetId, user.id).then((res) => {
      if (res.video) {
        setWatchDetailVideo(normalizeVideoItem(res.video));
      }
      if (Array.isArray(res.upNext) && res.upNext.length > 0) {
        setUpNextVideos(res.upNext.map((u) => normalizeVideoItem(u)));
      } else {
        setUpNextVideos(allKnownVideos.filter((v) => v.id !== targetId).slice(0, 8));
      }
    });

    fetchFutubeCaptions(targetId).then((cues) => {
      setCaptions(Array.isArray(cues) ? cues : []);
    });

    fetchLiveMatchChat(targetId, user.id).then((chat) => {
      setLiveChatIsSquad(Boolean(chat.isSquadMember));
      setLiveChatMessages(Array.isArray(chat.messages) ? chat.messages : []);
    });
  }, [tubeSubView, activeWatchVideo?.id, user.id]);

  // Load Shouts separately whenever video ID or sort changes
  useEffect(() => {
    if (tubeSubView !== 'watch' || !activeWatchVideo?.id) return;
    fetchFutubeShouts(activeWatchVideo.id, shoutSort, user.id).then((list) => {
      setShouts(Array.isArray(list) ? list : []);
    });
  }, [tubeSubView, activeWatchVideo?.id, shoutSort, user.id]);

  // Ensure Watch HTML5 <video> keeps sound ON and applies playback speed
  useEffect(() => {
    const el = watchVideoRef.current;
    if (!el || tubeSubView !== 'watch') return;
    el.muted = isMuted;
    el.volume = volume;
    el.playbackRate = playbackSpeed;
  }, [isMuted, volume, playbackSpeed, tubeSubView, activeWatchVideo?.id]);

  // Auto-play with sound ON when switching Watch clip
  useEffect(() => {
    const el = watchVideoRef.current;
    if (!el || tubeSubView !== 'watch' || !activeWatchVideo?.videoUrl) return;
    el.muted = isMuted;
    el.volume = isMuted ? 0 : volume;
    el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tubeSubView, activeWatchVideo?.id]);

  // Ensure Quick Kicks <video> starts with sound ON
  useEffect(() => {
    const el = quickKickVideoRef.current;
    if (!el || tubeSubView !== 'kicks' || !activeQuickKick?.videoUrl) return;
    kickPlaySecondsRef.current = 0;
    kickLastTickRef.current = 0;
    setQuickKickPaused(false);
    el.muted = quickKickMuted;
    el.volume = 1;
    el.play().catch(() => setQuickKickPaused(true));
  }, [tubeSubView, activeQuickKick?.id, quickKickMuted]);

  // Track Fullscreen changes
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Helper: update a video across local states
  const patchVideoEverywhere = useCallback((videoId: string, patch: Partial<VideoItem>) => {
    setFeedVideos((prev) => prev.map((v) => (v.id === videoId ? { ...v, ...patch } : v)));
    setUpNextVideos((prev) => prev.map((v) => (v.id === videoId ? { ...v, ...patch } : v)));
    setWatchDetailVideo((prev) => (prev && prev.id === videoId ? { ...prev, ...patch } : prev));
  }, []);

  // Open Watch view
  const handleOpenWatch = (clip: VideoItem) => {
    haptics.light();
    if (clip.isQuickKick || clip.aspectRatio === '9:16') {
      const idx = quickKicksList.findIndex((k) => k.id === clip.id);
      if (idx >= 0) setQuickKickIndex(idx);
      setTubeWatchVideoId(clip.id);
      setTubeSubView('kicks');
      return;
    }
    setTubeWatchVideoId(clip.id);
    setTubeSubView('watch');
  };

  // 5-second genuine watch counter handler (Watch Player & Quick Kicks)
  const handlePlaybackTimeTick = async (
    videoId: string,
    playedSecondsRef: React.MutableRefObject<number>,
    lastTickTsRef: React.MutableRefObject<number>,
    isVideoPaused: boolean
  ) => {
    if (isVideoPaused || !videoId) {
      lastTickTsRef.current = 0;
      return;
    }
    const now = Date.now();
    if (lastTickTsRef.current > 0) {
      const delta = (now - lastTickTsRef.current) / 1000;
      if (delta > 0 && delta < 2.5) {
        playedSecondsRef.current += delta;
      }
    }
    lastTickTsRef.current = now;

    // Strictly count a Watch ONLY once watchedSeconds reaches >= 5 seconds
    if (playedSecondsRef.current >= 5 && !watchRecordedIdsRef.current.has(videoId)) {
      watchRecordedIdsRef.current.add(videoId);
      const res = await recordFutubeWatchOnServer(
        videoId,
        user.id,
        Math.round(playedSecondsRef.current)
      );
      if (res.watches > 0) {
        patchVideoEverywhere(videoId, { watches: res.watches, views: res.watches });
      }
    }
  };

  // Cheer 🔥 action
  const handleCheer = async (clip: VideoItem) => {
    haptics.like();
    if (!clip.hasCheered) {
      triggerCheerBurst();
    }
    const optimisticCheered = !clip.hasCheered;
    const optimisticCount = Math.max(
      0,
      Number(clip.cheers ?? clip.likes ?? 0) + (optimisticCheered ? 1 : -1)
    );
    patchVideoEverywhere(clip.id, {
      hasCheered: optimisticCheered,
      isLiked: optimisticCheered,
      cheers: optimisticCount,
      likes: optimisticCount,
    });

    const res = await toggleFutubeCheerOnServer(clip.id, user.id);
    if (res.success) {
      patchVideoEverywhere(clip.id, {
        hasCheered: res.hasCheered,
        isLiked: res.hasCheered,
        cheers: res.cheers,
        likes: res.cheers,
        boos: res.boos,
      });
      if (res.hasCheered) {
        addFanPoints(5, 'Cheered clip on Futfield Tube');
      }
    }
  };

  // Boo 👎 action
  const handleBoo = async (clip: VideoItem) => {
    haptics.light();
    const res = await toggleFutubeBooOnServer(clip.id, user.id);
    if (res.success) {
      patchVideoEverywhere(clip.id, {
        hasBooed: res.hasBooed,
        boos: res.boos,
        cheers: res.cheers,
        likes: res.cheers,
        hasCheered: res.hasBooed ? false : clip.hasCheered,
      });
    }
  };

  // Connect ⚡ / Connected ✓
  const handleToggleConnect = async (clip: VideoItem) => {
    haptics.like();
    const handle = clip.fanzoneHandle || clip.creator?.handle || clip.userId || '@fanzone';
    const res = await toggleFutubeConnect(user.id, handle);
    if (res.success) {
      setLiveChatIsSquad(res.isConnected);
      patchVideoEverywhere(clip.id, {
        squadCount: res.squadCount,
        alertEnabled: res.alertEnabled,
        creator: {
          ...clip.creator,
          isSubscribed: res.isConnected,
          subscribers: `${res.squadCount} Squad`,
        },
      });
      addNotification({
        title: res.isConnected
          ? `Connected to ${clip.fanzoneName || clip.creator.name} ⚡`
          : 'Disconnected from FanZone',
        body: res.isConnected
          ? 'Joined Squad & unlocked Match Live Squad Chat!'
          : 'Updated your FanZone connections.',
        type: 'follow',
      });
    }
  };

  // Alert 🔔 toggle
  const handleToggleAlert = async (clip: VideoItem) => {
    haptics.light();
    const handle = clip.fanzoneHandle || clip.creator?.handle || clip.userId || '@fanzone';
    const res = await toggleFutubeAlert(user.id, handle);
    if (res.success) {
      patchVideoEverywhere(clip.id, {
        alertEnabled: res.alertEnabled,
        creator: {
          ...clip.creator,
          isSubscribed: res.isConnected,
        },
      });
      addNotification({
        title: res.alertEnabled ? 'Alert Turned On 🔔' : 'Alert Paused',
        body: res.alertEnabled
          ? `You will receive matchday upload alerts from ${clip.fanzoneName || clip.creator.name}.`
          : 'Upload alerts muted for this FanZone.',
        type: 'system',
      });
    }
  };

  // Download video file (real binary download)
  const handleDownloadClip = async (clip: VideoItem) => {
    if (!clip.videoUrl || downloadingId) return;
    setDownloadingId(clip.id);
    haptics.light();
    const res = await downloadVideoFile({
      id: clip.id,
      title: clip.title,
      videoUrl: clip.videoUrl,
    });
    setDownloadingId(null);
    if (res.success) {
      haptics.success();
      addNotification({
        title: 'Clip Downloaded!',
        body: `${res.filename || clip.title} saved to your device.`,
        type: 'video',
      });
    } else {
      addNotification({
        title: 'Download Failed',
        body: res.error || 'Could not download clip.',
        type: 'system',
      });
    }
  };

  // Delete video (inline Confirm/Cancel — no window.confirm)
  const handleConfirmDelete = async (clipId: string) => {
    setConfirmDeleteId(null);
    await deleteVideo(clipId);
    setFeedVideos((prev) => prev.filter((v) => v.id !== clipId));
    setUpNextVideos((prev) => prev.filter((v) => v.id !== clipId));
    if (tubeSubView === 'watch') {
      setTubeSubView('feed');
    } else if (tubeSubView === 'kicks') {
      setQuickKickIndex((i) => Math.max(0, i - 1));
    }
  };

  // Save to Matchday Pack
  const handleOpenPackPicker = async () => {
    setShowPackPicker((v) => !v);
    const list = await fetchMatchdayPacks(user.id);
    setPacks(Array.isArray(list) ? list : []);
  };

  const handleSaveToPack = async (packName: string) => {
    if (!activeWatchVideo || !packName.trim()) return;
    haptics.success();
    const res = await saveToMatchdayPack(user.id, activeWatchVideo.id, packName.trim());
    if (res.success && res.pack) {
      setPacks((prev) => {
        const exists = prev.some((p) => p.id === res.pack.id);
        return exists
          ? prev.map((p) => (p.id === res.pack.id ? res.pack : p))
          : [res.pack, ...prev];
      });
      setShowPackPicker(false);
      addNotification({
        title: 'Saved to Matchday Pack',
        body: `Added to "${packName.trim()}".`,
        type: 'system',
      });
    }
  };

  // Send Shout (comment)
  const handleSendShout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWatchVideo || !shoutInput.trim()) return;
    haptics.success();
    const res = await postFutubeShout(activeWatchVideo.id, {
      userId: user.id,
      authorName: user.name,
      authorHandle: user.handle,
      authorAvatar: user.avatar,
      text: shoutInput.trim(),
      parentId: replyTarget?.parentId || null,
    });
    if (res.success && res.shout) {
      if (replyTarget?.parentId) {
        setShouts((prev) =>
          prev.map((s) =>
            s.id === replyTarget.parentId
              ? { ...s, replies: [...(s.replies || []), res.shout] }
              : s
          )
        );
      } else {
        setShouts((prev) => [res.shout, ...prev]);
      }
      if (typeof res.shoutsCount === 'number') {
        patchVideoEverywhere(activeWatchVideo.id, {
          shoutsCount: res.shoutsCount,
          commentsCount: res.shoutsCount,
        });
      }
      setShoutInput('');
      setReplyTarget(null);
      addFanPoints(5, 'Posted a Shout on Futfield Tube');
    }
  };

  const handleCheerShout = async (shoutId: string) => {
    haptics.like();
    const res = await cheerFutubeShout(shoutId, user.id);
    if (res.success) {
      setShouts((prev) =>
        prev.map((s) =>
          s.id === shoutId ? { ...s, hasCheered: res.hasCheered, cheers: res.cheers } : s
        )
      );
    }
  };

  const handleSendLiveSquadChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWatchVideo || !liveChatInput.trim()) return;
    const res = await postLiveMatchChat(activeWatchVideo.id, {
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar,
      text: liveChatInput.trim(),
    });
    if (res.success && res.message) {
      setLiveChatMessages((prev) => [...prev, res.message]);
      setLiveChatInput('');
    } else if (res.squadRequired) {
      addNotification({
        title: 'Squad Required ⚡',
        body: 'Click Connect ⚡ to join the FanZone Squad and chat during Match Live!',
        type: 'system',
      });
    }
  };

  // Player helpers (Watch)
  const toggleWatchPlayPause = () => {
    const el = watchVideoRef.current;
    if (!el) return;
    if (el.paused) {
      el.muted = isMuted;
      el.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  const handleWatchSurfaceTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const side: 'left' | 'right' = e.clientX - rect.left < rect.width / 2 ? 'left' : 'right';
    const now = Date.now();
    if (now - lastTapRef.current.time < 280 && lastTapRef.current.side === side) {
      const el = watchVideoRef.current;
      if (el) {
        el.currentTime =
          side === 'right'
            ? Math.min(el.duration || el.currentTime + 10, el.currentTime + 10)
            : Math.max(0, el.currentTime - 10);
        setSeekOverlay(side === 'right' ? 'forward' : 'back');
        setTimeout(() => setSeekOverlay(null), 650);
      }
      lastTapRef.current = { time: 0, side };
    } else {
      lastTapRef.current = { time: now, side };
      toggleWatchPlayPause();
    }
  };

  const handleTogglePiP = async () => {
    const el = watchVideoRef.current as any;
    if (!el || typeof el.requestPictureInPicture !== 'function') return;
    try {
      if (document.pictureInPictureElement) {
        await (document as any).exitPictureInPicture();
      } else {
        await el.requestPictureInPicture();
      }
    } catch {}
  };

  const handleToggleFullscreen = async () => {
    const target = playerContainerRef.current as any;
    if (!target) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (typeof target.requestFullscreen === 'function') {
        await target.requestFullscreen();
      }
    } catch {}
  };

  // Current live subtitle cue (EN or Pidgin)
  const activeCaptionCue = useMemo(() => {
    if (captionMode === 'off' || captions.length === 0) return null;
    const t = tubeSubView === 'kicks' ? quickKickTime : currentTime;
    return captions.find((c) => t >= c.startSec && t <= c.endSec) || captions[0];
  }, [captionMode, captions, tubeSubView, quickKickTime, currentTime]);

  // ==============================================================
  // FLOATING SCREEN-WIDE CHEER 🔥 BURST OVERLAY
  // ==============================================================
  const renderCheerBurstOverlay = () => {
    if (cheerBursts.length === 0) return null;
    return (
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {cheerBursts.map((b) => (
          <span
            key={b.id}
            className="absolute bottom-14 text-3xl animate-cheer-rise"
            style={{
              left: `${b.leftPct}%`,
              animationDelay: `${b.delayMs}ms`,
              transform: `scale(${b.scale})`,
            }}
          >
            🔥
          </span>
        ))}
      </div>
    );
  };

  // ==============================================================
  // SUB-VIEW 1: /tube/upload
  // ==============================================================
  if (tubeSubView === 'upload') {
    return (
      <>
        {renderCheerBurstOverlay()}
        <FutfieldTubeUploadModal
          onClose={() => setTubeSubView('feed')}
          onPublished={(vid) => {
            setFeedVideos((prev) => [vid, ...prev.filter((x) => x.id !== vid.id)]);
            setTubeWatchVideoId(vid.id);
            setTubeSubView(vid.isQuickKick ? 'kicks' : 'watch');
          }}
        />
      </>
    );
  }

  // ==============================================================
  // SUB-VIEW 2: /fanzone/:username
  // ==============================================================
  if (tubeSubView === 'fanzone') {
    return (
      <>
        {renderCheerBurstOverlay()}
        <FanZoneProfileView
          usernameOrHandle={tubeFanZoneHandle || user.handle}
          onBack={() => setTubeSubView('feed')}
          onOpenWatch={(clip) => {
            setTubeWatchVideoId(clip.id);
            setTubeSubView('watch');
          }}
          onOpenQuickKick={(kick) => {
            const idx = quickKicksList.findIndex((k) => k.id === kick.id);
            if (idx >= 0) setQuickKickIndex(idx);
            setTubeWatchVideoId(kick.id);
            setTubeSubView('kicks');
          }}
        />
      </>
    );
  }

  // ==============================================================
  // SUB-VIEW 3: /tube/kicks — QUICK KICKS (9:16 MAX 60s VERTICAL)
  // ==============================================================
  if (tubeSubView === 'kicks') {
    const kick = activeQuickKick;
    if (!kick) {
      return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 space-y-4">
          <FutfieldTubeLogo size={44} />
          <h2 className="font-display font-black text-lg text-slate-900 dark:text-white">
            No Quick Kicks uploaded yet
          </h2>
          <p className="text-xs text-slate-500 dark:text-white/60 text-center max-w-xs">
            Upload a vertical 9:16 clip (max 60 seconds) to kick off the Quick Kicks feed!
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openTubeUpload}
              className="px-5 py-2.5 rounded-full bg-[#00C853] text-black font-black text-xs"
            >
              + Upload Clip
            </button>
            <button
              type="button"
              onClick={() => setTubeSubView('feed')}
              className="px-4 py-2.5 rounded-full bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white font-bold text-xs"
            >
              Back to Feed
            </button>
          </div>
        </div>
      );
    }

    const fanzoneName = kick.fanzoneName || kick.creator?.name || 'FanZone';
    const fanzoneHandle = kick.fanzoneHandle || kick.creator?.handle || '@fanzone';
    const fanzoneAvatar =
      kick.fanzoneAvatar || kick.creator?.avatar || '/assets/aistudio/IMG-20261106-WA6972_a4f2c4ba.jpg';
    const isConnected = Boolean(kick.creator?.isSubscribed);

    const goNextKick = () => {
      if (quickKickIndex < quickKicksList.length - 1) {
        haptics.light();
        setQuickKickIndex((i) => i + 1);
      }
    };
    const goPrevKick = () => {
      if (quickKickIndex > 0) {
        haptics.light();
        setQuickKickIndex((i) => i - 1);
      }
    };

    return (
      <div
        className="fixed inset-0 z-40 bg-black flex items-center justify-center overflow-hidden select-none"
        onTouchStart={(e) => {
          kickTouchStartYRef.current = e.touches[0]?.clientY ?? null;
        }}
        onTouchEnd={(e) => {
          const startY = kickTouchStartYRef.current;
          kickTouchStartYRef.current = null;
          if (startY === null) return;
          const endY = e.changedTouches[0]?.clientY ?? startY;
          const diff = startY - endY;
          if (diff > 45) goNextKick();
          else if (diff < -45) goPrevKick();
        }}
      >
        {renderCheerBurstOverlay()}

        {/* Vertical 9:16 Stage */}
        <div className="relative w-full h-full max-w-[480px] mx-auto bg-black flex items-center justify-center">
          <video
            ref={quickKickVideoRef}
            key={kick.id}
            src={kick.videoUrl}
            poster={kick.thumbnailUrl || undefined}
            autoPlay
            loop
            playsInline
            muted={quickKickMuted}
            onClick={() => {
              const el = quickKickVideoRef.current;
              if (!el) return;
              if (el.paused) {
                el.muted = quickKickMuted;
                el.play().catch(() => {});
                setQuickKickPaused(false);
              } else {
                el.pause();
                setQuickKickPaused(true);
              }
            }}
            onLoadedMetadata={(e) => setQuickKickDur(e.currentTarget.duration || 0)}
            onTimeUpdate={(e) => {
              const el = e.currentTarget;
              setQuickKickTime(el.currentTime);
              handlePlaybackTimeTick(kick.id, kickPlaySecondsRef, kickLastTickRef, el.paused);
            }}
            className="w-full h-full object-contain bg-black"
          />

          {/* Subtle Left Exit Pill (Zero action clutter on top!) */}
          <button
            type="button"
            onClick={() => setTubeSubView('feed')}
            className="absolute top-4 left-3 z-20 px-3 py-1.5 rounded-full bg-black/55 backdrop-blur-md text-white text-xs font-extrabold flex items-center gap-1.5 border border-white/15"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quick Kicks</span>
          </button>

          {/* Paused Center Indicator */}
          {quickKickPaused && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-[#00C853] border border-white/20">
                <Play className="w-8 h-8 fill-current ml-1" />
              </div>
            </div>
          )}

          {/* Free Watermark if non-Pro clip */}
          {kick.hasWatermark && (
            <div className="pointer-events-none absolute bottom-32 left-4 px-2.5 py-0.5 rounded-md bg-black/50 text-white/75 text-[10px] font-black tracking-widest border border-white/15">
              FUTFIELD
            </div>
          )}

          {/* Live CC Subtitle Strip (English / Pidgin) */}
          {captionMode !== 'off' && (
            <div className="pointer-events-none absolute bottom-28 left-4 right-20">
              <div className="inline-block px-3 py-1 rounded-xl bg-black/75 text-white text-xs font-bold leading-snug">
                {captionMode === 'pidgin'
                  ? '⚽ Chale see better football skill! Make everybody cheer 🔥'
                  : `⚽ ${kick.title} — Pure matchday highlight!`}
              </div>
            </div>
          )}

          {/* Bottom Info: Title + #tags + Watches */}
          <div className="absolute bottom-6 left-3 right-20 z-20 space-y-2 text-white">
            <div
              onClick={() => openFanZone(fanzoneHandle)}
              className="inline-flex items-center gap-2 cursor-pointer"
            >
              <span className="font-display font-black text-sm drop-shadow">{fanzoneName}</span>
              <span className="text-[11px] font-mono text-[#00C853] font-bold">
                {formatCompact(kick.watches ?? kick.views ?? 0)} Watches
              </span>
            </div>
            <p className="text-xs sm:text-sm font-bold leading-snug drop-shadow line-clamp-2">
              {kick.title}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(kick.hashtags || ['#QuickKicks', '#FutfieldTube']).slice(0, 4).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    setSearchQuery(tag.replace(/^#/, ''));
                    setTubeSubView('feed');
                  }}
                  className="text-[11px] font-bold text-[#00C853] hover:underline"
                >
                  {tag.startsWith('#') ? tag : `#${tag}`}
                </button>
              ))}
            </div>

            {/* Clean Green Timeline Scrubber */}
            <input
              type="range"
              min={0}
              max={quickKickDur || 1}
              step={0.1}
              value={quickKickTime}
              onChange={(e) => {
                const t = Number(e.target.value);
                if (quickKickVideoRef.current) quickKickVideoRef.current.currentTime = t;
                setQuickKickTime(t);
              }}
              className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-[#00C853]"
            />
          </div>

          {/* STRICT RIGHT-SIDE ACTION RAIL (Never on Top!) */}
          <div className="absolute right-2.5 bottom-12 z-20 flex flex-col items-center gap-3.5 text-white">
            {/* Swipe Up/Down Chevrons */}
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={goPrevKick}
                disabled={quickKickIndex <= 0}
                className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center disabled:opacity-30 border border-white/15"
                title="Previous Quick Kick"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={goNextKick}
                disabled={quickKickIndex >= quickKicksList.length - 1}
                className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center disabled:opacity-30 border border-white/15"
                title="Next Quick Kick"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* FanZone Avatar + Connect ⚡ badge */}
            <div className="relative flex flex-col items-center">
              <img
                src={fanzoneAvatar}
                alt={fanzoneName}
                onClick={() => openFanZone(fanzoneHandle)}
                className="w-11 h-11 rounded-full object-cover border-2 border-[#00C853] cursor-pointer shadow-lg"
              />
              <button
                type="button"
                onClick={() => handleToggleConnect(kick)}
                className={`-mt-2.5 px-2 py-0.5 rounded-full text-[10px] font-black shadow ${
                  isConnected ? 'bg-white text-black' : 'bg-[#00C853] text-black'
                }`}
                title={isConnected ? 'Connected' : 'Connect to FanZone'}
              >
                {isConnected ? '✓' : '⚡'}
              </button>
            </div>

            {/* Cheer 🔥 */}
            <button
              type="button"
              onClick={() => handleCheer(kick)}
              className="flex flex-col items-center gap-0.5"
              title="Cheer"
            >
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md border transition-transform active:scale-90 ${
                  kick.hasCheered
                    ? 'bg-[#00C853] text-black border-[#00C853]'
                    : 'bg-black/55 text-white border-white/15'
                }`}
              >
                <Flame className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-extrabold font-mono">
                {formatCompact(kick.cheers ?? kick.likes ?? 0)}
              </span>
            </button>

            {/* Shout 💬 */}
            <button
              type="button"
              onClick={() => setShoutsDrawerVideo(kick)}
              className="flex flex-col items-center gap-0.5"
              title="Shouts"
            >
              <div className="w-11 h-11 rounded-full bg-black/55 backdrop-blur-md border border-white/15 flex items-center justify-center">
                <MessageCircle className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-extrabold font-mono">
                {formatCompact(kick.shoutsCount ?? kick.commentsCount ?? 0)}
              </span>
            </button>

            {/* Share */}
            <button
              type="button"
              onClick={() =>
                openShareSheet({
                  kind: 'video',
                  targetId: kick.id,
                  title: kick.title,
                  text: `Watch "${kick.title}" Quick Kick on Futfield Tube!`,
                  url: buildShareUrl(`/tube/watch/${encodeURIComponent(kick.id)}`),
                  previewImage: kick.thumbnailUrl,
                  videoUrl: kick.videoUrl,
                })
              }
              className="flex flex-col items-center gap-0.5"
              title="Share"
            >
              <div className="w-11 h-11 rounded-full bg-black/55 backdrop-blur-md border border-white/15 flex items-center justify-center">
                <Share2 className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold">Share</span>
            </button>

            {/* Sound Toggle (ON by default) */}
            <button
              type="button"
              onClick={() => {
                const next = !quickKickMuted;
                setQuickKickMuted(next);
                if (quickKickVideoRef.current) {
                  quickKickVideoRef.current.muted = next;
                  if (!next) quickKickVideoRef.current.volume = 1;
                }
              }}
              className="flex flex-col items-center gap-0.5"
              title="Toggle Sound"
            >
              <div className="w-11 h-11 rounded-full bg-black/55 backdrop-blur-md border border-white/15 flex items-center justify-center">
                {quickKickMuted ? (
                  <VolumeX className="w-5 h-5 text-amber-400" />
                ) : (
                  <Volume2 className="w-5 h-5 text-[#00C853]" />
                )}
              </div>
              <span className="text-[10px] font-bold">{quickKickMuted ? 'Muted' : 'Sound'}</span>
            </button>

            {/* Crowd Cheer Sound FX */}
            <button
              type="button"
              onClick={() => {
                haptics.success();
                playCrowdCheerSound();
                triggerCheerBurst();
              }}
              className="flex flex-col items-center gap-0.5"
              title="Stadium Crowd Cheer FX"
            >
              <div className="w-11 h-11 rounded-full bg-[#00C853]/25 backdrop-blur-md border border-[#00C853]/60 flex items-center justify-center text-[#00C853]">
                <Volume2 className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-[#00C853]">Crowd</span>
            </button>

            {/* Caption Language Cycle (EN / Pidgin / Off) */}
            <button
              type="button"
              onClick={() =>
                setCaptionMode((m) => (m === 'english' ? 'pidgin' : m === 'pidgin' ? 'off' : 'english'))
              }
              className="flex flex-col items-center gap-0.5"
              title="Captions (English / Pidgin)"
            >
              <div className="w-10 h-10 rounded-full bg-black/55 backdrop-blur-md border border-white/15 flex items-center justify-center">
                <Subtitles className="w-4 h-4" />
              </div>
              <span className="text-[9px] font-bold uppercase">{captionMode}</span>
            </button>

            {/* Download */}
            <button
              type="button"
              onClick={() => handleDownloadClip(kick)}
              className="w-10 h-10 rounded-full bg-black/55 backdrop-blur-md border border-white/15 flex items-center justify-center"
              title="Download Clip"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Delete Clip (Inline Confirm) */}
            {confirmDeleteId === kick.id ? (
              <div className="flex flex-col gap-1 items-center bg-black/85 p-1.5 rounded-xl border border-white/20">
                <button
                  type="button"
                  onClick={() => handleConfirmDelete(kick.id)}
                  className="px-2 py-1 rounded-lg bg-[#00C853] text-black font-black text-[10px]"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-2 py-1 rounded-lg bg-white/15 text-white text-[10px]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDeleteId(kick.id)}
                className="w-10 h-10 rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-white/80 hover:text-amber-300 flex items-center justify-center"
                title="Delete Quick Kick"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Shouts Drawer for Quick Kicks */}
        {shoutsDrawerVideo && (
          <VideoCommentsDrawer
            video={shoutsDrawerVideo}
            isOpen={Boolean(shoutsDrawerVideo)}
            onClose={() => setShoutsDrawerVideo(null)}
          />
        )}
      </div>
    );
  }

  // ==============================================================
  // SUB-VIEW 4: /tube/watch/:id — WATCH PAGE (CUSTOM HTML5 PLAYER)
  // ==============================================================
  if (tubeSubView === 'watch' && activeWatchVideo) {
    const clip = activeWatchVideo;
    const fanzoneName = clip.fanzoneName || clip.creator?.name || 'FanZone Creator';
    const fanzoneHandle = clip.fanzoneHandle || clip.creator?.handle || '@fanzone';
    const fanzoneAvatar =
      clip.fanzoneAvatar || clip.creator?.avatar || '/assets/aistudio/IMG-20261106-WA6972_a4f2c4ba.jpg';
    const isConnected = Boolean(clip.creator?.isSubscribed);
    const watchesCount = Number(clip.watches ?? clip.views ?? 0);
    const cheersCount = Number(clip.cheers ?? clip.likes ?? 0);
    const boosCount = Number(clip.boos ?? 0);

    return (
      <div
        className="pb-24 max-w-6xl mx-auto px-2.5 sm:px-4 pt-2 space-y-4"
        onTouchStart={(e) => {
          watchTouchStartYRef.current = e.touches[0]?.clientY ?? null;
        }}
        onTouchEnd={(e) => {
          const startY = watchTouchStartYRef.current;
          watchTouchStartYRef.current = null;
          if (startY === null) return;
          const endY = e.changedTouches[0]?.clientY ?? startY;
          // Mobile swipe up cleanly jumps into Quick Kicks mode
          if (startY - endY > 95 && window.innerWidth < 768) {
            openQuickKicks();
          }
        }}
      >
        {renderCheerBurstOverlay()}

        {/* Watch Top Bar */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setTubeSubView('feed')}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5 hover:border-[#00C853]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Futfield Tube</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openQuickKicks()}
              className="min-h-[36px] px-3 py-1 rounded-full bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white text-xs font-extrabold flex items-center gap-1"
            >
              <Zap className="w-3.5 h-3.5 text-[#00C853]" />
              <span>Quick Kicks</span>
            </button>
            <button
              type="button"
              onClick={openTubeUpload}
              className="min-h-[36px] px-3.5 py-1 rounded-full bg-[#00C853] text-black text-xs font-black flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Upload Clip</span>
            </button>
          </div>
        </div>

        {/* Main 2-Column Watch Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {/* LEFT 2/3: PLAYER + INFO + SHOUTS */}
          <div className="lg:col-span-2 space-y-4">
            {/* Custom HTML5 Player (NO iframe, Sound ON by default, Stadium Green #00C853) */}
            <div
              ref={playerContainerRef}
              className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-2xl"
            >
              <div
                onClick={handleWatchSurfaceTap}
                className="relative aspect-video w-full bg-black flex items-center justify-center cursor-pointer"
              >
                <video
                  ref={watchVideoRef}
                  key={clip.id}
                  src={clip.videoUrl}
                  poster={clip.thumbnailUrl || undefined}
                  playsInline
                  autoPlay
                  muted={isMuted}
                  onLoadedMetadata={(e) => {
                    const el = e.currentTarget;
                    setDurationSec(el.duration || clip.durationSeconds || 0);
                    el.muted = isMuted;
                    el.volume = isMuted ? 0 : volume;
                    el.playbackRate = playbackSpeed;
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onTimeUpdate={(e) => {
                    const el = e.currentTarget;
                    setCurrentTime(el.currentTime);
                    handlePlaybackTimeTick(
                      clip.id,
                      accumulatedPlayRef,
                      lastTickRef,
                      el.paused
                    );
                  }}
                  onEnded={() => {
                    if (autoplayNext && upNextVideos.length > 0) {
                      handleOpenWatch(upNextVideos[0]);
                    }
                  }}
                  className="w-full h-full object-contain"
                />

                {/* Center Play Badge when paused */}
                {!isPlaying && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
                    <div className="w-16 h-16 rounded-full bg-[#00C853] text-black flex items-center justify-center shadow-2xl">
                      <Play className="w-8 h-8 fill-black ml-1" />
                    </div>
                  </div>
                )}

                {/* Double-Tap Seek Feedback (-10s / +10s) */}
                {seekOverlay && (
                  <div
                    className={`pointer-events-none absolute top-1/2 -translate-y-1/2 px-4 py-2 rounded-full bg-black/75 text-[#00C853] font-black text-sm ${
                      seekOverlay === 'back' ? 'left-6' : 'right-6'
                    }`}
                  >
                    {seekOverlay === 'back' ? '<< -10s' : '+10s >>'}
                  </div>
                )}

                {/* Free User Watermark Overlay */}
                {clip.hasWatermark && (
                  <div className="pointer-events-none absolute top-3 right-3 px-2.5 py-0.5 rounded bg-black/55 text-white/80 text-[10px] font-black tracking-widest border border-white/15">
                    FUTFIELD
                  </div>
                )}

                {/* Match Live Badge */}
                {clip.isMatchLive && (
                  <div className="pointer-events-none absolute top-3 left-3 px-2.5 py-1 rounded-full bg-[#00C853] text-black text-[10px] font-black flex items-center gap-1">
                    <Radio className="w-3 h-3 animate-pulse" />
                    <span>MATCH LIVE</span>
                  </div>
                )}

                {/* Auto-Caption Overlay (English + Pidgin) */}
                {activeCaptionCue && captionMode !== 'off' && (
                  <div className="pointer-events-none absolute bottom-3 left-4 right-4 text-center">
                    <span className="inline-block px-3 py-1 rounded-lg bg-black/80 text-white text-xs sm:text-sm font-bold shadow">
                      {captionMode === 'pidgin'
                        ? activeCaptionCue.pidgin
                        : activeCaptionCue.english}
                    </span>
                  </div>
                )}
              </div>

              {/* Custom Bottom Control Bar */}
              <div className="px-3 py-2 bg-[#090D12] border-t border-white/10 space-y-1.5 text-white">
                <input
                  type="range"
                  min={0}
                  max={durationSec || 1}
                  step={0.1}
                  value={currentTime}
                  onChange={(e) => {
                    const t = Number(e.target.value);
                    if (watchVideoRef.current) watchVideoRef.current.currentTime = t;
                    setCurrentTime(t);
                  }}
                  className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#00C853]"
                />

                <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleWatchPlayPause}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-[#00C853]"
                      title={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const nextMuted = !isMuted;
                        setIsMuted(nextMuted);
                        if (watchVideoRef.current) watchVideoRef.current.muted = nextMuted;
                      }}
                      className="p-1.5 rounded-lg hover:bg-white/10"
                      title="Toggle Sound"
                    >
                      {isMuted ? (
                        <VolumeX className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-[#00C853]" />
                      )}
                    </button>

                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setVolume(v);
                        setIsMuted(v === 0);
                        if (watchVideoRef.current) {
                          watchVideoRef.current.volume = v;
                          watchVideoRef.current.muted = v === 0;
                        }
                      }}
                      className="w-16 hidden sm:block h-1 bg-white/25 rounded-lg appearance-none cursor-pointer accent-[#00C853]"
                    />

                    <span className="font-mono text-[11px] text-white/75">
                      {formatMediaTime(currentTime)} / {formatMediaTime(durationSec)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Auto-Captions EN / Pidgin */}
                    <button
                      type="button"
                      onClick={() =>
                        setCaptionMode((m) =>
                          m === 'english' ? 'pidgin' : m === 'pidgin' ? 'off' : 'english'
                        )
                      }
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border ${
                        captionMode === 'off'
                          ? 'border-white/15 text-white/60'
                          : 'border-[#00C853]/60 bg-[#00C853]/15 text-[#00C853]'
                      }`}
                      title="Auto-Captions (English / Pidgin)"
                    >
                      <Subtitles className="w-3.5 h-3.5" />
                      <span>
                        {captionMode === 'english'
                          ? 'CC: EN'
                          : captionMode === 'pidgin'
                          ? 'CC: Pidgin'
                          : 'CC: Off'}
                      </span>
                    </button>

                    {/* Speed Selector 1x / 1.5x / 2x */}
                    <button
                      type="button"
                      onClick={() => {
                        const next = playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1;
                        setPlaybackSpeed(next);
                        if (watchVideoRef.current) watchVideoRef.current.playbackRate = next;
                      }}
                      className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-mono font-bold flex items-center gap-1"
                      title="Playback Speed"
                    >
                      <Gauge className="w-3 h-3 text-[#00C853]" />
                      <span>{playbackSpeed}x</span>
                    </button>

                    {/* Quality Selector 720p / 1080p */}
                    <button
                      type="button"
                      onClick={() => {
                        if (qualityPref === '720p' && !isProUser) {
                          setPricingModalOpen(true);
                          return;
                        }
                        setQualityPref((q) => (q === '1080p' ? '720p' : '1080p'));
                      }}
                      className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-mono font-bold text-[#00C853]"
                      title="Video Quality"
                    >
                      {qualityPref}
                    </button>

                    {/* Picture-in-Picture */}
                    <button
                      type="button"
                      onClick={handleTogglePiP}
                      className="p-1.5 rounded-lg hover:bg-white/10"
                      title="Picture-in-Picture"
                    >
                      <PictureInPicture2 className="w-4 h-4" />
                    </button>

                    {/* Fullscreen */}
                    <button
                      type="button"
                      onClick={handleToggleFullscreen}
                      className="p-1.5 rounded-lg hover:bg-white/10"
                      title="Fullscreen"
                    >
                      {isFullscreen ? (
                        <Minimize2 className="w-4 h-4" />
                      ) : (
                        <Maximize2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Title, Watches, & FanZone Bar */}
            <div className="space-y-3">
              <div>
                <h1 className="font-display font-black text-base sm:text-xl text-slate-900 dark:text-white leading-snug">
                  {clip.title}
                </h1>
                <p className="text-xs text-slate-500 dark:text-white/60 font-medium mt-1">
                  {formatCompact(watchesCount)} Watches · {formatRelativeTime(clip.createdAt)} ·{' '}
                  <span className="text-[#00C853] font-bold">
                    {clip.tubeCategory || 'Goals'}
                  </span>
                  {clip.boostFirst60 && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-[#00C853]/15 text-[#00C853] text-[10px] font-black">
                      60s Goal Boost ⚡
                    </span>
                  )}
                </p>
              </div>

              {/* FanZone Row: Avatar + Name + Squad + Connect ⚡ + Alert 🔔 */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
                <div
                  onClick={() => openFanZone(fanzoneHandle)}
                  className="flex items-center gap-3 cursor-pointer min-w-0"
                >
                  <img
                    src={fanzoneAvatar}
                    alt={fanzoneName}
                    className="w-11 h-11 rounded-full object-cover border-2 border-[#00C853] shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="font-display font-extrabold text-sm text-slate-900 dark:text-white truncate hover:text-[#00C853]">
                      {fanzoneName}
                    </div>
                    <div className="text-xs font-mono text-slate-500 dark:text-white/55">
                      {formatCompact(clip.squadCount || 1)} Squad
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleConnect(clip)}
                    className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-black transition-all ${
                      isConnected
                        ? 'bg-slate-200 dark:bg-white/15 text-slate-900 dark:text-white'
                        : 'bg-[#00C853] hover:bg-[#00b248] text-black shadow-md shadow-[#00C853]/25'
                    }`}
                  >
                    {isConnected ? 'Connected ✓' : 'Connect ⚡'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleAlert(clip)}
                    className={`min-h-[40px] px-3 py-1.5 rounded-full border text-xs font-bold flex items-center gap-1 ${
                      clip.alertEnabled
                        ? 'bg-[#00C853]/15 border-[#00C853] text-[#00C853]'
                        : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/75'
                    }`}
                    title="Alert"
                  >
                    {clip.alertEnabled ? (
                      <Bell className="w-4 h-4 fill-current" />
                    ) : (
                      <BellOff className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">Alert</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons Bar: Cheer 🔥, Boo 👎, Shout 💬, Share, Download, Save to Matchday Pack, Report, Delete */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                <button
                  type="button"
                  onClick={() => handleCheer(clip)}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 shrink-0 transition-all ${
                    clip.hasCheered
                      ? 'bg-[#00C853] text-black shadow-sm'
                      : 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white hover:bg-[#00C853]/20'
                  }`}
                >
                  <span>Cheer 🔥</span>
                  <span className="font-mono">{formatCompact(cheersCount)}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleBoo(clip)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 shrink-0 ${
                    clip.hasBooed
                      ? 'bg-amber-500/20 border border-amber-500/50 text-amber-600 dark:text-amber-300'
                      : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white/80'
                  }`}
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                  <span>Boo</span>
                  {boosCount > 0 && <span className="font-mono">({boosCount})</span>}
                </button>

                <button
                  type="button"
                  onClick={() => shoutInputRef.current?.focus()}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white text-xs font-bold flex items-center gap-1.5 shrink-0"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-[#00C853]" />
                  <span>Shout ({shouts.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openShareSheet({
                      kind: 'video',
                      targetId: clip.id,
                      title: clip.title,
                      text: `Watch "${clip.title}" on Futfield Tube!`,
                      url: buildShareUrl(`/tube/watch/${encodeURIComponent(clip.id)}`),
                      previewImage: clip.thumbnailUrl,
                      videoUrl: clip.videoUrl,
                    })
                  }
                  className="min-h-[38px] px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white text-xs font-bold flex items-center gap-1.5 shrink-0"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadClip(clip)}
                  disabled={downloadingId === clip.id}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white text-xs font-bold flex items-center gap-1.5 shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{downloadingId === clip.id ? 'Saving...' : 'Download'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenPackPicker}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white text-xs font-bold flex items-center gap-1.5 shrink-0"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-[#00C853]" />
                  <span>Save to Matchday Pack</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowReportBox((v) => !v)}
                  className="min-h-[38px] px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/70 text-xs font-bold flex items-center gap-1 shrink-0"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Report</span>
                </button>

                {confirmDeleteId === clip.id ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleConfirmDelete(clip.id)}
                      className="min-h-[36px] px-3 rounded-full bg-[#00C853] text-black font-black text-xs"
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="min-h-[36px] px-2.5 rounded-full bg-slate-200 dark:bg-white/15 text-xs font-bold"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(clip.id)}
                    className="min-h-[38px] px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white/75 text-xs font-bold flex items-center gap-1 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                )}
              </div>

              {/* Matchday Pack Inline Picker */}
              {showPackPicker && (
                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#12171F] border border-[#00C853]/40 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-extrabold text-slate-900 dark:text-white">
                    <span>Save to Matchday Pack</span>
                    <button type="button" onClick={() => setShowPackPicker(false)} className="text-slate-400">
                      Close
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {['Weekend Bangers', 'Tactical Gems', 'Best Goals'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleSaveToPack(preset)}
                        className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-[#00C853] hover:text-black text-xs font-bold"
                      >
                        + {preset}
                      </button>
                    ))}
                    {packs.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSaveToPack(p.name)}
                        className="px-3 py-1.5 rounded-full bg-[#00C853]/15 text-[#00C853] text-xs font-bold"
                      >
                        {p.name} ({p.videoIds.length})
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPackName}
                      onChange={(e) => setNewPackName(e.target.value)}
                      placeholder="New Matchday Pack name..."
                      className="flex-1 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveToPack(newPackName)}
                      className="px-4 py-1.5 rounded-xl bg-[#00C853] text-black font-black text-xs"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}

              {/* Report Inline Picker */}
              {showReportBox && (
                <div className="p-3 rounded-2xl bg-white dark:bg-[#12171F] border border-amber-500/40 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-slate-800 dark:text-white">Report Clip:</span>
                  {['Broadcast Copy', 'Spam', 'Off-topic'].map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={async () => {
                        await reportFutubeVideo(clip.id, user.id, reason);
                        setShowReportBox(false);
                        addNotification({
                          title: 'Report Submitted',
                          body: `Thanks — our MediaGuard team will review (${reason}).`,
                          type: 'system',
                        });
                      }}
                      className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold"
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              )}

              {/* Expandable Description + Clickable #Tags */}
              <div className="p-3.5 rounded-2xl bg-slate-100/80 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/8 space-y-2">
                <p
                  className={`text-xs text-slate-700 dark:text-white/80 leading-relaxed whitespace-pre-line ${
                    descExpanded ? '' : 'line-clamp-2'
                  }`}
                >
                  {clip.description || 'Original football clip on Futfield Tube.'}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {(clip.hashtags || ['#FutfieldTube']).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setSearchQuery(tag.replace(/^#/, ''));
                        setTubeSubView('feed');
                      }}
                      className="text-xs font-bold text-[#00C853] hover:underline"
                    >
                      {tag.startsWith('#') ? tag : `#${tag}`}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setDescExpanded((v) => !v)}
                    className="ml-auto text-xs font-extrabold text-slate-700 dark:text-white"
                  >
                    {descExpanded ? 'Show less' : 'Show more'}
                  </button>
                </div>
              </div>

              {/* Squad-Only Live Chat Toggle & Panel */}
              <div className="rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowMatchLiveChat((v) => !v)}
                  className="w-full px-4 py-3 flex items-center justify-between text-xs font-extrabold text-slate-900 dark:text-white bg-slate-50 dark:bg-black/25"
                >
                  <span className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-[#00C853]" />
                    <span>Squad-Only Match Live Chat ({liveChatMessages.length})</span>
                  </span>
                  <span className="text-[#00C853]">{showMatchLiveChat ? 'Hide' : 'Open'}</span>
                </button>
                {showMatchLiveChat && (
                  <div className="p-3.5 space-y-3 border-t border-slate-200 dark:border-white/10">
                    {!liveChatIsSquad && !isConnected ? (
                      <div className="p-3 rounded-xl bg-[#00C853]/10 border border-[#00C853]/30 flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-white">
                          Connect ⚡ to this FanZone to chat during Match Live!
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleConnect(clip)}
                          className="px-3.5 py-1.5 rounded-full bg-[#00C853] text-black font-black text-xs shrink-0"
                        >
                          Connect ⚡
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="max-h-40 overflow-y-auto space-y-2">
                          {liveChatMessages.length === 0 ? (
                            <p className="text-xs text-slate-500 dark:text-white/50 text-center py-2">
                              No Squad messages yet — start the Match Live banter!
                            </p>
                          ) : (
                            liveChatMessages.map((m) => (
                              <div key={m.id} className="flex items-start gap-2 text-xs">
                                <img
                                  src={m.userAvatar || fanzoneAvatar}
                                  alt={m.userName}
                                  className="w-6 h-6 rounded-full object-cover shrink-0"
                                />
                                <div>
                                  <span className="font-bold text-[#00C853] mr-1.5">
                                    {m.userName}:
                                  </span>
                                  <span className="text-slate-800 dark:text-white/85">{m.text}</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                        <form onSubmit={handleSendLiveSquadChat} className="flex gap-2">
                          <input
                            type="text"
                            value={liveChatInput}
                            onChange={(e) => setLiveChatInput(e.target.value)}
                            placeholder="Send a Squad Match Live message..."
                            className="flex-1 min-h-[38px] px-3 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs"
                          />
                          <button
                            type="submit"
                            className="px-3.5 rounded-xl bg-[#00C853] text-black font-black text-xs"
                          >
                            Send
                          </button>
                        </form>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* SHOUT SECTION (Comments with Newest / Top Cheers, Emoji Picker, Nested Replies) */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-display font-black text-sm text-slate-900 dark:text-white">
                    Shouts ({shouts.length})
                  </h3>
                  <div className="flex items-center gap-1 p-1 rounded-full bg-slate-100 dark:bg-white/5">
                    {(['newest', 'top_cheers'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setShoutSort(s)}
                        className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                          shoutSort === s
                            ? 'bg-[#00C853] text-black font-extrabold'
                            : 'text-slate-600 dark:text-white/70'
                        }`}
                      >
                        {s === 'newest' ? 'Newest' : 'Top Cheers 🔥'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Football Emoji Bar */}
                {showEmojiPicker && (
                  <div className="flex items-center gap-1.5 flex-wrap p-2 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10">
                    {QUICK_FOOTBALL_EMOJIS.map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setShoutInput((prev) => `${prev}${em}`)}
                        className="w-8 h-8 rounded-lg hover:bg-[#00C853]/20 text-base flex items-center justify-center"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                )}

                {/* Shout Input Form */}
                <form onSubmit={handleSendShout} className="space-y-1.5">
                  {replyTarget && (
                    <div className="flex items-center justify-between text-[11px] px-3 py-1 rounded-lg bg-[#00C853]/15 text-[#00C853] font-bold">
                      <span>Replying to @{replyTarget.authorName}</span>
                      <button type="button" onClick={() => setReplyTarget(null)}>
                        Cancel
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-8 h-8 rounded-full object-cover shrink-0"
                    />
                    <input
                      ref={shoutInputRef}
                      type="text"
                      value={shoutInput}
                      onChange={(e) => setShoutInput(e.target.value)}
                      placeholder="Add a Shout..."
                      className="flex-1 min-h-[40px] px-3.5 rounded-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00C853]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker((v) => !v)}
                      className="min-h-[40px] px-2.5 rounded-full bg-slate-100 dark:bg-white/10 text-sm"
                      title="Football Emoji Picker"
                    >
                      🔥
                    </button>
                    <button
                      type="submit"
                      disabled={!shoutInput.trim()}
                      className="min-h-[40px] px-4 rounded-full bg-[#00C853] text-black font-black text-xs disabled:opacity-45 flex items-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Shout</span>
                    </button>
                  </div>
                </form>

                {/* Shouts List */}
                <div className="space-y-3.5">
                  {shouts.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-white/50 text-center py-4">
                      No Shouts yet — drop the first match reaction!
                    </p>
                  ) : (
                    shouts.map((sh) => (
                      <div key={sh.id} className="space-y-2">
                        <div className="flex items-start gap-2.5 text-xs">
                          <img
                            src={sh.authorAvatar || fanzoneAvatar}
                            alt={sh.authorName}
                            onClick={() => openFanZone(sh.authorHandle || sh.authorName)}
                            className="w-8 h-8 rounded-full object-cover cursor-pointer shrink-0"
                          />
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                onClick={() => openFanZone(sh.authorHandle || sh.authorName)}
                                className="font-bold text-slate-900 dark:text-white cursor-pointer hover:text-[#00C853]"
                              >
                                {sh.authorName}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {formatRelativeTime(sh.createdAt)}
                              </span>
                            </div>
                            <p className="text-slate-700 dark:text-white/85 leading-relaxed">
                              {sh.text}
                            </p>
                            <div className="flex items-center gap-3 pt-0.5 text-[11px]">
                              <button
                                type="button"
                                onClick={() => handleCheerShout(sh.id)}
                                className={`font-bold flex items-center gap-1 ${
                                  sh.hasCheered
                                    ? 'text-[#00C853]'
                                    : 'text-slate-500 dark:text-white/60'
                                }`}
                              >
                                <span>🔥 {sh.cheers || 0}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setReplyTarget({
                                    parentId: sh.id,
                                    authorName: sh.authorName,
                                  });
                                  shoutInputRef.current?.focus();
                                }}
                                className="font-bold text-slate-500 dark:text-white/60 hover:text-[#00C853]"
                              >
                                Reply
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Nested Replies */}
                        {sh.replies && sh.replies.length > 0 && (
                          <div className="pl-10 space-y-2 border-l-2 border-[#00C853]/30 ml-4">
                            {sh.replies.map((rep) => (
                              <div key={rep.id} className="flex items-start gap-2 text-xs">
                                <CornerDownRight className="w-3.5 h-3.5 text-[#00C853] shrink-0 mt-1" />
                                <div className="flex-1 bg-slate-50 dark:bg-white/[0.04] p-2 rounded-xl">
                                  <span className="font-bold text-slate-900 dark:text-white mr-1.5">
                                    {rep.authorName}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {formatRelativeTime(rep.createdAt)}
                                  </span>
                                  <p className="text-slate-700 dark:text-white/80 mt-0.5">
                                    {rep.text}
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
              </div>
            </div>
          </div>

          {/* RIGHT 1/3: UP NEXT SIDEBAR WITH AUTOPLAY TOGGLE */}
          <aside className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-display font-black text-sm text-slate-900 dark:text-white">
                Up Next
              </h3>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-white/75 cursor-pointer">
                <span>Autoplay Next</span>
                <input
                  type="checkbox"
                  checked={autoplayNext}
                  onChange={(e) => setAutoplayNext(e.target.checked)}
                  className="accent-[#00C853]"
                />
              </label>
            </div>

            <div className="space-y-2.5">
              {upNextVideos.map((rel) => (
                <div
                  key={rel.id}
                  onClick={() => handleOpenWatch(rel)}
                  className="flex gap-2.5 p-2 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10 hover:border-[#00C853] cursor-pointer transition-all group"
                >
                  <div className="relative w-36 aspect-video rounded-xl overflow-hidden bg-black shrink-0">
                    {rel.thumbnailUrl ? (
                      <img
                        src={rel.thumbnailUrl}
                        alt={rel.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <video
                        src={`${rel.videoUrl}#t=0.4`}
                        muted
                        playsInline
                        preload="metadata"
                        className="w-full h-full object-cover"
                      />
                    )}
                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono font-bold">
                      {rel.duration}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-2 group-hover:text-[#00C853]">
                      {rel.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-white/55 truncate">
                      {rel.fanzoneName || rel.creator?.name}
                    </p>
                    <p className="text-[10px] font-mono text-slate-400">
                      {formatCompact(rel.watches ?? rel.views ?? 0)} Watches · 🔥{' '}
                      {formatCompact(rel.cheers ?? rel.likes ?? 0)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  // ==============================================================
  // SUB-VIEW 5: /tube — MAIN FUTFIELD TUBE VIDEO FEED
  // ==============================================================
  const visibleFeedVideos = feedVideos.filter((v) => {
    if (selectedCategory === 'Quick Kicks') {
      return v.isQuickKick || v.aspectRatio === '9:16';
    }
    return true;
  });

  return (
    <div className="pb-24 max-w-6xl mx-auto px-3 sm:px-4 pt-2 space-y-4">
      {renderCheerBurstOverlay()}

      {/* Header: Futfield Tube 🔥 + Quick Kicks + Upload Clip */}
      <header className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <FutfieldTubeLogo size={32} />
          <div>
            <h1 className="font-display font-black text-lg sm:text-xl text-slate-900 dark:text-white flex items-center gap-1">
              <span>Futfield Tube</span>
              <span>🔥</span>
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-white/55">
              Football FanZones · Goals · Quick Kicks · Zero Copyright
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openQuickKicks()}
            className="min-h-[40px] px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-white/10 hover:border-[#00C853] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-xs font-extrabold flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5 text-[#00C853]" />
            <span>Quick Kicks</span>
          </button>

          <button
            type="button"
            onClick={openTubeUpload}
            className="min-h-[40px] px-4 py-1.5 rounded-full bg-[#00C853] hover:bg-[#00b248] text-black font-black text-xs shadow-md shadow-[#00C853]/25 flex items-center gap-1"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Upload Clip</span>
          </button>
        </div>
      </header>

      {/* Search Bar + Goals Boost / On Fire / Newest */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search goals, players, clubs..."
            className="w-full min-h-[42px] pl-10 pr-4 rounded-full bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#00C853]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'goals_boost', label: 'Goals Boost ⚡' },
            { id: 'on_fire', label: 'On Fire 🔥' },
            { id: 'newest', label: 'Newest' },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSortMode(s.id as any)}
              className={`min-h-[38px] px-3.5 py-1 rounded-full text-xs font-extrabold whitespace-nowrap transition-all ${
                sortMode === s.id
                  ? 'bg-[#00C853] text-black shadow-sm'
                  : 'bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/75'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Horizontal Scrollable Categories */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {TUBE_CATEGORIES.map((cat) => {
          const active = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => {
                haptics.light();
                setSelectedCategory(cat);
              }}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition-all ${
                active
                  ? 'bg-slate-900 dark:bg-[#00C853] text-white dark:text-black'
                  : 'bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/75 hover:border-[#00C853]'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Pro Ad-Free Status */}
      {isProUser ? (
        <div className="px-3.5 py-2 rounded-2xl bg-[#00C853]/10 border border-[#00C853]/30 flex items-center justify-between text-xs">
          <span className="font-extrabold text-[#00C853] flex items-center gap-1.5">
            <Crown className="w-4 h-4" />
            <span>Ad-Free Pro Arena Active · Unlimited 1080p Uploads</span>
          </span>
          <Check className="w-4 h-4 text-[#00C853]" />
        </div>
      ) : (
        <div className="px-3.5 py-2 rounded-2xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 flex items-center justify-between gap-2 text-xs">
          <span className="text-slate-600 dark:text-white/70 font-medium">
            Free Supporter Mode · Up to 3 clips/day (720p)
          </span>
          <button
            type="button"
            onClick={() => setPricingModalOpen(true)}
            className="px-3 py-1 rounded-full bg-[#00C853] text-black font-black text-[11px] shrink-0"
          >
            Go Ad-Free Pro
          </button>
        </div>
      )}

      {/* FanZone Battle Voting Section */}
      <FanZoneBattlePanel
        videos={visibleFeedVideos}
        onWatchVideoId={(vidId) => {
          setTubeWatchVideoId(vidId);
          setTubeSubView('watch');
        }}
      />

      {/* Video Grid (16:9 Thumbnails, FanZone Avatar, Watches, Cheer Count) */}
      {visibleFeedVideos.length === 0 && !loadingFeed ? (
        <div className="py-14 px-4 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10 text-center space-y-3">
          <FutfieldTubeLogo size={42} className="mx-auto" />
          <h3 className="font-display font-black text-base text-slate-900 dark:text-white">
            No Clips Match Right Now
          </h3>
          <p className="text-xs text-slate-500 dark:text-white/55 max-w-sm mx-auto">
            Upload your own matchday highlights, tactical breakdowns, or 9:16 Quick Kicks to build your FanZone.
          </p>
          <button
            type="button"
            onClick={openTubeUpload}
            className="min-h-[42px] px-5 py-2 rounded-full bg-[#00C853] text-black font-black text-xs inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>+ Upload Clip</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleFeedVideos.map((clip) => {
            const fanzoneName = clip.fanzoneName || clip.creator?.name || 'FanZone Creator';
            const fanzoneHandle = clip.fanzoneHandle || clip.creator?.handle || '@fanzone';
            const fanzoneAvatar =
              clip.fanzoneAvatar ||
              clip.creator?.avatar ||
              '/assets/aistudio/IMG-20261106-WA6972_a4f2c4ba.jpg';

            return (
              <article
                key={clip.id}
                className="rounded-2xl overflow-hidden bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10 hover:border-[#00C853] transition-all flex flex-col group shadow-sm"
              >
                {/* 16:9 Thumbnail Cover */}
                <div
                  onClick={() => handleOpenWatch(clip)}
                  className="relative aspect-video bg-black cursor-pointer overflow-hidden"
                >
                  {clip.thumbnailUrl ? (
                    <img
                      src={clip.thumbnailUrl}
                      alt={clip.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : clip.videoUrl ? (
                    <video
                      src={`${clip.videoUrl}#t=0.4`}
                      muted
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-cover"
                    />
                  ) : null}

                  {/* Center Green Play Emblem */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/25">
                    <div className="w-12 h-12 rounded-full bg-[#00C853] text-black flex items-center justify-center shadow-xl">
                      <Play className="w-6 h-6 fill-black ml-0.5" />
                    </div>
                  </div>

                  {/* Top-Left Format / Goals Boost Badge */}
                  {clip.isQuickKick ? (
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-[#00C853] text-black text-[10px] font-black flex items-center gap-1">
                      <Zap className="w-3 h-3" /> Quick Kick
                    </span>
                  ) : clip.boostFirst60 ? (
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/80 text-[#00C853] text-[10px] font-black border border-[#00C853]/40">
                      60s Boost ⚡
                    </span>
                  ) : null}

                  {/* Bottom-Right Duration Badge */}
                  <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/85 text-white text-[10px] font-mono font-bold">
                    {clip.duration || '0:30'}
                  </span>
                </div>

                {/* Metadata Row */}
                <div className="p-3 flex-1 flex flex-col justify-between gap-2.5">
                  <div className="flex items-start gap-2.5">
                    <img
                      src={fanzoneAvatar}
                      alt={fanzoneName}
                      onClick={(e) => {
                        e.stopPropagation();
                        openFanZone(fanzoneHandle);
                      }}
                      className="w-9 h-9 rounded-full object-cover border border-[#00C853]/40 shrink-0 cursor-pointer hover:scale-105 transition-transform"
                    />
                    <div className="flex-1 min-w-0">
                      <h3
                        onClick={() => handleOpenWatch(clip)}
                        className="font-display font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-2 cursor-pointer group-hover:text-[#00C853]"
                      >
                        {clip.title}
                      </h3>
                      <p
                        onClick={() => openFanZone(fanzoneHandle)}
                        className="text-[11px] font-bold text-slate-600 dark:text-white/65 truncate mt-0.5 cursor-pointer hover:text-[#00C853]"
                      >
                        {fanzoneName}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-white/50 font-mono mt-0.5">
                        {formatCompact(clip.watches ?? clip.views ?? 0)} Watches ·{' '}
                        {formatRelativeTime(clip.createdAt)} · 🔥{' '}
                        {formatCompact(clip.cheers ?? clip.likes ?? 0)}
                      </p>
                    </div>
                  </div>

                  {/* Quick Bottom Bar (Cheer, Share, Delete) */}
                  <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCheer(clip)}
                        className={`px-2.5 py-1 rounded-full font-bold text-[11px] flex items-center gap-1 ${
                          clip.hasCheered
                            ? 'bg-[#00C853] text-black'
                            : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white/80'
                        }`}
                      >
                        <span>🔥 {formatCompact(clip.cheers ?? clip.likes ?? 0)}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          openShareSheet({
                            kind: 'video',
                            targetId: clip.id,
                            title: clip.title,
                            text: `Watch "${clip.title}" on Futfield Tube!`,
                            url: buildShareUrl(`/tube/watch/${encodeURIComponent(clip.id)}`),
                            previewImage: clip.thumbnailUrl,
                            videoUrl: clip.videoUrl,
                          })
                        }
                        className="p-1.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white/75 hover:text-[#00C853]"
                        title="Share Clip"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {confirmDeleteId === clip.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleConfirmDelete(clip.id)}
                          className="px-2 py-1 rounded-lg bg-[#00C853] text-black font-black text-[10px]"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-white/10 text-[10px]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(clip.id)}
                        className="p-1.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-white/60 hover:text-amber-500"
                        title="Delete Clip"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Infinite Scroll Sentinel + Manual Fallback */}
      {hasMoreFeed && (
        <div ref={loadMoreSentinelRef} className="pt-2 flex justify-center">
          <button
            type="button"
            disabled={loadingFeed}
            onClick={() => loadFeedPage(false)}
            className="min-h-[40px] px-6 py-2 rounded-full bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10 text-xs font-extrabold text-slate-800 dark:text-white hover:border-[#00C853]"
          >
            {loadingFeed ? 'Loading more clips...' : 'Load More Clips'}
          </button>
        </div>
      )}
    </div>
  );
};
