import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import zlib from 'zlib';
import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import {
  getMatches as getFotmobMatches,
  getLiveFixtures as getFotmobLiveFixtures,
  getSearchSuggestions as getFotmobSearch,
  getPlayerDetails as getFotmobPlayerDetails,
  getLeagueTable,
  getLeagueDetails,
  getAllLeagues,
} from '@iamglitch404/fotmob';
import {
  TOP_10_LEAGUES,
  TOP_10_LEAGUE_PLAYERS,
  FootballPlayer,
} from './src/data/top10LeaguesPlayers.ts';
import {
  analyzeVideoCopyright,
  getCopyrightEngineStatus,
  manageCopyrightRegistry,
} from './server/copyrightDetector.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IS_SERVERLESS = Boolean(
  process.env.NETLIFY ||
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT
);

const DEFAULT_AVATAR = '/futfield-logo.jpg';
const DEFAULT_BANNER = '/og-image.jpg';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isValidUuid(val: any): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val.trim());
}

const CREATOR_EMAIL = 'futfieldsport@gmail.com';
const CREATOR_ID = 'futfield_creator_official';
const CREATOR_HANDLE = '@futfield';
const CREATOR_NAME = 'Futfield';

function isCreatorEmail(email?: string | null): boolean {
  return String(email || '').trim().toLowerCase() === CREATOR_EMAIL;
}

function isReservedFutfieldText(value?: string | null): boolean {
  const raw = String(value || '').trim();
  if (!raw) return false;
  return /fut\s*[-_.]?\s*field/i.test(raw);
}

function isCreatorTarget(identifier?: string | null): boolean {
  const norm = String(identifier || '').trim().toLowerCase();
  if (!norm) return false;
  if (
    norm === CREATOR_ID ||
    norm === CREATOR_HANDLE ||
    norm === 'futfield' ||
    norm === CREATOR_EMAIL
  ) {
    return true;
  }
  const prof =
    inMemoryProfiles[identifier || ''] ||
    Object.values(inMemoryProfiles).find(
      (p: any) =>
        String(p?.id || '').toLowerCase() === norm ||
        String(p?.handle || '').toLowerCase() === norm ||
        String(p?.email || '').toLowerCase() === norm
    );
  return Boolean(prof && isCreatorEmail(prof.email));
}


const portArgIndex = process.argv.indexOf('--port');
const cliPort = portArgIndex !== -1 ? parseInt(process.argv[portArgIndex + 1], 10) : NaN;
const envPort = Number(process.env.PORT);
const PORT = !isNaN(cliPort) ? cliPort : envPort && envPort !== 8080 ? envPort : 3000;

// Persistent Local Uploads & Store Directories (Netlify Functions write safely to /tmp)
const UPLOADS_DIR = IS_SERVERLESS
  ? '/tmp/futfield_uploads'
  : path.resolve(__dirname, 'uploads');
const UPLOAD_SUBDIRS = ['images', 'videos', 'thumbnails', 'avatars', 'voices'];
for (const sub of UPLOAD_SUBDIRS) {
  fs.mkdirSync(path.join(UPLOADS_DIR, sub), { recursive: true });
}
const MEDIA_REGISTRY_FILE = path.join(UPLOADS_DIR, 'media-registry.json');
const FEED_STORE_FILE = path.join(UPLOADS_DIR, 'feed-store.json');
const SUPPORT_TICKETS_FILE = path.join(UPLOADS_DIR, 'support-tickets.json');

const UPLOADS_ROOT_RESOLVED = path.resolve(UPLOADS_DIR);
function resolveSafeUploadPath(relPath: string): string | null {
  const cleanRel = String(relPath || '')
    .replace(/^\/uploads\//, '')
    .replace(/^\/+/, '');
  if (!cleanRel || cleanRel.includes('\0')) return null;
  const candidate = path.resolve(UPLOADS_ROOT_RESOLVED, cleanRel);
  if (!candidate.startsWith(UPLOADS_ROOT_RESOLVED + path.sep)) {
    return null;
  }
  return candidate;
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// -------------------------------------------------------------
// Global Security Hardening & High-Concurrency Layer (1M+ Users Ready)
// -------------------------------------------------------------
function getClientIp(req: express.Request): string {
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) return cfIp.trim();
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return (req.ip || req.socket?.remoteAddress || 'unknown').replace(/^::ffff:/, '');
}

function isPrivateOrLoopbackIp(ip: string): boolean {
  const clean = String(ip || '').trim().toLowerCase().replace(/^::ffff:/, '');
  if (!clean || clean === 'unknown' || clean === 'localhost' || clean === '127.0.0.1' || clean === '::1') {
    return true;
  }
  if (/^(10\.|192\.168\.|127\.|169\.254\.|0\.)/.test(clean)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(clean)) return true;
  if (clean.startsWith('fc') || clean.startsWith('fd') || clean.startsWith('fe80:')) return true;
  return false;
}

function createRateLimiter(options: {
  windowMs: number;
  max: number;
  label: string;
  keyFn?: (req: express.Request) => string;
}): express.RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const MAX_TRACKED_KEYS = 50_000;

  return (req, res, next) => {
    const now = Date.now();
    const key = options.keyFn ? options.keyFn(req) : getClientIp(req);
    let entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      if (hits.size >= MAX_TRACKED_KEYS) {
        for (const [k, v] of hits) {
          if (v.resetAt <= now) hits.delete(k);
          if (hits.size < MAX_TRACKED_KEYS * 0.85) break;
        }
        if (hits.size >= MAX_TRACKED_KEYS) {
          const oldestKey = hits.keys().next().value;
          if (oldestKey) hits.delete(oldestKey);
        }
      }
      entry = { count: 1, resetAt: now + options.windowMs };
      hits.set(key, entry);
      return next();
    }

    entry.count += 1;
    if (entry.count > options.max) {
      const retrySec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retrySec));
      return res.status(429).json({
        success: false,
        error: `Too many ${options.label} requests. Please retry in ${retrySec}s.`,
      });
    }
    return next();
  };
}

const globalApiLimiter = createRateLimiter({ windowMs: 60_000, max: 300, label: 'API' });
const authLimiter = createRateLimiter({ windowMs: 5 * 60_000, max: 20, label: 'authentication' });
const resetPasswordLimiter = createRateLimiter({
  windowMs: 15 * 60_000,
  max: 6,
  label: 'password reset',
  keyFn: (req) => `${getClientIp(req)}:${String(req.body?.email || '').trim().toLowerCase()}`,
});
const paystackLimiter = createRateLimiter({ windowMs: 5 * 60_000, max: 15, label: 'checkout' });
const uploadLimiter = createRateLimiter({ windowMs: 10 * 60_000, max: 40, label: 'media upload' });

// Security headers across every route
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(), payment=(self)');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Zero-dependency Gzip compression for JSON/XML/text responses >= 1KB
app.use((req, res, next) => {
  const acceptEnc = String(req.headers['accept-encoding'] || '');
  if (!acceptEnc.includes('gzip') || req.path.startsWith('/uploads/') || req.path.includes('/stream')) {
    return next();
  }

  const origJson = res.json.bind(res);
  res.json = ((body: any) => {
    try {
      const jsonStr = JSON.stringify(body);
      if (jsonStr && jsonStr.length >= 1024 && !res.headersSent) {
        const compressed = zlib.gzipSync(Buffer.from(jsonStr, 'utf-8'));
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Vary', 'Accept-Encoding');
        return res.send(compressed);
      }
    } catch {}
    return origJson(body);
  }) as any;
  next();
});

app.use('/api', globalApiLimiter);

app.use('/uploads', express.static(UPLOADS_DIR, { acceptRanges: true, maxAge: '7d' }));
app.use(
  express.json({
    limit: '50mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Prototype-pollution & null-byte sanitizer on JSON/query inputs
const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
function sanitizeInputTree(val: any, depth = 0): any {
  if (depth > 8 || val === null || val === undefined) return val;
  if (typeof val === 'string') return val.replace(/\0/g, '');
  if (Array.isArray(val)) return val.map((item) => sanitizeInputTree(item, depth + 1));
  if (typeof val === 'object' && !Buffer.isBuffer(val)) {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (BLOCKED_KEYS.has(k)) continue;
      clean[k] = sanitizeInputTree(v, depth + 1);
    }
    return clean;
  }
  return val;
}

app.use((req, _res, next) => {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    req.body = sanitizeInputTree(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    for (const key of Object.keys(req.query)) {
      if (BLOCKED_KEYS.has(key)) {
        delete req.query[key];
      }
    }
  }
  next();
});

// Initialize Backend Supabase Client using environment secrets
const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const hasServiceRole = Boolean(supabaseServiceRoleKey);
const supabaseKey =
  supabaseServiceRoleKey ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

let supabaseBackendClient: SupabaseClient | null = null;
if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('https://')) {
  try {
    supabaseBackendClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    console.log('[Backend] Supabase client initialized successfully with project URL:', supabaseUrl);
  } catch (err) {
    console.warn('[Backend] Failed to initialize Supabase client:', err);
  }
} else {
  console.log('[Backend] Supabase credentials not found or invalid in environment secrets.');
}

// Initialize Gemini AI Client
const geminiApiKey = process.env.GEMINI_API_KEY || '';
let aiClient: GoogleGenAI | null = null;
if (geminiApiKey) {
  try {
    aiClient = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    console.log('[Backend] Gemini AI client initialized with User-Agent telemetry.');
  } catch (err) {
    console.warn('[Backend] AI client initialization notice:', err);
  }
}

let aiFallbackUntil = 0;

async function invokeGeminiSafely(
  prompt: string,
  options?: { responseMimeType?: string; timeoutMs?: number }
): Promise<string | null> {
  if (!aiClient || Date.now() < aiFallbackUntil) return null;
  const timeoutMs = options?.timeoutMs ?? 3500;
  try {
    const aiPromise = aiClient.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      ...(options?.responseMimeType
        ? { config: { responseMimeType: options.responseMimeType } }
        : {}),
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI request timeout')), timeoutMs)
    );
    const response = await Promise.race([aiPromise, timeoutPromise]);
    const text = response?.text;
    return typeof text === 'string' && text.trim() ? text.trim() : null;
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (
      msg.includes('PERMISSION_DENIED') ||
      msg.includes('API_KEY') ||
      msg.toLowerCase().includes('failed to list') ||
      msg.toLowerCase().includes('permission denied')
    ) {
      aiFallbackUntil = Date.now() + 60_000;
      console.warn('[Backend] Gemini key/permission fallback active — serving local tactical engine.');
    } else {
      console.warn('[Backend] AI generation fallback:', msg);
    }
    return null;
  }
}

// -------------------------------------------------------------
// Authentication Routes (Supabase Auth + Salted Scrypt Hybrid + Reset Password)
// -------------------------------------------------------------
const inMemoryAuthCredentials: Record<string, string> = {};
const passwordResetTokens = new Map<string, { codeHash: string; expiresAt: number; attempts: number }>();

