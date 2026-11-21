import { CANONICAL_DOMAIN } from './seo';

/**
 * Production domain constant strictly enforced across all share links, invites,
 * QR codes, SMS, WhatsApp, and copy buttons to prevent AI Studio dev URLs from leaking.
 */
export const PROD_DOMAIN = 'https://futfieldsport.com.ng';

export type ShareContentKind = 'app' | 'profile' | 'video' | 'post' | 'match' | 'blog';

export interface SharePayload {
  title: string;
  text: string;
  url: string;
  kind: ShareContentKind;
  targetId?: string;
  previewImage?: string;
  videoUrl?: string;
  metaLabel?: string;
}

export type ShareChannel =
  | 'native'
  | 'sms'
  | 'whatsapp'
  | 'telegram'
  | 'x'
  | 'facebook'
  | 'email'
  | 'qr'
  | 'copy';

export interface DevicePhoneContext {
  os: 'ios' | 'android' | 'desktop';
  isMobile: boolean;
  isWebView: boolean;
  supportsNativeShare: boolean;
  label: string;
}

export function detectDevicePhoneContext(): DevicePhoneContext {
  if (typeof navigator === 'undefined') {
    return {
      os: 'desktop',
      isMobile: false,
      isWebView: false,
      supportsNativeShare: false,
      label: 'Phone & Web Share Ready',
    };
  }
  const ua = navigator.userAgent || '';
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isMobile = isIos || isAndroid || /Mobile|Tablet/i.test(ua);
  const isWebView = /wv|FBAN|FBAV|Instagram|Line\/|Twitter|MicroMessenger/i.test(ua);
  const supportsNativeShare = typeof navigator.share === 'function';

  return {
    os: isIos ? 'ios' : isAndroid ? 'android' : 'desktop',
    isMobile,
    isWebView,
    supportsNativeShare,
    label: isIos
      ? 'Connected to your iPhone Share & Messages'
      : isAndroid
      ? 'Connected to your Android Phone & Apps'
      : 'Phone Link · QR Scan & SMS Connect Ready',
  };
}

/**
 * Detect environment and return the safe public production origin:
 * If running on ais-dev, localhost, run.app, aistudio, or webcontainer,
 * it returns PROD_DOMAIN ("https://futfieldsport.com.ng").
 */
export function getShareOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname.toLowerCase();
    if (
      host.includes('ais-dev') ||
      host.includes('localhost') ||
      host.includes('127.0.0.1') ||
      host.includes('run.app') ||
      host.includes('aistudio') ||
      host.includes('webcontainer')
    ) {
      return PROD_DOMAIN;
    }
    return window.location.origin;
  }
  return PROD_DOMAIN;
}

