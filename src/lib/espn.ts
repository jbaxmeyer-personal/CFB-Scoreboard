import type {
  EspnBoxscorePlayerEntry,
  EspnDrive,
  EspnCoreCompetitor,
  EspnCoreRef,
  EspnCoreCompetitorsResponse,
  EspnCorePlaysResponse,
  EspnCoreStatCategory,
  EspnCoreStatisticsResponse,
  EspnBoxscoreTeamEntry,
  EspnCompetitor,
  EspnEvent,
  EspnLeaderCategory,
  EspnLogo,
  EspnPlay,
  EspnScoreboardResponse,
  EspnSummaryLeadersEntry,
  EspnSummaryResponse,
  EspnTeamScheduleResponse,
  EspnTeamStatCategory,
  EspnTeamStatEntry,
  EspnTeamStatisticsResponse,
} from '../types/espn'
import type { Game, GameBoxScore, GamePlay, GameState, StatLeader, Team, TeamStatLine } from '../types/game'

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

/**
 * A competitor's score, from either shape ESPN uses: the scoreboard sends
 * `"38"`, the team-schedule endpoint sends `{value: 38, displayValue: "38"}`.
 * Reading only the first shape turned every completed game on a team's
 * schedule into `NaN-NaN` (and, since NaN compares false both ways, a tie).
 * Anything that doesn't yield a real number comes back undefined so callers
 * treat it as "no score" rather than rendering NaN.
 */