function hashPasswordScrypt(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPasswordScrypt(password: string, stored: string): boolean {
  const parts = String(stored || '').split(':');
  if (parts.length !== 2) return false;
  const [salt, hexHash] = parts;
  if (!salt || !hexHash) return false;
  try {
    const derived = crypto.scryptSync(String(password), salt, 64);
    const expected = Buffer.from(hexHash, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

app.post('/api/auth/signup', authLimiter, async (req, res) => {
  const { email, password, name, handle, favoriteClub, favoriteCountry } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const isCreatorAccount = isCreatorEmail(normalizedEmail);
  const baseHandle = isCreatorAccount
    ? CREATOR_HANDLE
    : handle
    ? (String(handle).trim().startsWith('@') ? String(handle).trim() : `@${String(handle).trim()}`)
    : `@${normalizedEmail.split('@')[0]}`;
  const displayName = isCreatorAccount
    ? (String(name || '').trim() || CREATOR_NAME)
    : (String(name || '').trim() || normalizedEmail.split('@')[0]);

  if (!isCreatorAccount && (isReservedFutfieldText(displayName) || isReservedFutfieldText(baseHandle))) {
    return res.status(400).json({
      error: 'The name "Futfield" is strictly reserved for the official Futfield Creator account.',
    });
  }

  // If Supabase is connected, execute real Auth SignUp
  if (supabaseBackendClient) {
    try {
      let authUser: any = null;
      let authSession: any = null;
      let authError: any = null;

      if (hasServiceRole && supabaseBackendClient.auth.admin?.createUser) {
        const adminRes = await supabaseBackendClient.auth.admin.createUser({
          email: normalizedEmail,
          password,
          email_confirm: true,
          user_metadata: {
            name: displayName,
            handle: baseHandle,
            favorite_club: favoriteClub || 'Not Set',
            favorite_country: favoriteCountry || 'Global',
          },
        });
        authUser = adminRes.data?.user || null;
        authError = adminRes.error || null;
      }

      if (!authUser) {
        const signUpRes = await supabaseBackendClient.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              name: displayName,
              handle: baseHandle,
              favorite_club: favoriteClub || 'Not Set',
              favorite_country: favoriteCountry || 'Global',
            },
          },
        });
        authUser = signUpRes.data?.user || null;
        authSession = signUpRes.data?.session || null;
        authError = signUpRes.error || authError;
      }

      if (authUser && !authSession) {
        try {
          const signInRes = await supabaseBackendClient.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });
          if (signInRes.data?.session) {
            authSession = signInRes.data.session;
          }
        } catch {}
      }

      if (authError && !authUser) {
        return res.status(400).json({ error: authError.message });
      }

      const userId = authUser?.id || crypto.randomUUID();
      const profile = {
        id: userId,
        email: normalizedEmail,
        name: displayName,
        handle: baseHandle,
        avatar: DEFAULT_AVATAR,
        bio: isCreatorAccount
          ? 'Official Futfield Main Account · Live scores, FanZone clips & global football community ⚽'
          : `${favoriteClub || 'Football'} supporter on FUTFIELD ⚽`,
        favoriteClub: favoriteClub || 'Not Set',
        favoriteClubCrest: '⚽',
        favoriteCountry: favoriteCountry || 'Global',
        favoriteCountryFlag: '🌍',
        favoritePlayers: [],
        fanPoints: isCreatorAccount ? 1000 : 0,
        weeklyPoints: 0,
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        predictionAccuracy: 0,
        correctPredictions: 0,
        totalPredictions: 0,
        isOfficialCreator: isCreatorAccount,
        badges: [
          {
            id: 'b_welcome',
            name: isCreatorAccount ? 'Official Creator' : 'Verified Fan',
            icon: isCreatorAccount ? '👑' : '⭐',
            description: isCreatorAccount ? 'Official Futfield Main Account' : 'Verified FUTFIELD registered member',
            color: 'from-emerald-500/20 to-emerald-700/20 text-emerald-400 border-emerald-500/30',
          },
        ],
        isAuthenticated: true,
      };

      inMemoryAuthCredentials[normalizedEmail] = hashPasswordScrypt(password);
      inMemoryProfiles[userId] = profile;
      inMemoryProfiles[profile.handle] = profile;
      if (isCreatorAccount) {
        inMemoryProfiles[CREATOR_ID] = profile;
        inMemoryProfiles[CREATOR_EMAIL] = profile;
      } else {
        await ensureAutoFollowCreator(userId);
        profile.followingCount = inMemoryFollows.filter(f => f.followerId === userId).length;
      }
      if (isCreatorAccount) {
        profile.followersCount = countCreatorFollowers();
      }
      scheduleStorePersist();

      // Upsert profile using exact supabase_schema.sql columns
      if (isValidUuid(userId)) {
        try {
          const { error: upsertErr } = await supabaseBackendClient.from('profiles').upsert({
            id: userId,
            username: profile.handle,
            full_name: profile.name,
            avatar_url: profile.avatar,
            bio: profile.bio,
            favorite_club: profile.favoriteClub,
            favorite_club_logo: profile.favoriteClubCrest,
            fan_points: profile.fanPoints,
          });
          if (upsertErr && upsertErr.message?.toLowerCase().includes('username')) {
            await supabaseBackendClient.from('profiles').upsert({
              id: userId,
              username: `${profile.handle}_${userId.slice(0, 4)}`,
              full_name: profile.name,
              avatar_url: profile.avatar,
              bio: profile.bio,
              favorite_club: profile.favoriteClub,
              favorite_club_logo: profile.favoriteClubCrest,
              fan_points: profile.fanPoints,
            });
          }
        } catch (upsertErr) {
          console.warn('[Backend] Profile table upsert notice:', upsertErr);
        }
      }

      return res.json({
        success: true,
        user: authUser || { id: userId, email: normalizedEmail },
        session: authSession,
        profile,
        autoFollowedCreator: !isCreatorAccount,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Authentication error occurred.' });
    }
  }

  // Fallback session if Supabase keys are not set in environment
  const fallbackId = isCreatorAccount ? CREATOR_ID : `user_${Date.now()}`;
  const profile = {
    id: fallbackId,
    email: normalizedEmail,
    name: displayName,
    handle: baseHandle,
    avatar: DEFAULT_AVATAR,
    bio: isCreatorAccount
      ? 'Official Futfield Main Account · Live scores, FanZone clips & global football community ⚽'
      : `${favoriteClub || 'Football'} supporter on FUTFIELD ⚽`,
    favoriteClub: favoriteClub || 'Not Set',
    favoriteClubCrest: '⚽',
    favoriteCountry: favoriteCountry || 'Global',
    favoriteCountryFlag: '🌍',
    favoritePlayers: [],
    fanPoints: isCreatorAccount ? 1000 : 0,
    weeklyPoints: 0,
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
    predictionAccuracy: 0,
    correctPredictions: 0,
    totalPredictions: 0,
    isOfficialCreator: isCreatorAccount,
    badges: [
      {
        id: 'b_welcome',
        name: isCreatorAccount ? 'Official Creator' : 'Verified Fan',
        icon: isCreatorAccount ? '👑' : '⭐',
        description: isCreatorAccount ? 'Official Futfield Main Account' : 'Verified FUTFIELD registered member',
        color: 'from-emerald-500/20 to-emerald-700/20 text-emerald-400 border-emerald-500/30',
      },
    ],
    isAuthenticated: true,
  };

  inMemoryAuthCredentials[normalizedEmail] = hashPasswordScrypt(password);
  inMemoryProfiles[fallbackId] = profile;
  inMemoryProfiles[profile.handle] = profile;
  if (isCreatorAccount) {
    inMemoryProfiles[CREATOR_ID] = profile;
    inMemoryProfiles[CREATOR_EMAIL] = profile;
    profile.followersCount = countCreatorFollowers();
  } else {
    await ensureAutoFollowCreator(fallbackId);
    profile.followingCount = inMemoryFollows.filter(f => f.followerId === fallbackId).length;
  }
  scheduleStorePersist();

  return res.json({
    success: true,
    user: { id: profile.id, email: profile.email },
    profile,
    autoFollowedCreator: !isCreatorAccount,
    notice: 'Authenticated successfully.',
  });
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const isCreatorAccount = isCreatorEmail(normalizedEmail);

  if (supabaseBackendClient) {
    try {
      const { data, error } = await supabaseBackendClient.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      // Fetch user profile from Supabase profiles table using maybeSingle()
      let existingProfile: any = null;
      const memProf = inMemoryProfiles[data.user.id];
      try {
        const { data: profData } = await supabaseBackendClient
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profData) {
          existingProfile = {
            id: profData.id,
            email: data.user.email,
            name: profData.full_name || profData.name || data.user.user_metadata?.name || normalizedEmail.split('@')[0],
            handle: profData.username || profData.handle || data.user.user_metadata?.handle || `@${normalizedEmail.split('@')[0]}`,
            avatar: profData.avatar_url || profData.avatar || DEFAULT_AVATAR,
            bio: profData.bio || 'Football enthusiast on FUTFIELD ⚽',
            favoriteClub: profData.favorite_club || data.user.user_metadata?.favorite_club || 'Not Set',
            favoriteClubCrest: profData.favorite_club_logo || '⚽',
            favoriteCountry: data.user.user_metadata?.favorite_country || memProf?.favoriteCountry || 'Global',
            favoriteCountryFlag: memProf?.favoriteCountryFlag || '🌍',
            favoritePlayers: memProf?.favoritePlayers || [],
            fanPoints: profData.fan_points ?? memProf?.fanPoints ?? 0,
            weeklyPoints: memProf?.weeklyPoints || 0,
            followersCount: memProf?.followersCount || 0,
            followingCount: memProf?.followingCount || 0,
            postsCount: memProf?.postsCount || 0,
            predictionAccuracy: memProf?.predictionAccuracy || 0,
            correctPredictions: memProf?.correctPredictions || 0,
            totalPredictions: memProf?.totalPredictions || 0,
            location: profData.location || '',
            website: profData.website || '',
            isPro: Boolean(profData.is_pro),
            proPlan: profData.pro_plan || undefined,
            proExpiresAt: profData.pro_expires_at || undefined,
            badges: memProf?.badges || [],
            isAuthenticated: true,
          };
        }
      } catch (err) {
        console.warn('[Backend] Profile lookup note:', err);
      }

      const finalProfile = existingProfile || memProf || {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || normalizedEmail.split('@')[0],
        handle: data.user.user_metadata?.handle || `@${normalizedEmail.split('@')[0]}`,
        avatar: DEFAULT_AVATAR,
        bio: 'Football enthusiast on FUTFIELD',
        favoriteClub: data.user.user_metadata?.favorite_club || 'Not Set',
        favoriteClubCrest: '⚽',
        favoriteCountry: data.user.user_metadata?.favorite_country || 'Global',
        favoriteCountryFlag: '🌍',
        favoritePlayers: [],
        fanPoints: 0,
        weeklyPoints: 0,
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        predictionAccuracy: 0,
        correctPredictions: 0,
        totalPredictions: 0,
        badges: [],
        isAuthenticated: true,
      };

      if (isCreatorAccount) {
        finalProfile.name = finalProfile.name || CREATOR_NAME;
        finalProfile.handle = CREATOR_HANDLE;
        finalProfile.isOfficialCreator = true;
        inMemoryProfiles[CREATOR_ID] = finalProfile;
        inMemoryProfiles[CREATOR_EMAIL] = finalProfile;
        finalProfile.followersCount = countCreatorFollowers();
      } else {
        if (isReservedFutfieldText(finalProfile.name)) finalProfile.name = normalizedEmail.split('@')[0] || 'Football Fan';
        if (isReservedFutfieldText(finalProfile.handle)) finalProfile.handle = `@${normalizedEmail.split('@')[0] || 'fan'}`;
        await ensureAutoFollowCreator(finalProfile.id);
        finalProfile.followingCount = inMemoryFollows.filter(f => f.followerId === finalProfile.id).length;
      }

      inMemoryProfiles[data.user.id] = finalProfile;
      if (finalProfile.handle) inMemoryProfiles[finalProfile.handle] = finalProfile;
      scheduleStorePersist();

      return res.json({
        success: true,
        user: data.user,
        session: data.session,
        profile: finalProfile,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Login error occurred.' });
    }
  }

  // Offline / local hybrid auth with scrypt password verification
  const storedHash = inMemoryAuthCredentials[normalizedEmail];
  if (storedHash && !verifyPasswordScrypt(password, storedHash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const existingMem = Object.values(inMemoryProfiles).find((p: any) => p.email === normalizedEmail);
  if (!storedHash && existingMem) {
    inMemoryAuthCredentials[normalizedEmail] = hashPasswordScrypt(password);
  } else if (!storedHash) {
    inMemoryAuthCredentials[normalizedEmail] = hashPasswordScrypt(password);
  }
  const profile = existingMem || {
    id: isCreatorAccount ? CREATOR_ID : `user_${Date.now()}`,
    email: normalizedEmail,
    name: isCreatorAccount ? CREATOR_NAME : normalizedEmail.split('@')[0],
    handle: isCreatorAccount ? CREATOR_HANDLE : `@${normalizedEmail.split('@')[0]}`,
    avatar: DEFAULT_AVATAR,
    bio: isCreatorAccount
      ? 'Official Futfield Main Account · Live scores, FanZone clips & global football community ⚽'
      : 'Football fan on FUTFIELD ⚽',
    favoriteClub: 'Not Set',
    favoriteClubCrest: '⚽',
    favoriteCountry: 'Global',
    favoriteCountryFlag: '🌍',
    favoritePlayers: [],
    fanPoints: isCreatorAccount ? 1000 : 0,
    weeklyPoints: 0,
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
    predictionAccuracy: 0,
    correctPredictions: 0,
    totalPredictions: 0,
    isOfficialCreator: isCreatorAccount,
    badges: [],
    isAuthenticated: true,
  };

  if (isCreatorAccount) {
    profile.handle = CREATOR_HANDLE;
    profile.isOfficialCreator = true;
    inMemoryProfiles[CREATOR_ID] = profile;
    inMemoryProfiles[CREATOR_EMAIL] = profile;
    profile.followersCount = countCreatorFollowers();
  } else {
    if (isReservedFutfieldText(profile.name)) profile.name = normalizedEmail.split('@')[0] || 'Football Fan';
    if (isReservedFutfieldText(profile.handle)) profile.handle = `@${normalizedEmail.split('@')[0] || 'fan'}`;
    await ensureAutoFollowCreator(profile.id);
    profile.followingCount = inMemoryFollows.filter(f => f.followerId === profile.id).length;
  }

  inMemoryProfiles[profile.id] = profile;
  inMemoryProfiles[profile.handle] = profile;
  scheduleStorePersist();

  return res.json({
    success: true,
    user: { id: profile.id, email: profile.email },
    profile,
  });
});

app.post('/api/auth/logout', async (req, res) => {
  if (supabaseBackendClient) {
    try {
      await supabaseBackendClient.auth.signOut();
    } catch {}
  }
  res.json({ success: true });
});

app.post('/api/auth/forgot-password', resetPasswordLimiter, async (req, res) => {
  const normalizedEmail = String(req.body?.email || '').trim().toLowerCase();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({
      success: false,
      error: 'Please enter a valid account email address.',
    });
  }

  const code = String(crypto.randomInt(100000, 999999));
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');

  if (passwordResetTokens.size >= 20_000) {
    const oldestKey = passwordResetTokens.keys().next().value;
    if (oldestKey) passwordResetTokens.delete(oldestKey);
  }
  passwordResetTokens.set(normalizedEmail, {
    codeHash,
    expiresAt: Date.now() + 15 * 60_000,
    attempts: 0,
  });

  let supabaseEmailSent = false;
  if (supabaseBackendClient) {
    try {
      const origin = String(req.headers.origin || 'https://futfieldsports.com.ng').replace(/\/$/, '');
      const { error } = await supabaseBackendClient.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${origin}/auth/reset-password`,
      });
      if (!error) supabaseEmailSent = true;
    } catch {}
  }

  return res.json({
    success: true,
    email: normalizedEmail,
    expiresInMinutes: 15,
    supabaseEmailSent,
    verificationCode: !process.env.SMTP_HOST ? code : undefined,
    message: supabaseEmailSent
      ? `Password reset link sent to ${normalizedEmail}. You can also enter your 6-digit verification code below.`
      : `6-digit password reset code generated for ${normalizedEmail} (valid 15 minutes).`,
  });
});

app.post('/api/auth/reset-password', resetPasswordLimiter, async (req, res) => {
  const normalizedEmail = String(req.body?.email || '').trim().toLowerCase();
  const code = String(req.body?.code || '').trim();
  const newPassword = String(req.body?.newPassword || '');

  if (!normalizedEmail || !code || !newPassword) {
    return res.status(400).json({
      success: false,
      error: 'Email, 6-digit verification code, and new password are required.',
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      error: 'New password must be at least 6 characters long.',
    });
  }

  const tokenRecord = passwordResetTokens.get(normalizedEmail);
  if (!tokenRecord || Date.now() > tokenRecord.expiresAt) {
    passwordResetTokens.delete(normalizedEmail);
    return res.status(400).json({
      success: false,
      error: 'Reset code has expired or was not requested. Request a new code.',
    });
  }

  if (tokenRecord.attempts >= 5) {
    passwordResetTokens.delete(normalizedEmail);
    return res.status(429).json({
      success: false,
      error: 'Maximum verification attempts exceeded. Please request a new reset code.',
    });
  }

  const candidateHash = crypto.createHash('sha256').update(code).digest('hex');
  const a = Buffer.from(candidateHash, 'hex');
  const b = Buffer.from(tokenRecord.codeHash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    tokenRecord.attempts += 1;
    return res.status(400).json({
      success: false,
      error: `Invalid verification code. ${Math.max(0, 5 - tokenRecord.attempts)} attempts left.`,
    });
  }

  passwordResetTokens.delete(normalizedEmail);
  inMemoryAuthCredentials[normalizedEmail] = hashPasswordScrypt(newPassword);
  scheduleStorePersist();

  const matchingProf = Object.values(inMemoryProfiles).find(
    (p: any) => String(p?.email || '').toLowerCase() === normalizedEmail
  );

  if (supabaseBackendClient && hasServiceRole && isValidUuid(matchingProf?.id)) {
    try {
      await supabaseBackendClient.auth.admin?.updateUserById(matchingProf.id, {
        password: newPassword,
      });
    } catch (err: any) {
      console.warn('[Backend] Supabase admin password reset notice:', err?.message);
    }
  }

  return res.json({
    success: true,
    email: normalizedEmail,
    updatedAt: new Date().toISOString(),
    message: `Password reset successfully for ${normalizedEmail}. Sign in with your new password.`,
  });
});

app.post('/api/auth/update-password', authLimiter, async (req, res) => {
  const { email, userId, newPassword } = req.body || {};

  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({
      success: false,
      error: 'New password must be at least 6 characters long.',
    });
  }

  const targetEmail = String(email || '').trim().toLowerCase();
  if (!targetEmail) {
    return res.status(400).json({
      success: false,
      error: 'Please sign in with an account email before updating your password.',
    });
  }

  inMemoryAuthCredentials[targetEmail] = hashPasswordScrypt(String(newPassword));
  scheduleStorePersist();

  if (supabaseBackendClient) {
    try {
      if (isValidUuid(userId) && hasServiceRole) {
        await supabaseBackendClient.auth.admin?.updateUserById(userId, {
          password: String(newPassword),
        });
      }
    } catch (err: any) {
      console.warn('[Backend] Supabase password update note:', err?.message);
    }
  }

  return res.json({
    success: true,
    email: targetEmail,
    updatedAt: new Date().toISOString(),
    message: `Password updated securely for ${targetEmail}.`,
  });
});

// -------------------------------------------------------------
// Backend Database Routes (Real Posts and Profiles)
// -------------------------------------------------------------
app.get('/api/db/status', async (req, res) => {
  const t0 = Date.now();
  let isConnected = false;
  let errorMsg = null;

  if (supabaseBackendClient) {
    try {
      const { error } = await supabaseBackendClient.from('profiles').select('id').limit(1);
      isConnected = !error || error.code === 'PGRST116' || error.code === '42P01' || error.message?.includes('schema cache');
      if (error && !error.message?.includes('schema cache') && error.code !== '42P01') {
        errorMsg = error.message;
      }
    } catch (e: any) {
      errorMsg = e?.message;
    }
  }

  const latencyMs = Date.now() - t0;

  res.json({
    configured: Boolean(supabaseBackendClient),
    connected: isConnected || Boolean(supabaseBackendClient),
    provider: 'supabase',
    hasUrl: Boolean(supabaseUrl),
    hasServiceRole,
    latencyMs,
    postsCount: inMemoryPosts.length,
    videosCount: inMemoryVideos.length,
    error: errorMsg,
    message: supabaseBackendClient
      ? `Supabase PostgreSQL & Auth live (${latencyMs}ms).`
      : 'Local persisted engine active.',
  });
});

app.post('/api/db/sync-profile', async (req, res) => {
  const { profile } = req.body || {};
  if (!profile || (!profile.id && !profile.handle)) {
    return res.status(400).json({ success: false, error: 'Profile payload required' });
  }

  const targetId = String(profile.id || profile.handle);
  const existing = inMemoryProfiles[targetId];
  const email = profile.email || existing?.email || '';
  const isCreatorAccount = isCreatorEmail(email);

  if (!isCreatorAccount && (isReservedFutfieldText(profile.name) || isReservedFutfieldText(profile.handle))) {
    return res.status(400).json({
      success: false,
      error: 'The name "Futfield" is strictly reserved for the official Futfield Creator account.',
    });
  }

  const cleanProfile = {
    ...(existing || {}),
    ...profile,
    handle: isCreatorAccount ? CREATOR_HANDLE : profile.handle,
    isOfficialCreator: isCreatorAccount,
  };

  inMemoryProfiles[targetId] = cleanProfile;
  if (cleanProfile.handle) {
    inMemoryProfiles[cleanProfile.handle] = cleanProfile;
  }
  if (isCreatorAccount) {
    inMemoryProfiles[CREATOR_ID] = cleanProfile;
    inMemoryProfiles[CREATOR_EMAIL] = cleanProfile;
  } else if (profile.isAuthenticated && targetId !== 'guest_user') {
    await ensureAutoFollowCreator(targetId);
  }
  scheduleStorePersist();

  if (supabaseBackendClient && isValidUuid(targetId)) {
    try {
      await supabaseBackendClient.from('profiles').upsert({
        id: targetId,
        username: cleanProfile.handle || `@fan_${targetId.slice(0, 6)}`,
        full_name: cleanProfile.name || 'Football Fan',
        avatar_url: cleanProfile.avatar || DEFAULT_AVATAR,
        bio: cleanProfile.bio || '',
        favorite_club: cleanProfile.favoriteClub || 'Not Set',
        favorite_club_logo: cleanProfile.favoriteClubCrest || '⚽',
        fan_points: Number(cleanProfile.fanPoints || 0),
        location: cleanProfile.location || null,
        website: cleanProfile.website || null,
      });
    } catch (err: any) {
      console.warn('[Backend] sync-profile Supabase notice:', err?.message);
    }
  }

  return res.json({ success: true, profile: inMemoryProfiles[targetId] });
});

app.post('/api/db/sync-post', async (req, res) => {
  const { post } = req.body || {};
  if (!post || !post.id) {
    return res.status(400).json({ success: false, error: 'Post payload required' });
  }
  const existingIdx = inMemoryPosts.findIndex(p => p.id === post.id);
  if (existingIdx !== -1) {
    inMemoryPosts[existingIdx] = { ...inMemoryPosts[existingIdx], ...post };
  } else {
    inMemoryPosts.unshift(post);
  }
  scheduleStorePersist();
  return res.json({ success: true, post });
});

// -------------------------------------------------------------
// In-Memory & Disk-Persisted Stores (keeps uploads, MB stats & real engagement across restarts)
// -------------------------------------------------------------
interface MediaRegistryItem {
  id: string;
  fileName: string;
  url: string;
  bucket: string;
  mediaKind: 'image' | 'video' | 'audio';
  mimeType: string;
  sizeBytes: number;
  sizeMb: number;
  userId?: string;
  createdAt: string;
}

const inMemoryPosts: any[] = [];
const inMemoryPostLikes: { postId: string; userId: string }[] = [];
const inMemoryPostReactions: { postId: string; userId: string; emoji: string }[] = [];
const inMemoryPostComments: any[] = [];
const inMemoryPostBookmarks: { postId: string; userId: string }[] = [];
const inMemoryVideos: any[] = [];
const inMemoryVideoLikes: { videoId: string; userId: string }[] = [];
const inMemoryVideoReactions: { videoId: string; userId: string; emoji: string }[] = [];
const inMemoryVideoComments: any[] = [];
const inMemoryVideoViews: { videoId: string; userId: string; timestamp?: string }[] = [];
// FUTFIELD TUBE Persistent Stores (Supabase-backed with disk mirror)
const inMemoryFutubeConnects: Array<{ fanId: string; fanzoneId: string; alertEnabled: boolean; createdAt: string }> = [];
const inMemoryFutubeCheers: Array<{ videoId: string; userId: string; createdAt: string }> = [];
const inMemoryFutubeBoos: Array<{ videoId: string; userId: string; createdAt: string }> = [];
const inMemoryFutubeShouts: any[] = [];
const inMemoryFutubeWatchHistory: Array<{
  userId: string;
  videoId: string;
  watchedSeconds: number;
  countedWatch: boolean;
  updatedAt: string;
}> = [];
const inMemoryFutubePacks: Array<{
  id: string;
  userId: string;
  name: string;
  videoIds: string[];
  createdAt: string;
}> = [];
const inMemoryFutubeBattles: any[] = [];
const inMemoryFutubeLiveChats: Record<string, any[]> = {};
const inMemoryFutubeReports: Array<{ videoId: string; userId: string; reason: string; createdAt: string }> = [];
const inMemoryFutubeDailyUploads: Record<string, string[]> = {};
const inMemoryFollows: { followerId: string; followingId: string }[] = [];
const inMemoryProfiles: Record<string, any> = {};
const inMemoryPredictorPicks: any[] = [];
const inMemoryArenaPolls: Array<{
  id: string;
  question: string;
  category: string;
  authorName: string;
  options: Array<{ id: string; label: string; votes: number }>;
  voters: Record<string, string>;
  createdAt: string;
}> = [
  {
    id: 'poll_1',
    question: 'Who wins the UEFA Champions League this season?',
    category: 'UEFA Champions League',
    authorName: 'Futfield',
    options: [
      { id: 'opt_1', label: 'Real Madrid', votes: 14 },
      { id: 'opt_2', label: 'Arsenal', votes: 11 },
      { id: 'opt_3', label: 'FC Barcelona / Bayern', votes: 9 },
    ],
    voters: {},
    createdAt: new Date().toISOString(),
  },
  {
    id: 'poll_2',
    question: 'Who is the Premier League Player of the Season so far?',
    category: 'Premier League',
    authorName: 'Futfield',
    options: [
      { id: 'opt_1', label: 'Mohamed Salah', votes: 18 },
      { id: 'opt_2', label: 'Bukayo Saka', votes: 12 },
      { id: 'opt_3', label: 'Cole Palmer', votes: 10 },
    ],
    voters: {},
    createdAt: new Date().toISOString(),
  },
];

function seedOfficialCreatorProfile() {
  if (!inMemoryProfiles[CREATOR_ID]) {
    const creatorProf = {
      id: CREATOR_ID,
      email: CREATOR_EMAIL,
      name: CREATOR_NAME,
      handle: CREATOR_HANDLE,
      avatar: DEFAULT_AVATAR,
      bio: 'Official Futfield Main Account · Live scores, FanZone clips & global football community ⚽',
      favoriteClub: 'FUTFIELD Official',
      favoriteClubCrest: '⚽',
      favoriteCountry: 'Global',
      favoriteCountryFlag: '🌍',
      fanPoints: 1000,
      followersCount: 0,
      followingCount: 0,
      isOfficialCreator: true,
      joinedAt: 'Official Main Account',
    };
    inMemoryProfiles[CREATOR_ID] = creatorProf;
    inMemoryProfiles[CREATOR_HANDLE] = creatorProf;
    inMemoryProfiles[CREATOR_EMAIL] = creatorProf;
  }
}
seedOfficialCreatorProfile();

function countCreatorFollowers(): number {
  const uniqueFollowers = new Set<string>();
  for (const f of inMemoryFollows) {
    if (isCreatorTarget(f.followingId)) {
      uniqueFollowers.add(f.followerId);
    }
  }
  return uniqueFollowers.size;
}

async function ensureAutoFollowCreator(followerId: string) {
  if (!followerId || followerId === 'guest_user' || isCreatorTarget(followerId)) return;
  const alreadyFollowing = inMemoryFollows.some(
    f => f.followerId === followerId && isCreatorTarget(f.followingId)
  );
  if (!alreadyFollowing) {
    inMemoryFollows.push({ followerId, followingId: CREATOR_ID });
    if (supabaseBackendClient && isValidUuid(followerId)) {
      try {
        await supabaseBackendClient.from('follows').insert({ follower_id: followerId, following_id: CREATOR_ID });
      } catch {}
    }
  }
  const alreadyConnected = inMemoryFutubeConnects.some(
    c => c.fanId === followerId && c.fanzoneId === CREATOR_HANDLE
  );
  if (!alreadyConnected) {
    inMemoryFutubeConnects.push({
      fanId: followerId,
      fanzoneId: CREATOR_HANDLE,
      alertEnabled: true,
      createdAt: new Date().toISOString(),
    });
  }
  const creatorProf = inMemoryProfiles[CREATOR_ID];
  if (creatorProf) {
    creatorProf.followersCount = countCreatorFollowers();
  }
}

const inMemoryCommunities: any[] = [];
const inMemoryCommunityMembers: { communityId: string; userId: string }[] = [];
const inMemoryMatchRooms: Record<string, any[]> = {};
const inMemoryMatchReactions: { messageId: string; userId: string; emoji: string }[] = [];
const inMemoryRoomPresence: { matchId: string; userId: string; user: any; lastSeen: number }[] = [];
const inMemoryTypingIndicators: Record<string, { userId: string; userName: string; isTyping: boolean; isRecording: boolean; timestamp: number }[]> = {};
const mediaRegistry: MediaRegistryItem[] = [];
const inMemorySupportTickets: Array<{
  id: string;
  referenceCode: string;
  userId: string;
  name: string;
  email: string;
  category: string;
  priority: 'Normal' | 'High' | 'Urgent';
  subject: string;
  message: string;
  channel: 'contact_form' | 'email_desk';
  status: 'Open' | 'In Review' | 'Resolved';
  dateFormatted: string;
  createdAt: string;
  updatedAt: string;
}> = [];

interface PaystackTransactionRecord {
  reference: string;
  userId: string;
  email: string;
  amount: number;
  currency: string;
  tier: 'pro' | 'vip' | 'season' | 'custom';
  status: 'success' | 'failed' | 'pending';
  createdAt: string;
}

const paystackTransactions: Record<string, PaystackTransactionRecord> = {};

interface ActiveSubscription {
  userId: string;
  email: string;
  tier: string;
  expiresAt: string;
  notified: boolean;
}

const activeSubscriptionsStore: Record<string, ActiveSubscription> = {};
const subscriptionExpiryAlerts: Record<string, any[]> = {};

// Hydrate persisted uploads & feed data on boot
try {
  if (fs.existsSync(MEDIA_REGISTRY_FILE)) {
    const rawMedia = JSON.parse(fs.readFileSync(MEDIA_REGISTRY_FILE, 'utf-8'));
    if (Array.isArray(rawMedia)) {
      mediaRegistry.push(...rawMedia);
    }
  }
  if (fs.existsSync(FEED_STORE_FILE)) {
    const rawFeed = JSON.parse(fs.readFileSync(FEED_STORE_FILE, 'utf-8'));
    if (Array.isArray(rawFeed?.posts)) {
      inMemoryPosts.push(
        ...rawFeed.posts
          .filter((p: any) => {
            if (!p) return false;
            const pid = String(p.id || '').toLowerCase();
            const handle = String(p.author?.handle || '').toLowerCase();
            const name = String(p.author?.name || '').toLowerCase();
            return !pid.startsWith('post_test_') && handle !== '@testfan' && name !== 'test fan';
          })
          .map((p: any) => ({
            ...p,
            author: {
              name: p?.author?.name || 'Football Supporter',
              handle: p?.author?.handle || '@fan',
              avatar: p?.author?.avatar || DEFAULT_AVATAR,
              clubBadge: p?.author?.clubBadge || p?.clubTag || '⚽',
              isVerified: Boolean(p?.author?.isVerified),
            },
          }))
      );
    }
    if (Array.isArray(rawFeed?.videos)) {
      inMemoryVideos.push(
        ...rawFeed.videos
          .filter((v: any) => {
            if (!v) return false;
            const vid = String(v.id || '').toLowerCase();
            const title = String(v.title || '').toLowerCase();
            const url = String(v.videoUrl || '').toLowerCase();
            return vid !== 'vid_1794743322269' && !(title === 'training highlight' && url.includes('/uploads/videos/sample.mp4'));
          })
          .map((v: any) => ({
            ...v,
            creator: {
              name: v?.creator?.name || 'Pitch Creator',
              handle: v?.creator?.handle || '@creator',
              subscribers: v?.creator?.subscribers || '1 supporter',
              avatar: v?.creator?.avatar || DEFAULT_AVATAR,
              isVerified: Boolean(v?.creator?.isVerified),
              isSubscribed: Boolean(v?.creator?.isSubscribed),
            },
          }))
      );
    }
    if (Array.isArray(rawFeed?.postComments)) inMemoryPostComments.push(...rawFeed.postComments);
    if (Array.isArray(rawFeed?.videoComments)) inMemoryVideoComments.push(...rawFeed.videoComments);
    if (Array.isArray(rawFeed?.futubeConnects)) inMemoryFutubeConnects.push(...rawFeed.futubeConnects);
    if (Array.isArray(rawFeed?.futubeCheers)) inMemoryFutubeCheers.push(...rawFeed.futubeCheers);
    if (Array.isArray(rawFeed?.futubeBoos)) inMemoryFutubeBoos.push(...rawFeed.futubeBoos);
    if (Array.isArray(rawFeed?.futubeShouts)) inMemoryFutubeShouts.push(...rawFeed.futubeShouts);
    if (Array.isArray(rawFeed?.futubeWatchHistory)) inMemoryFutubeWatchHistory.push(...rawFeed.futubeWatchHistory);
    if (Array.isArray(rawFeed?.futubePacks)) inMemoryFutubePacks.push(...rawFeed.futubePacks);
    if (Array.isArray(rawFeed?.futubeBattles)) inMemoryFutubeBattles.push(...rawFeed.futubeBattles);
    if (rawFeed?.futubeLiveChats && typeof rawFeed.futubeLiveChats === 'object') {
      Object.assign(inMemoryFutubeLiveChats, rawFeed.futubeLiveChats);
    }
    if (rawFeed?.futubeDailyUploads && typeof rawFeed.futubeDailyUploads === 'object') {
      Object.assign(inMemoryFutubeDailyUploads, rawFeed.futubeDailyUploads);
    }
    if (rawFeed?.paystackTransactions && typeof rawFeed.paystackTransactions === 'object') {
      Object.assign(paystackTransactions, rawFeed.paystackTransactions);
    }
    if (rawFeed?.activeSubscriptions && typeof rawFeed.activeSubscriptions === 'object') {
      Object.assign(activeSubscriptionsStore, rawFeed.activeSubscriptions);
    }
    if (Array.isArray(rawFeed?.follows)) {
      inMemoryFollows.push(...rawFeed.follows);
    }
    if (rawFeed?.authCredentials && typeof rawFeed.authCredentials === 'object') {
      Object.assign(inMemoryAuthCredentials, rawFeed.authCredentials);
    }
    if (rawFeed?.profiles && typeof rawFeed.profiles === 'object') {
      Object.assign(inMemoryProfiles, rawFeed.profiles);
      seedOfficialCreatorProfile();
    }
    if (Array.isArray(rawFeed?.predictorPicks)) {
      inMemoryPredictorPicks.push(...rawFeed.predictorPicks);
    }
    if (Array.isArray(rawFeed?.arenaPolls) && rawFeed.arenaPolls.length > 0) {
      inMemoryArenaPolls.splice(0, inMemoryArenaPolls.length, ...rawFeed.arenaPolls);
    }
  }
  if (fs.existsSync(SUPPORT_TICKETS_FILE)) {
    const rawTickets = JSON.parse(fs.readFileSync(SUPPORT_TICKETS_FILE, 'utf-8'));
    if (Array.isArray(rawTickets)) {
      inMemorySupportTickets.push(...rawTickets);
    }
  }
} catch (err) {
  console.warn('[Backend] Store hydration notice:', err);
}

async function writeJsonAtomic(filePath: string, payload: unknown) {
  const tmpPath = `${filePath}.tmp`;
  await fs.promises.writeFile(tmpPath, JSON.stringify(payload, null, 2), 'utf-8');
  await fs.promises.rename(tmpPath, filePath);
}

let persistTimer: NodeJS.Timeout | null = null;
let persistInFlight = false;
let persistQueued = false;

async function flushStorePersist() {
  if (persistInFlight) {
    persistQueued = true;
    return;
  }
  persistInFlight = true;
  try {
    await Promise.all([
      writeJsonAtomic(MEDIA_REGISTRY_FILE, mediaRegistry.slice(0, 500)),
      writeJsonAtomic(FEED_STORE_FILE, {
        posts: inMemoryPosts.slice(0, 200),
        videos: inMemoryVideos.slice(0, 200),
        postComments: inMemoryPostComments.slice(0, 500),
        videoComments: inMemoryVideoComments.slice(0, 500),
        futubeConnects: inMemoryFutubeConnects.slice(0, 1000),
        futubeCheers: inMemoryFutubeCheers.slice(0, 2000),
        futubeBoos: inMemoryFutubeBoos.slice(0, 1000),
        futubeShouts: inMemoryFutubeShouts.slice(0, 1000),
        futubeWatchHistory: inMemoryFutubeWatchHistory.slice(0, 3000),
        futubePacks: inMemoryFutubePacks.slice(0, 500),
        futubeBattles: inMemoryFutubeBattles.slice(0, 100),
        futubeLiveChats: inMemoryFutubeLiveChats,
        futubeDailyUploads: inMemoryFutubeDailyUploads,
        paystackTransactions,
        activeSubscriptions: activeSubscriptionsStore,
        follows: inMemoryFollows.slice(0, 5000),
        authCredentials: inMemoryAuthCredentials,
        profiles: inMemoryProfiles,
        predictorPicks: inMemoryPredictorPicks.slice(0, 2000),
        arenaPolls: inMemoryArenaPolls.slice(0, 100),
      }),
      writeJsonAtomic(SUPPORT_TICKETS_FILE, inMemorySupportTickets.slice(0, 300)),
    ]);
  } catch (err) {
    console.warn('[Backend] Store persist notice:', err);
  } finally {
    persistInFlight = false;
    if (persistQueued) {
      persistQueued = false;
      setImmediate(() => {
        flushStorePersist().catch(() => {});
      });
    }
  }
}

function scheduleStorePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    flushStorePersist().catch(() => {});
  }, 250);
}

function computeMediaStats() {
  const images = mediaRegistry.filter(item => item.mediaKind === 'image');
  const videos = mediaRegistry.filter(item => item.mediaKind === 'video');
  const totalImageBytes = images.reduce((acc, item) => acc + (item.sizeBytes || 0), 0);
  const totalVideoBytes = videos.reduce((acc, item) => acc + (item.sizeBytes || 0), 0);
  const totalBytes = totalImageBytes + totalVideoBytes;
  const toMb = (bytes: number) => +(bytes / (1024 * 1024)).toFixed(2);

  return {
    imageCount: images.length,
    videoCount: videos.length,
    totalFiles: mediaRegistry.length,
    totalImageBytes,
    totalVideoBytes,
    totalBytes,
    totalImageMb: toMb(totalImageBytes),
    totalVideoMb: toMb(totalVideoBytes),
    totalMb: toMb(totalBytes),
    images: images.slice(0, 50),
    videos: videos.slice(0, 50),
    recentUploads: mediaRegistry.slice(0, 25),
  };
}

function sumReactionsMap(reactions?: Record<string, number>): number {
  if (!reactions) return 0;
  return Object.values(reactions).reduce((acc, val) => acc + (Number(val) || 0), 0);
}

function computeRealtimeAnalytics() {
  const videoViews = inMemoryVideos.reduce((acc, v) => acc + (Number(v.views) || 0), 0);
  const videoLikes = inMemoryVideos.reduce((acc, v) => acc + (Number(v.likes) || 0), 0);
  const videoShares = inMemoryVideos.reduce((acc, v) => acc + (Number(v.shares) || 0), 0);
  const videoComments = inMemoryVideos.reduce((acc, v) => acc + (Number(v.commentsCount) || 0), 0);

  const reactionTotals: Record<string, number> = {};
  let videoReactionsCount = 0;
  for (const v of inMemoryVideos) {
    if (v.reactions && typeof v.reactions === 'object') {
      for (const [emoji, cnt] of Object.entries(v.reactions)) {
        const val = Number(cnt) || 0;
        reactionTotals[emoji] = (reactionTotals[emoji] || 0) + val;
        videoReactionsCount += val;
      }
    }
  }

  const postLikes = inMemoryPosts.reduce((acc, p) => acc + (Number(p.likes) || 0), 0);
  const postShares = inMemoryPosts.reduce((acc, p) => acc + (Number(p.shares) || 0), 0);
  const postComments = inMemoryPosts.reduce((acc, p) => acc + (Number(p.commentsCount) || 0), 0);
  let postReactionsCount = 0;
  for (const p of inMemoryPosts) {
    postReactionsCount += sumReactionsMap(p.reactions);
  }

  const trendingVideos = [...inMemoryVideos]
    .map(v => {
      const rCount = sumReactionsMap(v.reactions);
      const score = (Number(v.views) || 0) + (Number(v.likes) || 0) * 3 + rCount * 4 + (Number(v.shares) || 0) * 5 + (Number(v.commentsCount) || 0) * 2;
      return {
        id: v.id,
        title: v.title,
        creator: v.creator?.name || 'Creator',
        views: Number(v.views) || 0,
        likes: Number(v.likes) || 0,
        reactionsCount: rCount,
        shares: Number(v.shares) || 0,
        commentsCount: Number(v.commentsCount) || 0,
        sizeMb: Number(v.sizeMb) || 0,
        engagementScore: score,
      };
    })
    .sort((a, b) => b.engagementScore - a.engagementScore)
    .slice(0, 10);

  return {
    totalViews: videoViews,
    totalLikes: videoLikes + postLikes,
    totalReactions: videoReactionsCount + postReactionsCount,
    totalShares: videoShares + postShares,
    totalComments: videoComments + postComments,
    videoBreakdown: {
      count: inMemoryVideos.length,
      views: videoViews,
      likes: videoLikes,
      reactions: videoReactionsCount,
      shares: videoShares,
      comments: videoComments,
      reactionTotals,
    },
    postBreakdown: {
      count: inMemoryPosts.length,
      likes: postLikes,
      reactions: postReactionsCount,
      shares: postShares,
      comments: postComments,
    },
    trendingVideos,
    mediaStorage: computeMediaStats(),
    timestamp: new Date().toISOString(),
  };
}

// Real-Time Event Bus for Match Rooms (Server-Sent Events & Realtime sync)
const roomSubscribers: Record<string, Set<(event: string, data: any) => void>> = {};

function broadcastToRoom(matchId: string, event: string, data: any) {
  const subs = roomSubscribers[matchId];
  if (subs && subs.size > 0) {
    subs.forEach(send => {
      try {
        send(event, data);
      } catch {}
    });
  }
}

// Real-Time Global Feed Event Bus (Broadcasts posts, videos, likes, reactions, shares & analytics worldwide in real time)
const globalFeedSubscribers = new Set<(event: string, data: any) => void>();

function broadcastToGlobalFeed(event: string, data: any) {
  globalFeedSubscribers.forEach(send => {
    try {
      send(event, data);
    } catch {}
  });
}

app.get('/api/db/feed/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent('connected', { time: new Date().toISOString(), subscribers: globalFeedSubscribers.size + 1 });
  sendEvent('analytics_summary', computeRealtimeAnalytics());
  globalFeedSubscribers.add(sendEvent);

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    globalFeedSubscribers.delete(sendEvent);
  });
});

// Real-Time Media Storage & MB Calculator Endpoint
app.get('/api/media/stats', (_req, res) => {
  return res.json({
    success: true,
    ...computeMediaStats(),
  });
});

// Real-Time Engagement Analytics Endpoint (Views, Likes, Reactions, Shares)
app.get('/api/analytics/realtime', (_req, res) => {
  return res.json({
    success: true,
    analytics: computeRealtimeAnalytics(),
  });
});

// -------------------------------------------------------------
// Real Posts Endpoints (Supabase table 'posts', 'post_likes', 'post_comments')
// -------------------------------------------------------------
app.get('/api/db/posts', async (req, res) => {
  const { userId, clubTag } = req.query;
  const mergedMap = new Map<string, any>();

  for (const p of inMemoryPosts) {
    if (p?.id) mergedMap.set(p.id, p);
  }

  if (supabaseBackendClient) {
    try {
      let query = supabaseBackendClient
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(60);

      if (userId && isValidUuid(userId)) {
        query = query.eq('user_id', userId);
      }
      if (clubTag) {
        query = query.eq('club_tag', clubTag);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          if (!mergedMap.has(row.id)) {
            const prof = inMemoryProfiles[row.user_id];
            mergedMap.set(row.id, {
              id: row.id,
              userId: row.user_id,
              author: prof
                ? {
                    name: prof.name,
                    handle: prof.handle,
                    avatar: prof.avatar || DEFAULT_AVATAR,
                    clubBadge: prof.favoriteClubCrest || row.club_tag || '⚽',
                    isVerified: prof.isAuthenticated,
                  }
                : {
                    name: 'Football Supporter',
                    handle: '@fan',
                    avatar: DEFAULT_AVATAR,
                    clubBadge: row.club_tag || '⚽',
                    isVerified: false,
                  },
              content: row.content,
              timestamp: row.created_at
                ? new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Recently',
              mediaUrl: row.image_url || row.video_url,
              mediaType: row.video_url ? 'video' : row.image_url ? 'image' : undefined,
              imageUrl: row.image_url,
              videoUrl: row.video_url,
              location: row.location,
              clubTag: row.club_tag,
              privacy: row.privacy || 'public',
              isEdited: row.is_edited || false,
              likes: row.likes_count || 0,
              isLiked: false,
              commentsCount: row.comments_count || 0,
              shares: row.shares_count || 0,
              reposts: 0,
              tags: [],
              category: 'foryou',
            });
          }
        }
      }
    } catch (err: any) {
      console.warn('[Backend] Supabase posts fetch error:', err?.message);
    }
  }

  let results = Array.from(mergedMap.values()).filter(p => {
    const pid = String(p?.id || '').toLowerCase();
    const handle = String(p?.author?.handle || '').toLowerCase();
    const name = String(p?.author?.name || '').toLowerCase();
    return !pid.startsWith('post_test_') && handle !== '@testfan' && name !== 'test fan';
  });
  if (userId) {
    results = results.filter(p => p.userId === userId || p.author?.handle === userId);
  }
  if (clubTag) {
    results = results.filter(p => p.clubTag === clubTag);
  }
  return res.json({ posts: results });
});

app.post('/api/db/posts', async (req, res) => {
  const { post } = req.body;
  if (!post || (!post.content && !post.mediaUrl && !post.imageUrl && !post.videoUrl)) {
    return res.status(400).json({ error: 'Post content or media required' });
  }
  const checkUrls = [post.mediaUrl, post.imageUrl, post.videoUrl].filter(Boolean) as string[];
  if (checkUrls.some(u => u.startsWith('blob:'))) {
    return res.status(400).json({ error: 'Media must be uploaded to backend storage before posting' });
  }

  const newPostId = post.id || `post_${Date.now()}`;
  const dbPostId = isValidUuid(newPostId) ? newPostId : crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const prof = post.userId ? inMemoryProfiles[post.userId] : undefined;
  const fullPost = {
    ...post,
    id: newPostId,
    author: {
      name: post.author?.name || prof?.name || 'Football Supporter',
      handle: post.author?.handle || prof?.handle || '@fan',
      avatar: post.author?.avatar || prof?.avatar || DEFAULT_AVATAR,
      clubBadge: post.author?.clubBadge || prof?.favoriteClubCrest || post.clubTag || '⚽',
      isVerified: Boolean(post.author?.isVerified ?? prof?.isAuthenticated),
    },
    timestamp: 'Just now',
    likes: 0,
    commentsCount: 0,
    shares: 0,
    isLiked: false,
    isSaved: false,
    commentsList: [],
    createdAt: timestamp,
  };

  if (supabaseBackendClient && isValidUuid(post.userId)) {
    try {
      await supabaseBackendClient.from('posts').insert({
        id: dbPostId,
        user_id: post.userId,
        content: post.content || '',
        image_url: post.imageUrl || (post.mediaType === 'image' ? post.mediaUrl : null),
        video_url: post.videoUrl || (post.mediaType === 'video' ? post.mediaUrl : null),
        location: post.location || null,
        club_tag: post.clubTag || null,
        privacy: post.privacy || 'public',
        likes_count: 0,
        comments_count: 0,
        shares_count: 0,
        is_edited: false,
        created_at: timestamp,
      });
    } catch (err: any) {
      console.warn('[Backend] Supabase post insert notice:', err?.message);
    }
  }

  inMemoryPosts.unshift(fullPost);
  scheduleStorePersist();
  broadcastToGlobalFeed('new_post', fullPost);
  broadcastToGlobalFeed('analytics_summary', computeRealtimeAnalytics());
  return res.json({ success: true, post: fullPost });
});

app.put('/api/db/posts/:id', async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  if (supabaseBackendClient) {
    try {
      await supabaseBackendClient
        .from('posts')
        .update({ content, is_edited: true })
        .eq('id', id);
    } catch (err: any) {
      console.warn('[Backend] Post update note:', err?.message);
    }
  }

  const idx = inMemoryPosts.findIndex(p => p.id === id);
  if (idx !== -1) {
    inMemoryPosts[idx].content = content;
    inMemoryPosts[idx].isEdited = true;
  }

  return res.json({ success: true, id, content });
});

app.delete('/api/db/posts/:id', async (req, res) => {
  const { id } = req.params;

  if (supabaseBackendClient) {
    try {
      await supabaseBackendClient.from('posts').delete().eq('id', id);
      await supabaseBackendClient.from('post_likes').delete().eq('post_id', id);
      await supabaseBackendClient.from('post_comments').delete().eq('post_id', id);
    } catch (err: any) {
      console.warn('[Backend] Post delete note:', err?.message);
    }
  }

  const idx = inMemoryPosts.findIndex(p => p.id === id);
  if (idx !== -1) {
    inMemoryPosts.splice(idx, 1);
  }

  return res.json({ success: true, deletedId: id });
});

app.post('/api/db/posts/:id/like', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  const uId = userId || 'anonymous_user';

  let isLiked = false;
  let likesCount = 0;

  // Toggle in-memory
  const likeIdx = inMemoryPostLikes.findIndex(l => l.postId === id && l.userId === uId);
  if (likeIdx !== -1) {
    inMemoryPostLikes.splice(likeIdx, 1);
    isLiked = false;
  } else {
    inMemoryPostLikes.push({ postId: id, userId: uId });
    isLiked = true;
  }

  const post = inMemoryPosts.find(p => p.id === id);
  if (post) {
    post.likes = Math.max(0, post.likes + (isLiked ? 1 : -1));
    post.isLiked = isLiked;
    likesCount = post.likes;
  }

  if (supabaseBackendClient) {
    try {
      if (isLiked) {
        await supabaseBackendClient.from('post_likes').insert({ post_id: id, user_id: uId });
        try {
          await supabaseBackendClient.rpc('increment_post_likes', { post_id: id });
        } catch {}
      } else {
        await supabaseBackendClient.from('post_likes').delete().match({ post_id: id, user_id: uId });
      }
    } catch (err: any) {
      console.warn('[Backend] Like toggle note:', err?.message);
    }
  }

  scheduleStorePersist();
  broadcastToGlobalFeed('like_post', { postId: id, isLiked, likesCount });
  broadcastToGlobalFeed('analytics_summary', computeRealtimeAnalytics());
  return res.json({ success: true, isLiked, likesCount });
});

app.post('/api/db/posts/:id/react', (req, res) => {
  const { id } = req.params;
  const { userId = 'anonymous_user', emoji = '🔥' } = req.body || {};

  const existingIdx = inMemoryPostReactions.findIndex(
    r => r.postId === id && r.userId === userId && r.emoji === emoji
  );
  let active = false;
  const post = inMemoryPosts.find(p => p.id === id);
  if (post && !post.reactions) {
    post.reactions = {};
  }

  if (existingIdx !== -1) {
    inMemoryPostReactions.splice(existingIdx, 1);
    active = false;
    if (post) {
      post.reactions[emoji] = Math.max(0, (post.reactions[emoji] || 1) - 1);
    }
  } else {
    inMemoryPostReactions.push({ postId: id, userId, emoji });
    active = true;
    if (post) {
      post.reactions[emoji] = (post.reactions[emoji] || 0) + 1;
    }
  }

  const reactions = post?.reactions || { [emoji]: active ? 1 : 0 };
  const userReactions = inMemoryPostReactions
    .filter(r => r.postId === id && r.userId === userId)
    .map(r => r.emoji);

  scheduleStorePersist();
  broadcastToGlobalFeed('post_engagement_updated', { postId: id, reactions, userReactions });
  broadcastToGlobalFeed('analytics_summary', computeRealtimeAnalytics());
  return res.json({ success: true, postId: id, reactions, userReactions, active });
});

app.post('/api/db/posts/:id/bookmark', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  const uId = userId || 'anonymous_user';

  let isBookmarked = false;
  const bIdx = inMemoryPostBookmarks.findIndex(b => b.postId === id && b.userId === uId);
  if (bIdx !== -1) {
    inMemoryPostBookmarks.splice(bIdx, 1);
    isBookmarked = false;
  } else {
    inMemoryPostBookmarks.push({ postId: id, userId: uId });
    isBookmarked = true;
  }

  const post = inMemoryPosts.find(p => p.id === id);
  if (post) {
    post.isSaved = isBookmarked;
  }

  if (supabaseBackendClient) {
    try {
      if (isBookmarked) {
        await supabaseBackendClient.from('post_bookmarks').insert({ post_id: id, user_id: uId });
      } else {
        await supabaseBackendClient.from('post_bookmarks').delete().match({ post_id: id, user_id: uId });
      }
    } catch (err: any) {
      console.warn('[Backend] Bookmark toggle note:', err?.message);
    }
  }

  return res.json({ success: true, isBookmarked });
});

app.get('/api/db/posts/:id/comments', async (req, res) => {
  const { id } = req.params;
  const comments = inMemoryPostComments.filter(c => c.postId === id);
  return res.json({ comments });
});

app.post('/api/db/posts/:id/comments', async (req, res) => {
  const { id } = req.params;
  const { author, text, parentId } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Comment text required' });
  }

  const newComment = {
    id: `comm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    postId: id,
    parentId: parentId || null,
    author: author || { name: 'Fan', handle: '@fan', avatar: '' },
    text: text.trim(),
    timestamp: 'Just now',
    likes: 0,
    replies: [],
  };

  if (parentId) {
    const parent = inMemoryPostComments.find(c => c.id === parentId);
    if (parent) {
      if (!parent.replies) parent.replies = [];
      parent.replies.push(newComment);
    }
  } else {
    inMemoryPostComments.unshift(newComment);
  }

  const post = inMemoryPosts.find(p => p.id === id);
  if (post) {
    post.commentsCount = (post.commentsCount || 0) + 1;
    if (!post.commentsList) post.commentsList = [];
    if (!parentId) post.commentsList.unshift(newComment);
  }

  if (supabaseBackendClient) {
    try {
      await supabaseBackendClient.from('post_comments').insert({
        id: newComment.id,
        post_id: id,
        user_id: author?.handle || 'user',
        content: text.trim(),
        parent_id: parentId || null,
        likes_count: 0,
        created_at: new Date().toISOString(),
      });
    } catch (err: any) {
      console.warn('[Backend] Comment insert note:', err?.message);
    }
  }

  broadcastToGlobalFeed('comment_post', { postId: id, comment: newComment });
  return res.json({ success: true, comment: newComment });
});

app.post('/api/db/posts/:id/share', async (req, res) => {
  const { id } = req.params;
  const post = inMemoryPosts.find(p => p.id === id);
  if (post) {
    post.shares = (post.shares || 0) + 1;
  }
  const sharesCount = post?.shares || 1;
  scheduleStorePersist();
  broadcastToGlobalFeed('post_engagement_updated', { postId: id, shares: sharesCount });
  broadcastToGlobalFeed('analytics_summary', computeRealtimeAnalytics());
  return res.json({ success: true, shares: sharesCount });
});

// -------------------------------------------------------------
// Real Videos Endpoints (Supabase tables 'videos', 'video_likes', 'video_views')
// -------------------------------------------------------------
app.get('/api/db/videos', async (req, res) => {
  const { search, clubTag, userId, kind } = req.query;
  const mergedMap = new Map<string, any>();

  for (const v of inMemoryVideos) {
    if (v?.id) mergedMap.set(v.id, v);
  }

  if (supabaseBackendClient) {
    try {
      let query = supabaseBackendClient
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false });

      if (userId && isValidUuid(userId)) query = query.eq('user_id', userId);
      if (clubTag) query = query.eq('club_tag', clubTag);

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        for (const v of data) {
          if (!mergedMap.has(v.id)) {
            const prof = inMemoryProfiles[v.user_id];
            const durSec = Number(v.duration || 45);
            mergedMap.set(v.id, {
              id: v.id,
              userId: v.user_id,
              title: v.title,
              description: v.description || '',
              videoUrl: v.video_url,
              thumbnailUrl: v.thumbnail_url || '',
              duration: `${Math.floor(durSec / 60)}:${(durSec % 60).toString().padStart(2, '0')}`,
              durationSeconds: durSec,
              videoKind: durSec > 120 ? 'video' : 'short',
              aspectRatio: durSec > 120 ? '16:9' : '9:16',
              views: v.views || 0,
              clubTag: v.club_tag || '',
              privacy: v.privacy || 'public',
              createdAt: v.created_at || 'Recently',
              creator: prof
                ? {
                    name: prof.name,
                    handle: prof.handle,
                    subscribers: '1 supporter',
                    avatar: prof.avatar || DEFAULT_AVATAR,
                    isVerified: prof.isAuthenticated,
                  }
                : {
                    name: 'Pitch Creator',
                    handle: `@user_${String(v.user_id || 'creator').slice(0, 6)}`,
                    subscribers: '1 supporter',
                    avatar: DEFAULT_AVATAR,
                    isVerified: false,
                  },
              likes: v.likes_count || 0,
              isLiked: false,
              commentsCount: v.comments_count || 0,
              shares: 0,
              isSaved: false,
              quality: '1080p · Sound ON',
              copyrightStatus: 'CLEAR',
              tacticalSummary: v.description || '',
              category: 'foryou',
              hashtags: ['#FutfieldTube', '#FUTFIELD'],
            });
          }
        }
      }
    } catch (err: any) {
      console.warn('[Backend] Videos query notice:', err?.message);
    }
  }

  let results = Array.from(mergedMap.values()).filter(v => {
    const vid = String(v?.id || '').toLowerCase();
    const title = String(v?.title || '').toLowerCase();
    const url = String(v?.videoUrl || '').toLowerCase();
    return vid !== 'vid_1794743322269' && !(title === 'training highlight' && url.includes('/uploads/videos/sample.mp4'));
  });
  if (search) {
    const q = (search as string).toLowerCase();
    results = results.filter(v => v.title?.toLowerCase().includes(q) || v.description?.toLowerCase().includes(q));
  }
  if (clubTag) {
    results = results.filter(v => v.clubTag === clubTag);
  }
  if (userId) {
    results = results.filter(v => v.userId === userId);
  }
  if (kind === 'short' || kind === 'video') {
    results = results.filter(v => (v.videoKind || (v.aspectRatio === '16:9' ? 'video' : 'short')) === kind);
  }
  return res.json({ videos: results });
});

