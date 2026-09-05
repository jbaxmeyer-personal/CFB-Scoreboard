// FBS conference membership, keyed by ESPN team id.
//
// Generated from the Dynasty-Tracker project's school table, which already
// carries an ESPN team id and a conference for every FBS program. Slate used
// to build this at runtime by walking ESPN's core API — a request for the
// conference list plus one per conference — on a response shape that could
// not be checked from the build environment. A static table is faster, works
// offline, and is verifiable by reading it.
//
// Alignment is current as of the 2026 season: Oregon, USC, UCLA and
// Washington in the Big Ten, Texas and Oklahoma in the SEC, Stanford and SMU
// in the ACC, a rebuilt Pac-12. Realignment happens between seasons, so this
// needs a refresh each year rather than never.
//
// FCS opponents are deliberately absent — they belong to no FBS conference,
// and a game against one still matches on the FBS team's side.

export interface Conference {
  id: string
  name: string
  shortName: string
  teamIds: Set<string>
}

interface ConferenceSeed {
  id: string
  name: string
  shortName: string
  teamIds: string[]
}

/** Power four first, then the rest alphabetically, independents last — the
 * order someone is most likely to want, not the order a machine would sort. */
const CONFERENCE_SEEDS: ConferenceSeed[] = [
  {
    id: "SEC",
    name: "SEC",
    shortName: "SEC",
    // Alabama, Arkansas, Auburn, Florida, Georgia, Kentucky, LSU, Mississippi St, Missouri, Oklahoma, Ole Miss, South Carolina, Tennessee, Texas, Texas A&M, Vanderbilt
    teamIds: ['333', '8', '2', '57', '61', '96', '99', '344', '142', '201', '145', '2579', '2633', '251', '245', '238'],
  },
  {
    id: "Big Ten",
    name: "Big Ten",
    shortName: "B1G",
    // Illinois, Indiana, Iowa, Maryland, Michigan, Michigan State, Minnesota, Nebraska, Northwestern, Ohio State, Oregon, Penn State, Purdue, Rutgers, UCLA, USC, Washington, Wisconsin
    teamIds: ['356', '84', '2294', '120', '130', '127', '135', '158', '77', '194', '2483', '213', '2509', '164', '26', '30', '264', '275'],
  },
  {
    id: "Big 12",
    name: "Big 12",
    shortName: "B12",
    // Arizona, Arizona State, BYU, Baylor, Cincinnati, Colorado, Houston, Iowa State, Kansas, Kansas State, Oklahoma State, TCU, Texas Tech, UCF, Utah, West Virginia
    teamIds: ['12', '9', '252', '239', '2132', '38', '248', '66', '2305', '2306', '197', '2628', '2641', '2116', '254', '277'],
  },
  {
    id: "ACC",
    name: "ACC",
    shortName: "ACC",
    // Boston College, California, Clemson, Duke, Florida State, Georgia Tech, Louisville, Miami, NC State, North Carolina, Pittsburgh, SMU, Stanford, Syracuse, Virginia, Virginia Tech, Wake Forest
    teamIds: ['103', '25', '228', '150', '52', '59', '97', '2390', '152', '153', '221', '2567', '24', '183', '258', '259', '154'],
  },
  {
    id: "AAC",
    name: "AAC",
    shortName: "AAC",
    // Army, Charlotte, East Carolina, Fla Atlantic, Memphis, Navy, North Texas, Rice, Temple, Tulane, Tulsa, UAB, USF, UTSA
    teamIds: ['349', '2429', '151', '2226', '235', '2426', '249', '242', '218', '2655', '202', '5', '58', '2636'],
  },
  {
    id: "CUSA",
    name: "CUSA",
    shortName: "CUSA",
    // Delaware, FIU, Jax State, Kennesaw St., Liberty, Middle Tenn, Missouri State, New Mexico St., Sam Houston, W. Kentucky
    teamIds: ['48', '2229', '55', '338', '2335', '2393', '2623', '166', '2534', '98'],
  },
  {
    id: "MAC",
    name: "MAC",
    shortName: "MAC",
    // Akron, Ball State, Bowling Green, Buffalo, C. Michigan, E. Michigan, Kent State, Miami (OH), Ohio, Toledo, UMass, W. Michigan
    teamIds: ['2006', '2050', '189', '2084', '2117', '2199', '2309', '193', '195', '2649', '113', '2711'],
  },
  {
    id: "Mountain West",
    name: "Mountain West",
    shortName: "MWC",
    // Air Force, Hawai'i, N. Illinois, NDSU, Nevada, New Mexico, San Jose State, UNLV, UTEP, Wyoming
    teamIds: ['2005', '62', '2459', '2449', '2440', '167', '23', '2439', '2638', '2751'],
  },
  {
    id: "Pac-12",
    name: "Pac-12",
    shortName: "P12",
    // Boise State, Colorado State, Fresno State, Oregon State, San Diego St., Texas State, Utah State, Washington St.
    teamIds: ['68', '36', '278', '204', '21', '326', '328', '265'],
  },
  {
    id: "Sun Belt",
    name: "Sun Belt",
    shortName: "SBC",
    // App St., Arkansas State, C. Carolina, GA Southern, Georgia State, James Madison, Louisiana, Louisiana Tech, Marshall, Old Dominion, South Alabama, Southern Miss, Troy, UL Monroe
    teamIds: ['2026', '2032', '324', '290', '2247', '256', '309', '2348', '276', '295', '6', '2572', '2653', '2433'],
  },
  {
    id: "Independent",
    name: "Independent",
    shortName: "Independent",
    // Notre Dame, UConn
    teamIds: ['87', '41'],
  },
]

export const CONFERENCES: Conference[] = CONFERENCE_SEEDS.map((c) => ({ ...c, teamIds: new Set(c.teamIds) }))

export const CONFERENCES_BY_ID = new Map(CONFERENCES.map((c) => [c.id, c]))

/** A stored filter naming a conference this build doesn't have — an id from
 * an older build, or a hand-edited value — reads as no conference filter
 * rather than one that silently matches nothing. */
export function isKnownConferenceId(id: string): boolean {
  return CONFERENCES_BY_ID.has(id)
}
