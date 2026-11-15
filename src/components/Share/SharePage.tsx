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
} from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { haptics } from '../../utils/haptics';
import {
  SharePayload,
  ShareChannel,
  buildShareUrl,
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
  const { addNotification, addFanPoints } = useFootball();
  const [phoneInput, setPhoneInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [nativeNotice, setNativeNotice] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState<string>('');
  const [rewardedOnce, setRewardedOnce] = useState(false);

  const deviceCtx = useMemo(() => detectDevicePhoneContext(), []);

  useEffect(() => {
    let active = true;
    QRCode.toString(payload.url, {
      type: 'svg',
      margin: 1,
      width: 176,
      color: {
        dark: '#0B1117',
        light: '#FFFFFF',
      },
    })
      .then(svg => {
        if (active) setQrSvg(svg);
      })
      .catch(() => {
        if (active) setQrSvg('');
      });
    return () => {
      active = false;
    };
  }, [payload.url]);

  const recordChannelShare = async (channel: ShareChannel) => {
    trackShareEvent({
      channel,
      targetType: payload.kind,
      targetId: payload.targetId,
    }).catch(() => {});
    if (!rewardedOnce) {
      setRewardedOnce(true);
      addFanPoints(5, 'Shared via Phone');
    }
    onShared?.(channel);
  };

  const fullShareText = `${payload.title} — ${payload.text}\n${payload.url}`;
  const cleanDigits = formatPhoneDigitsOnly(phoneInput);
  const smsHref = buildSmsHref(fullShareText, phoneInput);
  const smsContactsHref = buildSmsHref(fullShareText);
  const whatsappHref = buildWhatsAppHref(fullShareText, phoneInput);
  const telegramHref = buildTelegramHref(payload.url, `${payload.title} — ${payload.text}`);
  const twitterHref = buildTwitterHref(payload.url, `${payload.title} — ${payload.text}`);
  const facebookHref = buildFacebookHref(payload.url);
  const emailHref = buildMailtoHref(payload.title, fullShareText);

  const handleCopy = async () => {
    haptics.success();
    const ok = await copyTextSafely(payload.url);
    if (ok) {
      setCopied(true);
      recordChannelShare('copy');
      addNotification({
        title: 'Link Copied for Phone Share',
        body: 'Paste into WhatsApp, Messages, iMessage, or any chat app.',
        type: 'system',
      });
      setTimeout(() => setCopied(false), 2400);
    }
  };

  const handleNativePhoneShare = async () => {
    haptics.light();
    setNativeNotice(null);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: payload.title,
          text: payload.text,
          url: payload.url,
        });
        recordChannelShare('native');
        addNotification({
          title: 'Shared to Phone App',
          body: 'Sent directly through your device share sheet.',
          type: 'system',
        });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        // WebView / iframe permission fallback
      }
    }
    const ok = await copyTextSafely(payload.url);
    setNativeNotice(
      ok
        ? 'Device sheet unavailable in this browser frame — link copied automatically. Use SMS, WhatsApp, or QR below.'
        : 'Use SMS, WhatsApp, Telegram, or the QR code below to send directly to any phone.'
    );
  };

  const handleDownloadQr = () => {
    if (!qrSvg) return;
    haptics.light();
    try {
      const blob = new Blob([qrSvg], { type: 'image/svg+xml;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `futfield-share-qr.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      recordChannelShare('qr');
    } catch {}
  };

  return (
    <div className="space-y-3.5">
      {/* Device Connection Card & Preview */}
      <div className="rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/10 p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-3">
          {payload.previewImage ? (
            <img
              src={payload.previewImage}
              alt={payload.title}
              className="w-14 h-14 rounded-2xl object-cover shrink-0 border border-slate-200 dark:border-white/10"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-700 dark:text-[#00E676] flex items-center justify-center shrink-0">
              <Smartphone className="w-7 h-7" />
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-[11px] font-bold text-emerald-700 dark:text-[#00E676] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00E676] inline-block" />
              <span>{deviceCtx.label}</span>
            </p>
            <h3 className="font-display font-black text-sm text-slate-900 dark:text-white line-clamp-1">
              {payload.title}
            </h3>
            <p className="text-[11px] text-slate-600 dark:text-white/65 line-clamp-2 leading-snug">
              {payload.text}
            </p>
          </div>
        </div>

        {/* One-Tap Copy URL Bar */}
        <div className="flex items-center gap-2 p-1.5 pl-3 rounded-2xl bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10">
          <span className="text-[11px] font-mono text-slate-700 dark:text-white/80 truncate flex-1 select-all">
            {payload.url}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="min-h-[40px] px-3.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black font-extrabold text-xs flex items-center gap-1.5 shrink-0 active:scale-95 transition-transform"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#00E676]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        {/* Primary Native Mobile OS Share Trigger */}
        <button
          type="button"
          onClick={handleNativePhoneShare}
          className="w-full min-h-[48px] rounded-2xl bg-[#00E676] hover:bg-[#00c864] text-black font-black text-sm shadow-lg shadow-[#00E676]/20 flex items-center justify-center gap-2 active:scale-[0.99] transition-all"
        >
          <Share2 className="w-4 h-4 stroke-[2.5]" />
          <span>Share via Phone Contacts &amp; Apps</span>
        </button>

        {nativeNotice && (
          <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2 leading-snug">
            {nativeNotice}
          </p>
        )}
      </div>

      {/* Send Directly to a User's Phone Number */}
      <div className="rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/10 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="font-display font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-[#00E676]" />
              <span>Send Direct to Any Phone Number</span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-white/55">
              Enter a friend&apos;s number or pick directly from your phone&apos;s SMS contacts
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="tel"
              inputMode="tel"
              value={phoneInput}
              onChange={e => setPhoneInput(e.target.value)}
              placeholder="+234 800 000 0000 or +44 / +1..."
              className="flex-1 min-h-[44px] px-3.5 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#00E676]"
            />
            {phoneInput && (
              <button
                type="button"
                onClick={() => setPhoneInput('')}
                className="min-h-[44px] min-w-[44px] rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-500 flex items-center justify-center"
                aria-label="Clear phone number"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-white/65">
            <span className="font-semibold">Quick prefix:</span>
            {['+234', '+44', '+1', '+34', '+254'].map(code => (
              <button
                key={code}
                type="button"
                onClick={() => {
                  haptics.light();
                  setPhoneInput(prev => (prev.startsWith('+') ? prev : `${code}${prev.replace(/^0+/, '')}`));
                }}
                className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-emerald-500/15 hover:text-emerald-700 dark:hover:text-[#00E676] font-mono font-bold transition-colors"
              >
                {code}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <a
            href={cleanDigits.length >= 6 ? smsHref : smsContactsHref}
            onClick={() => recordChannelShare('sms')}
            className="min-h-[46px] px-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
          >
            <MessageSquare className="w-4 h-4" />
            <span>{cleanDigits.length >= 6 ? 'Text This Number' : 'Open SMS Contacts'}</span>
          </a>

          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => recordChannelShare('whatsapp')}
            className="min-h-[46px] px-3 rounded-2xl bg-[#25D366] hover:bg-[#1ebe5d] text-black font-extrabold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
          >
            <MessageCircle className="w-4 h-4" />
            <span>{cleanDigits.length >= 6 ? 'WhatsApp Number' : 'WhatsApp Chats'}</span>
          </a>
        </div>
      </div>

      {/* Connected Phone Messaging & Social Launchers */}
      <div className="rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/10 p-4 shadow-sm space-y-2.5">
        <h4 className="font-display font-extrabold text-xs text-slate-900 dark:text-white">
          Installed Phone Apps
        </h4>
        <div className="grid grid-cols-3 gap-2">
          <a
            href={smsContactsHref}
            onClick={() => recordChannelShare('sms')}
            className="min-h-[56px] p-2.5 rounded-2xl bg-slate-50 dark:bg-white/[0.04] hover:bg-blue-500/10 border border-slate-200/80 dark:border-white/10 flex flex-col items-center justify-center gap-1 text-center transition-colors"
          >
            <MessageSquare className="w-4 h-4 text-blue-500" />
            <span className="text-[11px] font-bold text-slate-800 dark:text-white">Messages</span>
          </a>

          <a
            href={buildWhatsAppHref(fullShareText)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => recordChannelShare('whatsapp')}
            className="min-h-[56px] p-2.5 rounded-2xl bg-slate-50 dark:bg-white/[0.04] hover:bg-emerald-500/10 border border-slate-200/80 dark:border-white/10 flex flex-col items-center justify-center gap-1 text-center transition-colors"
          >
            <MessageCircle className="w-4 h-4 text-[#25D366]" />
            <span className="text-[11px] font-bold text-slate-800 dark:text-white">WhatsApp</span>
          </a>

          <a
            href={telegramHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => recordChannelShare('telegram')}
            className="min-h-[56px] p-2.5 rounded-2xl bg-slate-50 dark:bg-white/[0.04] hover:bg-sky-500/10 border border-slate-200/80 dark:border-white/10 flex flex-col items-center justify-center gap-1 text-center transition-colors"
          >
            <Send className="w-4 h-4 text-sky-500" />
            <span className="text-[11px] font-bold text-slate-800 dark:text-white">Telegram</span>
          </a>

          <a
            href={twitterHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => recordChannelShare('x')}
            className="min-h-[56px] p-2.5 rounded-2xl bg-slate-50 dark:bg-white/[0.04] hover:bg-slate-200/70 dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/10 flex flex-col items-center justify-center gap-1 text-center transition-colors"
          >
            <ExternalLink className="w-4 h-4 text-slate-800 dark:text-white" />
            <span className="text-[11px] font-bold text-slate-800 dark:text-white">Post on X</span>
          </a>

          <a
            href={facebookHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => recordChannelShare('facebook')}
            className="min-h-[56px] p-2.5 rounded-2xl bg-slate-50 dark:bg-white/[0.04] hover:bg-blue-500/10 border border-slate-200/80 dark:border-white/10 flex flex-col items-center justify-center gap-1 text-center transition-colors"
          >
            <Globe className="w-4 h-4 text-blue-600" />
            <span className="text-[11px] font-bold text-slate-800 dark:text-white">Facebook</span>
          </a>

          <a
            href={emailHref}
            onClick={() => recordChannelShare('email')}
            className="min-h-[56px] p-2.5 rounded-2xl bg-slate-50 dark:bg-white/[0.04] hover:bg-amber-500/10 border border-slate-200/80 dark:border-white/10 flex flex-col items-center justify-center gap-1 text-center transition-colors"
          >
            <Mail className="w-4 h-4 text-amber-500" />
            <span className="text-[11px] font-bold text-slate-800 dark:text-white">Email</span>
          </a>
        </div>
      </div>

      {/* Phone-to-Phone Camera QR Code Scanner Card */}
      <div className="rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/10 p-4 shadow-sm flex items-center gap-4">
        <div
          className="w-28 h-28 rounded-2xl bg-white p-2 border border-slate-200 shrink-0 flex items-center justify-center shadow-inner"
          aria-label="Scan QR code with another phone camera"
          dangerouslySetInnerHTML={qrSvg ? { __html: qrSvg } : undefined}
        >
          {!qrSvg ? <QrCode className="w-10 h-10 text-slate-400" /> : null}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h4 className="font-display font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-[#00E676]" />
              <span>Scan With Any Phone</span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-white/60 leading-snug mt-0.5">
              Point any iPhone or Android camera here to open this exact FUTFIELD page instantly.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadQr}
            disabled={!qrSvg}
            className="min-h-[38px] px-3 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-xs font-bold text-slate-800 dark:text-white inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Save QR Code</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const SharePage: React.FC = () => {
  const { user, videos, matches, goBack } = useFootball();
  const [selectedPreset, setSelectedPreset] = useState<'app' | 'profile' | 'video' | 'scores'>('app');

  const latestVideo = videos[0];
  const featuredLiveMatch = matches.find(m => m.status === 'LIVE') || matches[0];

  const activePayload: SharePayload = useMemo(() => {
    if (selectedPreset === 'profile') {
      const cleanHandle = (user.handle || '@futfield').replace(/^@?/, '@');
      return {
        kind: 'profile',
        title: `${user.name} (${cleanHandle}) on FUTFIELD`,
        text: `Follow me on FUTFIELD for matchday takes, PitchReels highlights, and live scores!`,
        url: buildShareUrl(`/profile/${encodeURIComponent(cleanHandle)}`),
        previewImage: user.avatar,
      };
    }
    if (selectedPreset === 'video' && latestVideo) {
      return {
        kind: 'video',
        targetId: latestVideo.id,
        title: latestVideo.title || 'FUTFIELD PitchReels Highlight',
        text: `Watch "${latestVideo.title}" (${latestVideo.duration}) on FUTFIELD PitchReels!`,
        url: buildShareUrl('/highlights'),
        previewImage: latestVideo.thumbnailUrl,
      };
    }
    if (selectedPreset === 'scores' && featuredLiveMatch) {
      return {
        kind: 'match',
        targetId: featuredLiveMatch.id,
        title: `${featuredLiveMatch.homeTeam.name} vs ${featuredLiveMatch.awayTeam.name} · FUTFIELD`,
        text: `Follow live scores (${featuredLiveMatch.homeTeam.score}-${featuredLiveMatch.awayTeam.score}) & join fan match chat!`,
        url: buildShareUrl(`/match/${encodeURIComponent(featuredLiveMatch.id)}`),
      };
    }
    return {
      kind: 'app',
      title: 'FUTFIELD — Live Football Scores, PitchReels & Match Chat',
      text: 'Join me on FUTFIELD! Watch match highlights, join live stadium rooms, and connect with football fans worldwide.',
      url: buildShareUrl('/'),
      previewImage: '/og-image.jpg',
    };
  }, [selectedPreset, user, latestVideo, featuredLiveMatch]);

  return (
    <div className="pb-24 max-w-2xl mx-auto px-3 sm:px-4 pt-3 space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/10">
        <button
          type="button"
          onClick={goBack}
          className="min-h-[44px] px-2.5 flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-white hover:text-emerald-700 dark:hover:text-[#00E676] rounded-xl transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <div className="text-right">
          <h1 className="font-display text-sm font-black text-slate-900 dark:text-white">
            Share FUTFIELD to Phone
          </h1>
          <p className="text-[10px] text-slate-500 dark:text-white/55">
            SMS · WhatsApp · Contacts · Camera QR
          </p>
        </div>
      </div>

      {/* What to Share Preset Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { id: 'app' as const, label: 'Invite to App', icon: Smartphone },
          { id: 'profile' as const, label: 'My Profile', icon: User },
          { id: 'video' as const, label: 'Latest Video', icon: Film, disabled: !latestVideo },
          { id: 'scores' as const, label: 'Live Match', icon: Trophy, disabled: !featuredLiveMatch },
        ].map(item => {
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
              }}
              className={`min-h-[44px] px-3 py-2 rounded-2xl border text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 ${
                active
                  ? 'bg-[#00E676] border-[#00E676] text-black shadow-sm'
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

export const PhoneShareModal: React.FC<{
  payload: SharePayload | null;
  onClose: () => void;
}> = ({ payload, onClose }) => {
  if (!payload) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[88vh] overflow-y-auto no-scrollbar rounded-t-3xl sm:rounded-3xl bg-[#F8FAFC] dark:bg-[#0D1117] border border-slate-200 dark:border-white/10 p-4 space-y-3 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#00E676]/15 text-emerald-700 dark:text-[#00E676] flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display font-black text-sm text-slate-900 dark:text-white">
                Send to Phone
              </h2>
              <p className="text-[10px] text-slate-500 dark:text-white/55">
                Contacts · SMS · WhatsApp · QR Code
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share sheet"
            className="min-h-[44px] min-w-[44px] rounded-full bg-slate-200/70 dark:bg-white/10 text-slate-700 dark:text-white flex items-center justify-center hover:bg-slate-300/70 dark:hover:bg-white/20"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <PhoneSharePanel payload={payload} />
      </div>
    </div>
  );
};