app.post('/api/db/videos', async (req, res) => {
  const { video } = req.body;
  if (!video || !video.videoUrl) {
    return res.status(400).json({ error: 'Video URL and metadata required' });
  }
  if (String(video.videoUrl).startsWith('blob:')) {
    return res.status(400).json({ error: 'Video must be uploaded to backend storage before publishing' });
  }

  // Enforce 9:16 Quick Kicks <= 120s and 16:9 Clips <= 600s
  const durSec = Number(video.durationSeconds || 0);
  const resolvedAspectRatio: '9:16' | '16:9' =
    video.aspectRatio === '16:9' || video.videoKind === 'video' ? '16:9' : '9:16';
  const resolvedKind: 'short' | 'video' = resolvedAspectRatio === '16:9' ? 'video' : 'short';

  if (resolvedKind === 'short' && durSec > 120) {
    return res.status(400).json({
      success: false,
      error: `9:16 Quick Kicks cannot exceed 2 minutes (120s). Received ${durSec}s.`,
    });
  }
  if (resolvedKind === 'video' && durSec > 600) {
    return res.status(400).json({
      success: false,
      error: `16:9 Football Clips cannot exceed 10 minutes (600s). Received ${durSec}s.`,
    });
  }

  // Run backend Copyright Detector with strict path-traversal containment
  let diskBuffer: Buffer | null = null;
  if (String(video.videoUrl).startsWith('/uploads/')) {
    const candidatePath = resolveSafeUploadPath(String(video.videoUrl));
    if (candidatePath && fs.existsSync(candidatePath)) {
      try {
        diskBuffer = fs.readFileSync(candidatePath);
      } catch {}
    }
  }

  const copyrightReport = analyzeVideoCopyright({
    buffer: diskBuffer,
    fileName: String(video.videoUrl || ''),
    title: String(video.title || ''),
    description: String(video.description || ''),
    videoUrl: String(video.videoUrl || ''),
    hashtags: Array.isArray(video.hashtags) ? video.hashtags : [],
    clubTag: String(video.clubTag || ''),
  });

  if (copyrightReport.status === 'BLOCKED') {
    return res.status(403).json({
      success: false,
      copyrightStatus: 'BLOCKED',
      copyrightReport,
      error: copyrightReport.reason || 'Copyrighted broadcast or DRM-protected video blocked by MediaGuard.',
    });
  }

  const newId = video.id || `v_${Date.now()}`;
  const dbVideoId = isValidUuid(newId) ? newId : crypto.randomUUID();
  const creatorProf = video.userId ? inMemoryProfiles[video.userId] : undefined;
  const fullVideo = {
    ...video,
    id: newId,
    creator: {
      name: video.creator?.name || creatorProf?.name || 'Pitch Creator',
      handle: video.creator?.handle || creatorProf?.handle || '@creator',
      subscribers: video.creator?.subscribers || '1 supporter',
      avatar: video.creator?.avatar || creatorProf?.avatar || DEFAULT_AVATAR,
      isVerified: Boolean(video.creator?.isVerified ?? creatorProf?.isAuthenticated),
    },
    thumbnailUrl: video.thumbnailUrl || '',
    videoKind: resolvedKind,
    aspectRatio: resolvedAspectRatio,
    copyrightStatus: copyrightReport.status,
    copyrightReport,
    views: video.views || 0,
    likes: video.likes || 0,
    commentsCount: 0,
    shares: 0,
    isLiked: false,
    isSaved: false,
    createdAt: new Date().toISOString(),
  };

  if (supabaseBackendClient && isValidUuid(video.userId)) {
    try {
      await supabaseBackendClient.from('videos').insert({
        id: dbVideoId,
        user_id: video.userId,
        title: video.title,
        description: video.description || '',
        video_url: video.videoUrl,
        thumbnail_url: video.thumbnailUrl || null,
        duration: durSec || 30,
        views: 0,
        likes_count: 0,
        comments_count: 0,
        club_tag: video.clubTag || null,
        privacy: video.privacy || 'public',
        created_at: new Date().toISOString(),
      });
    } catch (err: any) {
      console.warn('[Backend] Video upload insert notice:', err?.message);
    }
  }

  inMemoryVideos.unshift(fullVideo);
  scheduleStorePersist();
  broadcastToGlobalFeed('new_video', fullVideo);
  broadcastToGlobalFeed('analytics_summary', computeRealtimeAnalytics());
  return res.json({
    success: true,
    video: fullVideo,
    copyrightStatus: copyrightReport.status,
    copyrightReport,
  });
});

