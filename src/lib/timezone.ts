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

/** Short day label for tab chips, e.g. "Sat 8/30". */
export function formatDayChip(isoUtc: string, zoneId: string): string {
  const zone = resolveZone(zoneId)
  return DateTime.fromISO(isoUtc, { zone }).toFormat('ccc M/d')
}

/** YYYY-MM-DD local-date key in the given zone, used to group games by day. */
export function localDateKey(isoUtc: string, zoneId: string): string {
  const zone = resolveZone(zoneId)
  return DateTime.fromISO(isoUtc, { zone }).toFormat('yyyy-MM-dd')
}

/** yyyyMMdd for the ESPN `dates` query param, in the given zone. */
export function toEspnDateParam(date: DateTime): string {
  return date.toFormat('yyyyMMdd')
}