export function sanitizeShareUrl(rawUrl?: string): string {
  if (!rawUrl || !String(rawUrl).trim()) return PROD_DOMAIN;
  const trimmed = String(rawUrl).trim();
  if (
    trimmed.includes('ais-dev') ||
    trimmed.includes('run.app') ||
    trimmed.includes('localhost') ||
    trimmed.includes('127.0.0.1') ||
    trimmed.includes('aistudio') ||
    trimmed.includes('webcontainer') ||
    trimmed.includes('futfieldsports.com.ng') ||
    trimmed.includes('futfield.com') ||
    trimmed.includes('fitfield.com')
  ) {
    try {
      const parsed = new URL(trimmed);
      return `${PROD_DOMAIN}${parsed.pathname}${parsed.search}`;
    } catch {
      return PROD_DOMAIN;
    }
  }
  return trimmed.startsWith('http') ? trimmed : `${PROD_DOMAIN}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
}

/**
 * Build a production-grade shareable URL using environment detection.
 * Dev URLs are strictly converted to PROD_DOMAIN.
 */
export function buildShareUrl(path: string = '/'): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const origin = getShareOrigin();
  return sanitizeShareUrl(`${origin}${cleanPath}`);
}

/**
 * Build user invite / referral link:
 * e.g. https://futfieldsport.com.ng/join?code=amos
 */
export function buildUserInviteUrl(user?: { id?: string; handle?: string; name?: string } | null): string {
  if (!user) return `${PROD_DOMAIN}/join`;
  const rawCode = user.handle
    ? user.handle.replace(/^@/, '')
    : user.name
    ? user.name.toLowerCase().replace(/[^a-z0-9]/g, '')
    : '';
  if (rawCode) {
    return `${PROD_DOMAIN}/join?code=${encodeURIComponent(rawCode)}`;
  }
  const ref = user.id ? user.id.slice(0, 6) : 'app';
  return `${PROD_DOMAIN}/invite?ref=${encodeURIComponent(ref)}`;
}

/**
 * Build latest video / reel share URL:
 * https://futfieldsport.com.ng/videos/${videoId}
 */
export function buildVideoShareUrl(videoId: string): string {
  return `${PROD_DOMAIN}/videos/${encodeURIComponent(videoId)}`;
}

/**
 * Build live match share URL:
 * https://futfieldsport.com.ng/live/${matchId}
 */
export function buildMatchShareUrl(matchId: string): string {
  return `${PROD_DOMAIN}/live/${encodeURIComponent(matchId)}`;
}

/**
 * Copy text safely across restricted WebViews, sandboxed iframes, and iOS/Android browsers.
 */
export async function copyTextSafely(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to textarea fallback
  }

  try {
    if (typeof document !== 'undefined') {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      ta.style.left = '-9999px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    }
  } catch {
    return false;
  }
  return false;
}

export function formatPhoneForUri(rawPhone: string): string {
  const trimmed = String(rawPhone || '').trim();
  if (!trimmed) return '';
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  return hasPlus ? `+${digits}` : digits;
}

export function formatPhoneDigitsOnly(rawPhone: string): string {
  return String(rawPhone || '').replace(/\D/g, '');
}

/**
 * iOS uses `sms:number&body=...` whereas Android/standard uses `sms:number?body=...`.
 */
export function buildSmsHref(messageBody: string, phoneNumber?: string): string {
  const cleanPhone = formatPhoneForUri(phoneNumber || '');
  const encodedBody = encodeURIComponent(messageBody);
  const ctx = detectDevicePhoneContext();
  if (ctx.os === 'ios') {
    return cleanPhone ? `sms:${cleanPhone}&body=${encodedBody}` : `sms:&body=${encodedBody}`;
  }
  return cleanPhone ? `sms:${cleanPhone}?body=${encodedBody}` : `sms:?body=${encodedBody}`;
}

export function buildWhatsAppHref(messageBody: string, phoneNumber?: string): string {
  const digits = formatPhoneDigitsOnly(phoneNumber || '');
  const encoded = encodeURIComponent(messageBody);
  return digits ? `https://wa.me/${digits}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

export function buildTelegramHref(url: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

export function buildTwitterHref(url: string, text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

export function buildFacebookHref(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

export function buildMailtoHref(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export async function trackShareEvent(params: {
  channel: ShareChannel;
  targetType?: ShareContentKind;
  targetId?: string;
}): Promise<{ success: boolean; shares?: number }> {
  try {
    const res = await fetch('/api/share/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {}
  return { success: false };
}

export async function downloadVideoFile(params: {
  id?: string;
  title?: string;
  videoUrl: string;
}): Promise<{ success: boolean; filename?: string; sizeBytes?: number; error?: string }> {
  const safeBase =
    String(params.title || 'futfield_video')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64) || 'futfield_video';

  const candidates: string[] = [];
  if (params.id && !params.videoUrl.startsWith('blob:') && !params.videoUrl.startsWith('data:')) {
    candidates.push(`/api/db/videos/${encodeURIComponent(params.id)}/download`);
  }
  if (params.videoUrl && !params.videoUrl.startsWith('blob:') && !params.videoUrl.startsWith('data:')) {
    candidates.push(
      `/api/db/media/download?url=${encodeURIComponent(params.videoUrl)}&title=${encodeURIComponent(safeBase)}`
    );
  }
  if (params.videoUrl) {
    candidates.push(params.videoUrl);
  }

  let lastErr = 'Video file could not be downloaded.';
  for (const endpoint of candidates) {
    try {
      const res = await fetch(endpoint);
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        if (errJson?.error) lastErr = errJson.error;
        continue;
      }
      const blob = await res.blob();
      if (!blob || blob.size === 0) {
        lastErr = 'Downloaded video file is empty.';
        continue;
      }
      const type = blob.type || res.headers.get('content-type') || 'video/mp4';
      const ext = type.includes('webm') ? '.webm' : type.includes('quicktime') ? '.mov' : '.mp4';
      const filename = `${safeBase}${ext}`;
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
      return { success: true, filename, sizeBytes: blob.size };
    } catch (err: any) {
      lastErr = err?.message || lastErr;
    }
  }

  return { success: false, error: lastErr };
}
