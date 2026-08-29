import type { Game, Team } from '../types/game'

// Real ESPN team logo CDN URLs (public static assets, no auth) so the mock
// data preview looks like the real thing. Scores/status are invented.
const logo = (espnId: string) => `https://a.espncdn.com/i/teamlogos/ncaa/500/${espnId}.png`

function team(partial: Omit<Team, 'logoLight'> & { espnId: string }): Team {
  const { espnId, ...rest } = partial
  return { ...rest, logoLight: logo(espnId) }
}

const OHIO_STATE = team({ espnId: '194', id: 't194', name: 'Ohio State Buckeyes', shortName: 'Ohio State', abbreviation: 'OSU', color: '#BB0000', rank: 1 })
const TEXAS = team({ espnId: '251', id: 't251', name: 'Texas Longhorns', shortName: 'Texas', abbreviation: 'TEX', color: '#BF5700', rank: 3 })
const ALABAMA = team({ espnId: '333', id: 't333', name: 'Alabama Crimson Tide', shortName: 'Alabama', abbreviation: 'ALA', color: '#9E1B32', rank: 2 })
const FLORIDA_STATE = team({ espnId: '52', id: 't52', name: 'Florida State Seminoles', shortName: 'Florida State', abbreviation: 'FSU', color: '#782F40' })
const MICHIGAN = team({ espnId: '130', id: 't130', name: 'Michigan Wolverines', shortName: 'Michigan', abbreviation: 'MICH', color: '#00274C' })
const UTAH_STATE = team({ espnId: '328', id: 't328', name: 'Utah State Aggies', shortName: 'Utah State', abbreviation: 'USU', color: '#0F2439' })
const LSU = team({ espnId: '99', id: 't99', name: 'LSU Tigers', shortName: 'LSU', abbreviation: 'LSU', color: '#461D7C', rank: 8 })
const CLEMSON = team({ espnId: '228', id: 't228', name: 'Clemson Tigers', shortName: 'Clemson', abbreviation: 'CLEM', color: '#F56600', rank: 7 })
const USC = team({ espnId: '30', id: 't30', name: 'USC Trojans', shortName: 'USC', abbreviation: 'USC', color: '#990000' })
const NEVADA = team({ espnId: '2440', id: 't2440', name: 'Nevada Wolf Pack', shortName: 'Nevada', abbreviation: 'NEV', color: '#003366' })
const OREGON = team({ espnId: '2483', id: 't2483', name: 'Oregon Ducks', shortName: 'Oregon', abbreviation: 'ORE', color: '#154733', rank: 4 })
const NORTHWESTERN = team({ espnId: '77', id: 't77', name: 'Northwestern Wildcats', shortName: 'Northwestern', abbreviation: 'NW', color: '#4E2A84' })
const NOTRE_DAME = team({ espnId: '87', id: 't87', name: 'Notre Dame Fighting Irish', shortName: 'Notre Dame', abbreviation: 'ND', color: '#0C2340', rank: 12 })
const MIAMI_OH = team({ espnId: '193', id: 't193', name: 'Miami (OH) RedHawks', shortName: 'Miami (OH)', abbreviation: 'M-OH', color: '#C41230' })
const COLORADO = team({ espnId: '38', id: 't38', name: 'Colorado Buffaloes', shortName: 'Colorado', abbreviation: 'COL', color: '#000000' })
const GEORGIA_TECH = team({ espnId: '59', id: 't59', name: 'Georgia Tech Yellow Jackets', shortName: 'Georgia Tech', abbreviation: 'GT', color: '#B3A369' })
const IOWA_STATE = team({ espnId: '66', id: 't66', name: 'Iowa State Cyclones', shortName: 'Iowa State', abbreviation: 'ISU', color: '#C8102E' })
const KANSAS_STATE = team({ espnId: '2306', id: 't2306', name: 'Kansas State Wildcats', shortName: 'Kansas State', abbreviation: 'KSU', color: '#512888' })
const STANFORD = team({ espnId: '24', id: 't24', name: 'Stanford Cardinal', shortName: 'Stanford', abbreviation: 'STAN', color: '#8C1515' })
const HAWAII = team({ espnId: '62', id: 't62', name: 'Hawaiʻi Rainbow Warriors', shortName: 'Hawaiʻi', abbreviation: 'HAW', color: '#024731' })

