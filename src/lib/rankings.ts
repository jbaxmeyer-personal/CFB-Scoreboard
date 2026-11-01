/**
 * The AP Top 25, keyed by team id.
 *
 * Read the same defensive way the standings are: ESPN can't be reached from
 * the build environment, so the payload is walked as a tree rather than
 * addressed by a path, and anything unrecognized costs the ranks and
 * nothing else. Without ranks the Standings screen drops its Top 25 section
 * and its badges; the conference tables are unaffected.
 *
 * One thing here does need addressing rather than walking, though. This
 * endpoint carries several polls — AP, the coaches' poll, and in December
 * the committee's rankings — and blindly collecting every `rank` in the
 * tree would interleave them, giving some teams the coaches' number and
 * some the AP's. So the poll is chosen first, and only then parsed.
 */
import { ALL_TEAMS } from '../data/teams'

const RANKINGS_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings'

export interface TeamRanking {
  rank: number
  /** ESPN sends a record string alongside the poll on some shapes. Used
   * only as a backstop where the standings feed had nothing for a team. */
  record?: string
}

export interface Rankings {
  byTeamId: Map<string, TeamRanking>
  /** Which poll these came from, for the screen's section heading — "AP Top
   * 25" when it could be identified, and the feed's own name otherwise, so
   * nothing is captioned as the AP poll that isn't. */
  pollName: string
}

export const NO_RANKINGS: Rankings = { byTeamId: new Map(), pollName: 'Top 25' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase() : ''
}

function idFromRef(ref: unknown): string | undefined {
  return typeof ref === 'string' ? /\/teams\/(\d+)/.exec(ref)?.[1] : undefined
}

function teamIdFrom(node: Record<string, unknown>, known: Set<string>): string | undefined {
  const team = node.team
  if (isRecord(team)) {
    const direct = typeof team.id === 'number' ? String(team.id) : typeof team.id === 'string' ? team.id : undefined
    if (direct && known.has(direct)) return direct
    const ref = idFromRef(team.$ref)
    if (ref && known.has(ref)) return ref
  }
  const own = typeof node.teamId === 'number' ? String(node.teamId) : typeof node.teamId === 'string' ? node.teamId : undefined
  return own && known.has(own) ? own : undefined
}

/** 1-25 and nothing else: the badge is a Top 25 badge, and "others
 * receiving votes" at 38 is not a thing to put on a logo. */
function rankFrom(node: Record<string, unknown>): number | undefined {
  for (const key of ['current', 'rank', 'position'] as const) {
    const value = node[key]
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
    if (Number.isInteger(n) && n >= 1 && n <= 25) return n
  }
  return undefined
}

function recordFrom(node: Record<string, unknown>): string | undefined {
  for (const key of ['recordSummary', 'record', 'summary'] as const) {
    const value = node[key]
    if (typeof value === 'string' && /^\d{1,3}-\d{1,3}/.test(value.trim())) return value.trim()
  }
  return undefined
}

/**
 * Every node in the tree carrying a `ranks` array, which is what a poll
 * looks like whatever it is nested under.
 */
interface Poll {
  node: Record<string, unknown>
  /** The nearest season year at or above this poll in the payload, if it
   * carries one. Used only to spot a stale poll — see pollOrder. */
  season?: number
}

/**
 * Every node in the tree carrying a `ranks` array, which is what a poll
 * looks like whatever it is nested under, each with the season it was found
 * under.
 */
function findPolls(payload: unknown): Poll[] {
  const polls: Poll[] = []
  const seen = new Set<unknown>()
  const walk = (node: unknown, depth: number, season: number | undefined): void => {
    if (depth > 10 || !isRecord(node) || seen.has(node)) return
    seen.add(node)
    const own = isRecord(node.season) && typeof node.season.year === 'number' ? node.season.year : undefined
    const inherited = own ?? season
    if (Array.isArray(node.ranks)) polls.push({ node, season: inherited })
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach((item) => walk(item, depth + 1, inherited))
      else if (isRecord(value)) walk(value, depth + 1, inherited)
    }
  }
  walk(payload, 0, undefined)
  return polls
}

function pollNames(poll: Poll): string {
  const n = poll.node
  return [text(n.name), text(n.shortName), text(n.type), text(n.displayName)].join(' ')
}

