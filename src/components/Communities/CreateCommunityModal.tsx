import React, { useState } from 'react';
import { X, Shield, Plus, Users } from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { Community } from '../../types/football';

interface CreateCommunityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateCommunityModal: React.FC<CreateCommunityModalProps> = ({ isOpen, onClose }) => {
  const { addCommunity, user } = useFootball();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<Community['category']>('club');
  const [crest, setCrest] = useState('⚽');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('1. Respect all fans\n2. Keep banter friendly\n3. No match spoilers');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const emojiOptions = ['⚽', '🏆', '🔥', '🛡️', '🦁', '👑', '🦅', '⚡', '🌟', '🌍', '🔴', '🔵', '⚪'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const parsedRules = rules
        .split('\n')
        .map(r => r.replace(/^\d+\.\s*/, '').trim())
        .filter(Boolean);

      await addCommunity({
        name: name.trim(),
        category,
        crest,
        description: description.trim() || `The official fan community for ${name} supporters worldwide.`,
        rules: parsedRules.length > 0 ? parsedRules : undefined,
      });

      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-[#161b22] border border-slate-200 dark:border-white/10 rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50 dark:bg-[#0d1117] shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center text-[#00E676]">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Create Fan Community</h3>
              <p className="text-[11px] text-slate-500 dark:text-white/50">Build a supporter hub for your club or country</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-white/70 hover:text-black dark:hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 no-scrollbar">
          {/* Community Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-white/80">Community Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Gunners Global, Real Madrid Ultras, Super Eagles Fanbase"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus:outline-none focus:border-[#00E676]/50"
            />
          </div>

          {/* Category Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-white/80">Category</label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'club', label: 'Club Hub' },
                  { id: 'country', label: 'National Team' },
                  { id: 'league', label: 'League Hub' },
                ] as const
              ).map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                    category === cat.id
                      ? 'bg-[#00E676]/10 border-[#00E676] text-[#00E676]'
                      : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-700 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/10'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Crest / Badge Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-white/80">Crest / Emoji Badge</label>
            <div className="flex flex-wrap gap-2">
              {emojiOptions.map(em => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setCrest(em)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg border transition-all ${
                    crest === em
                      ? 'bg-[#00E676]/20 border-[#00E676] scale-110 shadow-sm'
                      : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-white/80">Community Mission / Bio</label>
            <textarea
              rows={3}
              placeholder="What makes this fan community special? Match discussions, watch parties, transfer news..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus:outline-none focus:border-[#00E676]/50 resize-none"
            />
          </div>

          {/* Rules */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-white/80">Community Rules (one per line)</label>
            <textarea
              rows={3}
              value={rules}
              onChange={e => setRules(e.target.value)}
              className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus:outline-none focus:border-[#00E676]/50 resize-none font-mono text-[11px]"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-slate-600 dark:text-white/60 hover:text-black dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="px-5 py-2 rounded-xl bg-[#00E676] hover:bg-[#00c864] text-black font-extrabold text-xs shadow-md shadow-[#00E676]/20 disabled:opacity-40 transition-all"
            >
              {isSubmitting ? 'Founding...' : 'Create Community (+50 pts)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
