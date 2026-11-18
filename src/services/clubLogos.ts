/**
 * Original Heraldic Football Club & Tournament Shield Generator
 * Uses 100% original geometric SVG crests with club colors & initials.
 * Google Play Store Copyright-Compliant: Zero third-party trademarked logos or external crest CDNs.
 */

export interface ClubInfo {
  name: string;
  shortName: string;
  logo: string;
  primaryColor: string;
  secondaryColor: string;
  country: string;
}

/**
 * Generates an SVG Data URL with the club's initials and a styled heraldic crest shield.
 * Handles light primary colors gracefully with high-contrast dark inner sheen.
 */
export function generateShieldLogo(name: string, primaryColor = '#1e293b', secondaryColor = '#00E676'): string {
  const words = name.replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/).filter(Boolean);
  const initials = words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : (name.substring(0, 3) || 'FC').toUpperCase();

  const upperPrimary = primaryColor.toUpperCase();
  const isVeryLightPrimary =
    upperPrimary === '#FFFFFF' ||
    upperPrimary === '#FFE600' ||
    upperPrimary === '#FDE100' ||
    upperPrimary === '#FFCC00' ||
    upperPrimary === '#F7B5CD';

  const gradTop = isVeryLightPrimary ? '#16202A' : primaryColor;
  const gradBottom = '#0B1016';
  const accentColor = isVeryLightPrimary ? primaryColor : secondaryColor;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${gradTop}"/>
        <stop offset="100%" stop-color="${gradBottom}"/>
      </linearGradient>
      <linearGradient id="rim" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${accentColor}"/>
        <stop offset="100%" stop-color="#00E676"/>
      </linearGradient>
    </defs>
    <path d="M 50,4 C 75,4 92,16 92,38 C 92,68 50,96 50,96 C 50,96 8,68 8,38 C 8,16 25,4 50,4 Z" fill="url(#g)" stroke="url(#rim)" stroke-width="4.5" stroke-linejoin="round"/>
    <path d="M 50,14 L 54,23 L 64,24 L 56,31 L 58,41 L 50,36 L 42,41 L 44,31 L 36,24 L 46,23 Z" fill="${accentColor}" opacity="0.35"/>
    <text x="50" y="65" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="28" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">${initials}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

interface ClubPaletteEntry {
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  country: string;
}

