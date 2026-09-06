import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { fetchGameSummary, normalizePlayerStats } from '../lib/espn'
import { aggregateSeasonPlayers } from '../lib/seasonPlayerStats'
import type { EspnBoxscorePlayerEntry, EspnSummaryResponse } from '../types/espn'
import type { Game, PlayerStatCategory } from '../types/game'

export interface SeasonPlayerStatsResult {
  categories: PlayerStatCategory[]
  isLoading: boolean
  isError: boolean
  /** How many of the team's games the totals actually cover, so a season
   * that is still loading — or a game ESPN has no box score for — is visible
   * rather than silently missing from the sums. */
  gamesCounted: number
  gamesAvailable: number
}

/** This team's entry in a summary's player box score, by id and then by
 * abbreviation — ESPN's own entries carry both, and a game where the id is
 * absent is still identifiable. */
function teamEntry(summary: EspnSummaryResponse | undefined, teamId: string, abbreviation?: string): EspnBoxscorePlayerEntry | undefined {
  const players = summary?.boxscore?.players
  return (
    players?.find((entry) => entry.team.id === teamId) ??
    (abbreviation ? players?.find((entry) => entry.team.abbreviation === abbreviation) : undefined)
  )
}

/**
 * One team's season player stats, added up from that team's own games.
 *
 * Fetched only when asked for, and one request per game played — the same
 * per-game summaries the expanded game view uses, under the same query key,
 * so any game already opened costs nothing here and anything fetched here
 * makes opening that game instant.
 *
 * Only games that have been played are requested. A fixture that hasn't
 * kicked off has no box score, and asking for one would be a request that
 * could never return anything.
 */
export function useSeasonPlayerStats(
  teamId: string,
  abbreviation: string | undefined,
  schedule: Game[],
  enabled: boolean,
): SeasonPlayerStatsResult {
  const played = useMemo(() => schedule.filter((game) => game.state !== 'pre'), [schedule])

  const results = useQueries({
    queries: played.map((game) => ({
      queryKey: ['gameSummary', game.id],
      queryFn: () => fetchGameSummary(game.id),
      enabled,
      // A finished game's box score is finished with. This is the same key
      // the live view polls, and that view sets its own interval while the
      // game is in progress; nothing here needs to poll.
      staleTime: 5 * 60_000,
    })),
  })

  const summaries = results.map((r) => r.data)
  const categories = useMemo(
    () => {
      const perGame = summaries
        .map((summary) => normalizePlayerStats(teamEntry(summary, teamId, abbreviation)))
        .filter((cats) => cats.length > 0)
      return perGame.length > 0 ? aggregateSeasonPlayers(perGame) : []
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [results.map((r) => r.dataUpdatedAt).join(','), teamId, abbreviation],
  )

  return {
    categories,
    isLoading: enabled && results.some((r) => r.isLoading),
    isError: results.length > 0 && results.every((r) => r.isError),
    gamesCounted: summaries.filter((s) => teamEntry(s, teamId, abbreviation)).length,
    gamesAvailable: played.length,
  }
}
