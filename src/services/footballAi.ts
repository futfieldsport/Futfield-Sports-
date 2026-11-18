import { Match } from '../types/football';

/**
 * Generate an instant AI Match Recap via server-side /api/ai/match-recap
 * Never exposes provider keys directly in the browser.
 */
export async function generateMatchRecap(match: Match): Promise<string> {
  try {
    const res = await fetch('/api/ai/match-recap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.recap) return String(data.recap);
    }
  } catch {
    // fallback below
  }

  const isDraw = match.homeTeam.score === match.awayTeam.score;
  const winner = match.homeTeam.score > match.awayTeam.score ? match.homeTeam.name : match.awayTeam.name;
  return `⚡ **FUTFIELD AI MATCH RECAP**

${isDraw ? `An enthralling tactical stalemate at ${match.venue}! Both ${match.homeTeam.name} and ${match.awayTeam.name} traded heavy blows in a high-intensity duel.` : `A commanding showcase from ${winner}! Sharp transitional counter-attacks broke the deadlock and punished defensive gaps.`}

🔥 **Decisive Turning Point:** The high-tempo midfield press generated ${match.stats.shots[0] + match.stats.shots[1]} total shots, with ${match.events.find(e => e.type === 'goal')?.player || 'the frontline'} displaying lethal clinical precision inside the box.

⭐ **Tactical Takeaway:** ${match.homeTeam.name} dominated the ball (${match.stats.possession[0]}% possession) while ${match.awayTeam.name} looked dangerous on quick vertical breaks. A pulsating contest for football purists!`;
}

/**
 * Ask Football AI Assistant via server-side /api/ai/ask
 */
export async function askFootballAi(question: string, context?: string): Promise<string> {
  try {
    const res = await fetch('/api/ai/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, context }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.answer) return String(data.answer);
    }
  } catch {
    // fallback below
  }

  const q = question.toLowerCase();
  if (q.includes('el clasico') || q.includes('barca') || q.includes('madrid')) {
    return `⚽ **El Clásico Tactical Breakdown**\n\n• **Midfield Control:** The duel between tempo controllers and driving box-to-box midfielders dictates the entire rhythm.\n• **Flank Threat:** 1v1 take-ons consistently draw double-teams, creating half-spaces for overlapping fullbacks.\n• **Historical Head-to-Head:** Football's fiercest rivalry continues to set global matchday standards.`;
  }
  if (q.includes('offside') || q.includes('var')) {
    return `📐 **Offside & Semi-Automated VAR Rules**\n\n• A player is in an offside position if any part of their head, body, or feet is nearer to the opponents' goal line than both the ball and the second-last opponent.\n• Hands and arms of all players, including goalkeepers, are not considered.\n• Semi-Automated Offside Technology (SAOT) calculates limb positions rapidly for clean decisions.`;
  }
  if (q.includes('haaland') || q.includes('saka') || q.includes('yamal') || q.includes('bellingham')) {
    return `🌟 **Player Scouting Report**\n\n• **Physicality & Finishing:** Elite positioning inside the 18-yard box, averaging high xG per 90 with minimal touches needed.\n• **Work Rate & Pressing:** Modern forwards execute counter-pressing triggers within 3 seconds of possession loss.\n• **Key Metric:** Generating consistent Goal Contributions per 90 minutes in top-flight European football.`;
  }

  return `⚽ **FUTFIELD Football Intelligence**\n\nGreat question! In modern football, spatial dominance between the lines and transitional efficiency define winning squads. Ask me about any match, player comparison, VAR rule, or league table!`;
}

/**
 * AI Post Draft Polish & Hashtags Generator via server-side /api/ai/smart-post-enhance
 */
export async function improvePostDraft(draft: string): Promise<{ text: string; hashtags: string[] }> {
  try {
    const res = await fetch('/api/ai/smart-post-enhance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft, tone: 'tactical' }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.enhancedText) {
        return {
          text: String(data.enhancedText),
          hashtags: Array.isArray(data.hashtags) ? data.hashtags : ['#FUTFIELD', '#Football'],
        };
      }
    }
  } catch {
    // fallback below
  }

  return {
    text: `${draft.trim()} 🔥 The intensity this season is unmatched. What are your thoughts?`,
    hashtags: ['#FUTFIELD', '#Football', '#Matchday', '#FansVoice'],
  };
}

/**
 * AI Match Prediction Analysis via server-side /api/ai/match-prediction
 */
export async function analyzeMatchPrediction(homeTeam: string, awayTeam: string, league: string): Promise<{
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  predictedScore: string;
  keyFactors: string[];
}> {
  try {
    const res = await fetch('/api/ai/match-prediction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ homeTeam, awayTeam, league }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.prediction) {
        return {
          homeWinPct: Number(data.prediction.homeWinPct) || 45,
          drawPct: Number(data.prediction.drawPct) || 25,
          awayWinPct: Number(data.prediction.awayWinPct) || 30,
          predictedScore: String(data.prediction.predictedScore || '2 - 1'),
          keyFactors: Array.isArray(data.prediction.keyBattles)
            ? data.prediction.keyBattles
            : ['Midfield control', 'Flank attacking threat', 'Defensive transitions'],
        };
      }
    }
  } catch {
    // fallback
  }

  return {
    homeWinPct: 52,
    drawPct: 24,
    awayWinPct: 24,
    predictedScore: '2 - 1',
    keyFactors: [
      `${homeTeam}'s superior home fortress record`,
      `Midfield duel and high-press battle in central areas`,
      `Set-piece delivery into the opponent's 6-yard box`,
    ],
  };
}

/**
 * Translate post via server-side /api/ai/translate
 */
export async function translateText(text: string, targetLanguage = 'English'): Promise<string> {
  try {
    const res = await fetch('/api/ai/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLanguage }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.translatedText) return String(data.translatedText);
    }
  } catch {
    // fallback
  }
  return text;
}
