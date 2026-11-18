import React, { useState } from 'react';
import { useFootball } from '../../context/FootballContext';
import { ClubLogo } from '../Common/ClubLogo';
import {
  Trophy,
  Flame,
  Video,
  Users,
  ArrowRight,
  CheckCircle2,
  Play,
  Zap,
  Radio,
  LogIn,
  ShieldCheck,
  Target,
  Brain,
} from 'lucide-react';

interface WelcomePageProps {
  onEnter: () => void;
  onReplayIntro: () => void;
}

export const WelcomePage: React.FC<WelcomePageProps> = ({ onEnter, onReplayIntro }) => {
  const { user, updateUser, setAuthModalOpen, setClubTheme } = useFootball();

  const [selectedClub, setSelectedClub] = useState<string>(
    user.favoriteClub && user.favoriteClub !== 'Not Set' ? user.favoriteClub : 'Real Madrid'
  );
  const [selectedRole, setSelectedRole] = useState<string>('Matchday Tactician');

  const topClubs = [
    { name: 'Real Madrid', country: 'Spain', color: 'from-amber-500/20 to-amber-950/40', border: 'border-amber-500/40', theme: 'madrid' },
    { name: 'FC Barcelona', country: 'Spain', color: 'from-blue-600/20 to-rose-900/40', border: 'border-blue-500/40', theme: 'barca' },
    { name: 'Arsenal', country: 'England', color: 'from-red-600/20 to-rose-950/40', border: 'border-red-500/40', theme: 'arsenal' },
    { name: 'Manchester United', country: 'England', color: 'from-red-700/20 to-neutral-900/40', border: 'border-red-600/40', theme: 'arsenal' },
    { name: 'Manchester City', country: 'England', color: 'from-sky-500/20 to-slate-900/40', border: 'border-sky-500/40', theme: 'default' },
    { name: 'Liverpool', country: 'England', color: 'from-rose-600/20 to-stone-900/40', border: 'border-rose-500/40', theme: 'arsenal' },
    { name: 'Chelsea', country: 'England', color: 'from-blue-700/20 to-indigo-950/40', border: 'border-blue-600/40', theme: 'chelsea' },
    { name: 'Bayern Munich', country: 'Germany', color: 'from-red-600/20 to-neutral-950/40', border: 'border-red-500/40', theme: 'arsenal' },
    { name: 'Paris Saint-Germain', country: 'France', color: 'from-blue-900/20 to-rose-900/40', border: 'border-indigo-500/40', theme: 'chelsea' },
    { name: 'Juventus', country: 'Italy', color: 'from-neutral-700/20 to-black', border: 'border-white/30', theme: 'default' },
    { name: 'Borussia Dortmund', country: 'Germany', color: 'from-yellow-500/20 to-neutral-950/40', border: 'border-yellow-500/40', theme: 'madrid' },
    { name: 'AC Milan', country: 'Italy', color: 'from-red-800/20 to-black', border: 'border-red-600/40', theme: 'arsenal' },
  ];

  const fanRoles = [
    { title: 'Matchday Tactician', desc: 'Analyzes pressing traps, expected goals, lineups, and mid-game switches' },
    { title: 'Diehard Ultras', desc: 'Chants 90+ minutes, banter enthusiast, live Match Room voice leader' },
    { title: 'Predictor & Stats Guru', desc: 'Competes in the Matchday Predictor League and Football IQ Arena streaks' },
    { title: 'Futfield Tube Creator', desc: 'Publishes 9:16 Quick Kicks, 16:9 Clips, and match reactions in their FanZone' },
  ];

  const handleClubSelect = (club: typeof topClubs[0]) => {
    setSelectedClub(club.name);
    setClubTheme(club.theme);
  };

  const handleEnterPitch = () => {
    updateUser({
      favoriteClub: selectedClub,
      bio: `⚽ ${selectedClub} Supporter | ${selectedRole} | FUTFIELD Community Member`,
    });
    localStorage.setItem('futfield_welcome_seen', 'true');
    localStorage.setItem('futfield_club_selected', 'true');
    onEnter();
  };

  return (
    <div className="fixed inset-0 z-40 bg-[#090D12] text-[#F1F5F9] overflow-y-auto selection:bg-[#00E676] selection:text-black">
      {/* Ambient pitch floodlight background glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[380px] h-[280px] bg-[#00E676]/10 blur-[110px] rounded-full" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00e67606_1px,transparent_1px),linear-gradient(to_bottom,#00e67606_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      <div className="relative z-10 w-full max-w-2xl mx-auto px-3.5 py-5 flex flex-col gap-5 pb-10">
        {/* Top Mini Bar with Brand & Account Entry */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3.5 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl overflow-hidden border border-[#00E676]/40 bg-[#0D1117] p-0.5 shrink-0">
              <img
                src="/futfield-logo.jpg"
                alt="FUTFIELD Official Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <span className="font-display font-extrabold text-lg tracking-tight text-white">
                FUT<span className="text-[#00E676]">FIELD</span>
              </span>
              <div className="text-[10px] text-white/60 font-semibold tracking-wider uppercase truncate">
                Welcome Guide · First-Time Setup
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onReplayIntro}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/85 hover:text-white border border-white/10 transition-colors"
              title="Replay intro"
              aria-label="Replay intro"
            >
              <Play className="w-4 h-4 text-[#00E676]" />
            </button>

            <button
              onClick={() => setAuthModalOpen(true)}
              className="min-h-[44px] flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#00E676]/10 hover:bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/30 text-xs font-bold transition-all"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          </div>
        </div>

        {/* HERO SECTION with Banner Image & Full App Description */}
        <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-[#12171F] shadow-2xl">
          <div className="relative w-full h-44 overflow-hidden bg-black">
            <img
              src="/og-image.jpg"
              alt="FUTFIELD - Where Fans Become Family"
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#12171F] via-[#12171F]/25 to-black/35" />

            <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md border border-[#00E676]/35 text-[#00E676] text-[11px] font-bold">
              <Radio className="w-3 h-3 text-[#00E676]" />
              <span>Welcome to FUTFIELD</span>
            </div>
          </div>

          <div className="p-4 sm:p-5 -mt-5 relative z-10 space-y-2.5">
            <div className="inline-flex items-center gap-1.5 text-[#00E676] text-[11px] font-bold tracking-[0.14em] uppercase">
              <Zap className="w-3.5 h-3.5" />
              <span>Where Fans Become Family</span>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-[1.12]">
              Your All-in-One{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-emerald-100 to-[#00E676]">
                Global Football Stadium
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
              FUTFIELD brings supporters from every league together in one fast mobile community. Track real-time match scores, step into Live Match Rooms with audio voice notes, upload and watch 9:16 Quick Kicks &amp; 16:9 Clips on Futfield Tube, challenge fans in the Matchday Predictor League &amp; Football IQ Arena, join global Fan Communities, and unlock Worldwide Pro Passes via Paystack.
            </p>
          </div>
        </div>

        {/* FULL CAPABILITIES OVERVIEW */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-white/60 uppercase tracking-[0.14em]">
            Inside FUTFIELD · Full Feature Guide
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-[#12171F] border border-white/8 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-[#00E676]/12 text-[#00E676] flex items-center justify-center">
                <Flame className="w-5 h-5" />
              </div>
              <h3 className="font-display font-bold text-white text-sm">Live Scores &amp; Match Rooms</h3>
              <p className="text-xs text-white/70 leading-relaxed">
                Follow live fixtures with instant score updates, confirmed stats, win probabilities, voice notes, and the real-time Rivalry Intensity thermometer.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#12171F] border border-white/8 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-rose-500/12 text-rose-400 flex items-center justify-center">
                <Video className="w-5 h-5" />
              </div>
              <h3 className="font-display font-bold text-white text-sm">Futfield Tube &amp; 9:16 Quick Kicks</h3>
              <p className="text-xs text-white/70 leading-relaxed">
                Share photos, upload football clips effortlessly with automatic thumbnails, launch your FanZone, cheer highlights, and organize Matchday Packs.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#12171F] border border-white/8 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-amber-500/12 text-amber-400 flex items-center justify-center">
                <Target className="w-5 h-5" />
              </div>
              <h3 className="font-display font-bold text-white text-sm">Matchday Predictor &amp; IQ Arena</h3>
              <p className="text-xs text-white/70 leading-relaxed">
                Lock weekly scoreline predictions, compete in live football trivia streaks and fan polls, and climb leaderboard rankings with verifiable Fan Points.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#12171F] border border-white/8 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-blue-500/12 text-blue-400 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-display font-bold text-white text-sm">Communities &amp; Worldwide Pro</h3>
              <p className="text-xs text-white/70 leading-relaxed">
                Unite with supporter clubs worldwide, manage posts from your FanZone profile, and upgrade seamlessly with Paystack local-currency Pro Passes.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center gap-2.5 text-xs text-white/75">
            <ShieldCheck className="w-4 h-4 text-[#00E676] shrink-0" />
            <span>
              Copyright-Safe Fan Platform: Original geometric club shields, MediaGuard upload protection, and strict account security across every session.
            </span>
          </div>
        </div>

        {/* STEP 1: CHOOSE YOUR CLUB */}
        <div className="p-4 rounded-3xl bg-[#12171F] border border-white/10 space-y-4 shadow-xl">
          <div className="flex flex-col gap-1 border-b border-white/10 pb-3">
            <div className="inline-flex items-center gap-1.5 text-[#00E676] text-xs font-bold uppercase tracking-wider">
              <Trophy className="w-4 h-4" />
              <span>Personalize Your Experience</span>
            </div>
            <h2 className="font-display text-lg font-extrabold text-white mt-0.5">
              Pick Your Primary Football Club
            </h2>
            <div className="text-xs text-white/70">
              Selected: <span className="font-bold text-[#00E676]">{selectedClub}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {topClubs.map((club) => {
              const isSelected = selectedClub === club.name;
              return (
                <button
                  key={club.name}
                  type="button"
                  onClick={() => handleClubSelect(club)}
                  className={`min-h-[80px] p-3 rounded-2xl text-left border transition-all flex flex-col justify-between gap-2 relative overflow-hidden group ${
                    isSelected
                      ? `bg-gradient-to-br ${club.color} ${club.border} ring-1 ring-[#00E676]`
                      : 'bg-[#171D26] border-white/8 hover:border-white/25 hover:bg-[#1C2430]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <ClubLogo name={club.name} size="sm" />
                    {isSelected ? (
                      <CheckCircle2 className="w-4 h-4 text-[#00E676]" />
                    ) : (
                      <span className="text-[10px] text-white/50 uppercase tracking-wider">{club.country}</span>
                    )}
                  </div>
                  <div className={`font-bold text-xs truncate w-full ${isSelected ? 'text-white' : 'text-white/90 group-hover:text-white'}`}>
                    {club.name}
                  </div>
                </button>
              );
            })}
          </div>

          {/* STEP 2: SELECT FAN IDENTITY */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            <div className="text-xs font-bold text-white/75 uppercase tracking-wider flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-[#00E676]" />
              <span>Select Your Fan Persona</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {fanRoles.map((role) => {
                const isSelected = selectedRole === role.title;
                return (
                  <button
                    key={role.title}
                    type="button"
                    onClick={() => setSelectedRole(role.title)}
                    className={`min-h-[68px] p-3.5 rounded-2xl text-left border transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'bg-[#00E676]/10 border-[#00E676] ring-1 ring-[#00E676]'
                        : 'bg-[#171D26] border-white/8 hover:border-white/25'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected ? 'bg-[#00E676] text-black' : 'bg-white/8 text-white/70'
                      }`}
                    >
                      <Zap className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-white flex items-center gap-2">
                        <span>{role.title}</span>
                      </div>
                      <div className="text-xs text-white/65 mt-0.5 leading-snug">
                        {role.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* BOTTOM CTA: ENTER THE PITCH */}
        <div className="flex flex-col items-center justify-between gap-3 p-4 rounded-3xl bg-[#12171F] border border-[#00E676]/30 shadow-2xl">
          <div className="space-y-1 text-center">
            <h3 className="font-display font-extrabold text-base text-white">
              Ready for Kick-off?
            </h3>
            <p className="text-xs text-white/70">
              Joining with: <span className="text-[#00E676] font-bold">{selectedClub}</span> · {selectedRole}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="w-full sm:w-auto sm:flex-1 min-h-[46px] px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 border border-white/10"
            >
              <LogIn className="w-4 h-4 text-[#00E676]" />
              <span>Sign In / Create Account</span>
            </button>

            <button
              type="button"
              onClick={handleEnterPitch}
              className="w-full sm:w-auto sm:flex-1 min-h-[48px] px-6 py-3 rounded-2xl bg-[#00E676] hover:bg-[#69F0AE] text-black font-extrabold text-sm tracking-wide transition-all shadow-lg shadow-[#00E676]/25 active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Enter FUTFIELD</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
