-- FUTFIELD TUBE Supabase PostgreSQL Schema & Storage Bucket
-- Non-copyright football video & Quick Kicks platform schema

-- Storage bucket for Futfield Tube videos & thumbnails
INSERT INTO storage.buckets (id, name, public)
VALUES ('futfield-videos', 'futfield-videos', true)
ON CONFLICT (id) DO NOTHING;

-- 1. Videos & Quick Kicks
CREATE TABLE IF NOT EXISTS public.futube_videos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  fanzone_id TEXT NOT NULL,
  title VARCHAR(80) NOT NULL,
  description TEXT DEFAULT '',
  video_url TEXT NOT NULL,
  thumbnail_url TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Goals',
  tags TEXT[] DEFAULT '{}',
  watches INTEGER NOT NULL DEFAULT 0,
  cheers INTEGER NOT NULL DEFAULT 0,
  boos INTEGER NOT NULL DEFAULT 0,
  shouts_count INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'squad', 'private')),
  is_quick_kick BOOLEAN NOT NULL DEFAULT false,
  is_match_live BOOLEAN NOT NULL DEFAULT false,
  duration TEXT DEFAULT '0:30',
  duration_seconds INTEGER NOT NULL DEFAULT 30,
  quality TEXT NOT NULL DEFAULT '720p',
  has_watermark BOOLEAN NOT NULL DEFAULT true,
  boost_first_60 BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_futube_videos_category ON public.futube_videos (category);
CREATE INDEX IF NOT EXISTS idx_futube_videos_fanzone ON public.futube_videos (fanzone_id);
CREATE INDEX IF NOT EXISTS idx_futube_videos_created ON public.futube_videos (created_at DESC);

-- 2. FanZone Connects (replaces subscriptions)
CREATE TABLE IF NOT EXISTS public.futube_connects (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  fan_id TEXT NOT NULL,
  fanzone_id TEXT NOT NULL,
  alert_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fan_id, fanzone_id)
);

-- 3. Cheers (replaces likes)
CREATE TABLE IF NOT EXISTS public.futube_cheers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  video_id TEXT NOT NULL REFERENCES public.futube_videos(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (video_id, user_id)
);

-- 4. Shouts (replaces comments, supports nested replies)
CREATE TABLE IF NOT EXISTS public.futube_shouts (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL REFERENCES public.futube_videos(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT 'Supporter',
  author_handle TEXT NOT NULL DEFAULT '@fan',
  author_avatar TEXT DEFAULT '',
  text TEXT NOT NULL,
  parent_id TEXT NULL,
  cheers INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_futube_shouts_video ON public.futube_shouts (video_id, created_at DESC);

-- 5. Watch History (only records & increments watches at >= 5s viewed)
CREATE TABLE IF NOT EXISTS public.futube_watch_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  video_id TEXT NOT NULL REFERENCES public.futube_videos(id) ON DELETE CASCADE,
  watched_seconds INTEGER NOT NULL DEFAULT 0,
  counted_watch BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, video_id)
);

-- 6. Matchday Packs (replaces playlists)
CREATE TABLE IF NOT EXISTS public.futube_matchday_packs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  video_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
