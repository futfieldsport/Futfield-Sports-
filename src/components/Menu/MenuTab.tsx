import React, { useState } from 'react';
import {
  BrainCircuit,
  Shield,
  Layers,
  Award,
  Trophy,
  Search,
  Users,
  Settings,
  ChevronRight,
  ChevronLeft,
  Filter,
  BarChart3,
  Calendar,
  CheckCircle2,
  Share2,
  Plus,
  Play,
  RotateCcw,
  Zap,
  Activity,
  Globe,
  Sliders,
  Crown,
  CreditCard,
  LifeBuoy,
  BookOpen,
  MessageSquare,
  Mail,
  FileText,
  RefreshCw,
  Cookie,
} from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { ClubLogo } from '../Common/ClubLogo';
import { haptics } from '../../utils/haptics';
import { TOP_10_LEAGUES, TOP_10_LEAGUE_PLAYERS, FootballPlayer } from '../../data/top10LeaguesPlayers';
import { formatTodayFull, formatTodayShort } from '../../utils/dateFormat';

export const MenuTab: React.FC = () => {
  const {
    user,
    addFanPoints,
    addNotification,
    setPlayerScoutModalOpen,
    setAiDrawerOpen,
    setActiveTab,
    openSupportLegalPage,
    setPricingModalOpen,
    matches,
    openMatchRoom,
    communities,
    setSelectedCommunity,
  } = useFootball();

  const todayFull = formatTodayFull();
  const todayShort = formatTodayShort();

  // Active Dedicated View: null = Menu Hub, or string = full sub-page
  const [dedicatedPage, setDedicatedPage] = useState<'tactics' | 'leagues' | 'scout' | 'vault' | null>(null);
  const [selectedLeagueTable, setSelectedLeagueTable] = useState<any | null>(null);
  const [loadingTable, setLoadingTable] = useState(false);

  const fetchLeagueTable = async (leagueId: string, leagueName: string) => {
    haptics.light();
    setLoadingTable(true);
    setSelectedLeagueTable({ leagueName, standings: [] });
    try {
      const res = await fetch(`/api/football/leagues/${encodeURIComponent(leagueId)}/table`);
      if (res.ok) {
        const data = await res.json();
        setSelectedLeagueTable(data);
      }
    } catch {}
    setLoadingTable(false);
  };

  // -------------------------------------------------------------
  // FEATURE 1: TACTICAL PITCH ARCHITECT (100% Real Interactive Board)
  // -------------------------------------------------------------
  const [formation, setFormation] = useState<'4-3-3' | '4-2-3-1' | '3-5-2' | '4-4-2' | '5-3-2'>('4-3-3');
  const [mentality, setMentality] = useState<'press' | 'possession' | 'counter' | 'balanced'>('press');
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);

  // Lineup slots based on selected formation
  const formationPositions: Record<string, string[]> = {
    '4-3-3': ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'CDM', 'CM', 'LW', 'ST', 'RW'],
    '4-2-3-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CDM', 'CAM', 'LM', 'ST', 'RM'],
    '3-5-2': ['GK', 'CB', 'CB', 'CB', 'LWB', 'CM', 'CDM', 'CM', 'RWB', 'ST', 'ST'],
    '4-4-2': ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'],
    '5-3-2': ['GK', 'LWB', 'CB', 'CB', 'CB', 'RWB', 'CM', 'CM', 'CM', 'ST', 'ST'],
  };

  const [squadSlots, setSquadSlots] = useState<Array<FootballPlayer | null>>([
    TOP_10_LEAGUE_PLAYERS.find(p => p.position === 'GK') || null,
    TOP_10_LEAGUE_PLAYERS.find(p => p.id === 'davies') || null,
    TOP_10_LEAGUE_PLAYERS.find(p => p.id === 'saliba') || null,
    TOP_10_LEAGUE_PLAYERS.find(p => p.id === 'van_dijk') || null,
    TOP_10_LEAGUE_PLAYERS.find(p => p.id === 'hakimi') || null,
    TOP_10_LEAGUE_PLAYERS.find(p => p.id === 'rodri') || null,
    TOP_10_LEAGUE_PLAYERS.find(p => p.id === 'bellingham') || null,
    TOP_10_LEAGUE_PLAYERS.find(p => p.id === 'wirtz') || null,
    TOP_10_LEAGUE_PLAYERS.find(p => p.id === 'vinicius') || null,
    TOP_10_LEAGUE_PLAYERS.find(p => p.id === 'haaland') || null,
    TOP_10_LEAGUE_PLAYERS.find(p => p.id === 'saka') || null,
  ]);

  const handleAssignPlayer = (player: FootballPlayer) => {
    if (selectedSlotIndex === null) return;
    haptics.like();
    const newSlots = [...squadSlots];
    newSlots[selectedSlotIndex] = player;
    setSquadSlots(newSlots);
    setSelectedSlotIndex(null);
  };

  const handleSaveLineup = () => {
    haptics.success();
    addFanPoints(20, 'Built Custom Tactical Lineup');
    addNotification({
      title: 'Tactical Squad Saved! (+20 Fan Points)',
      body: `${formation} formation with ${mentality} mentality saved to your tactics profile.`,
      type: 'system',
    });
  };

  // -------------------------------------------------------------
  // FEATURE 2: SCOUT CATALOG SEARCH & FILTERS
  // -------------------------------------------------------------
  const [scoutSearch, setScoutSearch] = useState('');
  const [scoutPositionFilter, setScoutPositionFilter] = useState<'ALL' | 'FW' | 'MF' | 'DF' | 'GK'>('ALL');
  const [selectedScoutPlayer, setSelectedScoutPlayer] = useState<FootballPlayer | null>(null);

  const filteredPlayers = TOP_10_LEAGUE_PLAYERS.filter(p => {
    const matchesQuery =
      p.name.toLowerCase().includes(scoutSearch.toLowerCase()) ||
      p.club.toLowerCase().includes(scoutSearch.toLowerCase()) ||
      p.nationality.toLowerCase().includes(scoutSearch.toLowerCase());
    const matchesPosition =
      scoutPositionFilter === 'ALL' || p.position.toUpperCase() === scoutPositionFilter;
    return matchesQuery && matchesPosition;
  });

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
            {dedicatedPage === 'tactics'
              ? 'Tactical Board'
              : dedicatedPage === 'leagues'
              ? 'Leagues Radar'
              : dedicatedPage === 'scout'
              ? 'Player Scout'
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
                  Tactical boards, verified player database, and live match tools · {todayFull}
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
            {/* Tactical Architect */}
            <button
              onClick={() => {
                haptics.light();
                setDedicatedPage('tactics');
              }}
              className="p-3.5 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm hover:border-[#00E676]/50 transition-all text-left space-y-2"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-[#00E676] flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-xs text-slate-900 dark:text-white">
                  Tactical Board
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-white/55">
                  Build 4-3-3 &amp; 4-2-3-1 squad formations
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

            {/* Official Player Scout */}
            <button
              onClick={() => {
                haptics.light();
                setDedicatedPage('scout');
              }}
              className="p-3.5 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm hover:border-[#00E676]/50 transition-all text-left space-y-2"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-xs text-slate-900 dark:text-white">
                  Player Scout
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-white/55">
                  30 registered global stars database
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
                setAiDrawerOpen(true);
              }}
              className="w-full flex items-center justify-between p-2.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded-2xl transition-all"
            >
              <div className="flex items-center gap-2.5">
                <BrainCircuit className="w-4 h-4 text-emerald-400" />
                <span className="font-extrabold text-slate-800 dark:text-white">Tactical IQ Intelligence Core</span>
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
      {/* SUB-PAGE 1: TACTICAL PITCH ARCHITECT */}
      {/* ============================================================= */}
      {dedicatedPage === 'tactics' && (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#00E676]" />
                  Tactical Pitch Board
                </h3>
                <p className="text-xs text-slate-500 dark:text-white/50">
                  Select formation, assign verified players, and set tactical style
                </p>
              </div>

              <button
                onClick={handleSaveLineup}
                className="px-3.5 py-1.5 rounded-xl bg-[#00E676] hover:bg-[#00C853] text-black font-extrabold text-xs shadow-md shadow-[#00E676]/20"
              >
                Save Lineup (+20 FP)
              </button>
            </div>

            {/* Formation Selector Pills */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1">
              {(['4-3-3', '4-2-3-1', '3-5-2', '4-4-2', '5-3-2'] as const).map(fmt => (
                <button
                  key={fmt}
                  onClick={() => {
                    haptics.light();
                    setFormation(fmt);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-extrabold whitespace-nowrap transition-all ${
                    formation === fmt
                      ? 'bg-[#00E676] text-black font-extrabold shadow-sm'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white/70'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>

            {/* Team Mentality Selector */}
            <div className="grid grid-cols-4 gap-1 pt-1">
              {[
                { id: 'press', label: 'High Press' },
                { id: 'possession', label: 'Tiki-Taka' },
                { id: 'counter', label: 'Counter' },
                { id: 'balanced', label: 'Balanced' },
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => {
                    haptics.light();
                    setMentality(m.id as any);
                  }}
                  className={`py-1 rounded-xl text-[10px] font-bold capitalize transition-all border ${
                    mentality === m.id
                      ? 'bg-[#00E676]/10 text-[#00E676] border-[#00E676]'
                      : 'border-slate-200 dark:border-white/10 text-slate-500'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Interactive Football Pitch Graphic */}
            <div className="relative rounded-2xl bg-gradient-to-b from-[#06331a] via-[#084222] to-[#042412] p-4 border border-[#00E676]/30 shadow-inner overflow-hidden min-h-[380px] flex flex-col justify-between">
              {/* Pitch Markings */}
              <div className="absolute inset-2 border border-[#00E676]/20 rounded-xl pointer-events-none" />
              <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 border-b border-[#00E676]/20 pointer-events-none" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 border border-[#00E676]/20 rounded-full pointer-events-none" />

              {/* Pitch Player Nodes in Tactical Rows */}
              <div className="relative z-10 space-y-4 py-2">
                {/* Forwards Row */}
                <div className="flex items-center justify-around">
                  {[8, 9, 10].map(idx => {
                    const p = squadSlots[idx];
                    const posLabel = formationPositions[formation]?.[idx] || 'FW';
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          haptics.light();
                          setSelectedSlotIndex(idx);
                        }}
                        className={`flex flex-col items-center transition-all ${
                          selectedSlotIndex === idx ? 'scale-110 ring-2 ring-[#00E676] rounded-xl p-1' : ''
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-black/70 border-2 border-[#00E676] overflow-hidden flex items-center justify-center shadow-lg">
                          {p?.photoUrl ? (
                            <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-black text-white">{posLabel}</span>
                          )}
                        </div>
                        <span className="text-[10px] font-black text-white bg-black/60 px-1.5 py-0.2 rounded mt-1 truncate max-w-[65px]">
                          {p?.shortName || posLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Midfield Row */}
                <div className="flex items-center justify-around">
                  {[5, 6, 7].map(idx => {
                    const p = squadSlots[idx];
                    const posLabel = formationPositions[formation]?.[idx] || 'MF';
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          haptics.light();
                          setSelectedSlotIndex(idx);
                        }}
                        className={`flex flex-col items-center transition-all ${
                          selectedSlotIndex === idx ? 'scale-110 ring-2 ring-[#00E676] rounded-xl p-1' : ''
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-black/70 border-2 border-emerald-400 overflow-hidden flex items-center justify-center shadow-lg">
                          {p?.photoUrl ? (
                            <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-black text-white">{posLabel}</span>
                          )}
                        </div>
                        <span className="text-[10px] font-black text-white bg-black/60 px-1.5 py-0.2 rounded mt-1 truncate max-w-[65px]">
                          {p?.shortName || posLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Defenders Row */}
                <div className="flex items-center justify-around">
                  {[1, 2, 3, 4].map(idx => {
                    const p = squadSlots[idx];
                    const posLabel = formationPositions[formation]?.[idx] || 'DF';
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          haptics.light();
                          setSelectedSlotIndex(idx);
                        }}
                        className={`flex flex-col items-center transition-all ${
                          selectedSlotIndex === idx ? 'scale-110 ring-2 ring-[#00E676] rounded-xl p-1' : ''
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-black/70 border-2 border-blue-400 overflow-hidden flex items-center justify-center shadow-lg">
                          {p?.photoUrl ? (
                            <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-black text-white">{posLabel}</span>
                          )}
                        </div>
                        <span className="text-[10px] font-black text-white bg-black/60 px-1.5 py-0.2 rounded mt-1 truncate max-w-[65px]">
                          {p?.shortName || posLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Goalkeeper */}
                <div className="flex items-center justify-center pt-1">
                  {(() => {
                    const p = squadSlots[0];
                    return (
                      <button
                        onClick={() => {
                          haptics.light();
                          setSelectedSlotIndex(0);
                        }}
                        className={`flex flex-col items-center transition-all ${
                          selectedSlotIndex === 0 ? 'scale-110 ring-2 ring-[#00E676] rounded-xl p-1' : ''
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-black/70 border-2 border-amber-400 overflow-hidden flex items-center justify-center shadow-lg">
                          {p?.photoUrl ? (
                            <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-black text-white">GK</span>
                          )}
                        </div>
                        <span className="text-[10px] font-black text-white bg-black/60 px-1.5 py-0.2 rounded mt-1 truncate max-w-[65px]">
                          {p?.shortName || 'GK'}
                        </span>
                      </button>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Slot assignment drawer */}
            {selectedSlotIndex !== null && (
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-black/50 border border-[#00E676]/40 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    Assign Player to Position #{selectedSlotIndex + 1}
                  </span>
                  <button
                    onClick={() => setSelectedSlotIndex(null)}
                    className="text-slate-400 hover:text-black dark:hover:text-white font-bold"
                  >
                    ✕
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto no-scrollbar pt-1">
                  {TOP_10_LEAGUE_PLAYERS.map(player => (
                    <button
                      key={player.id}
                      onClick={() => handleAssignPlayer(player)}
                      className="flex items-center gap-2 p-1.5 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-[#00E676] text-left transition-all"
                    >
                      <img
                        src={player.photoUrl}
                        alt={player.name}
                        className="w-7 h-7 rounded-full object-cover shrink-0"
                      />
                      <div className="truncate min-w-0">
                        <span className="font-bold text-[11px] text-slate-800 dark:text-white truncate block">
                          {player.shortName}
                        </span>
                        <span className="text-[9px] text-slate-400 block truncate">
                          {player.position} · {player.club}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* SUB-PAGE 2: TOP 10 LEAGUES RADAR */}
      {/* ============================================================= */}
      {dedicatedPage === 'leagues' && (
        <div className="p-4 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-3">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-[#00E676]" />
              Official Top 10 Leagues Radar
            </h3>
            <p className="text-xs text-slate-500 dark:text-white/50">
              Live tournament coverage powered by FotMob global network
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {TOP_10_LEAGUES.map(league => (
              <div
                key={league.id}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{league.flag}</span>
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">
                      {league.name}
                    </h4>
                    <span className="text-[10px] text-slate-500 dark:text-white/50">
                      {league.country} · {league.clubsCount} Clubs
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => fetchLeagueTable(league.id, league.name)}
                    className="px-2.5 py-1 rounded-xl bg-[#00E676] text-black font-extrabold text-[10px] transition-all hover:bg-emerald-400"
                  >
                    View Table
                  </button>
                  <button
                    onClick={() => {
                      haptics.light();
                      setActiveTab('scores');
                    }}
                    className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white/80 font-bold text-[10px] transition-all hover:bg-slate-200 dark:hover:bg-white/20"
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
                  Live table, points & goals gap powered by FotMob
                </span>
              </div>
              <button
                onClick={() => setSelectedLeagueTable(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-1.5 no-scrollbar">
              {loadingTable ? (
                <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
                  Loading live table standings from global feed...
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
                        className="grid grid-cols-12 gap-1 px-3 py-2 text-xs items-center rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5"
                      >
                        <span className="col-span-1 font-mono font-bold text-center text-slate-500">
                          {row.position}
                        </span>
                        <span className="col-span-4 font-extrabold text-slate-900 dark:text-white truncate">
                          {row.teamName}
                        </span>
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
                        <span className="col-span-2 font-mono text-right font-black text-[#00E676]">
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
      {/* SUB-PAGE 3: OFFICIAL PLAYER SCOUT */}
      {/* ============================================================= */}
      {dedicatedPage === 'scout' && (
        <div className="p-4 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-3">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <Search className="w-4 h-4 text-[#00E676]" />
              Verified Player Scout Database
            </h3>
            <p className="text-xs text-slate-500 dark:text-white/50">
              30 top registered European and world stars with real stats
            </p>
          </div>

          {/* Search & Position Pills */}
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Search player, club, or nationality..."
              value={scoutSearch}
              onChange={e => setScoutSearch(e.target.value)}
              className="w-full px-3 py-2 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none"
            />
            <div className="flex items-center gap-1">
              {(['ALL', 'FW', 'MF', 'DF', 'GK'] as const).map(pos => (
                <button
                  key={pos}
                  onClick={() => setScoutPositionFilter(pos)}
                  className={`flex-1 py-1 rounded-xl text-xs font-bold transition-all ${
                    scoutPositionFilter === pos
                      ? 'bg-[#00E676] text-black font-extrabold'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/60'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>

          {/* Player Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 max-h-[500px] overflow-y-auto no-scrollbar">
            {filteredPlayers.map(player => (
              <div
                key={player.id}
                onClick={() => setSelectedScoutPlayer(player)}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 flex items-center gap-3 cursor-pointer hover:border-[#00E676]/40 transition-all"
              >
                <img
                  src={player.photoUrl}
                  alt={player.name}
                  className="w-11 h-11 rounded-2xl object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h5 className="font-display font-extrabold text-xs text-slate-900 dark:text-white truncate">
                      {player.name}
                    </h5>
                    <span className="text-xs font-black text-emerald-700 dark:text-[#00E676] font-mono tabular-nums">
                      {player.rating}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-white/55 mt-0.5 tabular-nums">
                    <span>{player.position}</span>
                    <span>·</span>
                    <span className="truncate">{player.club}</span>
                    <span>·</span>
                    <span>{player.marketValue}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Player Detail Modal */}
          {selectedScoutPlayer && (
            <div className="p-4 rounded-3xl bg-slate-50 dark:bg-black/80 border border-emerald-500/40 dark:border-[#00E676]/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img
                    src={selectedScoutPlayer.photoUrl}
                    alt={selectedScoutPlayer.name}
                    className="w-12 h-12 rounded-2xl object-cover"
                  />
                  <div>
                    <h4 className="font-display font-extrabold text-sm text-slate-900 dark:text-white">
                      {selectedScoutPlayer.name}
                    </h4>
                    <span className="text-xs text-emerald-700 dark:text-[#00E676] font-bold">
                      {selectedScoutPlayer.club} · {selectedScoutPlayer.nationality}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedScoutPlayer(null)}
                  className="min-h-[36px] min-w-[36px] rounded-full flex items-center justify-center text-xs font-bold text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-white dark:bg-white/5">
                  <span className="text-[10px] text-slate-400 block">Rating</span>
                  <span className="font-black text-slate-900 dark:text-white font-mono tabular-nums text-base">
                    {selectedScoutPlayer.rating}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-white/5">
                  <span className="text-[10px] text-slate-400 block">Goals</span>
                  <span className="font-black text-rose-500 font-mono tabular-nums text-base">
                    {selectedScoutPlayer.stats?.goals ?? 0}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-white/5">
                  <span className="text-[10px] text-slate-400 block">Assists</span>
                  <span className="font-black text-blue-500 font-mono tabular-nums text-base">
                    {selectedScoutPlayer.stats?.assists ?? 0}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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
