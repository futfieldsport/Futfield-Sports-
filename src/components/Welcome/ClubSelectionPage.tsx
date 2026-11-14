import React, { useState } from 'react';
import { useFootball } from '../../context/FootballContext';
import { POPULAR_TOP_5_CLUBS, TOP_5_LEAGUES, TopClub } from '../../data/top5Clubs';
import { ClubLogo } from '../Common/ClubLogo';
import { Check, ArrowRight, Search } from 'lucide-react';
import confetti from 'canvas-confetti';

interface ClubSelectionPageProps {
  onComplete: () => void;
}

export const ClubSelectionPage: React.FC<ClubSelectionPageProps> = ({ onComplete }) => {
  const { user, updateUser, setClubTheme, addNotification, addFanPoints } = useFootball();

  const [selectedClubId, setSelectedClubId] = useState<string>(() => {
    const existing = POPULAR_TOP_5_CLUBS.find(
      c => c.name.toLowerCase() === (user.favoriteClub || '').toLowerCase()
    );
    return existing ? existing.id : 'arsenal';
  });

  const [selectedLeague, setSelectedLeague] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredClubs = POPULAR_TOP_5_CLUBS.filter(club => {
    const matchesLeague = selectedLeague === 'all' || club.leagueId === selectedLeague;
    const matchesSearch =
      club.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      club.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
      club.stadium.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLeague && matchesSearch;
  });

  const handleSelectClub = (club: TopClub) => {
    setSelectedClubId(club.id);
  };

  const handleContinue = () => {
    const chosenClub = POPULAR_TOP_5_CLUBS.find(c => c.id === selectedClubId) || POPULAR_TOP_5_CLUBS[0];

    // Update user profile with selected club
    updateUser({
      favoriteClub: chosenClub.name,
      favoriteCountry: chosenClub.country,
      bio: `⚽ ${chosenClub.name} Supporter | Founded ${chosenClub.founded} | FUTFIELD Fan`,
    });

    setClubTheme(chosenClub.theme);
    localStorage.setItem('futfield_club_selected', 'true');
    localStorage.setItem('futfield_welcome_seen', 'true');

    // Confetti celebration
    try {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#00E676', '#ffffff', '#22c55e'],
      });
    } catch {}

    // Dispatch instant in-app notification
    addNotification({
      title: `Welcome to ${chosenClub.name}!`,
      body: `You are now an official supporter of ${chosenClub.name} on FUTFIELD. Personalized scores and news activated!`,
      type: 'system',
    });

    addFanPoints(50, 'Completed Club Onboarding');

    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#090D12] text-[#F1F5F9] flex flex-col justify-between overflow-hidden select-none">
      {/* Background Stadium Floodlight Ambiance */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[560px] h-[420px] bg-emerald-600/12 blur-[130px] rounded-full" />
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[440px] h-[340px] bg-[#00E676]/8 blur-[120px] rounded-full" />
      </div>

      {/* Main Content Viewport */}
      <div className="relative z-10 flex-1 flex flex-col max-w-md w-full mx-auto px-5 pt-8 pb-4 overflow-hidden">
        <div className="text-center space-y-1 mb-5">
          <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white/90">
            Welcome to
          </h2>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white">
            FUT<span className="text-[#00E676]">FIELD</span>
          </h1>
          <p className="text-xs sm:text-sm text-white/70 font-medium pt-1">
            Pick your club to unlock tailored scores, colors &amp; fan rooms.
          </p>
        </div>

        {/* Top 5 Leagues Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-3 shrink-0">
          {TOP_5_LEAGUES.map(league => {
            const isActive = selectedLeague === league.id;
            return (
              <button
                key={league.id}
                onClick={() => setSelectedLeague(league.id)}
                className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-[#00E676] text-black shadow-md shadow-[#00E676]/25'
                    : 'bg-[#12171F] hover:bg-white/10 text-white/75 border border-white/10'
                }`}
              >
                <span>{league.icon}</span>
                <span>{league.name}</span>
              </button>
            );
          })}
        </div>

        {/* Search input for quick lookup */}
        <div className="relative mb-3 shrink-0">
          <Search className="w-4 h-4 text-white/45 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search popular clubs..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full min-h-[44px] bg-[#12171F] border border-white/10 rounded-xl pl-10 pr-10 py-2 text-xs text-white placeholder:text-white/45 focus:outline-none focus:border-[#00E676]/60 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-xs text-white/60 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* 2-column Grid of Popular Clubs */}
        <div className="flex-1 overflow-y-auto no-scrollbar pr-0.5">
          <div className="grid grid-cols-2 gap-3.5 pb-4">
            {filteredClubs.map(club => {
              const isSelected = selectedClubId === club.id;
              return (
                <button
                  type="button"
                  key={club.id}
                  onClick={() => handleSelectClub(club)}
                  className={`relative cursor-pointer rounded-3xl p-4 flex flex-col items-center justify-between min-h-[145px] transition-all duration-200 ${
                    isSelected
                      ? 'bg-emerald-950/35 border-2 border-[#00E676] shadow-lg shadow-[#00E676]/15 scale-[1.01]'
                      : 'bg-[#12171F] border border-white/10 hover:border-white/25 hover:bg-[#171D26]'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[#00E676] flex items-center justify-center">
                      <Check className="w-3 h-3 text-black stroke-[3]" />
                    </div>
                  )}

                  <div className="w-16 h-16 flex items-center justify-center p-1 my-auto">
                    <ClubLogo name={club.name} size="lg" />
                  </div>

                  <div className="text-center w-full mt-2">
                    <div className="font-bold text-sm text-white truncate">
                      {club.name}
                    </div>
                    <div className="text-[11px] text-white/60 truncate">
                      {club.flag} {club.leagueName}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom CTA: Continue Button */}
        <div className="pt-3 pb-2 shrink-0 space-y-2.5">
          <button
            onClick={handleContinue}
            className="w-full min-h-[48px] py-3.5 rounded-2xl bg-[#00E676] hover:bg-[#69F0AE] active:scale-[0.99] text-black font-extrabold text-sm tracking-wide transition-all shadow-lg shadow-[#00E676]/25 flex items-center justify-center gap-2"
          >
            <span>Continue to FUTFIELD</span>
            <ArrowRight className="w-4 h-4 stroke-[3]" />
          </button>

          <p className="text-center text-[11px] text-white/55">
            You can switch your club badge &amp; accent theme anytime in Settings.
          </p>
        </div>
      </div>
    </div>
  );
};
