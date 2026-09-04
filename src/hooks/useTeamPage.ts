import { useQuery } from '@tanstack/react-query'
import {
  coreRankMap,
  describeRankSource,
  fetchCoreTeamSeasonStats,
  fetchTeamSchedule,
  fetchTeamSeasonStats,
  normalizeTeamProfile,
  normalizeTeamSchedule,
} from '../lib/espn'
import type { TeamProfileStat } from '../lib/espn'
import type { Game } from '../types/game'

export interface TeamPageResult {
  stats: TeamProfileStat[]
  schedule: Game[]
  statsLoading: boolean
  scheduleLoading: boolean
  statsError: boolean
  scheduleError: boolean
  /** What the core rank source returned, shown only when the rank column
   * came up empty — so a missing rank reports itself rather than being
   * guessed at again. */
  rankSource: string
}

/** Everything a team's page needs: its season profile and its full
 * schedule. Two independent requests so a slow or failed schedule doesn't
 * hold up the stats, or the other way round — each section reports its own
 * state. Both are cached for an hour; neither changes within a session
 * except when a game finishes, which the scoreboard already polls for. */
export function useTeamPage(teamId: string, year: number): TeamPageResult {
  const statsQuery = useQuery({
    queryKey: ['teamSeasonStats', teamId, year],
    queryFn: () => fetchTeamSeasonStats(teamId, year),
    staleTime: 60 * 60_000,
  })

  // Rank source. The site endpoint carries ranks only on its opponent
  // categories, so offensive and turnover rows need this; it's a separate
  // query so a failure here leaves the stats themselves intact.
  const coreQuery = useQuery({
    queryKey: ['coreTeamSeasonStats', teamId, year],
    queryFn: () => fetchCoreTeamSeasonStats(teamId, year),
    staleTime: 60 * 60_000,
    retry: 1,
  })

  const scheduleQuery = useQuery({
    queryKey: ['teamSchedule', teamId, year],
    queryFn: () => fetchTeamSchedule(teamId, year),
    staleTime: 60 * 60_000,
  })

  const coreRanks = coreRankMap(coreQuery.data)
  const stats = statsQuery.data ? normalizeTeamProfile(statsQuery.data, year, coreRanks) : []
  const schedule = normalizeTeamSchedule(scheduleQuery.data)

  return {
    stats,
    schedule,
    statsLoading: statsQuery.isLoading,
    scheduleLoading: scheduleQuery.isLoading,
    statsError: statsQuery.isError,
    scheduleError: scheduleQuery.isError,
    rankSource: describeRankSource(coreQuery.data, coreQuery.isError ? (coreQuery.error?.message ?? 'request failed') : undefined),
  }
}
