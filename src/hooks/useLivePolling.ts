import { useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { EspnScoreboardResponse } from '../types/espn'

/**
 * How often a day is re-fetched, by whether anything in it is being played.
 *
 * A day with a game in progress is the only thing on screen that changes by
 * the second; the other days are kickoff times that were set weeks ago. So
 * the live day is polled hard and the rest are left nearly alone — faster
 * where it matters and quieter overall than the flat 30 seconds across every
 * day in the window that this replaces.
 */
export const LIVE_POLL_MS = 5_000
export const IDLE_POLL_MS = 5 * 60_000

/** Whether any game in a day's payload is in progress. Read straight off the
 * cached response rather than the normalized games, so it costs nothing. */
export function hasLiveGame(response: EspnScoreboardResponse | undefined): boolean {
  return (response?.events ?? []).some((event) => {
    const status = event.competitions?.[0]?.status ?? event.status
    return status?.type?.state === 'in'
  })
}

/**
 * Keeps a window of scoreboard days current.
 *
 * This exists because `refetchInterval` does not work through `useQueries`,
 * which is what left a live scoreboard sitting still for minutes at a time.
 * React Query installs the interval timer in `QueryObserver.setOptions`, but
 * only `if (mounted)` — only once that observer has listeners.
 * `QueriesObserver.setQueries` calls `setOptions` on each child observer
 * *before* subscribing them, so on the first pass nothing is armed; every
 * later pass is guarded by `nextRefetchInterval !== currentRefetchInterval`,
 * which is false for a constant interval, so nothing is armed then either. A
 * plain `useQuery` polls correctly because its observer is subscribed before
 * its options are set — which is why the per-game summary stayed current
 * while the scoreboard around it did not.
 *
 * Measured, not assumed: with a game in progress and a 5s interval set on the
 * query options, the scoreboard endpoint was requested exactly once in
 * sixteen seconds, while the summary query was requested four times.
 *
 * Both scoreboard screens fetch the same per-day query keys, so this takes
 * the day list and drives the refetches itself.
 */
export function useLivePolling(dateParams: string[], liveDateParams: string[]): void {
  const queryClient = useQueryClient()
  // Joined into strings so the effects below depend on the days themselves
  // rather than on a fresh array identity every render.
  const liveKey = liveDateParams.join(',')
  const allKey = dateParams.join(',')

  const refreshers = useMemo(() => {
    const refresh = (days: string[]) => () => {
      // Nobody is reading a scoreboard they can't see, and iOS suspends the
      // page anyway; the visibility listener below covers coming back.
      if (typeof document !== 'undefined' && document.hidden) return
      for (const day of days) void queryClient.refetchQueries({ queryKey: ['scoreboard', day] })
    }
    return { live: refresh(liveKey ? liveKey.split(',') : []), all: refresh(allKey ? allKey.split(',') : []) }
  }, [liveKey, allKey, queryClient])

  // The live days, hard. Also fires once immediately on becoming visible
  // again, so returning to the app shows the current score rather than
  // whatever it held when it was last open.
  useEffect(() => {
    if (!liveKey) return
    const timer = setInterval(refreshers.live, LIVE_POLL_MS)
    document.addEventListener('visibilitychange', refreshers.live)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refreshers.live)
    }
  }, [liveKey, refreshers])

  // The whole window, slowly. This is what lets a game that kicks off become
  // live without anyone reopening the app.
  useEffect(() => {
    if (!allKey) return
    const timer = setInterval(refreshers.all, IDLE_POLL_MS)
    return () => clearInterval(timer)
  }, [allKey, refreshers])
}
