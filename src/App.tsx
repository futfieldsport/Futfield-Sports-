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
import { AIAssistantDrawer } from './components/Modals/AIAssistantDrawer';
import { SearchModal } from './components/Modals/SearchModal';
import { AuthModal } from './components/Auth/AuthModal';
import { AppSplashIntro } from './components/Welcome/AppSplashIntro';
import { CinematicIntro } from './components/Welcome/CinematicIntro';
import { WelcomePage } from './components/Welcome/WelcomePage';
import { ClubSelectionPage } from './components/Welcome/ClubSelectionPage';
import { InAppNotificationToast } from './components/Notifications/InAppNotificationToast';
import { SettingsPage } from './components/Settings/SettingsPage';
import { PlayerScoutModal } from './components/Players/PlayerScoutModal';
import { NotificationsModal } from './components/Notifications/NotificationsModal';
import { DailyHighlightReel } from './components/Videos/DailyHighlightReel';
import { CreatorProfileModal } from './components/Profile/CreatorProfileModal';
import { MonetizationModal } from './components/Monetization/MonetizationModal';
import { PricingPage } from './components/Pricing/PricingPage';
import { SupportLegalHub } from './components/Support/SupportLegalHub';
import { BlogPage } from './components/Blog/BlogPage';
import { FanReviewsPage } from './components/Reviews/FanReviewsPage';
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
    aiDrawerOpen,
    setAiDrawerOpen,
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
    playerScoutModalOpen,
    setPlayerScoutModalOpen,
    notificationsModalOpen,
    setNotificationsModalOpen,
    showSplash,
    setShowSplash,
    showDailyHighlightReel,
    setShowDailyHighlightReel,
    selectedCreatorForProfile,
    closeCreatorProfile,
    monetizationModalOpen,
    setMonetizationModalOpen,
    pricingModalOpen,
    setPricingModalOpen,
    openSupportLegalPage,
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
    const ref = urlParams.get('reference') || urlParams.get('trxref');
    const isCallbackPath = window.location.pathname.includes('/payment/callback') || Boolean(ref);

    if (ref && isCallbackPath) {
      setCallbackState({
        verifying: true,
        success: false,
        error: null,
        reference: ref,
      });

      fetch(`/api/paystack/verify/${encodeURIComponent(ref)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: ref, user_id: user.id }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            confetti({
              particleCount: 140,
              spread: 85,
              origin: { y: 0.6 },
              colors: ['#00E676', '#3b82f6', '#f59e0b', '#ffffff'],
            });

            updateUser({
              isPro: true,
              membershipTier: 'pro',
              paystackReference: ref,
              proExpiresAt: data.data?.expires_at,
            });

            addNotification({
              title: 'You are now Pro - Worldwide 🏆',
              body: `Paystack transaction confirmed (${ref}). All Pro features unlocked.`,
              type: 'system',
            });

            setCallbackState({
              verifying: false,
              success: true,
              error: null,
              reference: ref,
            });

            try {
              window.history.replaceState(
                {},
                document.title,
                window.location.pathname.replace('/payment/callback', '/')
              );
            } catch {}
          } else {
            setCallbackState({
              verifying: false,
              success: false,
              error: data.error || 'Payment verification failed',
              reference: ref,
            });
          }
        })
        .catch((err) => {
          setCallbackState({
            verifying: false,
            success: false,
            error: err.message || 'Verification connection failed',
            reference: ref,
          });
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
      default:
        return <HomeTab />;
    }
  };

  return (
    <div
      data-club-theme={clubTheme || 'default'}
      className={`h-dvh w-screen overflow-hidden bg-[#E2E8F0] dark:bg-[#05070A] text-slate-900 dark:text-[#F1F5F9] flex items-center justify-center transition-colors selection:bg-[#00E676] selection:text-black ${
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
      {/* Stationary Stagnant 9:16 Portrait Viewport Shell (transform-gpu contains all fixed modals/drawers cleanly) */}
      <main className="relative h-[min(100dvh,calc(100vw*16/9))] sm:h-[min(97dvh,calc(97vw*16/9))] aspect-[9/16] max-w-full overflow-hidden transform-gpu bg-white dark:bg-[#090D12] sm:rounded-[28px] border border-slate-300/80 dark:border-white/10 flex flex-col shadow-2xl">
        <div className="relative w-full h-full flex flex-col overflow-hidden bg-white dark:bg-[#090D12]">
          {/* Top Bar Navigation */}
          <TopBar />

          {/* Scrollable Screen Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden relative no-scrollbar bg-[#F8FAFC] dark:bg-[#0D1117]">
            {renderActiveTab()}

            {activeTab !== 'videos' && activeTab !== 'support' && activeTab !== 'blog' && (
              <footer className="px-4 pb-24 pt-4 border-t border-slate-200/80 dark:border-white/8 text-center space-y-2.5 bg-white/60 dark:bg-[#090D12]/60">
                <div className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1 text-xs font-semibold text-slate-600 dark:text-white/70">
                  <button
                    onClick={() => setActiveTab('scores')}
                    className="hover:text-emerald-700 dark:hover:text-[#00E676] transition-colors py-1"
                  >
                    Live Scores
                  </button>
                  <button
                    onClick={() => setActiveTab('blog')}
                    className="hover:text-emerald-700 dark:hover:text-[#00E676] transition-colors py-1"
                  >
                    Blog
                  </button>
                  <button
                    onClick={() => setActiveTab('reviews')}
                    className="hover:text-emerald-700 dark:hover:text-[#00E676] transition-colors py-1"
                  >
                    Reviews
                  </button>
                  <button
                    onClick={() => setActiveTab('pricing')}
                    className="hover:text-emerald-700 dark:hover:text-[#00E676] transition-colors py-1"
                  >
                    Pricing
                  </button>
                  <button
                    onClick={() => openSupportLegalPage('privacy')}
                    className="hover:text-emerald-700 dark:hover:text-[#00E676] transition-colors py-1"
                  >
                    Privacy
                  </button>
                  <button
                    onClick={() => openSupportLegalPage('terms')}
                    className="hover:text-emerald-700 dark:hover:text-[#00E676] transition-colors py-1"
                  >
                    Terms
                  </button>
                  <button
                    onClick={() => openSupportLegalPage('refund')}
                    className="hover:text-emerald-700 dark:hover:text-[#00E676] transition-colors py-1"
                  >
                    Refund
                  </button>
                  <button
                    onClick={() => openSupportLegalPage('support')}
                    className="hover:text-emerald-700 dark:hover:text-[#00E676] transition-colors py-1"
                  >
                    Support
                  </button>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-white/45 font-medium">
                  FUTFIELD · futfieldsport.com.ng · Updated {todayShort}
                </div>
              </footer>
            )}
          </div>

          {/* Fixed Mobile Bottom Tab Bar */}
          <div className="shrink-0 relative sticky bottom-0 z-30">
            <BottomTabBar embedded />
          </div>

          {/* Match Room Modal Overlay inside 9:16 Mobile Frame */}
          {activeMatchRoom && (
            <div className="absolute inset-0 z-50 overflow-hidden">
              <MatchRoomModal match={activeMatchRoom} onClose={closeMatchRoom} />
            </div>
          )}

          {/* AI Assistant Drawer inside 9:16 Mobile Frame */}
          <AIAssistantDrawer isOpen={aiDrawerOpen} onClose={() => setAiDrawerOpen(false)} />

          {/* Global Search Modal inside 9:16 Mobile Frame */}
          <SearchModal isOpen={searchModalOpen} onClose={() => setSearchModalOpen(false)} />

          {/* Supabase Authentication Modal inside 9:16 Mobile Frame */}
          <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />

          {/* Top 10 Leagues Player Scout Modal inside 9:16 Mobile Frame */}
          {playerScoutModalOpen && (
            <PlayerScoutModal
              isOpen={playerScoutModalOpen}
              onClose={() => setPlayerScoutModalOpen(false)}
            />
          )}

          {/* Football Notifications & Match Alerts Modal inside 9:16 Mobile Frame */}
          <NotificationsModal
            isOpen={notificationsModalOpen}
            onClose={() => setNotificationsModalOpen(false)}
          />

          {/* Daily Highlight Reel Story-like viewer */}
          <DailyHighlightReel
            isOpen={showDailyHighlightReel}
            onClose={() => setShowDailyHighlightReel(false)}
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

          {/* Paystack Pricing Page Overlay */}
          {pricingModalOpen && (
            <div className="absolute inset-0 z-50 overflow-y-auto bg-white dark:bg-[#090D12] p-3 sm:p-5 animate-in fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10 mb-3 sticky top-0 bg-white/95 dark:bg-[#090D12]/95 backdrop-blur z-10 pt-1">
                <span className="font-display text-sm font-black tracking-tight text-emerald-700 dark:text-[#00E676]">
                  FUTFIELD Pro &amp; Paystack Passes
                </span>
                <button
                  onClick={() => setPricingModalOpen(false)}
                  aria-label="Close pricing"
                  className="min-h-[44px] min-w-[44px] rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 flex items-center justify-center text-sm font-bold text-slate-700 dark:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
              <PricingPage onClose={() => setPricingModalOpen(false)} />
            </div>
          )}

          {/* Paystack /payment/callback Verification Result Modal */}
          {callbackState && (
            <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
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
                      Ref: {callbackState.reference} · Settling to UBA
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

          {/* Always load 5-second Splash screen before a user enters the app */}
          {showSplash && (
            <div className="absolute inset-0 z-50 overflow-hidden">
              <AppSplashIntro
                onComplete={() => {
                  setShowSplash(false);
                }}
              />
            </div>
          )}

          {/* Cinematic 2-Screen Motion Intro */}
          {!showSplash && showIntro && (
            <div className="absolute inset-0 z-50 overflow-hidden">
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

          {/* One-Time Welcome Page for Football Fans */}
          {!showSplash && !showIntro && showWelcome && (
            <div className="absolute inset-0 z-50 overflow-hidden">
              <WelcomePage
                onEnter={() => {
                  localStorage.setItem('futfield_welcome_seen', 'true');
                  setShowWelcome(false);
                  setShowClubSelection(true);
                }}
                onReplayIntro={() => {
                  setShowIntro(true);
                }}
              />
            </div>
          )}

          {/* Second Image: Club Selection Page immediately loaded after Welcome Page */}
          {!showSplash && !showIntro && !showWelcome && showClubSelection && (
            <div className="absolute inset-0 z-50 overflow-hidden">
              <ClubSelectionPage
                onComplete={() => {
                  setShowClubSelection(false);
                }}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default function App() {
  return (
    <FootballProvider>
      <AppContent />
    </FootballProvider>
  );
}
