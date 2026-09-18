import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { DateTime } from 'luxon'
import { fetchScoreboard, normalizeScoreboard } from '../lib/espn'
import { toEspnDateParam } from '../lib/timezone'
import { windowDateKeys } from '../lib/dayWindow'
import { mergeSeasonCalendars, parseSeasonCalendar, type SeasonCalendar } from '../lib/seasonCalendar'
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
  /** The season's own schedule, as the payload described it — the days that
   * have games where ESPN lists them, and the season's extent either way.
   * Empty when the payload carried nothing usable, which leaves the screen
   * on the fetched window it used before. */
  season: SeasonCalendar
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
export function useScoreboardDays(
  anchorDateKey: string | null,
  zoneId: string,
  /** Fetch exactly these days rather than a window around the anchor. A
   * week is a known span, so week navigation names its days outright; the
   * window is only what the first pass uses to learn the calendar. */
  explicitDateKeys?: string[],
): ScoreboardDaysResult {
  const explicitKey = explicitDateKeys?.join(',')
  const dateKeys = useMemo(
    () => (explicitKey ? explicitKey.split(',') : windowDateKeys(anchorDateKey, zoneId)),
    [explicitKey, anchorDateKey, zoneId],
  )

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

  // Every day's response carries the same season calendar, so this takes
  // whichever of them have arrived. No extra request: these are the
  // responses the screen is already built from.
  const season = useMemo(
    () => mergeSeasonCalendars(results.filter((r) => r.data).map((r) => parseSeasonCalendar(r.data))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [results.map((r) => r.dataUpdatedAt).join(',')],
  )

  return {
    games,
    dateKeys,
    season,
    isLoading: isLoading && !hasAnyData,
    isError,
    refetch: () => {
      for (const r of results) r.refetch()
    },
  }
}
