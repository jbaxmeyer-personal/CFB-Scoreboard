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
 * season aggregate barely moves within a session. `year` is the season this
 * game belongs to (see seasonYearFromDate) — passed explicitly because the
 * endpoint silently falls back to a completed season otherwise. */
export function useSeasonTeamStats(homeTeamId: string, awayTeamId: string, year: number): SeasonTeamStatsResult {
  const homeQuery = useQuery({
    queryKey: ['teamSeasonStats', homeTeamId, year],
    queryFn: () => fetchTeamSeasonStats(homeTeamId, year),
    staleTime: 60 * 60_000,
  })
  const awayQuery = useQuery({
    queryKey: ['teamSeasonStats', awayTeamId, year],
    queryFn: () => fetchTeamSeasonStats(awayTeamId, year),
    staleTime: 60 * 60_000,
  })

  return {
    stats: homeQuery.data && awayQuery.data ? normalizeSeasonStats(homeQuery.data, awayQuery.data, year) : [],
    isLoading: homeQuery.isLoading || awayQuery.isLoading,
    isError: homeQuery.isError || awayQuery.isError,
  }
}