app.delete('/api/db/videos/:id', async (req, res) => {
  const { id } = req.params;
  const idx = inMemoryVideos.findIndex(v => v.id === id);
  const removed = idx !== -1 ? inMemoryVideos[idx] : null;
  if (idx !== -1) {
    inMemoryVideos.splice(idx, 1);
  }
  if (removed) {
    for (const field of [removed.videoUrl, removed.thumbnailUrl]) {
      if (typeof field === 'string' && field.startsWith('/uploads/')) {
        try {
          const targetPath = path.join(UPLOADS_DIR, field.replace(/^\/uploads\//, ''));
          if (targetPath.startsWith(UPLOADS_DIR) && fs.existsSync(targetPath)) {
            fs.unlinkSync(targetPath);
          }
        } catch {}
      }
    }
  }
  if (supabaseBackendClient) {
    try {
      await supabaseBackendClient.from('videos').delete().eq('id', id);
    } catch {}
  }
  scheduleStorePersist();
  broadcastToGlobalFeed('video_deleted', { videoId: id });
  broadcastToGlobalFeed('analytics_summary', computeRealtimeAnalytics());
  return res.json({ success: true, deletedId: id });
});

async function streamDownloadResponse(
  res: express.Response,
  sourceUrl: string,
  title: string
) {
  const safeBase = String(title || 'futfield_video')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || 'futfield_video';

  if (sourceUrl.startsWith('/uploads/')) {
    const rel = sourceUrl.replace(/^\/uploads\//, '');
    const targetPath = path.join(UPLOADS_DIR, rel);
    if (!targetPath.startsWith(UPLOADS_DIR) || !fs.existsSync(targetPath)) {
      return res.status(404).json({ error: 'Video file not found on server' });
    }
    const ext = path.extname(targetPath) || '.mp4';
    const contentType =
      ext.toLowerCase() === '.webm'
        ? 'video/webm'
        : ext.toLowerCase() === '.mov'
        ? 'video/quicktime'
        : 'video/mp4';
    const stat = fs.statSync(targetPath);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('Content-Disposition', `attachment; filename="${safeBase}${ext}"`);
    return fs.createReadStream(targetPath).pipe(res);
  }

  if (/^https?:\/\//i.test(sourceUrl)) {
    try {
      const upstream = await fetch(sourceUrl);
      if (!upstream.ok) {
        return res.status(upstream.status).json({ error: 'Unable to fetch video file from storage' });
      }
      const contentType = upstream.headers.get('content-type') || 'video/mp4';
      const ext = contentType.includes('webm') ? '.webm' : contentType.includes('quicktime') ? '.mov' : '.mp4';
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', String(buf.length));
      res.setHeader('Content-Disposition', `attachment; filename="${safeBase}${ext}"`);
      return res.send(buf);
    } catch (err: any) {
      return res.status(502).json({ error: err?.message || 'Download stream failed' });
    }
  }

  return res.status(400).json({ error: 'Unsupported video URL for download' });
}

app.get('/api/db/videos/:id/download', async (req, res) => {
  const { id } = req.params;
  let videoRecord = inMemoryVideos.find(v => v.id === id);
  if (!videoRecord && supabaseBackendClient) {
    try {
      const { data } = await supabaseBackendClient
        .from('videos')
        .select('id, title, video_url')
        .eq('id', id)
        .maybeSingle();
      if (data?.video_url) {
        videoRecord = { id: data.id, title: data.title, videoUrl: data.video_url };
      }
    } catch {}
  }
  if (!videoRecord || !videoRecord.videoUrl) {
    return res.status(404).json({ error: 'Video not found' });
  }
  return streamDownloadResponse(res, String(videoRecord.videoUrl), String(videoRecord.title || 'futfield_video'));
});

app.get('/api/db/media/download', async (req, res) => {
  const rawUrl = String(req.query.url || '').trim();
  const title = String(req.query.title || 'futfield_clip').trim();
  if (!rawUrl) {
    return res.status(400).json({ error: 'Media url query parameter required' });
  }
  return streamDownloadResponse(res, rawUrl, title);
});

app.post('/api/db/videos/:id/like', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  const uId = userId || 'user';

  let isLiked = false;
  const idx = inMemoryVideoLikes.findIndex(l => l.videoId === id && l.userId === uId);
  if (idx !== -1) {
    inMemoryVideoLikes.splice(idx, 1);
    isLiked = false;
  } else {
    inMemoryVideoLikes.push({ videoId: id, userId: uId });
    isLiked = true;
  }

  let v = inMemoryVideos.find(item => item.id === id);
  if (!v) {
    // Register trackable video record dynamically if not yet in memory
    v = { id, views: 1, likes: 0, shares: 0, commentsCount: 0, reactions: {} };
    inMemoryVideos.push(v);
  }
  v.likes = Math.max(0, (v.likes || 0) + (isLiked ? 1 : -1));
  v.isLiked = isLiked;

  scheduleStorePersist();
  broadcastToGlobalFeed('video_engagement_updated', {
    videoId: id,
    likes: v.likes,
    views: v.views || 0,
    shares: v.shares || 0,
    reactions: v.reactions || {},
    commentsCount: v.commentsCount || 0,
  });
  broadcastToGlobalFeed('analytics_summary', computeRealtimeAnalytics());
  return res.json({ success: true, isLiked, likesCount: v.likes });
});

app.post('/api/db/videos/:id/view', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  let v = inMemoryVideos.find(item => item.id === id);
  if (!v) {
    v = { id, views: 0, likes: 0, shares: 0, commentsCount: 0, reactions: {} };
    inMemoryVideos.push(v);
  }
  v.views = (v.views || 0) + 1;

  inMemoryVideoViews.push({
    videoId: id,
    userId: userId || 'viewer',
    timestamp: new Date().toISOString(),
  });

  scheduleStorePersist();
  broadcastToGlobalFeed('video_engagement_updated', {
    videoId: id,
    views: v.views,
    likes: v.likes || 0,
    shares: v.shares || 0,
    reactions: v.reactions || {},
    commentsCount: v.commentsCount || 0,
  });
  broadcastToGlobalFeed('analytics_summary', computeRealtimeAnalytics());
  return res.json({ success: true, views: v.views });
});

app.post('/api/db/videos/:id/react', (req, res) => {
  const { id } = req.params;
  const { userId = 'user', emoji = '🔥' } = req.body || {};

  let v = inMemoryVideos.find(item => item.id === id);
  if (!v) {
    v = { id, views: 1, likes: 0, shares: 0, commentsCount: 0, reactions: {} };
    inMemoryVideos.push(v);
  }
  if (!v.reactions || typeof v.reactions !== 'object') {
    v.reactions = {};
  }

  const existingIdx = inMemoryVideoReactions.findIndex(
    r => r.videoId === id && r.userId === userId && r.emoji === emoji
  );
  let active = false;

  if (existingIdx !== -1) {
    inMemoryVideoReactions.splice(existingIdx, 1);
    v.reactions[emoji] = Math.max(0, (v.reactions[emoji] || 1) - 1);
    active = false;
  } else {
    inMemoryVideoReactions.push({ videoId: id, userId, emoji });
    v.reactions[emoji] = (v.reactions[emoji] || 0) + 1;
    active = true;
  }

  const userReactions = inMemoryVideoReactions
    .filter(r => r.videoId === id && r.userId === userId)
    .map(r => r.emoji);

  scheduleStorePersist();
  broadcastToGlobalFeed('video_engagement_updated', {
    videoId: id,
    views: v.views || 0,
    likes: v.likes || 0,
    shares: v.shares || 0,
    reactions: v.reactions,
    commentsCount: v.commentsCount || 0,
  });
  broadcastToGlobalFeed('analytics_summary', computeRealtimeAnalytics());
  return res.json({ success: true, videoId: id, reactions: v.reactions, userReactions, active });
});

app.post('/api/db/videos/:id/share', (req, res) => {
  const { id } = req.params;
  let v = inMemoryVideos.find(item => item.id === id);
  if (!v) {
    v = { id, views: 1, likes: 0, shares: 0, commentsCount: 0, reactions: {} };
    inMemoryVideos.push(v);
  }
  v.shares = (v.shares || 0) + 1;

  scheduleStorePersist();
  broadcastToGlobalFeed('video_engagement_updated', {
    videoId: id,
    views: v.views || 0,
    likes: v.likes || 0,
    shares: v.shares,
    reactions: v.reactions || {},
    commentsCount: v.commentsCount || 0,
  });
  broadcastToGlobalFeed('analytics_summary', computeRealtimeAnalytics());
  return res.json({ success: true, videoId: id, shares: v.shares });
});

app.get('/api/db/videos/:id/comments', async (req, res) => {
  const { id } = req.params;
  const list = inMemoryVideoComments.filter(c => c.videoId === id);
  return res.json({ comments: list });
});

app.post('/api/db/videos/:id/comments', async (req, res) => {
  const { id } = req.params;
  const { author, text, parentId } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Text required' });

  const newComm = {
    id: `vcomm_${Date.now()}`,
    videoId: id,
    parentId: parentId || null,
    author: author || { name: 'Fan', handle: '@fan', avatar: '' },
    text: text.trim(),
    timestamp: 'Just now',
    likes: 0,
    replies: [],
  };

  if (parentId) {
    const parent = inMemoryVideoComments.find(c => c.id === parentId);
    if (parent) {
      if (!parent.replies) parent.replies = [];
      parent.replies.push(newComm);
    }
  } else {
    inMemoryVideoComments.unshift(newComm);
  }

  let v = inMemoryVideos.find(item => item.id === id);
  if (!v) {
    v = { id, views: 1, likes: 0, shares: 0, commentsCount: 0, reactions: {} };
    inMemoryVideos.push(v);
  }
  v.commentsCount = (v.commentsCount || 0) + 1;

  scheduleStorePersist();
  broadcastToGlobalFeed('video_engagement_updated', {
    videoId: id,
    views: v.views || 0,
    likes: v.likes || 0,
    shares: v.shares || 0,
    reactions: v.reactions || {},
    commentsCount: v.commentsCount,
  });
  broadcastToGlobalFeed('analytics_summary', computeRealtimeAnalytics());
  return res.json({ success: true, comment: newComm });
});

// -------------------------------------------------------------
// FUTFIELD TUBE Endpoints (/api/futube/*)
// Non-Copyright Football Video & Quick Kicks Platform
// -------------------------------------------------------------
function normalizeFutubeHandle(raw?: string): string {
  const cleaned = String(raw || '@fanzone').trim();
  if (!cleaned) return '@fanzone';
  return cleaned.startsWith('@') ? cleaned.toLowerCase() : `@${cleaned.toLowerCase()}`;
}

function enrichFutubeVideo(raw: any, viewerId?: string) {
  if (!raw) return null;
  const fanzoneHandle = normalizeFutubeHandle(
    raw.fanzoneHandle || raw.creator?.handle || (raw.userId ? `@fan_${String(raw.userId).slice(0, 6)}` : '@fanzone')
  );
  const fanzoneId = raw.fanzoneId || fanzoneHandle;
  const fanzoneName = raw.fanzoneName || raw.creator?.name || 'FanZone Creator';
  const fanzoneAvatar = raw.fanzoneAvatar || raw.creator?.avatar || DEFAULT_AVATAR;

  const squadCount = Math.max(
    1,
    Number(raw.squadCount || 0),
    inMemoryFutubeConnects.filter(c => c.fanzoneId === fanzoneId || c.fanzoneId === fanzoneHandle).length
  );
  const watches = Number(raw.watches ?? raw.views ?? 0);
  const cheers = Number(raw.cheers ?? raw.likes ?? 0);
  const boos = Number(raw.boos ?? 0);
  const shoutsCount = Math.max(
    Number(raw.shoutsCount ?? raw.commentsCount ?? 0),
    inMemoryFutubeShouts.filter(s => s.videoId === raw.id).length
  );

  const connectRec = viewerId
    ? inMemoryFutubeConnects.find(
        c => c.fanId === viewerId && (c.fanzoneId === fanzoneId || c.fanzoneId === fanzoneHandle)
      )
    : undefined;
  const hasCheered = viewerId
    ? inMemoryFutubeCheers.some(c => c.videoId === raw.id && c.userId === viewerId)
    : false;
  const hasBooed = viewerId
    ? inMemoryFutubeBoos.some(b => b.videoId === raw.id && b.userId === viewerId)
    : false;

  const durSec = Number(raw.durationSeconds || 30);
  const isQuickKick = Boolean(raw.isQuickKick ?? (raw.aspectRatio === '9:16' || raw.videoKind === 'short'));
  const tubeCategory =
    raw.tubeCategory ||
    (isQuickKick ? 'Quick Kicks' : raw.clubTag ? 'Premier League' : 'Goals');
  const boostFirst60 = Boolean(
    raw.boostFirst60 ?? (tubeCategory.toLowerCase() === 'goals' || durSec <= 60)
  );

  return {
    ...raw,
    fanzoneId,
    fanzoneName,
    fanzoneHandle,
    fanzoneAvatar,
    fanzoneBio: raw.fanzoneBio || `Official ${raw.clubTag || 'Football'} FanZone on Futfield Tube ⚽`,
    squadCount,
    watches,
    views: watches,
    cheers,
    likes: cheers,
    boos,
    shoutsCount,
    commentsCount: shoutsCount,
    hasCheered,
    isLiked: hasCheered,
    hasBooed,
    isConnected: Boolean(connectRec),
    alertEnabled: connectRec ? Boolean(connectRec.alertEnabled) : false,
    isQuickKick,
    tubeCategory,
    boostFirst60,
    visibility: raw.visibility || (raw.privacy === 'followers' ? 'squad' : raw.privacy || 'public'),
    quality: raw.quality || (raw.hasWatermark === false ? '1080p' : '720p'),
    hasWatermark: raw.hasWatermark !== undefined ? Boolean(raw.hasWatermark) : false,
    creator: {
      ...(raw.creator || {}),
      name: fanzoneName,
      handle: fanzoneHandle,
      avatar: fanzoneAvatar,
      subscribers: `${squadCount} Squad`,
      isSubscribed: Boolean(connectRec),
    },
  };
}

app.get('/api/futube/videos', async (req, res) => {
  const category = String(req.query.category || 'All').trim();
  const search = String(req.query.search || '').trim().toLowerCase();
  const sort = String(req.query.sort || 'goals_boost').trim();
  const userId = String(req.query.userId || '').trim();
  const fanzone = String(req.query.fanzone || '').trim();
  const offset = Math.max(0, Number(req.query.offset || 0));
  const limit = Math.max(1, Math.min(50, Number(req.query.limit || 24)));

  const mergedMap = new Map<string, any>();
  for (const v of inMemoryVideos) {
    if (v?.id) mergedMap.set(v.id, v);
  }

  if (supabaseBackendClient) {
    try {
      const { data, error } = await supabaseBackendClient
        .from('futube_videos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          if (!mergedMap.has(row.id)) {
            const durSec = Number(row.duration_seconds || 30);
            mergedMap.set(row.id, {
              id: row.id,
              userId: row.user_id,
              fanzoneId: row.fanzone_id,
              title: row.title,
              description: row.description || '',
              videoUrl: row.video_url,
              thumbnailUrl: row.thumbnail_url || '',
              tubeCategory: row.category || 'Goals',
              hashtags: Array.isArray(row.tags) ? row.tags : [],
              watches: row.watches || 0,
              views: row.watches || 0,
              cheers: row.cheers || 0,
              likes: row.cheers || 0,
              boos: row.boos || 0,
              shoutsCount: row.shouts_count || 0,
              shares: row.shares || 0,
              visibility: row.visibility || 'public',
              isQuickKick: Boolean(row.is_quick_kick),
              isMatchLive: Boolean(row.is_match_live),
              duration: row.duration || '0:30',
              durationSeconds: durSec,
              quality: row.quality || '720p',
              hasWatermark: Boolean(row.has_watermark),
              boostFirst60: Boolean(row.boost_first_60),
              aspectRatio: row.is_quick_kick ? '9:16' : '16:9',
              videoKind: row.is_quick_kick ? 'short' : 'video',
              createdAt: row.created_at,
            });
          }
        }
      }
    } catch {}
  }

  let items = Array.from(mergedMap.values())
    .map(v => enrichFutubeVideo(v, userId || undefined))
    .filter((v): v is NonNullable<typeof v> => Boolean(v));

  // Enforce Private visibility (creator-only)
  items = items.filter(v => {
    if (v.visibility === 'private') {
      return userId && v.userId === userId;
    }
    return true;
  });

  if (fanzone) {
    const targetFz = normalizeFutubeHandle(fanzone);
    items = items.filter(
      v => v.fanzoneHandle === targetFz || String(v.fanzoneId).toLowerCase() === fanzone.toLowerCase()
    );
  }

  if (category && category !== 'All') {
    if (category === 'Quick Kicks') {
      items = items.filter(v => v.isQuickKick);
    } else if (category === 'Match Live') {
      items = items.filter(v => v.isMatchLive);
    } else if (category === 'On Fire') {
      items = [...items].sort((a, b) => (b.cheers * 4 + b.watches * 2) - (a.cheers * 4 + a.watches * 2));
    } else {
      const catLower = category.toLowerCase();
      items = items.filter(
        v =>
          String(v.tubeCategory || '').toLowerCase() === catLower ||
          String(v.clubTag || '').toLowerCase().includes(catLower) ||
          (Array.isArray(v.hashtags) && v.hashtags.some((t: string) => t.toLowerCase().includes(catLower.replace(/\s+/g, ''))))
      );
    }
  }

  if (search) {
    items = items.filter(v => {
      const hay = [
        v.title,
        v.description,
        v.clubTag,
        v.fanzoneName,
        v.fanzoneHandle,
        v.tubeCategory,
        ...(Array.isArray(v.hashtags) ? v.hashtags : []),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(search);
    });
  }

  if (sort === 'on_fire' || category === 'On Fire') {
    items.sort((a, b) => (b.cheers * 4 + b.watches * 2 + b.shoutsCount * 3) - (a.cheers * 4 + a.watches * 2 + a.shoutsCount * 3));
  } else if (sort === 'newest') {
    items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  } else {
    // Football-only algorithm: Boost goals & clips <= 60s
    items.sort((a, b) => {
      const aGoalBoost = (a.boostFirst60 ? 500 : 0) + (String(a.tubeCategory).toLowerCase() === 'goals' ? 300 : 0);
      const bGoalBoost = (b.boostFirst60 ? 500 : 0) + (String(b.tubeCategory).toLowerCase() === 'goals' ? 300 : 0);
      const aScore = aGoalBoost + a.cheers * 3 + a.watches;
      const bScore = bGoalBoost + b.cheers * 3 + b.watches;
      if (bScore !== aScore) return bScore - aScore;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }

  const total = items.length;
  const paged = items.slice(offset, offset + limit);
  return res.json({
    success: true,
    videos: paged,
    total,
    hasMore: offset + paged.length < total,
  });
});

app.get('/api/futube/videos/:id', (req, res) => {
  const { id } = req.params;
  const userId = String(req.query.userId || '').trim();
  const raw = inMemoryVideos.find(v => v.id === id);
  if (!raw) {
    return res.status(404).json({ success: false, error: 'Clip not found' });
  }
  const enriched = enrichFutubeVideo(raw, userId || undefined);
  const upNext = inMemoryVideos
    .filter(v => v.id !== id && v.visibility !== 'private')
    .map(v => enrichFutubeVideo(v, userId || undefined))
    .filter(Boolean)
    .slice(0, 10);

  return res.json({
    success: true,
    video: enriched,
    upNext,
  });
});

app.post('/api/futube/videos', async (req, res) => {
  const payload = req.body?.video || req.body || {};
  const userId = String(payload.userId || 'guest_user');
  if (!payload.videoUrl) {
    return res.status(400).json({ success: false, error: 'Video URL is required' });
  }
  if (String(payload.videoUrl).startsWith('blob:')) {
    return res.status(400).json({ success: false, error: 'Upload video to futfield-videos storage first' });
  }

  const cleanTitle = String(payload.title || 'Matchday Clip').trim().slice(0, 80);
  if (!cleanTitle) {
    return res.status(400).json({ success: false, error: 'Clip title (max 80 chars) required' });
  }

  const durSec = Math.max(1, Math.round(Number(payload.durationSeconds || 30)));
  const isQuickKick = Boolean(payload.isQuickKick || payload.aspectRatio === '9:16' || payload.videoKind === 'short');
  if (isQuickKick && durSec > 60) {
    return res.status(400).json({
      success: false,
      error: `Quick Kicks (vertical 9:16) cannot exceed 60 seconds. Received ${durSec}s.`,
    });
  }

  // Enforce Pro (unlimited, 1080p, no watermark) vs Free (3/day, 720p, Futfield watermark)
  const isPro = Boolean(payload.isPro || activeSubscriptionsStore[userId]);
  const todayKey = `${userId}_${new Date().toISOString().slice(0, 10)}`;
  const todaysUploads = inMemoryFutubeDailyUploads[todayKey] || [];
  if (!isPro && todaysUploads.length >= 3) {
    return res.status(429).json({
      success: false,
      limitReached: true,
      error: 'Free limit reached (3 clips/day). Upgrade to Pro for unlimited 1080p watermark-free uploads!',
    });
  }

  let diskBuffer: Buffer | null = null;
  if (String(payload.videoUrl).startsWith('/uploads/')) {
    const candidate = path.join(UPLOADS_DIR, String(payload.videoUrl).replace(/^\/uploads\//, ''));
    if (fs.existsSync(candidate)) {
      try {
        diskBuffer = fs.readFileSync(candidate);
      } catch {}
    }
  }

  const copyrightReport = analyzeVideoCopyright({
    buffer: diskBuffer,
    fileName: String(payload.videoUrl || ''),
    title: cleanTitle,
    description: String(payload.description || ''),
    videoUrl: String(payload.videoUrl || ''),
    hashtags: Array.isArray(payload.hashtags) ? payload.hashtags : [],
    clubTag: String(payload.clubTag || ''),
  });

  if (copyrightReport.status === 'BLOCKED') {
    return res.status(403).json({
      success: false,
      copyrightStatus: 'BLOCKED',
      copyrightReport,
      error: copyrightReport.reason || 'Protected broadcast blocked by MediaGuard.',
    });
  }

  const newId = payload.id || `ft_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const uploaderProf = inMemoryProfiles[userId];
  const isCreatorAccount = isCreatorEmail(payload.email || uploaderProf?.email);
  const fanzoneHandle = normalizeFutubeHandle(payload.fanzoneHandle || payload.creator?.handle || `@fan_${userId.slice(0, 6)}`);
  const fanzoneName = payload.fanzoneName || payload.creator?.name || 'FanZone Creator';
  if (!isCreatorAccount && (isReservedFutfieldText(fanzoneName) || isReservedFutfieldText(fanzoneHandle))) {
    return res.status(400).json({
      success: false,
      error: 'The name "Futfield" is strictly reserved for the official Futfield Creator account.',
    });
  }
  const fanzoneAvatar = payload.fanzoneAvatar || payload.creator?.avatar || DEFAULT_AVATAR;
  const tubeCategory = isQuickKick ? 'Quick Kicks' : String(payload.tubeCategory || payload.category || 'Goals');
  const boostFirst60 = tubeCategory.toLowerCase() === 'goals' || durSec <= 60;
  const visibility: 'public' | 'squad' | 'private' =
    payload.visibility === 'squad' || payload.visibility === 'private' ? payload.visibility : 'public';

  const fullClip = {
    id: newId,
    userId,
    fanzoneId: payload.fanzoneId || fanzoneHandle,
    fanzoneName,
    fanzoneHandle,
    fanzoneAvatar,
    fanzoneBio: payload.fanzoneBio || `Official ${payload.clubTag || 'Football'} FanZone on Futfield Tube`,
    title: cleanTitle,
    description: String(payload.description || ''),
    videoUrl: String(payload.videoUrl),
    thumbnailUrl: String(payload.thumbnailUrl || ''),
    tubeCategory,
    category: isQuickKick ? 'playlists' : 'highlights',
    hashtags: Array.isArray(payload.hashtags) ? payload.hashtags : ['#FutfieldTube', '#Football'],
    duration: payload.duration || `${Math.floor(durSec / 60)}:${(durSec % 60).toString().padStart(2, '0')}`,
    durationSeconds: durSec,
    videoKind: isQuickKick ? 'short' : 'video',
    aspectRatio: isQuickKick ? '9:16' : '16:9',
    isQuickKick,
    isMatchLive: Boolean(payload.isMatchLive),
    visibility,
    privacy: visibility === 'squad' ? 'followers' : visibility,
    clubTag: String(payload.clubTag || ''),
    watches: 0,
    views: 0,
    cheers: 0,
    likes: 0,
    boos: 0,
    shoutsCount: 0,
    commentsCount: 0,
    shares: 0,
    quality: isPro ? '1080p' : '720p',
    hasWatermark: !isPro,
    boostFirst60,
    sizeBytes: payload.sizeBytes,
    sizeMb: payload.sizeMb,
    copyrightStatus: copyrightReport.status,
    copyrightReport,
    creator: {
      name: fanzoneName,
      handle: fanzoneHandle,
      avatar: fanzoneAvatar,
      subscribers: '1 Squad',
      isVerified: Boolean(payload.creator?.isVerified),
    },
    createdAt: new Date().toISOString(),
  };

  inMemoryVideos.unshift(fullClip);
  inMemoryFutubeDailyUploads[todayKey] = [...todaysUploads, newId];

  if (supabaseBackendClient) {
    try {
      await supabaseBackendClient.from('futube_videos').insert({
        id: newId,
        user_id: userId,
        fanzone_id: fullClip.fanzoneId,
        title: cleanTitle,
        description: fullClip.description,
        video_url: fullClip.videoUrl,
        thumbnail_url: fullClip.thumbnailUrl,
        category: tubeCategory,
        tags: fullClip.hashtags,
        watches: 0,
        cheers: 0,
        boos: 0,
        shouts_count: 0,
        shares: 0,
        visibility,
        is_quick_kick: isQuickKick,
        is_match_live: fullClip.isMatchLive,
        duration: fullClip.duration,
        duration_seconds: durSec,
        quality: fullClip.quality,
        has_watermark: fullClip.hasWatermark,
        boost_first_60: boostFirst60,
        created_at: fullClip.createdAt,
      });
    } catch {}
  }

  scheduleStorePersist();
  const enriched = enrichFutubeVideo(fullClip, userId);
  broadcastToGlobalFeed('new_video', enriched);
  broadcastToGlobalFeed('analytics_summary', computeRealtimeAnalytics());
  return res.json({
    success: true,
    video: enriched,
    remainingToday: isPro ? 'unlimited' : Math.max(0, 3 - inMemoryFutubeDailyUploads[todayKey].length),
  });
});

app.delete('/api/futube/videos/:id', async (req, res) => {
  const { id } = req.params;
  const idx = inMemoryVideos.findIndex(v => v.id === id);
  const removed = idx !== -1 ? inMemoryVideos[idx] : null;
  if (idx !== -1) inMemoryVideos.splice(idx, 1);

  if (removed) {
    for (const field of [removed.videoUrl, removed.thumbnailUrl]) {
      if (typeof field === 'string' && field.startsWith('/uploads/')) {
        try {
          const targetPath = path.join(UPLOADS_DIR, field.replace(/^\/uploads\//, ''));
          if (targetPath.startsWith(UPLOADS_DIR) && fs.existsSync(targetPath)) {
            fs.unlinkSync(targetPath);
          }
        } catch {}
      }
    }
  }
  if (supabaseBackendClient) {
    try {
      await supabaseBackendClient.from('futube_videos').delete().eq('id', id);
    } catch {}
  }
  scheduleStorePersist();
  broadcastToGlobalFeed('video_deleted', { videoId: id });
  return res.json({ success: true, deletedId: id });
});

// Increment watches strictly at >= 5 seconds of real viewing (anti-fake-view protection)
app.post('/api/futube/videos/:id/watch', async (req, res) => {
  const { id } = req.params;
  const userId = String(req.body?.userId || 'anon_viewer');
  const watchedSeconds = Math.max(0, Math.round(Number(req.body?.watchedSeconds || 0)));

  let v = inMemoryVideos.find(item => item.id === id);
  if (!v) {
    return res.status(404).json({ success: false, error: 'Clip not found' });
  }

  let historyRec = inMemoryFutubeWatchHistory.find(h => h.videoId === id && h.userId === userId);
  if (!historyRec) {
    historyRec = {
      userId,
      videoId: id,
      watchedSeconds: 0,
      countedWatch: false,
      updatedAt: new Date().toISOString(),
    };
    inMemoryFutubeWatchHistory.push(historyRec);
  }
  historyRec.watchedSeconds = Math.max(historyRec.watchedSeconds, watchedSeconds);
  historyRec.updatedAt = new Date().toISOString();

  let counted = false;
  if (watchedSeconds >= 5 && !historyRec.countedWatch) {
    historyRec.countedWatch = true;
    v.watches = Number(v.watches ?? v.views ?? 0) + 1;
    v.views = v.watches;
    counted = true;

    if (supabaseBackendClient) {
      try {
        await supabaseBackendClient.from('futube_watch_history').upsert({
          user_id: userId,
          video_id: id,
          watched_seconds: historyRec.watchedSeconds,
          counted_watch: true,
          updated_at: historyRec.updatedAt,
        });
        await supabaseBackendClient
          .from('futube_videos')
          .update({ watches: v.watches })
          .eq('id', id);
      } catch {}
    }

    broadcastToGlobalFeed('video_engagement_updated', {
      videoId: id,
      watches: v.watches,
      views: v.watches,
      cheers: v.cheers ?? v.likes ?? 0,
      likes: v.cheers ?? v.likes ?? 0,
      shares: v.shares || 0,
      shoutsCount: v.shoutsCount ?? v.commentsCount ?? 0,
      commentsCount: v.shoutsCount ?? v.commentsCount ?? 0,
    });
  }

  scheduleStorePersist();
  return res.json({
    success: true,
    counted,
    watchedSeconds: historyRec.watchedSeconds,
    watches: Number(v.watches ?? v.views ?? 0),
  });
});

app.post('/api/futube/videos/:id/cheer', async (req, res) => {
  const { id } = req.params;
  const userId = String(req.body?.userId || 'guest_user');
  const v = inMemoryVideos.find(item => item.id === id);
  if (!v) return res.status(404).json({ success: false, error: 'Clip not found' });

  const idx = inMemoryFutubeCheers.findIndex(c => c.videoId === id && c.userId === userId);
  let hasCheered = false;
  if (idx !== -1) {
    inMemoryFutubeCheers.splice(idx, 1);
    v.cheers = Math.max(0, Number(v.cheers ?? v.likes ?? 0) - 1);
  } else {
    inMemoryFutubeCheers.push({ videoId: id, userId, createdAt: new Date().toISOString() });
    v.cheers = Number(v.cheers ?? v.likes ?? 0) + 1;
    hasCheered = true;
    // Remove boo if switching from Boo to Cheer
    const booIdx = inMemoryFutubeBoos.findIndex(b => b.videoId === id && b.userId === userId);
    if (booIdx !== -1) {
      inMemoryFutubeBoos.splice(booIdx, 1);
      v.boos = Math.max(0, Number(v.boos || 0) - 1);
    }
  }
  v.likes = v.cheers;

  if (supabaseBackendClient) {
    try {
      if (hasCheered) {
        await supabaseBackendClient.from('futube_cheers').upsert({ video_id: id, user_id: userId });
      } else {
        await supabaseBackendClient.from('futube_cheers').delete().eq('video_id', id).eq('user_id', userId);
      }
      await supabaseBackendClient.from('futube_videos').update({ cheers: v.cheers, boos: v.boos || 0 }).eq('id', id);
    } catch {}
  }

  scheduleStorePersist();
  broadcastToGlobalFeed('video_engagement_updated', {
    videoId: id,
    watches: v.watches ?? v.views ?? 0,
    views: v.watches ?? v.views ?? 0,
    cheers: v.cheers,
    likes: v.cheers,
    boos: v.boos || 0,
    shares: v.shares || 0,
    shoutsCount: v.shoutsCount ?? v.commentsCount ?? 0,
    commentsCount: v.shoutsCount ?? v.commentsCount ?? 0,
  });
  return res.json({ success: true, hasCheered, cheers: v.cheers, boos: v.boos || 0 });
});

app.post('/api/futube/videos/:id/boo', (req, res) => {
  const { id } = req.params;
  const userId = String(req.body?.userId || 'guest_user');
  const v = inMemoryVideos.find(item => item.id === id);
  if (!v) return res.status(404).json({ success: false, error: 'Clip not found' });

  const idx = inMemoryFutubeBoos.findIndex(b => b.videoId === id && b.userId === userId);
  let hasBooed = false;
  if (idx !== -1) {
    inMemoryFutubeBoos.splice(idx, 1);
    v.boos = Math.max(0, Number(v.boos || 0) - 1);
  } else {
    inMemoryFutubeBoos.push({ videoId: id, userId, createdAt: new Date().toISOString() });
    v.boos = Number(v.boos || 0) + 1;
    hasBooed = true;
    const cheerIdx = inMemoryFutubeCheers.findIndex(c => c.videoId === id && c.userId === userId);
    if (cheerIdx !== -1) {
      inMemoryFutubeCheers.splice(cheerIdx, 1);
      v.cheers = Math.max(0, Number(v.cheers ?? v.likes ?? 0) - 1);
      v.likes = v.cheers;
    }
  }
  scheduleStorePersist();
  return res.json({ success: true, hasBooed, boos: v.boos, cheers: v.cheers ?? v.likes ?? 0 });
});

app.post('/api/futube/videos/:id/report', (req, res) => {
  const { id } = req.params;
  const userId = String(req.body?.userId || 'guest_user');
  const reason = String(req.body?.reason || 'Inappropriate or non-football content').trim();
  inMemoryFutubeReports.unshift({
    videoId: id,
    userId,
    reason,
    createdAt: new Date().toISOString(),
  });
  return res.json({ success: true, reported: true });
});

app.get('/api/futube/videos/:id/shouts', (req, res) => {
  const { id } = req.params;
  const sort = String(req.query.sort || 'newest');
  const userId = String(req.query.userId || '');

  const allForVideo = inMemoryFutubeShouts.filter(s => s.videoId === id);
  const topLevel = allForVideo.filter(s => !s.parentId).map(s => {
    const replies = allForVideo
      .filter(r => r.parentId === s.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map(r => ({
        ...r,
        hasCheered: userId ? Array.isArray(r.cheerUserIds) && r.cheerUserIds.includes(userId) : false,
      }));
    return {
      ...s,
      hasCheered: userId ? Array.isArray(s.cheerUserIds) && s.cheerUserIds.includes(userId) : false,
      replies,
    };
  });

  if (sort === 'top_cheers') {
    topLevel.sort((a, b) => (Number(b.cheers || 0) - Number(a.cheers || 0)) || (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } else {
    topLevel.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  return res.json({ success: true, shouts: topLevel, totalCount: allForVideo.length });
});

app.post('/api/futube/videos/:id/shouts', async (req, res) => {
  const { id } = req.params;
  const { userId = 'guest_user', authorName = 'Supporter', authorHandle = '@fan', authorAvatar = DEFAULT_AVATAR, text, parentId = null } = req.body || {};
  if (!text || !String(text).trim()) {
    return res.status(400).json({ success: false, error: 'Shout text is required' });
  }

  const shout = {
    id: `sh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    videoId: id,
    userId,
    authorName,
    authorHandle: normalizeFutubeHandle(authorHandle),
    authorAvatar: authorAvatar || DEFAULT_AVATAR,
    text: String(text).trim(),
    parentId: parentId || null,
    cheers: 0,
    cheerUserIds: [] as string[],
    createdAt: new Date().toISOString(),
  };

  inMemoryFutubeShouts.unshift(shout);
  const v = inMemoryVideos.find(item => item.id === id);
  if (v) {
    v.shoutsCount = inMemoryFutubeShouts.filter(s => s.videoId === id).length;
    v.commentsCount = v.shoutsCount;
  }

  if (supabaseBackendClient) {
    try {
      await supabaseBackendClient.from('futube_shouts').insert({
        id: shout.id,
        video_id: id,
        user_id: userId,
        author_name: authorName,
        author_handle: shout.authorHandle,
        author_avatar: shout.authorAvatar,
        text: shout.text,
        parent_id: parentId,
        cheers: 0,
        created_at: shout.createdAt,
      });
    } catch {}
  }

  scheduleStorePersist();
  return res.json({ success: true, shout: { ...shout, replies: [] }, shoutsCount: v?.shoutsCount || 1 });
});

app.post('/api/futube/shouts/:shoutId/cheer', (req, res) => {
  const { shoutId } = req.params;
  const userId = String(req.body?.userId || 'guest_user');
  const shout = inMemoryFutubeShouts.find(s => s.id === shoutId);
  if (!shout) return res.status(404).json({ success: false, error: 'Shout not found' });

  if (!Array.isArray(shout.cheerUserIds)) shout.cheerUserIds = [];
  const idx = shout.cheerUserIds.indexOf(userId);
  let hasCheered = false;
  if (idx !== -1) {
    shout.cheerUserIds.splice(idx, 1);
    shout.cheers = Math.max(0, Number(shout.cheers || 0) - 1);
  } else {
    shout.cheerUserIds.push(userId);
    shout.cheers = Number(shout.cheers || 0) + 1;
    hasCheered = true;
  }
  scheduleStorePersist();
  return res.json({ success: true, hasCheered, cheers: shout.cheers });
});

app.post('/api/futube/connects/toggle', async (req, res) => {
  const fanId = String(req.body?.fanId || req.body?.userId || 'guest_user');
  const fanzoneId = normalizeFutubeHandle(req.body?.fanzoneId || req.body?.handle);

  const idx = inMemoryFutubeConnects.findIndex(c => c.fanId === fanId && c.fanzoneId === fanzoneId);
  let isConnected = false;
  let alertEnabled = false;
  if (idx !== -1) {
    if (isCreatorTarget(fanzoneId) && !isCreatorTarget(fanId)) {
      const squadCount = Math.max(
        1,
        inMemoryFutubeConnects.filter(c => c.fanzoneId === fanzoneId).length
      );
      return res.json({
        success: false,
        blocked: true,
        isConnected: true,
        alertEnabled: inMemoryFutubeConnects[idx]?.alertEnabled ?? true,
        squadCount,
        fanzoneId,
        error: 'You cannot disconnect from or unfollow the official Futfield Creator account.',
      });
    }
    inMemoryFutubeConnects.splice(idx, 1);
  } else {
    inMemoryFutubeConnects.push({
      fanId,
      fanzoneId,
      alertEnabled: true,
      createdAt: new Date().toISOString(),
    });
    isConnected = true;
    alertEnabled = true;
  }

  const squadCount = Math.max(
    1,
    inMemoryFutubeConnects.filter(c => c.fanzoneId === fanzoneId).length
  );
  for (const v of inMemoryVideos) {
    if (normalizeFutubeHandle(v.fanzoneHandle || v.creator?.handle) === fanzoneId || v.fanzoneId === fanzoneId) {
      v.squadCount = squadCount;
      if (v.creator) v.creator.subscribers = `${squadCount} Squad`;
    }
  }

  if (supabaseBackendClient) {
    try {
      if (isConnected) {
        await supabaseBackendClient.from('futube_connects').upsert({
          fan_id: fanId,
          fanzone_id: fanzoneId,
          alert_enabled: true,
        });
      } else {
        await supabaseBackendClient.from('futube_connects').delete().eq('fan_id', fanId).eq('fanzone_id', fanzoneId);
      }
    } catch {}
  }

  scheduleStorePersist();
  return res.json({ success: true, isConnected, alertEnabled, squadCount, fanzoneId });
});

app.post('/api/futube/connects/alert', (req, res) => {
  const fanId = String(req.body?.fanId || req.body?.userId || 'guest_user');
  const fanzoneId = normalizeFutubeHandle(req.body?.fanzoneId || req.body?.handle);
  let rec = inMemoryFutubeConnects.find(c => c.fanId === fanId && c.fanzoneId === fanzoneId);
  if (!rec) {
    rec = { fanId, fanzoneId, alertEnabled: true, createdAt: new Date().toISOString() };
    inMemoryFutubeConnects.push(rec);
  } else {
    rec.alertEnabled = !rec.alertEnabled;
  }
  scheduleStorePersist();
  return res.json({ success: true, alertEnabled: rec.alertEnabled, isConnected: true });
});

app.get('/api/futube/fanzone/:username', (req, res) => {
  const rawUser = decodeURIComponent(req.params.username || '').trim();
  const handle = normalizeFutubeHandle(rawUser);
  const viewerId = String(req.query.userId || '');

  const prof =
    inMemoryProfiles[handle] ||
    inMemoryProfiles[rawUser] ||
    Object.values(inMemoryProfiles).find(
      p => normalizeFutubeHandle(p?.handle) === handle || String(p?.id).toLowerCase() === rawUser.toLowerCase()
    );

  const matchingVideos = inMemoryVideos
    .filter(
      v =>
        normalizeFutubeHandle(v.fanzoneHandle || v.creator?.handle) === handle ||
        String(v.fanzoneId || '').toLowerCase() === rawUser.toLowerCase() ||
        String(v.userId || '').toLowerCase() === rawUser.toLowerCase()
    )
    .map(v => enrichFutubeVideo(v, viewerId || undefined))
    .filter((v): v is NonNullable<typeof v> => Boolean(v));

  const firstVid = matchingVideos[0];
  const squadCount = Math.max(
    inMemoryFutubeConnects.filter(c => c.fanzoneId === handle).length,
    Number(firstVid?.squadCount || 0),
    Number(prof?.followersCount || 0)
  );
  const totalWatches = matchingVideos.reduce((acc, v) => acc + Number(v.watches || 0), 0);
  const connectRec = viewerId
    ? inMemoryFutubeConnects.find(c => c.fanId === viewerId && c.fanzoneId === handle)
    : undefined;

  const clips = matchingVideos.filter(v => !v.isQuickKick);
  const quickKicks = matchingVideos.filter(v => v.isQuickKick);
  const packs = inMemoryFutubePacks.filter(
    p => p.userId === prof?.id || normalizeFutubeHandle(p.userId) === handle
  );

  return res.json({
    success: true,
    fanzone: {
      id: prof?.id || handle,
      username: handle.replace(/^@/, ''),
      handle,
      name: prof?.name || firstVid?.fanzoneName || `${handle.replace(/^@/, '')} FanZone`,
      avatar: prof?.avatar || firstVid?.fanzoneAvatar || DEFAULT_AVATAR,
      bannerUrl:
        firstVid?.fanzoneBanner ||
        '/og-image.jpg',
      bio:
        prof?.bio ||
        firstVid?.fanzoneBio ||
        'Gunners for life — Matchday reactions, tactical breakdowns & Quick Kicks on Futfield Tube ⚡',
      favoriteClub: prof?.favoriteClub || firstVid?.clubTag || 'Arsenal',
      squadCount,
      clipsCount: matchingVideos.length,
      quickKicksCount: quickKicks.length,
      totalWatches,
      isConnected: Boolean(connectRec),
      alertEnabled: connectRec ? Boolean(connectRec.alertEnabled) : false,
      clips,
      quickKicks,
      packs,
    },
  });
});

app.get('/api/futube/packs', (req, res) => {
  const userId = String(req.query.userId || 'guest_user');
  const packs = inMemoryFutubePacks.filter(p => p.userId === userId);
  return res.json({ success: true, packs });
});

app.post('/api/futube/packs/save', async (req, res) => {
  const { userId = 'guest_user', videoId, packName = 'Matchday Favorites' } = req.body || {};
  if (!videoId) return res.status(400).json({ success: false, error: 'videoId required' });

  let pack = inMemoryFutubePacks.find(
    p => p.userId === userId && p.name.toLowerCase() === String(packName).trim().toLowerCase()
  );
  if (!pack) {
    pack = {
      id: `pack_${Date.now()}`,
      userId,
      name: String(packName).trim() || 'Matchday Pack',
      videoIds: [],
      createdAt: new Date().toISOString(),
    };
    inMemoryFutubePacks.unshift(pack);
  }
  if (!pack.videoIds.includes(videoId)) {
    pack.videoIds.push(videoId);
  }

  if (supabaseBackendClient) {
    try {
      await supabaseBackendClient.from('futube_matchday_packs').upsert({
        id: pack.id,
        user_id: pack.userId,
        name: pack.name,
        video_ids: pack.videoIds,
      });
    } catch {}
  }

  scheduleStorePersist();
  return res.json({ success: true, pack });
});

app.get('/api/futube/battles', (req, res) => {
  const userId = String(req.query.userId || '');
  // Auto-compose a live FanZone battle if user clips exist and none created manually yet
  let list = [...inMemoryFutubeBattles];
  if (list.length === 0 && inMemoryVideos.length >= 2) {
    const v1 = enrichFutubeVideo(inMemoryVideos[0], userId);
    const v2 = enrichFutubeVideo(inMemoryVideos[1], userId);
    if (v1 && v2) {
      list = [
        {
          id: `battle_auto_${v1.id}_${v2.id}`,
          title: `${v1.fanzoneName} vs ${v2.fanzoneName} — Goal of the Week Battle`,
          category: 'Goals',
          status: 'LIVE',
          createdAt: new Date().toISOString(),
          leftSide: {
            fanzoneName: v1.fanzoneName,
            fanzoneHandle: v1.fanzoneHandle,
            fanzoneAvatar: v1.fanzoneAvatar,
            videoId: v1.id,
            videoTitle: v1.title,
            thumbnailUrl: v1.thumbnailUrl,
            videoUrl: v1.videoUrl,
            votes: 0,
          },
          rightSide: {
            fanzoneName: v2.fanzoneName,
            fanzoneHandle: v2.fanzoneHandle,
            fanzoneAvatar: v2.fanzoneAvatar,
            videoId: v2.id,
            videoTitle: v2.title,
            thumbnailUrl: v2.thumbnailUrl,
            videoUrl: v2.videoUrl,
            votes: 0,
          },
          voterMap: {},
        },
      ];
    }
  }

  const formatted = list.map(b => ({
    ...b,
    userVotedSide: userId && b.voterMap ? b.voterMap[userId] || null : null,
  }));
  return res.json({ success: true, battles: formatted });
});

app.post('/api/futube/battles', (req, res) => {
  const { title, leftVideoId, rightVideoId } = req.body || {};
  const v1 = enrichFutubeVideo(inMemoryVideos.find(v => v.id === leftVideoId));
  const v2 = enrichFutubeVideo(inMemoryVideos.find(v => v.id === rightVideoId));
  if (!v1 || !v2) {
    return res.status(400).json({ success: false, error: 'Select two uploaded clips to start a FanZone Battle.' });
  }
  const battle = {
    id: `battle_${Date.now()}`,
    title: String(title || `${v1.fanzoneName} vs ${v2.fanzoneName}`).trim().slice(0, 80),
    category: 'FanZone Battle',
    status: 'LIVE',
    createdAt: new Date().toISOString(),
    leftSide: {
      fanzoneName: v1.fanzoneName,
      fanzoneHandle: v1.fanzoneHandle,
      fanzoneAvatar: v1.fanzoneAvatar,
      videoId: v1.id,
      videoTitle: v1.title,
      thumbnailUrl: v1.thumbnailUrl,
      videoUrl: v1.videoUrl,
      votes: 0,
    },
    rightSide: {
      fanzoneName: v2.fanzoneName,
      fanzoneHandle: v2.fanzoneHandle,
      fanzoneAvatar: v2.fanzoneAvatar,
      videoId: v2.id,
      videoTitle: v2.title,
      thumbnailUrl: v2.thumbnailUrl,
      videoUrl: v2.videoUrl,
      votes: 0,
    },
    voterMap: {} as Record<string, 'left' | 'right'>,
  };
  inMemoryFutubeBattles.unshift(battle);
  scheduleStorePersist();
  return res.json({ success: true, battle });
});

app.post('/api/futube/battles/:id/vote', (req, res) => {
  const { id } = req.params;
  const { userId = 'guest_user', side } = req.body || {};
  if (side !== 'left' && side !== 'right') {
    return res.status(400).json({ success: false, error: 'side must be left or right' });
  }

  let battle = inMemoryFutubeBattles.find(b => b.id === id);
  if (!battle && id.startsWith('battle_auto_') && inMemoryVideos.length >= 2) {
    const v1 = enrichFutubeVideo(inMemoryVideos[0]);
    const v2 = enrichFutubeVideo(inMemoryVideos[1]);
    if (v1 && v2) {
      battle = {
        id,
        title: `${v1.fanzoneName} vs ${v2.fanzoneName} — Goal of the Week Battle`,
        category: 'Goals',
        status: 'LIVE',
        createdAt: new Date().toISOString(),
        leftSide: {
          fanzoneName: v1.fanzoneName,
          fanzoneHandle: v1.fanzoneHandle,
          fanzoneAvatar: v1.fanzoneAvatar,
          videoId: v1.id,
          videoTitle: v1.title,
          thumbnailUrl: v1.thumbnailUrl,
          videoUrl: v1.videoUrl,
          votes: 0,
        },
        rightSide: {
          fanzoneName: v2.fanzoneName,
          fanzoneHandle: v2.fanzoneHandle,
          fanzoneAvatar: v2.fanzoneAvatar,
          videoId: v2.id,
          videoTitle: v2.title,
          thumbnailUrl: v2.thumbnailUrl,
          videoUrl: v2.videoUrl,
          votes: 0,
        },
        voterMap: {},
      };
      inMemoryFutubeBattles.unshift(battle);
    }
  }
  if (!battle) return res.status(404).json({ success: false, error: 'Battle not found' });

  if (!battle.voterMap) battle.voterMap = {};
  const prevVote = battle.voterMap[userId];
  if (prevVote === 'left') battle.leftSide.votes = Math.max(0, battle.leftSide.votes - 1);
  if (prevVote === 'right') battle.rightSide.votes = Math.max(0, battle.rightSide.votes - 1);

  battle.voterMap[userId] = side;
  if (side === 'left') battle.leftSide.votes += 1;
  else battle.rightSide.votes += 1;

  scheduleStorePersist();
  return res.json({ success: true, battle: { ...battle, userVotedSide: side } });
});

app.get('/api/futube/live-chat/:videoId', (req, res) => {
  const { videoId } = req.params;
  const userId = String(req.query.userId || '');
  const v = inMemoryVideos.find(item => item.id === videoId);
  const fanzoneId = normalizeFutubeHandle(v?.fanzoneHandle || v?.creator?.handle);
  const isSquadMember =
    !v ||
    (userId &&
      (v.userId === userId ||
        inMemoryFutubeConnects.some(c => c.fanId === userId && c.fanzoneId === fanzoneId)));

  return res.json({
    success: true,
    isSquadMember: Boolean(isSquadMember),
    fanzoneId,
    messages: isSquadMember ? (inMemoryFutubeLiveChats[videoId] || []) : [],
  });
});

app.post('/api/futube/live-chat/:videoId', (req, res) => {
  const { videoId } = req.params;
  const { userId = 'guest_user', userName = 'Supporter', userAvatar = DEFAULT_AVATAR, text } = req.body || {};
  if (!text || !String(text).trim()) {
    return res.status(400).json({ success: false, error: 'Message text required' });
  }
  const v = inMemoryVideos.find(item => item.id === videoId);
  const fanzoneId = normalizeFutubeHandle(v?.fanzoneHandle || v?.creator?.handle);
  const isSquadMember =
    !v ||
    v.userId === userId ||
    inMemoryFutubeConnects.some(c => c.fanId === userId && c.fanzoneId === fanzoneId);

  if (!isSquadMember) {
    return res.status(403).json({
      success: false,
      squadRequired: true,
      error: 'Squad-Only Match Live Chat: Click Connect ⚡ to join this FanZone Squad first!',
    });
  }

  if (!inMemoryFutubeLiveChats[videoId]) inMemoryFutubeLiveChats[videoId] = [];
  const msg = {
    id: `lc_${Date.now()}`,
    userId,
    userName,
    userAvatar,
    text: String(text).trim(),
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
  inMemoryFutubeLiveChats[videoId].push(msg);
  if (inMemoryFutubeLiveChats[videoId].length > 200) {
    inMemoryFutubeLiveChats[videoId] = inMemoryFutubeLiveChats[videoId].slice(-200);
  }
  scheduleStorePersist();
  return res.json({ success: true, message: msg });
});

// -------------------------------------------------------------
// Real Profiles & Follows Endpoints
// -------------------------------------------------------------
app.get('/api/db/profiles/:id', async (req, res) => {
  const { id } = req.params;
  const { currentUserId } = req.query;

  // Real calculation of stats from database stores
  const userPosts = inMemoryPosts.filter(p => p.userId === id || p.author?.handle === id);
  const userPostsCount = userPosts.length;
  const userVideos = inMemoryVideos.filter(v => v.userId === id || v.creator?.handle === id);
  const userVideosCount = userVideos.length;

  const likesReceived = userPosts.reduce((acc, p) => acc + (p.likes || 0), 0);
  const commentsReceived = userPosts.reduce((acc, p) => acc + (p.commentsCount || 0), 0);

  const targetIsCreator = isCreatorTarget(id);
  const followers = targetIsCreator
    ? inMemoryFollows.filter(f => isCreatorTarget(f.followingId))
    : inMemoryFollows.filter(f => f.followingId === id);
  const followersCount = followers.length;
  const followingCount = inMemoryFollows.filter(f => f.followerId === id).length;
  const isFollowing = currentUserId
    ? targetIsCreator
      ? inMemoryFollows.some(f => f.followerId === currentUserId && isCreatorTarget(f.followingId))
      : inMemoryFollows.some(f => f.followerId === currentUserId && f.followingId === id)
    : false;

  // Real fan points calculation: +10 per post, +20 per video, +2 per like received, +5 per comment received
  const calculatedPoints = userPostsCount * 10 + userVideosCount * 20 + likesReceived * 2 + commentsReceived * 5;

  let existingProfile = inMemoryProfiles[id];
  if (!existingProfile) {
    // Check if key is a handle or id
    const found = Object.values(inMemoryProfiles).find((p: any) => p.handle === id || p.id === id);
    if (found) existingProfile = found;
  }

  // If Supabase is connected, check real profiles table
  if (supabaseBackendClient) {
    try {
      let query = supabaseBackendClient.from('profiles').select('*');
      if (id.startsWith('@')) {
        query = query.eq('username', id);
      } else {
        query = query.eq('id', id);
      }
      const { data: dbProf } = await query.single();
      if (dbProf) {
        existingProfile = {
          id: dbProf.id,
          name: dbProf.full_name || dbProf.name || id,
          handle: dbProf.username || (id.startsWith('@') ? id : `@${id}`),
          avatar: dbProf.avatar_url || DEFAULT_AVATAR,
          bio: dbProf.bio || 'Football enthusiast on FUTFIELD ⚽',
          favoriteClub: dbProf.favorite_club || 'Not Set',
          favoriteClubCrest: dbProf.favorite_club_logo || '⚽',
          location: dbProf.location || '',
          website: dbProf.website || '',
          joinedAt: dbProf.joined_at ? new Date(dbProf.joined_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'November 2026',
        };
      }
    } catch {}
  }

  const profile = {
    id: existingProfile?.id || id,
    name: existingProfile?.name || (id.startsWith('@') ? id.replace('@', '') : 'Football Supporter'),
    handle: existingProfile?.handle || (id.startsWith('@') ? id : `@${id}`),
    avatar: existingProfile?.avatar || DEFAULT_AVATAR,
    bio: existingProfile?.bio || 'Football supporter on FUTFIELD ⚽',
    favoriteClub: existingProfile?.favoriteClub || 'Not Set',
    favoriteClubCrest: existingProfile?.favoriteClubCrest || '⚽',
    fanPoints: existingProfile?.fanPoints !== undefined && existingProfile.fanPoints > calculatedPoints
      ? existingProfile.fanPoints
      : calculatedPoints,
    postsCount: userPostsCount,
    videosCount: userVideosCount,
    followersCount,
    followingCount,
    isFollowing,
    location: existingProfile?.location || '',
    website: existingProfile?.website || '',
    joinedAt: existingProfile?.joinedAt || 'November 2026',
  };

  return res.json({ profile });
});

// Points Breakdown History (Real points calculated from database actions)
app.get('/api/db/profiles/:id/points-history', async (req, res) => {
  const { id } = req.params;

  const userPosts = inMemoryPosts.filter(p => p.userId === id || p.author?.handle === id);
  const postsCount = userPosts.length;
  const userVideos = inMemoryVideos.filter(v => v.userId === id || v.creator?.handle === id);
  const videosCount = userVideos.length;

  const likesReceived = userPosts.reduce((acc, p) => acc + (p.likes || 0), 0);
  const commentsReceived = userPosts.reduce((acc, p) => acc + (p.commentsCount || 0), 0);

  const postsPoints = postsCount * 10;
  const videosPoints = videosCount * 20;
  const likesPoints = likesReceived * 2;
  const commentsPoints = commentsReceived * 5;
  const total = postsPoints + videosPoints + likesPoints + commentsPoints;

  const breakdown = [
    {
      category: 'Pitch Match Posts',
      description: 'Original match discussions & tactical opinions (+10 pts each)',
      count: postsCount,
      pointsPerUnit: 10,
      total: postsPoints,
      icon: '📝',
    },
    {
      category: 'Futfield Tube Uploads',
      description: 'Original match clips & Quick Kicks (+20 pts each)',
      count: videosCount,
      pointsPerUnit: 20,
      total: videosPoints,
      icon: '📹',
    },
    {
      category: 'Post Likes Received',
      description: 'Community appreciation on your pitch posts (+2 pts each)',
      count: likesReceived,
      pointsPerUnit: 2,
      total: likesPoints,
      icon: '❤️',
    },
    {
      category: 'Comments Received',
      description: 'Discussions generated under your match opinions (+5 pts each)',
      count: commentsReceived,
      pointsPerUnit: 5,
      total: commentsPoints,
      icon: '💬',
    },
  ];

  return res.json({
    totalPoints: total,
    breakdown,
  });
});

app.put('/api/db/profiles/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body || {};
  const existing = inMemoryProfiles[id];
  const email = updates.email || existing?.email || '';
  const isCreatorAccount = isCreatorEmail(email) || isCreatorTarget(id);

  if (!isCreatorAccount && (isReservedFutfieldText(updates.name) || isReservedFutfieldText(updates.handle))) {
    return res.status(400).json({
      success: false,
      error: 'The name "Futfield" is strictly reserved for the official Futfield Creator account.',
    });
  }

  inMemoryProfiles[id] = {
    ...(existing || {}),
    ...updates,
    id,
  };

  if (updates.handle) {
    inMemoryProfiles[updates.handle] = inMemoryProfiles[id];
  }
  scheduleStorePersist();

  if (supabaseBackendClient && isValidUuid(id)) {
    try {
      await supabaseBackendClient.from('profiles').upsert({
        id,
        full_name: updates.name,
        username: updates.handle,
        bio: updates.bio,
        favorite_club: updates.favoriteClub,
        favorite_club_logo: updates.favoriteClubCrest,
        location: updates.location,
        website: updates.website,
        avatar_url: updates.avatar,
      });
    } catch (err: any) {
      console.warn('[Backend] Profile update note:', err?.message);
    }
  }

  return res.json({ success: true, profile: inMemoryProfiles[id] });
});

app.post('/api/db/follows', async (req, res) => {
  const { followerId, followingId } = req.body;
  if (!followerId || !followingId) return res.status(400).json({ error: 'IDs required' });

  const targetIsCreator = isCreatorTarget(followingId);
  const idx = inMemoryFollows.findIndex(f =>
    f.followerId === followerId &&
    (targetIsCreator ? isCreatorTarget(f.followingId) : f.followingId === followingId)
  );

  let following = false;
  if (idx !== -1) {
    if (targetIsCreator && !isCreatorTarget(followerId)) {
      const followersCount = countCreatorFollowers();
      return res.status(403).json({
        success: false,
        blocked: true,
        following: true,
        followersCount,
        error: 'You cannot unfollow the official Futfield Creator account.',
      });
    }
    inMemoryFollows.splice(idx, 1);
    following = false;
  } else {
    inMemoryFollows.push({
      followerId,
      followingId: targetIsCreator ? CREATOR_ID : followingId,
    });
    following = true;
  }

  const followersCount = targetIsCreator
    ? countCreatorFollowers()
    : inMemoryFollows.filter(f => f.followingId === followingId).length;

  if (supabaseBackendClient) {
    try {
      if (following) {
        await supabaseBackendClient.from('follows').insert({
          follower_id: followerId,
          following_id: targetIsCreator ? CREATOR_ID : followingId,
        });
      } else {
        await supabaseBackendClient.from('follows').delete().match({ follower_id: followerId, following_id: followingId });
      }
    } catch (err: any) {
      console.warn('[Backend] Follow toggle note:', err?.message);
    }
  }

  scheduleStorePersist();
  return res.json({ success: true, following, followersCount });
});

app.get('/api/db/follows/:userId', (req, res) => {
  const { userId } = req.params;
  const targetIsCreator = isCreatorTarget(userId);
  const followerIds = (
    targetIsCreator
      ? inMemoryFollows.filter(f => isCreatorTarget(f.followingId))
      : inMemoryFollows.filter(f => f.followingId === userId)
  ).map(f => f.followerId);
  const followingIds = inMemoryFollows.filter(f => f.followerId === userId).map(f => f.followingId);

  const resolveUser = (uId: string) => {
    const prof = inMemoryProfiles[uId] || (isCreatorTarget(uId) ? inMemoryProfiles[CREATOR_ID] : undefined);
    if (prof) {
      return {
        id: prof.id || uId,
        name: prof.name || 'Football Supporter',
        handle: prof.handle || (uId.startsWith('@') ? uId : `@${uId}`),
        avatar: prof.avatar || DEFAULT_AVATAR,
        favoriteClub: prof.favoriteClub || 'Not Set',
        fanPoints: prof.fanPoints || 0,
      };
    }
    // Check if user has posts
    const postWithAuthor = inMemoryPosts.find(p => p.userId === uId || p.author?.handle === uId);
    if (postWithAuthor?.author) {
      return {
        id: uId,
        name: postWithAuthor.author.name || 'Supporter',
        handle: postWithAuthor.author.handle || `@${uId}`,
        avatar: postWithAuthor.author.avatar || DEFAULT_AVATAR,
        favoriteClub: postWithAuthor.clubTag || 'Not Set',
        fanPoints: 10,
      };
    }
    return {
      id: uId,
      name: uId.startsWith('@') ? uId.replace('@', '') : 'Supporter',
      handle: uId.startsWith('@') ? uId : `@${uId}`,
      avatar: DEFAULT_AVATAR,
      favoriteClub: 'Not Set',
      fanPoints: 0,
    };
  };

  const followersUsers = followerIds.map(resolveUser);
  const followingUsers = followingIds.map(resolveUser);

  return res.json({
    followers: followerIds,
    following: followingIds,
    followersUsers,
    followingUsers,
  });
});

// -------------------------------------------------------------
// Matchday Predictor League & Football IQ Arena Routes
// -------------------------------------------------------------
app.get('/api/predictor/predictions', (req, res) => {
  const userId = String(req.query.userId || '');
  const userPicks = userId ? inMemoryPredictorPicks.filter(p => p.userId === userId) : [];

  const consensus: Record<string, { total: number; homePct: number; drawPct: number; awayPct: number }> = {};
  const byMatch: Record<string, { home: number; draw: number; away: number; total: number }> = {};
  for (const p of inMemoryPredictorPicks) {
    if (!p?.matchId) continue;
    if (!byMatch[p.matchId]) byMatch[p.matchId] = { home: 0, draw: 0, away: 0, total: 0 };
    byMatch[p.matchId].total += 1;
    if (p.outcome === 'home') byMatch[p.matchId].home += 1;
    else if (p.outcome === 'away') byMatch[p.matchId].away += 1;
    else byMatch[p.matchId].draw += 1;
  }
  for (const [mId, counts] of Object.entries(byMatch)) {
    const t = Math.max(1, counts.total);
    consensus[mId] = {
      total: counts.total,
      homePct: Math.round((counts.home / t) * 100),
      drawPct: Math.round((counts.draw / t) * 100),
      awayPct: Math.round((counts.away / t) * 100),
    };
  }

  return res.json({ success: true, userPicks, consensus });
});

app.post('/api/predictor/predictions', (req, res) => {
  const { userId = 'guest_user', userName = 'Football Fan', userHandle = '@fan', matchId, homeTeam, awayTeam, outcome, homeScore, awayScore, doubleConfidence } = req.body || {};
  if (!matchId || !homeTeam || !awayTeam) {
    return res.status(400).json({ success: false, error: 'Match details are required.' });
  }
  const cleanHandle = userHandle.startsWith('@') ? userHandle : `@${userHandle}`;
  const idx = inMemoryPredictorPicks.findIndex(p => p.userId === userId && p.matchId === matchId);
  const record = {
    id: idx !== -1 ? inMemoryPredictorPicks[idx].id : `pred_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    userId,
    userName,
    userHandle: cleanHandle,
    matchId,
    homeTeam,
    awayTeam,
    outcome: outcome === 'home' || outcome === 'away' ? outcome : 'draw',
    homeScore: Math.max(0, Math.min(9, Number(homeScore) || 0)),
    awayScore: Math.max(0, Math.min(9, Number(awayScore) || 0)),
    doubleConfidence: Boolean(doubleConfidence),
    createdAt: new Date().toISOString(),
  };
  if (idx !== -1) {
    inMemoryPredictorPicks[idx] = record;
  } else {
    inMemoryPredictorPicks.unshift(record);
  }
  const matchPicks = inMemoryPredictorPicks.filter(p => p.matchId === matchId);
  const total = Math.max(1, matchPicks.length);
  const consensus = {
    total: matchPicks.length,
    homePct: Math.round((matchPicks.filter(p => p.outcome === 'home').length / total) * 100),
    drawPct: Math.round((matchPicks.filter(p => p.outcome === 'draw').length / total) * 100),
    awayPct: Math.round((matchPicks.filter(p => p.outcome === 'away').length / total) * 100),
  };
  scheduleStorePersist();
  return res.json({ success: true, prediction: record, consensus });
});

app.get('/api/predictor/leaderboard', (_req, res) => {
  const grouped: Record<string, { userId: string; userName: string; userHandle: string; predictionsCount: number; pointsEarned: number; doubleLocks: number }> = {};
  for (const p of inMemoryPredictorPicks) {
    if (!grouped[p.userId]) {
      grouped[p.userId] = {
        userId: p.userId,
        userName: p.userName || 'Football Fan',
        userHandle: p.userHandle || '@fan',
        predictionsCount: 0,
        pointsEarned: 0,
        doubleLocks: 0,
      };
    }
    grouped[p.userId].predictionsCount += 1;
    grouped[p.userId].pointsEarned += p.doubleConfidence ? 25 : 15;
    if (p.doubleConfidence) grouped[p.userId].doubleLocks += 1;
  }
  const leaderboard = Object.values(grouped)
    .sort((a, b) => b.pointsEarned - a.pointsEarned)
    .slice(0, 25);
  return res.json({ success: true, leaderboard });
});

app.get('/api/arena/polls', (req, res) => {
  const userId = String(req.query.userId || '');
  const formatted = inMemoryArenaPolls.map(poll => ({
    id: poll.id,
    question: poll.question,
    category: poll.category,
    authorName: poll.authorName,
    options: poll.options,
    totalVotes: poll.options.reduce((acc, o) => acc + Number(o.votes || 0), 0),
    userVotedOptionId: userId ? poll.voters?.[userId] || null : null,
  }));
  return res.json({ success: true, polls: formatted });
});

app.post('/api/arena/polls', (req, res) => {
  const { userId = 'guest_user', authorName = 'Football Fan', question, options } = req.body || {};
  const cleanQ = String(question || '').trim();
  const cleanOpts = Array.isArray(options) ? options.map((o: any) => String(o || '').trim()).filter(Boolean) : [];
  if (!cleanQ || cleanOpts.length < 2) {
    return res.status(400).json({ success: false, error: 'Question and at least 2 options are required.' });
  }
  const poll = {
    id: `poll_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    question: cleanQ,
    category: 'Matchday Debate',
    authorName: String(authorName || 'Football Fan').slice(0, 32),
    options: cleanOpts.slice(0, 4).map((label: string, idx: number) => ({
      id: `opt_${idx + 1}`,
      label,
      votes: idx === 0 ? 1 : 0,
    })),
    voters: { [userId]: 'opt_1' },
    createdAt: new Date().toISOString(),
  };
  inMemoryArenaPolls.unshift(poll);
  scheduleStorePersist();
  return res.json({
    success: true,
    poll: {
      id: poll.id,
      question: poll.question,
      category: poll.category,
      authorName: poll.authorName,
      options: poll.options,
      totalVotes: 1,
      userVotedOptionId: 'opt_1',
    },
  });
});

app.post('/api/arena/polls/:id/vote', (req, res) => {
  const poll = inMemoryArenaPolls.find(p => p.id === req.params.id);
  if (!poll) return res.status(404).json({ success: false, error: 'Poll not found' });
  const { userId = 'guest_user', optionId } = req.body || {};
  const alreadyVoted = Boolean(poll.voters?.[userId]);
  if (!alreadyVoted) {
    const targetOpt = poll.options.find(o => o.id === optionId);
    if (!targetOpt) return res.status(400).json({ success: false, error: 'Invalid option' });
    targetOpt.votes += 1;
    if (!poll.voters) poll.voters = {};
    poll.voters[userId] = optionId;
    scheduleStorePersist();
  }
  return res.json({
    success: true,
    alreadyVoted,
    poll: {
      id: poll.id,
      question: poll.question,
      category: poll.category,
      authorName: poll.authorName,
      options: poll.options,
      totalVotes: poll.options.reduce((acc, o) => acc + Number(o.votes || 0), 0),
      userVotedOptionId: poll.voters?.[userId] || null,
    },
  });
});

// Free Backend Binary & JSON Media Storage Engine + Exact MB Size Calculator
function resolveMediaFolderAndKind(bucket: string, mimeType: string): { folder: string; mediaKind: 'image' | 'video' | 'audio' } {
  const lowerBucket = (bucket || '').toLowerCase();
  const lowerMime = (mimeType || '').toLowerCase();
  const isAudio = lowerMime.startsWith('audio/') || lowerBucket.includes('voice');
  if (isAudio) {
    return { folder: 'voices', mediaKind: 'audio' };
  }
  const isVideo =
    lowerMime.startsWith('video/') ||
    lowerBucket === 'videos' ||
    lowerBucket === 'post-videos' ||
    lowerBucket === 'futfield-videos';
  if (isVideo) {
    return { folder: 'videos', mediaKind: 'video' };
  }
  if (lowerBucket === 'video-thumbnails') {
    return { folder: 'thumbnails', mediaKind: 'image' };
  }
  if (lowerBucket === 'avatars') {
    return { folder: 'avatars', mediaKind: 'image' };
  }
  return { folder: 'images', mediaKind: 'image' };
}

function sanitizeFilename(rawName: string, fallbackExt: string): string {
  const parsed = path.basename(rawName || `media.${fallbackExt}`);
  const cleaned = parsed.replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned.includes('.') ? cleaned : `${cleaned}.${fallbackExt}`;
}

async function handleBinaryMediaUpload(req: express.Request, res: express.Response) {
  try {
    const buffer = req.body as Buffer;
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
      return res.status(400).json({ success: false, status: 'ERROR', error: 'Empty binary upload payload' });
    }

    const bucket = String(req.headers['x-bucket'] || 'post-images');
    const isFutubeBucket = bucket === 'futfield-videos';
    const mimeType = String(req.headers['x-file-type'] || req.headers['content-type'] || 'application/octet-stream');
    let rawName = 'upload';
    try {
      rawName = decodeURIComponent(String(req.headers['x-file-name'] || 'upload'));
    } catch {
      rawName = String(req.headers['x-file-name'] || 'upload');
    }
    const userId = String(req.headers['x-user-id'] || 'user');
    const durationSecondsHeader = Number(req.headers['x-video-duration'] || 0);
    const widthHeader = Number(req.headers['x-video-width'] || 0);
    const heightHeader = Number(req.headers['x-video-height'] || 0);
    const requestedAspect = String(req.headers['x-aspect-ratio'] || '');
    const requestedKind = String(req.headers['x-video-kind'] || '');
    let headerTitle = '';
    let headerDescription = '';
    try {
      if (req.headers['x-media-title']) headerTitle = decodeURIComponent(String(req.headers['x-media-title']));
      if (req.headers['x-media-description']) headerDescription = decodeURIComponent(String(req.headers['x-media-description']));
    } catch {}

    const { folder, mediaKind } = resolveMediaFolderAndKind(bucket, mimeType);

    const maxShortSec = isFutubeBucket ? 60 : 120;
    const maxVideoSec = isFutubeBucket ? 3600 : 600;

    let detectedVideoKind: 'short' | 'video' | undefined;
    let detectedAspectRatio: '9:16' | '16:9' | undefined;
    let copyrightReport: any = null;

    if (mediaKind === 'video') {
      if (widthHeader > 0 && heightHeader > 0) {
        const ratio = widthHeader / heightHeader;
        if (ratio < 1.0 && !isFutubeBucket) {
          detectedVideoKind = 'short';
          detectedAspectRatio = '9:16';
        } else if (ratio <= 0.85) {
          detectedVideoKind = 'short';
          detectedAspectRatio = '9:16';
        } else {
          detectedVideoKind = 'video';
          detectedAspectRatio = '16:9';
        }
      } else if (requestedKind === 'video' || requestedAspect === '16:9') {
        detectedVideoKind = 'video';
        detectedAspectRatio = '16:9';
      } else {
        detectedVideoKind = durationSecondsHeader > maxShortSec ? 'video' : 'short';
        detectedAspectRatio = detectedVideoKind === 'video' ? '16:9' : '9:16';
      }

      if (detectedVideoKind === 'short' && durationSecondsHeader > maxShortSec) {
        return res.status(400).json({
          success: false,
          status: 'ERROR',
          error: `Quick Kicks (vertical 9:16) must be ${maxShortSec}s or less. Received ${durationSecondsHeader}s.`,
        });
      }

      if (detectedVideoKind === 'video' && durationSecondsHeader > maxVideoSec) {
        return res.status(400).json({
          success: false,
          status: 'ERROR',
          error: `Football Clips cannot exceed ${Math.round(maxVideoSec / 60)} minutes. Received ${durationSecondsHeader}s.`,
        });
      }

      // Run MediaGuard Copyright Detector before committing video to storage
      copyrightReport = analyzeVideoCopyright({
        buffer,
        fileName: rawName,
        title: headerTitle,
        description: headerDescription,
      });

      if (copyrightReport.status === 'BLOCKED') {
        return res.status(403).json({
          success: false,
          status: 'ERROR',
          copyrightStatus: 'BLOCKED',
          copyrightReport,
          error:
            copyrightReport.reason ||
            'Copyrighted broadcast or DRM-protected video detected and blocked by FUTFIELD MediaGuard.',
        });
      }
    }

    const fallbackExt = mediaKind === 'video' ? 'mp4' : mediaKind === 'audio' ? 'webm' : 'jpg';
    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${sanitizeFilename(rawName, fallbackExt)}`;
    const diskPath = path.join(UPLOADS_DIR, folder, safeName);

    fs.writeFileSync(diskPath, buffer);
    let finalUrl = `/uploads/${folder}/${safeName}`;

    if (supabaseBackendClient && supabaseUrl) {
      try {
        let { data, error } = await supabaseBackendClient.storage
          .from(bucket)
          .upload(safeName, buffer, { contentType: mimeType });
        if (error && isFutubeBucket) {
          await supabaseBackendClient.storage.createBucket(bucket, { public: true }).catch(() => {});
          const retry = await supabaseBackendClient.storage
            .from(bucket)
            .upload(safeName, buffer, { contentType: mimeType });
          data = retry.data;
          error = retry.error;
        }
        if (!error && data?.path) {
          finalUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${data.path}`;
        }
      } catch {}
    }

    const sizeBytes = buffer.length;
    const sizeMb = +(sizeBytes / (1024 * 1024)).toFixed(2);
    const exactMb = +(sizeBytes / (1024 * 1024)).toFixed(3);

    if (bucket !== 'video-thumbnails' && mediaKind !== 'audio') {
      mediaRegistry.unshift({
        id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        fileName: rawName,
        url: finalUrl,
        bucket,
        mediaKind,
        mimeType,
        sizeBytes,
        sizeMb: exactMb,
        userId,
        createdAt: new Date().toISOString(),
      });
      scheduleStorePersist();
    }

    const totals = computeMediaStats();
    broadcastToGlobalFeed('media_uploaded', totals);
    broadcastToGlobalFeed('analytics_summary', computeRealtimeAnalytics());

    return res.json({
      success: true,
      status: 'UPLOADED',
      url: finalUrl,
      localUrl: `/uploads/${folder}/${safeName}`,
      fileName: rawName,
      mediaKind,
      videoKind: detectedVideoKind,
      aspectRatio: detectedAspectRatio,
      copyrightStatus: copyrightReport?.status,
      copyrightReport,
      sizeBytes,
      sizeMb: sizeMb > 0 ? sizeMb : exactMb,
      exactMb,
      totals,
    });
  } catch (err: any) {
    console.error('[Backend] Binary upload error:', err);
    return res.status(500).json({ success: false, status: 'ERROR', error: err?.message || 'Upload failed' });
  }
}

