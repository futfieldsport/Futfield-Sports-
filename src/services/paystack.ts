import PaystackPop from '@paystack/inline-js';

/**
 * FUTFIELD Paystack Worldwide Subscription Gateway
 * Single payment processor settling worldwide international cards, bank transfers, and USSD across 3 tiers.
 */

export interface UserCountryData {
  country_code: string;
  country_name: string;
  currency: string;
  city?: string;
}

export interface BackendGeoPlan {
  id: 'pro' | 'vip' | 'season';
  name: string;
  days: number;
  usdPrice: number;
  usdFormatted: string;
  effectiveMonthlyUsd: number;
  localCurrency: string;
  localAmount: number;
  localFormatted: string;
  exchangeRate: number;
}

export interface BackendGeoPricingResponse {
  success: boolean;
  country_code: string;
  country_name: string;
  city?: string;
  currency: string;
  exchange_rate: number;
  stagnant_usd_base: {
    pro: number;
    vip: number;
    season: number;
    lowestMonthlyUsd: number;
  };
  paystack_direct_currency: string;
  rates: Record<string, number>;
  plans: BackendGeoPlan[];
}

export const PENDING_PAYSTACK_TX_KEY = 'futfield_pending_paystack_tx';

let cachedCountry: UserCountryData | null = null;
let cachedGeoPricing: BackendGeoPricingResponse | null = null;

/**
 * Format any stagnant USD amount dynamically into the visitor's local currency.
 */
export function formatLocalPriceFromUsd(
  usdAmount: number,
  currencyCode: string,
  rate = 1
): string {
  const code = String(currencyCode || 'USD').toUpperCase();
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
  const converted = code === 'USD' ? usdAmount : usdAmount * safeRate;
  const isWhole = ['NGN', 'KES', 'TZS', 'UGX', 'RWF', 'JPY', 'KRW', 'IDR', 'XOF', 'XAF'].includes(code);
  const rounded = isWhole ? Math.round(converted) : +converted.toFixed(2);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: isWhole ? 0 : 2,
      minimumFractionDigits: isWhole ? 0 : 2,
    }).format(rounded);
  } catch {
    return `${code} ${rounded.toLocaleString('en-US')}`;
  }
}

/**
 * Fetch free backend IP geolocation + live USD exchange rate pricing.
 * Keeps base USD rates stagnant ($12 / $25 / $36) while adapting local currency display.
 */
export async function fetchBackendGeoPricing(
  currencyOverride?: string
): Promise<BackendGeoPricingResponse> {
  if (!currencyOverride && cachedGeoPricing) return cachedGeoPricing;

  try {
    const q = currencyOverride ? `?currency=${encodeURIComponent(currencyOverride)}` : '';
    const res = await fetch(`/api/geo/ip-pricing${q}`, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data: BackendGeoPricingResponse = await res.json();
      if (data?.success && data.currency) {
        if (!currencyOverride) {
          cachedGeoPricing = data;
          cachedCountry = {
            country_code: (data.country_code || 'NG').toUpperCase(),
            country_name: data.country_name || 'Nigeria',
            currency: data.currency,
            city: data.city,
          };
        }
        return data;
      }
    }
  } catch (err) {
    console.warn('[Paystack GeoIP Backend] Geo-pricing notice, using fallback:', err);
  }

  return {
    success: true,
    country_code: 'NG',
    country_name: 'Nigeria',
    currency: 'NGN',
    exchange_rate: 1600,
    stagnant_usd_base: { pro: 12, vip: 25, season: 36, lowestMonthlyUsd: 7.2 },
    paystack_direct_currency: 'NGN',
    rates: { USD: 1, NGN: 1600, GBP: 0.79, EUR: 0.92, GHS: 15.2, KES: 129, ZAR: 18.2 },
    plans: [],
  };
}

/**
 * Detect user country via backend IP geolocation tool
 */
