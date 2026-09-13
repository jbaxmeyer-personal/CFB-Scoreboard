/**
 * The season's schedule of dates, read out of the scoreboard payload.
 *
 * ESPN puts a calendar on the scoreboard response — the one the app already
 * fetches for each day — so this costs nothing extra. What it looks like
 * isn't verifiable from where Slate is built, and three shapes are all
 * plausible: a flat list of dates, a list of weeks each carrying a start and
 * an end, or weeks carrying per-day entries. So this reads all of them and
 * takes what it finds, rather than assuming one and breaking on another.
 *
 * Two different things come out of it, and they are used differently:
 *
 *  - `dates`: the individual days that have games. Only some shapes carry
 *    these. When they're there, Scoreboard can offer the whole season in its
 *    day strip instead of a ten-day window.
 *  - `start`/`end`: the season's extent, which every shape gives. Enough to
 *    stop the date picker wandering into February even when the individual
 *    days aren't known.
 *
 * Finding nothing is a normal outcome, not a failure: the caller falls back
 * to the fetched window, which is what the app did before this existed.
 */

/** How deep to walk before giving up. Guards against a cyclic or
 * pathologically nested payload; three levels covers every shape above. */
const MAX_DEPTH = 4

export interface SeasonCalendar {
  /** yyyy-MM-dd, ascending, de-duplicated. Empty when the payload only
   * described weeks. */
  dates: string[]
  /** yyyy-MM-dd bounds of the season, when they could be determined. */
  start?: string
  end?: string
}

/** The UTC date of an ISO instant.
 *
 * UTC rather than a local or Eastern reading because these are day markers,
 * not kickoffs, and they arrive at whatever hour ESPN uses for a day
 * boundary. Read in UTC, midnight, 04:00 and 07:00 on the same date all
 * yield that date; read in a western zone, some of them slide backwards. */
function utcDateKey(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return undefined
  return parsed.toISOString().slice(0, 10)
}

function collect(node: unknown, depth: number, dates: Set<string>, bounds: string[]): void {
  if (depth > MAX_DEPTH || node === null || node === undefined) return

  if (typeof node === 'string') {
    // A bare date in a flat calendar is itself a day with games.
    const key = utcDateKey(node)
    if (key) {
      dates.add(key)
      bounds.push(key)
    }
    return
  }

  if (Array.isArray(node)) {
    for (const item of node) collect(item, depth + 1, dates, bounds)
    return
  }

  if (typeof node !== 'object') return
  const record = node as Record<string, unknown>

  const start = utcDateKey(record.startDate ?? record.value)
  const end = utcDateKey(record.endDate)
  if (start) bounds.push(start)
  if (end) bounds.push(end)

  const entries = record.entries
  if (Array.isArray(entries) && entries.length > 0) {
    // Entries are the individual days within a week; the week's own start is
    // one of them, so it isn't a day in its own right.
    for (const entry of entries) collect(entry, depth + 1, dates, bounds)
    return
  }

  // A leaf with a start and no entries: a single day, unless it also carries
  // an end on a different date, which makes it a span rather than a day.
  if (start && (!end || end === start)) dates.add(start)
}

export function parseSeasonCalendar(response: unknown): SeasonCalendar {
  const leagues = (response as { leagues?: unknown[] } | undefined)?.leagues
  const dates = new Set<string>()
  const bounds: string[] = []

  for (const league of Array.isArray(leagues) ? leagues : []) {
    collect((league as { calendar?: unknown } | undefined)?.calendar, 0, dates, bounds)
  }

  bounds.sort()
  return {
    dates: [...dates].sort(),
    start: bounds[0],
    end: bounds[bounds.length - 1],
  }
}

/** Merges what several days' payloads said, since each response carries the
 * same season calendar and any one of them may be the one that arrived. */
export function mergeSeasonCalendars(calendars: SeasonCalendar[]): SeasonCalendar {
  const dates = new Set<string>()
  const bounds: string[] = []
  for (const calendar of calendars) {
    for (const date of calendar.dates) dates.add(date)
    if (calendar.start) bounds.push(calendar.start)
    if (calendar.end) bounds.push(calendar.end)
  }
  bounds.sort()
  return { dates: [...dates].sort(), start: bounds[0], end: bounds[bounds.length - 1] }
}
