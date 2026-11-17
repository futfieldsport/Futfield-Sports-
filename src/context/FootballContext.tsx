import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { haptics } from '../utils/haptics';
import { saveCachedMatches, getCachedMatches } from '../utils/offlineCache';
import { checkDailyLimit, incrementDailyLimit } from '../utils/dailyLimits';
import {
  UserProfile,
  Post,
  Match,
  VideoItem,
  Community,
  AppNotification,
  MatchChatMessage,
  PostComment,
} from '../types/football';
import {
  INITIAL_USER,
  INITIAL_COMMUNITIES,
  INITIAL_POSTS,
  INITIAL_MATCHES,
  INITIAL_VIDEOS,
  INITIAL_MATCH_CHAT,
  INITIAL_NOTIFICATIONS,
} from '../data/initialData';
import {
  syncUserProfile,
  syncPostToBackend,
  createPostOnServer,
  logoutUser,
  fetchServerPosts,
  fetchServerVideos,
  uploadServerVideo,
  fetchServerCommunities,
  createServerCommunity,
  joinServerCommunity,
  fetchServerMatchMessages,
  sendServerMatchMessage,
  reactToMatchMessageOnServer,
  deleteMatchMessageOnServer,
  pinMatchMessageOnServer,
  toggleFollowUserOnServer,
  reactToPostOnServer,
  reactToVideoOnServer,
  shareVideoOnServer,
  deleteVideoOnServer,
  fetchMediaStorageStats,
  fetchRealtimeAnalytics,
} from '../services/supabaseClient';
import { translateText } from '../services/footballAi';
import { applyRouteSeoMetadata, resolvePathFromAppState } from '../utils/seo';
import type { SharePayload } from '../utils/share';
import { scrollToTopInstant } from '../utils/scroll';

export type MainTab = 'home' | 'scores' | 'videos' | 'communities' | 'menu' | 'profile' | 'settings' | 'studio' | 'pricing' | 'support' | 'blog' | 'reviews' | 'share';

export type SupportLegalSection =
  | 'support'
  | 'resources'
  | 'contact'
  | 'email'
  | 'privacy'
  | 'terms'
  | 'refund'
  | 'guidelines'
  | 'cookies';

const DEFAULT_CREATOR_AVATAR = '/assets/aistudio/IMG-20261106-WA6972_a4f2c4ba.jpg';

export type TubeSubView = 'feed' | 'watch' | 'kicks' | 'upload' | 'fanzone';

export function normalizeVideoItem(raw: any): VideoItem {
  const creatorObj = raw?.creator && typeof raw.creator === 'object' ? raw.creator : {};
  const authorObj = raw?.author && typeof raw.author === 'object' ? raw.author : {};
  const fallbackHandle = raw?.fanzoneHandle || creatorObj.handle || authorObj.handle || (raw?.userId ? `@fan_${String(raw.userId).slice(0, 6)}` : '@fanzone');
  const watchesVal = Number(raw?.watches ?? raw?.views ?? 0);
  const cheersVal = Number(raw?.cheers ?? raw?.likes ?? 0);
  const shoutsVal = Number(raw?.shoutsCount ?? raw?.commentsCount ?? 0);
  const isQuickKick = Boolean(raw?.isQuickKick ?? (raw?.aspectRatio === '9:16' || raw?.videoKind === 'short'));
  return {
    ...raw,
    id: raw?.id || `ft_${Date.now()}`,
    title: raw?.title || 'Matchday Highlight',
    description: raw?.description || '',
    videoUrl: raw?.videoUrl || '',
    thumbnailUrl: raw?.thumbnailUrl || '',
    duration: raw?.duration || '0:30',
    durationSeconds: Number(raw?.durationSeconds) || 30,
    views: watchesVal,
    watches: watchesVal,
    likes: cheersVal,
    cheers: cheersVal,
    boos: Number(raw?.boos) || 0,
    commentsCount: shoutsVal,
    shoutsCount: shoutsVal,
    shares: Number(raw?.shares) || 0,
    isLiked: Boolean(raw?.hasCheered ?? raw?.isLiked),
    hasCheered: Boolean(raw?.hasCheered ?? raw?.isLiked),
    hasBooed: Boolean(raw?.hasBooed),
    isSaved: Boolean(raw?.isSaved),
    isQuickKick,
    tubeCategory: raw?.tubeCategory || (isQuickKick ? 'Quick Kicks' : 'Goals'),
    boostFirst60: Boolean(raw?.boostFirst60 ?? (Number(raw?.durationSeconds || 30) <= 60)),
    fanzoneId: raw?.fanzoneId || fallbackHandle,
    fanzoneName: raw?.fanzoneName || creatorObj.name || authorObj.name || 'FanZone Creator',
    fanzoneHandle: fallbackHandle,
    fanzoneAvatar: raw?.fanzoneAvatar || creatorObj.avatar || authorObj.avatar || DEFAULT_CREATOR_AVATAR,
    squadCount: Number(raw?.squadCount) || 1,
    hashtags: Array.isArray(raw?.hashtags) ? raw.hashtags : [],
    creator: {
      name: raw?.fanzoneName || creatorObj.name || authorObj.name || 'FanZone Creator',
      handle: fallbackHandle,
      subscribers: creatorObj.subscribers || `${Number(raw?.squadCount) || 1} Squad`,
      avatar: raw?.fanzoneAvatar || creatorObj.avatar || authorObj.avatar || DEFAULT_CREATOR_AVATAR,
      isSubscribed: Boolean(raw?.isConnected ?? creatorObj.isSubscribed),
      isVerified: Boolean(creatorObj.isVerified),
    },
  } as VideoItem;
}

export function isTestArtifactPost(raw: any): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const id = String(raw.id || '').toLowerCase();
  const handle = String(raw.author?.handle || '').toLowerCase();
  const name = String(raw.author?.name || '').toLowerCase();
  const content = String(raw.content || '').toLowerCase();
  const mediaUrl = String(raw.mediaUrl || raw.imageUrl || '').toLowerCase();
  return (
    id.startsWith('post_test_') ||
    handle === '@testfan' ||
    name === 'test fan' ||
    content.includes('testing live post #futfield') ||
    mediaUrl.includes('9m6n_test.png')
  );
}

export function isTestArtifactVideo(raw: any): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const id = String(raw.id || '').toLowerCase();
  const title = String(raw.title || '').toLowerCase();
  const videoUrl = String(raw.videoUrl || '').toLowerCase();
  const handle = String(raw.author?.handle || raw.creator?.handle || '').toLowerCase();
  return (
    id === 'vid_1794743322269' ||
    handle === '@testfan' ||
    (title === 'training highlight' && videoUrl.includes('/uploads/videos/sample.mp4'))
  );
}

export function normalizePostItem(raw: any): Post {
  const authorObj = raw?.author && typeof raw.author === 'object' ? raw.author : {};
  const creatorObj = raw?.creator && typeof raw.creator === 'object' ? raw.creator : {};
  return {
    ...raw,
    id: raw?.id || `post_${Date.now()}`,
    content: raw?.content || '',
    timestamp: raw?.timestamp || 'Recently',
    likes: Number(raw?.likes) || 0,
    isLiked: Boolean(raw?.isLiked),
    commentsCount: Number(raw?.commentsCount) || 0,
    shares: Number(raw?.shares) || 0,
    reposts: Number(raw?.reposts) || 0,
    tags: Array.isArray(raw?.tags) ? raw.tags : [],
    category: raw?.category || 'foryou',
    author: {
      name: authorObj.name || creatorObj.name || 'Football Supporter',
      handle: authorObj.handle || creatorObj.handle || (raw?.userId ? `@user_${String(raw.userId).slice(0, 6)}` : '@fan'),
      avatar: authorObj.avatar || creatorObj.avatar || DEFAULT_CREATOR_AVATAR,
      clubBadge: authorObj.clubBadge || raw?.clubTag || undefined,
      isVerified: Boolean(authorObj.isVerified),
    },
  } as Post;
}

interface FootballContextType {
  user: UserProfile;
  updateUser: (fields: Partial<UserProfile>) => void;
  addFanPoints: (points: number, reason?: string) => void;
  refreshAndClearProfile: () => void;
  
  // Navigation & view
  activeTab: MainTab;
  setActiveTab: (tab: MainTab) => void;
  activeBlogSlug: string | null;
  openBlogArticle: (slug?: string | null) => void;
  supportSection: SupportLegalSection;
  setSupportSection: (section: SupportLegalSection) => void;
  supportPrefillCategory: string | null;
  openSupportLegalPage: (section: SupportLegalSection, prefillCategory?: string) => void;
  canGoBack: boolean;
  goBack: () => void;
  registerBackHandler: (handler: (() => boolean) | null) => void;
  viewingProfileUserId: string | null;
  setViewingProfileUserId: (id: string | null) => void;
  navigateToProfile: (userIdOrHandle?: string) => void;
  toggleFollowUser: (targetUserId: string) => Promise<boolean>;
  mobileFrameMode: boolean;
  setMobileFrameMode: (val: boolean | ((prev: boolean) => boolean)) => void;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  clubTheme: string;
  setClubTheme: (theme: string) => void;
  dataSavingMode: boolean;
  setDataSavingMode: (val: boolean) => void;
  refreshFrequency: '15s' | '30s' | '60s';
  setRefreshFrequency: (freq: '15s' | '30s' | '60s') => void;
  goalSoundEnabled: boolean;
  setGoalSoundEnabled: (val: boolean) => void;
  cardAlertsEnabled: boolean;
  setCardAlertsEnabled: (val: boolean) => void;
  varAlertsEnabled: boolean;
  setVarAlertsEnabled: (val: boolean) => void;
  dmPrivacy: 'all' | 'followers' | 'verified';
  setDmPrivacy: (val: 'all' | 'followers' | 'verified') => void;
  readReceiptsEnabled: boolean;
  setReadReceiptsEnabled: (val: boolean) => void;
  clearAppCache: () => { clearedKeys: number };
  showSplash: boolean;
  setShowSplash: (val: boolean) => void;
  replaySplash: () => void;
  
  // Posts
  posts: Post[];
  addPost: (data: {
    content: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
    imageUrl?: string;
    videoUrl?: string;
    mediaSizeBytes?: number;
    mediaSizeMb?: number;
    thumbnailUrl?: string;
    videoKind?: 'short' | 'video';
    aspectRatio?: '9:16' | '16:9';
    durationSeconds?: number;
    width?: number;
    height?: number;
    pollQuestion?: string;
    pollOptions?: string[];
    tags?: string[];
    category?: 'foryou' | 'following' | 'trending';
    communityId?: string;
    location?: string;
    clubTag?: string;
    feeling?: string;
    privacy?: 'public' | 'followers' | 'private';
  }) => void;
  toggleLikePost: (postId: string) => void;
  reactToPost: (postId: string, emoji: string) => Promise<void>;
  toggleRepost: (postId: string) => void;
  toggleSavePost: (postId: string) => void;
  votePoll: (postId: string, optionId: string) => void;
  addCommentToPost: (postId: string, text: string) => void;
  translatePostContent: (postId: string) => Promise<void>;
  
