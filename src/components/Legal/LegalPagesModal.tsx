import React, { useState } from 'react';
import { Shield, FileText, RefreshCw, X, CheckCircle2, Lock, Award, HelpCircle } from 'lucide-react';
import { formatTodayFull } from '../../utils/dateFormat';
import { useFootball } from '../../context/FootballContext';

interface LegalPagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'terms' | 'privacy' | 'refund' | 'faq';
}

export const LegalPagesModal: React.FC<LegalPagesModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'terms',
}) => {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy' | 'refund' | 'faq'>(initialTab);
  const { openSupportLegalPage } = useFootball();
  const todayFull = formatTodayFull();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-[#111720] rounded-3xl border border-slate-200 dark:border-white/10 flex flex-col shadow-2xl overflow-hidden">
        {/* Header with Tabs */}
        <div className="p-4 border-b border-slate-200 dark:border-white/10 flex flex-col gap-3 bg-slate-50 dark:bg-[#161b22]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-[#00E676]/10 text-[#00E676]">
                <Shield className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  FUTFIELD Legal & Compliance
                </h2>
                <span className="text-[10px] text-slate-500 dark:text-white/50">
                  Paystack Merchant Verified · Updated {todayFull}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-200/60 dark:bg-black/40 text-xs font-bold overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('terms')}
              className={`flex-1 py-2 px-2.5 rounded-xl transition-all whitespace-nowrap ${
                activeTab === 'terms'
                  ? 'bg-white dark:bg-[#161b22] text-slate-900 dark:text-white shadow font-black'
                  : 'text-slate-500 dark:text-white/60'
              }`}
            >
              Terms of Service
            </button>
            <button
              onClick={() => setActiveTab('privacy')}
              className={`flex-1 py-2 px-2.5 rounded-xl transition-all whitespace-nowrap ${
                activeTab === 'privacy'
                  ? 'bg-white dark:bg-[#161b22] text-slate-900 dark:text-white shadow font-black'
                  : 'text-slate-500 dark:text-white/60'
              }`}
            >
              Privacy Policy
            </button>
            <button
              onClick={() => setActiveTab('refund')}
              className={`flex-1 py-2 px-2.5 rounded-xl transition-all whitespace-nowrap ${
                activeTab === 'refund'
                  ? 'bg-white dark:bg-[#161b22] text-slate-900 dark:text-white shadow font-black'
                  : 'text-slate-500 dark:text-white/60'
              }`}
            >
              Refund Policy
            </button>
            <button
              onClick={() => setActiveTab('faq')}
              className={`flex-1 py-2 px-2.5 rounded-xl transition-all whitespace-nowrap ${
                activeTab === 'faq'
                  ? 'bg-white dark:bg-[#161b22] text-slate-900 dark:text-white shadow font-black'
                  : 'text-slate-500 dark:text-white/60'
              }`}
            >
              Billing & FAQ
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs text-slate-700 dark:text-white/85 leading-relaxed no-scrollbar">
          {activeTab === 'terms' && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  FUTFIELD Terms of Service
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-white/50">
                  Effective Date: {todayFull} · Last Updated: {todayFull}
                </p>
              </div>
              <p>
                Welcome to FUTFIELD. By accessing or using our global football application, match room chats, tactical board, shorts reels video hub, and subscription passes, you agree to comply with and be bound by these Terms of Service.
              </p>
              <h4 className="font-bold text-slate-900 dark:text-white pt-1">1. Subscriptions & Billing via Paystack</h4>
              <p>
                FUTFIELD offers tiered subscription passes: Matchday Pro Pass ($12 for 1 month), Club VIP Ultra Pass ($25 for 3 months), and Championship Season Pass ($36 for 5 months). Payments are securely processed worldwide via Paystack. Subscriptions actively expire at the end of their respective billing duration unless renewed.
              </p>
              <h4 className="font-bold text-slate-900 dark:text-white pt-1">2. User Conduct & Daily Limits</h4>
              <p>
                Free tier accounts are limited to 3 image/post uploads per day, 1 shorts reel video (30-second 9:16 with sound) per day, and 5 chat room messages per day. Pro and VIP pass subscribers receive expanded/unlimited access. Respectful community conduct is required at all times.
              </p>
              <h4 className="font-bold text-slate-900 dark:text-white pt-1">3. Intellectual Property</h4>
              <p>
                All football logos, live match data feeds, scores, trademarks, and Futfield tactical tools are property of FUTFIELD and its licensed partners.
              </p>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  FUTFIELD Privacy Policy
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-white/50">
                  Effective Date: {todayFull} · Last Updated: {todayFull}
                </p>
              </div>
              <p>
                FUTFIELD (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) values your privacy. This Privacy Policy outlines how we collect, use, and protect your personal data when you use our global football platform.
              </p>
              <h4 className="font-bold text-slate-900 dark:text-white pt-1">1. Information We Collect</h4>
              <p>
                We collect your email address, username, favorite club preferences, IP location (for localized currency conversion), and transaction records processed securely through Paystack.
              </p>
              <h4 className="font-bold text-slate-900 dark:text-white pt-1">2. How We Use Your Data</h4>
              <p>
                Your data is used solely to authenticate your account, deliver live match scores, sync community posts and shorts reels, process secure Paystack subscription billing, and personalize your football experience. We never sell your personal data to third parties.
              </p>
              <h4 className="font-bold text-slate-900 dark:text-white pt-1">3. Data Security</h4>
              <p>
                All payment transactions adhere to 256-bit PCI-DSS Level 1 security standards via Paystack.
              </p>
            </div>
          )}

          {activeTab === 'refund' && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  FUTFIELD Refund & Cancellation Policy
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-white/50">
                  Effective Date: {todayFull} · Paystack Merchant Verified
                </p>
              </div>
              <p>
                We want you to enjoy the ultimate football matchday experience on FUTFIELD. Please review our refund and cancellation terms below:
              </p>
              <h4 className="font-bold text-slate-900 dark:text-white pt-1">1. Subscription Cancellations</h4>
              <p>
                You may cancel your Pro or VIP subscription at any time directly from Settings &gt; Subscription. Upon cancellation, your Pro benefits will remain active until the end of your prepaid billing period ($12 for 1 month, $25 for 3 months, or $36 for 5 months). No further charges will occur.
              </p>
              <h4 className="font-bold text-slate-900 dark:text-white pt-1">2. Refund Eligibility & Timelines</h4>
              <p>
                Due to immediate digital access to live match data feeds, Futfield tactical tools, and premium creator feeds, subscription fees are generally non-refundable. However, if you experience a duplicate charge, accidental renewal, or technical billing error processed via Paystack, you may request a refund within 48 hours by contacting our support team at futfieldsport@gmail.com. Approved refunds are processed back to your original payment card via Paystack within 3-5 business days.
              </p>
            </div>
          )}

          {activeTab === 'faq' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#00E676]" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Paystack Compliance & Subscription FAQ
                </h3>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/5 space-y-1">
                  <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">
                    1. What are the subscription pricing tiers and durations?
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-white/75 leading-relaxed">
                    FUTFIELD features 3 tiered subscription plans: Matchday Pro Pass ($12 for 1 month), Club VIP Ultra Pass ($25 for 3 months), and Championship Season Pass ($36 for 5 months). Subscriptions actively expire at the end of their respective billing duration unless renewed.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/5 space-y-1">
                  <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">
                    2. How does Paystack process international and local payments?
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-white/75 leading-relaxed">
                    All global and local card payments are processed securely through Paystack with 256-bit PCI-DSS Level 1 encryption. The app automatically detects user IP locations and converts pricing into local currencies (NGN, USD, GBP, EUR, etc.) in real time.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/5 space-y-1">
                  <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">
                    3. What is the refund timeline for billing errors?
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-white/75 leading-relaxed">
                    Requests regarding duplicate charges or billing errors must be submitted within 48 hours of transaction to futfieldsport@gmail.com. Approved refunds are credited back to your original payment card via Paystack within 3 to 5 business days.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/5 space-y-1">
                  <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">
                    4. What are the free tier daily usage allowances?
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-white/75 leading-relaxed">
                    Free accounts are limited to 3 posts/images per day, 1 shorts reel video (30-second 9:16 with sound) per day, and 5 chat room messages per day. Pro subscribers enjoy unlimited access across all features.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#161b22] flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <Lock className="w-3 h-3 text-[#00E676]" />
            <span>Updated {todayFull}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                openSupportLegalPage(activeTab === 'privacy' ? 'privacy' : activeTab === 'refund' ? 'refund' : activeTab === 'faq' ? 'support' : 'terms');
              }}
              className="px-3 py-2 rounded-xl bg-slate-200/80 dark:bg-white/10 text-slate-800 dark:text-white font-bold text-xs hover:opacity-90"
            >
              Open Full Center
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-black font-black text-xs hover:opacity-90"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
