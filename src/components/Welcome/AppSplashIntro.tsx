import React, { useState, useEffect, useRef } from 'react';
import { Shield, Activity } from 'lucide-react';

interface AppSplashIntroProps {
  onComplete: () => void;
}

export const AppSplashIntro: React.FC<AppSplashIntroProps> = ({ onComplete }) => {
  const [timeLeft, setTimeLeft] = useState<number>(5.0);
  const [elapsed, setElapsed] = useState<number>(0);
  const startTimeRef = useRef<number>(Date.now());
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    startTimeRef.current = Date.now();

    const interval = setInterval(() => {
      const currentElapsed = (Date.now() - startTimeRef.current) / 1000;
      setElapsed(Math.min(currentElapsed, 5));
      const remaining = Math.max(0, 5 - currentElapsed);
      setTimeLeft(remaining);

      if (currentElapsed >= 5.0) {
        clearInterval(interval);
        onCompleteRef.current();
      }
    }, 30);

    return () => clearInterval(interval);
  }, []);

  const progressPercent = Math.min(100, (elapsed / 5.0) * 100);
  const statusStage =
    elapsed < 1.5
      ? 'Connecting Live Global Match Engine...'
      : elapsed < 3.2
      ? 'Loading Futfield Tube, Match Rooms & Predictor...'
      : elapsed < 4.5
      ? 'Securing Fan Session & Regional Currency...'
      : 'Pitch Ready. Entering Stadium...';

  return (
    <div className="fixed inset-0 z-50 bg-[#090D12] text-[#F1F5F9] flex flex-col justify-between overflow-hidden select-none">
      {/* Top Header with mandatory 5-second loading countdown */}
      <div className="w-full max-w-md mx-auto pt-6 px-5 z-30 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-[#00E676] font-display tracking-wider uppercase text-xs font-bold">
            Preparing FUTFIELD Stadium
          </span>

          <span className="font-mono tabular-nums text-white/90 text-xs bg-[#12171F] px-2.5 py-1 rounded-lg border border-white/10">
            {timeLeft.toFixed(1)}s
          </span>
        </div>

        {/* 5-second Progress Bar */}
        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#00E676] to-[#69F0AE] transition-all duration-75 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Main Center Display with Framed Shield Logo */}
      <div className="flex-1 w-full max-w-md mx-auto flex flex-col items-center justify-center p-6 relative">
        {/* Crisp Stadium Floodlight Wash */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-72 h-72 rounded-full bg-[#00E676]/12 blur-[96px]" />
        </div>

        {/* Tactical Pitch Grid */}
        <div className="absolute inset-0 bg-[radial-gradient(#00E676_1px,transparent_1px)] [background-size:28px_28px] opacity-10 pointer-events-none" />

        {/* Animated Shield Logo Container */}
        <div className="relative group flex flex-col items-center">
          <div className="absolute -inset-6 border border-[#00E676]/25 rounded-full animate-orbit-spin pointer-events-none scale-110" />
          <div className="absolute -inset-12 border border-emerald-400/15 rounded-full animate-orbit-spin pointer-events-none scale-125 [animation-direction:reverse]" />

          {/* Official App Logo Shield */}
          <div className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-3xl overflow-hidden shadow-[0_18px_50px_rgba(0,230,118,0.28)] border border-[#00E676]/45 bg-[#0D1117] animate-float-glow">
            <img
              src="/futfield-logo.jpg"
              alt="FUTFIELD Official App Shield Logo"
              className="w-full h-full object-contain p-1.5"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full animate-shimmer-sweep pointer-events-none" />
          </div>

          <div className="w-32 h-5 mt-5 rounded-full bg-[#00E676]/20 blur-md" />
        </div>

        {/* App Title & Dynamic Engine Progress */}
        <div className="mt-6 text-center space-y-2 z-20">
          <div className="inline-flex items-center gap-1.5 text-[#00E676] text-xs font-bold tracking-[0.14em] uppercase">
            <Activity className="w-3.5 h-3.5 text-[#00E676]" />
            <span>Official Football Fan Community</span>
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white flex items-center justify-center gap-1.5">
            FUT<span className="text-[#00E676]">FIELD</span>
          </h1>
          <p className="text-xs text-white/75 font-medium max-w-xs mx-auto leading-relaxed">
            {statusStage}
          </p>
        </div>
      </div>

      {/* Bottom Footer Info */}
      <div className="w-full max-w-md mx-auto pb-7 px-6 z-30 flex items-center justify-between text-xs text-white/55">
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-[#00E676]" />
          <span>Protected by MediaGuard</span>
        </div>
        <div className="font-mono tabular-nums text-xs font-bold text-[#00E676]">
          {Math.round(progressPercent)}%
        </div>
      </div>
    </div>
  );
};
