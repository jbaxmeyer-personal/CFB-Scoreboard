import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { fetchGameSummary } from '../lib/espn'
import type { EspnSummaryResponse } from '../types/espn'
import type { Game } from '../types/game'

export interface TeamGameSummaries {
  games: { game: Game; summary?: EspnSummaryResponse }[]
  isLoading: boolean
  isError: boolean
  /** How many of the played games actually came back, so a section built on
   * them can say what it covers instead of quietly averaging fewer. */
  loaded: number
  played: number
}

/**
 * Every summary for the games a team has played.
 *
 * One request per played game, under the same query key the expanded game
 * view uses — so a game already opened costs nothing, and anything fetched
 * here makes opening that game instant. Both the season player totals and
 * the defensive season rows read from this, so the team page fetches them
 * once between them rather than once each.
 *
 * Fixtures that haven't kicked off are skipped: there is no box score to
 * ask for.
 */
export function useTeamGameSummaries(schedule: Game[], enabled = true): TeamGameSummaries {
  const played = useMemo(() => schedule.filter((game) => game.state !== 'pre'), [schedule])

  const results = useQueries({
    queries: played.map((game) => ({
      queryKey: ['gameSummary', game.id],
      queryFn: () => fetchGameSummary(game.id),
      enabled,
      // A finished game's box score is finished with. The live view sets its
      // own interval on this key while a game is in progress.
      staleTime: 5 * 60_000,
    })),
  })

  const games = useMemo(
    () => played.map((game, i) => ({ game, summary: results[i]?.data })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [played, results.map((r) => r.dataUpdatedAt).join(',')],
  )

  return {
    games,
    isLoading: enabled && results.some((r) => r.isLoading),
    isError: results.length > 0 && results.every((r) => r.isError),
    loaded: results.filter((r) => r.data).length,
    played: played.length,
  }
}
