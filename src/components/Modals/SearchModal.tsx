import React, { useState, useEffect } from 'react';
import { Search, X, Users, Calendar, FileText, ArrowRight, PlaySquare, Trophy } from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { TOP_10_LEAGUE_PLAYERS } from '../../data/top10LeaguesPlayers';
import { ClubLogo } from '../Common/ClubLogo';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const SearchModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const {
    communities,
    matches,
    posts,
    videos,
    setActiveTab,
    openMatchRoom,
    setSelectedCommunity,
    setPlayerScoutModalOpen,
    setActiveVideoIndex,
  } = useFootball();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();

  const matchedMatches = q
    ? matches.filter(
        m =>
          m.homeTeam.name.toLowerCase().includes(q) ||
          m.awayTeam.name.toLowerCase().includes(q) ||
          m.league.toLowerCase().includes(q)
      )
    : matches.slice(0, 3);

  const matchedPlayers = q
    ? TOP_10_LEAGUE_PLAYERS.filter(
        pl =>
          pl.name.toLowerCase().includes(q) ||
          pl.club.toLowerCase().includes(q) ||
          pl.league.toLowerCase().includes(q) ||
          pl.nationality.toLowerCase().includes(q)
      ).slice(0, 6)
    : TOP_10_LEAGUE_PLAYERS.slice(0, 4);

  const matchedVideos = q
    ? videos.filter(
        v =>
          v.title.toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q) ||
          (v.clubTag && v.clubTag.toLowerCase().includes(q)) ||
          v.creator.name.toLowerCase().includes(q)
      ).slice(0, 4)
    : [];

  const matchedCommunities = q
    ? communities.filter(
        c => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
      )
    : communities.slice(0, 4);

  const matchedPosts = q
    ? posts.filter(
        p =>
          p.content.toLowerCase().includes(q) ||
          p.author.name.toLowerCase().includes(q) ||
          (p.clubTag && p.clubTag.toLowerCase().includes(q)) ||
          p.tags.some(t => t.toLowerCase().includes(q))
      )
    : [];

  const hasAnyResults =
    matchedMatches.length > 0 ||
    matchedPlayers.length > 0 ||
    matchedVideos.length > 0 ||
    matchedCommunities.length > 0 ||
    matchedPosts.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/85 backdrop-blur-sm flex items-start justify-center p-3 sm:p-4 pt-10 sm:pt-16 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-[#161b22] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[82vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-white/10 flex items-center gap-2.5 bg-slate-50 dark:bg-[#0d1117]">
          <Search className="w-5 h-5 text-slate-400 dark:text-white/50 shrink-0" />
          <input
            type="text"
            placeholder="Search matches, players, reels, clubs, or posts..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-slate-900 dark:text-white text-sm focus:outline-none placeholder:text-slate-400 dark:placeholder:text-white/40 min-w-0"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 dark:text-white/40 hover:text-black dark:hover:text-white"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="min-h-[40px] text-xs px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white/80 hover:bg-slate-300 dark:hover:text-white font-semibold shrink-0"
          >
            Esc
          </button>
        </div>

        {/* Results Stream */}
        <div className="p-4 overflow-y-auto space-y-5 no-scrollbar">
          {/* Matches / Fixtures */}
          {matchedMatches.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-500 dark:text-white/50 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#00E676]" />
                <span>Fixtures &amp; Live Matches</span>
              </div>
              <div className="space-y-1.5">
                {matchedMatches.map(m => (
                  <button
                    key={m.id}
                    onClick={() => {
                      onClose();
                      openMatchRoom(m);
                    }}
                    className="w-full min-h-[52px] text-left p-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/5 flex items-center justify-between transition-colors gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {m.homeTeam.name} vs {m.awayTeam.name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-white/50 truncate">
                        {m.league} · {m.status === 'LIVE' ? `Live (${m.minute}')` : `${m.dateStr} ${m.timeStr}`}
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-700 dark:text-[#00E676] flex items-center gap-1.5 tabular-nums shrink-0">
                      {m.homeTeam.score} - {m.awayTeam.score}
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-white/40" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Top 10 Leagues Players */}
          {matchedPlayers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-white/50 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  <span>Top 10 Leagues Players</span>
                </span>
                <button
                  onClick={() => {
                    onClose();
                    setPlayerScoutModalOpen(true);
                  }}
                  className="text-[11px] font-bold text-emerald-700 dark:text-[#00E676] hover:underline"
                >
                  Open Scout DB
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {matchedPlayers.map(pl => (
                  <button
                    key={pl.id}
                    onClick={() => {
                      onClose();
                      setPlayerScoutModalOpen(true);
                    }}
                    className="min-h-[52px] text-left p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/5 flex items-center justify-between gap-2 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-[#00E676] font-mono text-xs font-black flex items-center justify-center shrink-0 tabular-nums">
                        {pl.rating}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {pl.countryFlag} {pl.name}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-white/50 truncate">
                          {pl.club} · {pl.position}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-white/70 shrink-0 tabular-nums">
                      {pl.stats.goals}G {pl.stats.assists}A
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PitchReels Videos */}
          {matchedVideos.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-500 dark:text-white/50 flex items-center gap-1.5">
                <PlaySquare className="w-3.5 h-3.5 text-blue-500" />
                <span>PitchReels Highlights</span>
              </div>
              <div className="space-y-1.5">
                {matchedVideos.map(v => (
                  <button
                    key={v.id}
                    onClick={() => {
                      const idx = videos.findIndex(item => item.id === v.id);
                      if (idx >= 0) setActiveVideoIndex(idx);
                      onClose();
                      setActiveTab('videos');
                    }}
                    className="w-full min-h-[48px] text-left p-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/5 flex items-center justify-between gap-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{v.title}</div>
                      <div className="text-[11px] text-slate-500 dark:text-white/50 truncate">
                        {v.creator.name} · {v.views} views · {v.likes} likes
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Communities & Clubs */}
          {matchedCommunities.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-500 dark:text-white/50 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-purple-400" />
                <span>Clubs &amp; Communities</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {matchedCommunities.map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCommunity(c);
                      onClose();
                      setActiveTab('communities');
                    }}
                    className="min-h-[52px] text-left p-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/5 flex items-center gap-2.5 transition-colors"
                  >
                    <ClubLogo name={c.name} size="sm" />
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-900 dark:text-white truncate">{c.name}</div>
                      <div className="text-[10px] text-slate-500 dark:text-white/40 truncate">{c.fanCount}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Posts matching */}
          {matchedPosts.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-500 dark:text-white/50 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-500" />
                <span>Matchday Discussions</span>
              </div>
              <div className="space-y-1.5">
                {matchedPosts.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onClose();
                      setActiveTab('home');
                    }}
                    className="w-full text-left p-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/5 space-y-1 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-bold text-slate-900 dark:text-white">{p.author.name}</span>
                      <span className="text-slate-400 dark:text-white/40">· {p.timestamp}</span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-white/80 line-clamp-2">{p.content}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!hasAnyResults && (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-white/40">
              No results found for &quot;{query}&quot;. Try searching for Arsenal, Bellingham, Yamal, or Premier League.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
