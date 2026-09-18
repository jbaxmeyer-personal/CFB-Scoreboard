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

/** One of ESPN's weeks: a label and the span it covers. This is the part
 * of the calendar that is actually populated — the individual days never
 * are — so it is what week-based navigation is built from. */
export interface SeasonWeek {
  /** "Week 3", "Bowls", "CFP". */
  label: string
  /** Which season type it belongs to: "Regular Season", "Postseason". */
  section: string
  /** yyyy-MM-dd, inclusive. */
  start: string
  /** yyyy-MM-dd, inclusive. ESPN ends a week at 06:59Z on the following
   * day, which is the small hours Eastern; the last day it really covers
   * is the day before. */
  end: string
}

export interface SeasonCalendar {
  /** yyyy-MM-dd, ascending, de-duplicated. Empty when the payload only
   * described weeks — which, for college football, is always. */
  dates: string[]
  /** The season's weeks in order, which is the one thing its calendar
   * reliably carries. */
  weeks: SeasonWeek[]
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

/** A week's last day. ESPN closes a week at 06:59Z on the morning after
 * it ends — the small hours Eastern — so the date on that timestamp is one
 * day past what the week actually covers. */
function inclusiveEnd(end: string): string {
  const day = new Date(`${end}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() - 1)
  return day.toISOString().slice(0, 10)
}

const DAY_MS = 24 * 60 * 60_000

function addDays(dateKey: string, days: number): string {
  const day = new Date(`${dateKey}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() + days)
  return day.toISOString().slice(0, 10)
}

/** 0 is Sunday, 6 is Saturday. */
function weekday(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay()
}

/**
 * Splits Week 0 out of the season's opening entry.
 *
 * ESPN does not have a Week 0. It folds the opening Saturday into Week 1,
 * which for 2026 makes "Week 1" run 22 August to 7 September — seventeen
 * days holding three Saturdays. College football does have one, and the
 * games on it are Week 0's, so listing them under Week 1 is wrong.
 *
 * The split is derived rather than dated: the *last* Saturday in the span
 * is the one Week 1 is named for, so Week 1 starts on the Sunday before it
 * and everything earlier becomes Week 0. An opening entry holding a single
 * Saturday is a normal week and is left alone, which is what happens in a
 * season with no Week 0.
 */
function splitWeekZero(weeks: SeasonWeek[]): SeasonWeek[] {
  const first = weeks[0]
  if (!first || first.section !== 'Regular Season') return weeks
  if ((Date.parse(`${first.end}T00:00:00Z`) - Date.parse(`${first.start}T00:00:00Z`)) / DAY_MS < 8) return weeks

  // The last Saturday the entry covers: the week ESPN actually labelled.
  let lastSaturday = first.end
  while (lastSaturday > first.start && weekday(lastSaturday) !== 6) lastSaturday = addDays(lastSaturday, -1)
  if (weekday(lastSaturday) !== 6) return weeks

  const weekOneStart = addDays(lastSaturday, -6)
  if (weekOneStart <= first.start) return weeks

  return [
    { label: 'Week 0', section: first.section, start: first.start, end: addDays(weekOneStart, -1) },
    { ...first, start: weekOneStart },
    ...weeks.slice(1),
  ]
}

/** The weeks under each season type, in order. Only entries with both a
 * start and an end are weeks; anything else is not something to navigate. */
function collectWeeks(calendar: unknown): SeasonWeek[] {
  const weeks: SeasonWeek[] = []
  for (const section of Array.isArray(calendar) ? calendar : []) {
    const record = (section ?? {}) as Record<string, unknown>
    const sectionLabel = typeof record.label === 'string' ? record.label : ''
    for (const entry of Array.isArray(record.entries) ? record.entries : []) {
      const week = (entry ?? {}) as Record<string, unknown>
      const start = utcDateKey(week.startDate)
      const rawEnd = utcDateKey(week.endDate)
      if (!start || !rawEnd || typeof week.label !== 'string') continue
      const end = inclusiveEnd(rawEnd)
      weeks.push({ label: week.label, section: sectionLabel, start, end: end >= start ? end : start })
    }
  }
  return splitWeekZero(weeks.sort((a, b) => a.start.localeCompare(b.start)))
}

export function parseSeasonCalendar(response: unknown): SeasonCalendar {
  const leagues = (response as { leagues?: unknown[] } | undefined)?.leagues
  const dates = new Set<string>()
  const bounds: string[] = []
  const weeks: SeasonWeek[] = []

  for (const league of Array.isArray(leagues) ? leagues : []) {
    const calendar = (league as { calendar?: unknown } | undefined)?.calendar
    collect(calendar, 0, dates, bounds)
    weeks.push(...collectWeeks(calendar))
  }

  bounds.sort()
  return {
    dates: [...dates].sort(),
    weeks,
    start: bounds[0],
    end: bounds[bounds.length - 1],
  }
}

/** Merges what several days' payloads said, since each response carries the
 * same season calendar and any one of them may be the one that arrived. */
export function mergeSeasonCalendars(calendars: SeasonCalendar[]): SeasonCalendar {
  const dates = new Set<string>()
  const bounds: string[] = []
  const weeks = new Map<string, SeasonWeek>()
  for (const calendar of calendars) {
    for (const date of calendar.dates) dates.add(date)
    // Keyed by start, since every response carries the same weeks.
    for (const week of calendar.weeks) weeks.set(week.start, week)
    if (calendar.start) bounds.push(calendar.start)
    if (calendar.end) bounds.push(calendar.end)
  }
  bounds.sort()
  return {
    dates: [...dates].sort(),
    weeks: [...weeks.values()].sort((a, b) => a.start.localeCompare(b.start)),
    start: bounds[0],
    end: bounds[bounds.length - 1],
  }
}

/** Every day in a week, as yyyy-MM-dd keys. A week is a known span, so its
 * days are simply enumerated — no window, no growing, nothing to anchor. */
export function weekDateKeys(week: SeasonWeek): string[] {
  const keys: string[] = []
  const day = new Date(`${week.start}T00:00:00Z`)
  const last = new Date(`${week.end}T00:00:00Z`)
  // Bounded rather than trusting the dates: a malformed span should not
  // spin here, and no real week runs past a bowl period's six weeks.
  for (let i = 0; i < 45 && day <= last; i++) {
    keys.push(day.toISOString().slice(0, 10))
    day.setUTCDate(day.getUTCDate() + 1)
  }
  return keys
}

/** The week containing a day, or the nearest one after it. */
export function weekForDate(weeks: SeasonWeek[], dateKey: string): SeasonWeek | undefined {
  return weeks.find((w) => dateKey >= w.start && dateKey <= w.end) ?? weeks.find((w) => w.start > dateKey)
}
