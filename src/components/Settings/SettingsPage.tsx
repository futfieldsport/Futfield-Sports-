import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  User,
  Bell,
  Palette,
  Wifi,
  Shield,
  HelpCircle,
  LogOut,
  ChevronRight,
  Check,
  CheckCircle2,
  RefreshCw,
  Zap,
  Smartphone,
  Monitor,
  Flame,
  Award,
  Database,
  Radio,
  Volume2,
  VolumeX,
  Lock,
  ExternalLink,
  Layers,
  Search,
  Eye,
  KeyRound,
  Trash2,
  AlertCircle,
  PlayCircle,
  Globe,
  Sliders,
  Activity,
  Crown,
  CreditCard,
  FileText,
  LifeBuoy,
  BookOpen,
  MessageSquare,
  Mail,
  Film,
  Play,
  Plus,
  Share2,
} from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { TOP_10_LEAGUES } from '../../data/top10LeaguesPlayers';
import { WORLD_COUNTRIES, getCountryFlag } from '../../data/worldCountries';
import { POPULAR_TOP_5_CLUBS } from '../../data/top5Clubs';
import { haptics } from '../../utils/haptics';
import { useHaptics } from '../../hooks/useHaptics';
import { fetchCopyrightEngineStatus } from '../../services/supabaseClient';
import { SubscriptionPage } from '../Subscription/SubscriptionPage';
import { DailyUsageTracker } from '../Common/DailyUsageTracker';
import { formatTodayFull } from '../../utils/dateFormat';
import { buildVideoShareUrl } from '../../utils/share';
import { isCreatorEmail, isReservedFutfieldText } from '../../utils/creatorGuard';

interface EngineStatusData {
  engine: string;
  version: string;
  provider: string;
  connected: boolean;
  pingLatencyMs: number;
  clientLatencyMs?: number;
  trackedLeaguesCount: number;
  top10LeaguesCoverage: number;
  registeredPlayersDatabase: number;
  supabaseConnected: boolean;
  aiAssistantActive: boolean;
  cachedMatchesCount?: number;
  timestamp: string;
}

function measureLocalStorageCache(): { formattedSize: string; keyCount: number } {
  try {
    let bytes = 0;
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const val = localStorage.getItem(k) || '';
      bytes += (k.length + val.length) * 2;
      count += 1;
    }
    if (bytes < 1024) return { formattedSize: `${bytes} B`, keyCount: count };
    if (bytes < 1024 * 1024) return { formattedSize: `${(bytes / 1024).toFixed(1)} KB`, keyCount: count };
    return { formattedSize: `${(bytes / (1024 * 1024)).toFixed(2)} MB`, keyCount: count };
  } catch {
    return { formattedSize: '0 KB', keyCount: 0 };
  }
}

