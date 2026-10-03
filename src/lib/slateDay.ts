import { DateTime } from 'luxon'
import { resolveZone } from './timezone'

/**
 * Which day Slate opens on.
 *
 * It used to be whichever day came first in the fetched window, and the
 * window starts two days *before* today — so a fresh open landed on a day
 * whose games had already been played. Today is what Slate is for.
 *
 * Today when today has games; otherwise the next day that does, since a
 * Tuesday in October has nothing on it and the useful answer is Saturday.
 * Only when every remaining day is behind us does it fall back to the last
 * day there is, which beats showing nothing.
 */
export function defaultSlateDayKey(dayKeys: string[], todayKey: string): string | undefined {
  if (dayKeys.length === 0) return undefined
  const ordered = [...dayKeys].sort()
  return ordered.find((key) => key >= todayKey) ?? ordered[ordered.length - 1]
}

/** Today, in the viewer's own zone — the same yyyy-MM-dd shape the day keys use. */
export function todayKey(zoneId: string): string {
  return DateTime.now().setZone(resolveZone(zoneId)).toFormat('yyyy-MM-dd')
}

/**
 * A remembered day is restored only when it was chosen today.
 *
 * The chosen day is persisted so that leaving Slate and coming back does
 * not lose your place. Without a stamp that also means a day picked last
 * Saturday is still selected the following Tuesday, which is the other half
 * of opening on a day whose games are over. Storing when the choice was
 * made keeps it for the rest of that day and drops it after.
 */
export interface RememberedDay {
  dateKey: string
  chosenOn: string
}

export function parseRememberedDay(raw: string | null, today: string): string | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<RememberedDay>
    if (typeof parsed?.dateKey !== 'string' || parsed.chosenOn !== today) return null
    return parsed.dateKey
  } catch {
    // A bare string is what the previous build wrote, with no record of
    // when. It cannot be told apart from a stale one, so it is dropped.
    return null
  }
}

export function serializeRememberedDay(dateKey: string | null, today: string): string | null {
  return dateKey === null ? null : JSON.stringify({ dateKey, chosenOn: today } satisfies RememberedDay)
}
