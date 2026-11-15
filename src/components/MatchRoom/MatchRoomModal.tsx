import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { checkDailyLimit, incrementDailyLimit } from '../../utils/dailyLimits';
import {
  ChevronLeft,
  Paperclip,
  Smile,
  Send,
  Shield,
  Heart,
  Flame,
  Users,
  Eye,
  Pin,
  X,
  Mic,
  Square,
  Pause,
  Play,
  Trash2,
  Reply,
  MoreVertical,
  Flag,
  Share2,
  Download,
  Image as ImageIcon,
  Camera,
  Film,
  Check,
  CheckCheck,
  Volume2,
  VolumeX,
  ArrowDown,
  Clock,
  Radio,
  Thermometer,
  Zap,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useFootball } from '../../context/FootballContext';
import { Match, MatchChatMessage, MatchMediaType, MatchMessageType } from '../../types/football';
import { ClubLogo } from '../Common/ClubLogo';
import {
  fetchServerMatchMessages,
  sendServerMatchMessage,
  reactToMatchMessageOnServer,
  deleteMatchMessageOnServer,
  pinMatchMessageOnServer,
  sendMatchRoomPresence,
  leaveMatchRoomPresence,
  fetchMatchRoomPresence,
  sendMatchTypingStatus,
  fetchMatchTypingStatus,
  triggerMatchEventWebhook,
  subscribeToMatchRoomRealtime,
} from '../../services/supabaseClient';
import { haptics } from '../../utils/haptics';
import { useHaptics } from '../../hooks/useHaptics';
import { uploadFileToBackend, formatBytesToMb } from '../../utils/mediaUpload';
import { MediaUploadSplash, UploadSplashStatus } from '../Common/MediaUploadSplash';

interface MatchRoomModalProps {
  match: Match;
  onClose: () => void;
}

// 6 Core reaction emojis
const REACTION_EMOJIS = ['🔥', '⚽', '❤️', '😂', '😱', '👏'];

// Quick reaction banter pills
const QUICK_CHAT_PILLS = [
  'What a goal! 🚀',
  'Ref is blind! 🟨',
  'What a save! 🧤',
  'VAR check please! 📺',
  'Great tackle! 🛡️',
  'Let\'s go! 🔥',
  'Unbelievable skill! 🪄',
];

// -------------------------------------------------------------
// Voice Note Player Component with 30-bar waveform & speed control
// -------------------------------------------------------------
const VoiceNoteBubble: React.FC<{
  audioUrl: string;
  durationSeconds?: number;
  waveform?: number[];
  isMe: boolean;
}> = ({ audioUrl, durationSeconds = 12, waveform, isMe }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5 | 2>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Generate 30 stable waveform heights
  const bars = useMemo(() => {
    if (waveform && waveform.length >= 30) {
      return waveform.slice(0, 30);
    }
    // Fallback pleasing waveform pattern
    const seed = [35, 60, 85, 45, 95, 70, 40, 65, 80, 55, 90, 60, 45, 75, 100, 85, 50, 65, 80, 45, 70, 95, 60, 40, 80, 65, 50, 75, 45, 30];
    return seed;
  }, [waveform]);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
    };

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextSpeed = playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1;
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const seekTo = (index: number) => {
    if (!audioRef.current) return;
    const total = audioRef.current.duration || durationSeconds;
    const target = (index / 30) * total;
    audioRef.current.currentTime = target;
    setCurrentTime(target);
  };

  const progressPercent = audioRef.current?.duration
    ? (currentTime / audioRef.current.duration) * 100
    : (currentTime / durationSeconds) * 100;

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex items-center gap-2.5 py-1 min-w-[210px] max-w-[270px]">
      {/* Circular Play / Pause button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 shadow-sm ${
          isMe
            ? 'bg-slate-900 text-[#00E676] hover:bg-black'
            : 'bg-[#00E676] text-black hover:bg-[#00c864]'
        }`}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>

      {/* Waveform Visualization (30 bars) */}
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-[2px] h-7 cursor-pointer select-none" title="Seek audio">
          {bars.map((height, i) => {
            const barProgress = (i / 30) * 100;
            const isPlayed = barProgress <= progressPercent;
            return (
              <span
                key={i}
                onClick={() => seekTo(i)}
                style={{ height: `${Math.max(15, height * 0.28)}px` }}
                className={`w-[3px] rounded-full transition-colors ${
                  isPlayed
                    ? isMe
                      ? 'bg-emerald-950 dark:bg-emerald-300'
                      : 'bg-[#00E676]'
                    : isMe
                    ? 'bg-emerald-700/40 dark:bg-emerald-900/50'
                    : 'bg-slate-300 dark:bg-white/20'
                }`}
              />
            );
          })}
        </div>

        {/* Duration and Playback Speed */}
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-white/60">
          <span>{isPlaying ? formatTimer(currentTime) : formatTimer(durationSeconds)}</span>
          <button
            type="button"
            onClick={cycleSpeed}
            className="px-1.5 py-0.5 rounded-md bg-black/10 dark:bg-white/10 text-[9px] font-bold hover:bg-black/20 transition-colors"
          >
            {playbackSpeed}x
          </button>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// MAIN COMPONENT: MatchRoomModal
