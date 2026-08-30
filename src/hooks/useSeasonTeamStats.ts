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

  const stats = homeQuery.data && awayQuery.data ? normalizeSeasonStats(homeQuery.data, awayQuery.data, year) : []
  // `isLoading` alone can briefly read false before data actually lands
  // (e.g. between a transient failure and react-query's automatic retry),
  // which was flashing an empty gap in the UI. Keep reporting "loading"
  // for as long as either query is still pending or actively (re)fetching,
  // and only surface an error once nothing is left in flight.
  const stillWorking = homeQuery.isPending || homeQuery.isFetching || awayQuery.isPending || awayQuery.isFetching

  return {
    stats,
    isLoading: stats.length === 0 && stillWorking,
    isError: stats.length === 0 && !stillWorking && (homeQuery.isError || awayQuery.isError),
  }
}
