/**
 * Finds out what ESPN actually serves for season player stats.
 *
 * There is no verified source for them. ESPN is unreachable from where Slate
 * is built, so every previous guess at a field's meaning had to be corrected
 * from a screenshot afterwards — the field-position frame twice, the play
 * clock, a down that wasn't a down. Rather than repeat that at the scale of
 * a whole new screen, this fetches the candidate endpoints on a device that
 * can reach ESPN and reports, verbatim, what came back.
 *
 * Nothing here is interpreted and nothing is normalized. It reports the
 * status, the top-level keys, and a small excerpt, which is enough to tell
 * which endpoint carries per-player season numbers and what they are called.
 *
 * This is a diagnostic, not a feature: it runs only when the button in
 * Settings is pressed, and nothing in the app reads its output.
 */
const SITE_TEAMS = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams'
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

/** Cuts a response down to something readable: the first entry of any array,
 * and nothing deeper than a few levels. A roster response is hundreds of
 * kilobytes and the shape is what matters, not the hundredth player. */
function trim(value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) {
    if (value.length === 0) return []
    return { '[length]': value.length, '[0]': depth >= 3 ? '…' : trim(value[0], depth + 1) }
  }
  if (value && typeof value === 'object') {
    if (depth >= 3) return '…'
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = trim(v, depth + 1)
    return out
  }
  return value
}

async function probe(label: string, url: string): Promise<ProbeResult> {
  const { status, body, error } = await getJson(url)
  return { label, url, status, topLevelKeys: keysOf(body), sample: body === undefined ? undefined : trim(body), error }
}

/** The first `$ref` anywhere in a response, so the hypermedia core API can be
 * followed one hop at a time instead of having its URLs composed by hand —
 * composing them is how the core fallback's paths went wrong before. */
function firstRef(value: unknown, key = '$ref'): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  if (typeof record[key] === 'string') return (record[key] as string).replace(/^http:\/\//, 'https://')
  for (const nested of Object.values(record)) {
    const found = firstRef(nested, key)
    if (found) return found
  }
  return undefined
}

/**
 * Probes every candidate source for one team's season player stats.
 *
 * Requests run one after another rather than together: this is a hand-pressed
 * diagnostic on a phone, and a burst of requests to an endpoint nobody has
 * confirmed the shape of is the wrong first move.
 */
export async function probeTeamPlayerSources(teamId: string, year: number): Promise<string> {
  const results: ProbeResult[] = []

  results.push(await probe('site: team roster', `${SITE_TEAMS}/${teamId}/roster?season=${year}`))
  results.push(await probe('site: team statistics', `${SITE_TEAMS}/${teamId}/statistics?season=${year}&seasontype=2`))

  const athletes = await probe('core: season team athletes', `${CORE_SEASON}/${year}/types/2/teams/${teamId}/athletes?limit=3`)
  results.push(athletes)

  // Follow one athlete, then that athlete's statistics — the two hops that
  // decide whether per-player season stats are reachable at all, and at what
  // cost (one request per athlete would be a different feature from one
  // request per team).
  const athleteRef = firstRef(athletes.sample)
  if (athleteRef) {
    const athlete = await probe('core: one athlete (followed $ref)', athleteRef)
    results.push(athlete)
    const statsRef = firstRef((athlete.sample as Record<string, unknown>)?.statistics)
    if (statsRef) results.push(await probe("core: that athlete's statistics (followed $ref)", statsRef))
    else results.push({ label: "core: that athlete's statistics", url: '(no statistics $ref on the athlete)', status: 'skipped' })
  }

  return JSON.stringify({ teamId, year, capturedAt: new Date().toISOString(), results }, null, 2)
}
