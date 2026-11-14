-- =========================================================================
-- FUTFIELD DATABASE SCHEMA & ROW LEVEL SECURITY (RLS) POLICIES
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- =========================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------------
-- 1. PROFILES TABLE
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  favorite_club TEXT DEFAULT 'Not Set',
  favorite_club_logo TEXT DEFAULT '⚽',
  fan_points INT DEFAULT 0,
  location TEXT DEFAULT '',
  website TEXT DEFAULT '',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone" 
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- -------------------------------------------------------------
-- 2. FOLLOWS TABLE
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(follower_id, following_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows are viewable by everyone" 
  ON public.follows FOR SELECT USING (true);

CREATE POLICY "Users can follow other users" 
  ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow" 
  ON public.follows FOR DELETE USING (auth.uid() = follower_id);

-- -------------------------------------------------------------
-- 3. POSTS TABLE (Facebook Style)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  video_url TEXT,
  location TEXT,
  club_tag TEXT,
  privacy TEXT DEFAULT 'public',
  likes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  shares_count INT DEFAULT 0,
  is_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public posts are viewable by everyone" 
  ON public.posts FOR SELECT USING (privacy = 'public' OR auth.uid() = user_id);

CREATE POLICY "Users can create posts" 
  ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts" 
  ON public.posts FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts" 
  ON public.posts FOR DELETE USING (auth.uid() = user_id);

-- -------------------------------------------------------------
-- 4. POST LIKES, COMMENTS, BOOKMARKS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.post_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(post_id, user_id)
);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Post likes are viewable by everyone" 
  ON public.post_likes FOR SELECT USING (true);

CREATE POLICY "Users can like posts" 
  ON public.post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike posts" 
  ON public.post_likes FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES public.post_comments(id) ON DELETE CASCADE,
  likes_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments are viewable by everyone" 
  ON public.post_comments FOR SELECT USING (true);

CREATE POLICY "Users can create comments" 
  ON public.post_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" 
  ON public.post_comments FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.post_bookmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(post_id, user_id)
);

ALTER TABLE public.post_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookmarks" 
  ON public.post_bookmarks FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can bookmark posts" 
  ON public.post_bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove bookmarks" 
  ON public.post_bookmarks FOR DELETE USING (auth.uid() = user_id);

-- -------------------------------------------------------------
-- 5. VIDEOS TABLE (Reels & Highlights)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration INT DEFAULT 30,
  views INT DEFAULT 0,
  likes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  club_tag TEXT,
  privacy TEXT DEFAULT 'public',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public videos are viewable by everyone" 
  ON public.videos FOR SELECT USING (privacy = 'public' OR auth.uid() = user_id);

CREATE POLICY "Users can upload videos" 
  ON public.videos FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own videos" 
  ON public.videos FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own videos" 
  ON public.videos FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.video_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(video_id, user_id)
);

ALTER TABLE public.video_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Video likes viewable by everyone" 
  ON public.video_likes FOR SELECT USING (true);

CREATE POLICY "Users can like videos" 
  ON public.video_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike videos" 
  ON public.video_likes FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.video_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES public.video_comments(id) ON DELETE CASCADE,
  likes_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.video_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Video comments viewable by everyone" 
  ON public.video_comments FOR SELECT USING (true);

CREATE POLICY "Users can comment on videos" 
  ON public.video_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own video comments" 
  ON public.video_comments FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.video_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(video_id, user_id)
);

ALTER TABLE public.video_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Video views insertable" 
  ON public.video_views FOR INSERT WITH CHECK (true);

CREATE POLICY "Video views viewable by video owner" 
  ON public.video_views FOR SELECT USING (true);

-- -------------------------------------------------------------
-- 6. STORAGE BUCKETS SETUP
-- -------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('post-images', 'post-images', true),
  ('post-videos', 'post-videos', true),
  ('videos', 'videos', true),
  ('video-thumbnails', 'video-thumbnails', true),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Storage Access" ON storage.objects FOR SELECT USING (bucket_id IN ('post-images', 'post-videos', 'videos', 'video-thumbnails', 'avatars'));
CREATE POLICY "Authenticated Storage Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id IN ('post-images', 'post-videos', 'videos', 'video-thumbnails', 'avatars'));

-- -------------------------------------------------------------
-- 7. FAN POINTS AUTO-CALCULATION TRIGGERS
-- -------------------------------------------------------------
-- +10 per post created
CREATE OR REPLACE FUNCTION public.calc_fan_points_on_post()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET fan_points = fan_points + 10
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_fan_points_on_post ON public.posts;
CREATE TRIGGER trg_fan_points_on_post
AFTER INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.calc_fan_points_on_post();

-- +20 per video uploaded
CREATE OR REPLACE FUNCTION public.calc_fan_points_on_video()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET fan_points = fan_points + 20
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_fan_points_on_video ON public.videos;
CREATE TRIGGER trg_fan_points_on_video
AFTER INSERT ON public.videos
FOR EACH ROW EXECUTE FUNCTION public.calc_fan_points_on_video();