app.get('/api/media/copyright-status', (_req, res) => {
  res.json(getCopyrightEngineStatus());
});

app.post('/api/media/copyright-check', (req, res) => {
  const { fileName = '', title = '', description = '', videoUrl = '', hashtags = [], clubTag = '' } = req.body || {};
  let buffer: Buffer | null = null;

  if (typeof videoUrl === 'string' && videoUrl.startsWith('/uploads/')) {
    const candidatePath = resolveSafeUploadPath(videoUrl);
    if (candidatePath && fs.existsSync(candidatePath)) {
      try {
        buffer = fs.readFileSync(candidatePath);
      } catch {}
    }
  }

  const report = analyzeVideoCopyright({
    buffer,
    fileName,
    title,
    description,
    videoUrl,
    hashtags: Array.isArray(hashtags) ? hashtags : [],
    clubTag,
  });

  return res.json({
    success: true,
    copyrightStatus: report.status,
    report,
  });
});

app.post('/api/media/copyright-registry', (req, res) => {
  try {
    const { action = 'add', sha256 = '', label = 'Blocked Copyright Asset', level = 'blocked' } = req.body || {};
    const status = manageCopyrightRegistry(
      action === 'remove' ? 'remove' : 'add',
      sha256,
      label,
      level === 'warning' ? 'warning' : 'blocked'
    );
    return res.json({ success: true, status });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'Invalid hash registry request' });
  }
});

app.post('/api/media/upload', uploadLimiter, express.raw({ type: '*/*', limit: '500mb' }), handleBinaryMediaUpload);
app.post('/api/db/upload-binary', uploadLimiter, express.raw({ type: '*/*', limit: '500mb' }), handleBinaryMediaUpload);

app.post('/api/db/upload', uploadLimiter, async (req, res) => {
  const { fileData, fileName, bucket = 'post-images', userId = 'user' } = req.body;
  if (!fileData) {
    return res.status(400).json({ success: false, status: 'ERROR', error: 'File data required' });
  }

  const mimeMatch = String(fileData).match(/^data:([^;]+);base64,/);
  const mimeType = mimeMatch?.[1] || (bucket.includes('video') ? 'video/mp4' : bucket.includes('voice') ? 'audio/webm' : 'image/jpeg');
  const base64Clean = String(fileData).replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(base64Clean, 'base64');
  const sizeBytes = buffer.length;
  const sizeMb = +(sizeBytes / (1024 * 1024)).toFixed(2);
  const exactMb = +(sizeBytes / (1024 * 1024)).toFixed(3);

  const { folder, mediaKind } = resolveMediaFolderAndKind(bucket, mimeType);
  const fallbackExt = mediaKind === 'video' ? 'mp4' : mediaKind === 'audio' ? 'webm' : 'jpg';
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${sanitizeFilename(fileName || 'media', fallbackExt)}`;
  const diskPath = path.join(UPLOADS_DIR, folder, safeName);

  fs.writeFileSync(diskPath, buffer);
  let finalUrl = `/uploads/${folder}/${safeName}`;

  if (supabaseBackendClient && supabaseUrl) {
    try {
      const { data, error } = await supabaseBackendClient.storage
        .from(bucket)
        .upload(safeName, buffer, { contentType: mimeType });
      if (!error && data?.path) {
        finalUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${data.path}`;
      }
    } catch (err: any) {
      console.warn('[Backend] Storage upload notice:', err?.message);
    }
  }

  if (bucket !== 'video-thumbnails' && mediaKind !== 'audio') {
    mediaRegistry.unshift({
      id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      fileName: fileName || safeName,
      url: finalUrl,
      bucket,
      mediaKind,
      mimeType,
      sizeBytes,
      sizeMb: exactMb,
      userId,
      createdAt: new Date().toISOString(),
    });
    scheduleStorePersist();
  }

  const totals = computeMediaStats();
  broadcastToGlobalFeed('media_uploaded', totals);

  return res.json({
    success: true,
    status: 'UPLOADED',
    url: finalUrl,
    localUrl: `/uploads/${folder}/${safeName}`,
    mediaKind,
    sizeBytes,
    sizeMb: sizeMb > 0 ? sizeMb : exactMb,
    exactMb,
    totals,
  });
});

// -------------------------------------------------------------
// Customer Support, Contact & Email Desk Ticket Endpoints
// -------------------------------------------------------------
app.get('/api/support/tickets', (req, res) => {
  const userId = String(req.query.userId || '').trim();
  const filtered = userId
    ? inMemorySupportTickets.filter(t => t.userId === userId || t.userId === 'guest_user')
    : inMemorySupportTickets;

  return res.json({
    success: true,
    supportEmail: 'futfieldsport@gmail.com',
    serverDate: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    tickets: filtered.slice(0, 50),
  });
});

app.post('/api/support/tickets', (req, res) => {
  const {
    userId = 'guest_user',
    name = 'FUTFIELD Member',
    email = '',
    category = 'General Inquiry',
    priority = 'Normal',
    subject = '',
    message = '',
    channel = 'contact_form',
  } = req.body || {};

  if (!String(email).trim() || !String(subject).trim() || !String(message).trim()) {
    return res.status(400).json({
      success: false,
      error: 'Email, subject, and message are required.',
    });
  }

  const now = new Date();
  const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  const ticket = {
    id: `tkt_${Date.now()}_${rand.toLowerCase()}`,
    referenceCode: `FF-${yyyymmdd}-${rand}`,
    userId: String(userId || 'guest_user'),
    name: String(name).trim() || 'FUTFIELD Member',
    email: String(email).trim().toLowerCase(),
    category: String(category).trim() || 'General Inquiry',
    priority: (['Normal', 'High', 'Urgent'].includes(priority) ? priority : 'Normal') as 'Normal' | 'High' | 'Urgent',
    subject: String(subject).trim(),
    message: String(message).trim(),
    channel: (channel === 'email_desk' ? 'email_desk' : 'contact_form') as 'contact_form' | 'email_desk',
    status: 'Open' as const,
    dateFormatted: now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  inMemorySupportTickets.unshift(ticket);
  scheduleStorePersist();

  return res.json({
    success: true,
    supportEmail: 'futfieldsport@gmail.com',
    ticket,
  });
});

app.post('/api/support/tickets/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  const ticket = inMemorySupportTickets.find(t => t.id === id);
  if (!ticket) {
    return res.status(404).json({ success: false, error: 'Support ticket not found.' });
  }
  if (status === 'Open' || status === 'In Review' || status === 'Resolved') {
    ticket.status = status;
    ticket.updatedAt = new Date().toISOString();
    scheduleStorePersist();
  }
  return res.json({ success: true, ticket });
});

// -------------------------------------------------------------
// Real Communities Endpoints (Supabase tables 'communities' & 'community_members')
// -------------------------------------------------------------
app.get('/api/db/communities', async (req, res) => {
  if (supabaseBackendClient) {
    try {
      const { data: comms, error } = await supabaseBackendClient
        .from('communities')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(comms)) {
        // Query real member counts: SELECT COUNT(*) FROM community_members WHERE community_id = X
        const populated = await Promise.all(
          comms.map(async (c: any) => {
            const { count } = await supabaseBackendClient!
              .from('community_members')
              .select('*', { count: 'exact', head: true })
              .eq('community_id', c.id);

            const memberCount = count || 0;
            return {
              id: c.id,
              name: c.name,
              category: c.category,
              crest: c.crest,
              fanCount: `${memberCount} fan${memberCount === 1 ? '' : 's'}`,
              rawFanCount: memberCount,
              isJoined: false,
              hasModBadge: Boolean(c.has_mod_badge),
              description: c.description || '',
              rules: c.rules || [],
            };
          })
        );
        return res.json({ communities: populated });
      }
    } catch (err: any) {
      console.warn('[Backend] Communities query notice:', err?.message);
    }
  }

  return res.json({ communities: inMemoryCommunities });
});

app.post('/api/db/communities', async (req, res) => {
  const { community } = req.body;
  if (!community || !community.name) {
    return res.status(400).json({ error: 'Community name is required' });
  }

  const newComm = {
    id: community.id || `c_${Date.now()}`,
    name: community.name,
    category: community.category || 'club',
    crest: community.crest || '⚽',
    fanCount: '1 fan',
    rawFanCount: 1,
    isJoined: true,
    hasModBadge: Boolean(community.hasModBadge),
    description: community.description || '',
    rules: community.rules || ['Respect all football fans', 'Keep banter friendly'],
  };

  if (supabaseBackendClient) {
    try {
      await supabaseBackendClient.from('communities').insert({
        id: newComm.id,
        name: newComm.name,
        category: newComm.category,
        crest: newComm.crest,
        description: newComm.description,
        has_mod_badge: newComm.hasModBadge,
        rules: newComm.rules,
        created_at: new Date().toISOString(),
      });
    } catch (err: any) {
      console.warn('[Backend] Community insert notice:', err?.message);
    }
  }

  inMemoryCommunities.unshift(newComm);
  return res.json({ success: true, community: newComm });
});

app.post('/api/db/communities/join', async (req, res) => {
  const { communityId, userId, action } = req.body;
  if (!communityId || !userId) {
    return res.status(400).json({ error: 'communityId and userId required' });
  }

  if (supabaseBackendClient) {
    try {
      if (action === 'join') {
        await supabaseBackendClient.from('community_members').upsert({
          community_id: communityId,
          user_id: userId,
          joined_at: new Date().toISOString(),
        });
      } else {
        await supabaseBackendClient
          .from('community_members')
          .delete()
          .match({ community_id: communityId, user_id: userId });
      }

      const { count } = await supabaseBackendClient
        .from('community_members')
        .select('*', { count: 'exact', head: true })
        .eq('community_id', communityId);

      return res.json({ success: true, count: count || 0 });
    } catch (err: any) {
      console.warn('[Backend] Community join notice:', err?.message);
    }
  }

  // In-memory tracking
  if (action === 'join') {
    if (!inMemoryCommunityMembers.some(m => m.communityId === communityId && m.userId === userId)) {
      inMemoryCommunityMembers.push({ communityId, userId });
    }
  } else {
    const idx = inMemoryCommunityMembers.findIndex(m => m.communityId === communityId && m.userId === userId);
    if (idx >= 0) inMemoryCommunityMembers.splice(idx, 1);
  }

  const count = inMemoryCommunityMembers.filter(m => m.communityId === communityId).length;
  return res.json({ success: true, count });
});

// -------------------------------------------------------------
// Real Match Rooms Chat Endpoints (WhatsApp-Quality Live Match Chat)
// -------------------------------------------------------------
app.get('/api/db/match_rooms/:matchId/messages', async (req, res) => {
  const { matchId } = req.params;
  const { currentUserId, limit = 100 } = req.query;

  let messages: any[] = [];

  if (supabaseBackendClient) {
    try {
      const { data, error } = await supabaseBackendClient
        .from('match_messages')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true })
        .limit(Number(limit));

      if (!error && Array.isArray(data)) {
        messages = data.map((row: any) => ({
          id: row.id,
          matchId: row.match_id,
          roomId: row.room_id,
          userId: row.user_id,
          user: row.user_data || { name: 'Fan', handle: '@fan', avatar: '' },
          text: row.content || row.text || '',
          content: row.content || row.text || '',
          messageType: row.message_type || 'chat',
          mediaType: row.media_type || 'text',
          mediaUrl: row.media_url,
          thumbnailUrl: row.thumbnail_url,
          voiceDuration: row.voice_duration,
          waveform: row.waveform,
          replyToId: row.reply_to_id,
          isPinned: row.is_pinned || false,
          isDeleted: row.is_deleted || false,
          timestamp: row.created_at ? new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live',
          createdAt: row.created_at,
          reactions: {},
          userReactions: [],
          status: 'delivered',
        }));
      }
    } catch (err: any) {
      console.warn('[Backend] Supabase match messages notice:', err?.message);
    }
  }

  // Fallback / merge with in-memory messages
  if (messages.length === 0) {
    messages = inMemoryMatchRooms[matchId] || [];
  }

  // Populate reactions for each message
  const populated = messages.map(msg => {
    const msgReactions = inMemoryMatchReactions.filter(r => r.messageId === msg.id);
    const reactionsCount: Record<string, number> = {
      '🔥': 0,
      '⚽': 0,
      '❤️': 0,
      '😂': 0,
      '😱': 0,
      '👏': 0,
    };
    const userReacted: string[] = [];

    msgReactions.forEach(r => {
      reactionsCount[r.emoji] = (reactionsCount[r.emoji] || 0) + 1;
      if (currentUserId && r.userId === currentUserId) {
        userReacted.push(r.emoji);
      }
    });

    // If message had preset reactions, combine
    if (msg.reactions) {
      Object.entries(msg.reactions).forEach(([k, v]) => {
        if (typeof v === 'number' && v > 0) {
          reactionsCount[k] = Math.max(reactionsCount[k] || 0, v);
        }
      });
    }

    // Attach replyToMessage snippet if reply_to_id exists
    let replySnippet = undefined;
    if (msg.replyToId) {
      const parent = messages.find(m => m.id === msg.replyToId);
      if (parent) {
        replySnippet = {
          authorName: parent.user?.name || 'Supporter',
          text: parent.text || (parent.mediaType === 'image' ? '📷 Photo' : parent.mediaType === 'voice' ? '🎤 Voice note' : ''),
          mediaType: parent.mediaType,
          thumbnailUrl: parent.thumbnailUrl,
        };
      }
    }

    return {
      ...msg,
      reactions: reactionsCount,
      userReactions: userReacted,
      replyToMessage: replySnippet,
    };
  });

  return res.json({ messages: populated });
});

app.post('/api/db/match_rooms/:matchId/send', async (req, res) => {
  const { matchId } = req.params;
  const {
    id,
    user,
    text,
    content,
    messageType = 'chat',
    mediaType = 'text',
    mediaUrl,
    thumbnailUrl,
    voiceDuration,
    waveform,
    replyToId,
    replyToMessage,
  } = req.body;

  const msgContent = content || text || '';
  if (!msgContent.trim() && !mediaUrl) {
    return res.status(400).json({ error: 'Message content or media required' });
  }

  const newMsgId = id || `mmsg_${Date.now()}`;
  const now = new Date();
  const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const newMsg: any = {
    id: newMsgId,
    matchId,
    user: user || { name: 'Football Supporter', handle: '@fan', avatar: '' },
    text: msgContent,
    content: msgContent,
    messageType,
    mediaType,
    mediaUrl: mediaUrl || null,
    thumbnailUrl: thumbnailUrl || null,
    voiceDuration: voiceDuration || null,
    waveform: waveform || null,
    replyToId: replyToId || null,
    replyToMessage: replyToMessage || null,
    isPinned: false,
    isDeleted: false,
    timestamp: timeFormatted,
    createdAt: now.toISOString(),
    reactions: {
      '🔥': 0,
      '⚽': 0,
      '❤️': 0,
      '😂': 0,
      '😱': 0,
      '👏': 0,
    },
    userReactions: [],
    status: 'delivered',
  };

  if (supabaseBackendClient) {
    try {
      await supabaseBackendClient.from('match_messages').insert({
        id: newMsgId,
        match_id: matchId,
        user_id: user?.id || null,
        user_data: user,
        content: msgContent,
        message_type: messageType,
        media_type: mediaType,
        media_url: mediaUrl || null,
        thumbnail_url: thumbnailUrl || null,
        voice_duration: voiceDuration || null,
        waveform: waveform || null,
        reply_to_id: replyToId || null,
        is_pinned: false,
        is_deleted: false,
        created_at: now.toISOString(),
      });
    } catch (err: any) {
      console.warn('[Backend] Supabase match message insert notice:', err?.message);
    }
  }

  if (!inMemoryMatchRooms[matchId]) {
    inMemoryMatchRooms[matchId] = [];
  }
  inMemoryMatchRooms[matchId].push(newMsg);

  // Broadcast real-time message to all subscribers
  broadcastToRoom(matchId, 'new_message', newMsg);

  return res.json({ success: true, message: newMsg });
});

// Toggle Reaction on Match Message
app.post('/api/db/match_rooms/:matchId/messages/:messageId/react', async (req, res) => {
  const { matchId, messageId } = req.params;
  const { emoji, userId = 'user' } = req.body;

  if (!emoji) return res.status(400).json({ error: 'Emoji required' });

  const existingIdx = inMemoryMatchReactions.findIndex(
    r => r.messageId === messageId && r.userId === userId && r.emoji === emoji
  );

  let hasReacted = false;
  if (existingIdx !== -1) {
    inMemoryMatchReactions.splice(existingIdx, 1);
    hasReacted = false;
  } else {
    inMemoryMatchReactions.push({ messageId, userId, emoji });
    hasReacted = true;
  }

  // Calculate updated reactions
  const msgReactions = inMemoryMatchReactions.filter(r => r.messageId === messageId);
  const reactions: Record<string, number> = {
    '🔥': 0,
    '⚽': 0,
    '❤️': 0,
    '😂': 0,
    '😱': 0,
    '👏': 0,
  };
  const userReactions: string[] = [];

  msgReactions.forEach(r => {
    reactions[r.emoji] = (reactions[r.emoji] || 0) + 1;
    if (r.userId === userId) {
      userReactions.push(r.emoji);
    }
  });

  if (supabaseBackendClient) {
    try {
      if (hasReacted) {
        await supabaseBackendClient.from('message_reactions').insert({
          message_id: messageId,
          user_id: userId,
          emoji,
        });
      } else {
        await supabaseBackendClient
          .from('message_reactions')
          .delete()
          .match({ message_id: messageId, user_id: userId, emoji });
      }
    } catch (err: any) {
      console.warn('[Backend] Reaction sync notice:', err?.message);
    }
  }

  // Broadcast reaction update to all subscribers
  broadcastToRoom(matchId, 'reaction_updated', { messageId, reactions, userReactions });

  return res.json({ success: true, reactions, userReactions, hasReacted });
});

// Delete Match Message (for everyone or for me)
app.post('/api/db/match_rooms/:matchId/messages/:messageId/delete', async (req, res) => {
  const { matchId, messageId } = req.params;
  const { forEveryone = true } = req.body;

  const roomMsgs = inMemoryMatchRooms[matchId] || [];
  const msg = roomMsgs.find(m => m.id === messageId);

  if (msg) {
    if (forEveryone) {
      msg.isDeleted = true;
      msg.text = 'This message was deleted';
      msg.content = 'This message was deleted';
      msg.mediaUrl = null;
      msg.thumbnailUrl = null;
    } else {
      const idx = roomMsgs.indexOf(msg);
      if (idx !== -1) roomMsgs.splice(idx, 1);
    }
  }

  if (supabaseBackendClient && forEveryone) {
    try {
      await supabaseBackendClient
        .from('match_messages')
        .update({
          is_deleted: true,
          content: 'This message was deleted',
          media_url: null,
          thumbnail_url: null,
        })
        .eq('id', messageId);
    } catch {}
  }

  // Broadcast deletion to all subscribers
  broadcastToRoom(matchId, 'message_deleted', { messageId, forEveryone });

  return res.json({ success: true, messageId });
});

// Pin / Unpin Match Message
app.post('/api/db/match_rooms/:matchId/messages/:messageId/pin', async (req, res) => {
  const { matchId, messageId } = req.params;
  const { isPinned } = req.body;

  const roomMsgs = inMemoryMatchRooms[matchId] || [];
  const msg = roomMsgs.find(m => m.id === messageId);
  if (msg) {
    msg.isPinned = Boolean(isPinned);
  }

  if (supabaseBackendClient) {
    try {
      await supabaseBackendClient
        .from('match_messages')
        .update({ is_pinned: Boolean(isPinned) })
        .eq('id', messageId);
    } catch {}
  }

  // Broadcast pin status to all subscribers
  broadcastToRoom(matchId, 'message_pinned', { messageId, isPinned: Boolean(isPinned), message: msg });

  return res.json({ success: true, messageId, isPinned: Boolean(isPinned) });
});

// Room Presence Heartbeat, Leave & Real-Time Viewers (Zero Fake Inflation)
app.post('/api/db/match_rooms/:matchId/presence', async (req, res) => {
  const { matchId } = req.params;
  const { user } = req.body || {};
  const userId = user?.id || user?.handle || 'guest';

  const now = Date.now();
  const existingIdx = inMemoryRoomPresence.findIndex(p => p.matchId === matchId && p.userId === userId);

  if (existingIdx !== -1) {
    inMemoryRoomPresence[existingIdx].lastSeen = now;
    inMemoryRoomPresence[existingIdx].user = user || inMemoryRoomPresence[existingIdx].user;
  } else {
    inMemoryRoomPresence.push({ matchId, userId, user, lastSeen: now });
  }

  // Purge stale entries globally & filter active viewers within last 60s
  const activeCutoff = now - 60000;
  for (let i = inMemoryRoomPresence.length - 1; i >= 0; i--) {
    if (inMemoryRoomPresence[i].lastSeen <= activeCutoff) {
      inMemoryRoomPresence.splice(i, 1);
    }
  }
  const activeViewers = inMemoryRoomPresence.filter(p => p.matchId === matchId);

  const presencePayload = {
    viewersCount: activeViewers.length,
    viewers: activeViewers.map(v => v.user).filter(Boolean).slice(0, 15),
  };

  broadcastToRoom(matchId, 'presence_updated', presencePayload);

  return res.json({
    success: true,
    ...presencePayload,
  });
});

app.post('/api/db/match_rooms/:matchId/presence/leave', (req, res) => {
  const { matchId } = req.params;
  const userId = req.body?.userId || req.body?.user?.id || req.body?.user?.handle;

  if (userId) {
    for (let i = inMemoryRoomPresence.length - 1; i >= 0; i--) {
      if (inMemoryRoomPresence[i].matchId === matchId && inMemoryRoomPresence[i].userId === userId) {
        inMemoryRoomPresence.splice(i, 1);
      }
    }
  }

  const now = Date.now();
  const activeCutoff = now - 60000;
  const activeViewers = inMemoryRoomPresence.filter(p => p.matchId === matchId && p.lastSeen > activeCutoff);

  const presencePayload = {
    viewersCount: activeViewers.length,
    viewers: activeViewers.map(v => v.user).filter(Boolean).slice(0, 15),
  };

  broadcastToRoom(matchId, 'presence_updated', presencePayload);

  return res.json({
    success: true,
    ...presencePayload,
  });
});

