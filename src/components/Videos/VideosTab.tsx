import React, { useState, useRef, useEffect } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Search,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Upload,
  Check,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  Maximize2,
  X,
  CheckCircle2,
  Plus,
  Send,
  ArrowLeft,
  Download,
  Image as ImageIcon,
  Music,
  CornerDownRight,
  Flame,
  Repeat,
  PictureInPicture2,
  Eye,
  Gauge,
  Film,
  Sparkles,
  SkipForward,
  Trophy,
  ShieldCheck,
  ShieldAlert,
  Clapperboard,
  RefreshCw,
  Minimize2,
  Smartphone,
} from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { VideoItem } from '../../types/football';
import { POPULAR_TOP_5_CLUBS } from '../../data/top5Clubs';
import { VideoCommentsDrawer } from './VideoCommentsDrawer';
import {
  likeVideoOnServer,
  recordVideoViewOnServer,
  toggleFollowUserOnServer,
  fetchVideoCommentsFromServer,
  addVideoCommentOnServer,
} from '../../services/supabaseClient';
import { haptics } from '../../utils/haptics';
import { useHaptics } from '../../hooks/useHaptics';
import {
  uploadFileToBackend,
  inspectVideoMetadata,
  formatBytesToMb,
  captureVideoPosterFrame,
} from '../../utils/mediaUpload';
import { buildShareUrl } from '../../utils/share';
import { MediaUploadSplash, UploadSplashStatus } from '../Common/MediaUploadSplash';

