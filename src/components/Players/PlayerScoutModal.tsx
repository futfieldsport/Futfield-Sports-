import React, { useState, useEffect } from 'react';
import {
  Search,
  Trophy,
  Plus,
  Check,
  Zap,
  X,
  Radio,
  ArrowLeftRight,
  ChevronLeft,
} from 'lucide-react';
import { FootballPlayer, TOP_10_LEAGUES } from '../../data/top10LeaguesPlayers';
import { useFootball } from '../../context/FootballContext';

interface PlayerScoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PlayerScoutModal: React.FC<PlayerScoutModalProps> = ({ isOpen, onClose }) => {
  const { user, updateUser, addFanPoints } = useFootball();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeague, setSelectedLeague] = useState<string>('all');
  const [selectedPosition, setSelectedPosition] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'rating' | 'goals' | 'assists' | 'age'>('rating');

  const [playersList, setPlayersList] = useState<FootballPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<FootballPlayer | null>(null);
  const [comparePlayer, setComparePlayer] = useState<FootballPlayer | null>(null);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);

  // Fetch players from backend endpoint `/api/football/players`
  const fetchPlayers = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('query', searchQuery.trim());
      if (selectedLeague !== 'all') params.set('league', selectedLeague);
      if (selectedPosition !== 'all') params.set('position', selectedPosition);
      params.set('sort', sortBy);

      const res = await fetch(`/api/football/players?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const nextPlayers: FootballPlayer[] = data.players || [];
        setPlayersList(nextPlayers);
        if (nextPlayers.length > 0 && !selectedPlayer) {
          setSelectedPlayer(nextPlayers[0]);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch top league players:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPlayers();
    }
  }, [isOpen, selectedLeague, selectedPosition, sortBy]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      fetchPlayers();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isFavorite = (name: string) => {
    return (user.favoritePlayers || []).some(p => p.toLowerCase().includes(name.toLowerCase()));
  };

  const handleToggleFavorite = (player: FootballPlayer) => {
    let nextList = [...(user.favoritePlayers || [])];
    if (isFavorite(player.name)) {
      nextList = nextList.filter(p => !p.toLowerCase().includes(player.name.toLowerCase()));
    } else {
      nextList.push(player.name);
      addFanPoints(15, `Added ${player.name} to favorite players`);
    }
    updateUser({ favoritePlayers: nextList });
  };

  const handleSelectPlayer = async (player: FootballPlayer) => {
    setSelectedPlayer(player);
    setMobileShowDetail(true);
    try {
      const res = await fetch(`/api/football/player/${encodeURIComponent(player.id)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.player) {
          setSelectedPlayer(prev => (prev?.id === player.id ? data.player : prev));
        }
      }
    } catch {}
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl h-[90vh] max-h-[840px] rounded-3xl bg-white dark:bg-[#0f141a] border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/5 flex items-center justify-between gap-3 bg-slate-50 dark:bg-[#131922]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-[#00E676]/10 text-emerald-700 dark:text-[#00E676] border border-[#00E676]/20 shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                  Top 10 Leagues Player Database
                </h2>
                <span className="text-[11px] font-bold text-emerald-700 dark:text-[#00E676]">
                  Live Global Scout
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-white/55 truncate">
                Premier League, La Liga, Serie A, Bundesliga, Ligue 1, MLS, Saudi Pro &amp; more
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-200/70 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white/70 hover:text-black dark:hover:text-white transition-colors shrink-0"
            aria-label="Close Player Scout"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-3 sm:p-4 bg-slate-100 dark:bg-[#111720] border-b border-slate-200 dark:border-white/5 space-y-2.5">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search player by name, club, position, or nationality (e.g. Haaland, Saka, Yamal)..."
              className="w-full min-h-[44px] bg-white dark:bg-black/50 text-slate-900 dark:text-white text-xs rounded-xl pl-9 pr-4 py-2.5 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-[#00E676] placeholder:text-slate-400 dark:placeholder:text-white/40"
            />
          </div>

          {/* League Filter Scroll */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              onClick={() => setSelectedLeague('all')}
              className={`min-h-[36px] px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                selectedLeague === 'all'
                  ? 'bg-[#00E676] text-black font-extrabold shadow'
                  : 'bg-white dark:bg-white/5 text-slate-700 dark:text-white/70 hover:text-black dark:hover:text-white border border-slate-200 dark:border-white/10'
              }`}
            >
              All 10 Leagues ({playersList.length})
            </button>
            {TOP_10_LEAGUES.map(league => (
              <button
                key={league.id}
                onClick={() => setSelectedLeague(league.id)}
                className={`min-h-[36px] flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                  selectedLeague === league.id
                    ? 'bg-[#00E676] text-black font-extrabold shadow'
                    : 'bg-white dark:bg-white/5 text-slate-700 dark:text-white/70 hover:text-black dark:hover:text-white border border-slate-200 dark:border-white/10'
                }`}
              >
                <span>{league.flag}</span>
                <span>{league.name}</span>
              </button>
            ))}
          </div>

          {/* Position & Sort Filter Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-0.5">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="font-semibold text-[11px] text-slate-500 dark:text-white/50 mr-1">Pos:</span>
              {(['all', 'FW', 'MF', 'DF', 'GK'] as const).map(pos => (
                <button
                  key={pos}
                  onClick={() => setSelectedPosition(pos)}
                  className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition-colors ${
                    selectedPosition === pos
                      ? 'bg-[#00E676] text-black font-extrabold'
                      : 'bg-white dark:bg-white/5 text-slate-600 dark:text-white/60 hover:text-black dark:hover:text-white border border-slate-200 dark:border-white/10'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-[11px] text-slate-500 dark:text-white/50">Sort:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="min-h-[34px] bg-white dark:bg-black/60 text-slate-900 dark:text-white text-[11px] font-semibold rounded-lg px-2.5 py-1 border border-slate-200 dark:border-white/10 focus:outline-none"
              >
                <option value="rating">Rating (Highest)</option>
                <option value="goals">Top Scorers (Goals)</option>
                <option value="assists">Top Playmakers (Assists)</option>
                <option value="age">Age (Youngest)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content: 9:16 Single-Pane Players List OR Selected Player Detail */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Players List (hidden if viewing detail sheet) */}
          <div className={`flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar ${mobileShowDetail ? 'hidden' : 'block'}`}>
            {isLoading ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-white/60">
                Loading players from Top 10 Leagues...
              </div>
            ) : playersList.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-white/60">
                No players match your filter. Try searching for a different name or league.
              </div>
            ) : (
              playersList.map(player => {
                const isSelected = selectedPlayer?.id === player.id;
                const isCompared = comparePlayer?.id === player.id;
                const favorited = isFavorite(player.name);
                return (
                  <div
                    key={player.id}
                    onClick={() => handleSelectPlayer(player)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 group ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-[#00E676] shadow-sm'
                        : 'bg-slate-50 dark:bg-[#151b23] border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white dark:bg-black/60 border border-slate-200 dark:border-white/10 flex flex-col items-center justify-center shrink-0 tabular-nums">
                        <span className="text-xs font-black text-emerald-700 dark:text-[#00E676]">{player.rating}</span>
                        <span className="text-[9px] font-bold text-slate-500 dark:text-white/50 uppercase">{player.position}</span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white truncate">
                          <span>{player.countryFlag}</span>
                          <span className="group-hover:text-emerald-700 dark:group-hover:text-[#00E676] transition-colors truncate">{player.name}</span>
                          <span className="text-[10px] text-slate-400 dark:text-white/40 shrink-0">#{player.number}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-white/50 truncate">
                          <span>{player.club}</span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{player.league}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="text-right mr-1 tabular-nums">
                        <div className="font-mono text-xs font-black text-slate-900 dark:text-white">
                          {player.stats.goals}G · {player.stats.assists}A
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-white/45">{player.marketValue}</div>
                      </div>

                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setComparePlayer(prev => (prev?.id === player.id ? null : player));
                        }}
                        className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border transition-all ${
                          isCompared
                            ? 'bg-amber-500 text-black border-amber-500'
                            : 'bg-white dark:bg-white/5 text-slate-600 dark:text-white/60 hover:text-black dark:hover:text-white border-slate-200 dark:border-white/10'
                        }`}
                        title={isCompared ? 'Remove from comparison' : 'Compare with selected player'}
                        aria-label={`Compare ${player.name}`}
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleToggleFavorite(player);
                        }}
                        className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border transition-all ${
                          favorited
                            ? 'bg-[#00E676] text-black border-[#00E676]'
                            : 'bg-white dark:bg-white/5 text-slate-600 dark:text-white/50 hover:text-black dark:hover:text-white border-slate-200 dark:border-white/10'
                        }`}
                        title={favorited ? 'In favorite players' : 'Add to favorite players'}
                        aria-label={`Favorite ${player.name}`}
                      >
                        {favorited ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Selected Player Detail Card + Optional Comparison */}
          <div className={`flex-1 p-4 flex-col justify-between bg-slate-50 dark:bg-[#111720] overflow-y-auto no-scrollbar ${mobileShowDetail ? 'flex' : 'hidden'}`}>
            {mobileShowDetail && (
              <button
                onClick={() => setMobileShowDetail(false)}
                className="min-h-[40px] mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-white hover:text-[#00E676]"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back to Players List</span>
              </button>
            )}

            {selectedPlayer ? (
              <div className="space-y-4">
                {/* Player Header Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-100 dark:from-emerald-950/60 to-white dark:to-black border border-emerald-500/30 text-center relative overflow-hidden shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="text-left">
                      <div className="text-3xl font-black text-emerald-700 dark:text-[#00E676] tabular-nums">{selectedPlayer.rating}</div>
                      <div className="text-xs font-extrabold text-slate-600 dark:text-white/70 uppercase">{selectedPlayer.position} · Age {selectedPlayer.age}</div>
                      <div className="text-sm mt-1">{selectedPlayer.countryFlag}</div>
                    </div>
                    <span className="text-2xl">{selectedPlayer.clubCrest}</span>
                  </div>

                  <div className="mt-1">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">{selectedPlayer.name}</h3>
                    <div className="text-xs text-emerald-700 dark:text-[#00E676] font-semibold">{selectedPlayer.specificRole}</div>
                    <div className="text-xs text-slate-600 dark:text-white/60">{selectedPlayer.club} · {selectedPlayer.league}</div>
                  </div>
                </div>

                {/* Head-to-Head Comparison Drawer (when second player selected) */}
                {comparePlayer && comparePlayer.id !== selectedPlayer.id && (
                  <div className="p-3.5 rounded-2xl bg-white dark:bg-black/50 border border-amber-500/40 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        <span>Head-to-Head Comparison</span>
                      </span>
                      <button
                        onClick={() => setComparePlayer(null)}
                        className="text-[11px] font-bold text-slate-500 hover:text-slate-900 dark:text-white/50 dark:hover:text-white"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="grid grid-cols-3 text-[11px] font-bold border-b border-slate-200 dark:border-white/10 pb-1.5">
                      <span className="truncate text-emerald-700 dark:text-[#00E676]">{selectedPlayer.name}</span>
                      <span className="text-center text-slate-400">Stat</span>
                      <span className="truncate text-right text-amber-600 dark:text-amber-400">{comparePlayer.name}</span>
                    </div>
                    {[
                      { label: 'Rating', a: selectedPlayer.rating, b: comparePlayer.rating },
                      { label: 'Goals', a: selectedPlayer.stats.goals, b: comparePlayer.stats.goals },
                      { label: 'Assists', a: selectedPlayer.stats.assists, b: comparePlayer.stats.assists },
                      { label: 'Pass %', a: selectedPlayer.stats.passAccuracy, b: comparePlayer.stats.passAccuracy },
                      { label: 'Apps', a: selectedPlayer.stats.appearances, b: comparePlayer.stats.appearances },
                    ].map(row => (
                      <div key={row.label} className="grid grid-cols-3 text-xs items-center tabular-nums">
                        <span className={`font-mono font-black ${row.a >= row.b ? 'text-emerald-700 dark:text-[#00E676]' : 'text-slate-600 dark:text-white/70'}`}>
                          {row.a}
                        </span>
                        <span className="text-center text-[10px] text-slate-500 dark:text-white/50">{row.label}</span>
                        <span className={`font-mono font-black text-right ${row.b >= row.a ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-white/70'}`}>
                          {row.b}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Key Stats Bar */}
                <div className="grid grid-cols-4 gap-2 text-center tabular-nums">
                  <div className="p-2 rounded-xl bg-white dark:bg-black/40 border border-slate-200 dark:border-white/5">
                    <div className="font-mono text-sm font-black text-slate-900 dark:text-white">{selectedPlayer.stats.goals}</div>
                    <div className="text-[10px] text-slate-500 dark:text-white/50">Goals</div>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-black/40 border border-slate-200 dark:border-white/5">
                    <div className="font-mono text-sm font-black text-slate-900 dark:text-white">{selectedPlayer.stats.assists}</div>
                    <div className="text-[10px] text-slate-500 dark:text-white/50">Assists</div>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-black/40 border border-slate-200 dark:border-white/5">
                    <div className="font-mono text-sm font-black text-slate-900 dark:text-white">{selectedPlayer.stats.passAccuracy}%</div>
                    <div className="text-[10px] text-slate-500 dark:text-white/50">Pass Acc</div>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-black/40 border border-slate-200 dark:border-white/5">
                    <div className="font-mono text-sm font-black text-slate-900 dark:text-white">{selectedPlayer.stats.appearances}</div>
                    <div className="text-[10px] text-slate-500 dark:text-white/50">Apps</div>
                  </div>
                </div>

                {/* Player Traits & Bio */}
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl bg-white dark:bg-black/40 border border-slate-200 dark:border-white/5 space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-[#00E676]" />
                      <span>Playing Style</span>
                    </div>
                    <div className="text-slate-600 dark:text-white/70 leading-relaxed">{selectedPlayer.playingStyle}</div>
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-black/40 border border-slate-200 dark:border-white/5 space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white">Scouting Bio</div>
                    <p className="text-slate-600 dark:text-white/65 leading-relaxed text-[11px]">{selectedPlayer.bio}</p>
                  </div>

                  {/* Tactical Intelligence Summary */}
                  <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-black/50 border border-emerald-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-emerald-700 dark:text-[#00E676] uppercase tracking-wider flex items-center gap-1">
                        <Radio className="w-3 h-3 text-[#00E676]" />
                        Tactical Fit Breakdown
                      </span>
                      <span className="text-[10px] font-black text-emerald-700 dark:text-[#00E676] tabular-nums">
                        {Math.min(99, selectedPlayer.rating + 4)}% Squad Fit
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 pt-1 text-center tabular-nums">
                      <div className="p-2 rounded-xl bg-white dark:bg-black/40 border border-slate-200 dark:border-white/5">
                        <div className="font-mono text-xs font-black text-emerald-700 dark:text-[#00E676]">
                          {((selectedPlayer.stats.goals + selectedPlayer.stats.assists) / Math.max(1, selectedPlayer.stats.appearances)).toFixed(2)}
                        </div>
                        <div className="text-[9px] text-slate-500 dark:text-white/50">G+A / Match</div>
                      </div>
                      <div className="p-2 rounded-xl bg-white dark:bg-black/40 border border-slate-200 dark:border-white/5">
                        <div className="font-mono text-xs font-black text-emerald-700 dark:text-[#00E676]">
                          {selectedPlayer.stats.passAccuracy}%
                        </div>
                        <div className="text-[9px] text-slate-500 dark:text-white/50">Distribution</div>
                      </div>
                      <div className="p-2 rounded-xl bg-white dark:bg-black/40 border border-slate-200 dark:border-white/5">
                        <div className="font-mono text-xs font-black text-emerald-700 dark:text-[#00E676]">
                          {selectedPlayer.marketValue}
                        </div>
                        <div className="text-[9px] text-slate-500 dark:text-white/50">Valuation</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Favorite Action */}
                <button
                  onClick={() => handleToggleFavorite(selectedPlayer)}
                  className={`w-full min-h-[44px] py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                    isFavorite(selectedPlayer.name)
                      ? 'bg-emerald-500/20 text-emerald-800 dark:text-[#00E676] border border-[#00E676]/40'
                      : 'bg-[#00E676] hover:bg-[#00c864] text-black shadow-lg shadow-[#00E676]/20'
                  }`}
                >
                  {isFavorite(selectedPlayer.name) ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>In Your Favorite Players</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Add to Favorite Players (+15 pts)</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="m-auto text-center text-xs text-slate-500 dark:text-white/50">
                Select a player to view their scouting report
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