export async function getUserCountry(): Promise<UserCountryData> {
  if (cachedCountry) return cachedCountry;

  try {
    const geo = await fetchBackendGeoPricing();
    if (geo?.country_code) {
      cachedCountry = {
        country_code: geo.country_code.toUpperCase(),
        country_name: geo.country_name || 'Nigeria',
        currency: geo.currency || (geo.country_code === 'NG' ? 'NGN' : 'USD'),
        city: geo.city,
      };
      return cachedCountry;
    }
  } catch {}

  try {
    const res = await fetch('/api/ip-country', {
      headers: { Accept: 'application/json' },
    });

    if (res.ok) {
      const data = await res.json();
      cachedCountry = {
        country_code: (data.country_code || 'NG').toUpperCase(),
        country_name: data.country_name || 'Nigeria',
        currency: data.currency || (data.country_code === 'NG' ? 'NGN' : 'USD'),
        city: data.city,
      };
      return cachedCountry;
    }
  } catch (err) {
    console.warn('[Paystack GeoIP Backend] IP lookup notice, defaulting to Nigeria (NG):', err);
  }

  cachedCountry = {
    country_code: 'NG',
    country_name: 'Nigeria',
    currency: 'NGN',
  };
  return cachedCountry;
}

export interface SubscriptionPricingPlan {
  id: 'pro' | 'vip' | 'season';
  name: string;
  badge: string;
  billingInterval: string;
  effectiveMonthlyUsd: number;
  ngnPrice: number;
  usdPrice: number;
  ngnFormatted: string;
  usdFormatted: string;
  tagline: string;
  description: string;
  allowanceUpgrades: {
    posts: string;
    videos: string;
    chats: string;
  };
  features: string[];
  savings?: string;
  highlight?: boolean;
  badgeColor?: string;
}

export const FREE_TIER_ALLOWANCE_SUMMARY = {
  name: 'Free Fan Starter',
  usdPrice: 0,
  limits: [
    { label: 'Posts & Photos', value: '3 / day' },
    { label: '9:16 Quick Kicks', value: '1 / day' },
    { label: 'Live Match Room Chats', value: '5 msgs / day' },
  ],
};

export const PRO_SUBSCRIPTION_PLANS: SubscriptionPricingPlan[] = [
  {
    id: 'pro',
    name: 'Matchday Pro Pass',
    badge: '1 MONTH PASS',
    billingInterval: '1 month',
    effectiveMonthlyUsd: 12,
    ngnPrice: 19200,
    usdPrice: 12,
    ngnFormatted: '₦19,200',
    usdFormatted: '$12',
    tagline: 'Remove all daily free-tier limits for 30 days',
    description: 'Lift the 3 posts/day, 1 clip/day & 5 chat/day caps immediately with priority feeds.',
    allowanceUpgrades: {
      posts: 'Unlimited Posts & HD Photos (vs 3/day Free)',
      videos: 'Unlimited Futfield Tube & Quick Kicks (vs 1/day Free)',
      chats: 'Unlimited Live Match Room Chat (vs 5/day Free)',
    },
    features: [
      'Unlimited Posts & Matchday Image Uploads (Free: 3/day)',
      'Unlimited 9:16 Quick Kicks & Videos with Sound (Free: 1/day)',
      'Exclusive Offline Video & Clip Downloads (Pro Users Only)',
      'Unlimited Live Match Room Messages & Reactions (Free: 5/day)',
      'Instant Futfield PitchIQ Tactical Summaries + +500 FP',
    ],
  },
  {
    id: 'vip',
    name: 'Club VIP Ultra Pass',
    badge: '3 MONTHS PASS · $8.33/MO',
    billingInterval: '3 months',
    effectiveMonthlyUsd: 8.33,
    ngnPrice: 40000,
    usdPrice: 25,
    ngnFormatted: '₦40,000',
    usdFormatted: '$25',
    savings: 'Save ~31%',
    highlight: true,
    badgeColor: 'amber',
    tagline: 'Most Popular · 90 days unlimited access + Golden Verified Badge',
    description: 'Unlimited daily posts, clips & match chats plus FanZone custom thumbnails & VIP perks.',
    allowanceUpgrades: {
      posts: 'Unlimited Posts + Priority Top Placement',
      videos: 'Unlimited 1080p HD Clips + Custom Thumbnails',
      chats: 'Unlimited VIP Match Chat + Golden Name Highlight',
    },
    features: [
      'Unlimited Posts, Futfield Tube Clips & Match Chats for 90 Days',
      'FUTFIELD Verified Golden Checkmark on Profile & Takes',
      'Unlimited Custom Video Thumbnails in FanZone Studio',
      'Priority Creator Studio Analytics & Live Match Alerts',
      '+2,000 Fan Points Instant Boost ($8.33/mo effective rate)',
    ],
  },
  {
    id: 'season',
    name: 'Championship Season Pass',
    badge: '5 MONTHS PASS · $7.20/MO',
    billingInterval: '5 months',
    effectiveMonthlyUsd: 7.2,
    ngnPrice: 57600,
    usdPrice: 36,
    ngnFormatted: '₦57,600',
    usdFormatted: '$36',
    savings: 'Save 40% (Best Value)',
    tagline: 'Lowest cost per month · 150 days unlimited creator & matchday access',
    description: 'Full 5-month unlimited access to every post, Futfield Tube clip, match room, and VIP trophy badge.',
    allowanceUpgrades: {
      posts: 'Unlimited Posts + Live Matchday Poll Authoring',
      videos: 'Unlimited Ultra HD Clips + Zero Ads',
      chats: 'Unlimited Chats + VIP Room Pinning Privileges',
    },
    features: [
      'Full 150-Day Unlimited Posts, Futfield Tube Clips & Match Rooms',
      'Lowest Monthly Rate ($7.20/mo · Save 40% vs 1-Month Pass)',
      'Exclusive Golden Trophy Icon + VIP Room Pinning',
      'Direct Access to Author Matchday Live Polls',
      '+5,000 Fan Points Instant Championship Bonus',
    ],
  },
];

