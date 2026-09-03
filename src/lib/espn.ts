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
  EspnTeamStatCategory,
  EspnTeamStatEntry,
  EspnTeamStatisticsResponse,
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
    // Skip rather than show a placeholder name — ESPN's scoreboard payload
    // doesn't always carry athlete data for every matchup (e.g. smaller
    // programs), and a blank/"Unknown" row is worse than no row.
    if (leader?.athlete?.displayName) result.push({ category, playerName: leader.athlete.displayName, displayValue: leader.displayValue })
  }
  return result
}

function toTeam(competitor: EspnCompetitor): Team {
  const { team, curatedRank, records, leaders } = competitor
  const rank = curatedRank?.current
  const overallRecord = records?.find((r) => r.type === 'total' || r.name === 'overall')?.summary ?? records?.[0]?.summary
  const homeRecord = records?.find((r) => r.type === 'home')?.summary
  const awayRecord = records?.find((r) => r.type === 'road' || r.type === 'away')?.summary
  return {
    id: team.id,
    name: team.displayName,
    shortName: team.shortDisplayName,
    abbreviation: team.abbreviation,
    color: team.color ? `#${team.color}` : undefined,
    alternateColor: team.alternateColor ? `#${team.alternateColor}` : undefined,
    rank: rank && rank > 0 && rank <= 25 ? rank : undefined,
    record: overallRecord,
    homeRecord,
    awayRecord,
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

function statByName(stats: { name: string; displayValue: string }[] | undefined, name: string): string | undefined {
  return stats?.find((s) => s.name === name)?.displayValue
}

/** The per-game box score doesn't expose a raw "yards per play" field
 * either (same gap as the season stats endpoint — see yardsPerPlay above),
 * so derive it the same way from this game's totals. displayValue strings
 * have to be parsed by hand here since, unlike the season endpoint, the
 * box score's stat entries don't also carry a numeric `value`. */
function boxYardsPerPlay(stats: { name: string; displayValue: string }[] | undefined): string | undefined {
  const yards = Number(statByName(stats, 'totalYards'))
  const plays = Number(statByName(stats, 'totalOffensivePlays'))
  if (!Number.isFinite(yards) || !Number.isFinite(plays) || plays === 0) return undefined
  return (yards / plays).toFixed(1)
}

interface BoxScoreStatDef {
  label: string
  // Turnovers is the one box-score row where fewer is better — flips
  // which team's bar segment reads as "ahead", same as the season stats.
  invert?: boolean
  get: (stats: { name: string; displayValue: string }[] | undefined) => string | undefined
}

const BOX_SCORE_STAT_DEFS: BoxScoreStatDef[] = [
  { label: 'Total Yards', get: (s) => statByName(s, 'totalYards') },
  { label: 'Passing Yards', get: (s) => statByName(s, 'netPassingYards') },
  { label: 'Rushing Yards', get: (s) => statByName(s, 'rushingYards') },
  { label: 'Yards/Play', get: (s) => boxYardsPerPlay(s) },
  // yardsPerPass/yardsPerRushAttempt are unverified field names for this
  // endpoint specifically (confirmed only on the season stats endpoint) —
  // degrades to not shown, same as everywhere else in this file, if wrong.
  { label: 'Passing Yards/Play', get: (s) => statByName(s, 'yardsPerPass') },
  { label: 'Rushing Yards/Play', get: (s) => statByName(s, 'yardsPerRushAttempt') },
  { label: 'Turnovers', invert: true, get: (s) => statByName(s, 'turnovers') },
  { label: 'Time of Possession', get: (s) => statByName(s, 'possessionTime') },
]

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

/** ESPN's own play text still marks a redundant "1ST DOWN" on a touchdown's
 * description (the play technically satisfies the down-tracking rule, but
 * the drive is already over — there's no down left to convert) — confirmed
 * live, strip it so a scoring play doesn't also claim a first down. The
 * clause sits mid-string, not necessarily at the end — the same play's
 * text often continues on into the extra-point attempt ("...TOUCHDOWN,
 * clock 09:43, 1ST DOWN #99 D.Morris kick attempt good...") — so this
 * removes it wherever it appears rather than anchoring to the end. Left
 * untouched for every other play, where a real first down is exactly what
 * happened. */
function cleanPlayText(text: string, isScoringPlay: boolean): string {
  if (!isScoringPlay) return text
  return text.replace(/,?\s*1ST DOWN\b\.?/gi, '').replace(/\s{2,}/g, ' ').trim()
}

function toGamePlay(play: EspnPlay): GamePlay | null {
  if (!play.text || play.homeScore === undefined || play.awayScore === undefined) return null
  const isScoringPlay = play.scoringPlay ?? false
  return {
    id: play.id,
    text: cleanPlayText(play.text, isScoringPlay),
    period: play.period?.number ?? 0,
    clock: play.clock?.displayValue ?? '',
    homeScore: play.homeScore,
    awayScore: play.awayScore,
    isScoringPlay,
  }
}

/**
 * Flattens ESPN's drives into a single newest-first play list. `previous` is
 * assumed oldest-drive-first and each drive's own plays oldest-first (the
 * usual convention for this endpoint, unverified in this environment) — so
 * the chronological feed is every previous drive's plays followed by the
 * in-progress drive's plays, then reversed for a newest-first display order
 * matching a live play-by-play feed. A scoring play sometimes shows up in
 * both the drive it ended *and* as the lead-in to the next (kickoff) drive
 * — confirmed live, and confirmed under a *different* play id each time
 * (an id-based dedupe alone didn't catch it), so this dedupes by the
 * play's actual content — period + clock + text — instead, keeping the
 * first (oldest) occurrence.
 */
export function normalizePlays(response: EspnSummaryResponse): GamePlay[] {
  const previousPlays = (response.drives?.previous ?? []).flatMap((d) => d.plays ?? [])
  const currentPlays = response.drives?.current?.plays ?? []
  const chronological = [...previousPlays, ...currentPlays]
  const seen = new Set<string>()
  const deduped = chronological.filter((p) => {
    const key = `${p.period?.number ?? ''}|${p.clock?.displayValue ?? ''}|${p.text ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return deduped
    .map(toGamePlay)
    .filter((p): p is GamePlay => p !== null)
    .reverse()
}

// --- Season-long team stats (pre-game only) --------------------------------
// A separate per-team endpoint, fetched only pre-game for the season stat
// comparison shown alongside season leaders. Shape confirmed against a real
// response (site.api.espn.com/.../teams/{id}/statistics): results.stats.
// categories is the team's own offensive/special-teams production;
// results.opponent is the *same* category shape but for what opponents did
// against this team — that's where "allowed" (defensive) numbers come
// from, since this endpoint has no separate offense-vs-defense split of
// its own. Note: results.opponent only carries passing/rushing/receiving/
// general/scoring categories (no miscellaneous/defensive), so allowed-side
// first downs and 3rd-down% aren't available here.

const TEAMS_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams'

/** ESPN's CFB season spans Aug-Jan; a game in Jan-Jun belongs to the season
 * that started the previous fall (bowls/playoffs run into January). */
export function seasonYearFromDate(iso: string): number {
  const d = new Date(iso)
  const month = d.getUTCMonth() // 0 = Jan
  return month <= 5 ? d.getUTCFullYear() - 1 : d.getUTCFullYear()
}

/** Without an explicit season, this endpoint silently falls back to the
 * most recently *completed* season instead of the in-progress one (seen
 * live: a request in the 2026 season returned full 2025 postseason stats,
 * 12 games played, with no error) — so the year must be forced. seasontype
 * 2 = regular season, matching what's actually in progress right now. */
export async function fetchTeamSeasonStats(teamId: string, year: number): Promise<EspnTeamStatisticsResponse> {
  const res = await fetch(`${TEAMS_URL}/${teamId}/statistics?season=${year}&seasontype=2`)
  if (!res.ok) {
    throw new Error(`ESPN team statistics request failed: ${res.status}`)
  }
  return res.json() as Promise<EspnTeamStatisticsResponse>
}

function flattenStatCategories(categories: EspnTeamStatCategory[] | undefined): Map<string, EspnTeamStatEntry> {
  const map = new Map<string, EspnTeamStatEntry>()
  for (const category of categories ?? []) {
    for (const stat of category.stats ?? []) {
      // First occurrence wins: a few stat names (e.g. totalPointsPerGame)
      // repeat across categories with the same value, except "scoring",
      // which computes it differently — categories are ordered with
      // passing/rushing/receiving first, so this always keeps the
      // consistent value.
      if (!map.has(stat.name)) map.set(stat.name, stat)
    }
  }
  return map
}

function statDisplay(map: Map<string, EspnTeamStatEntry>, name: string, perGame: boolean): string | undefined {
  const stat = map.get(name)
  if (!stat) return undefined
  return (perGame ? stat.perGameDisplayValue : undefined) ?? stat.displayValue
}

/** ESPN doesn't expose a single "yards per play" field — derive it from the
 * season total yards and total offensive plays, both confirmed present on
 * both the team's own stats and (separately) the opponent side. */
function yardsPerPlay(map: Map<string, EspnTeamStatEntry>): string | undefined {
  const yards = map.get('totalYards')?.value
  const plays = map.get('totalOffensivePlays')?.value
  if (yards === undefined || plays === undefined || plays === 0) return undefined
  return (yards / plays).toFixed(1)
}

interface SeasonStatDef {
  label: string
  section: 'offense' | 'defense' | 'turnovers'
  // Lower is better for allowed/defense stats (and for turnovers) — flips
  // which team's bar segment reads as "ahead" rather than just "bigger".
  invert?: boolean
  get: (own: Map<string, EspnTeamStatEntry>, allowed: Map<string, EspnTeamStatEntry>) => string | undefined
}

const SEASON_STAT_DEFS: SeasonStatDef[] = [
  // Offense
  { label: 'Points Per Game', section: 'offense', get: (own) => statDisplay(own, 'totalPointsPerGame', false) },
  // "yardsPerGame" lives inside ESPN's passing category despite meaning
  // total offensive yards per game — confirmed against the real payload.
  { label: 'Total Yards Per Game', section: 'offense', get: (own) => statDisplay(own, 'yardsPerGame', false) },
  { label: 'Passing Yards Per Game', section: 'offense', get: (own) => statDisplay(own, 'passingYardsPerGame', false) },
  { label: 'Rushing Yards Per Game', section: 'offense', get: (own) => statDisplay(own, 'rushingYardsPerGame', false) },
  { label: 'First Downs Per Game', section: 'offense', get: (own) => statDisplay(own, 'firstDowns', true) },
  { label: 'Yards Per Play', section: 'offense', get: (own) => yardsPerPlay(own) },
  { label: 'Passing Yards Per Play', section: 'offense', get: (own) => statDisplay(own, 'yardsPerPassAttempt', false) },
  { label: 'Rushing Yards Per Play', section: 'offense', get: (own) => statDisplay(own, 'yardsPerRushAttempt', false) },
  // Defense (all "allowed" — lower is better, so bars invert)
  { label: 'Points Allowed Per Game', section: 'defense', invert: true, get: (_own, allowed) => statDisplay(allowed, 'totalPointsPerGame', false) },
  { label: 'Total Yards Allowed Per Game', section: 'defense', invert: true, get: (_own, allowed) => statDisplay(allowed, 'yardsPerGame', false) },
  { label: 'Passing Yards Allowed Per Game', section: 'defense', invert: true, get: (_own, allowed) => statDisplay(allowed, 'passingYardsPerGame', false) },
  { label: 'Rushing Yards Allowed Per Game', section: 'defense', invert: true, get: (_own, allowed) => statDisplay(allowed, 'rushingYardsPerGame', false) },
  { label: 'Yards Allowed Per Play', section: 'defense', invert: true, get: (_own, allowed) => yardsPerPlay(allowed) },
  { label: 'Passing Yards Allowed Per Play', section: 'defense', invert: true, get: (_own, allowed) => statDisplay(allowed, 'yardsPerPassAttempt', false) },
  { label: 'Rushing Yards Allowed Per Play', section: 'defense', invert: true, get: (_own, allowed) => statDisplay(allowed, 'yardsPerRushAttempt', false) },
  // Turnovers — giving the ball away is bad (fewer is better), taking it
  // away is good (more is better), so only Turnovers inverts.
  { label: 'Turnovers', section: 'turnovers', invert: true, get: (own) => statDisplay(own, 'totalGiveaways', false) },
  { label: 'Takeaways', section: 'turnovers', get: (own) => statDisplay(own, 'totalTakeaways', false) },
]

/** The response echoes back which season it actually served under
 * `requestedSeason` — if that doesn't match what was asked for (ESPN
 * ignored the query params, or fell back again for some other reason),
 * treat it as no data rather than silently showing a stale year. */
export function normalizeSeasonStats(
  homeStats: EspnTeamStatisticsResponse,
  awayStats: EspnTeamStatisticsResponse,
  expectedYear: number,
): TeamStatLine[] {
  if (homeStats.requestedSeason?.year !== expectedYear || awayStats.requestedSeason?.year !== expectedYear) return []

  const homeOwn = flattenStatCategories(homeStats.results?.stats?.categories)
  const homeAllowed = flattenStatCategories(homeStats.results?.opponent)
  const awayOwn = flattenStatCategories(awayStats.results?.stats?.categories)
  const awayAllowed = flattenStatCategories(awayStats.results?.opponent)

  const lines: TeamStatLine[] = []
  for (const def of SEASON_STAT_DEFS) {
    const homeValue = def.get(homeOwn, homeAllowed)
    const awayValue = def.get(awayOwn, awayAllowed)
    if (homeValue !== undefined && awayValue !== undefined) {
      lines.push({ label: def.label, homeValue, awayValue, section: def.section, invert: def.invert })
    }
  }
  return lines
}

export function normalizeBoxScore(response: EspnSummaryResponse, homeTeamId: string, awayTeamId: string): GameBoxScore {
  const teams = response.boxscore?.teams
  const homeEntry = teams?.find((t: EspnBoxscoreTeamEntry) => t.team.id === homeTeamId)
  const awayEntry = teams?.find((t: EspnBoxscoreTeamEntry) => t.team.id === awayTeamId)

  const teamStats: TeamStatLine[] = []
  for (const def of BOX_SCORE_STAT_DEFS) {
    const homeValue = def.get(homeEntry?.statistics)
    const awayValue = def.get(awayEntry?.statistics)
    if (homeValue !== undefined && awayValue !== undefined) {
      teamStats.push({ label: def.label, homeValue, awayValue, invert: def.invert })
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
