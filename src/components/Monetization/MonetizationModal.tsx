import React, { useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  Award,
  ArrowUpRight,
  Shield,
  CreditCard,
  Building,
  CheckCircle2,
  X,
  Zap,
  BarChart3,
  Calendar,
  AlertCircle,
  Clock,
  Layers,
} from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { haptics } from '../../utils/haptics';

interface MonetizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean;
}

export const MonetizationModal: React.FC<MonetizationModalProps> = ({
  isOpen,
  onClose,
  embedded = false,
}) => {
  const {
    creatorWallet,
    requestPayout,
    fetchMonetizationAdvice,
    user,
  } = useFootball();

  // Payout Drawer state
  const [showPayoutDrawer, setShowPayoutDrawer] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState(creatorWallet.balance.toFixed(2));
  const [payoutMethod, setPayoutMethod] = useState<'PayPal' | 'Stripe' | 'Bank'>('PayPal');
  const [payoutAccount, setPayoutAccount] = useState('futfieldsport@gmail.com');
  const [isProcessingPayout, setIsProcessingPayout] = useState(false);
  const [payoutStatus, setPayoutStatus] = useState<string | null>(null);

  // AI Monetization Advisor state
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<any>(null);

  if (!isOpen && !embedded) return null;

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(payoutAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    setIsProcessingPayout(true);
    const success = await requestPayout(amountNum, payoutMethod, payoutAccount);
    setIsProcessingPayout(false);

    if (success) {
      setPayoutStatus(`$${amountNum.toFixed(2)} payout initiated via ${payoutMethod}!`);
      setTimeout(() => {
        setPayoutStatus(null);
        setShowPayoutDrawer(false);
      }, 2500);
    }
  };

  const handleGenerateAiAdvice = async () => {
    haptics.light();
    setIsLoadingAdvice(true);
    const advice = await fetchMonetizationAdvice();
    setIsLoadingAdvice(false);
    if (advice) {
      setAiAdvice(advice);
    }
  };

  const content = (
    <div className="space-y-4 text-slate-900 dark:text-white">
      {/* Wallet Balance Hero Card */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-200 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-[#00E676]" />
              FUTFIELD Creator Wallet & Earnings
            </span>
            <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-extrabold backdrop-blur-sm">
              Instant Payouts Enabled
            </span>
          </div>

          <div>
            <div className="text-3xl font-black font-mono tracking-tight text-white flex items-center gap-1">
              <span>${creatorWallet.balance.toFixed(2)}</span>
              <span className="text-xs text-emerald-200 font-sans font-bold">Available USD</span>
            </div>
            <p className="text-[11px] text-emerald-100/80 mt-0.5">
              Accumulated from real video ad share &amp; Paystack subscriptions
            </p>
          </div>

          {/* Breakdown Pills */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/15">
            <div className="p-2 rounded-xl bg-black/20 backdrop-blur-sm">
              <span className="text-[10px] text-emerald-200 block">Ad Revenue</span>
              <span className="text-xs font-mono font-black text-white">
                ${creatorWallet.adRevenue.toFixed(2)}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-black/20 backdrop-blur-sm">
              <span className="text-[10px] text-emerald-200 block">Passes</span>
              <span className="text-xs font-mono font-black text-white">
                ${creatorWallet.subscriptions.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Payout Trigger Button */}
          <button
            onClick={() => {
              haptics.light();
              setPayoutAmount(creatorWallet.balance.toFixed(2));
              setShowPayoutDrawer(true);
            }}
            disabled={creatorWallet.balance <= 0}
            className="w-full py-2.5 rounded-2xl bg-[#00E676] hover:bg-emerald-400 text-black font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Request Instant Payout (${creatorWallet.balance.toFixed(2)})</span>
          </button>
        </div>
      </div>

      {/* Creator Revenue Optimization Engine */}
      <div className="p-4 rounded-3xl bg-white dark:bg-[#161b22] border border-slate-200/80 dark:border-white/10 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-sm flex items-center gap-1.5 text-slate-900 dark:text-white">
              <Zap className="w-4 h-4 text-[#00E676]" />
              Revenue Optimization Engine
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-white/50">
              Analyzes your football tactical clips to maximize RPM and projected creator income
            </p>
          </div>
          <button
            onClick={handleGenerateAiAdvice}
            disabled={isLoadingAdvice}
            className="px-3 py-1.5 rounded-xl bg-slate-900 text-[#00E676] dark:bg-white/10 dark:text-[#00E676] border border-[#00E676]/30 text-xs font-black flex items-center gap-1.5 hover:bg-slate-800 transition-all active:scale-95"
          >
            <Zap className={`w-3.5 h-3.5 ${isLoadingAdvice ? 'animate-spin' : ''}`} />
            <span>{isLoadingAdvice ? 'Analyzing...' : 'Generate Plan'}</span>
          </button>
        </div>

        {/* AI Result Card */}
        {aiAdvice ? (
          <div className="space-y-3 pt-2">
            {/* Projected Range */}
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-white/80">
                  Projected 30-Day Monthly Earnings:
                </span>
                <span className="font-mono font-black text-emerald-600 dark:text-[#00E676] text-sm">
                  ${aiAdvice.estimatedMonthlyEarningsMin} - ${aiAdvice.estimatedMonthlyEarningsMax} USD
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-white/60">
                <span>Ad RPM: {aiAdvice.recommendedRpm}</span>
                <span>Sponsorship Value: {aiAdvice.sponsorshipValuation}</span>
              </div>
            </div>

            {/* Peak Windows */}
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400">
                Peak Matchday Earning Windows:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {aiAdvice.peakEarningWindows?.map((window: string, i: number) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-white/5 text-[10px] font-bold text-slate-700 dark:text-white/70 border border-slate-200 dark:border-white/5"
                  >
                    ⏰ {window}
                  </span>
                ))}
              </div>
            </div>

            {/* Strategic Recommendations */}
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase text-slate-400">
                Tactical Revenue Multipliers:
              </span>
              {aiAdvice.revenueStrategies?.map((strat: any, i: number) => (
                <div
                  key={i}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {strat.title}
                    </span>
                    <span className="text-[10px] font-black text-[#00E676]">
                      {strat.impact}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-white/70 leading-relaxed">
                    {strat.advice}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 text-center space-y-1">
            <p className="text-xs text-slate-600 dark:text-white/70">
              Tap &quot;Generate Plan&quot; to calculate your projected monthly revenue and RPM optimization tactics.
            </p>
          </div>
        )}
      </div>

      {/* Transaction History Log */}
      <div className="p-4 rounded-3xl bg-white dark:bg-[#161b22] border border-slate-200/80 dark:border-white/10 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-sm flex items-center gap-1.5 text-slate-900 dark:text-white">
            <Clock className="w-4 h-4 text-slate-400" />
            Payout & Earning Transactions
          </h3>
          <span className="text-[10px] text-slate-400">
            {creatorWallet.transactions.length} recorded
          </span>
        </div>

        <div className="space-y-2 max-h-52 overflow-y-auto no-scrollbar">
          {creatorWallet.transactions.map((tx: any) => (
            <div
              key={tx.id}
              className="p-2.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 flex items-center justify-between text-xs"
            >
              <div className="space-y-0.5">
                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-emerald-500/10 text-[#00E676]">
                    {tx.type}
                  </span>
                  <span>{tx.description}</span>
                </div>
                <span className="text-[10px] text-slate-400">{tx.timestamp}</span>
              </div>
              <span
                className={`font-mono font-black ${
                  tx.type === 'payout' ? 'text-rose-500' : 'text-[#00E676]'
                }`}
              >
                {tx.type === 'payout' ? '-' : '+'}${tx.amount.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Payout Modal Drawer */}
      {showPayoutDrawer && (
        <div className="p-4 rounded-3xl bg-slate-900 text-white border border-[#00E676]/30 shadow-2xl space-y-3 animate-in slide-in-from-bottom">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black flex items-center gap-1.5 text-white">
              <CreditCard className="w-4 h-4 text-[#00E676]" />
              Withdraw Creator Earnings
            </h4>
            <button
              onClick={() => setShowPayoutDrawer(false)}
              className="text-white/60 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>

          {payoutStatus ? (
            <div className="p-3 rounded-2xl bg-emerald-500 text-black font-extrabold text-xs text-center">
              {payoutStatus}
            </div>
          ) : (
            <form onSubmit={handleRequestPayout} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-white/60 uppercase block mb-1">
                  Payout Method:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['PayPal', 'Stripe', 'Bank'] as const).map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPayoutMethod(method)}
                      className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                        payoutMethod === method
                          ? 'border-[#00E676] bg-[#00E676]/20 text-[#00E676]'
                          : 'border-white/10 bg-white/5 text-white/70'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-white/60 uppercase block mb-1">
                  Recipient Account / Email:
                </label>
                <input
                  type="text"
                  value={payoutAccount}
                  onChange={e => setPayoutAccount(e.target.value)}
                  placeholder="e.g. futfieldsport@gmail.com"
                  className="w-full bg-white/10 rounded-xl px-3 py-2 text-xs text-white border border-white/10 focus:outline-none focus:border-[#00E676]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-white/60 uppercase block mb-1">
                  Amount (USD):
                </label>
                <input
                  type="number"
                  step="0.01"
                  max={creatorWallet.balance}
                  value={payoutAmount}
                  onChange={e => setPayoutAmount(e.target.value)}
                  className="w-full bg-white/10 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white border border-white/10 focus:outline-none focus:border-[#00E676]"
                />
              </div>

              <button
                type="submit"
                disabled={isProcessingPayout}
                className="w-full py-2.5 rounded-xl bg-[#00E676] text-black font-black text-xs hover:bg-emerald-400 transition-colors"
              >
                {isProcessingPayout ? 'Transferring...' : `Confirm Transfer of $${payoutAmount}`}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-[440px] max-h-[92vh] bg-white dark:bg-[#0d1117] rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-slate-200 dark:border-white/10">
        <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-emerald-500/10 text-[#00E676]">
              <DollarSign className="w-4 h-4" />
            </span>
            <h2 className="font-black text-sm text-slate-900 dark:text-white">
              Creator Monetization
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
          {content}
        </div>
      </div>
    </div>
  );
};
