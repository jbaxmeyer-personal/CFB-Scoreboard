/**
 * Conference standings: every FBS conference, its teams, and their records.
 *
 * Built deliberately the other way round from the rest of the app's ESPN
 * code. The *table* — which conferences exist, who is in them, each team's
 * name, shield and logo — comes entirely from the static tables in
 * src/data, so the screen renders in full before any request is made and
 * still renders in full if the request fails. The only thing asked of ESPN
 * is a record per team id, overlaid onto that table.
 *
 * That split is the point. Slate has shipped a blank panel twice now by
 * taking a response shape on trust (a linescore that turned out to carry
 * `displayValue` and no `value`; a conference list built from an API whose
 * shape couldn't be checked here). ESPN is not reachable from this build
 * environment, so the standings shape cannot be checked either — and the
 * worst case had to be "a complete table with no records in it", not an
 * empty tab.
 *
 * Hence the parser below reads the payload as a tree rather than as a known
 * structure: it goes looking for anything that resolves to a team id and a
 * won-lost record, wherever it sits and however it is spelled. Grouping,
 * ordering and naming are ours.
 */
import type { Team } from '../types/game'
import { ALL_TEAMS } from '../data/teams'
import { CONFERENCES, type Conference } from '../data/conferences'
import { hidesTeamSeason, type SpoilerSettings } from './spoilers'

const STANDINGS_URL = 'https://site.api.espn.com/apis/v2/sports/football/college-football/standings'

/** A team's won-lost record, as parsed out of the standings payload. */
export interface TeamRecord {
  /** e.g. "5-2", straight from the feed where it sends one. */
  overall?: string
  conference?: string
  /** Parsed out of the strings above, for ordering. */
  overallWins?: number
  overallLosses?: number
  conferenceWins?: number
  conferenceLosses?: number
}

export interface StandingsRow {
  team: Team
  /** Absent when the feed had nothing for this team — a team that hasn't
   * played, or a payload that didn't mention them. */
  record?: TeamRecord
  /** This team's season is withheld under no-spoilers. The row still
   * appears; its records don't. */
  hidden: boolean
}

export interface ConferenceStandings {
  conference: Conference
  rows: StandingsRow[]
  /**
   * These rows are in alphabetical order and carry no position numbers,
   * for one of two reasons.
   *
   * Either a team in this conference is protected — a protected team's
   * *position* gives its record away as surely as the record does, so one
   * hidden team unranks its conference while the rest stay ranked — or
   * nothing here has a record at all, in which case numbering the rows
   * 1-14 down an alphabetical list states a standing nobody has. That
   * second one is what July looks like, and what a failed request looks
   * like.
   */
  unranked: boolean
  /** True only for the first of those reasons, which is the one the screen
   * owes the reader an explanation for. */
  hidesRecords: boolean
}

export interface StandingsData {
  conferences: ConferenceStandings[]
  /** How many teams the feed gave a record for, across everything. Zero
   * with no error means the request was answered and understood nothing. */
  teamsWithRecords: number
  /** Plain-language note for the screen when something is off, in the same
   * spirit as the empty box-score diagnostics. */
  note?: string
}

const RECORD_PATTERN = /^(\d{1,3})-(\d{1,3})(?:-(\d{1,3}))?$/

/** Lowercased and stripped of separators, so `vsConf`, `vs_conf` and
 * "VS CONF" are one key. */
function statKey(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase().replace(/[^a-z0-9]/g, '') : ''
}

const OVERALL_KEYS = new Set(['overall', 'total', 'record', 'alltotal', 'overallrecord'])
const CONFERENCE_KEYS = new Set(['vsconf', 'vsconference', 'conference', 'conf', 'confrecord', 'conferencerecord', 'league', 'leaguerecord', 'vsdiv', 'division'])

