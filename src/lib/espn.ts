import type {
  EspnBoxscorePlayerEntry,
  EspnBoxscoreTeamEntry,
  EspnCompetitor,
  EspnEvent,
  EspnLeaderCategory,
  EspnLogo,
  EspnPlay,
  EspnScoreboardResponse,
  EspnSummaryResponse,
} from '../types/espn'
import type { Game, GameBoxScore, GamePlay, GameState, StatLeader, Team, TeamStatLine, WeekSelector } from '../types/game'

export const FBS_GROUP = 80

const SCOREBOARD_URL =
  'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard'
const SUMMARY_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary'

export function buildScoreboardUrl(dateParam: string, group = FBS_GROUP): string {
  const params = new URLSearchParams({
    dates: dateParam,
    groups: String(group),
    limit: '300',
  })
  return `${SCOREBOARD_URL}?${params.toString()}`
}

export async function fetchScoreboard(dateParam: string): Promise<EspnScoreboardResponse> {
  const res = await fetch(buildScoreboardUrl(dateParam))
  if (!res.ok) {
    throw new Error(`ESPN scoreboard request failed: ${res.status}`)
  }
  return res.json() as Promise<EspnScoreboardResponse>
}

// --- Season-wide, week-based fetching (Scoreboard) ------------------------
// The per-day `dates=` query above is what Slate uses for its short
// "known kickoff times" window. Browsing a whole season that way would mean
// one request per calendar day (~150 of them) — ESPN's scoreboard endpoint
// also accepts a week number directly, which pulls an entire week's slate
// in a single request. This `week`/`seasontype`/`dates=<year>` combination
// is the standard shape documented across ESPN's public (if unofficial)
// site API, but unverified against a live response in this environment —
// normalizeScoreboard degrades to an empty list rather than crashing if a
// field is missing or shaped differently than expected.

export function buildWeekScoreboardUrl({ year, seasonType, week }: WeekSelector, group = FBS_GROUP): string {
  const params = new URLSearchParams({
    dates: String(year),
    seasontype: String(seasonType),
    week: String(week),
    groups: String(group),
    limit: '300',
  })
  return `${SCOREBOARD_URL}?${params.toString()}`
}

export async function fetchScoreboardWeek(selector: WeekSelector): Promise<EspnScoreboardResponse> {
  const res = await fetch(buildWeekScoreboardUrl(selector))
  if (!res.ok) {
    throw new Error(`ESPN scoreboard (week) request failed: ${res.status}`)
  }
  return res.json() as Promise<EspnScoreboardResponse>
}

/** Fetched with no date/week params at all, so ESPN returns whatever it
 * considers "right now" — used once to learn the current year/seasonType/
 * week number to seed the week navigator. Its `events` are discarded; the
 * actual displayed week is always fetched explicitly via fetchScoreboardWeek
 * so navigating is just incrementing/decrementing a known week number. */
export async function fetchCurrentWeek(group = FBS_GROUP): Promise<EspnScoreboardResponse> {
  const params = new URLSearchParams({ groups: String(group), limit: '1' })
  const res = await fetch(`${SCOREBOARD_URL}?${params.toString()}`)
  if (!res.ok) {
    throw new Error(`ESPN scoreboard (current week) request failed: ${res.status}`)
  }
  return res.json() as Promise<EspnScoreboardResponse>
}

// ESPN's CDN publishes a "-dark" logo variant for teams whose default mark
// has dark elements that disappear on a dark background (many others 404
// on this path) — e.g. .../teamlogos/ncaa/500/99.png -> .../500-dark/99.png.
// TeamLogo tries this first and falls back to the regular logo on error.
function deriveDarkVariant(url: string): string | undefined {
  const match = url.match(/^(.*\/ncaa\/)500(\/.*)$/)
  return match ? `${match[1]}500-dark${match[2]}` : undefined
}

function pickLogos(logos: EspnLogo[] | undefined, singleLogo: string | undefined): { logoLight?: string; logoDark?: string } {
  if (logos && logos.length > 0) {
    const dark = logos.find((l) => l.rel.includes('dark'))
    const full = logos.find((l) => l.rel.includes('full')) ?? logos[0]
    return { logoLight: full?.href, logoDark: dark?.href ?? full?.href }
  }
  // The scoreboard endpoint gives just this single (light-background) URL.
  if (singleLogo) return { logoLight: singleLogo, logoDark: deriveDarkVariant(singleLogo) ?? singleLogo }
  return {}
}

