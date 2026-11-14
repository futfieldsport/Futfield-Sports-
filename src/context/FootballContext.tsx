import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  fetchMediaStorageStats,
  fetchRealtimeAnalytics,
} from '../services/supabaseClient';
import { translateText } from '../services/footballAi';
import { applyRouteSeoMetadata, resolvePathFromAppState } from '../utils/seo';

export type MainTab = 'home' | 'scores' | 'videos' | 'communities' | 'menu' | 'profile' | 'settings' | 'studio' | 'pricing' | 'support' | 'blog' | 'reviews';

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
  
  // Videos & PitchReels
  videos: VideoItem[];
  activeVideoIndex: number;
  setActiveVideoIndex: (idx: number) => void;
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
    category?: VideoItem['category'];
    hashtags?: string[];
    duration?: string;
    durationSeconds?: number;
    sizeBytes?: number;
    sizeMb?: number;
    videoKind?: 'short' | 'video';
    aspectRatio?: '9:16' | '16:9';
    copyrightStatus?: 'CLEAR' | 'WARNING' | 'BLOCKED';
    copyrightReport?: any;
  }) => Promise<void>;
  
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

  // Daily Highlight Reel
  showDailyHighlightReel: boolean;
  setShowDailyHighlightReel: (open: boolean) => void;
  dailyHighlightClips: VideoItem[];

  // Creator Monetization Wallet & Stadium Gifting
  creatorWallet: {
    userId: string;
    balance: number;
    totalEarned: number;
    tipsReceived: number;
    adRevenue: number;
    subscriptions: number;
    transactions: any[];
  };
  sendGiftToCreator: (
    toUserHandle: string,
    toUserName: string,
    gift: { id: string; name: string; icon: string; price: number },
    postId?: string,
    videoId?: string
  ) => Promise<boolean>;
  requestPayout: (amount: number, method: string, destination: string) => Promise<boolean>;
  fetchMonetizationAdvice: () => Promise<any>;
  monetizationModalOpen: boolean;
  setMonetizationModalOpen: (open: boolean) => void;
  pricingModalOpen: boolean;
  setPricingModalOpen: (open: boolean) => void;
}

const FootballContext = createContext<FootballContextType | undefined>(undefined);