export const VideosTab: React.FC = () => {
  const {
    videos,
    activeVideoIndex,
    setActiveVideoIndex,
    toggleLikeVideo,
    toggleSaveVideo,
    toggleSubscribeCreator,
    addVideo,
    user,
    addFanPoints,
    addNotification,
    setActiveTab,
    registerBackHandler,
    navigateToProfile,
    isCreatorConnected,
    toggleConnectCreator,
    openCreatorProfile,
    reactToVideo,
    shareVideo,
    refreshMediaAndAnalytics,
    dataSavingMode,
    latestUploadedVideoId,
    setLatestUploadedVideoId,
    openShareSheet,
  } = useFootball();

  const { triggerMessage, triggerWarning, triggerSuccess } = useHaptics();

  // Top-level split: 'short' (9:16 <= 2m) vs 'video' (16:9 <= 3m)
  const [activeVideoSection, setActiveVideoSection] = useState<'short' | 'video'>('short');

  // Mode: 'foryou' (vertical swipeable) | 'trending' (live ranked trending) | 'explore' (2-column grid)
  const [viewMode, setViewMode] = useState<'foryou' | 'trending' | 'explore'>('foryou');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClubFilter, setSelectedClubFilter] = useState<string>('all');
  const [selectedHashtag, setSelectedHashtag] = useState<string>('All');

  // Dedicated Video Page state (YouTube style)
  const [dedicatedVideo, setDedicatedVideo] = useState<VideoItem | null>(null);

  // Player controls state
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.25 | 1.5 | 2>(1);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [autoAdvanceReels, setAutoAdvanceReels] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(45);
  const [showCommentsDrawer, setShowCommentsDrawer] = useState<boolean>(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState<boolean>(false);
  const [heartBurst, setHeartBurst] = useState<boolean>(false);
  const [reactionBurstEmoji, setReactionBurstEmoji] = useState<string | null>(null);
  const [dislikedVideos, setDislikedVideos] = useState<Record<string, boolean>>({});
  const [fitMode, setFitMode] = useState<'contain' | 'cover'>('contain');
  const [reelProgress, setReelProgress] = useState<number>(0);
  const [reelDuration, setReelDuration] = useState<number>(0);
  const [videoBuffering, setVideoBuffering] = useState<boolean>(false);
  const [videoError, setVideoError] = useState<boolean>(false);

  // Backend Video Upload Modal state + Sign Splash
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadStep, setUploadStep] = useState<1 | 2 | 3>(1);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadBackendUrl, setUploadBackendUrl] = useState<string>('');
  const [videoUploadStatus, setVideoUploadStatus] = useState<UploadSplashStatus>('idle');
  const [thumbUploadStatus, setThumbUploadStatus] = useState<UploadSplashStatus>('idle');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadClubTag, setUploadClubTag] = useState('');
  const [uploadPrivacy, setUploadPrivacy] = useState<'public' | 'followers' | 'private'>('public');
  const [uploadThumbnail, setUploadThumbnail] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [uploadFileSizeBytes, setUploadFileSizeBytes] = useState<number>(0);
  const [uploadFileSizeMb, setUploadFileSizeMb] = useState<number>(0);
  const [uploadDurationSec, setUploadDurationSec] = useState<number>(30);
  const [uploadResolution, setUploadResolution] = useState<string>('');
  const [uploadWidth, setUploadWidth] = useState<number>(0);
  const [uploadHeight, setUploadHeight] = useState<number>(0);
  const [uploadIsVertical, setUploadIsVertical] = useState<boolean>(true);
  const [uploadVideoKind, setUploadVideoKind] = useState<'short' | 'video'>('short');
  const [uploadAspectRatio, setUploadAspectRatio] = useState<'9:16' | '16:9'>('9:16');
  const [uploadCopyrightStatus, setUploadCopyrightStatus] = useState<'CLEAR' | 'WARNING' | 'BLOCKED' | null>(null);
  const [uploadCopyrightReport, setUploadCopyrightReport] = useState<any>(null);
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string | null>(null);

  // Comments for dedicated video page with nested replies
  const [pageComments, setPageComments] = useState<any[]>([]);
  const [pageCommentInput, setPageCommentInput] = useState('');
  const [pageReplyTarget, setPageReplyTarget] = useState<{ parentId: string; authorName: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const dedicatedVideoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const customThumbInputRef = useRef<HTMLInputElement | null>(null);

  // Swipe navigation detection for For You mode
  const touchStartY = useRef<number | null>(null);

  const TRENDING_TAGS = ['All', '#PitchReels', '#UCL', '#Golazo', '#Skills', '#Matchday', '#Tactics'];

  const getVideoSectionKind = (v: VideoItem): 'short' | 'video' => {
    if (v.videoKind === 'short' || v.videoKind === 'video') return v.videoKind;
    if (v.aspectRatio === '16:9') return 'video';
    if ((v.durationSeconds || 0) > 120) return 'video';
    return 'short';
  };

  const getVideoEngagementScore = (v: VideoItem): number => {
    const reactionsSum = v.reactions
      ? Object.values(v.reactions).reduce((acc, c) => acc + (Number(c) || 0), 0)
      : 0;
    return (v.views || 0) + (v.likes || 0) * 3 + reactionsSum * 4 + (v.shares || 0) * 5 + (v.commentsCount || 0) * 2;
  };

  const shortsTotalCount = videos.filter(v => getVideoSectionKind(v) === 'short').length;
  const fullVideosTotalCount = videos.filter(v => getVideoSectionKind(v) === 'video').length;

  // Filter videos by active section (9:16 Shorts vs 16:9 Videos), search, club tag, and trending hashtag
  const baseFilteredVideos = videos.filter(v => {
    if (!v) return false;
    const matchesSection = getVideoSectionKind(v) === activeVideoSection;
    const qLower = searchQuery.toLowerCase();
    const matchesSearch =
      (v.title || '').toLowerCase().includes(qLower) ||
      (v.description || '').toLowerCase().includes(qLower) ||
      (v.hashtags && v.hashtags.some(h => h.toLowerCase().includes(qLower)));
    const matchesClub = selectedClubFilter === 'all' || v.clubTag === selectedClubFilter;
    const matchesTag =
      selectedHashtag === 'All' ||
      v.hashtags?.some(h => h.toLowerCase() === selectedHashtag.toLowerCase()) ||
      (v.title || '').toLowerCase().includes(selectedHashtag.replace('#', '').toLowerCase()) ||
      (v.description || '').toLowerCase().includes(selectedHashtag.replace('#', '').toLowerCase());
    return matchesSection && matchesSearch && matchesClub && matchesTag;
  });

  const filteredVideos =
    viewMode === 'trending'
      ? [...baseFilteredVideos].sort((a, b) => getVideoEngagementScore(b) - getVideoEngagementScore(a))
      : baseFilteredVideos;

  const currentVideo = filteredVideos[activeVideoIndex] || filteredVideos[0] || null;

  // Keep dedicatedVideo in sync with live server SSE updates (likes, views, reactions, shares)
  const liveDedicatedVideo = dedicatedVideo
    ? videos.find(v => v.id === dedicatedVideo.id) || dedicatedVideo
    : null;

  // Sync HTML5 video element with Play/Pause, Speed & Loop state
  useEffect(() => {
    const el = videoRef.current;
    if (!el || viewMode !== 'foryou') return;
    el.playbackRate = playbackRate;
    el.loop = isLooping;
    if (isPlaying) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [isPlaying, playbackRate, isLooping, currentVideo?.id, viewMode]);

  // Reset play state & player progress when switching reels
  useEffect(() => {
    setIsPlaying(!dataSavingMode);
    setReelProgress(0);
    setReelDuration(currentVideo?.durationSeconds || 0);
    setVideoBuffering(false);
    setVideoError(false);
    setFitMode('contain');
  }, [currentVideo?.id, dataSavingMode, activeVideoSection]);

  // Automatically clear filters and jump to a freshly uploaded video when targeted
  useEffect(() => {
    if (!latestUploadedVideoId) return;
    const found = videos.find(v => v && v.id === latestUploadedVideoId);
    if (!found) return;
    const targetKind = getVideoSectionKind(found);
    setSearchQuery('');
    setSelectedClubFilter('all');
    setSelectedHashtag('All');
    setActiveVideoSection(targetKind);
    setViewMode('foryou');
    const sectionList = videos.filter(v => v && getVideoSectionKind(v) === targetKind);
    const targetIdx = sectionList.findIndex(v => v.id === found.id);
    setActiveVideoIndex(targetIdx >= 0 ? targetIdx : 0);
    setDedicatedVideo(null);
  }, [latestUploadedVideoId, videos]);

  // Keyboard navigation (Up/Down arrows & Space play/pause) on desktop
  useEffect(() => {
    if (viewMode !== 'foryou' || showUploadModal || dedicatedVideo) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveVideoIndex(Math.min(filteredVideos.length - 1, activeVideoIndex + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveVideoIndex(Math.max(0, activeVideoIndex - 1));
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying(p => !p);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewMode, activeVideoIndex, filteredVideos.length, showUploadModal, dedicatedVideo]);

  // Track video view after 2 seconds of watching (real-time backend counter)
  useEffect(() => {
    const activeId = liveDedicatedVideo?.id || currentVideo?.id;
    if (!activeId) return;
    const timer = setTimeout(() => {
      recordVideoViewOnServer(activeId, user.id);
    }, 2000);
    return () => clearTimeout(timer);
  }, [currentVideo?.id, liveDedicatedVideo?.id]);

  // Register PitchReels internal back handler with global TopBar Back button
  useEffect(() => {
    registerBackHandler(() => {
      if (showUploadModal) {
        setShowUploadModal(false);
        return true;
      }
      if (dedicatedVideo) {
        setDedicatedVideo(null);
        return true;
      }
      if (viewMode !== 'foryou') {
        setViewMode('foryou');
        return true;
      }
      return false;
    });
    return () => registerBackHandler(null);
  }, [registerBackHandler, showUploadModal, dedicatedVideo, viewMode]);

  // Load comments when entering dedicated video page
  useEffect(() => {
    if (dedicatedVideo) {
      fetchVideoCommentsFromServer(dedicatedVideo.id).then(list => {
        setPageComments(list || []);
      });
    }
  }, [dedicatedVideo?.id]);

  // Dedicated Video time tracking
  const handleTimeUpdate = () => {
    if (dedicatedVideoRef.current) {
      setCurrentTime(Math.floor(dedicatedVideoRef.current.currentTime));
      if (dedicatedVideoRef.current.duration) {
        setDuration(Math.floor(dedicatedVideoRef.current.duration));
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (dedicatedVideoRef.current) {
      dedicatedVideoRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const toggleDedicatedPlay = () => {
    if (dedicatedVideoRef.current) {
      if (dedicatedVideoRef.current.paused) {
        dedicatedVideoRef.current.play();
        setIsPlaying(true);
      } else {
        dedicatedVideoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const toggleDedicatedFullscreen = () => {
    if (dedicatedVideoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        dedicatedVideoRef.current.requestFullscreen?.();
      }
    }
  };

  // Double tap to like on For You reel
  const handleDoubleTap = (videoId: string) => {
    haptics.like();
    setHeartBurst(true);
    setTimeout(() => setHeartBurst(false), 900);
    toggleLikeVideo(videoId);
    likeVideoOnServer(videoId, user.id);
  };

  // Follow creator action
  const handleFollowCreator = async (creatorHandle: string) => {
    haptics.success();
    toggleSubscribeCreator(creatorHandle);
    await toggleFollowUserOnServer(user.handle, creatorHandle);
    addNotification({
      title: 'Creator Followed!',
      body: `You are now following ${creatorHandle} for exclusive match highlights.`,
      type: 'follow',
    });
    addFanPoints(10, 'Followed pitch creator');
  };

  // Touch Swipe handlers for For You Mode
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (deltaY < -50) {
      // Swiped UP -> Next Video
      if (activeVideoIndex < filteredVideos.length - 1) {
        setActiveVideoIndex(activeVideoIndex + 1);
      }
    } else if (deltaY > 50) {
      // Swiped DOWN -> Previous Video
      if (activeVideoIndex > 0) {
        setActiveVideoIndex(activeVideoIndex - 1);
      }
    }
    touchStartY.current = null;
  };

  // Cycle playback speed 1x -> 1.25x -> 1.5x -> 2x
  const cyclePlaybackRate = () => {
    haptics.light();
    setPlaybackRate(prev => (prev === 1 ? 1.25 : prev === 1.25 ? 1.5 : prev === 1.5 ? 2 : 1));
  };

  // Trigger Picture-in-Picture on active player
  const handlePictureInPicture = async (el: HTMLVideoElement | null) => {
    try {
      if (!el) return;
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if ((el as any).requestPictureInPicture) {
        await (el as any).requestPictureInPicture();
      }
    } catch {}
  };

  // Real-time Share action wired to Phone Share Sheet & server counter
  const handleShareReel = (vid: VideoItem) => {
    haptics.light();
    shareVideo(vid.id);
    addFanPoints(5, 'Shared PitchReel');
    openShareSheet({
      kind: 'video',
      targetId: vid.id,
      title: vid.title,
      text: `${vid.title} — Watch on FUTFIELD PitchReels`,
      url: buildShareUrl('/highlights'),
      previewImage: vid.thumbnailUrl,
    });
  };

  // Live Emoji Reaction on a video with floating burst animation
  const handleEmojiReaction = (videoId: string, emoji: string) => {
    haptics.like();
    setReactionBurstEmoji(emoji);
    setTimeout(() => setReactionBurstEmoji(null), 700);
    reactToVideo(videoId, emoji);
    addFanPoints(2, `Reacted ${emoji} to PitchReel`);
  };

  // Open Upload modal pre-filled as a Remix / Reply Clip
  const handleRemixClip = (vid: VideoItem) => {
    haptics.light();
    setUploadTitle(`Remix: ${vid.title || 'Highlight'}`.slice(0, 100));
    setUploadDesc(`Replying to ${vid.creator?.handle || '@creator'} #Remix #PitchReels ${vid.clubTag ? `#${vid.clubTag.replace(/\s+/g, '')}` : ''}`);
    setUploadClubTag(vid.clubTag || '');
    setUploadStep(1);
    setShowUploadModal(true);
  };

  // Handle Video Selection -> Auto-detect 9:16 Short (<=2m) vs 16:9 Video (<=3m) + Backend Copyright Guard
  const processVideoFile = async (file: File) => {
    setUploadFile(file);
    const exactBytes = file.size;
    const exactMb = formatBytesToMb(exactBytes);
    setUploadFileSizeBytes(exactBytes);
    setUploadFileSizeMb(exactMb);
    setUploadBackendUrl('');
    setUploadErrorMsg(null);
    setUploadCopyrightStatus(null);
    setUploadCopyrightReport(null);
    setVideoUploadStatus('uploading');
    setUploadProgress(5);
    setUploadStep(2);

    // 1. Inspect metadata & auto-detect 9:16 Short (<=120s) vs 16:9 Video (<=180s)
    const meta = await inspectVideoMetadata(file);
    if (meta.duration > 0) setUploadDurationSec(meta.duration);
    setUploadWidth(meta.width || 0);
    setUploadHeight(meta.height || 0);
    if (meta.width > 0 && meta.height > 0) {
      setUploadResolution(`${meta.width}x${meta.height}`);
    } else {
      setUploadResolution('');
    }

    if (meta.validationError || meta.videoKind === 'unsupported') {
      triggerWarning();
      setVideoUploadStatus('error');
      setUploadErrorMsg(
        meta.validationError ||
          'Only 9:16 Vertical Shorts (≤ 2 min) or 16:9 Widescreen Videos (≤ 3 min) are permitted.'
      );
      return;
    }

    const detectedKind: 'short' | 'video' = meta.videoKind;
    const detectedRatio: '9:16' | '16:9' = meta.detectedAspectRatio === '16:9' ? '16:9' : '9:16';
    setUploadVideoKind(detectedKind);
    setUploadAspectRatio(detectedRatio);
    setUploadIsVertical(detectedKind === 'short');

    // Capture a real poster frame in parallel so every uploaded video displays crisp artwork immediately
    const posterPromise = captureVideoPosterFrame(file).catch(() => null);

    // 2. Upload binary with detected dimensions/duration + run Backend MediaGuard Copyright Detector
    const res = await uploadFileToBackend(
      file,
      'videos',
      file.name,
      (pct) => setUploadProgress(pct),
      user.id,
      {
        durationSeconds: meta.duration,
        width: meta.width,
        height: meta.height,
        videoKind: detectedKind,
        aspectRatio: detectedRatio,
        title: uploadTitle.trim() || file.name,
        description: uploadDesc.trim(),
      }
    );

    if (res.success && res.url) {
      setUploadBackendUrl(res.url);
      if (res.sizeBytes) setUploadFileSizeBytes(res.sizeBytes);
      if (res.sizeMb) setUploadFileSizeMb(res.sizeMb);
      if (res.videoKind) setUploadVideoKind(res.videoKind);
      if (res.aspectRatio) setUploadAspectRatio(res.aspectRatio);
      setUploadCopyrightStatus(res.copyrightStatus || 'CLEAR');
      setUploadCopyrightReport(res.copyrightReport || null);
      setUploadProgress(100);
      setVideoUploadStatus('uploaded');
      triggerSuccess();
      refreshMediaAndAnalytics().catch(() => {});

      const posterBlob = await posterPromise;
      if (posterBlob) {
        setThumbUploadStatus('uploading');
        const posterFile = new File([posterBlob], `poster-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const posterRes = await uploadFileToBackend(posterFile, 'video-thumbnails', posterFile.name, undefined, user.id);
        if (posterRes.success && posterRes.url) {
          setUploadThumbnail(prev => prev || posterRes.url || '');
          setThumbUploadStatus('uploaded');
        } else {
          setThumbUploadStatus('idle');
        }
      }
    } else {
      triggerWarning();
      setUploadCopyrightStatus(res.copyrightStatus || null);
      setUploadCopyrightReport(res.copyrightReport || null);
      setVideoUploadStatus('error');
      setUploadErrorMsg(res.error || 'Video upload to backend failed');
    }
  };

  const handleVideoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) processVideoFile(file);
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('video/') || file.name.endsWith('.mp4') || file.name.endsWith('.mov'))) {
      processVideoFile(file);
    }
  };

  // Custom cover image upload directly to Backend (no FileReader base64)
  const handleCustomThumbnailSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setThumbUploadStatus('uploading');
    const res = await uploadFileToBackend(file, 'video-thumbnails', file.name, undefined, user.id);
    if (res.success && res.url) {
      setUploadThumbnail(res.url);
      setThumbUploadStatus('uploaded');
    } else {
      setThumbUploadStatus('error');
    }
  };

  // Execute Publish after Backend Video Upload completes ('UPLOADED')
  const handleStartUpload = async () => {
    if (!uploadTitle.trim() || !uploadBackendUrl || videoUploadStatus !== 'uploaded') return;

    setUploadStep(3);
    setIsPublishing(true);
    haptics.light();

    try {
      const tags = Array.from(uploadDesc.matchAll(/#([a-zA-Z0-9_]+)/g)).map(m => `#${m[1]}`);
      const durSec = uploadDurationSec || 30;
      const durStr = `${Math.floor(durSec / 60)}:${(durSec % 60).toString().padStart(2, '0')}`;

      const created = await addVideo({
        title: uploadTitle.trim(),
        description: uploadDesc.trim(),
        videoUrl: uploadBackendUrl,
        thumbnailUrl: uploadThumbnail || '',
        clubTag: uploadClubTag,
        privacy: uploadPrivacy,
        hashtags: tags.length > 0 ? tags : [uploadVideoKind === 'short' ? '#PitchShorts' : '#PitchVideos', '#FUTFIELD'],
        duration: durStr,
        durationSeconds: durSec,
        sizeBytes: uploadFileSizeBytes,
        sizeMb: uploadFileSizeMb,
        width: uploadWidth || undefined,
        height: uploadHeight || undefined,
        videoKind: uploadVideoKind,
        aspectRatio: uploadAspectRatio,
        copyrightStatus: uploadCopyrightStatus || 'CLEAR',
        copyrightReport: uploadCopyrightReport,
      });

      triggerSuccess();
      refreshMediaAndAnalytics().catch(() => {});
      setSearchQuery('');
      setSelectedClubFilter('all');
      setSelectedHashtag('All');
      setActiveVideoSection(uploadVideoKind);
      setViewMode('foryou');
      setActiveVideoIndex(0);
      if (created?.id) setLatestUploadedVideoId(created.id);
      addNotification({
        title: `${uploadVideoKind === 'short' ? '9:16 Short' : '16:9 Video'} Published Live!`,
        body: `"${uploadTitle}" (${uploadFileSizeMb} MB) cleared MediaGuard & is streaming now.`,
        type: 'video',
      });

      setIsPublishing(false);
      setShowUploadModal(false);
      setUploadStep(1);
      setUploadFile(null);
      setUploadBackendUrl('');
      setVideoUploadStatus('idle');
      setThumbUploadStatus('idle');
      setUploadThumbnail('');
      setUploadTitle('');
      setUploadDesc('');
      setUploadProgress(0);
      setUploadFileSizeBytes(0);
      setUploadFileSizeMb(0);
      setUploadWidth(0);
      setUploadHeight(0);
      setUploadCopyrightStatus(null);
      setUploadCopyrightReport(null);
    } catch {
      setIsPublishing(false);
      setUploadStep(2);
    }
  };

  // Add Comment on Dedicated Video Page
  const handleAddPageComment = async () => {
    if (!pageCommentInput.trim() || !dedicatedVideo) return;
    triggerMessage();

    const author = {
      name: user.name,
      handle: user.handle,
      avatar: user.avatar,
    };

    const res = await addVideoCommentOnServer(
      dedicatedVideo.id,
      author,
      pageCommentInput.trim(),
      pageReplyTarget?.parentId
    );

    if (res.success && res.comment) {
      if (pageReplyTarget) {
        setPageComments(prev =>
          prev.map(c => {
            if (c.id === pageReplyTarget.parentId) {
              return {
                ...c,
                replies: [...(c.replies || []), res.comment],
              };
            }
            return c;
          })
        );
      } else {
        setPageComments(prev => [res.comment, ...prev]);
      }

      setPageCommentInput('');
      setPageReplyTarget(null);
      addFanPoints(5, 'Commented on pitch highlight');
      addNotification({
        title: pageReplyTarget ? 'Reply Sent!' : 'Comment Published!',
        body: 'Your match analysis was added to the discussion.',
        type: 'comment',
      });
    }
  };

  // Direct Video Download
  const handleDownloadVideo = (video: VideoItem) => {
    const a = document.createElement('a');
    a.href = video.videoUrl;
    a.download = `${video.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    addNotification({
      title: 'Download Started',
      body: `Downloading "${video.title}" highlight reel.`,
      type: 'system',
    });
  };

  // Dislike toggle
  const toggleDislike = (videoId: string) => {
    setDislikedVideos(prev => ({
      ...prev,
      [videoId]: !prev[videoId],
    }));
  };

  // -------------------------------------------------------------
  // VIEW: DEDICATED FULL VIDEO PAGE (YouTube style)
  // -------------------------------------------------------------
  if (liveDedicatedVideo) {
    const relatedVideos = videos.filter(
      v => v.id !== liveDedicatedVideo.id && (!liveDedicatedVideo.clubTag || v.clubTag === liveDedicatedVideo.clubTag)
    );

    return (
      <div className="pb-28 max-w-xl mx-auto px-3 sm:px-4 pt-2 space-y-3.5 animate-in fade-in">
        {/* Back navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setDedicatedVideo(null)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-white/80 hover:text-[#00E676] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Reels</span>
          </button>
          <div className="flex items-center gap-2">
            {liveDedicatedVideo.sizeMb ? (
              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-mono text-[10px] font-bold">
                {liveDedicatedVideo.sizeMb} MB
              </span>
            ) : null}
            <span className="text-xs font-semibold text-slate-400">PitchReels Player</span>
          </div>
        </div>

        {/* Video Player Box with Controls */}
        <div
          className={`relative rounded-2xl overflow-hidden bg-black shadow-2xl group ${
            getVideoSectionKind(liveDedicatedVideo) === 'short'
              ? 'aspect-[9/16] max-h-[68vh] max-w-[340px] mx-auto'
              : 'aspect-video w-full'
          }`}
        >
          <video
            key={liveDedicatedVideo.id}
            ref={dedicatedVideoRef}
            src={liveDedicatedVideo.videoUrl}
            poster={liveDedicatedVideo.thumbnailUrl || undefined}
            playsInline
            autoPlay={!dataSavingMode}
            preload={dataSavingMode ? 'metadata' : 'auto'}
            loop={isLooping}
            muted={isMuted}
            onTimeUpdate={handleTimeUpdate}
            onClick={toggleDedicatedPlay}
            className="w-full h-full object-contain cursor-pointer"
          />

          {/* Bottom Video Controls Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
            {/* Seek bar */}
            <input
              type="range"
              min={0}
              max={duration || 45}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-[#00E676]"
            />

            <div className="flex items-center justify-between text-white text-xs">
              <div className="flex items-center gap-3">
                <button onClick={toggleDedicatedPlay} className="hover:text-[#00E676]">
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => {
                    if (dedicatedVideoRef.current) {
                      dedicatedVideoRef.current.muted = !isMuted;
                      setIsMuted(!isMuted);
                    }
                  }}
                  className="hover:text-[#00E676]"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <span className="text-[11px] font-mono text-white/80">
                  {Math.floor(currentTime / 60)}:{(currentTime % 60).toString().padStart(2, '0')} /{' '}
                  {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const nextRate = playbackRate === 1 ? 1.25 : playbackRate === 1.25 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
                    setPlaybackRate(nextRate);
                    if (dedicatedVideoRef.current) dedicatedVideoRef.current.playbackRate = nextRate;
                  }}
                  className="px-1.5 py-0.5 rounded bg-white/15 hover:bg-white/25 text-[10px] font-mono font-bold"
                  title="Playback speed"
                >
                  {playbackRate}x
                </button>
                <button
                  onClick={() => handlePictureInPicture(dedicatedVideoRef.current)}
                  className="hover:text-[#00E676]"
                  title="Picture-in-Picture"
                >
                  <PictureInPicture2 className="w-4 h-4" />
                </button>
                <button onClick={toggleDedicatedFullscreen} className="hover:text-[#00E676]">
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Video Title & Real-Time Metrics */}
        <div className="space-y-1">
          <h1 className="text-base font-extrabold text-slate-900 dark:text-white leading-snug">
            {liveDedicatedVideo.title}
          </h1>
          <div className="flex items-center flex-wrap gap-2 text-xs text-slate-500 dark:text-white/50">
            <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-white/80">
              <Eye className="w-3.5 h-3.5 text-[#00E676]" />
              {liveDedicatedVideo.views} views
            </span>
            <span>•</span>
            <span>{liveDedicatedVideo.shares || 0} shares</span>
            <span>•</span>
            <span>{liveDedicatedVideo.createdAt || 'Recently'}</span>
            {liveDedicatedVideo.clubTag && (
              <>
                <span>•</span>
                <span className="text-[#00E676] font-bold">#{liveDedicatedVideo.clubTag}</span>
              </>
            )}
          </div>
        </div>

        {/* Channel Row */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-[#161b22] border border-slate-200/80 dark:border-white/10 shadow-sm">
          <div
            onClick={() => navigateToProfile(liveDedicatedVideo.userId || liveDedicatedVideo.creator?.handle || '@creator')}
            className="flex items-center gap-2.5 cursor-pointer group"
            title={`View ${liveDedicatedVideo.creator?.name || 'Pitch Creator'}'s profile`}
          >
            <img
              src={liveDedicatedVideo.creator?.avatar || '/assets/aistudio/IMG-20261106-WA6972_a4f2c4ba.jpg'}
              alt={`${liveDedicatedVideo.creator?.name || 'Pitch Creator'} football creator`}
              loading="lazy"
              decoding="async"
              className="w-10 h-10 rounded-full object-cover ring-2 ring-[#00E676]/30 group-hover:ring-[#00E676] transition-all"
            />
            <div>
              <div className="flex items-center gap-1">
                <span className="font-extrabold text-xs text-slate-900 dark:text-white group-hover:text-[#00E676] transition-colors">
                  {liveDedicatedVideo.creator?.name || 'Pitch Creator'}
                </span>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#00E676] fill-[#00E676]/20" />
              </div>
              <span className="text-[10px] text-slate-500 dark:text-white/50">
                {liveDedicatedVideo.creator?.subscribers || '1 supporter'}
              </span>
            </div>
          </div>

          <button
            onClick={() => handleFollowCreator(liveDedicatedVideo.creator?.handle || '@creator')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              liveDedicatedVideo.creator?.isSubscribed
                ? 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 active:scale-95'
            }`}
          >
            {liveDedicatedVideo.creator?.isSubscribed ? 'Following' : 'Follow'}
          </button>
        </div>

        {/* Live Emoji Reactions Bar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['🔥', '⚽', '👏', '😱', '❤️'] as const).map(emoji => {
            const count = liveDedicatedVideo.reactions?.[emoji] || 0;
            const active = liveDedicatedVideo.userReactions?.includes(emoji);
            return (
              <button
                key={emoji}
                onClick={() => handleEmojiReaction(liveDedicatedVideo.id, emoji)}
                className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 border transition-all active:scale-95 ${
                  active
                    ? 'bg-[#00E676]/15 border-[#00E676] text-[#00E676]'
                    : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/80'
                }`}
              >
                <span>{emoji}</span>
                {count > 0 && <span className="font-mono text-[11px]">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Action Buttons Row: Like, Dislike, Share, Remix, Download, Save */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 text-xs">
          {/* Like */}
          <button
            onClick={() => {
              toggleLikeVideo(liveDedicatedVideo.id);
              likeVideoOnServer(liveDedicatedVideo.id, user.id);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border transition-colors ${
              liveDedicatedVideo.isLiked
                ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-500 text-rose-500 font-bold'
                : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-white'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${liveDedicatedVideo.isLiked ? 'fill-rose-500' : ''}`} />
            <span>{liveDedicatedVideo.likes}</span>
          </button>

          {/* Dislike */}
          <button
            onClick={() => toggleDislike(liveDedicatedVideo.id)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border transition-colors ${
              dislikedVideos[liveDedicatedVideo.id]
                ? 'bg-slate-200 dark:bg-white/20 border-slate-400 text-slate-900 dark:text-white font-bold'
                : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-white'
            }`}
          >
            <ThumbsDown className="w-3.5 h-3.5" />
            <span>Dislike</span>
          </button>

          {/* Share */}
          <button
            onClick={() => handleShareReel(liveDedicatedVideo)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-100"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share ({liveDedicatedVideo.shares || 0})</span>
          </button>

          {/* Remix Clip */}
          <button
            onClick={() => handleRemixClip(liveDedicatedVideo)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-500 font-bold hover:bg-purple-500/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Remix</span>
          </button>

          {/* Download */}
          <button
            onClick={() => handleDownloadVideo(liveDedicatedVideo)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-100"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>

          {/* Save / Bookmark */}
          <button
            onClick={() => {
              toggleSaveVideo(liveDedicatedVideo.id);
              addNotification({
                title: 'Saved to Watchlist',
                body: 'Video bookmarked in your highlights.',
                type: 'system',
              });
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border transition-colors ${
              liveDedicatedVideo.isSaved
                ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-500 text-amber-500 font-bold'
                : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-white'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${liveDedicatedVideo.isSaved ? 'fill-amber-500' : ''}`} />
            <span>Save</span>
          </button>
        </div>

        {/* Expandable Description */}
        <div className="p-3 rounded-2xl bg-white dark:bg-[#161b22] border border-slate-200/80 dark:border-white/10 space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 dark:text-white">Description</span>
            {liveDedicatedVideo.description && liveDedicatedVideo.description.length > 90 && (
              <button
                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                className="text-[11px] font-bold text-blue-500 hover:underline"
              >
                {isDescriptionExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
          <p
            className={`text-slate-600 dark:text-white/70 leading-relaxed whitespace-pre-line ${
              !isDescriptionExpanded ? 'line-clamp-2' : ''
            }`}
          >
            {liveDedicatedVideo.description || 'No description provided.'}
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {(liveDedicatedVideo.hashtags || []).map((h, i) => (
              <span
                key={i}
                onClick={() => setSearchQuery(h.replace('#', ''))}
                className="text-[#00E676] font-semibold text-[11px] cursor-pointer hover:underline"
              >
                {h}
              </span>
            ))}
          </div>
        </div>

        {/* Comments Section with Nested Replies */}
        <div className="p-3 rounded-2xl bg-white dark:bg-[#161b22] border border-slate-200/80 dark:border-white/10 space-y-3">
          <span className="font-bold text-xs text-slate-900 dark:text-white">
            Comments ({pageComments.length})
          </span>

          {/* Comment Composer */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={pageCommentInput}
              onChange={e => setPageCommentInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddPageComment();
              }}
              placeholder={
                pageReplyTarget
                  ? `Replying to @${pageReplyTarget.authorName}...`
                  : 'Add a comment...'
              }
              className="flex-1 bg-slate-100 dark:bg-white/5 px-3 py-2 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none"
            />
            {pageReplyTarget && (
              <button
                onClick={() => setPageReplyTarget(null)}
                className="text-[10px] text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleAddPageComment}
              className="p-2 rounded-xl bg-[#00E676] text-black font-bold"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Comments List & Nested Replies */}
          <div className="space-y-2.5">
            {pageComments.length === 0 ? (
              <p className="text-[11px] text-slate-400 py-1 text-center">
                Be the first to comment on this football reel!
              </p>
            ) : (
              pageComments.map(c => (
                <div key={c.id} className="space-y-1.5 text-xs">
                  <div className="flex items-start gap-2">
                    <img src={c.author?.avatar || user.avatar} alt={`${c.author?.name || 'Supporter'} football fan avatar`} loading="lazy" decoding="async" className="w-6 h-6 rounded-full object-cover shrink-0" />
                    <div className="flex-1 bg-slate-50 dark:bg-white/5 p-2 rounded-xl space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[10px] text-slate-900 dark:text-white">
                          {c.author?.name || 'Supporter'}
                        </span>
                        <span className="text-[9px] text-slate-400">{c.timestamp}</span>
                      </div>
                      <p className="text-[11px] text-slate-700 dark:text-white/80">{c.text}</p>
                    </div>
                  </div>

                  {/* Reply Button */}
                  <div className="pl-8 flex items-center gap-3 text-[10px] text-slate-400">
                    <button
                      onClick={() =>
                        setPageReplyTarget({ parentId: c.id, authorName: c.author?.name || 'Supporter' })
                      }
                      className="hover:text-[#00E676] font-semibold"
                    >
                      Reply
                    </button>
                  </div>

                  {/* Sub-replies */}
                  {c.replies && c.replies.length > 0 && (
                    <div className="pl-7 space-y-1.5 border-l-2 border-slate-100 dark:border-white/10 ml-3">
                      {c.replies.map((r: any) => (
                        <div key={r.id} className="flex items-start gap-2 text-xs">
                          <CornerDownRight className="w-3 h-3 text-slate-400 shrink-0 mt-1" />
                          <div className="flex-1 bg-slate-100/70 dark:bg-white/10 p-2 rounded-xl">
                            <span className="font-bold text-[10px] text-slate-900 dark:text-white block">
                              {r.author?.name || 'Supporter'}
                            </span>
                            <p className="text-[11px] text-slate-700 dark:text-white/80">{r.text}</p>
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

        {/* Up Next Related Videos */}
        <div className="space-y-2 pt-2">
          <span className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-tight">
            Up Next
          </span>
          <div className="space-y-2">
            {relatedVideos.map(item => (
              <div
                key={item.id}
                onClick={() => setDedicatedVideo(item)}
                className="flex items-center gap-2.5 p-2 rounded-xl bg-white dark:bg-[#161b22] border border-slate-200/80 dark:border-white/10 cursor-pointer hover:border-[#00E676] transition-all"
              >
                <div className="relative w-28 aspect-video rounded-lg overflow-hidden bg-black shrink-0">
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt={`${item.title} football match highlight`} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  ) : (
                    <video
                      src={`${item.videoUrl}#t=0.5`}
                      preload="metadata"
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  )}
                  <span className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/80 text-[9px] text-white rounded font-mono">
                    {item.duration}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-2 leading-snug">
                    {item.title}
                  </h4>
                  <span className="text-[10px] text-slate-500 dark:text-white/50 block truncate">
                    {item.creator?.name || 'Pitch Creator'}
                  </span>
                  <span className="text-[10px] text-slate-400">{item.views || 0} views</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: MAIN VIDEO FEED ('For You' vs 'Explore')
  // -------------------------------------------------------------
  return (
    <div className="pb-28 max-w-2xl mx-auto px-3 sm:px-4 pt-3 space-y-3.5 relative">
      {/* Top Header Row with Mode Switcher & Upload */}
      <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
            PitchReels · Football Highlights
          </h1>
        </div>

        <div className="flex items-center gap-1.5">
          {/* 3 Modes Toggle: 'For You' | 'Trending' | 'Explore' */}
          <div className="p-0.5 rounded-full bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10 flex items-center text-[10px] font-bold">
            <button
              onClick={() => setViewMode('foryou')}
              className={`min-h-[32px] px-2.5 py-1 rounded-full transition-all ${
                viewMode === 'foryou'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-white/65 hover:text-black dark:hover:text-white'
              }`}
            >
              For You
            </button>
            <button
              onClick={() => setViewMode('trending')}
              className={`min-h-[32px] px-2.5 py-1 rounded-full transition-all flex items-center gap-1 ${
                viewMode === 'trending'
                  ? 'bg-amber-400 text-black shadow-sm font-extrabold'
                  : 'text-slate-600 dark:text-white/65 hover:text-black dark:hover:text-white'
              }`}
            >
              <Flame className="w-3 h-3" />
              <span>Hot</span>
            </button>
            <button
              onClick={() => setViewMode('explore')}
              className={`min-h-[32px] px-2.5 py-1 rounded-full transition-all ${
                viewMode === 'explore'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-white/65 hover:text-black dark:hover:text-white'
              }`}
            >
              Grid
            </button>
          </div>

          <button
            onClick={() => setShowUploadModal(true)}
            className="min-h-[34px] px-3 py-1 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-extrabold flex items-center gap-1 shadow-md shadow-blue-600/25 active:scale-95 transition-all"
          >
            <Upload className="w-3 h-3" />
            <span>Post</span>
          </button>
        </div>
      </div>

      {/* Divided Sections Switcher: 9:16 Shorts (<=2m) vs 16:9 Videos (<=3m) */}
      <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-[#12171F] border border-slate-200/80 dark:border-white/10">
        <button
          onClick={() => {
            haptics.light();
            setActiveVideoSection('short');
            setActiveVideoIndex(0);
          }}
          className={`min-h-[42px] px-3 py-1.5 rounded-xl text-left transition-all flex items-center justify-between ${
            activeVideoSection === 'short'
              ? 'bg-[#00E676] text-black shadow-sm font-black'
              : 'text-slate-600 dark:text-white/70 hover:bg-white/60 dark:hover:bg-white/5'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Clapperboard className="w-4 h-4 shrink-0" />
            <div className="truncate">
              <div className="text-[11px] font-extrabold leading-tight">9:16 Shorts</div>
              <div className={`text-[9px] leading-tight ${activeVideoSection === 'short' ? 'text-black/75' : 'text-slate-400 dark:text-white/45'}`}>
                Max 2 min reel
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono tabular-nums font-black">{shortsTotalCount}</span>
        </button>

        <button
          onClick={() => {
            haptics.light();
            setActiveVideoSection('video');
            setActiveVideoIndex(0);
          }}
          className={`min-h-[42px] px-3 py-1.5 rounded-xl text-left transition-all flex items-center justify-between ${
            activeVideoSection === 'video'
              ? 'bg-blue-600 text-white shadow-sm font-black'
              : 'text-slate-600 dark:text-white/70 hover:bg-white/60 dark:hover:bg-white/5'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Film className="w-4 h-4 shrink-0" />
            <div className="truncate">
              <div className="text-[11px] font-extrabold leading-tight">16:9 Videos</div>
              <div className={`text-[9px] leading-tight ${activeVideoSection === 'video' ? 'text-white/80' : 'text-slate-400 dark:text-white/45'}`}>
                Max 3 min video
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono tabular-nums font-black">{fullVideosTotalCount}</span>
        </button>
      </div>

      {/* Trending Hashtags Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {TRENDING_TAGS.map(tag => (
          <button
            key={tag}
            onClick={() => {
              haptics.light();
              setSelectedHashtag(tag);
              setActiveVideoIndex(0);
            }}
            className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
              selectedHashtag === tag
                ? 'bg-[#00E676] text-black shadow-sm'
                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/10'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Search & Club Tag Filter Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-slate-100 dark:bg-white/5 px-3 py-1.5 rounded-full text-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search match highlights, skills or tags..."
            className="flex-1 bg-transparent border-none text-xs text-slate-900 dark:text-white focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-white">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Club Tag Selector */}
        <select
          value={selectedClubFilter}
          onChange={e => setSelectedClubFilter(e.target.value)}
          className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-2.5 py-1.5 rounded-full text-[11px] font-semibold text-slate-700 dark:text-white focus:outline-none"
        >
          <option value="all">All Clubs</option>
          {POPULAR_TOP_5_CLUBS.map(club => (
            <option key={club.id} value={club.name} className="dark:bg-[#161b22]">
              {club.name}
            </option>
          ))}
        </select>
      </div>

      {/* -------------------------------------------------------------
          MODE 1: FOR YOU (Vertical Swipeable PitchReels Player)
      -------------------------------------------------------------- */}
      {viewMode === 'foryou' && (
        <div className="space-y-3">
          {filteredVideos.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#161b22] border border-slate-200/80 dark:border-white/10 p-8 text-center space-y-3 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto text-xl">
                📹
              </div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                No videos match this filter - Upload your skill
              </h3>
              <p className="text-xs text-slate-500 dark:text-white/50 max-w-sm mx-auto">
                Capture your match highlights, freekicks, or 9:16 skills to share with football fans.
              </p>
              <div className="flex items-center justify-center gap-2">
                {selectedHashtag !== 'All' && (
                  <button
                    onClick={() => setSelectedHashtag('All')}
                    className="px-3 py-2 rounded-full bg-slate-100 dark:bg-white/10 text-xs font-bold text-slate-700 dark:text-white"
                  >
                    Clear Tag Filter
                  </button>
                )}
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md shadow-blue-600/30 transition-all"
                >
                  Upload Video
                </button>
              </div>
            </div>
          ) : (
            currentVideo && (
              <div className="space-y-3">
                {/* Just Uploaded Live Showcase Bar */}
                {latestUploadedVideoId === currentVideo.id && (
                  <div className="p-3 rounded-2xl bg-gradient-to-r from-[#00E676]/15 via-emerald-500/10 to-blue-500/10 border border-[#00E676]/40 flex items-center justify-between gap-2 animate-in fade-in">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-[#00E676]">
                        <span className="w-2 h-2 rounded-full bg-[#00E676] animate-pulse" />
                        <span>Just Uploaded · Streaming Live</span>
                      </div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate mt-0.5">
                        {currentVideo.title} · {activeVideoSection === 'video' ? '16:9 HD' : '9:16 Short'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleShareReel(currentVideo)}
                        className="px-2.5 py-1.5 rounded-xl bg-[#00E676] text-black text-[10px] font-black flex items-center gap-1 hover:bg-emerald-400 active:scale-95 transition-all"
                      >
                        <Smartphone className="w-3 h-3" />
                        <span>Share</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDedicatedVideo(currentVideo)}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-900 dark:bg-white/10 text-white text-[10px] font-bold hover:opacity-90"
                      >
                        Full
                      </button>
                      <button
                        type="button"
                        onClick={() => setLatestUploadedVideoId(null)}
                        className="p-1.5 rounded-lg text-slate-500 dark:text-white/60 hover:text-slate-900 dark:hover:text-white"
                        title="Dismiss showcase"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                <div
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  onDoubleClick={() => handleDoubleTap(currentVideo.id)}
                  className={`relative w-full ${
                    activeVideoSection === 'video'
                      ? 'aspect-video'
                      : 'aspect-[9/16] max-h-[68vh]'
                  } rounded-3xl overflow-hidden bg-black shadow-2xl border border-white/10 select-none group`}
                >
                  {/* Video Player with Key, Real Poster Frame & Aspect-Safe Rendering */}
                  <video
                    key={currentVideo.id}
                    ref={videoRef}
                    src={currentVideo.videoUrl}
                    poster={currentVideo.thumbnailUrl || undefined}
                    autoPlay={!dataSavingMode}
                    preload={dataSavingMode ? 'metadata' : 'auto'}
                    loop={isLooping && !autoAdvanceReels}
                    muted={isMuted}
                    playsInline
                    onWaiting={() => setVideoBuffering(true)}
                    onCanPlay={() => {
                      setVideoBuffering(false);
                      setVideoError(false);
                    }}
                    onPlaying={() => {
                      setVideoBuffering(false);
                      setVideoError(false);
                    }}
                    onError={() => {
                      setVideoBuffering(false);
                      setVideoError(true);
                    }}
                    onLoadedMetadata={(e) => {
                      const d = e.currentTarget.duration;
                      if (Number.isFinite(d) && d > 0) setReelDuration(d);
                    }}
                    onTimeUpdate={(e) => {
                      setReelProgress(e.currentTarget.currentTime);
                      const d = e.currentTarget.duration;
                      if (Number.isFinite(d) && d > 0) setReelDuration(d);
                    }}
                    onEnded={() => {
                      if (autoAdvanceReels && activeVideoIndex < filteredVideos.length - 1) {
                        setActiveVideoIndex(activeVideoIndex + 1);
                      }
                    }}
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`w-full h-full ${
                      fitMode === 'cover' && activeVideoSection === 'short' ? 'object-cover' : 'object-contain'
                    } cursor-pointer bg-black`}
                  />

                  {/* Buffering Indicator */}
                  {videoBuffering && !videoError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/35 pointer-events-none z-20">
                      <div className="w-10 h-10 rounded-full border-3 border-[#00E676] border-t-transparent animate-spin" />
                    </div>
                  )}

                  {/* Stream Error Retry Overlay */}
                  {videoError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-black/80 text-white z-30 p-4 text-center">
                      <p className="text-xs font-bold text-white/85">Video stream interrupted or loading slowly</p>
                      <button
                        type="button"
                        onClick={() => {
                          setVideoError(false);
                          setVideoBuffering(true);
                          if (videoRef.current) {
                            videoRef.current.load();
                            videoRef.current.play().catch(() => {});
                          }
                        }}
                        className="px-4 py-2 rounded-full bg-[#00E676] text-black font-extrabold text-xs flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retry Video</span>
                      </button>
                    </div>
                  )}

                  {/* Paused Play Indicator */}
                  {!isPlaying && !videoError && (
                    <div
                      onClick={() => setIsPlaying(true)}
                      className="absolute inset-0 flex items-center justify-center bg-black/25 cursor-pointer z-20"
                    >
                      <div className="w-16 h-16 rounded-full bg-black/70 border border-white/20 flex items-center justify-center text-white backdrop-blur-md">
                        <Play className="w-7 h-7 fill-white ml-0.5" />
                      </div>
                    </div>
                  )}

                  {/* Heart or Emoji Burst Animation */}
                  {(heartBurst || reactionBurstEmoji) && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                      {reactionBurstEmoji ? (
                        <span className="text-6xl animate-ping duration-700">{reactionBurstEmoji}</span>
                      ) : (
                        <Heart className="w-20 h-20 text-rose-500 fill-rose-500 animate-ping duration-700" />
                      )}
                    </div>
                  )}

                  {/* Top Overlay Controls */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20 pointer-events-auto">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setIsMuted(!isMuted)}
                        className="p-2 rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black"
                        title={isMuted ? 'Unmute sound' : 'Mute sound'}
                      >
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-[#00E676]" />}
                      </button>
                      <button
                        onClick={cyclePlaybackRate}
                        className="px-2 py-1 rounded-full bg-black/60 text-white text-[10px] font-mono font-bold backdrop-blur-md hover:bg-black flex items-center gap-0.5"
                        title="Playback Speed"
                      >
                        <Gauge className="w-3 h-3 text-[#00E676]" />
                        <span>{playbackRate}x</span>
                      </button>
                      {activeVideoSection === 'short' && (
                        <button
                          onClick={() => setFitMode(prev => (prev === 'contain' ? 'cover' : 'contain'))}
                          className="px-2 py-1 rounded-full bg-black/60 text-white text-[10px] font-bold backdrop-blur-md hover:bg-black flex items-center gap-1"
                          title={fitMode === 'contain' ? 'Fill frame' : 'Fit full video'}
                        >
                          {fitMode === 'contain' ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3 text-[#00E676]" />}
                          <span>{fitMode === 'contain' ? 'Fit' : 'Fill'}</span>
                        </button>
                      )}
                      {activeVideoSection === 'short' && (
                        <>
                          <button
                            onClick={() => setAutoAdvanceReels(!autoAdvanceReels)}
                            className={`px-2 py-1 rounded-full backdrop-blur-md transition-colors text-[10px] font-bold flex items-center gap-0.5 ${
                              autoAdvanceReels ? 'bg-[#00E676]/25 text-[#00E676]' : 'bg-black/60 text-white/60'
                            }`}
                            title={autoAdvanceReels ? 'Auto-Next Reel ON' : 'Auto-Next Reel OFF'}
                          >
                            <SkipForward className="w-3 h-3" />
                            <span>Auto</span>
                          </button>
                          <button
                            onClick={() => {
                              setIsLooping(!isLooping);
                              if (!isLooping) setAutoAdvanceReels(false);
                            }}
                            className={`p-1.5 rounded-full backdrop-blur-md transition-colors ${
                              isLooping && !autoAdvanceReels ? 'bg-[#00E676]/25 text-[#00E676]' : 'bg-black/60 text-white/60'
                            }`}
                            title={isLooping && !autoAdvanceReels ? 'Loop ON' : 'Loop OFF'}
                          >
                            <Repeat className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handlePictureInPicture(videoRef.current)}
                        className="p-1.5 rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black"
                        title="Picture-in-Picture"
                      >
                        <PictureInPicture2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {currentVideo.sizeMb ? (
                        <span className="px-2 py-1 rounded-full bg-black/70 text-[10px] font-mono font-bold text-[#00E676] backdrop-blur-md">
                          {currentVideo.sizeMb} MB
                        </span>
                      ) : null}
                      <span className="px-2 py-1 rounded-full bg-black/60 text-[10px] font-bold text-white/90 backdrop-blur-md flex items-center gap-1">
                        <Eye className="w-3 h-3 text-[#00E676]" />
                        {currentVideo.views}
                      </span>
                      <span className="px-2 py-1 rounded-full bg-black/60 text-[10px] font-mono text-white/80">
                        {activeVideoIndex + 1}/{filteredVideos.length}
                      </span>
                    </div>
                  </div>

                  {/* Desktop Prev/Next Controls */}
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-20 pointer-events-auto opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      disabled={activeVideoIndex === 0}
                      onClick={() => setActiveVideoIndex(Math.max(0, activeVideoIndex - 1))}
                      className="p-2 rounded-full bg-black/60 text-white disabled:opacity-30 hover:bg-black/90 transition-all"
                      title="Previous video"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      disabled={activeVideoIndex >= filteredVideos.length - 1}
                      onClick={() => setActiveVideoIndex(Math.min(filteredVideos.length - 1, activeVideoIndex + 1))}
                      className="p-2 rounded-full bg-black/60 text-white disabled:opacity-30 hover:bg-black/90 transition-all"
                      title="Next video"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Vertical 9:16 Shorts Overlay Rail + Metadata */}
                  {activeVideoSection === 'short' && (
                    <>
                      {/* Right Vertical Action Rail */}
                      <div className="absolute right-3 bottom-16 flex flex-col items-center gap-3 z-20 pointer-events-auto">
                        <div className="relative">
                          <img
                            onClick={() => openCreatorProfile({
                              handle: currentVideo.creator?.handle || '@creator',
                              name: currentVideo.creator?.name || 'Pitch Creator',
                              avatar: currentVideo.creator?.avatar || '/assets/aistudio/IMG-20261106-WA6972_a4f2c4ba.jpg',
                            })}
                            src={currentVideo.creator?.avatar || '/assets/aistudio/IMG-20261106-WA6972_a4f2c4ba.jpg'}
                            alt={`${currentVideo.creator?.name || 'Pitch Creator'} football creator`}
                            loading="lazy"
                            decoding="async"
                            className="w-10 h-10 rounded-full object-cover border-2 border-white cursor-pointer shadow-lg hover:scale-105 transition-transform"
                            title={`View all posts and clips by ${currentVideo.creator?.name || 'Pitch Creator'}`}
                          />
                          {!isCreatorConnected(currentVideo.creator?.handle || '@creator') && (
                            <button
                              onClick={() => toggleConnectCreator(currentVideo.creator?.handle || '@creator', {
                                name: currentVideo.creator?.name || 'Pitch Creator',
                                avatar: currentVideo.creator?.avatar || '/assets/aistudio/IMG-20261106-WA6972_a4f2c4ba.jpg',
                              })}
                              className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#00E676] text-black flex items-center justify-center shadow font-bold"
                              title="Connect with creator"
                            >
                              <Plus className="w-3 h-3 stroke-[3]" />
                            </button>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            haptics.like();
                            toggleLikeVideo(currentVideo.id);
                            likeVideoOnServer(currentVideo.id, user.id);
                          }}
                          className="flex flex-col items-center gap-0.5 text-white"
                        >
                          <div className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md">
                            <Heart className={`w-5 h-5 ${currentVideo.isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                          </div>
                          <span className="text-[10px] font-extrabold">{currentVideo.likes}</span>
                        </button>

                        <button
                          onClick={() => setShowCommentsDrawer(true)}
                          className="flex flex-col items-center gap-0.5 text-white"
                        >
                          <div className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md">
                            <MessageCircle className="w-5 h-5" />
                          </div>
                          <span className="text-[10px] font-extrabold">{currentVideo.commentsCount || 0}</span>
                        </button>

                        <button
                          onClick={() => handleRemixClip(currentVideo)}
                          className="flex flex-col items-center gap-0.5 text-purple-300"
                          title="Remix or reply with your own clip"
                        >
                          <div className="w-10 h-10 rounded-full bg-black/50 text-purple-300 flex items-center justify-center backdrop-blur-md">
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <span className="text-[10px] font-extrabold">Remix</span>
                        </button>

                        <button
                          onClick={() => toggleSaveVideo(currentVideo.id)}
                          className="flex flex-col items-center gap-0.5 text-white"
                        >
                          <div className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md">
                            <Bookmark className={`w-5 h-5 ${currentVideo.isSaved ? 'fill-amber-400 text-amber-400' : ''}`} />
                          </div>
                          <span className="text-[10px] font-extrabold">Save</span>
                        </button>

                        <button
                          onClick={() => handleShareReel(currentVideo)}
                          className="flex flex-col items-center gap-0.5 text-white"
                        >
                          <div className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md">
                            <Share2 className="w-5 h-5" />
                          </div>
                          <span className="text-[10px] font-extrabold">{currentVideo.shares || 0}</span>
                        </button>
                      </div>

                      {/* Bottom Metadata, Quick Reactions Dock & Sound Ticker */}
                      <div className="absolute left-2.5 right-16 bottom-6 z-20 pointer-events-auto text-white space-y-1.5 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-2.5 rounded-2xl">
                        <div className="flex items-center gap-1 flex-wrap">
                          {(['🔥', '⚽', '👏', '😱', '❤️'] as const).map(emoji => {
                            const cnt = currentVideo.reactions?.[emoji] || 0;
                            const active = currentVideo.userReactions?.includes(emoji);
                            return (
                              <button
                                key={emoji}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEmojiReaction(currentVideo.id, emoji);
                                }}
                                className={`px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 backdrop-blur-md border transition-all active:scale-95 tabular-nums ${
                                  active
                                    ? 'bg-[#00E676]/25 border-[#00E676] text-[#00E676]'
                                    : 'bg-black/55 border-white/15 text-white hover:bg-black/75'
                                }`}
                              >
                                <span>{emoji}</span>
                                {cnt > 0 && <span className="font-mono text-[10px]">{cnt}</span>}
                              </button>
                            );
                          })}
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            onClick={() => openCreatorProfile({
                              handle: currentVideo.creator?.handle || '@creator',
                              name: currentVideo.creator?.name || 'Pitch Creator',
                              avatar: currentVideo.creator?.avatar || '/assets/aistudio/IMG-20261106-WA6972_a4f2c4ba.jpg',
                            })}
                            className="font-extrabold text-xs cursor-pointer hover:underline"
                          >
                            {currentVideo.creator?.handle || '@creator'}
                          </span>
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#00E676] fill-[#00E676]/20" />

                          {(currentVideo.creator?.handle || '@creator') !== user.handle && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleConnectCreator(currentVideo.creator?.handle || '@creator', {
                                  name: currentVideo.creator?.name || 'Pitch Creator',
                                  avatar: currentVideo.creator?.avatar || '/assets/aistudio/IMG-20261106-WA6972_a4f2c4ba.jpg',
                                });
                              }}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black transition-all flex items-center gap-0.5 ${
                                isCreatorConnected(currentVideo.creator?.handle || '@creator')
                                  ? 'bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/40'
                                  : 'bg-[#00E676] text-black hover:bg-emerald-400'
                              }`}
                            >
                              {isCreatorConnected(currentVideo.creator?.handle || '@creator') ? '✓ Connected' : '+ Connect'}
                            </button>
                          )}
                        </div>
                        <p
                          onClick={() => setDedicatedVideo(currentVideo)}
                          className="text-xs leading-snug line-clamp-2 cursor-pointer hover:underline text-white/95 font-medium"
                        >
                          {currentVideo.title}
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsMuted(!isMuted)}
                          className="flex items-center gap-1.5 text-[10px] text-white/85 hover:text-[#00E676] pt-0.5 tabular-nums"
                        >
                          <Music className="w-3 h-3 text-[#00E676]" />
                          <span>
                            {isMuted ? 'Tap for Original Match Sound' : 'Original Pitch Sound ON'} · {currentVideo.duration}
                          </span>
                        </button>
                      </div>
                    </>
                  )}

                  {/* Bottom Interactive Timeline Scrubber + Carousel Dots */}
                  <div className="absolute bottom-1.5 left-3 right-3 z-20 space-y-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="text-white hover:text-[#00E676]"
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                      >
                        {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={reelDuration || 30}
                        step={0.1}
                        value={Math.min(reelProgress, reelDuration || 30)}
                        onChange={(e) => {
                          const nextVal = Number(e.target.value);
                          setReelProgress(nextVal);
                          if (videoRef.current) videoRef.current.currentTime = nextVal;
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-[#00E676]"
                      />
                      <span className="text-[10px] font-mono text-white/85 tabular-nums">
                        {Math.floor(reelProgress / 60)}:{Math.floor(reelProgress % 60).toString().padStart(2, '0')} /{' '}
                        {Math.floor((reelDuration || 0) / 60)}:{Math.floor((reelDuration || 0) % 60).toString().padStart(2, '0')}
                      </span>
                      {activeVideoSection === 'video' && (
                        <button
                          type="button"
                          onClick={() => setDedicatedVideo(currentVideo)}
                          className="text-white hover:text-[#00E676]"
                          title="Open Full Player"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {activeVideoSection === 'short' && (
                      <div className="flex justify-center gap-1">
                        {filteredVideos.slice(0, 6).map((_, i) => (
                          <span
                            key={i}
                            onClick={() => setActiveVideoIndex(i)}
                            className={`h-1 rounded-full cursor-pointer transition-all ${
                              activeVideoIndex === i ? 'w-4 bg-[#00E676]' : 'w-1 bg-white/40'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Unobstructed Widescreen 16:9 Details, Reactions & Actions Below Video Frame */}
                {activeVideoSection === 'video' && (
                  <div className="p-3.5 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/10 shadow-sm space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <h3
                          onClick={() => setDedicatedVideo(currentVideo)}
                          className="font-display font-extrabold text-sm text-slate-900 dark:text-white leading-snug cursor-pointer hover:text-[#00E676]"
                        >
                          {currentVideo.title}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500 dark:text-white/60">
                          <button
                            type="button"
                            onClick={() => openCreatorProfile({
                              handle: currentVideo.creator?.handle || '@creator',
                              name: currentVideo.creator?.name || 'Pitch Creator',
                              avatar: currentVideo.creator?.avatar || '/assets/aistudio/IMG-20261106-WA6972_a4f2c4ba.jpg',
                            })}
                            className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-white/90 hover:text-[#00E676]"
                          >
                            <img
                              src={currentVideo.creator?.avatar || '/assets/aistudio/IMG-20261106-WA6972_a4f2c4ba.jpg'}
                              alt={currentVideo.creator?.name || 'Creator'}
                              className="w-5 h-5 rounded-full object-cover"
                            />
                            <span>{currentVideo.creator?.name || 'Pitch Creator'}</span>
                          </button>
                          <span>· {currentVideo.views} views</span>
                          <span>· {currentVideo.duration}</span>
                        </div>
                      </div>

                      {(currentVideo.creator?.handle || '@creator') !== user.handle && (
                        <button
                          type="button"
                          onClick={() => toggleConnectCreator(currentVideo.creator?.handle || '@creator', {
                            name: currentVideo.creator?.name || 'Pitch Creator',
                            avatar: currentVideo.creator?.avatar || '/assets/aistudio/IMG-20261106-WA6972_a4f2c4ba.jpg',
                          })}
                          className={`px-3 py-1.5 rounded-full text-[11px] font-black shrink-0 transition-all ${
                            isCreatorConnected(currentVideo.creator?.handle || '@creator')
                              ? 'bg-[#00E676]/20 text-emerald-700 dark:text-[#00E676]'
                              : 'bg-[#00E676] text-black hover:bg-emerald-400'
                          }`}
                        >
                          {isCreatorConnected(currentVideo.creator?.handle || '@creator') ? 'Connected' : '+ Connect'}
                        </button>
                      )}
                    </div>

                    {/* Emoji Reactions */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(['🔥', '⚽', '👏', '😱', '❤️'] as const).map(emoji => {
                        const cnt = currentVideo.reactions?.[emoji] || 0;
                        const active = currentVideo.userReactions?.includes(emoji);
                        return (
                          <button
                            key={emoji}
                            onClick={() => handleEmojiReaction(currentVideo.id, emoji)}
                            className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 border transition-all active:scale-95 tabular-nums ${
                              active
                                ? 'bg-[#00E676]/15 border-[#00E676] text-emerald-700 dark:text-[#00E676]'
                                : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/80'
                            }`}
                          >
                            <span>{emoji}</span>
                            {cnt > 0 && <span className="font-mono text-[10px]">{cnt}</span>}
                          </button>
                        );
                      })}
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
                      <button
                        onClick={() => {
                          haptics.like();
                          toggleLikeVideo(currentVideo.id);
                          likeVideoOnServer(currentVideo.id, user.id);
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border ${
                          currentVideo.isLiked
                            ? 'bg-rose-500/10 border-rose-500 text-rose-500'
                            : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-white'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${currentVideo.isLiked ? 'fill-rose-500' : ''}`} />
                        <span>{currentVideo.likes}</span>
                      </button>

                      <button
                        onClick={() => setShowCommentsDrawer(true)}
                        className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>{currentVideo.commentsCount || 0}</span>
                      </button>

                      <button
                        onClick={() => handleShareReel(currentVideo)}
                        className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 bg-[#00E676]/15 border border-[#00E676]/40 text-emerald-700 dark:text-[#00E676]"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Share ({currentVideo.shares || 0})</span>
                      </button>

                      <button
                        onClick={() => toggleSaveVideo(currentVideo.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border ${
                          currentVideo.isSaved
                            ? 'bg-amber-500/10 border-amber-500 text-amber-500'
                            : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-white'
                        }`}
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${currentVideo.isSaved ? 'fill-amber-500' : ''}`} />
                        <span>Save</span>
                      </button>

                      <button
                        onClick={() => setDedicatedVideo(currentVideo)}
                        className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 bg-blue-600 text-white ml-auto"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Full Player</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}

      {/* -------------------------------------------------------------
          MODE 2: TRENDING (Live Ranked by Server Views, Likes, Reactions & Shares)
      -------------------------------------------------------------- */}
      {viewMode === 'trending' && (
        <div className="space-y-2.5">
          {/* Trending Header Card */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-[#00E676]/10 to-blue-500/10 border border-amber-500/25 flex items-center justify-between gap-2 text-xs">
            <div className="space-y-0.5">
              <div className="font-display font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-500" />
                <span>Trending Now</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-white/65">
                Top fan-voted clips ranked by community engagement
              </p>
            </div>
          </div>

          {/* Trending Creator Spotlight */}
          {filteredVideos.length > 0 && (
            <div className="rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 p-3.5 space-y-2 shadow-sm">
              <div className="flex items-center justify-between text-xs font-extrabold text-slate-900 dark:text-white">
                <span className="flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  <span>Trending Creators Live</span>
                </span>
                <span className="text-[11px] text-emerald-700 dark:text-[#00E676] font-mono tabular-nums">{filteredVideos.length} active reels</span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                {Array.from(
                  filteredVideos.reduce((map, vid) => {
                    const key = vid.creator?.handle || '@creator';
                    const existing = map.get(key) || {
                      handle: key,
                      name: vid.creator?.name || 'Pitch Creator',
                      avatar: vid.creator?.avatar || '/assets/aistudio/IMG-20261106-WA6972_a4f2c4ba.jpg',
                      score: 0,
                      views: 0,
                    };
                    existing.score += getVideoEngagementScore(vid);
                    existing.views += vid.views || 0;
                    map.set(key, existing);
                    return map;
                  }, new Map<string, { handle: string; name: string; avatar: string; score: number; views: number }>()).values()
                )
                  .sort((a, b) => b.score - a.score)
                  .slice(0, 6)
                  .map((cr, idx) => (
                    <button
                      key={cr.handle}
                      onClick={() => openCreatorProfile({ handle: cr.handle, name: cr.name, avatar: cr.avatar })}
                      className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-amber-500/60 transition-all text-left"
                    >
                      <span className="text-[11px] font-black text-amber-600 dark:text-amber-400 tabular-nums">#{idx + 1}</span>
                      <img src={cr.avatar} alt={`${cr.name} football creator`} loading="lazy" decoding="async" className="w-6 h-6 rounded-full object-cover" />
                      <div className="text-[10px] leading-tight">
                        <div className="font-extrabold text-slate-900 dark:text-white truncate max-w-[90px]">
                          {cr.name}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-white/55 font-mono tabular-nums">
                          {cr.views} views
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {filteredVideos.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 p-8 text-center text-xs text-slate-500">
              No trending clips found for this filter yet.
            </div>
          ) : (
            filteredVideos.map((item, rankIdx) => {
              const reactionsTotal = item.reactions
                ? Object.values(item.reactions).reduce((a, b) => a + (Number(b) || 0), 0)
                : 0;
              return (
                <div
                  key={item.id}
                  onClick={() => setDedicatedVideo(item)}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm hover:border-[#00E676] transition-all cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 font-black text-xs flex items-center justify-center shrink-0 tabular-nums">
                    #{rankIdx + 1}
                  </div>
                  <div className="relative w-24 aspect-video rounded-xl overflow-hidden bg-black shrink-0">
                    {item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt={`${item.title} football match highlight`} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    ) : (
                      <video
                        src={`${item.videoUrl}#t=0.5`}
                        preload="metadata"
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    )}
                    <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/80 text-[9px] font-mono tabular-nums text-white">
                      {item.duration}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-white/55">
                      <span className="truncate">{item.creator?.name || 'Pitch Creator'}</span>
                      {item.sizeMb ? (
                        <span className="font-mono tabular-nums font-bold text-blue-600 dark:text-blue-400">
                          · {item.sizeMb} MB
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2.5 text-[11px] font-mono tabular-nums font-bold text-slate-600 dark:text-white/75">
                      <span>👁️ {item.views}</span>
                      <span>❤️ {item.likes}</span>
                      <span>🔥 {reactionsTotal}</span>
                      <span>🔗 {item.shares || 0}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* -------------------------------------------------------------
          MODE 3: EXPLORE (2-Column Football Video Grid)
      -------------------------------------------------------------- */}
      {viewMode === 'explore' && (
        <div className="space-y-3">
          {filteredVideos.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 p-8 text-center space-y-3 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto text-xl">
                📹
              </div>
              <h3 className="font-display font-extrabold text-slate-900 dark:text-white text-base">
                No videos yet - Upload your first skill
              </h3>
              <p className="text-xs text-slate-500 dark:text-white/55 max-w-sm mx-auto">
                Discover match tactics, skills, and highlights from global football creators.
              </p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="min-h-[44px] px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md shadow-blue-600/30 transition-all"
              >
                Upload Video
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {filteredVideos.map(item => (
                <div
                  key={item.id}
                  onClick={() => setDedicatedVideo(item)}
                  className="group cursor-pointer rounded-2xl overflow-hidden bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm hover:border-[#00E676] transition-all flex flex-col"
                >
                  <div className="relative aspect-video bg-black overflow-hidden">
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={`${item.title} football match highlight`}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <video
                        src={`${item.videoUrl}#t=0.5`}
                        preload="metadata"
                        muted
                        playsInline
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    )}
                    {item.sizeMb ? (
                      <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[9px] font-mono tabular-nums font-bold text-[#00E676]">
                        {item.sizeMb} MB
                      </span>
                    ) : null}
                    <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[9px] font-mono tabular-nums font-bold text-white">
                      {item.duration}
                    </span>
                  </div>

                  <div className="p-2.5 flex-1 flex flex-col justify-between space-y-1.5">
                    <h3 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-emerald-700 dark:group-hover:text-[#00E676] transition-colors">
                      {item.title}
                    </h3>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-white/55 pt-1 border-t border-slate-100 dark:border-white/5 tabular-nums">
                      <span className="truncate">{item.creator?.name || 'Pitch Creator'}</span>
                      <span>{item.views || 0}v · ❤️ {item.likes || 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------
          FLOATING ACTION BUTTON (FAB) FOR QUICK UPLOAD
      -------------------------------------------------------------- */}
      <button
        onClick={() => setShowUploadModal(true)}
        className="fixed bottom-24 right-4 z-40 sm:bottom-28 p-3.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-600/40 active:scale-95 transition-all flex items-center justify-center group"
        title="Upload Video"
      >
        <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300 stroke-[2.5]" />
      </button>

      {/* -------------------------------------------------------------
          3-STEP VIDEO UPLOAD MODAL (YouTube Level)
      -------------------------------------------------------------- */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#161b22] border border-slate-200 dark:border-white/10 p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2">
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-500 flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {uploadStep === 1 && 'Step 1: Select Video'}
                  {uploadStep === 2 && 'Step 2: Video Details'}
                  {uploadStep === 3 && 'Step 3: Uploading...'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadStep(1);
                  setVideoUploadStatus('idle');
                  setThumbUploadStatus('idle');
                  setUploadBackendUrl('');
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step 1: Select Video Drag & Drop Area */}
            {uploadStep === 1 && (
              <div className="space-y-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleVideoFileSelect}
                  accept="video/mp4,video/quicktime,video/*"
                  className="hidden"
                />
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors space-y-2.5 ${
                    isDragging
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-300 dark:border-white/20 hover:border-blue-500 bg-slate-50 dark:bg-white/5'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-blue-600/10 text-blue-500 flex items-center justify-center mx-auto">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-xs text-slate-800 dark:text-white">
                    Upload {activeVideoSection === 'video' ? '16:9 Video' : '9:16 Short'} to Backend
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-white/60 leading-relaxed">
                    9:16 Shorts: ≤ 2 min (120s) · 16:9 Videos: ≤ 3 min (180s). Auto-detected + MediaGuard Copyright Scan.
                  </p>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md shadow-blue-600/30 transition-all inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Add video to upload</span>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Backend Upload Sign Splash + Video Details */}
            {uploadStep === 2 && (
              <div className="space-y-3 text-xs">
                <MediaUploadSplash
                  status={videoUploadStatus}
                  mediaKind="video"
                  fileName={uploadFile?.name}
                  sizeMb={uploadFileSizeMb}
                  progress={uploadProgress}
                  errorMessage={uploadErrorMsg}
                  onDismissError={() => {
                    setVideoUploadStatus('idle');
                    setUploadErrorMsg(null);
                    setUploadCopyrightStatus(null);
                    setUploadStep(1);
                  }}
                />

                {uploadCopyrightStatus === 'BLOCKED' && (
                  <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-500 text-[11px] flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-extrabold">MediaGuard Copyright Block</div>
                      <p className="text-[10px] opacity-90">{uploadCopyrightReport?.reason || uploadErrorMsg}</p>
                    </div>
                  </div>
                )}

                {videoUploadStatus === 'uploaded' && uploadBackendUrl && (
                  <div className="space-y-1.5">
                    <div
                      className={`rounded-xl overflow-hidden ${
                        uploadVideoKind === 'video' ? 'aspect-video' : 'aspect-[9/16] max-h-44 mx-auto'
                      } bg-black border border-[#00E676]/40`}
                    >
                      <video
                        src={uploadBackendUrl}
                        poster={uploadThumbnail || undefined}
                        controls
                        playsInline
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px]">
                      <div className="flex items-center gap-1.5 font-mono font-bold text-[#00E676]">
                        <Film className="w-3.5 h-3.5" />
                        <span>UPLOADED</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono text-slate-600 dark:text-white/70">
                        <span>{uploadDurationSec}s</span>
                        {uploadResolution && <span>· {uploadResolution}</span>}
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold ${
                            uploadVideoKind === 'short'
                              ? 'bg-[#00E676]/20 text-emerald-700 dark:text-[#00E676]'
                              : 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          {uploadVideoKind === 'short' ? 'Auto: 9:16 Short' : 'Auto: 16:9 Video'}
                        </span>
                      </div>
                    </div>
                    {uploadCopyrightStatus && uploadCopyrightStatus !== 'BLOCKED' && (
                      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-[10px] text-emerald-700 dark:text-[#00E676]">
                        <span className="flex items-center gap-1.5 font-extrabold">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          MediaGuard Copyright: {uploadCopyrightStatus}
                        </span>
                        {uploadCopyrightReport?.sha256 && (
                          <span className="font-mono opacity-75">
                            SHA: {uploadCopyrightReport.sha256.slice(0, 8)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Title (required, max 100) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-slate-700 dark:text-white/80">Title (required)</span>
                    <span className="text-slate-400">{uploadTitle.length}/100</span>
                  </div>
                  <input
                    type="text"
                    maxLength={100}
                    value={uploadTitle}
                    onChange={e => setUploadTitle(e.target.value)}
                    placeholder="e.g. Bukayo Saka sublime curler vs Chelsea"
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Description & Hashtags */}
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-white/80">Description & Hashtags</span>
                  <textarea
                    rows={2}
                    value={uploadDesc}
                    onChange={e => setUploadDesc(e.target.value)}
                    placeholder="Match context, tactics, or skills breakdown #Arsenal #EPL"
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {['#PitchReels', '#Golazo', '#Skills', '#Matchday'].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setUploadDesc(prev => (prev ? `${prev} ${tag}` : tag))}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/70 hover:bg-slate-200"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional Custom Cover Image Upload to Backend */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-slate-700 dark:text-white/80">Cover Thumbnail (Optional)</span>
                    <span className="text-slate-400">
                      {thumbUploadStatus === 'uploading'
                        ? 'Uploading...'
                        : thumbUploadStatus === 'uploaded'
                        ? 'UPLOADED ✓'
                        : 'Auto video frame if empty'}
                    </span>
                  </div>

                  <input
                    type="file"
                    ref={customThumbInputRef}
                    onChange={handleCustomThumbnailSelect}
                    accept="image/*"
                    className="hidden"
                  />

                  <div className="flex items-center gap-2">
                    {uploadThumbnail && (
                      <img
                        src={uploadThumbnail}
                        alt="Football highlight cover thumbnail"
                        loading="lazy"
                        decoding="async"
                        className="w-20 aspect-video rounded-lg object-cover border border-[#00E676]"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => customThumbInputRef.current?.click()}
                      className="px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-white/20 flex items-center gap-1.5 text-slate-600 dark:text-white/70 hover:border-blue-500 hover:text-blue-500 transition-colors text-[11px] font-bold"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>{uploadThumbnail ? 'Change Cover Image' : 'Upload Cover Image'}</span>
                    </button>
                  </div>
                </div>

                {/* Club Tag */}
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-white/80">Club Tag</span>
                  <select
                    value={uploadClubTag}
                    onChange={e => setUploadClubTag(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="">No Club Tag</option>
                    {POPULAR_TOP_5_CLUBS.map(c => (
                      <option key={c.id} value={c.name} className="dark:bg-[#161b22]">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Privacy */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-white/80">Privacy</span>
                  <select
                    value={uploadPrivacy}
                    onChange={e => setUploadPrivacy(e.target.value as any)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 text-xs text-slate-800 dark:text-white"
                  >
                    <option value="public" className="dark:bg-[#161b22]">Public</option>
                    <option value="followers" className="dark:bg-[#161b22]">Followers Only</option>
                    <option value="private" className="dark:bg-[#161b22]">Private</option>
                  </select>
                </div>

                {/* Publish Video Button */}
                <button
                  onClick={handleStartUpload}
                  disabled={!uploadTitle.trim() || videoUploadStatus !== 'uploaded' || !uploadBackendUrl || isPublishing}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-extrabold text-xs shadow-md shadow-blue-600/30 transition-all"
                >
                  {videoUploadStatus === 'uploading'
                    ? `Uploading Video (${uploadProgress}%)...`
                    : 'Publish Video'}
                </button>
              </div>
            )}

            {/* Step 3: Publishing confirmation */}
            {uploadStep === 3 && (
              <div className="space-y-4 py-4 text-center">
                <div className="w-12 h-12 rounded-full border-4 border-[#00E676] border-t-transparent animate-spin mx-auto" />
                <div className="space-y-1">
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Publishing to PitchReels...
                  </h4>
                  <p className="text-xs text-[#00E676] font-bold">UPLOADED · Syncing real-time stream</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Comments Drawer for For You Mode */}
      {currentVideo && (
        <VideoCommentsDrawer
          video={currentVideo}
          isOpen={showCommentsDrawer}
          onClose={() => setShowCommentsDrawer(false)}
        />
      )}
    </div>
  );
};