  // Matches & Match Rooms
  matches: Match[];
  activeMatchRoom: Match | null;
  openMatchRoom: (match: Match) => void;
  closeMatchRoom: () => void;
  matchChats: Record<string, MatchChatMessage[]>;
  sendMatchMessage: (
    matchId: string,
    text: string,
    options?: {
      mediaType?: 'text' | 'image' | 'video' | 'voice' | 'gif';
      mediaUrl?: string;
      thumbnailUrl?: string;
      voiceDuration?: number;
      waveform?: number[];
      replyToId?: string;
      replyToMessage?: any;
      messageType?: any;
    }
  ) => Promise<void>;
  reactToMessage: (matchId: string, messageId: string, reactionType: string) => void;
  deleteMatchMessage: (matchId: string, messageId: string, forEveryone?: boolean) => Promise<void>;
  pinMatchMessage: (matchId: string, messageId: string, isPinned: boolean) => Promise<void>;
  
  // Futfield Tube & Quick Kicks
  videos: VideoItem[];
  activeVideoIndex: number;
  setActiveVideoIndex: (idx: number) => void;
  latestUploadedVideoId: string | null;
  setLatestUploadedVideoId: (id: string | null) => void;
  tubeSubView: TubeSubView;
  setTubeSubView: (view: TubeSubView) => void;
  tubeWatchVideoId: string | null;
  setTubeWatchVideoId: (id: string | null) => void;
  tubeFanZoneHandle: string | null;
  setTubeFanZoneHandle: (handle: string | null) => void;
  openFanZone: (usernameOrHandle: string) => void;
  openTubeUpload: () => void;
  openQuickKicks: (videoId?: string) => void;
  openVideoInReels: (videoId: string) => void;
  toggleLikeVideo: (videoId: string) => void;
  reactToVideo: (videoId: string, emoji: string) => Promise<void>;
  shareVideo: (videoId: string) => Promise<number>;
  toggleSaveVideo: (videoId: string) => void;
  toggleSubscribeCreator: (creatorHandle: string) => void;
  addVideo: (data: {
    title: string;
    description: string;
    videoUrl: string;
    thumbnailUrl?: string;
    clubTag?: string;
    privacy?: 'public' | 'followers' | 'private';
    visibility?: 'public' | 'squad' | 'private';
    category?: VideoItem['category'];
    tubeCategory?: string;
    hashtags?: string[];
    duration?: string;
    durationSeconds?: number;
    sizeBytes?: number;
    sizeMb?: number;
    videoKind?: 'short' | 'video';
    aspectRatio?: '9:16' | '16:9';
    isQuickKick?: boolean;
    width?: number;
    height?: number;
    copyrightStatus?: 'CLEAR' | 'WARNING' | 'BLOCKED';
    copyrightReport?: any;
    skipAutoNavigate?: boolean;
  }) => Promise<VideoItem | null>;
  deleteVideo: (videoId: string) => Promise<boolean>;
  
  // Real-time Analytics & Media MB Storage Stats
  realtimeAnalytics: {
    totalViews: number;
    totalLikes: number;
    totalReactions: number;
    totalShares: number;
    totalComments: number;
    trendingVideos: any[];
    [key: string]: any;
  };
  mediaStorageStats: {
    imageCount: number;
    videoCount: number;
    totalFiles: number;
    totalImageBytes: number;
    totalVideoBytes: number;
    totalBytes: number;
    totalImageMb: number;
    totalVideoMb: number;
    totalMb: number;
    images: any[];
    videos: any[];
    recentUploads: any[];
    [key: string]: any;
  };
  refreshMediaAndAnalytics: () => Promise<void>;
  
  // Communities
  communities: Community[];
  addCommunity: (data: { name: string; category: Community['category']; crest: string; description: string; rules?: string[] }) => Promise<void>;
  toggleJoinCommunity: (communityId: string) => void;
  selectedCommunity: Community | null;
  setSelectedCommunity: (c: Community | null) => void;
  
  // Notifications
  notifications: AppNotification[];
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  unreadNotificationsCount: number;
  notificationsModalOpen: boolean;
  setNotificationsModalOpen: (open: boolean) => void;
  addNotification: (n: Omit<AppNotification, 'id' | 'time' | 'isRead'>) => void;
  
  // Modals & Auth
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  logout: () => Promise<void>;
  aiDrawerOpen: boolean;
  setAiDrawerOpen: (open: boolean) => void;
  searchModalOpen: boolean;
  setSearchModalOpen: (open: boolean) => void;
  showIntro: boolean;
  setShowIntro: (open: boolean) => void;
  showWelcome: boolean;
  setShowWelcome: (open: boolean) => void;
  showClubSelection: boolean;
  setShowClubSelection: (open: boolean) => void;
  activeToastNotification: AppNotification | null;
  dismissToastNotification: () => void;
  playerScoutModalOpen: boolean;
  setPlayerScoutModalOpen: (open: boolean) => void;
  fetchLiveMatches: (dateStr?: string) => Promise<void>;
  matchesLoading: boolean;

  // Connected Creators System (Priority Feed & Direct User Exploration)
  connectedCreators: string[];
  toggleConnectCreator: (handle: string, userDetails?: { name: string; avatar: string; clubBadge?: string }) => void;
  isCreatorConnected: (handle: string) => boolean;
  selectedCreatorForProfile: { handle: string; name: string; avatar: string; clubBadge?: string } | null;
  openCreatorProfile: (creator: { handle: string; name: string; avatar: string; clubBadge?: string }) => void;
  closeCreatorProfile: () => void;

  // Creator Monetization Wallet
  creatorWallet: {
    userId: string;
    balance: number;
    totalEarned: number;
    tipsReceived: number;
    adRevenue: number;
    subscriptions: number;
    transactions: any[];
  };
  requestPayout: (amount: number, method: string, destination: string) => Promise<boolean>;
  fetchMonetizationAdvice: () => Promise<any>;
  monetizationModalOpen: boolean;
  setMonetizationModalOpen: (open: boolean) => void;
  pricingModalOpen: boolean;
  setPricingModalOpen: (open: boolean) => void;
  shareModalPayload: SharePayload | null;
  openShareSheet: (payload: SharePayload) => void;
  closeShareSheet: () => void;
  targetPostId: string | null;
  setTargetPostId: (id: string | null) => void;
}

const FootballContext = createContext<FootballContextType | undefined>(undefined);

