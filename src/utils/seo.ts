import { Match } from '../types/football';
import { BLOG_ARTICLES } from '../data/blogArticles';

export const PROD_DOMAIN = 'https://www.futfieldsport.com.ng';
export const CANONICAL_DOMAIN = PROD_DOMAIN;
export const DEFAULT_OG_IMAGE = `${PROD_DOMAIN}/futfield-logo.jpg`;
export const DEFAULT_SEO_TITLE = 'FUTFIELD — Live Football Scores, Match Rooms & Futfield Tube';
export const DEFAULT_SEO_DESCRIPTION =
  'Join worldwide football fans on FUTFIELD! Watch match highlights, join live stadium rooms, and connect with football fans worldwide.';
export const DEFAULT_SEO_KEYWORDS =
  'football app, live scores, football social, soccer chat, match highlights, futfield tube, quick kicks, fanzone';

export interface RouteSeoConfig {
  path: string;
  title: string;
  description: string;
  keywords: string;
  ogType?: 'website' | 'article' | 'profile';
  image?: string;
}

function clampTitle(raw: string): string {
  if (raw.length <= 60) return raw;
  return `${raw.slice(0, 57).trimEnd()}...`;
}

function upsertMetaTag(attrName: 'name' | 'property', key: string, content: string) {
  if (typeof document === 'undefined') return;
  let el = document.querySelector(`meta[${attrName}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLinkTag(rel: string, href: string) {
  if (typeof document === 'undefined') return;
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function upsertJsonLdScript(id: string, payload: any | null) {
  if (typeof document === 'undefined') return;
  let script = document.getElementById(id) as HTMLScriptElement | null;
  if (!payload) {
    if (script) script.remove();
    return;
  }
  if (!script) {
    script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(payload);
}

export function resolvePathFromAppState(params: {
  activeTab: string;
  supportSection?: string;
  activeMatchRoom?: Match | null;
  viewingProfileUserId?: string | null;
  activeBlogSlug?: string | null;
  tubeSubView?: 'feed' | 'watch' | 'kicks' | 'upload' | 'fanzone';
  tubeWatchVideoId?: string | null;
  tubeFanZoneHandle?: string | null;
}): string {
  if (params.activeMatchRoom?.id) {
    return `/match/${encodeURIComponent(params.activeMatchRoom.id)}`;
  }
  if (params.activeTab === 'scores') return '/live-scores';
  if (params.activeTab === 'menu' || params.activeTab === 'studio') return '/features';
  if (params.activeTab === 'pricing') return '/pricing';
  if (params.activeTab === 'blog') {
    return params.activeBlogSlug ? `/blog/${encodeURIComponent(params.activeBlogSlug)}` : '/blog';
  }
  if (params.activeTab === 'profile') {
    const handle = params.viewingProfileUserId || '@fan';
    return `/profile/${encodeURIComponent(handle)}`;
  }
  if (params.activeTab === 'support') {
    if (params.supportSection === 'terms') return '/terms';
    if (params.supportSection === 'privacy') return '/privacy';
    if (params.supportSection === 'refund') return '/refund';
    return '/support';
  }
  if (params.activeTab === 'reviews') return '/reviews';
  if (params.activeTab === 'share') return '/share';
  if (params.activeTab === 'videos') {
    if (params.tubeSubView === 'watch' && params.tubeWatchVideoId) {
      return `/tube/watch/${encodeURIComponent(params.tubeWatchVideoId)}`;
    }
    if (params.tubeSubView === 'kicks') return '/tube/kicks';
    if (params.tubeSubView === 'upload') return '/tube/upload';
    if (params.tubeSubView === 'fanzone' && params.tubeFanZoneHandle) {
      return `/fanzone/${encodeURIComponent(params.tubeFanZoneHandle.replace(/^@/, ''))}`;
    }
    return '/tube';
  }
  if (params.activeTab === 'communities') return '/communities';
  return '/';
}

export function buildRouteSeoConfig(params: {
  activeTab: string;
  supportSection?: string;
  activeMatchRoom?: Match | null;
  viewingProfileUserId?: string | null;
  activeBlogSlug?: string | null;
  tubeSubView?: 'feed' | 'watch' | 'kicks' | 'upload' | 'fanzone';
  tubeWatchVideoId?: string | null;
  tubeFanZoneHandle?: string | null;
}): RouteSeoConfig {
  const path = resolvePathFromAppState(params);

  if (params.activeMatchRoom) {
    const m = params.activeMatchRoom;
    const title = clampTitle(`${m.homeTeam.name} vs ${m.awayTeam.name} | Futfield Match Chat`);
    return {
      path,
      title,
      description: `Join live soccer chat and follow ${m.homeTeam.name} vs ${m.awayTeam.name} (${m.homeTeam.score}-${m.awayTeam.score}) live scores on Futfield.`,
      keywords: `${m.homeTeam.name}, ${m.awayTeam.name}, ${DEFAULT_SEO_KEYWORDS}`,
      ogType: 'article',
    };
  }

  if (params.activeTab === 'videos') {
    if (params.tubeSubView === 'fanzone' && params.tubeFanZoneHandle) {
      return {
        path,
        title: clampTitle(`${params.tubeFanZoneHandle} FanZone | Futfield Tube`),
        description: `Connect with ${params.tubeFanZoneHandle} FanZone for football Clips, Quick Kicks & Matchday Packs on Futfield Tube.`,
        keywords: `Futfield Tube, FanZone, Quick Kicks, ${DEFAULT_SEO_KEYWORDS}`,
        ogType: 'profile',
      };
    }
    if (params.tubeSubView === 'kicks') {
      return {
        path,
        title: clampTitle('Quick Kicks 🔥 | Futfield Tube'),
        description: 'Swipe vertical 9:16 Quick Kicks goals, skills, and fan reactions with stadium audio on Futfield Tube.',
        keywords: `Quick Kicks, Futfield Tube, football clips, ${DEFAULT_SEO_KEYWORDS}`,
      };
    }
    return {
      path,
      title: clampTitle('Futfield Tube 🔥 | Football Clips, Quick Kicks & FanZones'),
      description: 'Watch non-copyright football goals, tactical clips, FanZone battles, and 9:16 Quick Kicks on Futfield Tube.',
      keywords: `Futfield Tube, Quick Kicks, FanZone, ${DEFAULT_SEO_KEYWORDS}`,
    };
  }

  if (params.activeTab === 'scores') {
    return {
      path: '/live-scores',
      title: clampTitle('Live Scores Today | Futfield Football Fan App'),
      description:
        'Follow real-time live football scores across Premier League, UCL, La Liga & Serie A with live soccer chat on Futfield.',
      keywords: `Premier League live scores, UCL scores, ${DEFAULT_SEO_KEYWORDS}`,
    };
  }

  if (params.activeTab === 'reviews') {
    return {
      path: '/reviews',
      title: clampTitle('Fan Reviews & Opinion Blog | Futfield Football App'),
      description:
        'Read real user reviews of Futfield and publish your own football opinion blog post or app rating completely free.',
      keywords: `Futfield reviews, football app reviews, fan opinion blog, ${DEFAULT_SEO_KEYWORDS}`,
    };
  }

  if (params.activeTab === 'share') {
    return {
      path: '/share',
      title: clampTitle('Share Futfield to Phone | SMS, WhatsApp & QR Connect'),
      description:
        'Connect and share Futfield highlights, profiles, and live scores directly to any iPhone or Android phone via SMS, WhatsApp, or QR scan.',
      keywords: `share Futfield, football app invite, live match share, ${DEFAULT_SEO_KEYWORDS}`,
    };
  }

  if (params.activeTab === 'blog') {
    if (params.activeBlogSlug) {
      const article = BLOG_ARTICLES.find(a => a.slug === params.activeBlogSlug);
      if (article) {
        return {
          path: `/blog/${article.slug}`,
          title: clampTitle(article.metaTitle),
          description: article.metaDescription,
          keywords: article.keywords.join(', '),
          ogType: 'article',
          image: `${CANONICAL_DOMAIN}${article.coverImage.startsWith('/') ? article.coverImage : `/${article.coverImage}`}`,
        };
      }
    }
    return {
      path: '/blog',
      title: clampTitle('Futfield Blog | Football Scores, Guides & Transfers'),
      description:
        'Explore 5 viral football guides: live Premier League scores today, best football social app 2026, live match chat, free highlights & transfers.',
      keywords: `football blog, Premier League today, ${DEFAULT_SEO_KEYWORDS}`,
    };
  }

  if (params.activeTab === 'menu' || params.activeTab === 'studio') {
    return {
      path: '/features',
      title: clampTitle('Futfield Features | Matchday Predictor, Trivia & Tube'),
      description:
        'Explore Futfield football app features: Futfield Tube Quick Kicks, Matchday Predictor League, Football IQ Arena trivia & live match rooms.',
      keywords: `matchday predictor, football trivia, ${DEFAULT_SEO_KEYWORDS}`,
    };
  }

  if (params.activeTab === 'pricing') {
    return {
      path: '/pricing',
      title: clampTitle('Futfield Pro Pricing | Unlimited Football Fan Experience'),
      description:
        'Compare Futfield free football fan allowances and Pro VIP passes for 1080p Futfield Tube uploads, priority chat & zero ads.',
      keywords: `Futfield pricing, football app pro, ${DEFAULT_SEO_KEYWORDS}`,
    };
  }

  if (params.activeTab === 'support') {
    if (params.supportSection === 'terms') {
      return {
        path: '/terms',
        title: clampTitle('Terms of Use | Futfield Football Fan App'),
        description: 'Read Futfield Terms of Use covering live match rooms, fair clip sharing, and community conduct.',
        keywords: `Futfield terms, ${DEFAULT_SEO_KEYWORDS}`,
      };
    }
    if (params.supportSection === 'privacy') {
      return {
        path: '/privacy',
        title: clampTitle('Privacy Policy | Futfield Football Social Network'),
        description: 'Learn how Futfield protects supporter privacy, chat data, and MediaGuard uploaded video security.',
        keywords: `Futfield privacy policy, ${DEFAULT_SEO_KEYWORDS}`,
      };
    }
    if (params.supportSection === 'refund') {
      return {
        path: '/refund',
        title: clampTitle('Refund Policy | Futfield Pro Subscriptions'),
        description: 'View Futfield Pro subscription refund terms, billing protections, and direct 24/7 fan support.',
        keywords: `Futfield refund policy, ${DEFAULT_SEO_KEYWORDS}`,
      };
    }
  }

  if (params.activeTab === 'profile') {
    const cleanHandle = (params.viewingProfileUserId || '@fan').replace(/^@?/, '@');
    return {
      path: `/profile/${encodeURIComponent(cleanHandle)}`,
      title: clampTitle(`${cleanHandle} Profile | Futfield Football Fan App`),
      description: `Follow ${cleanHandle} on Futfield — view football takes, Futfield Tube clips, and favorite club stats.`,
      keywords: `${cleanHandle}, football fan profile, ${DEFAULT_SEO_KEYWORDS}`,
      ogType: 'profile',
    };
  }

  return {
    path,
    title: DEFAULT_SEO_TITLE,
    description: DEFAULT_SEO_DESCRIPTION,
    keywords: DEFAULT_SEO_KEYWORDS,
    ogType: 'website',
  };
}

export function buildSportsEventSchema(match: Match) {
  const statusMap: Record<string, string> = {
    LIVE: 'https://schema.org/EventScheduled',
    UPCOMING: 'https://schema.org/EventScheduled',
    FINISHED: 'https://schema.org/EventCompleted',
  };
  const isoToday = new Date().toISOString().slice(0, 10);
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
    description: `${match.league} football match: ${match.homeTeam.name} (${match.homeTeam.score}) vs ${match.awayTeam.name} (${match.awayTeam.score}). Live score and fan chat on Futfield.`,
    startDate: `${isoToday}T15:00:00Z`,
    eventStatus: statusMap[match.status] || 'https://schema.org/EventScheduled',
    sport: 'Soccer',
    url: `${CANONICAL_DOMAIN}/match/${encodeURIComponent(match.id)}`,
    location: {
      '@type': 'Place',
      name: `${match.homeTeam.name} Stadium`,
      address: match.league || 'Global Football Arena',
    },
    homeTeam: {
      '@type': 'SportsTeam',
      name: match.homeTeam.name,
    },
    awayTeam: {
      '@type': 'SportsTeam',
      name: match.awayTeam.name,
    },
    competitor: [
      { '@type': 'SportsTeam', name: match.homeTeam.name },
      { '@type': 'SportsTeam', name: match.awayTeam.name },
    ],
    organizer: {
      '@type': 'Organization',
      name: 'Futfield',
      url: CANONICAL_DOMAIN,
    },
  };
}

export function applyRouteSeoMetadata(params: {
  activeTab: string;
  supportSection?: string;
  activeMatchRoom?: Match | null;
  viewingProfileUserId?: string | null;
  activeBlogSlug?: string | null;
  matches?: Match[];
  tubeSubView?: 'feed' | 'watch' | 'kicks' | 'upload' | 'fanzone';
  tubeWatchVideoId?: string | null;
  tubeFanZoneHandle?: string | null;
}) {
  if (typeof document === 'undefined') return;
  const config = buildRouteSeoConfig(params);
  const canonicalUrl = `${CANONICAL_DOMAIN}${config.path === '/' ? '/' : config.path}`;
  const ogImageUrl = config.image || DEFAULT_OG_IMAGE;

  document.title = config.title;
  upsertMetaTag('name', 'description', config.description);
  upsertMetaTag('name', 'keywords', config.keywords);
  upsertLinkTag('canonical', canonicalUrl);

  upsertMetaTag('property', 'og:type', config.ogType || 'website');
  upsertMetaTag('property', 'og:site_name', 'Futfield');
  upsertMetaTag('property', 'og:title', config.title);
  upsertMetaTag('property', 'og:description', config.description);
  upsertMetaTag('property', 'og:url', canonicalUrl);
  upsertMetaTag('property', 'og:image', ogImageUrl);
  upsertMetaTag('property', 'og:image:alt', 'Futfield illuminated football stadium live scores and fan chat');

  upsertMetaTag('name', 'twitter:card', 'summary_large_image');
  upsertMetaTag('name', 'twitter:title', config.title);
  upsertMetaTag('name', 'twitter:description', config.description);
  upsertMetaTag('name', 'twitter:image', ogImageUrl);
  upsertMetaTag('name', 'twitter:image:alt', 'Futfield football stadium fan social arena');

  // Dynamic route-specific JSON-LD schemas
  if (params.activeMatchRoom) {
    upsertJsonLdScript('futfield-dynamic-schema', buildSportsEventSchema(params.activeMatchRoom));
    upsertJsonLdScript('futfield-faq-schema', null);
  } else if (params.activeTab === 'scores' && Array.isArray(params.matches) && params.matches.length > 0) {
    const eventsGraph = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Futfield Live Football Scores & Fixtures',
      url: `${CANONICAL_DOMAIN}/live-scores`,
      itemListElement: params.matches.slice(0, 15).map((match, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        item: buildSportsEventSchema(match),
      })),
    };
    upsertJsonLdScript('futfield-dynamic-schema', eventsGraph);
    upsertJsonLdScript('futfield-faq-schema', null);
  } else if (params.activeTab === 'blog' && params.activeBlogSlug) {
    const article = BLOG_ARTICLES.find(a => a.slug === params.activeBlogSlug);
    if (article) {
      const todayIso = new Date().toISOString().slice(0, 10);
      upsertJsonLdScript('futfield-dynamic-schema', {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.title,
        description: article.metaDescription,
        keywords: article.keywords.join(', '),
        image: `${CANONICAL_DOMAIN}/og-image.jpg`,
        datePublished: todayIso,
        dateModified: todayIso,
        author: {
          '@type': 'Organization',
          name: 'Futfield',
        },
        publisher: {
          '@type': 'Organization',
          name: 'Futfield',
          logo: {
            '@type': 'ImageObject',
            url: `${CANONICAL_DOMAIN}/og-image.jpg`,
          },
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': `${CANONICAL_DOMAIN}/blog/${article.slug}`,
        },
      });
      upsertJsonLdScript('futfield-faq-schema', {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: article.faqs.map(faq => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      });
    } else {
      upsertJsonLdScript('futfield-dynamic-schema', null);
      upsertJsonLdScript('futfield-faq-schema', null);
    }
  } else {
    upsertJsonLdScript('futfield-dynamic-schema', null);
    upsertJsonLdScript('futfield-faq-schema', null);
  }
}
