import { useQuery } from '@tanstack/react-query'
import { fetchTeamSeasonStats, normalizeSeasonStats } from '../lib/espn'
import type { TeamStatLine } from '../types/game'

export interface SeasonTeamStatsResult {
  stats: TeamStatLine[]
  isLoading: boolean
  isError: boolean
}

/** Season-long team stat comparison, fetched only pre-game (see
 * SeasonTeamComparison) — two per-team requests, cached for an hour since a
 * season aggregate barely moves within a session. */
export function useSeasonTeamStats(homeTeamId: string, awayTeamId: string): SeasonTeamStatsResult {
  const homeQuery = useQuery({
    queryKey: ['teamSeasonStats', homeTeamId],
    queryFn: () => fetchTeamSeasonStats(homeTeamId),
    staleTime: 60 * 60_000,
  })
  const awayQuery = useQuery({
    queryKey: ['teamSeasonStats', awayTeamId],
    queryFn: () => fetchTeamSeasonStats(awayTeamId),
    staleTime: 60 * 60_000,
  })

  return {
    stats: homeQuery.data && awayQuery.data ? normalizeSeasonStats(homeQuery.data, awayQuery.data) : [],
    isLoading: homeQuery.isLoading || awayQuery.isLoading,
    isError: homeQuery.isError || awayQuery.isError,
  }
}