export const FootballProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Purge any stale client mock / test-fan records from previous runs on initialization
  useEffect(() => {
    try {
      const isPurged = localStorage.getItem('futfield_profile_v6_cleared');
      if (!isPurged) {
        localStorage.removeItem('futfield_user');
        localStorage.removeItem('futfield_posts');
        localStorage.removeItem('futfield_matches');
        localStorage.removeItem('futfield_videos');
        localStorage.removeItem('futfield_communities');
        localStorage.setItem('futfield_profile_v6_cleared', 'true');
        setUser(INITIAL_USER);
      }
      if (!localStorage.getItem('futfield_test_fan_purged_v2')) {
        setPosts(prev => prev.filter(p => !isTestArtifactPost(p)));
        setVideos(prev => prev.filter(v => !isTestArtifactVideo(v)));
        setConnectedCreators(prev => prev.filter(h => h.toLowerCase() !== '@testfan'));
        localStorage.setItem('futfield_test_fan_purged_v2', 'true');
      }
    } catch {}
  }, []);

  // Load user profile with clean zero defaults
  const [user, setUser] = useState<UserProfile>(() => {
    try {
      const isPurged = localStorage.getItem('futfield_profile_v6_cleared');
      if (!isPurged) return INITIAL_USER;
      const saved = localStorage.getItem('futfield_user');
      return saved ? JSON.parse(saved) : INITIAL_USER;
    } catch {
      return INITIAL_USER;
    }
  });

  // Instant app entry — no blocking 5-second splash gate on load (can still replay from Settings)
  const [showSplash, setShowSplash] = useState<boolean>(false);
  const replaySplash = () => setShowSplash(true);

  // Clear and refresh profile feature
  const refreshAndClearProfile = () => {
    const refreshed: UserProfile = {
      ...INITIAL_USER,
      id: user.id || 'guest_user',
      name: user.name || 'Football Fan',
      handle: user.handle || '@fan',
      avatar: user.avatar || INITIAL_USER.avatar,
      favoriteClub: user.favoriteClub || 'Not Set',
      favoriteClubCrest: user.favoriteClubCrest || '⚽',
      fanPoints: 0,
      weeklyPoints: 0,
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      badges: [],
      isAuthenticated: user.isAuthenticated || false,
    };
    setUser(refreshed);
    try {
      localStorage.setItem('futfield_user', JSON.stringify(refreshed));
      localStorage.setItem('futfield_profile_v6_cleared', 'true');
    } catch {}
    syncUserProfile(refreshed).catch(() => {});
    addNotification({
      title: 'Profile Cleared & Refreshed',
      body: 'Fan points, following, and followers have been cleared and refreshed.',
      type: 'system',
    });
  };

  const [showIntro, setShowIntro] = useState<boolean>(false);
  const [showWelcome, setShowWelcome] = useState<boolean>(false);
  const [showClubSelection, setShowClubSelection] = useState<boolean>(false);
  const [activeToastNotification, setActiveToastNotification] = useState<AppNotification | null>(null);

  const getInitialUrlRoute = () => {
    const empty = {
      tab: 'home' as MainTab,
      support: 'support' as SupportLegalSection,
      blogSlug: null as string | null,
      profileId: null as string | null,
      matchId: null as string | null,
      videoId: null as string | null,
      postId: null as string | null,
      tubeSubView: 'feed' as TubeSubView,
      fanzoneHandle: null as string | null,
    };
    if (typeof window === 'undefined') {
      return empty;
    }
    const rawPath = window.location.pathname || '/';
    const p = rawPath.toLowerCase();
    const params = new URLSearchParams(window.location.search);
    const sharedVideoId = params.get('video')?.trim() || null;
    const sharedPostId = params.get('post')?.trim() || null;

    if (sharedVideoId) {
      return { ...empty, tab: 'videos' as MainTab, videoId: sharedVideoId, tubeSubView: 'watch' as TubeSubView };
    }
    if (sharedPostId) {
      return { ...empty, tab: 'home' as MainTab, postId: sharedPostId };
    }
    if (p === '/tube' || p === '/tube/') {
      return { ...empty, tab: 'videos' as MainTab, tubeSubView: 'feed' as TubeSubView };
    }
    if (p === '/tube/kicks' || p === '/tube/kicks/') {
      return { ...empty, tab: 'videos' as MainTab, tubeSubView: 'kicks' as TubeSubView };
    }
    if (p === '/tube/upload' || p === '/tube/upload/') {
      return { ...empty, tab: 'videos' as MainTab, tubeSubView: 'upload' as TubeSubView };
    }
    if (p.startsWith('/tube/watch/')) {
      const vid = decodeURIComponent(rawPath.replace(/^\/tube\/watch\//i, '')).trim() || null;
      return { ...empty, tab: 'videos' as MainTab, videoId: vid, tubeSubView: 'watch' as TubeSubView };
    }
    if (p.startsWith('/videos/') || p.startsWith('/video/')) {
      const vid = decodeURIComponent(rawPath.replace(/^\/(?:videos|video)\//i, '')).trim() || null;
      return { ...empty, tab: 'videos' as MainTab, videoId: vid, tubeSubView: 'watch' as TubeSubView };
    }
    if (p.startsWith('/fanzone/')) {
      const fz = decodeURIComponent(rawPath.replace(/^\/fanzone\//i, '')).trim() || null;
      return { ...empty, tab: 'videos' as MainTab, tubeSubView: 'fanzone' as TubeSubView, fanzoneHandle: fz };
    }
    if (p === '/live-scores') return { ...empty, tab: 'scores' as MainTab };
    if (p.startsWith('/live/')) {
      const mId = decodeURIComponent(rawPath.replace(/^\/live\//i, '')).trim() || null;
      return { ...empty, tab: 'scores' as MainTab, matchId: mId };
    }
    if (p === '/features') return { ...empty, tab: 'menu' as MainTab };
    if (p === '/pricing') return { ...empty, tab: 'pricing' as MainTab };
    if (p === '/terms') return { ...empty, tab: 'support' as MainTab, support: 'terms' as SupportLegalSection };
    if (p === '/privacy') return { ...empty, tab: 'support' as MainTab, support: 'privacy' as SupportLegalSection };
    if (p === '/refund') return { ...empty, tab: 'support' as MainTab, support: 'refund' as SupportLegalSection };
    if (p === '/reviews') return { ...empty, tab: 'reviews' as MainTab };
    if (p === '/share' || p.startsWith('/join') || p.startsWith('/invite')) return { ...empty, tab: 'share' as MainTab };
    if (p === '/highlights') return { ...empty, tab: 'videos' as MainTab, tubeSubView: 'feed' as TubeSubView };
    if (p === '/blog' || p.startsWith('/blog/')) {
      const slug = rawPath.replace(/^\/blog\/?/i, '').trim() || null;
      return { ...empty, tab: 'blog' as MainTab, blogSlug: slug };
    }
    if (p.startsWith('/profile/')) {
      const uname = decodeURIComponent(rawPath.replace(/^\/profile\//i, '')).trim() || null;
      if (uname && uname.replace(/^@/, '').toLowerCase() === 'testfan') {
        return empty;
      }
      return { ...empty, tab: 'profile' as MainTab, profileId: uname };
    }
    if (p.startsWith('/match/')) {
      const mId = decodeURIComponent(rawPath.replace(/^\/match\//i, '')).trim() || null;
      return { ...empty, tab: 'scores' as MainTab, matchId: mId };
    }
    return empty;
  };

  const initialRouteRef = useRef(getInitialUrlRoute());

  const [activeTab, setActiveTabState] = useState<MainTab>(initialRouteRef.current.tab);
  const [activeBlogSlug, setActiveBlogSlug] = useState<string | null>(initialRouteRef.current.blogSlug);
  const [supportSection, setSupportSection] = useState<SupportLegalSection>(initialRouteRef.current.support);
  const [supportPrefillCategory, setSupportPrefillCategory] = useState<string | null>(null);
  const [viewingProfileUserId, setViewingProfileUserId] = useState<string | null>(initialRouteRef.current.profileId);
  const [mobileFrameMode, setMobileFrameModeState] = useState<boolean>(false);
  const [tubeSubView, setTubeSubView] = useState<TubeSubView>(initialRouteRef.current.tubeSubView);
  const [tubeWatchVideoId, setTubeWatchVideoId] = useState<string | null>(initialRouteRef.current.videoId);
  const [tubeFanZoneHandle, setTubeFanZoneHandle] = useState<string | null>(initialRouteRef.current.fanzoneHandle);
  const setMobileFrameMode = (val: boolean | ((prev: boolean) => boolean)) => {
    setMobileFrameModeState(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      try {
        localStorage.setItem('futfield_mobile_frame', String(next));
      } catch {}
      return next;
    });
  };
  const [communities, setCommunities] = useState<Community[]>(INITIAL_COMMUNITIES);
  const [selectedCommunity, setSelectedCommunityState] = useState<Community | null>(null);
  const [shareModalPayload, setShareModalPayload] = useState<SharePayload | null>(null);
  const [latestUploadedVideoId, setLatestUploadedVideoId] = useState<string | null>(initialRouteRef.current.videoId);
  const [targetPostId, setTargetPostId] = useState<string | null>(initialRouteRef.current.postId);

  const openShareSheet = useCallback((payload: SharePayload) => {
    haptics.light();
    setShareModalPayload(payload);
  }, []);

  const closeShareSheet = useCallback(() => {
    setShareModalPayload(null);
  }, []);
  const [navHistory, setNavHistory] = useState<Array<{
    activeTab: MainTab;
    viewingProfileUserId: string | null;
    selectedCommunity: Community | null;
  }>>([]);
  const subBackHandlerRef = useRef<(() => boolean) | null>(null);

  const registerBackHandler = useCallback((handler: (() => boolean) | null) => {
    subBackHandlerRef.current = handler;
  }, []);

  const pushCurrentLocationToHistory = () => {
    setNavHistory(prev => {
      const snapshot = { activeTab, viewingProfileUserId, selectedCommunity };
      const top = prev[prev.length - 1];
      if (
        top &&
        top.activeTab === snapshot.activeTab &&
        top.viewingProfileUserId === snapshot.viewingProfileUserId &&
        top.selectedCommunity?.id === snapshot.selectedCommunity?.id
      ) {
        return prev;
      }
      return [...prev.slice(-24), snapshot];
    });
  };

  const setActiveTab = (tab: MainTab) => {
    scrollToTopInstant();
    if (tab !== activeTab) {
      pushCurrentLocationToHistory();
      if (tab !== 'communities') {
        setSelectedCommunityState(null);
      }
      if (tab !== 'blog') {
        setActiveBlogSlug(null);
      }
      setActiveTabState(tab);
    }
  };

  const openBlogArticle = (slug?: string | null) => {
    scrollToTopInstant();
    if (activeTab !== 'blog') {
      pushCurrentLocationToHistory();
      setSelectedCommunityState(null);
    }
    setActiveBlogSlug(slug || null);
    setActiveTabState('blog');
  };

  const openSupportLegalPage = (section: SupportLegalSection, prefillCategory?: string) => {
    scrollToTopInstant();
    setSupportSection(section);
    setSupportPrefillCategory(prefillCategory || null);
    if (activeTab !== 'support') {
      pushCurrentLocationToHistory();
      setSelectedCommunityState(null);
      setActiveTabState('support');
    }
  };

  const setSelectedCommunity = (c: Community | null) => {
    scrollToTopInstant();
    if (c?.id !== selectedCommunity?.id) {
      pushCurrentLocationToHistory();
      setSelectedCommunityState(c);
    }
  };

  const navigateToProfile = (userIdOrHandle?: string) => {
    scrollToTopInstant();
    const nextProfileId =
      !userIdOrHandle || userIdOrHandle === user.id || userIdOrHandle === user.handle
        ? null
        : userIdOrHandle;
    if (activeTab !== 'profile' || viewingProfileUserId !== nextProfileId) {
      pushCurrentLocationToHistory();
    }
    setViewingProfileUserId(nextProfileId);
    setActiveTabState('profile');
  };

  const toggleFollowUser = async (targetUserId: string): Promise<boolean> => {
    try {
      const res = await toggleFollowUserOnServer(user.id, targetUserId);
      const isNowFollowing = res.following;
      updateUser({
        followingCount: Math.max(0, (user.followingCount || 0) + (isNowFollowing ? 1 : -1)),
      });
      addNotification({
        title: isNowFollowing ? 'Now Following' : 'Unfollowed',
        body: isNowFollowing
          ? `You are now following ${targetUserId.startsWith('@') ? targetUserId : `@${targetUserId}`}.`
          : `You unfollowed ${targetUserId.startsWith('@') ? targetUserId : `@${targetUserId}`}.`,
        type: 'follow',
      });
      return isNowFollowing;
    } catch {
      return false;
    }
  };
  
  // Light Mode & Dark Mode with synchronous persistence & color-scheme lock
  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('futfield_theme');
      return saved === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  const applyThemeToDom = useCallback((t: 'dark' | 'light') => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (t === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
      document.body.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
      document.body.style.colorScheme = 'light';
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', t === 'dark' ? '#090D12' : '#F8FAFC');
    }
  }, []);

  const setTheme = (t: 'dark' | 'light') => {
    try {
      localStorage.setItem('futfield_theme', t);
    } catch {}
    applyThemeToDom(t);
    setThemeState(t);
  };

  useLayoutEffect(() => {
    applyThemeToDom(theme);
  }, [theme, applyThemeToDom]);

  const [clubTheme, setClubThemeState] = useState<string>(() => {
    try {
      return localStorage.getItem('futfield_club_theme') || 'default';
    } catch {
      return 'default';
    }
  });
  const setClubTheme = (nextTheme: string) => {
    setClubThemeState(nextTheme);
    try {
      localStorage.setItem('futfield_club_theme', nextTheme);
    } catch {}
  };

  const [dataSavingMode, setDataSavingModeState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('futfield_data_saving') === 'true';
    } catch {
      return false;
    }
  });
  const setDataSavingMode = (val: boolean) => {
    setDataSavingModeState(val);
    try {
      localStorage.setItem('futfield_data_saving', String(val));
    } catch {}
  };

  const [refreshFrequency, setRefreshFrequencyState] = useState<'15s' | '30s' | '60s'>(() => {
    try {
      const saved = localStorage.getItem('futfield_refresh_freq');
      return saved === '15s' || saved === '60s' ? saved : '30s';
    } catch {
      return '30s';
    }
  });
  const setRefreshFrequency = (freq: '15s' | '30s' | '60s') => {
    setRefreshFrequencyState(freq);
    try {
      localStorage.setItem('futfield_refresh_freq', freq);
    } catch {}
  };

  const [goalSoundEnabled, setGoalSoundEnabledState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('futfield_goal_sound') !== 'false';
    } catch {
      return true;
    }
  });
  const setGoalSoundEnabled = (val: boolean) => {
    setGoalSoundEnabledState(val);
    try {
      localStorage.setItem('futfield_goal_sound', String(val));
    } catch {}
  };

  const [cardAlertsEnabled, setCardAlertsEnabledState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('futfield_card_alerts') !== 'false';
    } catch {
      return true;
    }
  });
  const setCardAlertsEnabled = (val: boolean) => {
    setCardAlertsEnabledState(val);
    try {
      localStorage.setItem('futfield_card_alerts', String(val));
    } catch {}
  };

  const [varAlertsEnabled, setVarAlertsEnabledState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('futfield_var_alerts') !== 'false';
    } catch {
      return true;
    }
  });
  const setVarAlertsEnabled = (val: boolean) => {
    setVarAlertsEnabledState(val);
    try {
      localStorage.setItem('futfield_var_alerts', String(val));
    } catch {}
  };

  const [dmPrivacy, setDmPrivacyState] = useState<'all' | 'followers' | 'verified'>(() => {
    try {
      const saved = localStorage.getItem('futfield_dm_privacy');
      return saved === 'followers' || saved === 'verified' ? saved : 'all';
    } catch {
      return 'all';
    }
  });
  const setDmPrivacy = (val: 'all' | 'followers' | 'verified') => {
    setDmPrivacyState(val);
    try {
      localStorage.setItem('futfield_dm_privacy', val);
    } catch {}
  };

  const [readReceiptsEnabled, setReadReceiptsEnabledState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('futfield_read_receipts') !== 'false';
    } catch {
      return true;
    }
  });
  const setReadReceiptsEnabled = (val: boolean) => {
    setReadReceiptsEnabledState(val);
    try {
      localStorage.setItem('futfield_read_receipts', String(val));
    } catch {}
  };

  const clearAppCache = () => {
    let clearedKeys = 0;
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k === 'futfield_posts' || k === 'futfield_videos' || k.startsWith('futfield_matches'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      clearedKeys = keysToRemove.length;
      sessionStorage.clear();
    } catch {}
    matchesByDateRef.current = {};
    fetchLiveMatches();
    fetchServerPosts()
      .then(srv => {
        if (Array.isArray(srv) && srv.length > 0) setPosts(srv.filter(Boolean).map(normalizePostItem));
      })
      .catch(() => {});
    fetchServerVideos()
      .then(srv => {
        if (Array.isArray(srv) && srv.length > 0) setVideos(srv.filter(Boolean).map(normalizeVideoItem));
      })
      .catch(() => {});
    return { clearedKeys };
  };

  // Real data state collections - hydrate from local cache instantaneously so tabs never block
  const [posts, setPosts] = useState<Post[]>(() => {
    try {
      const saved = localStorage.getItem('futfield_posts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed
            .filter(p => Boolean(p) && !isTestArtifactPost(p))
            .map(normalizePostItem);
        }
      }
    } catch {}
    return INITIAL_POSTS.filter(p => !isTestArtifactPost(p)).map(normalizePostItem);
  });
  const [matches, setMatches] = useState<Match[]>(INITIAL_MATCHES);
  const [activeMatchRoom, setActiveMatchRoom] = useState<Match | null>(null);
  const [matchChats, setMatchChats] = useState<Record<string, MatchChatMessage[]>>(INITIAL_MATCH_CHAT);

  const [videos, setVideos] = useState<VideoItem[]>(() => {
    try {
      const saved = localStorage.getItem('futfield_videos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed
            .filter(v => Boolean(v) && !isTestArtifactVideo(v))
            .map(normalizeVideoItem);
        }
      }
    } catch {}
    return INITIAL_VIDEOS.filter(v => !isTestArtifactVideo(v)).map(normalizeVideoItem);
  });
  const [activeVideoIndex, setActiveVideoIndex] = useState<number>(0);

  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [playerScoutModalOpen, setPlayerScoutModalOpen] = useState(false);
  const [notificationsModalOpen, setNotificationsModalOpen] = useState(false);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [realtimeAnalytics, setRealtimeAnalytics] = useState<any>({
    totalViews: 0,
    totalLikes: 0,
    totalReactions: 0,
    totalShares: 0,
    totalComments: 0,
    trendingVideos: [],
  });
  const [mediaStorageStats, setMediaStorageStats] = useState<any>({
    imageCount: 0,
    videoCount: 0,
    totalFiles: 0,
    totalImageBytes: 0,
    totalVideoBytes: 0,
    totalBytes: 0,
    totalImageMb: 0,
    totalVideoMb: 0,
    totalMb: 0,
    images: [],
    videos: [],
    recentUploads: [],
  });
  const matchesByDateRef = useRef<Record<string, Match[]>>({});

  // Connected Creators State (persisted in localStorage)
  const [connectedCreators, setConnectedCreators] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('futfield_connected_creators');
      return saved ? JSON.parse(saved) : ['@emirates_gunner', '@tactical_scout'];
    } catch {
      return ['@emirates_gunner', '@tactical_scout'];
    }
  });

  const toggleConnectCreator = (handle: string, userDetails?: { name: string; avatar: string; clubBadge?: string }) => {
    haptics.like();
    setConnectedCreators(prev => {
      const isConnected = prev.includes(handle);
      const updated = isConnected ? prev.filter(h => h !== handle) : [...prev, handle];
      try {
        localStorage.setItem('futfield_connected_creators', JSON.stringify(updated));
      } catch {}

      if (!isConnected) {
        addFanPoints(2, 'Connected with Creator');
        addNotification({
          title: `Connected with ${userDetails?.name || handle}! 🤝`,
          body: `You will now receive tactical match breakdowns and posts from ${userDetails?.name || handle} first in your feed!`,
          type: 'like',
        });
      }
      return updated;
    });
  };

  const isCreatorConnected = (handle: string) => connectedCreators.includes(handle);

  // Selected Creator Profile Modal State
  const [selectedCreatorForProfile, setSelectedCreatorForProfile] = useState<{
    handle: string;
    name: string;
    avatar: string;
    clubBadge?: string;
  } | null>(null);

  const openCreatorProfile = (creator: { handle: string; name: string; avatar: string; clubBadge?: string }) => {
    haptics.light();
    setSelectedCreatorForProfile(creator);
  };

  const closeCreatorProfile = () => {
    setSelectedCreatorForProfile(null);
  };

  // Creator Monetization Wallet State
  const [monetizationModalOpen, setMonetizationModalOpen] = useState(false);
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [creatorWallet, setCreatorWallet] = useState<{
    userId: string;
    balance: number;
    totalEarned: number;
    tipsReceived: number;
    adRevenue: number;
    subscriptions: number;
    transactions: any[];
  }>({
    userId: user.id || 'current_user',
    balance: 0,
    totalEarned: 0,
    tipsReceived: 0,
    adRevenue: 0,
    subscriptions: 0,
    transactions: [],
  });

  const requestPayout = async (amount: number, method: string, destination: string): Promise<boolean> => {
    haptics.like();
    try {
      const res = await fetch('/api/monetization/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount,
          payoutMethod: method,
          destination,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCreatorWallet(prev => ({
          ...prev,
          balance: data.remainingBalance,
          transactions: [data.transaction, ...prev.transactions],
        }));
        addNotification({
          title: 'Payout Processed! 💸',
          body: `Instant payout of $${amount.toFixed(2)} sent via ${method}.`,
          type: 'system',
        });
        return true;
      }
    } catch {}
    return false;
  };

  const fetchMonetizationAdvice = async () => {
    try {
      const res = await fetch('/api/ai/monetization-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorHandle: user.handle,
          postCount: user.postsCount || posts.length,
          videoCount: videos.length,
          totalViews: videos.reduce((acc, v) => acc + (v.views || 0), 0),
          totalLikes: posts.reduce((acc, p) => acc + (p.likes || 0), 0),
          followerCount: user.followersCount || 0,
          clubNiche: user.favoriteClub,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.advice;
      }
    } catch (err) {
      console.warn('Monetization advice fetch notice:', err);
    }
    return null;
  };

  // Fast Live Match fetcher with instant date-cache switching & IndexedDB hydration
  const fetchLiveMatches = async (dateStr?: string) => {
    const cacheKey = dateStr || 'today';
    const instantDateCached = matchesByDateRef.current[cacheKey];
    if (instantDateCached && instantDateCached.length > 0) {
      setMatches(instantDateCached);
    } else {
      setMatchesLoading(matches.length === 0);
    }

    try {
      const url = dateStr ? `/api/football/live?date=${encodeURIComponent(dateStr)}` : '/api/football/live';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.matches) && data.matches.length > 0) {
          matchesByDateRef.current[cacheKey] = data.matches;
          setMatches(data.matches);
          if (!dateStr) saveCachedMatches(data.matches);
          setMatchesLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('[FUTFIELD] Live match sync notice:', err);
    } finally {
      setMatchesLoading(false);
    }

    if (!instantDateCached) {
      try {
        const cached = await getCachedMatches();
        if (Array.isArray(cached) && cached.length > 0) {
          setMatches(cached);
        }
      } catch {}
    }
  };

  const refreshMediaAndAnalytics = async () => {
    try {
      const [statsRes, analyticsRes] = await Promise.all([
        fetchMediaStorageStats(),
        fetchRealtimeAnalytics(),
      ]);
      if (statsRes && typeof statsRes === 'object') {
        setMediaStorageStats((prev: any) => ({ ...prev, ...statsRes }));
      }
      if (analyticsRes && typeof analyticsRes === 'object') {
        setRealtimeAnalytics((prev: any) => ({ ...prev, ...analyticsRes }));
      }
    } catch {}
  };

  // Hydrate offline IndexedDB matches immediately before first network fetch + background warm adjacent days
  useEffect(() => {
    getCachedMatches()
      .then(cached => {
        if (Array.isArray(cached) && cached.length > 0) {
          setMatches(prev => (prev.length === 0 ? cached : prev));
        }
      })
      .catch(() => {});

    fetchLiveMatches();
    const todayD = new Date();
    const yest = new Date(todayD);
    yest.setDate(yest.getDate() - 1);
    const tom = new Date(todayD);
    tom.setDate(tom.getDate() + 1);
    const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
    // Silently pre-populate yesterday & tomorrow client cache for instant filter switching
    fetch(`/api/football/live?date=${fmt(yest)}`).then(r => r.json()).then(d => {
      if (Array.isArray(d?.matches) && d.matches.length > 0) matchesByDateRef.current[fmt(yest)] = d.matches;
    }).catch(() => {});
    fetch(`/api/football/live?date=${fmt(tom)}`).then(r => r.json()).then(d => {
      if (Array.isArray(d?.matches) && d.matches.length > 0) matchesByDateRef.current[fmt(tom)] = d.matches;
    }).catch(() => {});
  }, []);

  // Dynamic Live Score Sync Interval controlled by Settings refreshFrequency
  useEffect(() => {
    const intervalMs = refreshFrequency === '15s' ? 15000 : refreshFrequency === '60s' ? 60000 : 30000;
    const liveSyncInterval = setInterval(() => {
      fetchLiveMatches();
    }, intervalMs);
    return () => clearInterval(liveSyncInterval);
  }, [refreshFrequency]);

  // Poll subscription status for automatic Pro unlock & expiration downgrade
  useEffect(() => {
    if (!user?.id) return;
    const checkSub = () => {
      const emailQ = user.email ? `?email=${encodeURIComponent(user.email)}` : '';
      fetch(`/api/subscriptions/check/${encodeURIComponent(user.id)}${emailQ}`)
        .then(r => (r.ok ? r.json() : null))
        .then(data => {
          if (!data) return;
          if (data.isPro && (!user.isPro || (data.tier && user.proPlan !== data.tier))) {
            const tier = (data.tier || 'pro') as 'pro' | 'vip' | 'season';
            updateUser({
              isPro: true,
              membershipTier: tier === 'vip' || tier === 'season' ? 'vip' : 'pro',
              proPlan: tier,
              proExpiresAt: data.expiresAt || user.proExpiresAt,
              paystackReference: data.reference || user.paystackReference,
            });
          } else if (data.isExpired && user.isPro) {
            updateUser({ isPro: false, membershipTier: 'free' });
          }
          if (Array.isArray(data.alerts) && data.alerts.length > 0) {
            data.alerts.forEach((a: any) => {
              addNotification({
                title: a.title || 'Subscription Expired',
                body: a.body || 'Your Pro subscription has expired. Renew anytime to restore unlimited access.',
                type: 'system',
              });
            });
          }
        })
        .catch(() => {});
    };
    checkSub();
    const subTimer = setInterval(checkSub, 60000);
    return () => clearInterval(subTimer);
  }, [user.id, user.email, user.isPro, user.proPlan]);

  // Real-Time Global Feed Stream (Instant Worldwide Post, Video, Engagement & Analytics Sync)
  useEffect(() => {
    let sse: EventSource | null = null;
    let reconnectTimer: any = null;

    const connectStream = () => {
      try {
        sse = new EventSource('/api/db/feed/stream');

        sse.addEventListener('new_post', (e: MessageEvent) => {
          try {
            const rawPost = JSON.parse(e.data);
            if (rawPost && rawPost.id) {
              const incomingPost = normalizePostItem(rawPost);
              setPosts(prev => {
                if (prev.some(p => p.id === incomingPost.id)) return prev;
                return [incomingPost, ...prev];
              });
            }
          } catch {}
        });

        sse.addEventListener('new_video', (e: MessageEvent) => {
          try {
            const rawVideo = JSON.parse(e.data);
            if (rawVideo && rawVideo.id) {
              const incomingVideo = normalizeVideoItem(rawVideo);
              setVideos(prev => {
                if (prev.some(v => v.id === incomingVideo.id)) return prev;
                return [incomingVideo, ...prev];
              });
            }
          } catch {}
        });

        sse.addEventListener('video_deleted', (e: MessageEvent) => {
          try {
            const payload = JSON.parse(e.data);
            if (payload?.videoId) {
              setVideos(prev => prev.filter(v => v.id !== payload.videoId));
              setLatestUploadedVideoId(prev => (prev === payload.videoId ? null : prev));
            }
          } catch {}
        });

        sse.addEventListener('like_post', (e: MessageEvent) => {
          try {
            const { postId, likesCount } = JSON.parse(e.data);
            if (postId) {
              setPosts(prev =>
                prev.map(p => (p.id === postId ? { ...p, likes: likesCount } : p))
              );
            }
          } catch {}
        });

        sse.addEventListener('post_engagement_updated', (e: MessageEvent) => {
          try {
            const payload = JSON.parse(e.data);
            if (payload?.postId) {
              setPosts(prev =>
                prev.map(p =>
                  p.id === payload.postId
                    ? {
                        ...p,
                        reactions: payload.reactions ?? p.reactions,
                        shares: payload.shares ?? p.shares,
                      }
                    : p
                )
              );
            }
          } catch {}
        });

        sse.addEventListener('video_engagement_updated', (e: MessageEvent) => {
          try {
            const payload = JSON.parse(e.data);
            if (payload?.videoId) {
              setVideos(prev =>
                prev.map(v =>
                  v.id === payload.videoId
                    ? {
                        ...v,
                        views: payload.views ?? v.views,
                        likes: payload.likes ?? v.likes,
                        shares: payload.shares ?? v.shares,
                        reactions: payload.reactions ?? v.reactions,
                        commentsCount: payload.commentsCount ?? v.commentsCount,
                      }
                    : v
                )
              );
            }
          } catch {}
        });

        sse.addEventListener('media_uploaded', (e: MessageEvent) => {
          try {
            const stats = JSON.parse(e.data);
            if (stats && typeof stats === 'object') {
              setMediaStorageStats((prev: any) => ({ ...prev, ...stats }));
            }
          } catch {}
        });

        sse.addEventListener('analytics_summary', (e: MessageEvent) => {
          try {
            const summary = JSON.parse(e.data);
            if (summary && typeof summary === 'object') {
              setRealtimeAnalytics((prev: any) => ({ ...prev, ...summary }));
              if (summary.mediaStorage && typeof summary.mediaStorage === 'object') {
                setMediaStorageStats((prev: any) => ({ ...prev, ...summary.mediaStorage }));
              }
            }
          } catch {}
        });

        sse.addEventListener('comment_post', (e: MessageEvent) => {
          try {
            const { postId, comment } = JSON.parse(e.data);
            if (postId && comment) {
              setPosts(prev =>
                prev.map(p =>
                  p.id === postId
                    ? {
                        ...p,
                        commentsCount: p.commentsCount + 1,
                        commentsList: [comment, ...(p.commentsList || [])],
                      }
                    : p
                )
              );
            }
          } catch {}
        });

        sse.addEventListener('subscription_unlocked', (e: MessageEvent) => {
          try {
            const payload = JSON.parse(e.data);
            const matchesId = payload?.userId && payload.userId === user.id;
            const matchesEmail =
              payload?.email &&
              user.email &&
              payload.email.toLowerCase() === user.email.toLowerCase();
            if (matchesId || matchesEmail) {
              const tier = (payload.tier || 'pro') as 'pro' | 'vip' | 'season';
              const bonusFp = Number(payload.bonusPoints || 0);
              updateUser({
                isPro: true,
                membershipTier: tier === 'vip' || tier === 'season' ? 'vip' : 'pro',
                proPlan: tier,
                proExpiresAt: payload.expiresAt,
                paystackReference: payload.reference,
                ...(bonusFp > 0
                  ? {
                      fanPoints: (user.fanPoints || 0) + bonusFp,
                      weeklyPoints: (user.weeklyPoints || 0) + bonusFp,
                    }
                  : {}),
              });
              addNotification({
                title: 'Paystack Pro Pass Unlocked 🏆',
                body: `Your ${tier.toUpperCase()} pass is now active worldwide.`,
                type: 'system',
              });
            }
          } catch {}
        });

        sse.onerror = () => {
          sse?.close();
          reconnectTimer = setTimeout(connectStream, 3000);
        };
      } catch {
        reconnectTimer = setTimeout(connectStream, 5000);
      }
    };

    connectStream();
    refreshMediaAndAnalytics();

    // Initial parallel server hydration
    fetchServerPosts()
      .then(serverPosts => {
        if (Array.isArray(serverPosts)) {
          const normalized = serverPosts
            .filter(p => Boolean(p) && !isTestArtifactPost(p))
            .map(normalizePostItem);
          setPosts(prev => {
            const cleanPrev = prev.filter(p => !isTestArtifactPost(p));
            if (normalized.length === 0) return cleanPrev;
            const serverIds = new Set(normalized.map(p => p.id));
            const localOnly = cleanPrev.filter(p => !serverIds.has(p.id));
            return [...normalized, ...localOnly];
          });
        }
      })
      .catch(() => {});

    fetchServerVideos()
      .then(serverVideos => {
        if (Array.isArray(serverVideos)) {
          const normalized = serverVideos
            .filter(v => Boolean(v) && !isTestArtifactVideo(v))
            .map(normalizeVideoItem);
          setVideos(prev => {
            const cleanPrev = prev.filter(v => !isTestArtifactVideo(v));
            if (normalized.length === 0) return cleanPrev;
            const serverIds = new Set(normalized.map(v => v.id));
            const localOnly = cleanPrev.filter(v => !serverIds.has(v.id));
            return [...normalized, ...localOnly];
          });
        }
      })
      .catch(() => {});

    fetchServerCommunities()
      .then(serverCommunities => {
        if (serverCommunities && serverCommunities.length > 0) {
          setCommunities(serverCommunities);
        }
      })
      .catch(() => {});

    const periodicSync = setInterval(() => {
      fetchServerPosts().then(srvPosts => {
        if (srvPosts && srvPosts.length > 0) {
          setPosts(prev => {
            const serverMap = new Map(srvPosts.map(p => [p.id, p]));
            return prev.map(p => {
              const fresh = serverMap.get(p.id);
              return fresh ? { ...p, likes: fresh.likes, commentsCount: fresh.commentsCount, shares: fresh.shares, reactions: fresh.reactions } : p;
            });
          });
        }
      }).catch(() => {});
    }, 25000);

    return () => {
      if (sse) sse.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(periodicSync);
    };
  }, []);

  // Sync user state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('futfield_user', JSON.stringify(user));
    } catch {}
  }, [user]);

  // Sync posts & videos to localStorage (skip oversized base64 payloads so storage quota never breaks)
  useEffect(() => {
    try {
      const safePosts = posts.slice(0, 60).map(p => ({
        ...p,
        mediaUrl: p.mediaUrl && p.mediaUrl.startsWith('data:') && p.mediaUrl.length > 50000 ? undefined : p.mediaUrl,
      }));
      localStorage.setItem('futfield_posts', JSON.stringify(safePosts));
    } catch {}
  }, [posts]);

  useEffect(() => {
    try {
      const safeVideos = videos.slice(0, 60);
      localStorage.setItem('futfield_videos', JSON.stringify(safeVideos));
    } catch {}
  }, [videos]);

  // Theme DOM synchronization is handled synchronously by applyThemeToDom/useLayoutEffect above

  const updateUser = (fields: Partial<UserProfile>) => {
    setUser(prev => {
      const updated = { ...prev, ...fields };
      syncUserProfile(updated).catch(() => {});
      return updated;
    });
  };

  const addFanPoints = (pts: number, reason?: string) => {
    setUser(prev => ({
      ...prev,
      fanPoints: prev.fanPoints + pts,
      weeklyPoints: prev.weeklyPoints + pts,
    }));
    try {
      confetti({
        particleCount: 25,
        spread: 40,
        origin: { y: 0.8 },
        colors: ['#00E676', '#3b82f6', '#f59e0b'],
      });
    } catch {}
  };

  const addPost = (data: {
    content: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
    imageUrl?: string;
    videoUrl?: string;
    mediaSizeBytes?: number;
    mediaSizeMb?: number;
    thumbnailUrl?: string;
    videoKind?: 'short' | 'video';
    aspectRatio?: '9:16' | '16:9';
    durationSeconds?: number;
    width?: number;
    height?: number;
    pollQuestion?: string;
    pollOptions?: string[];
    tags?: string[];
    category?: 'foryou' | 'following' | 'trending';
    communityId?: string;
    location?: string;
    clubTag?: string;
    feeling?: string;
    privacy?: 'public' | 'followers' | 'private';
  }) => {
    const finalMediaType = data.mediaType || (data.videoUrl ? 'video' : data.mediaUrl?.includes('video') ? 'video' : data.mediaUrl ? 'image' : undefined);
    const isProUser = Boolean(user.isPro || user.membershipTier === 'pro' || user.membershipTier === 'vip');
    const limitType = finalMediaType === 'video' ? 'video' : 'post';
    const limitCheck = checkDailyLimit(user.id, limitType, isProUser);
    if (!limitCheck.allowed) {
      addNotification({
        title: 'Free Tier Limit Reached ⚠️',
        body: limitCheck.message || 'Daily limit reached. Upgrade to Pro for unlimited posts and videos!',
        type: 'system',
      });
      setPricingModalOpen(true);
      return;
    }
    incrementDailyLimit(user.id, limitType);

    const newPost: Post = {
      id: `post_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: user.id,
      author: {
        name: user.name,
        handle: user.handle,
        avatar: user.avatar,
        clubBadge: user.favoriteClubCrest,
        isVerified: user.isAuthenticated || user.fanPoints >= 5000,
      },
      content: data.content,
      timestamp: 'Just now',
      mediaUrl: data.mediaUrl || data.imageUrl || data.videoUrl,
      mediaType: finalMediaType,
      imageUrl: data.imageUrl || (finalMediaType === 'image' ? data.mediaUrl : undefined),
      videoUrl: data.videoUrl || (finalMediaType === 'video' ? data.mediaUrl : undefined),
      thumbnailUrl: data.thumbnailUrl,
      videoKind: data.videoKind,
      aspectRatio: data.aspectRatio,
      durationSeconds: data.durationSeconds,
      width: data.width,
      height: data.height,
      mediaSizeBytes: data.mediaSizeBytes,
      mediaSizeMb: data.mediaSizeMb,
      location: data.location,
      clubTag: data.clubTag,
      feeling: data.feeling,
      privacy: data.privacy || 'public',
      poll: data.pollQuestion && data.pollOptions && data.pollOptions.length >= 2
        ? {
            id: `poll_${Date.now()}`,
            question: data.pollQuestion,
            options: data.pollOptions.map((opt, i) => ({
              id: `opt_${i}`,
              label: opt,
              votes: 0,
            })),
            totalVotes: 0,
            expiresIn: '24h',
          }
        : undefined,
      likes: 0,
      isLiked: false,
      reactions: {},
      userReactions: [],
      commentsCount: 0,
      shares: 0,
      reposts: 0,
      tags: data.tags || [],
      category: data.category || 'foryou',
      communityId: data.communityId,
    };

    setPosts(prev => [newPost, ...prev.filter(p => p.id !== newPost.id)]);
    addFanPoints(2, 'Shared a football take');
    updateUser({ postsCount: (user.postsCount || 0) + 1 });
    createPostOnServer(newPost).catch(() => {});
  };

  const toggleLikePost = (postId: string) => {
    setPosts(prev =>
      prev.map(p => {
        if (p.id === postId) {
          const isLiked = !p.isLiked;
          if (isLiked) addFanPoints(1, 'Liked a post');
          return {
            ...p,
            isLiked,
            likes: isLiked ? p.likes + 1 : Math.max(0, p.likes - 1),
          };
        }
        return p;
      })
    );
  };

  const reactToPost = async (postId: string, emoji: string) => {
    haptics.like();
    setPosts(prev =>
      prev.map(p => {
        if (p.id !== postId) return p;
        const currentUserReactions = p.userReactions || [];
        const hasReacted = currentUserReactions.includes(emoji);
        const currentReactions = { ...(p.reactions || {}) };
        currentReactions[emoji] = hasReacted
          ? Math.max(0, (currentReactions[emoji] || 1) - 1)
          : (currentReactions[emoji] || 0) + 1;
        return {
          ...p,
          reactions: currentReactions,
          userReactions: hasReacted
            ? currentUserReactions.filter(e => e !== emoji)
            : [...currentUserReactions, emoji],
        };
      })
    );
    const res = await reactToPostOnServer(postId, user.id, emoji);
    if (res.success && res.reactions) {
      setPosts(prev =>
        prev.map(p => (p.id === postId ? { ...p, reactions: res.reactions, userReactions: res.userReactions } : p))
      );
    }
  };

  const toggleRepost = (postId: string) => {
    setPosts(prev =>
      prev.map(p => {
        if (p.id === postId) {
          const isReposted = !p.isReposted;
          if (isReposted) addFanPoints(2, 'Reposted football opinion');
          return {
            ...p,
            isReposted,
            reposts: isReposted ? p.reposts + 1 : Math.max(0, p.reposts - 1),
          };
        }
        return p;
      })
    );
  };

  const toggleSavePost = (postId: string) => {
    setPosts(prev =>
      prev.map(p => (p.id === postId ? { ...p, isSaved: !p.isSaved } : p))
    );
  };

  const votePoll = (postId: string, optionId: string) => {
    haptics.vote();
    setPosts(prev =>
      prev.map(p => {
        if (p.id === postId && p.poll && !p.poll.userVotedOptionId) {
          const updatedOptions = p.poll.options.map(opt =>
            opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt
          );
          addFanPoints(2, 'Voted in poll');
          return {
            ...p,
            poll: {
              ...p.poll,
              options: updatedOptions,
              totalVotes: p.poll.totalVotes + 1,
              userVotedOptionId: optionId,
            },
          };
        }
        return p;
      })
    );
  };

  const addCommentToPost = (postId: string, text: string) => {
    const newComment: PostComment = {
      id: `c_${Date.now()}`,
      author: {
        name: user.name,
        handle: user.handle,
        avatar: user.avatar,
        clubBadge: user.favoriteClubCrest,
      },
      text,
      timestamp: 'Just now',
      likes: 0,
    };

    setPosts(prev =>
      prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            commentsCount: p.commentsCount + 1,
            commentsList: [...(p.commentsList || []), newComment],
          };
        }
        return p;
      })
    );
    addFanPoints(1, 'Commented on post');
  };

  const translatePostContent = async (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    if (post.translatedContent) {
      setPosts(prev =>
        prev.map(p => (p.id === postId ? { ...p, translatedContent: undefined } : p))
      );
      return;
    }

    setPosts(prev =>
      prev.map(p => (p.id === postId ? { ...p, isTranslating: true } : p))
    );

    const translated = await translateText(post.content, 'English');
    setPosts(prev =>
      prev.map(p =>
        p.id === postId
          ? { ...p, translatedContent: translated, isTranslating: false }
          : p
      )
    );
  };

  const openMatchRoom = async (match: Match) => {
    scrollToTopInstant();
    setActiveMatchRoom(match);
    const serverMsgs = await fetchServerMatchMessages(match.id);
    if (serverMsgs && serverMsgs.length > 0) {
      setMatchChats(prev => ({ ...prev, [match.id]: serverMsgs }));
    }
  };

  const closeMatchRoom = () => {
    setActiveMatchRoom(null);
  };

  const sendMatchMessage = async (
    matchId: string,
    text: string,
    options?: {
      mediaType?: 'text' | 'image' | 'video' | 'voice' | 'gif';
      mediaUrl?: string;
      thumbnailUrl?: string;
      voiceDuration?: number;
      waveform?: number[];
      replyToId?: string;
      replyToMessage?: any;
      messageType?: any;
    }
  ) => {
    const newMsgId = `mmsg_${Date.now()}`;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMsg: MatchChatMessage = {
      id: newMsgId,
      matchId,
      user: {
        id: user.id,
        name: user.name,
        handle: user.handle,
        avatar: user.avatar,
        favoriteClub: user.favoriteClub,
        isMod: user.isModerator,
      },
      text,
      content: text,
      timestamp: timeStr,
      createdAt: now.toISOString(),
      messageType: options?.messageType || 'chat',
      mediaType: options?.mediaType || 'text',
      mediaUrl: options?.mediaUrl,
      thumbnailUrl: options?.thumbnailUrl,
      voiceDuration: options?.voiceDuration,
      waveform: options?.waveform,
      replyToId: options?.replyToId,
      replyToMessage: options?.replyToMessage,
      isPinned: false,
      isDeleted: false,
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

    setMatchChats(prev => ({
      ...prev,
      [matchId]: [...(prev[matchId] || []), newMsg],
    }));

    addFanPoints(10, 'Live match chat');
    await sendServerMatchMessage(matchId, newMsg);
  };

  const reactToMessage = async (
    matchId: string,
    messageId: string,
    reactionType: string
  ) => {
    setMatchChats(prev => {
      const roomMsgs = prev[matchId] || [];
      const updated = roomMsgs.map(msg => {
        if (msg.id === messageId) {
          const userReactions = msg.userReactions || [];
          const hasReacted = userReactions.includes(reactionType);
          const currentCount = Number(msg.reactions[reactionType] || 0);
          const newReactions = {
            ...msg.reactions,
            [reactionType]: hasReacted
              ? Math.max(0, currentCount - 1)
              : currentCount + 1,
          };
          const newUserReactions = hasReacted
            ? userReactions.filter(r => r !== reactionType)
            : [...userReactions, reactionType];
          return {
            ...msg,
            reactions: newReactions,
            userReactions: newUserReactions,
          };
        }
        return msg;
      });
      return { ...prev, [matchId]: updated };
    });

    await reactToMatchMessageOnServer(matchId, messageId, reactionType, user.id);
  };

  const deleteMatchMessage = async (matchId: string, messageId: string, forEveryone = true) => {
    setMatchChats(prev => {
      const roomMsgs = prev[matchId] || [];
      if (!forEveryone) {
        return { ...prev, [matchId]: roomMsgs.filter(m => m.id !== messageId) };
      }
      const updated = roomMsgs.map(m => {
        if (m.id === messageId) {
          return {
            ...m,
            isDeleted: true,
            text: 'This message was deleted',
            content: 'This message was deleted',
            mediaUrl: undefined,
            thumbnailUrl: undefined,
          };
        }
        return m;
      });
      return { ...prev, [matchId]: updated };
    });
    await deleteMatchMessageOnServer(matchId, messageId, forEveryone);
  };

  const pinMatchMessage = async (matchId: string, messageId: string, isPinned: boolean) => {
    setMatchChats(prev => {
      const roomMsgs = prev[matchId] || [];
      const updated = roomMsgs.map(m => (m.id === messageId ? { ...m, isPinned } : m));
      return { ...prev, [matchId]: updated };
    });
    await pinMatchMessageOnServer(matchId, messageId, isPinned);
  };

  const toggleLikeVideo = (videoId: string) => {
    setVideos(prev =>
      prev.map(v => {
        if (v.id === videoId) {
          const isLiked = !v.isLiked;
          return {
            ...v,
            isLiked,
            likes: isLiked ? v.likes + 1 : Math.max(0, v.likes - 1),
          };
        }
        return v;
      })
    );
  };

  const reactToVideo = async (videoId: string, emoji: string) => {
    haptics.like();
    setVideos(prev =>
      prev.map(v => {
        if (v.id !== videoId) return v;
        const currentUserReactions = v.userReactions || [];
        const hasReacted = currentUserReactions.includes(emoji);
        const nextReactions = { ...(v.reactions || {}) };
        nextReactions[emoji] = hasReacted
          ? Math.max(0, (nextReactions[emoji] || 1) - 1)
          : (nextReactions[emoji] || 0) + 1;
        return {
          ...v,
          reactions: nextReactions,
          userReactions: hasReacted
            ? currentUserReactions.filter(e => e !== emoji)
            : [...currentUserReactions, emoji],
        };
      })
    );
    const res = await reactToVideoOnServer(videoId, user.id, emoji);
    if (res.success && res.reactions) {
      setVideos(prev =>
        prev.map(v =>
          v.id === videoId ? { ...v, reactions: res.reactions, userReactions: res.userReactions } : v
        )
      );
    }
  };

  const shareVideo = async (videoId: string): Promise<number> => {
    setVideos(prev =>
      prev.map(v => (v.id === videoId ? { ...v, shares: (v.shares || 0) + 1 } : v))
    );
    const res = await shareVideoOnServer(videoId);
    if (res.success) {
      setVideos(prev =>
        prev.map(v => (v.id === videoId ? { ...v, shares: res.shares } : v))
      );
      return res.shares;
    }
    return 1;
  };

  const toggleSaveVideo = (videoId: string) => {
    setVideos(prev =>
      prev.map(v => (v.id === videoId ? { ...v, isSaved: !v.isSaved } : v))
    );
  };

  const toggleSubscribeCreator = (creatorHandle: string) => {
    setVideos(prev =>
      prev.map(v => {
        if (v.creator?.handle === creatorHandle) {
          return {
            ...v,
            creator: {
              ...v.creator,
              isSubscribed: !v.creator?.isSubscribed,
            },
          };
        }
        return v;
      })
    );
  };

  const openVideoInReels = (videoId: string) => {
    scrollToTopInstant();
    setLatestUploadedVideoId(videoId);
    setTubeWatchVideoId(videoId);
    setTubeSubView('watch');
    setActiveVideoIndex(0);
    setActiveTab('videos');
  };

  const openFanZone = (usernameOrHandle: string) => {
    scrollToTopInstant();
    pushCurrentLocationToHistory();
    setTubeFanZoneHandle(usernameOrHandle);
    setTubeSubView('fanzone');
    setActiveTabState('videos');
  };

  const openTubeUpload = () => {
    scrollToTopInstant();
    pushCurrentLocationToHistory();
    setTubeSubView('upload');
    setActiveTabState('videos');
  };

  const openQuickKicks = (videoId?: string) => {
    scrollToTopInstant();
    pushCurrentLocationToHistory();
    if (videoId) setTubeWatchVideoId(videoId);
    setTubeSubView('kicks');
    setActiveTabState('videos');
  };

  const addVideo = async (data: {
    title: string;
    description: string;
    videoUrl: string;
    thumbnailUrl?: string;
    clubTag?: string;
    privacy?: 'public' | 'followers' | 'private';
    visibility?: 'public' | 'squad' | 'private';
    category?: VideoItem['category'];
    tubeCategory?: string;
    hashtags?: string[];
    duration?: string;
    durationSeconds?: number;
    sizeBytes?: number;
    sizeMb?: number;
    videoKind?: 'short' | 'video';
    aspectRatio?: '9:16' | '16:9';
    isQuickKick?: boolean;
    width?: number;
    height?: number;
    copyrightStatus?: 'CLEAR' | 'WARNING' | 'BLOCKED';
    copyrightReport?: any;
    skipAutoNavigate?: boolean;
  }): Promise<VideoItem | null> => {
    const isProUser = Boolean(user.isPro || user.membershipTier === 'pro' || user.membershipTier === 'vip');
    const limitCheck = checkDailyLimit(user.id, 'video', isProUser);
    if (!limitCheck.allowed) {
      addNotification({
        title: 'Free Tier Limit Reached ⚠️',
        body: 'Free limit is 3 uploads/day. Upgrade to Pro for unlimited 1080p Futfield Tube uploads!',
        type: 'system',
      });
      setPricingModalOpen(true);
      return null;
    }
    incrementDailyLimit(user.id, 'video');

    const durSec = data.durationSeconds || 30;
    const durFormatted = data.duration || `${Math.floor(durSec / 60)}:${(durSec % 60).toString().padStart(2, '0')}`;
    const isQuickKick = Boolean(data.isQuickKick ?? (data.videoKind === 'short' || data.aspectRatio === '9:16'));
    const resolvedKind: 'short' | 'video' = isQuickKick ? 'short' : 'video';
    const resolvedRatio: '9:16' | '16:9' = isQuickKick ? '9:16' : '16:9';

    const newVideo: VideoItem = {
      id: `ft_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId: user.id,
      fanzoneId: user.handle,
      fanzoneName: `${user.name} FanZone`,
      fanzoneHandle: user.handle,
      fanzoneAvatar: user.avatar,
      squadCount: Math.max(1, user.followersCount || 1),
      title: data.title.trim().slice(0, 80),
      description: data.description,
      videoUrl: data.videoUrl,
      thumbnailUrl: data.thumbnailUrl || '',
      duration: durFormatted,
      durationSeconds: durSec,
      views: 0,
      watches: 0,
      cheers: 0,
      boos: 0,
      shoutsCount: 0,
      clubTag: data.clubTag,
      privacy: data.privacy || 'public',
      visibility: data.visibility || (data.privacy === 'followers' ? 'squad' : data.privacy || 'public'),
      tubeCategory: data.tubeCategory || (isQuickKick ? 'Quick Kicks' : 'Goals'),
      isQuickKick,
      hasWatermark: !isProUser,
      boostFirst60: durSec <= 60 || data.tubeCategory === 'Goals',
      createdAt: new Date().toISOString(),
      creator: {
        name: `${user.name} FanZone`,
        handle: user.handle,
        subscribers: `${Math.max(1, user.followersCount || 1)} Squad`,
        avatar: user.avatar,
        isVerified: user.isAuthenticated,
      },
      likes: 0,
      isLiked: false,
      reactions: {},
      userReactions: [],
      commentsCount: 0,
      shares: 0,
      isSaved: false,
      sizeBytes: data.sizeBytes,
      sizeMb: data.sizeMb,
      videoKind: resolvedKind,
      aspectRatio: resolvedRatio,
      width: data.width,
      height: data.height,
      copyrightStatus: data.copyrightStatus || 'CLEAR',
      copyrightReport: data.copyrightReport,
      quality: isProUser ? '1080p' : '720p',
      tacticalSummary: data.description,
      category: data.category || 'foryou',
      hashtags: data.hashtags || [isQuickKick ? '#QuickKicks' : '#FutfieldTube', '#FUTFIELD'],
    };

    const serverRes = await uploadServerVideo(newVideo);
    if (!serverRes.success) {
      haptics.warning();
      addNotification({
        title: 'Clip Upload Blocked ⚠️',
        body: serverRes.error || 'Clip failed duration or copyright validation.',
        type: 'system',
      });
      return null;
    }

    const finalVideo = normalizeVideoItem(
      serverRes.video ? { ...newVideo, ...serverRes.video } : newVideo
    );
    setVideos(prev => [finalVideo, ...prev.filter(v => v.id !== finalVideo.id)]);
    setLatestUploadedVideoId(finalVideo.id);
    setTubeWatchVideoId(finalVideo.id);
    setActiveVideoIndex(0);
    if (!data.skipAutoNavigate) {
      setTubeSubView(finalVideo.isQuickKick ? 'kicks' : 'watch');
      setActiveTab('videos');
    }
    addFanPoints(20, isQuickKick ? 'Uploaded 9:16 Quick Kick' : 'Uploaded Futfield Tube Clip');
    refreshMediaAndAnalytics().catch(() => {});
    return finalVideo;
  };

  const deleteVideo = async (videoId: string): Promise<boolean> => {
    haptics.light();
    setVideos(prev => prev.filter(v => v.id !== videoId));
    setLatestUploadedVideoId(prev => (prev === videoId ? null : prev));
    setTubeWatchVideoId(prev => (prev === videoId ? null : prev));
    setActiveVideoIndex(0);
    const ok = await deleteVideoOnServer(videoId);
    addNotification({
      title: 'Clip Removed',
      body: 'Your clip has been deleted from Futfield Tube.',
      type: 'system',
    });
    refreshMediaAndAnalytics().catch(() => {});
    return ok;
  };

  const toggleJoinCommunity = async (communityId: string) => {
    const target = communities.find(c => c.id === communityId);
    if (!target) return;
    const nextJoined = !target.isJoined;
    const action = nextJoined ? 'join' : 'leave';

    setCommunities(prev =>
      prev.map(c => {
        if (c.id === communityId) {
          const raw = nextJoined ? c.rawFanCount + 1 : Math.max(0, c.rawFanCount - 1);
          return {
            ...c,
            isJoined: nextJoined,
            rawFanCount: raw,
            fanCount: `${raw} fan${raw === 1 ? '' : 's'}`,
          };
        }
        return c;
      })
    );

    addFanPoints(20, nextJoined ? 'Joined football community' : 'Left community');
    const res = await joinServerCommunity(communityId, user.handle || user.id, action);
    if (res && res.success) {
      setCommunities(prev =>
        prev.map(c =>
          c.id === communityId
            ? { ...c, rawFanCount: res.count, fanCount: `${res.count} fan${res.count === 1 ? '' : 's'}` }
            : c
        )
      );
    }
  };

  const addCommunity = async (data: {
    name: string;
    category: Community['category'];
    crest: string;
    description: string;
    rules?: string[];
  }) => {
    const newComm: Community = {
      id: `c_${Date.now()}`,
      name: data.name,
      category: data.category,
      crest: data.crest,
      fanCount: '1 fan',
      rawFanCount: 1,
      isJoined: true,
      hasModBadge: false,
      description: data.description,
      rules: data.rules || ['Respect all football fans', 'Keep banter friendly'],
    };

    setCommunities(prev => [newComm, ...prev]);
    addFanPoints(50, 'Founded a new football community');
    await createServerCommunity(newComm);
  };

  const addNotification = (n: Omit<AppNotification, 'id' | 'time' | 'isRead'>) => {
    const newNotif: AppNotification = {
      ...n,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      time: 'Just now',
      isRead: false,
    };
    setNotifications(prev => [newNotif, ...prev]);
    setActiveToastNotification(newNotif);

    // Auto-dismiss in-app banner after 4.5 seconds
    setTimeout(() => {
      setActiveToastNotification(current => (current?.id === newNotif.id ? null : current));
    }, 4500);
  };

  const dismissToastNotification = () => {
    setActiveToastNotification(null);
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const unreadNotificationsCount = notifications.filter(n => !n.isRead).length;

  const logout = async () => {
    await logoutUser();
    setUser(INITIAL_USER);
    try {
      localStorage.removeItem('futfield_user');
    } catch {}
  };

  const canGoBack = Boolean(
    activeMatchRoom ||
    shareModalPayload ||
    pricingModalOpen ||
    playerScoutModalOpen ||
    notificationsModalOpen ||
    searchModalOpen ||
    monetizationModalOpen ||
    selectedCreatorForProfile ||
    aiDrawerOpen ||
    authModalOpen ||
    selectedCommunity ||
    viewingProfileUserId ||
    navHistory.length > 0 ||
    activeTab !== 'home'
  );

  const goBack = () => {
    haptics.light();
    // 1. Dismiss topmost overlay modal / drawer first
    if (shareModalPayload) {
      closeShareSheet();
      return;
    }
    if (activeMatchRoom) {
      closeMatchRoom();
      return;
    }
    if (selectedCreatorForProfile) {
      closeCreatorProfile();
      return;
    }
    if (pricingModalOpen) {
      setPricingModalOpen(false);
      return;
    }
    if (monetizationModalOpen) {
      setMonetizationModalOpen(false);
      return;
    }
    if (playerScoutModalOpen) {
      setPlayerScoutModalOpen(false);
      return;
    }
    if (notificationsModalOpen) {
      setNotificationsModalOpen(false);
      return;
    }
    if (searchModalOpen) {
      setSearchModalOpen(false);
      return;
    }
    if (aiDrawerOpen) {
      setAiDrawerOpen(false);
      return;
    }
    if (authModalOpen) {
      setAuthModalOpen(false);
      return;
    }
    // 2. Allow active tab sub-view to intercept Back (e.g. PitchReels Dedicated Video, Menu subpage)
    if (subBackHandlerRef.current && subBackHandlerRef.current()) {
      return;
    }
    // 3. Pop active community view
    if (selectedCommunity) {
      setSelectedCommunityState(null);
      return;
    }
    // 4. Restore previous navigation history snapshot
    if (navHistory.length > 0) {
      const prev = navHistory[navHistory.length - 1];
      setNavHistory(h => h.slice(0, -1));
      setActiveTabState(prev.activeTab);
      setViewingProfileUserId(prev.viewingProfileUserId);
      setSelectedCommunityState(prev.selectedCommunity);
      return;
    }
    // 5. Fallback to Home Feed
    if (viewingProfileUserId) {
      setViewingProfileUserId(null);
    }
    if (activeTab !== 'home') {
      setActiveTabState('home');
    }
  };

  // Deep-link /match/:id activation once matches load
  const pendingDeepLinkMatchIdRef = useRef<string | null>(initialRouteRef.current.matchId);
  useEffect(() => {
    if (!pendingDeepLinkMatchIdRef.current || matches.length === 0) return;
    const found = matches.find(m => m.id === pendingDeepLinkMatchIdRef.current);
    if (found) {
      setActiveMatchRoom(found);
      pendingDeepLinkMatchIdRef.current = null;
    }
  }, [matches]);

  // Reset scroll to top immediately whenever any feature or route changes
  useLayoutEffect(() => {
    scrollToTopInstant();
  }, [
    activeTab,
    supportSection,
    activeMatchRoom?.id,
    viewingProfileUserId,
    activeBlogSlug,
    tubeSubView,
    tubeWatchVideoId,
    tubeFanZoneHandle,
    selectedCommunity?.id,
  ]);

  // Dynamic Per-Route SEO Metadata + Browser URL Sync
  useEffect(() => {
    applyRouteSeoMetadata({
      activeTab,
      supportSection,
      activeMatchRoom,
      viewingProfileUserId,
      activeBlogSlug,
      matches,
      tubeSubView,
      tubeWatchVideoId,
      tubeFanZoneHandle,
    });

    if (typeof window !== 'undefined') {
      const targetPath = resolvePathFromAppState({
        activeTab,
        supportSection,
        activeMatchRoom,
        viewingProfileUserId,
        activeBlogSlug,
        tubeSubView,
        tubeWatchVideoId,
        tubeFanZoneHandle,
      });
      // Preserve Paystack verification query params when present
      const hasPaymentParams =
        window.location.search.includes('reference=') ||
        window.location.search.includes('trxref=');
      if (!hasPaymentParams && window.location.pathname !== targetPath) {
        try {
          window.history.replaceState({}, document.title, targetPath);
        } catch {}
      }
    }
  }, [activeTab, supportSection, activeMatchRoom, viewingProfileUserId, activeBlogSlug, matches, tubeSubView, tubeWatchVideoId, tubeFanZoneHandle]);

  return (
    <FootballContext.Provider
      value={{
        user,
        updateUser,
        addFanPoints,
        activeTab,
        setActiveTab,
        activeBlogSlug,
        openBlogArticle,
        supportSection,
        setSupportSection,
        supportPrefillCategory,
        openSupportLegalPage,
        canGoBack,
        goBack,
        registerBackHandler,
        viewingProfileUserId,
        setViewingProfileUserId,
        navigateToProfile,
        toggleFollowUser,
        mobileFrameMode,
        setMobileFrameMode,
        theme,
        setTheme,
        clubTheme,
        setClubTheme,
        dataSavingMode,
        setDataSavingMode,
        refreshFrequency,
        setRefreshFrequency,
        goalSoundEnabled,
        setGoalSoundEnabled,
        cardAlertsEnabled,
        setCardAlertsEnabled,
        varAlertsEnabled,
        setVarAlertsEnabled,
        dmPrivacy,
        setDmPrivacy,
        readReceiptsEnabled,
        setReadReceiptsEnabled,
        clearAppCache,
        posts,
        addPost,
        toggleLikePost,
        reactToPost,
        toggleRepost,
        toggleSavePost,
        votePoll,
        addCommentToPost,
        translatePostContent,
        matches,
        activeMatchRoom,
        openMatchRoom,
        closeMatchRoom,
        matchChats,
        sendMatchMessage,
        reactToMessage,
        deleteMatchMessage,
        pinMatchMessage,
        videos,
        activeVideoIndex,
        setActiveVideoIndex,
        latestUploadedVideoId,
        setLatestUploadedVideoId,
        tubeSubView,
        setTubeSubView,
        tubeWatchVideoId,
        setTubeWatchVideoId,
        tubeFanZoneHandle,
        setTubeFanZoneHandle,
        openFanZone,
        openTubeUpload,
        openQuickKicks,
        openVideoInReels,
        toggleLikeVideo,
        reactToVideo,
        shareVideo,
        toggleSaveVideo,
        toggleSubscribeCreator,
        addVideo,
        deleteVideo,
        realtimeAnalytics,
        mediaStorageStats,
        refreshMediaAndAnalytics,
        communities,
        addCommunity,
        toggleJoinCommunity,
        selectedCommunity,
        setSelectedCommunity,
        notifications,
        markNotificationAsRead,
        markAllNotificationsRead,
        unreadNotificationsCount,
        notificationsModalOpen,
        setNotificationsModalOpen,
        addNotification,
        activeToastNotification,
        dismissToastNotification,
        authModalOpen,
        setAuthModalOpen,
        logout,
        aiDrawerOpen,
        setAiDrawerOpen,
        searchModalOpen,
        setSearchModalOpen,
        showIntro,
        setShowIntro,
        showWelcome,
        setShowWelcome,
        showClubSelection,
        setShowClubSelection,
        playerScoutModalOpen,
        setPlayerScoutModalOpen,
        fetchLiveMatches,
        matchesLoading,
        connectedCreators,
        toggleConnectCreator,
        isCreatorConnected,
        selectedCreatorForProfile,
        openCreatorProfile,
        closeCreatorProfile,
        creatorWallet,
        requestPayout,
        fetchMonetizationAdvice,
        monetizationModalOpen,
        setMonetizationModalOpen,
        pricingModalOpen,
        setPricingModalOpen,
        shareModalPayload,
        openShareSheet,
        closeShareSheet,
        targetPostId,
        setTargetPostId,
        showSplash,
        setShowSplash,
        replaySplash,
        refreshAndClearProfile,
      }}
    >
      {children}
    </FootballContext.Provider>
  );
};

export const useFootball = () => {
  const context = useContext(FootballContext);
  if (!context) {
    throw new Error('useFootball must be used within a FootballProvider');
  }
  return context;
};
