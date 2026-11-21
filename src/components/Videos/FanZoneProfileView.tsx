import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  BellOff,
  CheckCircle2,
  Eye,
  Film,
  Flame,
  FolderHeart,
  Info,
  Play,
  ShieldCheck,
  Users,
  Zap,
} from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { FanZoneProfile, VideoItem } from '../../types/football';
import {
  fetchFanZoneProfile,
  toggleFutubeAlert,
  toggleFutubeConnect,
} from '../../services/supabaseClient';
import { FutfieldTubeLogo } from './FutfieldTubeLogo';
import { haptics } from '../../utils/haptics';
import { isCreatorEmail, isCreatorTarget } from '../../utils/creatorGuard';
import { SafeImage } from '../Common/SafeImage';

interface FanZoneProfileViewProps {
  usernameOrHandle: string;
  onBack: () => void;
  onOpenWatch: (video: VideoItem) => void;
  onOpenQuickKick: (video: VideoItem) => void;
}

function formatCompactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

export const FanZoneProfileView: React.FC<FanZoneProfileViewProps> = ({
  usernameOrHandle,
  onBack,
  onOpenWatch,
  onOpenQuickKick,
}) => {
  const { user, videos, addNotification } = useFootball();
  const [profile, setProfile] = useState<FanZoneProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'clips' | 'kicks' | 'packs' | 'about'>('clips');
  const [togglingConnect, setTogglingConnect] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchFanZoneProfile(usernameOrHandle, user.id)
      .then((res) => {
        if (cancelled) return;
        if (res) {
          setProfile(res);
        } else {
          // Build fallback profile from local videos if offline
          const norm = usernameOrHandle.startsWith('@')
            ? usernameOrHandle.toLowerCase()
            : `@${usernameOrHandle.toLowerCase()}`;
          const matching = videos.filter(
            (v) =>
              (v.fanzoneHandle || v.creator?.handle || '').toLowerCase() === norm ||
              (v.userId || '').toLowerCase() === usernameOrHandle.toLowerCase()
          );
          const first = matching[0];
          setProfile({
            id: norm,
            username: norm.replace(/^@/, ''),
            handle: norm,
            name: first?.fanzoneName || first?.creator?.name || `${norm.replace(/^@/, '')} FanZone`,
            avatar:
              first?.fanzoneAvatar ||
              first?.creator?.avatar ||
              (isCreatorTarget(norm) ? '/futfield-logo.jpg' : '/default-avatar.jpg'),
            bannerUrl: first?.fanzoneBanner || '/og-image.jpg',
            bio: first?.fanzoneBio || 'Gunners for life — Matchday highlights, tactical breakdowns & Quick Kicks ⚡',
            favoriteClub: first?.clubTag || 'Arsenal',
            squadCount: first?.squadCount || 1,
            clipsCount: matching.length,
            quickKicksCount: matching.filter((m) => m.isQuickKick).length,
            totalWatches: matching.reduce((acc, m) => acc + Number(m.watches ?? m.views ?? 0), 0),
            isConnected: Boolean(first?.creator?.isSubscribed),
            alertEnabled: Boolean(first?.alertEnabled),
            clips: matching.filter((m) => !m.isQuickKick),
            quickKicks: matching.filter((m) => m.isQuickKick),
            packs: [],
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [usernameOrHandle, user.id, videos]);

  const handleToggleConnect = async () => {
    if (!profile || togglingConnect) return;
    haptics.like();
    setTogglingConnect(true);
    const res = await toggleFutubeConnect(user.id, profile.handle);
    setTogglingConnect(false);
    if (res.blocked) {
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              isConnected: true,
              alertEnabled: res.alertEnabled,
              squadCount: res.squadCount || prev.squadCount,
            }
          : prev
      );
      addNotification({
        title: 'Official Creator Protected 🔒',
        body: res.error || 'Every account automatically follows the official Futfield Creator account.',
        type: 'system',
      });
      return;
    }
    if (res.success) {
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              isConnected: res.isConnected,
              alertEnabled: res.alertEnabled,
              squadCount: res.squadCount || prev.squadCount,
            }
          : prev
      );
      addNotification({
        title: res.isConnected ? `Connected to ${profile.name} ⚡` : `Disconnected from ${profile.name}`,
        body: res.isConnected
          ? 'You joined their Squad & unlocked Match Live Squad Chat.'
          : 'Removed from your connected FanZones.',
        type: 'follow',
      });
    }
  };

  const handleToggleAlert = async () => {
    if (!profile) return;
    haptics.light();
    const res = await toggleFutubeAlert(user.id, profile.handle);
    if (res.success) {
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              isConnected: res.isConnected,
              alertEnabled: res.alertEnabled,
            }
          : prev
      );
      addNotification({
        title: res.alertEnabled ? 'Matchday Alerts On 🔔' : 'Matchday Alerts Muted',
        body: res.alertEnabled
          ? `You'll be alerted when ${profile.name} drops new Clips or goes Match Live.`
          : `Alerts paused for ${profile.name}.`,
        type: 'system',
      });
    }
  };

  if (loading || !profile) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 space-y-3">
        <FutfieldTubeLogo size={40} className="animate-pulse" />
        <p className="text-xs font-bold text-slate-500 dark:text-white/60">Loading FanZone...</p>
      </div>
    );
  }

  return (
    <div className="pb-24 max-w-4xl mx-auto px-3 sm:px-4 pt-2 space-y-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white text-xs font-bold flex items-center gap-1.5 hover:border-[#00C853]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Futfield Tube</span>
        </button>
        <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#00C853]">
          <FutfieldTubeLogo size={22} />
          <span>FanZone</span>
        </div>
      </div>

      {/* Banner + Avatar + Connect Header */}
      <div className="rounded-3xl overflow-hidden bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10 shadow-sm">
        <div className="relative h-36 sm:h-48 w-full bg-gradient-to-br from-[#042312] via-[#063E1E] to-[#081018] overflow-hidden">
          {profile.bannerUrl && (
            <img
              src={profile.bannerUrl}
              alt={`${profile.name} banner`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover opacity-65"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
          {profile.favoriteClub && (
            <span className="absolute top-3 right-3 px-3 py-1 rounded-full bg-[#00C853] text-black font-black text-[11px] shadow">
              {profile.favoriteClub} FanZone
            </span>
          )}
        </div>

        <div className="px-4 sm:px-6 pb-5 -mt-10 relative space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="flex items-end gap-3.5">
              <SafeImage
                src={profile.avatar || '/default-avatar.jpg'}
                fallbackSrc="/default-avatar.jpg"
                alt={profile.name}
                loading="eager"
                wrapperClassName="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-4 border-white dark:border-[#12171F] shadow-xl bg-black"
                className="w-full h-full object-cover"
              />
              <div className="pb-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h1 className="font-display font-black text-lg sm:text-xl text-slate-900 dark:text-white">
                    {profile.name}
                  </h1>
                  <CheckCircle2 className="w-4 h-4 text-[#00C853]" />
                </div>
                <p className="text-xs font-mono text-slate-500 dark:text-white/60">
                  {profile.handle} · {formatCompactCount(profile.squadCount)} Squad
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleConnect}
                disabled={togglingConnect}
                className={`min-h-[42px] px-5 py-2 rounded-full font-extrabold text-xs flex items-center gap-1.5 transition-all active:scale-95 ${
                  profile.isConnected || (isCreatorTarget(profile.handle) && !isCreatorEmail(user.email))
                    ? 'bg-slate-200 dark:bg-white/15 text-slate-900 dark:text-white border border-slate-300 dark:border-white/20'
                    : 'bg-[#00C853] hover:bg-[#00b248] text-black shadow-md shadow-[#00C853]/25'
                }`}
              >
                {isCreatorTarget(profile.handle) && !isCreatorEmail(user.email) ? (
                  <span>Connected · Official 🔒</span>
                ) : profile.isConnected ? (
                  <span>Connected ✓</span>
                ) : (
                  <span>Connect ⚡</span>
                )}
              </button>

              <button
                type="button"
                onClick={handleToggleAlert}
                className={`min-h-[42px] min-w-[42px] px-3 py-2 rounded-full border font-bold text-xs flex items-center gap-1 transition-all ${
                  profile.alertEnabled
                    ? 'bg-[#00C853]/15 border-[#00C853] text-[#00C853]'
                    : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70'
                }`}
                title="Alert Notifications"
              >
                {profile.alertEnabled ? <Bell className="w-4 h-4 fill-current" /> : <BellOff className="w-4 h-4" />}
                <span className="hidden sm:inline">{profile.alertEnabled ? 'Alert On' : 'Alert'}</span>
              </button>
            </div>
          </div>

          {/* Bio */}
          <p className="text-xs sm:text-sm text-slate-700 dark:text-white/80 leading-relaxed">
            {profile.bio}
          </p>

          {/* FanZone Stats Bar */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/8 text-center">
              <div className="text-base sm:text-lg font-black font-mono text-slate-900 dark:text-white">
                {profile.clipsCount}
              </div>
              <div className="text-[11px] font-bold text-slate-500 dark:text-white/55">Clips</div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/8 text-center">
              <div className="text-base sm:text-lg font-black font-mono text-[#00C853]">
                {formatCompactCount(profile.squadCount)}
              </div>
              <div className="text-[11px] font-bold text-slate-500 dark:text-white/55">Squad</div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/8 text-center">
              <div className="text-base sm:text-lg font-black font-mono text-slate-900 dark:text-white">
                {formatCompactCount(profile.totalWatches)}
              </div>
              <div className="text-[11px] font-bold text-slate-500 dark:text-white/55">Total Watches</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Clips, Quick Kicks, Matchday Packs, About */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'clips', label: `Clips (${profile.clips.length})`, icon: Film },
          { id: 'kicks', label: `Quick Kicks (${profile.quickKicks.length})`, icon: Zap },
          { id: 'packs', label: `Matchday Packs (${profile.packs.length})`, icon: FolderHeart },
          { id: 'about', label: 'About', icon: Info },
        ].map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                haptics.light();
                setActiveTab(t.id as any);
              }}
              className={`min-h-[38px] px-4 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                active
                  ? 'bg-[#00C853] text-black shadow-sm'
                  : 'bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/75'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'clips' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {profile.clips.length === 0 ? (
            <div className="col-span-full py-12 text-center rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10">
              <p className="text-xs font-bold text-slate-500 dark:text-white/60">
                No widescreen Clips in this FanZone yet.
              </p>
            </div>
          ) : (
            profile.clips.map((clip) => (
              <div
                key={clip.id}
                onClick={() => onOpenWatch(clip)}
                className="rounded-2xl overflow-hidden bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10 cursor-pointer hover:border-[#00C853] transition-all group"
              >
                <div className="relative aspect-video bg-black overflow-hidden">
                  {clip.thumbnailUrl ? (
                    <img
                      src={clip.thumbnailUrl}
                      alt={clip.title}
                      className="w-full h-full object-contain bg-black transform-gpu"
                    />
                  ) : (
                    <video
                      src={clip.videoUrl}
                      muted
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-contain bg-black transform-gpu"
                    />
                  )}
                  <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono font-bold">
                    {clip.duration}
                  </span>
                </div>
                <div className="p-3 space-y-1">
                  <h3 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-2">
                    {clip.title}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-white/55 font-medium">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" /> {formatCompactCount(clip.watches ?? clip.views ?? 0)} Watches
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1 text-[#00C853] font-bold">
                      <Flame className="w-3 h-3" /> {formatCompactCount(clip.cheers ?? clip.likes ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'kicks' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {profile.quickKicks.length === 0 ? (
            <div className="col-span-full py-12 text-center rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10">
              <p className="text-xs font-bold text-slate-500 dark:text-white/60">
                No 9:16 Quick Kicks in this FanZone yet.
              </p>
            </div>
          ) : (
            profile.quickKicks.map((kick) => (
              <div
                key={kick.id}
                onClick={() => onOpenQuickKick(kick)}
                className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-black border border-slate-200 dark:border-white/10 cursor-pointer group"
              >
                {kick.thumbnailUrl ? (
                  <img
                    src={kick.thumbnailUrl}
                    alt={kick.title}
                    className="w-full h-full object-contain bg-black transform-gpu"
                  />
                ) : (
                  <video
                    src={kick.videoUrl}
                    muted
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-contain bg-black transform-gpu"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                <div className="absolute bottom-2.5 left-2.5 right-2.5 text-white space-y-1">
                  <p className="font-bold text-xs line-clamp-2">{kick.title}</p>
                  <p className="text-[10px] text-[#00C853] font-bold">
                    {formatCompactCount(kick.watches ?? kick.views ?? 0)} Watches · 🔥 {kick.cheers ?? kick.likes ?? 0}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'packs' && (
        <div className="space-y-3">
          {profile.packs.length === 0 ? (
            <div className="py-12 text-center rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10 space-y-1.5">
              <FolderHeart className="w-7 h-7 text-[#00C853] mx-auto" />
              <p className="text-xs font-bold text-slate-700 dark:text-white">No Matchday Packs created yet</p>
              <p className="text-[11px] text-slate-500 dark:text-white/50">
                Use &ldquo;Save to Matchday Pack&rdquo; while watching any clip to organize packs.
              </p>
            </div>
          ) : (
            profile.packs.map((pack) => (
              <div
                key={pack.id}
                className="p-4 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10 flex items-center justify-between"
              >
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{pack.name}</h4>
                  <p className="text-xs text-slate-500 dark:text-white/55">{pack.videoIds.length} saved clips</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-[#00C853]/15 text-[#00C853] text-xs font-extrabold">
                  Matchday Pack
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'about' && (
        <div className="p-5 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10 space-y-3">
          <h3 className="font-display font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#00C853]" />
            <span>About {profile.name}</span>
          </h3>
          <p className="text-xs text-slate-600 dark:text-white/75 leading-relaxed">{profile.bio}</p>
          <div className="grid grid-cols-2 gap-2.5 text-xs pt-2 border-t border-slate-100 dark:border-white/8">
            <div className="flex items-center gap-2 text-slate-600 dark:text-white/70">
              <Users className="w-4 h-4 text-[#00C853]" />
              <span>{formatCompactCount(profile.squadCount)} Connected Squad</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-white/70">
              <ShieldCheck className="w-4 h-4 text-[#00C853]" />
              <span>Non-Copyright Original Creator</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
