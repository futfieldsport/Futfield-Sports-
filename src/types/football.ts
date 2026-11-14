export interface UserProfile {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  bio: string;
  favoriteClub: string;
  favoriteClubCrest: string;
  favoriteCountry: string;
  favoriteCountryFlag: string;
  favoritePlayers: string[];
  fanPoints: number;
  weeklyPoints: number;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  predictionAccuracy: number;
  correctPredictions: number;
  totalPredictions: number;
  badges: {
    id: string;
    name: string;
    icon: string;
    description: string;
    color: string;
  }[];
  clubTheme?: string;
  isModerator?: boolean;
  email?: string;
  isAuthenticated?: boolean;
  location?: string;
  website?: string;
  joinedAt?: string;
  membershipTier?: 'free' | 'pro' | 'vip';
  membershipExpiresAt?: string;
  isPro?: boolean;
  proPlan?: 'monthly' | 'yearly' | 'pro' | 'vip' | 'season';
  proExpiresAt?: string;
  country?: string;
  paystackReference?: string;
  paystackSubscriptionCode?: string;
  paystackCustomerCode?: string;
  lastPaymentCurrency?: string;
}

export interface PollOption {
  id: string;
  label: string;
  votes: number;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  userVotedOptionId?: string;
  expiresIn: string;
}

export interface PostComment {
  id: string;
  postId?: string;
  parentId?: string | null;
  author: {
    name: string;
    handle: string;
    avatar: string;
    clubBadge?: string;
  };
  text: string;
  timestamp: string;
  likes: number;
  isLiked?: boolean;
  replies?: PostComment[];
}

export interface Post {
  id: string;
  userId?: string;
  author: {
    name: string;
    handle: string;
    avatar: string;
    clubBadge?: string;
    isVerified?: boolean;
  };
  content: string;
  timestamp: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  imageUrl?: string;
  videoUrl?: string;
  mediaSizeBytes?: number;
  mediaSizeMb?: number;
  location?: string;
  clubTag?: string;
  feeling?: string;
  privacy?: 'public' | 'followers' | 'private';
  poll?: Poll;
  likes: number;
  isLiked: boolean;
  reactions?: Record<string, number>;
  userReactions?: string[];
  commentsCount: number;
  commentsList?: PostComment[];
  shares: number;
  reposts: number;
  isReposted?: boolean;
  isSaved?: boolean;
  isEdited?: boolean;
  tags: string[];
  category: 'foryou' | 'following' | 'trending';
  communityId?: string;
  translatedContent?: string;
  isTranslating?: boolean;
}

export interface MatchEvent {
  id: string;
  minute: string;
  type: 'goal' | 'yellow_card' | 'red_card' | 'substitution';
  player: string;
  assist?: string;
  team: 'home' | 'away';
}

export interface MatchTeam {
  id: string;
  name: string;
  shortName: string;
  crest: string;
  score: number;
}

export interface MatchStats {
  possession: [number, number]; // home, away %
  shots: [number, number];
  shotsOnTarget: [number, number];
  corners: [number, number];
  fouls: [number, number];
  yellowCards: [number, number];
  redCards: [number, number];
  xg?: [number, number];
}

export interface LineupPlayer {
  number: number;
  name: string;
  position: string;
  isCaptain?: boolean;
}

export interface Match {
  id: string;
  league: string;
  round?: string;
  homeTeam: MatchTeam;
  awayTeam: MatchTeam;
  status: 'LIVE' | 'TODAY' | 'TOMORROW' | 'FINISHED';
  minute?: number | string;
  dateStr: string;
  timeStr: string;
  activeFansCount: number;
  events: MatchEvent[];
  stats: MatchStats;
  lineups: {
    home: LineupPlayer[];
    away: LineupPlayer[];
  };
  venue: string;
  aiRecap?: string;
}

export type MatchMessageType = 'chat' | 'goal' | 'yellow' | 'red' | 'sub' | 'system' | 'highlight';
export type MatchMediaType = 'text' | 'image' | 'video' | 'voice' | 'gif';

export interface MatchChatMessage {
  id: string;
  roomId?: string;
  matchId: string;
  userId?: string;
  user: {
    id?: string;
    name: string;
    handle: string;
    avatar: string;
    isMod?: boolean;
    favoriteClub?: string;
  };
  text: string;
  content?: string;
  timestamp: string;
  createdAt?: string;
  messageType?: MatchMessageType;
  mediaType?: MatchMediaType;
  mediaUrl?: string;
  thumbnailUrl?: string;
  voiceDuration?: number;
  waveform?: number[];
  replyToId?: string;
  replyToMessage?: {
    authorName: string;
    text: string;
    mediaType?: MatchMediaType;
    thumbnailUrl?: string;
  };
  isPinned?: boolean;
  isDeleted?: boolean;
  reactions: {
    thumbsUp?: number;
    shocked?: number;
    fire?: number;
    goal?: number;
    [key: string]: number | undefined;
  };
  userReactions?: string[];
  status?: 'sending' | 'sent' | 'delivered' | 'read';
}

export interface VideoItem {
  id: string;
  userId?: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: string;
  durationSeconds: number;
  views: number;
  clubTag?: string;
  privacy?: 'public' | 'followers' | 'private';
  createdAt?: string;
  creator: {
    name: string;
    handle: string;
    subscribers: string;
    avatar: string;
    isVerified?: boolean;
    isSubscribed?: boolean;
  };
  likes: number;
  isLiked: boolean;
  reactions?: Record<string, number>;
  userReactions?: string[];
  commentsCount: number;
  shares: number;
  isSaved: boolean;
  sizeBytes?: number;
  sizeMb?: number;
  quality: string;
  videoKind?: 'short' | 'video';
  aspectRatio?: '9:16' | '16:9';
  copyrightStatus?: 'CLEAR' | 'WARNING' | 'BLOCKED';
  copyrightReport?: {
    status: 'CLEAR' | 'WARNING' | 'BLOCKED';
    riskLevel: 'none' | 'low' | 'high' | 'critical';
    confidenceScore: number;
    drmDetected: boolean;
    sha256: string;
    detectedClaims: Array<{ code: string; category: string; match: string; severity: string; reason: string }>;
    reason: string;
    scannedAt: string;
    engine: string;
  };
  tacticalSummary?: string;
  category: 'foryou' | 'subscriptions' | 'playlists' | 'highlights';
  hashtags: string[];
}

export interface Community {
  id: string;
  name: string;
  category: 'club' | 'country' | 'league';
  crest: string;
  bannerUrl?: string;
  fanCount: string;
  rawFanCount: number;
  isJoined: boolean;
  hasModBadge?: boolean;
  description: string;
  rules: string[];
}

export interface AppNotification {
  id: string;
  type: 'goal' | 'match_start' | 'reply' | 'follow' | 'trending' | 'comment' | 'like' | 'system' | 'video';
  title: string;
  body: string;
  time: string;
  isRead: boolean;
  matchId?: string;
  postId?: string;
}
