import React, { useState, useEffect } from 'react';
import {
  Filter,
  Bell,
  MessageSquare,
  Clock,
  Zap,
  Trophy,
  Activity,
  Users,
  Shield,
  ChevronRight,
  TrendingUp,
  Calendar,
  ChevronLeft,
  Heart,
  Share2,
  BarChart3,
  X,
  Target,
  CheckCircle2,
} from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { Match, MatchEvent } from '../../types/football';
import { generateMatchRecap } from '../../services/footballAi';
import { ClubLogo } from '../Common/ClubLogo';
import { fetchAiMatchPrediction } from '../../services/supabaseClient';
import { haptics } from '../../utils/haptics';
import { useHaptics } from '../../hooks/useHaptics';
import { buildMatchShareUrl } from '../../utils/share';

export const ScoresTab: React.FC = () => {
  const {
    matches,
    matchesLoading,
    openMatchRoom,
    unreadNotificationsCount,
    setNotificationsModalOpen,
    addNotification,
    addFanPoints,
    fetchLiveMatches,
    theme,
    openShareSheet,
  } = useFootball();

  const { triggerVote } = useHaptics();

  const [dateFilter, setDateFilter] = useState<'YESTERDAY' | 'LIVE' | 'TODAY' | 'TOMORROW' | 'FINISHED' | 'CUSTOM'>('TODAY');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCustomDate, setSelectedCustomDate] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [leagueFilter, setLeagueFilter] = useState<string>('all');
  const [showLeagueFilterMenu, setShowLeagueFilterMenu] = useState(false);
  const [selectedMatchForDetails, setSelectedMatchForDetails] = useState<(Match & { referee?: string }) | null>(null);
  const [matchDetailsTab, setMatchDetailsTab] = useState<'overview' | 'lineups' | 'stats' | 'recap'>('overview');
  const [loadingMatchDetails, setLoadingMatchDetails] = useState<boolean>(false);
  const [isGeneratingRecap, setIsGeneratingRecap] = useState(false);
  const [aiRecapResult, setAiRecapResult] = useState<string | null>(null);

  const openMatchDetailsModal = async (match: Match) => {
    haptics.light();
    setSelectedMatchForDetails(match);
    setMatchDetailsTab('overview');
    setAiRecapResult(null);
    setLoadingMatchDetails(true);
    try {
      const res = await fetch(`/api/football/match/${encodeURIComponent(match.id)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.match) {
          setSelectedMatchForDetails(prev =>
            prev && prev.id === match.id
              ? {
                  ...prev,
                  ...data.match,
                  homeTeam: { ...prev.homeTeam, ...data.match.homeTeam },
                  awayTeam: { ...prev.awayTeam, ...data.match.awayTeam },
                }
              : prev
          );
        }
      }
    } catch {
      // Keep base match details visible silently
    } finally {
      setLoadingMatchDetails(false);
    }
  };

  const getEventBadge = (ev: MatchEvent) => {
    switch (ev.type) {
      case 'penalty_goal':
        return { icon: '⚽', tag: 'PEN', colorClass: 'text-emerald-600 dark:text-[#00E676]' };
      case 'own_goal':
        return { icon: '⚽', tag: 'OG', colorClass: 'text-rose-500' };
      case 'missed_penalty':
        return { icon: '❌', tag: 'Missed Pen', colorClass: 'text-rose-500' };
      case 'yellow_card':
        return { icon: '🟨', tag: '', colorClass: 'text-amber-500' };
      case 'red_card':
        return { icon: '🟥', tag: 'RED', colorClass: 'text-rose-600 dark:text-rose-400' };
      case 'substitution':
        return { icon: '🔄', tag: 'SUB', colorClass: 'text-sky-500' };
      case 'var':
        return { icon: '📺', tag: 'VAR', colorClass: 'text-purple-500' };
      case 'goal':
      default:
        return { icon: '⚽', tag: '', colorClass: 'text-emerald-600 dark:text-[#00E676]' };
    }
  };

  // AI Match Prediction state
  const [predictions, setPredictions] = useState<Record<string, any>>({});
  const [loadingPredictionMatchId, setLoadingPredictionMatchId] = useState<string | null>(null);
  const [showPredictionModal, setShowPredictionModal] = useState<boolean>(false);
  const [activePredictionMatch, setActivePredictionMatch] = useState<Match | null>(null);
  const [userVotes, setUserVotes] = useState<Record<string, 'home' | 'draw' | 'away'>>(() => {
    try {
      const saved = localStorage.getItem('futfield_match_votes');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [matchLikes, setMatchLikes] = useState<Record<string, number>>({});
  const [likedMatchIds, setLikedMatchIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!selectedMatchForDetails && !showPredictionModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedMatchForDetails(null);
        setShowPredictionModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedMatchForDetails, showPredictionModal]);

  const handleToggleMatchLike = async (matchId: string, homeTeam: string, awayTeam: string) => {
    haptics.like();
    const isLiked = likedMatchIds.has(matchId);
    const initialCount = matchLikes[matchId] ?? (matches.find(m => m.id === matchId)?.activeFansCount || 0);
    const newCount = isLiked ? Math.max(0, initialCount - 1) : initialCount + 1;

    setMatchLikes(prev => ({ ...prev, [matchId]: newCount }));
    setLikedMatchIds(prev => {
      const next = new Set(prev);
      if (isLiked) {
        next.delete(matchId);
      } else {
        next.add(matchId);
      }
      return next;
    });

    if (!isLiked) {
      addFanPoints(5, 'Match reaction');
      addNotification({
        title: 'Match Reaction Registered!',
        body: `You are following ${homeTeam} vs ${awayTeam}. Real-time count: ${newCount}`,
        type: 'like',
      });
    }

    try {
      await fetch(`/api/db/matches/${encodeURIComponent(matchId)}/reaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLiked: !isLiked }),
      });
    } catch (err) {
      console.warn('[ScoresTab] Reaction sync notice:', err);
    }
  };

  // Real-time AI win-probability calculator & cache
  const getMatchProbabilities = (m: Match) => {
    if (predictions[m.id]) {
      return predictions[m.id];
    }
    const homeLower = m.homeTeam.name.toLowerCase();
    const awayLower = m.awayTeam.name.toLowerCase();
    let homeWeight = 50;
    let awayWeight = 32;

    const elite = ['arsenal', 'city', 'madrid', 'barca', 'barcelona', 'bayern', 'liverpool', 'inter'];
    if (elite.some(c => homeLower.includes(c))) homeWeight += 18;
    if (elite.some(c => awayLower.includes(c))) awayWeight += 18;

    if (m.status === 'LIVE' || m.status === 'FINISHED') {
      homeWeight += m.homeTeam.score * 15;
      awayWeight += m.awayTeam.score * 15;
    }

    const total = homeWeight + 24 + awayWeight;
    const homeWinPct = Math.round((homeWeight / total) * 100);
    const awayWinPct = Math.round((awayWeight / total) * 100);
    const drawPct = Math.max(10, 100 - homeWinPct - awayWinPct);

    return {
      homeWinPct,
      drawPct,
      awayWinPct,
      predictedScore: homeWinPct > awayWinPct ? '2 - 1' : homeWinPct < awayWinPct ? '1 - 2' : '1 - 1',
      homeForm: ['W', 'W', 'D', 'W', 'L'],
      awayForm: ['D', 'W', 'L', 'W', 'D'],
      tacticalBreakdown: `${m.homeTeam.name}'s transition speed and spatial overload generate strong pitch control.`,
      keyBattles: ['Midfield turnover duel', 'Flank pace & crosses', 'Defending set pieces'],
      starPlayer: `${m.homeTeam.name} Star`,
    };
  };

  const handleOpenAiPrediction = async (match: Match) => {
    haptics.light();
    setActivePredictionMatch(match);
    setShowPredictionModal(true);

    if (!predictions[match.id]) {
      setLoadingPredictionMatchId(match.id);
      try {
        const pred = await fetchAiMatchPrediction(
          match.homeTeam.name,
          match.awayTeam.name,
          match.league,
          match.homeTeam.score,
          match.awayTeam.score
        );
        if (pred) {
          setPredictions(prev => ({ ...prev, [match.id]: pred }));
        }
      } finally {
        setLoadingPredictionMatchId(null);
      }
    }
  };

  const handleVote = (matchId: string, pick: 'home' | 'draw' | 'away') => {
    if (userVotes[matchId]) return;
    triggerVote();
    setUserVotes(prev => {
      const next = { ...prev, [matchId]: pick };
      try {
        localStorage.setItem('futfield_match_votes', JSON.stringify(next));
      } catch {}
      return next;
    });
    addFanPoints(10, 'Match prediction vote');
    addNotification({
      title: 'Match Prediction Submitted! ⚽',
      body: `You backed ${pick === 'home' ? activePredictionMatch?.homeTeam.name : pick === 'away' ? activePredictionMatch?.awayTeam.name : 'a Draw'}. +10 Fan Points awarded!`,
      type: 'like',
    });
  };

  const liveCount = matches.filter(m => m.status === 'LIVE').length;

  const competitions = [
    { id: 'all', label: 'All Leagues' },
    { id: 'premier', label: 'Premier League' },
    { id: 'champions', label: 'Champions League' },
    { id: 'laliga', label: 'La Liga' },
    { id: 'serie a', label: 'Serie A' },
    { id: 'bundesliga', label: 'Bundesliga' },
    { id: 'ligue 1', label: 'Ligue 1' },
    { id: 'youth', label: 'UEFA Youth' },
  ];

  // Helper date generators (YYYYMMDD)
  const getDateString = (offsetDays = 0): string => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10).replace(/-/g, '');
  };

  const handleSelectDateFilter = (filter: 'YESTERDAY' | 'LIVE' | 'TODAY' | 'TOMORROW' | 'FINISHED') => {
    haptics.light();
    setDateFilter(filter);
    setShowDatePicker(false);
    setIsRefreshing(true);
    const targetDate =
      filter === 'YESTERDAY'
        ? getDateString(-1)
        : filter === 'TOMORROW'
        ? getDateString(1)
        : getDateString(0);

    fetchLiveMatches(targetDate).finally(() => {
      setIsRefreshing(false);
    });
  };

  const handleSelectCustomDate = (dateStr: string) => {
    haptics.light();
    setSelectedCustomDate(dateStr);
    setDateFilter('CUSTOM');
    setIsRefreshing(true);
    fetchLiveMatches(dateStr.replace(/-/g, '')).finally(() => {
      setIsRefreshing(false);
    });
  };

  // Generate 7 upcoming & past dates for the 'More Days' picker
  const generateDateStrip = () => {
    const items = [];
    for (let i = -3; i <= 4; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      items.push({ iso, dayName, dayNum, offset: i });
    }
    return items;
  };

  const filteredMatches = matches.filter(m => {
    if (leagueFilter !== 'all' && !m.league.toLowerCase().includes(leagueFilter.toLowerCase())) {
      return false;
    }
    if (dateFilter === 'LIVE') {
      return m.status === 'LIVE';
    }
    if (dateFilter === 'FINISHED') {
      return m.status === 'FINISHED';
    }
    // When date is YESTERDAY, TODAY, TOMORROW, or CUSTOM, the fetched data set already corresponds to that selected day
    return true;
  });

  const handleGenerateAiRecap = async (match: Match) => {
    setIsGeneratingRecap(true);
    try {
      const recap = await generateMatchRecap(match);
      setAiRecapResult(recap);
      addFanPoints(30, 'Generated AI Match Analysis');
    } finally {
      setIsGeneratingRecap(false);
    }
  };

  return (
    <div className="pb-24 max-w-2xl mx-auto px-3 sm:px-4 pt-3 space-y-4">
      {/* Top Header Row */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Live Football Scores
          </h1>
          <p className="text-xs text-slate-500 dark:text-white/55">
            Instant match sync · Tactical win probabilities
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              haptics.light();
              setIsRefreshing(true);
              const dateArg =
                dateFilter === 'YESTERDAY'
                  ? getDateString(-1)
                  : dateFilter === 'TOMORROW'
                  ? getDateString(1)
                  : dateFilter === 'CUSTOM' && selectedCustomDate
                  ? selectedCustomDate.replace(/-/g, '')
                  : getDateString(0);
              fetchLiveMatches(dateArg).finally(() => {
                setIsRefreshing(false);
              });
            }}
            className="min-h-[44px] min-w-[44px] rounded-full text-slate-700 dark:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors flex items-center justify-center"
            title="Fast Refresh Live Scores"
          >
            <Activity className={`w-5 h-5 ${isRefreshing ? 'animate-spin text-emerald-600 dark:text-[#00E676]' : 'text-slate-600 dark:text-white/70'}`} />
          </button>
          <button
            onClick={() => setShowDatePicker(prev => !prev)}
            className={`min-h-[44px] min-w-[44px] rounded-full transition-colors flex items-center justify-center ${
              showDatePicker
                ? 'bg-[#00E676] text-black shadow-md shadow-[#00E676]/20'
                : 'text-slate-700 dark:text-white hover:bg-slate-200/60 dark:hover:bg-white/10'
            }`}
            title="Browse dates"
          >
            <Calendar className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowLeagueFilterMenu(prev => !prev)}
            className={`min-h-[44px] min-w-[44px] rounded-full transition-colors flex items-center justify-center ${
              showLeagueFilterMenu || leagueFilter !== 'all'
                ? 'bg-[#00E676] text-black shadow-md shadow-[#00E676]/20'
                : 'text-slate-700 dark:text-white hover:bg-slate-200/60 dark:hover:bg-white/10'
            }`}
            title="Filter by league"
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* League & Competition Filter Dropdown */}
      {showLeagueFilterMenu && (
        <div className="p-3 rounded-2xl bg-white dark:bg-[#161b22] border border-slate-200 dark:border-white/10 shadow-xl space-y-2 animate-in fade-in">
          <div className="text-[11px] font-bold text-slate-400 dark:text-white/50 uppercase tracking-wider px-1">
            Filter by Competition
          </div>
          <div className="flex flex-wrap gap-1.5">
            {competitions.map(c => (
              <button
                key={c.id}
                onClick={() => {
                  setLeagueFilter(c.id);
                  setShowLeagueFilterMenu(false);
                }}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  leagueFilter === c.id
                    ? 'bg-[#00E676] text-black font-bold'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/10'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Segmented Date Pills: Yesterday, Live, Today, Tomorrow, Finished, More Days */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
        {/* Yesterday Button */}
        <button
          onClick={() => handleSelectDateFilter('YESTERDAY')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
            dateFilter === 'YESTERDAY'
              ? 'bg-[#00E676] text-black shadow-md shadow-[#00E676]/20'
              : 'bg-white dark:bg-[#161b22] text-slate-600 dark:text-white/70 hover:text-black dark:hover:text-white border border-slate-200 dark:border-white/5 shadow-sm'
          }`}
        >
          Yesterday
        </button>

        {/* Live Pill */}
        <button
          onClick={() => handleSelectDateFilter('LIVE')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            dateFilter === 'LIVE'
              ? 'bg-[#00E676] text-black shadow-md shadow-[#00E676]/20'
              : 'bg-white dark:bg-[#161b22] text-slate-600 dark:text-white/70 hover:text-black dark:hover:text-white border border-slate-200 dark:border-white/5 shadow-sm'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${dateFilter === 'LIVE' ? 'bg-black animate-pulse' : 'bg-[#00E676]'}`} />
          <span>Live · {liveCount}</span>
        </button>

        {/* Today Button */}
        <button
          onClick={() => handleSelectDateFilter('TODAY')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
            dateFilter === 'TODAY'
              ? 'bg-[#00E676] text-black shadow-md shadow-[#00E676]/20'
              : 'bg-white dark:bg-[#161b22] text-slate-600 dark:text-white/70 hover:text-black dark:hover:text-white border border-slate-200 dark:border-white/5 shadow-sm'
          }`}
        >
          Today
        </button>

        {/* Tomorrow Button */}
        <button
          onClick={() => handleSelectDateFilter('TOMORROW')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
            dateFilter === 'TOMORROW'
              ? 'bg-[#00E676] text-black shadow-md shadow-[#00E676]/20'
              : 'bg-white dark:bg-[#161b22] text-slate-600 dark:text-white/70 hover:text-black dark:hover:text-white border border-slate-200 dark:border-white/5 shadow-sm'
          }`}
        >
          Tomorrow
        </button>

        {/* Finished Button */}
        <button
          onClick={() => handleSelectDateFilter('FINISHED')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
            dateFilter === 'FINISHED'
              ? 'bg-[#00E676] text-black shadow-md shadow-[#00E676]/20'
              : 'bg-white dark:bg-[#161b22] text-slate-600 dark:text-white/70 hover:text-black dark:hover:text-white border border-slate-200 dark:border-white/5 shadow-sm'
          }`}
        >
          Finished
        </button>

        {/* More Days Button */}
        <button
          onClick={() => setShowDatePicker(prev => !prev)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
            showDatePicker || dateFilter === 'CUSTOM'
              ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20'
              : 'bg-white dark:bg-[#161b22] text-slate-600 dark:text-white/70 hover:text-black dark:hover:text-white border border-slate-200 dark:border-white/5 shadow-sm'
          }`}
          title="Pick custom fixture date"
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>More Days</span>
        </button>
      </div>

      {/* Expandable 'More Days' Horizontal Date Picker Ribbon */}
      {showDatePicker && (
        <div className="p-3 rounded-2xl bg-white dark:bg-[#161b22] border border-slate-200 dark:border-white/10 shadow-xl space-y-2.5 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#00E676]" />
              Select Match Date
            </span>
            <input
              type="date"
              value={selectedCustomDate}
              onChange={e => handleSelectCustomDate(e.target.value)}
              className="text-xs bg-slate-100 dark:bg-black/40 text-slate-800 dark:text-white rounded-lg px-2 py-1 border border-slate-200 dark:border-white/10"
            />
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 pt-1">
            {generateDateStrip().map(item => (
              <button
                key={item.iso}
                onClick={() => handleSelectCustomDate(item.iso)}
                className={`flex flex-col items-center justify-center p-2 rounded-xl text-xs transition-all border ${
                  selectedCustomDate === item.iso
                    ? 'bg-[#00E676] text-black font-extrabold border-[#00E676] shadow-sm'
                    : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-700 dark:text-white/80 hover:bg-slate-100 dark:hover:bg-white/10'
                }`}
              >
                <span className="text-[10px] uppercase font-bold opacity-70">{item.dayName}</span>
                <span className="text-xs font-black">{item.dayNum}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Match Cards List with Real Club Logos */}
      <div className="space-y-4">
        {matchesLoading && matches.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="h-32 rounded-2xl bg-white dark:bg-[#161b22] border border-slate-200 dark:border-white/5 animate-pulse p-4 space-y-3"
              >
                <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-1/3" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/10" />
                    <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-20" />
                  </div>
                  <div className="h-6 bg-slate-200 dark:bg-white/10 rounded w-12" />
                  <div className="flex items-center gap-2">
                    <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-20" />
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/10" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white dark:bg-[#161b22] border border-slate-200 dark:border-white/5 space-y-3 shadow-lg">
            <div className="w-12 h-12 rounded-2xl bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center text-[#00E676] mx-auto text-xl">
              <Activity className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-slate-800 dark:text-white text-base">
              {dateFilter === 'LIVE'
                ? 'No live matches in play right now'
                : dateFilter === 'YESTERDAY'
                ? 'No fixtures recorded yesterday'
                : `No fixtures scheduled for this selection`}
            </h3>
            <p className="text-xs text-slate-500 dark:text-white/50 max-w-sm mx-auto leading-relaxed">
              {dateFilter === 'LIVE'
                ? 'There are currently no active matches on the pitch at this minute. View all today’s matchday fixtures or check upcoming dates.'
                : 'No fixtures found for this filter. Check other dates using the date buttons above.'}
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              {dateFilter === 'LIVE' && matches.length > 0 && (
                <button
                  onClick={() => setDateFilter('TODAY')}
                  className="px-4 py-2 rounded-xl bg-[#00E676] hover:bg-[#00C853] text-black font-extrabold text-xs shadow-md shadow-[#00E676]/20 inline-flex items-center gap-1.5 transition-all"
                >
                  <span>View All Today’s Fixtures ({matches.length})</span>
                </button>
              )}
              <button
                onClick={() => {
                  haptics.light();
                  setIsRefreshing(true);
                  const dateArg =
                    dateFilter === 'YESTERDAY'
                      ? getDateString(-1)
                      : dateFilter === 'TOMORROW'
                      ? getDateString(1)
                      : dateFilter === 'CUSTOM' && selectedCustomDate
                      ? selectedCustomDate.replace(/-/g, '')
                      : getDateString(0);
                  fetchLiveMatches(dateArg).finally(() => setIsRefreshing(false));
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-800 dark:text-white font-bold text-xs inline-flex items-center gap-1.5 transition-all"
              >
                <Activity className={`w-3.5 h-3.5 text-[#00E676] ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Syncing...' : 'Fast Reload'}</span>
              </button>
            </div>
          </div>
        ) : (
          filteredMatches.map(match => {
            const isLive = match.status === 'LIVE';

            return (
              <div
                key={match.id}
                className="rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 overflow-hidden shadow-sm hover:shadow-md transition-all hover:border-[#00E676]/50 dark:hover:border-white/15"
              >
                {/* Match Card Header */}
                <div className="px-4 pt-3.5 pb-2 flex items-center justify-between">
                  {isLive ? (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-[#00E676] text-xs font-extrabold tracking-wide tabular-nums">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-[#00E676] animate-pulse" />
                      LIVE · {match.minute || 'Live'}
                    </div>
                  ) : (
                    <div className="text-xs font-bold text-slate-500 dark:text-white/55 tracking-wider uppercase flex items-center gap-1.5 tabular-nums">
                      <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-white/40" />
                      {(match.dateStr || 'TODAY').toUpperCase()} · {match.timeStr || '20:00'}
                    </div>
                  )}

                  <span className="text-[11px] font-semibold text-slate-500 dark:text-white/50 truncate max-w-[190px]">
                    {match.league}
                  </span>
                </div>

                {/* Scoreboard Block with REAL CLUB LOGOS */}
                <div
                  onClick={() => openMatchDetailsModal(match)}
                  className="px-4 sm:px-5 py-3.5 cursor-pointer group hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <div className="grid grid-cols-7 items-center gap-2">
                    <div className="col-span-3 flex flex-col items-center sm:items-start text-center sm:text-left">
                      <div className="mb-1.5 group-hover:scale-105 transition-transform">
                        <ClubLogo name={match.homeTeam.name} rawId={match.homeTeam.id} size="lg" />
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white text-sm truncate w-full">
                        {match.homeTeam.name}
                      </span>
                    </div>

                    <div className="col-span-1 flex flex-col items-center justify-center">
                      {isLive || match.status === 'FINISHED' ? (
                        <div className="font-mono tabular-nums text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                          {match.homeTeam.score} - {match.awayTeam.score}
                        </div>
                      ) : (
                        <div className="text-xs font-black px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white/85">
                          VS
                        </div>
                      )}
                    </div>

                    <div className="col-span-3 flex flex-col items-center sm:items-end text-center sm:text-right">
                      <div className="mb-1.5 group-hover:scale-105 transition-transform">
                        <ClubLogo name={match.awayTeam.name} rawId={match.awayTeam.id} size="lg" />
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white text-sm truncate w-full">
                        {match.awayTeam.name}
                      </span>
                    </div>
                  </div>

                  {/* Mobile Flashscore-Style Key Match Incidents Preview (Scorers, Penalties, Cards) */}
                  {match.events && match.events.length > 0 && (() => {
                    const keyEvents = match.events.filter(
                      e => e.type !== 'substitution' && e.type !== 'var'
                    );
                    const displayEvents = keyEvents.length > 0 ? keyEvents : match.events;
                    const homeEvents = displayEvents.filter(e => e.team === 'home').slice(0, 4);
                    const awayEvents = displayEvents.filter(e => e.team === 'away').slice(0, 4);

                    if (homeEvents.length === 0 && awayEvents.length === 0) return null;

                    return (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/5 grid grid-cols-2 gap-2.5 text-[11px]">
                        <div className="space-y-1 min-w-0">
                          {homeEvents.map(ev => {
                            const badge = getEventBadge(ev);
                            return (
                              <div key={ev.id} className="flex items-center gap-1 text-slate-700 dark:text-white/85 min-w-0">
                                <span className="shrink-0">{badge.icon}</span>
                                <span className="truncate font-semibold">{ev.player}</span>
                                {badge.tag && (
                                  <span className={`text-[9px] font-black uppercase shrink-0 ${badge.colorClass}`}>
                                    {badge.tag}
                                  </span>
                                )}
                                <span className="text-slate-500 dark:text-white/50 font-mono tabular-nums text-[10px] shrink-0">
                                  {ev.minute}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        <div className="space-y-1 text-right min-w-0">
                          {awayEvents.map(ev => {
                            const badge = getEventBadge(ev);
                            return (
                              <div key={ev.id} className="flex items-center justify-end gap-1 text-slate-700 dark:text-white/85 min-w-0">
                                <span className="text-slate-500 dark:text-white/50 font-mono tabular-nums text-[10px] shrink-0">
                                  {ev.minute}
                                </span>
                                {badge.tag && (
                                  <span className={`text-[9px] font-black uppercase shrink-0 ${badge.colorClass}`}>
                                    {badge.tag}
                                  </span>
                                )}
                                <span className="truncate font-semibold">{ev.player}</span>
                                <span className="shrink-0">{badge.icon}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-slate-500 dark:text-white/45">
                    <span className="truncate">{match.venue || 'Matchday Stadium'}</span>
                    <span className="text-emerald-700 dark:text-[#00E676] font-bold shrink-0">
                      Match Center · Timeline, Stats &amp; XI →
                    </span>
                  </div>
                </div>

                {/* Tactical Win Probability Bar */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenAiPrediction(match);
                  }}
                  className="px-4 py-2.5 bg-slate-50/90 dark:bg-black/30 border-t border-slate-100 dark:border-white/5 space-y-2 cursor-pointer hover:bg-slate-100/80 dark:hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-white/90">
                      <BarChart3 className="w-3.5 h-3.5 text-emerald-600 dark:text-[#00E676]" />
                      <span>Tactical Win Probability</span>
                    </div>
                    <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-[#00E676]">
                      <Activity className="w-3 h-3" />
                      <span>Tactics &amp; Form</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  </div>

                  {(() => {
                    const prob = getMatchProbabilities(match);
                    return (
                      <>
                        <div className="h-2.5 w-full bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden flex shadow-inner">
                          <div
                            style={{ width: `${prob.homeWinPct}%` }}
                            className="bg-[#00E676] h-full flex items-center justify-center text-[9px] font-black text-black transition-all duration-500 overflow-hidden tabular-nums"
                            title={`${match.homeTeam.name}: ${prob.homeWinPct}%`}
                          >
                            {prob.homeWinPct >= 16 && `${prob.homeWinPct}%`}
                          </div>
                          <div
                            style={{ width: `${prob.drawPct}%` }}
                            className="bg-slate-400 dark:bg-slate-500 h-full flex items-center justify-center text-[9px] font-black text-white transition-all duration-500 overflow-hidden tabular-nums"
                            title={`Draw: ${prob.drawPct}%`}
                          >
                            {prob.drawPct >= 16 && `${prob.drawPct}%`}
                          </div>
                          <div
                            style={{ width: `${prob.awayWinPct}%` }}
                            className="bg-sky-500 h-full flex items-center justify-center text-[9px] font-black text-white transition-all duration-500 overflow-hidden tabular-nums"
                            title={`${match.awayTeam.name}: ${prob.awayWinPct}%`}
                          >
                            {prob.awayWinPct >= 16 && `${prob.awayWinPct}%`}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-white/65">
                          <div className="flex items-center gap-1 font-semibold truncate max-w-[38%]">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-[#00E676] shrink-0" />
                            <span className="truncate">{match.homeTeam.name}</span>
                            <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">{prob.homeWinPct}%</span>
                          </div>
                          <div className="text-center shrink-0 font-medium text-slate-500 dark:text-white/50 tabular-nums">
                            Draw {prob.drawPct}%
                          </div>
                          <div className="flex items-center justify-end gap-1 font-semibold truncate max-w-[38%]">
                            <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">{prob.awayWinPct}%</span>
                            <span className="truncate">{match.awayTeam.name}</span>
                            <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Match Card Action Row */}
                <div className="px-4 py-2 bg-slate-50 dark:bg-black/40 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-white/75">
                  {(() => {
                    const isLiked = likedMatchIds.has(match.id);
                    const reactionCount = matchLikes[match.id] ?? match.activeFansCount ?? 0;

                    return (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleMatchLike(match.id, match.homeTeam.name, match.awayTeam.name);
                        }}
                        className={`min-h-[38px] flex items-center gap-1.5 py-1.5 px-3 rounded-xl transition-all active:scale-95 tabular-nums ${
                          isLiked
                            ? 'bg-rose-500/15 text-rose-500 font-bold border border-rose-500/30 shadow-sm'
                            : 'hover:bg-slate-200/60 dark:hover:bg-white/10 text-slate-600 dark:text-white/75'
                        }`}
                        title={isLiked ? 'Unlike fixture' : 'Like fixture'}
                      >
                        <Heart
                          className={`w-4 h-4 transition-transform ${
                            isLiked ? 'fill-rose-500 text-rose-500 scale-110' : 'hover:text-rose-500'
                          }`}
                        />
                        <span className="font-mono text-xs font-bold">{reactionCount}</span>
                      </button>
                    );
                  })()}

                  <button
                    onClick={() => openMatchRoom(match)}
                    className="min-h-[38px] flex items-center gap-1.5 py-1.5 px-3 rounded-xl hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors text-slate-800 dark:text-white font-bold"
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-[#00E676]" />
                    <span>Chat Room</span>
                  </button>

                  <button
                    onClick={() => {
                      openShareSheet({
                        kind: 'match',
                        targetId: match.id,
                        title: `${match.homeTeam.name} ${match.homeTeam.score}-${match.awayTeam.score} ${match.awayTeam.name}`,
                        text: `${match.league} · Follow live match scores & fan room chat on FUTFIELD!`,
                        url: buildMatchShareUrl(match.id),
                      });
                    }}
                    className="min-h-[38px] flex items-center gap-1.5 py-1.5 px-3 rounded-xl hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Share</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Match Details Modal with Club Logos */}
      {selectedMatchForDetails && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-[#161b22] border border-slate-200 dark:border-white/10 rounded-t-3xl sm:rounded-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-[#00E676] tracking-wider uppercase">
                  {selectedMatchForDetails.league}
                </span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {selectedMatchForDetails.homeTeam.name} vs {selectedMatchForDetails.awayTeam.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedMatchForDetails(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/70 hover:text-black dark:hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Scorecard Hero with Official Logos */}
            <div className="p-4 bg-gradient-to-b from-slate-50 to-white dark:from-[#0b0e11] dark:to-[#161b22] text-center border-b border-slate-200 dark:border-white/5">
              <div className="flex items-center justify-center gap-6 mb-2">
                <ClubLogo name={selectedMatchForDetails.homeTeam.name} rawId={selectedMatchForDetails.homeTeam.id} size="lg" />
                <div className="text-3xl font-black font-mono text-slate-900 dark:text-white">
                  {selectedMatchForDetails.homeTeam.score} - {selectedMatchForDetails.awayTeam.score}
                </div>
                <ClubLogo name={selectedMatchForDetails.awayTeam.name} rawId={selectedMatchForDetails.awayTeam.id} size="lg" />
              </div>
              <div className="text-xs text-slate-500 dark:text-white/60 space-y-0.5">
                <div>
                  {selectedMatchForDetails.venue || 'Football Stadium'} ·{' '}
                  <span className="font-mono tabular-nums font-bold text-emerald-700 dark:text-[#00E676]">
                    {selectedMatchForDetails.minute || selectedMatchForDetails.timeStr || 'Kickoff'}
                  </span>
                </div>
                {selectedMatchForDetails.referee && (
                  <div className="text-[11px] text-slate-400 dark:text-white/45">
                    Referee: {selectedMatchForDetails.referee}
                  </div>
                )}
              </div>
            </div>

            {/* Subtabs inside Match Details */}
            <div className="grid grid-cols-4 border-b border-slate-200 dark:border-white/10 text-xs font-bold text-center">
              {(['overview', 'lineups', 'stats', 'recap'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setMatchDetailsTab(tab)}
                  className={`min-h-[42px] py-2.5 capitalize transition-colors ${
                    matchDetailsTab === tab
                      ? 'text-emerald-700 dark:text-[#00E676] border-b-2 border-[#00E676]'
                      : 'text-slate-500 dark:text-white/50 hover:text-black dark:hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Body Content */}
            <div className="p-4 overflow-y-auto space-y-3 max-h-[48vh] no-scrollbar">
              {matchDetailsTab === 'overview' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 dark:text-white/60 uppercase">
                      Match Incidents Timeline
                    </span>
                    {loadingMatchDetails && (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-[#00E676] animate-pulse">
                        Syncing Flashscore feed...
                      </span>
                    )}
                  </div>

                  {selectedMatchForDetails.events.length === 0 ? (
                    <div className="text-xs text-slate-400 dark:text-white/45 italic py-6 text-center">
                      {loadingMatchDetails
                        ? 'Fetching scorers, cards & incidents...'
                        : 'No incidents recorded yet. Kickoff updates stream here automatically.'}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedMatchForDetails.events.map(ev => {
                        const badge = getEventBadge(ev);
                        const isHome = ev.team === 'home';
                        const teamShort = isHome
                          ? selectedMatchForDetails.homeTeam.shortName || selectedMatchForDetails.homeTeam.name
                          : selectedMatchForDetails.awayTeam.shortName || selectedMatchForDetails.awayTeam.name;

                        return (
                          <div
                            key={ev.id}
                            className={`p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/5 flex items-center justify-between gap-2 text-xs ${
                              isHome ? 'flex-row' : 'flex-row-reverse text-right'
                            }`}
                          >
                            <div className={`flex items-center gap-2 min-w-0 ${isHome ? '' : 'flex-row-reverse'}`}>
                              <span className="text-sm shrink-0">{badge.icon}</span>
                              <div className="min-w-0">
                                <div className={`flex items-center gap-1.5 flex-wrap ${isHome ? '' : 'justify-end'}`}>
                                  <span className="font-bold text-slate-900 dark:text-white truncate">
                                    {ev.player}
                                  </span>
                                  {badge.tag && (
                                    <span className={`text-[10px] font-black uppercase ${badge.colorClass}`}>
                                      {badge.tag}
                                    </span>
                                  )}
                                  <span className="text-[10px] font-semibold text-slate-400 dark:text-white/45">
                                    ({teamShort})
                                  </span>
                                </div>
                                {ev.assist && (
                                  <div className="text-[10px] text-slate-500 dark:text-white/55">
                                    {ev.type === 'substitution' ? `Replaced: ${ev.assist}` : `Assist: ${ev.assist}`}
                                  </div>
                                )}
                                {ev.detail && !ev.assist && (
                                  <div className="text-[10px] text-slate-500 dark:text-white/55">{ev.detail}</div>
                                )}
                              </div>
                            </div>
                            <span className="font-mono tabular-nums font-black text-emerald-700 dark:text-[#00E676] shrink-0 px-2 py-0.5 rounded-md bg-emerald-500/10">
                              {ev.minute}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {matchDetailsTab === 'stats' && (
                <div className="space-y-3">
                  {[
                    {
                      label: 'Ball Possession',
                      hVal: selectedMatchForDetails.stats?.possession?.[0] ?? 50,
                      aVal: selectedMatchForDetails.stats?.possession?.[1] ?? 50,
                      hDisplay: `${selectedMatchForDetails.stats?.possession?.[0] ?? 50}%`,
                      aDisplay: `${selectedMatchForDetails.stats?.possession?.[1] ?? 50}%`,
                    },
                    ...(selectedMatchForDetails.stats?.xg
                      ? [
                          {
                            label: 'Expected Goals (xG)',
                            hVal: Number(selectedMatchForDetails.stats.xg[0] || 0),
                            aVal: Number(selectedMatchForDetails.stats.xg[1] || 0),
                            hDisplay: Number(selectedMatchForDetails.stats.xg[0] || 0).toFixed(2),
                            aDisplay: Number(selectedMatchForDetails.stats.xg[1] || 0).toFixed(2),
                          },
                        ]
                      : []),
                    {
                      label: 'Total Shots',
                      hVal: selectedMatchForDetails.stats?.shots?.[0] ?? 0,
                      aVal: selectedMatchForDetails.stats?.shots?.[1] ?? 0,
                      hDisplay: String(selectedMatchForDetails.stats?.shots?.[0] ?? 0),
                      aDisplay: String(selectedMatchForDetails.stats?.shots?.[1] ?? 0),
                    },
                    {
                      label: 'Shots on Target',
                      hVal: selectedMatchForDetails.stats?.shotsOnTarget?.[0] ?? 0,
                      aVal: selectedMatchForDetails.stats?.shotsOnTarget?.[1] ?? 0,
                      hDisplay: String(selectedMatchForDetails.stats?.shotsOnTarget?.[0] ?? 0),
                      aDisplay: String(selectedMatchForDetails.stats?.shotsOnTarget?.[1] ?? 0),
                    },
                    {
                      label: 'Corner Kicks',
                      hVal: selectedMatchForDetails.stats?.corners?.[0] ?? 0,
                      aVal: selectedMatchForDetails.stats?.corners?.[1] ?? 0,
                      hDisplay: String(selectedMatchForDetails.stats?.corners?.[0] ?? 0),
                      aDisplay: String(selectedMatchForDetails.stats?.corners?.[1] ?? 0),
                    },
                    {
                      label: 'Fouls Committed',
                      hVal: selectedMatchForDetails.stats?.fouls?.[0] ?? 0,
                      aVal: selectedMatchForDetails.stats?.fouls?.[1] ?? 0,
                      hDisplay: String(selectedMatchForDetails.stats?.fouls?.[0] ?? 0),
                      aDisplay: String(selectedMatchForDetails.stats?.fouls?.[1] ?? 0),
                    },
                    {
                      label: 'Yellow Cards',
                      hVal: selectedMatchForDetails.stats?.yellowCards?.[0] ?? 0,
                      aVal: selectedMatchForDetails.stats?.yellowCards?.[1] ?? 0,
                      hDisplay: String(selectedMatchForDetails.stats?.yellowCards?.[0] ?? 0),
                      aDisplay: String(selectedMatchForDetails.stats?.yellowCards?.[1] ?? 0),
                    },
                    {
                      label: 'Red Cards',
                      hVal: selectedMatchForDetails.stats?.redCards?.[0] ?? 0,
                      aVal: selectedMatchForDetails.stats?.redCards?.[1] ?? 0,
                      hDisplay: String(selectedMatchForDetails.stats?.redCards?.[0] ?? 0),
                      aDisplay: String(selectedMatchForDetails.stats?.redCards?.[1] ?? 0),
                    },
                  ].map((stat, i) => {
                    const total = stat.hVal + stat.aVal;
                    const homePct = total > 0 ? Math.round((stat.hVal / total) * 100) : 50;
                    const awayPct = 100 - homePct;
                    return (
                      <div key={i} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-bold text-slate-800 dark:text-white/90 tabular-nums">
                          <span className="font-mono">{stat.hDisplay}</span>
                          <span className="text-[11px] text-slate-500 dark:text-white/55 font-semibold">{stat.label}</span>
                          <span className="font-mono">{stat.aDisplay}</span>
                        </div>
                        <div className="h-2 w-full rounded-full overflow-hidden flex bg-slate-200 dark:bg-white/10 gap-0.5">
                          <div
                            style={{ width: `${homePct}%` }}
                            className="h-full bg-[#00E676] transition-all duration-300"
                          />
                          <div
                            style={{ width: `${awayPct}%` }}
                            className="h-full bg-sky-500 transition-all duration-300"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {matchDetailsTab === 'lineups' && (
                <div className="space-y-3">
                  {selectedMatchForDetails.lineups?.home?.length > 0 ||
                  selectedMatchForDetails.lineups?.away?.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      {/* Home Starting XI */}
                      <div className="space-y-1.5">
                        <div className="font-extrabold text-[11px] text-emerald-700 dark:text-[#00E676] uppercase tracking-wider px-1 truncate">
                          {selectedMatchForDetails.homeTeam.name} XI
                        </div>
                        {selectedMatchForDetails.lineups.home.map((lp, idx) => (
                          <div
                            key={`${lp.name}_${idx}`}
                            className="p-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/5 flex items-center justify-between gap-1"
                          >
                            <div className="min-w-0 flex items-center gap-1.5">
                              <span className="font-mono tabular-nums text-[10px] font-black text-slate-500 dark:text-white/50 w-5 shrink-0">
                                #{lp.number}
                              </span>
                              <div className="min-w-0">
                                <div className="font-bold text-[11px] text-slate-900 dark:text-white truncate">
                                  {lp.name} {lp.isCaptain ? '©' : ''}
                                </div>
                                <div className="text-[9px] text-slate-400 uppercase">{lp.position}</div>
                              </div>
                            </div>
                            {typeof lp.rating === 'number' && lp.rating > 0 && (
                              <span
                                className={`px-1.5 py-0.5 rounded font-mono tabular-nums text-[10px] font-black shrink-0 ${
                                  lp.rating >= 7.5
                                    ? 'bg-[#00E676] text-black'
                                    : lp.rating >= 6.5
                                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-[#00E676]'
                                    : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                }`}
                              >
                                {lp.rating.toFixed(1)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Away Starting XI */}
                      <div className="space-y-1.5">
                        <div className="font-extrabold text-[11px] text-sky-600 dark:text-sky-400 uppercase tracking-wider px-1 truncate text-right">
                          {selectedMatchForDetails.awayTeam.name} XI
                        </div>
                        {selectedMatchForDetails.lineups.away.map((lp, idx) => (
                          <div
                            key={`${lp.name}_${idx}`}
                            className="p-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/5 flex items-center justify-between gap-1"
                          >
                            <div className="min-w-0 flex items-center gap-1.5">
                              <span className="font-mono tabular-nums text-[10px] font-black text-slate-500 dark:text-white/50 w-5 shrink-0">
                                #{lp.number}
                              </span>
                              <div className="min-w-0">
                                <div className="font-bold text-[11px] text-slate-900 dark:text-white truncate">
                                  {lp.name} {lp.isCaptain ? '©' : ''}
                                </div>
                                <div className="text-[9px] text-slate-400 uppercase">{lp.position}</div>
                              </div>
                            </div>
                            {typeof lp.rating === 'number' && lp.rating > 0 && (
                              <span
                                className={`px-1.5 py-0.5 rounded font-mono tabular-nums text-[10px] font-black shrink-0 ${
                                  lp.rating >= 7.5
                                    ? 'bg-[#00E676] text-black'
                                    : lp.rating >= 6.5
                                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-[#00E676]'
                                    : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                }`}
                              >
                                {lp.rating.toFixed(1)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 text-center text-xs text-slate-500 dark:text-white/60">
                      {loadingMatchDetails
                        ? 'Synchronizing Starting XIs from Flashscore feed...'
                        : 'Official tactical lineups are synchronized 45 minutes prior to match kickoff.'}
                    </div>
                  )}
                </div>
              )}

              {matchDetailsTab === 'recap' && (
                <div className="space-y-3">
                  <button
                    onClick={() => handleGenerateAiRecap(selectedMatchForDetails)}
                    disabled={isGeneratingRecap}
                    className="w-full py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c864] text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow transition-all disabled:opacity-50"
                  >
                    <Zap className="w-4 h-4" />
                    <span>{isGeneratingRecap ? 'Analyzing Match...' : 'Generate Match Analysis'}</span>
                  </button>
                  {aiRecapResult && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-white/90 leading-relaxed whitespace-pre-line">
                      {aiRecapResult}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Bottom CTA: Join Match Room */}
            <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0d1117] flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-white/50">
                Match Room is open for fan discussions
              </span>
              <button
                onClick={() => {
                  openMatchRoom(selectedMatchForDetails);
                  setSelectedMatchForDetails(null);
                }}
                className="px-4 py-2 rounded-xl bg-[#00E676] hover:bg-[#00c864] text-black font-bold text-xs flex items-center gap-1.5 shadow"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Join Match Room</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Match Prediction Modal */}
      {showPredictionModal && activePredictionMatch && (() => {
        const activeProb = getMatchProbabilities(activePredictionMatch);
        const isLoadingPred = loadingPredictionMatchId === activePredictionMatch.id;
        const currentVote = userVotes[activePredictionMatch.id];

        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
            <div className="w-full max-w-lg bg-white dark:bg-[#161b22] border border-slate-200 dark:border-white/10 rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
              {/* Header */}
              <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 via-transparent to-sky-500/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#00E676]/20 border border-[#00E676]/30 flex items-center justify-center text-[#00E676]">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>Tactical Match Prediction</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-[#00E676] text-black uppercase">PitchIQ Engine</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-white/50">Form analysis &amp; matchday probability model</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    haptics.light();
                    setShowPredictionModal(false);
                    setActivePredictionMatch(null);
                  }}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/70 hover:text-black dark:hover:text-white flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Modal Content */}
              <div className="p-4 overflow-y-auto space-y-4 max-h-[75vh] no-scrollbar">
                {/* Matchup Card */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5 text-center space-y-3">
                  <div className="text-[11px] font-bold text-slate-400 dark:text-white/50 uppercase tracking-wider">
                    {activePredictionMatch.league} · {activePredictionMatch.status === 'LIVE' ? `LIVE (${activePredictionMatch.minute})` : activePredictionMatch.timeStr || 'Today'}
                  </div>

                  <div className="flex items-center justify-around gap-2">
                    <div className="flex flex-col items-center flex-1">
                      <ClubLogo name={activePredictionMatch.homeTeam.name} rawId={activePredictionMatch.homeTeam.id} size="lg" />
                      <span className="mt-2 text-xs font-black text-slate-900 dark:text-white text-center">
                        {activePredictionMatch.homeTeam.name}
                      </span>
                    </div>

                    <div className="flex flex-col items-center px-2">
                      <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                        {activePredictionMatch.status === 'LIVE' || activePredictionMatch.status === 'FINISHED'
                          ? `${activePredictionMatch.homeTeam.score} - ${activePredictionMatch.awayTeam.score}`
                          : 'VS'}
                      </div>
                      <div className="mt-1 px-2.5 py-0.5 rounded-full bg-[#00E676]/15 border border-[#00E676]/30 text-[10px] font-bold text-[#00E676]">
                        Projected: {activeProb.predictedScore}
                      </div>
                    </div>

                    <div className="flex flex-col items-center flex-1">
                      <ClubLogo name={activePredictionMatch.awayTeam.name} rawId={activePredictionMatch.awayTeam.id} size="lg" />
                      <span className="mt-2 text-xs font-black text-slate-900 dark:text-white text-center">
                        {activePredictionMatch.awayTeam.name}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Win Probability Cards */}
                <div>
                  <div className="text-xs font-bold text-slate-700 dark:text-white/80 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5 text-[#00E676]" />
                      Win Probability Breakdown
                    </span>
                    {isLoadingPred && (
                      <span className="text-[10px] text-[#00E676] animate-pulse">Running Tactical Neural Engine...</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1">
                      <span className="text-[10px] font-bold text-slate-600 dark:text-white/70 truncate block">
                        {activePredictionMatch.homeTeam.name}
                      </span>
                      <div className="text-xl font-black text-[#00E676]">
                        {activeProb.homeWinPct}%
                      </div>
                      <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">Home Win</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center space-y-1">
                      <span className="text-[10px] font-bold text-slate-600 dark:text-white/70 block">
                        Draw
                      </span>
                      <div className="text-xl font-black text-slate-700 dark:text-white">
                        {activeProb.drawPct}%
                      </div>
                      <span className="text-[9px] font-semibold text-slate-500 dark:text-white/50">Tie Game</span>
                    </div>

                    <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-center space-y-1">
                      <span className="text-[10px] font-bold text-slate-600 dark:text-white/70 truncate block">
                        {activePredictionMatch.awayTeam.name}
                      </span>
                      <div className="text-xl font-black text-sky-500">
                        {activeProb.awayWinPct}%
                      </div>
                      <span className="text-[9px] font-semibold text-sky-600 dark:text-sky-400">Away Win</span>
                    </div>
                  </div>
                </div>

                {/* Recent 5-Match Form */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 space-y-2">
                  <div className="text-[11px] font-bold text-slate-600 dark:text-white/70 uppercase tracking-wide">
                    Recent 5-Match Form
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 dark:text-white truncate max-w-[120px]">
                        {activePredictionMatch.homeTeam.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {(activeProb.homeForm || ['W', 'W', 'D', 'W', 'L']).map((res: string, i: number) => (
                          <span
                            key={i}
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                              res === 'W' ? 'bg-[#00E676] text-black' : res === 'D' ? 'bg-amber-400 text-black' : 'bg-rose-500 text-white'
                            }`}
                          >
                            {res}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 dark:text-white truncate max-w-[120px]">
                        {activePredictionMatch.awayTeam.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {(activeProb.awayForm || ['D', 'W', 'L', 'W', 'D']).map((res: string, i: number) => (
                          <span
                            key={i}
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                              res === 'W' ? 'bg-[#00E676] text-black' : res === 'D' ? 'bg-amber-400 text-black' : 'bg-rose-500 text-white'
                            }`}
                          >
                            {res}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tactical Form Breakdown */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-white">
                    <Activity className="w-4 h-4 text-[#00E676]" />
                    <span>Tactical Analysis &amp; Pitch Intel</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-white/80 leading-relaxed">
                    {activeProb.tacticalBreakdown}
                  </p>

                  {/* Key Battles */}
                  {activeProb.keyBattles && activeProb.keyBattles.length > 0 && (
                    <div className="pt-2 border-t border-slate-200 dark:border-white/5 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-white/50 uppercase">Key Match Battles:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {activeProb.keyBattles.map((b: string, i: number) => (
                          <span key={i} className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-white/90 font-medium">
                            ⚔️ {b}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Star Player */}
                  {activeProb.starPlayer && (
                    <div className="pt-2 text-xs flex items-center gap-1.5 text-slate-700 dark:text-white/80 font-medium">
                      <span className="text-[10px] font-bold text-[#00E676] uppercase">Key Star:</span>
                      <span>⭐ {activeProb.starPlayer}</span>
                    </div>
                  )}
                </div>

                {/* Interactive Fan Prediction Vote */}
                <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-500/10 via-transparent to-sky-500/10 border border-emerald-500/20 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-[#00E676]" />
                      Fan Prediction Vote (+10 Points)
                    </span>
                    {currentVote && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#00E676]">
                        <CheckCircle2 className="w-3 h-3" />
                        Voted
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleVote(activePredictionMatch.id, 'home')}
                      className={`py-2 px-1 rounded-xl text-xs font-bold transition-all border ${
                        currentVote === 'home'
                          ? 'bg-[#00E676] text-black border-[#00E676] shadow-sm'
                          : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10'
                      }`}
                    >
                      {activePredictionMatch.homeTeam.name.slice(0, 7)} Win
                    </button>

                    <button
                      onClick={() => handleVote(activePredictionMatch.id, 'draw')}
                      className={`py-2 px-1 rounded-xl text-xs font-bold transition-all border ${
                        currentVote === 'draw'
                          ? 'bg-amber-400 text-black border-amber-400 shadow-sm'
                          : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10'
                      }`}
                    >
                      Draw
                    </button>

                    <button
                      onClick={() => handleVote(activePredictionMatch.id, 'away')}
                      className={`py-2 px-1 rounded-xl text-xs font-bold transition-all border ${
                        currentVote === 'away'
                          ? 'bg-sky-500 text-white border-sky-500 shadow-sm'
                          : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10'
                      }`}
                    >
                      {activePredictionMatch.awayTeam.name.slice(0, 7)} Win
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Footer CTA */}
              <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0d1117] flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-white/50">
                  Discuss live with other fans
                </span>
                <button
                  onClick={() => {
                    haptics.medium();
                    setShowPredictionModal(false);
                    openMatchRoom(activePredictionMatch);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#00E676] hover:bg-[#00c864] text-black font-bold text-xs flex items-center gap-1.5 shadow"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Join Match Room</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