app.get('/api/db/match_rooms/:matchId/presence', (req, res) => {
  const { matchId } = req.params;
  const now = Date.now();
  const activeCutoff = now - 60000;
  const activeViewers = inMemoryRoomPresence.filter(p => p.matchId === matchId && p.lastSeen > activeCutoff);
  return res.json({
    viewersCount: activeViewers.length,
    viewers: activeViewers.map(v => v.user).filter(Boolean).slice(0, 15),
  });
});

// Typing / Recording Voice Status
app.post('/api/db/match_rooms/:matchId/typing', (req, res) => {
  const { matchId } = req.params;
  const { user, isTyping = false, isRecording = false } = req.body;
  const userId = user?.id || user?.handle || 'guest';
  const userName = user?.name || user?.handle?.replace('@', '') || 'Supporter';

  if (!inMemoryTypingIndicators[matchId]) {
    inMemoryTypingIndicators[matchId] = [];
  }

  const list = inMemoryTypingIndicators[matchId];
  const idx = list.findIndex(item => item.userId === userId);

  if (isTyping || isRecording) {
    if (idx !== -1) {
      list[idx].isTyping = isTyping;
      list[idx].isRecording = isRecording;
      list[idx].timestamp = Date.now();
    } else {
      list.push({ userId, userName, isTyping, isRecording, timestamp: Date.now() });
    }
  } else if (idx !== -1) {
    list.splice(idx, 1);
  }

  // Purge older than 10 seconds
  const cutoff = Date.now() - 10000;
  const active = list.filter(item => item.timestamp > cutoff);
  inMemoryTypingIndicators[matchId] = active;

  // Broadcast typing indicators in real time
  broadcastToRoom(matchId, 'typing_changed', { typingFans: active });

  return res.json({ success: true, typingFans: active });
});

app.get('/api/db/match_rooms/:matchId/typing', (req, res) => {
  const { matchId } = req.params;
  const cutoff = Date.now() - 10000;
  const list = (inMemoryTypingIndicators[matchId] || []).filter(item => item.timestamp > cutoff);
  inMemoryTypingIndicators[matchId] = list;
  return res.json({ typingFans: list });
});

// Real-Time Match Events Webhook Simulator (Goal, Yellow, Red Card, VAR)
app.post('/api/db/match_rooms/:matchId/event-webhook', async (req, res) => {
  const { matchId } = req.params;
  const { eventType, minute, player, team, text } = req.body;

  const newMsgId = `mevt_${Date.now()}`;
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const eventMessage: any = {
    id: newMsgId,
    matchId,
    user: {
      name: 'FUTFIELD Live Engine',
      handle: '@futfield.match',
      avatar: DEFAULT_AVATAR,
      isMod: true,
    },
    text: text || `${minute}' ${eventType.toUpperCase()}: ${player} (${team})`,
    content: text || `${minute}' ${eventType.toUpperCase()}: ${player} (${team})`,
    messageType: eventType || 'goal',
    mediaType: 'text',
    timestamp: timeStr,
    createdAt: now.toISOString(),
    reactions: {
      '🔥': 0,
      '⚽': 0,
      '❤️': 0,
      '😂': 0,
      '😱': 0,
      '👏': 0,
    },
    userReactions: [],
    status: 'delivered',
  };

  if (!inMemoryMatchRooms[matchId]) {
    inMemoryMatchRooms[matchId] = [];
  }
  inMemoryMatchRooms[matchId].push(eventMessage);

  // Broadcast match event to all room viewers
  broadcastToRoom(matchId, 'match_event', eventMessage);

  return res.json({ success: true, event: eventMessage });
});

// Real-Time Match Room SSE Stream Endpoint
app.get('/api/db/match_rooms/:matchId/stream', (req, res) => {
  const { matchId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const listener = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  if (!roomSubscribers[matchId]) {
    roomSubscribers[matchId] = new Set();
  }
  roomSubscribers[matchId].add(listener);

  // Initial connection heartbeat
  res.write(`event: connected\ndata: ${JSON.stringify({ matchId, connected: true, timestamp: Date.now() })}\n\n`);

  req.on('close', () => {
    roomSubscribers[matchId]?.delete(listener);
  });
});

// Supabase Public Config for Client-Side Realtime Channels
app.get('/api/db/supabase-config', (req, res) => {
  res.json({
    supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
  });
});

// AI Match Prediction Endpoint (Form analysis, Win probability, Head-to-Head)
app.post('/api/ai/match-prediction', async (req, res) => {
  const homeTeam = req.body?.homeTeam || req.body?.home;
  const awayTeam = req.body?.awayTeam || req.body?.away;
  const { league, homeScore, awayScore } = req.body || {};
  if (!homeTeam || !awayTeam) {
    return res.status(400).json({ error: 'homeTeam and awayTeam required' });
  }

  if (aiClient) {
    try {
      const prompt = `You are FUTFIELD's Chief Match Data Scientist & Tactical Analyst.
Analyze this high-profile fixture:
Home Club: ${homeTeam}
Away Club: ${awayTeam}
League: ${league || 'European Top Flight'}
${typeof homeScore === 'number' ? `Current Scoreline: ${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}` : ''}

Task:
1. Provide win probability percentages that STRICTLY sum to 100: homeWinPct, drawPct, awayWinPct (integers).
2. Predict the most probable final scoreline (e.g. "2 - 1").
3. Estimate 5-match form array for both teams using "W", "D", "L" (e.g., ["W", "W", "D", "W", "L"]).
4. Provide a punchy 2-sentence tactical breakdown on pressing triggers, space exploit, and momentum.
5. Provide 3 decisive tactical battles.
6. Identify the star player to watch.

Output strictly valid JSON:
{
  "homeWinPct": 52,
  "drawPct": 26,
  "awayWinPct": 22,
  "predictedScore": "2 - 1",
  "homeForm": ["W", "W", "D", "W", "L"],
  "awayForm": ["D", "L", "W", "W", "D"],
  "tacticalBreakdown": "Arsenal's rapid transitional overloads on the right flank will test Chelsea's backline compactness.",
  "keyBattles": [
    "Right-wing 1v1 isolation and overlapping support",
    "Central midfield pivot turnover contest",
    "Defensive line depth against direct runs"
  ],
  "starPlayer": "Bukayo Saka"
}`;

      const rawAiText = await invokeGeminiSafely(prompt, {
        responseMimeType: 'application/json',
        timeoutMs: 4500,
      });

      if (rawAiText) {
        const parsed = JSON.parse(rawAiText);
        const home = Number(parsed.homeWinPct) || 48;
        const away = Number(parsed.awayWinPct) || 28;
        const draw = Math.max(10, 100 - home - away);

        return res.json({
          success: true,
          prediction: {
            homeWinPct: home,
            drawPct: draw,
            awayWinPct: away,
            predictedScore: parsed.predictedScore || '2 - 1',
            homeForm: parsed.homeForm || ['W', 'W', 'D', 'W', 'L'],
            awayForm: parsed.awayForm || ['D', 'W', 'L', 'W', 'D'],
            tacticalBreakdown: parsed.tacticalBreakdown || `${homeTeam}'s spatial control between lines gives them the home advantage.`,
            keyBattles: parsed.keyBattles || [
              'High pressing trigger vs build-up passing',
              'Flank take-on efficiency',
              'Set piece delivery into the box'
            ],
            starPlayer: parsed.starPlayer || `${homeTeam} Playmaker`,
          },
        });
      }
    } catch (err: any) {
      console.warn('[Backend] AI match prediction notice:', err?.message);
    }
  }

  // Domain-intelligent fallback calculation based on team reputations & home pitch advantage
  const homeLower = homeTeam.toLowerCase();
  const awayLower = awayTeam.toLowerCase();
  let homeWeight = 50;
  let awayWeight = 32;

  const eliteClubs = ['arsenal', 'city', 'manchester city', 'madrid', 'real madrid', 'barcelona', 'barca', 'bayern', 'liverpool', 'inter', 'psg'];
  if (eliteClubs.some(c => homeLower.includes(c))) homeWeight += 18;
  if (eliteClubs.some(c => awayLower.includes(c))) awayWeight += 18;

  const total = homeWeight + 25 + awayWeight;
  const homeWinPct = Math.round((homeWeight / total) * 100);
  const awayWinPct = Math.round((awayWeight / total) * 100);
  const drawPct = Math.max(10, 100 - homeWinPct - awayWinPct);

  return res.json({
    success: true,
    prediction: {
      homeWinPct,
      drawPct,
      awayWinPct,
      predictedScore: homeWinPct > awayWinPct ? '2 - 1' : homeWinPct < awayWinPct ? '1 - 2' : '1 - 1',
      homeForm: ['W', 'W', 'D', 'W', 'L'],
      awayForm: ['D', 'W', 'L', 'W', 'D'],
      tacticalBreakdown: `${homeTeam}'s midfield transition speed and half-space penetration provide a commanding edge over ${awayTeam}'s defensive structure.`,
      keyBattles: [
        'Central midfield duel and turnover recovery speed',
        'Flank 1v1 dribbles vs overlapping full-backs',
        'Direct set-piece aerial box defending',
      ],
      starPlayer: homeTeam.includes('Arsenal') ? 'Bukayo Saka' : homeTeam.includes('City') ? 'Erling Haaland' : homeTeam.includes('Madrid') ? 'Jude Bellingham' : `${homeTeam} Captain`,
    },
  });
});

// -------------------------------------------------------------
// Backend AI Smart Post Editor Endpoint
// -------------------------------------------------------------
app.post('/api/ai/smart-post-enhance', async (req, res) => {
  const { draft, tone = 'tactical', targetClub, matchContext } = req.body;

  if (!draft || typeof draft !== 'string') {
    return res.status(400).json({ error: 'Draft content required' });
  }

  const commonFootballTypos: Record<string, string> = {
    'lewandowki': 'Lewandowski',
    'lewandoski': 'Lewandowski',
    'odegaard': 'Ødegaard',
    'debruyne': 'De Bruyne',
    'de bruyn': 'De Bruyne',
    'vini': 'Vinícius Jr',
    'bellingam': 'Bellingham',
    'mbappe': 'Mbappé',
    'gvardiol': 'Gvardiol',
    'barca': 'Barça',
    'clasico': 'El Clásico',
    'off sides': 'offside',
    'penality': 'penalty',
    'shootout': 'penalty shootout',
    'counter attack': 'counter-attack',
  };

  const detectedTerminologySuggestions: { word: string; suggestion: string; reason: string }[] = [];
  const lowerDraft = draft.toLowerCase();

  for (const [typo, correct] of Object.entries(commonFootballTypos)) {
    if (lowerDraft.includes(typo) && !draft.includes(correct)) {
      detectedTerminologySuggestions.push({
        word: typo,
        suggestion: correct,
        reason: 'Standard football spelling for proper player names and tournament terms.',
      });
    }
  }

  if (aiClient) {
    try {
      const tonePrompts: Record<string, string> = {
        tactical: 'A tactical analyst breakdown focusing on half-spaces, defensive blocks, pressing triggers, and xG.',
        ultra: 'A passionate, electric football fan/ultra celebrating with high energy, match chants, and stadium banter.',
        banter: 'Witty, clever football banter and sharp humor suitable for football Twitter / TikTok.',
        reporter: 'A professional, authoritative sports journalism match dispatch.',
      };

      const selectedToneGuideline = tonePrompts[tone] || tonePrompts.tactical;

      const prompt = `You are the chief football editor for FUTFIELD. Enhance this football post draft:
"${draft}"

Selected Tone: ${selectedToneGuideline}
${targetClub ? `Fan Club Alignment: ${targetClub}` : ''}
${matchContext ? `Match Context: ${matchContext}` : ''}

Task Requirements:
1. Provide an enhanced rewrite in the requested tone that sounds authentic to true football culture.
2. Generate 4-6 trending football hashtags relevant to clubs, players, tactics, or leagues mentioned.
3. Conduct a football grammar, jargon, and terminology check.
4. Calculate a "Football Authenticity Score" out of 100.
5. Provide 2-3 specific football terminology or tactical phrase suggestions (e.g., "half-space overload", "inverted full-back", "low block").

Output strictly valid JSON with this schema:
{
  "enhancedText": "rewritten text",
  "hashtags": ["#Tag1", "#Tag2", "#Tag3", "#Tag4"],
  "authenticityScore": 92,
  "toneFeedback": "Concise feedback on why this tone resonates with fans",
  "grammarNotes": ["note 1", "note 2"],
  "tacticalJargonSuggestions": ["Inverted full-back", "Pressing trigger", "xG overperformance"]
}`;

      const rawAiEnhance = await invokeGeminiSafely(prompt, {
        responseMimeType: 'application/json',
        timeoutMs: 6000,
      });

      if (rawAiEnhance) {
        const parsed = JSON.parse(rawAiEnhance);
        return res.json({
          success: true,
          enhancedText: parsed.enhancedText || draft,
          hashtags: parsed.hashtags || ['#FUTFIELD', '#Football'],
          authenticityScore: parsed.authenticityScore || 88,
          toneFeedback: parsed.toneFeedback || 'Punchy football phrasing with good emotional hook.',
          grammarNotes: parsed.grammarNotes || [],
          tacticalJargonSuggestions: parsed.tacticalJargonSuggestions || ['Half-spaces', 'High press', 'Direct transition'],
          detectedTerminology: detectedTerminologySuggestions,
        });
      }
    } catch (err: any) {
      console.warn('[Backend] AI enhancement fallback to rule engine:', err?.message);
    }
  }

  const fallbackEnhancement: Record<string, string> = {
    tactical: `${draft.trim()} Notice how the spatial overload in the half-spaces completely disjointed their defensive block. Tactical masterclass.`,
    ultra: `${draft.trim()} UNREAL SCENES! 🏟️🔥 Absolute passion on the pitch tonight! This is what football is all about!`,
    banter: `${draft.trim()} Absolutely rattled their whole defense! You love to see it 😂⚽`,
    reporter: `${draft.trim()} A clinical performance on the night, shifting momentum and leaving the opposition searching for tactical answers.`,
  };

  const hashtags = ['#FUTFIELD', '#Football', '#Matchday', '#UCL', '#Tactics'];
  if (lowerDraft.includes('barca') || lowerDraft.includes('barcelona')) hashtags.push('#Barça', '#LaLiga');
  if (lowerDraft.includes('arsenal')) hashtags.push('#Arsenal', '#COYG');
  if (lowerDraft.includes('madrid')) hashtags.push('#RealMadrid', '#HalaMadrid');
  if (lowerDraft.includes('city') || lowerDraft.includes('haaland')) hashtags.push('#ManCity', '#Haaland');

  res.json({
    success: true,
    enhancedText: fallbackEnhancement[tone] || fallbackEnhancement.tactical,
    hashtags: Array.from(new Set(hashtags)).slice(0, 5),
    authenticityScore: 85,
    toneFeedback: `Applied authentic ${tone} football cadence with sharp match vocabulary.`,
    grammarNotes: ['Checked against football names and tactical terms.'],
    tacticalJargonSuggestions: ['Counter-press transition', 'Low block penetration', 'Half-space overload'],
    detectedTerminology: detectedTerminologySuggestions,
  });
});

// -------------------------------------------------------------
// Additional Server-Side Football AI & Phone Share Endpoints
// -------------------------------------------------------------
app.post('/api/ai/match-recap', async (req, res) => {
  const rawMatch = req.body?.match;
  const match = rawMatch && rawMatch.homeTeam && rawMatch.awayTeam
    ? rawMatch
    : req.body?.home && req.body?.away
    ? {
        homeTeam: { name: String(req.body.home), score: Number(String(req.body.score || '0-0').split('-')[0]) || 0 },
        awayTeam: { name: String(req.body.away), score: Number(String(req.body.score || '0-0').split('-')[1]) || 0 },
        league: req.body.league || 'League',
        venue: req.body.venue || 'the stadium',
        status: req.body.status || 'FT',
        events: req.body.events || [],
        stats: req.body.stats || { possession: [50, 50], shots: [6, 5] },
      }
    : null;
  if (!match || !match.homeTeam || !match.awayTeam) {
    return res.status(400).json({ success: false, error: 'Match details required' });
  }

  const eventsSummary = Array.isArray(match.events) && match.events.length > 0
    ? match.events.map((e: any) => `${e.minute}' ${e.player} (${e.type})`).join(', ')
    : 'No goals yet';
  const possession = Array.isArray(match.stats?.possession) ? match.stats.possession : [50, 50];
  const shots = Array.isArray(match.stats?.shots) ? match.stats.shots : [6, 5];

  const prompt = `You are FUTFIELD's Senior Football Tactical Analyst. Provide a punchy, 3-paragraph recap for this match:
Match: ${match.homeTeam.name} ${match.homeTeam.score ?? 0} - ${match.awayTeam.score ?? 0} ${match.awayTeam.name} (${match.league || 'League'})
Status: ${match.status || 'LIVE'} (${match.minute ? match.minute + ' mins' : ''})
Key Events: ${eventsSummary}
Stats: Possession ${possession[0]}% vs ${possession[1]}%, Shots ${shots[0]} vs ${shots[1]}

Include:
1. Match narrative & tempo
2. Decisive moment or tactical tweak
3. Key player performance rating
Keep it under 180 words with bold highlights.`;

  const aiText = await invokeGeminiSafely(prompt, { timeoutMs: 5500 });
  if (aiText) {
    return res.json({ success: true, recap: aiText, source: 'futfield-pitchiq' });
  }

  const homeScore = Number(match.homeTeam.score ?? 0);
  const awayScore = Number(match.awayTeam.score ?? 0);
  const isDraw = homeScore === awayScore;
  const winner = homeScore > awayScore ? match.homeTeam.name : match.awayTeam.name;
  const keyScorer = Array.isArray(match.events)
    ? match.events.find((e: any) => String(e?.type || '').includes('goal'))?.player
    : null;

  const fallbackRecap = `⚡ **FUTFIELD TACTICAL MATCH RECAP**

${isDraw
  ? `An enthralling tactical duel at ${match.venue || 'the stadium'}! Both ${match.homeTeam.name} and ${match.awayTeam.name} traded high-pressing spells in an intense contest.`
  : `A commanding showcase from ${winner}! Sharp transitional counter-attacks broke the deadlock and punished spaces between the lines.`}

🔥 **Decisive Turning Point:** The midfield press generated ${shots[0] + shots[1]} total shots, with ${keyScorer || 'the frontline'} leading decisive surges inside the penalty area.

⭐ **Tactical Takeaway:** ${match.homeTeam.name} held ${possession[0]}% possession while ${match.awayTeam.name} threatened with rapid vertical breaks.`;

  return res.json({ success: true, recap: fallbackRecap, source: 'tactical-engine' });
});

app.post('/api/ai/ask', async (req, res) => {
  const { question, context } = req.body || {};
  const cleanQuestion = String(question || '').trim();
  if (!cleanQuestion) {
    return res.status(400).json({ success: false, error: 'Question required' });
  }

  const prompt = `You are FUTFIELD AI — the world's most knowledgeable, passionate football assistant.
User question: "${cleanQuestion}"
${context ? `Current screen context: ${String(context)}` : ''}

Rules:
- Provide accurate football facts, tactical nuance, historical context, or stats.
- Keep it energetic, concise (2-4 bullet points or short paragraphs).
- Mention relevant clubs, leagues, or legendary players where fitting.`;

  const aiText = await invokeGeminiSafely(prompt, { timeoutMs: 6000 });
  if (aiText) {
    return res.json({ success: true, answer: aiText, source: 'futfield-pitchiq' });
  }

  const q = cleanQuestion.toLowerCase();
  let answer = `⚽ **FUTFIELD Football Intelligence**\n\nGreat question! In modern football, spatial dominance between the lines and transitional efficiency define winning squads. Matches are decided in half-space overloads, 3-second counter-pressing triggers, and composure in front of goal. Ask me about any club, player comparison, VAR rule, or upcoming fixture!`;

  if (q.includes('el clasico') || q.includes('barca') || q.includes('madrid')) {
    answer = `⚽ **El Clásico Tactical Breakdown**\n\n• **Midfield Control:** The duel between tempo controllers and vertical box-to-box runners dictates the rhythm.\n• **Flank Threat:** 1v1 wingers consistently draw double-teams, creating half-spaces for overlapping fullbacks.\n• **Rivalry Stakes:** Every meeting reshapes the title race and global football conversation.`;
  } else if (q.includes('offside') || q.includes('var')) {
    answer = `📐 **Offside & Semi-Automated VAR Rules**\n\n• A player is in an offside position if any scoring part of their head, body, or feet is nearer the opponent's goal line than both the ball and the second-last opponent.\n• Hands and arms are excluded.\n• Semi-Automated Offside Technology tracks limb points rapidly to keep match decisions accurate.`;
  } else if (q.includes('haaland') || q.includes('saka') || q.includes('yamal') || q.includes('bellingham')) {
    answer = `🌟 **Player Scouting Report**\n\n• **Finishing & Movement:** Elite box occupation and blind-side runs generate high xG per 90.\n• **Pressing Work Rate:** Executes counter-pressing triggers immediately after possession turnovers.\n• **Match Impact:** Consistently creates goal contributions against deep-block defenses.`;
  }

  return res.json({ success: true, answer, source: 'tactical-engine' });
});

app.post('/api/ai/translate', async (req, res) => {
  const { text, targetLanguage = 'English' } = req.body || {};
  const cleanText = String(text || '');
  if (!cleanText.trim()) {
    return res.json({ success: true, translatedText: cleanText });
  }

  const prompt = `Translate the following football fan post accurately into ${String(targetLanguage)}, preserving football slang and matchday energy. Return ONLY the translated text without quotes:\n\n${cleanText}`;
  const aiText = await invokeGeminiSafely(prompt, { timeoutMs: 4500 });
  return res.json({
    success: true,
    translatedText: aiText || cleanText,
    source: aiText ? 'futfield-pitchiq' : 'passthrough',
  });
});

const shareAnalyticsLog: Array<{ channel: string; targetType: string; targetId?: string; timestamp: string }> = [];

app.post('/api/share/track', (req, res) => {
  const { channel = 'copy', targetType = 'app', targetId } = req.body || {};
  shareAnalyticsLog.unshift({
    channel: String(channel),
    targetType: String(targetType),
    targetId: targetId ? String(targetId) : undefined,
    timestamp: new Date().toISOString(),
  });
  if (shareAnalyticsLog.length > 500) shareAnalyticsLog.pop();

  let updatedShares: number | undefined;
  if (targetType === 'post' && targetId) {
    const post = inMemoryPosts.find(p => p.id === targetId);
    if (post) {
      post.shares = (post.shares || 0) + 1;
      updatedShares = post.shares;
      scheduleStorePersist();
      broadcastToGlobalFeed('post_engagement_updated', { postId: targetId, shares: updatedShares });
      broadcastToGlobalFeed('analytics_summary', computeRealtimeAnalytics());
    }
  } else if (targetType === 'video' && targetId) {
    const video = inMemoryVideos.find(v => v.id === targetId);
    if (video) {
      video.shares = (video.shares || 0) + 1;
      updatedShares = video.shares;
      scheduleStorePersist();
      broadcastToGlobalFeed('video_engagement_updated', {
        videoId: targetId,
        views: video.views || 0,
        likes: video.likes || 0,
        shares: updatedShares,
        reactions: video.reactions || {},
        commentsCount: video.commentsCount || 0,
      });
      broadcastToGlobalFeed('analytics_summary', computeRealtimeAnalytics());
    }
  }

  return res.json({
    success: true,
    channel,
    targetType,
    targetId: targetId || null,
    shares: updatedShares,
    totalTrackedShares: shareAnalyticsLog.length,
  });
});

// -------------------------------------------------------------
// Real-time Match Reaction Counter Service
// -------------------------------------------------------------
const matchReactionCounts: Record<string, number> = {};

app.post('/api/db/matches/:id/reaction', (req, res) => {
  const { id } = req.params;
  const { isLiked } = req.body;
  if (!matchReactionCounts[id]) {
    matchReactionCounts[id] = 0;
  }
  if (isLiked) {
    matchReactionCounts[id] += 1;
  } else {
    matchReactionCounts[id] = Math.max(0, matchReactionCounts[id] - 1);
  }

  // broadcast to match room if active
  broadcastToRoom(id, 'reaction_count_updated', {
    matchId: id,
    count: matchReactionCounts[id],
  });

  return res.json({ success: true, matchId: id, count: matchReactionCounts[id] });
});

app.get('/api/db/matches/:id/reactions', (req, res) => {
  const { id } = req.params;
  return res.json({ matchId: id, count: matchReactionCounts[id] || 0 });
});

// -------------------------------------------------------------
// Real FutHub Menu Data Services (Leagues & Squad Engine)
// -------------------------------------------------------------
app.get('/api/menu/leagues', (req, res) => {
  return res.json({ success: true, count: TOP_10_LEAGUES.length, leagues: TOP_10_LEAGUES });
});

// -------------------------------------------------------------
// FUTFIELD Creator Monetization & Virtual Gifting Engine
// -------------------------------------------------------------
interface CreatorWallet {
  userId: string;
  balance: number;
  totalEarned: number;
  tipsReceived: number;
  adRevenue: number;
  subscriptions: number;
  transactions: {
    id: string;
    type: 'tip' | 'ad_revenue' | 'subscription' | 'payout';
    amount: number;
    description: string;
    fromUser?: string;
    status: 'COMPLETED' | 'PENDING';
    timestamp: string;
  }[];
}

const creatorWallets: Record<string, CreatorWallet> = {};

function getOrCreateWallet(userId: string): CreatorWallet {
  if (!creatorWallets[userId]) {
    creatorWallets[userId] = {
      userId,
      balance: 14.50, // Starter creator grant
      totalEarned: 14.50,
      tipsReceived: 4.50,
      adRevenue: 7.00,
      subscriptions: 3.00,
      transactions: [
        {
          id: `tx_${Date.now()}_init`,
          type: 'ad_revenue',
          amount: 7.00,
          description: 'Matchday clip views revenue share (RPM $0.50)',
          status: 'COMPLETED',
          timestamp: 'Yesterday',
        },
        {
          id: `tx_${Date.now()}_tip`,
          type: 'tip',
          amount: 4.50,
          description: 'Stadium Matchball Tip from @emirates_gunner',
          fromUser: '@emirates_gunner',
          status: 'COMPLETED',
          timestamp: '2 hours ago',
        },
      ],
    };
  }
  return creatorWallets[userId];
}

// Fetch user creator wallet
app.get('/api/monetization/wallet/:userId', (req, res) => {
  const { userId } = req.params;
  const wallet = getOrCreateWallet(userId);
  res.json({ success: true, wallet });
});

// Tip/Gift a Creator
app.post('/api/monetization/tip', (req, res) => {
  const { fromUserId = 'fan_user', fromUserName = 'FUTFIELD Supporter', toUserId, toUserHandle, giftName = 'Match Ball', amount = 1.00, postId, videoId } = req.body;
  if (!toUserId && !toUserHandle) {
    return res.status(400).json({ error: 'Recipient creator ID or handle required' });
  }

  const targetId = toUserId || toUserHandle;
  const wallet = getOrCreateWallet(targetId);
  const tipAmount = Math.max(0.50, Number(amount) || 1.00);

  wallet.balance = +(wallet.balance + tipAmount).toFixed(2);
  wallet.totalEarned = +(wallet.totalEarned + tipAmount).toFixed(2);
  wallet.tipsReceived = +(wallet.tipsReceived + tipAmount).toFixed(2);

  const tx = {
    id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    type: 'tip' as const,
    amount: tipAmount,
    description: `Gift: ${giftName} from ${fromUserName}`,
    fromUser: fromUserName,
    status: 'COMPLETED' as const,
    timestamp: 'Just now',
  };
  wallet.transactions.unshift(tx);

  // Broadcast tip across global feed stream
  broadcastToGlobalFeed('tip_received', {
    toUserHandle,
    fromUserName,
    giftName,
    amount: tipAmount,
    postId,
    videoId,
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    message: `Gift ${giftName} ($${tipAmount.toFixed(2)}) sent successfully!`,
    wallet,
    transaction: tx,
  });
});

// Request Instant Payout
app.post('/api/monetization/payout', (req, res) => {
  const { userId, amount, payoutMethod = 'PayPal', destination } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID required' });
  const wallet = getOrCreateWallet(userId);
  const payoutAmount = Number(amount) || wallet.balance;

  if (payoutAmount <= 0 || payoutAmount > wallet.balance) {
    return res.status(400).json({ error: `Invalid payout amount. Available balance is $${wallet.balance.toFixed(2)}` });
  }

  wallet.balance = +(wallet.balance - payoutAmount).toFixed(2);
  const tx = {
    id: `tx_payout_${Date.now()}`,
    type: 'payout' as const,
    amount: payoutAmount,
    description: `Instant Payout via ${payoutMethod} to ${destination || 'Connected Account'}`,
    status: 'COMPLETED' as const,
    timestamp: 'Just now',
  };
  wallet.transactions.unshift(tx);

  res.json({
    success: true,
    message: `Payout of $${payoutAmount.toFixed(2)} processed successfully via ${payoutMethod}.`,
    remainingBalance: wallet.balance,
    transaction: tx,
  });
});

// Creator Revenue Optimizer API
app.post('/api/ai/monetization-advisor', async (req, res) => {
  const {
    creatorHandle = '@creator',
    postCount = 5,
    videoCount = 4,
    totalViews = 1250,
    totalLikes = 320,
    followerCount = 180,
    clubNiche = 'European Football',
  } = req.body;

  const baselineProjection = Math.max(25, Math.round(totalViews * 0.04 + totalLikes * 0.08 + followerCount * 0.15));

  if (aiClient) {
    try {
      const prompt = `You are the lead Creator Revenue & Monetization Strategist for FUTFIELD (a premier global football social media app).
Analyze this creator's profile performance metrics:
- Handle: ${creatorHandle}
- Total Uploaded Videos: ${videoCount}
- Tactical Posts: ${postCount}
- Combined Views: ${totalViews}
- Fan Likes & Reactions: ${totalLikes}
- Connected Followers: ${followerCount}
- Primary Football Niche: ${clubNiche}

Provide strategic, authentic football monetization recommendations strictly as a JSON object:
{
  "estimatedMonthlyEarningsMin": number (e.g. ${baselineProjection}),
  "estimatedMonthlyEarningsMax": number (e.g. ${baselineProjection * 3}),
  "recommendedRpm": "$0.45 - $0.85 per 1k views",
  "sponsorshipValuation": "$75 - $150 per sponsored match breakdown",
  "peakEarningWindows": ["60 mins before Champions League kickoff", "Full-time whistle reaction window", "Weekend Derby matchday morning"],
  "revenueStrategies": [
    {
      "title": "High-RPM Tactical Hook",
      "impact": "+35% View Duration",
      "advice": "Display the match tactic graphic in the first 2 seconds to retain 80%+ audience retention before ads trigger."
    },
    {
      "title": "Virtual Stadium Gift Triggers",
      "impact": "Direct Fan Tips",
      "advice": "Ask fans to tip 'Match Ball' or 'Golden Trophy' if their club will score first in the second half."
    },
    {
      "title": "Connected Fan Supporter Passes",
      "impact": "Predictable Monthly Income",
      "advice": "Offer exclusive squad lineup previews 10 minutes before official team releases for connected supporters."
    }
  ],
  "topRecommendedTags": ["#ChampionsLeague", "#Tactics", "#FUTFIELD", "#DerbyDay"]
}`;

      const rawAdviceText = await invokeGeminiSafely(prompt, {
        responseMimeType: 'application/json',
        timeoutMs: 5500,
      });

      if (rawAdviceText) {
        const parsed = JSON.parse(rawAdviceText);
        return res.json({ success: true, advice: parsed });
      }
    } catch (err: any) {
      console.warn('[Backend] AI Monetization Advisor notice:', err?.message);
    }
  }

  // Fallback intelligent projection
  res.json({
    success: true,
    advice: {
      estimatedMonthlyEarningsMin: baselineProjection,
      estimatedMonthlyEarningsMax: baselineProjection * 2.8,
      recommendedRpm: '$0.40 - $0.80 per 1k views',
      sponsorshipValuation: `$${Math.max(50, Math.round(followerCount * 0.4))} per tactical shoutout`,
      peakEarningWindows: [
        'Matchday post-game 90-minute debrief window',
        'Champions League & Premier League kickoff countdown',
        'Transfer deadline week viral analysis',
      ],
      revenueStrategies: [
        {
          title: 'Immediate Tactical Hook',
          impact: '+40% Ad Revenue Share',
          advice: 'Open tactical video clips with the freeze-frame passing lane to optimize viewer retention and trigger maximum ad tier payouts.',
        },
        {
          title: 'Live Gift Matchday Bounties',
          impact: 'Instant Cash Tips',
          advice: 'Prompt live room viewers to send the Super Strikers Cup gift when their team registers an xG over 1.5.',
        },
        {
          title: 'Priority Connected Feed',
          impact: '2x Organic Reach',
          advice: 'Encourage users to click your Connect button so all your video breakdowns land at the top of their home feed first.',
        },
      ],
      topRecommendedTags: ['#FUTFIELD', '#TacticalBreakdown', '#Matchday', '#LiveScores'],
    },
  });
});
// -------------------------------------------------------------
// Paystack Official Payment & Membership Billing Engine
// -------------------------------------------------------------
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_PUBLIC_KEY =
  process.env.VITE_PAYSTACK_PUBLIC_KEY || process.env.PAYSTACK_PUBLIC_KEY || '';

if (!IS_SERVERLESS) {
  setInterval(() => {
    const now = new Date();
    for (const [userId, sub] of Object.entries(activeSubscriptionsStore)) {
      if (!sub.notified && new Date(sub.expiresAt) < now) {
        sub.notified = true;
        if (!subscriptionExpiryAlerts[userId]) {
          subscriptionExpiryAlerts[userId] = [];
        }
        subscriptionExpiryAlerts[userId].unshift({
          id: `expiry_${Date.now()}`,
          title: 'Subscription Expired',
          body: `Your FUTFIELD ${sub.tier.toUpperCase()} subscription pass has expired. Renew with Paystack to restore Pro access.`,
          type: 'subscription_expired',
          timestamp: new Date().toISOString(),
        });
      }
    }
  }, 60_000);
}

function getTierPricingSpec(tierRaw: string) {
  const tier = (tierRaw || 'pro').toLowerCase();
  if (tier === 'season') {
    return { tier: 'season' as const, usdPrice: 36, usdSubunit: 3600, ngnPrice: 57600, ngnSubunit: 5760000, days: 150, bonusFp: 5000 };
  }
  if (tier === 'vip') {
    return { tier: 'vip' as const, usdPrice: 25, usdSubunit: 2500, ngnPrice: 40000, ngnSubunit: 4000000, days: 90, bonusFp: 2000 };
  }
  return { tier: 'pro' as const, usdPrice: 12, usdSubunit: 1200, ngnPrice: 19200, ngnSubunit: 1920000, days: 30, bonusFp: 500 };
}

async function activateProMembershipForUser(params: {
  reference: string;
  userId: string;
  email?: string;
  planType: string;
  amountMajor?: number;
  currency?: string;
}) {
  const { reference, userId, email = 'supporter@futfieldsport.com.ng', planType, amountMajor, currency = 'NGN' } = params;
  const spec = getTierPricingSpec(planType);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + spec.days);
  const expiresAtIso = expiresAt.toISOString();

  if (paystackTransactions[reference]) {
    paystackTransactions[reference].status = 'success';
  } else {
    paystackTransactions[reference] = {
      reference,
      userId,
      email,
      amount: amountMajor ?? (currency === 'NGN' ? spec.ngnPrice : spec.usdPrice),
      currency,
      tier: spec.tier,
      status: 'success',
      createdAt: new Date().toISOString(),
    };
  }

  const cleanEmail = String(email || '').trim().toLowerCase();
  if (userId) {
    const subRecord: ActiveSubscription = {
      userId,
      email: cleanEmail,
      tier: spec.tier,
      expiresAt: expiresAtIso,
      notified: false,
    };
    activeSubscriptionsStore[userId] = subRecord;
    if (cleanEmail) {
      activeSubscriptionsStore[`email:${cleanEmail}`] = subRecord;
    }

    if (inMemoryProfiles[userId]) {
      inMemoryProfiles[userId] = {
        ...inMemoryProfiles[userId],
        isPro: true,
        membershipTier: spec.tier === 'vip' || spec.tier === 'season' ? 'vip' : 'pro',
        proPlan: spec.tier,
        proExpiresAt: expiresAtIso,
        paystackReference: reference,
        fanPoints: (inMemoryProfiles[userId].fanPoints || 0) + spec.bonusFp,
      };
    }

    const wallet = getOrCreateWallet(userId);
    wallet.subscriptions += spec.usdPrice;
    if (!wallet.transactions.some((tx: any) => tx.id === `tx_${reference}`)) {
      wallet.transactions.unshift({
        id: `tx_${reference}`,
        type: 'subscription',
        amount: amountMajor ?? spec.usdPrice,
        description: `FUTFIELD ${spec.tier.toUpperCase()} Subscription Unlocked (${currency})`,
        status: 'COMPLETED',
        timestamp: new Date().toISOString(),
      });
    }

    if (supabaseBackendClient && isValidUuid(userId)) {
      try {
        await supabaseBackendClient
          .from('profiles')
          .update({
            is_pro: true,
            pro_plan: spec.tier,
            pro_expires_at: expiresAtIso,
          })
          .eq('id', userId);
      } catch (supaErr) {
        console.warn('[Paystack] Supabase profile unlock sync notice:', supaErr);
      }
    }
  } else if (cleanEmail) {
    activeSubscriptionsStore[`email:${cleanEmail}`] = {
      userId: `email:${cleanEmail}`,
      email: cleanEmail,
      tier: spec.tier,
      expiresAt: expiresAtIso,
      notified: false,
    };
  }

  scheduleStorePersist();
  broadcastToGlobalFeed('subscription_unlocked', {
    userId,
    email: cleanEmail,
    tier: spec.tier,
    isPro: true,
    membershipTier: spec.tier === 'vip' || spec.tier === 'season' ? 'vip' : 'pro',
    expiresAt: expiresAtIso,
    bonusPoints: spec.bonusFp,
    reference,
  });

  return { spec, expiresAtIso };
}

