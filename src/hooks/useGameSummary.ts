import { useQuery } from '@tanstack/react-query'
import { fetchGameSummary, normalizeBoxScore, normalizePlays } from '../lib/espn'
import type { GameBoxScore, GamePlay } from '../types/game'

export interface GameSummaryResult {
  boxScore?: GameBoxScore
  plays: GamePlay[]
  isLoading: boolean
  isError: boolean
}

/** Fetches the per-game summary (box score + play-by-play) — only
 * meaningful for a live/final game, and only called while that one game's
 * detail view is actually mounted (see ExpandedGame), so this never fires
 * for every game in a list. Box score and play-by-play containers both call
 * this with the same query key, so it's a single shared request. */
export function useGameSummary(eventId: string, homeTeamId: string, awayTeamId: string, isLive: boolean): GameSummaryResult {
  const query = useQuery({
    queryKey: ['gameSummary', eventId],
    queryFn: () => fetchGameSummary(eventId),
    staleTime: 30_000,
    // A final game's summary is done changing; only keep polling while the
    // game is actually in progress.
    refetchInterval: isLive ? 20_000 : false,
  })

  return {
    boxScore: query.data ? normalizeBoxScore(query.data, homeTeamId, awayTeamId) : undefined,
    plays: query.data ? normalizePlays(query.data) : [],
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
