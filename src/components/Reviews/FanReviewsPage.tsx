import React, { useEffect, useMemo, useState } from 'react';
import {
  Star,
  MessageSquarePlus,
  ThumbsUp,
  ArrowLeft,
  Send,
  Award,
  BookOpen,
  Radio,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { useHaptics } from '../../hooks/useHaptics';
import { formatTodayShort } from '../../utils/dateFormat';

export interface FanReviewEntry {
  id: string;
  entryType: 'review' | 'blog';
  authorName: string;
  authorHandle: string;
  title: string;
  body: string;
  rating: number; // 1-5 for reviews, 5 default for blogs
  helpfulCount: number;
  createdAt: string;
}

const STORAGE_KEY = 'futfield_fan_reviews_v1';

const DEFAULT_ENTRIES: FanReviewEntry[] = [
  {
    id: 'rev_seed_1',
    entryType: 'review',
    authorName: 'Tunde A.',
    authorHandle: '@tunde_afc',
    title: 'Fastest live match chat & 9:16 mobile feel',
    body: 'Using Futfield during North London Derbies is unreal. The Rivalry Intensity thermometer climbs live as rivals talk banter and the scores refresh faster than my stream!',
    rating: 5,
    helpfulCount: 18,
    createdAt: new Date().toISOString().slice(0, 10),
  },
  {
    id: 'rev_seed_2',
    entryType: 'blog',
    authorName: 'Mateo R.',
    authorHandle: '@mateo_tactics',
    title: 'Why 9:16 Shorts + 16:9 Tactical Videos Separate Futfield',
    body: 'Most apps cram highlight clips into one messy feed. Having dedicated under-2m vertical Futfield Tube Quick Kicks for matchday energy and 3m 16:9 videos for pressing analysis is genius.',
    rating: 5,
    helpfulCount: 12,
    createdAt: new Date().toISOString().slice(0, 10),
  },
];

export const FanReviewsPage: React.FC = () => {
  const { user, setActiveTab, goBack, addFanPoints, addNotification } = useFootball();
  const { triggerLight, triggerSuccess } = useHaptics();
  const todayShort = formatTodayShort();

  const [entries, setEntries] = useState<FanReviewEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_ENTRIES;
  });

  const [filterType, setFilterType] = useState<'all' | 'review' | 'blog'>('all');
  const [entryType, setEntryType] = useState<'review' | 'blog'>('review');
  const [authorName, setAuthorName] = useState(user.name || 'Football Fan');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [rating, setRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [upvotedIds, setUpvotedIds] = useState<Record<string, boolean>>({});
  const [justPosted, setJustPosted] = useState(false);

  // Sync with backend lightweight /api/reviews
  useEffect(() => {
    fetch('/api/reviews')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.success && Array.isArray(data.reviews) && data.reviews.length > 0) {
          setEntries(prev => {
            const seen = new Set(data.reviews.map((r: FanReviewEntry) => r.id));
            const localOnly = prev.filter(p => !seen.has(p.id) && p.id.startsWith('rev_local_'));
            return [...localOnly, ...data.reviews];
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 80)));
    } catch {}
  }, [entries]);

  const filteredEntries = useMemo(() => {
    if (filterType === 'all') return entries;
    return entries.filter(e => e.entryType === filterType);
  }, [entries, filterType]);

  const avgRating = useMemo(() => {
    const reviewsOnly = entries.filter(e => e.entryType === 'review');
    if (reviewsOnly.length === 0) return '5.0';
    const sum = reviewsOnly.reduce((acc, r) => acc + (r.rating || 5), 0);
    return (sum / reviewsOnly.length).toFixed(1);
  }, [entries]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (!cleanTitle || !cleanBody) return;

    setSubmitting(true);
    triggerSuccess();

    const newItem: FanReviewEntry = {
      id: `rev_local_${Date.now()}`,
      entryType,
      authorName: authorName.trim() || user.name || 'Football Fan',
      authorHandle: user.handle || '@fan',
      title: cleanTitle,
      body: cleanBody,
      rating: entryType === 'review' ? rating : 5,
      helpfulCount: 1,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.review) {
          newItem.id = data.review.id;
        }
      }
    } catch {}

    setEntries(prev => [newItem, ...prev]);
    setTitle('');
    setBody('');
    setRating(5);
    setSubmitting(false);
    setJustPosted(true);
    setTimeout(() => setJustPosted(false), 2500);

    addFanPoints(20, entryType === 'review' ? 'Published App Review' : 'Published Fan Opinion Blog');
    addNotification({
      title: entryType === 'review' ? 'Review Published! ⭐' : 'Fan Blog Published! ✍️',
      body: `"${cleanTitle}" is now live (+20 FP).`,
      type: 'system',
    });
  };

  const handleUpvote = async (id: string) => {
    if (upvotedIds[id]) return;
    triggerLight();
    setUpvotedIds(prev => ({ ...prev, [id]: true }));
    setEntries(prev =>
      prev.map(item =>
        item.id === id ? { ...item, helpfulCount: (item.helpfulCount || 0) + 1 } : item
      )
    );
    try {
      await fetch(`/api/reviews/${encodeURIComponent(id)}/upvote`, { method: 'POST' });
    } catch {}
  };

  const handleDeleteLocal = (id: string) => {
    triggerLight();
    setEntries(prev => prev.filter(item => item.id !== id));
  };

  return (
    <div className="pb-28 max-w-2xl mx-auto px-3.5 pt-3 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <MessageSquarePlus className="w-5 h-5 text-[#00E676] shrink-0" />
            <span className="truncate">Fan Reviews &amp; Opinions</span>
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-white/55">
            Rate Futfield &amp; publish your own football opinion blog · {todayShort}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerLight();
            goBack();
          }}
          className="min-h-[38px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-xs font-bold text-slate-700 dark:text-white flex items-center gap-1 shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>
      </div>

      {/* Compact Rating Summary Strip */}
      <div className="p-3 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/10 flex items-center justify-between gap-2 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-[#00E676]/15 text-emerald-700 dark:text-[#00E676] flex items-center justify-center font-display font-black text-base tabular-nums">
            {avgRating}★
          </div>
          <div>
            <div className="text-xs font-extrabold text-slate-900 dark:text-white">
              Community Rating ({entries.length} posts)
            </div>
            <div className="text-[10px] text-slate-500 dark:text-white/55">
              Verified fan reviews &amp; supporter blog takes
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <a
            href="/blog"
            onClick={e => {
              e.preventDefault();
              triggerLight();
              setActiveTab('blog');
            }}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 text-[11px] font-bold text-slate-700 dark:text-white hover:text-[#00E676] flex items-center gap-1"
          >
            <BookOpen className="w-3 h-3 text-[#00E676]" />
            <span>Blog</span>
          </a>
          <a
            href="/live-scores"
            onClick={e => {
              e.preventDefault();
              triggerLight();
              setActiveTab('scores');
            }}
            className="px-2.5 py-1.5 rounded-xl bg-[#00E676]/15 text-[11px] font-bold text-emerald-700 dark:text-[#00E676] flex items-center gap-1"
          >
            <Radio className="w-3 h-3" />
            <span>Scores</span>
          </a>
        </div>
      </div>

      {/* Simple & Lightweight Composer */}
      <form
        onSubmit={handleSubmit}
        className="p-3.5 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/10 shadow-sm space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-[#00E676]" />
            <span>Share Your Review or Blog Post</span>
          </span>
          <div className="flex p-0.5 rounded-xl bg-slate-100 dark:bg-white/5 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => {
                triggerLight();
                setEntryType('review');
              }}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                entryType === 'review'
                  ? 'bg-[#00E676] text-black'
                  : 'text-slate-600 dark:text-white/65'
              }`}
            >
              App Review
            </button>
            <button
              type="button"
              onClick={() => {
                triggerLight();
                setEntryType('blog');
              }}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                entryType === 'blog'
                  ? 'bg-[#00E676] text-black'
                  : 'text-slate-600 dark:text-white/65'
              }`}
            >
              Fan Blog
            </button>
          </div>
        </div>

        {/* Star Selector for App Review */}
        {entryType === 'review' && (
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/5">
            <span className="text-[11px] font-bold text-slate-600 dark:text-white/70">
              Your Rating:
            </span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(starVal => (
                <button
                  key={starVal}
                  type="button"
                  onClick={() => {
                    triggerLight();
                    setRating(starVal);
                  }}
                  aria-label={`Rate ${starVal} stars`}
                  className="p-0.5 transition-transform active:scale-90"
                >
                  <Star
                    className={`w-5 h-5 ${
                      starVal <= rating
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-slate-300 dark:text-white/20'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2">
          <input
            type="text"
            value={authorName}
            onChange={e => setAuthorName(e.target.value)}
            maxLength={40}
            placeholder="Your name (e.g. Alex)"
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00E676]"
          />
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={90}
            required
            placeholder={
              entryType === 'review'
                ? 'Review headline (e.g. Best live match chat app!)'
                : 'Blog post title (e.g. Arsenal title race outlook)'
            }
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00E676]"
          />
          <textarea
            rows={3}
            value={body}
            onChange={e => setBody(e.target.value)}
            maxLength={800}
            required
            placeholder={
              entryType === 'review'
                ? 'Share what you love about Futfield or any feedback...'
                : 'Write your football opinion, match analysis, or fan story...'
            }
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00E676] resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !title.trim() || !body.trim()}
          className="w-full min-h-[42px] rounded-2xl bg-[#00E676] hover:bg-[#00c864] disabled:opacity-50 text-black font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#00E676]/20 transition-all"
        >
          {justPosted ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Published! +20 FP</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>{entryType === 'review' ? 'Post App Review' : 'Publish Fan Blog Post'}</span>
            </>
          )}
        </button>
      </form>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5">
        {([
          { id: 'all', label: `All (${entries.length})` },
          { id: 'review', label: 'App Reviews' },
          { id: 'blog', label: 'Fan Blogs' },
        ] as const).map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              triggerLight();
              setFilterType(tab.id);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterType === tab.id
                ? 'bg-slate-900 dark:bg-white text-white dark:text-black'
                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/70'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Simple Feed Cards */}
      <div className="space-y-2.5">
        {filteredEntries.map(item => (
          <article
            key={item.id}
            className="p-3.5 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/10 shadow-sm space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                    item.entryType === 'review'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      : 'bg-emerald-500/15 text-emerald-700 dark:text-[#00E676]'
                  }`}
                >
                  {item.entryType === 'review' ? 'App Review' : 'Fan Blog'}
                </span>
                {item.entryType === 'review' && (
                  <span className="text-xs font-black text-amber-500 tabular-nums">
                    {'★'.repeat(item.rating)}{'☆'.repeat(Math.max(0, 5 - item.rating))}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 shrink-0">{item.createdAt}</span>
            </div>

            <h2 className="font-display text-sm font-extrabold text-slate-900 dark:text-white leading-snug">
              {item.title}
            </h2>
            <p className="text-xs text-slate-600 dark:text-white/75 leading-relaxed whitespace-pre-line">
              {item.body}
            </p>

            <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-white/5 text-[11px]">
              <span className="font-bold text-slate-700 dark:text-white/70 truncate">
                {item.authorName} <span className="text-slate-400 font-normal">{item.authorHandle}</span>
              </span>
              <div className="flex items-center gap-2">
                {item.authorHandle === user.handle && (
                  <button
                    type="button"
                    onClick={() => handleDeleteLocal(item.id)}
                    aria-label="Delete post"
                    className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleUpvote(item.id)}
                  className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${
                    upvotedIds[item.id]
                      ? 'bg-[#00E676]/20 text-emerald-700 dark:text-[#00E676]'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/70 hover:text-[#00E676]'
                  }`}
                >
                  <ThumbsUp className="w-3 h-3" />
                  <span className="tabular-nums">{item.helpfulCount || 0}</span>
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};
