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
      // Deliberately shorter than the poll below. Polling pauses while the
      // tab is hidden, so coming back to the app is the moment the data is
      // most likely to be behind — and a focus refetch only fires if the
      // data is already stale. At five minutes it almost never was, so
      // returning to a live game waited out the next 30s tick instead of
      // refetching on arrival. Now anything older than half a poll refetches
      // the moment the app is looked at again.
      staleTime: 15_000,
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
    // Deduped by event id, not just concatenated: ESPN's `dates=` day
    // boundary isn't the viewer's, so a late kickoff comes back in *both*
    // the day it's filed under and the adjacent day's payload. Those two
    // copies then land in the same local-day bucket (see useGamesByDay),
    // which rendered the same game twice on Slate and handed React two
    // children with the same key — a warned-about state where children
    // "may be duplicated and/or omitted".
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

  const refetch = () => {
    for (const r of results) r.refetch()
  }

  return { games, isLoading: isLoading && !hasAnyData, isError, refetch }
}