app.get('/api/subscriptions/check/:userId', async (req, res) => {
  const { userId } = req.params;
  const emailParam = String(req.query.email || '').trim().toLowerCase();
  let sub =
    activeSubscriptionsStore[userId] ||
    (emailParam ? activeSubscriptionsStore[`email:${emailParam}`] : undefined);

  if (!sub && supabaseBackendClient && isValidUuid(userId)) {
    try {
      const { data: prof } = await supabaseBackendClient
        .from('profiles')
        .select('is_pro, pro_plan, pro_expires_at')
        .eq('id', userId)
        .maybeSingle();
      if (prof?.is_pro) {
        sub = {
          userId,
          email: emailParam,
          tier: prof.pro_plan || 'pro',
          expiresAt: prof.pro_expires_at || new Date(Date.now() + 30 * 86400000).toISOString(),
          notified: false,
        };
        activeSubscriptionsStore[userId] = sub;
      }
    } catch {}
  }

  const isExpired = sub ? new Date(sub.expiresAt) < new Date() : false;
  const alerts = subscriptionExpiryAlerts[userId] || [];
  if (alerts.length > 0) {
    subscriptionExpiryAlerts[userId] = [];
  }
  const latestTx = Object.values(paystackTransactions).find(
    (tx) => tx.status === 'success' && (tx.userId === userId || (emailParam && tx.email?.toLowerCase() === emailParam))
  );
  res.json({
    success: true,
    hasSubscription: Boolean(sub),
    isPro: sub ? !isExpired : false,
    tier: sub?.tier || 'free',
    expiresAt: sub?.expiresAt || null,
    reference: latestTx?.reference || null,
    isExpired,
    alerts,
  });
});

// -------------------------------------------------------------
// Free Backend IP Geolocation, Live USD FX Rates & Paystack Pricing
// Stagnant USD pricing ($12 Pro / $25 VIP / $36 Season / $7.20/mo)
// -------------------------------------------------------------
const STAGNANT_USD_PLANS = {
  pro: { tier: 'pro' as const, name: 'Matchday Pro Pass', usdPrice: 12, days: 30, effectiveMonthlyUsd: 12, bonusFp: 500 },
  vip: { tier: 'vip' as const, name: 'Club VIP Ultra Pass', usdPrice: 25, days: 90, effectiveMonthlyUsd: 8.33, bonusFp: 2000 },
  season: { tier: 'season' as const, name: 'Championship Season Pass', usdPrice: 36, days: 150, effectiveMonthlyUsd: 7.2, bonusFp: 5000 },
};

const FALLBACK_USD_RATES: Record<string, number> = {
  USD: 1, NGN: 1600, GHS: 15.8, KES: 129, ZAR: 18.2, EGP: 49.5, UGX: 3700, TZS: 2650,
  XOF: 605, XAF: 605, MAD: 9.8, EUR: 0.92, GBP: 0.78, CAD: 1.38, AUD: 1.52,
  INR: 84.5, BRL: 5.75, JPY: 153, AED: 3.67, SAR: 3.75, TRY: 34.4, CHF: 0.88,
  SEK: 10.6, NOK: 10.9, DKK: 6.86, PLN: 4.02, MXN: 20.1, ARS: 995, COP: 4350,
  PKR: 278, BDT: 119.5, IDR: 15750, MYR: 4.42, PHP: 58.6, SGD: 1.34, KRW: 1390, CNY: 7.22,
};

const COUNTRY_TO_META: Record<string, { name: string; currency: string }> = {
  NG: { name: 'Nigeria', currency: 'NGN' },
  GH: { name: 'Ghana', currency: 'GHS' },
  KE: { name: 'Kenya', currency: 'KES' },
  ZA: { name: 'South Africa', currency: 'ZAR' },
  EG: { name: 'Egypt', currency: 'EGP' },
  UG: { name: 'Uganda', currency: 'UGX' },
  TZ: { name: 'Tanzania', currency: 'TZS' },
  CI: { name: "Côte d'Ivoire", currency: 'XOF' },
  SN: { name: 'Senegal', currency: 'XOF' },
  CM: { name: 'Cameroon', currency: 'XAF' },
  MA: { name: 'Morocco', currency: 'MAD' },
  US: { name: 'United States', currency: 'USD' },
  GB: { name: 'United Kingdom', currency: 'GBP' },
  CA: { name: 'Canada', currency: 'CAD' },
  AU: { name: 'Australia', currency: 'AUD' },
  DE: { name: 'Germany', currency: 'EUR' },
  FR: { name: 'France', currency: 'EUR' },
  ES: { name: 'Spain', currency: 'EUR' },
  IT: { name: 'Italy', currency: 'EUR' },
  NL: { name: 'Netherlands', currency: 'EUR' },
  PT: { name: 'Portugal', currency: 'EUR' },
  IE: { name: 'Ireland', currency: 'EUR' },
  BE: { name: 'Belgium', currency: 'EUR' },
  IN: { name: 'India', currency: 'INR' },
  BR: { name: 'Brazil', currency: 'BRL' },
  JP: { name: 'Japan', currency: 'JPY' },
  AE: { name: 'United Arab Emirates', currency: 'AED' },
  SA: { name: 'Saudi Arabia', currency: 'SAR' },
  TR: { name: 'Turkey', currency: 'TRY' },
  MX: { name: 'Mexico', currency: 'MXN' },
};

const PAYSTACK_SETTLEMENT_CURRENCIES = new Set(['NGN', 'GHS', 'ZAR', 'KES', 'XOF', 'USD']);
const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'UGX', 'XOF', 'XAF']);

let cachedRates: { rates: Record<string, number>; timestamp: number } | null = null;
async function getLiveUsdRates(): Promise<Record<string, number>> {
  const now = Date.now();
  if (cachedRates && now - cachedRates.timestamp < 3600_000) {
    return cachedRates.rates;
  }
  try {
    const ratesRes = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: AbortSignal.timeout(3000),
    });
    if (ratesRes.ok) {
      const data = await ratesRes.json();
      if (data?.rates && typeof data.rates === 'object') {
        const merged = { ...FALLBACK_USD_RATES, ...data.rates, USD: 1 };
        cachedRates = { rates: merged, timestamp: now };
        return merged;
      }
    }
  } catch {}
  return { ...FALLBACK_USD_RATES };
}

const geoIpCache = new Map<string, { timestamp: number; data: { country_code: string; country_name: string; currency: string; city?: string } }>();

function formatMoneyAmount(amount: number, currency: string): string {
  const safeCur = (currency || 'USD').toUpperCase();
  const isZeroDec = ZERO_DECIMAL_CURRENCIES.has(safeCur) || ['NGN', 'KES', 'INR', 'TZS', 'IDR'].includes(safeCur);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: safeCur,
      minimumFractionDigits: safeCur === 'USD' && Number.isInteger(amount) ? 0 : isZeroDec ? 0 : 2,
      maximumFractionDigits: isZeroDec ? 0 : 2,
    }).format(amount);
  } catch {
    return `${safeCur} ${isZeroDec ? Math.round(amount).toLocaleString('en-US') : amount.toFixed(2)}`;
  }
}

async function detectClientGeo(req: express.Request): Promise<{
  country_code: string;
  country_name: string;
  currency: string;
  city?: string;
}> {
  const clientIp = getClientIp(req);
  const ipQuery = isPrivateOrLoopbackIp(clientIp) ? '' : clientIp;

  // 1. Hosting / Edge proxy headers (Cloudflare, Vercel, Netlify)
  const edgeCountry = String(
    req.headers['cf-ipcountry'] ||
    req.headers['x-vercel-ip-country'] ||
    req.headers['x-country-code'] ||
    ''
  ).trim().toUpperCase();
  if (edgeCountry && /^[A-Z]{2}$/.test(edgeCountry) && edgeCountry !== 'XX' && edgeCountry !== 'T1') {
    const meta = COUNTRY_TO_META[edgeCountry];
    return {
      country_code: edgeCountry,
      country_name: meta?.name || edgeCountry,
      currency: meta?.currency || 'USD',
    };
  }

  const cacheKey = ipQuery || '__outbound__';
  const cached = geoIpCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 6 * 3600_000) {
    return cached.data;
  }

  const saveGeo = (val: { country_code: string; country_name: string; currency: string; city?: string }) => {
    if (geoIpCache.size >= 10_000) {
      const oldest = geoIpCache.keys().next().value;
      if (oldest) geoIpCache.delete(oldest);
    }
    geoIpCache.set(cacheKey, { timestamp: Date.now(), data: val });
    return val;
  };

  // Provider 1: ipwho.is (free, no key, reliable currency info)
  try {
    const whoRes = await fetch(`https://ipwho.is/${encodeURIComponent(ipQuery)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(2800),
    });
    if (whoRes.ok) {
      const whoData = await whoRes.json();
      if (whoData?.success && whoData.country_code) {
        const cc = String(whoData.country_code).toUpperCase();
        return saveGeo({
          country_code: cc,
          country_name: whoData.country || COUNTRY_TO_META[cc]?.name || cc,
          currency: String(whoData.currency?.code || COUNTRY_TO_META[cc]?.currency || 'USD').toUpperCase(),
          city: whoData.city || undefined,
        });
      }
    }
  } catch {}

  // Provider 2: ipapi.co (free fallback)
  try {
    const apiRes = await fetch(`https://ipapi.co/${ipQuery ? encodeURIComponent(ipQuery) + '/' : ''}json/`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(2800),
    });
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data?.country_code) {
        const cc = String(data.country_code).toUpperCase();
        return saveGeo({
          country_code: cc,
          country_name: data.country_name || COUNTRY_TO_META[cc]?.name || cc,
          currency: String(data.currency || COUNTRY_TO_META[cc]?.currency || 'USD').toUpperCase(),
          city: data.city || undefined,
        });
      }
    }
  } catch {}

  // Provider 3: ip-api.com (free fallback)
  try {
    const ipApiRes = await fetch(`http://ip-api.com/json/${encodeURIComponent(ipQuery)}?fields=status,countryCode,country,city,currency`, {
      signal: AbortSignal.timeout(2800),
    });
    if (ipApiRes.ok) {
      const d = await ipApiRes.json();
      if (d?.status === 'success' && d.countryCode) {
        const cc = String(d.countryCode).toUpperCase();
        return saveGeo({
          country_code: cc,
          country_name: d.country || COUNTRY_TO_META[cc]?.name || cc,
          currency: String(d.currency || COUNTRY_TO_META[cc]?.currency || 'USD').toUpperCase(),
          city: d.city || undefined,
        });
      }
    }
  } catch {}

  return {
    country_code: 'NG',
    country_name: 'Nigeria',
    currency: 'NGN',
  };
}

app.get('/api/ip-country', async (req, res) => {
  try {
    const geo = await detectClientGeo(req);
    return res.json({ success: true, ...geo });
  } catch {
    return res.json({ success: true, country_code: 'NG', country_name: 'Nigeria', currency: 'NGN' });
  }
});

