import { UserProfile, Post } from '../types/football';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

let clientSupabaseInstance: SupabaseClient | null = null;
let clientSupabasePromise: Promise<SupabaseClient | null> | null = null;

export async function getClientSupabase(): Promise<SupabaseClient | null> {
  if (clientSupabaseInstance) return clientSupabaseInstance;
  if (clientSupabasePromise) return clientSupabasePromise;

  clientSupabasePromise = (async () => {
    try {
      const res = await fetch('/api/db/supabase-config');
      if (!res.ok) return null;
      const { supabaseUrl, supabaseAnonKey } = await res.json();
      if (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('https://')) {
        clientSupabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
        return clientSupabaseInstance;
      }
    } catch {}
    return null;
  })();

  return clientSupabasePromise;
}

export async function checkBackendDbStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  provider: string;
  hasUrl: boolean;
  hasServiceRole?: boolean;
  latencyMs?: number;
  postsCount?: number;
  videosCount?: number;
  message: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/db/status');
    if (!res.ok) return { configured: false, connected: false, provider: 'supabase', hasUrl: false, message: 'Server offline' };
    return await res.json();
  } catch {
    return { configured: false, connected: false, provider: 'supabase', hasUrl: false, message: 'Local storage active' };
  }
}

export async function loginWithEmail(email: string, password: string): Promise<{
  success: boolean;
  user?: any;
  profile?: UserProfile;
  error?: string;
}> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to sign in' };
    }
    return { success: true, user: data.user, profile: data.profile };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error during login' };
  }
}

export async function signupWithEmail(
  email: string,
  password: string,
  details: {
    name: string;
    handle: string;
    favoriteClub?: string;
    favoriteCountry?: string;
  }
): Promise<{
  success: boolean;
  user?: any;
  profile?: UserProfile;
  error?: string;
}> {
  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        name: details.name,
        handle: details.handle,
        favoriteClub: details.favoriteClub,
        favoriteCountry: details.favoriteCountry,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to create account' };
    }
    return { success: true, user: data.user, profile: data.profile };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error during signup' };
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {}
}

export async function fetchServerPosts(): Promise<Post[]> {
  try {
    const res = await fetch('/api/db/posts');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.posts) ? data.posts : [];
  } catch {
    return [];
  }
}

export async function syncUserProfile(profile: UserProfile): Promise<boolean> {
  try {
    const res = await fetch('/api/db/sync-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile }),
    });
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}

export async function syncPostToBackend(post: Post): Promise<boolean> {
  try {
    const res = await fetch('/api/db/sync-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post }),
    });
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}

export async function fetchServerVideos(): Promise<any[]> {
  try {
    const res = await fetch('/api/db/videos');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.videos) ? data.videos : [];
  } catch {
    return [];
  }
}

export async function uploadServerVideo(video: any): Promise<{
  success: boolean;
  video?: any;
  copyrightStatus?: 'CLEAR' | 'WARNING' | 'BLOCKED';
  copyrightReport?: any;
  error?: string;
}> {
  try {
    const res = await fetch('/api/db/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video }),
    });
    const data = await res.json();
    return {
      success: Boolean(res.ok && data.success),
      video: data.video,
      copyrightStatus: data.copyrightStatus || data.video?.copyrightStatus,
      copyrightReport: data.copyrightReport || data.video?.copyrightReport,
      error: data.error,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Unable to publish video to backend.' };
  }
}

export async function checkVideoCopyrightOnServer(payload: {
  fileName?: string;
  title?: string;
  description?: string;
  videoUrl?: string;
  hashtags?: string[];
  clubTag?: string;
}): Promise<{
  success: boolean;
  copyrightStatus: 'CLEAR' | 'WARNING' | 'BLOCKED';
  report: any;
}> {
  try {
    const res = await fetch('/api/media/copyright-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return {
      success: Boolean(data.success),
      copyrightStatus: data.copyrightStatus || data.report?.status || 'CLEAR',
      report: data.report || null,
    };
  } catch {
    return { success: false, copyrightStatus: 'CLEAR', report: null };
  }
}

export async function fetchCopyrightEngineStatus(): Promise<{
  active: boolean;
  engine: string;
  totalScans: number;
  totalBlocked: number;
  totalWarnings: number;
  totalCleared: number;
  blockedHashesCount: number;
  activeRulesCount: number;
} | null> {
  try {
    const res = await fetch('/api/media/copyright-status');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchServerCommunities(): Promise<any[]> {
  try {
    const res = await fetch('/api/db/communities');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.communities) ? data.communities : [];
  } catch {
    return [];
  }
}

export async function createServerCommunity(community: any): Promise<{ success: boolean; community?: any }> {
  try {
    const res = await fetch('/api/db/communities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ community }),
    });
    return await res.json();
  } catch {
    return { success: false };
  }
}