// -------------------------------------------------------------
export const MatchRoomModal: React.FC<MatchRoomModalProps> = ({ match, onClose }) => {
  const {
    user,
    addFanPoints,
    addNotification,
    navigateToProfile,
    setPricingModalOpen,
    openShareSheet,
  } = useFootball();

  const { triggerMessage } = useHaptics();

  // Messages & Room state
  const [messages, setMessages] = useState<MatchChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [viewersCount, setViewersCount] = useState<number>(match.activeFansCount || 0);
  const [viewerAvatars, setViewerAvatars] = useState<any[]>([]);
  const [showViewersTray, setShowViewersTray] = useState(false);
  const [replyTarget, setReplyTarget] = useState<MatchChatMessage | null>(null);

  // Input & Tools state
  const [showMediaSheet, setShowMediaSheet] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [typingFans, setTypingFans] = useState<any[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // Fullscreen image viewer state
  const [activeViewerImage, setActiveViewerImage] = useState<{ url: string; caption?: string } | null>(null);

  // Media gallery drawer (all images/voices in chat)
  const [showGalleryDrawer, setShowGalleryDrawer] = useState(false);
  const [galleryTab, setGalleryTab] = useState<'media' | 'voices'>('media');

  // Long press / Action sheet state
  const [selectedMessageAction, setSelectedMessageAction] = useState<MatchChatMessage | null>(null);

  // Rivalry Intensity Thermometer breakdown state
  const [showRivalryBreakdown, setShowRivalryBreakdown] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingPaused, setRecordingPaused] = useState(false);
  const [liveVolumeLevel, setLiveVolumeLevel] = useState(10);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<any>(null);

  // Media file inputs
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  // Backend media upload preview + splash state
  const [pendingUploadMedia, setPendingUploadMedia] = useState<{ url: string; type: MatchMediaType; file: File } | null>(null);
  const [pendingCaption, setPendingCaption] = useState('');
  const [chatUploadStatus, setChatUploadStatus] = useState<UploadSplashStatus>('idle');
  const [chatUploadProgress, setChatUploadProgress] = useState(0);
  const [chatUploadSizeMb, setChatUploadSizeMb] = useState(0);

  // Auto-scroll logic
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [showScrollBottomPill, setShowScrollBottomPill] = useState(false);

  const userRef = useRef(user);
  userRef.current = user;

  // 1. Initial Load & Realtime Subscription for Messages, Typing & Presence
  const loadRoomMessages = useCallback(async () => {
    const serverMsgs = await fetchServerMatchMessages(match.id, user.id);
    if (serverMsgs) {
      setMessages(serverMsgs);
    }
  }, [match.id, user.id]);

  useEffect(() => {
    loadRoomMessages();
    const activeUser = userRef.current;

    // Subscribe to Supabase Realtime channel + Server-Sent Events stream
    const unsubscribe = subscribeToMatchRoomRealtime(match.id, activeUser, {
      onNewMessage: (incomingMsg) => {
        setMessages(prev => {
          if (prev.some(m => m.id === incomingMsg.id)) return prev;
          return [...prev, incomingMsg];
        });
        if (incomingMsg.messageType === 'goal' || incomingMsg.messageType === 'red') {
          haptics.goalAlert();
        } else if (incomingMsg.user?.id !== userRef.current.id) {
          haptics.light();
        }
      },
      onReactionUpdated: ({ messageId, reactions, userReactions }) => {
        setMessages(prev =>
          prev.map(m =>
            m.id === messageId
              ? {
                  ...m,
                  reactions: reactions || m.reactions,
                  userReactions: userReactions !== undefined ? userReactions : m.userReactions,
                }
              : m
          )
        );
      },
      onMessageDeleted: ({ messageId }) => {
        setMessages(prev =>
          prev.map(m =>
            m.id === messageId
              ? {
                  ...m,
                  isDeleted: true,
                  text: 'This message was deleted',
                  content: 'This message was deleted',
                  mediaUrl: undefined,
                  thumbnailUrl: undefined,
                }
              : m
          )
        );
      },
      onMessagePinned: ({ messageId, isPinned }) => {
        setMessages(prev =>
          prev.map(m => (m.id === messageId ? { ...m, isPinned } : m))
        );
      },
      onTypingChanged: (fans) => {
        const cur = userRef.current;
        const others = fans.filter((f: any) => f.userId !== cur.id && f.userId !== cur.handle);
        setTypingFans(others);
      },
      onPresenceUpdated: (presence) => {
        if (typeof presence?.viewersCount === 'number') {
          setViewersCount(presence.viewersCount);
        }
        if (presence?.viewers) {
          setViewerAvatars(presence.viewers);
        }
      },
      onMatchEvent: () => {
        haptics.goalAlert();
      },
    });

    const getPresencePayload = () => ({
      id: userRef.current.id,
      name: userRef.current.name,
      handle: userRef.current.handle,
      avatar: userRef.current.avatar,
      favoriteClub: userRef.current.favoriteClub,
    });

    // Announce room entry immediately on mount so live viewer count updates in real time
    sendMatchRoomPresence(match.id, getPresencePayload()).then(res => {
      if (res && typeof res.viewersCount === 'number') {
        setViewersCount(res.viewersCount);
        setViewerAvatars(res.viewers || []);
      }
    });

    // Heartbeat every 15s to keep live presence fresh
    const presenceHeartbeat = setInterval(() => {
      sendMatchRoomPresence(match.id, getPresencePayload()).then(res => {
        if (res && typeof res.viewersCount === 'number') {
          setViewersCount(res.viewersCount);
          setViewerAvatars(res.viewers || []);
        }
      });
    }, 15000);

    return () => {
      unsubscribe();
      clearInterval(presenceHeartbeat);
      leaveMatchRoomPresence(match.id, userRef.current.id || userRef.current.handle || 'guest').catch(() => {});
    };
  }, [loadRoomMessages, match.id, user.id]);

  // Handle typing debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (!isTyping) {
      setIsTyping(true);
      sendMatchTypingStatus(match.id, user, true, false);
      setTimeout(() => {
        setIsTyping(false);
        sendMatchTypingStatus(match.id, user, false, false);
      }, 3000);
    }
  };

  // Scroll to bottom helper
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (!showScrollBottomPill) {
      scrollToBottom('smooth');
    }
  }, [messages.length]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollBottomPill(distanceToBottom > 150);
  };

  // 4. Send Text Message / Quick Banter
  const handleSendTextMessage = async (textToSend?: string) => {
    const content = (textToSend || inputText).trim();
    if (!content) return;

    const isProUser = Boolean(user.isPro || user.membershipTier === 'pro' || user.membershipTier === 'vip');
    const limitCheck = checkDailyLimit(user.id, 'chat', isProUser);
    if (!limitCheck.allowed) {
      addNotification({
        title: 'Free Chat Limit Reached ⚠️',
        body: limitCheck.message || 'Daily chat limit reached. Upgrade to Pro for unlimited access!',
        type: 'system',
      });
      setPricingModalOpen(true);
      return;
    }
    incrementDailyLimit(user.id, 'chat');

    setInputText('');
    setShowEmojiPicker(false);
    const replySnippet = replyTarget
      ? {
          authorName: replyTarget.user?.name || 'Supporter',
          text: replyTarget.text || (replyTarget.mediaType === 'image' ? '📷 Photo' : '🎤 Voice note'),
          mediaType: replyTarget.mediaType,
          thumbnailUrl: replyTarget.thumbnailUrl,
        }
      : undefined;

    const newMsg: MatchChatMessage = {
      id: `mmsg_${Date.now()}`,
      matchId: match.id,
      user: {
        id: user.id,
        name: user.name,
        handle: user.handle,
        avatar: user.avatar,
        favoriteClub: user.favoriteClub,
        isMod: user.isModerator,
      },
      text: content,
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date().toISOString(),
      messageType: 'chat',
      mediaType: 'text',
      replyToId: replyTarget?.id,
      replyToMessage: replySnippet,
      reactions: { '🔥': 0, '⚽': 0, '❤️': 0, '😂': 0, '😱': 0, '👏': 0 },
      userReactions: [],
      status: 'delivered',
    };

    setReplyTarget(null);
    setMessages(prev => [...prev, newMsg]);
    scrollToBottom('smooth');

    triggerMessage();
    addFanPoints(10, 'Live match chat take');
    await sendServerMatchMessage(match.id, newMsg);
  };

  // 5. Send Backend-Uploaded Image Media
  const handleConfirmSendMedia = async () => {
    if (!pendingUploadMedia || !pendingUploadMedia.url) return;

    const mediaItem = pendingUploadMedia;
    const caption = pendingCaption.trim();
    setPendingUploadMedia(null);
    setPendingCaption('');
    setChatUploadStatus('idle');
    setChatUploadProgress(0);

    const newMsg: MatchChatMessage = {
      id: `mmsg_${Date.now()}`,
      matchId: match.id,
      user: {
        id: user.id,
        name: user.name,
        handle: user.handle,
        avatar: user.avatar,
        favoriteClub: user.favoriteClub,
      },
      text: caption,
      content: caption,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date().toISOString(),
      messageType: 'chat',
      mediaType: mediaItem.type,
      mediaUrl: mediaItem.url,
      thumbnailUrl: mediaItem.url,
      reactions: { '🔥': 0, '⚽': 0, '❤️': 0, '😂': 0, '😱': 0, '👏': 0 },
      userReactions: [],
      status: 'delivered',
    };

    setMessages(prev => [...prev, newMsg]);
    scrollToBottom('smooth');

    triggerMessage();
    addFanPoints(15, 'Shared match photo');
    await sendServerMatchMessage(match.id, newMsg);
  };

  const handleMediaFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: MatchMediaType) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowMediaSheet(false);
    setChatUploadSizeMb(formatBytesToMb(file.size));
    setChatUploadProgress(10);
    setChatUploadStatus('uploading');
    setPendingUploadMedia({ url: '', type, file });

    const res = await uploadFileToBackend(
      file,
      'match-chat-images',
      file.name,
      (pct) => setChatUploadProgress(pct),
      user.id
    );

    if (res.success && res.url) {
      setChatUploadProgress(100);
      setChatUploadStatus('uploaded');
      setPendingUploadMedia({ url: res.url, type, file });
      haptics.success();
    } else {
      setChatUploadStatus('error');
    }
  };

  // 6. Voice Recording Flow (WhatsApp Level)
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Setup audio analysis for live waveform reaction
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateMeter = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((acc, v) => acc + v, 0) / dataArray.length;
          setLiveVolumeLevel(Math.min(100, Math.max(10, avg * 1.5)));
          animFrameRef.current = requestAnimationFrame(updateMeter);
        };
        updateMeter();
      } catch {}

      mediaRecorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingSeconds(0);
      setRecordingPaused(false);
      sendMatchTypingStatus(match.id, user, false, true);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => {
          if (prev >= 60) {
            stopAndSendVoiceRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      addNotification({
        title: 'Microphone Access Required',
        body: 'Please allow microphone access to record match voice notes.',
        type: 'system',
      });
    }
  };

  const stopAndSendVoiceRecording = async () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    clearInterval(recordingTimerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    sendMatchTypingStatus(match.id, user, false, false);

    const recorder = mediaRecorderRef.current;
    const finalDuration = recordingSeconds;

    recorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const generatedWaveform = Array.from({ length: 30 }, () =>
        Math.floor(25 + Math.random() * 70)
      );

      const uploadRes = await uploadFileToBackend(
        audioBlob,
        'match-chat-voices',
        `voice_${Date.now()}.webm`,
        undefined,
        user.id
      );

      if (uploadRes.success && uploadRes.url) {
        const newMsg: MatchChatMessage = {
          id: `mmsg_${Date.now()}`,
          matchId: match.id,
          user: {
            id: user.id,
            name: user.name,
            handle: user.handle,
            avatar: user.avatar,
            favoriteClub: user.favoriteClub,
          },
          text: '🎤 Voice note',
          content: '🎤 Voice note',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          createdAt: new Date().toISOString(),
          messageType: 'chat',
          mediaType: 'voice',
          mediaUrl: uploadRes.url,
          voiceDuration: Math.max(1, finalDuration),
          waveform: generatedWaveform,
          reactions: { '🔥': 0, '⚽': 0, '❤️': 0, '😂': 0, '😱': 0, '👏': 0 },
          userReactions: [],
          status: 'delivered',
        };

        setMessages(prev => [...prev, newMsg]);
        scrollToBottom('smooth');

        triggerMessage();
        addFanPoints(20, 'Recorded match voice note');
        await sendServerMatchMessage(match.id, newMsg);
      }

      // Stop mic tracks
      recorder.stream.getTracks().forEach(track => track.stop());
    };

    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
    setIsRecording(false);
  };

  const cancelVoiceRecording = () => {
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {}
    }
    clearInterval(recordingTimerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    setIsRecording(false);
    sendMatchTypingStatus(match.id, user, false, false);
    addNotification({
      title: 'Voice Note Cancelled',
      body: 'Recording discarded.',
      type: 'system',
    });
  };

  const togglePauseVoiceRecording = () => {
    if (!mediaRecorderRef.current) return;
    if (recordingPaused) {
      mediaRecorderRef.current.resume();
      setRecordingPaused(false);
    } else {
      mediaRecorderRef.current.pause();
      setRecordingPaused(true);
    }
  };

  // 7. Toggle Reaction on Message
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    setMessages(prev =>
      prev.map(msg => {
        if (msg.id === messageId) {
          const userReactions = msg.userReactions || [];
          const hasReacted = userReactions.includes(emoji);
          const currentCount = Number(msg.reactions[emoji] || 0);
          const updatedReactions = {
            ...msg.reactions,
            [emoji]: hasReacted ? Math.max(0, currentCount - 1) : currentCount + 1,
          };
          const updatedUserReactions = hasReacted
            ? userReactions.filter(e => e !== emoji)
            : [...userReactions, emoji];
          return {
            ...msg,
            reactions: updatedReactions,
            userReactions: updatedUserReactions,
          };
        }
        return msg;
      })
    );

    haptics.like();
    await reactToMatchMessageOnServer(match.id, messageId, emoji, user.id);
  };

  // 8. Delete Message (For everyone vs for me)
  const handleDeleteMessage = async (message: MatchChatMessage, forEveryone = true) => {
    setSelectedMessageAction(null);
    setMessages(prev => {
      if (!forEveryone) {
        return prev.filter(m => m.id !== message.id);
      }
      return prev.map(m =>
        m.id === message.id
          ? {
              ...m,
              isDeleted: true,
              text: 'This message was deleted',
              content: 'This message was deleted',
              mediaUrl: undefined,
              thumbnailUrl: undefined,
            }
          : m
      );
    });

    await deleteMatchMessageOnServer(match.id, message.id, forEveryone);
    addNotification({
      title: 'Message Deleted',
      body: forEveryone ? 'Deleted for everyone in match room.' : 'Deleted for you.',
      type: 'system',
    });
  };

  // 9. Pin / Unpin Message
  const handleTogglePinMessage = async (message: MatchChatMessage) => {
    setSelectedMessageAction(null);
    const nextPinState = !message.isPinned;
    setMessages(prev =>
      prev.map(m => (m.id === message.id ? { ...m, isPinned: nextPinState } : m))
    );
    await pinMatchMessageOnServer(match.id, message.id, nextPinState);
    addNotification({
      title: nextPinState ? 'Message Pinned' : 'Message Unpinned',
      body: nextPinState ? 'Pinned to top of match room.' : 'Unpinned from match room.',
      type: 'system',
    });
  };

  // 10. Report Message
  const handleReportMessage = (message: MatchChatMessage) => {
    setSelectedMessageAction(null);
    addNotification({
      title: 'Report Received',
      body: `Thank you. The report on @${message.user?.handle?.replace('@', '')} has been logged for moderation.`,
      type: 'system',
    });
  };

  // 11. Trigger Match Event Simulation Webhook (Goals, Cards)
  const handleSimulateGoalEvent = async () => {
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#00E676', '#FFD700', '#ffffff'],
      });
    } catch {}

    const res = await triggerMatchEventWebhook(match.id, {
      eventType: 'goal',
      minute: typeof match.minute === 'number' ? `${match.minute}` : '72',
      player: `${match.homeTeam.shortName || 'Attacker'} Striker`,
      team: match.homeTeam.name,
      text: `GOAL! ${match.homeTeam.name} score a sensational strike into the top corner!`,
    });

    haptics.goalAlert();
    if (res?.event) {
      setMessages(prev => [...prev, res.event]);
      scrollToBottom('smooth');
    }
  };

  // Currently pinned message
  const pinnedMessage = useMemo(() => {
    return messages.find(m => m.isPinned);
  }, [messages]);

  // Gallery items for media drawer
  const mediaGalleryItems = useMemo(() => {
    return messages.filter(m => m.mediaType === 'image' && m.mediaUrl);
  }, [messages]);

  const voiceGalleryItems = useMemo(() => {
    return messages.filter(m => m.mediaType === 'voice' && m.mediaUrl);
  }, [messages]);

  // Dynamic Rivalry Intensity Thermometer metrics calculated strictly from live chat messages & reactions
  const rivalryMetrics = useMemo(() => {
    const matchesTeamName = (clubStr: string | undefined, teamName: string, shortName?: string): boolean => {
      if (!clubStr) return false;
      const cleanClub = clubStr.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
      const cleanName = teamName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
      const cleanShort = (shortName || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
      if (!cleanClub) return false;
      if (cleanClub === cleanName || (cleanShort && cleanShort.length >= 3 && cleanClub === cleanShort)) {
        return true;
      }
      return Boolean(cleanName && (cleanClub.includes(cleanName) || cleanName.includes(cleanClub)));
    };

    const userSupportsHome = matchesTeamName(user.favoriteClub, match.homeTeam.name, match.homeTeam.shortName);
    const userSupportsAway = !userSupportsHome && matchesTeamName(user.favoriteClub, match.awayTeam.name, match.awayTeam.shortName);
    const userSide: 'home' | 'away' | 'neutral' = userSupportsHome
      ? 'home'
      : userSupportsAway
      ? 'away'
      : 'neutral';

    let homeMsgs = 0;
    let homeReacts = 0;
    let awayMsgs = 0;
    let awayReacts = 0;
    let otherRivalMsgs = 0;
    let otherRivalReacts = 0;
    let totalMsgs = 0;
    let totalReacts = 0;

    for (const msg of messages) {
      if (msg.isDeleted || msg.messageType === 'system') continue;
      totalMsgs += 1;
      const msgReactions = Object.values(msg.reactions || {}).reduce<number>(
        (acc, val) => acc + (Number(val) || 0),
        0
      );
      totalReacts += msgReactions;

      const favClub = msg.user?.favoriteClub;
      const isHome = matchesTeamName(favClub, match.homeTeam.name, match.homeTeam.shortName);
      const isAway = !isHome && matchesTeamName(favClub, match.awayTeam.name, match.awayTeam.shortName);

      if (isHome) {
        homeMsgs += 1;
        homeReacts += msgReactions;
      } else if (isAway) {
        awayMsgs += 1;
        awayReacts += msgReactions;
      } else if (favClub && (!user.favoriteClub || favClub.toLowerCase() !== user.favoriteClub.toLowerCase())) {
        otherRivalMsgs += 1;
        otherRivalReacts += msgReactions;
      }
    }

    // Rival volume relative to user's club or opposing sides in this fixture
    const rivalFansMsgs =
      userSide === 'home'
        ? awayMsgs + otherRivalMsgs
        : userSide === 'away'
        ? homeMsgs + otherRivalMsgs
        : awayMsgs + otherRivalMsgs;

    const rivalFansReacts =
      userSide === 'home'
        ? awayReacts + otherRivalReacts
        : userSide === 'away'
        ? homeReacts + otherRivalReacts
        : awayReacts + otherRivalReacts;

    const homeVolume = homeMsgs + homeReacts;
    const awayVolume = awayMsgs + awayReacts + otherRivalMsgs + otherRivalReacts;
    const clashBonus = Math.min(homeVolume, awayVolume) * 6;
    const rawHeat =
      rivalFansMsgs * 8 +
      rivalFansReacts * 5 +
      clashBonus +
      totalMsgs * 2 +
      totalReacts * 2;

    const intensityPct = Math.min(100, Math.max(0, Math.round(rawHeat)));

    const totalFactionVol = homeVolume + awayVolume;
    const homeSharePct = totalFactionVol > 0 ? Math.round((homeVolume / totalFactionVol) * 100) : 50;
    const awaySharePct = totalFactionVol > 0 ? 100 - homeSharePct : 50;

    let tierLabel = 'Calm';
    let barGradient = 'from-sky-400 via-cyan-400 to-emerald-400';
    let bulbBg = 'bg-sky-500';
    let badgeTextColor = 'text-sky-600 dark:text-sky-400';
    let badgeBg = 'bg-sky-500/10 border-sky-500/30';

    if (intensityPct >= 75) {
      tierLabel = 'Boiling Point';
      barGradient = 'from-amber-500 via-rose-500 to-red-600';
      bulbBg = 'bg-red-600 animate-pulse';
      badgeTextColor = 'text-rose-500';
      badgeBg = 'bg-rose-500/15 border-rose-500/40';
    } else if (intensityPct >= 50) {
      tierLabel = 'Heated Clash';
      barGradient = 'from-emerald-400 via-amber-500 to-orange-500';
      bulbBg = 'bg-orange-500';
      badgeTextColor = 'text-orange-500';
      badgeBg = 'bg-orange-500/15 border-orange-500/40';
    } else if (intensityPct >= 25) {
      tierLabel = 'Warming Up';
      barGradient = 'from-cyan-400 via-emerald-400 to-amber-400';
      bulbBg = 'bg-amber-400';
      badgeTextColor = 'text-amber-500';
      badgeBg = 'bg-amber-500/15 border-amber-500/30';
    }

    return {
      userSide,
      homeMsgs,
      homeReacts,
      awayMsgs,
      awayReacts,
      otherRivalMsgs,
      otherRivalReacts,
      rivalFansMsgs,
      rivalFansReacts,
      totalMsgs,
      totalReacts,
      intensityPct,
      homeSharePct,
      awaySharePct,
      tierLabel,
      barGradient,
      bulbBg,
      badgeTextColor,
      badgeBg,
    };
  }, [messages, match.homeTeam.name, match.homeTeam.shortName, match.awayTeam.name, match.awayTeam.shortName, user.favoriteClub]);

  return (
    <div className="fixed inset-0 z-50 bg-[#efeae2] dark:bg-[#0b141a] flex flex-col justify-between animate-in slide-in-from-right duration-200 text-slate-900 dark:text-white font-sans">
      {/* -------------------------------------------------------------
          HEADER STICKY TOP (Height 88px, border bottom, shadow)
      -------------------------------------------------------------- */}
      <header className="h-[88px] px-3 sm:px-4 bg-white dark:bg-[#12171F] border-b border-slate-200 dark:border-white/10 flex flex-col justify-between shrink-0 z-30 shadow-sm">
        {/* Top Header Row */}
        <div className="flex items-center justify-between pt-1.5">
          {/* Left: Back button + Team logos + Live Score */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={onClose}
              className="min-h-[40px] min-w-[40px] -ml-1.5 flex items-center justify-center text-slate-600 dark:text-white/80 hover:text-black dark:hover:text-white rounded-full transition-colors"
              title="Return to scores"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Overlapping Club Logos */}
            <div className="flex items-center -space-x-2 shrink-0">
              <div className="ring-2 ring-white dark:ring-[#12171F] rounded-full overflow-hidden bg-white">
                <ClubLogo name={match.homeTeam.name} size="sm" />
              </div>
              <div className="ring-2 ring-white dark:ring-[#12171F] rounded-full overflow-hidden bg-white">
                <ClubLogo name={match.awayTeam.name} size="sm" />
              </div>
            </div>

            {/* Score & Minute */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-mono tabular-nums text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  {match.homeTeam.score} - {match.awayTeam.score}
                </span>
                <span className="text-xs font-extrabold text-slate-700 dark:text-white/90 truncate hidden xs:inline">
                  {match.homeTeam.shortName} vs {match.awayTeam.shortName}
                </span>
              </div>

              {/* Minute with pulsing red LIVE dot */}
              <div className="flex items-center gap-1.5 text-[10px] font-bold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600" />
                </span>
                <span className="text-rose-600 font-extrabold tabular-nums">{match.minute || 'LIVE'}&apos;</span>
                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-white/30" />
                <span className="text-emerald-700 dark:text-[#00E676]">{match.status}</span>
              </div>
            </div>
          </div>

          {/* Right Action Icons: Live Viewers + Media Gallery + Simulate Event */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Viewers Pill */}
            <button
              onClick={() => setShowViewersTray(prev => !prev)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-white/90 hover:bg-slate-200 transition-colors"
              title="Active fans in match room"
            >
              <Eye className="w-3.5 h-3.5 text-[#00E676]" />
              <span className="font-mono">{viewersCount}</span>
            </button>

            {/* Gallery Drawer Button */}
            <button
              onClick={() => setShowGalleryDrawer(true)}
              className="p-1.5 rounded-full text-slate-600 dark:text-white/80 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              title="Media Gallery"
            >
              <ImageIcon className="w-4 h-4" />
            </button>

            {/* Share Live Match Room to Phone */}
            <button
              onClick={() => {
                const path = `/match/${encodeURIComponent(match.id)}`;
                const url =
                  typeof window !== 'undefined' && window.location?.origin
                    ? `${window.location.origin}${path}`
                    : `https://futfieldsport.com.ng${path}`;
                openShareSheet({
                  kind: 'match',
                  targetId: match.id,
                  title: `Live Match Room: ${match.homeTeam.name} vs ${match.awayTeam.name}`,
                  text: `Join live fan chat (${match.homeTeam.score}-${match.awayTeam.score}) on FUTFIELD!`,
                  url,
                });
              }}
              className="p-1.5 rounded-full text-slate-600 dark:text-white/80 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              title="Share match room to phone"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {/* Quick Goal Webhook Button for Testing Live Match Engine */}
            <button
              onClick={handleSimulateGoalEvent}
              className="p-1 px-2 rounded-full bg-emerald-500/10 text-[#00E676] border border-emerald-500/30 text-[10px] font-black hover:bg-emerald-500/20 transition-colors"
              title="Simulate Match Event"
            >
              ⚽ GOAL!
            </button>
          </div>
        </div>

        {/* Second Row: Mini Match Stats Bar */}
        <div className="pb-1.5 pt-0.5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px] font-semibold text-slate-500 dark:text-white/60">
          <div className="flex items-center gap-2 w-full max-w-xs">
            <span className="font-mono font-bold text-emerald-600 dark:text-[#00E676]">
              {match.stats.possession[0]}%
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden flex">
              <div
                style={{ width: `${match.stats.possession[0]}%` }}
                className="bg-[#00E676] h-full"
              />
              <div
                style={{ width: `${match.stats.possession[1]}%` }}
                className="bg-slate-400 dark:bg-slate-600 h-full"
              />
            </div>
            <span className="font-mono">{match.stats.possession[1]}%</span>
          </div>

          <div className="flex items-center gap-3 shrink-0 ml-2 font-mono">
            <span>Shots {match.stats.shots[0]}-{match.stats.shots[1]}</span>
            <span>Corners {match.stats.corners[0]}-{match.stats.corners[1]}</span>
          </div>
        </div>
      </header>

      {/* -------------------------------------------------------------
          VISUAL 'RIVALRY INTENSITY' THERMOMETER (Live Rival Fan Heat)
      -------------------------------------------------------------- */}
      <div
        onClick={() => setShowRivalryBreakdown(prev => !prev)}
        className="bg-white/95 dark:bg-[#111821] border-b border-slate-200 dark:border-white/10 px-3 sm:px-4 py-2 shrink-0 z-20 cursor-pointer select-none transition-colors hover:bg-slate-50 dark:hover:bg-[#151e28]"
        title="Tap to view rival fanbase chat & reaction breakdown"
      >
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Thermometer className={`w-3.5 h-3.5 shrink-0 ${rivalryMetrics.badgeTextColor}`} />
            <span className="text-[11px] font-black uppercase tracking-tight text-slate-800 dark:text-white">
              Rivalry Intensity
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-extrabold ${rivalryMetrics.badgeBg} ${rivalryMetrics.badgeTextColor}`}
            >
              {rivalryMetrics.intensityPct >= 50 && <Flame className="w-2.5 h-2.5 fill-current" />}
              {rivalryMetrics.tierLabel} · {rivalryMetrics.intensityPct}°
            </span>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-slate-500 dark:text-white/60 shrink-0">
            <span>
              Rivals: {rivalryMetrics.rivalFansMsgs}m · {rivalryMetrics.rivalFansReacts}r
            </span>
            <span className="text-slate-400">{showRivalryBreakdown ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* Visual Thermometer Bulb + Graduated Mercury Tube */}
        <div className="flex items-center gap-0">
          {/* Thermometer Bulb */}
          <div
            className={`w-5 h-5 rounded-full ${rivalryMetrics.bulbBg} ring-2 ring-white dark:ring-[#111821] shadow-md flex items-center justify-center shrink-0 z-10 transition-colors duration-500`}
          >
            <Zap className="w-2.5 h-2.5 text-white fill-white" />
          </div>

          {/* Graduated Mercury Tube */}
          <div className="-ml-1.5 flex-1 h-3 rounded-r-full bg-slate-200 dark:bg-white/10 overflow-hidden relative border border-slate-300/60 dark:border-white/10 shadow-inner">
            <div
              style={{ width: `${Math.max(4, rivalryMetrics.intensityPct)}%` }}
              className={`h-full rounded-r-full bg-gradient-to-r ${rivalryMetrics.barGradient} transition-all duration-500 ease-out shadow-sm`}
            />
            {/* Graduated Degree Ticks */}
            <div className="absolute inset-0 flex justify-evenly pointer-events-none">
              <span className="w-px h-full bg-black/15 dark:bg-white/15" />
              <span className="w-px h-full bg-black/15 dark:bg-white/15" />
              <span className="w-px h-full bg-black/15 dark:bg-white/15" />
            </div>
          </div>
        </div>

        {/* Expandable Rival Fanbase Breakdown */}
        {showRivalryBreakdown && (
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/5 space-y-2 animate-in fade-in">
            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
              <div className="p-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="block font-bold text-slate-600 dark:text-white/70 truncate">
                  {match.homeTeam.shortName || match.homeTeam.name} Fans
                </span>
                <span className="font-mono font-black text-[#00E676]">
                  {rivalryMetrics.homeMsgs}m · {rivalryMetrics.homeReacts}r
                </span>
              </div>
              <div className="p-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <span className="block font-bold text-slate-600 dark:text-white/70 truncate">
                  {match.awayTeam.shortName || match.awayTeam.name} + Rivals
                </span>
                <span className="font-mono font-black text-rose-500">
                  {rivalryMetrics.awayMsgs + rivalryMetrics.otherRivalMsgs}m · {rivalryMetrics.awayReacts + rivalryMetrics.otherRivalReacts}r
                </span>
              </div>
              <div className="p-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <span className="block font-bold text-slate-600 dark:text-white/70">Total Room</span>
                <span className="font-mono font-black text-slate-800 dark:text-white">
                  {rivalryMetrics.totalMsgs}m · {rivalryMetrics.totalReacts}r
                </span>
              </div>
            </div>

            {/* Fanbase Clash Balance Bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 dark:text-white/50">
                <span>{match.homeTeam.shortName} ({rivalryMetrics.homeSharePct}%)</span>
                <span>Club Noise Split</span>
                <span>{match.awayTeam.shortName} &amp; Rivals ({rivalryMetrics.awaySharePct}%)</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden flex">
                <div
                  style={{ width: `${rivalryMetrics.homeSharePct}%` }}
                  className="bg-[#00E676] transition-all duration-500"
                />
                <div
                  style={{ width: `${rivalryMetrics.awaySharePct}%` }}
                  className="bg-rose-500 transition-all duration-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pinned Message Strip (if exists) */}
      {pinnedMessage && (
        <div
          onClick={() => {
            const el = document.getElementById(`msg-${pinnedMessage.id}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          className="bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/20 px-4 py-1.5 flex items-center justify-between text-xs cursor-pointer z-20 shrink-0"
        >
          <div className="flex items-center gap-2 truncate">
            <Pin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="font-bold text-amber-900 dark:text-amber-300">Pinned:</span>
            <span className="text-amber-800 dark:text-amber-200 truncate">{pinnedMessage.text}</span>
          </div>
          <span className="text-[10px] text-amber-600 shrink-0">Tap to view</span>
        </div>
      )}

      {/* Viewer Avatars Horizontal Tray */}
      {showViewersTray && (
        <div className="bg-white/95 dark:bg-[#161b22]/95 border-b border-slate-200 dark:border-white/10 px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar z-20 shrink-0 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0">
            Watching Live ({viewersCount}):
          </span>
          {viewerAvatars.map((v, i) => (
            <div
              key={v.id || i}
              onClick={() => {
                setShowViewersTray(false);
                navigateToProfile(v.handle || v.id);
              }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-100 dark:bg-white/5 cursor-pointer hover:bg-slate-200 shrink-0 text-xs"
              title={`View ${v.name}'s profile`}
            >
              <img src={v.avatar} alt={`${v.name || 'Supporter'} football fan avatar`} loading="lazy" decoding="async" className="w-5 h-5 rounded-full object-cover" />
              <span className="font-bold text-[11px] truncate max-w-[80px]">{v.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* -------------------------------------------------------------
          MESSAGE LIST (WhatsApp style feed with custom bubbles)
      -------------------------------------------------------------- */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-3 relative"
        style={{
          backgroundImage: 'radial-gradient(rgba(0, 230, 118, 0.03) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      >
        {/* Sticky Date Separator */}
        <div className="flex justify-center sticky top-2 z-10 select-none">
          <span className="px-3 py-1 rounded-full bg-white/80 dark:bg-[#161b22]/90 backdrop-blur border border-slate-200 dark:border-white/10 text-[10px] font-bold text-slate-500 dark:text-white/70 shadow-sm">
            Today
          </span>
        </div>

        {/* Empty State if 0 messages */}
        {messages.length === 0 ? (
          <div className="py-20 text-center space-y-3 max-w-xs mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-[#00E676] flex items-center justify-center text-3xl mx-auto shadow-sm">
              ⚽
            </div>
            <h3 className="font-black text-slate-900 dark:text-white text-base">
              Be the first to chat!
            </h3>
            <p className="text-xs text-slate-500 dark:text-white/60 leading-relaxed">
              {viewersCount} supporters are tuned into {match.homeTeam.name} vs {match.awayTeam.name}. Share your match observations, voice notes, or photos below!
            </p>
            {/* Quick Banter Suggestions */}
            <div className="pt-2 flex flex-wrap gap-1.5 justify-center">
              {QUICK_CHAT_PILLS.slice(0, 3).map((pill, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendTextMessage(pill)}
                  className="px-3 py-1 rounded-full text-[11px] font-bold bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-100"
                >
                  {pill}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.user?.id === user.id || msg.user?.handle === user.handle;

            // 1. System Centered Message
            if (msg.messageType === 'system') {
              return (
                <div key={msg.id} id={`msg-${msg.id}`} className="flex justify-center my-2">
                  <span className="px-3.5 py-1 rounded-full bg-slate-200/80 dark:bg-white/10 text-slate-600 dark:text-white/70 text-[11px] font-medium text-center max-w-sm">
                    {msg.text}
                  </span>
                </div>
              );
            }

            // 2. Goal Event Card
            if (msg.messageType === 'goal') {
              const fireCount = msg.reactions?.['🔥'] || 0;
              const goalCount = msg.reactions?.['⚽'] || 0;
              return (
                <div
                  key={msg.id}
                  id={`msg-${msg.id}`}
                  className="rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-900 to-[#090D12] p-4 text-white shadow-lg space-y-2.5 relative overflow-hidden border border-[#00E676]/30"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-3xl">⚽</span>
                      <div>
                        <span className="text-xs font-black tracking-widest text-[#00E676] uppercase">
                          MATCH EVENT
                        </span>
                        <h4 className="font-display font-extrabold text-base sm:text-lg tracking-tight">
                          {msg.text}
                        </h4>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Real-Time Reaction Counts */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/15 text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleReaction(msg.id, '🔥')}
                        className="px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 font-bold tabular-nums flex items-center gap-1 transition-colors"
                      >
                        <span>🔥</span>
                        <span>{fireCount}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleReaction(msg.id, '⚽')}
                        className="px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 font-bold tabular-nums flex items-center gap-1 transition-colors"
                      >
                        <span>⚽</span>
                        <span>{goalCount}</span>
                      </button>
                    </div>
                    <span className="text-[11px] text-white/70 font-mono tabular-nums">{msg.timestamp}</span>
                  </div>
                </div>
              );
            }

            // 3. Yellow or Red Card Message
            if (msg.messageType === 'yellow' || msg.messageType === 'red') {
              const isRed = msg.messageType === 'red';
              return (
                <div
                  key={msg.id}
                  id={`msg-${msg.id}`}
                  className={`rounded-2xl p-3 text-xs font-bold border flex items-center justify-between ${
                    isRed
                      ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                      : 'bg-amber-50 dark:bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{isRed ? '🟥' : '🟨'}</span>
                    <span>{msg.text}</span>
                  </div>
                  <span className="text-[10px] opacity-70">{msg.timestamp}</span>
                </div>
              );
            }

            // 4. Standard WhatsApp Chat Message (Own = Green Right, Other = White Left)
            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                className={`flex items-end gap-1.5 group ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                {/* Other User Avatar */}
                {!isMe && (
                  <img
                    onClick={() => navigateToProfile(msg.user?.handle || msg.user?.id)}
                    src={msg.user?.avatar || '/assets/aistudio/IMG-20261106-WA6972_a4f2c4ba.jpg'}
                    alt={`${msg.user?.name || 'Supporter'} football fan avatar`}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full object-cover shrink-0 mb-1 cursor-pointer hover:ring-2 hover:ring-[#00E676] transition-all"
                    title={`View ${msg.user?.name}'s profile`}
                  />
                )}

                {/* Bubble Container */}
                <div
                  onContextMenu={e => {
                    e.preventDefault();
                    setSelectedMessageAction(msg);
                  }}
                  className={`relative max-w-[82%] sm:max-w-[75%] rounded-2xl p-2.5 shadow-sm text-xs space-y-1.5 transition-all ${
                    isMe
                      ? 'bg-[#dcf8c6] dark:bg-[#005c4b] text-slate-900 dark:text-white rounded-br-xs'
                      : 'bg-white dark:bg-[#202c33] text-slate-900 dark:text-white rounded-bl-xs border border-slate-100 dark:border-white/5'
                  }`}
                >
                  {/* Pin Indicator */}
                  {msg.isPinned && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 pb-0.5 border-b border-black/5 dark:border-white/5">
                      <Pin className="w-2.5 h-2.5" />
                      <span>Pinned</span>
                    </div>
                  )}

                  {/* Header info for other supporters */}
                  {!isMe && (
                    <div className="flex items-center justify-between gap-2 pb-0.5">
                      <div
                        onClick={() => navigateToProfile(msg.user?.handle || msg.user?.id)}
                        className="flex items-center gap-1 font-bold text-[11px] cursor-pointer hover:underline"
                      >
                        <span className="text-[#00a884] dark:text-[#00E676]">{msg.user?.name}</span>
                        {msg.user?.favoriteClub && msg.user.favoriteClub !== 'Not Set' && (
                          <span className="text-[10px] text-slate-400 dark:text-white/50">
                            • ⚽ {msg.user.favoriteClub}
                          </span>
                        )}
                        {msg.user?.isMod && (
                          <Shield className="w-3 h-3 text-amber-500 fill-amber-500/20" />
                        )}
                      </div>

                      <button
                        onClick={() => setSelectedMessageAction(msg)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-opacity"
                      >
                        <MoreVertical className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Quoted Reply Preview */}
                  {msg.replyToMessage && (
                    <div
                      onClick={() => {
                        if (msg.replyToId) {
                          const el = document.getElementById(`msg-${msg.replyToId}`);
                          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }}
                      className="p-1.5 rounded-lg bg-black/5 dark:bg-white/5 border-l-3 border-[#00a884] dark:border-[#00E676] text-[11px] cursor-pointer"
                    >
                      <span className="font-bold text-[#00a884] dark:text-[#00E676] block text-[10px]">
                        {msg.replyToMessage.authorName}
                      </span>
                      <p className="line-clamp-1 opacity-75">{msg.replyToMessage.text}</p>
                    </div>
                  )}

                  {/* Message Content: Image */}
                  {msg.mediaType === 'image' && msg.mediaUrl && (
                    <div
                      onClick={() => setActiveViewerImage({ url: msg.mediaUrl!, caption: msg.text })}
                      className="rounded-xl overflow-hidden cursor-pointer relative group/img bg-black/10"
                    >
                      <img
                        src={msg.mediaUrl}
                        alt={`live score match chat photo for ${match.homeTeam.name} vs ${match.awayTeam.name}`}
                        loading="lazy"
                        decoding="async"
                        className="max-h-60 w-full object-cover rounded-xl hover:opacity-95 transition-opacity"
                      />
                    </div>
                  )}

                  {/* Message Content: Voice Note */}
                  {msg.mediaType === 'voice' && msg.mediaUrl && (
                    <VoiceNoteBubble
                      audioUrl={msg.mediaUrl}
                      durationSeconds={msg.voiceDuration || 12}
                      waveform={msg.waveform}
                      isMe={isMe}
                    />
                  )}

                  {/* Text Content */}
                  {msg.text && (
                    <p className={`leading-relaxed break-words ${msg.isDeleted ? 'italic opacity-60' : ''}`}>
                      {msg.text}
                    </p>
                  )}

                  {/* Bottom Footer: Timestamp & Checkmarks */}
                  <div className="flex items-center justify-end gap-1 text-[10px] text-slate-500 dark:text-white/50 pt-0.5">
                    <span>{msg.timestamp}</span>
                    {isMe && (
                      <span title="Delivered">
                        <CheckCheck className="w-3.5 h-3.5 text-sky-500 stroke-[2.5]" />
                      </span>
                    )}
                  </div>

                  {/* Reactions Row (emoji pills) */}
                  {msg.reactions && Object.values(msg.reactions).some(v => typeof v === 'number' && v > 0) && (
                    <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-black/5 dark:border-white/5">
                      {Object.entries(msg.reactions).map(([emoji, count]) => {
                        if (!count || count <= 0) return null;
                        const hasReacted = msg.userReactions?.includes(emoji);
                        return (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleToggleReaction(msg.id, emoji)}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border transition-all ${
                              hasReacted
                                ? 'bg-[#00E676]/20 border-[#00E676] text-black dark:text-white scale-105'
                                : 'bg-black/5 dark:bg-white/5 border-transparent text-slate-700 dark:text-white/80 hover:bg-black/10'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span>{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3-Dots Menu button for Own Message */}
                {isMe && (
                  <button
                    onClick={() => setSelectedMessageAction(msg)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-opacity mb-1"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating "Scroll to Bottom" Pill Button */}
      {showScrollBottomPill && (
        <button
          onClick={() => scrollToBottom('smooth')}
          className="absolute bottom-28 right-4 z-30 p-2.5 rounded-full bg-white dark:bg-[#161b22] text-[#00E676] shadow-xl border border-slate-200 dark:border-white/10 hover:scale-105 active:scale-95 transition-all flex items-center gap-1 text-xs font-bold"
        >
          <ArrowDown className="w-4 h-4" />
          <span className="text-[11px]">New messages</span>
        </button>
      )}

      {/* Typing Indicator Bar */}
      {typingFans.length > 0 && (
        <div className="px-4 py-1 text-xs text-slate-500 dark:text-white/60 flex items-center gap-2 bg-transparent shrink-0">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] animate-bounce [animation-delay:0.2s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] animate-bounce [animation-delay:0.4s]" />
          </div>
          <span>
            {typingFans[0].isRecording ? '🎤 Recording voice note...' : `${typingFans[0].userName} is typing...`}
          </span>
        </div>
      )}

      {/* Reply Banner Above Input */}
      {replyTarget && (
        <div className="bg-slate-100 dark:bg-[#1f2c34] border-t border-slate-200 dark:border-white/10 px-4 py-2 flex items-center justify-between z-20 shrink-0">
          <div className="border-l-3 border-[#00a884] dark:border-[#00E676] pl-2 text-xs min-w-0">
            <span className="font-bold text-[#00a884] dark:text-[#00E676] block text-[11px]">
              Replying to {replyTarget.user?.name}
            </span>
            <p className="text-slate-600 dark:text-white/70 line-clamp-1">{replyTarget.text}</p>
          </div>
          <button
            onClick={() => setReplyTarget(null)}
            className="p-1 text-slate-400 hover:text-white rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quick Banter Suggestions Pill Bar */}
      <div className="px-3 py-1.5 bg-slate-100/90 dark:bg-[#161b22]/90 border-t border-slate-200/80 dark:border-white/5 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 z-20">
        {QUICK_CHAT_PILLS.map((pill, i) => (
          <button
            key={i}
            onClick={() => handleSendTextMessage(pill)}
            className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/80 hover:bg-[#00E676] hover:text-black hover:border-[#00E676] transition-all shrink-0"
          >
            {pill}
          </button>
        ))}
      </div>

      {/* -------------------------------------------------------------
          INPUT BAR STICKY BOTTOM (WhatsApp Clone)
      -------------------------------------------------------------- */}
      <div className="p-2.5 bg-white dark:bg-[#161b22] border-t border-slate-200 dark:border-white/10 shrink-0 z-30 pb-safe">
        {isRecording ? (
          /* =========================================================
             VOICE RECORDING STUDIO MODE
          ========================================================== */
          <div className="flex items-center justify-between gap-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-2xl">
            {/* Left: Cancel Button (Red trash) */}
            <button
              onClick={cancelVoiceRecording}
              className="p-2 rounded-full text-rose-500 hover:bg-rose-500/20 transition-colors"
              title="Cancel recording"
            >
              <Trash2 className="w-5 h-5" />
            </button>

            {/* Center: Live timer & Volume meter */}
            <div className="flex-1 flex items-center justify-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <span className="font-mono text-xs font-black text-rose-600 dark:text-rose-400">
                0:{recordingSeconds < 10 ? '0' : ''}{recordingSeconds}
              </span>

              {/* Dynamic waveform meter */}
              <div className="flex items-center gap-1 h-5 px-2">
                {[12, 24, 18, 30, 20, 26, 14, 28].map((h, idx) => (
                  <span
                    key={idx}
                    style={{
                      height: `${Math.min(22, Math.max(4, (liveVolumeLevel / 100) * h))}px`,
                    }}
                    className="w-[2.5px] rounded-full bg-rose-500 transition-all duration-75"
                  />
                ))}
              </div>
              <span className="text-[11px] text-slate-400 hidden sm:inline">Slide to cancel</span>
            </div>

            {/* Right: Pause / Resume + Stop & Send */}
            <div className="flex items-center gap-2">
              <button
                onClick={togglePauseVoiceRecording}
                className="p-2 rounded-full bg-black/5 dark:bg-white/10 text-slate-700 dark:text-white hover:bg-black/10"
              >
                {recordingPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
              </button>

              <button
                onClick={stopAndSendVoiceRecording}
                className="w-10 h-10 rounded-full bg-[#00E676] hover:bg-[#00c864] text-black flex items-center justify-center shadow-lg shadow-[#00E676]/30 active:scale-95 transition-all"
                title="Send voice note"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* =========================================================
             STANDARD INPUT BAR (Text / Media / Voice trigger)
          ========================================================== */
          <div className="flex items-center gap-2">
            {/* Paperclip Button -> Opens Media Sheet */}
            <button
              type="button"
              onClick={() => setShowMediaSheet(prev => !prev)}
              className="p-2 rounded-full text-slate-500 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              title="Add media"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* Auto-expanding Input Box */}
            <div className="flex-1 flex items-center gap-2 bg-slate-100 dark:bg-[#202c33] rounded-full px-3.5 py-2 border border-slate-200 dark:border-white/5 focus-within:border-[#00E676] transition-colors">
              <input
                type="text"
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSendTextMessage();
                }}
                maxLength={500}
                placeholder="Say something... What a strike!!"
                className="flex-1 bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus:outline-none"
              />

              {/* Emoji Button */}
              <button
                type="button"
                onClick={() => setShowEmojiPicker(prev => !prev)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-0.5"
                title="Quick emojis"
              >
                <Smile className="w-4 h-4" />
              </button>
            </div>

            {/* Right Button: Send if text entered, else Voice Mic */}
            {inputText.trim() ? (
              <button
                type="button"
                onClick={() => handleSendTextMessage()}
                className="w-10 h-10 rounded-full bg-[#00E676] hover:bg-[#00c864] text-black flex items-center justify-center transition-all shadow-md shadow-[#00E676]/20 active:scale-95"
                title="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={startVoiceRecording}
                className="w-10 h-10 rounded-full bg-[#00E676] hover:bg-[#00c864] text-black flex items-center justify-center transition-all shadow-md shadow-[#00E676]/20 active:scale-95"
                title="Record voice note"
              >
                <Mic className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Hidden file inputs for Camera & Photo Gallery */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        onChange={e => handleMediaFileSelect(e, 'image')}
        className="hidden"
      />
      <input
        type="file"
        ref={galleryInputRef}
        accept="image/*,video/*"
        onChange={e => handleMediaFileSelect(e, 'image')}
        className="hidden"
      />

      {/* Media Sheet Modal (Camera, Gallery, GIF) */}
      {showMediaSheet && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center p-3 sm:p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#161b22] border border-slate-200 dark:border-white/10 p-5 shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/5">
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Share to Match Room</h4>
              <button onClick={() => setShowMediaSheet(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              {/* Camera */}
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5 flex flex-col items-center gap-2 group transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-[#00E676] flex items-center justify-center">
                  <Camera className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-white">Camera</span>
              </button>

              {/* Photo & Video Gallery */}
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5 flex flex-col items-center gap-2 group transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-white">Gallery</span>
              </button>

              {/* Football GIF */}
              <button
                onClick={() => {
                  setShowMediaSheet(false);
                  handleSendTextMessage('Check out this celebration! 🕺⚽');
                }}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5 flex flex-col items-center gap-2 group transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center">
                  <Film className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-white">GIF / Clip</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backend Image Upload Splash & Preview Modal before sending */}
      {pendingUploadMedia && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-between p-4">
          <div className="flex items-center justify-between text-white">
            <h4 className="font-bold text-sm">
              {chatUploadStatus === 'uploading' ? 'Uploading Image...' : 'Send Match Photo'}
            </h4>
            <button
              onClick={() => {
                setPendingUploadMedia(null);
                setChatUploadStatus('idle');
                setChatUploadProgress(0);
              }}
              className="p-2 hover:bg-white/10 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center py-4 gap-4 overflow-hidden">
            <div className="w-full max-w-md">
              <MediaUploadSplash
                status={chatUploadStatus}
                mediaKind="image"
                fileName={pendingUploadMedia.file.name}
                sizeMb={chatUploadSizeMb}
                progress={chatUploadProgress}
                onDismissError={() => {
                  setPendingUploadMedia(null);
                  setChatUploadStatus('idle');
                }}
              />
            </div>

            {chatUploadStatus === 'uploaded' && pendingUploadMedia.url && (
              <img
                src={pendingUploadMedia.url}
                alt="Uploaded match photo"
                className="max-h-[55vh] max-w-full rounded-2xl object-contain shadow-2xl border border-[#00E676]/40 animate-in fade-in"
              />
            )}
          </div>

          <div className="space-y-3 max-w-md mx-auto w-full">
            <input
              type="text"
              value={pendingCaption}
              onChange={e => setPendingCaption(e.target.value)}
              placeholder="Add a caption..."
              className="w-full px-4 py-3 rounded-2xl bg-white/10 text-white placeholder:text-white/40 border border-white/20 focus:outline-none focus:border-[#00E676] text-sm"
            />

            <button
              onClick={handleConfirmSendMedia}
              disabled={chatUploadStatus !== 'uploaded' || !pendingUploadMedia.url}
              className="w-full py-3 rounded-2xl bg-[#00E676] disabled:opacity-40 text-black font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <Send className="w-4 h-4" />
              <span>{chatUploadStatus === 'uploading' ? 'Uploading to Backend...' : 'Send Image'}</span>
            </button>
          </div>
        </div>
      )}

      {/* WhatsApp Fullscreen Image Viewer Modal */}
      {activeViewerImage && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between p-4 animate-in fade-in">
          <div className="flex items-center justify-between text-white z-20">
            <button onClick={() => setActiveViewerImage(null)} className="p-2 hover:bg-white/10 rounded-full">
              <X className="w-6 h-6" />
            </button>
            <button
              onClick={() => {
                const a = document.createElement('a');
                a.href = activeViewerImage.url;
                a.download = 'futfield_match_photo.jpg';
                a.click();
              }}
              className="p-2 hover:bg-white/10 rounded-full text-white/80 hover:text-white"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center py-2 overflow-hidden">
            <img
              src={activeViewerImage.url}
              alt=""
              className="max-h-[80vh] max-w-full object-contain rounded-xl select-none"
            />
          </div>

          {activeViewerImage.caption && (
            <div className="text-center text-white/90 text-sm py-2 bg-black/60 rounded-xl max-w-md mx-auto w-full">
              {activeViewerImage.caption}
            </div>
          )}
        </div>
      )}

      {/* Message Context Action Bottom Sheet (Reply, 6 Emojis, Pin, Delete, Report) */}
      {selectedMessageAction && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center p-3 sm:p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#161b22] border border-slate-200 dark:border-white/10 p-5 shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200 text-xs">
            {/* Emoji Reaction Bar (6 Emojis) */}
            <div className="flex items-center justify-around py-2 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
              {REACTION_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => {
                    handleToggleReaction(selectedMessageAction.id, emoji);
                    setSelectedMessageAction(null);
                  }}
                  className="text-2xl p-1.5 hover:scale-130 active:scale-95 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Actions List */}
            <div className="space-y-1">
              {/* Reply */}
              <button
                onClick={() => {
                  setReplyTarget(selectedMessageAction);
                  setSelectedMessageAction(null);
                }}
                className="w-full p-2.5 rounded-xl flex items-center gap-3 text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5 font-bold transition-colors"
              >
                <Reply className="w-4 h-4 text-emerald-500" />
                <span>Reply</span>
              </button>

              {/* Pin */}
              <button
                onClick={() => handleTogglePinMessage(selectedMessageAction)}
                className="w-full p-2.5 rounded-xl flex items-center gap-3 text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5 font-bold transition-colors"
              >
                <Pin className="w-4 h-4 text-amber-500" />
                <span>{selectedMessageAction.isPinned ? 'Unpin message' : 'Pin message'}</span>
              </button>

              {/* Delete (Own messages only) */}
              {(selectedMessageAction.user?.id === user.id || selectedMessageAction.user?.handle === user.handle) && (
                <>
                  <button
                    onClick={() => handleDeleteMessage(selectedMessageAction, true)}
                    className="w-full p-2.5 rounded-xl flex items-center gap-3 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 font-bold transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete for everyone</span>
                  </button>
                  <button
                    onClick={() => handleDeleteMessage(selectedMessageAction, false)}
                    className="w-full p-2.5 rounded-xl flex items-center gap-3 text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/5 font-bold transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete for me</span>
                  </button>
                </>
              )}

              {/* Report */}
              <button
                onClick={() => handleReportMessage(selectedMessageAction)}
                className="w-full p-2.5 rounded-xl flex items-center gap-3 text-slate-500 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/5 font-medium transition-colors"
              >
                <Flag className="w-4 h-4" />
                <span>Report message</span>
              </button>
            </div>

            <button
              onClick={() => setSelectedMessageAction(null)}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Media Gallery Drawer (Shared Media & Voices) */}
      {showGalleryDrawer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center sm:items-center p-0 sm:p-4">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#161b22] border border-slate-200 dark:border-white/10 p-5 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Match Room Gallery</h3>
              <button onClick={() => setShowGalleryDrawer(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs: Media vs Voices */}
            <div className="flex items-center gap-2 pt-3 pb-2 border-b border-slate-100 dark:border-white/5">
              <button
                onClick={() => setGalleryTab('media')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  galleryTab === 'media'
                    ? 'bg-[#00E676] text-black shadow-sm'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/60'
                }`}
              >
                Media ({mediaGalleryItems.length})
              </button>
              <button
                onClick={() => setGalleryTab('voices')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  galleryTab === 'voices'
                    ? 'bg-[#00E676] text-black shadow-sm'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/60'
                }`}
              >
                Voice Notes ({voiceGalleryItems.length})
              </button>
            </div>

            {/* Gallery Content */}
            <div className="flex-1 overflow-y-auto py-3">
              {galleryTab === 'media' ? (
                mediaGalleryItems.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-400">
                    No photos shared in this match room yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {mediaGalleryItems.map(m => (
                      <div
                        key={m.id}
                        onClick={() => {
                          setShowGalleryDrawer(false);
                          setActiveViewerImage({ url: m.mediaUrl!, caption: m.text });
                        }}
                        className="aspect-square rounded-xl overflow-hidden bg-black/10 cursor-pointer hover:opacity-90 transition-opacity"
                      >
                        <img src={m.mediaUrl} alt={m.text ? `${m.text} football match chat photo` : 'Football match chat fan photo'} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )
              ) : voiceGalleryItems.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400">
                  No voice notes recorded yet. Hold the microphone to record!
                </div>
              ) : (
                <div className="space-y-2">
                  {voiceGalleryItems.map(v => (
                    <div
                      key={v.id}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold">{v.user?.name}</span>
                        <span className="text-[10px] text-slate-400">{v.timestamp}</span>
                      </div>
                      <VoiceNoteBubble
                        audioUrl={v.mediaUrl!}
                        durationSeconds={v.voiceDuration || 10}
                        waveform={v.waveform}
                        isMe={v.user?.id === user.id}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