function parseRecord(value: unknown): { text: string; wins: number; losses: number } | undefined {
  if (typeof value !== 'string') return undefined
  const match = RECORD_PATTERN.exec(value.trim())
  if (!match) return undefined
  return { text: value.trim(), wins: Number(match[1]), losses: Number(match[2]) }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** The trailing id in a core-API `$ref`, e.g. .../teams/59?lang=en → "59". */
function idFromRef(ref: unknown): string | undefined {
  if (typeof ref !== 'string') return undefined
  const match = /\/teams\/(\d+)/.exec(ref)
  return match?.[1]
}

/**
 * Whether this node is a container of standings rather than one row of
 * them.
 *
 * This guard matters more than it looks. ESPN's conference group ids live
 * in the same small-integer range as its team ids — the SEC's group is 8,
 * and 8 is also Arkansas — so a conference node carrying any aggregate
 * `stats` would otherwise be read as that team's record, and filed under
 * whichever team collided with the group number. A container is identified
 * by what hangs off it, and never read as a row.
 */
function looksLikeGroup(node: Record<string, unknown>): boolean {
  return 'children' in node || 'standings' in node || 'entries' in node
}

/**
 * The team id an entry is about.
 *
 * Checked in order of how specific each candidate is: a nested team object's own id
 * first, then a `$ref` to one, then the entry's own `id` — ESPN's standings
 * entries key on the team id in some shapes, and on a synthetic entry id in
 * others, so the entry id is only trusted when it names a team we know.
 */
function teamIdFrom(entry: Record<string, unknown>, known: Set<string>): string | undefined {
  const team = entry.team
  if (isRecord(team)) {
    if (typeof team.id === 'string' && known.has(team.id)) return team.id
    if (typeof team.id === 'number' && known.has(String(team.id))) return String(team.id)
    const fromRef = idFromRef(team.$ref)
    if (fromRef && known.has(fromRef)) return fromRef
  }
  const fromTeamRef = idFromRef(entry.$ref) ?? idFromRef(team)
  if (fromTeamRef && known.has(fromTeamRef)) return fromTeamRef
  for (const key of ['teamId', 'id'] as const) {
    const value = entry[key]
    const asString = typeof value === 'number' ? String(value) : typeof value === 'string' ? value : undefined
    if (asString && known.has(asString)) return asString
  }
  return undefined
}

/**
 * A record out of one entry, from whichever of ESPN's three spellings it
 * happens to use: a stats array of pre-formatted `displayValue` strings, a
 * stats array of numeric wins/losses, or a `team.record.items` list of
 * `summary` strings.
 *
 * All three are supported because the payload could not be inspected from
 * here, and the cost of covering the ones it doesn't use is a few lines of
 * dead code — against a blank screen on a Saturday for guessing wrong.
 */
function recordFrom(entry: Record<string, unknown>): TeamRecord | undefined {
  const out: TeamRecord = {}
  const take = (key: string, value: unknown): void => {
    const parsed = parseRecord(value)
    if (!parsed) return
    if (OVERALL_KEYS.has(key) && out.overall === undefined) {
      out.overall = parsed.text
      out.overallWins = parsed.wins
      out.overallLosses = parsed.losses
    } else if (CONFERENCE_KEYS.has(key) && out.conference === undefined) {
      out.conference = parsed.text
      out.conferenceWins = parsed.wins
      out.conferenceLosses = parsed.losses
    }
  }

  // Shape 1 and 2: a `stats` array.
  const stats = entry.stats
  if (Array.isArray(stats)) {
    let wins: number | undefined
    let losses: number | undefined
    for (const stat of stats) {
      if (!isRecord(stat)) continue
      const keys = [statKey(stat.name), statKey(stat.type), statKey(stat.shortDisplayName), statKey(stat.abbreviation)]
      for (const key of keys) {
        if (!key) continue
        take(key, stat.displayValue)
        take(key, stat.summary)
      }
      // Numeric wins/losses, for a payload that sends the parts and not the
      // formatted string.
      const numeric = typeof stat.value === 'number' ? stat.value : undefined
      if (numeric === undefined) continue
      if (keys.includes('wins')) wins = numeric
      if (keys.includes('losses')) losses = numeric
    }
    if (out.overall === undefined && wins !== undefined && losses !== undefined) {
      out.overall = `${wins}-${losses}`
      out.overallWins = wins
      out.overallLosses = losses
    }
  }

  // Shape 3: `team.record.items[]`, the same list the scoreboard's
  // competitors carry — the one shape here that is known to be real.
  const team = entry.team
  const items = isRecord(team) && isRecord(team.record) ? team.record.items : isRecord(entry.record) ? entry.record.items : undefined
  if (Array.isArray(items)) {
    for (const item of items) {
      if (!isRecord(item)) continue
      for (const key of [statKey(item.type), statKey(item.name), statKey(item.description)]) {
        if (key) take(key, item.summary)
      }
    }
  }

  return out.overall === undefined && out.conference === undefined ? undefined : out
}

/**
 * Every team record anywhere in a standings payload, keyed by team id.
 *
 * A tree walk rather than a path. ESPN nests standings differently from one
 * endpoint and sport to the next — conferences under `children`, divisions
 * under `children.children`, entries under `standings.entries` — and none
 * of that nesting matters here, because the conferences and their
 * membership come from our own table. All this needs is to find the
 * entries, so it looks everywhere instead of being told where.
 *
 * Only ids in `known` are kept, which is what stops a stray numeric `id`
 * elsewhere in the tree being read as a team.
 */
export function recordsFromStandings(payload: unknown, known: Set<string> = fbsTeamIds()): Map<string, TeamRecord> {
  const found = new Map<string, TeamRecord>()
  const seen = new Set<unknown>()

  const walk = (node: unknown, depth: number): void => {
    if (depth > 12 || !isRecord(node)) return
    // Cheap cycle guard: these payloads are JSON, but `$ref` graphs have
    // been self-referential before.
    if (seen.has(node)) return
    seen.add(node)

    const teamId = looksLikeGroup(node) ? undefined : teamIdFrom(node, known)
    if (teamId) {
      const record = recordFrom(node)
      // First one wins: an overall record found higher in the tree is the
      // team's season, while a deeper one may belong to a split.
      if (record && !found.has(teamId)) found.set(teamId, record)
    }

    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const item of value) walk(item, depth + 1)
      } else if (isRecord(value)) {
        walk(value, depth + 1)
      }
    }
  }

  if (Array.isArray(payload)) payload.forEach((item) => walk(item, 0))
  else walk(payload, 0)
  return found
}

