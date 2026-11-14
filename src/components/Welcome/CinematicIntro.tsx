import React, { useState, useEffect, useRef } from 'react';
import { FastForward, Volume2, Zap, ChevronRight } from 'lucide-react';

interface CinematicIntroProps {
  onComplete: () => void;
}

export const CinematicIntro: React.FC<CinematicIntroProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<1 | 2>(1);
  const [timeLeft, setTimeLeft] = useState<number>(5.0);
  const [phase1Elapsed, setPhase1Elapsed] = useState<number>(0);
  const [phase2Elapsed, setPhase2Elapsed] = useState<number>(0);

  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    startTimeRef.current = Date.now();

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;

      if (phase === 1) {
        setPhase1Elapsed(Math.min(elapsed, 5));
        const remaining = Math.max(0, 5 - elapsed);
        setTimeLeft(remaining);

        if (elapsed >= 5) {
          // Switch to Screen 2
          setPhase(2);
          startTimeRef.current = Date.now();
          setTimeLeft(5.0);
        }
      } else {
        setPhase2Elapsed(Math.min(elapsed, 5));
        const remaining = Math.max(0, 5 - elapsed);
        setTimeLeft(remaining);

        if (elapsed >= 5) {
          clearInterval(interval);
          onComplete();
        }
      }
    }, 40);

    return () => clearInterval(interval);
  }, [phase, onComplete]);

  const handleSkip = () => {
    if (phase === 1) {
      setPhase(2);
      startTimeRef.current = Date.now();
      setTimeLeft(5.0);
    } else {
      onComplete();
    }
  };

  const handleSkipAll = () => {
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#090D12] text-[#F1F5F9] flex flex-col items-center justify-between overflow-hidden select-none">
      {/* Top Bar with dual 5-second progress segments & Skip control */}
      <div className="w-full max-w-xl mx-auto pt-6 px-6 z-30 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs font-semibold text-white/80">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00E676]" />
            <span className="text-[#00E676] font-display tracking-wider uppercase text-xs font-bold">
              {phase === 1 ? 'Screen 1 of 2 · FUTFIELD Icon' : 'Screen 2 of 2 · Global Fan Arena'}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="font-mono tabular-nums text-white/75 text-xs bg-[#12171F] px-2.5 py-1 rounded-lg border border-white/10">
              {timeLeft.toFixed(1)}s
            </span>
            <button
              onClick={handleSkipAll}
              className="min-h-[44px] flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all text-xs font-bold active:scale-95 border border-white/10"
            >
              <span>Skip to Welcome</span>
              <FastForward className="w-3.5 h-3.5 text-[#00E676]" />
            </button>
          </div>
        </div>

        {/* Dual Progress Bars: 5 seconds each */}
        <div className="grid grid-cols-2 gap-2 w-full">
          <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#00E676] to-[#69F0AE] transition-all duration-75 rounded-full"
              style={{
                width: phase === 1 ? `${(phase1Elapsed / 5) * 100}%` : '100%',
              }}
            />
          </div>

          <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#00E676] to-[#69F0AE] transition-all duration-75 rounded-full"
              style={{
                width: phase === 2 ? `${(phase2Elapsed / 5) * 100}%` : '0%',
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Animated Display Area */}
      <div className="flex-1 w-full max-w-4xl mx-auto flex items-center justify-center p-4 sm:p-8 relative">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[420px] h-[420px] rounded-full bg-[#00E676]/10 blur-[110px]" />
        </div>

        <div className="absolute inset-0 bg-[radial-gradient(#00E676_1px,transparent_1px)] [background-size:32px_32px] opacity-10 pointer-events-none" />

        {/* SCREEN 1: First 5 Seconds - App Icon in Motion */}
        {phase === 1 && (
          <div className="relative flex flex-col items-center justify-center transition-all duration-700 ease-out animate-fadeIn">
            <div className="absolute -inset-10 border border-[#00E676]/25 rounded-full animate-orbit-spin pointer-events-none scale-110" />
            <div className="absolute -inset-16 border border-emerald-400/15 rounded-full animate-orbit-spin pointer-events-none scale-125 [animation-direction:reverse]" />

            <div className="relative group cursor-pointer animate-float-glow">
              <div className="relative w-60 h-60 sm:w-72 sm:h-72 md:w-80 md:h-80 rounded-[40px] overflow-hidden shadow-[0_20px_70px_rgba(0,230,118,0.28)] border border-[#00E676]/35 bg-[#0D1117]">
                <img
                  src="/assets/aistudio/IMG-20261106-WA6972_a4f2c4ba.jpg"
                  alt="FUTFIELD Official App Shield Icon"
                  className="w-full h-full object-contain p-2 scale-100 transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full animate-shimmer-sweep pointer-events-none" />
              </div>
            </div>

            <div className="mt-7 text-center space-y-2 z-20">
              <div className="inline-flex items-center gap-1.5 text-[#00E676] text-xs font-bold tracking-[0.14em] uppercase">
                <Zap className="w-3.5 h-3.5" />
                <span>Next-Gen Football Platform</span>
              </div>
              <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-white flex items-center justify-center">
                FUT<span className="text-[#00E676]">FIELD</span>
              </h1>
              <p className="text-sm text-white/70 font-medium">
                The Pitch Is Primed. Booting 2026 Global Match Engine...
              </p>
            </div>
          </div>
        )}

        {/* SCREEN 2: Second 5 Seconds - Wide FUTFIELD Banner in Motion */}
        {phase === 2 && (
          <div className="relative flex flex-col items-center justify-center w-full max-w-3xl transition-all duration-700 ease-out animate-fadeIn">
            <div className="relative w-full rounded-3xl overflow-hidden shadow-[0_24px_80px_rgba(0,230,118,0.22)] border border-[#00E676]/35 bg-[#0D1117] aspect-[16/10] sm:aspect-[16/9] flex items-center justify-center">
              <img
                src="/assets/aistudio/IMG-20261102-WA2735_f2548d41.jpg"
                alt="FUTFIELD - Where Fans Become Family"
                className="w-full h-full object-cover object-center animate-kenburns"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/30 pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#00E676]/20 to-transparent -translate-x-full animate-shimmer-sweep pointer-events-none" />

              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-white/95 bg-black/65 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#00E676]" />
                  <span className="font-display font-bold tracking-wide text-[#00E676]">WHERE FANS BECOME FAMILY</span>
                </div>
                <div className="text-xs text-white/75 hidden sm:block">
                  Global Football Community · 3.5B Fans
                </div>
              </div>
            </div>

            <div className="mt-6 text-center space-y-1.5 z-20">
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                Connecting Fans Across Every League
              </h2>
              <p className="text-sm text-white/70">
                Live Scores · Instant Banter · Creator Studio · Match Rooms
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      <div className="w-full max-w-xl mx-auto pb-8 px-6 z-30 flex items-center justify-between">
        <div className="text-xs text-white/55 font-mono tabular-nums">
          {phase === 1 ? '5s Screen 1' : '5s Screen 2'} · Auto-advancing
        </div>

        {phase === 1 ? (
          <button
            onClick={handleSkip}
            className="min-h-[44px] flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-[#00E676] hover:text-black text-white font-bold text-xs transition-all active:scale-95 border border-white/10 shadow-lg"
          >
            <span>Next Screen</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={onComplete}
            className="min-h-[44px] flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#00E676] text-black font-extrabold text-xs transition-all hover:bg-[#69F0AE] active:scale-95 shadow-lg shadow-[#00E676]/25"
          >
            <span>Enter Welcome Hub</span>
            <ChevronRight className="w-4 h-4 stroke-[3]" />
          </button>
        )}
      </div>
    </div>
  );
};
