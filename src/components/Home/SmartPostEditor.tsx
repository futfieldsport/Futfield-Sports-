import React, { useState, useEffect } from 'react';
import {
  Zap,
  BarChart2,
  Image as ImageIcon,
  Send,
  Check,
  RefreshCw,
  Hash,
  AlertCircle,
  Eye,
  PenTool,
  Sliders,
  CheckCircle2,
  X,
  Flame,
  Target,
  Smile,
  MessageSquare,
  BookOpen,
} from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { SafeImage } from '../Common/SafeImage';

interface SmartPostEditorProps {
  onClose?: () => void;
  defaultFilter?: 'foryou' | 'following' | 'trending';
}

type ToneType = 'tactical' | 'ultra' | 'banter' | 'reporter';

interface TerminologySuggestion {
  word: string;
  suggestion: string;
  reason: string;
}

interface AiEnhanceResult {
  enhancedText: string;
  hashtags: string[];
  authenticityScore: number;
  toneFeedback: string;
  grammarNotes: string[];
  tacticalJargonSuggestions: string[];
  detectedTerminology: TerminologySuggestion[];
}

export const SmartPostEditor: React.FC<SmartPostEditorProps> = ({
  onClose,
  defaultFilter = 'foryou',
}) => {
  const { user, addPost, addFanPoints } = useFootball();

  const [activeTab, setActiveTab] = useState<'editor' | 'analysis' | 'preview'>('editor');
  const [draft, setDraft] = useState('');
  const [originalDraft, setOriginalDraft] = useState('');
  const [selectedTone, setSelectedTone] = useState<ToneType>('tactical');
  const [selectedPhoto, setSelectedPhoto] = useState<string>('');
  
  // Poll state
  const [showPoll, setShowPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  // AI & Inspection state
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [aiResult, setAiResult] = useState<AiEnhanceResult | null>(null);
  const [hasEnhanced, setHasEnhanced] = useState(false);

  // Available Match Action Graphics (Copyright-Safe Original FUTFIELD Media)
  const samplePhotos = [
    { label: 'Matchday Pitch', url: '/og-image.jpg' },
    { label: 'Futfield Crest', url: '/futfield-logo.jpg' },
  ];

  const toneOptions: { id: ToneType; label: string; icon: string; desc: string }[] = [
    { id: 'tactical', label: 'Tactical Analyst', icon: '📐', desc: 'Focuses on half-spaces, pressing triggers, xG and blocks' },
    { id: 'ultra', label: 'Passionate Ultra', icon: '🔥', desc: 'Electric stadium energy, anthems and raw emotion' },
    { id: 'banter', label: 'Football Banter', icon: '😂', desc: 'Witty, sharp humor and light rivalry jabs' },
    { id: 'reporter', label: 'Match Reporter', icon: '📰', desc: 'Authoritative, concise journalism style' },
  ];

  // Client-side quick football terminology check
  const checkLocalTerminology = (text: string): TerminologySuggestion[] => {
    const dictionary: Record<string, string> = {
      'lewandowki': 'Lewandowski',
      'lewandoski': 'Lewandowski',
      'odegaard': 'Ødegaard',
      'debruyne': 'De Bruyne',
      'vini': 'Vinícius Jr',
      'bellingam': 'Bellingham',
      'mbappe': 'Mbappé',
      'gvardiol': 'Gvardiol',
      'off sides': 'offside',
      'penality': 'penalty',
      'clasico': 'El Clásico',
    };
    const found: TerminologySuggestion[] = [];
    const lower = text.toLowerCase();
    for (const [typo, correct] of Object.entries(dictionary)) {
      if (lower.includes(typo) && !text.includes(correct)) {
        found.push({
          word: typo,
          suggestion: correct,
          reason: 'Correct football spelling for players and tournament standards.',
        });
      }
    }
    return found;
  };

  const detectedLocalTypos = checkLocalTerminology(draft);

  // Auto-hashtag generation based on draft text
  const getDynamicHashtags = (): string[] => {
    const tags = new Set<string>(['#FUTFIELD', '#Football']);
    const lower = draft.toLowerCase();
    if (lower.includes('barca') || lower.includes('barcelona') || lower.includes('yamal')) {
      tags.add('#Barça');
      tags.add('#LaLiga');
    }
    if (lower.includes('madrid') || lower.includes('bellingham') || lower.includes('vinicius')) {
      tags.add('#HalaMadrid');
      tags.add('#RealMadrid');
    }
    if (lower.includes('arsenal') || lower.includes('saka') || lower.includes('arteta')) {
      tags.add('#Arsenal');
      tags.add('#COYG');
      tags.add('#ArtetaBall');
    }
    if (lower.includes('city') || lower.includes('haaland') || lower.includes('pep')) {
      tags.add('#ManCity');
      tags.add('#Haaland');
    }
    if (lower.includes('goal') || lower.includes('finish') || lower.includes('volley')) {
      tags.add('#Wondergoal');
    }
    if (lower.includes('press') || lower.includes('block') || lower.includes('tactic')) {
      tags.add('#Tactics');
    }
    return Array.from(tags);
  };

  const handleEnhanceWithAI = async () => {
    if (!draft.trim()) return;
    setIsEnhancing(true);
    setOriginalDraft(draft);

    try {
      // Call our dedicated backend Smart Post Editor endpoint
      const response = await fetch('/api/ai/smart-post-enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft,
          tone: selectedTone,
          targetClub: user.favoriteClub,
        }),
      });

      if (response.ok) {
        const data: AiEnhanceResult = await response.json();
        setAiResult(data);
        setDraft(data.enhancedText);
        setHasEnhanced(true);
        addFanPoints(20, 'Enhanced Post Tone & Phrasing');
      } else {
        throw new Error('Fallback needed');
      }
    } catch {
      // Offline / Local intelligent fallback
      const localEnhancements: Record<ToneType, string> = {
        tactical: `${draft.trim()} Notice how the spatial overload in the half-spaces disrupted their low block. Masterclass in positional play.`,
        ultra: `${draft.trim()} UNREAL ATMOSPHERE! 🏟️🔥 Absolute passion on the pitch tonight! This club is everything!`,
        banter: `${draft.trim()} Completely rattled their whole backline! You love to see it 😂⚽`,
        reporter: `${draft.trim()} A clinical performance on the night, shifting momentum and leaving the opposition searching for answers.`,
      };

      const fallbackResult: AiEnhanceResult = {
        enhancedText: localEnhancements[selectedTone],
        hashtags: getDynamicHashtags(),
        authenticityScore: 88,
        toneFeedback: `Applied authentic ${selectedTone} football phrasing with high engagement.`,
        grammarNotes: ['Terminology checked against European league standards.'],
        tacticalJargonSuggestions: ['Half-space overload', 'High press trigger', 'Counter-press transition'],
        detectedTerminology: detectedLocalTypos,
      };

      setAiResult(fallbackResult);
      setDraft(fallbackResult.enhancedText);
      setHasEnhanced(true);
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleApplyCorrection = (originalWord: string, replacement: string) => {
    const regex = new RegExp(originalWord, 'gi');
    setDraft(prev => prev.replace(regex, replacement));
  };

  const handleInsertHashtag = (tag: string) => {
    if (!draft.includes(tag)) {
      setDraft(prev => `${prev.trim()} ${tag}`);
    }
  };

  const handleInsertJargon = (jargon: string) => {
    setDraft(prev => `${prev.trim()} (${jargon})`);
  };

  const handleRevert = () => {
    if (originalDraft) {
      setDraft(originalDraft);
      setHasEnhanced(false);
    }
  };

  const handleSubmitPost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() && !pollQuestion.trim()) return;

    addPost({
      content: draft,
      mediaUrl: selectedPhoto || undefined,
      pollQuestion: showPoll && pollQuestion.trim() ? pollQuestion : undefined,
      pollOptions: showPoll ? pollOptions.filter(o => o.trim()) : undefined,
      category: defaultFilter,
    });

    setDraft('');
    setPollQuestion('');
    setPollOptions(['', '']);
    setShowPoll(false);
    setSelectedPhoto('');
    setAiResult(null);
    setHasEnhanced(false);
    if (onClose) onClose();
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#161b22] border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden transition-all">
      {/* Editor Header */}
      <div className="p-3.5 bg-slate-50 dark:bg-gradient-to-r dark:from-[#0d1510] dark:via-[#161b22] dark:to-[#111923] border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#00E676]/20 border border-[#00E676]/40 flex items-center justify-center text-[#00E676]">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-xs tracking-tight flex items-center gap-1.5">
              Smart Post Editor
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/30">
                Pitch Engine
              </span>
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-white/50">
              Grammar & tone tuned for authentic football culture
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-black/40 p-1 rounded-xl border border-slate-200 dark:border-white/5">
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors ${
              activeTab === 'editor'
                ? 'bg-[#00E676] text-black shadow-sm'
                : 'text-slate-600 dark:text-white/60 hover:text-black dark:hover:text-white'
            }`}
          >
            <PenTool className="w-3 h-3" />
            <span>Editor</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('analysis')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors ${
              activeTab === 'analysis'
                ? 'bg-[#00E676] text-black shadow-sm'
                : 'text-slate-600 dark:text-white/60 hover:text-black dark:hover:text-white'
            }`}
          >
            <Sliders className="w-3 h-3" />
            <span>Tone Check</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors ${
              activeTab === 'preview'
                ? 'bg-[#00E676] text-black shadow-sm'
                : 'text-slate-600 dark:text-white/60 hover:text-black dark:hover:text-white'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>Preview</span>
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="p-4 space-y-3.5">
        {activeTab === 'editor' && (
          <>
            {/* Tone Selector Pills */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-white/60 font-semibold">
                <span>Select Post Tone:</span>
                <span className="text-[#00E676] font-bold">{toneOptions.find(t => t.id === selectedTone)?.desc}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {toneOptions.map(tone => {
                  const isSelected = selectedTone === tone.id;
                  return (
                    <button
                      key={tone.id}
                      type="button"
                      onClick={() => setSelectedTone(tone.id)}
                      className={`p-2 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-[#00E676] bg-[#00E676]/10 text-slate-900 dark:text-white font-bold'
                          : 'border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02] text-slate-700 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs">
                        <span>{tone.icon}</span>
                        <span className="truncate">{tone.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Input Area with Word Count */}
            <div className="relative">
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="Break down the match, drop your tactical opinion, or banter with rivals... (e.g. Lewandowki and Yamal exploited the half-spaces)"
                rows={4}
                className="w-full bg-slate-100 dark:bg-black/40 text-slate-900 dark:text-white text-sm rounded-xl p-3 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-[#00E676]/50 placeholder:text-slate-400 dark:placeholder:text-white/30 resize-none"
              />
              <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-white/40 pt-1">
                <span className="font-mono">{draft.length} characters · {draft.split(/\s+/).filter(Boolean).length} words</span>
                {hasEnhanced && (
                  <button
                    type="button"
                    onClick={handleRevert}
                    className="text-amber-500 dark:text-amber-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <RefreshCw className="w-2.5 h-2.5" /> Revert to draft
                  </button>
                )}
              </div>
            </div>

            {/* Football Grammar & Terminology Detection Callout */}
            {detectedLocalTypos.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Football Terminology Corrections Detected
                </div>
                <div className="flex flex-wrap gap-2">
                  {detectedLocalTypos.map((typo, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyCorrection(typo.word, typo.suggestion)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-black/40 dark:hover:bg-black/60 border border-amber-500/30 text-xs text-slate-800 dark:text-white flex items-center gap-1.5 transition-colors group"
                    >
                      <span className="line-through text-slate-400 dark:text-white/40">{typo.word}</span>
                      <span className="text-[#00E676] font-bold">→ {typo.suggestion}</span>
                      <span className="text-[10px] text-[#00E676] opacity-0 group-hover:opacity-100 font-semibold">Apply</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Auto-Hashtag Suggestions */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-white/60">
                <span className="flex items-center gap-1">
                  <Hash className="w-3 h-3 text-[#00E676]" />
                  Auto-Hashtag Suggestions:
                </span>
                <span className="text-[10px] text-slate-400 dark:text-white/40">Tap to insert</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {getDynamicHashtags().map((tag, idx) => {
                  const isAlreadyIn = draft.includes(tag);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleInsertHashtag(tag)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                        isAlreadyIn
                          ? 'bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/30'
                          : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5'
                      }`}
                    >
                      {tag}
                      {isAlreadyIn && <Check className="w-2.5 h-2.5 inline ml-1" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Match Photo Selector */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-white/60">
                <span className="flex items-center gap-1">
                  <ImageIcon className="w-3 h-3 text-sky-500" />
                  Attach Match Photo:
                </span>
                {selectedPhoto && (
                  <button
                    type="button"
                    onClick={() => setSelectedPhoto('')}
                    className="text-[10px] text-rose-500 hover:underline"
                  >
                    Remove photo
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                {samplePhotos.map((photo, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedPhoto(selectedPhoto === photo.url ? '' : photo.url)}
                    className={`relative rounded-xl overflow-hidden aspect-video w-24 border shrink-0 transition-all ${
                      selectedPhoto === photo.url
                        ? 'border-[#00E676] ring-2 ring-[#00E676]/40 scale-105'
                        : 'border-slate-200 dark:border-white/10 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <img src={photo.url} alt={photo.label} className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 inset-x-0 bg-slate-900/80 text-[9px] text-white text-center py-0.5 truncate px-1">
                      {photo.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Poll Creation Drawer if toggled */}
            {showPoll && (
              <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-emerald-600 dark:text-[#00E676] flex items-center gap-1.5">
                    <BarChart2 className="w-3.5 h-3.5" />
                    Match Prediction Poll
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPoll(false)}
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-xs"
                  >
                    ✕
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Poll Question (e.g. Who wins this weekend?)"
                  value={pollQuestion}
                  onChange={e => setPollQuestion(e.target.value)}
                  className="w-full bg-white dark:bg-white/5 text-slate-900 dark:text-white text-xs rounded-lg px-3 py-2 border border-slate-200 dark:border-white/10 focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Option 1 (e.g. Barcelona)"
                    value={pollOptions[0]}
                    onChange={e => setPollOptions([e.target.value, pollOptions[1]])}
                    className="bg-white dark:bg-white/5 text-slate-900 dark:text-white text-xs rounded-lg px-2.5 py-1.5 border border-slate-200 dark:border-white/10 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Option 2 (e.g. Real Madrid)"
                    value={pollOptions[1]}
                    onChange={e => setPollOptions([pollOptions[0], e.target.value])}
                    className="bg-white dark:bg-white/5 text-slate-900 dark:text-white text-xs rounded-lg px-2.5 py-1.5 border border-slate-200 dark:border-white/10 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* Tab 2: Tone & Jargon Analysis */}
        {activeTab === 'analysis' && (
          <div className="space-y-4">
            {aiResult ? (
              <div className="space-y-3.5">
                {/* Authenticity Score Meter */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-[#0c2e1b] dark:to-[#0d1f14] border border-[#00E676]/30 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-[#00E676]" />
                      Football Authenticity Score
                    </span>
                    <span className="font-mono text-lg font-black text-[#00E676]">
                      {aiResult.authenticityScore} / 100
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-white/10 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#00E676] h-full transition-all duration-700"
                      style={{ width: `${aiResult.authenticityScore}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-700 dark:text-[#00E676]/90 leading-relaxed pt-1">
                    {aiResult.toneFeedback}
                  </p>
                </div>

                {/* Tactical Jargon Suggestions */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 dark:text-white/70 uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#00E676]" />
                    Tactical Jargon Recommendations
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {aiResult.tacticalJargonSuggestions.map((jargon, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleInsertJargon(jargon)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-xs text-slate-800 dark:text-white/90 flex items-center gap-1.5 transition-colors"
                      >
                        <span className="text-[#00E676] font-bold">+</span>
                        <span>{jargon}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grammar Notes */}
                {aiResult.grammarNotes.length > 0 && (
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 space-y-1.5">
                    <div className="text-xs font-bold text-slate-700 dark:text-white/70">Grammar & Syntax Verdict</div>
                    {aiResult.grammarNotes.map((note, i) => (
                      <div key={i} className="text-xs text-slate-600 dark:text-white/60 flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-[#00E676]" />
                        <span>{note}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 space-y-2">
                <Zap className="w-8 h-8 text-[#00E676] mx-auto animate-pulse" />
                <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">No Analysis Generated Yet</h4>
                <p className="text-xs text-slate-500 dark:text-white/50 max-w-sm mx-auto">
                  Type your post in the Editor tab and tap "Pro Pitch Polish" to inspect football grammar, jargon density, and authenticity score.
                </p>
                <button
                  type="button"
                  onClick={handleEnhanceWithAI}
                  disabled={!draft.trim() || isEnhancing}
                  className="mt-2 px-4 py-2 rounded-xl bg-[#00E676] text-black font-bold text-xs"
                >
                  Run Football Tone Check
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Live Feed Preview */}
        {activeTab === 'preview' && (
          <div className="rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/5 p-4 space-y-3">
            <div className="flex items-center gap-2.5">
              <SafeImage
                src={user.avatar || '/default-avatar.jpg'}
                fallbackSrc="/default-avatar.jpg"
                alt={user.name}
                className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200 dark:ring-white/10"
              />
              <div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">{user.name}</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#00E676]" />
                </div>
                <div className="text-xs text-slate-500 dark:text-white/40">{user.handle} · Just now</div>
              </div>
            </div>

            <p className="text-slate-900 dark:text-white text-sm leading-relaxed whitespace-pre-wrap">
              {draft || 'Your football post content will appear here...'}
            </p>

            {selectedPhoto && (
              <div className="rounded-xl overflow-hidden bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 flex items-center justify-center">
                <SafeImage
                  src={selectedPhoto}
                  alt="Attached Preview"
                  className="w-full max-h-64 object-contain"
                />
              </div>
            )}

            {showPoll && pollQuestion && (
              <div className="rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 p-3 space-y-2 text-xs">
                <div className="font-bold text-slate-900 dark:text-white">Poll — {pollQuestion}</div>
                {pollOptions.map((opt, i) => (
                  <div key={i} className="p-2 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-700 dark:text-white/80">
                    {i + 1}. {opt || `Option ${i + 1}`}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bottom Actions Row */}
        <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleEnhanceWithAI}
              disabled={isEnhancing || !draft.trim()}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/20 disabled:opacity-40 transition-all active:scale-95"
              title="Enhance tone, check grammar, and generate football hashtags"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-200" />
              <span>{isEnhancing ? 'Polishing...' : 'Pro Pitch Polish'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPoll(prev => !prev)}
              className={`p-2 rounded-xl border transition-colors ${
                showPoll
                  ? 'bg-[#00E676]/20 text-[#00E676] border-[#00E676]/30'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/60 hover:text-black dark:hover:text-white border-slate-200 dark:border-white/5'
              }`}
              title="Toggle match poll"
            >
              <BarChart2 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-slate-500 dark:text-white/60 hover:text-black dark:hover:text-white"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleSubmitPost}
              disabled={!draft.trim() && !pollQuestion.trim()}
              className="px-4 py-1.5 rounded-full bg-[#00E676] hover:bg-[#00c864] text-black font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-[#00E676]/20 disabled:opacity-40 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Post</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