export async function getExchangeRates(): Promise<Record<string, number>> {
  try {
    const res = await fetch('/api/exchange-rates');
    const data = await res.json();
    if (data?.rates) return data.rates;
  } catch {}
  return { NGN: 1600, USD: 1 };
}

export async function checkPaystackKeyStatus(): Promise<{
  active: boolean;
  configured?: boolean;
  message: string;
  hasPublicKey?: boolean;
  publicKey?: string;
  mode?: 'live' | 'test' | 'unconfigured';
}> {
  try {
    const res = await fetch('/api/paystack/status');
    if (!res.ok) {
      return { active: false, message: 'Paystack status check unavailable.' };
    }
    return await res.json();
  } catch {
    return { active: false, message: 'Unable to reach Paystack verification server.' };
  }
}

export interface StartSubscriptionOptions {
  email: string;
  userId: string;
  country: string;
  preferredCurrency?: string;
  planType: 'pro' | 'vip' | 'season';
  checkoutMode?: 'popup' | 'redirect';
  onSuccess: (data: { reference: string; planType: string; expiresAt: string; bonusPoints?: number; currency?: string; amount?: number }) => void;
  onFailed?: (errorMsg: string) => void;
  onClose?: () => void;
}

function savePendingPaystackTx(payload: {
  reference: string;
  planType: string;
  userId: string;
  email: string;
}) {
  try {
    localStorage.setItem(
      PENDING_PAYSTACK_TX_KEY,
      JSON.stringify({ ...payload, createdAt: Date.now() })
    );
  } catch {}
}

export function clearPendingPaystackTx() {
  try {
    localStorage.removeItem(PENDING_PAYSTACK_TX_KEY);
  } catch {}
}

/**
 * Initializes Paystack on the server and resumes the exact transaction via Paystack V2 Inline JS
 * (`resumeTransaction(access_code)`), avoiding duplicate reference errors and falling back to hosted checkout if needed.
 */
