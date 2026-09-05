/**
 * The mechanics behind the broadcast delay: a short history of what a feed
 * said and when we were told, so the UI can render what it knew N seconds
 * ago instead of what it knows now.
 *
 * Kept out of the hooks that use it because there are two of them — the
 * per-game scoreboard state and the per-game summary (box score and
 * play-by-play) — and the two must release on exactly the same terms. A
 * score held back while its play-by-play runs live would announce the
 * touchdown anyway.
 */
export interface Snapshot<T> {
  at: number
  fingerprint: string
  value: T
}

/**
 * How far past the requested delay a snapshot may be before it stops
 * counting. Polling pauses while the tab is hidden, so returning to the app
 * after a while leaves a buffer whose newest entry is minutes old. Showing
 * that would be a far longer delay than was asked for, so anything this
 * stale is discarded and the caller waits for fresh data instead — running
 * behind is recoverable, running ahead is not.
 */
export const STALE_MARGIN_MS = 90_000

/** Appends only when the value actually changed. Returns whether it did, so
 * callers can skip a re-render when a poll brought back the same thing. */
export function recordSnapshot<T>(snapshots: Snapshot<T>[], value: T, fingerprint: string, at: number): boolean {
  const newest = snapshots[snapshots.length - 1]
  if (newest && newest.fingerprint === fingerprint) return false
  snapshots.push({ at, fingerprint, value })
  return true
}

/** The newest snapshot old enough to release, or undefined when none is —
 * either because nothing has aged in yet, or because everything held is so
 * old it would misrepresent the delay. */
export function selectReleased<T>(snapshots: Snapshot<T>[], now: number, delayMs: number): Snapshot<T> | undefined {
  const cutoff = now - delayMs
  for (let i = snapshots.length - 1; i >= 0; i--) {
    if (snapshots[i].at <= cutoff) {
      return snapshots[i].at < cutoff - STALE_MARGIN_MS ? undefined : snapshots[i]
    }
  }
  return undefined
}

/** Drops entries older than the one currently on screen; they can never be
 * shown again. Mutates in place. */
export function pruneReleased<T>(snapshots: Snapshot<T>[], now: number, delayMs: number): void {
  const cutoff = now - delayMs
  for (let i = snapshots.length - 1; i >= 0; i--) {
    if (snapshots[i].at <= cutoff) {
      if (i > 0) snapshots.splice(0, i)
      return
    }
  }
}

/** When the next still-held snapshot comes due, so a caller can wake exactly
 * then instead of polling a timer. Undefined when nothing is waiting. */
export function nextDueAt<T>(snapshots: Snapshot<T>[], now: number, delayMs: number): number | undefined {
  for (const snapshot of snapshots) {
    const dueAt = snapshot.at + delayMs
    if (dueAt > now) return dueAt
  }
  return undefined
}
