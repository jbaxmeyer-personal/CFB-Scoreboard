import { DateTime } from 'luxon'

export interface TimezoneOption {
  id: string // IANA zone name
  label: string
  abbr: string
}

// US zones covering the vast majority of CFB viewers, plus device-local.
export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { id: 'America/New_York', label: 'Eastern', abbr: 'ET' },
  { id: 'America/Chicago', label: 'Central', abbr: 'CT' },
  { id: 'America/Denver', label: 'Mountain', abbr: 'MT' },
  { id: 'America/Los_Angeles', label: 'Pacific', abbr: 'PT' },
  { id: 'America/Anchorage', label: 'Alaska', abbr: 'AKT' },
  { id: 'Pacific/Honolulu', label: 'Hawaii', abbr: 'HT' },
]

export const DEVICE_TIMEZONE_ID = 'device'

export function getDeviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** Resolves the "device" sentinel to a real IANA zone; passes through everything else. */
export function resolveZone(zoneId: string): string {
  return zoneId === DEVICE_TIMEZONE_ID ? getDeviceTimezone() : zoneId
}

export function zoneLabel(zoneId: string): string {
  if (zoneId === DEVICE_TIMEZONE_ID) return 'Device'
  const known = TIMEZONE_OPTIONS.find((z) => z.id === zoneId)
  return known?.label ?? zoneId
}

export function zoneAbbr(zoneId: string, atISO: string): string {
  const zone = resolveZone(zoneId)
  return DateTime.fromISO(atISO, { zone }).toFormat('ZZZZ')
}

/** Current-moment zone abbreviation, e.g. "ET" / "EDT" depending on DST. */
export function zoneAbbrNow(zoneId: string): string {
  const zone = resolveZone(zoneId)
  return DateTime.now().setZone(zone).toFormat('ZZZZ')
}

/** e.g. "7:30 PM ET" */
export function formatKickoff(isoUtc: string, zoneId: string): string {
  const zone = resolveZone(zoneId)
  const dt = DateTime.fromISO(isoUtc, { zone })
  return `${dt.toFormat('h:mm a')} ${dt.toFormat('ZZZZ')}`
}

/** e.g. "7:30 PM" without the zone suffix, for tighter layouts. */
export function formatKickoffTime(isoUtc: string, zoneId: string): string {
  const zone = resolveZone(zoneId)
  return DateTime.fromISO(isoUtc, { zone }).toFormat('h:mm a')
}

/** e.g. "Saturday, Aug 30" in the given zone. */
export function formatDayLabel(isoUtc: string, zoneId: string): string {
  const zone = resolveZone(zoneId)
  return DateTime.fromISO(isoUtc, { zone }).toFormat('cccc, LLL d')
}

/** Short day label for a yyyy-MM-dd key, e.g. "Sat 8/30". The key already
 * names the day, so it is read as a plain date rather than converted from
 * an instant — a tab labelled from a game's kickoff said "Fri" for a
 * Saturday slate whose times weren't announced. */
export function formatDayKeyChip(dateKey: string): string {
  const dt = DateTime.fromISO(dateKey)
  return dt.isValid ? dt.toFormat('ccc M/d') : dateKey
}

/** Short day label for tab chips, e.g. "Sat 8/30". */
export function formatDayChip(isoUtc: string, zoneId: string): string {
  const zone = resolveZone(zoneId)
  return DateTime.fromISO(isoUtc, { zone }).toFormat('ccc M/d')
}

/** The zone college football's schedule is written in: a kickoff with no
 * time set carries midnight here. */
const SCHEDULE_ZONE = 'America/New_York'

/** True when a kickoff lands exactly on midnight Eastern, which is ESPN's
 * placeholder for "time not announced" rather than a game at midnight.
 * Belt and braces behind the `timeValid` flag, for a payload that omits it. */
export function isScheduleMidnight(isoUtc: string): boolean {
  const dt = DateTime.fromISO(isoUtc, { zone: SCHEDULE_ZONE })
  return dt.isValid && dt.hour === 0 && dt.minute === 0
}

/** YYYY-MM-DD in the zone the schedule is written in, which is the day a
 * game is actually played even when its time is still TBD. */
export function scheduleDateKey(isoUtc: string): string {
  return DateTime.fromISO(isoUtc, { zone: SCHEDULE_ZONE }).toFormat('yyyy-MM-dd')
}

/** YYYY-MM-DD local-date key in the given zone, used to group games by day. */
export function localDateKey(isoUtc: string, zoneId: string): string {
  const zone = resolveZone(zoneId)
  return DateTime.fromISO(isoUtc, { zone }).toFormat('yyyy-MM-dd')
}

/**
 * The day a game belongs to.
 *
 * Normally the viewer's own local date. But a game whose kickoff time isn't
 * set carries midnight Eastern as a placeholder, and converting that to any
 * zone west of Eastern lands it on the day before — which is how a Saturday
 * slate came to be listed under Friday for a viewer in Central. For those,
 * the Eastern date is the real one.
 */
export function gameDayKey(game: { startDate: string; timeTBD: boolean }, zoneId: string): string {
  return game.timeTBD ? scheduleDateKey(game.startDate) : localDateKey(game.startDate, zoneId)
}

/** yyyyMMdd for the ESPN `dates` query param, in the given zone. */
export function toEspnDateParam(date: DateTime): string {
  return date.toFormat('yyyyMMdd')
}