export async function startPaystackSubscription(options: StartSubscriptionOptions): Promise<void> {
  const {
    email,
    userId,
    country,
    preferredCurrency,
    planType,
    checkoutMode = 'popup',
    onSuccess,
    onFailed,
    onClose,
  } = options;

  try {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error('Please enter a valid billing email address for your Paystack receipt.');
    }

    const initRes = await fetch('/api/paystack/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        user_id: userId,
        country,
        preferred_currency: preferredCurrency,
        plan_type: planType,
        callback_url: `${window.location.origin}/payment/callback`,
      }),
    });

    const initData = await initRes.json().catch(() => ({}));
    if (!initRes.ok || !initData.success) {
      throw new Error(initData.error || 'Failed to initialize Paystack checkout session');
    }

    const { reference, access_code, authorization_url } = initData;
    if (reference) {
      savePendingPaystackTx({ reference, planType, userId, email: cleanEmail });
    }

    // Direct hosted checkout redirect when explicitly chosen or when access_code/public key unavailable
    const publicKey = String(
      (import.meta as any).env?.VITE_PAYSTACK_PUBLIC_KEY || initData.publicKey || ''
    ).trim();

    if (checkoutMode === 'popup' && access_code && publicKey.startsWith('pk_')) {
      try {
        const popup = new PaystackPop();
        let finished = false;
        let fallbackTriggered = false;

        // Safety timeout: if Paystack iframe is blocked or fails to load, redirect cleanly to hosted checkout
        const loadFallbackTimer = window.setTimeout(() => {
          if (!finished && !fallbackTriggered && authorization_url) {
            fallbackTriggered = true;
            window.location.assign(authorization_url);
          }
        }, 12000);

        popup.resumeTransaction(access_code, {
          onLoad: () => {
            window.clearTimeout(loadFallbackTimer);
          },
          onSuccess: (transaction: any) => {
            finished = true;
            window.clearTimeout(loadFallbackTimer);
            const verifiedRef = transaction?.reference || reference;
            verifyAndActivatePro(verifiedRef, planType, userId, onSuccess, onFailed).catch((err) => {
              if (onFailed) onFailed(err?.message || 'Payment verification failed');
            });
          },
          onCancel: () => {
            finished = true;
            window.clearTimeout(loadFallbackTimer);
            if (onClose) onClose();
          },
          onError: (err: any) => {
            window.clearTimeout(loadFallbackTimer);
            console.warn('[Paystack Inline Popup Error, falling back to hosted checkout]:', err?.message || err);
            if (!finished && !fallbackTriggered && authorization_url) {
              fallbackTriggered = true;
              window.location.assign(authorization_url);
            } else if (onFailed) {
              onFailed(err?.message || 'Unable to load Paystack checkout popup.');
            }
          },
        });
        return;
      } catch (popupErr: any) {
        console.warn('[Paystack Inline Init Fallback]:', popupErr?.message);
      }
    }

    if (authorization_url && !String(authorization_url).includes('undefined')) {
      window.location.assign(authorization_url);
      return;
    }

    throw new Error('Paystack checkout session could not be opened. Check server payment configuration.');
  } catch (err: any) {
    console.error('[Paystack Subscription Error]:', err);
    if (onFailed) onFailed(err.message || 'Payment initialization failed. Please try again.');
  }
}

/**
 * Verify Paystack transaction on the backend and trigger Pro activation
 */
export async function verifyAndActivatePro(
  reference: string,
  planType: string,
  userId: string,
  onSuccess: (data: {
    reference: string;
    planType: string;
    expiresAt: string;
    bonusPoints?: number;
    currency?: string;
    amount?: number;
  }) => void,
  onFailed?: (errorMsg: string) => void
): Promise<boolean> {
  try {
    const cleanRef = String(reference || '').trim();
    if (!cleanRef) {
      if (onFailed) onFailed('Please provide a valid Paystack transaction reference.');
      return false;
    }

    const res = await fetch(`/api/paystack/verify/${encodeURIComponent(cleanRef)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference: cleanRef, plan_type: planType, user_id: userId }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      clearPendingPaystackTx();
      onSuccess({
        reference: data.reference || cleanRef,
        planType: data.data?.plan_type || planType,
        expiresAt: data.data?.expires_at || new Date(Date.now() + 30 * 86400000).toISOString(),
        bonusPoints: typeof data.data?.bonus_points === 'number' ? data.data.bonus_points : undefined,
        currency: data.data?.currency,
        amount: data.data?.amount,
      });
      return true;
    }

    if (onFailed) onFailed(data.error || 'Paystack transaction could not be verified.');
    return false;
  } catch (err: any) {
    console.error('[Paystack Verification Error]:', err);
    if (onFailed) onFailed(err?.message || 'Network error while verifying Paystack payment.');
    return false;
  }
}

/**
 * Cancel recurring subscription
 */
export async function cancelProSubscription(
  userId: string,
  subscriptionCode?: string,
  email?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/paystack/cancel-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        subscription_code: subscriptionCode,
        email,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        message: data?.error || data?.message || 'Unable to cancel subscription right now.',
      };
    }
    return data;
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Network error cancelling subscription.',
    };
  }
}