function parseScore(score: EspnCompetitor['score']): number | undefined {
  if (score === undefined || score === null) return undefined
  const raw = typeof score === 'object' ? (score.value ?? score.displayValue) : score
  if (raw === undefined || raw === '') return undefined
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : undefined
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
    competitionId: competition.id ?? event.id,
    startDate: event.date,
    shortName: event.shortName,
    venue: competition.venue?.fullName,
    home: toTeam(home),
    away: toTeam(away),
    homeScore: parseScore(home.score),
    awayScore: parseScore(away.score),
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

/**
 * The full set of stat names ESPN's CFB *team* box score actually carries
 * (per sportsdataverse's espn_cfb_team_box schema, which this endpoint
 * feeds): firstDowns, thirdDownEff, fourthDownEff, totalYards,
 * netPassingYards, completionAttempts, yardsPerPass, rushingYards,
 * rushingAttempts, yardsPerRushAttempt, totalPenaltiesYards, turnovers,
 * fumblesLost, interceptions, possessionTime.
 *
 * Notably absent, which is why guessing at their names never worked:
 * there is no total-plays or yards-per-play field, and no red zone field
 * at all. Both are derived below instead — yards/play from the attempt
 * counts that *are* here, red zone from the drive data in the same
 * response (see redZoneEfficiency).
 */

/** The trailing half of an "X-Y" pair, e.g. completionAttempts "18-25" →
 * 25 attempts. */
function attemptsFromPair(value: string | undefined): number | undefined {
  const match = value?.match(/^(\d+)-(\d+)$/)
  return match ? Number(match[2]) : undefined
}

/** Yards per play, derived from the attempt counts the box score does
 * carry: pass attempts (the back half of completionAttempts) plus rushing
 * attempts. That matches the NCAA convention, where a sack counts as a
 * rushing attempt rather than a pass play. */
function boxYardsPerPlay(stats: { name: string; displayValue: string }[] | undefined): string | undefined {
  const yards = Number(statByName(stats, 'totalYards'))
  const passAttempts = attemptsFromPair(statByName(stats, 'completionAttempts'))
  const rushAttempts = Number(statByName(stats, 'rushingAttempts'))
  if (!Number.isFinite(yards) || passAttempts === undefined || !Number.isFinite(rushAttempts)) return undefined
  const plays = passAttempts + rushAttempts
  if (plays === 0) return undefined
  return (yards / plays).toFixed(1)
}

/**
 * Red zone scoring as "made-trips", counted off the drive data in this
 * same response since the team box score has no red zone stat of its own.
 * A drive counts as a trip once any of its snaps starts inside the
 * opponent's 20 (start.yardsToEndzone), and as a score when the drive
 * ended in points (isScore) — so a 60-yard touchdown that never ran a
 * play inside the 20 correctly counts as neither.
 */
function redZoneEfficiency(response: EspnSummaryResponse, teamId: string, teamAbbreviation: string): string | undefined {
  const drives = [...(response.drives?.previous ?? []), ...(response.drives?.current ? [response.drives.current] : [])]
  if (drives.length === 0) return undefined

  let trips = 0
  let scores = 0
  for (const drive of drives) {
    const driveTeam = drive.team
    const isThisTeam = driveTeam?.id !== undefined ? driveTeam.id === teamId : driveTeam?.abbreviation === teamAbbreviation
    if (!isThisTeam) continue
    const reachedRedZone = (drive.plays ?? []).some((p) => {
      const toGoal = p.start?.yardsToEndzone
      return toGoal !== undefined && toGoal <= 20
    })
    if (!reachedRedZone) continue
    trips += 1
    if (drive.isScore) scores += 1
  }

  // A team that simply hasn't reached the red zone yet is 0-0, not missing
  // data — returning undefined there would drop the row for *both* teams
  // until each had been inside the 20, so it would blink in and out during
  // a game. Only a response with no drive data at all hides the row.
  return `${scores}-${trips}`
}

/** One team's slice of the summary response, for stats that need more
 * than the flat statistics array (red zone reads the drive data). */
interface BoxScoreTeamContext {
  stats: { name: string; displayValue: string }[] | undefined
  response: EspnSummaryResponse
  teamId: string
  teamAbbreviation: string
}

interface BoxScoreStatDef {
  label: string
  // Turnovers is the one box-score row where fewer is better — flips
  // which team's bar segment reads as "ahead", same as the season stats.
  invert?: boolean
  get: (ctx: BoxScoreTeamContext) => string | undefined
}

// Every name below is a real key from ESPN's CFB team box score (see the
// schema note above boxYardsPerPlay); the two rows with no such key —
// Yards/Play and Red Zone % — are derived rather than looked up.
// 3rd Down % and Red Zone % both come as an "X-Y" pair, which the bar
// compares as a success *rate* — see parseStatMagnitude.
const BOX_SCORE_STAT_DEFS: BoxScoreStatDef[] = [
  { label: 'Total Yards', get: ({ stats }) => statByName(stats, 'totalYards') },
  { label: 'Passing Yards', get: ({ stats }) => statByName(stats, 'netPassingYards') },
  { label: 'Rushing Yards', get: ({ stats }) => statByName(stats, 'rushingYards') },
  { label: 'Yards/Play', get: ({ stats }) => boxYardsPerPlay(stats) },
  { label: 'Passing Yards/Play', get: ({ stats }) => statByName(stats, 'yardsPerPass') },
  { label: 'Rushing Yards/Play', get: ({ stats }) => statByName(stats, 'yardsPerRushAttempt') },
  { label: '3rd Down %', get: ({ stats }) => statByName(stats, 'thirdDownEff') },
  { label: 'Red Zone %', get: (ctx) => redZoneEfficiency(ctx.response, ctx.teamId, ctx.teamAbbreviation) },
  { label: 'Turnovers', invert: true, get: ({ stats }) => statByName(stats, 'turnovers') },
  { label: 'Time of Possession', get: ({ stats }) => statByName(stats, 'possessionTime') },
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

const ORDINALS = ['', '1st', '2nd', '3rd', '4th']

/**
 * "2nd & 7" from the numbers, when ESPN doesn't hand us its own version.
 *
 * Goal-to-go reads "& Goal" rather than a yard count, the way a broadcast
 * says it, and a distance of zero is inches — a fresh set is never zero
 * yards away, so zero means the ball is on the line.
 */
function formatDownDistance(down: number | undefined, distance: number | undefined, isGoalToGo?: boolean): string | undefined {
  if (!down || down < 1 || down > 4) return undefined
  const ordinal = ORDINALS[down]
  if (isGoalToGo) return `${ordinal} & Goal`
  if (distance === undefined) return ordinal
  if (distance <= 0) return `${ordinal} & inches`
  return `${ordinal} & ${distance}`
}

/** Down and distance at the snap. ESPN's own preformatted text wins when
 * present — it already handles goal-to-go and any convention we'd otherwise
 * guess at — falling back to the raw numbers, and to nothing on a play that
 * has no down (kickoffs, extra points, end of quarter). */
function playDownDistance(play: EspnPlay): string | undefined {
  const start = play.start
  if (!start) return undefined
  const preformatted = start.shortDownDistanceText?.trim()
  if (preformatted) return preformatted
  return formatDownDistance(start.down, start.distance, start.isGoalToGo)
}

/**
 * Formations ESPN prefixes nearly every play text with. They repeat on
 * essentially every snap, which makes them noise rather than information,
 * and they occupy the position the play row now gives to down and distance.
 *
 * Matched only at the very start of the text and only as whole phrases, so
 * a formation named inside a description ("...on the Wildcat snap") is left
 * alone. Anything not on this list survives untouched — an unknown prefix
 * is better shown than silently eaten.
 */
const FORMATION_PREFIXES = [
  'No Huddle-Shotgun',
  'No Huddle Shotgun',
  'No-Huddle Shotgun',
  'Shotgun-No Huddle',
  'No Huddle',
  'No-Huddle',
  'Shotgun',
  'Under Center',
  'Pistol',
  'Wildcat',
]

/**
 * Strips ESPN's leading "(5:16)" snap clock and formation prefix from a play
 * description.
 *
 * The clock goes because the row already prints the play's time in its own
 * column, so it was the same number twice; the formation goes because the
 * row now leads with down and distance instead. Both are removed only from
 * the front of the string, and the rest of the description is never touched.
 */
export function stripPlayPrefix(text: string): string {
  let out = text.trim().replace(/^\(\d{1,2}:\d{2}\)\s*/, '')
  for (const formation of FORMATION_PREFIXES) {
    if (out.toLowerCase().startsWith(formation.toLowerCase())) {
      out = out.slice(formation.length).trimStart()
      break
    }
  }
  return out.length > 0 ? out : text.trim()
}

/**
 * Names a two-point conversion as one.
 *
 * ESPN appends the conversion attempt to the touchdown's own play text and
 * describes it the same way it describes an extra point: "#3 D.Dorwart pass
 * attempt Successful". Only the verb separates them — `kick` is the extra
 * point, `pass`/`rush`/`run` is a two-point try — so a successful two-point
 * conversion read as an ordinary PAT, with nothing on the row saying the
 * team had gone for it and got it.
 *
 * Only the attempt clause is rewritten; the touchdown it hangs off is left
 * exactly as it was. `kick attempt` deliberately doesn't match — an extra
 * point is already described correctly. Nothing here infers a conversion
 * from the score alone: it renames a clause ESPN actually sent.
 */
export function labelTwoPointConversions(text: string): string {
  return text.replace(
    /\b(pass|rush|run)\s+attempt\s+(successful|good|failed|no\s+good|unsuccessful)\b/gi,
    (_match, kind: string, outcome: string) => {
      const good = /^(successful|good)$/i.test(outcome.trim())
      return `TWO-POINT CONVERSION ${good ? 'GOOD' : 'FAILED'} (${kind.toLowerCase()})`
    },
  )
}

function toGamePlay(play: EspnPlay, driveTeam?: { id?: string; abbreviation?: string }): GamePlay | null {
  if (!play.text || play.homeScore === undefined || play.awayScore === undefined) return null
  // isScoringPlay (and the text cleanup that depends on it) is corrected
  // below in normalizePlays, once the real signal — an actual score change
  // versus the previous play — is known; ESPN's own scoringPlay flag isn't
  // reliable enough to use directly (see normalizePlays for why).
  return {
    id: play.id,
    text: labelTwoPointConversions(stripPlayPrefix(play.text)),
    downDistance: playDownDistance(play),
    // The play's own team wins: a drive can contain a snap the other side
    // ran — an interception return, a kickoff — and the drive's team would
    // put the wrong crest beside it.
    offenseTeamId: play.start?.team?.id ?? driveTeam?.id,
    offenseTeamAbbr: play.start?.team?.abbreviation ?? driveTeam?.abbreviation,
    period: play.period?.number ?? 0,
    clock: play.clock?.displayValue ?? '',
    homeScore: play.homeScore,
    awayScore: play.awayScore,
    isScoringPlay: false,
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
/** "12:04" / "0:37" -> seconds remaining in the period. */
function clockSeconds(display: string | undefined): number | undefined {
  const match = display?.match(/^(\d+):(\d{2})$/)
  return match ? Number(match[1]) * 60 + Number(match[2]) : undefined
}

/**
 * Chronological order, which everything downstream assumes and ESPN does
 * not guarantee. Confirmed live: the core plays feed returned a Q4 timeout
 * at 0:41 *after* the touchdown at 0:37, which made the running score step
 * backwards (14-13 -> 7-13) and so registered as a scoring play — putting
 * timeouts and touchbacks under the "Scoring" filter.
 *
 * Sorts on ESPN's own sequenceNumber when every play carries one, else on
 * period ascending and game clock descending. When neither is fully
 * available the original order is kept rather than half-sorted, and the
 * sort is stable, so plays sharing a key keep their incoming order.
 */
function sortPlaysChronologically(plays: EspnPlay[]): EspnPlay[] {
  if (plays.length < 2) return plays

  if (plays.every((p) => Number.isFinite(Number(p.sequenceNumber)))) {
    return [...plays].sort((a, b) => Number(a.sequenceNumber) - Number(b.sequenceNumber))
  }

  const byClock = plays.every((p) => p.period?.number !== undefined && clockSeconds(p.clock?.displayValue) !== undefined)
  if (!byClock) return plays

  return [...plays].sort((a, b) => {
    const periodDiff = (a.period?.number ?? 0) - (b.period?.number ?? 0)
    if (periodDiff !== 0) return periodDiff
    // Later in a period means less time on the clock.
    return (clockSeconds(b.clock?.displayValue) ?? 0) - (clockSeconds(a.clock?.displayValue) ?? 0)
  })
}

export function normalizePlays(response: EspnSummaryResponse): GamePlay[] {
  // Which drive each play came from, so the possessing team survives the
  // flattening. Keyed on the play object itself, which sorting and dedup
  // below pass through by reference rather than copying.
  const driveTeamByPlay = new Map<EspnPlay, { id?: string; abbreviation?: string }>()
  const collect = (drive: EspnDrive | undefined): EspnPlay[] => {
    const plays = drive?.plays ?? []
    if (drive?.team) for (const play of plays) driveTeamByPlay.set(play, drive.team)
    return plays
  }

  const previousPlays = (response.drives?.previous ?? []).flatMap(collect)
  const currentPlays = collect(response.drives?.current)
  const fromDrives = [...previousPlays, ...currentPlays]

  // Fallback: some responses come back with no usable drive data even for a
  // game that has plainly been scored in. The summary carries a separate
  // top-level scoringPlays array, so rather than showing nothing, fall back
  // to that — a scoring-plays-only feed beats an empty panel. Its entries
  // are play objects like the ones inside drives, and everything below is
  // optional-chained, so a response without it just yields [] as before.
  const usingScoringPlaysOnly = fromDrives.length === 0 && (response.scoringPlays?.length ?? 0) > 0
  const chronological = sortPlaysChronologically(usingScoringPlaysOnly ? [...(response.scoringPlays ?? [])] : fromDrives)

  const seen = new Set<string>()
  const deduped = chronological.filter((p) => {
    const key = `${p.period?.number ?? ''}|${p.clock?.displayValue ?? ''}|${p.text ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  const games = deduped.map((p) => toGamePlay(p, driveTeamByPlay.get(p))).filter((p): p is GamePlay => p !== null)

  // ESPN's own scoringPlay flag isn't reliable — confirmed live, it was set
  // on plays whose score hadn't actually changed (a kickoff and a later
  // first-down completion both showing up under the "Scoring" filter, well
  // after the field goal that actually scored). Derive it ourselves
  // instead: the one true signal for "this play scored" is that the
  // running score differs from the play immediately before it, in
  // chronological order — `games` is still oldest-first here, so a simple
  // walk forward does this directly from data we already have.
  let prevHomeScore: number | undefined
  let prevAwayScore: number | undefined
  for (const play of games) {
    const scored =
      prevHomeScore !== undefined && prevAwayScore !== undefined && (play.homeScore !== prevHomeScore || play.awayScore !== prevAwayScore)
    play.isScoringPlay = scored
    if (scored) play.text = cleanPlayText(play.text, true)
    prevHomeScore = play.homeScore
    prevAwayScore = play.awayScore
  }

  // The score-delta walk can't identify the *first* play in a list (there's
  // nothing before it to differ from). That's the right call for a full
  // feed, but when the list is the scoring-plays fallback, every entry in
  // it scored by definition — including the first.
  if (usingScoringPlaysOnly) {
    for (const play of games) {
      play.isScoringPlay = true
      play.text = cleanPlayText(play.text, true)
    }
  }

  return games.reverse()
}

/** What the summary response actually contained, for the "what came back?"
 * detail in an empty stats panel. ESPN's API isn't reachable from the build
 * environment, so this is how a real payload's shape gets reported from the
 * device that can reach it — facts instead of a guess about why a panel is
 * empty. */
export interface SummaryDiagnostics {
  eventId: string
  competitionId: string
  /** Filled in by useGameSummary from the core-API fallback requests. */
  coreStats?: string
  coreCompetitors?: string
  corePlays?: string
  pbpSource: string
  plays: string
  wantTeams: string
  boxTeams: string
  boxPlayers: string
  statNames: string
  leaders: string
  keys: string
}

/** "59/GT:14" — how a section identifies a team, and how much it carries.
 * Reported side by side with the ids Slate is matching on, because a
 * section that has two entries while the panel renders nothing is either a
 * failed match or genuinely empty statistics, and only these two lines
 * together tell them apart. */
function describeEntries(
  entries: { team: { id: string; abbreviation?: string }; statistics?: unknown[] }[] | undefined,
): string {
  if (!entries) return '(absent)'
  if (entries.length === 0) return '0'
  return entries.map((e) => `${e.team.id}/${e.team.abbreviation ?? '?'}:${e.statistics?.length ?? 0}`).join(' ')
}

/** Per-team player categories that actually carry athletes, e.g.
 * "38/COLO: passing:1 rushing:4". A category list with no athletes in it is
 * a skeleton ESPN sends whether or not it has data, so the athlete count —
 * not the category count — is what says whether anything is recoverable. */
function describePlayerEntries(entries: EspnBoxscorePlayerEntry[] | undefined): string {
  if (!entries) return '(absent)'
  if (entries.length === 0) return '0'
  return entries
    .map((entry) => {
      const categories = entry.statistics ?? []
      const label = `${entry.team.id}/${entry.team.abbreviation ?? '?'}`
      const populated = categories.filter((c) => (c.athletes?.length ?? 0) > 0)
      if (populated.length === 0) return `${label}: ${categories.length} cats, 0 athletes`
      return `${label}: ${populated.map((c) => `${c.name}:${c.athletes.length}`).join(' ')}`
    })
    .join(' · ')
}

function describeLeaderEntries(entries: EspnSummaryLeadersEntry[] | undefined): string {
  if (!entries) return '(absent)'
  if (entries.length === 0) return '0'
  return entries
    .map((entry) => {
      const categories = entry.leaders ?? []
      const label = `${entry.team?.id ?? '?'}/${entry.team?.abbreviation ?? '?'}`
      if (categories.length === 0) return `${label}: none`
      return `${label}: ${categories.map((c) => `${c.name}:${c.leaders?.length ?? 0}`).join(' ')}`
    })
    .join(' · ')
}

export function summaryDiagnostics(
  response: EspnSummaryResponse,
  eventId: string,
  competitionId: string,
  home: TeamIdentity,
  away: TeamIdentity,
): SummaryDiagnostics {
  const drives = (response.drives?.previous?.length ?? 0) + (response.drives?.current ? 1 : 0)
  const teams = response.boxscore?.teams
  const firstWithStats = teams?.find((t) => (t.statistics?.length ?? 0) > 0)
  return {
    eventId,
    competitionId,
    pbpSource: response.header?.competitions?.[0]?.playByPlaySource ?? '(absent)',
    plays: `${drives} drives, ${response.scoringPlays?.length ?? 0} scoring`,
    wantTeams: `${home.id}/${home.abbreviation ?? '?'} vs ${away.id}/${away.abbreviation ?? '?'}`,
    boxTeams: describeEntries(teams),
    boxPlayers: describePlayerEntries(response.boxscore?.players),
    statNames:
      firstWithStats?.statistics
        ?.slice(0, 4)
        .map((st) => st.name)
        .join(', ') ?? '(no stats)',
    leaders: describeLeaderEntries(response.leaders),
    keys: Object.keys(response).join(', ') || '(none)',
  }
}

// --- ESPN core API fallback (sports.core.api.espn.com) --------------------
// Reached for only when the summary endpoint comes back empty. Confirmed
// necessary against a real game whose summary returned nothing but empty
// containers; this is a different backing store, not a different spelling
// of the same one.

const CORE_URL = 'https://sports.core.api.espn.com/v2/sports/football/leagues/college-football'

/** The competition id equals the event id for CFB (sportsdataverse defaults
 * `cid` to `event_id` for exactly this reason). */
function coreCompetitionPath(eventId: string, competitionId: string): string {
  return `${CORE_URL}/events/${eventId}/competitions/${competitionId}`
}

/** ESPN hands back `$ref` links as http://, which a page served over https
 * refuses to load as mixed content. Upgrade them rather than silently
 * losing every linked resource. */
function upgradeRef(url: string): string {
  return url.replace(/^http:\/\//, 'https://')
}

/** Requests that back a visible loading state get a deadline. Without one a
 * stalled connection leaves the panel spinning indefinitely with no way
 * back — an error at least settles into a message and a retry. */
const REQUEST_TIMEOUT_MS = 12_000

function timeoutSignal(): AbortSignal | undefined {
  // Safari gained AbortSignal.timeout in 16.4; older browsers simply get
  // the previous no-deadline behaviour rather than a crash.
  return typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined
}

async function getCoreJson<T>(url: string, label: string): Promise<T> {
  const res = await fetch(upgradeRef(url), { signal: timeoutSignal() })
  if (!res.ok) throw new Error(`${label} HTTP ${res.status}`)
  return res.json() as Promise<T>
}

/** Core `$ref` URLs end in the resource id, e.g. .../teams/59?lang=en. */
function idFromRef(ref: string | undefined, resource: string): string | undefined {
  return ref?.match(new RegExp(`/${resource}/(\\d+)`))?.[1]
}

function competitorTeamId(competitor: EspnCoreCompetitor): string | undefined {
  return competitor.team?.id ?? idFromRef(competitor.team?.$ref, 'teams')
}

export interface CoreTeamStatsPair {
  home?: EspnCoreStatisticsResponse
  away?: EspnCoreStatisticsResponse
  /** What the competitors collection actually contained, for the details
   * panel — reported rather than inferred, same as everything else here. */
  competitorSummary: string
}

/**
 * Both teams' core statistics, resolved by following ESPN's own links
 * instead of constructing a path.
 *
 * The previous version built `/competitors/{teamId}/statistics` directly,
 * which assumes a competitor is addressed by its *team* id — a guess, and
 * one that 404s while `/plays` on the same competition returns 200. The
 * competitors collection gives each competitor's own id and a link to its
 * statistics, so use those. Collection items are often `{$ref}` stubs, so
 * unresolved ones are fetched. One call covers both teams, so the shared
 * competitors request isn't made twice.
 */
export async function fetchCoreTeamStats(
  eventId: string,
  competitionId: string,
  homeTeamId: string,
  awayTeamId: string,
): Promise<CoreTeamStatsPair> {
  const list = await getCoreJson<EspnCoreCompetitorsResponse>(
    `${coreCompetitionPath(eventId, competitionId)}/competitors`,
    'core competitors',
  )
  const items = list.items ?? []

  const resolved = await Promise.all(
    items.map(async (item) => {
      if (item.statistics || item.team) return item
      if (!item.$ref) return item
      return getCoreJson<EspnCoreCompetitor>(item.$ref, 'core competitor').catch(() => item)
    }),
  )

  const competitorSummary =
    resolved.length === 0
      ? 'no competitors'
      : resolved
          .map((c) => `${c.id ?? '?'}/team ${competitorTeamId(c) ?? '?'}${c.statistics?.$ref ? '' : ' (no stats link)'}`)
          .join(' · ')

  const statsFor = async (teamId: string): Promise<EspnCoreStatisticsResponse | undefined> => {
    const match = resolved.find((c) => competitorTeamId(c) === teamId)
    const ref = match?.statistics?.$ref
    if (!ref) return undefined
    return getCoreJson<EspnCoreStatisticsResponse>(ref, 'core statistics').catch(() => undefined)
  }

  const [home, away] = await Promise.all([statsFor(homeTeamId), statsFor(awayTeamId)])
  return { home, away, competitorSummary }
}

export async function fetchCorePlays(eventId: string, competitionId: string): Promise<EspnCorePlaysResponse> {
  return getCoreJson<EspnCorePlaysResponse>(`${coreCompetitionPath(eventId, competitionId)}/plays?limit=1000`, 'core plays')
}

/** This API varies its container shapes between endpoints, so nothing here
 * assumes a field is an array just because it usually is. */
function asArray<T>(value: T[] | T | undefined): T[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

/**
 * The stat categories from a core statistics response, whichever shape it
 * arrived in: `splits` as a list, `splits` as a single object, or
 * `categories` at the top level.
 *
 * The single-object form is what season team statistics actually return,
 * and treating it as a list crashed the app with "(e.splits ?? []).flatMap
 * is not a function" — a blank screen, since this runs during render.
 * Every core-stats consumer goes through here so that can't diverge again.
 */
function coreCategories(response: EspnCoreStatisticsResponse | undefined): EspnCoreStatCategory[] {
  if (!response) return []
  const fromSplits = asArray(response.splits).flatMap((split) => asArray(split?.categories))
  return fromSplits.length > 0 ? fromSplits : asArray(response.categories)
}

/**
 * Flattens the core API's split/category/stat nesting into the same flat
 * `{name, displayValue}` list the summary's box score uses, so the existing
 * BOX_SCORE_STAT_DEFS work against it unchanged. Core and site occasionally
 * spell the same stat differently (yardsPerPassAttempt vs yardsPerPass), so
 * the site spelling is added as an alias where they diverge rather than
 * duplicating the stat definitions.
 */
const CORE_STAT_ALIASES: Record<string, string> = {
  yardsPerPassAttempt: 'yardsPerPass',
  yardsPerRushingAttempt: 'yardsPerRushAttempt',
  netTotalYards: 'totalYards',
  totalOffensiveYards: 'totalYards',
}

export function flattenCoreStats(response: EspnCoreStatisticsResponse | undefined): { name: string; displayValue: string }[] {
  const flat: { name: string; displayValue: string }[] = []
  const seen = new Set<string>()
  const push = (name: string | undefined, displayValue: string | undefined) => {
    if (!name || displayValue === undefined || seen.has(name)) return
    seen.add(name)
    flat.push({ name, displayValue })
  }
  for (const category of coreCategories(response)) {
    for (const stat of asArray(category.stats)) {
      const displayValue = stat.displayValue ?? (stat.value !== undefined ? String(stat.value) : undefined)
      push(stat.name, displayValue)
      const alias = stat.name ? CORE_STAT_ALIASES[stat.name] : undefined
      push(alias, displayValue)
    }
  }
  return flat
}

/** Builds the same GameBoxScore shape from core stats, so the UI renders it
 * identically to a summary-sourced one. Leaders aren't available here — the
 * core equivalent is a separate per-team request — so they stay empty. */
export function boxScoreFromCoreStats(
  home: EspnCoreStatisticsResponse | undefined,
  away: EspnCoreStatisticsResponse | undefined,
  response: EspnSummaryResponse,
  homeTeamId: string,
  awayTeamId: string,
): GameBoxScore {
  const homeStats = flattenCoreStats(home)
  const awayStats = flattenCoreStats(away)
  const teamStats: TeamStatLine[] = []
  for (const def of BOX_SCORE_STAT_DEFS) {
    const homeValue = def.get({ stats: homeStats, response, teamId: homeTeamId, teamAbbreviation: '' })
    const awayValue = def.get({ stats: awayStats, response, teamId: awayTeamId, teamAbbreviation: '' })
    if (homeValue !== undefined && awayValue !== undefined) {
      teamStats.push({ label: def.label, homeValue, awayValue, invert: def.invert })
    }
  }
  return { teamStats, homeLeaders: [], awayLeaders: [] }
}

/** Core plays are the same objects the summary nests inside drives, so this
 * reuses the summary path wholesale — dedupe, score-delta scoring detection
 * and the 1ST DOWN cleanup all apply identically. */
export function normalizeCorePlays(response: EspnCorePlaysResponse | undefined): GamePlay[] {
  if (!response?.items?.length) return []
  return normalizePlays({ drives: { previous: [{ plays: response.items }] } })
}

/** Names the core API actually returned, for the empty-panel details — the
 * same "report it, don't infer it" loop that identified this problem. */
export function describeCoreStats(response: EspnCoreStatisticsResponse | undefined): string {
  if (!response) return '(not fetched)'
  const categories = coreCategories(response)
  if (categories.length === 0) return 'no categories'
  const total = categories.reduce((n, c) => n + (c.stats?.length ?? 0), 0)
  return `${categories.length} cats, ${total} stats: ${categories.map((c) => c.name ?? '?').join(' ')}`
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
  const res = await fetch(`${TEAMS_URL}/${teamId}/statistics?season=${year}&seasontype=2`, { signal: timeoutSignal() })
  // A team that hasn't played yet has no statistics resource at all. That's
  // an empty season, not a failure — returning an empty response lets the
  // page say "no stats posted yet" instead of "couldn't load".
  if (res.status === 404) return {}
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
  /** The ESPN stat this row reads, used to look up a national rank on the
   * team page. Absent for derived rows (yards per play), which have no
   * single underlying stat and so no rank. */
  rankKey?: string
  // Lower is better for allowed/defense stats (and for turnovers) — flips
  // which team's bar segment reads as "ahead" rather than just "bigger".
  invert?: boolean
  get: (own: Map<string, EspnTeamStatEntry>, allowed: Map<string, EspnTeamStatEntry>) => string | undefined
}

const SEASON_STAT_DEFS: SeasonStatDef[] = [
  // Offense
  { label: 'Points Per Game', section: 'offense', rankKey: 'totalPointsPerGame', get: (own) => statDisplay(own, 'totalPointsPerGame', false) },
  // "yardsPerGame" lives inside ESPN's passing category despite meaning
  // total offensive yards per game — confirmed against the real payload.
  { label: 'Total Yards Per Game', section: 'offense', rankKey: 'yardsPerGame', get: (own) => statDisplay(own, 'yardsPerGame', false) },
  { label: 'Passing Yards Per Game', section: 'offense', rankKey: 'passingYardsPerGame', get: (own) => statDisplay(own, 'passingYardsPerGame', false) },
  { label: 'Rushing Yards Per Game', section: 'offense', rankKey: 'rushingYardsPerGame', get: (own) => statDisplay(own, 'rushingYardsPerGame', false) },
  { label: 'First Downs Per Game', section: 'offense', rankKey: 'firstDowns', get: (own) => statDisplay(own, 'firstDowns', true) },
  { label: 'Yards Per Play', section: 'offense', get: (own) => yardsPerPlay(own) },
  { label: 'Passing Yards Per Play', section: 'offense', rankKey: 'yardsPerPassAttempt', get: (own) => statDisplay(own, 'yardsPerPassAttempt', false) },
  { label: 'Rushing Yards Per Play', section: 'offense', rankKey: 'yardsPerRushAttempt', get: (own) => statDisplay(own, 'yardsPerRushAttempt', false) },
  // Defense (all "allowed" — lower is better, so bars invert)
  { label: 'Points Allowed Per Game', section: 'defense', invert: true, rankKey: 'totalPointsPerGame', get: (_own, allowed) => statDisplay(allowed, 'totalPointsPerGame', false) },
  { label: 'Total Yards Allowed Per Game', section: 'defense', invert: true, rankKey: 'yardsPerGame', get: (_own, allowed) => statDisplay(allowed, 'yardsPerGame', false) },
  { label: 'Passing Yards Allowed Per Game', section: 'defense', invert: true, rankKey: 'passingYardsPerGame', get: (_own, allowed) => statDisplay(allowed, 'passingYardsPerGame', false) },
  { label: 'Rushing Yards Allowed Per Game', section: 'defense', invert: true, rankKey: 'rushingYardsPerGame', get: (_own, allowed) => statDisplay(allowed, 'rushingYardsPerGame', false) },
  { label: 'Yards Allowed Per Play', section: 'defense', invert: true, get: (_own, allowed) => yardsPerPlay(allowed) },
  { label: 'Passing Yards Allowed Per Play', section: 'defense', invert: true, rankKey: 'yardsPerPassAttempt', get: (_own, allowed) => statDisplay(allowed, 'yardsPerPassAttempt', false) },
  { label: 'Rushing Yards Allowed Per Play', section: 'defense', invert: true, rankKey: 'yardsPerRushAttempt', get: (_own, allowed) => statDisplay(allowed, 'yardsPerRushAttempt', false) },
  // Turnovers — giving the ball away is bad (fewer is better), taking it
  // away is good (more is better), so only Turnovers inverts.
  { label: 'Turnovers', section: 'turnovers', invert: true, rankKey: 'totalGiveaways', get: (own) => statDisplay(own, 'totalGiveaways', false) },
  { label: 'Takeaways', section: 'turnovers', rankKey: 'totalTakeaways', get: (own) => statDisplay(own, 'totalTakeaways', false) },
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

/**
 * Does ESPN have a live stats feed for this game at all? `playByPlaySource`
 * is ESPN's own flag and can literally be "none" — when it is, the payload
 * carries no drives and no team statistics no matter how far along the game
 * is, so an empty box score means "ESPN isn't covering this game" rather
 * than "Slate failed to parse it". Anything else (including a missing
 * field) is treated as "should have data", since only the explicit "none"
 * is a definite negative.
 */
export function summaryHasPlayByPlay(response: EspnSummaryResponse): boolean {
  return response.header?.competitions?.[0]?.playByPlaySource !== 'none'
}

/**
 * Finds one team's entry in a summary section keyed by ESPN team id. A
 * single id mismatch would silently blank *every* stat row, so when the id
 * lookup misses, fall back to elimination: these sections always carry
 * exactly the two teams in this game, so if the *other* team matched by id,
 * the remaining entry can only be this one. Deliberately gives up rather
 * than guessing by array position when neither id matches — showing one
 * team's stats under the other team's column would be worse than showing
 * none, and the UI now says so explicitly instead of rendering nothing.
 */
function findTeamEntry<T extends { team: { id: string; abbreviation?: string } }>(
  entries: T[] | undefined,
  team: TeamIdentity,
  otherTeam: TeamIdentity,
): T | undefined {
  if (!entries) return undefined

  const byId = entries.find((e) => e.team.id === team.id)
  if (byId) return byId

  // Abbreviation is a real identifier, not a positional guess, so it can't
  // silently swap the two columns the way an index would.
  const wantAbbreviation = team.abbreviation?.toUpperCase()
  const byAbbreviation = wantAbbreviation
    ? entries.find((e) => e.team.abbreviation?.toUpperCase() === wantAbbreviation)
    : undefined
  if (byAbbreviation) return byAbbreviation

  if (entries.length !== 2) return undefined
  const otherAbbreviation = otherTeam.abbreviation?.toUpperCase()
  const otherIndex = entries.findIndex(
    (e) => e.team.id === otherTeam.id || (otherAbbreviation !== undefined && e.team.abbreviation?.toUpperCase() === otherAbbreviation),
  )
  return otherIndex === -1 ? undefined : entries[1 - otherIndex]
}

/** Enough of a team to be recognised in a summary section — the id ESPN
 * usually keys on, plus the abbreviation to fall back to when it doesn't. */
export interface TeamIdentity {
  id: string
  abbreviation?: string
}

/** Game leaders from the summary's own top-level `leaders` array, used when
 * the player box score doesn't yield any — a real response was confirmed to
 * carry `leaders` while carrying no drives at all. */
function leadersFromSummary(response: EspnSummaryResponse, team: TeamIdentity, otherTeam: TeamIdentity): StatLeader[] {
  const entries = response.leaders
  if (!entries) return []
  const wantAbbreviation = team.abbreviation?.toUpperCase()
  const otherAbbreviation = otherTeam.abbreviation?.toUpperCase()
  const otherIndex = entries.findIndex(
    (e) => e.team?.id === otherTeam.id || (otherAbbreviation !== undefined && e.team?.abbreviation?.toUpperCase() === otherAbbreviation),
  )
  const match =
    entries.find((e) => e.team?.id === team.id) ??
    (wantAbbreviation ? entries.find((e) => e.team?.abbreviation?.toUpperCase() === wantAbbreviation) : undefined) ??
    (entries.length === 2 && otherIndex !== -1 ? entries[1 - otherIndex] : undefined)
  return parseSeasonLeaders(match?.leaders)
}

export function normalizeBoxScore(response: EspnSummaryResponse, home: TeamIdentity, away: TeamIdentity): GameBoxScore {
  const homeTeamId = home.id
  const awayTeamId = away.id
  const teams = response.boxscore?.teams
  const homeEntry = findTeamEntry<EspnBoxscoreTeamEntry>(teams, home, away)
  const awayEntry = findTeamEntry<EspnBoxscoreTeamEntry>(teams, away, home)

  const teamStats: TeamStatLine[] = []
  for (const def of BOX_SCORE_STAT_DEFS) {
    const homeValue = def.get({
      stats: homeEntry?.statistics,
      response,
      teamId: homeTeamId,
      teamAbbreviation: homeEntry?.team.abbreviation ?? '',
    })
    const awayValue = def.get({
      stats: awayEntry?.statistics,
      response,
      teamId: awayTeamId,
      teamAbbreviation: awayEntry?.team.abbreviation ?? '',
    })
    if (homeValue !== undefined && awayValue !== undefined) {
      teamStats.push({ label: def.label, homeValue, awayValue, invert: def.invert })
    }
  }

  const players = response.boxscore?.players
  const homePlayers = findTeamEntry<EspnBoxscorePlayerEntry>(players, home, away)
  const awayPlayers = findTeamEntry<EspnBoxscorePlayerEntry>(players, away, home)

  // The player box score is the richer source (it carries stat lines), so
  // it wins; the summary's own leaders array is the fallback for a response
  // that has one and not the other.
  const homeLeaders = parseGameLeaders(homePlayers)
  const awayLeaders = parseGameLeaders(awayPlayers)

  return {
    teamStats,
    homeLeaders: homeLeaders.length > 0 ? homeLeaders : leadersFromSummary(response, home, away),
    awayLeaders: awayLeaders.length > 0 ? awayLeaders : leadersFromSummary(response, away, home),
  }
}

// --- Team page: schedule + single-team season profile ----------------------

/**
 * The set of FBS team ids for a season, read from the core API's group-80
 * membership (80 is FBS — the same group the scoreboard already filters
 * on). Collection items are `$ref` pointers, and the team id is the
 * trailing path segment, so membership is established without fetching
 * each team.
 *
 * Used to suppress national ranks on FCS team pages: those ranks are
 * computed over FBS, so showing one next to an FCS team's numbers implies
 * a comparison that wasn't made.
 */
export async function fetchFbsTeamIds(year: number): Promise<Set<string>> {
  const ids = new Set<string>()
  let page = 1
  // Bounded rather than while(true): one page covers FBS at limit=500, and
  // a malformed pageCount shouldn't spin.
  for (let guard = 0; guard < 5; guard++) {
    const body = await getCoreJson<{ items?: (EspnCoreRef & { id?: string })[]; pageCount?: number; pageIndex?: number }>(
      `${CORE_URL}/seasons/${year}/types/2/groups/${FBS_GROUP}/teams?limit=500&page=${page}`,
      'core FBS teams',
    )
    for (const item of body.items ?? []) {
      const id = item.id ?? idFromRef(item.$ref, 'teams')
      if (id) ids.add(id)
    }
    const pageCount = body.pageCount ?? 1
    const pageIndex = body.pageIndex ?? page
    if (pageIndex >= pageCount || (body.items ?? []).length === 0) break
    page = pageIndex + 1
  }
  return ids
}

/**
 * A team's season statistics from the core API, used purely as a rank
 * source. The site endpoint's own-team categories carry no rank on any
 * copy of any stat — established by scanning every occurrence and finding
 * none — while its opponent categories do, which is why defensive rows had
 * ranks and offensive ones never could.
 *
 * Resolved by following links rather than composing a path, the same way
 * the in-game core fallback does: fetch the season team object, then its
 * statistics.$ref. Constructing the sub-path directly is what 404'd the
 * first time that API was used here.
 */
export async function fetchCoreTeamSeasonStats(teamId: string, year: number): Promise<EspnCoreStatisticsResponse> {
  const team = await getCoreJson<{ statistics?: EspnCoreRef }>(
    // Team objects sit directly under the season, NOT under a season type:
    // seasons/{year}/teams/{id}. Composing .../types/2/teams/{id} is what
    // returned "core season team HTTP 404" on a device. The statistics link
    // is then followed rather than composed, for the same reason.
    `${CORE_URL}/seasons/${year}/teams/${teamId}`,
    'core season team',
  )
  const ref = team.statistics?.$ref
  if (!ref) throw new Error('core season team has no statistics link')
  return getCoreJson<EspnCoreStatisticsResponse>(ref, 'core season statistics')
}

/**
 * name -> rank, for every core stat that carries one. Values are ignored
 * here: the site endpoint remains the source of truth for what's displayed,
 * so the two can't disagree on a number. This only fills in the rank column.
 */
export function coreRankMap(response: EspnCoreStatisticsResponse | undefined): Map<string, string> {
  const ranks = new Map<string, string>()
  if (!response) return ranks
  for (const category of coreCategories(response)) {
    for (const stat of asArray(category.stats)) {
      if (!stat.name || ranks.has(stat.name)) continue
      if (stat.rankDisplayValue) ranks.set(stat.name, stat.rankDisplayValue)
      else if (typeof stat.rank === 'number' && stat.rank > 0) ranks.set(stat.name, ordinal(stat.rank))
    }
  }
  return ranks
}

/** What the core rank source actually returned, so a still-empty rank
 * column reports itself instead of being guessed at a fourth time. */
export function describeRankSource(response: EspnCoreStatisticsResponse | undefined, error: string | undefined): string {
  if (error) return error
  if (!response) return '(not fetched)'
  const ranks = coreRankMap(response)
  if (ranks.size > 0) return `${ranks.size} ranks`
  const categories = coreCategories(response)
  const names = categories.flatMap((c) => asArray(c.stats).map((st) => st.name ?? '?')).slice(0, 6)
  return categories.length === 0 ? 'no categories' : `0 ranks in ${categories.length} cats: ${names.join(', ')}`
}

/**
 * A team's full season schedule. The events come back in the same shape the
 * scoreboard uses — competitions with competitors, status, broadcasts and a
 * venue — so normalizeEvent handles them unchanged rather than needing a
 * second parser that could drift from the first.
 */
export async function fetchTeamSchedule(teamId: string, year: number): Promise<EspnTeamScheduleResponse> {
  const res = await fetch(`${TEAMS_URL}/${teamId}/schedule?season=${year}`, { signal: timeoutSignal() })
  if (!res.ok) throw new Error(`ESPN team schedule request failed: ${res.status}`)
  return res.json() as Promise<EspnTeamScheduleResponse>
}

export function normalizeTeamSchedule(response: EspnTeamScheduleResponse | undefined): Game[] {
  return (response?.events ?? [])
    .map(normalizeEvent)
    .filter((g): g is Game => g !== null)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
}

/** One row on a team's own season profile: the value, and its national rank
 * when ESPN actually supplies one. */
export interface TeamProfileStat {
  label: string
  value: string
  section: 'offense' | 'defense' | 'turnovers'
  rank?: string
}

/**
 * A stat's national rank, searched across every category rather than the
 * deduped value map.
 *
 * flattenStatCategories keeps the *first* occurrence of a repeated stat
 * name, deliberately, because the categories disagree on the value. But
 * ranks aren't always on that first copy: a team's own stats came back with
 * ranks only on the later duplicates, so reading through the map showed
 * ranks for every defensive row (whose categories barely duplicate) and
 * none at all on offense. Scanning every occurrence can only find a rank
 * the map would have missed — it never changes the displayed value.
 *
 * Still returns undefined when no copy carries one, rather than inventing a
 * placeholder that reads as data.
 */
function statRank(categories: EspnTeamStatCategory[] | undefined, name: string): string | undefined {
  for (const category of categories ?? []) {
    for (const stat of category.stats ?? []) {
      if (stat.name !== name) continue
      if (stat.rankDisplayValue) return stat.rankDisplayValue
      if (typeof stat.rank === 'number' && stat.rank > 0) return ordinal(stat.rank)
    }
  }
  return undefined
}

function ordinal(n: number): string {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  const suffix = ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'
  return `${n}${n % 10 <= 3 ? suffix : 'th'}`
}

/**
 * The same stat set the pre-game comparison uses, rendered for one team on
 * its own. Reusing SEASON_STAT_DEFS keeps the two surfaces from drifting —
 * a stat added to the matchup comparison shows up here too.
 */
export function normalizeTeamProfile(
  response: EspnTeamStatisticsResponse | undefined,
  expectedYear: number,
  coreRanks?: Map<string, string>,
  /** National ranks are computed over FBS, so an FCS team gets none at all
   * — a rank beside its numbers would imply a comparison nobody made. */
  showRanks = true,
): TeamProfileStat[] {
  if (!response) return []
  // Same guard as the comparison: this endpoint silently serves a completed
  // season when the requested one has no data yet, and stale numbers are
  // worse than none.
  if (response.requestedSeason?.year !== expectedYear) return []

  const ownCategories = response.results?.stats?.categories
  const allowedCategories = response.results?.opponent
  const own = flattenStatCategories(ownCategories)
  const allowed = flattenStatCategories(allowedCategories)

  const rows: TeamProfileStat[] = []
  for (const def of SEASON_STAT_DEFS) {
    const value = def.get(own, allowed)
    if (value === undefined) continue
    // The site payload's own-team categories carry no ranks, so an offensive
    // or turnover row falls back to the core API's season ranks. Defensive
    // rows keep reading the opponent side, which does carry them and which
    // the core source has no equivalent of.
    const rank =
      showRanks && def.rankKey
        ? (statRank(def.section === 'defense' ? allowedCategories : ownCategories, def.rankKey) ??
          (def.section === 'defense' ? undefined : coreRanks?.get(def.rankKey)))
        : undefined
    rows.push({ label: def.label, value, section: def.section, rank })
  }
  return rows
}
