/**
 * How far behind live the app should run.
 *
 * ESPN's feed is ahead of the television broadcast — the score updates here
 * before it happens on screen — so watching a game with the app open spoils
 * the play a beat before you see it. This holds live data back by a fixed
 * amount so the app trails the broadcast instead of leading it.
 *
 * It is not no-spoilers mode. That hides a game outright, on purpose, until
 * you ask to see it. This shows everything, just late, and only while a game
 * is actually in progress.
 */
export interface BroadcastDelayOption {
  seconds: number
  label: string
}

/** Off first, because knowing the score in real time is the right default
 * for anyone not watching that game on television. */
export const BROADCAST_DELAY_OPTIONS: BroadcastDelayOption[] = [
  { seconds: 0, label: 'Off' },
  { seconds: 10, label: '10 seconds' },
  { seconds: 30, label: '30 seconds' },
  { seconds: 60, label: '1 minute' },
  { seconds: 120, label: '2 minutes' },
]

export const DEFAULT_BROADCAST_DELAY_SECONDS = 0

/** A stored value from a future (or hand-edited) build shouldn't leave the
 * app running on a delay it can't name, so anything unrecognized reads as
 * off. */
export function normalizeDelaySeconds(value: unknown): number {
  return BROADCAST_DELAY_OPTIONS.some((o) => o.seconds === value)
    ? (value as number)
    : DEFAULT_BROADCAST_DELAY_SECONDS
}

export function delayLabel(seconds: number): string {
  return BROADCAST_DELAY_OPTIONS.find((o) => o.seconds === seconds)?.label ?? 'Off'
}

/** Compact form for the on-screen badge, e.g. "+30s" / "+2m". */
export function delayBadge(seconds: number): string {
  if (seconds <= 0) return ''
  return seconds % 60 === 0 && seconds >= 60 ? `+${seconds / 60}m` : `+${seconds}s`
}
