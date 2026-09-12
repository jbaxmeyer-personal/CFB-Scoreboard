/**
 * Finds out what CollegeFootballData.com actually serves, from a device that
 * can reach it.
 *
 * The case for it is narrow and specific: ESPN's scoreboard competitors
 * carry no team colour at all, which is why the comparison bars had to go
 * scavenging for one through a team's schedule and its box scores. A single
 * list of teams with their colours would replace all of that.
 *
 * Everything below is a question, not an assumption. CFBD is not reachable
 * from where Slate is built, and three separate bugs this month came from
 * writing a guess about a payload into the code as though it were fact. So
 * this asks, and reports what came back:
 *
 *  - Does a browser request work at all, or does CORS block it? A blocked
 *    request fails as a TypeError with no status, which is reported as such
 *    rather than as a network error.
 *  - Is an API key required, and if so what does the refusal look like?
 *  - Does the teams list carry `color` — and for how many of the teams, not
 *    just the first one.
 *  - Do FCS teams come back too? Slate shows them (Howard, Florida A&M), so
 *    an FBS-only list would only half-solve this.
 *  - Is the season-stats endpoint shaped the way the defence rows would
 *    need, which is the larger question behind the small one.
 *
 * A diagnostic, not a feature: it runs only when the button in Settings is
 * pressed, and nothing in the app reads its output. The key, if one is
 * pasted in, is used for these requests and never stored.
 */
const CFBD = 'https://api.collegefootballdata.com'

/** Bounded so a probe can't hang the screen it was pressed from. */
const PROBE_TIMEOUT_MS = 15_000

interface Attempt {
  label: string
  url: string
  status: number | string
  /** Set when the request never reached a status — CORS, DNS, offline. */
  error?: string
  /** The body's own words when it refused, which is what says whether a key
   * is needed and in what form. */
  message?: string
  summary?: unknown
}

async function getJson(
  url: string,
  apiKey?: string,
): Promise<{ status: number | string; body?: unknown; error?: string; text?: string }> {
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    const text = await res.text()
    if (!res.ok) return { status: res.status, text: text.slice(0, 300) }
    try {
      return { status: res.status, body: JSON.parse(text) }
    } catch {
      return { status: res.status, text: text.slice(0, 300) }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return {
      status: 'no response',
      // A CORS refusal and a dead network look identical from script; say so
      // rather than pick one.
      error: `${message} — a browser reports a CORS refusal exactly like this, with no status`,
    }
  }
}

/** What a list of teams would actually give us, counted rather than sampled:
 * one team with a colour proves nothing about the other hundred. */
function summarizeTeams(body: unknown): Record<string, unknown> {
  const teams = Array.isArray(body) ? (body as Record<string, unknown>[]) : []
  if (teams.length === 0) return { teams: 0, note: 'not an array — see rawShape' }

  const has = (key: string) => teams.filter((t) => typeof t[key] === 'string' && (t[key] as string).length > 0).length
  const divisions = new Set<string>()
  for (const t of teams) {
    const division = t.classification ?? t.division
    if (typeof division === 'string') divisions.add(division)
  }
  const first = teams[0]
  return {
    teams: teams.length,
    fields: Object.keys(first),
    withColor: has('color'),
    withAltColor: has('alt_color'),
    withAbbreviation: has('abbreviation'),
    divisions: [...divisions].slice(0, 6),
    firstTeam: {
      id: first.id,
      school: first.school,
      abbreviation: first.abbreviation,
      color: first.color,
      alt_color: first.alt_color,
      conference: first.conference,
      classification: first.classification ?? first.division,
      logos: Array.isArray(first.logos) ? (first.logos as unknown[]).slice(0, 2) : first.logos,
    },
    /** The two Slate needs to match a CFBD team to an ESPN one. */
    notreDame: teams
      .filter((t) => typeof t.school === 'string' && (t.school as string).includes('Notre Dame'))
      .map((t) => ({ id: t.id, school: t.school, abbreviation: t.abbreviation, color: t.color, alt_color: t.alt_color })),
  }
}

/** Whether the season-stats response is shaped the way the defence rows
 * would need — a flat list of named stat lines, offence and opponent alike. */
function summarizeSeasonStats(body: unknown): Record<string, unknown> {
  const rows = Array.isArray(body) ? (body as Record<string, unknown>[]) : []
  if (rows.length === 0) return { rows: 0, note: 'not an array, or empty — see rawShape' }
  return {
    rows: rows.length,
    fields: Object.keys(rows[0]),
    statNames: [...new Set(rows.map((r) => String(r.statName ?? r.stat_name ?? '?')))].slice(0, 40),
    first: rows[0],
  }
}

function shape(value: unknown): unknown {
  if (Array.isArray(value)) return { '[array length]': value.length, '[0]': value[0] }
  if (value && typeof value === 'object') return Object.keys(value as object)
  return value
}

export async function probeCfbd(year: number, apiKey?: string): Promise<string> {
  const key = apiKey?.trim() ? apiKey.trim() : undefined
  const attempts: Attempt[] = []

  // Requests run one after another rather than together: this is a
  // hand-pressed diagnostic on a phone.
  const run = async (
    label: string,
    url: string,
    withKey: boolean,
    summarize?: (body: unknown) => unknown,
  ) => {
    const res = await getJson(url, withKey ? key : undefined)
    attempts.push({
      label,
      url,
      status: res.status,
      error: res.error,
      message: res.text,
      summary: res.body !== undefined ? (summarize ? summarize(res.body) : shape(res.body)) : undefined,
    })
    return res
  }

  // 1. The whole question, asked the simplest way: no key at all.
  const anonymous = await run('A. FBS teams, no API key', `${CFBD}/teams/fbs?year=${year}`, false, summarizeTeams)

  // 2. The same request with a key, when one was pasted in — so the two
  //    answers sit side by side rather than needing a second round.
  if (key) {
    await run('B. FBS teams, with the API key', `${CFBD}/teams/fbs?year=${year}`, true, summarizeTeams)
  } else {
    attempts.push({
      label: 'B. FBS teams, with the API key',
      url: `${CFBD}/teams/fbs?year=${year}`,
      status: 'skipped',
      error: 'No key was entered. If A was refused, get a free key and run this again with it.',
    })
  }

  // 3. Every division, because Slate shows FCS teams too.
  await run('C. All teams (FCS included)', `${CFBD}/teams?year=${year}`, Boolean(key), summarizeTeams)

  // 4. The larger question: could this replace the defence rows, which
  //    currently cost one request per game a team has played.
  await run(
    'D. Season stats for one team',
    `${CFBD}/stats/season?year=${year}&team=${encodeURIComponent('Notre Dame')}`,
    Boolean(key),
    summarizeSeasonStats,
  )

  return JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      year,
      keyEntered: Boolean(key),
      // The one line that decides the whole approach.
      verdict:
        anonymous.status === 200
          ? 'Reachable from the browser with no key'
          : anonymous.status === 'no response'
            ? 'No response at all — CORS or network; see A.error'
            : `Refused with ${anonymous.status} — see A.message for whether that means a key`,
      attempts,
    },
    null,
    2,
  )
}
