/**
 * Verified Real Football Club & Tournament Crests Dictionary
 * Uses official Wikimedia / FotMob / SportsDB transparent PNG and SVG CDN URLs.
 * Never outputs a generic ball emoji.
 */

export interface ClubInfo {
  name: string;
  shortName: string;
  logo: string;
  primaryColor: string;
  secondaryColor: string;
  country: string;
}

export const KNOWN_CLUB_LOGOS: Record<string, ClubInfo> = {
  // Premier League
  arsenal: {
    name: 'Arsenal',
    shortName: 'ARS',
    logo: 'https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg',
    primaryColor: '#EF0107',
    secondaryColor: '#063672',
    country: 'England',
  },
  'manchester city': {
    name: 'Manchester City',
    shortName: 'MCI',
    logo: 'https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg',
    primaryColor: '#6CABDD',
    secondaryColor: '#1C2C5B',
    country: 'England',
  },
  'man city': {
    name: 'Manchester City',
    shortName: 'MCI',
    logo: 'https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg',
    primaryColor: '#6CABDD',
    secondaryColor: '#1C2C5B',
    country: 'England',
  },
  'manchester united': {
    name: 'Manchester United',
    shortName: 'MUN',
    logo: 'https://upload.wikimedia.org/wikipedia/en/7/7a/Manchester_United_FC_crest.svg',
    primaryColor: '#DA291C',
    secondaryColor: '#FBE122',
    country: 'England',
  },
  'man united': {
    name: 'Manchester United',
    shortName: 'MUN',
    logo: 'https://upload.wikimedia.org/wikipedia/en/7/7a/Manchester_United_FC_crest.svg',
    primaryColor: '#DA291C',
    secondaryColor: '#FBE122',
    country: 'England',
  },
  liverpool: {
    name: 'Liverpool',
    shortName: 'LIV',
    logo: 'https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg',
    primaryColor: '#C8102E',
    secondaryColor: '#00B2A9',
    country: 'England',
  },
  chelsea: {
    name: 'Chelsea',
    shortName: 'CHE',
    logo: 'https://upload.wikimedia.org/wikipedia/en/c/cc/Chelsea_FC.svg',
    primaryColor: '#034694',
    secondaryColor: '#EE242C',
    country: 'England',
  },
  tottenham: {
    name: 'Tottenham Hotspur',
    shortName: 'TOT',
    logo: 'https://upload.wikimedia.org/wikipedia/en/b/b4/Tottenham_Hotspur.svg',
    primaryColor: '#132257',
    secondaryColor: '#FFFFFF',
    country: 'England',
  },
  'aston villa': {
    name: 'Aston Villa',
    shortName: 'AVL',
    logo: 'https://upload.wikimedia.org/wikipedia/en/f/f9/Aston_Villa_FC_crest_%282016%29.svg',
    primaryColor: '#95BFE5',
    secondaryColor: '#670E36',
    country: 'England',
  },
  newcastle: {
    name: 'Newcastle United',
    shortName: 'NEW',
    logo: 'https://upload.wikimedia.org/wikipedia/en/5/56/Newcastle_United_Logo.svg',
    primaryColor: '#241F20',
    secondaryColor: '#41B6E6',
    country: 'England',
  },

  // La Liga
  barcelona: {
    name: 'FC Barcelona',
    shortName: 'BAR',
    logo: 'https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg',
    primaryColor: '#004D98',
    secondaryColor: '#A50044',
    country: 'Spain',
  },
  'fc barcelona': {
    name: 'FC Barcelona',
    shortName: 'BAR',
    logo: 'https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg',
    primaryColor: '#004D98',
    secondaryColor: '#A50044',
    country: 'Spain',
  },
  'real madrid': {
    name: 'Real Madrid',
    shortName: 'RMA',
    logo: 'https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg',
    primaryColor: '#FFFFFF',
    secondaryColor: '#EE8707',
    country: 'Spain',
  },
  'atletico madrid': {
    name: 'Atlético Madrid',
    shortName: 'ATM',
    logo: 'https://upload.wikimedia.org/wikipedia/en/f/f4/Atletico_Madrid_2017_logo.svg',
    primaryColor: '#CB3524',
    secondaryColor: '#272E61',
    country: 'Spain',
  },
  villarreal: {
    name: 'Villarreal CF',
    shortName: 'VIL',
    logo: 'https://upload.wikimedia.org/wikipedia/en/7/70/Villarreal_CF_logo.svg',
    primaryColor: '#FFE600',
    secondaryColor: '#00519E',
    country: 'Spain',
  },

  // Bundesliga
  'bayern munich': {
    name: 'Bayern München',
    shortName: 'BAY',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg',
    primaryColor: '#DC052D',
    secondaryColor: '#0066B2',
    country: 'Germany',
  },
  'bayern münchen': {
    name: 'Bayern München',
    shortName: 'BAY',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg',
    primaryColor: '#DC052D',
    secondaryColor: '#0066B2',
    country: 'Germany',
  },
  dortmund: {
    name: 'Borussia Dortmund',
    shortName: 'BVB',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/6/67/Borussia_Dortmund_logo.svg',
    primaryColor: '#FDE100',
    secondaryColor: '#000000',
    country: 'Germany',
  },
  leverkusen: {
    name: 'Bayer 04 Leverkusen',
    shortName: 'B04',
    logo: 'https://upload.wikimedia.org/wikipedia/en/5/59/Bayer_04_Leverkusen_logo.svg',
    primaryColor: '#E32221',
    secondaryColor: '#000000',
    country: 'Germany',
  },
  stuttgart: {
    name: 'VfB Stuttgart',
    shortName: 'VFB',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/e/eb/VfB_Stuttgart_1893_Logo.svg',
    primaryColor: '#E32219',
    secondaryColor: '#FFFFFF',
    country: 'Germany',
  },

  // Serie A
  inter: {
    name: 'Inter Milan',
    shortName: 'INT',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/0/05/FC_Internazionale_Milano_2021.svg',
    primaryColor: '#001EA0',
    secondaryColor: '#000000',
    country: 'Italy',
  },
  'ac milan': {
    name: 'AC Milan',
    shortName: 'MIL',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Logo_of_AC_Milan.svg',
    primaryColor: '#FB090B',
    secondaryColor: '#000000',
    country: 'Italy',
  },
  juventus: {
    name: 'Juventus',
    shortName: 'JUV',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/b/bc/Juventus_FC_2017_icon_%28black%29.svg',
    primaryColor: '#000000',
    secondaryColor: '#FFFFFF',
    country: 'Italy',
  },
  napoli: {
    name: 'Napoli',
    shortName: 'NAP',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/b/ba/SSC_Neapel.svg',
    primaryColor: '#12A0D7',
    secondaryColor: '#FFFFFF',
    country: 'Italy',
  },
  roma: {
    name: 'AS Roma',
    shortName: 'ROM',
    logo: 'https://upload.wikimedia.org/wikipedia/en/f/f7/AS_Roma_logo_%282017%29.svg',
    primaryColor: '#8E1F2F',
    secondaryColor: '#F0BC42',
    country: 'Italy',
  },

  // Ligue 1
  psg: {
    name: 'Paris Saint-Germain',
    shortName: 'PSG',
    logo: 'https://upload.wikimedia.org/wikipedia/en/a/a7/Paris_Saint-Germain_F.C..svg',
    primaryColor: '#004170',
    secondaryColor: '#DA291C',
    country: 'France',
  },
  'paris saint germain': {
    name: 'Paris Saint-Germain',
    shortName: 'PSG',
    logo: 'https://upload.wikimedia.org/wikipedia/en/a/a7/Paris_Saint-Germain_F.C..svg',
    primaryColor: '#004170',
    secondaryColor: '#DA291C',
    country: 'France',
  },
  lille: {
    name: 'Lille OSC',
    shortName: 'LOSC',
    logo: 'https://upload.wikimedia.org/wikipedia/en/6/6f/Lille_OSC_2018_logo.svg',
    primaryColor: '#E01E13',
    secondaryColor: '#1B2444',
    country: 'France',
  },

  // Other Top European & Global Clubs
  salzburg: {
    name: 'FC Red Bull Salzburg',
    shortName: 'RBS',
    logo: 'https://upload.wikimedia.org/wikipedia/en/7/77/FC_Red_Bull_Salzburg_logo.svg',
    primaryColor: '#CC0000',
    secondaryColor: '#FFFFFF',
    country: 'Austria',
  },
  genk: {
    name: 'KRC Genk',
    shortName: 'GNK',
    logo: 'https://upload.wikimedia.org/wikipedia/en/f/f1/KRC_Genk_logo_2016.svg',
    primaryColor: '#005CA9',
    secondaryColor: '#FFFFFF',
    country: 'Belgium',
  },
  'sporting cp': {
    name: 'Sporting CP',
    shortName: 'SCP',
    logo: 'https://upload.wikimedia.org/wikipedia/en/e/e1/Sporting_Clube_de_Portugal_%28Logo%29.svg',
    primaryColor: '#008057',
    secondaryColor: '#FFFFFF',
    country: 'Portugal',
  },
  benfica: {
    name: 'SL Benfica',
    shortName: 'SLB',
    logo: 'https://upload.wikimedia.org/wikipedia/en/a/a2/SL_Benfica_logo.svg',
    primaryColor: '#FF0000',
    secondaryColor: '#FFFFFF',
    country: 'Portugal',
  },
  porto: {
    name: 'FC Porto',
    shortName: 'FCP',
    logo: 'https://upload.wikimedia.org/wikipedia/en/f/f1/FC_Porto.svg',
    primaryColor: '#0038A8',
    secondaryColor: '#FFFFFF',
    country: 'Portugal',
  },
  feyenoord: {
    name: 'Feyenoord Rotterdam',
    shortName: 'FEY',
    logo: 'https://upload.wikimedia.org/wikipedia/en/8/87/Feyenoord_Rotterdam_logo.svg',
    primaryColor: '#EE2E24',
    secondaryColor: '#FFFFFF',
    country: 'Netherlands',
  },
  ajax: {
    name: 'AFC Ajax',
    shortName: 'AJX',
    logo: 'https://upload.wikimedia.org/wikipedia/en/7/79/Ajax_Amsterdam.svg',
    primaryColor: '#D2122E',
    secondaryColor: '#FFFFFF',
    country: 'Netherlands',
  },
  galatasaray: {
    name: 'Galatasaray',
    shortName: 'GAL',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/f/f6/Galatasaray_Sports_Club_Logo.svg',
    primaryColor: '#A90432',
    secondaryColor: '#FDB912',
    country: 'Turkey',
  },
  fenerbahce: {
    name: 'Fenerbahçe',
    shortName: 'FEN',
    logo: 'https://upload.wikimedia.org/wikipedia/en/3/39/Fenerbah%C3%A7e.svg',
    primaryColor: '#002D72',
    secondaryColor: '#FFED00',
    country: 'Turkey',
  },
  shakhtar: {
    name: 'Shakhtar Donetsk',
    shortName: 'SHK',
    logo: 'https://upload.wikimedia.org/wikipedia/en/a/a1/FC_Shakhtar_Donetsk.svg',
    primaryColor: '#F58220',
    secondaryColor: '#000000',
    country: 'Ukraine',
  },
  'shakhtar donetsk': {
    name: 'Shakhtar Donetsk',
    shortName: 'SHK',
    logo: 'https://upload.wikimedia.org/wikipedia/en/a/a1/FC_Shakhtar_Donetsk.svg',
    primaryColor: '#F58220',
    secondaryColor: '#000000',
    country: 'Ukraine',
  },
  'inter miami': {
    name: 'Inter Miami CF',
    shortName: 'MIA',
    logo: 'https://upload.wikimedia.org/wikipedia/en/5/5c/Inter_Miami_CF_logo.svg',
    primaryColor: '#F7B5CD',
    secondaryColor: '#231F20',
    country: 'USA',
  },
  'al hilal': {
    name: 'Al-Hilal',
    shortName: 'HIL',
    logo: 'https://upload.wikimedia.org/wikipedia/en/2/2a/Al_Hilal_SFC_Logo.svg',
    primaryColor: '#002B7F',
    secondaryColor: '#FFFFFF',
    country: 'Saudi Arabia',
  },
  'al nassr': {
    name: 'Al-Nassr',
    shortName: 'NAS',
    logo: 'https://upload.wikimedia.org/wikipedia/en/c/c5/Al-Nassr_FC_Logo.svg',
    primaryColor: '#FFCC00',
    secondaryColor: '#002B7F',
    country: 'Saudi Arabia',
  },
};

