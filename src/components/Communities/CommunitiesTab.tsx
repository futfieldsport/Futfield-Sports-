import React, { useState, useEffect } from 'react';
import { Search, Shield, Users, Check, MessageSquare, Plus } from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { Community } from '../../types/football';
import { CreateCommunityModal } from './CreateCommunityModal';
import { ClubLogo } from '../Common/ClubLogo';

export const CommunitiesTab: React.FC = () => {
  const { communities, posts, toggleJoinCommunity, setActiveTab } = useFootball();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'joined' | 'club' | 'country' | 'league'>('all');
  const [selectedCommunityModal, setSelectedCommunityModal] = useState<Community | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    if (!selectedCommunityModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedCommunityModal(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedCommunityModal]);

  const matchesSearch = (c: Community) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesQ =
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q);
    if (!matchesQ) return false;
    if (categoryFilter === 'joined') return c.isJoined;
    if (categoryFilter === 'all') return true;
    return c.category === categoryFilter;
  };

  const clubs = communities.filter(c => c.category === 'club' && matchesSearch(c));
  const countries = communities.filter(c => c.category === 'country' && matchesSearch(c));
  const leagues = communities.filter(c => c.category === 'league' && matchesSearch(c));
  const joinedCount = communities.filter(c => c.isJoined).length;

  const getCommunityPostCount = (name: string) =>
    posts.filter(
      p =>
        (p.clubTag && p.clubTag.toLowerCase().includes(name.toLowerCase())) ||
        p.content.toLowerCase().includes(name.toLowerCase())
    ).length;

  const renderCommunityCard = (c: Community) => {
    const activityPosts = getCommunityPostCount(c.name);
    return (
      <div
        key={c.id}
        className="rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 p-3.5 flex items-center justify-between gap-3 shadow-sm transition-all hover:border-slate-300 dark:hover:border-white/15"
      >
        <div
          onClick={() => setSelectedCommunityModal(c)}
          className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
        >
          <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/8 flex items-center justify-center shrink-0 p-1.5 overflow-hidden">
            <ClubLogo name={c.name} size="md" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-display font-bold text-slate-900 dark:text-white text-sm truncate">{c.name}</span>
              {c.hasModBadge && (
                <span
                  className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-0.5 shrink-0"
                  title="Official Moderator Community"
                >
                  <Shield className="w-3 h-3" />
                  Mod
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 dark:text-white/55 truncate tabular-nums">
              {c.fanCount} · {activityPosts} posts
            </div>
          </div>
        </div>

        <button
          onClick={() => toggleJoinCommunity(c.id)}
          className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 whitespace-nowrap ${
            c.isJoined
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-[#00E676] border border-emerald-500/35 dark:border-[#00E676]/40 hover:bg-emerald-500/20'
              : 'bg-[#00E676] text-black shadow-sm hover:bg-[#00c864]'
          }`}
        >
          {c.isJoined ? 'Joined' : 'Join'}
        </button>
      </div>
    );
  };

  const hasVisibleResults = clubs.length > 0 || countries.length > 0 || leagues.length > 0;

  return (
    <div className="pb-24 max-w-2xl mx-auto px-3 sm:px-4 pt-3 space-y-4">
      {/* Header with Create Community Button */}
      <div className="pt-1 flex items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight text-slate-900 dark:text-white">Football Communities</h1>
          <p className="text-xs text-slate-500 dark:text-white/55 tabular-nums">
            {joinedCount} joined chapters · {communities.length} total hubs
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="min-h-[44px] flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#00E676] hover:bg-[#00c864] text-black text-xs font-extrabold shadow-md shadow-[#00E676]/20 transition-all active:scale-95 shrink-0 whitespace-nowrap"
          title="Create a new fan community"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>Create Hub</span>
        </button>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {([
          { id: 'all', label: `All (${communities.length})` },
          { id: 'joined', label: `Joined (${joinedCount})` },
          { id: 'club', label: 'Clubs' },
          { id: 'league', label: 'Leagues' },
          { id: 'country', label: 'Countries' },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setCategoryFilter(tab.id)}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 tabular-nums ${
              categoryFilter === tab.id
                ? 'bg-slate-900 dark:bg-white text-white dark:text-black'
                : 'bg-white dark:bg-[#12171F] text-slate-600 dark:text-white/65 border border-slate-200/90 dark:border-white/8 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 dark:text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search clubs, countries, leagues"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full min-h-[44px] bg-white dark:bg-[#12171F] text-slate-900 dark:text-white text-xs rounded-2xl pl-10 pr-10 py-3 border border-slate-200/90 dark:border-white/8 focus:outline-none focus:border-[#00E676]/60 placeholder:text-slate-400 dark:placeholder:text-white/40 shadow-sm"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40 hover:text-slate-900 dark:hover:text-white text-xs"
            aria-label="Clear filter"
          >
            ✕
          </button>
        )}
      </div>

      {!hasVisibleResults ? (
        <div className="rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 p-8 text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-700 dark:text-[#00E676] mx-auto text-xl">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="font-display font-extrabold text-slate-900 dark:text-white text-base">
            {categoryFilter === 'joined' ? 'No joined communities yet' : 'No communities match your filter'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-white/55 max-w-sm mx-auto leading-relaxed">
            {categoryFilter === 'joined'
              ? 'Tap Join on any club, country, or league hub to collect +50 matchday Fan Points and join supporter banter.'
              : 'Try a different search keyword or found a new supporter chapter.'}
          </p>
          <button
            onClick={() => {
              if (categoryFilter === 'joined') {
                setCategoryFilter('all');
              } else {
                setIsCreateOpen(true);
              }
            }}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#00E676] hover:bg-[#00c864] text-black font-extrabold text-xs inline-flex items-center gap-1.5 shadow-md shadow-[#00E676]/20 transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>{categoryFilter === 'joined' ? 'Browse All Hubs' : 'Create Community'}</span>
          </button>
        </div>
      ) : (
        <>
          {clubs.length > 0 && (
            <div className="space-y-2.5">
              <div className="font-display text-base font-extrabold text-slate-900 dark:text-white flex items-center justify-between">
                <span>Clubs</span>
                <span className="text-xs font-sans font-normal text-slate-500 dark:text-white/50 tabular-nums">{clubs.length} active</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {clubs.map(renderCommunityCard)}
              </div>
            </div>
          )}

          {countries.length > 0 && (
            <div className="space-y-2.5">
              <div className="font-display text-base font-extrabold text-slate-900 dark:text-white flex items-center justify-between">
                <span>Countries</span>
                <span className="text-xs font-sans font-normal text-slate-500 dark:text-white/50 tabular-nums">{countries.length} active</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {countries.map(renderCommunityCard)}
              </div>
            </div>
          )}

          {leagues.length > 0 && (
            <div className="space-y-2.5">
              <div className="font-display text-base font-extrabold text-slate-900 dark:text-white flex items-center justify-between">
                <span>Leagues</span>
                <span className="text-xs font-sans font-normal text-slate-500 dark:text-white/50 tabular-nums">{leagues.length} active</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {leagues.map(renderCommunityCard)}
              </div>
            </div>
          )}
        </>
      )}

      {/* Community Detail Hub Modal */}
      {selectedCommunityModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedCommunityModal(null)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 rounded-t-3xl sm:rounded-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 dark:border-white/8 flex items-center justify-between bg-slate-50 dark:bg-white/[0.03]">
              <div className="flex items-center gap-3">
                <ClubLogo name={selectedCommunityModal.name} size="lg" />
                <div>
                  <h3 className="font-display font-extrabold text-slate-900 dark:text-white text-lg leading-tight">
                    {selectedCommunityModal.name}
                  </h3>
                  <div className="text-xs text-slate-500 dark:text-white/55 tabular-nums">
                    {selectedCommunityModal.fanCount} · {getCommunityPostCount(selectedCommunityModal.name)} recent discussions
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedCommunityModal(null)}
                className="min-h-[44px] min-w-[44px] rounded-full bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-white flex items-center justify-center"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 no-scrollbar">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/5">
                <div className="text-xs font-semibold text-slate-500 dark:text-white/50 mb-1">
                  About Community
                </div>
                <p className="text-sm text-slate-700 dark:text-white/90 leading-relaxed">
                  {selectedCommunityModal.description}
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-500 dark:text-white/50">
                  Community Code &amp; Rules
                </div>
                {selectedCommunityModal.rules.map((rule, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200/80 dark:border-white/5 text-xs text-slate-700 dark:text-white/80 flex items-center gap-2"
                  >
                    <Check className="w-3.5 h-3.5 text-[#00E676] shrink-0" />
                    <span>{rule}</span>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-emerald-700 dark:text-[#00E676]">Community Fan Perks</div>
                  <div className="text-[11px] text-slate-600 dark:text-white/70">
                    Earn 2x Fan Points during live matchdays
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedCommunityModal(null);
                    setActiveTab('home');
                    setTimeout(() => window.dispatchEvent(new CustomEvent('futfield:focus-composer')), 80);
                  }}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black text-xs font-bold flex items-center gap-1.5 shrink-0"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Post Take</span>
                </button>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0d1117] flex items-center justify-between gap-2">
              <span className="text-xs text-slate-600 dark:text-white/60">
                {selectedCommunityModal.isJoined ? 'You are a registered fan' : 'Not yet joined'}
              </span>
              <button
                onClick={() => {
                  toggleJoinCommunity(selectedCommunityModal.id);
                  setSelectedCommunityModal(prev =>
                    prev ? { ...prev, isJoined: !prev.isJoined } : null
                  );
                }}
                className={`min-h-[44px] px-5 py-2 rounded-xl text-xs font-bold shadow-md transition-all ${
                  selectedCommunityModal.isJoined
                    ? 'bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-white/10 dark:text-white dark:hover:bg-white/20'
                    : 'bg-[#00E676] text-black shadow-[#00E676]/20'
                }`}
              >
                {selectedCommunityModal.isJoined ? 'Leave Community' : 'Join Community'}
              </button>
            </div>
          </div>
        </div>
      )}

      <CreateCommunityModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </div>
  );
};
