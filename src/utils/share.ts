import { CANONICAL_DOMAIN } from './seo';

export type ShareContentKind = 'app' | 'profile' | 'video' | 'post' | 'match' | 'blog';

export interface SharePayload {
  title: string;
  text: string;
  url: string;
  kind: ShareContentKind;
  targetId?: string;
  previewImage?: string;
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
 * Build a phone-openable live URL using the current active origin (so preview links open on phones),
 * falling back to CANONICAL_DOMAIN when unavailable.
 */
export function buildShareUrl(path: string = '/'): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${cleanPath}`;
  }
  return `${CANONICAL_DOMAIN}${cleanPath}`;
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
