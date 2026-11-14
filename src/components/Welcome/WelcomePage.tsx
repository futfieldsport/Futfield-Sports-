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
} from 'lucide-react';

interface WelcomePageProps {
  onEnter: () => void;
  onReplayIntro: () => void;
}

export const WelcomePage: React.FC<WelcomePageProps> = ({ onEnter, onReplayIntro }) => {
  const { user, updateUser, setAuthModalOpen, setClubTheme } = useFootball();

  const [selectedClub, setSelectedClub] = useState<string>(user.favoriteClub || 'Real Madrid');
  const [selectedRole, setSelectedRole] = useState<string>('Matchday Tactician');
  const [hasCustomized, setHasCustomized] = useState(false);

  const topClubs = [
    { name: 'Real Madrid', country: 'Spain', color: 'from-amber-500/20 to-amber-950/40', border: 'border-amber-500/40', text: 'text-amber-400', theme: 'madrid' },
    { name: 'FC Barcelona', country: 'Spain', color: 'from-blue-600/20 to-rose-900/40', border: 'border-blue-500/40', text: 'text-blue-400', theme: 'barca' },
    { name: 'Arsenal', country: 'England', color: 'from-red-600/20 to-rose-950/40', border: 'border-red-500/40', text: 'text-red-400', theme: 'arsenal' },
    { name: 'Manchester United', country: 'England', color: 'from-red-700/20 to-neutral-900/40', border: 'border-red-600/40', text: 'text-red-400', theme: 'arsenal' },
    { name: 'Manchester City', country: 'England', color: 'from-sky-500/20 to-slate-900/40', border: 'border-sky-500/40', text: 'text-sky-400', theme: 'default' },
    { name: 'Liverpool', country: 'England', color: 'from-rose-600/20 to-stone-900/40', border: 'border-rose-500/40', text: 'text-rose-400', theme: 'arsenal' },
    { name: 'Chelsea', country: 'England', color: 'from-blue-700/20 to-indigo-950/40', border: 'border-blue-600/40', text: 'text-blue-400', theme: 'chelsea' },
    { name: 'Bayern Munich', country: 'Germany', color: 'from-red-600/20 to-neutral-950/40', border: 'border-red-500/40', text: 'text-red-400', theme: 'arsenal' },
    { name: 'Paris Saint-Germain', country: 'France', color: 'from-blue-900/20 to-rose-900/40', border: 'border-indigo-500/40', text: 'text-indigo-400', theme: 'chelsea' },
    { name: 'Juventus', country: 'Italy', color: 'from-neutral-700/20 to-black', border: 'border-white/30', text: 'text-white', theme: 'default' },
    { name: 'Borussia Dortmund', country: 'Germany', color: 'from-yellow-500/20 to-neutral-950/40', border: 'border-yellow-500/40', text: 'text-yellow-400', theme: 'madrid' },
    { name: 'AC Milan', country: 'Italy', color: 'from-red-800/20 to-black', border: 'border-red-600/40', text: 'text-red-400', theme: 'arsenal' },
  ];

  const fanRoles = [
    { title: 'Matchday Tactician', desc: 'Analyzes xG, formations, pressing traps, and substitutions' },
    { title: 'Diehard Ultras', desc: 'Chants 90+ minutes, banter enthusiast, live match chat leader' },
    { title: 'Fantasy & Stats Guru', desc: 'Tracks FPL picks, player ratings, injury reports, and trends' },
    { title: 'Football Creator', desc: 'Posts match opinions, reels, AI-assisted tactical threads' },
  ];

  const handleClubSelect = (club: typeof topClubs[0]) => {
    setSelectedClub(club.name);
    setClubTheme(club.theme);
    setHasCustomized(true);
  };

  const handleEnterPitch = () => {
    // Save user selections
    updateUser({
      favoriteClub: selectedClub,
      bio: `⚽ ${selectedClub} Supporter | ${selectedRole} | FUTFIELD Founding Member`,
    });
    localStorage.setItem('futfield_welcome_seen', 'true');
    onEnter();
  };

  const handleOpenAuth = () => {
    setAuthModalOpen(true);
  };

  return (
    <div className="fixed inset-0 z-40 bg-[#090D12] text-[#F1F5F9] overflow-y-auto selection:bg-[#00E676] selection:text-black">
      {/* Ambient pitch floodlight background glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[380px] h-[280px] bg-[#00E676]/10 blur-[110px] rounded-full" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00e67606_1px,transparent_1px),linear-gradient(to_bottom,#00e67606_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      <div className="relative z-10 w-full mx-auto px-3.5 py-5 flex flex-col gap-5">
        {/* Top Mini Bar with Brand & Replay Intro Button */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3.5 gap-1.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl overflow-hidden border border-[#00E676]/40 bg-[#0D1117] p-0.5 shrink-0">
              <img
                src="/assets/aistudio/IMG-20261106-WA6972_a4f2c4ba.jpg"
                alt="FUTFIELD Official Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <span className="font-display font-extrabold text-lg tracking-tight text-white">
                FUT<span className="text-[#00E676]">FIELD</span>
              </span>
              <div className="text-[10px] text-white/60 font-semibold tracking-wider uppercase truncate">
                Official Welcome Hub
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onReplayIntro}
              className="min-h-[40px] flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/85 hover:text-white text-[11px] font-semibold border border-white/10 transition-colors"
              title="Watch the 2 animated 5s screens again"
            >
              <Play className="w-3.5 h-3.5 text-[#00E676]" />
            </button>

            <button
              onClick={handleOpenAuth}
              className="min-h-[40px] flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#00E676]/10 hover:bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/30 text-[11px] font-bold transition-all"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>

            <button
              onClick={onEnter}
              className="min-h-[40px] flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition-all border border-white/15"
              title="Close Welcome and Enter FUTFIELD"
            >
              <span>Skip</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* HERO SECTION with Banner Image & Tagline */}
        <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-[#12171F] shadow-2xl">
          <div className="relative w-full h-40 overflow-hidden bg-black">
            <img
              src="/assets/aistudio/IMG-20261102-WA2735_f2548d41.jpg"
              alt="FUTFIELD - Where Fans Become Family"
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#12171F] via-[#12171F]/25 to-black/35" />

            <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md border border-[#00E676]/35 text-[#00E676] text-[11px] font-bold">
              <Radio className="w-3 h-3 text-[#00E676]" />
              <span>Live Global Arena</span>
            </div>
          </div>

          <div className="p-4 -mt-5 relative z-10 space-y-2.5">
            <div className="inline-flex items-center gap-1.5 text-[#00E676] text-[11px] font-bold tracking-[0.14em] uppercase">
              <Zap className="w-3.5 h-3.5" />
              <span>Where Fans Become Family</span>
            </div>

            <h1 className="font-display text-2xl font-extrabold tracking-tight text-white leading-[1.12]">
              The Digital Stadium for{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-emerald-100 to-[#00E676]">
                3.5 Billion Football Fans
              </span>
            </h1>

            <p className="text-xs text-white/75 leading-relaxed">
              Experience football beyond the broadcast. FUTFIELD unites real-time live scores, matchday banter rooms, tactical studio tools, creator PitchReels, and passionate global fan clubs in one home.
            </p>
          </div>
        </div>

        {/* 4 CORE FOOTBALL SUPERPOWERS */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-white/60 uppercase tracking-[0.14em]">
            Core Matchday Features
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="p-4 rounded-2xl bg-[#12171F] border border-white/8 hover:border-[#00E676]/40 transition-all hover:-translate-y-0.5 group">
              <div className="w-10 h-10 rounded-xl bg-[#00E676]/12 text-[#00E676] flex items-center justify-center mb-3">
                <Flame className="w-5 h-5" />
              </div>
              <h3 className="font-display font-bold text-white text-sm mb-1">Live Match Rooms</h3>
              <p className="text-xs text-white/65 leading-relaxed">
                Jump into real-time banter rooms with live Rivalry Intensity meters during Premier League, UCL &amp; El Clásico.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#12171F] border border-white/8 hover:border-[#00E676]/40 transition-all hover:-translate-y-0.5 group">
              <div className="w-10 h-10 rounded-xl bg-purple-500/12 text-purple-400 flex items-center justify-center mb-3">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="font-display font-bold text-white text-sm mb-1">Tactical Pitch Studio</h3>
              <p className="text-xs text-white/65 leading-relaxed">
                Design matchday graphics, track upload storage in MB, and publish instant tactical commentary.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#12171F] border border-white/8 hover:border-[#00E676]/40 transition-all hover:-translate-y-0.5 group">
              <div className="w-10 h-10 rounded-xl bg-blue-500/12 text-blue-400 flex items-center justify-center mb-3">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-display font-bold text-white text-sm mb-1">Club Communities</h3>
              <p className="text-xs text-white/65 leading-relaxed">
                Connect directly with Madridistas, Gooners, Culés, Red Devils, and supporter groups worldwide.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#12171F] border border-white/8 hover:border-[#00E676]/40 transition-all hover:-translate-y-0.5 group">
              <div className="w-10 h-10 rounded-xl bg-rose-500/12 text-rose-400 flex items-center justify-center mb-3">
                <Video className="w-5 h-5" />
              </div>
              <h3 className="font-display font-bold text-white text-sm mb-1">PitchReels Video Hub</h3>
              <p className="text-xs text-white/65 leading-relaxed">
                Upload matchday clips and watch verified skills, golazos, and live reaction metrics in real time.
              </p>
            </div>
          </div>
        </div>

        {/* STEP 1: CHOOSE YOUR CLUB (FAN CUSTOMIZATION) */}
        <div className="p-4 rounded-3xl bg-[#12171F] border border-white/10 space-y-4 shadow-xl">
          <div className="flex flex-col gap-1 border-b border-white/10 pb-3">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[#00E676] text-xs font-bold uppercase tracking-wider">
                <Trophy className="w-4 h-4" />
                <span>Fan Onboarding</span>
              </div>
              <h2 className="font-display text-lg font-extrabold text-white mt-0.5">
                Pick Your Primary Football Club
              </h2>
            </div>
            <div className="text-xs text-white/70">
              Selected: <span className="font-bold text-[#00E676]">{selectedClub}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {topClubs.map((club) => {
              const isSelected = selectedClub === club.name;
              return (
                <button
                  key={club.name}
                  onClick={() => handleClubSelect(club)}
                  className={`min-h-[84px] p-3.5 rounded-2xl text-left border transition-all flex flex-col justify-between gap-2 relative overflow-hidden group ${
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
                  <div className={`font-bold text-xs sm:text-sm truncate w-full ${isSelected ? 'text-white' : 'text-white/90 group-hover:text-white'}`}>
                    {club.name}
                  </div>
                </button>
              );
            })}
          </div>

          {/* STEP 2: SELECT FAN IDENTITY */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            <div className="text-xs font-bold text-white/75 uppercase tracking-wider">
              Select Your Fan Persona
            </div>
            <div className="grid grid-cols-1 gap-2.5">
              {fanRoles.map((role) => {
                const isSelected = selectedRole === role.title;
                return (
                  <button
                    key={role.title}
                    onClick={() => {
                      setSelectedRole(role.title);
                      setHasCustomized(true);
                    }}
                    className={`min-h-[68px] p-3.5 rounded-2xl text-left border transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'bg-[#00E676]/10 border-[#00E676] ring-1 ring-[#00E676]'
                        : 'bg-[#171D26] border-white/8 hover:border-white/25'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isSelected ? 'bg-[#00E676] text-black' : 'bg-white/8 text-white/70'
                    }`}>
                      <Zap className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-white flex items-center gap-2">
                        <span>{role.title}</span>
                        {isSelected && <span className="text-[10px] text-[#00E676] font-mono">ACTIVE</span>}
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

          <div className="flex flex-col items-center gap-2.5 w-full">
            <button
              onClick={handleOpenAuth}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 border border-white/10"
            >
              <LogIn className="w-4 h-4 text-[#00E676]" />
              <span>Login / Create Account</span>
            </button>

            <button
              onClick={handleEnterPitch}
              className="w-full min-h-[48px] px-6 py-3 rounded-2xl bg-[#00E676] hover:bg-[#69F0AE] text-black font-extrabold text-sm tracking-wide transition-all shadow-lg shadow-[#00E676]/25 active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Enter the Pitch</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
