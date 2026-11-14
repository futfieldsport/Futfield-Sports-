import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Clock,
  ArrowLeft,
  Share2,
  Check,
  TrendingUp,
  Radio,
  Crown,
  ChevronRight,
  Tag,
  HelpCircle,
  MessageSquarePlus,
} from 'lucide-react';
import { BLOG_ARTICLES, BlogArticle } from '../../data/blogArticles';
import { useFootball } from '../../context/FootballContext';
import { useHaptics } from '../../hooks/useHaptics';
import { CANONICAL_DOMAIN } from '../../utils/seo';

export const BlogPage: React.FC = () => {
  const { activeBlogSlug, openBlogArticle, setActiveTab, goBack, addNotification } = useFootball();
  const { triggerLight, triggerSuccess } = useHaptics();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const activeArticle: BlogArticle | null = useMemo(
    () => (activeBlogSlug ? BLOG_ARTICLES.find(a => a.slug === activeBlogSlug) || null : null),
    [activeBlogSlug]
  );

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(BLOG_ARTICLES.map(a => a.category)))],
    []
  );

  const filteredArticles = useMemo(() => {
    if (selectedCategory === 'All') return BLOG_ARTICLES;
    return BLOG_ARTICLES.filter(a => a.category === selectedCategory);
  }, [selectedCategory]);

  const countWords = (article: BlogArticle) =>
    [article.title, ...article.sections.flatMap(s => [s.heading, ...s.paragraphs])]
      .join(' ')
      .trim()
      .split(/\s+/).length;

  const handleCopyArticleUrl = async (article: BlogArticle) => {
    triggerSuccess();
    const url = `${CANONICAL_DOMAIN}/blog/${article.slug}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: article.title,
          text: article.metaDescription,
          url,
        });
      } catch {}
    } else {
      navigator.clipboard?.writeText(url);
    }
    setCopiedSlug(article.slug);
    addNotification({
      title: 'Article Link Copied!',
      body: `Ready to share: ${url}`,
      type: 'system',
    });
    setTimeout(() => setCopiedSlug(null), 2200);
  };

  if (activeArticle) {
    const wordCount = countWords(activeArticle);
    const articleUrl = `${CANONICAL_DOMAIN}/blog/${activeArticle.slug}`;
    const shareText = `${activeArticle.title} — ${activeArticle.metaDescription}`;
    const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${articleUrl}`)}`;
    const twitterHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(activeArticle.title)}&url=${encodeURIComponent(articleUrl)}`;
    const facebookHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`;

    return (
      <article className="pb-28 max-w-2xl mx-auto px-3.5 pt-3 space-y-4">
        {/* Top Back & Copy Row */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-white/10">
          <a
            href="/blog"
            onClick={e => {
              e.preventDefault();
              triggerLight();
              openBlogArticle(null);
            }}
            className="min-h-[42px] px-2.5 flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-white hover:text-[#00E676] rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>All Blog Guides</span>
          </a>

          <button
            type="button"
            onClick={() => handleCopyArticleUrl(activeArticle)}
            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#00E676]/15 hover:bg-[#00E676]/25 text-emerald-700 dark:text-[#00E676] text-xs font-bold flex items-center gap-1.5"
          >
            {copiedSlug === activeArticle.slug ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span>Copy Link</span>
              </>
            )}
          </button>
        </div>

        {/* Main Article Card */}
        <div className="rounded-3xl overflow-hidden border border-slate-200 dark:border-white/10 bg-white dark:bg-[#12171F] shadow-sm">
          <div className="relative h-44 w-full bg-black overflow-hidden">
            <img
              src={activeArticle.coverImage}
              alt={activeArticle.coverAlt}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-bold text-white/90">
              <span className="px-2.5 py-0.5 rounded-full bg-[#00E676] text-black">
                {activeArticle.category}
              </span>
              <span className="flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded-full">
                <Clock className="w-3 h-3 text-[#00E676]" />
                {activeArticle.readTime} · {wordCount} words
              </span>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <header className="space-y-2">
              <h1 className="font-display text-xl font-black tracking-tight text-slate-900 dark:text-white leading-snug">
                {activeArticle.title}
              </h1>
              <p className="text-xs font-medium text-slate-600 dark:text-white/70 leading-relaxed">
                {activeArticle.subtitle}
              </p>
              <div className="text-[11px] text-slate-500 dark:text-white/55 flex flex-wrap items-center gap-2">
                <span>By {activeArticle.author}</span>
                <span aria-hidden="true">·</span>
                <span>Published {activeArticle.publishedAt}</span>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-700 dark:text-[#00E676] font-semibold">futfieldsport.com.ng</span>
              </div>
            </header>

            {/* Viral Social Share Buttons: WhatsApp, Twitter, Facebook */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 space-y-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-white/55 block">
                Share This Guide Worldwide
              </span>
              <div className="grid grid-cols-3 gap-2 text-xs font-extrabold">
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => triggerSuccess()}
                  className="min-h-[38px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1 transition-colors"
                >
                  <span>WhatsApp</span>
                </a>
                <a
                  href={twitterHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => triggerSuccess()}
                  className="min-h-[38px] rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white/15 dark:hover:bg-white/25 text-white flex items-center justify-center gap-1 transition-colors"
                >
                  <span>Twitter / X</span>
                </a>
                <a
                  href={facebookHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => triggerSuccess()}
                  className="min-h-[38px] rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-1 transition-colors"
                >
                  <span>Facebook</span>
                </a>
              </div>
            </div>

            {/* 600+ Word Editorial Sections */}
            <div className="space-y-4">
              {activeArticle.sections.map((section, idx) => (
                <section key={idx} className="space-y-2">
                  <h2 className="font-display text-base font-extrabold text-slate-900 dark:text-white">
                    {section.heading}
                  </h2>
                  {section.paragraphs.map((para, pIdx) => (
                    <p
                      key={pIdx}
                      className="text-xs sm:text-[13px] text-slate-700 dark:text-white/80 leading-relaxed"
                    >
                      {para}
                    </p>
                  ))}
                </section>
              ))}
            </div>

            {/* Internal Links CTA Box to /live-scores & /pricing */}
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-[#00E676]/30 flex flex-col gap-2.5">
              <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                Explore Live Matches &amp; Futfield Pro Plans
              </div>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href="/live-scores"
                  onClick={e => {
                    e.preventDefault();
                    triggerLight();
                    setActiveTab('scores');
                  }}
                  className="min-h-[42px] px-3 py-2 rounded-xl bg-[#00E676] text-black text-xs font-extrabold flex items-center justify-center gap-1.5"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Live Scores</span>
                </a>
                <a
                  href="/pricing"
                  onClick={e => {
                    e.preventDefault();
                    triggerLight();
                    setActiveTab('pricing');
                  }}
                  className="min-h-[42px] px-3 py-2 rounded-xl bg-slate-900 text-white dark:bg-white/10 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Crown className="w-3.5 h-3.5 text-[#00E676]" />
                  <span>View Pricing</span>
                </a>
              </div>
            </div>

            {/* 3-Question FAQ Rich Snippet Section */}
            <section
              aria-labelledby="blog-faq-heading"
              className="pt-3 border-t border-slate-200 dark:border-white/10 space-y-2.5"
            >
              <h2
                id="blog-faq-heading"
                className="font-display text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5"
              >
                <HelpCircle className="w-4 h-4 text-[#00E676]" />
                <span>Frequently Asked Questions</span>
              </h2>
              <div className="space-y-2">
                {activeArticle.faqs.map((faq, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/8 space-y-1"
                  >
                    <h3 className="text-xs font-extrabold text-slate-900 dark:text-white leading-snug">
                      {faq.question}
                    </h3>
                    <p className="text-[11px] text-slate-600 dark:text-white/75 leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* SEO Keyword Tags */}
            <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex flex-wrap gap-1.5">
              {activeArticle.keywords.map(kw => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 text-[10px] font-bold text-slate-600 dark:text-white/65"
                >
                  <Tag className="w-3 h-3 text-[#00E676]" />
                  {kw}
                </span>
              ))}
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="pb-28 max-w-2xl mx-auto px-3.5 pt-3 space-y-4">
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#00E676]" />
            <span>Futfield Football Blog</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-white/55">
            Live Premier League scores, match chat, free highlights &amp; transfer guides
          </p>
        </div>
        <button
          onClick={() => {
            triggerLight();
            goBack();
          }}
          className="min-h-[40px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-xs font-bold text-slate-700 dark:text-white"
        >
          ← Back
        </button>
      </div>

      {/* Quick Banner Link to Community App Reviews & Fan Opinions Page */}
      <a
        href="/reviews"
        onClick={e => {
          e.preventDefault();
          triggerLight();
          setActiveTab('reviews');
        }}
        className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-[#00E676]/15 to-blue-500/10 border border-[#00E676]/35 hover:border-[#00E676] transition-all group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#00E676] text-black flex items-center justify-center shrink-0">
            <MessageSquarePlus className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black text-slate-900 dark:text-white truncate">
              Write Your Own Review or Fan Blog Post
            </div>
            <div className="text-[11px] text-slate-600 dark:text-white/70 truncate">
              Rate Futfield &amp; share your opinion in 1 tap
            </div>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-[#00E676] shrink-0 group-hover:translate-x-0.5 transition-transform" />
      </a>

      {/* Category Filter Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => {
              triggerLight();
              setSelectedCategory(cat);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? 'bg-[#00E676] text-black shadow-sm'
                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/10'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 5 SEO Articles Cards */}
      <div className="space-y-3.5">
        {filteredArticles.map(article => {
          const words = countWords(article);
          return (
            <a
              key={article.slug}
              href={`/blog/${article.slug}`}
              onClick={e => {
                e.preventDefault();
                triggerLight();
                openBlogArticle(article.slug);
              }}
              className="block rounded-3xl overflow-hidden bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/10 shadow-sm hover:border-[#00E676]/50 transition-all cursor-pointer group"
            >
              <div className="relative h-36 w-full bg-black overflow-hidden">
                <img
                  src={article.coverImage}
                  alt={article.coverAlt}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-[#00E676] text-black text-[10px] font-black">
                  {article.category}
                </div>
                <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[11px] font-bold text-white/85">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-[#00E676]" />
                    <span>3 FAQs Included</span>
                  </span>
                  <span>{article.readTime} · {words} words</span>
                </div>
              </div>

              <div className="p-4 space-y-2">
                <h2 className="font-display text-base font-extrabold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-[#00E676] transition-colors leading-snug">
                  {article.title}
                </h2>
                <p className="text-xs text-slate-600 dark:text-white/70 line-clamp-2 leading-relaxed">
                  {article.metaDescription}
                </p>
                <div className="pt-1 flex items-center justify-between text-[11px] font-bold text-emerald-700 dark:text-[#00E676]">
                  <span>Read full guide + FAQs</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </a>
          );
        })}
      </div>

      {/* Footer Internal Links to /live-scores & /pricing */}
      <div className="pt-1 flex items-center justify-center gap-3 text-xs font-bold">
        <a
          href="/live-scores"
          onClick={e => {
            e.preventDefault();
            triggerLight();
            setActiveTab('scores');
          }}
          className="text-emerald-700 dark:text-[#00E676] hover:underline"
        >
          Check Live Scores →
        </a>
        <span className="text-slate-300 dark:text-white/20">|</span>
        <a
          href="/pricing"
          onClick={e => {
            e.preventDefault();
            triggerLight();
            setActiveTab('pricing');
          }}
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          View Pro Pricing →
        </a>
      </div>
    </div>
  );
};
