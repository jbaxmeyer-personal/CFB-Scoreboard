import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchLeaguePlayerStats, selectTeamPlayers } from '../lib/seasonPlayerStats'
import type { PlayerStatCategory } from '../types/game'

export interface SeasonPlayerStatsResult {
  categories: PlayerStatCategory[]
  isLoading: boolean
  isError: boolean
  error?: Error
  /** What the download actually cost, and whether it was cut short — shown
   * under the tables rather than left as folklore. */
  leagueAthletes?: number
  pagesFetched?: number
  truncated?: boolean
}

/**
 * One team's season player stats, fetched only once asked for.
 *
 * `enabled` is the point of this hook. ESPN has no per-team source — three
 * rounds of probing a real device established that — so this reads the
 * league-wide table and filters it, several thousand athletes across a few
 * requests. That is not a cost to impose on anyone who merely opened a team
 * page, so nothing is fetched until the section is expanded.
 *
 * The query key carries no team on purpose: the download is the league, so
 * one team's page warms the cache for every other team's, and the filtering
 * happens here. The long stale time follows from what the data is — season
 * totals move once a week, not once a poll.
 */
export function useSeasonPlayerStats(teamId: string, year: number, enabled: boolean): SeasonPlayerStatsResult {
  const query = useQuery({
    queryKey: ['leaguePlayerStats', year],
    queryFn: () => fetchLeaguePlayerStats(year),
    enabled,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    retry: 1,
  })

  const categories = useMemo(
    () => (query.data ? selectTeamPlayers(query.data, teamId) : []),
    [query.data, teamId],
  )

  return {
    categories,
    isLoading: query.isLoading && enabled,
    isError: query.isError,
    error: query.error ?? undefined,
    leagueAthletes: query.data?.leagueAthletes,
    pagesFetched: query.data?.pagesFetched,
    truncated: query.data?.truncated,
  }
}
