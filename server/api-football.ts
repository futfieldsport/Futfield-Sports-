import express from 'express';

const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io';
const ALLOWED_ENDPOINTS = new Set([
  'status',
  'timezone',
  'countries',
  'leagues',
  'seasons',
  'teams',
  'teams/statistics',
  'venues',
  'standings',
  'fixtures',
  'fixtures/rounds',
  'fixtures/headtohead',
  'fixtures/statistics',
  'fixtures/events',
  'fixtures/lineups',
  'fixtures/players',
  'injuries',
  'predictions',
  'coachs',
  'players',
  'players/squads',
  'players/topscorers',
  'players/topassists',
  'transfers',
  'trophies',
  'sidelined',
  'odds',
  'odds/live',
]);
const LIVE_TTL_MS = 15_000;
const DEFAULT_TTL_MS = 5 * 60_000;
const MAX_CACHE_ENTRIES = 500;

type CacheEntry = { expires: number; status: number; body: unknown };
const cache = new Map<string, CacheEntry>();

function getApiKey() {
  return process.env.API_FOOTBALL_KEY || process.env.APISPORTS_KEY || '';
}

function ttlFor(endpoint: string, query: URLSearchParams) {
  return endpoint === 'odds/live' || query.get('live') ? LIVE_TTL_MS : DEFAULT_TTL_MS;
}

export const footballRouter = express.Router();

footballRouter.get('/health', (_req, res) => {
  res.json({ provider: 'api-football', configured: Boolean(getApiKey()) });
});

footballRouter.get('/*', async (req, res) => {
  const endpoint = String((req.params as Record<string, string>)[0] || '').replace(/^\/+|\/+$/g, '');
  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return res.status(404).json({ error: `Unknown API-Football endpoint: ${endpoint}` });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return res.status(503).json({ error: 'API_FOOTBALL_KEY is not configured on the server.' });
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string' && /^[a-z_]+$/i.test(key)) query.set(key, value.slice(0, 200));
  }
  query.sort();
  const cacheKey = `${endpoint}?${query}`;

  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(cached.status).json(cached.body);
  }

  try {
    const upstream = await fetch(`${API_FOOTBALL_BASE}/${endpoint}?${query}`, {
      headers: { 'x-apisports-key': apiKey },
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await upstream.json()) as { errors?: unknown };
    const hasErrors =
      body?.errors && (Array.isArray(body.errors) ? body.errors.length > 0 : Object.keys(body.errors).length > 0);
    const status = upstream.ok && hasErrors ? 502 : upstream.status;

    if (status === 200) {
      if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as string);
      cache.set(cacheKey, { expires: Date.now() + ttlFor(endpoint, query), status, body });
    }
    const remaining = upstream.headers.get('x-ratelimit-requests-remaining');
    if (remaining) res.setHeader('X-RateLimit-Requests-Remaining', remaining);
    res.setHeader('X-Cache', 'MISS');
    return res.status(status).json(body);
  } catch (error) {
    console.error('[API-Football] request failed:', endpoint, (error as Error).message);
    return res.status(502).json({ error: 'API-Football request failed.' });
  }
});
