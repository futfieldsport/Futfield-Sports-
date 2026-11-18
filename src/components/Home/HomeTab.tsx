import React, { useState, useRef, useEffect } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Zap,
  Image as ImageIcon,
  Video as VideoIcon,
  MapPin,
  Smile,
  Shield,
  Globe,
  Lock,
  Users,
  MoreHorizontal,
  Edit3,
  Trash2,
  X,
  Send,
  CornerDownRight,
  Maximize2,
  Check,
  Flame,
  Search,
  Bell,
  CheckCircle2,
  TrendingUp,
  Radio,
  Download,
  Crown,
} from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { Post, PostComment } from '../../types/football';
import { POPULAR_TOP_5_CLUBS } from '../../data/top5Clubs';
import { ClubLogo } from '../Common/ClubLogo';
import {
  createPostOnServer,
  editPostOnServer,
  deletePostOnServer,
  likePostOnServer,
  bookmarkPostOnServer,
  addPostCommentOnServer,
  sharePostOnServer,
} from '../../services/supabaseClient';
import { haptics } from '../../utils/haptics';
import { useHaptics } from '../../hooks/useHaptics';
import {
  uploadFileToBackend,
  formatBytesToMb,
  inspectVideoMetadata,
  captureVideoPosterFrame,
} from '../../utils/mediaUpload';
import { buildShareUrl, downloadVideoFile } from '../../utils/share';
import { MediaUploadSplash, UploadSplashStatus } from '../Common/MediaUploadSplash';

const FEELINGS_LIST = [
  '⚽ Watching Matchday',
  '🔥 Hyped for Kickoff',
  '🎉 Celebrating a Goal',
  '🏆 Championship Vibes',
  '😤 Heated Derby Rivalry',
  '👀 Scouting New Signings',
];

