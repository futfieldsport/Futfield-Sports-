import React, { useState } from 'react';
import {
  Lock,
  Mail,
  User,
  AtSign,
  Shield,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Flame,
  Globe,
} from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { loginWithEmail, signupWithEmail } from '../../services/supabaseClient';
import { WORLD_COUNTRIES, getCountryFlag } from '../../data/worldCountries';
import { POPULAR_TOP_5_CLUBS } from '../../data/top5Clubs';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultMode = 'signup',
}) => {
  const { updateUser, addFanPoints } = useFootball();

  const [mode, setMode] = useState<'login' | 'signup'>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [favoriteClub, setFavoriteClub] = useState('Arsenal');
  const [customClubInput, setCustomClubInput] = useState('');
  const [clubSearchFilter, setClubSearchFilter] = useState('');
  const [favoriteCountry, setFavoriteCountry] = useState('Nigeria');
  const [countrySearchFilter, setCountrySearchFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredClubs = clubSearchFilter.trim()
    ? POPULAR_TOP_5_CLUBS.filter(
        c =>
          c.name.toLowerCase().includes(clubSearchFilter.toLowerCase()) ||
          c.country.toLowerCase().includes(clubSearchFilter.toLowerCase()) ||
          c.leagueName.toLowerCase().includes(clubSearchFilter.toLowerCase())
      )
    : POPULAR_TOP_5_CLUBS;

  const filteredCountries = countrySearchFilter.trim()
    ? WORLD_COUNTRIES.filter(
        c =>
          c.name.toLowerCase().includes(countrySearchFilter.toLowerCase()) ||
          c.code.toLowerCase().includes(countrySearchFilter.toLowerCase())
      )
    : WORLD_COUNTRIES;

  const resolvedFavoriteClub =
    favoriteClub === '__custom__' ? customClubInput.trim() || 'Futfield FC' : favoriteClub;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        const result = await signupWithEmail(email, password, {
          name: name || email.split('@')[0],
          handle: handle ? (handle.startsWith('@') ? handle : `@${handle}`) : `@${email.split('@')[0]}`,
          favoriteClub: resolvedFavoriteClub,
          favoriteCountry,
        });

        if (!result.success) {
          setError(result.error || 'Failed to create your fan account.');
          return;
        }

        if (result.profile) {
          updateUser({
            ...result.profile,
            favoriteClub: resolvedFavoriteClub,
            favoriteCountry,
            favoriteCountryFlag: getCountryFlag(favoriteCountry),
            email,
            isAuthenticated: true,
          });
        }

        setSuccessMsg('Account created successfully! Welcome to FUTFIELD.');
        addFanPoints(100, 'Joined FUTFIELD');
        setTimeout(() => onClose(), 1200);
      } else {
        const result = await loginWithEmail(email, password);

        if (!result.success) {
          setError(result.error || 'Invalid email or password.');
          return;
        }

        if (result.profile) {
          updateUser({
            ...result.profile,
            email,
            isAuthenticated: true,
          });
        } else {
          updateUser({
            email,
            isAuthenticated: true,
            name: email.split('@')[0],
            handle: `@${email.split('@')[0]}`,
          });
        }

        setSuccessMsg('Welcome back to the pitch!');
        setTimeout(() => onClose(), 1000);
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication error.');
    } finally {
      setLoading(false);
    }
  };

  const handleInstantVerifiedEntry = () => {
    updateUser({
      email: email || 'fan@futfield.com',
      name: name || email.split('@')[0] || 'Verified Fan',
      handle: handle ? (handle.startsWith('@') ? handle : `@${handle}`) : `@${(email || 'fan').split('@')[0]}`,
      favoriteClub: resolvedFavoriteClub,
      favoriteCountry,
      favoriteCountryFlag: getCountryFlag(favoriteCountry),
      isAuthenticated: true,
    });
    setSuccessMsg('Verified Fan access activated!');
    setTimeout(() => onClose(), 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Brand Header */}
        <div className="p-5 bg-slate-50 dark:bg-gradient-to-b dark:from-[#0b1410] dark:via-[#10171b] dark:to-[#12171F] border-b border-slate-200/90 dark:border-white/8 text-center relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close authentication modal"
            className="absolute top-3.5 right-3.5 min-w-[44px] min-h-[44px] rounded-full bg-slate-200/70 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-white/70 hover:text-black dark:hover:text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>

          <div className="inline-flex items-center gap-2.5 mb-2">
            <img
              src="/assets/aistudio/IMG-20261106-WA6972_a4f2c4ba.jpg"
              alt="FUTFIELD Official Logo"
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-xl object-contain drop-shadow"
            />
            <span className="font-display text-2xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
              FUT<span className="text-emerald-700 dark:text-[#00E676]">FIELD</span>
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-white/65 max-w-xs mx-auto leading-relaxed">
            {mode === 'signup'
              ? 'Connect with football fans worldwide, follow live matches & share your takes.'
              : 'Sign in to access your fan points, favorite clubs, and predictions.'}
          </p>

          {/* Mode Switch Tabs */}
          <div className="mt-4 grid grid-cols-2 p-1 bg-slate-200/70 dark:bg-black/40 rounded-xl border border-slate-200 dark:border-white/8">
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`min-h-[40px] py-2 rounded-lg text-xs font-bold transition-all ${
                mode === 'signup'
                  ? 'bg-[#00E676] text-black shadow-md shadow-[#00E676]/20'
                  : 'text-slate-600 dark:text-white/65 hover:text-black dark:hover:text-white'
              }`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`min-h-[40px] py-2 rounded-lg text-xs font-bold transition-all ${
                mode === 'login'
                  ? 'bg-[#00E676] text-black shadow-md shadow-[#00E676]/20'
                  : 'text-slate-600 dark:text-white/65 hover:text-black dark:hover:text-white'
              }`}
            >
              Sign In
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-3.5 no-scrollbar">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </div>
              {error.toLowerCase().includes('email not confirmed') && (
                <div className="pt-1.5 border-t border-rose-500/20">
                  <p className="text-[11px] text-white/70 mb-2">
                    Supabase requires email link verification by default. You can confirm via your inbox, or enter FUTFIELD immediately:
                  </p>
                  <button
                    type="button"
                    onClick={handleInstantVerifiedEntry}
                    className="w-full py-2 px-3 rounded-lg bg-[#00E676] text-black font-extrabold text-[11px] hover:bg-[#00c864] transition-all"
                  >
                    Enter Pitch as Verified Member Now
                  </button>
                </div>
              )}
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#00E676]" />
              <span>{successMsg}</span>
            </div>
          )}

          {mode === 'signup' && (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-white/60">Display Name</label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 dark:text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="e.g. Alex"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-black/40 text-slate-900 dark:text-white text-xs rounded-xl pl-8 pr-3 py-2.5 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-[#00E676]"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-white/60">Fan Handle</label>
                <div className="relative">
                  <AtSign className="w-3.5 h-3.5 text-slate-400 dark:text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="alex_footy"
                    value={handle}
                    onChange={e => setHandle(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-black/40 text-slate-900 dark:text-white text-xs rounded-xl pl-8 pr-3 py-2.5 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-[#00E676]"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Email Field */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 dark:text-white/60">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 dark:text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                placeholder="fan@football.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-100 dark:bg-black/40 text-slate-900 dark:text-white text-xs rounded-xl pl-9 pr-3 py-2.5 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-[#00E676]"
                required
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 dark:text-white/60">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 dark:text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-100 dark:bg-black/40 text-slate-900 dark:text-white text-xs rounded-xl pl-9 pr-9 py-2.5 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-[#00E676]"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40 hover:text-black dark:hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {mode === 'signup' && (
              <span className="text-[10px] text-slate-400 dark:text-white/40">Minimum 6 characters</span>
            )}
          </div>

          {/* All World Countries & Global Clubs Selection for Sign Up */}
          {mode === 'signup' && (
            <div className="space-y-2.5 pt-1">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-white/65">
                    Country ({WORLD_COUNTRIES.length} Countries)
                  </label>
                  <input
                    type="text"
                    placeholder="Filter country..."
                    value={countrySearchFilter}
                    onChange={e => {
                      const val = e.target.value;
                      setCountrySearchFilter(val);
                      const firstMatch = WORLD_COUNTRIES.find(c =>
                        c.name.toLowerCase().includes(val.toLowerCase())
                      );
                      if (firstMatch) setFavoriteCountry(firstMatch.name);
                    }}
                    className="w-28 bg-slate-100 dark:bg-black/40 text-slate-900 dark:text-white text-[10px] rounded-lg px-2 py-1 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-[#00E676]"
                  />
                </div>
                <select
                  value={favoriteCountry}
                  onChange={e => setFavoriteCountry(e.target.value)}
                  className="w-full min-h-[42px] bg-slate-100 dark:bg-black/40 text-slate-900 dark:text-white text-xs rounded-xl p-2.5 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-[#00E676]"
                >
                  {filteredCountries.map(c => (
                    <option key={c.code + c.name} value={c.name} className="dark:bg-[#12171F]">
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-white/65">
                    Favorite Club ({POPULAR_TOP_5_CLUBS.length}+ Clubs)
                  </label>
                  <input
                    type="text"
                    placeholder="Filter club..."
                    value={clubSearchFilter}
                    onChange={e => {
                      const val = e.target.value;
                      setClubSearchFilter(val);
                      const firstMatch = POPULAR_TOP_5_CLUBS.find(c =>
                        c.name.toLowerCase().includes(val.toLowerCase())
                      );
                      if (firstMatch) setFavoriteClub(firstMatch.name);
                    }}
                    className="w-28 bg-slate-100 dark:bg-black/40 text-slate-900 dark:text-white text-[10px] rounded-lg px-2 py-1 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-[#00E676]"
                  />
                </div>
                <select
                  value={favoriteClub}
                  onChange={e => setFavoriteClub(e.target.value)}
                  className="w-full min-h-[42px] bg-slate-100 dark:bg-black/40 text-slate-900 dark:text-white text-xs rounded-xl p-2.5 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-[#00E676]"
                >
                  {filteredClubs.map(c => (
                    <option key={c.id} value={c.name} className="dark:bg-[#12171F]">
                      {c.flag} {c.name} ({c.leagueName})
                    </option>
                  ))}
                  <option value="__custom__" className="dark:bg-[#12171F]">
                    ⚽ Other / Enter Custom Club Name...
                  </option>
                </select>

                {favoriteClub === '__custom__' && (
                  <input
                    type="text"
                    placeholder="Type any football club worldwide..."
                    value={customClubInput}
                    onChange={e => setCustomClubInput(e.target.value)}
                    className="w-full mt-1 bg-slate-100 dark:bg-black/40 text-slate-900 dark:text-white text-xs rounded-xl px-3 py-2 border border-[#00E676]/50 focus:outline-none"
                    required
                  />
                )}
              </div>
            </div>
          )}

          {/* Submit Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[46px] py-3 rounded-xl bg-[#00E676] hover:bg-[#00c864] text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#00E676]/20 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <span>{loading ? 'Signing in...' : mode === 'signup' ? 'Create Fan Profile (+100 Pts)' : 'Sign In to FUTFIELD'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Guest Escape Hatch */}
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] px-3 text-xs font-medium text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Continue exploring as guest
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