/**
 * Which poll this app wants, lower first.
 *
 * The College Football Playoff rankings are the ones that matter once they
 * exist: from the first Tuesday they are released until the field is set,
 * they are what the season is actually being decided by, and the AP poll
 * becomes a sidebar. Before that they do not exist at all, so the AP poll
 * is the Top 25.
 *
 * Expressed as "prefer the CFP poll whenever there is one" rather than as a
 * date, deliberately. A date would need editing every November — and it is
 * the kind of edit nobody remembers until the wrong list has been on screen
 * for a week. Asking the payload what it has makes the switch happen by
 * itself, every season, in both directions: the CFP rankings appear in
 * November and this follows them, they stop being published after the
 * field is set and this falls back on its own.
 *
 * The coaches' poll is last rather than excluded: if it were somehow the
 * only poll in the response, showing it correctly labelled beats showing
 * nothing.
 */
function pollOrder(poll: Poll, currentSeason: number | undefined): number {
  const label = pollNames(poll)
  // A poll stamped with an older season is last whatever it is called. In
  // September, a response still carrying last season's final CFP rankings
  // would otherwise outrank this season's live AP poll — the exact failure
  // "use the CFP rankings when they come out" turns into next year if it is
  // written as "prefer the CFP rankings" and nothing checks when they are
  // from.
  const stale = currentSeason !== undefined && poll.season !== undefined && poll.season < currentSeason ? 10 : 0
  if (/college football playoff|\bcfp\b/.test(label)) return stale + 0
  if (/\bap\b|associated press/.test(label) && !/coach/.test(label)) return stale + 1
  if (/coach/.test(label)) return stale + 3
  return stale + 2
}

function pollLabel(poll: Record<string, unknown> | undefined): string {
  const name = typeof poll?.name === 'string' ? poll.name : undefined
  const short = typeof poll?.shortName === 'string' ? poll.shortName : undefined
  // Whichever already says "Top 25" is the heading, as-is. Otherwise the
  // feed's short name, which is what fits a column header — "CFP Rankings"
  // rather than "College Football Playoff Rankings". Never a caption of our
  // own: inventing one is how a list ends up labelled as something it is
  // not, and the heading is the only thing telling you which poll you are
  // reading.
  for (const candidate of [name, short]) {
    if (candidate && /top\s*25/i.test(candidate)) return candidate
  }
  return short ?? name ?? 'Top 25'
}

function entriesOf(poll: Poll, known: Set<string>): Map<string, TeamRanking> {
  const byTeamId = new Map<string, TeamRanking>()
  for (const entry of poll.node.ranks as unknown[]) {
    if (!isRecord(entry)) continue
    const teamId = teamIdFrom(entry, known)
    const rank = rankFrom(entry)
    if (!teamId || rank === undefined || byTeamId.has(teamId)) continue
    byTeamId.set(teamId, { rank, record: recordFrom(entry) })
  }
  return byTeamId
}

/**
 * The poll to show, and its teams.
 *
 * Polls are tried in preference order and the first one that actually
 * yields teams wins. That last part matters on the Tuesday the CFP
 * rankings are released: ESPN can carry the poll with an empty `ranks`
 * array before the show airs, and preferring it on name alone would empty
 * the Top 25 section for the day rather than leaving the AP poll up until
 * the real thing lands.
 */
export function rankingsFrom(
  payload: unknown,
  known: Set<string> = new Set(ALL_TEAMS.map((t) => t.id)),
  currentSeason?: number,
): Rankings {
  const polls = findPolls(payload)
    .map((poll, index) => ({ poll, order: pollOrder(poll, currentSeason), index }))
    // `index` keeps it stable, so two polls we rank equally stay in the
    // order ESPN listed them.
    .sort((a, b) => a.order - b.order || a.index - b.index)

  for (const { poll } of polls) {
    const byTeamId = entriesOf(poll, known)
    if (byTeamId.size > 0) return { byTeamId, pollName: pollLabel(poll.node) }
  }
  return NO_RANKINGS
}

export async function fetchRankings(): Promise<unknown> {
  const res = await fetch(RANKINGS_URL, { cache: 'no-store' })
  if (!res.ok) throw new Error(`ESPN rankings HTTP ${res.status}`)
  return res.json() as Promise<unknown>
}
