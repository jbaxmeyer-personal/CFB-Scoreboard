import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { DateTime } from 'luxon'
import { fetchScoreboard, normalizeScoreboard } from '../lib/espn'
import { toEspnDateParam } from '../lib/timezone'
import { windowDateKeys } from '../lib/dayWindow'
import type { Game } from '../types/game'

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
        staleTime: 5 * 60_000,
        refetchInterval: 30_000,
      }
    }),
  })

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