/**
 * Normalizes club name for matching.
 */
function cleanClubKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bu19\b|\bu21\b|\bu23\b/g, '')
    .replace(/\bfc\b|\bcf\b|\bafc\b|\bsc\b|\bosc\b|\bssc\b/g, '')
    .trim();
}

/**
 * Generates an SVG Data URL with the club's initials and a styled heraldic crest shield.
 * NEVER a plain generic ball.
 */
export function generateShieldLogo(name: string, primaryColor = '#1e293b', secondaryColor = '#00E676'): string {
  const words = name.replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/);
  const initials = words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : name.substring(0, 3).toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${primaryColor}"/>
        <stop offset="100%" stop-color="#0b1016"/>
      </linearGradient>
      <linearGradient id="rim" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${secondaryColor}"/>
        <stop offset="100%" stop-color="#00E676"/>
      </linearGradient>
    </defs>
    <!-- Heraldic Football Shield -->
    <path d="M 50,4 C 75,4 92,16 92,38 C 92,68 50,96 50,96 C 50,96 8,68 8,38 C 8,16 25,4 50,4 Z" fill="url(#g)" stroke="url(#rim)" stroke-width="4.5" stroke-linejoin="round"/>
    <!-- Subtle Inner Star / Chevron Accent -->
    <path d="M 50,14 L 54,23 L 64,24 L 56,31 L 58,41 L 50,36 L 42,41 L 44,31 L 36,24 L 46,23 Z" fill="${secondaryColor}" opacity="0.3"/>
    <!-- Club Monogram -->
    <text x="50" y="65" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="28" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">${initials}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Resolves a real club crest URL from club name or team ID.
 */
export function getClubLogo(name: string, rawId?: string | number): string {
  if (!name) return generateShieldLogo('FC');

  // Check if rawId matches FotMob image CDN format
  if (rawId && String(rawId).startsWith('team_')) {
    const numId = String(rawId).replace('team_', '');
    return `https://images.fotmob.com/image_resources/logo/teamlogo/${numId}.png`;
  }
  if (rawId && /^\d+$/.test(String(rawId))) {
    return `https://images.fotmob.com/image_resources/logo/teamlogo/${rawId}.png`;
  }

  // Match against known clubs dictionary
  const key = cleanClubKey(name);
  if (KNOWN_CLUB_LOGOS[key]) {
    return KNOWN_CLUB_LOGOS[key].logo;
  }

  // Partial search
  for (const [k, val] of Object.entries(KNOWN_CLUB_LOGOS)) {
    if (key.includes(k) || k.includes(key)) {
      return val.logo;
    }
  }

  // Fallback: Generate real heraldic shield with club initials (never a ball emoji)
  return generateShieldLogo(name);
}
