import React, { useEffect, useMemo, useState } from 'react';
import {
  Shield,
  FileText,
  LifeBuoy,
  BookOpen,
  MessageSquare,
  Mail,
  RefreshCw,
  Users,
  Cookie,
  Search,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Send,
  ExternalLink,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Lock,
} from 'lucide-react';
import { useFootball, SupportLegalSection } from '../../context/FootballContext';
import { formatTodayFull, formatTodayShort } from '../../utils/dateFormat';
import { haptics } from '../../utils/haptics';
import {
  SupportTicket,
  fetchSupportTickets,
  submitSupportTicket,
  updateSupportTicketStatus,
} from '../../services/supabaseClient';

const SUPPORT_EMAIL = 'futfieldsport@gmail.com';

interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

interface ResourceGuide {
  id: string;
  category: string;
  readTime: string;
  title: string;
  summary: string;
  steps: string[];
  actionLabel?: string;
  actionTab?: 'home' | 'scores' | 'videos' | 'studio' | 'settings' | 'pricing';
}

export const SupportLegalHub: React.FC = () => {
  const {
    user,
    supportSection,
    setSupportSection,
    supportPrefillCategory,
    setActiveTab,
    goBack,
    addNotification,
    setPricingModalOpen,
  } = useFootball();

  const todayFull = useMemo(() => formatTodayFull(), []);
  const todayShort = useMemo(() => formatTodayShort(), []);

  // Customer Support state
  const [faqSearch, setFaqSearch] = useState('');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>('faq_uploads');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  // Resource Center state
  const [resourceSearch, setResourceSearch] = useState('');
  const [expandedGuideId, setExpandedGuideId] = useState<string | null>('res_futfield_tube');

  // Contact Support Form state
  const [contactName, setContactName] = useState(user.name || '');
  const [contactEmail, setContactEmail] = useState(user.email || '');
  const [contactCategory, setContactCategory] = useState(supportPrefillCategory || 'General Inquiry');
  const [contactPriority, setContactPriority] = useState<'Normal' | 'High' | 'Urgent'>('Normal');
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [submittingContact, setSubmittingContact] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [submittedReceipt, setSubmittedReceipt] = useState<SupportTicket | null>(null);

  // Email Support Desk state
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [emailName, setEmailName] = useState(user.name || '');
  const [emailReplyTo, setEmailReplyTo] = useState(user.email || '');
  const [emailTopic, setEmailTopic] = useState('Account & Matchday Support');
  const [emailBody, setEmailBody] = useState('');
  const [submittingEmail, setSubmittingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailReceipt, setEmailReceipt] = useState<SupportTicket | null>(null);

  useEffect(() => {
    if (supportPrefillCategory) {
      setContactCategory(supportPrefillCategory);
    }
  }, [supportPrefillCategory]);

  useEffect(() => {
    if (!contactEmail && user.email) setContactEmail(user.email);
    if (!contactName && user.name) setContactName(user.name);
    if (!emailReplyTo && user.email) setEmailReplyTo(user.email);
    if (!emailName && user.name) setEmailName(user.name);
  }, [user.email, user.name]);

  const loadTickets = async () => {
    setTicketsLoading(true);
    const list = await fetchSupportTickets(user.id);
    setTickets(list);
    setTicketsLoading(false);
  };

  useEffect(() => {
    if (supportSection === 'support' || supportSection === 'contact' || supportSection === 'email') {
      loadTickets();
    }
  }, [supportSection, user.id]);

  const sections: Array<{
    id: SupportLegalSection;
    label: string;
    icon: React.FC<{ className?: string }>;
  }> = [
    { id: 'support', label: 'Customer Support', icon: LifeBuoy },
    { id: 'resources', label: 'Resources', icon: BookOpen },
    { id: 'contact', label: 'Contact Support', icon: MessageSquare },
    { id: 'email', label: 'Email Support', icon: Mail },
    { id: 'privacy', label: 'Privacy Policy', icon: Shield },
    { id: 'terms', label: 'Terms of Use', icon: FileText },
    { id: 'refund', label: 'Refund Policy', icon: RefreshCw },
    { id: 'guidelines', label: 'Safety & Rules', icon: Users },
    { id: 'cookies', label: 'Cookies & Data', icon: Cookie },
  ];

  const faqItems: FAQItem[] = [
    {
      id: 'faq_uploads',
      category: 'Media & Futfield Tube',
      question: 'How do image and video uploads process on the backend?',
      answer:
        'Every image and clip uploaded through FUTFIELD streams as binary bytes directly to /api/media/upload on our backend server. While uploading, you see the Uploading status until MediaGuard verifies format, duration, and copyright rules and confirms UPLOADED.',
    },
    {
      id: 'faq_scores',
      category: 'Live Scores',
      question: 'Why do live match fixtures update instantaneously?',
      answer:
        'FUTFIELD uses a fast dual-layer fixture engine with non-blocking timeout protection and instant offline cache fallback, so tapping the Scores tab renders fixtures immediately while syncing live matchday updates in the background.',
    },
    {
      id: 'faq_rivalry',
      category: 'Match Rooms',
      question: 'How does the Match Room Rivalry Intensity thermometer work?',
      answer:
        'As fans representing opposing clubs send messages and reactions inside a live Match Room, the Rivalry Intensity thermometer measures rival banter velocity and reaction surges in real time—without inflated mock viewer counts.',
    },
    {
      id: 'faq_billing',
      category: 'Paystack Billing',
      question: 'How do Paystack Pro Passes, cancellations, and refunds work?',
      answer:
        'You can choose Matchday Pro ($12 USD / 1 month), Club VIP ($25 USD / 3 months), or Championship Season ($36 USD / 5 months). Paystack automatically converts your local currency based on your IP location while USD rates remain fixed. Duplicate charges reported within 48 hours via Contact Support or futfieldsport@gmail.com are refunded in 3-5 business days.',
    },
    {
      id: 'faq_points',
      category: 'Fan Points & Badges',
      question: 'How do I unlock the Verified Blue Check and earn Fan Points?',
      answer:
        'Earn +20 FP for publishing a Futfield Tube clip or Quick Kick, +10 FP for a match post, +30 FP for exporting a Studio thumbnail, and +5 FP for interacting with fans. Reaching 500 FP unlocks your Verified Fan milestone badge.',
    },
  ];

  const filteredFaqs = faqItems.filter(item => {
    const q = faqSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      item.question.toLowerCase().includes(q) ||
      item.answer.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

  const resourceGuides: ResourceGuide[] = [
    {
      id: 'res_futfield_tube',
      category: 'Creator Guide',
      readTime: '4 min read',
      title: 'Futfield Tube 9:16 Quick Kicks, 16:9 Clips & Sound Sync Guide',
      summary:
        'Best practices for publishing 9:16 vertical Quick Kicks (≤ 60s) and 16:9 football clips with MediaGuard copyright checks.',
      steps: [
        'Use the Post Composer on Home or the Futfield Tube upload flow to pick a photo or football clip.',
        'Watch the upload status bar while binary bytes stream directly to the backend /api/media/upload endpoint.',
        'Wait for UPLOADED confirmation—MediaGuard scans copyright & format rules on the backend automatically.',
        'Your content immediately goes live in Home or Futfield Tube for fans worldwide.',
      ],
      actionLabel: 'Open Futfield Tube',
      actionTab: 'videos',
    },
    {
      id: 'res_matchroom',
      category: 'Community Playbook',
      readTime: '3 min read',
      title: 'Live Match Rooms, Real-Time Presence & Rivalry Intensity',
      summary:
        'Understand how real-time chat presence, reaction bursts, pinned callouts, and the Rivalry Intensity thermometer operate.',
      steps: [
        'Open any live or scheduled fixture in the Scores tab to enter its dedicated Match Room.',
        'Active viewer counts reflect real joined room sessions only—zero simulated numbers.',
        'Send banter, club reactions, voice notes, or polls; opposing club engagement raises the Rivalry Intensity thermometer dynamically.',
        'Smart anti-abuse filtering protects every room so rivalry stays passionate and respectful.',
      ],
      actionLabel: 'Go to Live Scores',
      actionTab: 'scores',
    },
    {
      id: 'res_studio',
      category: 'Creator Monetization',
      readTime: '5 min read',
      title: 'Creator Studio, Fan Points & Verification Checklist',
      summary:
        'Turn tactical breakdowns and matchday highlights into Fan Points, audience growth, and creator payouts.',
      steps: [
        'Design custom matchday thumbnails or upload video reels inside FUTFIELD Studio.',
        'Collect +20 FP per uploaded reel, +10 FP per post, and +5 FP on engaged comments.',
        'Reach 500 Fan Points to unlock Verified Creator status across posts, reels, and profiles.',
        'Connect your payout email inside Creator Monetization to receive stadium gifts.',
      ],
      actionLabel: 'Open Creator Studio',
      actionTab: 'studio',
    },
    {
      id: 'res_paystack',
      category: 'Billing & Security',
      readTime: '3 min read',
      title: 'Paystack Pro Pass Security, Local Currency & Receipts',
      summary:
        'Everything you need to know about worldwide Paystack checkout encryption, currency conversion, and pass expiration.',
      steps: [
        'All checkouts run through Paystack with 256-bit PCI-DSS Level 1 encryption—FUTFIELD never stores raw card numbers.',
        'Prices convert automatically into NGN, USD, GBP, EUR, and local currencies at checkout.',
        'Passes remain active for their exact prepaid duration (1 month, 3 months, or 5 months) without surprise hidden fees.',
        'Contact futfieldsport@gmail.com within 48 hours for rapid resolution on any duplicate charge.',
      ],
      actionLabel: 'View Pro Plans',
      actionTab: 'pricing',
    },
    {
      id: 'res_privacy_controls',
      category: 'Safety & Privacy',
      readTime: '3 min read',
      title: 'Account Privacy, DM Controls & Data Saving Mode',
      summary:
        'Configure who can message you, switch Data Saving Mode for mobile networks, or manage profile records.',
      steps: [
        'Open Settings > Privacy & Safety to restrict direct messages to All Fans, Followers Only, or Verified Only.',
        'Enable Data & Offline Mode in Settings to compress thumbnails and cache fixtures for low-bandwidth stadiums.',
        'Use the Contact Support form or Email Support at any time to request a copy or deletion of your account data.',
      ],
      actionLabel: 'Open Settings',
      actionTab: 'settings',
    },
  ];

  const filteredGuides = resourceGuides.filter(g => {
    const q = resourceSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      g.title.toLowerCase().includes(q) ||
      g.summary.toLowerCase().includes(q) ||
      g.category.toLowerCase().includes(q)
    );
  });

  const handleCopyEmail = () => {
    haptics.light();
    try {
      navigator.clipboard?.writeText(SUPPORT_EMAIL);
    } catch {}
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  const handleSubmitContactForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError(null);
    if (!contactEmail.trim() || !contactSubject.trim() || !contactMessage.trim()) {
      setContactError('Please enter your email, subject, and message details.');
      return;
    }

    setSubmittingContact(true);
    const res = await submitSupportTicket({
      userId: user.id,
      name: contactName.trim() || user.name || 'FUTFIELD Member',
      email: contactEmail.trim(),
      category: contactCategory,
      priority: contactPriority,
      subject: contactSubject.trim(),
      message: contactMessage.trim(),
      channel: 'contact_form',
    });
    setSubmittingContact(false);

    if (res.success && res.ticket) {
      haptics.success();
      setSubmittedReceipt(res.ticket);
      setContactSubject('');
      setContactMessage('');
      loadTickets();
      addNotification({
        title: `Support Ticket ${res.ticket.referenceCode}`,
        body: `Received on ${todayShort}. We will reply to ${res.ticket.email}.`,
        type: 'system',
      });
    } else {
      setContactError(res.error || 'Could not send support request. Please try again.');
    }
  };

  const handleDispatchEmailSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    if (!emailReplyTo.trim() || !emailTopic.trim() || !emailBody.trim()) {
      setEmailError('Please fill in your reply-to email, subject, and message.');
      return;
    }

    setSubmittingEmail(true);
    const res = await submitSupportTicket({
      userId: user.id,
      name: emailName.trim() || user.name || 'FUTFIELD Member',
      email: emailReplyTo.trim(),
      category: 'Email Support Desk',
      priority: 'Normal',
      subject: emailTopic.trim(),
      message: emailBody.trim(),
      channel: 'email_desk',
    });
    setSubmittingEmail(false);

    if (res.success && res.ticket) {
      haptics.success();
      setEmailReceipt(res.ticket);
      setEmailBody('');
      loadTickets();
      addNotification({
        title: `Email Dispatched (${res.ticket.referenceCode})`,
        body: `Routed to ${SUPPORT_EMAIL} on ${todayShort}.`,
        type: 'system',
      });
    } else {
      setEmailError(res.error || 'Unable to log email dispatch.');
    }
  };

  const handleToggleTicketStatus = async (ticket: SupportTicket) => {
    haptics.light();
    const nextStatus = ticket.status === 'Resolved' ? 'Open' : 'Resolved';
    const res = await updateSupportTicketStatus(ticket.id, nextStatus);
    if (res.success && res.ticket) {
      setTickets(prev => prev.map(t => (t.id === ticket.id ? res.ticket! : t)));
    }
  };

  const mailtoHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    `[FUTFIELD Support - ${todayShort}] ${emailTopic || 'Member Inquiry'}`
  )}&body=${encodeURIComponent(
    `Name: ${emailName || user.name}\nAccount Handle: ${user.handle}\nDate: ${todayFull}\n\n${emailBody || 'Hello FUTFIELD Support Team,'}`
  )}`;

  const sectionTitleMap: Record<SupportLegalSection, { title: string; subtitle: string }> = {
    support: {
      title: 'Customer Support Center',
      subtitle: `Help Desk Active · Updated ${todayFull}`,
    },
    resources: {
      title: 'FUTFIELD Resource Center',
      subtitle: `Playbooks & Platform Guides · Published ${todayFull}`,
    },
    contact: {
      title: 'Contact Support',
      subtitle: `Direct Ticket Desk · Open ${todayFull}`,
    },
    email: {
      title: 'Email Support',
      subtitle: `${SUPPORT_EMAIL} · Active ${todayFull}`,
    },
    privacy: {
      title: 'Privacy Policy',
      subtitle: `Effective ${todayFull} · Last Updated ${todayFull}`,
    },
    terms: {
      title: 'Terms of Use',
      subtitle: `Effective ${todayFull} · Last Updated ${todayFull}`,
    },
    refund: {
      title: 'Refund & Billing Policy',
      subtitle: `Effective ${todayFull} · Paystack Merchant Verified`,
    },
    guidelines: {
      title: 'Community Safety & Guidelines',
      subtitle: `Updated ${todayFull} · Fair Play Charter`,
    },
    cookies: {
      title: 'Cookie & Local Storage Policy',
      subtitle: `Updated ${todayFull} · Storage Transparency`,
    },
  };

  const currentMeta = sectionTitleMap[supportSection] || sectionTitleMap.support;

  return (
    <div className="pb-24 max-w-2xl mx-auto px-3 sm:px-4 pt-3 space-y-4">
      {/* Header Bar with Return & Today's Date */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => {
              haptics.light();
              goBack();
            }}
            className="min-h-[44px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-800 dark:text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-white/70 tabular-nums">
            <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-[#00E676]" />
            <span>{todayFull}</span>
          </div>
        </div>

        <div className="space-y-1">
          <h1 className="font-display text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {currentMeta.title}
          </h1>
          <p className="text-xs font-medium text-slate-500 dark:text-white/60">
            {currentMeta.subtitle}
          </p>
        </div>

        {/* Interactive Stacked Navigation Switcher */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          {sections.map(sec => {
            const Icon = sec.icon;
            const active = supportSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => {
                  haptics.light();
                  setSupportSection(sec.id);
                }}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all shrink-0 ${
                  active
                    ? 'bg-slate-900 text-white dark:bg-[#00E676] dark:text-black font-extrabold shadow-sm'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white/75 hover:bg-slate-200 dark:hover:bg-white/10'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ================================================================= */}
      {/* 1. CUSTOMER SUPPORT CENTER                                        */}
      {/* ================================================================= */}
      {supportSection === 'support' && (
        <div className="space-y-4">
          {/* Quick Support Channels */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              onClick={() => {
                haptics.light();
                setSupportSection('contact');
              }}
              className="min-h-[64px] p-3.5 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 hover:border-[#00E676]/50 text-left space-y-1 transition-all"
            >
              <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900 dark:text-white">
                <MessageSquare className="w-4 h-4 text-[#00E676]" />
                <span>Contact Support</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-white/60">
                Open a tracked support ticket · {todayShort}
              </p>
            </button>

            <button
              onClick={() => {
                haptics.light();
                setSupportSection('email');
              }}
              className="min-h-[64px] p-3.5 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 hover:border-[#00E676]/50 text-left space-y-1 transition-all"
            >
              <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900 dark:text-white">
                <Mail className="w-4 h-4 text-blue-500" />
                <span>Email Support</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-white/60 truncate">
                {SUPPORT_EMAIL}
              </p>
            </button>

            <button
              onClick={() => {
                haptics.light();
                setSupportSection('resources');
              }}
              className="min-h-[64px] p-3.5 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 hover:border-[#00E676]/50 text-left space-y-1 transition-all"
            >
              <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900 dark:text-white">
                <BookOpen className="w-4 h-4 text-amber-500" />
                <span>Resource Center</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-white/60">
                5 platform playbooks · {todayShort}
              </p>
            </button>
          </div>

          {/* Searchable Knowledge Base */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900 dark:text-white">
                Help Knowledge Base
              </h2>
              <span className="text-[11px] text-slate-500 dark:text-white/50">
                Verified {todayShort}
              </span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={faqSearch}
                onChange={e => setFaqSearch(e.target.value)}
                placeholder="Search help articles (uploads, live scores, Paystack, rivalry)..."
                className="w-full min-h-[44px] pl-10 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00E676]"
              />
            </div>

            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {filteredFaqs.map(item => {
                const isOpen = expandedFaqId === item.id;
                return (
                  <div key={item.id} className="py-2.5 first:pt-1 last:pb-0">
                    <button
                      onClick={() => {
                        haptics.light();
                        setExpandedFaqId(isOpen ? null : item.id);
                      }}
                      className="w-full min-h-[44px] flex items-center justify-between gap-3 text-left py-1"
                    >
                      <div className="space-y-0.5">
                        <div className="text-[11px] font-semibold text-emerald-700 dark:text-[#00E676]">
                          {item.category} · Updated {todayShort}
                        </div>
                        <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                          {item.question}
                        </div>
                      </div>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <p className="text-xs text-slate-600 dark:text-white/75 leading-relaxed pt-1.5 pb-1">
                        {item.answer}
                      </p>
                    )}
                  </div>
                );
              })}

              {filteredFaqs.length === 0 && (
                <div className="py-6 text-center space-y-2">
                  <p className="text-xs text-slate-500 dark:text-white/60">
                    No matching articles found for &ldquo;{faqSearch}&rdquo;.
                  </p>
                  <button
                    onClick={() => {
                      setContactSubject(faqSearch);
                      setSupportSection('contact');
                    }}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-[#00E676] text-black font-extrabold text-xs"
                  >
                    Ask Support Directly
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Real Backend Ticket Tracker */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-slate-900 dark:text-white">
                  Your Support Tickets
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-white/50">
                  Real-time ticket log · Synced {todayShort}
                </p>
              </div>
              <button
                onClick={loadTickets}
                className="min-h-[44px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 text-xs font-bold text-slate-700 dark:text-white/80 hover:bg-slate-200 dark:hover:bg-white/10"
              >
                {ticketsLoading ? 'Syncing...' : 'Refresh'}
              </button>
            </div>

            {tickets.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-black/30 border border-slate-200/70 dark:border-white/5 text-center space-y-2">
                <p className="text-xs text-slate-600 dark:text-white/65">
                  You have no open support tickets as of {todayFull}.
                </p>
                <button
                  onClick={() => setSupportSection('contact')}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-[#00E676] dark:text-black font-extrabold text-xs"
                >
                  Create a Support Ticket
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {tickets.map(ticket => (
                  <div key={ticket.id} className="py-3 first:pt-1 last:pb-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {ticket.subject}
                      </span>
                      <button
                        onClick={() => handleToggleTicketStatus(ticket)}
                        className="text-[11px] font-bold text-emerald-700 dark:text-[#00E676] hover:underline shrink-0"
                      >
                        {ticket.status === 'Resolved' ? 'Reopen' : 'Mark Resolved'}
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-white/60">
                      {ticket.referenceCode} · {ticket.status} · {ticket.priority} · {ticket.dateFormatted || todayFull}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-white/75 line-clamp-2">
                      {ticket.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 2. RESOURCE CENTER PAGE                                           */}
      {/* ================================================================= */}
      {supportSection === 'resources' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-slate-900 dark:text-white">
                  Platform Guides & Technical Resources
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-white/55">
                  All documentation reviewed and dated {todayFull}
                </p>
              </div>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={resourceSearch}
                onChange={e => setResourceSearch(e.target.value)}
                placeholder="Filter resources (Futfield Tube, Match Room, Paystack, Privacy)..."
                className="w-full min-h-[44px] pl-10 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00E676]"
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredGuides.map(guide => {
              const isOpen = expandedGuideId === guide.id;
              return (
                <article
                  key={guide.id}
                  className="p-4 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 space-y-2.5"
                >
                  <button
                    onClick={() => {
                      haptics.light();
                      setExpandedGuideId(isOpen ? null : guide.id);
                    }}
                    className="w-full text-left flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-slate-500 dark:text-white/60">
                        {guide.category} · {guide.readTime} · {todayFull}
                      </div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">
                        {guide.title}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-white/75 leading-relaxed">
                        {guide.summary}
                      </p>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-3">
                      <ol className="space-y-2 pl-4 list-decimal text-xs text-slate-700 dark:text-white/80 leading-relaxed">
                        {guide.steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>

                      {guide.actionLabel && guide.actionTab && (
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-slate-400">
                            Updated {todayShort}
                          </span>
                          <button
                            onClick={() => {
                              haptics.light();
                              if (guide.actionTab === 'pricing') {
                                setPricingModalOpen(true);
                              } else {
                                setActiveTab(guide.actionTab!);
                              }
                            }}
                            className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-[#00E676] dark:text-black font-extrabold text-xs"
                          >
                            {guide.actionLabel}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 3. CONTACT SUPPORT PAGE                                           */}
      {/* ================================================================= */}
      {supportSection === 'contact' && (
        <div className="space-y-4">
          {submittedReceipt && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-[#00E676]/40 space-y-2">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
                <CheckCircle2 className="w-5 h-5 text-[#00E676]" />
                <span>Support Ticket Submitted</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-white/80">
                Reference <span className="font-mono font-bold">{submittedReceipt.referenceCode}</span> logged on {submittedReceipt.dateFormatted}. Confirmation will be sent to {submittedReceipt.email}.
              </p>
            </div>
          )}

          <form
            onSubmit={handleSubmitContactForm}
            className="p-4 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-slate-900 dark:text-white">
                  Submit a Support Request
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-white/55">
                  Ticket Timestamp: {todayFull} · Average response within 24 hours
                </p>
              </div>
            </div>

            {contactError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-semibold text-rose-600 dark:text-rose-400">
                {contactError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-white/70">
                  Full Name
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  placeholder="Your name"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00E676]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-white/70">
                  Reply Email Address
                </label>
                <input
                  type="email"
                  required
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00E676]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-white/70">
                  Support Category
                </label>
                <select
                  value={contactCategory}
                  onChange={e => setContactCategory(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00E676]"
                >
                  <option value="General Inquiry">General Inquiry</option>
                  <option value="Account & Login">Account & Login</option>
                  <option value="Billing & Paystack">Billing & Paystack</option>
                  <option value="Media Upload & Storage">Media Upload & Storage</option>
                  <option value="Live Scores & Match Rooms">Live Scores & Match Rooms</option>
                  <option value="Privacy & Data Request">Privacy & Data Request</option>
                  <option value="Safety & Abuse Report">Safety & Abuse Report</option>
                  <option value="Feature Suggestion">Feature Suggestion</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-white/70">
                  Priority
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['Normal', 'High', 'Urgent'] as const).map(level => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => {
                        haptics.light();
                        setContactPriority(level);
                      }}
                      className={`min-h-[44px] rounded-xl text-xs font-bold border transition-all ${
                        contactPriority === level
                          ? 'bg-slate-900 text-white dark:bg-[#00E676] dark:text-black border-transparent font-extrabold'
                          : 'bg-slate-50 dark:bg-black/40 text-slate-600 dark:text-white/70 border-slate-200 dark:border-white/10'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-white/70">
                Subject
              </label>
              <input
                type="text"
                required
                value={contactSubject}
                onChange={e => setContactSubject(e.target.value)}
                placeholder="Brief summary of how we can help"
                className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00E676]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-white/70">
                Message Details
              </label>
              <textarea
                required
                rows={4}
                value={contactMessage}
                onChange={e => setContactMessage(e.target.value)}
                placeholder="Describe your question, match room ID, transaction reference, or upload issue..."
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00E676] resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submittingContact}
              className="w-full min-h-[48px] rounded-xl bg-[#00E676] hover:bg-[#00c864] text-black font-black text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-60"
            >
              <Send className="w-4 h-4" />
              <span>{submittingContact ? 'Submitting Ticket...' : `Submit Support Ticket · ${todayShort}`}</span>
            </button>
          </form>
        </div>
      )}

      {/* ================================================================= */}
      {/* 4. EMAIL SUPPORT PAGE                                             */}
      {/* ================================================================= */}
      {supportSection === 'email' && (
        <div className="space-y-4">
          {/* Direct Email Address Card */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 space-y-3">
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-white/55">
                Official Support Inbox · Active {todayFull}
              </div>
              <h2 className="text-base font-black text-slate-900 dark:text-white break-all">
                {SUPPORT_EMAIL}
              </h2>
              <p className="text-xs text-slate-600 dark:text-white/75 leading-relaxed">
                Reach our team directly for account recovery, Paystack billing receipts, privacy requests, or creator partnerships.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={handleCopyEmail}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-900 dark:text-white text-xs font-extrabold flex items-center justify-center gap-2 transition-all"
              >
                {copiedEmail ? (
                  <>
                    <Check className="w-4 h-4 text-[#00E676]" />
                    <span>Copied {SUPPORT_EMAIL}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Email Address</span>
                  </>
                )}
              </button>

              <a
                href={mailtoHref}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-black text-xs font-extrabold flex items-center justify-center gap-2 hover:opacity-90 transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Mail Client</span>
              </a>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-white/55 pt-1 border-t border-slate-100 dark:border-white/5">
              <Clock className="w-3.5 h-3.5 text-[#00E676]" />
              <span>Support Hours: Daily Matchday Desk · Updated {todayFull}</span>
            </div>
          </div>

          {emailReceipt && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-[#00E676]/40 space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
                <CheckCircle2 className="w-5 h-5 text-[#00E676]" />
                <span>Email Request Routed to {SUPPORT_EMAIL}</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-white/80">
                Reference <span className="font-mono font-bold">{emailReceipt.referenceCode}</span> recorded on {emailReceipt.dateFormatted}.
              </p>
            </div>
          )}

          {/* In-App Email Composer */}
          <form
            onSubmit={handleDispatchEmailSupport}
            className="p-4 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 space-y-3"
          >
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Compose Support Email In-App
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-white/55">
                Dispatches directly to {SUPPORT_EMAIL} with today&apos;s date ({todayShort})
              </p>
            </div>

            {emailError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-semibold text-rose-600 dark:text-rose-400">
                {emailError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={emailName}
                onChange={e => setEmailName(e.target.value)}
                placeholder="Your Name"
                className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00E676]"
              />
              <input
                type="email"
                required
                value={emailReplyTo}
                onChange={e => setEmailReplyTo(e.target.value)}
                placeholder="Your Reply-To Email"
                className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00E676]"
              />
            </div>

            <input
              type="text"
              required
              value={emailTopic}
              onChange={e => setEmailTopic(e.target.value)}
              placeholder="Email Subject"
              className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00E676]"
            />

            <textarea
              required
              rows={4}
              value={emailBody}
              onChange={e => setEmailBody(e.target.value)}
              placeholder="Write your email message to FUTFIELD Support..."
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00E676] resize-none"
            />

            <button
              type="submit"
              disabled={submittingEmail}
              className="w-full min-h-[48px] rounded-xl bg-[#00E676] hover:bg-[#00c864] text-black font-black text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-60"
            >
              <Mail className="w-4 h-4" />
              <span>{submittingEmail ? 'Sending Email...' : `Send Support Email · ${todayShort}`}</span>
            </button>
          </form>
        </div>
      )}

      {/* ================================================================= */}
      {/* 5. PRIVACY POLICY PAGE                                            */}
      {/* ================================================================= */}
      {supportSection === 'privacy' && (
        <article className="p-5 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 space-y-4 text-xs text-slate-700 dark:text-white/80 leading-relaxed">
          <div className="pb-3 border-b border-slate-100 dark:border-white/5 space-y-1">
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              FUTFIELD Privacy Policy
            </h2>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-white/60">
              Effective Date: {todayFull} · Last Updated: {todayFull} · Contact: {SUPPORT_EMAIL}
            </p>
          </div>

          <section className="space-y-1.5">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">
              1. Information We Collect
            </h3>
            <p>
              When you create an account, customize your club badge, post match commentary, or join live Match Rooms on FUTFIELD, we collect your profile name, handle, email address, favorite club and country preferences, and submitted community posts.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">
              2. Media Uploads & Backend Storage Telemetry
            </h3>
            <p>
              Images and Futfield Tube videos you upload are streamed directly to our backend media storage service (/api/media/upload). We measure exact file byte sizes solely to calculate image and video MB totals, enforce fair quotas, and display live engagement analytics (watches, cheers, reactions, shares).
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">
              3. Real-Time Match Rooms & Chat Interactions
            </h3>
            <p>
              Messages, voice clips, polls, and emoji reactions shared in Match Rooms are transmitted over Server-Sent Events (SSE) and synced to provide live fan presence and dynamic Rivalry Intensity measurements.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">
              4. Payments & Paystack Encryption
            </h3>
            <p>
              Pro Pass payments are processed securely by Paystack under 256-bit PCI-DSS Level 1 security standards. FUTFIELD never stores raw credit card numbers or CVV security codes.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">
              5. Your Privacy Rights & Data Controls
            </h3>
            <p>
              As of {todayFull}, you may request access, correction, export, or deletion of your personal data at any time. We never sell personal fan data to third-party data brokers.
            </p>
          </section>

          <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setContactCategory('Privacy & Data Request');
                setContactSubject('Privacy Data Access / Deletion Request');
                setSupportSection('contact');
              }}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-[#00E676] dark:text-black font-extrabold text-xs"
            >
              Submit Privacy Request
            </button>
            <button
              onClick={() => setSupportSection('email')}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-800 dark:text-white font-bold text-xs"
            >
              Email {SUPPORT_EMAIL}
            </button>
          </div>
        </article>
      )}

      {/* ================================================================= */}
      {/* 6. TERMS OF USE PAGE                                              */}
      {/* ================================================================= */}
      {supportSection === 'terms' && (
        <article className="p-5 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 space-y-4 text-xs text-slate-700 dark:text-white/80 leading-relaxed">
          <div className="pb-3 border-b border-slate-100 dark:border-white/5 space-y-1">
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              FUTFIELD Terms of Use
            </h2>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-white/60">
              Effective Date: {todayFull} · Last Updated: {todayFull} · Agreement
            </p>
          </div>

          <section className="space-y-1.5">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">
              1. Acceptance of Terms
            </h3>
            <p>
              By accessing FUTFIELD&apos;s live match centers, Futfield Tube &amp; Quick Kicks hub, Creator Studio, or Fan Communities on or after {todayFull}, you agree to be bound by these Terms of Use and our Privacy Policy.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">
              2. Account Responsibilities &amp; Fair Access
            </h3>
            <p>
              You are responsible for safeguarding your login credentials and ensuring accurate profile details. Free accounts include daily posting, Futfield Tube upload, and match room messaging allowances; Pro Pass plans unlock expanded limits.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">
              3. User Content &amp; Licensing
            </h3>
            <p>
              You retain ownership of original football photos, tactical commentary, and videos you upload. By publishing on FUTFIELD, you grant us a non-exclusive license to host, stream, display, and count engagement metrics across the platform.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">
              4. Prohibited Conduct &amp; Anti-Abuse
            </h3>
            <p>
              Hate speech, racial slurs, targeted harassment, automated spam, unauthorized copyright rebroadcasting, and impersonation are strictly prohibited and subject to immediate suspension.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">
              5. Live Match Data &amp; Availability
            </h3>
            <p>
              Live scores, standings, and statistics are provided for informational and community engagement purposes. While we engineer real-time synchronization and offline caching for speed, FUTFIELD is not liable for third-party feed delays.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">
              6. Google Play Intellectual Property, Non-Affiliation &amp; DMCA Policy
            </h3>
            <p>
              FUTFIELD is an independent football fan community platform and is not affiliated with, endorsed by, or sponsored by FIFA, UEFA, Premier League, La Liga, Serie A, Bundesliga, Ligue 1, or any third-party club or broadcaster. All club emblems displayed on the platform are original geometric heraldic shields generated solely for team identification. Uploaded videos are screened by MediaGuard against protected broadcast rights. To submit a DMCA or copyright takedown notice, email {SUPPORT_EMAIL}.
            </p>
          </section>

          <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500 dark:text-white/55">
              Questions? Contact {SUPPORT_EMAIL}
            </span>
            <button
              onClick={() => setSupportSection('refund')}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white font-bold text-xs"
            >
              Read Refund Policy
            </button>
          </div>
        </article>
      )}

      {/* ================================================================= */}
      {/* 7. REFUND & BILLING POLICY PAGE                                   */}
      {/* ================================================================= */}
      {supportSection === 'refund' && (
        <article className="p-5 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 space-y-4 text-xs text-slate-700 dark:text-white/80 leading-relaxed">
          <div className="pb-3 border-b border-slate-100 dark:border-white/5 space-y-1">
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              Refund, Billing & Cancellation Policy
            </h2>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-white/60">
              Effective Date: {todayFull} · Paystack Merchant Verified
            </p>
          </div>

          <section className="space-y-1.5">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">
              1. Subscription Passes & Local Currency
            </h3>
            <p>
              FUTFIELD offers three prepaid passes: Matchday Pro Pass ($12 / 1 month), Club VIP Ultra Pass ($25 / 3 months), and Championship Season Pass ($36 / 5 months). Local currencies (NGN, GBP, EUR, USD) are converted accurately at checkout via Paystack.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">
              2. Cancellation Policy
            </h3>
            <p>
              Subscriptions expire cleanly at the end of the prepaid period. You can review or manage your pass status anytime inside Settings &gt; Subscription &amp; Pro Pass.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">
              3. Refund Eligibility (48-Hour Billing Protection)
            </h3>
            <p>
              If you encounter a duplicate payment, accidental double checkout, or technical billing error, submit your transaction reference within 48 hours via Contact Support or email {SUPPORT_EMAIL}. Approved refunds settle back to your original payment method in 3–5 business days.
            </p>
          </section>

          <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex flex-wrap gap-2">
            <button
              onClick={() => {
                setContactCategory('Billing & Paystack');
                setContactSubject('Paystack Billing / Refund Inquiry');
                setSupportSection('contact');
              }}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-[#00E676] dark:text-black font-extrabold text-xs"
            >
              Request Billing Assistance
            </button>
          </div>
        </article>
      )}

      {/* ================================================================= */}
      {/* 8. COMMUNITY SAFETY & GUIDELINES PAGE                             */}
      {/* ================================================================= */}
      {supportSection === 'guidelines' && (
        <article className="p-5 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 space-y-4 text-xs text-slate-700 dark:text-white/80 leading-relaxed">
          <div className="pb-3 border-b border-slate-100 dark:border-white/5 space-y-1">
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              Community Safety & Fair Play Guidelines
            </h2>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-white/60">
              Updated: {todayFull} · Applicable Across All Feeds & Match Rooms
            </p>
          </div>

          <section className="space-y-1.5">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">
              1. Passionate Banter, Zero Hate Speech
            </h3>
            <p>
              Matchday rivalry fuels the Rivalry Intensity thermometer—celebrate goals, debate tactics, and support your badge passionately. Racial abuse, discriminatory slurs, personal threats, and doxxing result in immediate removal.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">
              2. Authentic Creator Media
            </h3>
            <p>
              Upload original matchday reactions, tactical breakdowns, training drills, and fan perspective clips. Credit fellow creators when remixing or commenting on shared football analyses.
            </p>
          </section>

          <div className="pt-3 border-t border-slate-100 dark:border-white/5">
            <button
              onClick={() => {
                setContactCategory('Safety & Abuse Report');
                setSupportSection('contact');
              }}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-[#00E676] dark:text-black font-extrabold text-xs"
            >
              Report a Safety Issue
            </button>
          </div>
        </article>
      )}

      {/* ================================================================= */}
      {/* 9. COOKIE & LOCAL STORAGE POLICY PAGE                             */}
      {/* ================================================================= */}
      {supportSection === 'cookies' && (
        <article className="p-5 rounded-2xl bg-white dark:bg-[#12171F] border border-slate-200/90 dark:border-white/8 space-y-4 text-xs text-slate-700 dark:text-white/80 leading-relaxed">
          <div className="pb-3 border-b border-slate-100 dark:border-white/5 space-y-1">
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              Cookie & Local Storage Policy
            </h2>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-white/60">
              Last Audited: {todayFull} · Privacy Transparency
            </p>
          </div>

          <section className="space-y-1.5">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">
              1. Essential Functional Storage
            </h3>
            <p>
              FUTFIELD stores essential local keys such as your preferred light/dark theme (futfield_theme), club accent theme, direct messaging privacy level (futfield_dm_privacy), and cached live match fixtures so pages open instantly even on slow connections.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">
              2. Clearing Local Storage & Cache
            </h3>
            <p>
              You can clear cached application data at any time from Settings &gt; Data &amp; Offline Mode without losing server-persisted media uploads or support tickets.
            </p>
          </section>

          <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 dark:text-white/55 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#00E676]" />
              Verified {todayFull}
            </span>
            <button
              onClick={() => setActiveTab('settings')}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white font-bold text-xs"
            >
              Manage in Settings
            </button>
          </div>
        </article>
      )}
    </div>
  );
};
