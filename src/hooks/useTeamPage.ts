import { useQuery } from '@tanstack/react-query'
import { fetchTeamSchedule, fetchTeamSeasonStats, normalizeTeamProfile, normalizeTeamSchedule } from '../lib/espn'
import type { TeamProfileStat } from '../lib/espn'
import type { Game } from '../types/game'

export interface TeamPageResult {
  stats: TeamProfileStat[]
  schedule: Game[]
  statsLoading: boolean
  scheduleLoading: boolean
  statsError: boolean
  scheduleError: boolean
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

  const scheduleQuery = useQuery({
    queryKey: ['teamSchedule', teamId, year],
    queryFn: () => fetchTeamSchedule(teamId, year),
    staleTime: 60 * 60_000,
  })

  const stats = statsQuery.data ? normalizeTeamProfile(statsQuery.data, year) : []
  const schedule = normalizeTeamSchedule(scheduleQuery.data)

  return {
    stats,
    schedule,
    statsLoading: statsQuery.isLoading,
    scheduleLoading: scheduleQuery.isLoading,
    statsError: statsQuery.isError,
    scheduleError: scheduleQuery.isError,
  }
}
