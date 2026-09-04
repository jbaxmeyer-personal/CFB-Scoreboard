import { useQuery } from '@tanstack/react-query'
import { fetchGameSummary, normalizeBoxScore, normalizePlays, summaryDiagnostics } from '../lib/espn'
import type { SummaryDiagnostics } from '../lib/espn'
import type { GameBoxScore, GamePlay, Team } from '../types/game'

export interface GameSummaryResult {
  boxScore?: GameBoxScore
  plays: GamePlay[]
  isLoading: boolean
  isError: boolean
  /** What the response actually contained, surfaced on demand when a panel
   * comes up empty — reported rather than guessed at. */
  diagnostics?: SummaryDiagnostics
  /** Lets the empty/error state offer a retry without a full page reload. */
  refetch: () => void
}

/** Fetches the per-game summary (box score + play-by-play) — only
 * meaningful for a live/final game, and only called while that one game's
 * detail view is actually mounted (see ExpandedGame), so this never fires
 * for every game in a list. */
export function useGameSummary(
  eventId: string,
  home: Team,
  away: Team,
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
    boxScore: query.data ? normalizeBoxScore(query.data, home, away) : undefined,
    plays: query.data ? normalizePlays(query.data) : [],
    isLoading: query.isLoading,
    isError: query.isError,
    diagnostics: query.data ? summaryDiagnostics(query.data, eventId, home, away) : undefined,
    refetch: () => void query.refetch(),
  }
}