const RAW_GAMES: Game[] = [
  // Thursday 8/27 — kicked off, both final
  {
    id: 'mock-1',
    startDate: '2026-08-28T00:00:00Z', // 8:00 PM ET Thu
    shortName: 'KSU @ ISU',
    venue: 'Jack Trice Stadium',
    home: IOWA_STATE,
    away: KANSAS_STATE,
    homeScore: 27,
    awayScore: 20,
    state: 'post',
    statusDetail: 'FINAL',
    broadcasts: ['FOX'],
  },
  {
    id: 'mock-2',
    startDate: '2026-08-28T02:30:00Z', // 10:30 PM ET Thu
    shortName: 'HAW @ STAN',
    venue: 'Stanford Stadium',
    home: STANFORD,
    away: HAWAII,
    homeScore: 17,
    awayScore: 14,
    state: 'in',
    statusDetail: 'Q3 6:42',
    period: 3,
    clock: '6:42',
    possession: 'away',
    broadcasts: ['ESPN2'],
  },

  // Friday 8/28
  {
    id: 'mock-3',
    startDate: '2026-08-28T23:30:00Z', // 7:30 PM ET Fri
    shortName: 'M-OH @ ND',
    venue: 'Notre Dame Stadium',
    home: NOTRE_DAME,
    away: MIAMI_OH,
    state: 'pre',
    statusDetail: '7:30 PM',
    broadcasts: ['NBC'],
  },
  {
    id: 'mock-4',
    startDate: '2026-08-29T00:00:00Z', // 8:00 PM ET Fri
    shortName: 'COL @ GT',
    venue: 'Bobby Dodd Stadium',
    home: GEORGIA_TECH,
    away: COLORADO,
    state: 'pre',
    statusDetail: '8:00 PM',
    broadcasts: ['ESPN'],
  },

  // Saturday 8/29 — the big slate
  {
    id: 'mock-5',
    startDate: '2026-08-29T16:00:00Z', // 12:00 PM ET Sat
    shortName: 'TEX @ OSU',
    venue: 'Ohio Stadium',
    home: OHIO_STATE,
    away: TEXAS,
    state: 'pre',
    statusDetail: '12:00 PM',
    broadcasts: ['FOX'],
  },
  {
    id: 'mock-6',
    startDate: '2026-08-29T16:00:00Z', // 12:00 PM ET Sat, live
    shortName: 'USU @ MICH',
    venue: 'Michigan Stadium',
    home: MICHIGAN,
    away: UTAH_STATE,
    homeScore: 14,
    awayScore: 3,
    state: 'in',
    statusDetail: 'Q2 9:58',
    period: 2,
    clock: '9:58',
    possession: 'home',
    broadcasts: ['BTN'],
  },
  {
    id: 'mock-7',
    startDate: '2026-08-29T19:30:00Z', // 3:30 PM ET Sat
    shortName: 'FSU @ ALA',
    venue: 'Bryant-Denny Stadium',
    home: ALABAMA,
    away: FLORIDA_STATE,
    state: 'pre',
    statusDetail: '3:30 PM',
    broadcasts: ['ABC'],
  },
  {
    id: 'mock-8',
    startDate: '2026-08-29T20:00:00Z', // 4:00 PM ET Sat, final — spoiler candidate
    shortName: 'NEV @ ORE',
    venue: 'Autzen Stadium',
    home: OREGON,
    away: NEVADA,
    homeScore: 45,
    awayScore: 10,
    state: 'post',
    statusDetail: 'FINAL',
    broadcasts: ['FOX'],
  },
  {
    id: 'mock-9',
    startDate: '2026-08-29T23:30:00Z', // 7:30 PM ET Sat
    shortName: 'CLEM @ LSU',
    venue: 'Tiger Stadium',
    home: LSU,
    away: CLEMSON,
    state: 'pre',
    statusDetail: '7:30 PM',
    broadcasts: ['ABC'],
  },
  {
    id: 'mock-10',
    startDate: '2026-08-30T02:30:00Z', // 10:30 PM ET Sat
    shortName: 'NW @ USC',
    venue: 'United Airlines Field at the Coliseum',
    home: USC,
    away: NORTHWESTERN,
    state: 'pre',
    statusDetail: '10:30 PM',
    broadcasts: ['ESPN'],
  },
]

// Real ESPN returns score "0" for both teams even before kickoff — mirror
// that here so pre-game mock data exercises the same "don't show 0-0" logic
// the real feed does, instead of masking it with `undefined`.
export const MOCK_GAMES: Game[] = RAW_GAMES.map((game) =>
  game.state === 'pre' ? { ...game, homeScore: 0, awayScore: 0 } : game,
)