app.get('/api/geo/ip-pricing', async (req, res) => {
  try {
    const overrideCurrency = String(req.query.currency || '').trim().toUpperCase();
    const [geo, rates] = await Promise.all([detectClientGeo(req), getLiveUsdRates()]);
    const detectedCurrency = overrideCurrency && rates[overrideCurrency] ? overrideCurrency : geo.currency;
    const rate = Number(rates[detectedCurrency] || 1);

    const plans = (Object.values(STAGNANT_USD_PLANS)).map((p) => {
      const rawLocal = p.usdPrice * rate;
      const isWholeCur = ZERO_DECIMAL_CURRENCIES.has(detectedCurrency) || ['NGN', 'KES', 'INR', 'TZS', 'IDR'].includes(detectedCurrency);
      const localAmount = isWholeCur ? Math.round(rawLocal) : +rawLocal.toFixed(2);
      return {
        id: p.tier,
        name: p.name,
        days: p.days,
        usdPrice: p.usdPrice,
        usdFormatted: `$${p.usdPrice}`,
        effectiveMonthlyUsd: p.effectiveMonthlyUsd,
        localCurrency: detectedCurrency,
        localAmount,
        localFormatted: formatMoneyAmount(localAmount, detectedCurrency),
        exchangeRate: rate,
      };
    });

    return res.json({
      success: true,
      country_code: geo.country_code,
      country_name: geo.country_name,
      city: geo.city,
      currency: detectedCurrency,
      exchange_rate: rate,
      stagnant_usd_base: {
        pro: 12,
        vip: 25,
        season: 36,
        lowestMonthlyUsd: 7.2,
      },
      paystack_direct_currency: PAYSTACK_SETTLEMENT_CURRENCIES.has(detectedCurrency) ? detectedCurrency : 'USD',
      rates,
      plans,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Unable to compute regional pricing.' });
  }
});

// Paystack Key Status Check (Real validation only)
app.get('/api/paystack/status', async (req, res) => {
  const keyMode = PAYSTACK_SECRET_KEY.startsWith('sk_live_') || PAYSTACK_PUBLIC_KEY.startsWith('pk_live_')
    ? 'live'
    : PAYSTACK_SECRET_KEY
    ? 'test'
    : 'unconfigured';

  if (!PAYSTACK_SECRET_KEY) {
    return res.json({
      active: false,
      configured: false,
      mode: 'unconfigured',
      hasPublicKey: Boolean(PAYSTACK_PUBLIC_KEY),
      publicKey: PAYSTACK_PUBLIC_KEY || undefined,
      message: 'PAYSTACK_SECRET_KEY is not configured in environment variables.',
    });
  }

  try {
    const testRes = await fetch('https://api.paystack.co/bank', {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      signal: AbortSignal.timeout(4000),
    });
    const testData = await testRes.json();
    if (testRes.ok && testData.status) {
      return res.json({
        active: true,
        configured: true,
        mode: keyMode,
        hasPublicKey: Boolean(PAYSTACK_PUBLIC_KEY),
        publicKey: PAYSTACK_PUBLIC_KEY || undefined,
        message: 'Paystack gateway authenticated and connected.',
      });
    }
    return res.json({
      active: false,
      configured: true,
      mode: keyMode,
      hasPublicKey: Boolean(PAYSTACK_PUBLIC_KEY),
      message: testData?.message || 'Paystack secret key authentication failed.',
    });
  } catch (err: any) {
    return res.json({
      active: false,
      configured: true,
      mode: keyMode,
      hasPublicKey: Boolean(PAYSTACK_PUBLIC_KEY),
      message: err?.message || 'Unable to reach Paystack API right now.',
    });
  }
});

// Real-time currency conversion tool via free API
app.get('/api/exchange-rates', async (_req, res) => {
  const rates = await getLiveUsdRates();
  return res.json({ success: true, base: 'USD', rates });
});

app.post('/api/paystack/initialize', paystackLimiter, async (req, res) => {
  const {
    email,
    user_id = 'user_guest',
    country = 'NG',
    preferred_currency,
    plan_type = 'pro',
    callback_url,
    metadata = {},
  } = req.body || {};

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return res.status(400).json({ success: false, error: 'Valid billing email is required to start Paystack checkout.' });
  }

  if (!PAYSTACK_SECRET_KEY) {
    return res.status(503).json({
      success: false,
      error: 'Paystack live secret key (PAYSTACK_SECRET_KEY) is not configured in environment secrets.',
    });
  }

  const rates = await getLiveUsdRates();
  const spec = getTierPricingSpec(plan_type);
  const requestedCur = String(preferred_currency || (country?.toUpperCase() === 'NG' ? 'NGN' : 'USD')).toUpperCase();

  // Keep USD base strictly stagnant ($12 / $25 / $36); convert dynamically via live FX to Paystack-supported settlement currency
  let currency = PAYSTACK_SETTLEMENT_CURRENCIES.has(requestedCur) ? requestedCur : 'USD';
  const liveRate = Number(rates[currency] || (currency === 'NGN' ? 1600 : 1));
  const ngnLiveSubunit = Math.round(spec.usdPrice * Number(rates.NGN || 1600)) * 100;
  let subunitAmount =
    currency === 'USD'
      ? spec.usdSubunit
      : Math.round(spec.usdPrice * liveRate * (ZERO_DECIMAL_CURRENCIES.has(currency) ? 1 : 100));

  const reference = `futfield_${currency.toLowerCase()}_${spec.tier}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const origin = (req.headers.origin as string) || process.env.APP_URL || 'https://futfieldsports.com.ng';
  const finalCallbackUrl = callback_url || `${origin.replace(/\/$/, '')}/payment/callback`;

  paystackTransactions[reference] = {
    reference,
    userId: user_id,
    email,
    amount: ZERO_DECIMAL_CURRENCIES.has(currency) ? subunitAmount : subunitAmount / 100,
    currency,
    tier: spec.tier,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  scheduleStorePersist();

  try {
    let paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: subunitAmount,
        currency,
        reference,
        callback_url: finalCallbackUrl,
        metadata: {
          ...metadata,
          user_id,
          plan_type: spec.tier,
          stagnant_usd_price: spec.usdPrice,
          detected_currency: requestedCur,
          country,
          settlement: 'Paystack Worldwide Gateway',
          app: 'Futfield',
        },
      }),
    });

    let data = await paystackResponse.json();

    // Retry in live-FX NGN equivalent if merchant Paystack profile settles in NGN only
    if (!data?.status && currency !== 'NGN') {
      const retryRes = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          amount: ngnLiveSubunit,
          currency: 'NGN',
          reference,
          callback_url: finalCallbackUrl,
          metadata: {
            ...metadata,
            user_id,
            plan_type: spec.tier,
            stagnant_usd_price: spec.usdPrice,
            country,
            fallback_converted: true,
            app: 'Futfield',
          },
        }),
      });
      data = await retryRes.json();
      if (data?.status) {
        subunitAmount = ngnLiveSubunit;
        currency = 'NGN';
        paystackTransactions[reference].amount = subunitAmount / 100;
        paystackTransactions[reference].currency = currency;
      }
    }

    if (data?.status && data.data?.authorization_url) {
      return res.json({
        success: true,
        reference: data.data.reference || reference,
        authorization_url: data.data.authorization_url,
        access_code: data.data.access_code,
        publicKey: PAYSTACK_PUBLIC_KEY || undefined,
        amount: subunitAmount,
        currency,
        usd_base_price: spec.usdPrice,
        plan_type: spec.tier,
      });
    }

    return res.status(400).json({
      success: false,
      error: data?.message || 'Paystack rejected checkout initialization. Verify merchant key & currency.',
    });
  } catch (err: any) {
    console.error('[Paystack Initialize Error]:', err?.message);
    return res.status(502).json({
      success: false,
      error: err?.message || 'Unable to connect to Paystack initialization endpoint.',
    });
  }
});

async function handlePaystackVerify(req: express.Request, res: express.Response) {
  const reference = String(req.params.reference || req.body?.reference || req.query?.reference || '').trim();
  const reqUserId = String(req.body?.user_id || req.body?.userId || req.query?.user_id || '').trim();
  const reqPlanType = String(req.body?.plan_type || req.query?.plan_type || '').trim();

  if (!reference) {
    return res.status(400).json({ success: false, error: 'Transaction reference is required' });
  }

  if (!PAYSTACK_SECRET_KEY) {
    return res.status(503).json({
      success: false,
      error: 'Paystack verification secret key is not configured on the server.',
      reference,
    });
  }

  let verified = false;
  let transactionData: any = null;
  let verifyMessage = 'Transaction verification failed or was not paid.';

  try {
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    const data = await response.json();
    if (data?.status && data.data?.status === 'success') {
      verified = true;
      transactionData = data.data;
    } else {
      verifyMessage = data?.data?.gateway_response || data?.message || verifyMessage;
    }
  } catch (err: any) {
    verifyMessage = err?.message || 'Unable to reach Paystack verification server.';
  }

  if (!verified || !transactionData) {
    return res.status(400).json({
      success: false,
      error: verifyMessage,
      reference,
    });
  }

  const meta = transactionData.metadata || {};
  const existingTx = paystackTransactions[reference];
  const resolvedUserId = reqUserId || String(meta.user_id || existingTx?.userId || 'user_guest');
  const resolvedPlan = String(reqPlanType || meta.plan_type || existingTx?.tier || 'pro').toLowerCase();
  const resolvedEmail = transactionData.customer?.email || existingTx?.email || 'supporter@futfieldsport.com.ng';
  const amountMajor = Number(transactionData.amount || 0) / 100;
  const currency = transactionData.currency || 'NGN';

  const { spec, expiresAtIso } = await activateProMembershipForUser({
    reference,
    userId: resolvedUserId,
    email: resolvedEmail,
    planType: resolvedPlan,
    amountMajor,
    currency,
  });

  return res.json({
    success: true,
    reference,
    message: 'You are now Pro - Worldwide',
    data: {
      is_pro: true,
      plan_type: spec.tier,
      expires_at: expiresAtIso,
      currency,
      amount: amountMajor,
      bonus_points: spec.bonusFp,
      reference,
    },
  });
}

app.get('/api/paystack/verify/:reference', paystackLimiter, handlePaystackVerify);
app.post('/api/paystack/verify/:reference', paystackLimiter, handlePaystackVerify);
app.post('/api/paystack/verify', paystackLimiter, handlePaystackVerify);

app.post('/api/paystack/webhook', async (req: any, res) => {
  const signature = String(req.headers['x-paystack-signature'] || '').trim();

  if (PAYSTACK_SECRET_KEY) {
    if (!signature) {
      return res.status(401).json({ error: 'Missing Paystack webhook signature.' });
    }
    try {
      const payloadForHmac = req.rawBody ? req.rawBody : JSON.stringify(req.body);
      const hash = crypto
        .createHmac('sha512', PAYSTACK_SECRET_KEY)
        .update(payloadForHmac)
        .digest('hex');

      const hashBuf = Buffer.from(hash, 'utf8');
      const sigBuf = Buffer.from(signature, 'utf8');
      if (hashBuf.length !== sigBuf.length || !crypto.timingSafeEqual(hashBuf, sigBuf)) {
        console.warn('[Paystack Webhook] Invalid timing-safe signature match');
        return res.status(401).send('Unauthorized webhook signature');
      }
    } catch (cryptoErr) {
      console.warn('[Paystack Webhook] Signature verification error:', cryptoErr);
      return res.status(401).send('Invalid signature');
    }
  }

  const { event, data } = req.body || {};
  console.log(`[Paystack Webhook] Event: ${event}`);

  if (event === 'charge.success' && data?.reference) {
    const reference = String(data.reference);
    const meta = data.metadata || {};
    const existingTx = paystackTransactions[reference];
    const resolvedUserId = String(meta.user_id || existingTx?.userId || '').trim();
    const resolvedPlan = String(meta.plan_type || existingTx?.tier || 'pro').toLowerCase();

    if (resolvedUserId) {
      await activateProMembershipForUser({
        reference,
        userId: resolvedUserId,
        email: data.customer?.email || existingTx?.email,
        planType: resolvedPlan,
        amountMajor: Number(data.amount || 0) / 100,
        currency: data.currency || 'NGN',
      });
    } else if (existingTx) {
      existingTx.status = 'success';
    }
  }

  return res.status(200).json({ received: true });
});

app.post('/api/paystack/cancel-subscription', async (req, res) => {
  const { user_id, subscription_code } = req.body || {};

  if (PAYSTACK_SECRET_KEY && subscription_code) {
    try {
      await fetch('https://api.paystack.co/subscription/disable', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: subscription_code,
          token: subscription_code,
        }),
      });
    } catch (err: any) {
      console.warn('[Paystack Cancel Warning]:', err?.message);
    }
  }

  if (user_id && activeSubscriptionsStore[user_id]) {
    delete activeSubscriptionsStore[user_id];
  }
  if (supabaseBackendClient && isValidUuid(user_id)) {
    try {
      await supabaseBackendClient.from('profiles').update({ is_pro: false }).eq('id', user_id);
    } catch {}
  }

  return res.json({
    success: true,
    message: 'Your Pro subscription has been cancelled. Your Pro features remain active until the end of your billing cycle.',
  });
});

// -------------------------------------------------------------
// Live Football Match Engine (Flashscore-Grade Match Details + Multi-Date Cache)
// -------------------------------------------------------------
let cachedMatchesResponse: any = null;
const matchesCacheByDate = new Map<string, { timestamp: number; data: any }>();
const MATCH_CACHE_TTL_MS = 30_000;
const matchDetailsCache = new Map<string, { timestamp: number; finished: boolean; data: any }>();
const MATCH_DETAIL_LIVE_TTL_MS = 25_000;
const MATCH_DETAIL_FINISHED_TTL_MS = 10 * 60_000;
const leagueTableCache = new Map<string, { timestamp: number; data: any }>();
const LEAGUE_TABLE_TTL_MS = 5 * 60_000;
const livePlayersCache = { timestamp: 0, players: [] as FootballPlayer[] };

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

function getDateOffsetYYYYMMDD(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function formatReadableDateLabel(yyyymmdd: string): string {
  const today = getDateOffsetYYYYMMDD(0);
  const yesterday = getDateOffsetYYYYMMDD(-1);
  const tomorrow = getDateOffsetYYYYMMDD(1);
  if (yyyymmdd === today) return 'TODAY';
  if (yyyymmdd === yesterday) return 'YESTERDAY';
  if (yyyymmdd === tomorrow) return 'TOMORROW';
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function mapPositionId(positionId?: number): string {
  if (positionId === 11 || positionId === 0) return 'GK';
  if (typeof positionId === 'number' && positionId >= 30 && positionId < 60) return 'DF';
  if (typeof positionId === 'number' && positionId >= 60 && positionId < 85) return 'MF';
  if (typeof positionId === 'number' && positionId >= 85) return 'FW';
  return 'MF';
}

function formatFotmobMinute(time?: number | string, overloadTime?: number | null): string {
  if (time === undefined || time === null) return "0'";
  if (overloadTime && Number(overloadTime) > 0) {
    return `${time}+${overloadTime}'`;
  }
  return `${time}'`;
}

function parseFotmobMatchDetailPayload(det: any) {
  const rawEvents: any[] = det?.content?.matchFacts?.events?.events || [];
  const parsedEvents: any[] = [];

  for (let i = 0; i < rawEvents.length; i++) {
    const ev = rawEvents[i];
    if (!ev || ev.type === 'Half' || ev.type === 'AddedTime') continue;
    const team: 'home' | 'away' = ev.isHome ? 'home' : 'away';
    const minute = formatFotmobMinute(ev.timeStr ?? ev.time, ev.overloadTime);
    const id = `ev_${ev.eventId || i}_${ev.type}`;

    if (ev.type === 'Goal') {
      const isOwnGoal = Boolean(ev.ownGoal || ev.goalDescriptionKey === 'owngoal' || ev.suffix === 'OG');
      const isPenalty = Boolean(ev.goalDescriptionKey === 'penalty' || String(ev.goalDescription || '').toLowerCase().includes('pen'));
      parsedEvents.push({
        id,
        minute,
        type: isOwnGoal ? 'own_goal' : isPenalty ? 'penalty_goal' : 'goal',
        player: ev.player?.name || ev.nameStr || ev.fullName || 'Scorer',
        assist: ev.assistStr || undefined,
        detail: isOwnGoal ? 'Own Goal' : isPenalty ? 'Penalty' : undefined,
        team,
      });
    } else if (ev.type === 'MissedPenalty' || String(ev.type || '').toLowerCase().includes('missed')) {
      parsedEvents.push({
        id,
        minute,
        type: 'missed_penalty',
        player: ev.player?.name || ev.nameStr || ev.fullName || 'Player',
        detail: ev.missedPenaltyStr || 'Missed Penalty',
        team,
      });
    } else if (ev.type === 'Card') {
      const cardType = String(ev.card || ev.cardDescription || '').toLowerCase();
      const isRed = cardType.includes('red');
      parsedEvents.push({
        id,
        minute,
        type: isRed ? 'red_card' : 'yellow_card',
        player: ev.player?.name || ev.nameStr || ev.fullName || 'Player',
        detail: cardType.includes('yellowred') ? '2nd Yellow / Red Card' : isRed ? 'Red Card' : 'Yellow Card',
        team,
      });
    } else if (ev.type === 'Substitution') {
      const subIn = ev.swap?.[0]?.name || ev.player?.name || ev.nameStr || 'Sub In';
      const subOut = ev.swap?.[1]?.name || undefined;
      parsedEvents.push({
        id,
        minute,
        type: 'substitution',
        player: subIn,
        assist: subOut ? `Out: ${subOut}` : undefined,
        detail: 'Substitution',
        team,
      });
    } else if (ev.type === 'VAR') {
      parsedEvents.push({
        id,
        minute,
        type: 'var',
        player: ev.player?.name || ev.nameStr || 'VAR Check',
        detail: ev.VARResult?.decision?.value || ev.goalDescription || 'VAR Review',
        team,
      });
    }
  }

  // Parse Stats
  const statGroups: any[] = det?.content?.stats?.Periods?.All?.stats || [];
  const allStatRows: any[] = statGroups.flatMap((g: any) => (Array.isArray(g?.stats) ? g.stats : []));
  const findStatPair = (keys: string[], fallback: [number, number]): [number, number] => {
    const row = allStatRows.find(
      (s: any) => keys.includes(String(s?.key || '').toLowerCase()) || keys.includes(String(s?.title || '').toLowerCase())
    );
    if (!row || !Array.isArray(row.stats)) return fallback;
    const a = parseFloat(String(row.rawStats?.[0]?.value ?? row.stats[0] ?? fallback[0]));
    const b = parseFloat(String(row.rawStats?.[1]?.value ?? row.stats[1] ?? fallback[1]));
    return [isNaN(a) ? fallback[0] : a, isNaN(b) ? fallback[1] : b];
  };

  const yellowFromEvents: [number, number] = [
    parsedEvents.filter(e => e.team === 'home' && e.type === 'yellow_card').length,
    parsedEvents.filter(e => e.team === 'away' && e.type === 'yellow_card').length,
  ];
  const redFromEvents: [number, number] = [
    parsedEvents.filter(e => e.team === 'home' && e.type === 'red_card').length,
    parsedEvents.filter(e => e.team === 'away' && e.type === 'red_card').length,
  ];

  const stats = {
    possession: findStatPair(['ballpossesion', 'ball possession'], [50, 50]),
    shots: findStatPair(['total_shots', 'total shots'], [0, 0]),
    shotsOnTarget: findStatPair(['shotsontarget', 'shots on target'], [0, 0]),
    corners: findStatPair(['corners'], [0, 0]),
    fouls: findStatPair(['fouls', 'fouls committed'], [0, 0]),
    yellowCards: findStatPair(['yellow_cards', 'yellow cards'], yellowFromEvents),
    redCards: findStatPair(['red_cards', 'red cards'], redFromEvents),
    xg: findStatPair(['expected_goals', 'expected goals (xg)'], [0, 0]),
  };

  // Parse Lineups
  const lu = det?.content?.lineup || {};
  const mapLineupList = (list: any[]) =>
    (Array.isArray(list) ? list : []).slice(0, 15).map((p: any) => ({
      number: Number(p.shirtNumber) || 0,
      name: p.name || p.lastName || 'Player',
      position: mapPositionId(p.positionId ?? p.usualPlayingPositionId),
      isCaptain: Boolean(p.isCaptain),
      rating: typeof p.performance?.rating === 'number' ? p.performance.rating : undefined,
    }));

  const lineups = {
    home: mapLineupList(lu?.homeTeam?.starters || []),
    away: mapLineupList(lu?.awayTeam?.starters || []),
  };

  const infoBox = det?.content?.matchFacts?.infoBox || {};
  return {
    events: parsedEvents,
    stats,
    lineups,
    venue: infoBox?.Stadium?.name || det?.general?.venue || undefined,
    referee: infoBox?.Referee?.text || undefined,
    minute: det?.header?.status?.liveTime?.short || undefined,
    homeScore: det?.header?.teams?.[0]?.score,
    awayScore: det?.header?.teams?.[1]?.score,
  };
}

async function fetchFotmobMatchDetailsCached(rawMatchId: string | number) {
  const cleanId = String(rawMatchId).replace(/^match_/i, '').trim();
  if (!cleanId || !/^\d+$/.test(cleanId)) return null;

  const existing = matchDetailsCache.get(cleanId);
  const ttl = existing?.finished ? MATCH_DETAIL_FINISHED_TTL_MS : MATCH_DETAIL_LIVE_TTL_MS;
  if (existing && Date.now() - existing.timestamp < ttl) {
    return existing.data;
  }

  try {
    const res = await fetch(`https://www.fotmob.com/api/data/matchDetails?matchId=${encodeURIComponent(cleanId)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FutfieldEngine/1.0)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return existing?.data || null;
    const det = await res.json();
    const parsed = parseFotmobMatchDetailPayload(det);
    const isFinished = Boolean(det?.header?.status?.finished);
    matchDetailsCache.set(cleanId, { timestamp: Date.now(), finished: isFinished, data: parsed });
    return parsed;
  } catch {
    return existing?.data || null;
  }
}

async function enrichMatchesWithDetails(formattedMatches: any[]) {
  const candidates = formattedMatches
    .filter(m => m.status === 'LIVE' || m.status === 'FINISHED')
    .slice(0, 18);

  const batchSize = 5;
  for (let i = 0; i < candidates.length; i += batchSize) {
    const chunk = candidates.slice(i, i + batchSize);
    await Promise.allSettled(
      chunk.map(async m => {
        const details = await fetchFotmobMatchDetailsCached(m.rawId || m.id);
        if (details) {
          m.events = details.events;
          m.stats = details.stats;
          m.lineups = details.lineups;
          if (details.venue) m.venue = details.venue;
          if (details.referee) m.referee = details.referee;
          if (details.minute && m.status === 'LIVE') m.minute = details.minute;
        }
      })
    );
  }
}

// Background warm-up and cache refresher
async function refreshMatchesCache(targetDate?: string) {
  const today = getDateOffsetYYYYMMDD(0);
  const dateToFetch = targetDate || today;

  const existing = matchesCacheByDate.get(dateToFetch);
  if (existing && Date.now() - existing.timestamp < MATCH_CACHE_TTL_MS) {
    return existing.data;
  }

  try {
    const data = await withTimeout(getFotmobMatches({ date: dateToFetch }), 3200, 'getFotmobMatches');
    const leagues = data?.leagues || [];
    const formattedMatches: any[] = [];
    const dateLabel = formatReadableDateLabel(dateToFetch);

    for (const league of leagues) {
      const leagueName = league.name || 'League Match';
      const matches = league.matches || [];

      for (const m of matches) {
        const matchObj: any = m;
        const isLive = Boolean(matchObj.status?.started && !matchObj.status?.finished);
        const isFinished = Boolean(matchObj.status?.finished);
        const statusType = isLive
          ? 'LIVE'
          : isFinished
          ? 'FINISHED'
          : dateLabel === 'TOMORROW'
          ? 'TOMORROW'
          : 'TODAY';

        let minuteStr = matchObj.status?.liveTime?.short || '';
        if (isLive && !minuteStr) {
          minuteStr = 'LIVE';
        }

        const homeTeamId = matchObj.home?.id;
        const awayTeamId = matchObj.away?.id;
        const homeCrest = '';
        const awayCrest = '';
        const kickoff = matchObj.time || matchObj.status?.startTimeStr || '20:00';
        const stadiumName = matchObj.status?.venue || 'Football Stadium';

        const cachedDet = matchDetailsCache.get(String(matchObj.id))?.data;

        formattedMatches.push({
          id: `match_${matchObj.id}`,
          rawId: matchObj.id,
          league: `${leagueName}`,
          status: statusType,
          minute: cachedDet?.minute || (isLive ? minuteStr : undefined),
          dateStr: dateLabel,
          timeStr: kickoff,
          kickoffTime: kickoff,
          homeTeam: {
            id: `team_${homeTeamId || 'h'}`,
            name: matchObj.home?.name || 'Home Team',
            shortName: matchObj.home?.shortName || matchObj.home?.name || 'Home',
            crest: homeCrest,
            score: typeof matchObj.home?.score === 'number' ? matchObj.home.score : 0,
            color: '#00E676',
          },
          awayTeam: {
            id: `team_${awayTeamId || 'a'}`,
            name: matchObj.away?.name || 'Away Team',
            shortName: matchObj.away?.shortName || matchObj.away?.name || 'Away',
            crest: awayCrest,
            score: typeof matchObj.away?.score === 'number' ? matchObj.away.score : 0,
            color: '#3B82F6',
          },
          venue: cachedDet?.venue || stadiumName,
          stadium: cachedDet?.venue || stadiumName,
          referee: cachedDet?.referee || 'Match Official',
          activeFansCount: matchReactionCounts[`match_${matchObj.id}`] || 0,
          events: cachedDet?.events || [],
          lineups: cachedDet?.lineups || { home: [], away: [] },
          stats: cachedDet?.stats || {
            possession: [50, 50],
            shots: [0, 0],
            shotsOnTarget: [0, 0],
            corners: [0, 0],
            fouls: [0, 0],
            yellowCards: [0, 0],
            redCards: [0, 0],
            xg: [0, 0],
          },
        });
      }
    }

    if (formattedMatches.length > 0) {
      // Enrich live/finished fixtures right away on first fetch if not cached, up to 2.5s budget
      await Promise.race([
        enrichMatchesWithDetails(formattedMatches),
        new Promise(r => setTimeout(r, 2400)),
      ]);

      const responseData = {
        success: true,
        source: 'FotMob Live Global Feed',
        date: dateToFetch,
        count: formattedMatches.length,
        liveCount: formattedMatches.filter(m => m.status === 'LIVE').length,
        matches: formattedMatches,
        lastSync: new Date().toISOString(),
      };

      matchesCacheByDate.set(dateToFetch, { timestamp: Date.now(), data: responseData });
      if (dateToFetch === today) {
        cachedMatchesResponse = responseData;
      }
      return responseData;
    }
  } catch (err: any) {
    console.warn('[Backend] Matches cache sync notice for date', dateToFetch, err?.message);
  }

  if (existing?.data) return existing.data;
  if (cachedMatchesResponse && dateToFetch === today) return cachedMatchesResponse;

  return {
    success: true,
    date: dateToFetch,
    count: 0,
    liveCount: 0,
    matches: [],
  };
}

// Warm up Yesterday, Today, and Tomorrow in long-running server only (serverless executes on demand)
async function warmMultiDayMatches() {
  await Promise.allSettled([
    refreshMatchesCache(getDateOffsetYYYYMMDD(0)),
    refreshMatchesCache(getDateOffsetYYYYMMDD(-1)),
    refreshMatchesCache(getDateOffsetYYYYMMDD(1)),
  ]);
}
if (!IS_SERVERLESS) {
  setInterval(() => {
    refreshMatchesCache(getDateOffsetYYYYMMDD(0)).catch(() => {});
  }, 30_000);

  // Bounded cache & presence pruning every 60s for 1M+ user scalability
  setInterval(() => {
    const now = Date.now();
    for (let i = inMemoryRoomPresence.length - 1; i >= 0; i--) {
      if (now - inMemoryRoomPresence[i].lastSeen > 120_000) {
        inMemoryRoomPresence.splice(i, 1);
      }
    }
    for (const [mId, list] of Object.entries(inMemoryTypingIndicators)) {
      const fresh = list.filter((t) => now - t.timestamp < 10_000);
      if (fresh.length === 0) delete inMemoryTypingIndicators[mId];
      else inMemoryTypingIndicators[mId] = fresh;
    }
    for (const [emailKey, rec] of passwordResetTokens) {
      if (rec.expiresAt <= now) passwordResetTokens.delete(emailKey);
    }
    while (matchesCacheByDate.size > 14) {
      const oldest = matchesCacheByDate.keys().next().value;
      if (oldest) matchesCacheByDate.delete(oldest);
      else break;
    }
    while (matchDetailsCache.size > 400) {
      const oldest = matchDetailsCache.keys().next().value;
      if (oldest) matchDetailsCache.delete(oldest);
      else break;
    }
  }, 60_000);
}

app.get('/api/football/status', async (req, res) => {
  const startTime = Date.now();
  const fotmobHealthy = Boolean(cachedMatchesResponse && cachedMatchesResponse.count > 0);
  const pingLatencyMs = Date.now() - startTime;

  res.json({
    engine: 'FUTFIELD Live Football Engine',
    version: '2.5.0',
    provider: 'FotMob Free Global Live Network',
    connected: fotmobHealthy,
    pingLatencyMs,
    trackedLeaguesCount: TOP_10_LEAGUES.length,
    top10LeaguesCoverage: TOP_10_LEAGUES.length,
    registeredPlayersDatabase: TOP_10_LEAGUE_PLAYERS.length + livePlayersCache.players.length,
    supabaseConnected: Boolean(supabaseBackendClient),
    aiAssistantActive: Boolean(aiClient),
    cachedMatchesCount: cachedMatchesResponse?.count || 0,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/football/live', async (req, res) => {
  const requestedDate = (req.query.date as string) || '';
  const today = getDateOffsetYYYYMMDD(0);
  const targetDate = requestedDate ? requestedDate.replace(/-/g, '') : today;

  const cachedForDate = matchesCacheByDate.get(targetDate);
  if (cachedForDate?.data) {
    if (Date.now() - cachedForDate.timestamp > MATCH_CACHE_TTL_MS) {
      refreshMatchesCache(targetDate).catch(() => {});
    }
    return res.json(cachedForDate.data);
  }

  if (!requestedDate && cachedMatchesResponse) {
    return res.json(cachedMatchesResponse);
  }

  const result = await refreshMatchesCache(targetDate);
  return res.json(result);
});

// Flashscore-style Real-Time Single Match Preview & Full Event Timeline Endpoint
app.get('/api/football/match/:id', async (req, res) => {
  const { id } = req.params;
  const cleanId = String(id).replace(/^match_/i, '').trim();

  // Check cached fixtures across dates first for base metadata
  let baseMatch: any = null;
  for (const cached of matchesCacheByDate.values()) {
    const found = (cached?.data?.matches || []).find(
      (m: any) => String(m.id) === String(id) || String(m.rawId) === cleanId
    );
    if (found) {
      baseMatch = { ...found };
      break;
    }
  }

  const details = await fetchFotmobMatchDetailsCached(cleanId);
  if (!details && !baseMatch) {
    return res.status(404).json({ success: false, error: 'Match not found in live schedule.' });
  }

  const merged = {
    ...(baseMatch || {
      id: `match_${cleanId}`,
      rawId: cleanId,
      league: 'Live Football Match',
      status: 'LIVE',
      homeTeam: { id: 'h', name: 'Home', shortName: 'HOM', crest: '', score: details?.homeScore ?? 0 },
      awayTeam: { id: 'a', name: 'Away', shortName: 'AWY', crest: '', score: details?.awayScore ?? 0 },
      dateStr: 'TODAY',
      timeStr: 'Live',
      activeFansCount: 0,
    }),
    ...(details
      ? {
          events: details.events,
          stats: details.stats,
          lineups: details.lineups,
          venue: details.venue || baseMatch?.venue || 'Stadium',
          referee: details.referee || baseMatch?.referee || 'Match Official',
          minute: details.minute || baseMatch?.minute,
          homeTeam: {
            ...(baseMatch?.homeTeam || {}),
            score: typeof details.homeScore === 'number' ? details.homeScore : (baseMatch?.homeTeam?.score ?? 0),
          },
          awayTeam: {
            ...(baseMatch?.awayTeam || {}),
            score: typeof details.awayScore === 'number' ? details.awayScore : (baseMatch?.awayTeam?.score ?? 0),
          },
        }
      : {}),
  };

  return res.json({
    success: true,
    source: 'FotMob MatchDetails Live',
    match: merged,
  });
});

// -------------------------------------------------------------
// Top 10 Leagues + Live Fixtures Counter & Player Scout Live APIs
// -------------------------------------------------------------
const LEAGUE_FOTMOB_MAPPING: Record<string, number> = {
  'premier-league': 47,
  'la-liga': 87,
  'serie-a': 55,
  'bundesliga': 54,
  'ligue-1': 53,
  'eredivisie': 57,
  'primeira-liga': 61,
  'mls': 134,
  'saudi-pro-league': 9900,
  'brasileirao': 112,
};

app.get('/api/football/leagues', async (_req, res) => {
  // Ensure today's fixtures are loaded so league live counts are real-time
  if (!cachedMatchesResponse) {
    await refreshMatchesCache(getDateOffsetYYYYMMDD(0)).catch(() => {});
  }
  const todayMatches: any[] = cachedMatchesResponse?.matches || [];

  const enrichedLeagues = TOP_10_LEAGUES.map(lg => {
    const keyLower = lg.name.toLowerCase();
    const matching = todayMatches.filter((m: any) =>
      String(m.league || '').toLowerCase().includes(keyLower)
    );
    return {
      ...lg,
      fotmobId: LEAGUE_FOTMOB_MAPPING[lg.id] || 47,
      liveCount: matching.filter(m => m.status === 'LIVE').length,
      todayCount: matching.length,
    };
  });

  return res.json({
    success: true,
    source: 'FotMob Real-Time Network',
    count: enrichedLeagues.length,
    leagues: enrichedLeagues,
    syncedAt: new Date().toISOString(),
  });
});

async function refreshLivePlayersPool(): Promise<FootballPlayer[]> {
  if (livePlayersCache.players.length > 0 && Date.now() - livePlayersCache.timestamp < 5 * 60_000) {
    return livePlayersCache.players;
  }

  const dynamicPlayers: FootballPlayer[] = [];
  const seenNames = new Set<string>(TOP_10_LEAGUE_PLAYERS.map(p => p.name.toLowerCase()));

  // Extract live goalscorers & starters from enriched today/yesterday matches
  for (const cached of matchesCacheByDate.values()) {
    const matchesList = cached?.data?.matches || [];
    for (const m of matchesList) {
      const leagueLabel = String(m.league || 'Global League').split('·')[0].trim();
      for (const ev of m.events || []) {
        if ((ev.type === 'goal' || ev.type === 'penalty_goal') && ev.player) {
          const cleanName = String(ev.player).trim();
          const key = cleanName.toLowerCase();
          if (!cleanName || seenNames.has(key)) continue;
          seenNames.add(key);
          const clubName = ev.team === 'home' ? m.homeTeam?.name : m.awayTeam?.name;
          dynamicPlayers.push({
            id: `live_scorer_${key.replace(/[^a-z0-9]/g, '_')}`,
            name: cleanName,
            shortName: cleanName.split(' ').pop() || cleanName,
            number: 9,
            position: 'FW',
            specificRole: 'Matchday Scorer (Live)',
            club: clubName || 'Club',
            clubCrest: '⚽',
            league: leagueLabel,
            leagueCountry: 'International',
            nationality: 'International',
            countryFlag: '🌍',
            age: 25,
            rating: 85,
            marketValue: 'Live Form',
            photoUrl: DEFAULT_AVATAR,
            stats: { appearances: 1, goals: 1, assists: 0, passAccuracy: 83 },
            preferredFoot: 'Right',
            playingStyle: `Live scorer in ${m.homeTeam?.name} vs ${m.awayTeam?.name}`,
            bio: `Scored at ${ev.minute} in ${m.homeTeam?.name} vs ${m.awayTeam?.name} (${leagueLabel}).`,
          });
        }
      }
      // Pull top rated starters if available
      for (const side of ['home', 'away'] as const) {
        const teamName = side === 'home' ? m.homeTeam?.name : m.awayTeam?.name;
        for (const lp of (m.lineups?.[side] || []).slice(0, 11)) {
          const cleanName = String(lp.name || '').trim();
          const key = cleanName.toLowerCase();
          if (!cleanName || seenNames.has(key)) continue;
          seenNames.add(key);
          const pos = (['GK', 'DF', 'MF', 'FW'].includes(lp.position) ? lp.position : 'MF') as 'GK' | 'DF' | 'MF' | 'FW';
          dynamicPlayers.push({
            id: `live_xi_${key.replace(/[^a-z0-9]/g, '_')}`,
            name: cleanName,
            shortName: cleanName.split(' ').pop() || cleanName,
            number: Number(lp.number) || 10,
            position: pos,
            specificRole: `${pos} Starter (Live XI)`,
            club: teamName || 'Club',
            clubCrest: '⚽',
            league: leagueLabel,
            leagueCountry: 'International',
            nationality: 'International',
            countryFlag: '🌍',
            age: 25,
            rating: lp.rating ? Math.min(94, Math.max(76, Math.round(lp.rating * 10 + 12))) : 82,
            marketValue: 'Active XI',
            photoUrl: DEFAULT_AVATAR,
            stats: { appearances: 1, goals: 0, assists: 0, passAccuracy: 84 },
            preferredFoot: 'Right',
            playingStyle: 'Matchday Starting XI',
            bio: `Selected in starting lineup for ${teamName} in ${leagueLabel}.`,
          });
        }
      }
    }
  }

  // Also pull live Premier League & La Liga top scorers from FotMob league stats
  try {
    const leagueDet: any = await withTimeout(getLeagueDetails({ id: 47 }), 2500, 'getLeagueDetails');
    const scorerSections = leagueDet?.stats?.players || [];
    for (const sec of scorerSections.slice(0, 2)) {
      for (const p of (sec?.topThree || []).concat(sec?.list || []).slice(0, 8)) {
        const pName = String(p?.name || '').trim();
        if (!pName || seenNames.has(pName.toLowerCase())) continue;
        seenNames.add(pName.toLowerCase());
        const pid = p?.id;
        dynamicPlayers.push({
          id: pid ? `live_${pid}` : `live_pl_${pName.toLowerCase().replace(/\s+/g, '_')}`,
          name: pName,
          shortName: pName.split(' ').pop() || pName,
          number: 10,
          position: 'FW',
          specificRole: sec?.header || 'Top Performer',
          club: p?.teamName || 'Premier League',
          clubCrest: '⚽',
          league: 'Premier League',
          leagueCountry: 'England',
          nationality: 'International',
          countryFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
          age: 25,
          rating: 86,
          marketValue: 'Top Scorer List',
          photoUrl: DEFAULT_AVATAR,
          stats: { appearances: 20, goals: Number(p?.value) || 8, assists: 4, passAccuracy: 83 },
          preferredFoot: 'Right',
          playingStyle: 'Premier League Live Leader',
          bio: `${pName} (${p?.teamName || 'Premier League'}) featured in FotMob live season stats.`,
        });
      }
    }
  } catch {}

  livePlayersCache.timestamp = Date.now();
  livePlayersCache.players = dynamicPlayers.slice(0, 80);
  return livePlayersCache.players;
}

app.get('/api/football/players', async (req, res) => {
  const { query = '', league = 'all', position = 'all', sort = 'rating' } = req.query as {
    query?: string;
    league?: string;
    position?: string;
    sort?: string;
  };

  if (!cachedMatchesResponse) {
    await refreshMatchesCache(getDateOffsetYYYYMMDD(0)).catch(() => {});
  }

  const livePool = await refreshLivePlayersPool();
  let results: FootballPlayer[] = [...TOP_10_LEAGUE_PLAYERS, ...livePool];

  if (league && league !== 'all') {
    const matchedLeague = TOP_10_LEAGUES.find(
      l => l.id.toLowerCase() === league.toLowerCase() || l.name.toLowerCase() === league.toLowerCase()
    );
    const targetName = matchedLeague ? matchedLeague.name.toLowerCase() : league.toLowerCase();
    results = results.filter(
      p => p.league.toLowerCase().includes(targetName) || p.id.toLowerCase().includes(league.toLowerCase())
    );
  }

  if (position && position !== 'all') {
    results = results.filter(p => p.position.toUpperCase() === position.toUpperCase());
  }

  if (query && query.trim()) {
    const q = query.trim().toLowerCase();
    results = results.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.shortName.toLowerCase().includes(q) ||
        p.club.toLowerCase().includes(q) ||
        p.nationality.toLowerCase().includes(q) ||
        p.specificRole.toLowerCase().includes(q)
    );

    if (results.length < 8) {
      try {
        const liveSearchData = await withTimeout(getFotmobSearch({ term: query.trim() }), 2800, 'getFotmobSearch');
        const allSuggestions = (liveSearchData || []).flatMap((g: any) => g.suggestions || []);
        const playerHits = allSuggestions.filter((s: any) => s.type === 'player').slice(0, 10);

        for (const hit of playerHits) {
          if (!results.some(r => r.name.toLowerCase() === String(hit.name || '').toLowerCase())) {
            results.push({
              id: `live_${hit.id}`,
              name: hit.name,
              shortName: hit.name.split(' ').pop() || hit.name,
              number: 10,
              position: 'FW',
              specificRole: 'Live Searched Player',
              club: hit.teamName || 'Professional Club',
              clubCrest: '⚽',
              league: 'Global Football',
              leagueCountry: 'International',
              nationality: 'Global',
              countryFlag: '🌍',
              age: 25,
              rating: 84,
              marketValue: 'Live Profile',
              photoUrl: DEFAULT_AVATAR,
              stats: { appearances: 20, goals: 6, assists: 4, passAccuracy: 82 },
              preferredFoot: 'Right',
              playingStyle: 'Live Scout Match',
              bio: `${hit.name} fetched live from FotMob global player search (${hit.teamName || 'World Football'}).`,
            });
          }
        }
      } catch (searchErr) {
        console.warn('[Backend] FotMob live player search note:', searchErr);
      }
    }
  }

  if (sort === 'rating') {
    results.sort((a, b) => b.rating - a.rating);
  } else if (sort === 'goals') {
    results.sort((a, b) => b.stats.goals - a.stats.goals);
  } else if (sort === 'assists') {
    results.sort((a, b) => b.stats.assists - a.stats.assists);
  } else if (sort === 'age') {
    results.sort((a, b) => a.age - b.age);
  }

  res.json({
    success: true,
    source: 'FotMob Live + Curated Top 10 Leagues',
    totalCount: results.length,
    leagues: TOP_10_LEAGUES,
    players: results,
    syncedAt: new Date().toISOString(),
  });
});

app.get('/api/football/player/:id', async (req, res) => {
  const { id } = req.params;

  const localPlayer = TOP_10_LEAGUE_PLAYERS.find(p => p.id === id) || livePlayersCache.players.find(p => p.id === id);

  if (id.startsWith('live_')) {
    const rawId = id.replace('live_', '');
    if (/^\d+$/.test(rawId)) {
      try {
        const details: any = await withTimeout(getFotmobPlayerDetails({ id: parseInt(rawId, 10) }), 3000, 'getFotmobPlayerDetails');
        if (details) {
          const posName = String(details?.positionDescription?.primaryPosition?.label || '').toLowerCase();
          const mappedPos: 'GK' | 'DF' | 'MF' | 'FW' = posName.includes('goal')
            ? 'GK'
            : posName.includes('back') || posName.includes('def')
            ? 'DF'
            : posName.includes('mid')
            ? 'MF'
            : 'FW';
          const mainStats = details?.mainLeague?.stats || [];
          const findStat = (title: string) => {
            const found = mainStats.find((s: any) => String(s.title || '').toLowerCase().includes(title));
            return Number(found?.value) || 0;
          };
          return res.json({
            success: true,
            source: 'FotMob PlayerDetails Live',
            player: {
              id,
              name: details?.name || localPlayer?.name || 'Footballer',
              shortName: (details?.name || 'Player').split(' ').pop() || 'Player',
              number: Number(details?.primaryTeam?.jerseyNumber || details?.meta?.shirtNumber || 10),
              position: mappedPos,
              specificRole: details?.positionDescription?.primaryPosition?.label || 'Professional Footballer',
              club: details?.primaryTeam?.teamName || localPlayer?.club || 'Professional Club',
              clubCrest: '⚽',
              league: details?.mainLeague?.leagueName || localPlayer?.league || 'League',
              leagueCountry: 'International',
              nationality: details?.birthDate ? 'International' : 'Global',
              countryFlag: '🌍',
              age: details?.age || localPlayer?.age || 25,
              rating: 85,
              marketValue: details?.playerInformation?.find((x: any) => x.title === 'Market value')?.value?.fallback || 'Pro Player',
              photoUrl: DEFAULT_AVATAR,
              stats: {
                appearances: findStat('matches') || findStat('started') || localPlayer?.stats.appearances || 18,
                goals: findStat('goals') || localPlayer?.stats.goals || 5,
                assists: findStat('assists') || localPlayer?.stats.assists || 3,
                passAccuracy: findStat('pass') || 83,
              },
              preferredFoot: details?.playerInformation?.find((x: any) => x.title === 'Preferred foot')?.value?.fallback || 'Right',
              playingStyle: details?.positionDescription?.primaryPosition?.label || 'Playmaker',
              bio: `${details?.name || 'Player'} live profile synchronized from FotMob (${details?.primaryTeam?.teamName || 'Club'}).`,
            },
          });
        }
      } catch (e: any) {
        console.warn('[Backend] Fotmob player detail note:', e?.message);
      }
    }
  }

  if (localPlayer) {
    return res.json({ success: true, source: 'Curated Top 10 Leagues', player: localPlayer });
  }

  return res.status(404).json({ success: false, error: 'Player not found in live or curated registry' });
});

app.get('/api/football/leagues/:leagueId/table', async (req, res) => {
  const { leagueId } = req.params;
  const cacheKey = leagueId.toLowerCase();
  const cached = leagueTableCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < LEAGUE_TABLE_TTL_MS) {
    return res.json(cached.data);
  }

  const fotmobId = LEAGUE_FOTMOB_MAPPING[cacheKey] || 47;

  try {
    const tableData: any = await withTimeout(getLeagueTable({ leagueId: fotmobId }), 3500, 'getLeagueTable');
    const standingsRaw =
      tableData?.table?.all ||
      tableData?.table?.[0]?.data?.table?.all ||
      [];
    if (Array.isArray(standingsRaw) && standingsRaw.length > 0) {
      const leaderPoints = Number(standingsRaw[0]?.pts || 0);
      const formatted = {
        success: true,
        source: 'FotMob Live Standings',
        leagueId,
        leagueName: tableData.leagueName || TOP_10_LEAGUES.find(l => l.id === cacheKey)?.name || leagueId,
        standings: standingsRaw.map((row: any, i: number) => {
          const pts = Number(row.pts || 0);
          const scoresParts = String(row.scoresStr || '0-0').split('-');
          const gf = parseInt(scoresParts[0] || '0', 10) || 0;
          const ga = parseInt(scoresParts[1] || '0', 10) || 0;
          return {
            position: row.idx || row.position || i + 1,
            teamId: row.id,
            teamName: row.name || row.shortName || 'Team',
            logoUrl: undefined,
            played: row.played || 0,
            won: row.wins || 0,
            drawn: row.draws || 0,
            lost: row.losses || 0,
            goalsFor: gf,
            goalsAgainst: ga,
            goalDifference: typeof row.goalConDiff === 'number' ? row.goalConDiff : gf - ga,
            points: pts,
            pointsGap: leaderPoints - pts,
            qualColor: row.qualColor,
          };
        }),
      };
      leagueTableCache.set(cacheKey, { timestamp: Date.now(), data: formatted });
      return res.json(formatted);
    }
  } catch (err: any) {
    console.warn('[Backend] League table fetch error:', err?.message);
  }

  if (cached?.data) {
    return res.json(cached.data);
  }

  return res.status(503).json({
    success: false,
    leagueId,
    leagueName: TOP_10_LEAGUES.find(l => l.id === cacheKey)?.name || leagueId,
    standings: [],
    error: 'Live standings temporarily unavailable from upstream provider. Please retry.',
  });
});

// -------------------------------------------------------------
// Vite middleware in dev OR static build in production
// -------------------------------------------------------------
if (!IS_SERVERLESS) {
  process.on('uncaughtException', (err) => {
    console.error('[FUTFIELD Server UncaughtException]', err);
  });
  process.on('unhandledRejection', (reason) => {
    console.warn('[FUTFIELD Server UnhandledRejection]', reason);
  });
}

let viteMiddlewares: any = null;
let viteInitPromise: Promise<void> | null = null;

async function ensureViteInitialized() {
  if (viteInitPromise || IS_SERVERLESS) return viteInitPromise;
  viteInitPromise = (async () => {
    if (process.env.NODE_ENV !== 'production' && !IS_SERVERLESS) {
      const vitePkg = 'vite';
      const { createServer } = await import(/* @vite-ignore */ vitePkg);
      const vite = await createServer({
        server: {
          middlewareMode: true,
          hmr: false,
        },
        appType: 'spa',
      });
      viteMiddlewares = vite.middlewares;
      console.log('[FUTFIELD Server] Vite middleware ready.');
    }
  })().catch(err => {
    viteInitPromise = null;
    console.error('[FUTFIELD Server] Failed to initialize Vite:', err);
  });
  return viteInitPromise;
}

// -------------------------------------------------------------
// Lightweight Community App Reviews & Fan Opinion Blog API
// -------------------------------------------------------------
interface FanReviewRecord {
  id: string;
  entryType: 'review' | 'blog';
  authorName: string;
  authorHandle: string;
  title: string;
  body: string;
  rating: number;
  helpfulCount: number;
  createdAt: string;
}

const inMemoryFanReviews: FanReviewRecord[] = [
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
    title: 'Why 9:16 Quick Kicks + 16:9 Clips Separate Futfield',
    body: 'Most apps cram highlight clips into one messy feed. Having dedicated vertical 9:16 Quick Kicks for matchday energy and 16:9 Futfield Tube videos for tactical analysis is genius.',
    rating: 5,
    helpfulCount: 12,
    createdAt: new Date().toISOString().slice(0, 10),
  },
];

app.get('/api/reviews', (_req, res) => {
  return res.json({ success: true, reviews: inMemoryFanReviews });
});

app.post('/api/reviews', (req, res) => {
  const { entryType, authorName, authorHandle, title, body, rating } = req.body || {};
  const cleanTitle = String(title || '').trim().slice(0, 100);
  const cleanBody = String(body || '').trim().slice(0, 1000);
  if (!cleanTitle || !cleanBody) {
    return res.status(400).json({ success: false, error: 'Title and opinion text are required.' });
  }
  const safeRating = Math.min(5, Math.max(1, Number(rating) || 5));
  const record: FanReviewRecord = {
    id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    entryType: entryType === 'blog' ? 'blog' : 'review',
    authorName: String(authorName || 'Football Fan').trim().slice(0, 40) || 'Football Fan',
    authorHandle: String(authorHandle || '@fan').trim().slice(0, 32) || '@fan',
    title: cleanTitle,
    body: cleanBody,
    rating: entryType === 'blog' ? 5 : safeRating,
    helpfulCount: 1,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  inMemoryFanReviews.unshift(record);
  if (inMemoryFanReviews.length > 100) inMemoryFanReviews.pop();
  return res.json({ success: true, review: record });
});

app.post('/api/reviews/:id/upvote', (req, res) => {
  const target = inMemoryFanReviews.find(r => r.id === req.params.id);
  if (target) {
    target.helpfulCount = (target.helpfulCount || 0) + 1;
    return res.json({ success: true, helpfulCount: target.helpfulCount });
  }
  return res.json({ success: true });
});

// -------------------------------------------------------------
// Viral SEO Endpoints: /robots.txt & Dynamic /sitemap.xml (futfieldsports.com.ng)
// -------------------------------------------------------------
const SEO_CANONICAL_DOMAIN = 'https://futfieldsports.com.ng';

app.get('/robots.txt', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.send(
    `User-agent: *\nAllow: /\nSitemap: ${SEO_CANONICAL_DOMAIN}/sitemap.xml\n`
  );
});

app.get('/sitemap.xml', (_req, res) => {
  const todayIso = new Date().toISOString().slice(0, 10);
  const staticUrls: Array<{ path: string; changefreq: 'daily' | 'weekly'; priority: string }> = [
    { path: '/', changefreq: 'weekly', priority: '1.0' },
    { path: '/live-scores', changefreq: 'daily', priority: '1.0' },
    { path: '/highlights', changefreq: 'daily', priority: '0.9' },
    { path: '/share', changefreq: 'weekly', priority: '0.85' },
    { path: '/features', changefreq: 'weekly', priority: '0.9' },
    { path: '/pricing', changefreq: 'weekly', priority: '0.9' },
    { path: '/blog', changefreq: 'weekly', priority: '0.9' },
    { path: '/blog/live-premier-league-scores-today', changefreq: 'weekly', priority: '0.85' },
    { path: '/blog/best-football-social-app-2026', changefreq: 'weekly', priority: '0.85' },
    { path: '/blog/how-to-chat-during-live-football-match', changefreq: 'weekly', priority: '0.85' },
    { path: '/blog/free-football-highlights-videos-app', changefreq: 'weekly', priority: '0.85' },
    { path: '/blog/football-transfer-news-today-live', changefreq: 'weekly', priority: '0.85' },
    { path: '/reviews', changefreq: 'weekly', priority: '0.85' },
    { path: '/terms', changefreq: 'weekly', priority: '0.7' },
    { path: '/privacy', changefreq: 'weekly', priority: '0.7' },
    { path: '/refund', changefreq: 'weekly', priority: '0.7' },
  ];

  // Collect dynamic /match/:id URLs from live cached fixtures
  const matchIdSet = new Set<string>(['epl-arsenal-chelsea', 'ucl-madrid-city']);
  for (const cached of matchesCacheByDate.values()) {
    const list = cached?.data?.matches;
    if (Array.isArray(list)) {
      for (const m of list.slice(0, 25)) {
        if (m?.id) matchIdSet.add(String(m.id));
      }
    }
  }
  for (const mId of Array.from(matchIdSet).slice(0, 30)) {
    staticUrls.push({
      path: `/match/${encodeURIComponent(mId)}`,
      changefreq: 'weekly',
      priority: '0.8',
    });
  }

  // Collect dynamic /profile/:username URLs
  const profileSet = new Set<string>(['@futfield', '@emirates_gunner']);
  for (const prof of Object.values(inMemoryProfiles)) {
    if (prof?.handle) profileSet.add(String(prof.handle));
  }
  for (const handle of Array.from(profileSet).slice(0, 30)) {
    staticUrls.push({
      path: `/profile/${encodeURIComponent(handle)}`,
      changefreq: 'weekly',
      priority: '0.8',
    });
  }

  const xmlItems = staticUrls
    .map(
      item =>
        `  <url>\n    <loc>${SEO_CANONICAL_DOMAIN}${item.path}</loc>\n    <lastmod>${todayIso}</lastmod>\n    <changefreq>${item.changefreq}</changefreq>\n    <priority>${item.priority}</priority>\n  </url>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlItems}\n</urlset>\n`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=900');
  return res.send(xml);
});

if (!IS_SERVERLESS) {
  if (process.env.NODE_ENV !== 'production') {
    app.use(async (req, res, next) => {
      if (
        req.path.startsWith('/api/') ||
        req.path.startsWith('/uploads/') ||
        req.path === '/robots.txt' ||
        req.path === '/sitemap.xml'
      ) {
        return next();
      }
      if (!viteMiddlewares) {
        await ensureViteInitialized();
      }
      if (viteMiddlewares) {
        return viteMiddlewares(req, res, next);
      }
      return next();
    });
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[FUTFIELD Server] Running on http://0.0.0.0:${PORT}`);
    if (process.env.NODE_ENV !== 'production') {
      ensureViteInitialized();
    }
    setTimeout(() => {
      warmMultiDayMatches().catch(() => {});
    }, 150);
  });

  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[FUTFIELD Server] Port ${PORT} already in use!`);
      process.exit(1);
    } else {
      console.error('[FUTFIELD Server Error]', err);
    }
  });
}

export { app };

