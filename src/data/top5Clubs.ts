export interface TopClub {
  id: string;
  name: string;
  shortName: string;
  leagueId: string;
  leagueName: string;
  country: string;
  flag: string;
  theme: 'default' | 'arsenal' | 'barca' | 'madrid' | 'chelsea';
  stadium: string;
  founded: number;
}

export const TOP_5_LEAGUES = [
  { id: 'all', name: 'All Clubs', icon: '🌍' },
  { id: 'pl', name: 'Premier League', icon: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', country: 'England' },
  { id: 'laliga', name: 'La Liga', icon: '🇪🇸', country: 'Spain' },
  { id: 'seriea', name: 'Serie A', icon: '🇮🇹', country: 'Italy' },
  { id: 'bundesliga', name: 'Bundesliga', icon: '🇩🇪', country: 'Germany' },
  { id: 'ligue1', name: 'Ligue 1', icon: '🇫🇷', country: 'France' },
  { id: 'championship', name: 'Championship', icon: '🇬🇧', country: 'England' },
  { id: 'eredivisie', name: 'Eredivisie', icon: '🇳🇱', country: 'Netherlands' },
  { id: 'portugal', name: 'Liga Portugal', icon: '🇵🇹', country: 'Portugal' },
  { id: 'scotland', name: 'Scottish Prem', icon: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', country: 'Scotland' },
  { id: 'npfl', name: 'NPFL Nigeria', icon: '🇳🇬', country: 'Nigeria' },
  { id: 'caf', name: 'Africa & CAF', icon: '🌍', country: 'Africa' },
  { id: 'saudi', name: 'Saudi Pro', icon: '🇸🇦', country: 'Saudi Arabia' },
  { id: 'mls', name: 'MLS', icon: '🇺🇸', country: 'USA' },
  { id: 'brazil', name: 'Brasileirão', icon: '🇧🇷', country: 'Brazil' },
  { id: 'argentina', name: 'Primera Arg', icon: '🇦🇷', country: 'Argentina' },
  { id: 'turkiye', name: 'Süper Lig', icon: '🇹🇷', country: 'Türkiye' },
  { id: 'asia', name: 'Asia & J-League', icon: '🇯🇵', country: 'Japan' },
] as const;

export const ALL_WORLD_LEAGUES = TOP_5_LEAGUES;

export const POPULAR_TOP_5_CLUBS: TopClub[] = [
  // Premier League (20 clubs)
  { id: 'arsenal', name: 'Arsenal', shortName: 'ARS', leagueId: 'pl', leagueName: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', theme: 'arsenal', stadium: 'Emirates Stadium', founded: 1886 },
  { id: 'aston-villa', name: 'Aston Villa', shortName: 'AVL', leagueId: 'pl', leagueName: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', theme: 'chelsea', stadium: 'Villa Park', founded: 1874 },
  { id: 'bournemouth', name: 'AFC Bournemouth', shortName: 'BOU', leagueId: 'pl', leagueName: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', theme: 'arsenal', stadium: 'Vitality Stadium', founded: 1899 },
  { id: 'brentford', name: 'Brentford', shortName: 'BRE', leagueId: 'pl', leagueName: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', theme: 'arsenal', stadium: 'Gtech Community Stadium', founded: 1889 },
  { id: 'brighton', name: 'Brighton & Hove Albion', shortName: 'BHA', leagueId: 'pl', leagueName: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', theme: 'chelsea', stadium: 'Amex Stadium', founded: 1901 },
  { id: 'chelsea', name: 'Chelsea', shortName: 'CHE', leagueId: 'pl', leagueName: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', theme: 'chelsea', stadium: 'Stamford Bridge', founded: 1905 },
  { id: 'crystal-palace', name: 'Crystal Palace', shortName: 'CRY', leagueId: 'pl', leagueName: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', theme: 'barca', stadium: 'Selhurst Park', founded: 1905 },
  { id: 'everton', name: 'Everton', shortName: 'EVE', leagueId: 'pl', leagueName: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', theme: 'chelsea', stadium: 'Goodison Park', founded: 1878 },
  { id: 'fulham', name: 'Fulham', shortName: 'FUL', leagueId: 'pl', leagueName: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', theme: 'default', stadium: 'Craven Cottage', founded: 1879 },
  { id: 'ipswich', name: 'Ipswich Town', shortName: 'IPS', leagueId: 'pl', leagueName: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', theme: 'chelsea', stadium: 'Portman Road', founded: 1878 },
  { id: 'leicester', name: 'Leicester City', shortName: 'LEI', leagueId: 'pl', leagueName: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', theme: 'chelsea', stadium: 'King Power Stadium', founded: 1884 },
  { id: 'liverpool', name: 'Liverpool', shortName: 'LIV', leagueId: 'pl', leagueName: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', theme: 'arsenal', stadium: 'Anfield', founded: 1892 },
  { id: 'manchester-city', name: 'Manchester City', shortName: 'MCI', leagueId: 'pl', leagueName: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', theme: 'default', stadium: 'Etihad Stadium', founded: 1880 },
  { id: 'manchester-united', name: 'Manchester United', shortName: 'MUN', leagueId: 'pl', leagueName: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', theme: 'arsenal', stadium: 'Old Trafford', founded: 1878 },
  { id: 'newcastle', name: 'Newcastle United', shortName: 'NEW', leagueId: 'pl', leagueName: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', theme: 'default', stadium: "St. James' Park", founded: 1892 },
  { id: 'nottingham-forest', name: 'Nottingham Forest', shortName: 'NFO', leagueId: 'pl', leagueName: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', theme: 'arsenal', stadium: 'City Ground', founded: 1865 },
  { id: 'southampton', name: 'Southampton', shortName: 'SOU', leagueId: 'pl', leagueName: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', theme: 'arsenal', stadium: "St Mary's Stadium", founded: 1885 },
  { id: 'tottenham', name: 'Tottenham Hotspur', shortName: 'TOT', leagueId: 'pl', leagueName: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', theme: 'default', stadium: 'Tottenham Hotspur Stadium', founded: 1882 },
  { id: 'west-ham', name: 'West Ham United', shortName: 'WHU', leagueId: 'pl', leagueName: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', theme: 'arsenal', stadium: 'London Stadium', founded: 1895 },
  { id: 'wolves', name: 'Wolverhampton Wanderers', shortName: 'WOL', leagueId: 'pl', leagueName: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', theme: 'madrid', stadium: 'Molineux Stadium', founded: 1877 },

  // La Liga (16 top clubs)
  { id: 'barcelona', name: 'FC Barcelona', shortName: 'BAR', leagueId: 'laliga', leagueName: 'La Liga', country: 'Spain', flag: '🇪🇸', theme: 'barca', stadium: 'Spotify Camp Nou', founded: 1899 },
  { id: 'real-madrid', name: 'Real Madrid', shortName: 'RMA', leagueId: 'laliga', leagueName: 'La Liga', country: 'Spain', flag: '🇪🇸', theme: 'madrid', stadium: 'Santiago Bernabéu', founded: 1902 },
  { id: 'atletico-madrid', name: 'Atletico Madrid', shortName: 'ATM', leagueId: 'laliga', leagueName: 'La Liga', country: 'Spain', flag: '🇪🇸', theme: 'arsenal', stadium: 'Cívitas Metropolitano', founded: 1903 },
  { id: 'athletic-club', name: 'Athletic Club', shortName: 'ATH', leagueId: 'laliga', leagueName: 'La Liga', country: 'Spain', flag: '🇪🇸', theme: 'arsenal', stadium: 'San Mamés', founded: 1898 },
  { id: 'real-sociedad', name: 'Real Sociedad', shortName: 'RSO', leagueId: 'laliga', leagueName: 'La Liga', country: 'Spain', flag: '🇪🇸', theme: 'barca', stadium: 'Reale Arena', founded: 1909 },
  { id: 'villarreal', name: 'Villarreal', shortName: 'VIL', leagueId: 'laliga', leagueName: 'La Liga', country: 'Spain', flag: '🇪🇸', theme: 'madrid', stadium: 'Estadio de la Cerámica', founded: 1923 },
  { id: 'real-betis', name: 'Real Betis', shortName: 'BET', leagueId: 'laliga', leagueName: 'La Liga', country: 'Spain', flag: '🇪🇸', theme: 'default', stadium: 'Benito Villamarín', founded: 1907 },
  { id: 'sevilla', name: 'Sevilla FC', shortName: 'SEV', leagueId: 'laliga', leagueName: 'La Liga', country: 'Spain', flag: '🇪🇸', theme: 'arsenal', stadium: 'Ramón Sánchez-Pizjuán', founded: 1890 },
  { id: 'girona', name: 'Girona FC', shortName: 'GIR', leagueId: 'laliga', leagueName: 'La Liga', country: 'Spain', flag: '🇪🇸', theme: 'arsenal', stadium: 'Montilivi', founded: 1930 },
  { id: 'valencia', name: 'Valencia CF', shortName: 'VAL', leagueId: 'laliga', leagueName: 'La Liga', country: 'Spain', flag: '🇪🇸', theme: 'madrid', stadium: 'Mestalla', founded: 1919 },
  { id: 'celta-vigo', name: 'Celta Vigo', shortName: 'CEL', leagueId: 'laliga', leagueName: 'La Liga', country: 'Spain', flag: '🇪🇸', theme: 'chelsea', stadium: 'Balaídos', founded: 1923 },
  { id: 'osasuna', name: 'CA Osasuna', shortName: 'OSA', leagueId: 'laliga', leagueName: 'La Liga', country: 'Spain', flag: '🇪🇸', theme: 'arsenal', stadium: 'El Sadar', founded: 1920 },
  { id: 'mallorca', name: 'RCD Mallorca', shortName: 'MLL', leagueId: 'laliga', leagueName: 'La Liga', country: 'Spain', flag: '🇪🇸', theme: 'arsenal', stadium: 'Son Moix', founded: 1916 },
  { id: 'getafe', name: 'Getafe CF', shortName: 'GET', leagueId: 'laliga', leagueName: 'La Liga', country: 'Spain', flag: '🇪🇸', theme: 'chelsea', stadium: 'Coliseum', founded: 1983 },

  // Serie A (14 top clubs)
  { id: 'inter-milan', name: 'Inter Milan', shortName: 'INT', leagueId: 'seriea', leagueName: 'Serie A', country: 'Italy', flag: '🇮🇹', theme: 'barca', stadium: 'San Siro', founded: 1908 },
  { id: 'juventus', name: 'Juventus', shortName: 'JUV', leagueId: 'seriea', leagueName: 'Serie A', country: 'Italy', flag: '🇮🇹', theme: 'default', stadium: 'Allianz Stadium', founded: 1897 },
  { id: 'ac-milan', name: 'AC Milan', shortName: 'MIL', leagueId: 'seriea', leagueName: 'Serie A', country: 'Italy', flag: '🇮🇹', theme: 'arsenal', stadium: 'San Siro', founded: 1899 },
  { id: 'napoli', name: 'Napoli', shortName: 'NAP', leagueId: 'seriea', leagueName: 'Serie A', country: 'Italy', flag: '🇮🇹', theme: 'barca', stadium: 'Stadio Diego Armando Maradona', founded: 1926 },
  { id: 'atalanta', name: 'Atalanta', shortName: 'ATA', leagueId: 'seriea', leagueName: 'Serie A', country: 'Italy', flag: '🇮🇹', theme: 'barca', stadium: 'Gewiss Stadium', founded: 1907 },
  { id: 'roma', name: 'AS Roma', shortName: 'ROM', leagueId: 'seriea', leagueName: 'Serie A', country: 'Italy', flag: '🇮🇹', theme: 'madrid', stadium: 'Stadio Olimpico', founded: 1927 },
  { id: 'lazio', name: 'SS Lazio', shortName: 'LAZ', leagueId: 'seriea', leagueName: 'Serie A', country: 'Italy', flag: '🇮🇹', theme: 'chelsea', stadium: 'Stadio Olimpico', founded: 1900 },
  { id: 'fiorentina', name: 'Fiorentina', shortName: 'FIO', leagueId: 'seriea', leagueName: 'Serie A', country: 'Italy', flag: '🇮🇹', theme: 'barca', stadium: 'Artemio Franchi', founded: 1926 },
  { id: 'bologna', name: 'Bologna', shortName: 'BOL', leagueId: 'seriea', leagueName: 'Serie A', country: 'Italy', flag: '🇮🇹', theme: 'arsenal', stadium: "Renato Dall'Ara", founded: 1909 },
  { id: 'torino', name: 'Torino', shortName: 'TOR', leagueId: 'seriea', leagueName: 'Serie A', country: 'Italy', flag: '🇮🇹', theme: 'arsenal', stadium: 'Olimpico Grande Torino', founded: 1906 },

  // Bundesliga (12 top clubs)
  { id: 'bayern-munich', name: 'Bayern Munich', shortName: 'BAY', leagueId: 'bundesliga', leagueName: 'Bundesliga', country: 'Germany', flag: '🇩🇪', theme: 'arsenal', stadium: 'Allianz Arena', founded: 1900 },
  { id: 'bayer-leverkusen', name: 'Bayer Leverkusen', shortName: 'B04', leagueId: 'bundesliga', leagueName: 'Bundesliga', country: 'Germany', flag: '🇩🇪', theme: 'arsenal', stadium: 'BayArena', founded: 1904 },
  { id: 'borussia-dortmund', name: 'Borussia Dortmund', shortName: 'BVB', leagueId: 'bundesliga', leagueName: 'Bundesliga', country: 'Germany', flag: '🇩🇪', theme: 'madrid', stadium: 'Signal Iduna Park', founded: 1909 },
  { id: 'rb-leipzig', name: 'RB Leipzig', shortName: 'RBL', leagueId: 'bundesliga', leagueName: 'Bundesliga', country: 'Germany', flag: '🇩🇪', theme: 'arsenal', stadium: 'Red Bull Arena', founded: 2009 },
  { id: 'eintracht-frankfurt', name: 'Eintracht Frankfurt', shortName: 'SGE', leagueId: 'bundesliga', leagueName: 'Bundesliga', country: 'Germany', flag: '🇩🇪', theme: 'arsenal', stadium: 'Deutsche Bank Park', founded: 1899 },
  { id: 'stuttgart', name: 'VfB Stuttgart', shortName: 'VFB', leagueId: 'bundesliga', leagueName: 'Bundesliga', country: 'Germany', flag: '🇩🇪', theme: 'arsenal', stadium: 'MHPArena', founded: 1893 },
  { id: 'wolfsburg', name: 'VfL Wolfsburg', shortName: 'WOB', leagueId: 'bundesliga', leagueName: 'Bundesliga', country: 'Germany', flag: '🇩🇪', theme: 'default', stadium: 'Volkswagen Arena', founded: 1945 },
  { id: 'monchengladbach', name: 'Borussia Mönchengladbach', shortName: 'BMG', leagueId: 'bundesliga', leagueName: 'Bundesliga', country: 'Germany', flag: '🇩🇪', theme: 'default', stadium: 'Borussia-Park', founded: 1900 },
  { id: 'freiburg', name: 'SC Freiburg', shortName: 'SCF', leagueId: 'bundesliga', leagueName: 'Bundesliga', country: 'Germany', flag: '🇩🇪', theme: 'arsenal', stadium: 'Europa-Park Stadion', founded: 1904 },
  { id: 'werder-bremen', name: 'Werder Bremen', shortName: 'SVW', leagueId: 'bundesliga', leagueName: 'Bundesliga', country: 'Germany', flag: '🇩🇪', theme: 'default', stadium: 'Weserstadion', founded: 1899 },

  // Ligue 1 (10 top clubs)
  { id: 'psg', name: 'Paris Saint-Germain', shortName: 'PSG', leagueId: 'ligue1', leagueName: 'Ligue 1', country: 'France', flag: '🇫🇷', theme: 'chelsea', stadium: 'Parc des Princes', founded: 1970 },
  { id: 'marseille', name: 'Marseille', shortName: 'OM', leagueId: 'ligue1', leagueName: 'Ligue 1', country: 'France', flag: '🇫🇷', theme: 'default', stadium: 'Orange Vélodrome', founded: 1899 },
  { id: 'monaco', name: 'AS Monaco', shortName: 'ASM', leagueId: 'ligue1', leagueName: 'Ligue 1', country: 'France', flag: '🇫🇷', theme: 'arsenal', stadium: 'Stade Louis-II', founded: 1924 },
  { id: 'lyon', name: 'Olympique Lyonnais', shortName: 'OL', leagueId: 'ligue1', leagueName: 'Ligue 1', country: 'France', flag: '🇫🇷', theme: 'barca', stadium: 'Groupama Stadium', founded: 1950 },
  { id: 'lille', name: 'Lille OSC', shortName: 'LOSC', leagueId: 'ligue1', leagueName: 'Ligue 1', country: 'France', flag: '🇫🇷', theme: 'arsenal', stadium: 'Decathlon Arena', founded: 1944 },
  { id: 'nice', name: 'OGC Nice', shortName: 'OGCN', leagueId: 'ligue1', leagueName: 'Ligue 1', country: 'France', flag: '🇫🇷', theme: 'arsenal', stadium: 'Allianz Riviera', founded: 1904 },
  { id: 'lens', name: 'RC Lens', shortName: 'RCL', leagueId: 'ligue1', leagueName: 'Ligue 1', country: 'France', flag: '🇫🇷', theme: 'madrid', stadium: 'Stade Bollaert-Delelis', founded: 1906 },
  { id: 'rennes', name: 'Stade Rennais', shortName: 'SRFC', leagueId: 'ligue1', leagueName: 'Ligue 1', country: 'France', flag: '🇫🇷', theme: 'arsenal', stadium: 'Roazhon Park', founded: 1901 },

  // Championship & Scotland
  { id: 'leeds', name: 'Leeds United', shortName: 'LEE', leagueId: 'championship', leagueName: 'EFL Championship', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', theme: 'madrid', stadium: 'Elland Road', founded: 1919 },
  { id: 'sunderland', name: 'Sunderland', shortName: 'SUN', leagueId: 'championship', leagueName: 'EFL Championship', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', theme: 'arsenal', stadium: 'Stadium of Light', founded: 1879 },
  { id: 'burnley', name: 'Burnley', shortName: 'BUR', leagueId: 'championship', leagueName: 'EFL Championship', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', theme: 'arsenal', stadium: 'Turf Moor', founded: 1882 },
  { id: 'sheffield-united', name: 'Sheffield United', shortName: 'SHU', leagueId: 'championship', leagueName: 'EFL Championship', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', theme: 'arsenal', stadium: 'Bramall Lane', founded: 1889 },
  { id: 'wrexham', name: 'Wrexham', shortName: 'WRX', leagueId: 'championship', leagueName: 'English Football League', country: 'Wales', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', theme: 'arsenal', stadium: 'STōK Cae Ras', founded: 1864 },
  { id: 'celtic', name: 'Celtic', shortName: 'CEL', leagueId: 'scotland', leagueName: 'Scottish Premiership', country: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', theme: 'default', stadium: 'Celtic Park', founded: 1887 },
  { id: 'rangers', name: 'Rangers', shortName: 'RAN', leagueId: 'scotland', leagueName: 'Scottish Premiership', country: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', theme: 'chelsea', stadium: 'Ibrox Stadium', founded: 1872 },

  // Eredivisie & Liga Portugal
  { id: 'ajax', name: 'Ajax', shortName: 'AJA', leagueId: 'eredivisie', leagueName: 'Eredivisie', country: 'Netherlands', flag: '🇳🇱', theme: 'arsenal', stadium: 'Johan Cruyff Arena', founded: 1900 },
  { id: 'psv', name: 'PSV Eindhoven', shortName: 'PSV', leagueId: 'eredivisie', leagueName: 'Eredivisie', country: 'Netherlands', flag: '🇳🇱', theme: 'arsenal', stadium: 'Philips Stadion', founded: 1913 },
  { id: 'feyenoord', name: 'Feyenoord', shortName: 'FEY', leagueId: 'eredivisie', leagueName: 'Eredivisie', country: 'Netherlands', flag: '🇳🇱', theme: 'arsenal', stadium: 'De Kuip', founded: 1908 },
  { id: 'benfica', name: 'SL Benfica', shortName: 'BEN', leagueId: 'portugal', leagueName: 'Liga Portugal', country: 'Portugal', flag: '🇵🇹', theme: 'arsenal', stadium: 'Estádio da Luz', founded: 1904 },
  { id: 'porto', name: 'FC Porto', shortName: 'POR', leagueId: 'portugal', leagueName: 'Liga Portugal', country: 'Portugal', flag: '🇵🇹', theme: 'chelsea', stadium: 'Estádio do Dragão', founded: 1893 },
  { id: 'sporting-cp', name: 'Sporting CP', shortName: 'SCP', leagueId: 'portugal', leagueName: 'Liga Portugal', country: 'Portugal', flag: '🇵🇹', theme: 'default', stadium: 'Estádio José Alvalade', founded: 1906 },

  // NPFL Nigeria
  { id: 'enyimba', name: 'Enyimba International', shortName: 'ENY', leagueId: 'npfl', leagueName: 'NPFL Nigeria', country: 'Nigeria', flag: '🇳🇬', theme: 'chelsea', stadium: 'Enyimba Stadium, Aba', founded: 1976 },
  { id: 'kano-pillars', name: 'Kano Pillars', shortName: 'KAN', leagueId: 'npfl', leagueName: 'NPFL Nigeria', country: 'Nigeria', flag: '🇳🇬', theme: 'default', stadium: 'Sani Abacha Stadium', founded: 1990 },
  { id: 'rivers-united', name: 'Rivers United', shortName: 'RIV', leagueId: 'npfl', leagueName: 'NPFL Nigeria', country: 'Nigeria', flag: '🇳🇬', theme: 'chelsea', stadium: 'Adokiye Amiesimaka Stadium', founded: 2016 },
  { id: 'remo-stars', name: 'Remo Stars', shortName: 'REM', leagueId: 'npfl', leagueName: 'NPFL Nigeria', country: 'Nigeria', flag: '🇳🇬', theme: 'chelsea', stadium: 'Remo Stars Stadium, Ikenne', founded: 2004 },
  { id: 'shooting-stars', name: 'Shooting Stars (3SC)', shortName: '3SC', leagueId: 'npfl', leagueName: 'NPFL Nigeria', country: 'Nigeria', flag: '🇳🇬', theme: 'chelsea', stadium: 'Lekan Salami Stadium, Ibadan', founded: 1950 },
  { id: 'enugu-rangers', name: 'Rangers International', shortName: 'RANG', leagueId: 'npfl', leagueName: 'NPFL Nigeria', country: 'Nigeria', flag: '🇳🇬', theme: 'arsenal', stadium: 'Nnamdi Azikiwe Stadium', founded: 1970 },
  { id: 'plateau-united', name: 'Plateau United', shortName: 'PLA', leagueId: 'npfl', leagueName: 'NPFL Nigeria', country: 'Nigeria', flag: '🇳🇬', theme: 'default', stadium: 'New Jos Stadium', founded: 1975 },

  // Africa & CAF Giants
  { id: 'al-ahly', name: 'Al Ahly SC', shortName: 'AHL', leagueId: 'caf', leagueName: 'Egyptian Premier League', country: 'Egypt', flag: '🇪🇬', theme: 'arsenal', stadium: 'Cairo International Stadium', founded: 1907 },
  { id: 'zamalek', name: 'Zamalek SC', shortName: 'ZAM', leagueId: 'caf', leagueName: 'Egyptian Premier League', country: 'Egypt', flag: '🇪🇬', theme: 'arsenal', stadium: 'Cairo International Stadium', founded: 1911 },
  { id: 'mamelodi-sundowns', name: 'Mamelodi Sundowns', shortName: 'SUN', leagueId: 'caf', leagueName: 'South Africa PSL', country: 'South Africa', flag: '🇿🇦', theme: 'madrid', stadium: 'Loftus Versfeld', founded: 1970 },
  { id: 'kaizer-chiefs', name: 'Kaizer Chiefs', shortName: 'KC', leagueId: 'caf', leagueName: 'South Africa PSL', country: 'South Africa', flag: '🇿🇦', theme: 'madrid', stadium: 'FNB Stadium', founded: 1970 },
  { id: 'orlando-pirates', name: 'Orlando Pirates', shortName: 'OP', leagueId: 'caf', leagueName: 'South Africa PSL', country: 'South Africa', flag: '🇿🇦', theme: 'default', stadium: 'Orlando Stadium', founded: 1937 },
  { id: 'wydad-ac', name: 'Wydad AC', shortName: 'WAC', leagueId: 'caf', leagueName: 'Botola Pro', country: 'Morocco', flag: '🇲🇦', theme: 'arsenal', stadium: 'Stade Mohammed V', founded: 1937 },
  { id: 'raja-ca', name: 'Raja CA', shortName: 'RCA', leagueId: 'caf', leagueName: 'Botola Pro', country: 'Morocco', flag: '🇲🇦', theme: 'default', stadium: 'Stade Mohammed V', founded: 1949 },
  { id: 'hearts-of-oak', name: 'Hearts of Oak', shortName: 'HOO', leagueId: 'caf', leagueName: 'Ghana Premier League', country: 'Ghana', flag: '🇬🇭', theme: 'madrid', stadium: 'Accra Sports Stadium', founded: 1911 },
  { id: 'asante-kotoko', name: 'Asante Kotoko', shortName: 'KOT', leagueId: 'caf', leagueName: 'Ghana Premier League', country: 'Ghana', flag: '🇬🇭', theme: 'arsenal', stadium: 'Baba Yara Stadium', founded: 1935 },
  { id: 'gor-mahia', name: 'Gor Mahia', shortName: 'GOR', leagueId: 'caf', leagueName: 'FKF Premier League', country: 'Kenya', flag: '🇰🇪', theme: 'default', stadium: 'Nyayo Stadium', founded: 1968 },

  // Saudi Pro League
  { id: 'al-nassr', name: 'Al Nassr', shortName: 'NAS', leagueId: 'saudi', leagueName: 'Saudi Pro League', country: 'Saudi Arabia', flag: '🇸🇦', theme: 'madrid', stadium: 'Al-Awwal Park', founded: 1955 },
  { id: 'al-hilal', name: 'Al Hilal', shortName: 'HIL', leagueId: 'saudi', leagueName: 'Saudi Pro League', country: 'Saudi Arabia', flag: '🇸🇦', theme: 'chelsea', stadium: 'Kingdom Arena', founded: 1957 },
  { id: 'al-ittihad', name: 'Al Ittihad', shortName: 'ITT', leagueId: 'saudi', leagueName: 'Saudi Pro League', country: 'Saudi Arabia', flag: '🇸🇦', theme: 'madrid', stadium: 'King Abdullah Sports City', founded: 1927 },
  { id: 'al-ahli-saudi', name: 'Al Ahli Saudi', shortName: 'AHL', leagueId: 'saudi', leagueName: 'Saudi Pro League', country: 'Saudi Arabia', flag: '🇸🇦', theme: 'default', stadium: 'King Abdullah Sports City', founded: 1937 },

  // MLS
  { id: 'inter-miami', name: 'Inter Miami CF', shortName: 'MIA', leagueId: 'mls', leagueName: 'MLS', country: 'United States', flag: '🇺🇸', theme: 'arsenal', stadium: 'Chase Stadium', founded: 2018 },
  { id: 'la-galaxy', name: 'LA Galaxy', shortName: 'LAG', leagueId: 'mls', leagueName: 'MLS', country: 'United States', flag: '🇺🇸', theme: 'chelsea', stadium: 'Dignity Health Sports Park', founded: 1994 },
  { id: 'lafc', name: 'Los Angeles FC', shortName: 'LAFC', leagueId: 'mls', leagueName: 'MLS', country: 'United States', flag: '🇺🇸', theme: 'madrid', stadium: 'BMO Stadium', founded: 2014 },
  { id: 'nycfc', name: 'New York City FC', shortName: 'NYC', leagueId: 'mls', leagueName: 'MLS', country: 'United States', flag: '🇺🇸', theme: 'chelsea', stadium: 'Yankee Stadium', founded: 2013 },
  { id: 'columbus-crew', name: 'Columbus Crew', shortName: 'CLB', leagueId: 'mls', leagueName: 'MLS', country: 'United States', flag: '🇺🇸', theme: 'madrid', stadium: 'Lower.com Field', founded: 1994 },

  // Brasileirão & Argentina
  { id: 'flamengo', name: 'Flamengo', shortName: 'FLA', leagueId: 'brazil', leagueName: 'Brasileirão Série A', country: 'Brazil', flag: '🇧🇷', theme: 'arsenal', stadium: 'Maracanã', founded: 1895 },
  { id: 'palmeiras', name: 'Palmeiras', shortName: 'PAL', leagueId: 'brazil', leagueName: 'Brasileirão Série A', country: 'Brazil', flag: '🇧🇷', theme: 'default', stadium: 'Allianz Parque', founded: 1914 },
  { id: 'sao-paulo', name: 'São Paulo FC', shortName: 'SAO', leagueId: 'brazil', leagueName: 'Brasileirão Série A', country: 'Brazil', flag: '🇧🇷', theme: 'arsenal', stadium: 'MorumBIS', founded: 1930 },
  { id: 'corinthians', name: 'Corinthians', shortName: 'COR', leagueId: 'brazil', leagueName: 'Brasileirão Série A', country: 'Brazil', flag: '🇧🇷', theme: 'default', stadium: 'Neo Química Arena', founded: 1910 },
  { id: 'botafogo', name: 'Botafogo', shortName: 'BOT', leagueId: 'brazil', leagueName: 'Brasileirão Série A', country: 'Brazil', flag: '🇧🇷', theme: 'default', stadium: 'Nilton Santos', founded: 1904 },
  { id: 'boca-juniors', name: 'Boca Juniors', shortName: 'BOC', leagueId: 'argentina', leagueName: 'Liga Profesional', country: 'Argentina', flag: '🇦🇷', theme: 'madrid', stadium: 'La Bombonera', founded: 1905 },
  { id: 'river-plate', name: 'River Plate', shortName: 'RIV', leagueId: 'argentina', leagueName: 'Liga Profesional', country: 'Argentina', flag: '🇦🇷', theme: 'arsenal', stadium: 'Mâs Monumental', founded: 1901 },
  { id: 'racing-club', name: 'Racing Club', shortName: 'RAC', leagueId: 'argentina', leagueName: 'Liga Profesional', country: 'Argentina', flag: '🇦🇷', theme: 'chelsea', stadium: 'El Cilindro', founded: 1903 },

  // Türkiye & Asia
  { id: 'galatasaray', name: 'Galatasaray', shortName: 'GAL', leagueId: 'turkiye', leagueName: 'Süper Lig', country: 'Türkiye', flag: '🇹🇷', theme: 'madrid', stadium: 'RAMS Park', founded: 1905 },
  { id: 'fenerbahce', name: 'Fenerbahçe', shortName: 'FEN', leagueId: 'turkiye', leagueName: 'Süper Lig', country: 'Türkiye', flag: '🇹🇷', theme: 'madrid', stadium: 'Şükrü Saracoğlu', founded: 1907 },
  { id: 'besiktas', name: 'Beşiktaş', shortName: 'BJK', leagueId: 'turkiye', leagueName: 'Süper Lig', country: 'Türkiye', flag: '🇹🇷', theme: 'default', stadium: 'Tüpraş Stadyumu', founded: 1903 },
  { id: 'vissel-kobe', name: 'Vissel Kobe', shortName: 'VKO', leagueId: 'asia', leagueName: 'J1 League', country: 'Japan', flag: '🇯🇵', theme: 'arsenal', stadium: 'Noevir Stadium', founded: 1966 },
  { id: 'yokohama-fm', name: 'Yokohama F. Marinos', shortName: 'YFM', leagueId: 'asia', leagueName: 'J1 League', country: 'Japan', flag: '🇯🇵', theme: 'chelsea', stadium: 'Nissan Stadium', founded: 1972 },
  { id: 'ulsan-hd', name: 'Ulsan HD', shortName: 'ULS', leagueId: 'asia', leagueName: 'K League 1', country: 'South Korea', flag: '🇰🇷', theme: 'chelsea', stadium: 'Ulsan Munsu Stadium', founded: 1983 },
];

export const ALL_WORLD_CLUBS = POPULAR_TOP_5_CLUBS;
