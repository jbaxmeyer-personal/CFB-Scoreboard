import { useQuery } from '@tanstack/react-query'
import { fetchTeamSeasonStats, normalizeSeasonStats } from '../lib/espn'
import type { TeamStatLine } from '../types/game'

export interface SeasonTeamStatsResult {
  stats: TeamStatLine[]
  isLoading: boolean
  isError: boolean
}

// react-query gives up for good after its default 3 retries (~7s of
// backoff) and then does nothing further — the only thing that used to
// bring the stats back was fully closing and reopening the game, which
// forces a remount and a fresh fetch. This keeps a settled failure quietly
// retrying every 5s in the background instead, so a transient network blip
// self-heals without any user action.
const RETRY_WHILE_FAILED = (query: { state: { status: string } }) => (query.state.status === 'error' ? 5000 : false)

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
    retry: 5,
    refetchInterval: RETRY_WHILE_FAILED,
  })
  const awayQuery = useQuery({
    queryKey: ['teamSeasonStats', awayTeamId, year],
    queryFn: () => fetchTeamSeasonStats(awayTeamId, year),
    staleTime: 60 * 60_000,
    retry: 5,
    refetchInterval: RETRY_WHILE_FAILED,
  })

  // Both sides succeeding (even to an empty [] — e.g. the season-match
  // guard in normalizeSeasonStats rejecting a stale response) is a settled
  // outcome, never a "still working" one — otherwise that legitimate hide
  // would get mistaken for an in-flight retry and loop forever below.
  const bothSucceeded = homeQuery.isSuccess && awayQuery.isSuccess
  const stats = bothSucceeded ? normalizeSeasonStats(homeQuery.data, awayQuery.data, year) : []
  const stillWorking = !bothSucceeded && (homeQuery.isPending || homeQuery.isFetching || awayQuery.isPending || awayQuery.isFetching)

  return {
    stats,
    isLoading: stats.length === 0 && stillWorking,
    isError: stats.length === 0 && !stillWorking && !bothSucceeded && (homeQuery.isError || awayQuery.isError),
  }
}
