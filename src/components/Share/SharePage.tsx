import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  Smartphone,
  Share2,
  MessageSquare,
  MessageCircle,
  Send,
  Mail,
  Copy,
  Check,
  QrCode,
  Download,
  Phone,
  ArrowLeft,
  Globe,
  Film,
  Trophy,
  User,
  ExternalLink,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { haptics } from '../../utils/haptics';
import { scrollToTopInstant } from '../../utils/scroll';
import {
  PROD_DOMAIN,
  SharePayload,
  ShareChannel,
  sanitizeShareUrl,
  buildUserInviteUrl,
  buildVideoShareUrl,
  buildMatchShareUrl,
  copyTextSafely,
  buildSmsHref,
  buildWhatsAppHref,
  buildTelegramHref,
  buildTwitterHref,
  buildFacebookHref,
  buildMailtoHref,
  detectDevicePhoneContext,
  trackShareEvent,
  formatPhoneDigitsOnly,
} from '../../utils/share';

interface PhoneSharePanelProps {
  payload: SharePayload;
  onShared?: (channel: ShareChannel) => void;
}

export const PhoneSharePanel: React.FC<PhoneSharePanelProps> = ({ payload, onShared }) => {
  const { addNotification, addFanPoints, addPost, setActiveTab, closeShareSheet } = useFootball();
  const [phoneInput, setPhoneInput] = useState('');
  const [showPhoneBox, setShowPhoneBox] = useState(false);
  const [showQrCard, setShowQrCard] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sharedToFeed, setSharedToFeed] = useState(false);
  const [sharingToFeed, setSharingToFeed] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState<string>('');
  const [rewardedOnce, setRewardedOnce] = useState(false);

  const deviceCtx = useMemo(() => detectDevicePhoneContext(), []);

  // Strict production share URL (dev / localhost / typo domains are always rewritten to PROD_DOMAIN)
  const safeProdUrl = useMemo(() => sanitizeShareUrl(payload.url), [payload.url]);

  useEffect(() => {
    if (!showQrCard) return;
    let active = true;
    QRCode.toString(safeProdUrl, {
      type: 'svg',
      margin: 1,
      width: 176,
      color: {
        dark: '#0B1117',
        light: '#FFFFFF',
      },
    })
      .then((svg) => {
        if (active) setQrSvg(svg);
      })
      .catch(() => {
        if (active) setQrSvg('');
      });
    return () => {
      active = false;
    };
  }, [safeProdUrl, showQrCard]);

  const recordChannelShare = async (channel: ShareChannel) => {
    trackShareEvent({
      channel,
      targetType: payload.kind,
      targetId: payload.targetId,
    }).catch(() => {});
    if (!rewardedOnce) {
      setRewardedOnce(true);
      addFanPoints(5, 'Shared from FUTFIELD');
    }
    onShared?.(channel);
  };

  const fullShareText = `${payload.title}\n${payload.text}\n${safeProdUrl}`;
  const cleanDigits = formatPhoneDigitsOnly(phoneInput);
  const smsHref = buildSmsHref(fullShareText, phoneInput);
  const smsContactsHref = buildSmsHref(fullShareText);
  const whatsappHref = buildWhatsAppHref(fullShareText, phoneInput);
  const telegramHref = buildTelegramHref(safeProdUrl, `${payload.title} — ${payload.text}`);
  const twitterHref = buildTwitterHref(safeProdUrl, `${payload.title} — ${payload.text}`);
  const facebookHref = buildFacebookHref(safeProdUrl);
  const emailHref = buildMailtoHref(payload.title, fullShareText);

  const handleCopy = async () => {
    haptics.success();
    const ok = await copyTextSafely(safeProdUrl);
    if (ok) {
      setCopied(true);
      setStatusFeedback('Production link copied to clipboard.');
      recordChannelShare('copy');
      addNotification({
        title: 'Link Copied',
        body: `${safeProdUrl} copied to clipboard.`,
        type: 'system',
      });
      setTimeout(() => setCopied(false), 2400);
    }
  };

  const handleNativeDeviceShare = async () => {
    haptics.light();
    setStatusFeedback(null);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: payload.title,
          text: payload.text,
          url: safeProdUrl,
        });
        recordChannelShare('native');
        setStatusFeedback('Shared via device share sheet!');
        addNotification({
          title: 'Shared Successfully',
          body: `Sent "${payload.title}" through your device share sheet.`,
          type: 'system',
        });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }
    const ok = await copyTextSafely(safeProdUrl);
    setStatusFeedback(
      ok
        ? 'Link copied! Pick WhatsApp, Messages, or any social app below.'
        : 'Pick WhatsApp, Messages, or any app below to share.'
    );
  };

  const handleShareToAppFeed = async () => {
    if (sharingToFeed || sharedToFeed) return;
    setSharingToFeed(true);
    haptics.success();
    try {
      const shareText = payload.text
        ? `${payload.title}\n${payload.text}\n${safeProdUrl}`
        : `${payload.title}\n${safeProdUrl}`;
      addPost({
        content: shareText,
        mediaType: payload.videoUrl ? 'video' : payload.previewImage ? 'image' : undefined,
        mediaUrl: payload.videoUrl || payload.previewImage || undefined,
        videoUrl: payload.videoUrl || undefined,
        imageUrl: !payload.videoUrl ? payload.previewImage || undefined : undefined,
        thumbnailUrl: payload.previewImage || undefined,
      });
      setSharedToFeed(true);
      setStatusFeedback('Posted to your FUTFIELD Home Feed!');
      recordChannelShare('native');
      addNotification({
        title: 'Shared to FUTFIELD Feed',
        body: `"${payload.title}" is now posted on your Home Feed.`,
        type: 'system',
      });
    } catch {
      setStatusFeedback('Could not post to your FUTFIELD Feed.');
    } finally {
      setSharingToFeed(false);
    }
  };

  const handleDownloadQr = () => {
    if (!qrSvg) return;
    haptics.light();
    try {
      const blob = new Blob([qrSvg], { type: 'image/svg+xml;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = 'futfield-share-qr.svg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      recordChannelShare('qr');
    } catch {}
  };

  return (
    <div className="space-y-3">
      {/* 1. Content Preview + Production Link Bar */}
      <div className="rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10 p-3.5 space-y-3 shadow-sm">
        <div className="flex items-center gap-3">
          {payload.previewImage ? (
            <img
              src={payload.previewImage}
              alt={payload.title}
              className="w-16 h-12 rounded-xl object-contain bg-black shrink-0 border border-slate-200 dark:border-white/10"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-[#00E676]/15 text-emerald-700 dark:text-[#00E676] flex items-center justify-center shrink-0">
              <Share2 className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-0.5">
            <h3 className="font-display font-black text-sm text-slate-900 dark:text-white line-clamp-1">
              {payload.title}
            </h3>
            <p className="text-[11px] text-slate-600 dark:text-white/65 line-clamp-2 leading-snug">
              {payload.text}
            </p>
          </div>
        </div>

        {/* One-Tap Copy Link */}
        <div className="flex items-center gap-2 p-1.5 pl-3 rounded-xl bg-slate-100 dark:bg-black/45 border border-slate-200 dark:border-white/10">
          <span className="text-[11px] font-mono text-emerald-700 dark:text-[#00E676] font-bold truncate flex-1 select-all">
            {safeProdUrl}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="min-h-[38px] px-3.5 rounded-lg bg-slate-900 dark:bg-[#00E676] text-white dark:text-black font-black text-xs flex items-center gap-1.5 shrink-0 active:scale-95 transition-transform"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Link'}</span>
          </button>
        </div>
      </div>

      {/* 2. Primary One-Tap Share Row */}
      <div className="grid grid-cols-2 gap-2">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => recordChannelShare('whatsapp')}
          className="min-h-[46px] px-3 rounded-2xl bg-[#25D366] hover:bg-[#1ebe5d] text-black font-black text-xs flex items-center justify-center gap-2 shadow-sm active:scale-98 transition-transform"
        >
          <MessageCircle className="w-4 h-4 stroke-[2.5]" />
          <span>WhatsApp</span>
        </a>

        <button
          type="button"
          onClick={handleNativeDeviceShare}
          className="min-h-[46px] px-3 rounded-2xl bg-[#00E676] hover:bg-[#00c864] text-black font-black text-xs flex items-center justify-center gap-2 shadow-sm active:scale-98 transition-transform"
        >
          <Smartphone className="w-4 h-4 stroke-[2.5]" />
          <span>{deviceCtx.supportsNativeShare ? 'Device Share' : 'Share Apps'}</span>
        </button>

        <button
          type="button"
          disabled={sharingToFeed}
          onClick={handleShareToAppFeed}
          className={`min-h-[44px] px-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-colors ${
            sharedToFeed
              ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-700 dark:text-[#00E676]'
              : 'bg-slate-900 dark:bg-white text-white dark:text-black hover:opacity-90'
          }`}
        >
          {sharedToFeed ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
          <span>{sharedToFeed ? 'Shared to Feed' : sharingToFeed ? 'Sharing...' : 'Share to Feed'}</span>
        </button>

        <a
          href={smsContactsHref}
          onClick={() => recordChannelShare('sms')}
          className="min-h-[44px] px-3 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10 hover:border-[#00E676] text-slate-900 dark:text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-colors"
        >
          <MessageSquare className="w-4 h-4 text-blue-500" />
          <span>Messages / SMS</span>
        </a>
      </div>

      {sharedToFeed && (
        <button
          type="button"
          onClick={() => {
            closeShareSheet();
            setActiveTab('home');
            scrollToTopInstant();
          }}
          className="w-full min-h-[38px] rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-[#00E676] text-xs font-extrabold"
        >
          View on Home Feed
        </button>
      )}

      {statusFeedback && (
        <p className="text-[11px] font-bold text-emerald-700 dark:text-[#00E676] bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-3 py-2 text-center">
          {statusFeedback}
        </p>
      )}

      {/* 3. Social & QR Strip */}
      <div className="rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10 p-3 space-y-2.5">
        <div className="grid grid-cols-5 gap-1.5">
          <a
            href={telegramHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => recordChannelShare('telegram')}
            className="min-h-[52px] p-1.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] hover:bg-sky-500/10 flex flex-col items-center justify-center gap-1 text-center"
          >
            <Send className="w-4 h-4 text-sky-500" />
            <span className="text-[10px] font-bold text-slate-800 dark:text-white">Telegram</span>
          </a>

          <a
            href={twitterHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => recordChannelShare('x')}
            className="min-h-[52px] p-1.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] hover:bg-slate-200 dark:hover:bg-white/10 flex flex-col items-center justify-center gap-1 text-center"
          >
            <ExternalLink className="w-4 h-4 text-slate-800 dark:text-white" />
            <span className="text-[10px] font-bold text-slate-800 dark:text-white">X</span>
          </a>

          <a
            href={facebookHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => recordChannelShare('facebook')}
            className="min-h-[52px] p-1.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] hover:bg-blue-500/10 flex flex-col items-center justify-center gap-1 text-center"
          >
            <Globe className="w-4 h-4 text-blue-600" />
            <span className="text-[10px] font-bold text-slate-800 dark:text-white">Facebook</span>
          </a>

          <a
            href={emailHref}
            onClick={() => recordChannelShare('email')}
            className="min-h-[52px] p-1.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] hover:bg-amber-500/10 flex flex-col items-center justify-center gap-1 text-center"
          >
            <Mail className="w-4 h-4 text-amber-500" />
            <span className="text-[10px] font-bold text-slate-800 dark:text-white">Email</span>
          </a>

          <button
            type="button"
            onClick={() => {
              haptics.light();
              setShowQrCard((v) => !v);
            }}
            className={`min-h-[52px] p-1.5 rounded-xl flex flex-col items-center justify-center gap-1 text-center transition-colors ${
              showQrCard
                ? 'bg-[#00E676]/20 text-emerald-700 dark:text-[#00E676]'
                : 'bg-slate-50 dark:bg-white/[0.04] text-slate-800 dark:text-white'
            }`}
          >
            <QrCode className="w-4 h-4 text-[#00E676]" />
            <span className="text-[10px] font-bold">QR Code</span>
          </button>
        </div>

        {/* Toggleable Phone Number Direct Send */}
        <button
          type="button"
          onClick={() => setShowPhoneBox((v) => !v)}
          className="w-full pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-white/80"
        >
          <span className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-[#00E676]" />
            <span>Send directly to a phone number</span>
          </span>
          {showPhoneBox ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showPhoneBox && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2">
              <input
                type="tel"
                inputMode="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="+234 800 000 0000..."
                className="flex-1 min-h-[40px] px-3 rounded-xl bg-slate-50 dark:bg-black/45 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-[#00E676]"
              />
              <a
                href={cleanDigits.length >= 6 ? smsHref : smsContactsHref}
                onClick={() => recordChannelShare('sms')}
                className="min-h-[40px] px-3 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center justify-center"
              >
                SMS
              </a>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => recordChannelShare('whatsapp')}
                className="min-h-[40px] px-3 rounded-xl bg-[#25D366] text-black font-black text-xs flex items-center justify-center"
              >
                WA
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Expandable QR Card */}
      {showQrCard && (
        <div className="rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10 p-3.5 flex items-center gap-3.5">
          <div
            className="w-24 h-24 rounded-xl bg-white p-1.5 border border-slate-200 shrink-0 flex items-center justify-center"
            dangerouslySetInnerHTML={qrSvg ? { __html: qrSvg } : undefined}
          >
            {!qrSvg ? <QrCode className="w-8 h-8 text-slate-400" /> : null}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-[11px] text-slate-600 dark:text-white/70 leading-snug">
              Scan with any phone camera to open on {PROD_DOMAIN.replace('https://', '')}.
            </p>
            <button
              type="button"
              onClick={handleDownloadQr}
              disabled={!qrSvg}
              className="min-h-[36px] px-3 rounded-xl bg-slate-100 dark:bg-white/10 text-xs font-bold text-slate-800 dark:text-white inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save QR</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const ShareFUTFIELD: React.FC = () => {
  const { user, videos, matches, goBack, addNotification } = useFootball();
  const [selectedPreset, setSelectedPreset] = useState<'app' | 'profile' | 'video' | 'scores'>('app');

  const latestVideo = videos[0];
  const featuredLiveMatch = matches.find((m) => m.status === 'LIVE') || matches[0];

  const userSlug = useMemo(() => {
    return user.handle
      ? user.handle.replace(/^@/, '')
      : user.name
      ? user.name.toLowerCase().replace(/[^a-z0-9]/g, '')
      : 'amos';
  }, [user.handle, user.name]);

  const activePayload: SharePayload = useMemo(() => {
    if (selectedPreset === 'profile') {
      const cleanHandle = (user.handle || '@fan').replace(/^@?/, '@');
      return {
        kind: 'profile',
        title: `${user.name} (${cleanHandle}) on FUTFIELD`,
        text: 'Follow me on FUTFIELD for matchday takes, Futfield Tube clips, and live scores!',
        url: buildUserInviteUrl(user),
        previewImage: user.avatar || `${PROD_DOMAIN}/futfield-logo.jpg`,
      };
    }
    if (selectedPreset === 'video' && latestVideo) {
      return {
        kind: 'video',
        targetId: latestVideo.id,
        title: latestVideo.title || 'Futfield Tube Highlight',
        text: `Watch "${latestVideo.title}" (${latestVideo.duration}) on Futfield Tube!`,
        url: buildVideoShareUrl(latestVideo.id),
        previewImage: latestVideo.thumbnailUrl || `${PROD_DOMAIN}/futfield-logo.jpg`,
        videoUrl: latestVideo.videoUrl,
      };
    }
    if (selectedPreset === 'scores' && featuredLiveMatch) {
      return {
        kind: 'match',
        targetId: featuredLiveMatch.id,
        title: `${featuredLiveMatch.homeTeam.name} vs ${featuredLiveMatch.awayTeam.name} · FUTFIELD`,
        text: `Follow live scores (${featuredLiveMatch.homeTeam.score}-${featuredLiveMatch.awayTeam.score}) & join stadium chat!`,
        url: buildMatchShareUrl(featuredLiveMatch.id),
        previewImage: `${PROD_DOMAIN}/futfield-logo.jpg`,
      };
    }

    return {
      kind: 'app',
      title: 'Join me on FUTFIELD',
      text: 'Watch match highlights, join live stadium rooms, and more!',
      url: `${PROD_DOMAIN}/join/${encodeURIComponent(userSlug)}`,
      previewImage: `${PROD_DOMAIN}/futfield-logo.jpg`,
    };
  }, [selectedPreset, user, latestVideo, featuredLiveMatch, userSlug]);

  const handleQuickInviteApp = async () => {
    haptics.light();
    const url = `${PROD_DOMAIN}/join/${encodeURIComponent(userSlug)}`;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Join me on FUTFIELD',
          text: 'Watch match highlights, join live stadium rooms, and more!',
          url,
        });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }
    await copyTextSafely(url);
    addNotification({
      title: 'Invite Link Copied',
      body: `Copied ${url}`,
      type: 'system',
    });
  };

  return (
    <div className="pb-24 max-w-2xl mx-auto px-3 sm:px-4 pt-3 space-y-3.5">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/10">
        <button
          type="button"
          onClick={() => {
            goBack();
            scrollToTopInstant();
          }}
          className="min-h-[44px] px-2.5 flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-white hover:text-emerald-700 dark:hover:text-[#00E676] rounded-xl transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <div className="text-right">
          <h1 className="font-display text-sm font-black text-slate-900 dark:text-white">
            Share FUTFIELD
          </h1>
          <p className="text-[10px] text-emerald-700 dark:text-[#00E676] font-bold">
            {PROD_DOMAIN.replace('https://', '')}
          </p>
        </div>
      </div>

      {/* Invite Banner */}
      <button
        type="button"
        onClick={handleQuickInviteApp}
        className="w-full min-h-[46px] px-4 rounded-2xl bg-[#00E676] hover:bg-[#00c864] text-black font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-[#00E676]/20"
      >
        <Share2 className="w-4 h-4 stroke-[2.5]" />
        <span>One-Tap Invite to FUTFIELD</span>
      </button>

      {/* What to Share Preset Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { id: 'app' as const, label: 'App Invite', icon: Smartphone },
          { id: 'profile' as const, label: 'My Squad Link', icon: User },
          { id: 'video' as const, label: 'Tube Clip', icon: Film, disabled: !latestVideo },
          { id: 'scores' as const, label: 'Match Room', icon: Trophy, disabled: !featuredLiveMatch },
        ].map((item) => {
          const Icon = item.icon;
          const active = selectedPreset === item.id;
          return (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                haptics.light();
                setSelectedPreset(item.id);
                scrollToTopInstant();
              }}
              className={`min-h-[42px] px-3 py-2 rounded-2xl border text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 ${
                active
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-black border-slate-900 dark:border-white shadow-sm'
                  : 'bg-white dark:bg-[#12171F] border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/80 hover:border-[#00E676]/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      <PhoneSharePanel payload={activePayload} />
    </div>
  );
};

export const SharePage: React.FC = () => {
  return <ShareFUTFIELD />;
};

export const PhoneShareModal: React.FC<{
  payload: SharePayload | null;
  onClose: () => void;
}> = ({ payload, onClose }) => {
  if (!payload) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[88vh] overflow-y-auto no-scrollbar rounded-t-3xl sm:rounded-3xl bg-[#F8FAFC] dark:bg-[#0D1117] border border-slate-200 dark:border-white/10 p-4 space-y-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#00E676]/15 text-emerald-700 dark:text-[#00E676] flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display font-black text-sm text-slate-900 dark:text-white">
                Share via FUTFIELD
              </h2>
              <p className="text-[10px] text-slate-500 dark:text-white/55">
                {PROD_DOMAIN.replace('https://', '')} · Instant Link &amp; Social Share
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share sheet"
            className="min-h-[40px] min-w-[40px] rounded-full bg-slate-200/70 dark:bg-white/10 text-slate-700 dark:text-white flex items-center justify-center hover:bg-slate-300/70 dark:hover:bg-white/20"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <PhoneSharePanel payload={payload} />
      </div>
    </div>
  );
};
