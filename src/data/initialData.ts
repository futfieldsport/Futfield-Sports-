import {
  UserProfile,
  Post,
  Match,
  VideoItem,
  Community,
  AppNotification,
  MatchChatMessage,
} from '../types/football';

/**
 * Clean initial application state.
 * All feeds and tables start empty until populated by real database records or user actions.
 */
export const INITIAL_USER: UserProfile = {
  id: 'guest_user',
  name: 'Football Fan',
  handle: '@fan',
  avatar: '/default-avatar.jpg',
  bio: 'Football fan on FUTFIELD ⚽',
  favoriteClub: 'Not Set',
  favoriteClubCrest: '⚽',
  favoriteCountry: 'Global',
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
  isAuthenticated: false,
};

export const INITIAL_POSTS: Post[] = [];

export const INITIAL_MATCHES: Match[] = [];

export const INITIAL_VIDEOS: VideoItem[] = [];

export const INITIAL_COMMUNITIES: Community[] = [];

export const INITIAL_MATCH_CHAT: Record<string, MatchChatMessage[]> = {};

export const INITIAL_NOTIFICATIONS: AppNotification[] = [];
