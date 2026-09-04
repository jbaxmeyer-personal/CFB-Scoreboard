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
import type { Game, GameBoxScore, GamePlay } from '../types/game'

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
export function useGameSummary(game: Game, isLive: boolean, enabled = true): GameSummaryResult {
  const eventId = game.id
  // Not assumed equal to the event id — that assumption is what the core
  // fallback's paths hang on, and a wrong competition id 404s every one.
  const competitionId = game.competitionId || game.id
  const home = game.home
  const away = game.away
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

  // One request set for both teams: the competitors collection they're both
  // resolved from is shared, so fetching it twice would be waste.
  const coreStats = useQuery({
    queryKey: ['coreTeamStats', eventId, competitionId, home.id, away.id],
    queryFn: () => fetchCoreTeamStats(eventId, competitionId, home.id, away.id),
    enabled: needsCoreStats,
    staleTime: 30_000,
    refetchInterval: isLive ? 30_000 : false,
  })
  const corePlays = useQuery({
    queryKey: ['corePlays', eventId, competitionId],
    queryFn: () => fetchCorePlays(eventId, competitionId),
    enabled: needsCorePlays,
    staleTime: 30_000,
    refetchInterval: isLive ? 30_000 : false,
  })

  const coreBoxScore =
    needsCoreStats && query.data && (coreStats.data?.home || coreStats.data?.away)
      ? boxScoreFromCoreStats(coreStats.data.home, coreStats.data.away, query.data, home.id, away.id)
      : undefined

  const boxScore = hasBoxScoreContent(summaryBoxScore)
    ? summaryBoxScore
    : hasBoxScoreContent(coreBoxScore)
      ? coreBoxScore
      : summaryBoxScore
  const plays = summaryPlays.length > 0 ? summaryPlays : normalizeCorePlays(corePlays.data)

  // A CORS block and an HTTP 404 both land in `isError`, and collapsing them
  // into one guess is what made the previous label ("blocked?") useless: a
  // browser-blocked request rejects with a TypeError whose message is
  // "Failed to fetch", while a request that reached ESPN and was refused
  // carries the status code the fetch helpers put in the error. Report the
  // message itself so those two are distinguishable, and never let a
  // not-yet-fetched query read as an empty one.
  function describeQuery(
    q: { isError: boolean; error: Error | null; isSuccess: boolean; isFetching: boolean },
    enabledForQuery: boolean,
    describeSuccess: () => string,
  ): string {
    if (q.isError) return q.error?.message ?? 'request failed'
    if (q.isSuccess) return describeSuccess()
    if (!enabledForQuery) return '(not needed)'
    return q.isFetching ? '(fetching…)' : '(not fetched)'
  }

  const diagnostics = query.data
    ? {
        ...summaryDiagnostics(query.data, eventId, competitionId, home, away),
        coreStats: describeQuery(coreStats, needsCoreStats, () => describeCoreStats(coreStats.data?.home ?? coreStats.data?.away)),
        coreCompetitors: describeQuery(coreStats, needsCoreStats, () => coreStats.data?.competitorSummary ?? '?'),
        corePlays: describeQuery(corePlays, needsCorePlays, () => `${corePlays.data?.items?.length ?? 0} items`),
      }
    : undefined

  return {
    boxScore,
    plays,
    // The core fallbacks are gated behind the summary, so a pending core
    // request is still "loading" from the panel's point of view.
    isLoading: query.isLoading || coreStats.isLoading || corePlays.isLoading,
    isError: query.isError,
    diagnostics,
    refetch: () => {
      void query.refetch()
      void coreStats.refetch()
      void corePlays.refetch()
    },
  }
}
