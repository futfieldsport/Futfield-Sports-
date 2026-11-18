import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Crown,
  FileVideo,
  Image as ImageIcon,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { VideoItem } from '../../types/football';
import {
  captureThreeVideoThumbnails,
  formatBytesToMb,
  inspectVideoMetadata,
  uploadFileToBackend,
} from '../../utils/mediaUpload';
import { publishFutubeVideo } from '../../services/supabaseClient';
import { FutfieldTubeLogo } from './FutfieldTubeLogo';
import { haptics } from '../../utils/haptics';
import { isCreatorEmail, isReservedFutfieldText } from '../../utils/creatorGuard';

interface FutfieldTubeUploadModalProps {
  onClose: () => void;
  onPublished: (video: VideoItem) => void;
}

const FUTUBE_CATEGORIES = [
  'Goals',
  'Premier League',
  'La Liga',
  'Skills',
  'Memes',
  'Fan Reactions',
  'Transfer News',
  'Quick Kicks',
];

export const FutfieldTubeUploadModal: React.FC<FutfieldTubeUploadModalProps> = ({
  onClose,
  onPublished,
}) => {
  const { user, addNotification, setPricingModalOpen, refreshMediaAndAnalytics } = useFootball();
  const isProUser = Boolean(user.isPro || user.membershipTier === 'pro' || user.membershipTier === 'vip');

  const [step, setStep] = useState<'form' | 'processing' | 'live'>('form');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Goals');
  const [tagsInput, setTagsInput] = useState('#Goals #FutfieldTube');
  const [clubTag, setClubTag] = useState(user.favoriteClub !== 'Not Set' ? user.favoriteClub : 'Arsenal');
  const [visibility, setVisibility] = useState<'public' | 'squad' | 'private'>('public');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoMeta, setVideoMeta] = useState<{
    duration: number;
    width: number;
    height: number;
    isQuickKick: boolean;
    aspectRatio: '9:16' | '16:9';
  } | null>(null);

  const [generatedThumbs, setGeneratedThumbs] = useState<string[]>([]);
  const [selectedThumbUrl, setSelectedThumbUrl] = useState<string>('');
  const [customThumbUploading, setCustomThumbUploading] = useState(false);

  const [processStage, setProcessStage] = useState<string>('Preparing clip...');
  const [processPct, setProcessPct] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [liveVideo, setLiveVideo] = useState<VideoItem | null>(null);

  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const thumbInputRef = useRef<HTMLInputElement | null>(null);

  const handleChooseVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMsg(null);

    if (file.size > 500 * 1024 * 1024) {
      setErrorMsg('Maximum file size is 500MB.');
      return;
    }

    haptics.light();
    setSelectedFile(file);
    if (!title.trim()) {
      setTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 80));
    }

    const meta = await inspectVideoMetadata(file, 'futube');
    if (meta.validationError || meta.videoKind === 'unsupported') {
      setSelectedFile(null);
      setVideoMeta(null);
      setErrorMsg(meta.validationError || 'Upload a 9:16 Quick Kick (≤ 60s) or 16:9 Football Clip.');
      return;
    }

    const isQuickKick = meta.videoKind === 'short';
    setVideoMeta({
      duration: meta.duration || 30,
      width: meta.width,
      height: meta.height,
      isQuickKick,
      aspectRatio: meta.detectedAspectRatio === '9:16' ? '9:16' : '16:9',
    });
    if (isQuickKick) {
      setCategory('Quick Kicks');
    }

    // Auto-generate 3 crisp thumbnails from video timestamps
    setGeneratedThumbs([]);
    const blobs = await captureThreeVideoThumbnails(file).catch(() => []);
    if (blobs.length > 0) {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < blobs.length; i++) {
        const res = await uploadFileToBackend(
          blobs[i],
          'video-thumbnails',
          `${file.name.replace(/\.[^.]+$/, '')}-auto-${i + 1}.jpg`,
          undefined,
          user.id
        ).catch(() => null);
        if (res?.success && res.url) {
          uploadedUrls.push(res.url);
        }
      }
      if (uploadedUrls.length > 0) {
        setGeneratedThumbs(uploadedUrls);
        setSelectedThumbUrl(uploadedUrls[0]);
      }
    }
  };

  const handleChooseCustomThumb = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCustomThumbUploading(true);
    const res = await uploadFileToBackend(file, 'video-thumbnails', file.name, undefined, user.id);
    setCustomThumbUploading(false);
    if (res.success && res.url) {
      setSelectedThumbUrl(res.url);
      setGeneratedThumbs((prev) => [res.url, ...prev]);
      haptics.success();
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !videoMeta || !title.trim()) return;
    if (
      !isCreatorEmail(user.email) &&
      (isReservedFutfieldText(user.name) || isReservedFutfieldText(user.handle))
    ) {
      setErrorMsg('The name "Futfield" is strictly reserved for the official Futfield Creator account.');
      return;
    }
    setErrorMsg(null);
    setStep('processing');
    setProcessStage('Uploading to Futfield PitchCloud HD Storage...');
    setProcessPct(25);

    const uploadRes = await uploadFileToBackend(
      selectedFile,
      'futfield-videos',
      selectedFile.name,
      (pct) => setProcessPct(25 + Math.round(pct * 0.65)),
      user.id,
      {
        durationSeconds: videoMeta.duration,
        width: videoMeta.width,
        height: videoMeta.height,
        videoKind: videoMeta.isQuickKick ? 'short' : 'video',
        aspectRatio: videoMeta.aspectRatio,
        title: title.trim().slice(0, 80),
        description: description.trim(),
      }
    );

    if (!uploadRes.success || !uploadRes.url) {
      setStep('form');
      setErrorMsg(uploadRes.error || 'Upload failed.');
      return;
    }

    setProcessStage('Finalizing FanZone Clip & Preparing HD Stream...');
    setProcessPct(95);

    const parsedTags = tagsInput
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => (t.startsWith('#') ? t : `#${t}`));

    const durSec = videoMeta.duration || 30;
    const publishRes = await publishFutubeVideo({
      userId: user.id,
      isPro: isProUser,
      fanzoneId: user.handle,
      fanzoneName: `${user.name} FanZone`,
      fanzoneHandle: user.handle,
      fanzoneAvatar: user.avatar,
      title: title.trim().slice(0, 80),
      description: description.trim(),
      videoUrl: uploadRes.url,
      thumbnailUrl: selectedThumbUrl,
      tubeCategory: videoMeta.isQuickKick ? 'Quick Kicks' : category,
      category: videoMeta.isQuickKick ? 'playlists' : 'highlights',
      hashtags: parsedTags.length > 0 ? parsedTags : ['#FutfieldTube', '#Football'],
      clubTag,
      visibility,
      isQuickKick: videoMeta.isQuickKick,
      duration: `${Math.floor(durSec / 60)}:${(durSec % 60).toString().padStart(2, '0')}`,
      durationSeconds: durSec,
      sizeBytes: uploadRes.sizeBytes,
      sizeMb: uploadRes.sizeMb,
    });

    if (!publishRes.success || !publishRes.video) {
      setStep('form');
      if (publishRes.limitReached) {
        setPricingModalOpen(true);
      }
      setErrorMsg(publishRes.error || 'Could not publish clip.');
      return;
    }

    setProcessPct(100);
    setLiveVideo(publishRes.video);
    setStep('live');
    haptics.success();
    refreshMediaAndAnalytics().catch(() => {});
    addNotification({
      title: 'Clip Live on Futfield Tube 🔥',
      body: `"${publishRes.video.title}" is now streaming on Futfield Tube!`,
      type: 'video',
    });
    onPublished(publishRes.video);
  };

  return (
    <div className="pb-24 max-w-2xl mx-auto px-3 sm:px-4 pt-3">
      <div className="rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50 dark:bg-black/30">
          <div className="flex items-center gap-2.5">
            <FutfieldTubeLogo size={26} />
            <div>
              <h2 className="font-display font-black text-sm text-slate-900 dark:text-white">
                Upload Clip to Futfield Tube
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-white/55">
                {isProUser
                  ? 'Pro Creator: Unlimited uploads · 1080p HD · Watermark-free'
                  : 'Free Tier: 3 uploads/day · 720p HD · Futfield Watermark'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] min-w-[38px] rounded-full bg-slate-200/70 dark:bg-white/10 text-slate-700 dark:text-white flex items-center justify-center"
            aria-label="Close Upload"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tier Banner */}
        {!isProUser && step === 'form' && (
          <div className="px-4 py-2.5 bg-[#00C853]/10 border-b border-[#00C853]/20 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-800 dark:text-white font-semibold">
              <Crown className="w-4 h-4 text-[#00C853] shrink-0" />
              <span>Upgrade to Pro for 1080p HD, Zero Watermark &amp; Unlimited Uploads</span>
            </div>
            <button
              type="button"
              onClick={() => setPricingModalOpen(true)}
              className="px-3 py-1 rounded-full bg-[#00C853] text-black font-black text-[11px] shrink-0"
            >
              Go Pro
            </button>
          </div>
        )}

        {step === 'form' && (
          <form onSubmit={handlePublish} className="p-4 sm:p-5 space-y-4">
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*,.mp4,.mov,.m4v,.webm,.3gp"
              onChange={handleChooseVideo}
              className="hidden"
            />
            <input
              ref={thumbInputRef}
              type="file"
              accept="image/*"
              onChange={handleChooseCustomThumb}
              className="hidden"
            />

            {errorMsg && (
              <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-300 text-xs font-bold">
                {errorMsg}
              </div>
            )}

            {/* Video Picker */}
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className="w-full p-5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-white/15 hover:border-[#00C853] bg-slate-50 dark:bg-black/30 flex flex-col items-center justify-center gap-2 transition-colors"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#00C853]/15 text-[#00C853] flex items-center justify-center">
                <FileVideo className="w-6 h-6" />
              </div>
              {selectedFile && videoMeta ? (
                <>
                  <span className="text-xs font-black text-slate-900 dark:text-white text-center">
                    {selectedFile.name} ({formatBytesToMb(selectedFile.size)} MB)
                  </span>
                  <span className="px-3 py-0.5 rounded-full bg-[#00C853] text-black text-[11px] font-black">
                    {videoMeta.isQuickKick ? '9:16 Quick Kick (≤60s)' : '16:9 Football Clip'} · {videoMeta.duration}s
                  </span>
                </>
              ) : (
                <>
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    Select Video File (MP4 / MOV · up to 500MB)
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-white/55 text-center">
                    Vertical 9:16 (max 60s) auto-routes to Quick Kicks · 16:9 clips auto-generate 3 thumbnails
                  </span>
                </>
              )}
            </button>

            {/* Title (max 80 chars) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-white/80">
                <label>Title (max 80 chars) *</label>
                <span className="font-mono text-slate-400">{title.length}/80</span>
              </div>
              <input
                type="text"
                required
                maxLength={80}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Saka curled top-bin stunner vs Spurs!"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00C853]"
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-white/80 block">
                Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Share match minute, club breakdown, and your original FanZone commentary..."
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00C853]"
              />
            </div>

            {/* Category + Visibility */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-white/80 block">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                >
                  {FUTUBE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-white/80 block">
                  Visibility
                </label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as any)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                >
                  <option value="public">Public (All Fans)</option>
                  <option value="squad">Squad Only (Connected Fans)</option>
                  <option value="private">Private (Only You)</option>
                </select>
              </div>
            </div>

            {/* Tags & Club */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-white/80 block">
                  Tags
                </label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="#PremierLeague #Arsenal #Goals"
                  className="w-full min-h-[44px] px-3 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-white/80 block">
                  Club / League
                </label>
                <input
                  type="text"
                  value={clubTag}
                  onChange={(e) => setClubTag(e.target.value)}
                  placeholder="Arsenal, Real Madrid..."
                  className="w-full min-h-[44px] px-3 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* 3 Auto-Generated Thumbnails + Custom Upload */}
            <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-black/35 border border-slate-200 dark:border-white/10">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-[#00C853]" />
                  <span>Clip Thumbnail (3 Auto-Generated or Custom)</span>
                </span>
                <button
                  type="button"
                  onClick={() => thumbInputRef.current?.click()}
                  className="px-3 py-1 rounded-full bg-white dark:bg-white/10 border border-slate-200 dark:border-white/15 text-[11px] font-bold text-slate-800 dark:text-white"
                >
                  {customThumbUploading ? 'Uploading...' : '+ Custom Cover'}
                </button>
              </div>

              {generatedThumbs.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {generatedThumbs.slice(0, 4).map((tUrl, idx) => (
                    <button
                      key={`${tUrl}-${idx}`}
                      type="button"
                      onClick={() => setSelectedThumbUrl(tUrl)}
                      className={`relative aspect-video rounded-xl overflow-hidden bg-black border-2 transition-colors ${
                        selectedThumbUrl === tUrl
                          ? 'border-[#00C853] ring-2 ring-[#00C853]/30'
                          : 'border-transparent opacity-80 hover:opacity-100'
                      }`}
                    >
                      <img src={tUrl} alt={`Frame ${idx + 1}`} className="w-full h-full object-contain bg-black" />
                      {selectedThumbUrl === tUrl && (
                        <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#00C853] text-black flex items-center justify-center">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 dark:text-white/50">
                  Select a video above to auto-generate 3 preview thumbnails, or upload a custom cover image.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!selectedFile || !title.trim()}
              className="w-full min-h-[46px] rounded-full bg-[#00C853] hover:bg-[#00b248] disabled:opacity-45 text-black font-black text-sm shadow-lg shadow-[#00C853]/25 flex items-center justify-center gap-2 transition-all"
            >
              <Upload className="w-4 h-4" />
              <span>Publish to Futfield Tube</span>
            </button>
          </form>
        )}

        {step === 'processing' && (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#00C853]/15 text-[#00C853] flex items-center justify-center mx-auto animate-pulse">
              <FutfieldTubeLogo size={40} />
            </div>
            <div className="space-y-1">
              <h3 className="font-display font-black text-base text-slate-900 dark:text-white">
                Processing Clip...
              </h3>
              <p className="text-xs text-slate-500 dark:text-white/60">{processStage}</p>
            </div>
            <div className="max-w-sm mx-auto space-y-1.5">
              <div className="h-2.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-[#00C853] transition-all duration-300"
                  style={{ width: `${processPct}%` }}
                />
              </div>
              <p className="text-xs font-mono font-bold text-[#00C853]">{processPct}%</p>
            </div>
          </div>
        )}

        {step === 'live' && liveVideo && (
          <div className="p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-[#00C853] text-black flex items-center justify-center mx-auto shadow-lg shadow-[#00C853]/30">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display font-black text-lg text-slate-900 dark:text-white">
                Clip is Live on Futfield Tube! 🔥
              </h3>
              <p className="text-xs text-slate-500 dark:text-white/60">
                {liveVideo.title} · {liveVideo.quality} {liveVideo.hasWatermark ? '· Futfield Watermark' : '· Pro HD'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => onPublished(liveVideo)}
                className="w-full sm:w-auto min-h-[42px] px-6 rounded-full bg-[#00C853] text-black font-black text-xs flex items-center justify-center gap-1.5"
              >
                <Zap className="w-4 h-4" />
                <span>Watch Clip Now</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto min-h-[42px] px-5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white font-bold text-xs"
              >
                Back to Feed
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
