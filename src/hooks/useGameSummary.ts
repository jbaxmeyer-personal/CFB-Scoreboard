import { useQuery } from '@tanstack/react-query'
import { fetchGameSummary, normalizeBoxScore } from '../lib/espn'
import type { GameBoxScore } from '../types/game'

export interface GameSummaryResult {
  boxScore?: GameBoxScore
  isLoading: boolean
  isError: boolean
}

/** Fetches the per-game box score — only meaningful for a live/final game,
 * and only called while that one game's detail view is actually mounted
 * (see ExpandedGame), so this never fires for every game in a list. */
export function useGameSummary(eventId: string, homeTeamId: string, awayTeamId: string): GameSummaryResult {
  const query = useQuery({
    queryKey: ['gameSummary', eventId],
    queryFn: () => fetchGameSummary(eventId),
    staleTime: 30_000,
  })

  return {
    boxScore: query.data ? normalizeBoxScore(query.data, homeTeamId, awayTeamId) : undefined,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
