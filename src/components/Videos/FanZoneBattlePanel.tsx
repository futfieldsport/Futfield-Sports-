import React, { useEffect, useState } from 'react';
import { Flame, Plus, Swords, Trophy, X } from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { FanZoneBattle, VideoItem } from '../../types/football';
import {
  createFutubeBattle,
  fetchFutubeBattles,
  voteFutubeBattle,
} from '../../services/supabaseClient';
import { haptics } from '../../utils/haptics';

interface FanZoneBattlePanelProps {
  videos: VideoItem[];
  onWatchVideoId: (videoId: string) => void;
}

export const FanZoneBattlePanel: React.FC<FanZoneBattlePanelProps> = ({
  videos,
  onWatchVideoId,
}) => {
  const { user, addNotification, addFanPoints } = useFootball();
  const [battles, setBattles] = useState<FanZoneBattle[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [battleTitle, setBattleTitle] = useState('');
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');
  const [creating, setCreating] = useState(false);

  const loadBattles = () => {
    fetchFutubeBattles(user.id).then((list) => {
      if (Array.isArray(list)) setBattles(list);
    });
  };

  useEffect(() => {
    loadBattles();
  }, [user.id, videos.length]);

  const handleVote = async (battleId: string, side: 'left' | 'right') => {
    haptics.vote();
    const res = await voteFutubeBattle(battleId, user.id, side);
    if (res.success && res.battle) {
      setBattles((prev) => prev.map((b) => (b.id === battleId ? res.battle : b)));
      addFanPoints(3, 'Voted in FanZone Battle');
      addNotification({
        title: 'Battle Vote Counted! 🔥',
        body: `Your vote backed the ${side === 'left' ? res.battle.leftSide.fanzoneName : res.battle.rightSide.fanzoneName}!`,
        type: 'like',
      });
    }
  };

  const handleCreateBattle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leftId || !rightId || leftId === rightId) return;
    setCreating(true);
    const res = await createFutubeBattle(
      battleTitle.trim() || 'FanZone Goal Clash',
      leftId,
      rightId
    );
    setCreating(false);
    if (res.success && res.battle) {
      setBattles((prev) => [res.battle, ...prev]);
      setShowCreate(false);
      setBattleTitle('');
      haptics.success();
    }
  };

  if (battles.length === 0 && videos.length < 2) {
    return null;
  }

  return (
    <section className="rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10 p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#00C853]/15 text-[#00C853] flex items-center justify-center">
            <Swords className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-display font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>FanZone Battle</span>
              <span className="px-2 py-0.5 rounded-full bg-[#00C853] text-black text-[10px] font-black">
                VOTING LIVE
              </span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-white/55">
              2 FanZones go head-to-head — watch both clips and vote the winner!
            </p>
          </div>
        </div>

        {videos.length >= 2 && (
          <button
            type="button"
            onClick={() => {
              setLeftId(videos[0]?.id || '');
              setRightId(videos[1]?.id || '');
              setShowCreate((v) => !v);
            }}
            className="min-h-[36px] px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/10 hover:border-[#00C853] text-slate-800 dark:text-white text-xs font-bold flex items-center gap-1 shrink-0"
          >
            {showCreate ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{showCreate ? 'Close' : 'New Battle'}</span>
          </button>
        )}
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreateBattle}
          className="p-3 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 space-y-2.5"
        >
          <input
            type="text"
            maxLength={80}
            placeholder="Battle title (e.g. Best Top-Bin Strike)"
            value={battleTitle}
            onChange={(e) => setBattleTitle(e.target.value)}
            className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00C853]"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select
              value={leftId}
              onChange={(e) => setLeftId(e.target.value)}
              className="min-h-[40px] px-2.5 rounded-xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white"
            >
              {videos.map((v) => (
                <option key={v.id} value={v.id}>
                  Corner A: {v.title}
                </option>
              ))}
            </select>
            <select
              value={rightId}
              onChange={(e) => setRightId(e.target.value)}
              className="min-h-[40px] px-2.5 rounded-xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white"
            >
              {videos.map((v) => (
                <option key={v.id} value={v.id}>
                  Corner B: {v.title}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={creating || !leftId || !rightId || leftId === rightId}
            className="w-full min-h-[40px] rounded-xl bg-[#00C853] text-black font-black text-xs disabled:opacity-50"
          >
            {creating ? 'Starting Battle...' : 'Launch FanZone Battle ⚡'}
          </button>
        </form>
      )}

      {battles.slice(0, 2).map((battle) => {
        const totalVotes = Math.max(1, battle.leftSide.votes + battle.rightSide.votes);
        const leftPct = battle.leftSide.votes + battle.rightSide.votes === 0
          ? 50
          : Math.round((battle.leftSide.votes / totalVotes) * 100);
        const rightPct = 100 - leftPct;

        return (
          <div
            key={battle.id}
            className="rounded-2xl bg-slate-50 dark:bg-black/35 border border-slate-200/80 dark:border-white/10 p-3 space-y-3"
          >
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-[#00C853]" />
                {battle.title}
              </span>
              <span className="text-[11px] font-mono text-slate-500 dark:text-white/55">
                {battle.leftSide.votes + battle.rightSide.votes} votes
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { key: 'left' as const, data: battle.leftSide, pct: leftPct },
                { key: 'right' as const, data: battle.rightSide, pct: rightPct },
              ].map((side) => {
                const isVoted = battle.userVotedSide === side.key;
                return (
                  <div
                    key={side.key}
                    className={`rounded-2xl overflow-hidden border transition-all bg-white dark:bg-[#12171F] ${
                      isVoted
                        ? 'border-[#00C853] ring-2 ring-[#00C853]/30'
                        : 'border-slate-200 dark:border-white/10'
                    }`}
                  >
                    <div
                      onClick={() => onWatchVideoId(side.data.videoId)}
                      className="relative aspect-video bg-black cursor-pointer overflow-hidden"
                    >
                      {side.data.thumbnailUrl ? (
                        <img
                          src={side.data.thumbnailUrl}
                          alt={side.data.videoTitle}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <video
                          src={`${side.data.videoUrl}#t=0.4`}
                          muted
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-cover"
                        />
                      )}
                      <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-black/80 text-white text-[10px] font-bold">
                        {side.pct}%
                      </span>
                    </div>
                    <div className="p-2.5 space-y-2">
                      <p className="font-bold text-[11px] text-slate-900 dark:text-white line-clamp-1">
                        {side.data.videoTitle}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-white/55 truncate">
                        {side.data.fanzoneName}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleVote(battle.id, side.key)}
                        className={`w-full min-h-[34px] rounded-xl text-[11px] font-black flex items-center justify-center gap-1 transition-all ${
                          isVoted
                            ? 'bg-[#00C853] text-black'
                            : 'bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white hover:bg-[#00C853]/20 hover:text-[#00C853]'
                        }`}
                      >
                        <Flame className="w-3.5 h-3.5" />
                        <span>{isVoted ? `Voted (${side.data.votes})` : `Vote (${side.data.votes})`}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden flex">
              <div
                className="h-full bg-[#00C853] transition-all duration-300"
                style={{ width: `${leftPct}%` }}
              />
              <div
                className="h-full bg-emerald-900/60 dark:bg-white/25 transition-all duration-300"
                style={{ width: `${rightPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </section>
  );
};
