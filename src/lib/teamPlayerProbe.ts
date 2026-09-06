/**
 * Finds out what ESPN actually serves for season player stats.
 *
 * There is no verified source for them. ESPN is unreachable from where Slate
 * is built, so every previous guess at a field's meaning had to be corrected
 * from a screenshot afterwards — the field-position frame twice, the play
 * clock, a down that wasn't a down. Rather than repeat that at the scale of
 * a whole new screen, this asks candidate endpoints from a device that can
 * reach ESPN and reports what came back.
 *
 * Two rounds have already run, and they narrowed it to one question:
 *
 *  - The roster carries bios only. An athlete entry has height, jersey,
 *    birthplace, and no statistics of any kind.
 *  - The team statistics response the team page already fetches carries team
 *    totals only — its first category is passing, and those 24 stats are the
 *    team's, not any player's. So this is not free.
 *  - The core API needs one request per athlete (105 of them for Indiana),
 *    and the athlete it returns has no `statistics` $ref, so it would be
 *    more than one each. Not viable; not probed again.
 *  - `common/v3/athletes/{id}/stats` returned 404.
 *  - `common/v3/statistics/byathlete` returned 200 with exactly the right
 *    shape: a row per athlete, each carrying categories of totals, values
 *    and ranks, plus a top-level categories list carrying the column labels.
 *    But `team=84` was ignored — the first athlete back played for Miami.
 *
 * So: which parameter actually filters that endpoint to one team. Each
 * variant below is judged on whether every athlete it returns plays for the
 * team asked for, rather than on its status code — a 200 full of the wrong
 * players is the failure this is looking for.
 *
 * This is a diagnostic, not a feature: it runs only when the button in
 * Settings is pressed, and nothing in the app reads its output.
 */
const COMMON_V3 = 'https://site.web.api.espn.com/apis/common/v3/sports/football/college-football'

/** Bounded so a probe can't hang the screen it was pressed from. */
const PROBE_TIMEOUT_MS = 12_000

export interface ProbeResult {
  label: string
  url: string
  status: number | string
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

/** Cuts a value down to something readable: the first entry of any array
 * plus its length, nothing past `maxDepth`, and no long strings. */
function trim(value: unknown, depth = 0, maxDepth = 6): unknown {
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

/** The distinct team ids among the athletes a byathlete response returned,
 * and who the first one is — the whole question for this endpoint. */
function summarizeByAthlete(body: unknown, wantedTeamId: string): Record<string, unknown> {
  const record = (body ?? {}) as Record<string, unknown>
  const athletes = Array.isArray(record.athletes) ? (record.athletes as Record<string, unknown>[]) : []
  const teamIds = new Set<string>()
  let firstAthlete: string | undefined
  for (const row of athletes) {
    const athlete = (row.athlete ?? {}) as Record<string, unknown>
    const teamId = String(athlete.teamId ?? '?')
    teamIds.add(teamId)
    if (!firstAthlete) firstAthlete = `${String(athlete.displayName ?? '?')} (${String(athlete.teamShortName ?? teamId)})`
  }
  const pagination = (record.pagination ?? {}) as Record<string, unknown>
  const categories = Array.isArray(record.categories) ? (record.categories as Record<string, unknown>[]) : []
  return {
    verdict: teamIds.size > 0 && teamIds.size === 1 && teamIds.has(wantedTeamId) ? `FILTERED TO ${wantedTeamId}` : 'NOT filtered to this team',
    athletesReturned: athletes.length,
    totalCount: pagination.count,
    pages: pagination.pages,
    distinctTeamIds: [...teamIds].slice(0, 6).join(', '),
    firstAthlete,
    categories: categories.map((c) => `${String(c.name)}[${(c.labels as unknown[] | undefined)?.join('/') ?? ''}]`).slice(0, 12),
  }
}

/**
 * Probes the ways of filtering `byathlete` to one team.
 *
 * Requests run one after another rather than together: this is a
 * hand-pressed diagnostic on a phone.
 */
export async function probeTeamPlayerSources(teamId: string, year: number): Promise<string> {
  const season = `season=${year}&seasontype=2`
  const variants: { label: string; url: string }[] = [
    { label: 'A. team= (round two baseline)', url: `${COMMON_V3}/statistics/byathlete?${season}&team=${teamId}&limit=25` },
    { label: 'B. teamId=', url: `${COMMON_V3}/statistics/byathlete?${season}&teamId=${teamId}&limit=25` },
    { label: 'C. team-scoped path', url: `${COMMON_V3}/teams/${teamId}/statistics/byathlete?${season}&limit=25` },
    { label: 'D. team= with isqualified=false', url: `${COMMON_V3}/statistics/byathlete?${season}&team=${teamId}&isqualified=false&limit=25` },
    {
      label: 'E. team= with the full parameter set',
      url: `${COMMON_V3}/statistics/byathlete?region=us&lang=en&contentorigin=espn&${season}&team=${teamId}&isqualified=false&page=1&limit=25&sort=general.gamesPlayed%3Adesc`,
    },
  ]

  const results: ProbeResult[] = []
  for (const variant of variants) {
    const { status, body, error } = await getJson(variant.url)
    results.push({
      label: variant.label,
      url: variant.url,
      status,
      error,
      sample: body === undefined ? undefined : summarizeByAthlete(body, teamId),
    })
  }

  // One full row from whichever variant filtered correctly, so the column
  // labels and the values under them can be read before anything is built.
  const winner = results.find((r) => String((r.sample as Record<string, unknown> | undefined)?.verdict ?? '').startsWith('FILTERED'))
  if (winner) {
    const { body } = await getJson(winner.url)
    const athletes = ((body ?? {}) as Record<string, unknown>).athletes
    results.push({
      label: `full first row from ${winner.label}`,
      url: winner.url,
      status: 'sample',
      sample: trim(Array.isArray(athletes) ? athletes[0] : athletes, 0, 6),
    })
  }

  return JSON.stringify({ teamId, year, capturedAt: new Date().toISOString(), results }, null, 2)
}