export const HomeTab: React.FC = () => {
  const {
    posts,
    videos,
    matches,
    openMatchRoom,
    user,
    addPost,
    toggleLikePost,
    reactToPost,
    toggleSavePost,
    addFanPoints,
    addNotification,
    setActiveTab,
    navigateToProfile,
    unreadNotificationsCount,
    setNotificationsModalOpen,
    setSearchModalOpen,
    isCreatorConnected,
    toggleConnectCreator,
    openCreatorProfile,
    refreshMediaAndAnalytics,
    openShareSheet,
    openVideoInReels,
    targetPostId,
    setTargetPostId,
    setPricingModalOpen,
  } = useFootball();

  const isProUser = Boolean(
    user.isPro || user.membershipTier === 'pro' || user.membershipTier === 'vip'
  );

  const { triggerMessage, triggerSuccess, triggerWarning } = useHaptics();

  const [activeFilter, setActiveFilter] = useState<'foryou' | 'following' | 'trending'>('foryou');
  const [hashtagFilter, setHashtagFilter] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'followers' | 'private'>('public');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [mediaThumbnailUrl, setMediaThumbnailUrl] = useState<string | null>(null);
  const [mediaVideoKind, setMediaVideoKind] = useState<'short' | 'video' | null>(null);
  const [mediaAspectRatio, setMediaAspectRatio] = useState<'9:16' | '16:9' | null>(null);
  const [mediaDurationSec, setMediaDurationSec] = useState<number>(0);
  const [mediaSizeBytes, setMediaSizeBytes] = useState<number>(0);
  const [mediaSizeMb, setMediaSizeMb] = useState<number>(0);
  const [location, setLocation] = useState<string>('');
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [clubTag, setClubTag] = useState<string>('');
  const [showClubSelector, setShowClubSelector] = useState(false);
  const [feeling, setFeeling] = useState<string>('');
  const [showFeelings, setShowFeelings] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active comment & reply state
  const [expandedCommentsPostId, setExpandedCommentsPostId] = useState<string | null>(null);
  const [expandedAllComments, setExpandedAllComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [replyTarget, setReplyTarget] = useState<{ postId: string; parentId: string; authorName: string } | null>(null);

  // Like animation trigger
  const [animatingLikeId, setAnimatingLikeId] = useState<string | null>(null);

  // Post Actions Menu
  const [activeMenuPostId, setActiveMenuPostId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editContent, setEditContent] = useState('');

  // Fullscreen Image Viewer
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // Share & download feedback
  const [shareFeedbackId, setShareFeedbackId] = useState<string | null>(null);
  const [downloadingPostId, setDownloadingPostId] = useState<string | null>(null);

  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<UploadSplashStatus>('idle');
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);
  const isUploadingMedia = uploadStatus === 'uploading';

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const onFocusComposer = () => {
      textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => textareaRef.current?.focus(), 120);
    };
    window.addEventListener('futfield:focus-composer', onFocusComposer);
    return () => window.removeEventListener('futfield:focus-composer', onFocusComposer);
  }, []);

  useEffect(() => {
    if (!fullscreenImage && !editingPost) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFullscreenImage(null);
        setEditingPost(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullscreenImage, editingPost]);

  useEffect(() => {
    if (!targetPostId) return;
    const el = document.getElementById(`post-${targetPostId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const timer = setTimeout(() => setTargetPostId(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [targetPostId, posts.length, setTargetPostId]);

  const handleContentInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  };

  // Handle Image Upload directly to Backend (No frontend blob URLs; shows Uploading -> UPLOADED splash)
  const handleSelectImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const exactBytes = file.size;
    const exactMb = formatBytesToMb(exactBytes);
    setMediaSizeBytes(exactBytes);
    setMediaSizeMb(exactMb);
    setUploadFileName(file.name);
    setMediaType('image');
    setMediaUrl(null);
    setUploadErrorMessage(null);
    setUploadStatus('uploading');
    setUploadProgress(10);
    haptics.light();

    const res = await uploadFileToBackend(
      file,
      'post-images',
      file.name,
      (pct) => setUploadProgress(pct),
      user.id
    );

    if (res.success && res.url) {
      setMediaUrl(res.url);
      if (res.sizeBytes) setMediaSizeBytes(res.sizeBytes);
      if (res.sizeMb) setMediaSizeMb(res.sizeMb);
      setUploadProgress(100);
      setUploadStatus('uploaded');
      haptics.success();
      refreshMediaAndAnalytics().catch(() => {});
    } else {
      setUploadStatus('error');
      setUploadErrorMessage(res.error || 'Image upload failed');
    }
  };

  // Handle Video Upload directly to Backend (auto-detects 9:16 Short <=2m vs 16:9 Video <=3m + runs Copyright Guard)
  const handleSelectVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const exactBytes = file.size;
    const exactMb = formatBytesToMb(exactBytes);
    setMediaSizeBytes(exactBytes);
    setMediaSizeMb(exactMb);
    setUploadFileName(file.name);
    setMediaType('video');
    setMediaUrl(null);
    setMediaThumbnailUrl(null);
    setMediaVideoKind(null);
    setMediaAspectRatio(null);
    setMediaDurationSec(0);
    setUploadErrorMessage(null);
    setUploadStatus('uploading');
    setUploadProgress(5);
    haptics.light();

    const meta = await inspectVideoMetadata(file);
    if (meta.validationError || meta.videoKind === 'unsupported') {
      triggerWarning();
      setUploadStatus('error');
      setUploadProgress(0);
      setMediaType(null);
      setUploadErrorMessage(
        meta.validationError ||
          'Only 9:16 Shorts (≤ 2 min) or 16:9 Football Videos (≤ 3 min) are permitted.'
      );
      return;
    }

    const detectedRatio: '9:16' | '16:9' = meta.detectedAspectRatio === '16:9' ? '16:9' : '9:16';
    setMediaVideoKind(meta.videoKind);
    setMediaAspectRatio(detectedRatio);
    setMediaDurationSec(meta.duration || 0);
    setUploadProgress(15);

    const [res, posterBlob] = await Promise.all([
      uploadFileToBackend(
        file,
        'post-videos',
        file.name,
        (pct) => setUploadProgress(pct),
        user.id,
        {
          durationSeconds: meta.duration,
          width: meta.width,
          height: meta.height,
          videoKind: meta.videoKind,
          aspectRatio: detectedRatio,
          title: content.trim().slice(0, 60) || file.name,
        }
      ),
      captureVideoPosterFrame(file).catch(() => null),
    ]);

    if (posterBlob) {
      const thumbRes = await uploadFileToBackend(
        posterBlob,
        'video-thumbnails',
        `${file.name.replace(/\.[^.]+$/, '')}-thumb.jpg`,
        undefined,
        user.id
      ).catch(() => null);
      if (thumbRes?.success && thumbRes.url) {
        setMediaThumbnailUrl(thumbRes.url);
      }
    }

    if (res.success && res.url) {
      setMediaUrl(res.url);
      if (res.sizeBytes) setMediaSizeBytes(res.sizeBytes);
      if (res.sizeMb) setMediaSizeMb(res.sizeMb);
      if (res.videoKind) setMediaVideoKind(res.videoKind);
      if (res.aspectRatio) setMediaAspectRatio(res.aspectRatio);
      setUploadProgress(100);
      setUploadStatus('uploaded');
      triggerSuccess();
      refreshMediaAndAnalytics().catch(() => {});
    } else {
      triggerWarning();
      setMediaType(null);
      setUploadStatus('error');
      setUploadErrorMessage(res.error || 'Video upload blocked or failed');
    }
  };

  // Submit New Post (only allows backend-hosted mediaUrl once UPLOADED)
  const handleCreatePost = async () => {
    if ((!content.trim() && !mediaUrl) || isUploadingMedia) return;

    setIsSubmitting(true);
    triggerSuccess();
    const tags = Array.from(content.matchAll(/#([a-zA-Z0-9_]+)/g)).map(m => `#${m[1]}`);

    const newPostData = {
      content: content.trim(),
      mediaUrl: mediaUrl || undefined,
      mediaType: mediaType || undefined,
      imageUrl: mediaType === 'image' ? (mediaUrl || undefined) : undefined,
      videoUrl: mediaType === 'video' ? (mediaUrl || undefined) : undefined,
      thumbnailUrl: mediaType === 'video' ? (mediaThumbnailUrl || undefined) : undefined,
      videoKind: mediaType === 'video' ? (mediaVideoKind || undefined) : undefined,
      aspectRatio: mediaType === 'video' ? (mediaAspectRatio || undefined) : undefined,
      durationSeconds: mediaType === 'video' && mediaDurationSec ? mediaDurationSec : undefined,
      mediaSizeBytes: mediaSizeBytes || undefined,
      mediaSizeMb: mediaSizeMb || undefined,
      location: location.trim() || undefined,
      clubTag: clubTag || undefined,
      feeling: feeling || undefined,
      privacy,
      tags: tags.length > 0 ? tags : ['#FUTFIELD', '#PitchFeed'],
      category: activeFilter,
    };

    addPost(newPostData);
    addFanPoints(10, 'Created football pitch post');
    addNotification({
      title: 'Post Published Live!',
      body: 'Your football post is now visible across the real-time feed.',
      type: 'system',
    });

    // Reset composer
    setContent('');
    setMediaUrl(null);
    setMediaType(null);
    setMediaThumbnailUrl(null);
    setMediaVideoKind(null);
    setMediaAspectRatio(null);
    setMediaDurationSec(0);
    setMediaSizeBytes(0);
    setMediaSizeMb(0);
    setUploadStatus('idle');
    setUploadFileName('');
    setUploadErrorMessage(null);
    setUploadProgress(0);
    setLocation('');
    setShowLocationInput(false);
    setClubTag('');
    setShowClubSelector(false);
    setFeeling('');
    setShowFeelings(false);
    setIsSubmitting(false);
  };

  // Like Post with animation & tactile haptic bump
  const handleLike = async (postId: string) => {
    haptics.like();
    setAnimatingLikeId(postId);
    setTimeout(() => setAnimatingLikeId(null), 600);
    toggleLikePost(postId);
    await likePostOnServer(postId, user.id);
  };

  // Bookmark Post with haptic feedback
  const handleBookmark = async (postId: string) => {
    haptics.medium();
    toggleSavePost(postId);
    await bookmarkPostOnServer(postId, user.id);
    addNotification({
      title: 'Post Bookmarked',
      body: 'Saved to your football library.',
      type: 'system',
    });
  };

  // Share Post directly to user's phone or feed
  const handleShare = async (post: Post) => {
    setShareFeedbackId(post.id);
    sharePostOnServer(post.id).catch(() => {});
    openShareSheet({
      kind: 'post',
      targetId: post.id,
      title: `FUTFIELD Post by ${post.author?.name || 'Supporter'}`,
      text: post.content || 'Check out this matchday post on FUTFIELD!',
      url: buildShareUrl(`/?post=${encodeURIComponent(post.id)}`),
      previewImage: post.thumbnailUrl || post.imageUrl || post.author?.avatar,
      videoUrl: post.videoUrl || (post.mediaType === 'video' ? post.mediaUrl : undefined),
    });
    setTimeout(() => setShareFeedbackId(null), 2000);
  };

  const handleDownloadPostVideo = async (post: Post) => {
    if (!isProUser) {
      haptics.light();
      addNotification({
        title: 'Pro Users Only',
        body: 'Upgrade to Futfield Pro to download videos directly to your device.',
        type: 'system',
      });
      setPricingModalOpen(true);
      return;
    }
    const src = post.videoUrl || post.mediaUrl;
    if (!src || downloadingPostId === post.id) return;
    haptics.light();
    setDownloadingPostId(post.id);
    const result = await downloadVideoFile({
      title: `futfield_${post.author?.name || 'clip'}_${post.id.slice(-6)}`,
      videoUrl: src,
    });
    setDownloadingPostId(null);
    if (result.success) {
      haptics.success();
      addNotification({
        title: 'Video Saved to Device',
        body: `Downloaded "${result.filename}".`,
        type: 'system',
      });
    } else {
      addNotification({
        title: 'Download Failed',
        body: result.error || 'Could not download this video.',
        type: 'system',
      });
    }
  };

  // Add Comment or Reply
  const handleAddComment = async (postId: string) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;

    const parentId = replyTarget?.postId === postId ? replyTarget.parentId : undefined;
    const author = {
      name: user.name,
      handle: user.handle,
      avatar: user.avatar,
      clubBadge: user.favoriteClubCrest,
    };

    const res = await addPostCommentOnServer(postId, author, text, parentId);
    if (res.success && res.comment) {
      triggerMessage();
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
      setReplyTarget(null);
      addFanPoints(5, 'Commented on football take');
      addNotification({
        title: parentId ? 'Reply Sent!' : 'Comment Published!',
        body: 'Your match insight was added to the discussion.',
        type: 'comment',
      });
    }
  };

  // Save Edit Post
  const handleSaveEdit = async () => {
    if (!editingPost || !editContent.trim()) return;
    await editPostOnServer(editingPost.id, editContent.trim());
    editingPost.content = editContent.trim();
    editingPost.isEdited = true;
    setEditingPost(null);
    setEditContent('');
    addNotification({
      title: 'Post Updated',
      body: 'Your edits were saved successfully.',
      type: 'system',
    });
  };

  const [confirmDeletePostId, setConfirmDeletePostId] = useState<string | null>(null);

  // Delete Post cleanly via in-app modal confirmation (zero browser confirm())
  const handleDeletePost = (postId: string) => {
    setConfirmDeletePostId(postId);
    setActiveMenuPostId(null);
  };

  const executeDeletePost = async () => {
    if (!confirmDeletePostId) return;
    await deletePostOnServer(confirmDeletePostId);
    setConfirmDeletePostId(null);
    addNotification({
      title: 'Post Deleted',
      body: 'The post was removed from your feed.',
      type: 'system',
    });
  };

  const getPostEngagementScore = (p: Post) => {
    const reactionsSum = Object.values(p.reactions || {}).reduce((acc, v) => acc + (Number(v) || 0), 0);
    return (p.likes || 0) + reactionsSum * 2 + (p.commentsCount || 0) * 2 + (p.shares || 0) * 3 + (p.reposts || 0) * 2;
  };

  const filteredPosts = posts.filter(p => {
    if (!p) return false;
    if (hashtagFilter) {
      const matchTag = p.tags?.some(t => t.toLowerCase() === hashtagFilter.toLowerCase());
      const matchContent = (p.content || '').toLowerCase().includes(hashtagFilter.toLowerCase());
      const matchClub = p.clubTag?.toLowerCase() === hashtagFilter.toLowerCase();
      if (!matchTag && !matchContent && !matchClub) return false;
    }
    if (activeFilter === 'foryou' || activeFilter === 'trending') return true;
    return p.category === activeFilter || isCreatorConnected(p.author?.handle || '@fan');
  });

  // Trending sorts by real engagement; For You/Following prioritize connected creators
  const prioritizedFilteredPosts = [...filteredPosts].sort((a, b) => {
    if (activeFilter === 'trending') {
      return getPostEngagementScore(b) - getPostEngagementScore(a);
    }
    const aConnected = isCreatorConnected(a.author?.handle || '@fan') ? 1 : 0;
    const bConnected = isCreatorConnected(b.author?.handle || '@fan') ? 1 : 0;
    return bConnected - aConnected;
  });

  // Real-time Trending Hashtags extracted dynamically from live posts & videos
  const trendingHashtags = React.useMemo(() => {
    const counts: Record<string, { tag: string; score: number; count: number }> = {};
    posts.forEach(p => {
      const weight = 1 + getPostEngagementScore(p);
      (p.tags || []).forEach(raw => {
        const tag = raw.startsWith('#') ? raw : `#${raw}`;
        const key = tag.toLowerCase();
        if (!counts[key]) counts[key] = { tag, score: 0, count: 0 };
        counts[key].score += weight;
        counts[key].count += 1;
      });
    });
    videos.forEach(v => {
      const weight = 1 + (v.views || 0) + (v.likes || 0) * 2;
      (v.hashtags || []).forEach(raw => {
        const tag = raw.startsWith('#') ? raw : `#${raw}`;
        const key = tag.toLowerCase();
        if (!counts[key]) counts[key] = { tag, score: 0, count: 0 };
        counts[key].score += weight;
        counts[key].count += 1;
      });
    });
    return Object.values(counts)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [posts, videos]);

  // Live Trending Match Rooms sorted by live events & score action
  const trendingMatches = React.useMemo(() => {
    return [...matches]
      .sort((a, b) => {
        const scoreA = (a.status === 'LIVE' ? 10 : 0) + (a.events?.length || 0) * 2 + (a.activeFansCount || 0);
        const scoreB = (b.status === 'LIVE' ? 10 : 0) + (b.events?.length || 0) * 2 + (b.activeFansCount || 0);
        return scoreB - scoreA;
      })
      .slice(0, 4);
  }, [matches]);

  return (
    <div className="pb-28 max-w-2xl mx-auto px-3 sm:px-4 pt-3 space-y-4">
      {/* Top Header Row */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Football Fan Feed
          </h1>
          <p className="text-xs text-slate-500 dark:text-white/55">
            Live matchday takes, banter &amp; club news
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSearchModalOpen(true)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 dark:text-white/80 hover:bg-slate-200/60 dark:hover:bg-white/10 rounded-full transition-colors"
            title="Search football posts"
          >
            <Search className="w-4.5 h-4.5" />
          </button>
          <div className="relative">
            <button
              onClick={() => setNotificationsModalOpen(true)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 dark:text-white/80 hover:bg-slate-200/60 dark:hover:bg-white/10 rounded-full transition-colors"
              title="Notifications"
            >
              <Bell className="w-4.5 h-4.5" />
            </button>
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#00E676] ring-2 ring-white dark:ring-[#090D12]" />
            )}
          </div>
        </div>
      </div>

      {/* Segmented Filter Chips & Active Tag Filter */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {(['foryou', 'following', 'trending'] as const).map(tab => {
            const labels = { foryou: 'For You', following: 'Following', trending: '🔥 Trending' };
            const isActive = activeFilter === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={`min-h-[38px] px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  isActive
                    ? tab === 'trending'
                      ? 'bg-amber-400 text-black shadow-sm font-extrabold'
                      : 'bg-slate-900 dark:bg-white text-white dark:text-black shadow-sm'
                    : 'bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/10 text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {hashtagFilter && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-[#00E676] text-xs font-bold">
            <span>Filter: {hashtagFilter}</span>
            <button
              onClick={() => setHashtagFilter(null)}
              className="hover:opacity-75 text-xs font-extrabold ml-0.5"
              aria-label="Clear tag filter"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Live Trending Pulse Bar (Trending Hashtags + Hot Match Rooms) */}
      <div className="rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 p-3.5 space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-500" />
            <span className="font-display text-xs font-extrabold tracking-tight text-slate-900 dark:text-white">
              Trending Pitch Radar
            </span>
            <span className="text-[10px] font-bold text-emerald-700 dark:text-[#00E676] uppercase tracking-wider">
              · Live
            </span>
          </div>
          <button
            onClick={() => setActiveTab('videos')}
            className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Trending Reels</span>
          </button>
        </div>

        {/* Dynamic Trending Hashtags */}
        {trendingHashtags.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {trendingHashtags.map(item => {
              const isSelected = hashtagFilter?.toLowerCase() === item.tag.toLowerCase();
              return (
                <button
                  key={item.tag}
                  onClick={() => setHashtagFilter(isSelected ? null : item.tag)}
                  className={`min-h-[32px] px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap border transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#00E676] text-black border-[#00E676]'
                      : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/80 hover:border-amber-500/50'
                  }`}
                >
                  <span>{item.tag}</span>
                  <span className="opacity-65 font-mono tabular-nums text-[10px]">{item.count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Hot Match Rooms Strip */}
        {trendingMatches.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-0.5">
            {trendingMatches.map(m => (
              <button
                key={m.id}
                onClick={() => openMatchRoom(m)}
                className="shrink-0 px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/30 border border-slate-200/90 dark:border-white/10 hover:border-[#00E676]/60 transition-all text-left flex items-center gap-2"
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.status === 'LIVE' ? 'bg-rose-500' : 'bg-slate-400'}`} />
                <div className="text-[11px] leading-tight">
                  <div className="font-extrabold text-slate-900 dark:text-white tabular-nums">
                    {m.homeTeam.shortName} {m.homeTeam.score}-{m.awayTeam.score} {m.awayTeam.shortName}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-white/60 flex items-center gap-1 mt-0.5">
                    <Radio className="w-2.5 h-2.5 text-emerald-600 dark:text-[#00E676]" />
                    <span>{m.status === 'LIVE' ? `${m.minute}'` : m.status} · Join Chat</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Post Composer Card */}
      <div className="rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 p-4 shadow-sm space-y-3">
        <div className="flex items-start gap-3">
          <img
            src={user.avatar}
            alt={user.name}
            onClick={() => navigateToProfile()}
            className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-100 dark:ring-white/10 shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
            title="View your profile"
          />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900 dark:text-white">
                {user.name}
              </span>
              {/* Privacy Selector */}
              <div className="flex items-center gap-1 text-[11px] bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-full text-slate-600 dark:text-white/70">
                {privacy === 'public' && <Globe className="w-3 h-3 text-emerald-500" />}
                {privacy === 'followers' && <Users className="w-3 h-3 text-blue-500" />}
                {privacy === 'private' && <Lock className="w-3 h-3 text-amber-500" />}
                <select
                  value={privacy}
                  onChange={e => setPrivacy(e.target.value as any)}
                  className="bg-transparent border-none text-[11px] font-semibold focus:outline-none cursor-pointer text-slate-700 dark:text-white/80"
                >
                  <option value="public" className="dark:bg-[#161b22]">Public</option>
                  <option value="followers" className="dark:bg-[#161b22]">Followers</option>
                  <option value="private" className="dark:bg-[#161b22]">Private</option>
                </select>
              </div>
            </div>

            {/* Auto-Expanding Multiline Input */}
            <textarea
              ref={textareaRef}
              rows={2}
              value={content}
              onChange={handleContentInput}
              placeholder="What is happening on the pitch?"
              className="w-full bg-transparent resize-none text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus:outline-none leading-relaxed min-h-[48px]"
            />

            {/* Tags / Badges Preview */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {location && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-semibold">
                  <MapPin className="w-2.5 h-2.5" />
                  {location}
                  <button onClick={() => setLocation('')} className="hover:opacity-75">×</button>
                </span>
              )}
              {clubTag && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                  ⚽ {clubTag}
                  <button onClick={() => setClubTag('')} className="hover:opacity-75">×</button>
                </span>
              )}
              {feeling && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-semibold">
                  {feeling}
                  <button onClick={() => setFeeling('')} className="hover:opacity-75">×</button>
                </span>
              )}
            </div>

            {/* Backend Media Upload Sign Splash & Real-Time Media Preview */}
            {uploadStatus !== 'idle' && (
              <div className="space-y-2 mt-2">
                <MediaUploadSplash
                  status={uploadStatus}
                  mediaKind={mediaType === 'video' ? 'video' : 'image'}
                  fileName={uploadFileName}
                  sizeMb={mediaSizeMb}
                  progress={uploadProgress}
                  errorMessage={uploadErrorMessage}
                  onDismissError={() => {
                    setUploadStatus('idle');
                    setUploadErrorMessage(null);
                    setMediaType(null);
                    setMediaUrl(null);
                  }}
                />

                {uploadStatus === 'uploaded' && mediaUrl && (
                  <div className="relative rounded-xl overflow-hidden border border-[#00E676]/40 bg-black group">
                    {mediaType === 'image' ? (
                      <img src={mediaUrl} alt="Uploaded post image" className="w-full max-h-52 object-contain bg-black" />
                    ) : (
                      <video src={mediaUrl} controls playsInline preload="auto" className="w-full max-h-52 object-contain bg-black transform-gpu" />
                    )}

                    <button
                      onClick={() => {
                        setMediaUrl(null);
                        setMediaType(null);
                        setMediaSizeBytes(0);
                        setMediaSizeMb(0);
                        setUploadStatus('idle');
                        setUploadFileName('');
                        setUploadProgress(0);
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/75 hover:bg-black text-white hover:text-rose-400 transition-colors shadow-md z-10"
                      title="Remove uploaded media"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Inline Location Input if activated */}
        {showLocationInput && (
          <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-white/5 rounded-xl text-xs">
            <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Add stadium or city (e.g., Emirates Stadium, London)"
              className="flex-1 bg-transparent border-none text-xs text-slate-800 dark:text-white focus:outline-none"
            />
            <button onClick={() => setShowLocationInput(false)} className="text-slate-400 hover:text-white">
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Club Tag Selector (Premier League & Top Clubs) */}
        {showClubSelector && (
          <div className="p-2.5 bg-slate-50 dark:bg-white/5 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 dark:text-white/60 uppercase tracking-wider">
                Select Premier League Clubs:
              </span>
              <button onClick={() => setShowClubSelector(false)} className="text-[10px] text-slate-400 hover:text-white">
                Close
              </button>
            </div>
            <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto no-scrollbar">
              {POPULAR_TOP_5_CLUBS.filter(c => c.leagueId === 'pl').map(club => (
                <button
                  key={club.id}
                  onClick={() => {
                    setClubTag(club.name);
                    setShowClubSelector(false);
                  }}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all ${
                    clubTag === club.name
                      ? 'bg-[#00E676] text-black font-bold'
                      : 'bg-white dark:bg-white/10 text-slate-700 dark:text-white hover:bg-slate-200'
                  }`}
                >
                  {club.name}
                </button>
              ))}
            </div>
            <div className="pt-1 border-t border-slate-200 dark:border-white/5">
              <span className="text-[9px] font-bold text-slate-400 dark:text-white/40 uppercase block mb-1">
                Other Top European Clubs:
              </span>
              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto no-scrollbar">
                {POPULAR_TOP_5_CLUBS.filter(c => c.leagueId !== 'pl').map(club => (
                  <button
                    key={club.id}
                    onClick={() => {
                      setClubTag(club.name);
                      setShowClubSelector(false);
                    }}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
                      clubTag === club.name
                        ? 'bg-[#00E676] text-black font-bold'
                        : 'bg-white dark:bg-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-200'
                    }`}
                  >
                    {club.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Feelings Picker */}
        {showFeelings && (
          <div className="p-2 bg-slate-50 dark:bg-white/5 rounded-xl flex flex-wrap gap-1.5">
            {FEELINGS_LIST.map(f => (
              <button
                key={f}
                onClick={() => {
                  setFeeling(f);
                  setShowFeelings(false);
                }}
                className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-white dark:bg-white/10 text-slate-700 dark:text-white hover:bg-slate-200"
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {/* Bottom Toolbar & Post Button */}
        <div className="pt-2.5 border-t border-slate-100 dark:border-white/8 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-white/75 flex-wrap">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleSelectImage}
              accept="image/*,.heic,.heif,.webp,.png,.jpg,.jpeg"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[44px] px-3 py-1.5 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-extrabold transition-colors"
              title="Upload Photo"
            >
              <ImageIcon className="w-4 h-4 shrink-0" />
              <span>Photo</span>
            </button>

            <input
              type="file"
              ref={videoInputRef}
              onChange={handleSelectVideo}
              accept="video/*,.mp4,.mov,.m4v,.webm,.3gp"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className="min-h-[44px] px-3 py-1.5 flex items-center justify-center gap-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-extrabold transition-colors"
              title="Upload Video"
            >
              <VideoIcon className="w-4 h-4 shrink-0" />
              <span>Video</span>
            </button>

            <button
              onClick={() => setShowLocationInput(!showLocationInput)}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-rose-500 transition-colors"
              title="Tag location"
            >
              <MapPin className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowClubSelector(!showClubSelector)}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-amber-500 transition-colors"
              title="Tag club"
            >
              <Shield className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowFeelings(!showFeelings)}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-purple-500 transition-colors"
              title="Feeling/Activity"
            >
              <Smile className="w-4 h-4" />
            </button>
          </div>

          {/* Post Button */}
          <button
            onClick={handleCreatePost}
            disabled={(!content.trim() && !mediaUrl) || isSubmitting || isUploadingMedia}
            className={`min-h-[40px] px-5 py-2 rounded-full text-xs font-extrabold flex items-center gap-1.5 transition-all ${
              (!content.trim() && !mediaUrl) || isSubmitting || isUploadingMedia
                ? 'bg-slate-200 dark:bg-white/10 text-slate-400 dark:text-white/30 cursor-not-allowed'
                : 'bg-[#00E676] hover:bg-[#00c864] text-black shadow-md shadow-[#00E676]/20 active:scale-95'
            }`}
          >
            {isSubmitting || isUploadingMedia ? (
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span>{isUploadingMedia ? `${uploadProgress}%` : 'Posting...'}</span>
              </div>
            ) : (
              <span>Post</span>
            )}
          </button>
        </div>
      </div>

      {/* Posts Feed */}
      <div className="space-y-3.5">
        {filteredPosts.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 p-8 text-center space-y-3 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center text-emerald-700 dark:text-[#00E676] mx-auto text-xl">
              ⚽
            </div>
            <h3 className="font-display font-extrabold text-slate-900 dark:text-white text-base">
              No posts yet - Be the first to post!
            </h3>
            <p className="text-xs text-slate-500 dark:text-white/55 max-w-sm mx-auto leading-relaxed">
              Share matchday updates, tactical insights, and celebrate team goals with supporters worldwide.
            </p>
          </div>
        ) : (
          prioritizedFilteredPosts.map(post => {
            const isCommentsExpanded = expandedCommentsPostId === post.id;
            const commentsList = post.commentsList || [];

            return (
              <article
                key={post.id}
                id={`post-${post.id}`}
                className={`rounded-2xl bg-white dark:bg-[#12171F] border p-4 shadow-sm space-y-3 hover:border-slate-300 dark:hover:border-white/15 ${
                  targetPostId === post.id
                    ? 'border-[#00E676] ring-2 ring-[#00E676]/40'
                    : 'border-slate-200/90 dark:border-white/8'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div
                    onClick={() => openCreatorProfile({
                      handle: post.author?.handle || '@fan',
                      name: post.author?.name || 'Supporter',
                      avatar: post.author?.avatar || user.avatar,
                      clubBadge: post.author?.clubBadge,
                    })}
                    className="flex items-center gap-2.5 cursor-pointer group min-w-0"
                    title={`View all posts and videos by ${post.author?.name || 'Supporter'}`}
                  >
                    <img
                      src={post.author?.avatar || user.avatar}
                      alt={`${post.author?.name || 'Supporter'} football fan profile avatar`}
                      loading="lazy"
                      decoding="async"
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-[#00E676]/30 group-hover:ring-[#00E676] transition-all shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-[#00E676] transition-colors truncate">
                          {post.author?.name || 'Supporter'}
                        </span>
                        {post.author?.isVerified && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-[#00E676] fill-[#00E676]/20 shrink-0" />
                        )}

                        {(post.author?.handle || '@fan') !== user.handle && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleConnectCreator(post.author?.handle || '@fan', {
                                name: post.author?.name || 'Supporter',
                                avatar: post.author?.avatar || user.avatar,
                                clubBadge: post.author?.clubBadge,
                              });
                            }}
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all flex items-center gap-1 shrink-0 ${
                              isCreatorConnected(post.author?.handle || '@fan')
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-[#00E676] border border-emerald-500/30'
                                : 'bg-[#00E676] text-black hover:bg-emerald-400'
                            }`}
                            title="Connect with creator to receive their posts first"
                          >
                            {isCreatorConnected(post.author?.handle || '@fan') ? '✓ Priority Connected' : '+ Connect'}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-white/55 flex-wrap">
                        <span>{post.author?.handle || '@fan'}</span>
                        <span>·</span>
                        <span>{post.timestamp}</span>
                        {post.clubTag ? (
                          <>
                            <span>·</span>
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                setHashtagFilter(post.clubTag || null);
                              }}
                              className="font-bold text-emerald-700 dark:text-[#00E676] hover:underline"
                            >
                              ⚽ {post.clubTag}
                            </button>
                          </>
                        ) : post.author?.clubBadge ? (
                          <span>· {post.author.clubBadge}</span>
                        ) : null}
                        {post.isEdited && <span className="text-[10px] italic">(edited)</span>}
                        {post.location && (
                          <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400">
                              <MapPin className="w-2.5 h-2.5" />
                              {post.location}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 text-slate-400 shrink-0">
                    <button
                      onClick={() => handleBookmark(post.id)}
                      className={`min-h-[38px] min-w-[38px] flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-white/5 transition-colors ${
                        post.isSaved ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'
                      }`}
                      title="Bookmark post"
                    >
                      <Bookmark className={`w-4 h-4 ${post.isSaved ? 'fill-amber-400' : ''}`} />
                    </button>

                    <div className="relative">
                      <button
                        onClick={() => setActiveMenuPostId(activeMenuPostId === post.id ? null : post.id)}
                        className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>

                      {activeMenuPostId === post.id && (
                        <div className="absolute right-0 top-9 z-30 w-36 rounded-xl bg-white dark:bg-[#1f2937] border border-slate-200 dark:border-white/10 shadow-xl py-1 text-xs">
                          <button
                            onClick={() => {
                              setEditingPost(post);
                              setEditContent(post.content);
                              setActiveMenuPostId(null);
                            }}
                            className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-white"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                            <span>Edit post</span>
                          </button>
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete post</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Content with Clickable Hashtags */}
                <div className="text-[13px] text-slate-800 dark:text-white/90 leading-relaxed break-words">
                  {post.content.split(' ').map((word, i) => {
                    if (word.startsWith('#')) {
                      return (
                        <span
                          key={i}
                          onClick={() => setHashtagFilter(word)}
                          className="text-emerald-700 dark:text-[#00E676] font-bold cursor-pointer hover:underline mr-1"
                        >
                          {word}{' '}
                        </span>
                      );
                    }
                    if (word.startsWith('@')) {
                      return (
                        <span key={i} className="text-blue-600 dark:text-blue-400 font-semibold cursor-pointer hover:underline mr-1">
                          {word}{' '}
                        </span>
                      );
                    }
                    return word + ' ';
                  })}
                </div>

                {/* Attached Feeling Badge */}
                {post.feeling && (
                  <div className="inline-block px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 text-[11px] font-semibold">
                    {post.feeling}
                  </div>
                )}

                {/* Media Image / Video Viewer */}
                {(post.imageUrl || (post.mediaType === 'image' && post.mediaUrl)) && (
                  <div
                    onClick={() => setFullscreenImage(post.imageUrl || post.mediaUrl || null)}
                    className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-black/10 dark:bg-black/40 border border-slate-100 dark:border-white/5 cursor-pointer group"
                  >
                    <img
                      src={post.imageUrl || post.mediaUrl}
                      alt={`football fan post photo by ${post.author?.name || 'Supporter'}`}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    />
                    {post.mediaSizeMb ? (
                      <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-black/75 text-[10px] font-mono tabular-nums font-bold text-[#00E676] border border-[#00E676]/30">
                        {post.mediaSizeMb} MB
                      </span>
                    ) : null}
                    <div className="absolute bottom-2.5 right-2.5 p-1.5 rounded-full bg-black/65 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <Maximize2 className="w-3.5 h-3.5" />
                    </div>
                  </div>
                )}

                {(post.videoUrl || (post.mediaType === 'video' && post.mediaUrl)) && (() => {
                  const isVerticalShort = post.aspectRatio === '9:16' || post.videoKind === 'short';
                  const videoSrc = post.videoUrl || post.mediaUrl || '';
                  return (
                    <div className="rounded-2xl overflow-hidden bg-slate-950 border border-slate-200/80 dark:border-white/10">
                      <div
                        className={`relative bg-black flex items-center justify-center ${
                          isVerticalShort ? 'aspect-[9/16] max-h-[420px] mx-auto' : 'aspect-video w-full'
                        }`}
                      >
                        <video
                          src={videoSrc}
                          poster={post.thumbnailUrl || undefined}
                          controls
                          playsInline
                          preload="auto"
                          className="w-full h-full object-contain bg-black transform-gpu"
                        />
                      </div>
                      <div className="px-3 py-2 bg-slate-900/95 text-white flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-mono text-white/80 truncate tabular-nums">
                          {isVerticalShort ? '9:16 Short' : '16:9 Video'}
                          {post.durationSeconds ? ` · ${Math.floor(post.durationSeconds / 60)}:${(post.durationSeconds % 60).toString().padStart(2, '0')}` : ''}
                          {post.mediaSizeMb ? ` · ${post.mediaSizeMb} MB` : ''}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={downloadingPostId === post.id}
                            onClick={() => handleDownloadPostVideo(post)}
                            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold flex items-center gap-1 disabled:opacity-50"
                            title={isProUser ? 'Download Video' : 'Pro Users Only'}
                          >
                            <Download className="w-3 h-3" />
                            <span>{downloadingPostId === post.id ? 'Saving...' : 'Download'}</span>
                            {!isProUser && (
                              <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-amber-400 text-black text-[8px] font-black">
                                <Crown className="w-2.5 h-2.5" />
                                PRO
                              </span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => openShareSheet({
                              kind: 'post',
                              targetId: post.id,
                              title: `Match Clip by ${post.author?.name || 'Supporter'}`,
                              text: post.content || 'Watch this football clip on FUTFIELD!',
                              url: buildShareUrl(`/?post=${encodeURIComponent(post.id)}`),
                              previewImage: post.thumbnailUrl,
                              videoUrl: videoSrc,
                            })}
                            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold"
                          >
                            Share
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab('videos')}
                            className="px-2.5 py-1 rounded-lg bg-[#00E676] hover:bg-[#00c864] text-black font-black"
                          >
                            <span>Futfield Tube</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Footer: Action Row */}
                <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-white/75">
                  <button
                    onClick={() => handleLike(post.id)}
                    className={`min-h-[38px] flex items-center gap-1.5 py-1.5 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all tabular-nums ${
                      post.isLiked ? 'text-rose-500 font-bold' : ''
                    }`}
                  >
                    <Heart
                      className={`w-4 h-4 transition-transform duration-200 ${
                        post.isLiked ? 'fill-rose-500 text-rose-500' : ''
                      } ${animatingLikeId === post.id ? 'scale-125' : ''}`}
                    />
                    <span>{post.likes >= 1000 ? `${(post.likes / 1000).toFixed(1)}k` : post.likes}</span>
                  </button>

                  <button
                    onClick={() =>
                      setExpandedCommentsPostId(isCommentsExpanded ? null : post.id)
                    }
                    className="min-h-[38px] flex items-center gap-1.5 py-1.5 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors tabular-nums"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>{post.commentsCount || commentsList.length}</span>
                  </button>

                  <button
                    onClick={() => handleShare(post)}
                    className={`min-h-[38px] flex items-center gap-1.5 py-1.5 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors tabular-nums ${
                      shareFeedbackId === post.id ? 'text-emerald-700 dark:text-[#00E676] font-bold' : ''
                    }`}
                  >
                    {shareFeedbackId === post.id ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600 dark:text-[#00E676]" />
                        <span>Shared</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-4 h-4" />
                        <span>{post.shares || 0}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Live Emoji Reactions Row */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {(['🔥', '⚽', '👏', '😱', '❤️'] as const).map(emoji => {
                    const count = post.reactions?.[emoji] || 0;
                    const active = post.userReactions?.includes(emoji);
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          haptics.light();
                          reactToPost(post.id, emoji);
                        }}
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 border transition-all active:scale-95 ${
                          active
                            ? 'bg-[#00E676]/15 border-[#00E676] text-[#00E676]'
                            : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10'
                        }`}
                      >
                        <span>{emoji}</span>
                        {count > 0 && <span className="font-mono text-[10px]">{count}</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Below Footer: Liked by Avatars Stack + Formatted Count */}
                <div className="flex items-center gap-2 pt-1 px-1 text-[11px] text-slate-500 dark:text-white/60">
                  <div className="flex -space-x-1.5 overflow-hidden">
                    <div className="inline-flex h-4 w-4 rounded-full ring-2 ring-white dark:ring-[#161b22] bg-rose-500 text-white items-center justify-center text-[8px] font-bold">
                      ❤️
                    </div>
                    <div className="inline-flex h-4 w-4 rounded-full ring-2 ring-white dark:ring-[#161b22] bg-[#00E676] text-black items-center justify-center text-[8px] font-bold">
                      ⚽
                    </div>
                    <div className="inline-flex h-4 w-4 rounded-full ring-2 ring-white dark:ring-[#161b22] bg-blue-500 text-white items-center justify-center text-[8px] font-bold">
                      🔥
                    </div>
                  </div>
                  <span className="font-medium">
                    Liked by{' '}
                    <strong className="text-slate-800 dark:text-white font-bold">
                      {post.likes >= 1000 ? `${(post.likes / 1000).toFixed(1)}k` : post.likes}
                    </strong>{' '}
                    supporters
                  </span>
                </div>

                {/* Comments Section */}
                {isCommentsExpanded && (
                  <div className="pt-3 border-t border-slate-100 dark:border-white/5 space-y-3">
                    {/* Inline Comment Composer */}
                    <div className="flex items-start gap-2">
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-7 h-7 rounded-full object-cover shrink-0"
                      />
                      <div className="flex-1 flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 px-3 py-1.5 rounded-full">
                        <input
                          type="text"
                          value={commentInputs[post.id] || ''}
                          onChange={e =>
                            setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))
                          }
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleAddComment(post.id);
                          }}
                          placeholder={
                            replyTarget?.postId === post.id
                              ? `Replying to @${replyTarget.authorName}...`
                              : 'Write a match reaction...'
                          }
                          className="flex-1 bg-transparent border-none text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
                        />
                        {replyTarget?.postId === post.id && (
                          <button
                            onClick={() => setReplyTarget(null)}
                            className="text-[10px] text-slate-400 hover:text-white"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          onClick={() => handleAddComment(post.id)}
                          className="text-[#00E676] hover:text-[#00c864] p-1"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Comments List: Collapsed to 2, then View X more */}
                    <div className="space-y-2.5 pt-1">
                      {commentsList.length === 0 ? (
                        <p className="text-[11px] text-slate-400 text-center py-1">
                          No comments yet. Start the football discussion!
                        </p>
                      ) : (
                        <>
                          {commentsList.length > 2 && !expandedAllComments[post.id] && (
                            <button
                              onClick={() =>
                                setExpandedAllComments(prev => ({ ...prev, [post.id]: true }))
                              }
                              className="text-[11px] font-bold text-slate-500 dark:text-white/60 hover:text-[#00E676] transition-colors py-0.5"
                            >
                              View {commentsList.length - 2} more comments
                            </button>
                          )}

                          {(expandedAllComments[post.id]
                            ? commentsList
                            : commentsList.slice(-2)
                          ).map(comment => (
                            <div key={comment.id} className="space-y-1.5">
                              <div className="flex items-start gap-2">
                                <img
                                  src={comment.author?.avatar || user.avatar}
                                  alt={`${comment.author?.name || 'Supporter'} football fan comment avatar`}
                                  loading="lazy"
                                  decoding="async"
                                  onClick={() => navigateToProfile(comment.author?.handle || comment.author?.name || 'Supporter')}
                                  className="w-6 h-6 rounded-full object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                />
                                <div className="flex-1 bg-slate-50 dark:bg-white/5 p-2 rounded-xl text-xs space-y-0.5">
                                  <div className="flex items-center justify-between">
                                    <span
                                      onClick={() => navigateToProfile(comment.author?.handle || comment.author?.name || 'Supporter')}
                                      className="font-bold text-[11px] text-slate-900 dark:text-white cursor-pointer hover:underline"
                                    >
                                      {comment.author?.name || 'Supporter'}
                                    </span>
                                    <span className="text-[9px] text-slate-400">{comment.timestamp}</span>
                                  </div>
                                  <p className="text-[11px] text-slate-700 dark:text-white/80">
                                    {comment.text}
                                  </p>
                                </div>
                              </div>

                              {/* Reply Action Button */}
                              <div className="pl-8 flex items-center gap-3 text-[10px] text-slate-400">
                                <button
                                  onClick={() =>
                                    setReplyTarget({
                                      postId: post.id,
                                      parentId: comment.id,
                                      authorName: comment.author?.name || 'Supporter',
                                    })
                                  }
                                  className="hover:text-[#00E676] font-semibold"
                                >
                                  Reply
                                </button>
                              </div>

                              {/* Nested Replies Rendering */}
                              {comment.replies && comment.replies.length > 0 && (
                                <div className="pl-7 space-y-1.5 border-l-2 border-slate-100 dark:border-white/10 ml-3">
                                  {comment.replies.map((reply: PostComment) => (
                                    <div key={reply.id} className="flex items-start gap-2">
                                      <CornerDownRight className="w-3 h-3 text-slate-400 shrink-0 mt-1" />
                                      <div className="flex-1 bg-slate-100/70 dark:bg-white/10 p-2 rounded-xl text-[11px]">
                                        <div className="flex items-center justify-between">
                                          <span className="font-bold text-[10px] text-slate-900 dark:text-white">
                                            {reply.author?.name || 'Supporter'}
                                          </span>
                                          <span className="text-[9px] text-slate-400">{reply.timestamp}</span>
                                        </div>
                                        <p className="text-slate-700 dark:text-white/80">{reply.text}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {/* Edit Post Modal */}
      {editingPost && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#161b22] border border-slate-200 dark:border-white/10 p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Edit Football Post</h3>
              <button onClick={() => setEditingPost(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              rows={4}
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingPost(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-1.5 rounded-xl bg-[#00E676] text-black font-extrabold text-xs"
              >
                Save Edits
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Image Modal */}
      {fullscreenImage && (
        <div
          onClick={() => setFullscreenImage(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-lg max-h-[90vh]">
            <img src={fullscreenImage} alt="Fullscreen viewer" className="w-full h-full object-contain rounded-2xl" />
            <button
              onClick={() => setFullscreenImage(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/70 text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* In-App Delete Post Confirmation Modal */}
      {confirmDeletePostId && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xs rounded-2xl bg-white dark:bg-[#161b22] border border-slate-200 dark:border-white/10 p-5 shadow-2xl space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Delete Football Post?</h3>
            <p className="text-xs text-slate-600 dark:text-white/70 leading-relaxed">
              This will permanently remove this post from your feed.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeletePostId(null)}
                className="flex-1 min-h-[44px] py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDeletePost}
                className="flex-1 min-h-[44px] py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
