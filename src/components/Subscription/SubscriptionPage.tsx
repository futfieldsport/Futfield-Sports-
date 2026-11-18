import React, { useState, useEffect } from 'react';
import {
  Crown,
  Check,
  CreditCard,
  Globe,
  AlertCircle,
  RefreshCw,
  Building2,
  Lock,
  ArrowRight,
  CheckCircle2,
  Calendar,
  Zap,
  Layers,
  Video,
  MessageSquare,
  Mail,
  ExternalLink,
  ShieldCheck,
  Receipt,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useFootball } from '../../context/FootballContext';
import {
  fetchBackendGeoPricing,
  formatLocalPriceFromUsd,
  UserCountryData,
  FREE_TIER_ALLOWANCE_SUMMARY,
  PRO_SUBSCRIPTION_PLANS,
  startPaystackSubscription,
  verifyAndActivatePro,
  cancelProSubscription,
  checkPaystackKeyStatus,
} from '../../services/paystack';
import { haptics } from '../../utils/haptics';
import { getDailyUsageCounts } from '../../utils/dailyLimits';

interface SubscriptionPageProps {
  onClose?: () => void;
  embedded?: boolean;
}

export const SubscriptionPage: React.FC<SubscriptionPageProps> = ({
  onClose,
  embedded = false,
}) => {
  const { user, updateUser, addNotification } = useFootball();

  const [countryData, setCountryData] = useState<UserCountryData>({
    country_code: 'NG',
    country_name: 'Nigeria',
    currency: 'NGN',
  });
  const [detectedLocalCurrency, setDetectedLocalCurrency] = useState<string>('NGN');
  const [preferredCurrency, setPreferredCurrency] = useState<string>('NGN');
  const [billingEmail, setBillingEmail] = useState<string>(user.email || 'futfieldsport@gmail.com');
  const [loadingCountry, setLoadingCountry] = useState(true);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({ NGN: 1600, USD: 1 });
  const [paystackStatus, setPaystackStatus] = useState<{
    active: boolean;
    message: string;
    mode?: 'live' | 'test' | 'unconfigured';
  } | null>(null);
  const [selectedTier, setSelectedTier] = useState<'pro' | 'vip' | 'season'>('vip');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showVerifyRefBox, setShowVerifyRefBox] = useState(false);
  const [manualRef, setManualRef] = useState('');
  const [isVerifyingManual, setIsVerifyingManual] = useState(false);

  const isPro = Boolean(user.isPro || user.membershipTier === 'pro' || user.membershipTier === 'vip');
  const [dailyUsage, setDailyUsage] = useState(() => getDailyUsageCounts(user.id));

  useEffect(() => {
    if (user.email && user.email !== billingEmail) {
      setBillingEmail(user.email);
    }
  }, [user.email]);

  useEffect(() => {
    const sync = () => setDailyUsage(getDailyUsageCounts(user.id));
    sync();
    window.addEventListener('futfield:daily-limit-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('futfield:daily-limit-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, [user.id]);

  // Detect user country via free backend IP lookup + live FX while keeping USD fixed
  useEffect(() => {
    let mounted = true;
    fetchBackendGeoPricing().then((geo) => {
      if (!mounted) return;
      const cur = (geo.currency || 'NGN').toUpperCase();
      setCountryData({
        country_code: (geo.country_code || 'NG').toUpperCase(),
        country_name: geo.country_name || 'Nigeria',
        currency: cur,
        city: geo.city,
      });
      setDetectedLocalCurrency(cur);
      setPreferredCurrency(cur);
      if (geo.rates) setExchangeRates(geo.rates);
      setLoadingCountry(false);
    });
    checkPaystackKeyStatus().then((status) => {
      if (mounted) setPaystackStatus(status);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const getLocalCurrencyPrice = (usdPrice: number, targetCurrency: string) => {
    const code = (targetCurrency || 'USD').toUpperCase();
    const rate = Number(exchangeRates[code] || (code === 'NGN' ? 1600 : 1));
    return formatLocalPriceFromUsd(usdPrice, code, rate);
  };

  const formatPlanPrice = (plan: typeof PRO_SUBSCRIPTION_PLANS[0]) => {
    return getLocalCurrencyPrice(plan.usdPrice, preferredCurrency);
  };

  const applyUnlockedUpgrade = (params: {
    reference: string;
    planType: 'pro' | 'vip' | 'season';
    expiresAt: string;
    bonusPoints?: number;
  }) => {
    const { reference, planType, expiresAt, bonusPoints } = params;
    haptics.success();

    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#00E676', '#3b82f6', '#f59e0b', '#ec4899', '#ffffff'],
    });

    const bonusFp =
      typeof bonusPoints === 'number'
        ? bonusPoints
        : planType === 'season'
        ? 5000
        : planType === 'vip'
        ? 2000
        : 500;

    setSuccessMessage('You are now Pro - Worldwide');

    updateUser({
      email: billingEmail.trim() || user.email,
      isPro: true,
      membershipTier: planType === 'vip' || planType === 'season' ? 'vip' : 'pro',
      proPlan: planType,
      proExpiresAt: expiresAt,
      country: preferredCurrency === 'NGN' ? 'NG' : countryData.country_code,
      paystackReference: reference,
      lastPaymentCurrency: preferredCurrency,
      fanPoints: (user.fanPoints || 0) + bonusFp,
      weeklyPoints: (user.weeklyPoints || 0) + bonusFp,
    });

    addNotification({
      title: 'You are now Pro - Worldwide 🏆',
      body: `Paystack transaction confirmed (${reference}). +${bonusFp} Fan Points & unlimited access unlocked!`,
      type: 'system',
    });
    addNotification({
      title: 'Payment Receipt Sent 📬',
      body: `Receipt dispatched to ${billingEmail.trim() || 'your email'} by Paystack.`,
      type: 'system',
    });
  };

  const handleSubscribe = async (
    planType: 'pro' | 'vip' | 'season',
    checkoutMode: 'popup' | 'redirect' = 'popup'
  ) => {
    haptics.medium();
    setSelectedTier(planType);
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = billingEmail.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address above so Paystack can send your receipt.');
      return;
    }

    setIsProcessing(true);

    await startPaystackSubscription({
      email: cleanEmail,
      userId: user.id || 'user_guest',
      country: preferredCurrency === 'NGN' ? 'NG' : countryData.country_code || 'US',
      preferredCurrency,
      planType,
      checkoutMode,
      onSuccess: ({ reference, planType: verifiedPlan, expiresAt, bonusPoints }) => {
        setIsProcessing(false);
        const resolvedTier = (verifiedPlan || planType) as 'pro' | 'vip' | 'season';
        applyUnlockedUpgrade({ reference, planType: resolvedTier, expiresAt, bonusPoints });
      },
      onFailed: (errText) => {
        setIsProcessing(false);
        haptics.light();
        setErrorMessage(errText || 'Payment was not completed. Please retry.');
      },
      onClose: () => {
        setIsProcessing(false);
      },
    });
  };

  const handleVerifyManualReference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualRef.trim()) return;
    setIsVerifyingManual(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    await verifyAndActivatePro(
      manualRef.trim(),
      selectedTier,
      user.id || 'user_guest',
      ({ reference, planType, expiresAt, bonusPoints }) => {
        setIsVerifyingManual(false);
        setShowVerifyRefBox(false);
        setManualRef('');
        applyUnlockedUpgrade({
          reference,
          planType: (planType || selectedTier) as 'pro' | 'vip' | 'season',
          expiresAt,
          bonusPoints,
        });
      },
      (errText) => {
        setIsVerifyingManual(false);
        setErrorMessage(errText || 'Could not confirm this Paystack reference yet.');
      }
    );
  };

  const handleCancelPro = async () => {
    haptics.medium();
    setIsCancelling(true);

    try {
      const res = await cancelProSubscription(
        user.id,
        user.paystackSubscriptionCode,
        user.email || billingEmail
      );

      setIsCancelling(false);
      setShowCancelModal(false);

      if (!res.success) {
        setErrorMessage(res.message || 'Could not cancel subscription right now.');
        return;
      }

      haptics.success();

      updateUser({
        isPro: false,
        membershipTier: 'free',
        proPlan: undefined,
      });

      addNotification({
        title: 'Subscription Cancelled',
        body: res.message || 'Your Pro subscription has been disabled.',
        type: 'system',
      });
    } catch {
      setIsCancelling(false);
      setShowCancelModal(false);
    }
  };

  return (
    <div className={`space-y-5 text-slate-900 dark:text-white max-w-2xl mx-auto ${embedded ? '' : 'pb-24'}`}>
      {/* Header Banner */}
      <div className="text-center space-y-2.5 pt-1">
        <div className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-[#00E676] text-xs font-extrabold uppercase tracking-wider">
          <Crown className="w-3.5 h-3.5 fill-current" />
          <span>Futfield Unlimited Passes · Paystack</span>
        </div>

        <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          Unlock Unlimited Matchday Access
        </h1>

        <p className="text-xs text-slate-600 dark:text-white/65 max-w-md mx-auto leading-relaxed tabular-nums">
          Remove Free Tier caps ({FREE_TIER_ALLOWANCE_SUMMARY.limits.map(l => `${l.value} ${l.label}`).join(' · ')}) from $7.20/mo via Paystack.
        </p>

        {/* Live Gateway + GeoIP Region Row */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-0.5 text-[11px] font-medium text-slate-600 dark:text-white/70">
          <span className="inline-flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-emerald-700 dark:text-[#00E676]" />
            {loadingCountry ? (
              <span className="flex items-center gap-1 text-slate-500">
                <RefreshCw className="w-3 h-3 animate-spin" /> Detecting region...
              </span>
            ) : (
              <span className="tabular-nums">
                Detected: <strong className="text-emerald-700 dark:text-[#00E676]">{countryData.city ? `${countryData.city}, ` : ''}{countryData.country_name} ({countryData.country_code}) · {detectedLocalCurrency}</strong>
              </span>
            )}
          </span>
          {paystackStatus?.active && (
            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-[#00E676] font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              Paystack {paystackStatus.mode === 'test' ? 'Test' : 'Live'} Gateway Ready
            </span>
          )}
        </div>
      </div>

      {/* Free Tier Allowances vs Unlimited Comparison Card */}
      {!isPro && (
        <div className="p-4 sm:p-5 rounded-3xl bg-slate-50 dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">
                Your Current Plan: {FREE_TIER_ALLOWANCE_SUMMARY.name} ($0)
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-white/60">
                Upgrade any pass below to unlock Unlimited features automatically via Paystack
              </p>
            </div>
            <Zap className="w-4 h-4 text-emerald-700 dark:text-[#00E676] shrink-0" />
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2.5 rounded-2xl bg-white dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/8 space-y-1">
              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-white/60">
                <Layers className="w-3 h-3 text-emerald-700 dark:text-[#00E676]" />
                <span>Posts</span>
              </div>
              <div className="font-mono tabular-nums font-black text-slate-900 dark:text-white text-[11px]">
                {dailyUsage.posts}/{dailyUsage.limits.post} Free
              </div>
              <div className="text-[10px] font-bold text-emerald-700 dark:text-[#00E676]">Pro: Unlimited</div>
            </div>

            <div className="p-2.5 rounded-2xl bg-white dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/8 space-y-1">
              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-white/60">
                <Video className="w-3 h-3 text-blue-500" />
                <span>Quick Kicks</span>
              </div>
              <div className="font-mono tabular-nums font-black text-slate-900 dark:text-white text-[11px]">
                {dailyUsage.videos}/{dailyUsage.limits.video} Free
              </div>
              <div className="text-[10px] font-bold text-emerald-700 dark:text-[#00E676]">Pro: Unlimited</div>
            </div>

            <div className="p-2.5 rounded-2xl bg-white dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/8 space-y-1">
              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-white/60">
                <MessageSquare className="w-3 h-3 text-amber-500" />
                <span>Room Chat</span>
              </div>
              <div className="font-mono tabular-nums font-black text-slate-900 dark:text-white text-[11px]">
                {dailyUsage.chats}/{dailyUsage.limits.chat} Free
              </div>
              <div className="text-[10px] font-bold text-emerald-700 dark:text-[#00E676]">Pro: Unlimited</div>
            </div>
          </div>
        </div>
      )}

      {/* Paystack Key Configuration Notice when server key is missing */}
      {paystackStatus && !paystackStatus.active && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs">
          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <span className="font-bold text-amber-700 dark:text-amber-400 block">
              Paystack Live Checkout Status
            </span>
            <span className="text-slate-600 dark:text-white/75 leading-relaxed block">
              {paystackStatus.message}
            </span>
          </div>
        </div>
      )}

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="p-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/40 dark:border-[#00E676] flex items-center gap-3 animate-in fade-in">
          <div className="w-9 h-9 rounded-2xl bg-[#00E676] text-black flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div className="flex-1">
            <h4 className="font-display font-black text-sm text-slate-900 dark:text-white">
              {successMessage}
            </h4>
            <p className="text-xs text-slate-600 dark:text-white/75">
              Your account now has full verified Pro status, priority feeds, and unlimited HD streams.
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-[#00E676] text-black text-xs font-black shrink-0"
            >
              Done
            </button>
          )}
        </div>
      )}

      {/* Error Retry Banner */}
      {errorMessage && (
        <div className="p-4 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-start justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-rose-600 dark:text-rose-400 block">Payment Notice</span>
              <span className="text-slate-600 dark:text-white/75">{errorMessage}</span>
            </div>
          </div>
          <button
            onClick={() => handleSubscribe(selectedTier)}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-rose-500 text-white font-bold text-xs shrink-0 hover:bg-rose-600"
          >
            Retry
          </button>
        </div>
      )}

      {/* Active Pro Status Card (with Cancel Pro flow & Receipt Reference) */}
      {isPro ? (
        <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-950/60 via-[#12171F] to-black border border-[#00E676]/60 shadow-xl space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-[#00E676] text-black flex items-center justify-center font-black shrink-0">
                <Crown className="w-5 h-5 fill-black" />
              </div>
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-[#00E676]">
                  Active Pro Member
                </span>
                <h3 className="font-display text-base font-black text-white">
                  {user.proPlan === 'season'
                    ? 'Championship Season Pass (5 Months)'
                    : user.proPlan === 'vip'
                    ? 'Club VIP Ultra Pass (3 Months)'
                    : 'Matchday Pro Pass (1 Month)'}
                </h3>
              </div>
            </div>

            <span className="text-[11px] font-black uppercase text-[#00E676] whitespace-nowrap">
              Pro Worldwide
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs pt-1">
            <div className="p-3 rounded-2xl bg-white/[0.05] border border-white/8">
              <span className="text-[11px] text-white/55 block">Renews / Expiry</span>
              <span className="font-bold text-white flex items-center gap-1.5 mt-0.5 tabular-nums">
                <Calendar className="w-3.5 h-3.5 text-[#00E676]" />
                {user.proExpiresAt
                  ? new Date(user.proExpiresAt).toLocaleDateString()
                  : 'Active 30 days'}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.05] border border-white/8">
              <span className="text-[11px] text-white/55 block">Payment Gateway</span>
              <span className="font-bold text-white flex items-center gap-1.5 mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-[#00E676]" />
                Paystack Secure Gateway
              </span>
            </div>
          </div>

          {user.paystackReference && (
            <div className="p-2.5 rounded-2xl bg-white/[0.04] border border-white/8 flex items-center justify-between text-[11px] font-mono text-white/75">
              <span className="flex items-center gap-1.5 truncate">
                <Receipt className="w-3.5 h-3.5 text-[#00E676] shrink-0" />
                <span className="truncate">Ref: {user.paystackReference}</span>
              </span>
              <span className="text-[#00E676] font-bold shrink-0">VERIFIED</span>
            </div>
          )}

          {/* Cancel Pro Button */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
            <span className="text-[11px] text-white/60">
              Manage your subscription anytime without penalties.
            </span>
            <button
              onClick={() => setShowCancelModal(true)}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-rose-500/20 text-white/85 hover:text-rose-400 border border-white/10 hover:border-rose-500/30 text-xs font-bold transition-colors whitespace-nowrap"
            >
              Cancel Pro
            </button>
          </div>
        </div>
      ) : (
        /* Subscription Pricing Selection Cards (3 Distinct Tiers) */
        <div className="space-y-4">
          {/* Billing Email + Currency Selector Card */}
          <div className="p-4 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 space-y-3 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label
                htmlFor="paystack-billing-email"
                className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5 text-emerald-700 dark:text-[#00E676]" />
                <span>Billing &amp; Paystack Receipt Email</span>
              </label>

              {/* Dynamic IP Local Currency vs Stagnant USD Switcher */}
              <div className="inline-flex flex-wrap p-0.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[11px] font-bold self-start sm:self-auto gap-0.5">
                {detectedLocalCurrency !== 'USD' && (
                  <button
                    type="button"
                    onClick={() => setPreferredCurrency(detectedLocalCurrency)}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      preferredCurrency === detectedLocalCurrency
                        ? 'bg-[#00E676] text-black shadow-sm'
                        : 'text-slate-600 dark:text-white/65'
                    }`}
                  >
                    📍 {detectedLocalCurrency}
                  </button>
                )}
                {detectedLocalCurrency !== 'NGN' && (
                  <button
                    type="button"
                    onClick={() => setPreferredCurrency('NGN')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      preferredCurrency === 'NGN'
                        ? 'bg-[#00E676] text-black shadow-sm'
                        : 'text-slate-600 dark:text-white/65'
                    }`}
                  >
                    🇳🇬 NGN
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPreferredCurrency('USD')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    preferredCurrency === 'USD'
                      ? 'bg-[#00E676] text-black shadow-sm'
                      : 'text-slate-600 dark:text-white/65'
                  }`}
                >
                  💵 USD ($) Fixed
                </button>
              </div>
            </div>

            <input
              id="paystack-billing-email"
              type="email"
              value={billingEmail}
              onChange={(e) => setBillingEmail(e.target.value)}
              placeholder="Enter email for Paystack receipt (e.g. you@gmail.com)"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#00E676]"
            />
          </div>

          <div className="text-center space-y-1">
            <h3 className="font-display text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Choose Your Futfield Access Pass
            </h3>
            <p className="text-xs text-slate-500 dark:text-white/60">
              Instant worldwide card, bank transfer, &amp; USSD checkout via Paystack ({preferredCurrency}).
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {PRO_SUBSCRIPTION_PLANS.map((plan) => {
              const isSelected = selectedTier === plan.id;
              return (
                <div
                  key={plan.id}
                  onClick={() => {
                    haptics.light();
                    setSelectedTier(plan.id);
                  }}
                  className={`p-5 rounded-3xl cursor-pointer transition-all relative overflow-hidden border ${
                    isSelected
                      ? 'bg-white dark:bg-[#12171F] border-emerald-600 dark:border-[#00E676] shadow-xl ring-2 ring-[#00E676]/20'
                      : 'bg-white dark:bg-[#12171F] border-slate-200/90 dark:border-white/8 hover:border-emerald-500/50 dark:hover:border-[#00E676]/50'
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute top-0 right-0 bg-[#00E676] text-black text-[10px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                      Most Popular
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-black uppercase text-emerald-700 dark:text-[#00E676]">
                        {plan.badge}
                      </span>

                      <div className="text-xs font-bold text-slate-500 dark:text-white/60 tabular-nums">
                        USD Base: ${plan.usdPrice} (Fixed)
                      </div>
                    </div>

                    <div>
                      <h4 className="font-display text-base font-black text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
                        <span>{plan.name}</span>
                        {plan.savings && (
                          <span className="text-[11px] font-sans text-amber-600 dark:text-amber-400 font-extrabold">
                            · {plan.savings}
                          </span>
                        )}
                      </h4>
                      <p className="text-xs font-semibold text-slate-700 dark:text-white/80 mt-0.5">
                        {plan.tagline}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-white/60 mt-0.5">
                        {plan.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-baseline gap-2 pt-2 border-t border-slate-100 dark:border-white/8">
                      <span className="text-2xl font-black font-mono tabular-nums tracking-tight text-slate-900 dark:text-white">
                        {formatPlanPrice(plan)}
                      </span>
                      <span className="text-xs font-bold text-slate-500 dark:text-white/55 tabular-nums">
                        {preferredCurrency === 'USD'
                          ? `Fixed $${plan.usdPrice} USD · ≈ ${getLocalCurrencyPrice(plan.usdPrice, detectedLocalCurrency === 'USD' ? 'NGN' : detectedLocalCurrency)} / ${plan.billingInterval}`
                          : `Stagnant $${plan.usdPrice} USD Base / ${plan.billingInterval}`}
                      </span>
                    </div>

                    {/* Free Tier Allowance Upgrade Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/8 text-[11px] tabular-nums">
                      <div className="font-semibold text-slate-700 dark:text-white/85">
                        <span className="text-emerald-700 dark:text-[#00E676] font-extrabold">Posts:</span> {plan.allowanceUpgrades.posts}
                      </div>
                      <div className="font-semibold text-slate-700 dark:text-white/85">
                        <span className="text-emerald-700 dark:text-[#00E676] font-extrabold">Reels:</span> {plan.allowanceUpgrades.videos}
                      </div>
                      <div className="font-semibold text-slate-700 dark:text-white/85">
                        <span className="text-emerald-700 dark:text-[#00E676] font-extrabold">Chats:</span> {plan.allowanceUpgrades.chats}
                      </div>
                    </div>

                    <ul className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-white/8">
                      {plan.features.slice(0, 5).map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-slate-700 dark:text-white/80">
                          <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-[#00E676] shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="space-y-2 pt-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSubscribe(plan.id, 'popup');
                        }}
                        disabled={isProcessing}
                        className={`w-full min-h-[46px] py-3 rounded-2xl font-black text-xs shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 ${
                          plan.highlight
                            ? 'bg-[#00E676] hover:bg-[#00c864] text-black shadow-[#00E676]/20'
                            : 'bg-slate-900 dark:bg-white text-white dark:text-black hover:opacity-90'
                        }`}
                      >
                        {isProcessing && selectedTier === plan.id ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Opening Paystack Checkout...</span>
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-4 h-4" />
                            <span className="tabular-nums">
                              Pay {formatPlanPrice(plan)} (${plan.usdPrice} USD) via Paystack
                            </span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSubscribe(plan.id, 'redirect');
                        }}
                        disabled={isProcessing}
                        className="w-full py-1.5 text-[11px] font-bold text-slate-500 dark:text-white/55 hover:text-emerald-700 dark:hover:text-[#00E676] flex items-center justify-center gap-1 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Or continue on hosted Paystack checkout page</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Verify Existing Paystack Payment Reference */}
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => setShowVerifyRefBox(prev => !prev)}
              className="text-xs font-bold text-emerald-700 dark:text-[#00E676] hover:underline"
            >
              {showVerifyRefBox ? 'Hide transaction verifier' : 'Already paid via Transfer / USSD? Verify Reference'}
            </button>

            {showVerifyRefBox && (
              <form
                onSubmit={handleVerifyManualReference}
                className="mt-2.5 p-3.5 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={manualRef}
                  onChange={(e) => setManualRef(e.target.value)}
                  placeholder="Paste Paystack reference (e.g. futfield_ng_pro_...)"
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00E676]"
                />
                <button
                  type="submit"
                  disabled={isVerifyingManual || !manualRef.trim()}
                  className="px-4 py-2 rounded-xl bg-[#00E676] text-black text-xs font-black disabled:opacity-50 shrink-0"
                >
                  {isVerifyingManual ? 'Checking...' : 'Verify'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Paystack Worldwide Settlement Guarantee Card */}
      <div className="p-4 rounded-3xl bg-slate-100 dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 space-y-2.5 text-center">
        <div className="flex items-center justify-center gap-2 text-emerald-700 dark:text-[#00E676]">
          <Building2 className="w-4 h-4" />
          <span className="font-display text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
            Secure Paystack Worldwide Gateway
          </span>
        </div>
        <p className="text-[11px] text-slate-600 dark:text-white/65 max-w-sm mx-auto leading-relaxed">
          All cards &amp; local methods worldwide (Visa, Mastercard, Verve, Bank Transfer, USSD, Apple Pay) accepted securely via Paystack with instant server-side verification and automated unlock.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-white/50 pt-1">
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-emerald-700 dark:text-[#00E676]" /> 256-bit PCI-DSS Level 1
          </span>
          <span aria-hidden="true">·</span>
          <span>Live Server Verification</span>
          <span aria-hidden="true">·</span>
          <span>Instant Activation</span>
        </div>
      </div>

      {/* Cancel Pro Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200 dark:border-white/10 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-black text-slate-900 dark:text-white">
                Cancel Futfield Pro?
              </h3>
              <button
                onClick={() => setShowCancelModal(false)}
                className="min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-white/75 leading-relaxed">
              Are you sure you want to cancel your Pro membership? You will retain access until the end of your current billing period, after which renewal will stop.
            </p>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white text-xs font-bold"
              >
                Keep Pro
              </button>
              <button
                onClick={handleCancelPro}
                disabled={isCancelling}
                className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {isCancelling ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
