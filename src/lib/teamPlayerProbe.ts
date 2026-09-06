/**
 * Finds out what ESPN actually serves for season player stats.
 *
 * There is no verified source for them. ESPN is unreachable from where Slate
 * is built, so every previous guess at a field's meaning had to be corrected
 * from a screenshot afterwards — the field-position frame twice, the play
 * clock, a down that wasn't a down. Rather than repeat that at the scale of
 * a whole new screen, this fetches candidate endpoints on a device that can
 * reach ESPN and reports, verbatim, what came back.
 *
 * Nothing here is interpreted and nothing is normalized. It reports the
 * status, the top-level keys, and a trimmed excerpt — enough to tell which
 * endpoint carries per-player season numbers, what they are called, and
 * whether reaching them costs one request per team or one per athlete.
 *
 * Round one settled two things and is why this round looks the way it does:
 *
 *  - `seasons/{y}/types/2/teams/{id}/athletes` returned 404. That URL was
 *    composed by hand rather than followed from a `$ref`, which is exactly
 *    the mistake this probe exists to stop making. The variant without the
 *    season type is tried below, and so is the one path that needs no
 *    composing at all: whatever `$ref` the roster itself hands over.
 *  - The roster and team-statistics responses both came back 200, but the
 *    excerpt stopped one level above the answer — at `athletes[0].items[0]`
 *    and `results.stats.categories[0]`. Those two objects are the question,
 *    so the excerpt now goes deep enough to show them.
 *
 * This is a diagnostic, not a feature: it runs only when the button in
 * Settings is pressed, and nothing in the app reads its output.
 */
const SITE_TEAMS = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams'
const COMMON_V3 = 'https://site.web.api.espn.com/apis/common/v3/sports/football/college-football'
const CORE_SEASON = 'https://sports.core.api.espn.com/v2/sports/football/leagues/college-football/seasons'

/** Bounded so a probe can't hang the screen it was pressed from. */
const PROBE_TIMEOUT_MS = 12_000

export interface ProbeResult {
  label: string
  url: string
  status: number | string
  topLevelKeys?: string
  /** A trimmed excerpt, small enough to paste back in a message. */
  sample?: unknown
  error?: string
}

async function getJson(url: string): Promise<{ status: number | string; body?: unknown; error?: string }> {
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
    if (!res.ok) return { status: res.status }
    return { status: res.status, body: await res.json() }
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : String(e) }
  }
}

function keysOf(body: unknown): string | undefined {
  return body && typeof body === 'object' ? Object.keys(body as Record<string, unknown>).join(', ') : undefined
}

/**
 * Cuts a response down to something readable: the first entry of any array
 * plus its length, and nothing past `maxDepth`.
 *
 * A roster is hundreds of kilobytes and the shape is what matters, not the
 * hundredth player — but the shape lives several levels down
 * (`athletes[0].items[0]`), so the depth has to clear that. Long strings are
 * cut too: a response full of image URLs and bios buries the stat fields
 * this is looking for.
 */
function trim(value: unknown, depth = 0, maxDepth = 7): unknown {
  if (typeof value === 'string') return value.length > 120 ? `${value.slice(0, 120)}…` : value
  if (Array.isArray(value)) {
    if (value.length === 0) return []
    return { '[length]': value.length, '[0]': depth >= maxDepth ? '…' : trim(value[0], depth + 1, maxDepth) }
  }
  if (value && typeof value === 'object') {
    if (depth >= maxDepth) return '…'
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = trim(v, depth + 1, maxDepth)
    return out
  }
  return value
}

async function probe(label: string, url: string, maxDepth?: number): Promise<ProbeResult> {
  const { status, body, error } = await getJson(url)
  return {
    label,
    url,
    status,
    topLevelKeys: keysOf(body),
    sample: body === undefined ? undefined : trim(body, 0, maxDepth),
    error,
  }
}

/** The first value at `key` anywhere in a response. Used to follow the core
 * API's hypermedia one hop at a time instead of composing its URLs, and to
 * pick an athlete id out of the roster without assuming the roster's shape. */
function findFirst(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  const own = record[key]
  if (typeof own === 'string' && own) return own.replace(/^http:\/\//, 'https://')
  for (const nested of Object.values(record)) {
    const found = findFirst(nested, key)
    if (found) return found
  }
  return undefined
}

/**
 * Probes every candidate source for one team's season player stats.
 *
 * Requests run one after another rather than together: this is a
 * hand-pressed diagnostic on a phone, and a burst of requests at endpoints
 * nobody has confirmed the shape of is the wrong first move.
 */
export async function probeTeamPlayerSources(teamId: string, year: number): Promise<string> {
  const results: ProbeResult[] = []

  // 1. The roster. Deep enough this time to show one athlete in full, which
  //    answers whether a roster entry carries stats or only a bio — and
  //    hands over an athlete id and possibly a $ref to follow.
  const roster = await probe('site: team roster (deep)', `${SITE_TEAMS}/${teamId}/roster?season=${year}`, 8)
  results.push(roster)

  // 2. The team statistics already used for team totals, deep enough to show
  //    a whole category. If per-player numbers are in here, this is free —
  //    the app fetches this response for the team page anyway.
  results.push(await probe('site: team statistics (deep)', `${SITE_TEAMS}/${teamId}/statistics?season=${year}&seasontype=2`, 8))

  // 3. The one-request-per-team shape, if it exists. This is what ESPN's own
  //    team stats page appears to run on, and it is the difference between a
  //    feature and a hundred requests to open a team page.
  results.push(
    await probe(
      'common v3: statistics byathlete for this team',
      `${COMMON_V3}/statistics/byathlete?season=${year}&seasontype=2&team=${teamId}&limit=25`,
      8,
    ),
  )

  // 4. The core athletes list without the season type in the path — the
  //    variant that 404'd had it.
  const coreAthletes = await probe('core: season team athletes (no season type)', `${CORE_SEASON}/${year}/teams/${teamId}/athletes?limit=3`, 6)
  results.push(coreAthletes)

  // 5. Per-athlete, two ways: the id the roster gave, and a $ref followed
  //    rather than composed. Both are recorded so the cheaper one wins.
  const athleteId = findFirst(roster.sample, 'id')
  if (athleteId) {
    results.push(
      await probe(
        `common v3: one athlete's stats (roster id ${athleteId})`,
        `${COMMON_V3}/athletes/${athleteId}/stats?season=${year}&seasontype=2`,
        8,
      ),
    )
  }

  const athleteRef = findFirst(coreAthletes.sample, '$ref') ?? findFirst(roster.sample, '$ref')
  if (athleteRef) {
    const athlete = await probe('core: one athlete (followed $ref)', athleteRef, 5)
    results.push(athlete)
    const statsRef = findFirst((athlete.sample as Record<string, unknown> | undefined)?.statistics, '$ref')
    if (statsRef) results.push(await probe("core: that athlete's statistics (followed $ref)", statsRef, 8))
    else results.push({ label: "core: that athlete's statistics", url: '(no statistics $ref on the athlete)', status: 'skipped' })
  }

  return JSON.stringify({ teamId, year, capturedAt: new Date().toISOString(), results }, null, 2)
}
