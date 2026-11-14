-- =========================================================================
-- FUTFIELD DATABASE SCHEMA & CLEAN PURGE SCRIPT
-- Purges all test records while keeping auth.users and profile structures intact
-- =========================================================================

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  email TEXT,
  name TEXT NOT NULL,
  handle TEXT NOT NULL UNIQUE,
  avatar TEXT,
  bio TEXT DEFAULT '',
  favorite_club TEXT DEFAULT '',
  favorite_country TEXT DEFAULT '',
  favorite_players TEXT[] DEFAULT '{}',
  fan_points INTEGER DEFAULT 0,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Posts Table
CREATE TABLE IF NOT EXISTS public.posts (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  author JSONB NOT NULL,
  content TEXT NOT NULL,
  media_url TEXT,
  poll JSONB,
  likes INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Matches Table (Optional persistence for live/scheduled fixtures)
CREATE TABLE IF NOT EXISTS public.matches (
  id TEXT PRIMARY KEY,
  league TEXT NOT NULL,
  round TEXT,
  venue TEXT,
  home_team JSONB NOT NULL,
  away_team JSONB NOT NULL,
  status TEXT DEFAULT 'TODAY',
  minute TEXT,
  time_str TEXT,
  date_str TEXT,
  stats JSONB,
  events JSONB DEFAULT '[]',
  active_fans_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Videos Table
CREATE TABLE IF NOT EXISTS public.videos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration TEXT DEFAULT '0:30',
  duration_seconds INTEGER DEFAULT 30,
  creator JSONB NOT NULL,
  likes INTEGER DEFAULT 0,
  category TEXT DEFAULT 'foryou',
  hashtags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Communities Table
CREATE TABLE IF NOT EXISTS public.communities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  crest TEXT NOT NULL,
  description TEXT DEFAULT '',
  rules TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Community Members Table (Computes real fan count: SELECT COUNT(*) FROM community_members)
CREATE TABLE IF NOT EXISTS public.community_members (
  id BIGSERIAL PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id, user_id)
);

-- 7. Match Rooms Chat Table
CREATE TABLE IF NOT EXISTS public.match_rooms (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL,
  user_id TEXT,
  user_data JSONB NOT NULL,
  text TEXT NOT NULL,
  timestamp TEXT,
  reactions JSONB DEFAULT '{"thumbsUp": 0, "shocked": 0, "fire": 0, "goal": 0}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Follows Table
CREATE TABLE IF NOT EXISTS public.follows (
  id BIGSERIAL PRIMARY KEY,
  follower_id TEXT NOT NULL,
  following_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

-- 9. Predictions Table
CREATE TABLE IF NOT EXISTS public.predictions (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  predicted_score TEXT NOT NULL,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- PURGE COMMAND: TRUNCATES ALL TABLES (PRESERVING auth.users)
-- =========================================================================
TRUNCATE TABLE 
  public.posts,
  public.matches,
  public.videos,
  public.community_members,
  public.communities,
  public.match_rooms,
  public.follows,
  public.predictions
CASCADE;

-- Reset fan stats in profiles to clean state
UPDATE public.profiles 
SET 
  fan_points = 0,
  followers_count = 0,
  following_count = 0,
  posts_count = 0;

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES - OPEN ACCESS
-- =========================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Allow all on profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow all on posts" ON public.posts FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow all on matches" ON public.matches FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow all on videos" ON public.videos FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow all on communities" ON public.communities FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow all on community_members" ON public.community_members FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow all on match_rooms" ON public.match_rooms FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow all on follows" ON public.follows FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow all on predictions" ON public.predictions FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================================
-- REALTIME ENABLEMENT FOR POSTS AND MATCH_ROOMS
-- =========================================================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.posts, public.match_rooms;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- =========================================================================
-- STORAGE BUCKETS (posts, videos, avatars as public)
-- =========================================================================
DO $$ BEGIN
  INSERT INTO storage.buckets (id, name, public) VALUES ('posts', 'posts', true) ON CONFLICT (id) DO NOTHING;
  INSERT INTO storage.buckets (id, name, public) VALUES ('videos', 'videos', true) ON CONFLICT (id) DO NOTHING;
  INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