export async function joinServerCommunity(communityId: string, userId: string, action: 'join' | 'leave'): Promise<{ success: boolean; count: number }> {
  try {
    const res = await fetch('/api/db/communities/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ communityId, userId, action }),
    });
    return await res.json();
  } catch {
    return { success: false, count: 0 };
  }
}

export async function createPostOnServer(post: any): Promise<{ success: boolean; post?: Post }> {
  try {
    const res = await fetch('/api/db/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post }),
    });
    return await res.json();
  } catch {
    return { success: false };
  }
}

export async function editPostOnServer(id: string, content: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/db/posts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}

export async function deletePostOnServer(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/db/posts/${id}`, { method: 'DELETE' });
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}

export async function likePostOnServer(id: string, userId: string): Promise<{ success: boolean; isLiked: boolean; likesCount: number }> {
  try {
    const res = await fetch(`/api/db/posts/${id}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return await res.json();
  } catch {
    return { success: false, isLiked: false, likesCount: 0 };
  }
}

export async function bookmarkPostOnServer(id: string, userId: string): Promise<{ success: boolean; isBookmarked: boolean }> {
  try {
    const res = await fetch(`/api/db/posts/${id}/bookmark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return await res.json();
  } catch {
    return { success: false, isBookmarked: false };
  }
}

export async function fetchPostCommentsFromServer(postId: string): Promise<any[]> {
  try {
    const res = await fetch(`/api/db/posts/${postId}/comments`);
    const data = await res.json();
    return Array.isArray(data.comments) ? data.comments : [];
  } catch {
    return [];
  }
}

export async function addPostCommentOnServer(postId: string, author: any, text: string, parentId?: string): Promise<{ success: boolean; comment?: any }> {
  try {
    const res = await fetch(`/api/db/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author, text, parentId }),
    });
    return await res.json();
  } catch {
    return { success: false };
  }
}

export async function sharePostOnServer(postId: string): Promise<number> {
  try {
    const res = await fetch(`/api/db/posts/${postId}/share`, { method: 'POST' });
    const data = await res.json();
    return data.shares || 1;
  } catch {
    return 1;
  }
}

