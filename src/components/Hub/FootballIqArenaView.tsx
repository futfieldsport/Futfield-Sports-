import React, { useEffect, useState, useCallback } from 'react';
import {
  Brain,
  CheckCircle2,
  XCircle,
  Trophy,
  Flame,
  BarChart2,
  Plus,
  RotateCcw,
  Clock,
} from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { haptics } from '../../utils/haptics';

interface TriviaQuestion {
  id: string;
  league: string;
  question: string;
  options: string[];
  correctIndex: number;
  fact: string;
}

const TRIVIA_BANK: TriviaQuestion[] = [
  {
    id: 'tq_1',
    league: 'UEFA Champions League',
    question: 'Which club holds the all-time record for the most UEFA Champions League / European Cup titles?',
    options: ['AC Milan', 'Real Madrid', 'Bayern Munich', 'Liverpool'],
    correctIndex: 1,
    fact: 'Real Madrid leads European football history with 15 UEFA Champions League crowns.',
  },
  {
    id: 'tq_2',
    league: 'Premier League',
    question: 'Which Arsenal side went an entire 38-match Premier League season unbeaten in 2003/04?',
    options: ['The Centurions', 'The Invincibles', 'The Class of 92', 'The Treble Winners'],
    correctIndex: 1,
    fact: 'Arsène Wenger’s Invincibles finished with 26 wins, 12 draws, and 0 defeats.',
  },
  {
    id: 'tq_3',
    league: 'AFCON',
    question: 'Which nation has won the Africa Cup of Nations (AFCON) the most times in history?',
    options: ['Nigeria', 'Cameroon', 'Egypt', 'Ghana'],
    correctIndex: 2,
    fact: 'Egypt has lifted the AFCON trophy a record 7 times, including three consecutive wins from 2006 to 2010.',
  },
  {
    id: 'tq_4',
    league: 'FIFA World Cup',
    question: 'Who scored a hat-trick in the 2022 FIFA World Cup Final in Lusail?',
    options: ['Lionel Messi', 'Kylian Mbappé', 'Julián Álvarez', 'Antoine Griezmann'],
    correctIndex: 1,
    fact: 'Kylian Mbappé became only the second player ever to score a World Cup Final hat-trick.',
  },
  {
    id: 'tq_5',
    league: 'Premier League',
    question: 'Who holds the Premier League record for most goals scored in a single 38-game season (36 goals)?',
    options: ['Mohamed Salah', 'Alan Shearer', 'Erling Haaland', 'Thierry Henry'],
    correctIndex: 2,
    fact: 'Erling Haaland netted 36 goals in 35 appearances during his debut 2022/23 Premier League campaign.',
  },
  {
    id: 'tq_6',
    league: 'La Liga',
    question: 'Which stadium is the home ground of FC Barcelona?',
    options: ['Santiago Bernabéu', 'Camp Nou', 'Metropolitano', 'Mestalla'],
    correctIndex: 1,
    fact: 'Spotify Camp Nou is Europe’s largest football stadium by capacity.',
  },
  {
    id: 'tq_7',
    league: 'Football History',
    question: 'Which African striker won the Ballon d’Or in 1995?',
    options: ['Didier Drogba', 'Samuel Eto’o', 'George Weah', 'Jay-Jay Okocha'],
    correctIndex: 2,
    fact: 'Liberian icon George Weah remains the only African player to win the Ballon d’Or.',
  },
  {
    id: 'tq_8',
    league: 'UEFA Champions League',
    question: 'Which stadium hosted the unforgettable 2005 Champions League comeback between AC Milan and Liverpool?',
    options: ['Atatürk Olympic Stadium', 'San Siro', 'Stade de France', 'Wembley'],
    correctIndex: 0,
    fact: 'Liverpool overturned a 3-0 halftime deficit in Istanbul to win on penalties.',
  },
];

interface ArenaPoll {
  id: string;
  question: string;
  category: string;
  authorName: string;
  options: Array<{ id: string; label: string; votes: number }>;
  totalVotes: number;
  userVotedOptionId?: string | null;
}

