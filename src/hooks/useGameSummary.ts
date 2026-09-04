import { useQuery } from '@tanstack/react-query'
import {
  boxScoreFromCoreStats,
  describeCoreStats,
  fetchCorePlays,
  fetchCoreTeamStats,
  fetchGameSummary,
  normalizeBoxScore,
  normalizeCorePlays,
  normalizePlays,
  summaryDiagnostics,
} from '../lib/espn'
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

function hasBoxScoreContent(boxScore: GameBoxScore | undefined): boolean {
  if (!boxScore) return false
  return boxScore.teamStats.length > 0 || boxScore.homeLeaders.length > 0 || boxScore.awayLeaders.length > 0
}

/** Fetches the per-game summary (box score + play-by-play) — only
 * meaningful for a live/final game, and only called while that one game's
 * detail view is actually mounted (see ExpandedGame), so this never fires
 * for every game in a list.
 *
 * When the summary comes back empty — which a real game was confirmed to do,
 * returning every container present and with nothing in it — this falls back
 * to ESPN's core API, a different backing store. Those requests are gated on
 * the summary actually being empty, so a normal game never makes them. */
export function useGameSummary(eventId: string, home: Team, away: Team, isLive: boolean, enabled = true): GameSummaryResult {
  const query = useQuery({
    queryKey: ['gameSummary', eventId],
    queryFn: () => fetchGameSummary(eventId),
    enabled,
    staleTime: 30_000,
    // A final game's summary is done changing; only keep polling while the
    // game is actually in progress.
    refetchInterval: isLive ? 20_000 : false,
  })

  const summaryBoxScore = query.data ? normalizeBoxScore(query.data, home, away) : undefined
  const summaryPlays = query.data ? normalizePlays(query.data) : []

  // Only reached for once the summary has resolved and produced nothing.
  const summaryResolved = enabled && query.data !== undefined
  const needsCoreStats = summaryResolved && !hasBoxScoreContent(summaryBoxScore)
  const needsCorePlays = summaryResolved && summaryPlays.length === 0

  const coreHome = useQuery({
    queryKey: ['coreTeamStats', eventId, home.id],
    queryFn: () => fetchCoreTeamStats(eventId, home.id),
    enabled: needsCoreStats,
    staleTime: 30_000,
    refetchInterval: isLive ? 30_000 : false,
  })
  const coreAway = useQuery({
    queryKey: ['coreTeamStats', eventId, away.id],
    queryFn: () => fetchCoreTeamStats(eventId, away.id),
    enabled: needsCoreStats,
    staleTime: 30_000,
    refetchInterval: isLive ? 30_000 : false,
  })
  const corePlays = useQuery({
    queryKey: ['corePlays', eventId],
    queryFn: () => fetchCorePlays(eventId),
    enabled: needsCorePlays,
    staleTime: 30_000,
    refetchInterval: isLive ? 30_000 : false,
  })

  const coreBoxScore =
    needsCoreStats && query.data && (coreHome.data || coreAway.data)
      ? boxScoreFromCoreStats(coreHome.data, coreAway.data, query.data, home.id, away.id)
      : undefined

  const boxScore = hasBoxScoreContent(summaryBoxScore)
    ? summaryBoxScore
    : hasBoxScoreContent(coreBoxScore)
      ? coreBoxScore
      : summaryBoxScore
  const plays = summaryPlays.length > 0 ? summaryPlays : normalizeCorePlays(corePlays.data)

  const diagnostics = query.data
    ? {
        ...summaryDiagnostics(query.data, eventId, home, away),
        coreStats: coreHome.isError || coreAway.isError ? 'request failed (blocked?)' : describeCoreStats(coreHome.data ?? coreAway.data),
        corePlays: corePlays.isError ? 'request failed (blocked?)' : `${corePlays.data?.items?.length ?? 0} items`,
      }
    : undefined

  return {
    boxScore,
    plays,
    // The core fallbacks are gated behind the summary, so a pending core
    // request is still "loading" from the panel's point of view.
    isLoading: query.isLoading || coreHome.isLoading || coreAway.isLoading || corePlays.isLoading,
    isError: query.isError,
    diagnostics,
    refetch: () => {
      void query.refetch()
      void coreHome.refetch()
      void coreAway.refetch()
      void corePlays.refetch()
    },
  }
}
