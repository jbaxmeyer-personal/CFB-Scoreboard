import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { DateTime } from 'luxon'
import { fetchScoreboard, normalizeScoreboard } from '../lib/espn'
import { toEspnDateParam } from '../lib/timezone'
import type { Game } from '../types/game'

export interface ScoreboardResult {
  games: Game[]
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

// ESPN's scoreboard endpoint is queried per-day; CFB games cluster
// Thu-through-Mon, so we pull a rolling window around today rather than
// requiring the user to page one day at a time.
//
// DAYS_AFTER must be at least 6: the worst case is "today" being a Sunday,
// where the next Saturday's slate (the biggest one of the week) is exactly
// 6 days out. A shorter window can clip it depending on what weekday it
// happens to be when someone opens the app.
const DAYS_BEFORE = 1
const DAYS_AFTER = 6

function getWindowDateParams(): string[] {
  const today = DateTime.now().startOf('day')
  const params: string[] = []
  for (let i = -DAYS_BEFORE; i <= DAYS_AFTER; i++) {
    params.push(toEspnDateParam(today.plus({ days: i })))
  }
  return params
}

export function useScoreboard(): ScoreboardResult {
  const dateParams = getWindowDateParams()

  const results = useQueries({
    queries: dateParams.map((dateParam) => ({
      queryKey: ['scoreboard', dateParam],
      queryFn: () => fetchScoreboard(dateParam),
      staleTime: 5 * 60_000, // ESPN scores move fast on live game days; keep this short
      // Keeps score/clock/possession/state fresh without any user action.
      // Pauses automatically while the tab is hidden (refetchIntervalInBackground
      // defaults to false), so this never polls when nobody's looking.
      refetchInterval: 30_000,
    })),
  })

  const isLoading = results.some((r) => r.isLoading)
  const hasAnyData = results.some((r) => r.data)
  const isError = !hasAnyData && results.some((r) => r.isError)

  const games = useMemo(() => {
    const all: Game[] = []
    for (const r of results) {
      if (r.data) all.push(...normalizeScoreboard(r.data))
    }
    return all.sort((a, b) => a.startDate.localeCompare(b.startDate))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.map((r) => r.dataUpdatedAt).join(',')])

  const refetch = () => {
    for (const r of results) r.refetch()
  }

  return { games, isLoading: isLoading && !hasAnyData, isError, refetch }
}
