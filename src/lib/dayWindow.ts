import { DateTime } from 'luxon'
import { resolveZone } from './timezone'

/** Two days back and seven forward, so the window opens on the day you're
 * anchored to with the weekend ahead of it and the games just played still
 * reachable. Ten days total. */
export const DAYS_BEFORE = 2
export const DAYS_AFTER = 7

/**
 * The local-day keys Scoreboard's window covers, anchored on
 * `anchorDateKey` (defaulting to today in the viewer's zone). An anchor
 * that doesn't parse falls back to today rather than producing an invalid
 * window.
 *
 * `extraBefore`/`extraAfter` widen it. The day strip grows outward as you
 * scroll to either end, because ESPN's season calendar describes weeks as
 * spans and never says which days inside them have games — the only source
 * that knows is the games themselves, so the days have to be fetched to be
 * listed.
 */
export function windowDateKeys(
  anchorDateKey: string | null,
  zoneId: string,
  extraBefore = 0,
  extraAfter = 0,
): string[] {
  const zone = resolveZone(zoneId)
  const today = DateTime.now().setZone(zone).startOf('day')
  const parsed = anchorDateKey ? DateTime.fromISO(anchorDateKey, { zone }).startOf('day') : null
  const base = parsed?.isValid ? parsed : today

  const keys: string[] = []
  for (let offset = -DAYS_BEFORE - extraBefore; offset <= DAYS_AFTER + extraAfter; offset++) {
    keys.push(base.plus({ days: offset }).toFormat('yyyy-MM-dd'))
  }
  return keys
}