export async function reactToPostOnServer(
  postId: string,
  userId: string,
  emoji: string
): Promise<{ success: boolean; reactions: Record<string, number>; userReactions: string[]; active: boolean }> {
  try {
    const res = await fetch(`/api/db/posts/${encodeURIComponent(postId)}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, emoji }),
    });
    return await res.json();
  } catch {
    return { success: false, reactions: {}, userReactions: [], active: false };
  }
}

export async function likeVideoOnServer(videoId: string, userId: string): Promise<{ success: boolean; isLiked: boolean; likesCount: number }> {
  try {
    const res = await fetch(`/api/db/videos/${videoId}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return await res.json();
  } catch {
    return { success: false, isLiked: false, likesCount: 0 };
  }
}

export async function reactToVideoOnServer(
  videoId: string,
  userId: string,
  emoji: string
): Promise<{ success: boolean; reactions: Record<string, number>; userReactions: string[]; active: boolean }> {
  try {
    const res = await fetch(`/api/db/videos/${encodeURIComponent(videoId)}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, emoji }),
    });
    return await res.json();
  } catch {
    return { success: false, reactions: {}, userReactions: [], active: false };
  }
}

export async function shareVideoOnServer(videoId: string): Promise<{ success: boolean; shares: number }> {
  try {
    const res = await fetch(`/api/db/videos/${encodeURIComponent(videoId)}/share`, {
      method: 'POST',
    });
    return await res.json();
  } catch {
    return { success: false, shares: 1 };
  }
}

export async function recordVideoViewOnServer(videoId: string, userId?: string): Promise<number> {
  try {
    const res = await fetch(`/api/db/videos/${videoId}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    return data.views || 1;
  } catch {
    return 1;
  }
}

export async function fetchMediaStorageStats(): Promise<any | null> {
  try {
    const res = await fetch('/api/media/stats');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchRealtimeAnalytics(): Promise<any | null> {
  try {
    const res = await fetch('/api/analytics/realtime');
    if (!res.ok) return null;
    const data = await res.json();
    return data.analytics || null;
  } catch {
    return null;
  }
}

export async function fetchVideoCommentsFromServer(videoId: string): Promise<any[]> {
  try {
    const res = await fetch(`/api/db/videos/${videoId}/comments`);
    const data = await res.json();
    return Array.isArray(data.comments) ? data.comments : [];
  } catch {
    return [];
  }
}

export async function addVideoCommentOnServer(videoId: string, author: any, text: string, parentId?: string): Promise<{ success: boolean; comment?: any }> {
  try {
    const res = await fetch(`/api/db/videos/${videoId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author, text, parentId }),
    });
    return await res.json();
  } catch {
    return { success: false };
  }
}

export async function fetchUserProfileFromServer(id: string, currentUserId?: string): Promise<any | null> {
  try {
    const url = currentUserId
      ? `/api/db/profiles/${encodeURIComponent(id)}?currentUserId=${encodeURIComponent(currentUserId)}`
      : `/api/db/profiles/${encodeURIComponent(id)}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.profile || null;
  } catch {
    return null;
  }
}

export async function fetchUserPointsHistory(id: string): Promise<{
  totalPoints: number;
  breakdown: Array<{ category: string; description: string; count: number; pointsPerUnit: number; total: number; icon: string }>;
} | null> {
  try {
    const res = await fetch(`/api/db/profiles/${encodeURIComponent(id)}/points-history`);
    const data = await res.json();
    return data;
  } catch {
    return null;
  }
}

export async function fetchUserFollowDetails(userId: string): Promise<{
  followers: string[];
  following: string[];
  followersUsers: Array<{ id: string; name: string; handle: string; avatar: string; favoriteClub?: string; fanPoints?: number }>;
  followingUsers: Array<{ id: string; name: string; handle: string; avatar: string; favoriteClub?: string; fanPoints?: number }>;
}> {
  try {
    const res = await fetch(`/api/db/follows/${encodeURIComponent(userId)}`);
    const data = await res.json();
    return {
      followers: data.followers || [],
      following: data.following || [],
      followersUsers: data.followersUsers || [],
      followingUsers: data.followingUsers || [],
    };
  } catch {
    return { followers: [], following: [], followersUsers: [], followingUsers: [] };
  }
}

export async function toggleFollowUserOnServer(followerId: string, followingId: string): Promise<{ success: boolean; following: boolean; followersCount: number }> {
  try {
    const res = await fetch('/api/db/follows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followerId, followingId }),
    });
    return await res.json();
  } catch {
    return { success: false, following: false, followersCount: 0 };
  }
}

export async function uploadMediaAsset(
  fileOrData: File | Blob | string,
  fileName: string,
  bucket = 'post-images',
  userId?: string
): Promise<string> {
  try {
    if (fileOrData instanceof File || fileOrData instanceof Blob) {
      const mimeType =
        fileOrData.type ||
        (bucket.includes('video') ? 'video/mp4' : bucket.includes('voice') ? 'audio/webm' : 'image/jpeg');
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        headers: {
          'Content-Type': mimeType,
          'x-file-name': encodeURIComponent(fileName || 'upload'),
          'x-file-type': mimeType,
          'x-bucket': bucket,
          ...(userId ? { 'x-user-id': userId } : {}),
        },
        body: fileOrData,
      });
      const data = await res.json();
      return data.success && data.url ? data.url : '';
    }

    const res = await fetch('/api/db/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileData: fileOrData, fileName, bucket, userId }),
    });
    const data = await res.json();
    return data.success && data.url ? data.url : '';
  } catch {
    return '';
  }
}

export async function fetchServerMatchMessages(matchId: string, currentUserId?: string): Promise<any[]> {
  try {
    const url = currentUserId
      ? `/api/db/match_rooms/${encodeURIComponent(matchId)}/messages?currentUserId=${encodeURIComponent(currentUserId)}`
      : `/api/db/match_rooms/${encodeURIComponent(matchId)}/messages`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.messages) ? data.messages : [];
  } catch {
    return [];
  }
}

export async function sendServerMatchMessage(matchId: string, message: any): Promise<{ success: boolean; message?: any }> {
  try {
    const res = await fetch(`/api/db/match_rooms/${encodeURIComponent(matchId)}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    return await res.json();
  } catch {
    return { success: false };
  }
}

export async function reactToMatchMessageOnServer(
  matchId: string,
  messageId: string,
  emoji: string,
  userId: string
): Promise<{ success: boolean; reactions: Record<string, number>; userReactions: string[]; hasReacted: boolean }> {
  try {
    const res = await fetch(`/api/db/match_rooms/${encodeURIComponent(matchId)}/messages/${encodeURIComponent(messageId)}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji, userId }),
    });
    return await res.json();
  } catch {
    return { success: false, reactions: {}, userReactions: [], hasReacted: false };
  }
}

