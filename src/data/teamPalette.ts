/**
 * Every FBS team's two colours, primary then secondary, hand-entered.
 *
 * Not taken from ESPN. The bars used ESPN's `color`/`alternateColor`, and
 * where those clash or where a team's `alternateColor` is a near-duplicate
 * of its primary, the bar fell back to a neutral grey — Florida came out
 * grey against Kentucky, two blues, when Florida's actual second colour is
 * orange and says exactly which team the bar belongs to.
 *
 * So the colours live here, where they can be read and corrected, the same
 * way conference membership does. A school's real second colour is the
 * answer the fallback wants; grey is only ever right for a school whose
 * second colour genuinely is grey or silver — Ohio State, Nevada,
 * Washington State, Memphis, Kansas State, Rice, UNLV, New Mexico, TCU,
 * Air Force.
 *
 * White is a real second colour for a lot of schools and reads fine on a
 * dark panel, so it is used as written rather than avoided.
 */
export interface TeamPalette {
  primary: string
  secondary: string
}

/** Keyed by ESPN team id, the same key everything else here uses. */
export const TEAM_PALETTE: Record<string, TeamPalette> = {
  '2005': { primary: '#003087', secondary: '#8A8B8C' }, // Air Force — blue / silver
  '2006': { primary: '#041E42', secondary: '#A89968' }, // Akron
  '333': { primary: '#9E1B32', secondary: '#FFFFFF' }, // Alabama
  '2026': { primary: '#000000', secondary: '#FFCC00' }, // App State
  '12': { primary: '#AB0520', secondary: '#0C234B' }, // Arizona
  '9': { primary: '#8C1D40', secondary: '#FFC627' }, // Arizona State
  '8': { primary: '#9D2235', secondary: '#FFFFFF' }, // Arkansas
  '2032': { primary: '#CC0000', secondary: '#000000' }, // Arkansas State
  '349': { primary: '#000000', secondary: '#D4BF91' }, // Army
  '2': { primary: '#0C2340', secondary: '#E87722' }, // Auburn — navy / orange
  '2050': { primary: '#BA0C2F', secondary: '#FFFFFF' }, // Ball State
  '239': { primary: '#154734', secondary: '#FFB81C' }, // Baylor — green / gold
  '68': { primary: '#0033A0', secondary: '#D64309' }, // Boise State
  '103': { primary: '#8C2232', secondary: '#BC9B6A' }, // Boston College
  '189': { primary: '#4F2C1D', secondary: '#FE5000' }, // Bowling Green
  '2084': { primary: '#005BBB', secondary: '#FFFFFF' }, // Buffalo
  '252': { primary: '#002E5D', secondary: '#FFFFFF' }, // BYU
  '25': { primary: '#003262', secondary: '#FDB515' }, // California
  '2117': { primary: '#6A0032', secondary: '#FFC82E' }, // Central Michigan
  '2429': { primary: '#046A38', secondary: '#B9975B' }, // Charlotte
  '2132': { primary: '#E00122', secondary: '#000000' }, // Cincinnati
  '228': { primary: '#F56600', secondary: '#522D80' }, // Clemson — orange / purple
  '324': { primary: '#006A65', secondary: '#A27752' }, // Coastal Carolina
  '38': { primary: '#000000', secondary: '#CFB87C' }, // Colorado — black / gold
  '36': { primary: '#1E4D2B', secondary: '#C8C372' }, // Colorado State
  '41': { primary: '#000E2F', secondary: '#FFFFFF' }, // UConn
  '48': { primary: '#00539F', secondary: '#FFD200' }, // Delaware
  '150': { primary: '#001A57', secondary: '#FFFFFF' }, // Duke
  '2199': { primary: '#046A38', secondary: '#FFFFFF' }, // Eastern Michigan
  '151': { primary: '#592A8A', secondary: '#FDC82F' }, // East Carolina
  '2229': { primary: '#081E3F', secondary: '#B6862C' }, // FIU
  '57': { primary: '#0021A5', secondary: '#FA4616' }, // Florida — blue / orange
  '2226': { primary: '#003366', secondary: '#CC0000' }, // Florida Atlantic
  '52': { primary: '#782F40', secondary: '#CEB888' }, // Florida State
  '278': { primary: '#DB0032', secondary: '#002E6D' }, // Fresno State
  '61': { primary: '#BA0C2F', secondary: '#000000' }, // Georgia — red / black
  '290': { primary: '#041E42', secondary: '#A89968' }, // Georgia Southern
  '2247': { primary: '#0039A6', secondary: '#CC0000' }, // Georgia State
  '59': { primary: '#B3A369', secondary: '#003057' }, // Georgia Tech
  '62': { primary: '#024731', secondary: '#FFFFFF' }, // Hawai'i
  '248': { primary: '#C8102E', secondary: '#FFFFFF' }, // Houston
  '356': { primary: '#E84A27', secondary: '#13294B' }, // Illinois
  '84': { primary: '#990000', secondary: '#FFFFFF' }, // Indiana
  '2294': { primary: '#000000', secondary: '#FFCD00' }, // Iowa — black / gold
  '66': { primary: '#C8102E', secondary: '#F1BE48' }, // Iowa State
  '55': { primary: '#CC0000', secondary: '#FFFFFF' }, // Jacksonville State
  '256': { primary: '#450084', secondary: '#CBB677' }, // James Madison
  '2305': { primary: '#0051BA', secondary: '#E8000D' }, // Kansas
  '2306': { primary: '#512888', secondary: '#D1D1D1' }, // Kansas State — purple / silver
  '338': { primary: '#000000', secondary: '#FFC72C' }, // Kennesaw State
  '2309': { primary: '#002664', secondary: '#EAAB00' }, // Kent State
  '96': { primary: '#0033A0', secondary: '#FFFFFF' }, // Kentucky — blue / white
  '2335': { primary: '#C41230', secondary: '#0A254E' }, // Liberty
  '309': { primary: '#CE181E', secondary: '#000000' }, // Louisiana
  '2348': { primary: '#002F8B', secondary: '#E31B23' }, // Louisiana Tech
  '97': { primary: '#AD0000', secondary: '#000000' }, // Louisville
  '99': { primary: '#461D7C', secondary: '#FDD023' }, // LSU — purple / gold
  '276': { primary: '#00B140', secondary: '#FFFFFF' }, // Marshall
  '120': { primary: '#E03A3E', secondary: '#FFD520' }, // Maryland
  '235': { primary: '#003087', secondary: '#898D8D' }, // Memphis — blue / gray
  '2390': { primary: '#F47321', secondary: '#005030' }, // Miami — orange / green
  '193': { primary: '#C41230', secondary: '#FFFFFF' }, // Miami (OH)
  '130': { primary: '#00274C', secondary: '#FFCB05' }, // Michigan — navy / maize
  '127': { primary: '#18453B', secondary: '#FFFFFF' }, // Michigan State
  '2393': { primary: '#0066CC', secondary: '#FFFFFF' }, // Middle Tennessee
  '135': { primary: '#7A0019', secondary: '#FFCC33' }, // Minnesota
  '344': { primary: '#660000', secondary: '#FFFFFF' }, // Mississippi State
  '142': { primary: '#000000', secondary: '#F1B82D' }, // Missouri — black / gold
  '2623': { primary: '#5E0009', secondary: '#FFFFFF' }, // Missouri State
  '2426': { primary: '#00205B', secondary: '#C5B783' }, // Navy — navy / gold
  '152': { primary: '#CC0000', secondary: '#000000' }, // NC State
  '158': { primary: '#E41C38', secondary: '#FFFFFF' }, // Nebraska
  '2440': { primary: '#003366', secondary: '#807F84' }, // Nevada — blue / silver
  '167': { primary: '#BA0C2F', secondary: '#63666A' }, // New Mexico — cherry / silver
  '166': { primary: '#8C0B42', secondary: '#FFFFFF' }, // New Mexico State
  '153': { primary: '#7BAFD4', secondary: '#13294B' }, // North Carolina
  '2449': { primary: '#009639', secondary: '#FFCD00' }, // North Dakota State
  '249': { primary: '#00853E', secondary: '#FFFFFF' }, // North Texas
  '2459': { primary: '#BA0C2F', secondary: '#000000' }, // Northern Illinois
  '77': { primary: '#4E2A84', secondary: '#FFFFFF' }, // Northwestern
  '87': { primary: '#0C2340', secondary: '#C99700' }, // Notre Dame — navy / gold
  '195': { primary: '#00694E', secondary: '#FFFFFF' }, // Ohio
  '194': { primary: '#BB0000', secondary: '#666666' }, // Ohio State — scarlet / gray
  '201': { primary: '#841617', secondary: '#FDF9D8' }, // Oklahoma — crimson / cream
  '197': { primary: '#FF7300', secondary: '#000000' }, // Oklahoma State
  '295': { primary: '#003057', secondary: '#A1D2F1' }, // Old Dominion
  '145': { primary: '#14213D', secondary: '#CE1126' }, // Ole Miss — navy / red
  '2483': { primary: '#154733', secondary: '#FEE123' }, // Oregon — green / yellow
  '204': { primary: '#DC4405', secondary: '#000000' }, // Oregon State
  '213': { primary: '#041E42', secondary: '#FFFFFF' }, // Penn State
  '221': { primary: '#003594', secondary: '#FFB81C' }, // Pittsburgh
  '2509': { primary: '#000000', secondary: '#CEB888' }, // Purdue — black / old gold
  '242': { primary: '#00205B', secondary: '#C1C6C8' }, // Rice — blue / gray
  '164': { primary: '#CC0033', secondary: '#000000' }, // Rutgers
  '2534': { primary: '#F56600', secondary: '#FFFFFF' }, // Sam Houston
  '21': { primary: '#A6192E', secondary: '#000000' }, // San Diego State
  '23': { primary: '#0055A2', secondary: '#E5A823' }, // San Jose State
  '2567': { primary: '#C8102E', secondary: '#0033A0' }, // SMU — red / blue
  '6': { primary: '#A6093D', secondary: '#003E51' }, // South Alabama
  '2579': { primary: '#73000A', secondary: '#000000' }, // South Carolina
  '2572': { primary: '#FFAB00', secondary: '#000000' }, // Southern Miss
  '24': { primary: '#8C1515', secondary: '#FFFFFF' }, // Stanford
  '183': { primary: '#D44500', secondary: '#000E54' }, // Syracuse — orange / navy
  '2628': { primary: '#4D1979', secondary: '#A3A9AC' }, // TCU — purple / silver
  '218': { primary: '#9E1B32', secondary: '#FFFFFF' }, // Temple
  '2633': { primary: '#FF8200', secondary: '#FFFFFF' }, // Tennessee
  '251': { primary: '#BF5700', secondary: '#FFFFFF' }, // Texas
  '245': { primary: '#500000', secondary: '#FFFFFF' }, // Texas A&M
  '326': { primary: '#501214', secondary: '#AB9253' }, // Texas State
  '2641': { primary: '#CC0000', secondary: '#000000' }, // Texas Tech
  '2649': { primary: '#003E7E', secondary: '#FFCD00' }, // Toledo
  '2653': { primary: '#8A1F2D', secondary: '#A2AAAD' }, // Troy — cardinal / silver
  '2655': { primary: '#006747', secondary: '#418FDE' }, // Tulane — green / sky
  '202': { primary: '#002D72', secondary: '#C8102E' }, // Tulsa
  '5': { primary: '#1E6B52', secondary: '#F4C300' }, // UAB — green / gold
  '2116': { primary: '#000000', secondary: '#FFC904' }, // UCF — black / gold
  '26': { primary: '#2D68C4', secondary: '#F2A900' }, // UCLA — blue / gold
  '2433': { primary: '#840029', secondary: '#FFB300' }, // UL Monroe
  '113': { primary: '#881C1C', secondary: '#FFFFFF' }, // UMass
  '2439': { primary: '#CF0A2C', secondary: '#666666' }, // UNLV — scarlet / gray
  '30': { primary: '#990000', secondary: '#FFC72C' }, // USC — cardinal / gold
  '58': { primary: '#006747', secondary: '#CFC493' }, // USF
  '254': { primary: '#CC0000', secondary: '#FFFFFF' }, // Utah
  '328': { primary: '#00263A', secondary: '#FFFFFF' }, // Utah State
  '2638': { primary: '#041E42', secondary: '#FF8200' }, // UTEP — navy / orange
  '2636': { primary: '#002A5C', secondary: '#F15A22' }, // UTSA — navy / orange
  '238': { primary: '#000000', secondary: '#866D4B' }, // Vanderbilt — black / gold
  '258': { primary: '#E57200', secondary: '#232D4B' }, // Virginia — orange / navy
  '259': { primary: '#630031', secondary: '#CF4420' }, // Virginia Tech — maroon / orange
  '154': { primary: '#9E7E38', secondary: '#000000' }, // Wake Forest
  '264': { primary: '#4B2E83', secondary: '#B7A57A' }, // Washington — purple / gold
  '265': { primary: '#981E32', secondary: '#5E6A71' }, // Washington State — crimson / gray
  '277': { primary: '#002855', secondary: '#EAAA00' }, // West Virginia — navy / gold
  '98': { primary: '#C60C30', secondary: '#FFFFFF' }, // Western Kentucky
  '2711': { primary: '#6C4023', secondary: '#B5A268' }, // Western Michigan
}

export function paletteFor(teamId: string | undefined): TeamPalette | undefined {
  return teamId ? TEAM_PALETTE[teamId] : undefined
}