export const FootballProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Purge any stale client mock records from previous runs on initialization
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
    if (typeof window === 'undefined') {
      return { tab: 'home' as MainTab, support: 'support' as SupportLegalSection, blogSlug: null as string | null, profileId: null as string | null, matchId: null as string | null };
    }
    const rawPath = window.location.pathname || '/';
    const p = rawPath.toLowerCase();
    if (p === '/live-scores') return { tab: 'scores' as MainTab, support: 'support' as SupportLegalSection, blogSlug: null, profileId: null, matchId: null };
    if (p === '/features') return { tab: 'menu' as MainTab, support: 'support' as SupportLegalSection, blogSlug: null, profileId: null, matchId: null };
    if (p === '/pricing') return { tab: 'pricing' as MainTab, support: 'support' as SupportLegalSection, blogSlug: null, profileId: null, matchId: null };
    if (p === '/terms') return { tab: 'support' as MainTab, support: 'terms' as SupportLegalSection, blogSlug: null, profileId: null, matchId: null };
    if (p === '/privacy') return { tab: 'support' as MainTab, support: 'privacy' as SupportLegalSection, blogSlug: null, profileId: null, matchId: null };
    if (p === '/refund') return { tab: 'support' as MainTab, support: 'refund' as SupportLegalSection, blogSlug: null, profileId: null, matchId: null };
    if (p === '/reviews') return { tab: 'reviews' as MainTab, support: 'support' as SupportLegalSection, blogSlug: null, profileId: null, matchId: null };
    if (p === '/blog' || p.startsWith('/blog/')) {
      const slug = rawPath.replace(/^\/blog\/?/i, '').trim() || null;
      return { tab: 'blog' as MainTab, support: 'support' as SupportLegalSection, blogSlug: slug, profileId: null, matchId: null };
    }
    if (p.startsWith('/profile/')) {
      const uname = decodeURIComponent(rawPath.replace(/^\/profile\//i, '')).trim() || null;
      return { tab: 'profile' as MainTab, support: 'support' as SupportLegalSection, blogSlug: null, profileId: uname, matchId: null };
    }
    if (p.startsWith('/match/')) {
      const mId = decodeURIComponent(rawPath.replace(/^\/match\//i, '')).trim() || null;
      return { tab: 'scores' as MainTab, support: 'support' as SupportLegalSection, blogSlug: null, profileId: null, matchId: mId };
    }
    return { tab: 'home' as MainTab, support: 'support' as SupportLegalSection, blogSlug: null, profileId: null, matchId: null };
  };

  const initialRouteRef = useRef(getInitialUrlRoute());

  const [activeTab, setActiveTabState] = useState<MainTab>(initialRouteRef.current.tab);
  const [activeBlogSlug, setActiveBlogSlug] = useState<string | null>(initialRouteRef.current.blogSlug);
  const [supportSection, setSupportSection] = useState<SupportLegalSection>(initialRouteRef.current.support);
  const [supportPrefillCategory, setSupportPrefillCategory] = useState<string | null>(null);
  const [viewingProfileUserId, setViewingProfileUserId] = useState<string | null>(initialRouteRef.current.profileId);
  const [mobileFrameMode, setMobileFrameModeState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('futfield_mobile_frame');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
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
    if (activeTab !== 'blog') {
      pushCurrentLocationToHistory();
      setSelectedCommunityState(null);
    }
    setActiveBlogSlug(slug || null);
    setActiveTabState('blog');
  };

  const openSupportLegalPage = (section: SupportLegalSection, prefillCategory?: string) => {
    setSupportSection(section);
    setSupportPrefillCategory(prefillCategory || null);
    if (activeTab !== 'support') {
      pushCurrentLocationToHistory();
      setSelectedCommunityState(null);
      setActiveTabState('support');
    }
  };

  const setSelectedCommunity = (c: Community | null) => {
    if (c?.id !== selectedCommunity?.id) {
      pushCurrentLocationToHistory();
      setSelectedCommunityState(c);
    }
  };

  const navigateToProfile = (userIdOrHandle?: string) => {
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
  
  // Light Mode & Dark Mode with persistence
  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('futfield_theme');
      return saved === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  const setTheme = (t: 'dark' | 'light') => {
    setThemeState(t);
    try {
      localStorage.setItem('futfield_theme', t);
      if (t === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch {}
  };

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

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
        if (Array.isArray(srv) && srv.length > 0) setPosts(srv);
      })
      .catch(() => {});
    fetchServerVideos()
      .then(srv => {
        if (Array.isArray(srv) && srv.length > 0) setVideos(srv);
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
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return INITIAL_POSTS;
  });
  const [matches, setMatches] = useState<Match[]>(INITIAL_MATCHES);
  const [activeMatchRoom, setActiveMatchRoom] = useState<Match | null>(null);
  const [matchChats, setMatchChats] = useState<Record<string, MatchChatMessage[]>>(INITIAL_MATCH_CHAT);

  const [videos, setVideos] = useState<VideoItem[]>(() => {
    try {
      const saved = localStorage.getItem('futfield_videos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return INITIAL_VIDEOS;
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

  // Daily Highlight Reel State (auto-aggregates top 5 trending match clips)
  const [showDailyHighlightReel, setShowDailyHighlightReel] = useState(false);
  const dailyHighlightClips = useMemo(() => {
    return [...videos]
      .sort((a, b) => (b.views + b.likes * 3) - (a.views + a.likes * 3))
      .slice(0, 5);
  }, [videos]);

  // Creator Monetization Wallet & Gifting State
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

  const sendGiftToCreator = async (
    toUserHandle: string,
    toUserName: string,
    gift: { id: string; name: string; icon: string; price: number },
    postId?: string,
    videoId?: string
  ): Promise<boolean> => {
    haptics.like();
    try {
      const res = await fetch('/api/monetization/tip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: user.id,
          fromUserName: user.name,
          toUserHandle,
          giftName: gift.name,
          amount: gift.price,
          postId,
          videoId,
        }),
      });
      if (res.ok) {
        addFanPoints(3, `Gifted ${gift.name}`);
        addNotification({
          title: `Gift Sent to ${toUserName}! 🎁`,
          body: `You sent a ${gift.name} ($${gift.price.toFixed(2)}). +3 Fan Points awarded!`,
          type: 'like',
        });
        return true;
      }
    } catch {}
    return true;
  };

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

  // Poll subscription status for automatic expiration downgrade & alert
  useEffect(() => {
    if (!user?.id) return;
    const checkSub = () => {
      fetch(`/api/subscriptions/check/${encodeURIComponent(user.id)}`)
        .then(r => (r.ok ? r.json() : null))
        .then(data => {
          if (!data) return;
          if (data.isExpired && user.isPro) {
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
  }, [user.id, user.isPro]);

  // Real-Time Global Feed Stream (Instant Worldwide Post, Video, Engagement & Analytics Sync)
  useEffect(() => {
    let sse: EventSource | null = null;
    let reconnectTimer: any = null;

    const connectStream = () => {
      try {
        sse = new EventSource('/api/db/feed/stream');

        sse.addEventListener('new_post', (e: MessageEvent) => {
          try {
            const incomingPost: Post = JSON.parse(e.data);
            if (incomingPost && incomingPost.id) {
              setPosts(prev => {
                if (prev.some(p => p.id === incomingPost.id)) return prev;
                return [incomingPost, ...prev];
              });
            }
          } catch {}
        });

        sse.addEventListener('new_video', (e: MessageEvent) => {
          try {
            const incomingVideo: VideoItem = JSON.parse(e.data);
            if (incomingVideo && incomingVideo.id) {
              setVideos(prev => {
                if (prev.some(v => v.id === incomingVideo.id)) return prev;
                return [incomingVideo, ...prev];
              });
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

        sse.addEventListener('tip_received', (e: MessageEvent) => {
          try {
            const tipData = JSON.parse(e.data);
            if (tipData?.toUserHandle === user.handle) {
              setCreatorWallet(prev => ({
                ...prev,
                balance: +(prev.balance + tipData.amount).toFixed(2),
                totalEarned: +(prev.totalEarned + tipData.amount).toFixed(2),
                tipsReceived: +(prev.tipsReceived + tipData.amount).toFixed(2),
                transactions: [
                  {
                    id: `tx_${Date.now()}`,
                    type: 'tip',
                    amount: tipData.amount,
                    description: `Gift: ${tipData.giftName} from ${tipData.fromUserName}`,
                    fromUser: tipData.fromUserName,
                    status: 'COMPLETED',
                    timestamp: 'Just now',
                  },
                  ...prev.transactions,
                ],
              }));
              addNotification({
                title: 'Stadium Gift Received! 🎁',
                body: `${tipData.fromUserName} sent you a ${tipData.giftName} ($${tipData.amount.toFixed(2)})!`,
                type: 'like',
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
        if (serverPosts && serverPosts.length > 0) {
          setPosts(prev => {
            const serverIds = new Set(serverPosts.map(p => p.id));
            const localOnly = prev.filter(p => !serverIds.has(p.id));
            return [...serverPosts, ...localOnly];
          });
        }
      })
      .catch(() => {});

    fetchServerVideos()
      .then(serverVideos => {
        if (serverVideos && serverVideos.length > 0) {
          setVideos(prev => {
            const serverIds = new Set(serverVideos.map(v => v.id));
            const localOnly = prev.filter(v => !serverIds.has(v.id));
            return [...serverVideos, ...localOnly];
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

  // Dark mode class sync with documentElement
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

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
        if (v.creator.handle === creatorHandle) {
          return {
            ...v,
            creator: {
              ...v.creator,
              isSubscribed: !v.creator.isSubscribed,
            },
          };
        }
        return v;
      })
    );
  };

  const addVideo = async (data: {
    title: string;
    description: string;
    videoUrl: string;
    thumbnailUrl?: string;
    clubTag?: string;
    privacy?: 'public' | 'followers' | 'private';
    category?: VideoItem['category'];
    hashtags?: string[];
    duration?: string;
    durationSeconds?: number;
    sizeBytes?: number;
    sizeMb?: number;
    videoKind?: 'short' | 'video';
    aspectRatio?: '9:16' | '16:9';
    copyrightStatus?: 'CLEAR' | 'WARNING' | 'BLOCKED';
    copyrightReport?: any;
  }) => {
    const isProUser = Boolean(user.isPro || user.membershipTier === 'pro' || user.membershipTier === 'vip');
    const limitCheck = checkDailyLimit(user.id, 'video', isProUser);
    if (!limitCheck.allowed) {
      addNotification({
        title: 'Free Tier Limit Reached ⚠️',
        body: limitCheck.message || 'Daily PitchReels upload limit reached. Upgrade to Pro for unlimited uploads!',
        type: 'system',
      });
      setPricingModalOpen(true);
      return;
    }
    incrementDailyLimit(user.id, 'video');

    const durSec = data.durationSeconds || 30;
    const durFormatted = data.duration || `${Math.floor(durSec / 60)}:${(durSec % 60).toString().padStart(2, '0')}`;
    const resolvedKind: 'short' | 'video' =
      data.videoKind || (data.aspectRatio === '16:9' || durSec > 120 ? 'video' : 'short');
    const resolvedRatio: '9:16' | '16:9' =
      data.aspectRatio || (resolvedKind === 'video' ? '16:9' : '9:16');

    const newVideo: VideoItem = {
      id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId: user.id,
      title: data.title,
      description: data.description,
      videoUrl: data.videoUrl,
      thumbnailUrl: data.thumbnailUrl || '/assets/aistudio/IMG-20261102-WA2735_f2548d41.jpg',
      duration: durFormatted,
      durationSeconds: durSec,
      views: 1,
      clubTag: data.clubTag,
      privacy: data.privacy || 'public',
      createdAt: 'Just now',
      creator: {
        name: user.name,
        handle: user.handle,
        subscribers: '1 supporter',
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
      copyrightStatus: data.copyrightStatus || 'CLEAR',
      copyrightReport: data.copyrightReport,
      quality: resolvedRatio === '16:9' ? '1080p Widescreen · Pitch Sound ON' : '1080p 9:16 Short · Pitch Sound ON',
      tacticalSummary: data.description,
      category: data.category || 'foryou',
      hashtags: data.hashtags || [resolvedKind === 'short' ? '#PitchShorts' : '#PitchVideos', '#FUTFIELD'],
    };

    const serverRes = await uploadServerVideo(newVideo);
    if (!serverRes.success) {
      haptics.warning();
      addNotification({
        title: 'Video Upload Blocked ⚠️',
        body: serverRes.error || 'Video failed server duration or copyright validation.',
        type: 'system',
      });
      return;
    }

    const finalVideo = serverRes.video ? { ...newVideo, ...serverRes.video } : newVideo;
    setVideos(prev => [finalVideo, ...prev.filter(v => v.id !== finalVideo.id)]);
    setActiveVideoIndex(0);
    setActiveTab('videos');
    addFanPoints(20, resolvedKind === 'short' ? 'Uploaded 9:16 Pitch Short' : 'Uploaded 16:9 Football Video');
    refreshMediaAndAnalytics().catch(() => {});
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
    pricingModalOpen ||
    playerScoutModalOpen ||
    notificationsModalOpen ||
    searchModalOpen ||
    monetizationModalOpen ||
    selectedCreatorForProfile ||
    aiDrawerOpen ||
    authModalOpen ||
    showDailyHighlightReel ||
    selectedCommunity ||
    viewingProfileUserId ||
    navHistory.length > 0 ||
    activeTab !== 'home'
  );

  const goBack = () => {
    haptics.light();
    // 1. Dismiss topmost overlay modal / drawer first
    if (activeMatchRoom) {
      closeMatchRoom();
      return;
    }
    if (selectedCreatorForProfile) {
      closeCreatorProfile();
      return;
    }
    if (showDailyHighlightReel) {
      setShowDailyHighlightReel(false);
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

  // Dynamic Per-Route SEO Metadata + Browser URL Sync
  useEffect(() => {
    applyRouteSeoMetadata({
      activeTab,
      supportSection,
      activeMatchRoom,
      viewingProfileUserId,
      activeBlogSlug,
      matches,
    });

    if (typeof window !== 'undefined') {
      const targetPath = resolvePathFromAppState({
        activeTab,
        supportSection,
        activeMatchRoom,
        viewingProfileUserId,
        activeBlogSlug,
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
  }, [activeTab, supportSection, activeMatchRoom, viewingProfileUserId, activeBlogSlug, matches]);

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
        toggleLikeVideo,
        reactToVideo,
        shareVideo,
        toggleSaveVideo,
        toggleSubscribeCreator,
        addVideo,
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
        showDailyHighlightReel,
        setShowDailyHighlightReel,
        dailyHighlightClips,
        creatorWallet,
        sendGiftToCreator,
        requestPayout,
        fetchMonetizationAdvice,
        monetizationModalOpen,
        setMonetizationModalOpen,
        pricingModalOpen,
        setPricingModalOpen,
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
