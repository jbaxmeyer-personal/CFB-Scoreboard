// Shape of the (unofficial) ESPN college football scoreboard response.
// Only the fields Slate actually reads are typed here — the real payload
// carries a lot more. See README for the endpoint caveat.

export interface EspnLogo {
  href: string
  width: number
  height: number
  alt?: string
  rel: string[]
}

export interface EspnTeam {
  id: string
  location: string
  name?: string
  abbreviation: string
  displayName: string
  shortDisplayName: string
  color?: string
  alternateColor?: string
  // The scoreboard endpoint typically gives a single `logo` URL; the richer
  // `logos` array (with rel tags like "dark") shows up on other ESPN
  // endpoints (e.g. /teams/{id}) and occasionally here too — handle both.
  logo?: string
  logos?: EspnLogo[]
}

export interface EspnCurrentRank {
  current: number
}

export interface EspnRecord {
  name?: string
  type?: string
  summary: string
}

export interface EspnLeaderAthlete {
  displayValue: string
  athlete?: { displayName: string }
}

export interface EspnLeaderCategory {
  name: string
  displayName?: string
  leaders?: EspnLeaderAthlete[]
}

export interface EspnCompetitor {
  id: string
  homeAway: 'home' | 'away'
  winner?: boolean
  team: EspnTeam
  score?: string
  curatedRank?: EspnCurrentRank
  records?: EspnRecord[]
  leaders?: EspnLeaderCategory[]
}

export interface EspnStatusType {
  id: string
  name: string
  state: 'pre' | 'in' | 'post'
  completed: boolean
  description: string
  detail: string
  shortDetail: string
}

export interface EspnStatus {
  clock?: number
  displayClock?: string
  period?: number
  type: EspnStatusType
}

export interface EspnBroadcast {
  market?: string
  names: string[]
}

export interface EspnSituation {
  possession?: string
  // Field-position fields — best-effort/unverified, same caveat as the
  // play-by-play and box score shapes below. yardLine is assumed to be
  // 0-100 measured from the possessing team's own goal line (the usual
  // convention for this endpoint).
  down?: number
  distance?: number
  yardLine?: number
  possessionText?: string
  isRedZone?: boolean
}

export interface EspnCompetition {
  id: string
  date: string
  competitors: EspnCompetitor[]
  status: EspnStatus
  broadcasts?: EspnBroadcast[]
  situation?: EspnSituation
  venue?: { fullName?: string }
}

export interface EspnEvent {
  id: string
  date: string
  name: string
  shortName: string
  competitions: EspnCompetition[]
  status: EspnStatus
}

export interface EspnScoreboardResponse {
  events: EspnEvent[]
  // Present when the scoreboard is fetched without an explicit date/week
  // (i.e. "what's the current week right now") — used to bootstrap the
  // season week-navigator. Field names are best-effort/unverified.
  week?: { number: number }
  season?: { year: number; type: number }
}

// Shape of the separate per-game summary endpoint
// (.../summary?event={id}), fetched only for an expanded live/final game —
// this is where box score team/player stats for that specific game live.
export interface EspnBoxscoreStat {
  name: string
  displayValue: string
  label?: string
}

export interface EspnBoxscoreTeamEntry {
  team: { id: string }
  statistics: EspnBoxscoreStat[]
}

export interface EspnBoxscorePlayerAthlete {
  athlete: { displayName: string }
  stats: string[]
}

export interface EspnBoxscorePlayerCategory {
  name: string
  text?: string
  labels: string[]
  athletes: EspnBoxscorePlayerAthlete[]
}

export interface EspnBoxscorePlayerEntry {
  team: { id: string }
  statistics: EspnBoxscorePlayerCategory[]
}

export interface EspnBoxscore {
  teams?: EspnBoxscoreTeamEntry[]
  players?: EspnBoxscorePlayerEntry[]
}

// Play-by-play — best-effort/unverified shape, same caveat as the box
// score above. ESPN's summary endpoint groups plays into drives; `current`
// is the in-progress drive, `previous` is every completed drive.
export interface EspnPlay {
  id: string
  text?: string
  type?: { text?: string }
  period?: { number: number }
  clock?: { displayValue: string }
  homeScore?: number
  awayScore?: number
  scoringPlay?: boolean
}

export interface EspnDrive {
  id?: string
  plays?: EspnPlay[]
}

export interface EspnDrives {
  previous?: EspnDrive[]
  current?: EspnDrive
}

export interface EspnSummaryResponse {
  boxscore?: EspnBoxscore
  drives?: EspnDrives
}

// Shape of the separate per-team season-statistics endpoint
// (.../teams/{id}/statistics) — best-effort/unverified, same caveat as
// everything else above. Fetched only pre-game, for the season stat
// comparison shown alongside season leaders.
export interface EspnTeamStatEntry {
  name: string
  displayValue: string
}

export interface EspnTeamStatCategory {
  name?: string
  stats?: EspnTeamStatEntry[]
}

export interface EspnTeamStatisticsResponse {
  splits?: { categories?: EspnTeamStatCategory[] }
}
