import React, { useState, useRef, useEffect } from 'react';
import {
  Video,
  Play,
  Film,
  Eye,
  Heart,
  MessageSquare,
  Share2,
  TrendingUp,
  BarChart3,
  Users,
  Award,
  Plus,
  Edit3,
  Trash2,
  Download,
  Image as ImageIcon,
  Check,
  CheckCircle2,
  Clock,
  Globe,
  Lock,
  Search,
  Filter,
  Layers,
  ArrowUpRight,
  Shield,
  Zap,
  Activity,
  Maximize2,
  ChevronRight,
  RefreshCw,
  Gift,
  DollarSign,
  Pin,
  Camera,
  Upload,
  FileVideo,
} from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { Post, VideoItem, Match } from '../../types/football';
import { ClubLogo } from '../Common/ClubLogo';
import { MonetizationModal } from '../Monetization/MonetizationModal';
import { MediaUploadSplash, UploadSplashStatus } from '../Common/MediaUploadSplash';
import {
  uploadFileToBackend,
  formatBytesToMb,
  inspectVideoMetadata,
  captureVideoPosterFrame,
} from '../../utils/mediaUpload';
import { buildShareUrl } from '../../utils/share';
import { haptics } from '../../utils/haptics';

export const FutfieldStudioTab: React.FC = () => {
  const {
    user,
    posts,
    videos,
    matches,
    addFanPoints,
    addNotification,
    setActiveTab,
    openMatchRoom,
    updateUser,
    addVideo,
    addPost,
    refreshMediaAndAnalytics,
    openShareSheet,
    openVideoInReels,
  } = useFootball();

  // Studio Sub-Navigation Tabs matching YouTube Studio structure
  const [studioSection, setStudioSection] = useState<
    'dashboard' | 'content' | 'analytics' | 'upload' | 'thumbnail' | 'comments' | 'monetization'
  >('dashboard');

  // Content Filter & Search
  const [contentFilter, setContentFilter] = useState<'all' | 'videos' | 'posts'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Editing Content Metadata Modal
  const [editingItem, setEditingItem] = useState<{
    id: string;
    type: 'video' | 'post';
    title: string;
    privacy: 'public' | 'followers' | 'private';
  } | null>(null);

  // Upload Form State
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [newVideoDesc, setNewVideoDesc] = useState('');
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newVideoThumbUrl, setNewVideoThumbUrl] = useState('');
  const [studioVideoKind, setStudioVideoKind] = useState<'short' | 'video'>('short');
  const [studioAspectRatio, setStudioAspectRatio] = useState<'9:16' | '16:9'>('9:16');
  const [studioDurationSec, setStudioDurationSec] = useState<number>(30);
  const [studioResolution, setStudioResolution] = useState<string>('');
  const [lastPublishedVideo, setLastPublishedVideo] = useState<VideoItem | null>(null);
  const [newVideoCategory, setNewVideoCategory] = useState<VideoItem['category']>('highlights');
  const [newVideoClubTag, setNewVideoClubTag] = useState(user.favoriteClub !== 'Not Set' ? user.favoriteClub : 'Arsenal');
  const [newVideoPrivacy, setNewVideoPrivacy] = useState<'public' | 'followers' | 'private'>('public');
  const [isSubmittingUpload, setIsSubmittingUpload] = useState(false);
  const [studioUploadStatus, setStudioUploadStatus] = useState<UploadSplashStatus>('idle');
  const [studioUploadProgress, setStudioUploadProgress] = useState<number>(0);
  const [studioUploadFileName, setStudioUploadFileName] = useState<string>('');
  const [studioUploadSizeMb, setStudioUploadSizeMb] = useState<number>(0);
  const [studioUploadSizeBytes, setStudioUploadSizeBytes] = useState<number>(0);
  const [studioUploadError, setStudioUploadError] = useState<string | null>(null);
  const studioVideoInputRef = useRef<HTMLInputElement | null>(null);

  // Thumbnail Studio State
  const [thumbHeadline, setThumbHeadline] = useState('MATCHDAY HIGHLIGHTS & TACTICS');
  const [thumbClub1, setThumbClub1] = useState(user.favoriteClub !== 'Not Set' ? user.favoriteClub : 'Arsenal');
  const [thumbClub2, setThumbClub2] = useState('Real Madrid');
  const [thumbScore, setThumbScore] = useState('2 - 1 FT');
  const [thumbFormat, setThumbFormat] = useState<'16:9' | '9:16'>('16:9');
  const [thumbTheme, setThumbTheme] = useState<'emerald' | 'derby' | 'gold' | 'neon'>('emerald');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Comments Moderation State
  const [heartedCommentIds, setHeartedCommentIds] = useState<Set<string>>(new Set());
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});

  // Real calculations computed strictly from user's live data
  const totalVideoViews = videos.reduce((acc, v) => acc + (v.views || 0), 0);
  const totalVideoLikes = videos.reduce((acc, v) => acc + (v.likes || 0), 0);
  const totalPostLikes = posts.reduce((acc, p) => acc + (p.likes || 0), 0);
  const totalLikes = totalVideoLikes + totalPostLikes;
  const totalComments = videos.reduce((acc, v) => acc + (v.commentsCount || 0), 0) +
    posts.reduce((acc, p) => acc + (p.commentsCount || 0), 0);
  const totalUploads = videos.length + posts.length;
  const latestVideo = videos.length > 0 ? videos[0] : null;
  const latestPost = posts.length > 0 ? posts[0] : null;

  // Real comments gathered from posts
  const realPostComments = posts.flatMap(p =>
    (p.commentsList || []).map(c => ({
      ...c,
      postTitle: p.content.slice(0, 36),
      postId: p.id,
      source: 'Post' as const,
    }))
  );

  // Render Thumbnail on HTML5 Canvas
  useEffect(() => {
    if (studioSection !== 'thumbnail' && studioSection !== 'dashboard') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = thumbFormat === '16:9' ? 640 : 360;
    const height = thumbFormat === '16:9' ? 360 : 640;
    canvas.width = width;
    canvas.height = height;

    // Background Gradient based on theme
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    if (thumbTheme === 'emerald') {
      bgGrad.addColorStop(0, '#042111');
      bgGrad.addColorStop(0.5, '#063d1e');
      bgGrad.addColorStop(1, '#021209');
    } else if (thumbTheme === 'derby') {
      bgGrad.addColorStop(0, '#3b0707');
      bgGrad.addColorStop(0.5, '#5c0c0c');
      bgGrad.addColorStop(1, '#1a0303');
    } else if (thumbTheme === 'gold') {
      bgGrad.addColorStop(0, '#2e1c03');
      bgGrad.addColorStop(0.5, '#4a2f05');
      bgGrad.addColorStop(1, '#140c01');
    } else {
      bgGrad.addColorStop(0, '#0b0f19');
      bgGrad.addColorStop(0.5, '#121829');
      bgGrad.addColorStop(1, '#05070d');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Football pitch lines pattern
    ctx.strokeStyle = 'rgba(0, 230, 118, 0.15)';
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 20, width - 40, height - 40);
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 70, 0, Math.PI * 2);
    ctx.stroke();

    // Studio Watermark
    ctx.fillStyle = '#00E676';
    ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('FUTFIELD STUDIO', 30, 45);

    // Match Score Pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(width - 150, 25, 120, 32);
    ctx.strokeStyle = '#00E676';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(width - 150, 25, 120, 32);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 15px "JetBrains Mono", monospace';
    ctx.fillText(thumbScore, width - 130, 47);

    // Versus clubs text
    ctx.fillStyle = '#E2E8F0';
    ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`${thumbClub1} vs ${thumbClub2}`, 30, height - 90);

    // Main Punchy Headline
    ctx.fillStyle = '#00E676';
    ctx.font = '900 24px "Plus Jakarta Sans", sans-serif';
    const words = thumbHeadline.split(' ');
    const line1 = words.slice(0, 3).join(' ');
    const line2 = words.slice(3).join(' ');
    ctx.fillText(line1, 30, height - 55);
    if (line2) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(line2, 30, height - 25);
    }
  }, [thumbHeadline, thumbClub1, thumbClub2, thumbScore, thumbFormat, thumbTheme, studioSection]);

  const handleDownloadThumbnail = () => {
    haptics.success();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `futfield-thumbnail-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    addNotification({
      title: 'Thumbnail Exported!',
      body: 'Your custom matchday graphic has been downloaded in HD.',
      type: 'system',
    });
  };

  const handleApplyToLatestVideo = () => {
    haptics.success();
    addFanPoints(30, 'Generated Studio Thumbnail');
    addNotification({
      title: 'Thumbnail Applied (+30 Fan Points)',
      body: 'Saved to your creator portfolio.',
      type: 'system',
    });
  };

  const handleHeartComment = (id: string) => {
    haptics.like();
    setHeartedCommentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        addFanPoints(5, 'Hearted a fan comment');
        addNotification({
          title: 'Hearted Comment (+5 Fan Points)',
          body: 'Showed appreciation to a football fan.',
          type: 'like',
        });
      }
      return next;
    });
  };

  const handleStudioSelectVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const exactBytes = file.size;
    const exactMb = formatBytesToMb(exactBytes);
    setStudioUploadSizeBytes(exactBytes);
    setStudioUploadSizeMb(exactMb);
    setStudioUploadFileName(file.name);
    setNewVideoUrl('');
    setNewVideoThumbUrl('');
    setStudioUploadError(null);
    setStudioUploadStatus('uploading');
    setStudioUploadProgress(10);
    if (!newVideoTitle.trim()) {
      setNewVideoTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
    }
    haptics.light();

    const meta = await inspectVideoMetadata(file);
    if (meta.validationError || meta.videoKind === 'unsupported') {
      setStudioUploadStatus('error');
      setStudioUploadProgress(0);
      setStudioUploadError(
        meta.validationError ||
          'Only 9:16 Shorts (≤ 2 min) or 16:9 Videos (≤ 3 min) are permitted.'
      );
      return;
    }

    const detectedKind: 'short' | 'video' = meta.videoKind;
    const detectedRatio: '9:16' | '16:9' = meta.detectedAspectRatio === '16:9' ? '16:9' : '9:16';
    setStudioVideoKind(detectedKind);
    setStudioAspectRatio(detectedRatio);
    setStudioDurationSec(meta.duration || 30);
    setStudioResolution(meta.width > 0 && meta.height > 0 ? `${meta.width}x${meta.height}` : '');

    const [res, posterBlob] = await Promise.all([
      uploadFileToBackend(
        file,
        'videos',
        file.name,
        (pct) => setStudioUploadProgress(pct),
        user.id,
        {
          durationSeconds: meta.duration,
          width: meta.width,
          height: meta.height,
          videoKind: detectedKind,
          aspectRatio: detectedRatio,
          title: newVideoTitle.trim() || file.name,
          description: newVideoDesc.trim(),
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
        setNewVideoThumbUrl(thumbRes.url);
      }
    }

    if (res.success && res.url) {
      setNewVideoUrl(res.url);
      if (res.sizeBytes) setStudioUploadSizeBytes(res.sizeBytes);
      if (res.sizeMb) setStudioUploadSizeMb(res.sizeMb);
      if (res.videoKind) setStudioVideoKind(res.videoKind);
      if (res.aspectRatio) setStudioAspectRatio(res.aspectRatio);
      setStudioUploadProgress(100);
      setStudioUploadStatus('uploaded');
      haptics.success();
      refreshMediaAndAnalytics().catch(() => {});
    } else {
      setStudioUploadStatus('error');
      setStudioUploadError(res.error || 'Video upload failed');
    }
  };

  const handleUploadVideoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVideoTitle.trim() || !newVideoUrl.trim() || studioUploadStatus === 'uploading') return;

    setIsSubmittingUpload(true);
    haptics.success();

    const durSec = studioDurationSec || 30;
    const durFormatted = `${Math.floor(durSec / 60)}:${(durSec % 60).toString().padStart(2, '0')}`;

    const published = await addVideo({
      title: newVideoTitle.trim(),
      description: newVideoDesc.trim() || 'Football tactical video on FUTFIELD',
      videoUrl: newVideoUrl.trim(),
      thumbnailUrl: newVideoThumbUrl || undefined,
      clubTag: newVideoClubTag,
      category: newVideoCategory,
      privacy: newVideoPrivacy,
      duration: durFormatted,
      durationSeconds: durSec,
      videoKind: studioVideoKind,
      aspectRatio: studioAspectRatio,
      sizeBytes: studioUploadSizeBytes || undefined,
      sizeMb: studioUploadSizeMb || undefined,
      skipAutoNavigate: true,
    });

    if (published) {
      setLastPublishedVideo(published);
      addNotification({
        title: `${studioVideoKind === 'short' ? '9:16 Short' : '16:9 Video'} Live in Studio!`,
        body: `"${published.title}" is ready to stream & share.`,
        type: 'video',
      });
    }

    setNewVideoTitle('');
    setNewVideoDesc('');
    setNewVideoUrl('');
    setNewVideoThumbUrl('');
    setStudioUploadStatus('idle');
    setStudioUploadSizeBytes(0);
    setStudioUploadSizeMb(0);
    setStudioUploadFileName('');
    setIsSubmittingUpload(false);
    setStudioSection('content');
  };

  // Filter content
  const filteredVideos = videos.filter(v =>
    v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPosts = posts.filter(p =>
    p.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="pb-24 max-w-2xl mx-auto px-3 sm:px-4 pt-3 space-y-4">
      {/* ============================================================= */}
      {/* YOUTUBE STUDIO HEADER & CHANNEL BRANDING */}
      {/* ============================================================= */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <img
                src={user.avatar || '/assets/aistudio/IMG-20261106-WA6972_a4f2c4ba.jpg'}
                alt={user.name}
                referrerPolicy="no-referrer"
                className="w-13 h-13 rounded-2xl object-cover ring-2 ring-[#00E676]/30 shadow-md"
              />
              <button
                onClick={() => {
                  haptics.light();
                  setActiveTab('profile');
                }}
                className="absolute -bottom-1 -right-1 min-h-[28px] min-w-[28px] p-1 rounded-full bg-[#00E676] text-black shadow-md hover:scale-110 transition-transform flex items-center justify-center"
                title="Edit profile photo"
              >
                <Camera className="w-3 h-3" />
              </button>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="font-display font-extrabold text-base text-slate-900 dark:text-white leading-tight truncate">
                  {user.name}
                </h1>
                {user.fanPoints >= 500 && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-[#00E676] fill-[#00E676]/20 shrink-0" />
                )}
                <span className="text-[11px] uppercase font-mono text-emerald-700 dark:text-[#00E676] font-extrabold tracking-wider">
                  · Studio
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-white/55 font-medium tabular-nums truncate">
                {user.handle} · {user.followersCount} followers
              </p>
              {user.favoriteClub !== 'Not Set' && (
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-white/80 mt-0.5">
                  <ClubLogo name={user.favoriteClub} className="w-3.5 h-3.5" />
                  <span>{user.favoriteClub}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Create Action Button */}
          <button
            onClick={() => {
              haptics.light();
              setStudioSection('upload');
            }}
            className="min-h-[44px] px-4 py-2 rounded-2xl bg-[#00E676] hover:bg-[#00C853] text-black font-extrabold text-xs shadow-md shadow-[#00E676]/20 flex items-center gap-1.5 transition-all active:scale-95 shrink-0 whitespace-nowrap"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Create</span>
          </button>
        </div>

        {/* YouTube Studio Navigation Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-2 border-t border-slate-100 dark:border-white/5">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
            { id: 'content', label: 'Content', icon: Film, count: totalUploads },
            { id: 'analytics', label: 'Analytics', icon: TrendingUp },
            { id: 'upload', label: 'Upload Lab', icon: Upload },
            { id: 'thumbnail', label: 'Thumbnail Lab', icon: ImageIcon },
            { id: 'comments', label: 'Comments', icon: MessageSquare, count: totalComments },
            { id: 'monetization', label: 'Earn Points', icon: DollarSign },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = studioSection === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  haptics.light();
                  setStudioSection(tab.id as any);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                  isActive
                    ? 'bg-[#00E676] text-black shadow-sm font-extrabold'
                    : 'text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && tab.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-black text-[#00E676]' : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ============================================================= */}
      {/* SECTION 1: DASHBOARD (YouTube Studio Style) */}
      {/* ============================================================= */}
      {studioSection === 'dashboard' && (
        <div className="space-y-4">
          {/* Channel Analytics KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-slate-500 dark:text-white/50 uppercase tracking-wider block">
                Total Views
              </span>
              <div className="text-xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
                {totalVideoViews.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-white/55 tabular-nums">
                {videos.length} videos published
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-slate-500 dark:text-white/50 uppercase tracking-wider block">
                Total Likes
              </span>
              <div className="text-xl font-black text-rose-500 font-mono tabular-nums">
                {totalLikes.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-white/55">
                Across videos & posts
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-slate-500 dark:text-white/50 uppercase tracking-wider block">
                Followers
              </span>
              <div className="text-xl font-black text-blue-500 font-mono tabular-nums">
                {user.followersCount.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-white/55">
                Current subscribers
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-slate-500 dark:text-white/50 uppercase tracking-wider block">
                Fan Points
              </span>
              <div className="text-xl font-black text-emerald-700 dark:text-[#00E676] font-mono tabular-nums">
                +{user.fanPoints} FP
              </div>
              <span className="text-[10px] text-slate-500 dark:text-white/55">
                {user.fanPoints >= 500 ? 'Verified Creator' : 'Earn 500 for badge'}
              </span>
            </div>
          </div>

          {/* Latest Video Performance Card */}
          <div className="p-4 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-slate-500 dark:text-white/50">
                Latest Upload Performance
              </span>
              {latestVideo && (
                <span className="text-[11px] text-emerald-700 dark:text-[#00E676] font-bold">Live on feed</span>
              )}
            </div>

            {latestVideo ? (
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-black overflow-hidden relative shrink-0">
                  <img
                    src={latestVideo.thumbnailUrl || '/assets/aistudio/IMG-20261102-WA2735_f2548d41.jpg'}
                    alt={latestVideo.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-1 right-1 p-0.5 rounded bg-black/80 text-[9px] font-mono tabular-nums text-white">
                    {latestVideo.duration || '0:45'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-display font-extrabold text-xs text-slate-900 dark:text-white truncate">
                    {latestVideo.title}
                  </h4>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-white/55 mt-1 tabular-nums">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3 text-emerald-600 dark:text-[#00E676]" />
                      {latestVideo.views} views
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3 text-rose-500" />
                      {latestVideo.likes} likes
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-blue-500" />
                      {latestVideo.commentsCount} comments
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-400 flex items-center justify-center mx-auto">
                  <FileVideo className="w-5 h-5" />
                </div>
                <h4 className="font-display font-extrabold text-xs text-slate-800 dark:text-white">
                  No videos uploaded yet
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-white/55 max-w-xs mx-auto">
                  Upload your first match highlight, tactical breakdown, or fan reaction clip to start seeing performance analytics.
                </p>
                <button
                  onClick={() => setStudioSection('upload')}
                  className="min-h-[40px] px-4 py-1.5 rounded-xl bg-[#00E676] hover:bg-[#00C853] text-black font-extrabold text-xs inline-flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Video Now (+20 FP)</span>
                </button>
              </div>
            )}
          </div>

          {/* Published Posts Performance */}
          <div className="p-4 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-slate-400">
                Latest Community Post
              </span>
              <span className="text-[10px] text-slate-400">{posts.length} published</span>
            </div>

            {latestPost ? (
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-2">
                <p className="text-xs text-slate-800 dark:text-white/90 line-clamp-2">
                  {latestPost.content}
                </p>
                <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-white/50 font-medium">
                  <span>{latestPost.likes} likes</span>
                  <span>{latestPost.commentsCount} comments</span>
                  <span>{latestPost.shares} shares</span>
                  <span className="ml-auto text-[10px] text-slate-400">{latestPost.timestamp}</span>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center space-y-1.5">
                <p className="text-xs text-slate-500 dark:text-white/50">
                  No tactical match posts published yet.
                </p>
                <button
                  onClick={() => {
                    haptics.light();
                    setActiveTab('home');
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white font-bold text-xs"
                >
                  Create Match Post (+10 FP)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* SECTION 2: CONTENT MANAGER (YouTube Studio Style Table) */}
      {/* ============================================================= */}
      {studioSection === 'content' && (
        <div className="space-y-3.5">
          {/* Search & Filter Bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search your uploads..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/8 text-xs text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/8">
              {(['all', 'videos', 'posts'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setContentFilter(tab)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold capitalize transition-all ${
                    contentFilter === tab
                      ? 'bg-[#00E676] text-black font-extrabold'
                      : 'text-slate-500 dark:text-white/60'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Freshly Published Video Live Showcase Card */}
          {lastPublishedVideo && (
            <div className="rounded-3xl bg-slate-950 border border-[#00E676]/40 overflow-hidden shadow-xl">
              <div className="px-4 py-2.5 bg-[#00E676]/15 border-b border-white/10 flex items-center justify-between text-xs">
                <span className="font-extrabold text-[#00E676]">
                  Just Published · {lastPublishedVideo.aspectRatio === '16:9' ? '16:9 Video' : '9:16 Short'}
                </span>
                <button
                  type="button"
                  onClick={() => setLastPublishedVideo(null)}
                  className="text-white/60 hover:text-white text-[11px] font-bold"
                >
                  Dismiss
                </button>
              </div>
              <div
                className={`bg-black flex items-center justify-center ${
                  lastPublishedVideo.aspectRatio === '16:9' ? 'aspect-video w-full' : 'aspect-[9/16] max-h-[340px] mx-auto'
                }`}
              >
                <video
                  src={lastPublishedVideo.videoUrl}
                  poster={lastPublishedVideo.thumbnailUrl}
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="p-3.5 text-white space-y-2.5">
                <div>
                  <h4 className="font-display font-black text-sm line-clamp-1">{lastPublishedVideo.title}</h4>
                  <p className="text-[11px] text-white/65 line-clamp-2">
                    {lastPublishedVideo.duration} · {lastPublishedVideo.sizeMb || 0} MB · {lastPublishedVideo.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openVideoInReels(lastPublishedVideo.id)}
                    className="flex-1 min-h-[42px] px-3 rounded-xl bg-[#00E676] hover:bg-[#00c864] text-black font-black text-xs flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-black" />
                    <span>Watch in PitchReels</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openShareSheet({
                      kind: 'video',
                      targetId: lastPublishedVideo.id,
                      title: lastPublishedVideo.title,
                      text: `Watch "${lastPublishedVideo.title}" on FUTFIELD PitchReels!`,
                      url: buildShareUrl('/highlights'),
                      previewImage: lastPublishedVideo.thumbnailUrl,
                    })}
                    className="min-h-[42px] px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share to Phone</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Videos List */}
          <div className="space-y-2">
            {(contentFilter === 'all' || contentFilter === 'videos') &&
              filteredVideos.map(vid => (
                <div
                  key={vid.id}
                  className="p-3.5 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-2.5"
                >
                  <div className="flex items-start gap-3">
                    <div
                      onClick={() => openVideoInReels(vid.id)}
                      className="w-16 h-16 rounded-2xl bg-black overflow-hidden relative shrink-0 cursor-pointer"
                    >
                      {vid.thumbnailUrl && !vid.thumbnailUrl.includes('IMG-20261106-WA6972') && !vid.thumbnailUrl.includes('IMG-20261102-WA2735') ? (
                        <img
                          src={vid.thumbnailUrl}
                          alt={vid.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : vid.videoUrl ? (
                        <video
                          src={`${vid.videoUrl}#t=0.4`}
                          preload="metadata"
                          muted
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img
                          src={vid.thumbnailUrl}
                          alt={vid.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <span className="absolute bottom-1 right-1 p-0.5 rounded bg-black/80 text-[8px] font-mono text-white">
                        {vid.duration || '0:30'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4
                          onClick={() => openVideoInReels(vid.id)}
                          className="font-extrabold text-xs text-slate-900 dark:text-white truncate cursor-pointer hover:text-emerald-700 dark:hover:text-[#00E676]"
                        >
                          {vid.title}
                        </h4>
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-[#00E676] shrink-0">
                          {vid.aspectRatio === '16:9' ? '16:9' : '9:16'} · {vid.privacy || 'Public'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-white/50 truncate mt-0.5">
                        {vid.description}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-600 dark:text-white/60 font-semibold mt-1 tabular-nums">
                        <span>{vid.views} views</span>
                        <span>{vid.likes} likes</span>
                        <span>{vid.commentsCount} comments</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5 text-xs">
                    <span className="text-[10px] text-slate-400">Uploaded {vid.createdAt || 'Recent'}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openVideoInReels(vid.id)}
                        className="px-2.5 py-1 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-[#00E676] font-bold text-[11px] flex items-center gap-1"
                        title="Play in PitchReels"
                      >
                        <Play className="w-3 h-3" />
                        <span>Play</span>
                      </button>
                      <button
                        onClick={() => {
                          haptics.light();
                          setEditingItem({
                            id: vid.id,
                            type: 'video',
                            title: vid.title,
                            privacy: (vid.privacy as any) || 'public',
                          });
                        }}
                        className="p-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-white"
                        title="Edit details"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          openShareSheet({
                            kind: 'video',
                            targetId: vid.id,
                            title: vid.title,
                            text: `Watch "${vid.title}" (${vid.duration || '0:30'}) on FUTFIELD PitchReels!`,
                            url: buildShareUrl('/highlights'),
                            previewImage: vid.thumbnailUrl,
                          });
                        }}
                        className="p-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-white"
                        title="Share to phone"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

            {/* Posts List */}
            {(contentFilter === 'all' || contentFilter === 'posts') &&
              filteredPosts.map(post => (
                <div
                  key={post.id}
                  className="p-3.5 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-2.5"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center shrink-0 text-slate-700 dark:text-white font-black text-xs">
                      POST
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                          Tactical Match Post
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white font-bold">
                          {post.privacy || 'Public'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-white/70 line-clamp-2 mt-0.5">
                        {post.content}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-600 dark:text-white/60 font-semibold mt-1">
                        <span>{post.likes} likes</span>
                        <span>{post.commentsCount} comments</span>
                        <span>{post.shares} shares</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5 text-xs">
                    <span className="text-[10px] text-slate-400">Published {post.timestamp}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          haptics.light();
                          setEditingItem({
                            id: post.id,
                            type: 'post',
                            title: post.content.slice(0, 40),
                            privacy: (post.privacy as any) || 'public',
                          });
                        }}
                        className="p-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-white"
                        title="Edit details"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

            {/* Empty State */}
            {totalUploads === 0 && (
              <div className="p-8 text-center rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 mx-auto">
                  <Film className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  No content published yet
                </h3>
                <p className="text-xs text-slate-500 dark:text-white/50 max-w-sm mx-auto">
                  Upload a video or create a post to populate your Content Manager with real-time analytics.
                </p>
                <button
                  onClick={() => setStudioSection('upload')}
                  className="px-4 py-2 rounded-xl bg-[#00E676] hover:bg-[#00C853] text-black font-extrabold text-xs inline-flex items-center gap-1.5 shadow-md shadow-[#00E676]/20"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Video</span>
                </button>
              </div>
            )}
          </div>

          {/* Edit Modal */}
          {editingItem && (
            <div className="p-4 rounded-3xl bg-slate-50 dark:bg-black/60 border border-slate-200 dark:border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                  Edit Content Settings
                </span>
                <button
                  onClick={() => setEditingItem(null)}
                  className="text-xs text-slate-400 hover:text-black dark:hover:text-white font-bold"
                >
                  ✕
                </button>
              </div>

              <input
                type="text"
                value={editingItem.title}
                onChange={e => setEditingItem({ ...editingItem, title: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/8 text-xs text-slate-900 dark:text-white focus:outline-none"
              />

              <div className="flex items-center justify-between">
                <select
                  value={editingItem.privacy}
                  onChange={e => setEditingItem({ ...editingItem, privacy: e.target.value as any })}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/8 text-xs text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="public">Public to All Fans</option>
                  <option value="followers">Followers Only</option>
                  <option value="private">Private (Only You)</option>
                </select>

                <button
                  onClick={() => {
                    haptics.success();
                    addNotification({
                      title: 'Settings Saved',
                      body: 'Content settings and visibility updated.',
                      type: 'system',
                    });
                    setEditingItem(null);
                  }}
                  className="px-4 py-1.5 rounded-xl bg-[#00E676] text-black font-extrabold text-xs"
                >
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* SECTION 3: ANALYTICS (100% Real Calculations - NO Mock Data) */}
      {/* ============================================================= */}
      {studioSection === 'analytics' && (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-3">
            <h3 className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-[#00E676]" />
              Real Channel Performance
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold block">Total Video Views</span>
                <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                  {totalVideoViews}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold block">Total Engagements</span>
                <span className="text-lg font-black text-rose-500 font-mono">
                  {totalLikes + totalComments}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold block">Follower Base</span>
                <span className="text-lg font-black text-blue-500 font-mono">
                  {user.followersCount}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold block">Creator Fan Points</span>
                <span className="text-lg font-black text-[#00E676] font-mono">
                  {user.fanPoints} FP
                </span>
              </div>
            </div>
          </div>

          {/* Real Content Ranking */}
          <div className="p-4 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-3">
            <h3 className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
              Top Performing Uploads
            </h3>

            {videos.length > 0 ? (
              <div className="space-y-2">
                {[...videos]
                  .sort((a, b) => (b.views || 0) - (a.views || 0))
                  .map((v, i) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-black text-slate-400 font-mono w-4">#{i + 1}</span>
                        <div className="truncate">
                          <h5 className="font-extrabold text-slate-900 dark:text-white truncate">
                            {v.title}
                          </h5>
                          <span className="text-[10px] text-slate-500 dark:text-white/50">
                            {v.likes} likes · {v.commentsCount} comments
                          </span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0 ml-2">
                        {v.views} views
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-white/50 py-3 text-center">
                Publish videos to start ranking your content by viewership.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* SECTION 4: UPLOAD LAB (Video & Clip Publisher) */}
      {/* ============================================================= */}
      {studioSection === 'upload' && (
        <form
          onSubmit={handleUploadVideoSubmit}
          className="p-4 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-[#00E676]" />
                Upload Football Video (Backend Hosted)
              </h3>
              <p className="text-xs text-slate-500 dark:text-white/50">
                Upload real highlights or tactical clips with automatic MB accounting (+20 FP)
              </p>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 dark:text-[#00E676]">
              +20 FP
            </span>
          </div>

          <input
            ref={studioVideoInputRef}
            type="file"
            accept="video/*"
            onChange={handleStudioSelectVideoFile}
            className="hidden"
          />

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => studioVideoInputRef.current?.click()}
              className="w-full min-h-[76px] p-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-white/15 hover:border-[#00E676] bg-slate-50 dark:bg-black/40 flex flex-col items-center justify-center gap-1.5 transition-colors"
            >
              <FileVideo className="w-6 h-6 text-[#00E676]" />
              <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                {studioUploadStatus === 'uploaded'
                  ? `Uploaded: ${studioUploadFileName} (${studioUploadSizeMb} MB)`
                  : 'Select Video File to Upload to Backend'}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-white/50">
                MP4, WebM, MOV · Calculated in exact MB on upload
              </span>
            </button>

            <MediaUploadSplash
              status={studioUploadStatus}
              mediaKind="video"
              fileName={studioUploadFileName}
              progress={studioUploadProgress}
              sizeMb={studioUploadSizeMb}
              errorMessage={studioUploadError}
            />

            {studioUploadStatus === 'uploaded' && newVideoUrl && (
              <div className="rounded-2xl overflow-hidden bg-slate-950 border border-[#00E676]/40 space-y-2 p-2.5">
                <div
                  className={`rounded-xl overflow-hidden bg-black flex items-center justify-center ${
                    studioVideoKind === 'video' ? 'aspect-video w-full' : 'aspect-[9/16] max-h-52 mx-auto'
                  }`}
                >
                  <video
                    src={newVideoUrl}
                    poster={newVideoThumbUrl || undefined}
                    controls
                    playsInline
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-white/80 px-1">
                  <span className="text-[#00E676] font-bold">
                    {studioVideoKind === 'short' ? '9:16 Short' : '16:9 Video'} · {studioDurationSec}s
                  </span>
                  <span>
                    {studioResolution || 'HD'} · {studioUploadSizeMb} MB
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 dark:text-white/80">
              Video Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Tactical Masterclass: Arsenal High Press Breakdown"
              value={newVideoTitle}
              onChange={e => setNewVideoTitle(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00E676]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 dark:text-white/80">
              Description &amp; Hashtags
            </label>
            <textarea
              rows={3}
              placeholder="Break down the key tactical moments, player movements, or your matchday reaction..."
              value={newVideoDesc}
              onChange={e => setNewVideoDesc(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00E676]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-white/80">
                Content Category
              </label>
              <select
                value={newVideoCategory}
                onChange={e => setNewVideoCategory(e.target.value as any)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="highlights">Match Highlights</option>
                <option value="foryou">Tactical Breakdown</option>
                <option value="subscriptions">Fan Reaction</option>
                <option value="playlists">Skills &amp; Goals</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-white/80">
                Privacy
              </label>
              <select
                value={newVideoPrivacy}
                onChange={e => setNewVideoPrivacy(e.target.value as any)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="public">Public to All Fans</option>
                <option value="followers">Followers Only</option>
                <option value="private">Private (Only You)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 dark:text-white/80">
              Club Tag
            </label>
            <input
              type="text"
              placeholder="e.g., Arsenal, Real Madrid, Liverpool"
              value={newVideoClubTag}
              onChange={e => setNewVideoClubTag(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmittingUpload || !newVideoTitle.trim() || studioUploadStatus !== 'uploaded'}
            className="w-full min-h-[44px] py-2.5 rounded-2xl bg-[#00E676] hover:bg-[#00C853] text-black font-extrabold text-xs shadow-md shadow-[#00E676]/20 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Upload className="w-4 h-4" />
            <span>
              {studioUploadStatus === 'uploading'
                ? 'Uploading Video to Backend...'
                : studioUploadStatus === 'uploaded'
                ? 'Publish Uploaded Video (+20 Fan Points)'
                : 'Select & Upload a Video File Above'}
            </span>
          </button>
        </form>
      )}

      {/* ============================================================= */}
      {/* SECTION 5: THUMBNAIL STUDIO & GRAPHIC LAB */}
      {/* ============================================================= */}
      {studioSection === 'thumbnail' && (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-[#00E676]" />
                  Video Thumbnail Generator
                </h3>
                <p className="text-xs text-slate-500 dark:text-white/50">
                  Render custom matchday graphics for YouTube and Shorts clips
                </p>
              </div>

              {/* Format Switcher */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <button
                  onClick={() => setThumbFormat('16:9')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    thumbFormat === '16:9' ? 'bg-[#00E676] text-black font-extrabold shadow' : 'text-slate-600 dark:text-white/60'
                  }`}
                >
                  16:9
                </button>
                <button
                  onClick={() => setThumbFormat('9:16')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    thumbFormat === '9:16' ? 'bg-[#00E676] text-black font-extrabold shadow' : 'text-slate-600 dark:text-white/60'
                  }`}
                >
                  9:16
                </button>
              </div>
            </div>

            {/* Live Canvas Preview */}
            <div className="flex justify-center p-3 rounded-2xl bg-black/40 border border-slate-200/50 dark:border-white/10 overflow-hidden">
              <canvas
                ref={canvasRef}
                className="max-w-full rounded-xl shadow-2xl border border-white/10"
                style={{
                  maxHeight: thumbFormat === '16:9' ? '220px' : '320px',
                  objectFit: 'contain',
                }}
              />
            </div>

            {/* Customization Inputs */}
            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-white/80 block mb-1">
                  Headline Text
                </label>
                <input
                  type="text"
                  value={thumbHeadline}
                  onChange={e => setThumbHeadline(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Home Club</label>
                  <input
                    type="text"
                    value={thumbClub1}
                    onChange={e => setThumbClub1(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Away Club</label>
                  <input
                    type="text"
                    value={thumbClub2}
                    onChange={e => setThumbClub2(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Score Watermark</label>
                  <input
                    type="text"
                    value={thumbScore}
                    onChange={e => setThumbScore(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Theme Palette */}
              <div className="flex items-center gap-1.5 pt-1">
                {(['emerald', 'derby', 'gold', 'neon'] as const).map(th => (
                  <button
                    key={th}
                    onClick={() => setThumbTheme(th)}
                    className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold capitalize border transition-all ${
                      thumbTheme === th
                        ? 'border-[#00E676] bg-[#00E676]/10 text-[#00E676]'
                        : 'border-slate-200 dark:border-white/10 text-slate-500'
                    }`}
                  >
                    {th}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleDownloadThumbnail}
                  className="flex-1 py-2 rounded-2xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-800 dark:text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PNG</span>
                </button>
                <button
                  onClick={handleApplyToLatestVideo}
                  className="flex-1 py-2 rounded-2xl bg-[#00E676] hover:bg-[#00C853] text-black font-extrabold text-xs shadow-md shadow-[#00E676]/20 flex items-center justify-center gap-1.5 transition-all"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save to Portfolio (+30 FP)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* SECTION 6: COMMENTS MODERATION (Real Comments Only) */}
      {/* ============================================================= */}
      {studioSection === 'comments' && (
        <div className="p-4 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-[#00E676]" />
                Comments Moderation
              </h3>
              <p className="text-xs text-slate-500 dark:text-white/50">
                Reply and heart fan comments on your content (+5 Fan Points)
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-400">
              {realPostComments.length} comments
            </span>
          </div>

          {realPostComments.length > 0 ? (
            <div className="space-y-2.5">
              {realPostComments.map(c => {
                const isHearted = heartedCommentIds.has(c.id);
                return (
                  <div
                    key={c.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <img
                          src={c.author?.avatar || '/assets/aistudio/IMG-20261106-WA6972_a4f2c4ba.jpg'}
                          alt={c.author?.name || 'Supporter'}
                          referrerPolicy="no-referrer"
                          className="w-7 h-7 rounded-full object-cover"
                        />
                        <div>
                          <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                            {c.author?.name || 'Supporter'}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-1.5">
                            {c.source} · {c.timestamp}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleHeartComment(c.id)}
                        className={`p-1.5 rounded-full transition-all ${
                          isHearted
                            ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/30'
                            : 'text-slate-400 hover:text-rose-500 hover:bg-rose-500/10'
                        }`}
                        title="Heart comment from creator"
                      >
                        <Heart className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </div>

                    <p className="text-xs text-slate-800 dark:text-white/90 pl-9">
                      {c.text}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 mx-auto">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h4 className="font-extrabold text-xs text-slate-800 dark:text-white">
                No comments yet
              </h4>
              <p className="text-xs text-slate-500 dark:text-white/50 max-w-sm mx-auto">
                As football supporters comment on your published videos and tactical match posts, their responses will appear here for you to moderate, reply, and heart.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* SECTION 7: MONETIZATION & FAN REWARDS PROGRESSION */}
      {/* ============================================================= */}
      {studioSection === 'monetization' && (
        <div className="space-y-4">
          {/* Real Wallet & AI Monetization Engine */}
          <MonetizationModal embedded isOpen={true} onClose={() => {}} />

          {/* Creator Fan Points & Verified Badging Roadmap */}
          <div className="p-4 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-display font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-emerald-600 dark:text-[#00E676]" />
                  Creator Fan Badges & Reputation
                </h3>
                <p className="text-xs text-slate-500 dark:text-white/55">
                  Earn points automatically through viral football content and community engagement
                </p>
              </div>
              <span className="text-base font-black text-emerald-700 dark:text-[#00E676] font-mono tabular-nums shrink-0">
                {user.fanPoints} FP
              </span>
            </div>

            {/* Creator Tier Roadmap */}
            <div className="space-y-2.5 pt-2">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-[#00E676]" />
                    Tier 1: Rising Creator (0 - 499 FP)
                  </span>
                  <span className="text-emerald-700 dark:text-[#00E676] font-bold">UNLOCKED</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-white/55">
                  Upload videos (+20 FP), create posts (+10 FP), and generate match thumbnails (+30 FP).
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Award className={`w-3.5 h-3.5 ${user.fanPoints >= 5000 ? 'text-emerald-600 dark:text-[#00E676]' : 'text-slate-400'}`} />
                    Tier 2: Verified Creator Badge (5,000 FP)
                  </span>
                  <span className={`font-bold tabular-nums ${user.fanPoints >= 5000 ? 'text-emerald-700 dark:text-[#00E676]' : 'text-slate-400'}`}>
                    {user.fanPoints >= 5000 ? 'ACTIVE' : `${Math.max(0, 5000 - user.fanPoints)} FP to go`}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-[#00E676] transition-all"
                    style={{ width: `${Math.min(100, (user.fanPoints / 5000) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Shield className={`w-3.5 h-3.5 ${user.fanPoints >= 15000 ? 'text-amber-500' : 'text-slate-400'}`} />
                    Tier 3: Club Legend (15,000 FP)
                  </span>
                  <span className={`font-bold ${user.fanPoints >= 15000 ? 'text-amber-500' : 'text-slate-400'}`}>
                    {user.fanPoints >= 15000 ? 'ACTIVE' : `${Math.max(0, 15000 - user.fanPoints)} FP to go`}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-all"
                    style={{ width: `${Math.min(100, (user.fanPoints / 15000) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