export const FootballIqArenaView: React.FC = () => {
  const { user, addFanPoints, addNotification } = useFootball();
  const [mode, setMode] = useState<'trivia' | 'polls'>('trivia');

  // Trivia state
  const [questionIdx, setQuestionIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(20);

  // Fan Polls state
  const [polls, setPolls] = useState<ArenaPoll[]>([]);
  const [pollsLoading, setPollsLoading] = useState(false);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [newPollQuestion, setNewPollQuestion] = useState('');
  const [newPollOptA, setNewPollOptA] = useState('');
  const [newPollOptB, setNewPollOptB] = useState('');
  const [newPollOptC, setNewPollOptC] = useState('');

  const currentQuestion = TRIVIA_BANK[questionIdx];

  useEffect(() => {
    if (mode !== 'trivia' || quizFinished || selectedOption !== null) return;
    if (timeLeft <= 0) {
      setSelectedOption(-1);
      setStreak(0);
      setAnsweredCount((c) => c + 1);
      return;
    }
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [mode, quizFinished, selectedOption, timeLeft]);

  const loadPolls = useCallback(async () => {
    setPollsLoading(true);
    try {
      const res = await fetch(`/api/arena/polls?userId=${encodeURIComponent(user.id || 'guest_user')}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.polls)) {
          setPolls(data.polls);
        }
      }
    } catch {}
    setPollsLoading(false);
  }, [user.id]);

  useEffect(() => {
    if (mode === 'polls') {
      loadPolls();
    }
  }, [mode, loadPolls]);

  const handleAnswerTrivia = (idx: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(idx);
    setAnsweredCount((c) => c + 1);

    if (idx === currentQuestion.correctIndex) {
      haptics.success();
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setScore((s) => s + 1);
      const pts = nextStreak >= 3 ? 15 : 10;
      addFanPoints(pts, 'Football IQ Trivia Correct Answer');
    } else {
      haptics.light();
      setStreak(0);
    }
  };

  const handleNextQuestion = () => {
    haptics.light();
    if (questionIdx + 1 >= TRIVIA_BANK.length) {
      setQuizFinished(true);
      addNotification({
        title: `Football IQ Round Complete (${score}/${TRIVIA_BANK.length}) 🏆`,
        body: `You answered ${score} out of ${TRIVIA_BANK.length} questions correctly!`,
        type: 'system',
      });
    } else {
      setQuestionIdx((i) => i + 1);
      setSelectedOption(null);
      setTimeLeft(20);
    }
  };

  const handleRestartTrivia = () => {
    haptics.light();
    setQuestionIdx(0);
    setSelectedOption(null);
    setScore(0);
    setStreak(0);
    setAnsweredCount(0);
    setQuizFinished(false);
    setTimeLeft(20);
  };

  const handleVotePoll = async (pollId: string, optionId: string) => {
    haptics.vote();
    try {
      const res = await fetch(`/api/arena/polls/${encodeURIComponent(pollId)}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id || 'guest_user', optionId }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.poll) {
        setPolls((prev) => prev.map((p) => (p.id === pollId ? data.poll : p)));
        if (!data.alreadyVoted) {
          addFanPoints(5, 'Voted in Football IQ Live Poll');
        }
      }
    } catch {}
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    const opts = [newPollOptA.trim(), newPollOptB.trim(), newPollOptC.trim()].filter(Boolean);
    if (!newPollQuestion.trim() || opts.length < 2) return;
    haptics.success();
    try {
      const res = await fetch('/api/arena/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id || 'guest_user',
          authorName: user.name || 'Football Fan',
          question: newPollQuestion.trim(),
          options: opts,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.poll) {
        setPolls((prev) => [data.poll, ...prev]);
        setNewPollQuestion('');
        setNewPollOptA('');
        setNewPollOptB('');
        setNewPollOptC('');
        setShowCreatePoll(false);
        addFanPoints(10, 'Launched Live Fan Poll');
        addNotification({
          title: 'Fan Poll Published! (+10 FP)',
          body: data.poll.question,
          type: 'system',
        });
      }
    } catch {}
  };

  return (
    <div className="space-y-3.5">
      {/* Header Card */}
      <div className="p-4 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Brain className="w-4 h-4 text-[#00C853]" />
              <span>Football IQ Arena</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-white/55 mt-0.5">
              Test your world football knowledge in timed trivia &amp; vote in live supporter debate polls.
            </p>
          </div>
          {streak > 0 && (
            <span className="px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[11px] font-black flex items-center gap-1 shrink-0">
              <Flame className="w-3.5 h-3.5" />
              {streak} Streak
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-black/40 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => {
              haptics.light();
              setMode('trivia');
            }}
            className={`min-h-[38px] py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
              mode === 'trivia'
                ? 'bg-[#00E676] text-black shadow-sm'
                : 'text-slate-600 dark:text-white/65'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Timed Trivia ({score}/{TRIVIA_BANK.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              haptics.light();
              setMode('polls');
            }}
            className={`min-h-[38px] py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
              mode === 'polls'
                ? 'bg-[#00E676] text-black shadow-sm'
                : 'text-slate-600 dark:text-white/65'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Live Fan Polls</span>
          </button>
        </div>
      </div>

      {/* TRIVIA MODE */}
      {mode === 'trivia' && (
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-4">
          {quizFinished ? (
            <div className="py-6 text-center space-y-3.5">
              <div className="w-14 h-14 rounded-3xl bg-[#00E676]/20 text-[#00C853] mx-auto flex items-center justify-center">
                <Trophy className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-display text-lg font-black text-slate-900 dark:text-white">
                  Final Score: {score} / {TRIVIA_BANK.length}
                </h3>
                <p className="text-xs text-slate-500 dark:text-white/60 mt-1">
                  {score >= 6
                    ? 'World-Class Football Historian! Your matchday IQ is elite.'
                    : 'Solid shift! Replay to sharpen your football trivia streak.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRestartTrivia}
                className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#00E676] hover:bg-[#00C853] text-black font-black text-xs inline-flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Play New Round</span>
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-[#00E676] font-extrabold">
                  Q{questionIdx + 1}/{TRIVIA_BANK.length} · {currentQuestion.league}
                </span>
                <span
                  className={`font-mono font-black flex items-center gap-1 tabular-nums ${
                    timeLeft <= 5 ? 'text-rose-500 animate-pulse' : 'text-slate-600 dark:text-white/70'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  {timeLeft}s
                </span>
              </div>

              <h3 className="font-display text-sm sm:text-base font-black text-slate-900 dark:text-white leading-snug">
                {currentQuestion.question}
              </h3>

              <div className="space-y-2">
                {currentQuestion.options.map((opt, idx) => {
                  const isRevealed = selectedOption !== null;
                  const isCorrect = idx === currentQuestion.correctIndex;
                  const isChosen = idx === selectedOption;

                  let styleClass =
                    'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 text-slate-800 dark:text-white hover:border-[#00E676]';
                  if (isRevealed) {
                    if (isCorrect) {
                      styleClass =
                        'bg-emerald-500/15 border-emerald-500 text-emerald-800 dark:text-[#00E676]';
                    } else if (isChosen) {
                      styleClass = 'bg-rose-500/15 border-rose-500 text-rose-500';
                    } else {
                      styleClass =
                        'bg-slate-50 dark:bg-white/[0.02] border-slate-200/60 dark:border-white/5 text-slate-400';
                    }
                  }

                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={isRevealed}
                      onClick={() => handleAnswerTrivia(idx)}
                      className={`w-full min-h-[46px] px-3.5 py-2.5 rounded-2xl border text-left text-xs font-bold flex items-center justify-between gap-2 transition-all ${styleClass}`}
                    >
                      <span>{opt}</span>
                      {isRevealed && isCorrect && <CheckCircle2 className="w-4 h-4 shrink-0 text-[#00C853]" />}
                      {isRevealed && isChosen && !isCorrect && <XCircle className="w-4 h-4 shrink-0 text-rose-500" />}
                    </button>
                  );
                })}
              </div>

              {selectedOption !== null && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 space-y-2.5">
                  <p className="text-xs text-slate-700 dark:text-white/80 leading-relaxed">
                    <strong className="text-emerald-700 dark:text-[#00E676]">Matchday Fact: </strong>
                    {currentQuestion.fact}
                  </p>
                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    className="w-full min-h-[42px] rounded-xl bg-[#00E676] hover:bg-[#00C853] text-black font-black text-xs"
                  >
                    {questionIdx + 1 >= TRIVIA_BANK.length ? 'View Final Score' : 'Next Question →'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* LIVE FAN POLLS MODE */}
      {mode === 'polls' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-500 dark:text-white/55">
              Vote in live football debates (+5 FP)
            </span>
            <button
              type="button"
              onClick={() => setShowCreatePoll((s) => !s)}
              className="min-h-[36px] px-3 rounded-xl bg-[#00E676] text-black font-black text-xs flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showCreatePoll ? 'Close' : 'New Poll'}</span>
            </button>
          </div>

          {showCreatePoll && (
            <form
              onSubmit={handleCreatePoll}
              className="p-4 rounded-3xl bg-white dark:bg-[#12171F] border border-emerald-500/40 space-y-2.5"
            >
              <input
                type="text"
                placeholder="Ask a football debate question (e.g. Who wins the Champions League?)"
                value={newPollQuestion}
                onChange={(e) => setNewPollQuestion(e.target.value)}
                required
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00E676]"
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Option 1 *"
                  value={newPollOptA}
                  onChange={(e) => setNewPollOptA(e.target.value)}
                  required
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Option 2 *"
                  value={newPollOptB}
                  onChange={(e) => setNewPollOptB(e.target.value)}
                  required
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Option 3 (optional)"
                  value={newPollOptC}
                  onChange={(e) => setNewPollOptC(e.target.value)}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full min-h-[40px] rounded-xl bg-[#00E676] text-black font-black text-xs"
              >
                Publish Fan Poll (+10 FP)
              </button>
            </form>
          )}

          {pollsLoading ? (
            <div className="p-8 rounded-3xl bg-white dark:bg-[#12171F] text-center text-xs text-slate-400">
              Loading live fan polls...
            </div>
          ) : (
            polls.map((poll) => (
              <div
                key={poll.id}
                className="p-4 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-2.5"
              >
                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-white/50">
                  <span className="font-bold text-emerald-700 dark:text-[#00E676]">{poll.category}</span>
                  <span className="tabular-nums">{poll.totalVotes} votes · by {poll.authorName}</span>
                </div>
                <h4 className="font-display font-extrabold text-sm text-slate-900 dark:text-white">
                  {poll.question}
                </h4>
                <div className="space-y-1.5">
                  {poll.options.map((opt) => {
                    const pct = poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0;
                    const isVoted = poll.userVotedOptionId === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleVotePoll(poll.id, opt.id)}
                        className={`relative w-full min-h-[40px] px-3 py-2 rounded-xl border text-left overflow-hidden flex items-center justify-between text-xs font-bold transition-all ${
                          isVoted
                            ? 'border-[#00E676] text-slate-900 dark:text-white'
                            : 'border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/85 hover:border-[#00E676]/50'
                        }`}
                      >
                        <div
                          className={`absolute inset-y-0 left-0 transition-all duration-300 ${
                            isVoted ? 'bg-[#00E676]/25' : 'bg-slate-200/60 dark:bg-white/10'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                        <span className="relative z-10">{opt.label}</span>
                        <span className="relative z-10 font-mono tabular-nums text-[11px] font-black">
                          {pct}% ({opt.votes})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