const CLUB_PALETTES: Record<string, ClubPaletteEntry> = {
  // Premier League
  arsenal: { name: 'Arsenal', shortName: 'ARS', primaryColor: '#EF0107', secondaryColor: '#063672', country: 'England' },
  'manchester city': { name: 'Manchester City', shortName: 'MCI', primaryColor: '#6CABDD', secondaryColor: '#1C2C5B', country: 'England' },
  'man city': { name: 'Manchester City', shortName: 'MCI', primaryColor: '#6CABDD', secondaryColor: '#1C2C5B', country: 'England' },
  'manchester united': { name: 'Manchester United', shortName: 'MUN', primaryColor: '#DA291C', secondaryColor: '#FBE122', country: 'England' },
  'man united': { name: 'Manchester United', shortName: 'MUN', primaryColor: '#DA291C', secondaryColor: '#FBE122', country: 'England' },
  liverpool: { name: 'Liverpool', shortName: 'LIV', primaryColor: '#C8102E', secondaryColor: '#00B2A9', country: 'England' },
  chelsea: { name: 'Chelsea', shortName: 'CHE', primaryColor: '#034694', secondaryColor: '#EE242C', country: 'England' },
  tottenham: { name: 'Tottenham Hotspur', shortName: 'TOT', primaryColor: '#132257', secondaryColor: '#FFFFFF', country: 'England' },
  'aston villa': { name: 'Aston Villa', shortName: 'AVL', primaryColor: '#670E36', secondaryColor: '#95BFE5', country: 'England' },
  newcastle: { name: 'Newcastle United', shortName: 'NEW', primaryColor: '#241F20', secondaryColor: '#41B6E6', country: 'England' },

  // La Liga
  barcelona: { name: 'FC Barcelona', shortName: 'BAR', primaryColor: '#004D98', secondaryColor: '#A50044', country: 'Spain' },
  'fc barcelona': { name: 'FC Barcelona', shortName: 'BAR', primaryColor: '#004D98', secondaryColor: '#A50044', country: 'Spain' },
  'real madrid': { name: 'Real Madrid', shortName: 'RMA', primaryColor: '#FFFFFF', secondaryColor: '#EE8707', country: 'Spain' },
  'atletico madrid': { name: 'Atlético Madrid', shortName: 'ATM', primaryColor: '#CB3524', secondaryColor: '#272E61', country: 'Spain' },
  villarreal: { name: 'Villarreal CF', shortName: 'VIL', primaryColor: '#FFE600', secondaryColor: '#00519E', country: 'Spain' },

  // Bundesliga
  'bayern munich': { name: 'Bayern München', shortName: 'BAY', primaryColor: '#DC052D', secondaryColor: '#0066B2', country: 'Germany' },
  'bayern münchen': { name: 'Bayern München', shortName: 'BAY', primaryColor: '#DC052D', secondaryColor: '#0066B2', country: 'Germany' },
  dortmund: { name: 'Borussia Dortmund', shortName: 'BVB', primaryColor: '#FDE100', secondaryColor: '#000000', country: 'Germany' },
  leverkusen: { name: 'Bayer 04 Leverkusen', shortName: 'B04', primaryColor: '#E32221', secondaryColor: '#000000', country: 'Germany' },
  stuttgart: { name: 'VfB Stuttgart', shortName: 'VFB', primaryColor: '#E32219', secondaryColor: '#FFFFFF', country: 'Germany' },

  // Serie A
  inter: { name: 'Inter Milan', shortName: 'INT', primaryColor: '#001EA0', secondaryColor: '#000000', country: 'Italy' },
  'ac milan': { name: 'AC Milan', shortName: 'MIL', primaryColor: '#FB090B', secondaryColor: '#000000', country: 'Italy' },
  juventus: { name: 'Juventus', shortName: 'JUV', primaryColor: '#1E293B', secondaryColor: '#FFFFFF', country: 'Italy' },
  napoli: { name: 'Napoli', shortName: 'NAP', primaryColor: '#12A0D7', secondaryColor: '#FFFFFF', country: 'Italy' },
  roma: { name: 'AS Roma', shortName: 'ROM', primaryColor: '#8E1F2F', secondaryColor: '#F0BC42', country: 'Italy' },

  // Ligue 1
  psg: { name: 'Paris Saint-Germain', shortName: 'PSG', primaryColor: '#004170', secondaryColor: '#DA291C', country: 'France' },
  'paris saint germain': { name: 'Paris Saint-Germain', shortName: 'PSG', primaryColor: '#004170', secondaryColor: '#DA291C', country: 'France' },
  lille: { name: 'Lille OSC', shortName: 'LOSC', primaryColor: '#E01E13', secondaryColor: '#1B2444', country: 'France' },

  // Other Top European & Global Clubs
  salzburg: { name: 'FC Red Bull Salzburg', shortName: 'RBS', primaryColor: '#CC0000', secondaryColor: '#FFFFFF', country: 'Austria' },
  genk: { name: 'KRC Genk', shortName: 'GNK', primaryColor: '#005CA9', secondaryColor: '#FFFFFF', country: 'Belgium' },
  'sporting cp': { name: 'Sporting CP', shortName: 'SCP', primaryColor: '#008057', secondaryColor: '#FFFFFF', country: 'Portugal' },
  benfica: { name: 'SL Benfica', shortName: 'SLB', primaryColor: '#CC0000', secondaryColor: '#FFFFFF', country: 'Portugal' },
  porto: { name: 'FC Porto', shortName: 'FCP', primaryColor: '#0038A8', secondaryColor: '#FFFFFF', country: 'Portugal' },
  feyenoord: { name: 'Feyenoord Rotterdam', shortName: 'FEY', primaryColor: '#EE2E24', secondaryColor: '#FFFFFF', country: 'Netherlands' },
  ajax: { name: 'AFC Ajax', shortName: 'AJX', primaryColor: '#D2122E', secondaryColor: '#FFFFFF', country: 'Netherlands' },
  galatasaray: { name: 'Galatasaray', shortName: 'GAL', primaryColor: '#A90432', secondaryColor: '#FDB912', country: 'Turkey' },
  fenerbahce: { name: 'Fenerbahçe', shortName: 'FEN', primaryColor: '#002D72', secondaryColor: '#FFED00', country: 'Turkey' },
  shakhtar: { name: 'Shakhtar Donetsk', shortName: 'SHK', primaryColor: '#F58220', secondaryColor: '#000000', country: 'Ukraine' },
  'shakhtar donetsk': { name: 'Shakhtar Donetsk', shortName: 'SHK', primaryColor: '#F58220', secondaryColor: '#000000', country: 'Ukraine' },
  'inter miami': { name: 'Inter Miami CF', shortName: 'MIA', primaryColor: '#F7B5CD', secondaryColor: '#231F20', country: 'USA' },
  'al hilal': { name: 'Al-Hilal', shortName: 'HIL', primaryColor: '#002B7F', secondaryColor: '#FFFFFF', country: 'Saudi Arabia' },
  'al nassr': { name: 'Al-Nassr', shortName: 'NAS', primaryColor: '#FFCC00', secondaryColor: '#002B7F', country: 'Saudi Arabia' },
};

export const KNOWN_CLUB_LOGOS: Record<string, ClubInfo> = Object.fromEntries(
  Object.entries(CLUB_PALETTES).map(([k, entry]) => [
    k,
    {
      ...entry,
      logo: generateShieldLogo(entry.name, entry.primaryColor, entry.secondaryColor),
    },
  ])
);

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
 * Resolves an original copyright-safe heraldic shield logo from club name.
 */
export function getClubLogo(name: string, _rawId?: string | number): string {
  if (!name) return generateShieldLogo('FC');

  const key = cleanClubKey(name);
  if (KNOWN_CLUB_LOGOS[key]) {
    return KNOWN_CLUB_LOGOS[key].logo;
  }

  for (const [k, val] of Object.entries(KNOWN_CLUB_LOGOS)) {
    if (key && (key.includes(k) || k.includes(key))) {
      return val.logo;
    }
  }

  return generateShieldLogo(name);
}