export async function deleteMatchMessageOnServer(
  matchId: string,
  messageId: string,
  forEveryone = true
): Promise<boolean> {
  try {
    const res = await fetch(`/api/db/match_rooms/${encodeURIComponent(matchId)}/messages/${encodeURIComponent(messageId)}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ forEveryone }),
    });
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}

export async function pinMatchMessageOnServer(
  matchId: string,
  messageId: string,
  isPinned: boolean
): Promise<boolean> {
  try {
    const res = await fetch(`/api/db/match_rooms/${encodeURIComponent(matchId)}/messages/${encodeURIComponent(messageId)}/pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPinned }),
    });
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}

export async function sendMatchRoomPresence(
  matchId: string,
  user: any
): Promise<{ viewersCount: number; viewers: any[] }> {
  try {
    const res = await fetch(`/api/db/match_rooms/${encodeURIComponent(matchId)}/presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user }),
    });
    return await res.json();
  } catch {
    return { viewersCount: 0, viewers: [] };
  }
}

export async function leaveMatchRoomPresence(
  matchId: string,
  userId: string
): Promise<{ viewersCount: number; viewers: any[] }> {
  try {
    const res = await fetch(`/api/db/match_rooms/${encodeURIComponent(matchId)}/presence/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return await res.json();
  } catch {
    return { viewersCount: 0, viewers: [] };
  }
}

export async function fetchMatchRoomPresence(
  matchId: string
): Promise<{ viewersCount: number; viewers: any[] }> {
  try {
    const res = await fetch(`/api/db/match_rooms/${encodeURIComponent(matchId)}/presence`);
    return await res.json();
  } catch {
    return { viewersCount: 0, viewers: [] };
  }
}

export async function sendMatchTypingStatus(
  matchId: string,
  user: any,
  isTyping: boolean,
  isRecording = false
): Promise<void> {
  try {
    await fetch(`/api/db/match_rooms/${encodeURIComponent(matchId)}/typing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, isTyping, isRecording }),
    });
  } catch {}
}

export async function fetchMatchTypingStatus(
  matchId: string
): Promise<{ typingFans: any[] }> {
  try {
    const res = await fetch(`/api/db/match_rooms/${encodeURIComponent(matchId)}/typing`);
    return await res.json();
  } catch {
    return { typingFans: [] };
  }
}

export async function triggerMatchEventWebhook(
  matchId: string,
  eventData: { eventType: string; minute: string; player: string; team: string; text?: string }
): Promise<any> {
  try {
    const res = await fetch(`/api/db/match_rooms/${encodeURIComponent(matchId)}/event-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData),
    });
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * AI Match Prediction Service (Analyzes team form, stats, win-probability)
 */
export async function fetchAiMatchPrediction(
  homeTeam: string,
  awayTeam: string,
  league?: string,
  homeScore?: number,
  awayScore?: number
): Promise<{
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  predictedScore: string;
  homeForm: string[];
  awayForm: string[];
  tacticalBreakdown: string;
  keyBattles: string[];
  starPlayer: string;
} | null> {
  try {
    const res = await fetch('/api/ai/match-prediction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ homeTeam, awayTeam, league, homeScore, awayScore }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.prediction || null;
  } catch {
    return null;
  }
}

export interface MatchRoomRealtimeHandlers {
  onNewMessage?: (msg: any) => void;
  onReactionUpdated?: (data: { messageId: string; reactions: Record<string, number>; userReactions?: string[] }) => void;
  onMessageDeleted?: (data: { messageId: string; forEveryone?: boolean }) => void;
  onMessagePinned?: (data: { messageId: string; isPinned: boolean; message?: any }) => void;
  onTypingChanged?: (typingFans: any[]) => void;
  onPresenceUpdated?: (presence: { viewersCount: number; viewers: any[] }) => void;
  onMatchEvent?: (event: any) => void;
}

/**
 * Unified Realtime Match Room Subscription
 * Subscribes to Supabase Realtime Channels (postgres changes & broadcast)
 * and connects to Server-Sent Events (SSE) for instant zero-latency message sync.
 */
export function subscribeToMatchRoomRealtime(
  matchId: string,
  currentUser: any,
  handlers: MatchRoomRealtimeHandlers
): () => void {
  let isCleanedUp = false;
  let supabaseChannel: RealtimeChannel | null = null;
  let eventSource: EventSource | null = null;

  // 1. Connect Supabase Realtime Channel if client initialized
  getClientSupabase().then(client => {
    if (isCleanedUp || !client) return;
    try {
      supabaseChannel = client.channel(`match_room_${matchId}`, {
        config: {
          presence: { key: currentUser?.id || 'guest' },
        },
      });

      // Postgres message insertions
      supabaseChannel
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'match_messages',
            filter: `match_id=eq.${matchId}`,
          },
          payload => {
            const row = payload.new as any;
            if (row && handlers.onNewMessage) {
              handlers.onNewMessage({
                id: row.id,
                matchId: row.match_id,
                user: row.user_data || { name: 'Fan', handle: '@fan', avatar: '' },
                text: row.content,
                content: row.content,
                messageType: row.message_type || 'chat',
                mediaType: row.media_type || 'text',
                mediaUrl: row.media_url,
                thumbnailUrl: row.thumbnail_url,
                timestamp: 'Live',
                reactions: {},
                userReactions: [],
                status: 'delivered',
              });
            }
          }
        )
        .on('presence', { event: 'sync' }, () => {
          if (!supabaseChannel) return;
          const state = supabaseChannel.presenceState();
          const viewers = Object.values(state).flat().map((p: any) => p.user).filter(Boolean);
          handlers.onPresenceUpdated?.({
            viewersCount: viewers.length,
            viewers: viewers.slice(0, 15),
          });
        })
        .on('broadcast', { event: 'typing' }, payload => {
          if (payload.payload?.typingFans) {
            handlers.onTypingChanged?.(payload.payload.typingFans);
          }
        })
        .subscribe(status => {
          if (status === 'SUBSCRIBED' && currentUser) {
            supabaseChannel?.track({
              user: {
                id: currentUser.id,
                name: currentUser.name,
                handle: currentUser.handle,
                avatar: currentUser.avatar,
              },
              online_at: new Date().toISOString(),
            });
          }
        });
    } catch (err) {
      console.warn('[Realtime] Supabase channel initialization fallback to SSE:', err);
    }
  });

  // 2. Connect Server-Sent Events (SSE) Stream
  try {
    eventSource = new EventSource(`/api/db/match_rooms/${encodeURIComponent(matchId)}/stream`);

    eventSource.addEventListener('new_message', (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data);
        handlers.onNewMessage?.(msg);
      } catch {}
    });

    eventSource.addEventListener('reaction_updated', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        handlers.onReactionUpdated?.(data);
      } catch {}
    });

    eventSource.addEventListener('message_deleted', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        handlers.onMessageDeleted?.(data);
      } catch {}
    });

    eventSource.addEventListener('message_pinned', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        handlers.onMessagePinned?.(data);
      } catch {}
    });

    eventSource.addEventListener('presence_updated', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        handlers.onPresenceUpdated?.(data);
      } catch {}
    });

    eventSource.addEventListener('typing_changed', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        handlers.onTypingChanged?.(data.typingFans || []);
      } catch {}
    });

    eventSource.addEventListener('match_event', (e: MessageEvent) => {
      try {
        const eventMsg = JSON.parse(e.data);
        handlers.onMatchEvent?.(eventMsg);
        handlers.onNewMessage?.(eventMsg);
      } catch {}
    });

    eventSource.onerror = () => {
      // Reconnection handled automatically by browser EventSource
    };
  } catch (err) {
    console.warn('[Realtime] EventSource error:', err);
  }

  // Cleanup subscriber
  return () => {
    isCleanedUp = true;
    if (supabaseChannel) {
      try {
        supabaseChannel.unsubscribe();
      } catch {}
    }
    if (eventSource) {
      try {
        eventSource.close();
      } catch {}
    }
  };
}

export interface SupportTicket {
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
}

export async function fetchSupportTickets(userId?: string): Promise<SupportTicket[]> {
  try {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const res = await fetch(`/api/support/tickets${query}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.tickets) ? data.tickets : [];
  } catch {
    return [];
  }
}

export async function submitSupportTicket(payload: {
  userId?: string;
  name: string;
  email: string;
  category: string;
  priority?: 'Normal' | 'High' | 'Urgent';
  subject: string;
  message: string;
  channel?: 'contact_form' | 'email_desk';
}): Promise<{ success: boolean; ticket?: SupportTicket; error?: string }> {
  try {
    const res = await fetch('/api/support/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err?.message || 'Unable to submit support request.' };
  }
}

export async function updateSupportTicketStatus(
  id: string,
  status: 'Open' | 'In Review' | 'Resolved'
): Promise<{ success: boolean; ticket?: SupportTicket }> {
  try {
    const res = await fetch(`/api/support/tickets/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return await res.json();
  } catch {
    return { success: false };
  }
}
