import React from 'react';
import { FootballProvider, useFootball } from './context/FootballContext';
import { TopBar } from './components/Navigation/TopBar';
import { BottomTabBar } from './components/Navigation/BottomTabBar';
import { HomeTab } from './components/Home/HomeTab';
import { ScoresTab } from './components/Scores/ScoresTab';
import { VideosTab } from './components/Videos/VideosTab';
import { CommunitiesTab } from './components/Communities/CommunitiesTab';
import { MenuTab } from './components/Menu/MenuTab';
import { ProfileTab } from './components/Profile/ProfileTab';
import { FutfieldStudioTab } from './components/Studio/FutfieldStudioTab';
import { MatchRoomModal } from './components/MatchRoom/MatchRoomModal';
import { SearchModal } from './components/Modals/SearchModal';
import { AuthModal } from './components/Auth/AuthModal';
import { AppSplashIntro } from './components/Welcome/AppSplashIntro';
import { CinematicIntro } from './components/Welcome/CinematicIntro';
import { WelcomePage } from './components/Welcome/WelcomePage';
import { ClubSelectionPage } from './components/Welcome/ClubSelectionPage';
import { InAppNotificationToast } from './components/Notifications/InAppNotificationToast';
import { SettingsPage } from './components/Settings/SettingsPage';
import { NotificationsModal } from './components/Notifications/NotificationsModal';
import { CreatorProfileModal } from './components/Profile/CreatorProfileModal';
import { MonetizationModal } from './components/Monetization/MonetizationModal';
import { PricingPage } from './components/Pricing/PricingPage';
import { SupportLegalHub } from './components/Support/SupportLegalHub';
import { BlogPage } from './components/Blog/BlogPage';
import { FanReviewsPage } from './components/Reviews/FanReviewsPage';
import { SharePage, PhoneShareModal } from './components/Share/SharePage';
import { formatTodayShort } from './utils/dateFormat';
import confetti from 'canvas-confetti';
import {
  Wifi,
  BatteryMedium,
  MessageSquare,
  TrendingUp,
  Database,
  Smartphone,
  Monitor,
  Flame,
  Award,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

const AppContent: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    activeMatchRoom,
    closeMatchRoom,
    authModalOpen,
    setAuthModalOpen,
    searchModalOpen,
    setSearchModalOpen,
    mobileFrameMode,
    setMobileFrameMode,
    matches,
    posts,
    user,
    updateUser,
    addNotification,
    openMatchRoom,
    clubTheme,
    showIntro,
    setShowIntro,
    showWelcome,
    setShowWelcome,
    showClubSelection,
    setShowClubSelection,
    notificationsModalOpen,
    setNotificationsModalOpen,
    showSplash,
    setShowSplash,
    selectedCreatorForProfile,
    closeCreatorProfile,
    monetizationModalOpen,
    setMonetizationModalOpen,
    pricingModalOpen,
    setPricingModalOpen,
    openSupportLegalPage,
    shareModalPayload,
    closeShareSheet,
  } = useFootball();

  const todayShort = formatTodayShort();

  // Paystack /payment/callback listener & modal state
  const [callbackState, setCallbackState] = React.useState<{
    verifying: boolean;
    success: boolean;
    error: string | null;
    reference: string | null;
  } | null>(null);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const urlRef = urlParams.get('reference') || urlParams.get('trxref');
    const isCallbackPath = window.location.pathname.includes('/payment/callback') || Boolean(urlRef);

    let pendingRef: string | null = null;
    try {
      const rawPending = localStorage.getItem('futfield_pending_paystack_tx');
      if (rawPending) {
        const parsedPending = JSON.parse(rawPending);
        if (
          parsedPending?.reference &&
          parsedPending?.createdAt &&
          Date.now() - parsedPending.createdAt < 20 * 60 * 1000
        ) {
          pendingRef = String(parsedPending.reference);
        } else {
          localStorage.removeItem('futfield_pending_paystack_tx');
        }
      }
    } catch {}

    const ref = urlRef || pendingRef;
    const isExplicitReturn = Boolean(urlRef && isCallbackPath);

    if (ref) {
      let resolvedUserId = user.id;
      let existingFanPoints = user.fanPoints || 0;
      let existingWeeklyPoints = user.weeklyPoints || 0;
      try {
        const savedRaw = localStorage.getItem('futfield_user');
        if (savedRaw) {
          const parsed = JSON.parse(savedRaw);
          if (parsed?.id) resolvedUserId = parsed.id;
          if (typeof parsed?.fanPoints === 'number') existingFanPoints = parsed.fanPoints;
          if (typeof parsed?.weeklyPoints === 'number') existingWeeklyPoints = parsed.weeklyPoints;
        }
      } catch {}

      if (isExplicitReturn) {
        setCallbackState({
          verifying: true,
          success: false,
          error: null,
          reference: ref,
        });
      }

      fetch(`/api/paystack/verify/${encodeURIComponent(ref)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: ref, user_id: resolvedUserId }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            try {
              localStorage.removeItem('futfield_pending_paystack_tx');
            } catch {}

            confetti({
              particleCount: 140,
              spread: 85,
              origin: { y: 0.6 },
              colors: ['#00E676', '#3b82f6', '#f59e0b', '#ffffff'],
            });

            const planType = (data.data?.plan_type || 'pro') as 'pro' | 'vip' | 'season';
            const bonusFp = Number(
              data.data?.bonus_points || (planType === 'season' ? 5000 : planType === 'vip' ? 2000 : 500)
            );

            updateUser({
              isPro: true,
              membershipTier: planType === 'vip' || planType === 'season' ? 'vip' : 'pro',
              proPlan: planType,
              paystackReference: ref,
              proExpiresAt: data.data?.expires_at,
              fanPoints: existingFanPoints + bonusFp,
              weeklyPoints: existingWeeklyPoints + bonusFp,
            });

            addNotification({
              title: 'You are now Pro - Worldwide 🏆',
              body: `Paystack transaction confirmed (${ref}). ${planType.toUpperCase()} package & +${bonusFp} FP unlocked!`,
              type: 'system',
            });

            setCallbackState({
              verifying: false,
              success: true,
              error: null,
              reference: ref,
            });

            try {
              const cleanPath = window.location.pathname.replace('/payment/callback', '') || '/';
              window.history.replaceState({}, document.title, cleanPath);
            } catch {}
          } else {
            if (isExplicitReturn) {
              setCallbackState({
                verifying: false,
                success: false,
                error: data.error || 'Payment verification failed',
                reference: ref,
              });
            }
          }
        })
        .catch((err) => {
          if (isExplicitReturn) {
            setCallbackState({
              verifying: false,
              success: false,
              error: err.message || 'Verification connection failed',
              reference: ref,
            });
          }
        });
    }
  }, []);

  const liveMatches = matches.filter(m => m.status === 'LIVE');

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'home':
        return <HomeTab />;
      case 'scores':
        return <ScoresTab />;
      case 'videos':
        return <VideosTab />;
      case 'communities':
        return <CommunitiesTab />;
      case 'menu':
        return <MenuTab />;
      case 'studio':
        return <FutfieldStudioTab />;
      case 'profile':
        return <ProfileTab />;
      case 'settings':
        return <SettingsPage />;
      case 'pricing':
        return <PricingPage />;
      case 'support':
        return <SupportLegalHub />;
      case 'blog':
        return <BlogPage />;
      case 'reviews':
        return <FanReviewsPage />;
      case 'share':
        return <SharePage />;
      default:
        return <HomeTab />;
    }
  };

  return (
    <div
      data-club-theme={clubTheme || 'default'}
      className={`min-h-screen w-full flex flex-col bg-[#F8FAFC] dark:bg-[#0D1117] text-slate-900 dark:text-[#F1F5F9] selection:bg-[#00E676] selection:text-black ${
        clubTheme === 'arsenal'
          ? 'accent-red-500'
          : clubTheme === 'barca'
          ? 'accent-blue-500'
          : clubTheme === 'madrid'
          ? 'accent-amber-500'
          : clubTheme === 'chelsea'
          ? 'accent-blue-600'
          : ''
      }`}
    >
      {/* Top Bar Navigation */}
      <TopBar />

      {/* Full-Screen Standalone App Content */}
      <main className="flex-1 w-full pb-20 bg-[#F8FAFC] dark:bg-[#0D1117]">
        {renderActiveTab()}

        {activeTab !== 'videos' && activeTab !== 'support' && activeTab !== 'blog' && (
          <footer className="px-4 pb-8 pt-4 border-t border-slate-200/80 dark:border-white/8 text-center space-y-2.5 bg-white/60 dark:bg-[#090D12]/60">
            <div className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1 text-xs font-semibold text-slate-600 dark:text-white/70">
              <button
                onClick={() => setActiveTab('scores')}
                className="hover:text-emerald-700 dark:hover:text-[#00E676] py-1"
              >
                Live Scores
              </button>
              <button
                onClick={() => setActiveTab('blog')}
                className="hover:text-emerald-700 dark:hover:text-[#00E676] py-1"
              >
                Blog
              </button>
              <button
                onClick={() => setActiveTab('reviews')}
                className="hover:text-emerald-700 dark:hover:text-[#00E676] py-1"
              >
                Reviews
              </button>
              <button
                onClick={() => setActiveTab('pricing')}
                className="hover:text-emerald-700 dark:hover:text-[#00E676] py-1"
              >
                Pricing
              </button>
              <button
                onClick={() => openSupportLegalPage('privacy')}
                className="hover:text-emerald-700 dark:hover:text-[#00E676] py-1"
              >
                Privacy
              </button>
              <button
                onClick={() => openSupportLegalPage('terms')}
                className="hover:text-emerald-700 dark:hover:text-[#00E676] py-1"
              >
                Terms
              </button>
              <button
                onClick={() => openSupportLegalPage('refund')}
                className="hover:text-emerald-700 dark:hover:text-[#00E676] py-1"
              >
                Refund
              </button>
              <button
                onClick={() => openSupportLegalPage('support')}
                className="hover:text-emerald-700 dark:hover:text-[#00E676] py-1"
              >
                Support
              </button>
              <button
                onClick={() => setActiveTab('share')}
                className="hover:text-emerald-700 dark:hover:text-[#00E676] py-1"
              >
                Share App
              </button>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-white/45 font-medium">
              FUTFIELD · futfieldsport.com.ng · Updated {todayShort}
            </div>
          </footer>
        )}
      </main>

      {/* Fixed Bottom Navigation Tab Bar */}
      <BottomTabBar />

      {/* Match Room Modal Overlay */}
      {activeMatchRoom && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <MatchRoomModal match={activeMatchRoom} onClose={closeMatchRoom} />
        </div>
      )}

      {/* Global Search Modal */}
      <SearchModal isOpen={searchModalOpen} onClose={() => setSearchModalOpen(false)} />

      {/* Futfield PitchCloud Authentication Modal */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      {/* Football Notifications & Match Alerts Modal */}
      <NotificationsModal
        isOpen={notificationsModalOpen}
        onClose={() => setNotificationsModalOpen(false)}
      />

      {/* Creator Profile Modal for Connected Creators */}
      <CreatorProfileModal
        isOpen={Boolean(selectedCreatorForProfile)}
        creator={selectedCreatorForProfile}
        onClose={closeCreatorProfile}
      />

      {/* Creator Monetization & AI Advisor Modal */}
      <MonetizationModal
        isOpen={monetizationModalOpen}
        onClose={() => setMonetizationModalOpen(false)}
      />

      {/* Universal Phone-Connected Share Sheet Modal */}
      <PhoneShareModal
        payload={shareModalPayload}
        onClose={closeShareSheet}
      />

      {/* Paystack Pricing Page Overlay */}
      {pricingModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white dark:bg-[#090D12] p-3 sm:p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10 mb-3 sticky top-0 bg-white/95 dark:bg-[#090D12]/95 backdrop-blur z-10 pt-1">
            <span className="font-display text-sm font-black tracking-tight text-emerald-700 dark:text-[#00E676]">
              FUTFIELD Pro &amp; Paystack Passes
            </span>
            <button
              onClick={() => setPricingModalOpen(false)}
              aria-label="Close pricing"
              className="min-h-[44px] min-w-[44px] rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 flex items-center justify-center text-sm font-bold text-slate-700 dark:text-white"
            >
              ✕
            </button>
          </div>
          <PricingPage onClose={() => setPricingModalOpen(false)} />
        </div>
      )}

      {/* Paystack /payment/callback Verification Result Modal */}
      {callbackState && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#12171F] border border-emerald-500/40 dark:border-[#00E676]/60 p-6 space-y-4 shadow-2xl text-center">
            {callbackState.verifying ? (
              <div className="py-6 space-y-3">
                <RefreshCw className="w-10 h-10 text-emerald-700 dark:text-[#00E676] animate-spin mx-auto" />
                <h3 className="font-display text-base font-black text-slate-900 dark:text-white">
                  Verifying with Paystack...
                </h3>
                <p className="text-xs text-slate-500 dark:text-white/60">
                  Confirming your worldwide card authorization with bank.
                </p>
              </div>
            ) : callbackState.success ? (
              <div className="space-y-3.5">
                <div className="w-14 h-14 rounded-3xl bg-[#00E676] text-black mx-auto flex items-center justify-center shadow-lg shadow-[#00E676]/25">
                  <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-[#00E676] block">
                    Worldwide Activation Confirmed
                  </span>
                  <h2 className="font-display text-xl font-black text-slate-900 dark:text-white mt-0.5">
                    You are now Pro - Worldwide 🏆
                  </h2>
                </div>
                <p className="text-xs text-slate-600 dark:text-white/75 leading-relaxed">
                  Welcome to Futfield Pro! Priority creator feed, Ultra HD match highlights, verified status, and zero ads are now active.
                </p>
                <div className="p-2.5 rounded-2xl bg-slate-100 dark:bg-white/[0.04] text-[11px] font-mono tabular-nums text-slate-600 dark:text-white/60">
                  Ref: {callbackState.reference} · Paystack Verified
                </div>
                <button
                  onClick={() => {
                    setCallbackState(null);
                    setActiveTab('home');
                  }}
                  className="w-full min-h-[44px] py-3 rounded-2xl bg-[#00E676] hover:bg-[#00c864] text-black font-black text-xs shadow-lg transition-all"
                >
                  Enter Futfield Pro
                </button>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div className="w-14 h-14 rounded-3xl bg-rose-500/20 text-rose-500 mx-auto flex items-center justify-center">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Payment Verification Failed
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-white/70 mt-1">
                    {callbackState.error || 'The bank could not complete the transaction.'}
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setCallbackState(null)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-xs font-bold text-slate-600 dark:text-white"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => {
                      setCallbackState(null);
                      setPricingModalOpen(true);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c864] text-black text-xs font-black"
                  >
                    Retry Payment
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Real-time In-App Notification Toast Banner */}
      <InAppNotificationToast />

      {/* Mandatory 5-Second Loading Screen */}
      {showSplash && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <AppSplashIntro
            onComplete={() => {
              setShowSplash(false);
              if (!localStorage.getItem('futfield_welcome_seen')) {
                setShowWelcome(true);
              } else if (!localStorage.getItem('futfield_club_selected')) {
                setShowClubSelection(true);
              }
            }}
          />
        </div>
      )}

      {/* Cinematic 2-Screen Motion Intro */}
      {!showSplash && showIntro && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <CinematicIntro
            onComplete={() => {
              sessionStorage.setItem('futfield_intro_played', 'true');
              setShowIntro(false);
              if (!localStorage.getItem('futfield_welcome_seen')) {
                setShowWelcome(true);
              } else if (!localStorage.getItem('futfield_club_selected')) {
                setShowClubSelection(true);
              }
            }}
          />
        </div>
      )}

      {/* One-Time Welcome Page for Every New User */}
      {!showSplash && !showIntro && showWelcome && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <WelcomePage
            onEnter={() => {
              localStorage.setItem('futfield_welcome_seen', 'true');
              setShowWelcome(false);
              if (!localStorage.getItem('futfield_club_selected')) {
                setShowClubSelection(true);
              }
            }}
            onReplayIntro={() => {
              setShowIntro(true);
            }}
          />
        </div>
      )}

      {/* Club Selection Page */}
      {!showSplash && !showIntro && !showWelcome && showClubSelection && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <ClubSelectionPage
            onComplete={() => {
              setShowClubSelection(false);
            }}
          />
        </div>
      )}
    </div>
  );
};

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || 'Unexpected application error' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[FUTFIELD ErrorBoundary]', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh w-screen bg-[#05070A] text-white flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#12171F] border border-white/10 p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="font-display text-lg font-black">Pitch Sync Interrupted</h2>
              <p className="text-xs text-white/65 leading-relaxed">{this.state.message}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
              }}
              className="w-full py-2.5 rounded-2xl bg-[#00E676] hover:bg-[#00c864] text-black font-black text-xs transition-all"
            >
              Recover View
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <FootballProvider>
        <AppContent />
      </FootballProvider>
    </AppErrorBoundary>
  );
}