export const SettingsPage: React.FC = () => {
  const {
    user,
    updateUser,
    setActiveTab,
    goBack,
    theme,
    setTheme,
    clubTheme,
    setClubTheme,
    mobileFrameMode,
    setMobileFrameMode,
    dataSavingMode,
    setDataSavingMode,
    refreshFrequency,
    setRefreshFrequency,
    goalSoundEnabled,
    setGoalSoundEnabled,
    cardAlertsEnabled,
    setCardAlertsEnabled,
    varAlertsEnabled,
    setVarAlertsEnabled,
    dmPrivacy,
    setDmPrivacy,
    readReceiptsEnabled,
    setReadReceiptsEnabled,
    clearAppCache,
    fetchLiveMatches,
    matches,
    logout,
    setAuthModalOpen,
    setShowIntro,
    setShowWelcome,
    setShowClubSelection,
    replaySplash,
    addFanPoints,
    addNotification,
    openSupportLegalPage,
    videos,
    deleteVideo,
    openTubeUpload,
    setTubeWatchVideoId,
    setTubeSubView,
    openShareSheet,
  } = useFootball();

  const todayFull = formatTodayFull();
  const {
    enabled: hapticsEnabled,
    isSupported: hapticsSupported,
    toggleEnabled: toggleHapticsEnabled,
    triggerNotificationToggle,
  } = useHaptics();

  const [activeSection, setActiveSection] = useState<
    'account' | 'content' | 'subscription' | 'notifications' | 'appearance' | 'data' | 'engine' | 'privacy' | 'about'
  >(() => {
    try {
      const target = sessionStorage.getItem('futfield_settings_section');
      if (target === 'content') {
        sessionStorage.removeItem('futfield_settings_section');
        return 'content';
      }
    } catch {}
    return 'account';
  });
  const [confirmDeleteVideoId, setConfirmDeleteVideoId] = useState<string | null>(null);

  const myUploadedVideos = React.useMemo(() => {
    const userHandleLower = (user.handle || '').toLowerCase();
    return videos.filter((v) => {
      if (v.userId && user.id && v.userId === user.id) return true;
      if (userHandleLower && (v.fanzoneHandle || '').toLowerCase() === userHandleLower) return true;
      if (userHandleLower && (v.creator?.handle || '').toLowerCase() === userHandleLower) return true;
      if (user.name && v.creator?.name === user.name) return true;
      if (v.id.startsWith('vid_upload')) return true;
      return false;
    });
  }, [videos, user.id, user.handle, user.name]);
  const [copyrightStats, setCopyrightStats] = useState<{
    engine: string;
    activeRulesCount: number;
    totalScans: number;
    totalBlocked: number;
  } | null>(null);

  // Real-time Cache Size tracker
  const [cacheMetrics, setCacheMetrics] = useState(() => measureLocalStorageCache());
  const [cacheClearedNotice, setCacheClearedNotice] = useState<string | null>(null);

  // Engine Diagnostics State
  const [engineStatus, setEngineStatus] = useState<EngineStatusData | null>(null);
  const [isPingingEngine, setIsPingingEngine] = useState<boolean>(false);
  const [pingSuccessNotice, setPingSuccessNotice] = useState<string | null>(null);

  // Edit Account details inside settings (keep synced with live user updates)
  const [editName, setEditName] = useState(user.name);
  const [editBio, setEditBio] = useState(user.bio);
  const [editClub, setEditClub] = useState(user.favoriteClub);
  const [editCountry, setEditCountry] = useState(user.favoriteCountry);
  const [saveAccountSuccess, setSaveAccountSuccess] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  useEffect(() => {
    setEditName(user.name);
    setEditBio(user.bio);
    setEditClub(user.favoriteClub);
    setEditCountry(user.favoriteCountry);
  }, [user.name, user.bio, user.favoriteClub, user.favoriteCountry]);

  useEffect(() => {
    if (activeSection === 'data') {
      setCacheMetrics(measureLocalStorageCache());
    }
    if (activeSection === 'privacy') {
      fetchCopyrightEngineStatus().then(stats => {
        if (stats) setCopyrightStats(stats);
      });
    }
  }, [activeSection]);

  // Password change modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<{ ok: boolean; text: string } | null>(null);

  // Clear cache confirmation
  const [showClearCacheModal, setShowClearCacheModal] = useState(false);

  // Fetch backend engine diagnostic on section mount
  const checkEngineStatus = async () => {
    setIsPingingEngine(true);
    setPingSuccessNotice(null);
    haptics.light();
    const clientStart = Date.now();

    try {
      const res = await fetch('/api/football/status');
      const clientLatencyMs = Math.max(1, Date.now() - clientStart);
      if (res.ok) {
        const data: EngineStatusData = await res.json();
        setEngineStatus({ ...data, clientLatencyMs });
        setPingSuccessNotice(
          `Engine Live (${clientLatencyMs}ms round-trip) · ${data.cachedMatchesCount ?? matches.length} matches cached · ${data.trackedLeaguesCount} leagues.`
        );
        haptics.success();
      } else {
        setPingSuccessNotice('Backend status unreachable — using local match cache.');
      }
    } catch {
      setPingSuccessNotice('Network offline — local cached match engine active.');
    } finally {
      setIsPingingEngine(false);
    }
  };

  useEffect(() => {
    if (activeSection === 'engine') {
      checkEngineStatus();
    }
  }, [activeSection]);

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setAccountError(null);
    const cleanName = editName.trim();
    if (!cleanName) return;
    if (!isCreatorEmail(user.email) && isReservedFutfieldText(cleanName)) {
      setAccountError('The name "Futfield" is strictly reserved for the official Futfield Creator account.');
      return;
    }
    haptics.success();
    updateUser({
      name: cleanName,
      bio: editBio.trim(),
      favoriteClub: editClub.trim() || 'Not Set',
      favoriteCountry: editCountry.trim() || 'Global',
      favoriteCountryFlag: getCountryFlag(editCountry.trim() || 'Global'),
    });
    setSaveAccountSuccess(true);
    setTimeout(() => setSaveAccountSuccess(false), 3000);
    addFanPoints(10, 'Saved Profile Settings');
    addNotification({
      title: 'Profile Settings Saved',
      body: 'Your fan identity details have been synced in real time.',
      type: 'system',
    });
  };

  const handleToggleGoalSound = (enabled: boolean) => {
    triggerNotificationToggle();
    setGoalSoundEnabled(enabled);
    if (enabled) {
      haptics.goalAlert();
    }
  };

  const handleToggleCardAlerts = (enabled: boolean) => {
    triggerNotificationToggle();
    setCardAlertsEnabled(enabled);
  };

  const handleToggleVarAlerts = (enabled: boolean) => {
    triggerNotificationToggle();
    setVarAlertsEnabled(enabled);
  };

  const handleChangeRefreshFrequency = (val: '15s' | '30s' | '60s') => {
    triggerNotificationToggle();
    setRefreshFrequency(val);
    fetchLiveMatches();
  };

  const handleSendTestAlert = () => {
    if (goalSoundEnabled) {
      haptics.goalAlert();
    } else {
      haptics.light();
    }
    addNotification({
      title: 'Live Matchday Alert Test ⚽',
      body: `Alerts active (${refreshFrequency} sync · Sound ${goalSoundEnabled ? 'ON' : 'OFF'} · Cards ${cardAlertsEnabled ? 'ON' : 'OFF'} · VAR ${varAlertsEnabled ? 'ON' : 'OFF'}).`,
      type: 'goal',
    });
  };

  const handleUpdatePasswordSubmit = async () => {
    if (newPassword.length < 6) {
      setPasswordNotice({ ok: false, text: 'Password must be at least 6 characters.' });
      return;
    }
    if (!user.email) {
      setPasswordNotice({ ok: false, text: 'Please sign in with your email account to update your password.' });
      return;
    }
    setUpdatingPassword(true);
    setPasswordNotice(null);
    try {
      const res = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          userId: user.id,
          newPassword,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        haptics.success();
        setPasswordNotice({ ok: true, text: data.message || `Password updated securely for ${user.email}.` });
        setNewPassword('');
        setTimeout(() => {
          setShowPasswordModal(false);
          setPasswordNotice(null);
        }, 1800);
      } else {
        setPasswordNotice({ ok: false, text: data.error || 'Could not update password.' });
      }
    } catch {
      setPasswordNotice({ ok: false, text: 'Network error while updating password.' });
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleClearAppCache = () => {
    haptics.medium();
    const { clearedKeys } = clearAppCache();
    setShowClearCacheModal(false);
    setCacheMetrics(measureLocalStorageCache());
    setCacheClearedNotice(`Cleared ${clearedKeys} cached storage buckets and re-synced live data.`);
    addNotification({
      title: 'Cache Cleared & Refreshed',
      body: 'Temporary local feeds cleared and latest live matches synced cleanly.',
      type: 'system',
    });
    setTimeout(() => setCacheClearedNotice(null), 4000);
  };

  const clubThemesList = [
    { id: 'default', label: 'Pitch Emerald', color: '#00E676', bgClass: 'bg-[#00E676]' },
    { id: 'arsenal', label: 'Arsenal Red', color: '#EF4444', bgClass: 'bg-red-500' },
    { id: 'barca', label: 'Barça Blaugrana', color: '#3B82F6', bgClass: 'bg-blue-500' },
    { id: 'madrid', label: 'Madrid Gold', color: '#F59E0B', bgClass: 'bg-amber-500' },
    { id: 'chelsea', label: 'Chelsea Royal', color: '#2563EB', bgClass: 'bg-blue-600' },
  ];

  return (
    <div className="pb-28 max-w-4xl mx-auto px-3 sm:px-4 pt-3 space-y-4 text-slate-900 dark:text-white">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              haptics.light();
              goBack();
            }}
            className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white/70 hover:text-black dark:hover:text-white transition-colors text-xs font-bold"
            title="Go back"
          >
            ← Back
          </button>
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 dark:text-[#00E676]" />
              FUTFIELD Settings
            </h1>
            <p className="text-xs text-slate-500 dark:text-white/55">
              Real-time account, pricing, live alerts &amp; engine controls · {todayFull}
            </p>
          </div>
        </div>

        {/* Quick Save Indicator */}
        {saveAccountSuccess && (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-[#00E676] border border-emerald-500/30 text-xs font-bold animate-fade-in">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Changes Saved
          </span>
        )}
      </div>

      {/* Main 9:16 Single-Column Stack: Compact Navigation + Detail Panel */}
      <div className="flex flex-col gap-3.5">
        {/* Settings Navigation Strip + Quick Auth */}
        <aside className="space-y-2 p-2.5 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm">
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { id: 'account', label: 'Account', icon: User, badge: user.isAuthenticated ? 'Verified' : 'Guest' },
              {
                id: 'content',
                label: 'Content Settings',
                icon: Film,
                highlight: true,
                badge: `${myUploadedVideos.length} Clips`,
              },
              {
                id: 'subscription',
                label: 'Pro Pass',
                icon: Crown,
                highlight: true,
                badge: user.isPro
                  ? user.proPlan === 'season'
                    ? 'Season VIP'
                    : user.proPlan === 'vip'
                    ? 'VIP'
                    : 'Pro'
                  : '$7.20/mo',
              },
              { id: 'notifications', label: 'Alerts & Haptics', icon: Bell, badge: refreshFrequency },
              { id: 'appearance', label: 'Theme & Pitch', icon: Palette },
              { id: 'data', label: 'Data & Cache', icon: Wifi, badge: dataSavingMode ? 'Low' : undefined },
              { id: 'engine', label: 'Live Engine', icon: Radio, highlight: true },
              { id: 'privacy', label: 'Privacy & Guard', icon: Shield },
              { id: 'about', label: 'Support', icon: HelpCircle },
            ].map(item => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    haptics.light();
                    setActiveSection(item.id as any);
                  }}
                  className={`w-full min-h-[42px] flex items-center justify-between px-2.5 py-2 rounded-2xl text-[11px] font-bold transition-all ${
                    isActive
                      ? 'bg-[#00E676] text-black shadow-md shadow-[#00E676]/20 font-extrabold'
                      : 'text-slate-600 hover:text-black dark:text-white/70 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-black' : item.highlight ? 'text-emerald-600 dark:text-[#00E676]' : 'text-slate-400 dark:text-white/60'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[9px] font-bold tabular-nums shrink-0 ${
                        isActive ? 'text-black/80' : 'text-emerald-700 dark:text-[#00E676]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Sign Out or In */}
          <div className="pt-1.5 border-t border-slate-100 dark:border-white/5">
            {user.isAuthenticated ? (
              <button
                onClick={() => {
                  haptics.light();
                  logout();
                }}
                className="w-full min-h-[40px] flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out of FUTFIELD</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  haptics.light();
                  setAuthModalOpen(true);
                }}
                className="w-full min-h-[40px] py-1.5 rounded-xl bg-[#00E676] text-black text-xs font-black shadow transition-all hover:bg-[#00c864]"
              >
                Sign In to FUTFIELD
              </button>
            )}
          </div>
        </aside>

        {/* Detail Panel */}
        <section className="space-y-4">
          {/* SECTION 1: ACCOUNT & SECURITY */}
          {activeSection === 'account' && (
            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-5">
              <div>
                <h2 className="font-display text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-600 dark:text-[#00E676]" />
                  Account &amp; Fan Profile
                </h2>
                <p className="text-xs text-slate-500 dark:text-white/55">
                  Manage your verified fan identity, email credentials, and profile details
                </p>
              </div>

              {/* User Email & Identity Badge */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200/70 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-[#00E676]"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-extrabold text-sm text-slate-900 dark:text-white">{user.name}</span>
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-[#00E676]">
                        · {user.isAuthenticated ? 'Verified Member' : 'Guest'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-white/55">
                      {user.email || 'Guest session · Sign in to link email'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono tabular-nums text-xs font-bold text-emerald-700 dark:text-[#00E676] bg-[#00E676]/10 px-2.5 py-1 rounded-lg border border-[#00E676]/20">
                    ⭐ {user.fanPoints.toLocaleString()} Fan Pts
                  </span>
                </div>
              </div>

              {/* Membership Tier & Paystack Pass Card */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-transparent border border-amber-500/30 dark:border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                    <Crown className="w-5 h-5 fill-amber-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                        {user.proPlan === 'season'
                          ? 'CHAMPIONSHIP SEASON PASS'
                          : user.membershipTier === 'vip'
                          ? 'CLUB VIP ULTRA PASS'
                          : user.isPro
                          ? 'MATCHDAY PRO PASS'
                          : 'FREE FAN STARTER (3/1/5 DAILY)'}
                      </span>
                      <span className="text-[10px] text-[#00E676] font-black uppercase">
                        · Active
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-white/60">
                      {user.isPro
                        ? 'Unlimited Posts, Futfield Tube & Match Rooms active via Paystack'
                        : 'Free tier: 3 posts/day · 1 Quick Kick/day · 5 room chats/day. Upgrade from $7.20/mo.'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    haptics.light();
                    setActiveSection('subscription');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-md active:scale-95"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>{user.isPro || (user.membershipTier && user.membershipTier !== 'free') ? 'Manage Subscription' : 'Upgrade with Paystack'}</span>
                </button>
              </div>

              {/* Edit Account Form */}
              <form onSubmit={handleSaveAccount} className="space-y-3.5">
                {accountError && (
                  <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs font-bold">
                    {accountError}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-white/70">Display Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full bg-slate-100 dark:bg-black/50 text-slate-900 dark:text-white text-xs rounded-xl p-2.5 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-[#00E676]"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-white/70">Account Email</label>
                    <input
                      type="email"
                      value={user.email || ''}
                      placeholder="Sign in to link email"
                      disabled
                      className="w-full bg-slate-100/70 dark:bg-black/30 text-slate-500 dark:text-white/50 text-xs rounded-xl p-2.5 border border-slate-200/60 dark:border-white/5 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-white/70">Fan Bio &amp; Status</label>
                  <textarea
                    rows={2}
                    value={editBio}
                    onChange={e => setEditBio(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-black/50 text-slate-900 dark:text-white text-xs rounded-xl p-2.5 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-[#00E676]"
                    placeholder="Tell the football world about your loyalty..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-white/70">
                      Favorite Club ({POPULAR_TOP_5_CLUBS.length}+ Clubs)
                    </label>
                    <input
                      type="text"
                      list="futfield-all-clubs"
                      value={editClub}
                      onChange={e => setEditClub(e.target.value)}
                      placeholder="Select or type any club..."
                      className="w-full min-h-[42px] bg-slate-100 dark:bg-black/50 text-slate-900 dark:text-white text-xs rounded-xl p-2.5 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-[#00E676]"
                    />
                    <datalist id="futfield-all-clubs">
                      {POPULAR_TOP_5_CLUBS.map(club => (
                        <option key={club.id} value={club.name}>
                          {club.leagueName} ({club.country})
                        </option>
                      ))}
                    </datalist>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-white/70">
                      Favorite Country ({WORLD_COUNTRIES.length} Countries)
                    </label>
                    <select
                      value={editCountry}
                      onChange={e => setEditCountry(e.target.value)}
                      className="w-full min-h-[42px] bg-slate-100 dark:bg-black/50 text-slate-900 dark:text-white text-xs rounded-xl p-2.5 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-[#00E676]"
                    >
                      {!WORLD_COUNTRIES.some(c => c.name === editCountry) && editCountry && (
                        <option value={editCountry} className="dark:bg-[#12171F]">
                          🌍 {editCountry}
                        </option>
                      )}
                      {WORLD_COUNTRIES.map(c => (
                        <option key={c.code + c.name} value={c.name} className="dark:bg-[#12171F]">
                          {c.flag} {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      haptics.light();
                      setPasswordNotice(null);
                      setShowPasswordModal(true);
                    }}
                    className="min-h-[40px] flex items-center gap-1.5 text-xs text-slate-600 dark:text-white/70 hover:text-black dark:hover:text-white underline underline-offset-4"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-emerald-600 dark:text-[#00E676]" />
                    Update Password
                  </button>

                  <button
                    type="submit"
                    className="min-h-[44px] px-5 py-2 rounded-xl bg-[#00E676] hover:bg-[#00c864] text-black font-extrabold text-xs shadow-md shadow-[#00E676]/20 transition-all active:scale-95"
                  >
                    Save Account Changes
                  </button>
                </div>
              </form>

              {/* Password Modal */}
              {showPasswordModal && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-black/60 border border-slate-200 dark:border-white/10 space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      Change Password {user.email ? `(${user.email})` : ''}
                    </h3>
                    <button
                      onClick={() => {
                        setShowPasswordModal(false);
                        setPasswordNotice(null);
                      }}
                      className="text-slate-400 hover:text-black dark:hover:text-white text-xs font-bold"
                    >
                      ✕
                    </button>
                  </div>
                  <input
                    type="password"
                    placeholder="Enter new secure password (min 6 chars)"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full bg-white dark:bg-black/60 text-slate-900 dark:text-white text-xs rounded-xl p-2.5 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-[#00E676]"
                  />
                  {passwordNotice && (
                    <div
                      className={`text-xs font-semibold ${
                        passwordNotice.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                      }`}
                    >
                      {passwordNotice.text}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={updatingPassword}
                      onClick={handleUpdatePasswordSubmit}
                      className="px-4 py-1.5 rounded-xl bg-[#00E676] text-black text-xs font-bold disabled:opacity-60"
                    >
                      {updatingPassword ? 'Updating...' : 'Confirm Password Update'}
                    </button>
                    {!user.email && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowPasswordModal(false);
                          setAuthModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-white/10 text-xs font-bold"
                      >
                        Sign In First
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION: CONTENT SETTINGS — UPLOADED VIDEOS LIST & DELETE */}
          {activeSection === 'content' && (
            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <Film className="w-4 h-4 text-emerald-600 dark:text-[#00E676]" />
                    <span>Content Settings · Uploaded Videos</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-white/55">
                    View, play, share, or delete your uploaded Futfield Tube clips and Quick Kicks
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    haptics.light();
                    setActiveTab('videos');
                    openTubeUpload();
                  }}
                  className="min-h-[40px] px-4 py-1.5 rounded-full bg-[#00E676] hover:bg-[#00c864] text-black font-black text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Upload Clip</span>
                </button>
              </div>

              {myUploadedVideos.length === 0 ? (
                <div className="py-10 px-4 rounded-2xl bg-slate-50 dark:bg-black/35 border border-slate-200/70 dark:border-white/10 text-center space-y-2.5">
                  <Film className="w-8 h-8 text-[#00E676] mx-auto" />
                  <h3 className="font-display font-extrabold text-sm text-slate-900 dark:text-white">
                    No uploaded videos yet
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-white/55 max-w-sm mx-auto">
                    Any clip or Quick Kick you upload to Futfield Tube will appear here so you can manage or delete it anytime.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      haptics.light();
                      setActiveTab('videos');
                      openTubeUpload();
                    }}
                    className="min-h-[40px] px-5 py-2 rounded-full bg-[#00E676] text-black font-black text-xs inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Upload First Video</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {myUploadedVideos.map((vid) => {
                    const isQuickKick = Boolean(vid.isQuickKick || vid.aspectRatio === '9:16');
                    const watchesCount = Number(vid.watches ?? vid.views ?? 0);
                    const cheersCount = Number(vid.cheers ?? vid.likes ?? 0);
                    return (
                      <div
                        key={vid.id}
                        className="p-3 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row sm:items-center gap-3"
                      >
                        <div
                          onClick={() => {
                            haptics.light();
                            setTubeWatchVideoId(vid.id);
                            setTubeSubView(isQuickKick ? 'kicks' : 'watch');
                            setActiveTab('videos');
                          }}
                          className="relative w-full sm:w-36 aspect-video rounded-xl overflow-hidden bg-black shrink-0 cursor-pointer border border-white/10"
                        >
                          {vid.thumbnailUrl ? (
                            <img
                              src={vid.thumbnailUrl}
                              alt={vid.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-contain bg-black"
                            />
                          ) : vid.videoUrl ? (
                            <video
                              src={vid.videoUrl}
                              muted
                              playsInline
                              preload="metadata"
                              className="w-full h-full object-contain bg-black"
                            />
                          ) : null}
                          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/85 text-white text-[10px] font-mono font-bold">
                            {vid.duration || '0:30'}
                          </span>
                          {isQuickKick && (
                            <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-[#00E676] text-black text-[9px] font-black">
                              Quick Kick
                            </span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <h3 className="font-display font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-2">
                            {vid.title}
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-white/60 font-mono">
                            {watchesCount} Watches · 🔥 {cheersCount} · {vid.privacy || 'Public'}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                haptics.light();
                                setTubeWatchVideoId(vid.id);
                                setTubeSubView(isQuickKick ? 'kicks' : 'watch');
                                setActiveTab('videos');
                              }}
                              className="min-h-[36px] px-3 py-1 rounded-xl bg-[#00E676]/15 hover:bg-[#00E676]/25 text-emerald-700 dark:text-[#00E676] font-bold text-xs flex items-center gap-1"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Watch</span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                openShareSheet({
                                  kind: 'video',
                                  targetId: vid.id,
                                  title: vid.title,
                                  text: `Watch "${vid.title}" on Futfield Tube!`,
                                  url: buildVideoShareUrl(vid.id),
                                  previewImage: vid.thumbnailUrl,
                                  videoUrl: vid.videoUrl,
                                })
                              }
                              className="min-h-[36px] px-3 py-1 rounded-xl bg-slate-200/80 dark:bg-white/10 text-slate-800 dark:text-white font-bold text-xs flex items-center gap-1"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              <span>Share</span>
                            </button>

                            {confirmDeleteVideoId === vid.id ? (
                              <div className="flex items-center gap-1.5 ml-auto">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await deleteVideo(vid.id);
                                    setConfirmDeleteVideoId(null);
                                  }}
                                  className="min-h-[36px] px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs"
                                >
                                  Confirm Delete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteVideoId(null)}
                                  className="min-h-[36px] px-2.5 py-1 rounded-xl bg-slate-200 dark:bg-white/15 text-slate-800 dark:text-white text-xs font-bold"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteVideoId(vid.id)}
                                className="min-h-[36px] px-3 py-1 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center gap-1 ml-auto"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SECTION: SUBSCRIPTION & PRO PASS (PAYSTACK WORLDWIDE GATEWAY) */}
          {activeSection === 'subscription' && (
            <div className="space-y-4">
              <DailyUsageTracker />
              <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm">
                <SubscriptionPage embedded />
              </div>
            </div>
          )}

          {/* SECTION 2: MATCHDAY & PUSH ALERTS */}
          {activeSection === 'notifications' && (
            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-5">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#00E676]" />
                  Matchday & Live Notifications
                </h2>
                <p className="text-xs text-slate-500 dark:text-white/50">
                  Configure real-time goal alerts, stadium sound effects, and whistle notices
                </p>
              </div>

              <div className="space-y-3">
                {/* Goal Alerts & Stadium Sound */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200/70 dark:border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-[#00E676]/10 text-[#00E676]">
                      {goalSoundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Goal Alerts & Stadium Audio</div>
                      <div className="text-[11px] text-slate-500 dark:text-white/50">
                        Plays electric stadium roar when a goal is scored in followed matches
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleGoalSound(!goalSoundEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      goalSoundEnabled ? 'bg-[#00E676]' : 'bg-slate-300 dark:bg-white/20'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white dark:bg-black shadow absolute top-1 transition-transform ${
                        goalSoundEnabled ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Red Card Alerts */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200/70 dark:border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-red-500/10 text-red-500">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Red Card & Penalty Drama</div>
                      <div className="text-[11px] text-slate-500 dark:text-white/50">
                        Instant notification when a penalty is awarded or red card brandished
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleCardAlerts(!cardAlertsEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      cardAlertsEnabled ? 'bg-[#00E676]' : 'bg-slate-300 dark:bg-white/20'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white dark:bg-black shadow absolute top-1 transition-transform ${
                        cardAlertsEnabled ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {/* VAR Alerts */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200/70 dark:border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                      <Radio className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">VAR Review Decisions</div>
                      <div className="text-[11px] text-slate-500 dark:text-white/50">
                        Pushes live VAR review updates (Goal checked, Offside, Penalty checked)
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleVarAlerts(!varAlertsEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      varAlertsEnabled ? 'bg-[#00E676]' : 'bg-slate-300 dark:bg-white/20'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white dark:bg-black shadow absolute top-1 transition-transform ${
                        varAlertsEnabled ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Tactile Browser Haptics Master Toggle */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200/70 dark:border-white/5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-[#00E676]/10 text-[#00E676]">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Tactile Browser Haptics</div>
                      <div className="text-[11px] text-slate-500 dark:text-white/50">
                        {hapticsSupported
                          ? 'Vibrate API feedback on voting, messaging & notification toggles'
                          : 'Device hardware does not expose Vibration API (visual feedback active)'}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleHapticsEnabled()}
                    aria-label="Toggle Browser Haptic Feedback"
                    className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                      hapticsEnabled ? 'bg-[#00E676]' : 'bg-slate-300 dark:bg-white/20'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white dark:bg-black shadow absolute top-1 transition-transform ${
                        hapticsEnabled ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Live Score Ticker Refresh Rate */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200/70 dark:border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Live Score Feed Sync Frequency</div>
                    <span className="text-[10px] font-bold text-[#00E676]">Active: every {refreshFrequency}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-white/50">
                    Real-time background sync interval for FotMob global match updates
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {([
                      { id: '15s', label: '15s (Ultra Live)' },
                      { id: '30s', label: '30s (Default)' },
                      { id: '60s', label: '60s (Saver)' },
                    ] as const).map(f => (
                      <button
                        key={f.id}
                        onClick={() => handleChangeRefreshFrequency(f.id)}
                        className={`min-h-[44px] py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                          refreshFrequency === f.id
                            ? 'bg-[#00E676] text-black font-extrabold shadow'
                            : 'bg-white dark:bg-white/5 text-slate-700 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Alert Verification Button */}
                <div className="pt-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500 dark:text-white/50">
                    Test push toast &amp; haptics with your active settings
                  </span>
                  <button
                    onClick={handleSendTestAlert}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-black font-extrabold text-xs hover:opacity-90 shrink-0"
                  >
                    Send Test Alert
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: CLUB THEME & APPEARANCE */}
          {activeSection === 'appearance' && (
            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-5">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Palette className="w-4 h-4 text-[#00E676]" />
                  Club Theme & Visual Identity
                </h2>
                <p className="text-xs text-slate-500 dark:text-white/50">
                  Custom color skins, pitch contrast modes, and mobile frame display
                </p>
              </div>

              {/* Club Colors Palette */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-900 dark:text-white">Club Accent Theme</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {clubThemesList.map(ct => (
                    <button
                      key={ct.id}
                      onClick={() => {
                        haptics.light();
                        setClubTheme(ct.id);
                      }}
                      className={`min-h-[44px] flex items-center justify-between p-3 rounded-2xl border transition-all ${
                        clubTheme === ct.id
                          ? 'border-[#00E676] bg-emerald-500/10 dark:bg-black/50 ring-1 ring-[#00E676]'
                          : 'border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-black/30 hover:bg-slate-100 dark:hover:bg-black/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="w-5 h-5 rounded-full shadow-inner"
                          style={{ backgroundColor: ct.color }}
                        />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{ct.label}</span>
                      </div>
                      {clubTheme === ct.id && <Check className="w-4 h-4 text-[#00E676]" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme Dark / Light */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200/70 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Pitch Lighting Mode</div>
                  <div className="text-[11px] text-slate-500 dark:text-white/50">
                    Switch between Floodlight Dark and Matchday Light
                  </div>
                </div>
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200 dark:bg-black/60 border border-slate-300 dark:border-white/10">
                  <button
                    onClick={() => {
                      haptics.light();
                      setTheme('dark');
                    }}
                    className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      theme === 'dark' ? 'bg-[#00E676] text-black font-extrabold shadow' : 'text-slate-700 dark:text-white/60'
                    }`}
                  >
                    Dark (Floodlights)
                  </button>
                  <button
                    onClick={() => {
                      haptics.light();
                      setTheme('light');
                    }}
                    className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      theme === 'light' ? 'bg-[#00E676] text-black font-extrabold shadow' : 'text-slate-700 dark:text-white/60'
                    }`}
                  >
                    Light
                  </button>
                </div>
              </div>

              {/* Full-Screen Standalone Layout */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200/70 dark:border-white/5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-slate-200 dark:bg-white/5 text-[#00E676]">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Full-Screen Standalone View</div>
                    <div className="text-[11px] text-slate-500 dark:text-white/50">
                      Edge-to-edge responsive layout across mobile and desktop
                    </div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-[#00E676] text-[11px] font-bold border border-[#00E676]/30 shrink-0">
                  Full Screen
                </span>
              </div>
            </div>
          )}

          {/* SECTION 4: DATA & OFFLINE MODE */}
          {activeSection === 'data' && (
            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-5">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-[#00E676]" />
                  Data Saving &amp; Weak Network Mode
                </h2>
                <p className="text-xs text-slate-500 dark:text-white/50">
                  Optimize performance and stream bandwidth for crowded stadium networks
                </p>
              </div>

              {/* Data Saving Mode Toggle */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200/70 dark:border-white/5 flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Stadium Low-Data Mode</div>
                  <div className="text-[11px] text-slate-500 dark:text-white/50">
                    {dataSavingMode
                      ? 'Active — pauses automatic video reel playback to conserve mobile data'
                      : 'Disables automatic video playback when switched on'}
                  </div>
                </div>
                <button
                  onClick={() => {
                    haptics.light();
                    setDataSavingMode(!dataSavingMode);
                  }}
                  aria-label="Toggle Stadium Low-Data Mode"
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                    dataSavingMode ? 'bg-[#00E676]' : 'bg-slate-300 dark:bg-white/20'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white dark:bg-black shadow absolute top-1 transition-transform ${
                      dataSavingMode ? 'right-1' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {/* Real-Time Cache Management */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200/70 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Local Cache Storage · {cacheMetrics.formattedSize}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-white/50">
                    {cacheMetrics.keyCount} active storage buckets (user session preserved on clear)
                  </div>
                </div>
                <button
                  onClick={() => setShowClearCacheModal(true)}
                  className="min-h-[44px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-bold transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Cache
                </button>
              </div>

              {cacheClearedNotice && (
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#00E676] shrink-0" />
                  <span>{cacheClearedNotice}</span>
                </div>
              )}

              {showClearCacheModal && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 space-y-2.5">
                  <div className="text-xs font-bold text-rose-600 dark:text-rose-300">Confirm Cache Purge</div>
                  <div className="text-[11px] text-slate-600 dark:text-white/70">
                    Clears cached feed/match buckets while keeping your signed-in account intact, then pulls fresh live scores immediately.
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleClearAppCache}
                      className="min-h-[44px] px-4 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-xs"
                    >
                      Yes, Clear Cache
                    </button>
                    <button
                      onClick={() => setShowClearCacheModal(false)}
                      className="min-h-[44px] px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-white text-xs font-bold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION 5: LIVE FOOTBALL ENGINE & DIAGNOSTICS */}
          {activeSection === 'engine' && (
            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <Radio className="w-4 h-4 text-[#00E676]" />
                    Live Football Backend Engine
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-white/50">
                    Real-time telemetry from Express engine, FotMob match feed &amp; player registry
                  </p>
                </div>

                <button
                  onClick={() => {
                    fetchLiveMatches();
                    checkEngineStatus();
                  }}
                  disabled={isPingingEngine}
                  className="min-h-[44px] flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#00E676]/10 hover:bg-[#00E676]/20 text-emerald-700 dark:text-[#00E676] border border-[#00E676]/30 text-xs font-bold transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isPingingEngine ? 'animate-spin' : ''}`} />
                  {isPingingEngine ? 'Pinging...' : 'Ping & Sync Live'}
                </button>
              </div>

              {pingSuccessNotice && (
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#00E676] shrink-0" />
                  <span>{pingSuccessNotice}</span>
                </div>
              )}

              {/* Live Status Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* FotMob Live Data Status */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200/70 dark:border-white/5 space-y-1.5">
                  <div className="flex justify-between items-center text-xs text-slate-500 dark:text-white/60">
                    <span>Live Match Provider</span>
                    <span className={`w-2 h-2 rounded-full ${engineStatus?.connected ? 'bg-[#00E676]' : 'bg-amber-400'}`} />
                  </div>
                  <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {engineStatus?.provider || 'FotMob Global Network'}
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-[#00E676] font-mono">
                    {engineStatus
                      ? `Connected · ${engineStatus.clientLatencyMs ?? engineStatus.pingLatencyMs}ms ping · ${refreshFrequency} sync`
                      : 'Checking live engine ping...'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-white/50 pt-1 border-t border-slate-200/60 dark:border-white/5">
                    {engineStatus?.cachedMatchesCount ?? matches.length} matches cached · {engineStatus?.trackedLeaguesCount ?? 79} leagues tracked
                  </div>
                </div>

                {/* Top 10 Leagues Player Database */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200/70 dark:border-white/5 space-y-1.5">
                  <div className="flex justify-between items-center text-xs text-slate-500 dark:text-white/60">
                    <span>Top 10 Leagues Players</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-[#00E676] text-[10px] font-bold">
                      {engineStatus?.top10LeaguesCoverage ?? 10}/10 Active
                    </span>
                  </div>
                  <div className="font-extrabold text-sm text-slate-900 dark:text-white">Global Player Registry</div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                    {engineStatus?.registeredPlayersDatabase
                      ? `${engineStatus.registeredPlayersDatabase} indexed stars + Live Scout`
                      : '10 Top Leagues + Live Scout Search'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-white/50 pt-1 border-t border-slate-200/60 dark:border-white/5">
                    Premier League, La Liga, Serie A, Bundesliga, MLS, Saudi Pro League &amp; more
                  </div>
                </div>

                {/* Database & Realtime */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200/70 dark:border-white/5 space-y-1.5">
                  <div className="flex justify-between items-center text-xs text-slate-500 dark:text-white/60">
                    <span>Database &amp; Realtime</span>
                    <Database className="w-3.5 h-3.5 text-[#00E676]" />
                  </div>
                  <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {engineStatus?.supabaseConnected ? 'Futfield PitchCloud Auth & Vault' : 'Realtime Live & Local Store'}
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                    {engineStatus?.supabaseConnected ? 'Synced via PitchCloud' : 'Active via Live Stadium stream'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-white/50 pt-1 border-t border-slate-200/60 dark:border-white/5">
                    Profiles, posts, clips analytics &amp; match chats synced in real time
                  </div>
                </div>

                {/* Futfield Tactical Engine */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200/70 dark:border-white/5 space-y-1.5">
                  <div className="flex justify-between items-center text-xs text-slate-500 dark:text-white/60">
                    <span>Match Telemetry</span>
                    <Activity className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <div className="font-extrabold text-sm text-slate-900 dark:text-white">Futfield PitchIQ Engine</div>
                  <div className="text-[11px] text-emerald-600 dark:text-[#00E676] font-mono">
                    {engineStatus?.aiAssistantActive ? 'Active on PitchCloud' : 'Tactical & Translation Rules Active'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-white/50 pt-1 border-t border-slate-200/60 dark:border-white/5">
                    Tactical xG summaries, win probabilities, and multi-language translation
                  </div>
                </div>
              </div>

              {/* Supported Top 10 Leagues Summary */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200/70 dark:border-white/5 space-y-2.5">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between">
                  <span>Top 10 Leagues Coverage</span>
                  <span className="text-[11px] text-[#00E676] font-bold">All 10 Included</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {TOP_10_LEAGUES.map(league => (
                    <div
                      key={league.id}
                      className="p-2 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 flex flex-col items-center text-center group hover:border-[#00E676]/40 transition-colors"
                    >
                      <span className="text-lg mb-1">{league.flag}</span>
                      <span className="text-[11px] font-bold text-slate-900 dark:text-white truncate max-w-full">
                        {league.name}
                      </span>
                      <span className="text-[9px] text-slate-500 dark:text-white/40">{league.clubsCount} Clubs</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 6: PRIVACY & SAFETY */}
          {activeSection === 'privacy' && (
            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-5">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#00E676]" />
                  Privacy, Moderation & Safety
                </h2>
                <p className="text-xs text-slate-500 dark:text-white/50">
                  Control fan interactions, content moderation, and fair play compliance
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200/70 dark:border-white/5 space-y-2">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Direct Messaging Privacy</div>
                  <div className="text-[11px] text-slate-500 dark:text-white/50">
                    Who can send you private match reactions and direct messages
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {([
                      { id: 'all', label: 'All Fans' },
                      { id: 'followers', label: 'Followers Only' },
                      { id: 'verified', label: 'Verified Only' },
                    ] as const).map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          haptics.light();
                          setDmPrivacy(opt.id);
                        }}
                        className={`min-h-[44px] py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                          dmPrivacy === opt.id
                            ? 'bg-[#00E676] text-black font-extrabold shadow'
                            : 'bg-white dark:bg-white/5 text-slate-700 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200/70 dark:border-white/5 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Read Receipts &amp; Room Presence</div>
                    <div className="text-[11px] text-slate-500 dark:text-white/50">
                      Show when you are active inside live Match Rooms
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      haptics.light();
                      setReadReceiptsEnabled(!readReceiptsEnabled);
                    }}
                    className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                      readReceiptsEnabled ? 'bg-[#00E676]' : 'bg-slate-300 dark:bg-white/20'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white dark:bg-black shadow absolute top-1 transition-transform ${
                        readReceiptsEnabled ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200/70 dark:border-white/5 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Smart Anti-Abuse & Filter</div>
                    <div className="text-[11px] text-slate-500 dark:text-white/50">
                      Automatically blocks abusive banter, racial slurs, and toxic spam in chat rooms
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-[#00E676] text-xs font-bold border border-emerald-500/30">
                    Active
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200/70 dark:border-white/5 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>MediaGuard Backend Copyright Detector</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-white/50">
                      {copyrightStats
                        ? `${copyrightStats.activeRulesCount} broadcaster & DRM rules · ${copyrightStats.totalScans} scans (${copyrightStats.totalBlocked} blocked)`
                        : 'Inspects ISO BMFF DRM atoms, broadcaster watermarks & rights hashes'}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-[#00E676] text-xs font-bold border border-emerald-500/30 shrink-0">
                    Enforced
                  </span>
                </div>

                {/* Legal & Privacy Documentation Links */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200/70 dark:border-white/5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Legal &amp; Compliance Documents</span>
                    <span className="text-[10px] text-slate-500 dark:text-white/50">Updated {todayFull}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => openSupportLegalPage('privacy')}
                      className="min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-left text-xs font-bold text-slate-800 dark:text-white hover:border-[#00E676]/50 flex items-center gap-2"
                    >
                      <Shield className="w-3.5 h-3.5 text-[#00E676]" />
                      <span>Privacy Policy</span>
                    </button>
                    <button
                      onClick={() => openSupportLegalPage('terms')}
                      className="min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-left text-xs font-bold text-slate-800 dark:text-white hover:border-[#00E676]/50 flex items-center gap-2"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-500" />
                      <span>Terms of Use</span>
                    </button>
                    <button
                      onClick={() => openSupportLegalPage('guidelines')}
                      className="min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-left text-xs font-bold text-slate-800 dark:text-white hover:border-[#00E676]/50 flex items-center gap-2"
                    >
                      <Shield className="w-3.5 h-3.5 text-amber-500" />
                      <span>Safety Guidelines</span>
                    </button>
                    <button
                      onClick={() => openSupportLegalPage('cookies')}
                      className="min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-left text-xs font-bold text-slate-800 dark:text-white hover:border-[#00E676]/50 flex items-center gap-2"
                    >
                      <Database className="w-3.5 h-3.5 text-purple-400" />
                      <span>Cookie Policy</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 7: ABOUT & ONBOARDING */}
          {activeSection === 'about' && (
            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-5">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-[#00E676]" />
                  About FUTFIELD, Support &amp; Resources
                </h2>
                <p className="text-xs text-slate-500 dark:text-white/50">
                  Platform date, support channels, resources, and onboarding replay · {todayFull}
                </p>
              </div>

              {/* Version Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-[#00E676]/5 to-transparent border border-emerald-500/20 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-xl font-black text-slate-900 dark:text-white">FUTFIELD</span>
                    <span className="text-xs font-bold font-mono text-emerald-700 dark:text-[#00E676]">v2.5.0</span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-white/60 font-medium">{todayFull}</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-white/80 leading-relaxed">
                  &quot;Where Fans Become Family&quot; — The definitive global social and live scores platform built for football lovers worldwide.
                </p>
                <div className="text-xs text-emerald-700 dark:text-[#00E676] font-semibold pt-1">
                  Official Support Email: futfieldsport@gmail.com
                </div>
              </div>

              {/* Direct Support & Resources */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-900 dark:text-white">Help, Resources &amp; Direct Support</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => openSupportLegalPage('support')}
                    className="min-h-[44px] flex items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-left text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <LifeBuoy className="w-4 h-4 text-[#00E676] shrink-0" />
                    <span>Customer Support</span>
                  </button>
                  <button
                    onClick={() => openSupportLegalPage('resources')}
                    className="min-h-[44px] flex items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-left text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <BookOpen className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Resource Center</span>
                  </button>
                  <button
                    onClick={() => openSupportLegalPage('contact')}
                    className="min-h-[44px] flex items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-left text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <MessageSquare className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>Contact Support</span>
                  </button>
                  <button
                    onClick={() => openSupportLegalPage('email')}
                    className="min-h-[44px] flex items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-left text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <Mail className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Email Support</span>
                  </button>
                </div>
              </div>

              {/* Tour and Intro Replay Triggers */}
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-900 dark:text-white">Interactive Onboarding Actions</div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    onClick={() => {
                      haptics.light();
                      sessionStorage.removeItem('futfield_intro_played');
                      setShowIntro(true);
                    }}
                    className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-left transition-all group"
                  >
                    <PlayCircle className="w-5 h-5 text-[#00E676] group-hover:scale-110 transition-transform" />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Replay Cinematic Intro</div>
                      <div className="text-[10px] text-slate-500 dark:text-white/50">5s motion screens 1 &amp; 2</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      haptics.light();
                      setShowWelcome(true);
                    }}
                    className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-left transition-all group"
                  >
                    <Globe className="w-5 h-5 text-emerald-500 group-hover:scale-110 transition-transform" />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Open Welcome Page</div>
                      <div className="text-[10px] text-slate-500 dark:text-white/50">Football Fan Welcome Hub</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      haptics.light();
                      setShowClubSelection(true);
                    }}
                    className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-left transition-all group"
                  >
                    <Award className="w-5 h-5 text-amber-500 group-hover:scale-110 transition-transform" />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Pick Favorite Club</div>
                      <div className="text-[10px] text-slate-500 dark:text-white/50">Launch club selector flow</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      haptics.light();
                      replaySplash();
                    }}
                    className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-left transition-all group"
                  >
                    <Zap className="w-5 h-5 text-blue-500 group-hover:scale-110 transition-transform" />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Replay Startup Splash</div>
                      <div className="text-[10px] text-slate-500 dark:text-white/50">Play FUTFIELD launch screen</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
