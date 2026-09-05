import { useEffect, useMemo, useRef, useState } from 'react'
import { nextDueAt, pruneReleased, recordSnapshot, selectReleased, type Snapshot } from '../lib/delayBuffer'

export interface DelayedValue<T> {
  /** The value as of `delaySeconds` ago, or undefined while nothing has aged
   * in yet. */
  value: T | undefined
  isDelayed: boolean
}

/**
 * The single-value counterpart to useDelayedGames, for the per-game summary
 * (box score and play-by-play).
 *
 * That feed needs its own buffer rather than riding along with the game's:
 * it is a separate request on a separate interval, so its updates arrive at
 * different moments than the scoreboard's and have to age from when *they*
 * landed. Both go through the same buffer mechanics, so the two release on
 * the same terms — which matters, because the expanded view prefers the
 * newest play's score over the scoreboard's. Left undelayed, the play-by-play
 * would announce the touchdown while the score above it was still held.
 */
export function useDelayedValue<T>(value: T, delaySeconds: number, enabled: boolean): DelayedValue<T> {
  const snapshots = useRef<Snapshot<T>[]>([])
  const [tick, setTick] = useState(0)
  const delayMs = enabled ? Math.max(0, delaySeconds) * 1000 : 0
  const fingerprint = useMemo(() => JSON.stringify(value ?? null), [value])

  useEffect(() => {
    if (delayMs === 0) {
      snapshots.current = []
      return
    }
    if (recordSnapshot(snapshots.current, value, fingerprint, Date.now())) setTick((t) => t + 1)
  }, [fingerprint, value, delayMs])

  const result = useMemo<DelayedValue<T>>(() => {
    if (delayMs === 0) return { value, isDelayed: false }
    const released = selectReleased(snapshots.current, Date.now(), delayMs)
    return released ? { value: released.value, isDelayed: false } : { value: undefined, isDelayed: true }
    // `tick` stands in for the clock this reads through Date.now().
  }, [value, delayMs, tick])

  useEffect(() => {
    if (delayMs === 0) return
    const now = Date.now()
    const due = nextDueAt(snapshots.current, now, delayMs)
    if (due === undefined) return
    const timer = setTimeout(() => setTick((t) => t + 1), Math.max(50, due - now))
    return () => clearTimeout(timer)
  }, [delayMs, tick])

  useEffect(() => {
    if (delayMs === 0) return
    pruneReleased(snapshots.current, Date.now(), delayMs)
  }, [delayMs, tick])

  return result
}
