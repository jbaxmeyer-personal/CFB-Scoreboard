import { useQuery } from '@tanstack/react-query'
import { fetchGameSummary, normalizeBoxScore, normalizePlays, summaryHasPlayByPlay } from '../lib/espn'
import type { GameBoxScore, GamePlay } from '../types/game'

export interface GameSummaryResult {
  boxScore?: GameBoxScore
  plays: GamePlay[]
  isLoading: boolean
  isError: boolean
  /** False only when ESPN explicitly says it has no play-by-play feed for
   * this game (playByPlaySource: "none") — the difference between "ESPN
   * isn't covering this game" and "we couldn't load it", which is what the
   * UI needs to explain an empty panel instead of rendering nothing. */
  hasPlayByPlay: boolean
  /** Lets the empty/error state offer a retry without a full page reload. */
  refetch: () => void
}

/** Fetches the per-game summary (box score + play-by-play) — only
 * meaningful for a live/final game, and only called while that one game's
 * detail view is actually mounted (see ExpandedGame), so this never fires
 * for every game in a list. */
export function useGameSummary(
  eventId: string,
  homeTeamId: string,
  awayTeamId: string,
  isLive: boolean,
  enabled = true,
): GameSummaryResult {
  const query = useQuery({
    queryKey: ['gameSummary', eventId],
    queryFn: () => fetchGameSummary(eventId),
    enabled,
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
    hasPlayByPlay: query.data ? summaryHasPlayByPlay(query.data) : true,
    refetch: () => void query.refetch(),
  }
}
