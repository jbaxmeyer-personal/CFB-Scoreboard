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
  /** abbreviation is the fallback key for matching drives to a team, since
   * ESPN's drive objects don't always carry a team id. */
  team: { id: string; abbreviation?: string }
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
  team: { id: string; abbreviation?: string }
  statistics: EspnBoxscorePlayerCategory[]
}

export interface EspnBoxscore {
  teams?: EspnBoxscoreTeamEntry[]
  players?: EspnBoxscorePlayerEntry[]
}

// Play-by-play. ESPN's summary endpoint groups plays into drives;
// `current` is the in-progress drive, `previous` is every completed drive.
// The drive/play field names below (isScore, team, start.yardsToEndzone)
// are taken from sportsdataverse's ESPN CFB parser, which extracts exactly
// these keys from this endpoint — not guessed.
export interface EspnPlay {
  id: string
  text?: string
  type?: { text?: string }
  period?: { number: number }
  clock?: { displayValue: string }
  homeScore?: number
  awayScore?: number
  scoringPlay?: boolean
  /** Distance to the opponent's goal line at the snap — the red zone
   * signal (<= 20), since the team box score carries no red zone stat. */
  start?: { yardsToEndzone?: number }
}

export interface EspnDrive {
  id?: string
  plays?: EspnPlay[]
  /** True when the drive ended in points (touchdown or field goal). */
  isScore?: boolean
  team?: { id?: string; abbreviation?: string }
}

export interface EspnDrives {
  previous?: EspnDrive[]
  current?: EspnDrive
}

/** ESPN's own flag for whether it has a live stats/play-by-play feed for a
 * game at all. Confirmed to literally take the value "none" — every
 * sportsdataverse ESPN parser (CFB, NBA, MBB) gates all drive/play parsing
 * on `playByPlaySource != "none"` before touching `drives`. When it's
 * "none" ESPN still updates the score and clock by hand, but carries no
 * drives, no team statistics, and no down/distance situation — which is
 * exactly the case where Slate would otherwise render a blank card with no
 * explanation. */
export interface EspnSummaryHeaderCompetition {
  playByPlaySource?: string
}

export interface EspnSummaryResponse {
  boxscore?: EspnBoxscore
  drives?: EspnDrives
  header?: { competitions?: EspnSummaryHeaderCompetition[] }
  /** Top-level scoring-plays array — a separate section from `drives`, and
   * one of the keys sportsdataverse's CFB parser expects on every summary
   * response. Used as a fallback feed when `drives` comes back empty, so a
   * game whose drive data is missing can still show its scoring plays
   * rather than nothing at all. */
  scoringPlays?: EspnPlay[]
  /** Top-level per-team leaders. Confirmed present on a real response that
   * carried no drives at all (see the `keys` list a device reported back),
   * so this is the fallback source for Game Leaders when the player box
   * score doesn't resolve. Same category shape as the scoreboard's
   * competitor.leaders. */
  leaders?: EspnSummaryLeadersEntry[]
}

export interface EspnSummaryLeadersEntry {
  team?: { id?: string; abbreviation?: string }
  leaders?: EspnLeaderCategory[]
}

// Shape of the separate per-team season-statistics endpoint
// (.../teams/{id}/statistics), fetched only pre-game for the season stat
// comparison shown alongside season leaders. Confirmed against a real
// response — see lib/espn.ts for how `results.stats.categories` (this
// team's own production) and `results.opponent` (what opponents did
// against this team, i.e. this team's "allowed" numbers) are used.
export interface EspnTeamStatEntry {
  name: string
  value?: number
  displayValue: string
  perGameValue?: number
  perGameDisplayValue?: string
}

export interface EspnTeamStatCategory {
  name?: string
  stats?: EspnTeamStatEntry[]
}

export interface EspnTeamStatisticsResponse {
  results?: {
    stats?: { categories?: EspnTeamStatCategory[] }
    opponent?: EspnTeamStatCategory[]
  }
  // Which season the endpoint actually served — confirmed to silently
  // differ from what was asked for when the current season doesn't have
  // enough data yet. Used to detect and hide that fallback rather than
  // show stale stats.
  requestedSeason?: { year: number; type: number }
}