const LEADER_CATEGORY_MATCHERS: { category: StatLeader['category']; pattern: RegExp }[] = [
  { category: 'passing', pattern: /passing/i },
  { category: 'rushing', pattern: /rushing/i },
  { category: 'receiving', pattern: /receiving/i },
]

/** Best-effort parse of ESPN's per-team season leaders (passing/rushing/
 * receiving), shown pre-game only — the category naming isn't something
 * this session could verify live, so an unmatched shape just yields []. */
function parseSeasonLeaders(leaders: EspnLeaderCategory[] | undefined): StatLeader[] {
  if (!leaders) return []
  const result: StatLeader[] = []
  for (const { category, pattern } of LEADER_CATEGORY_MATCHERS) {
    const found = leaders.find((l) => pattern.test(l.name) || (l.displayName && pattern.test(l.displayName)))
    const leader = found?.leaders?.[0]
    if (leader) result.push({ category, playerName: leader.athlete?.displayName ?? 'Unknown', displayValue: leader.displayValue })
  }
  return result
}

function toTeam(competitor: EspnCompetitor): Team {
  const { team, curatedRank, records, leaders } = competitor
  const rank = curatedRank?.current
  const overallRecord = records?.find((r) => r.type === 'total' || r.name === 'overall')?.summary ?? records?.[0]?.summary
  return {
    id: team.id,
    name: team.displayName,
    shortName: team.shortDisplayName,
    abbreviation: team.abbreviation,
    color: team.color ? `#${team.color}` : undefined,
    alternateColor: team.alternateColor ? `#${team.alternateColor}` : undefined,
    rank: rank && rank > 0 && rank <= 25 ? rank : undefined,
    record: overallRecord,
    seasonLeaders: parseSeasonLeaders(leaders),
    ...pickLogos(team.logos, team.logo),
  }
}

function toGameState(state: string): GameState {
  if (state === 'in') return 'in'
  if (state === 'post') return 'post'
  return 'pre'
}

export function normalizeEvent(event: EspnEvent): Game | null {
  const competition = event.competitions?.[0]
  if (!competition) return null

  const home = competition.competitors.find((c) => c.homeAway === 'home')
  const away = competition.competitors.find((c) => c.homeAway === 'away')
  if (!home || !away) return null

  const status = competition.status ?? event.status
  const broadcasts = (competition.broadcasts ?? []).flatMap((b) => b.names)
  const sit = competition.situation
  const possessionId = sit?.possession
  const possession =
    possessionId === home.team.id ? 'home' : possessionId === away.team.id ? 'away' : undefined
  const situation =
    sit?.down !== undefined && sit?.distance !== undefined && sit?.yardLine !== undefined
      ? { down: sit.down, distance: sit.distance, yardLine: sit.yardLine, possessionText: sit.possessionText ?? '', isRedZone: sit.isRedZone ?? false }
      : undefined

  return {
    id: event.id,
    startDate: event.date,
    shortName: event.shortName,
    venue: competition.venue?.fullName,
    home: toTeam(home),
    away: toTeam(away),
    homeScore: home.score !== undefined ? Number(home.score) : undefined,
    awayScore: away.score !== undefined ? Number(away.score) : undefined,
    state: toGameState(status.type.state),
    statusDetail: status.type.shortDetail || status.type.detail,
    period: status.period,
    clock: status.displayClock,
    possession,
    broadcasts,
    situation,
  }
}

export function normalizeScoreboard(response: EspnScoreboardResponse): Game[] {
  return response.events
    .map(normalizeEvent)
    .filter((g): g is Game => g !== null)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
}

// --- Per-game box score (live/final only) ---------------------------------
// A separate endpoint, fetched only for the one game currently expanded once
// it's live or final. Field names here are best-effort from general
// knowledge of ESPN's site API, not verified against a live response in
// this environment — everything is optional-chained so an unmatched shape
// just yields empty sections instead of crashing.

