import type { PlayerStatCategory } from '../types/game'

/**
 * Season stats for every player on one team.
 *
 * ESPN has no per-team source for these. Three rounds of probing a real
 * device settled it: the roster carries bios and no statistics; the team
 * statistics response carries team totals only; the core API needs a request
 * per athlete (105 for Indiana) and the athlete it returns has no statistics
 * link, so it would be more than one each; and `athletes/{id}/stats` is a
 * 404.
 *
 * What exists is `common/v3/statistics/byathlete`, which has exactly the
 * right shape — a row per athlete, each carrying its categories of totals,
 * and a top-level categories list carrying the column labels. It just cannot
 * be narrowed to a team. Five ways of asking were tried; `team=`, `teamId=`,
 * a team-scoped path (404), and two parameter sets all came back league-wide,
 * the first athlete playing for Miami when Indiana was asked for.
 *
 * So the league table is fetched and filtered here, by the `teamId` every
 * athlete row carries. That is a real cost — thousands of athletes across
 * several pages — which is why nothing fetches it until someone asks for it,
 * and why the result is cached under a key with no team in it: the whole
 * league is one download, shared by every team page for the rest of the
 * session.
 */
const BYATHLETE = 'https://site.web.api.espn.com/apis/common/v3/sports/football/college-football/statistics/byathlete'

/** Big enough that the league fits in a few requests. */
const PAGE_SIZE = 1000

/** A hard stop. Without one, a season with more athletes than expected — or
 * a pagination field that means something other than assumed — turns one
 * screen into an unbounded download on someone's phone. */
const MAX_PAGES = 6

/** One athlete, stripped to what a stat table needs.
 *
 * The league table is kept in memory so every team page can filter the same
 * download, so what is kept matters: a raw row carries fourteen team logos,
 * twelve links and a headshot, and the response repeats a sixty-entry
 * glossary on every page. None of that is a stat. */
export interface LeagueAthlete {
  teamId: string
  name: string
  position?: string
  categories: { name: string; totals: string[] }[]
}

/** The league table, compacted — shared by every team page. */
export interface LeaguePlayerStats {
  /** Column headers per category name, from the response's own list. */
  headers: Map<string, { label: string; columns: string[] }>
  athletes: LeagueAthlete[]
  /** How many athletes the league table held and how many pages were read,
   * so the cost of this is visible rather than folklore. */
  leagueAthletes: number
  pagesFetched: number
  /** True when the cap above stopped the walk before the end of the league,
   * which means a player could be missing rather than statless. */
  truncated: boolean
}

interface RawAthleteRow {
  athlete?: { id?: string; displayName?: string; teamId?: string; position?: { abbreviation?: string } }
  categories?: { name?: string; totals?: string[] }[]
}

interface RawByAthlete {
  pagination?: { count?: number; pages?: number }
  athletes?: RawAthleteRow[]
  categories?: { name?: string; displayName?: string; labels?: string[] }[]
}

async function fetchPage(year: number, page: number): Promise<RawByAthlete> {
  // `isqualified=false` on purpose: qualified filters to players meeting
  // per-category minimums, which early in a season is 37 athletes in all of
  // college football. A team's actual contributors are the point here.
  const url = `${BYATHLETE}?season=${year}&seasontype=2&isqualified=false&page=${page}&limit=${PAGE_SIZE}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`ESPN season player stats request failed: ${res.status}`)
  return (await res.json()) as RawByAthlete
}

/** ESPN's own `displayName` for the category, which this response carries for
 * every one of them — unlike the game box score, where the key had to be
 * humanised. The fallback below only splits camelCase and capitalises, so an
 * all-lowercase key like "defensiveinterceptions" stays one word; a word list
 * to break it up would be a guess, and this path is a guard against a missing
 * field rather than something anyone is expected to see. */
function categoryLabel(name: string, displayName: string | undefined): string {
  if (displayName) return displayName
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Turns the league table into one team's categories.
 *
 * Column labels come from the response's own category list, matched to each
 * athlete's category by name; the values are that athlete's `totals`, which
 * are already display strings. Rows are padded and trimmed to the header
 * count for the same reason the game box score does it — a row that
 * disagrees with its headers reads as a different stat.
 *
 * A row is kept only where it has at least one value that isn't zero or
 * blank: the league table lists every category for every player, so a
 * quarterback otherwise appears under punting with a row of zeroes.
 */
export function selectTeamPlayers(league: LeaguePlayerStats, teamId: string): PlayerStatCategory[] {
  const rowsByCategory = new Map<string, { playerName: string; stats: string[] }[]>()
  for (const athlete of league.athletes) {
    if (athlete.teamId !== teamId) continue
    for (const category of athlete.categories) {
      const header = league.headers.get(category.name)
      if (!header || header.columns.length === 0) continue
      const stats = header.columns.map((_, i) => category.totals[i] ?? '—')
      const hasAnything = stats.some((v) => v !== '—' && v !== '0' && v !== '0.0' && v !== '-' && v !== '')
      if (!hasAnything) continue
      const list = rowsByCategory.get(category.name) ?? []
      list.push({ playerName: athlete.position ? `${athlete.name} · ${athlete.position}` : athlete.name, stats })
      rowsByCategory.set(category.name, list)
    }
  }

  const categories: PlayerStatCategory[] = []
  for (const [name, header] of league.headers) {
    const rows = rowsByCategory.get(name)
    if (!rows || rows.length === 0) continue
    categories.push({ name, label: header.label, columns: header.columns, rows })
  }
  return categories
}

/** Walks the league table, stopping at the end or at the page cap, and keeps
 * only the fields a stat table reads. */
export async function fetchLeaguePlayerStats(year: number): Promise<LeaguePlayerStats> {
  const headers = new Map<string, { label: string; columns: string[] }>()
  const athletes: LeagueAthlete[] = []
  let totalPages = 1
  let leagueAthletes = 0
  let pagesFetched = 0

  for (let page = 1; page <= Math.min(totalPages, MAX_PAGES); page++) {
    const body = await fetchPage(year, page)
    pagesFetched++
    totalPages = body.pagination?.pages ?? 1
    leagueAthletes = body.pagination?.count ?? leagueAthletes

    for (const category of body.categories ?? []) {
      if (!category.name || headers.has(category.name)) continue
      headers.set(category.name, { label: categoryLabel(category.name, category.displayName), columns: category.labels ?? [] })
    }
    for (const row of body.athletes ?? []) {
      const teamId = row.athlete?.teamId
      const name = row.athlete?.displayName
      if (!teamId || !name) continue
      athletes.push({
        teamId,
        name,
        position: row.athlete?.position?.abbreviation,
        categories: (row.categories ?? [])
          .filter((c): c is { name: string; totals?: string[] } => Boolean(c.name))
          .map((c) => ({ name: c.name, totals: c.totals ?? [] })),
      })
    }
  }

  return { headers, athletes, leagueAthletes, pagesFetched, truncated: totalPages > MAX_PAGES }
}
