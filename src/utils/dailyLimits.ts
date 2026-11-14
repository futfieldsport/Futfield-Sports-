/**
 * FUTFIELD Free Tier Daily Limits Enforcement Engine
 * Free users: Max 3 posts/images, 1 shorts reel video, 5 chat room messages per day.
 * Pro/VIP/Season pass users: Unlimited access.
 */

export const FREE_TIER_DAILY_LIMITS = {
  post: 3,
  video: 1,
  chat: 5,
} as const;

export function getDailyUsageCounts(userId: string): {
  posts: number;
  videos: number;
  chats: number;
  limits: typeof FREE_TIER_DAILY_LIMITS;
} {
  try {
    const today = new Date().toISOString().split('T')[0];
    const posts = parseInt(localStorage.getItem(`futfield_limit_post_${userId}_${today}`) || '0', 10);
    const videos = parseInt(localStorage.getItem(`futfield_limit_video_${userId}_${today}`) || '0', 10);
    const chats = parseInt(localStorage.getItem(`futfield_limit_chat_${userId}_${today}`) || '0', 10);
    return { posts, videos, chats, limits: FREE_TIER_DAILY_LIMITS };
  } catch {
    return { posts: 0, videos: 0, chats: 0, limits: FREE_TIER_DAILY_LIMITS };
  }
}

export function checkDailyLimit(
  userId: string,
  type: 'post' | 'video' | 'chat',
  isPro: boolean
): { allowed: boolean; message?: string } {
  if (isPro) return { allowed: true };

  const today = new Date().toISOString().split('T')[0];
  const key = `futfield_limit_${type}_${userId}_${today}`;
  const count = parseInt(localStorage.getItem(key) || '0', 10);

  const max = FREE_TIER_DAILY_LIMITS[type];
  if (count >= max) {
    const descriptions = {
      post: `${FREE_TIER_DAILY_LIMITS.post} posts or images per calendar day`,
      video: `${FREE_TIER_DAILY_LIMITS.video} 30-second 9:16 shorts reels video per calendar day`,
      chat: `${FREE_TIER_DAILY_LIMITS.chat} chat room messages per calendar day`,
    };
    return {
      allowed: false,
      message: `Free Tier Limit Reached: You have used your allowance of ${descriptions[type]}. Upgrade to a Pro or VIP pass for unlimited access!`,
    };
  }

  return { allowed: true };
}

export function incrementDailyLimit(userId: string, type: 'post' | 'video' | 'chat'): void {
  try {
    const today = new Date().toISOString().split('T')[0];
    const key = `futfield_limit_${type}_${userId}_${today}`;
    const count = parseInt(localStorage.getItem(key) || '0', 10);
    localStorage.setItem(key, (count + 1).toString());
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('futfield:daily-limit-updated', { detail: { userId, type } }));
    }
  } catch {}
}
