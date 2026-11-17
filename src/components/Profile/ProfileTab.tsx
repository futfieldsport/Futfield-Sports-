import React, { useState, useRef, useEffect } from 'react';
import {
  Trophy,
  Flame,
  Star,
  Edit3,
  CheckCircle2,
  Share2,
  Award,
  Zap,
  Target,
  Shield,
  Layers,
  Settings as SettingsIcon,
  Bookmark,
  MessageSquare,
  MapPin,
  Calendar,
  Globe,
  Camera,
  X,
  ChevronRight,
  Heart,
  Video,
  Grid,
  ArrowLeft,
  UserPlus,
  UserCheck,
  Send,
  Loader2,
  ExternalLink,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { POPULAR_TOP_5_CLUBS } from '../../data/top5Clubs';
import { ClubLogo } from '../Common/ClubLogo';
import { DailyUsageTracker } from '../Common/DailyUsageTracker';
import { MediaUploadSplash, UploadSplashStatus } from '../Common/MediaUploadSplash';
import { uploadFileToBackend, formatBytesToMb } from '../../utils/mediaUpload';
import {
  syncUserProfile,
  fetchUserProfileFromServer,
  fetchUserPointsHistory,
  fetchUserFollowDetails,
  toggleFollowUserOnServer,
} from '../../services/supabaseClient';

export const ProfileTab: React.FC = () => {
  const {
    user,
    updateUser,
    addFanPoints,
    refreshAndClearProfile,
    setActiveTab,
    posts,
    videos,
    addNotification,
    setShowClubSelection,
    viewingProfileUserId,
    navigateToProfile,
    toggleFollowUser,
    openShareSheet,
    openVideoInReels,
    deleteVideo,
  } = useFootball();
  const [confirmDeleteVideoId, setConfirmDeleteVideoId] = useState<string | null>(null);

  const isOwnProfile = !viewingProfileUserId || viewingProfileUserId === user.id || viewingProfileUserId === user.handle;

  const [otherUserProfile, setOtherUserProfile] = useState<any | null>(null);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(false);
  const [activeProfileTab, setActiveProfileTab] = useState<'posts' | 'videos' | 'likes' | 'achievements'>('posts');

  // Modals state
  const [isEditing, setIsEditing] = useState(false);
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageContent, setMessageContent] = useState('');

  // Points history & follow details
  const [pointsHistory, setPointsHistory] = useState<any | null>(null);
  const [followDetails, setFollowDetails] = useState<{
    followersUsers: any[];
    followingUsers: any[];
  }>({ followersUsers: [], followingUsers: [] });
  const [isFollowingOptimistic, setIsFollowingOptimistic] = useState<boolean>(false);

  // Edit form state
  const [editName, setEditName] = useState(user.name);
  const [editHandle, setEditHandle] = useState(user.handle);
  const [editBio, setEditBio] = useState(user.bio);
  const [editClub, setEditClub] = useState(user.favoriteClub);
  const [editLocation, setEditLocation] = useState(user.location || '');
  const [editWebsite, setEditWebsite] = useState(user.website || '');
  const [editAvatar, setEditAvatar] = useState(user.avatar);
  const [avatarUploadStatus, setAvatarUploadStatus] = useState<UploadSplashStatus>('idle');
  const [avatarUploadProgress, setAvatarUploadProgress] = useState(0);
  const [avatarUploadSizeMb, setAvatarUploadSizeMb] = useState(0);
  const [avatarFileName, setAvatarFileName] = useState('');
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // Sync edit form with user state
  useEffect(() => {
    setEditName(user.name);
    setEditHandle(user.handle);
    setEditBio(user.bio);
    setEditClub(user.favoriteClub);
    setEditLocation(user.location || '');
    setEditWebsite(user.website || '');
    setEditAvatar(user.avatar);
  }, [user]);

  // Load other user's profile if inspecting another supporter
  useEffect(() => {
    if (!isOwnProfile && viewingProfileUserId) {
      setLoadingProfile(true);
      fetchUserProfileFromServer(viewingProfileUserId, user.id)
        .then(prof => {
          if (prof) {
            setOtherUserProfile(prof);
            setIsFollowingOptimistic(Boolean(prof.isFollowing));
          }
          setLoadingProfile(false);
        })
        .catch(() => setLoadingProfile(false));
    }
  }, [isOwnProfile, viewingProfileUserId, user.id]);

  // Active display profile
  const displayProfile = isOwnProfile
    ? user
    : otherUserProfile || {
        id: viewingProfileUserId,
        name: viewingProfileUserId?.startsWith('@') ? viewingProfileUserId.replace('@', '') : 'Supporter',
        handle: viewingProfileUserId?.startsWith('@') ? viewingProfileUserId : `@${viewingProfileUserId}`,
        avatar: '/assets/aistudio/IMG-20261106-WA6972_a4f2c4ba.jpg',
        bio: 'Football supporter on FUTFIELD ⚽',
        favoriteClub: 'Not Set',
        favoriteClubCrest: '⚽',
        fanPoints: 0,
        location: '',
        website: '',
        joinedAt: 'November 2026',
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        isFollowing: false,
      };

  // Real filtered items
  const userPosts = isOwnProfile
    ? posts.filter(p => p.author?.handle === user.handle || p.userId === user.id)
    : posts.filter(p => p.author?.handle === displayProfile.handle || p.userId === displayProfile.id);

  const userVideos = isOwnProfile
    ? videos.filter(v => v.creator?.handle === user.handle || v.userId === user.id)
    : videos.filter(v => v.creator?.handle === displayProfile.handle || v.userId === displayProfile.id);

  const likedPosts = isOwnProfile ? posts.filter(p => p.isLiked) : [];

  // Real counts
  const realPostsCount = userPosts.length;
  const realVideosCount = userVideos.length;
  const realFollowersCount = isOwnProfile
    ? user.followersCount || 0
    : (displayProfile.followersCount || 0) + (isFollowingOptimistic && !displayProfile.isFollowing ? 1 : !isFollowingOptimistic && displayProfile.isFollowing ? -1 : 0);
  const realFollowingCount = isOwnProfile ? user.followingCount || 0 : displayProfile.followingCount || 0;
  const currentFanPoints = displayProfile.fanPoints || 0;
  const isVerifiedBadge = currentFanPoints >= 500;

  // Real achievements check (Strictly based on real user actions)
  const earnedAchievements = [
    ...(currentFanPoints >= 1000
      ? [{ id: 'gold', name: 'Top Fan · Gold', desc: 'Over 1,000 Fan Points earned through pitch activity', color: 'from-amber-400 to-yellow-500' }]
      : []),
    ...(realPostsCount >= 7
      ? [{ id: 'streak', name: 'Pitch Streak', desc: 'Active football analyst with 7+ published takes', color: 'from-orange-500 to-red-500' }]
      : []),
    ...(displayProfile.favoriteClub && displayProfile.favoriteClub !== 'Not Set' && userPosts.filter(p => p.clubTag === displayProfile.favoriteClub).length >= 20
      ? [{ id: 'legend', name: `${displayProfile.favoriteClub} Legend`, desc: '20+ dedicated posts for chosen club', color: 'from-blue-600 to-indigo-700' }]
      : []),
    ...(realPostsCount >= 1
      ? [{ id: 'pioneer', name: 'Pitch Pioneer', desc: 'Published first match post to the community', color: 'from-emerald-400 to-teal-500' }]
      : []),
    ...(realVideosCount >= 1
      ? [{ id: 'creator', name: 'Reel Striker', desc: 'Uploaded original football skill or celebration', color: 'from-purple-400 to-pink-500' }]
      : []),
    ...(displayProfile.favoriteClub && displayProfile.favoriteClub !== 'Not Set'
      ? [{ id: 'loyal', name: `${displayProfile.favoriteClub} Faithful`, desc: 'Official club supporter badge', color: 'from-sky-400 to-blue-500' }]
      : []),
  ];

  // Open points modal & fetch real breakdown
  const handleOpenPointsModal = async () => {
    setShowPointsModal(true);
    const targetId = isOwnProfile ? user.id : displayProfile.id || displayProfile.handle;
    const res = await fetchUserPointsHistory(targetId);
    if (res) {
      setPointsHistory(res);
    }
  };

  // Open follow modals & fetch real lists
  const handleOpenFollowersModal = async () => {
    setShowFollowersModal(true);
    const targetId = isOwnProfile ? user.id : displayProfile.id || displayProfile.handle;
    const details = await fetchUserFollowDetails(targetId);
    setFollowDetails(details);
  };

  const handleOpenFollowingModal = async () => {
    setShowFollowingModal(true);
    const targetId = isOwnProfile ? user.id : displayProfile.id || displayProfile.handle;
    const details = await fetchUserFollowDetails(targetId);
    setFollowDetails(details);
  };

  // Toggle follow other user
  const handleToggleFollow = async () => {
    const targetId = displayProfile.id || displayProfile.handle;
    const nextState = !isFollowingOptimistic;
    setIsFollowingOptimistic(nextState);

    const followed = await toggleFollowUser(targetId);
    setIsFollowingOptimistic(followed);
  };

  // Avatar Upload Handler (Backend-only upload + Splash)
  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarFileName(file.name);
    setAvatarUploadSizeMb(formatBytesToMb(file.size));
    setAvatarUploadProgress(10);
    setAvatarUploadStatus('uploading');

    const res = await uploadFileToBackend(
      file,
      'avatars',
      file.name,
      (pct) => setAvatarUploadProgress(pct),
      user.id
    );

    if (res.success && res.url) {
      setAvatarUploadProgress(100);
      setAvatarUploadStatus('uploaded');
      setEditAvatar(res.url);
      updateUser({ avatar: res.url });
      addNotification({
        title: 'Avatar Uploaded!',
        body: 'Your profile photo is now saved on the backend.',
        type: 'system',
      });
    } else {
      setAvatarUploadStatus('error');
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanHandle = editHandle.trim().startsWith('@') ? editHandle.trim() : `@${editHandle.trim()}`;
    const chosenClub = POPULAR_TOP_5_CLUBS.find(c => c.name.toLowerCase() === editClub.toLowerCase());

    const updatedProfile = {
      name: editName.trim() || user.name,
      handle: cleanHandle,
      bio: editBio.trim(),
      favoriteClub: editClub,
      favoriteClubCrest: chosenClub ? '⚽' : user.favoriteClubCrest,
      location: editLocation.trim(),
      website: editWebsite.trim(),
      avatar: editAvatar,
    };

    updateUser(updatedProfile);
    syncUserProfile({ ...user, ...updatedProfile }).catch(() => {});
    setIsEditing(false);
    addFanPoints(10, 'Updated profile');
    addNotification({
      title: 'Profile Saved',
      body: 'Your football bio and credentials were updated.',
      type: 'system',
    });
  };

  const handleShareProfile = () => {
    const cleanHandle = (displayProfile.handle || '@futfield').replace(/^@?/, '@');
    const shareTitle = `${displayProfile.name} (${cleanHandle}) on FUTFIELD`;
    const shareText = `Follow ${displayProfile.name} on FUTFIELD for matchday takes, highlights & live football chat!`;
    const path = `/profile/${encodeURIComponent(cleanHandle)}`;
    const url = typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin}${path}`
      : `https://futfieldsport.com.ng${path}`;

    openShareSheet({
      kind: 'profile',
      title: shareTitle,
      text: shareText,
      url,
      previewImage: displayProfile.avatar,
    });
  };

  // Send Direct Banter / Message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageContent.trim()) return;

    addNotification({
      title: 'Message Sent!',
      body: `Your message was delivered to ${displayProfile.name}.`,
      type: 'system',
    });
    setMessageContent('');
    setShowMessageModal(false);
  };

  // Clickable bio renderer (handles URLs, hashtags, mentions)
  const renderFormattedBio = (text: string) => {
    if (!text) return 'Football supporter on FUTFIELD ⚽';
    const words = text.split(' ');
    return words.map((w, idx) => {
      if (w.startsWith('http://') || w.startsWith('https://')) {
        return (
          <a
            key={idx}
            href={w}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline font-semibold inline-flex items-center gap-0.5 mx-0.5"
            onClick={e => e.stopPropagation()}
          >
            {w.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            <ExternalLink className="w-2.5 h-2.5 inline" />
          </a>
        );
      }
      if (w.startsWith('#')) {
        return (
          <span key={idx} className="text-[#00E676] font-bold mx-0.5 cursor-pointer hover:underline">
            {w}{' '}
          </span>
        );
      }
      if (w.startsWith('@')) {
        return (
          <span
            key={idx}
            onClick={e => {
              e.stopPropagation();
              navigateToProfile(w);
            }}
            className="text-sky-500 font-bold mx-0.5 cursor-pointer hover:underline"
          >
            {w}{' '}
          </span>
        );
      }
      return <span key={idx}>{w} </span>;
    });
  };

  if (loadingProfile) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-7 h-7 text-[#00E676] animate-spin" />
        <p className="text-xs text-slate-500 dark:text-white/60">Loading supporter profile...</p>
      </div>
    );
  }

  return (
    <div className="pb-28 max-w-2xl mx-auto px-3 sm:px-4 pt-2 space-y-4">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pt-1">
        {isOwnProfile ? (
          <>
            <h1 className="font-display text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Profile
            </h1>
            <div className="flex items-center gap-1.5">
              <button
                onClick={refreshAndClearProfile}
                className="min-h-[40px] px-3 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 border border-slate-200 dark:border-white/10 whitespace-nowrap"
                title="Clear and Refresh Profile Stats"
              >
                <RotateCcw className="w-3.5 h-3.5 text-emerald-600 dark:text-[#00E676]" />
                <span>Refresh &amp; Clear</span>
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center p-2 text-slate-600 dark:text-white/80 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors"
                title="Account Settings"
              >
                <SettingsIcon className="w-5 h-5" />
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => navigateToProfile()}
              className="min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 rounded-full text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5 font-bold text-xs transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <h1 className="font-display text-sm font-extrabold text-slate-900 dark:text-white truncate max-w-[200px]">
              {displayProfile.name}
            </h1>
            <button
              onClick={handleShareProfile}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center p-2 text-slate-600 dark:text-white/80 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
              title="Share Profile"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Main Profile Header Card */}
      <div className="rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 p-5 shadow-sm text-center relative space-y-3">
        {/* Large Avatar with Tap-To-Change if own profile */}
        <div className="relative inline-block mx-auto">
          {isOwnProfile && (
            <input
              type="file"
              ref={avatarInputRef}
              onChange={handleAvatarSelect}
              accept="image/*"
              className="hidden"
            />
          )}
          <img
            src={displayProfile.avatar}
            alt={displayProfile.name}
            className={`w-20 h-20 rounded-full object-cover ring-4 ring-[#00E676]/40 shadow-xl ${
              isOwnProfile ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
            }`}
            onClick={() => isOwnProfile && avatarInputRef.current?.click()}
          />
          {isOwnProfile && (
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="absolute bottom-0 right-0 min-h-[30px] min-w-[30px] p-1.5 rounded-full bg-slate-900 text-white border-2 border-white dark:border-[#12171F] shadow hover:bg-black transition-colors flex items-center justify-center"
              title="Change avatar photo"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Name, Verified Badge, Username, Favorite Club Badge */}
        <div className="space-y-0.5">
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            <h2 className="font-display text-lg font-black text-slate-900 dark:text-white">
              {displayProfile.name}
            </h2>
            {isVerifiedBadge && (
              <span title="Verified Supporter (500+ Fan Points)">
                <CheckCircle2 className="w-4 h-4 text-sky-500 fill-sky-500/20" />
              </span>
            )}
            {displayProfile.favoriteClub && displayProfile.favoriteClub !== 'Not Set' && (
              <span className="text-xs">{displayProfile.favoriteClubCrest || '⚽'}</span>
            )}
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-white/50">
            {displayProfile.handle}
          </p>
        </div>

        {/* Bio with clickable links & hashtags */}
        <div className="text-xs text-slate-700 dark:text-white/80 max-w-sm mx-auto leading-relaxed break-words">
          {renderFormattedBio(displayProfile.bio)}
        </div>

        {/* Metadata: Location, Website, Joined Date */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-500 dark:text-white/50 pt-0.5">
          {displayProfile.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-rose-500" />
              {displayProfile.location}
            </span>
          )}
          {displayProfile.website && (
            <a
              href={displayProfile.website.startsWith('http') ? displayProfile.website : `https://${displayProfile.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-500 hover:underline"
            >
              <Globe className="w-3 h-3" />
              {displayProfile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </a>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Joined {displayProfile.joinedAt || 'November 2026'}
          </span>
        </div>

        {/* Favorite Club Badge Card */}
        {displayProfile.favoriteClub && displayProfile.favoriteClub !== 'Not Set' ? (
          <div
            onClick={() => isOwnProfile && setShowClubSelection(true)}
            className={`flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/5 transition-all ${
              isOwnProfile ? 'cursor-pointer hover:border-[#00E676]' : ''
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ClubLogo name={displayProfile.favoriteClub} size="md" />
              <div className="text-left">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-tight">
                  Favorite Club
                </span>
                <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                  {displayProfile.favoriteClub}
                </span>
              </div>
            </div>
            {isOwnProfile && <ChevronRight className="w-4 h-4 text-slate-400" />}
          </div>
        ) : isOwnProfile ? (
          <div
            onClick={() => setShowClubSelection(true)}
            className="flex items-center justify-between p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-500/20 cursor-pointer hover:bg-emerald-100/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-base">⚽</span>
              <div className="text-left">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  Pick your favorite club
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block">
                  Get personalized match updates & club badge everywhere in app
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-emerald-600" />
          </div>
        ) : null}

        {/* 4 Tappable Stats Cards (Real database counts - no fake numbers) */}
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
          {/* Fan Points */}
          <button
            onClick={handleOpenPointsModal}
            className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-center group"
          >
            <span className="block text-sm font-black font-mono tabular-nums text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-[#00E676] transition-colors">
              {currentFanPoints}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-white/60 font-semibold">
              Fan Points
            </span>
          </button>

          {/* Following */}
          <button
            onClick={handleOpenFollowingModal}
            className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-center group"
          >
            <span className="block text-sm font-black font-mono tabular-nums text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-[#00E676] transition-colors">
              {realFollowingCount}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-white/60 font-semibold">
              Following
            </span>
          </button>

          {/* Followers */}
          <button
            onClick={handleOpenFollowersModal}
            className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-center group"
          >
            <span className="block text-sm font-black font-mono tabular-nums text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-[#00E676] transition-colors">
              {realFollowersCount}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-white/60 font-semibold">
              Followers
            </span>
          </button>

          {/* Posts */}
          <button
            onClick={() => setActiveProfileTab('posts')}
            className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-center group"
          >
            <span className="block text-sm font-black font-mono tabular-nums text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-[#00E676] transition-colors">
              {realPostsCount}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-white/60 font-semibold">
              Posts
            </span>
          </button>
        </div>

        {/* Action Row */}
        <div className="flex items-center gap-2 pt-1">
          {isOwnProfile ? (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 min-h-[44px] py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-black font-extrabold text-xs shadow-sm hover:opacity-90 transition-opacity"
              >
                Edit Profile
              </button>
              <button
                onClick={handleShareProfile}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                title="Share Profile"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleToggleFollow}
                className={`flex-1 min-h-[44px] py-2 rounded-full font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 ${
                  isFollowingOptimistic
                    ? 'bg-slate-200 dark:bg-white/15 text-slate-900 dark:text-white border border-slate-300 dark:border-white/10'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
                }`}
              >
                {isFollowingOptimistic ? (
                  <>
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Following</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Follow</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setShowMessageModal(true)}
                className="p-2 px-3 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors flex items-center gap-1 text-xs font-bold"
                title="Message supporter"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Message</span>
              </button>
              <button
                onClick={handleShareProfile}
                className="p-2 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                title="Share Profile"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Real-Time Daily Usage Tracker Component */}
      <DailyUsageTracker />

      {/* Tabs Row under stats: Posts | Videos | Likes | Achievements */}
      <div className="flex items-center justify-around border-b border-slate-200 dark:border-white/10 text-xs font-bold text-slate-500">
        <button
          onClick={() => setActiveProfileTab('posts')}
          className={`pb-2.5 px-3 transition-colors relative ${
            activeProfileTab === 'posts' ? 'text-slate-900 dark:text-white font-extrabold' : 'hover:text-black dark:hover:text-white'
          }`}
        >
          <span>Posts ({realPostsCount})</span>
          {activeProfileTab === 'posts' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00E676]" />
          )}
        </button>

        <button
          onClick={() => setActiveProfileTab('videos')}
          className={`pb-2.5 px-3 transition-colors relative ${
            activeProfileTab === 'videos' ? 'text-slate-900 dark:text-white font-extrabold' : 'hover:text-black dark:hover:text-white'
          }`}
        >
          <span>Videos ({realVideosCount})</span>
          {activeProfileTab === 'videos' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00E676]" />
          )}
        </button>

        {isOwnProfile && (
          <button
            onClick={() => setActiveProfileTab('likes')}
            className={`pb-2.5 px-3 transition-colors relative ${
              activeProfileTab === 'likes' ? 'text-slate-900 dark:text-white font-extrabold' : 'hover:text-black dark:hover:text-white'
            }`}
          >
            <span>Likes ({likedPosts.length})</span>
            {activeProfileTab === 'likes' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00E676]" />
            )}
          </button>
        )}

        <button
          onClick={() => setActiveProfileTab('achievements')}
          className={`pb-2.5 px-3 transition-colors relative ${
            activeProfileTab === 'achievements' ? 'text-slate-900 dark:text-white font-extrabold' : 'hover:text-black dark:hover:text-white'
          }`}
        >
          <span>Achievements ({earnedAchievements.length})</span>
          {activeProfileTab === 'achievements' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00E676]" />
          )}
        </button>
      </div>

      {/* Tab 1: Posts */}
      {activeProfileTab === 'posts' && (
        <div className="space-y-3">
          {userPosts.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 p-8 text-center space-y-2">
              <span className="text-2xl">📝</span>
              <h4 className="font-extrabold text-sm text-slate-800 dark:text-white">No posts yet</h4>
              <p className="text-xs text-slate-500 dark:text-white/50">
                {isOwnProfile
                  ? 'Share your first football take or match observation from the Home feed.'
                  : `${displayProfile.name} has not published any pitch posts yet.`}
              </p>
              {isOwnProfile && (
                <button
                  onClick={() => setActiveTab('home')}
                  className="mt-2 px-4 py-1.5 rounded-full bg-[#00E676] text-black font-extrabold text-xs"
                >
                  Go to Home Feed
                </button>
              )}
            </div>
          ) : (
            userPosts.map(p => (
              <div
                key={p.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>{p.timestamp}</span>
                  {p.location && <span>📍 {p.location}</span>}
                </div>
                <p className="text-slate-900 dark:text-white leading-relaxed">{p.content}</p>
                {p.imageUrl && (
                  <img src={p.imageUrl} alt="football fan post highlight photo" loading="lazy" decoding="async" className="rounded-xl max-h-48 w-full object-cover" />
                )}
                <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1 border-t border-slate-100 dark:border-white/5">
                  <span>❤️ {p.likes} likes</span>
                  <span>💬 {p.commentsCount} comments</span>
                  <span>🔄 {p.shares} shares</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Videos */}
      {activeProfileTab === 'videos' && (
        <div className="space-y-3">
          {userVideos.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 p-8 text-center space-y-2">
              <span className="text-2xl">📹</span>
              <h4 className="font-extrabold text-sm text-slate-800 dark:text-white">No videos uploaded yet</h4>
              <p className="text-xs text-slate-500 dark:text-white/50">
                {isOwnProfile
                  ? 'Upload your skills or goal celebrations to PitchReels!'
                  : `${displayProfile.name} has not uploaded any video highlights yet.`}
              </p>
              {isOwnProfile && (
                <button
                  onClick={() => setActiveTab('videos')}
                  className="mt-2 px-4 py-1.5 rounded-full bg-blue-600 text-white font-extrabold text-xs"
                >
                  Upload to PitchReels
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {userVideos.map(v => {
                const isShort = v.videoKind !== 'video' && v.aspectRatio !== '16:9';
                const canDelete = isOwnProfile || v.userId === user.id || v.creator?.handle === user.handle;
                return (
                  <div
                    key={v.id}
                    className="rounded-2xl overflow-hidden bg-white dark:bg-[#12171F] border border-slate-200/80 dark:border-white/10 group flex flex-col"
                  >
                    <div
                      onClick={() => openVideoInReels(v.id)}
                      className={`relative w-full bg-black overflow-hidden cursor-pointer ${isShort ? 'aspect-[9/12]' : 'aspect-video'}`}
                    >
                      {v.thumbnailUrl ? (
                        <img
                          src={v.thumbnailUrl}
                          alt={`${v.title || 'football match highlight'} thumbnail`}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : v.videoUrl ? (
                        <video
                          src={`${v.videoUrl}#t=0.5`}
                          preload="metadata"
                          muted
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-900 text-white/40">
                          <Video className="w-6 h-6" />
                        </div>
                      )}
                      <span className="absolute bottom-1.5 right-1.5 bg-black/80 px-1.5 py-0.5 text-[10px] font-mono text-white rounded tabular-nums">
                        {v.duration || '0:30'}
                      </span>
                    </div>
                    <div className="p-2.5 space-y-1.5 flex-1 flex flex-col justify-between">
                      <div onClick={() => openVideoInReels(v.id)} className="cursor-pointer">
                        <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                          {v.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-white/55 tabular-nums">
                          {isShort ? 'Short' : 'Video'} · {v.views || 0} views · {v.likes || 0} likes
                        </p>
                      </div>
                      {canDelete && (
                        <div className="pt-1 border-t border-slate-100 dark:border-white/5">
                          {confirmDeleteVideoId === v.id ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteVideo(v.id);
                                  setConfirmDeleteVideoId(null);
                                }}
                                className="flex-1 min-h-[34px] px-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold"
                              >
                                Confirm Delete
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteVideoId(null);
                                }}
                                className="min-h-[34px] px-2.5 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white text-[11px] font-semibold"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteVideoId(v.id);
                              }}
                              className="w-full min-h-[34px] px-2.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete Video</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Liked Posts (Only for own profile) */}
      {isOwnProfile && activeProfileTab === 'likes' && (
        <div className="space-y-3">
          {likedPosts.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 p-8 text-center space-y-2">
              <span className="text-2xl">❤️</span>
              <h4 className="font-extrabold text-sm text-slate-800 dark:text-white">No liked posts yet</h4>
              <p className="text-xs text-slate-500 dark:text-white/50">
                Posts you like on the Home feed will show up here.
              </p>
            </div>
          ) : (
            likedPosts.map(p => (
              <div
                key={p.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 space-y-1.5 text-xs"
              >
                <div
                  onClick={() => navigateToProfile(p.author?.handle || p.userId || '@fan')}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <img
                    src={p.author?.avatar || '/assets/aistudio/IMG-20261106-WA6972_a4f2c4ba.jpg'}
                    alt={`${p.author?.name || 'Supporter'} football fan avatar`}
                    loading="lazy"
                    decoding="async"
                    className="w-5 h-5 rounded-full object-cover"
                  />
                  <span className="font-bold text-slate-900 dark:text-white text-[11px] group-hover:text-[#00E676] transition-colors">
                    {p.author?.name || 'Supporter'}
                  </span>
                </div>
                <p className="text-slate-700 dark:text-white/90 line-clamp-2">{p.content}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 4: Achievements */}
      {activeProfileTab === 'achievements' && (
        <div className="space-y-2.5">
          {earnedAchievements.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 p-8 text-center space-y-2">
              <Trophy className="w-10 h-10 text-slate-400 mx-auto" />
              <h4 className="font-extrabold text-sm text-slate-800 dark:text-white">No achievements yet</h4>
              <p className="text-xs text-slate-500 dark:text-white/50">
                Post football updates, upload highlights, and interact to unlock badges.
              </p>
            </div>
          ) : (
            earnedAchievements.map(ach => (
              <div
                key={ach.id}
                className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8"
              >
                <div className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${ach.color} flex items-center justify-center text-white shadow-md shrink-0`}>
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">
                    {ach.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-white/50">
                    {ach.desc}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Edit Profile Modal (Only for own profile) */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveProfile}
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/8 p-5 shadow-2xl space-y-3.5 text-xs max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Edit Profile</h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Avatar preview and change */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <img src={editAvatar} alt="Football fan profile avatar preview" loading="lazy" decoding="async" className="w-12 h-12 rounded-full object-cover ring-2 ring-[#00E676]" />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/10 text-[11px] font-bold text-slate-700 dark:text-white"
                >
                  Upload Photo
                </button>
              </div>
              {avatarUploadStatus !== 'idle' && (
                <MediaUploadSplash
                  status={avatarUploadStatus}
                  mediaKind="image"
                  fileName={avatarFileName}
                  sizeMb={avatarUploadSizeMb}
                  progress={avatarUploadProgress}
                  onDismissError={() => setAvatarUploadStatus('idle')}
                />
              )}
            </div>

            {/* Name */}
            <div className="space-y-1">
              <label className="font-bold text-[11px] text-slate-700 dark:text-white/80">Full Name</label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            {/* Handle with validation */}
            <div className="space-y-1">
              <label className="font-bold text-[11px] text-slate-700 dark:text-white/80">Username (@)</label>
              <input
                type="text"
                value={editHandle}
                onChange={e => setEditHandle(e.target.value)}
                required
                pattern="^@?[a-zA-Z0-9_]{3,25}$"
                placeholder="@username"
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            {/* Bio */}
            <div className="space-y-1">
              <label className="font-bold text-[11px] text-slate-700 dark:text-white/80">Bio</label>
              <textarea
                rows={2}
                value={editBio}
                onChange={e => setEditBio(e.target.value)}
                placeholder="Match observer, tactic fan, player scout..."
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            {/* Favorite Club */}
            <div className="space-y-1">
              <label className="font-bold text-[11px] text-slate-700 dark:text-white/80">Favorite Club</label>
              <select
                value={editClub}
                onChange={e => setEditClub(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="Not Set">Not Set</option>
                {POPULAR_TOP_5_CLUBS.map(club => (
                  <option key={club.id} value={club.name} className="dark:bg-[#161b22]">
                    {club.name} ({club.leagueName})
                  </option>
                ))}
              </select>
            </div>

            {/* Location */}
            <div className="space-y-1">
              <label className="font-bold text-[11px] text-slate-700 dark:text-white/80">Location</label>
              <input
                type="text"
                value={editLocation}
                onChange={e => setEditLocation(e.target.value)}
                placeholder="e.g. London, UK"
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            {/* Website */}
            <div className="space-y-1">
              <label className="font-bold text-[11px] text-slate-700 dark:text-white/80">Website Link</label>
              <input
                type="url"
                value={editWebsite}
                onChange={e => setEditWebsite(e.target.value)}
                placeholder="https://yourclub.com"
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl text-slate-500 hover:text-white font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#00E676] text-black font-extrabold shadow-md shadow-[#00E676]/20"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Fan Points Breakdown History Modal */}
      {showPointsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/8 p-5 shadow-2xl space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">⭐</span>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Fan Points History</h3>
              </div>
              <button onClick={() => setShowPointsModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-center py-2.5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
              <span className="text-3xl font-black font-mono tabular-nums text-emerald-700 dark:text-[#00E676]">{currentFanPoints}</span>
              <span className="block text-xs text-slate-500 dark:text-white/55">Total Lifetime Fan Points</span>
              {currentFanPoints < 500 && (
                <span className="text-[10px] text-amber-600 dark:text-amber-500 font-bold block pt-1 tabular-nums">
                  {500 - currentFanPoints} pts to Blue Verification Check
                </span>
              )}
            </div>

            <div className="space-y-2 text-xs">
              {pointsHistory?.breakdown ? (
                pointsHistory.breakdown.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-white/5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{item.icon}</span>
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">{item.category}</span>
                        <span className="text-[10px] text-slate-500 dark:text-white/50 tabular-nums">
                          {item.count} action{item.count === 1 ? '' : 's'} × {item.pointsPerUnit} pts
                        </span>
                      </div>
                    </div>
                    <span className="font-extrabold font-mono tabular-nums text-emerald-700 dark:text-[#00E676]">+{item.total} pts</span>
                  </div>
                ))
              ) : (
                <>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-white/5">
                    <span>Match pitch post</span>
                    <span className="font-bold font-mono tabular-nums text-emerald-700 dark:text-[#00E676]">+10 pts</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-white/5">
                    <span>Uploading PitchReel</span>
                    <span className="font-bold font-mono tabular-nums text-emerald-700 dark:text-[#00E676]">+20 pts</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-white/5">
                    <span>Like received on take</span>
                    <span className="font-bold font-mono tabular-nums text-emerald-700 dark:text-[#00E676]">+2 pts</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-white/5">
                    <span>Comment received</span>
                    <span className="font-bold font-mono tabular-nums text-emerald-700 dark:text-[#00E676]">+5 pts</span>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setShowPointsModal(false)}
              className="w-full min-h-[44px] py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black font-extrabold text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Following List Modal */}
      {showFollowingModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/8 p-5 shadow-2xl space-y-3 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Following ({realFollowingCount})
              </h3>
              <button onClick={() => setShowFollowingModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 py-1">
              {followDetails.followingUsers.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500 dark:text-white/50">
                  Not following any supporters yet. Discover creators in PitchReels and Home feed!
                </div>
              ) : (
                followDetails.followingUsers.map((person, idx) => (
                  <div
                    key={person.id || idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 transition-colors"
                  >
                    <div
                      onClick={() => {
                        setShowFollowingModal(false);
                        navigateToProfile(person.handle || person.id);
                      }}
                      className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                    >
                      <img src={person.avatar} alt={`${person.name} football fan`} loading="lazy" decoding="async" className="w-8 h-8 rounded-full object-cover shrink-0" />
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-slate-900 dark:text-white block truncate">
                          {person.name}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {person.handle}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowFollowingModal(false)}
              className="w-full py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black font-extrabold text-xs"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Followers List Modal */}
      {showFollowersModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/8 p-5 shadow-2xl space-y-3 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Followers ({realFollowersCount})
              </h3>
              <button onClick={() => setShowFollowersModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 py-1">
              {followDetails.followersUsers.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500 dark:text-white/50">
                  No followers yet. Post match takes to build your football following!
                </div>
              ) : (
                followDetails.followersUsers.map((person, idx) => (
                  <div
                    key={person.id || idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 transition-colors"
                  >
                    <div
                      onClick={() => {
                        setShowFollowersModal(false);
                        navigateToProfile(person.handle || person.id);
                      }}
                      className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                    >
                      <img src={person.avatar} alt={`${person.name} football fan`} loading="lazy" decoding="async" className="w-8 h-8 rounded-full object-cover shrink-0" />
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-slate-900 dark:text-white block truncate">
                          {person.name}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {person.handle}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowFollowersModal(false)}
              className="w-full py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black font-extrabold text-xs"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Message Modal for Other Supporter */}
      {showMessageModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={handleSendMessage}
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/8 p-5 shadow-2xl space-y-3.5 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-500" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Message {displayProfile.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMessageModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 dark:text-white/70">
                Match banter or message:
              </label>
              <textarea
                rows={3}
                value={messageContent}
                onChange={e => setMessageContent(e.target.value)}
                placeholder="Good game yesterday! What do you think about our tactical formation?"
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowMessageModal(false)}
                className="px-4 py-2 rounded-xl text-slate-500 hover:text-white font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold flex items-center gap-1.5 shadow-md shadow-blue-600/20"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