export async function fetchGameSummary(eventId: string): Promise<EspnSummaryResponse> {
  const res = await fetch(`${SUMMARY_URL}?event=${eventId}`)
  if (!res.ok) {
    throw new Error(`ESPN summary request failed: ${res.status}`)
  }
  return res.json() as Promise<EspnSummaryResponse>
}

const TEAM_STAT_LABELS: { name: string; label: string }[] = [
  { name: 'totalYards', label: 'Total Yards' },
  { name: 'netPassingYards', label: 'Passing Yards' },
  { name: 'rushingYards', label: 'Rushing Yards' },
  { name: 'turnovers', label: 'Turnovers' },
  { name: 'possessionTime', label: 'Time of Possession' },
]

function statByName(stats: { name: string; displayValue: string }[] | undefined, name: string): string | undefined {
  return stats?.find((s) => s.name === name)?.displayValue
}

function statValue(labels: string[], stats: string[], label: string): string | undefined {
  const idx = labels.findIndex((l) => l.toLowerCase() === label.toLowerCase())
  return idx >= 0 ? stats[idx] : undefined
}

function summarizePlayerStat(labels: string[], stats: string[]): string {
  const yds = statValue(labels, stats, 'YDS')
  const td = statValue(labels, stats, 'TD')
  if (yds && td) return `${yds} yds, ${td} TD`
  if (yds) return `${yds} yds`
  return stats.join(' / ')
}

function parseGameLeaders(entry: EspnBoxscorePlayerEntry | undefined): StatLeader[] {
  if (!entry) return []
  const result: StatLeader[] = []
  for (const { category, pattern } of LEADER_CATEGORY_MATCHERS) {
    const cat = entry.statistics.find((s) => pattern.test(s.name) || (s.text && pattern.test(s.text)))
    const athlete = cat?.athletes?.[0]
    if (athlete) {
      result.push({ category, playerName: athlete.athlete.displayName, displayValue: summarizePlayerStat(cat.labels, athlete.stats) })
    }
  }
  return result
}

// --- Play-by-play (live/final only) ---------------------------------------

function toGamePlay(play: EspnPlay): GamePlay | null {
  if (!play.text || play.homeScore === undefined || play.awayScore === undefined) return null
  return {
    id: play.id,
    text: play.text,
    period: play.period?.number ?? 0,
    clock: play.clock?.displayValue ?? '',
    homeScore: play.homeScore,
    awayScore: play.awayScore,
    isScoringPlay: play.scoringPlay ?? false,
  }
}

/**
 * Flattens ESPN's drives into a single newest-first play list. `previous` is
 * assumed oldest-drive-first and each drive's own plays oldest-first (the
 * usual convention for this endpoint, unverified in this environment) — so
 * the chronological feed is every previous drive's plays followed by the
 * in-progress drive's plays, then reversed for a newest-first display order
 * matching a live play-by-play feed.
 */
export function normalizePlays(response: EspnSummaryResponse): GamePlay[] {
  const previousPlays = (response.drives?.previous ?? []).flatMap((d) => d.plays ?? [])
  const currentPlays = response.drives?.current?.plays ?? []
  const chronological = [...previousPlays, ...currentPlays]
  return chronological
    .map(toGamePlay)
    .filter((p): p is GamePlay => p !== null)
    .reverse()
}

export function normalizeBoxScore(response: EspnSummaryResponse, homeTeamId: string, awayTeamId: string): GameBoxScore {
  const teams = response.boxscore?.teams
  const homeEntry = teams?.find((t: EspnBoxscoreTeamEntry) => t.team.id === homeTeamId)
  const awayEntry = teams?.find((t: EspnBoxscoreTeamEntry) => t.team.id === awayTeamId)

  const teamStats: TeamStatLine[] = []
  for (const { name, label } of TEAM_STAT_LABELS) {
    const homeValue = statByName(homeEntry?.statistics, name)
    const awayValue = statByName(awayEntry?.statistics, name)
    if (homeValue !== undefined && awayValue !== undefined) {
      teamStats.push({ label, homeValue, awayValue })
    }
  }

  const players = response.boxscore?.players
  const homePlayers = players?.find((p) => p.team.id === homeTeamId)
  const awayPlayers = players?.find((p) => p.team.id === awayTeamId)

  return {
    teamStats,
    homeLeaders: parseGameLeaders(homePlayers),
    awayLeaders: parseGameLeaders(awayPlayers),
  }
}
