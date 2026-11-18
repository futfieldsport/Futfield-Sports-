import React, { useState, useEffect, useCallback } from 'react';
import {
  Flame,
  Shield,
  Target,
  Brain,
  Award,
  Users,
  Settings,
  ChevronRight,
  ChevronLeft,
  BarChart3,
  Calendar,
  AlertCircle,
  Activity,
  Globe,
  Crown,
  LifeBuoy,
  BookOpen,
  MessageSquare,
  Mail,
  FileText,
  RefreshCw,
  Cookie,
  Smartphone,
} from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { haptics } from '../../utils/haptics';
import { TOP_10_LEAGUES, LeagueInfo } from '../../data/top10LeaguesPlayers';
import { formatTodayFull, formatTodayShort } from '../../utils/dateFormat';
import { MatchdayPredictorView } from '../Hub/MatchdayPredictorView';
import { FootballIqArenaView } from '../Hub/FootballIqArenaView';

interface LiveLeagueItem extends LeagueInfo {
  fotmobId?: number;
  liveCount?: number;
  todayCount?: number;
}

export const MenuTab: React.FC = () => {
  const {
    user,
    addFanPoints,
    addNotification,
    setActiveTab,
    openSupportLegalPage,
    setPricingModalOpen,
    matches,
    communities,
    menuDedicatedPage,
    setMenuDedicatedPage,
  } = useFootball();

  const todayFull = formatTodayFull();
  const todayShort = formatTodayShort();

  // Active Dedicated View synced with Context: null = Menu Hub, or string = full sub-page
  const dedicatedPage = menuDedicatedPage;
  const setDedicatedPage = setMenuDedicatedPage;

  // Live Top 10 Leagues + Standings state
  const [liveLeagues, setLiveLeagues] = useState<LiveLeagueItem[]>(
    () => TOP_10_LEAGUES.map(l => ({ ...l, liveCount: 0, todayCount: 0 }))
  );
  const [leaguesLoading, setLeaguesLoading] = useState(false);
  const [leaguesSyncedAt, setLeaguesSyncedAt] = useState<string | null>(null);
  const [selectedLeagueTable, setSelectedLeagueTable] = useState<{
    leagueId: string;
    leagueName: string;
    standings: any[];
    source?: string;
    error?: string | null;
  } | null>(null);
  const [loadingTable, setLoadingTable] = useState(false);

  const fetchLiveLeagues = useCallback(async () => {
    setLeaguesLoading(true);
    try {
      const res = await fetch('/api/football/leagues');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.leagues) && data.leagues.length > 0) {
          setLiveLeagues(data.leagues);
          setLeaguesSyncedAt(data.syncedAt || new Date().toISOString());
        }
      }
    } catch {}
    setLeaguesLoading(false);
  }, []);

  const fetchLeagueTable = async (leagueId: string, leagueName: string) => {
    haptics.light();
    setLoadingTable(true);
    setSelectedLeagueTable({ leagueId, leagueName, standings: [], error: null });
    try {
      const res = await fetch(`/api/football/leagues/${encodeURIComponent(leagueId)}/table`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success && Array.isArray(data.standings) && data.standings.length > 0) {
        setSelectedLeagueTable({
          leagueId,
          leagueName: data.leagueName || leagueName,
          standings: data.standings,
          source: data.source || 'FotMob Live Standings',
          error: null,
        });
      } else {
        setSelectedLeagueTable({
          leagueId,
          leagueName,
          standings: [],
          error: data?.error || 'Live table standings are temporarily unavailable for this competition.',
        });
      }
    } catch {
      setSelectedLeagueTable({
        leagueId,
        leagueName,
        standings: [],
        error: 'Network error loading live league standings.',
      });
    }
    setLoadingTable(false);
  };

  useEffect(() => {
    fetchLiveLeagues();
  }, [fetchLiveLeagues]);

  useEffect(() => {
    if (dedicatedPage === 'leagues') {
      fetchLiveLeagues();
    }
  }, [dedicatedPage, fetchLiveLeagues]);

  return (
    <div className="pb-24 max-w-2xl mx-auto px-3 sm:px-4 pt-3 space-y-4">
      {/* ============================================================= */}
      {/* 1. DEDICATED SUB-PAGE HEADER (if inside a sub-feature) */}
      {/* ============================================================= */}
      {dedicatedPage && (
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/10">
          <button
            onClick={() => {
              haptics.light();
              setDedicatedPage(null);
            }}
            className="min-h-[40px] px-2.5 flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-white hover:text-emerald-700 dark:hover:text-[#00E676] transition-colors rounded-xl"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Menu Hub</span>
          </button>
          <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-[#00E676] uppercase">
            {dedicatedPage === 'predictor'
              ? 'Matchday Predictor'
              : dedicatedPage === 'leagues'
              ? 'Leagues Radar'
              : dedicatedPage === 'arena'
              ? 'Football IQ Arena'
              : 'Points Vault'}
          </span>
        </div>
      )}

      {/* ============================================================= */}
      {/* MAIN MENU HUB OVERVIEW (when dedicatedPage === null) */}
      {/* ============================================================= */}
      {!dedicatedPage && (
        <div className="space-y-4">
          {/* Header Card */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h1 className="font-display text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-600 dark:text-[#00E676] shrink-0" />
                  <span>FUTFIELD Hub</span>
                </h1>
                <p className="text-xs text-slate-500 dark:text-white/55 truncate">
                  Matchday Predictor, Football IQ Arena, live leagues &amp; creator tools · {todayFull}
                </p>
              </div>
              <button
                onClick={() => {
                  haptics.light();
                  setActiveTab('scores');
                }}
                className="min-h-[44px] px-3.5 py-1.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-[#00E676] border border-emerald-500/30 dark:border-[#00E676]/30 text-xs font-bold flex items-center gap-1.5 shrink-0 whitespace-nowrap"
              >
                <Activity className="w-3.5 h-3.5" />
                <span className="tabular-nums">{matches.length} Matches Today</span>
              </button>
            </div>
          </div>

          {/* Quick Hub Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Matchday Predictor League */}
            <button
              onClick={() => {
                haptics.light();
                setDedicatedPage('predictor');
              }}
              className="p-3.5 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm hover:border-[#00E676]/50 transition-all text-left space-y-2"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-[#00E676] flex items-center justify-center">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-xs text-slate-900 dark:text-white">
                  Matchday Predictor
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-white/55">
                  Call match scores &amp; climb the leaderboard
                </p>
              </div>
            </button>

            {/* Global League Radar */}
            <button
              onClick={() => {
                haptics.light();
                setDedicatedPage('leagues');
              }}
              className="p-3.5 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm hover:border-[#00E676]/50 transition-all text-left space-y-2"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-xs text-slate-900 dark:text-white">
                  Top 10 Leagues
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-white/55">
                  Premier League, UCL, La Liga &amp; more
                </p>
              </div>
            </button>

            {/* Football IQ Arena */}
            <button
              onClick={() => {
                haptics.light();
                setDedicatedPage('arena');
              }}
              className="p-3.5 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm hover:border-[#00E676]/50 transition-all text-left space-y-2"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-xs text-slate-900 dark:text-white">
                  Football IQ Arena
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-white/55">
                  Timed trivia &amp; live football fan polls
                </p>
              </div>
            </button>

            {/* Fan Points & Rewards Vault */}
            <button
              onClick={() => {
                haptics.light();
                setDedicatedPage('vault');
              }}
              className="p-3.5 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm hover:border-[#00E676]/50 transition-all text-left space-y-2"
            >
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-500 dark:text-purple-400 flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-xs text-slate-900 dark:text-white">
                  Points Vault
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-white/55 tabular-nums">
                  +{user.fanPoints} FP earned · Track progress
                </p>
              </div>
            </button>
          </div>

          {/* Quick Action Navigation Rows */}
          <div className="p-3 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm divide-y divide-slate-100 dark:divide-white/5 text-xs">
            <button
              onClick={() => {
                haptics.light();
                setPricingModalOpen(true);
              }}
              className="w-full flex items-center justify-between p-2.5 hover:bg-emerald-500/10 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <Crown className="w-4 h-4 text-[#00E676] fill-[#00E676]" />
                <span className="font-extrabold text-slate-800 dark:text-white">Futfield Pro Pricing & Subscription</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-[#00E676] text-[10px] font-black uppercase">
                  {user.isPro
                    ? user.proPlan === 'season'
                      ? 'Season VIP'
                      : user.proPlan === 'vip'
                      ? 'VIP Active'
                      : 'Pro Active'
                    : 'Upgrade'}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </button>

            <button
              onClick={() => {
                haptics.light();
                setActiveTab('studio');
              }}
              className="w-full flex items-center justify-between p-2.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded-2xl transition-all"
            >
              <div className="flex items-center gap-2.5">
                <BarChart3 className="w-4 h-4 text-[#00E676]" />
                <span className="font-extrabold text-slate-800 dark:text-white">FUTFIELD Creator Studio</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={() => {
                haptics.light();
                setActiveTab('videos');
              }}
              className="w-full flex items-center justify-between p-2.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded-2xl transition-all"
            >
              <div className="flex items-center gap-2.5">
                <Flame className="w-4 h-4 text-[#00E676]" />
                <span className="font-extrabold text-slate-800 dark:text-white">Futfield Tube Clips</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={() => {
                haptics.light();
                setActiveTab('blog');
              }}
              className="w-full flex items-center justify-between p-2.5 hover:bg-emerald-500/10 rounded-2xl transition-all"
            >
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 text-[#00E676]" />
                <span className="font-extrabold text-slate-800 dark:text-white">Futfield Football Blog (5 Guides)</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={() => {
                haptics.light();
                setActiveTab('reviews');
              }}
              className="w-full flex items-center justify-between p-2.5 hover:bg-amber-500/10 rounded-2xl transition-all"
            >
              <div className="flex items-center gap-2.5">
                <Award className="w-4 h-4 text-amber-500" />
                <span className="font-extrabold text-slate-800 dark:text-white">Fan Reviews &amp; Opinion Blog</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={() => {
                haptics.light();
                setActiveTab('communities');
              }}
              className="w-full flex items-center justify-between p-2.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded-2xl transition-all"
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-blue-400" />
                <span className="font-extrabold text-slate-800 dark:text-white">Fan Communities ({communities.length})</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={() => {
                haptics.light();
                setActiveTab('share');
              }}
              className="w-full flex items-center justify-between p-2.5 hover:bg-emerald-500/10 rounded-2xl transition-all"
            >
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-4 h-4 text-[#00E676]" />
                <span className="font-extrabold text-slate-800 dark:text-white">Share App &amp; Connect to Phone</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-emerald-700 dark:text-[#00E676]">SMS · QR</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </button>

            <button
              onClick={() => {
                haptics.light();
                setActiveTab('settings');
              }}
              className="w-full flex items-center justify-between p-2.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded-2xl transition-all"
            >
              <div className="flex items-center gap-2.5">
                <Settings className="w-4 h-4 text-slate-400" />
                <span className="font-extrabold text-slate-800 dark:text-white">App Settings & Personalization</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Stacked Trust, Support, Resources & Legal Directory */}
          <div className="p-4 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-extrabold text-sm text-slate-900 dark:text-white">
                  Support, Resources &amp; Legal
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-white/55">
                  Help center, guides, privacy &amp; compliance · {todayFull}
                </p>
              </div>
              <Calendar className="w-4 h-4 text-emerald-600 dark:text-[#00E676] shrink-0" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  haptics.light();
                  openSupportLegalPage('support');
                }}
                className="min-h-[56px] p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/5 hover:border-[#00E676]/50 text-left space-y-1 transition-all"
              >
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900 dark:text-white">
                  <LifeBuoy className="w-4 h-4 text-[#00E676]" />
                  <span>Customer Support</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-white/50">
                  FAQ &amp; tickets · {todayShort}
                </p>
              </button>

              <button
                onClick={() => {
                  haptics.light();
                  openSupportLegalPage('resources');
                }}
                className="min-h-[56px] p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/5 hover:border-[#00E676]/50 text-left space-y-1 transition-all"
              >
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900 dark:text-white">
                  <BookOpen className="w-4 h-4 text-amber-500" />
                  <span>Resource Center</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-white/50">
                  Guides &amp; docs · {todayShort}
                </p>
              </button>

              <button
                onClick={() => {
                  haptics.light();
                  openSupportLegalPage('contact');
                }}
                className="min-h-[56px] p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/5 hover:border-[#00E676]/50 text-left space-y-1 transition-all"
              >
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900 dark:text-white">
                  <MessageSquare className="w-4 h-4 text-blue-500" />
                  <span>Contact Support</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-white/50">
                  Send ticket · {todayShort}
                </p>
              </button>

              <button
                onClick={() => {
                  haptics.light();
                  openSupportLegalPage('email');
                }}
                className="min-h-[56px] p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/5 hover:border-[#00E676]/50 text-left space-y-1 transition-all"
              >
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900 dark:text-white">
                  <Mail className="w-4 h-4 text-emerald-500" />
                  <span>Email Support</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-white/50 truncate">
                  futfieldsport@gmail.com
                </p>
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-white/5 text-xs pt-1">
              {[
                { id: 'privacy' as const, label: 'Privacy Policy', icon: Shield },
                { id: 'terms' as const, label: 'Terms of Use', icon: FileText },
                { id: 'refund' as const, label: 'Refund & Billing Policy', icon: RefreshCw },
                { id: 'guidelines' as const, label: 'Community Safety & Guidelines', icon: Users },
                { id: 'cookies' as const, label: 'Cookie & Local Storage Policy', icon: Cookie },
              ].map(doc => {
                const Icon = doc.icon;
                return (
                  <button
                    key={doc.id}
                    onClick={() => {
                      haptics.light();
                      openSupportLegalPage(doc.id);
                    }}
                    className="w-full min-h-[44px] flex items-center justify-between py-2 px-1.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 text-slate-500 dark:text-white/60" />
                      <span className="font-bold text-slate-800 dark:text-white">{doc.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span>{todayShort}</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* SUB-PAGE 1: MATCHDAY PREDICTOR LEAGUE */}
      {/* ============================================================= */}
      {dedicatedPage === 'predictor' && <MatchdayPredictorView />}

      {/* ============================================================= */}
      {/* SUB-PAGE 2: TOP 10 LEAGUES RADAR (LIVE API SYNC) */}
      {/* ============================================================= */}
      {dedicatedPage === 'leagues' && (
        <div className="p-4 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-[#00E676]" />
                Official Top 10 Leagues Radar
              </h3>
              <p className="text-xs text-slate-500 dark:text-white/50">
                Real-time standings &amp; live fixture counts · {leaguesSyncedAt ? 'Live Synced' : 'FotMob Network'}
              </p>
            </div>
            <button
              onClick={() => {
                haptics.light();
                fetchLiveLeagues();
              }}
              disabled={leaguesLoading}
              aria-label="Refresh Top 10 Leagues"
              className="min-h-[38px] px-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white/80 text-xs font-bold flex items-center gap-1 hover:bg-emerald-500/15"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${leaguesLoading ? 'animate-spin text-[#00E676]' : ''}`} />
              <span>Sync</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {liveLeagues.map(league => (
              <div
                key={league.id}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xl shrink-0">{league.flag}</span>
                  <div className="min-w-0">
                    <h4 className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                      {league.name}
                    </h4>
                    <span className="text-[10px] text-slate-500 dark:text-white/50 block truncate tabular-nums">
                      {league.country} · {league.clubsCount} Clubs
                      {(league.liveCount || 0) > 0 && (
                        <strong className="text-rose-500 ml-1">· {league.liveCount} LIVE</strong>
                      )}
                      {(league.liveCount || 0) === 0 && (league.todayCount || 0) > 0 && (
                        <strong className="text-emerald-600 dark:text-[#00E676] ml-1">· {league.todayCount} Today</strong>
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => fetchLeagueTable(league.id, league.name)}
                    className="min-h-[36px] px-2.5 py-1 rounded-xl bg-[#00E676] text-black font-extrabold text-[10px] transition-all hover:bg-emerald-400"
                  >
                    Table
                  </button>
                  <button
                    onClick={() => {
                      haptics.light();
                      setActiveTab('scores');
                    }}
                    className="min-h-[36px] px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white/80 font-bold text-[10px] transition-all hover:bg-slate-200 dark:hover:bg-white/20"
                  >
                    Fixtures
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live League Table Standings Modal */}
      {selectedLeagueTable && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg max-h-[85vh] bg-white dark:bg-[#111720] rounded-3xl border border-slate-200 dark:border-white/10 p-5 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#00E676]" />
                  {selectedLeagueTable.leagueName} Standings
                </h3>
                <span className="text-[10px] text-slate-500 dark:text-white/50">
                  {selectedLeagueTable.source || 'Live table, points & goals gap'}
                </span>
              </div>
              <button
                onClick={() => setSelectedLeagueTable(null)}
                aria-label="Close standings"
                className="min-h-[38px] min-w-[38px] rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-1.5 no-scrollbar">
              {loadingTable ? (
                <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
                  Loading real-time standings from live league API...
                </div>
              ) : selectedLeagueTable.error ? (
                <div className="p-6 text-center space-y-3">
                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                  <p className="text-xs text-slate-600 dark:text-white/75">{selectedLeagueTable.error}</p>
                  <button
                    onClick={() => fetchLeagueTable(selectedLeagueTable.leagueId, selectedLeagueTable.leagueName)}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[#00E676] text-black text-xs font-extrabold"
                  >
                    Retry Live Feed
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-1 px-3 py-1.5 text-[10px] font-black uppercase text-slate-400 bg-slate-100 dark:bg-white/5 rounded-xl">
                    <span className="col-span-1 text-center">#</span>
                    <span className="col-span-4">Club</span>
                    <span className="col-span-1 text-center">P</span>
                    <span className="col-span-1 text-center">W</span>
                    <span className="col-span-2 text-center">GD</span>
                    <span className="col-span-1 text-center">Gap</span>
                    <span className="col-span-2 text-right">Pts</span>
                  </div>

                  {selectedLeagueTable.standings?.map((row: any, idx: number) => {
                    const leaderPts = selectedLeagueTable.standings?.[0]?.points ?? row.points;
                    const gap = typeof row.pointsGap === 'number' ? row.pointsGap : Math.max(0, leaderPts - (row.points ?? 0));
                    return (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-1 px-3 py-2 text-xs items-center rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 tabular-nums"
                      >
                        <span className="col-span-1 font-mono font-bold text-center text-slate-500">
                          {row.position}
                        </span>
                        <div className="col-span-4 flex items-center gap-1.5 min-w-0">
                          {row.logoUrl && (
                            <img
                              src={row.logoUrl}
                              alt={row.teamName}
                              className="w-4 h-4 object-contain shrink-0"
                              onError={e => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          )}
                          <span className="font-extrabold text-slate-900 dark:text-white truncate">
                            {row.teamName}
                          </span>
                        </div>
                        <span className="col-span-1 font-mono text-center text-slate-600 dark:text-white/70">
                          {row.played}
                        </span>
                        <span className="col-span-1 font-mono text-center text-slate-600 dark:text-white/70">
                          {row.won}
                        </span>
                        <span className={`col-span-2 font-mono text-center font-bold ${row.goalDifference > 0 ? 'text-emerald-500' : row.goalDifference < 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                          {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                        </span>
                        <span className="col-span-1 font-mono text-center text-[11px] font-bold text-amber-500 dark:text-amber-400">
                          {gap === 0 ? '—' : `-${gap}`}
                        </span>
                        <span className="col-span-2 font-mono text-right font-black text-emerald-700 dark:text-[#00E676]">
                          {row.points}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* SUB-PAGE 3: FOOTBALL IQ ARENA */}
      {/* ============================================================= */}
      {dedicatedPage === 'arena' && <FootballIqArenaView />}

      {/* ============================================================= */}
      {/* SUB-PAGE 4: FAN POINTS & REWARDS VAULT */}
      {/* ============================================================= */}
      {dedicatedPage === 'vault' && (
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-display font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <Award className="w-4 h-4 text-emerald-600 dark:text-[#00E676]" />
                Fan Points &amp; Creator Vault
              </h3>
              <p className="text-xs text-slate-500 dark:text-white/55">
                Official rules and points progression on FUTFIELD
              </p>
            </div>
            <span className="text-xl font-black text-emerald-700 dark:text-[#00E676] font-mono tabular-nums shrink-0">
              +{user.fanPoints} FP
            </span>
          </div>

          <div className="space-y-2 pt-2">
            {[
              { rule: 'Upload Football Video in Studio', pts: '+20 FP' },
              { rule: 'Publish Tactical Match Post', pts: '+10 FP' },
              { rule: 'Design & Export Matchday Thumbnail', pts: '+30 FP' },
              { rule: 'Heart a Fan Comment', pts: '+5 FP' },
              { rule: 'React / Like a Match or Post', pts: '+2 FP' },
              { rule: 'Verified Blue Check Unlock', pts: '500 FP Threshold' },
            ].map(item => (
              <div
                key={item.rule}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 flex items-center justify-between text-xs"
              >
                <span className="font-bold text-slate-800 dark:text-white">{item.rule}</span>
                <span className="font-mono tabular-nums font-black text-emerald-700 dark:text-[#00E676] shrink-0 ml-2">{item.pts}</span>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <button
              onClick={() => {
                haptics.light();
                setActiveTab('studio');
              }}
              className="w-full min-h-[44px] py-2.5 rounded-2xl bg-[#00E676] hover:bg-[#00C853] text-black font-extrabold text-xs shadow-md shadow-[#00E676]/20"
            >
              Go to Creator Studio to Earn Points
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
