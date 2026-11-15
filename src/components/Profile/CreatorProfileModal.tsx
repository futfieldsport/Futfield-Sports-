import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  Heart,
  MessageSquare,
  Share2,
  Film,
  FileText,
  Shield,
  Award,
  TrendingUp,
  MapPin,
  Calendar,
  Sparkles,
  ArrowRight,
  Play,
} from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { Post, VideoItem } from '../../types/football';
import { haptics } from '../../utils/haptics';

interface CreatorProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  creator: {
    handle: string;
    name: string;
    avatar: string;
    clubBadge?: string;
  } | null;
}

export const CreatorProfileModal: React.FC<CreatorProfileModalProps> = ({
  isOpen,
  onClose,
  creator,
}) => {
  const {
    posts,
    videos,
    isCreatorConnected,
    toggleConnectCreator,
    toggleLikePost,
    toggleLikeVideo,
    user,
    openShareSheet,
  } = useFootball();

  const [activeTab, setActiveTab] = useState<'posts' | 'videos'>('posts');
  const [selectedVideoToPlay, setSelectedVideoToPlay] = useState<VideoItem | null>(null);

  if (!isOpen || !creator) return null;

  const isConnected = isCreatorConnected(creator.handle);

  // Filter posts and videos authored by this specific creator
  const creatorPosts = posts.filter(
    p => (p.author?.handle || '').toLowerCase() === (creator.handle || '').toLowerCase()
  );
  const creatorVideos = videos.filter(
    v => (v.creator?.handle || '').toLowerCase() === (creator.handle || '').toLowerCase()
  );

  const handleConnect = () => {
    haptics.like();
    toggleConnectCreator(creator.handle, {
      name: creator.name,
      avatar: creator.avatar,
      clubBadge: creator.clubBadge,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-[440px] max-h-[92vh] bg-white dark:bg-[#161b22] rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-slate-200 dark:border-white/10">
        {/* Header Cover Banner */}
        <div className="relative h-28 bg-gradient-to-r from-emerald-600 via-teal-700 to-slate-900 p-3 flex items-start justify-between">
          <div className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-extrabold text-white flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-[#00E676]" />
            <span>FUTFIELD Verified Creator</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-black/50 text-white/90 hover:text-white backdrop-blur-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Creator Info & Action Bar */}
        <div className="px-4 pb-3 -mt-10 relative space-y-3">
          <div className="flex items-end justify-between">
            <div className="relative">
              <img
                src={creator.avatar}
                alt={creator.name}
                className="w-20 h-20 rounded-full object-cover ring-4 ring-white dark:ring-[#161b22] shadow-lg"
              />
              <span className="absolute bottom-0 right-0 p-1 rounded-full bg-[#00E676] text-black">
                <CheckCircle2 className="w-3.5 h-3.5 fill-black text-[#00E676]" />
              </span>
            </div>

            {/* Action Buttons: Connect */}
            <div className="flex items-center gap-2">

              <button
                onClick={handleConnect}
                className={`px-4 py-1.5 rounded-full text-xs font-black transition-all flex items-center gap-1.5 shadow-sm active:scale-95 ${
                  isConnected
                    ? 'bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/40'
                    : 'bg-[#00E676] text-black hover:bg-emerald-400'
                }`}
              >
                {isConnected ? '✓ Connected' : '+ Connect'}
              </button>
            </div>
          </div>

          {/* Name & Bio */}
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                {creator.name}
              </h2>
              {creator.clubBadge && <span className="text-sm">{creator.clubBadge}</span>}
            </div>
            <p className="text-xs font-semibold text-slate-500 dark:text-white/50">
              {creator.handle}
            </p>
            <p className="text-xs text-slate-700 dark:text-white/80 mt-1 leading-relaxed">
              Matchday analysis, European tactical breakdowns, and live fan debate. Followed by true football supporters.
            </p>
          </div>

          {/* Priority Feed Callout when Connected */}
          {isConnected && (
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-[11px] font-bold text-emerald-600 dark:text-[#00E676]">
              <TrendingUp className="w-4 h-4 shrink-0" />
              <span>You are connected! {creator.name}&apos;s match posts and videos now appear first at the top of your feed.</span>
            </div>
          )}

          {/* Content Sub-Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pt-1">
            <button
              onClick={() => setActiveTab('posts')}
              className={`pb-2 text-xs font-black flex items-center gap-1.5 transition-all relative ${
                activeTab === 'posts'
                  ? 'text-[#00E676]'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Posts ({creatorPosts.length})</span>
              {activeTab === 'posts' && (
                <div className="absolute bottom-0 inset-x-0 h-0.5 bg-[#00E676] rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('videos')}
              className={`pb-2 text-xs font-black flex items-center gap-1.5 transition-all relative ${
                activeTab === 'videos'
                  ? 'text-[#00E676]'
                  : 'text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Clips & Highlights ({creatorVideos.length})</span>
              {activeTab === 'videos' && (
                <div className="absolute bottom-0 inset-x-0 h-0.5 bg-[#00E676] rounded-full" />
              )}
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
          {/* POSTS TAB */}
          {activeTab === 'posts' && (
            <div className="space-y-3">
              {creatorPosts.length > 0 ? (
                creatorPosts.map(post => (
                  <div
                    key={post.id}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-white/50">
                      <span className="font-semibold">{post.timestamp}</span>
                      {post.clubTag && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-[#00E676] font-bold text-[10px]">
                          ⚽ {post.clubTag}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-900 dark:text-white/90 leading-relaxed">
                      {post.content}
                    </p>
                    {post.mediaUrl && (
                      <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 max-h-56">
                        {post.mediaType === 'video' ? (
                          <video
                            src={post.mediaUrl}
                            controls
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <img
                            src={post.mediaUrl}
                            alt="Post Media"
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-xs pt-1 border-t border-slate-200/50 dark:border-white/5 text-slate-500 dark:text-white/60">
                      <button
                        onClick={() => toggleLikePost(post.id)}
                        className={`flex items-center gap-1 hover:text-rose-500 ${
                          post.isLiked ? 'text-rose-500 font-bold' : ''
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${post.isLiked ? 'fill-rose-500' : ''}`} />
                        <span>{post.likes}</span>
                      </button>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{post.commentsCount}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const handle = (creator.handle || '@creator').replace(/^@?/, '@');
                          const url =
                            typeof window !== 'undefined' && window.location?.origin
                              ? `${window.location.origin}/profile/${encodeURIComponent(handle)}`
                              : `https://futfieldsport.com.ng/profile/${encodeURIComponent(handle)}`;
                          openShareSheet({
                            kind: 'post',
                            targetId: post.id,
                            title: `${creator.name} on FUTFIELD`,
                            text: post.content.slice(0, 140),
                            url,
                            previewImage: post.mediaUrl || creator.avatar,
                          });
                        }}
                        className="flex items-center gap-1 hover:text-[#00E676] transition-colors"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>{post.shares}</span>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No public tactical posts yet from {creator.name}.
                </div>
              )}
            </div>
          )}

          {/* VIDEOS TAB */}
          {activeTab === 'videos' && (
            <div className="space-y-3">
              {creatorVideos.length > 0 ? (
                <div className="grid grid-cols-2 gap-2.5">
                  {creatorVideos.map(vid => (
                    <div
                      key={vid.id}
                      onClick={() => setSelectedVideoToPlay(vid)}
                      className="group cursor-pointer rounded-2xl overflow-hidden bg-slate-100 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 space-y-1.5 pb-2 hover:border-[#00E676] transition-all"
                    >
                      <div className="aspect-[9/12] relative overflow-hidden bg-black">
                        <img
                          src={vid.thumbnailUrl}
                          alt={vid.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors flex items-center justify-center">
                          <div className="p-2.5 rounded-full bg-black/60 text-white backdrop-blur-sm group-hover:scale-110 transition-transform">
                            <Play className="w-4 h-4 fill-white" />
                          </div>
                        </div>
                        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[9px] font-mono text-white">
                          {vid.duration}
                        </span>
                      </div>
                      <div className="px-2">
                        <h4 className="text-[11px] font-bold text-slate-900 dark:text-white line-clamp-1">
                          {vid.title}
                        </h4>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-white/50">
                          <span>{vid.views.toLocaleString()} views</span>
                          <span className="text-rose-500 font-bold">♥ {vid.likes}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No uploaded clips yet from {creator.name}.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Video Player Modal if tapped */}
        {selectedVideoToPlay && (
          <div className="absolute inset-0 z-50 bg-black flex flex-col">
            <div className="p-3 flex items-center justify-between bg-black/60 text-white">
              <span className="text-xs font-bold truncate">{selectedVideoToPlay.title}</span>
              <button
                onClick={() => setSelectedVideoToPlay(null)}
                className="p-1 rounded-full text-white/80 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center bg-black">
              {selectedVideoToPlay.videoUrl ? (
                <video
                  src={selectedVideoToPlay.videoUrl}
                  controls
                  autoPlay
                  className="w-full max-h-full object-contain"
                />
              ) : (
                <img
                  src={selectedVideoToPlay.thumbnailUrl}
                  alt={selectedVideoToPlay.title}
                  className="w-full max-h-full object-contain"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
