import React, { useEffect, useState, useCallback } from 'react';
import {
  Target,
  Trophy,
  Flame,
  CheckCircle2,
  Zap,
  Shield,
  Calendar,
  TrendingUp,
} from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { ClubLogo } from '../Common/ClubLogo';
import { haptics } from '../../utils/haptics';

interface PredictionRecord {
  id: string;
  userId: string;
  userName: string;
  userHandle: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  outcome: 'home' | 'draw' | 'away';
  homeScore: number;
  awayScore: number;
  doubleConfidence: boolean;
  createdAt: string;
}

interface ConsensusStats {
  total: number;
  homePct: number;
  drawPct: number;
  awayPct: number;
}

interface LeaderboardEntry {
  userId: string;
  userName: string;
  userHandle: string;
  predictionsCount: number;
  pointsEarned: number;
  doubleLocks: number;
}

export const MatchdayPredictorView: React.FC = () => {
  const { matches, user, addFanPoints, addNotification, setActiveTab } = useFootball();

  const [subTab, setSubTab] = useState<'fixtures' | 'mypicks' | 'leaderboard'>('fixtures');
  const [myPicks, setMyPicks] = useState<Record<string, PredictionRecord>>({});
  const [consensusByMatch, setConsensusByMatch] = useState<Record<string, ConsensusStats>>({});
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [draftScores, setDraftScores] = useState<Record<string, { home: number; away: number; lock2x: boolean }>>({});
  const [submittingMatchId, setSubmittingMatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadPredictorData = useCallback(async () => {
    setLoading(true);
    try {
      const [picksRes, lbRes] = await Promise.all([
        fetch(`/api/predictor/predictions?userId=${encodeURIComponent(user.id || 'guest_user')}`),
        fetch('/api/predictor/leaderboard'),
      ]);
      if (picksRes.ok) {
        const data = await picksRes.json();
        if (Array.isArray(data.userPicks)) {
          const map: Record<string, PredictionRecord> = {};
          for (const p of data.userPicks) {
            if (p?.matchId) map[p.matchId] = p;
          }
          setMyPicks(map);
        }
        if (data.consensus && typeof data.consensus === 'object') {
          setConsensusByMatch(data.consensus);
        }
      }
      if (lbRes.ok) {
        const lbData = await lbRes.json();
        if (Array.isArray(lbData.leaderboard)) {
          setLeaderboard(lbData.leaderboard);
        }
      }
    } catch {}
    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    loadPredictorData();
  }, [loadPredictorData]);

  const predictableMatches = matches.slice(0, 14);

  const getDraft = (matchId: string) => {
    if (draftScores[matchId]) return draftScores[matchId];
    const existing = myPicks[matchId];
    if (existing) {
      return {
        home: existing.homeScore,
        away: existing.awayScore,
        lock2x: existing.doubleConfidence,
      };
    }
    return { home: 1, away: 1, lock2x: false };
  };

  const adjustScore = (matchId: string, side: 'home' | 'away', delta: number) => {
    haptics.light();
    const cur = getDraft(matchId);
    const nextVal = Math.max(0, Math.min(9, cur[side] + delta));
    setDraftScores((prev) => ({
      ...prev,
      [matchId]: { ...cur, [side]: nextVal },
    }));
  };

  const toggle2x = (matchId: string) => {
    haptics.light();
    const cur = getDraft(matchId);
    setDraftScores((prev) => ({
      ...prev,
      [matchId]: { ...cur, lock2x: !cur.lock2x },
    }));
  };

  const handleSubmitPrediction = async (
    matchId: string,
    homeTeam: string,
    awayTeam: string,
    forcedOutcome?: 'home' | 'draw' | 'away'
  ) => {
    const cur = getDraft(matchId);
    let homeScore = cur.home;
    let awayScore = cur.away;
    if (forcedOutcome === 'home' && homeScore <= awayScore) {
      homeScore = Math.min(9, awayScore + 1);
    } else if (forcedOutcome === 'away' && awayScore <= homeScore) {
      awayScore = Math.min(9, homeScore + 1);
    } else if (forcedOutcome === 'draw') {
      awayScore = homeScore;
    }

    const outcome: 'home' | 'draw' | 'away' =
      homeScore > awayScore ? 'home' : homeScore < awayScore ? 'away' : 'draw';

    const alreadyPicked = Boolean(myPicks[matchId]);
    setSubmittingMatchId(matchId);
    haptics.success();

    try {
      const res = await fetch('/api/predictor/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id || 'guest_user',
          userName: user.name || 'Football Fan',
          userHandle: user.handle || '@fan',
          matchId,
          homeTeam,
          awayTeam,
          outcome,
          homeScore,
          awayScore,
          doubleConfidence: cur.lock2x,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDraftScores((prev) => ({
          ...prev,
          [matchId]: { home: homeScore, away: awayScore, lock2x: cur.lock2x },
        }));
        if (data.prediction) {
          setMyPicks((prev) => ({ ...prev, [matchId]: data.prediction }));
        }
        if (data.consensus) {
          setConsensusByMatch((prev) => ({ ...prev, [matchId]: data.consensus }));
        }
        if (!alreadyPicked) {
          const pts = cur.lock2x ? 25 : 15;
          addFanPoints(pts, `Matchday Prediction: ${homeTeam} vs ${awayTeam}`);
          addNotification({
            title: `Prediction Locked! (+${pts} FP)`,
            body: `${homeTeam} ${homeScore}-${awayScore} ${awayTeam}${cur.lock2x ? ' · 2x Confidence Active' : ''}`,
            type: 'system',
          });
        } else {
          addNotification({
            title: 'Prediction Updated',
            body: `${homeTeam} ${homeScore}-${awayScore} ${awayTeam}`,
            type: 'system',
          });
        }
        loadPredictorData();
      }
    } catch {}
    setSubmittingMatchId(null);
  };

  const myPicksList = Object.values(myPicks);

  return (
    <div className="space-y-3.5">
      {/* Header Card */}
      <div className="p-4 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-[#00C853]" />
              <span>Matchday Predictor League</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-white/55 mt-0.5">
              Call exact scores &amp; outcomes on today&apos;s fixtures to climb the leaderboard (+15 FP per call).
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-[#00E676] text-[11px] font-black font-mono tabular-nums shrink-0">
            {myPicksList.length} Calls
          </span>
        </div>

        {/* Sub Tabs */}
        <div className="grid grid-cols-3 gap-1.5 bg-slate-100 dark:bg-black/40 p-1 rounded-2xl">
          {[
            { id: 'fixtures', label: `Fixtures (${predictableMatches.length})` },
            { id: 'mypicks', label: `My Picks (${myPicksList.length})` },
            { id: 'leaderboard', label: 'Leaderboard' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                haptics.light();
                setSubTab(tab.id as any);
              }}
              className={`min-h-[38px] py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                subTab === tab.id
                  ? 'bg-[#00E676] text-black shadow-sm'
                  : 'text-slate-600 dark:text-white/65 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* FIXTURES PREDICTOR TAB */}
      {subTab === 'fixtures' && (
        <div className="space-y-3">
          {predictableMatches.length === 0 ? (
            <div className="p-8 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 text-center space-y-2.5">
              <Calendar className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                Syncing Live Matchday Fixtures...
              </p>
              <p className="text-xs text-slate-500 dark:text-white/55">
                Head to Live Scores to refresh today&apos;s kickoff schedule.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('scores')}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#00E676] text-black font-black text-xs"
              >
                Open Live Scores
              </button>
            </div>
          ) : (
            predictableMatches.map((m) => {
              const draft = getDraft(m.id);
              const savedPick = myPicks[m.id];
              const cons = consensusByMatch[m.id] || { total: 0, homePct: 42, drawPct: 26, awayPct: 32 };
              const draftOutcome =
                draft.home > draft.away ? 'home' : draft.home < draft.away ? 'away' : 'draw';

              return (
                <div
                  key={m.id}
                  className={`p-4 rounded-3xl bg-white dark:bg-[#12171F] border transition-all space-y-3 ${
                    savedPick
                      ? 'border-emerald-500/45 dark:border-[#00E676]/40'
                      : 'border-slate-200/90 dark:border-white/8'
                  }`}
                >
                  {/* Competition & Status */}
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-500 dark:text-white/55 truncate">
                      {m.league} · {m.timeStr || m.dateStr}
                    </span>
                    {savedPick ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-[#00E676] font-black shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Picked {savedPick.homeScore}-{savedPick.awayScore}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
                        +15 FP Open
                      </span>
                    )}
                  </div>

                  {/* Teams & Scoreline Stepper */}
                  <div className="grid grid-cols-11 items-center gap-2">
                    <div className="col-span-4 flex flex-col items-center text-center gap-1.5 min-w-0">
                      <ClubLogo name={m.homeTeam.name} size="md" />
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white line-clamp-1">
                        {m.homeTeam.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => adjustScore(m.id, 'home', -1)}
                          className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/10 font-black text-sm text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20"
                          aria-label={`Decrease ${m.homeTeam.name} score`}
                        >
                          -
                        </button>
                        <span className="w-7 text-center font-mono font-black text-base text-slate-900 dark:text-white tabular-nums">
                          {draft.home}
                        </span>
                        <button
                          type="button"
                          onClick={() => adjustScore(m.id, 'home', 1)}
                          className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/10 font-black text-sm text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20"
                          aria-label={`Increase ${m.homeTeam.name} score`}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="col-span-3 flex flex-col items-center justify-center gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        {draftOutcome === 'home' ? '1 · Home' : draftOutcome === 'away' ? '2 · Away' : 'X · Draw'}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggle2x(m.id)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 border transition-all ${
                          draft.lock2x
                            ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40'
                            : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-white/50 border-transparent'
                        }`}
                        title="Double Confidence Boost (+25 FP)"
                      >
                        <Zap className="w-3 h-3" />
                        <span>2x</span>
                      </button>
                    </div>

                    <div className="col-span-4 flex flex-col items-center text-center gap-1.5 min-w-0">
                      <ClubLogo name={m.awayTeam.name} size="md" />
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white line-clamp-1">
                        {m.awayTeam.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => adjustScore(m.id, 'away', -1)}
                          className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/10 font-black text-sm text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20"
                          aria-label={`Decrease ${m.awayTeam.name} score`}
                        >
                          -
                        </button>
                        <span className="w-7 text-center font-mono font-black text-base text-slate-900 dark:text-white tabular-nums">
                          {draft.away}
                        </span>
                        <button
                          type="button"
                          onClick={() => adjustScore(m.id, 'away', 1)}
                          className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/10 font-black text-sm text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20"
                          aria-label={`Increase ${m.awayTeam.name} score`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Quick Outcome Buttons + Lock CTA */}
                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleSubmitPrediction(m.id, m.homeTeam.name, m.awayTeam.name, 'home')}
                      disabled={submittingMatchId === m.id}
                      className={`py-2 rounded-xl text-[11px] font-extrabold transition-all ${
                        draftOutcome === 'home'
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-[#00E676] border border-emerald-500/40'
                          : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/65'
                      }`}
                    >
                      Home ({cons.homePct}%)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSubmitPrediction(m.id, m.homeTeam.name, m.awayTeam.name, 'draw')}
                      disabled={submittingMatchId === m.id}
                      className={`py-2 rounded-xl text-[11px] font-extrabold transition-all ${
                        draftOutcome === 'draw'
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-[#00E676] border border-emerald-500/40'
                          : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/65'
                      }`}
                    >
                      Draw ({cons.drawPct}%)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSubmitPrediction(m.id, m.homeTeam.name, m.awayTeam.name, 'away')}
                      disabled={submittingMatchId === m.id}
                      className={`py-2 rounded-xl text-[11px] font-extrabold transition-all ${
                        draftOutcome === 'away'
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-[#00E676] border border-emerald-500/40'
                          : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/65'
                      }`}
                    >
                      Away ({cons.awayPct}%)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSubmitPrediction(m.id, m.homeTeam.name, m.awayTeam.name)}
                      disabled={submittingMatchId === m.id}
                      className="py-2 rounded-xl bg-[#00E676] hover:bg-[#00C853] text-black font-black text-[11px] shadow-sm transition-all active:scale-95"
                    >
                      {savedPick ? 'Update' : 'Lock Call'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MY PICKS TAB */}
      {subTab === 'mypicks' && (
        <div className="p-4 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-2.5">
          {myPicksList.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <Flame className="w-8 h-8 text-amber-500 mx-auto" />
              <p className="text-sm font-extrabold text-slate-900 dark:text-white">No predictions locked yet</p>
              <p className="text-xs text-slate-500 dark:text-white/55">
                Pick a match scoreline on the Fixtures tab to earn Fan Points.
              </p>
            </div>
          ) : (
            myPicksList.map((pick) => (
              <div
                key={pick.id}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/5 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                    {pick.homeTeam} vs {pick.awayTeam}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-white/55">
                    Outcome: {pick.outcome.toUpperCase()} {pick.doubleConfidence ? '· ⚡ 2x Confidence' : ''}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-xl bg-[#00E676]/15 text-emerald-700 dark:text-[#00E676] font-mono font-black text-sm tabular-nums shrink-0">
                  {pick.homeScore} - {pick.awayScore}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* LEADERBOARD TAB */}
      {subTab === 'leaderboard' && (
        <div className="p-4 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-white/70 flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-500" />
              Global Matchday Predictors
            </h3>
            <span className="text-[11px] text-slate-400">Live Rankings</span>
          </div>

          {loading ? (
            <p className="text-xs text-slate-400 py-6 text-center">Loading predictor standings...</p>
          ) : leaderboard.length === 0 ? (
            <div className="py-8 text-center space-y-1.5">
              <TrendingUp className="w-7 h-7 text-emerald-500 mx-auto" />
              <p className="text-xs font-bold text-slate-700 dark:text-white/75">
                Be the first predictor on today&apos;s board!
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {leaderboard.map((row, idx) => (
                <div
                  key={row.userId}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/5 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-xl font-mono font-black text-xs flex items-center justify-center shrink-0 ${
                        idx === 0
                          ? 'bg-amber-500 text-black'
                          : idx === 1
                          ? 'bg-slate-300 text-black'
                          : idx === 2
                          ? 'bg-amber-700 text-white'
                          : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white/70'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate flex items-center gap-1">
                        <span>{row.userName}</span>
                        {row.userHandle === '@futfield' && (
                          <Shield className="w-3 h-3 text-[#00E676] shrink-0" />
                        )}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-white/50 truncate">
                        {row.userHandle} · {row.predictionsCount} predictions
                      </p>
                    </div>
                  </div>
                  <span className="font-mono font-black text-xs text-emerald-700 dark:text-[#00E676] tabular-nums shrink-0">
                    +{row.pointsEarned} FP
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
