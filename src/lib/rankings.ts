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
function findPolls(payload: unknown): Record<string, unknown>[] {
  const polls: Record<string, unknown>[] = []
  const seen = new Set<unknown>()
  const walk = (node: unknown, depth: number): void => {
    if (depth > 10 || !isRecord(node) || seen.has(node)) return
    seen.add(node)
    if (Array.isArray(node.ranks)) polls.push(node)
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach((item) => walk(item, depth + 1))
      else if (isRecord(value)) walk(value, depth + 1)
    }
  }
  walk(payload, 0)
  return polls
}

/**
 * The AP poll out of however many the response carries.
 *
 * Matched on the poll's own names rather than on its position in the list,
 * because the order changes through the season — the committee's rankings
 * appear in December and have been first in the list before. A poll naming
 * coaches is explicitly rejected rather than merely not preferred: "USA
 * Today Coaches Poll" would otherwise match nothing and win by being first.
 */
function pickApPoll(polls: Record<string, unknown>[]): Record<string, unknown> | undefined {
  const names = (poll: Record<string, unknown>): string =>
    [text(poll.name), text(poll.shortName), text(poll.type), text(poll.displayName)].join(' ')
  const ap = polls.find((poll) => {
    const label = names(poll)
    return /\bap\b|associated press/.test(label) && !/coach/.test(label)
  })
  return ap ?? polls.find((poll) => !/coach/.test(names(poll))) ?? polls[0]
}

function pollLabel(poll: Record<string, unknown> | undefined): string {
  const name = typeof poll?.name === 'string' ? poll.name : undefined
  const short = typeof poll?.shortName === 'string' ? poll.shortName : undefined
  // Whichever already says "Top 25" is the heading, as-is. Otherwise the
  // feed's own name, unchanged — appending "Top 25" to something like "USA
  // Today Coaches Poll" reads worse than the name on its own, and inventing
  // a caption for a poll we didn't recognize is how a list ends up labelled
  // as something it isn't.
  for (const candidate of [name, short]) {
    if (candidate && /top\s*25/i.test(candidate)) return candidate
  }
  return name ?? short ?? 'Top 25'
}

export function rankingsFrom(payload: unknown, known: Set<string> = new Set(ALL_TEAMS.map((t) => t.id))): Rankings {
  const poll = pickApPoll(findPolls(payload))
  const byTeamId = new Map<string, TeamRanking>()
  if (!poll) return NO_RANKINGS

  for (const entry of poll.ranks as unknown[]) {
    if (!isRecord(entry)) continue
    const teamId = teamIdFrom(entry, known)
    const rank = rankFrom(entry)
    if (!teamId || rank === undefined || byTeamId.has(teamId)) continue
    byTeamId.set(teamId, { rank, record: recordFrom(entry) })
  }
  return byTeamId.size === 0 ? NO_RANKINGS : { byTeamId, pollName: pollLabel(poll) }
}

export async function fetchRankings(): Promise<unknown> {
  const res = await fetch(RANKINGS_URL, { cache: 'no-store' })
  if (!res.ok) throw new Error(`ESPN rankings HTTP ${res.status}`)
  return res.json() as Promise<unknown>
}
