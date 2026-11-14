import React, { useState, useRef, useEffect } from 'react';
import { Zap, Send, ShieldCheck, Trash2, X, Copy, Check } from 'lucide-react';
import { askFootballAi } from '../../services/footballAi';
import { useFootball } from '../../context/FootballContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

const STORAGE_KEY = 'futfield_ai_scout_history';

export const AIAssistantDrawer: React.FC<Props> = ({ isOpen, onClose }) => {
  const { user, matches, addFanPoints } = useFootball();

  const welcomeMsg = (name: string): ChatMessage => ({
    id: 'm0',
    sender: 'ai',
    text: `Hello ${name}! I am your FUTFIELD Tactical Scout. Ask me about tactical breakdowns, live match predictions, VAR rules, player stats, or club histories.`,
    timestamp: 'Ready',
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [welcomeMsg(user.name)];
  });

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {}
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, loading]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const liveMatchPrompts = matches.slice(0, 2).map(
    m => `Tactical breakdown: ${m.homeTeam.name} vs ${m.awayTeam.name} (${m.homeTeam.score}-${m.awayTeam.score})`
  );

  const quickPrompts = [
    ...liveMatchPrompts,
    'Analyze El Clásico tactics',
    'How does Semi-Automated VAR work?',
    'Compare Saka vs Yamal stats',
  ];

  const handleSend = async (questionText?: string) => {
    const textToSend = questionText || input;
    if (!textToSend.trim() || loading) return;

    const nowLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: nowLabel,
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await askFootballAi(textToSend);
      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        sender: 'ai',
        text: response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, aiMsg]);
      addFanPoints(10, 'Consulted Football AI');
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: `ai_${Date.now()}`,
          sender: 'ai',
          text: 'I could not reach the tactical server right now. Ask another football question!',
          timestamp: nowLabel,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    const fresh = [welcomeMsg(user.name)];
    setMessages(fresh);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch {}
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex justify-end animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-[#161b22] border-l border-slate-200 dark:border-white/10 h-full flex flex-col justify-between shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50 dark:bg-[#0d1117]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-black font-extrabold">
              <Zap className="w-4 h-4 fill-black" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">FUTFIELD Tactical Scout</h3>
              <span className="text-[11px] text-emerald-700 dark:text-[#00E676] font-semibold">
                Live Pitch Analytics · Saved locally
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleClearHistory}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-white/50 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-white/5"
              title="Reset conversation"
              aria-label="Clear chat history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-white/50 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-white/5"
              aria-label="Close Tactical Scout"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar bg-slate-50/50 dark:bg-transparent">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] ${
                  msg.sender === 'user'
                    ? 'bg-[#00E676] text-black font-bold'
                    : 'bg-emerald-500/20 text-emerald-700 dark:text-[#00E676] border border-[#00E676]/30'
                }`}
              >
                {msg.sender === 'user' ? 'ME' : <ShieldCheck className="w-4 h-4" />}
              </div>

              <div className="max-w-[85%] space-y-1">
                <div
                  className={`p-3 rounded-2xl text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-[#00E676] text-black font-semibold'
                      : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-800 dark:text-white/90 shadow-xs whitespace-pre-line'
                  }`}
                >
                  {msg.text}
                </div>
                {msg.sender === 'ai' && (
                  <div className="flex items-center gap-2 px-1 text-[10px] text-slate-400 dark:text-white/40">
                    <span>{msg.timestamp}</span>
                    <button
                      onClick={() => handleCopyMessage(msg.id, msg.text)}
                      className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-white transition-colors"
                    >
                      {copiedId === msg.id ? <Check className="w-3 h-3 text-[#00E676]" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-transparent max-w-[75%] text-xs text-slate-600 dark:text-white/60">
              <Zap className="w-3.5 h-3.5 text-[#00E676] shrink-0" />
              <span>Analyzing football stats and live pitch data...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Live & Tactical Prompts */}
        <div className="px-4 py-2 bg-slate-100 dark:bg-black/30 border-t border-slate-200 dark:border-white/5 overflow-x-auto no-scrollbar flex items-center gap-2">
          {quickPrompts.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              className="min-h-[36px] px-3 py-1 rounded-full bg-white dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/80 hover:text-black dark:hover:text-white text-[11px] whitespace-nowrap transition-colors shrink-0"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3 bg-slate-50 dark:bg-[#0d1117] border-t border-slate-200 dark:border-white/10 flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Ask about tactics, clubs, players, or rules..."
            value={input}
            onChange={e => setInput(e.target.value)}
            className="flex-1 min-h-[44px] bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus:outline-none focus:border-[#00E676]/50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-[#00E676] hover:bg-[#00c864] text-black disabled:opacity-40 transition-all"
            aria-label="Send question"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
