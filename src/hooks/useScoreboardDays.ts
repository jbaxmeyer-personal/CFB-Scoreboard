import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { DateTime } from 'luxon'
import { fetchScoreboard, normalizeScoreboard } from '../lib/espn'
import { toEspnDateParam } from '../lib/timezone'
import { windowDateKeys } from '../lib/dayWindow'
import type { Game } from '../types/game'
import { hasLiveGame, useLivePolling } from './useLivePolling'

export { DAYS_BEFORE, DAYS_AFTER } from '../lib/dayWindow'

export interface ScoreboardDaysResult {
  games: Game[]
  /** Every day the window fetched, in order, including days that turned out
   * to have no games. Scoreboard filters these down to the days that do
   * before building its tab strip; the full list is what defines the
   * window's extent and its anchor. */
  dateKeys: string[]
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

/**
 * Scoreboard's day-based window. This replaces the week navigator: ESPN's
 * week numbering doesn't line up with how anyone actually looks for a game
 * ("what's on tonight", "what was on Saturday"), and a week boundary put
 * Thursday and the Saturday before it on different screens.
 *
 * One request per day, all in flight together, deduped by event id for the
 * same reason Slate's window is — ESPN's `dates=` day boundary isn't the
 * viewer's, so a late kickoff comes back in two adjacent days' payloads.
 */
export function useScoreboardDays(anchorDateKey: string | null, zoneId: string): ScoreboardDaysResult {
  const dateKeys = useMemo(() => windowDateKeys(anchorDateKey, zoneId), [anchorDateKey, zoneId])

  const results = useQueries({
    queries: dateKeys.map((dateKey) => {
      const dateParam = toEspnDateParam(DateTime.fromISO(dateKey))
      return {
        queryKey: ['scoreboard', dateParam],
        queryFn: () => fetchScoreboard(dateParam),
        // Short, so arriving back at the app refetches rather than rendering
        // whatever was last seen.
        staleTime: 4_000,
        // No `refetchInterval` — it does not work through `useQueries`. See
        // useLivePolling, which drives the refetches instead. This screen is
        // the scoreboard; it going quiet for minutes at a time was the bug.
      }
    }),
  })

  const dateParams = useMemo(
    () => dateKeys.map((dateKey) => toEspnDateParam(DateTime.fromISO(dateKey))),
    [dateKeys],
  )
  const liveDateParams = useMemo(
    () => dateParams.filter((_, i) => hasLiveGame(results[i]?.data)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateParams.join(','), results.map((r) => r.dataUpdatedAt).join(',')],
  )
  useLivePolling(dateParams, liveDateParams)

  const isLoading = results.some((r) => r.isLoading)
  const hasAnyData = results.some((r) => r.data)
  const isError = !hasAnyData && results.some((r) => r.isError)

  const games = useMemo(() => {
    const byId = new Map<string, Game>()
    for (const r of results) {
      if (!r.data) continue
      for (const game of normalizeScoreboard(r.data)) {
        if (!byId.has(game.id)) byId.set(game.id, game)
      }
    }
    return [...byId.values()].sort((a, b) => a.startDate.localeCompare(b.startDate))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.map((r) => r.dataUpdatedAt).join(',')])

  return {
    games,
    dateKeys,
    isLoading: isLoading && !hasAnyData,
    isError,
    refetch: () => {
      for (const r of results) r.refetch()
    },
  }
}