function fbsTeamIds(): Set<string> {
  return new Set(ALL_TEAMS.map((t) => t.id))
}

export function standingsUrl(year: number): string {
  // `season` is explicit on purpose: without it ESPN's season-scoped
  // endpoints quietly answer with the most recently *completed* season
  // (seen live on the team-stats endpoint, which returned a full 2025
  // postseason during the 2026 season, with no error).
  return `${STANDINGS_URL}?season=${year}`
}

export async function fetchStandings(year: number): Promise<unknown> {
  const res = await fetch(standingsUrl(year), { cache: 'no-store' })
  if (!res.ok) throw new Error(`ESPN standings HTTP ${res.status}`)
  return res.json() as Promise<unknown>
}

function winPct(wins: number | undefined, losses: number | undefined): number | undefined {
  if (wins === undefined || losses === undefined) return undefined
  const played = wins + losses
  return played === 0 ? undefined : wins / played
}

/**
 * Standings order: conference record first, then overall, then name.
 *
 * Win percentage rather than wins, so 4-1 outranks 4-2 and a team with a
 * game in hand isn't punished for it. A team with no record at all sorts to
 * the bottom rather than to the top, which is where an undefined would land
 * it in a naive numeric compare.
 */
function byStanding(a: StandingsRow, b: StandingsRow): number {
  const rank = (row: StandingsRow): [number, number, number, number] => [
    winPct(row.record?.conferenceWins, row.record?.conferenceLosses) ?? -1,
    row.record?.conferenceWins ?? -1,
    winPct(row.record?.overallWins, row.record?.overallLosses) ?? -1,
    row.record?.overallWins ?? -1,
  ]
  const left = rank(a)
  const right = rank(b)
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return right[i] - left[i]
  }
  return byName(a, b)
}

function byName(a: StandingsRow, b: StandingsRow): number {
  return a.team.name.localeCompare(b.team.name, 'en', { sensitivity: 'base' })
}

/**
 * The whole screen's data: each conference, its teams, and their records.
 *
 * Conferences and membership come from the static table, so a conference
 * with no records yet still lists its teams — in July, after a failed
 * request, or for a league ESPN filed somewhere this parser didn't look.
 */
export function buildStandings(
  records: Map<string, TeamRecord>,
  spoilers: SpoilerSettings,
  options: { conferences?: Conference[]; teams?: Team[] } = {},
): ConferenceStandings[] {
  const conferences = options.conferences ?? CONFERENCES
  const teams = options.teams ?? ALL_TEAMS
  const byId = new Map(teams.map((t) => [t.id, t]))

  return conferences.map((conference) => {
    const rows: StandingsRow[] = []
    for (const teamId of conference.teamIds) {
      const team = byId.get(teamId)
      // A membership id with no team entry would be a bug in the static
      // tables, not something to render a blank row for.
      if (!team) continue
      const hidden = hidesTeamSeason(teamId, spoilers)
      rows.push({ team, record: hidden ? undefined : records.get(teamId), hidden })
    }
    const hidesRecords = rows.some((row) => row.hidden)
    // Nothing to rank on is not the same as a tie for first.
    const unranked = hidesRecords || !rows.some((row) => row.record !== undefined)
    rows.sort(unranked ? byName : byStanding)
    return { conference, rows, unranked, hidesRecords }
  })
}