-- +2 per like received
CREATE OR REPLACE FUNCTION public.calc_fan_points_on_post_like()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET fan_points = fan_points + 2
  WHERE id = (SELECT user_id FROM public.posts WHERE id = NEW.post_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_fan_points_on_post_like ON public.post_likes;
CREATE TRIGGER trg_fan_points_on_post_like
AFTER INSERT ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.calc_fan_points_on_post_like();

-- +5 per comment received
CREATE OR REPLACE FUNCTION public.calc_fan_points_on_post_comment()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET fan_points = fan_points + 5
  WHERE id = (SELECT user_id FROM public.posts WHERE id = NEW.post_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_fan_points_on_post_comment ON public.post_comments;
CREATE TRIGGER trg_fan_points_on_post_comment
AFTER INSERT ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION public.calc_fan_points_on_post_comment();

-- -------------------------------------------------------------
-- 8. MATCHES & MATCH ROOMS (Professional Live Match Chat)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  home_team TEXT NOT NULL,
  home_logo_url TEXT,
  away_team TEXT NOT NULL,
  away_logo_url TEXT,
  home_score INT DEFAULT 0,
  away_score INT DEFAULT 0,
  minute TEXT DEFAULT '0',
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ht', 'finished')),
  league TEXT,
  stadium TEXT,
  start_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  home_possession INT DEFAULT 50,
  away_possession INT DEFAULT 50,
  viewers_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public matches viewable by everyone" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Authenticated users can update match live info" ON public.matches FOR UPDATE USING (true);

-- Match Rooms table
CREATE TABLE IF NOT EXISTS public.match_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID UNIQUE NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.match_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public match rooms viewable by everyone" ON public.match_rooms FOR SELECT USING (true);

-- Auto-create match room trigger on match insert
CREATE OR REPLACE FUNCTION public.auto_create_match_room()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.match_rooms (match_id)
  VALUES (NEW.id)
  ON CONFLICT (match_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_create_match_room ON public.matches;
CREATE TRIGGER trg_auto_create_match_room
AFTER INSERT ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.auto_create_match_room();

-- Match Messages table (WhatsApp quality text, image, voice note, goal events)
CREATE TABLE IF NOT EXISTS public.match_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES public.match_rooms(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_data JSONB,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'chat' CHECK (message_type IN ('chat', 'goal', 'yellow', 'red', 'sub', 'system', 'highlight')),
  media_type TEXT DEFAULT 'text' CHECK (media_type IN ('text', 'image', 'video', 'voice', 'gif')),
  media_url TEXT,
  thumbnail_url TEXT,
  voice_duration INT,
  waveform JSONB,
  reply_to_id UUID REFERENCES public.match_messages(id) ON DELETE SET NULL,
  is_pinned BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.match_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Match messages viewable by everyone" ON public.match_messages FOR SELECT USING (true);
CREATE POLICY "Users can send match messages" ON public.match_messages FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can update own messages" ON public.match_messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own messages" ON public.match_messages FOR DELETE USING (auth.uid() = user_id);

-- Message Reactions table ('🔥','⚽','❤️','😂','😱','👏')
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES public.match_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (emoji IN ('🔥','⚽','❤️','😂','😱','👏')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reactions viewable by everyone" ON public.message_reactions FOR SELECT USING (true);
CREATE POLICY "Users can add reactions" ON public.message_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove reactions" ON public.message_reactions FOR DELETE USING (auth.uid() = user_id);

-- Room Presence table (live viewers tracking)
CREATE TABLE IF NOT EXISTS public.room_presence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL,
  match_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  user_data JSONB,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(match_id, user_id)
);

ALTER TABLE public.room_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Presence viewable by everyone" ON public.room_presence FOR SELECT USING (true);
CREATE POLICY "Users can update presence" ON public.room_presence FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can refresh presence" ON public.room_presence FOR UPDATE USING (true);

-- Voice Messages table
CREATE TABLE IF NOT EXISTS public.voice_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES public.match_messages(id) ON DELETE CASCADE,
  audio_url TEXT NOT NULL,
  duration INT NOT NULL,
  waveform JSONB NOT NULL,
  transcript TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.voice_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Voice messages viewable by everyone" ON public.voice_messages FOR SELECT USING (true);

-- Storage buckets for match chat
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('match-chat-images', 'match-chat-images', true),
  ('match-chat-voices', 'match-chat-voices', true),
  ('match-chat-videos', 'match-chat-videos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Match Chat Media Access" ON storage.objects FOR SELECT USING (bucket_id IN ('match-chat-images', 'match-chat-voices', 'match-chat-videos'));
CREATE POLICY "Authenticated Match Chat Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id IN ('match-chat-images', 'match-chat-voices', 'match-chat-videos'));

-- -------------------------------------------------------------
-- 9. PAYSTACK WORLDWIDE SUBSCRIPTIONS & TRANSACTIONS TABLE
-- -------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pro_plan TEXT DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pro_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS paystack_reference TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS paystack_customer_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS paystack_subscription_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_payment_currency TEXT DEFAULT 'NGN';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'NG';

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reference TEXT UNIQUE NOT NULL,
  amount INT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  plan_type TEXT NOT NULL,
  country TEXT,
  gateway TEXT DEFAULT 'paystack',
  settlement_bank TEXT DEFAULT 'UBA',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Service role can insert transactions" ON public.transactions FOR INSERT WITH CHECK (true);


