import type { Game } from '../types/game'
import type { Conference } from './espn'

export interface GameFilters {
  /** Only games with at least one AP Top 25 team. */
  rankedOnly: boolean
  /** Only games involving a team from this conference, or null for all. */
  conferenceId: string | null
}

export const NO_FILTERS: GameFilters = { rankedOnly: false, conferenceId: null }

export function hasActiveFilters(filters: GameFilters): boolean {
  return filters.rankedOnly || filters.conferenceId !== null
}

/**
 * A ranked game is one with a Top 25 team on either side, not both.
 * "Top 25 games" in every scoreboard that offers it means the games worth
 * watching because a ranked team is in them — requiring both would drop
 * exactly the upsets that make the filter worth having.
 *
 * `rank` is already ESPN's curated AP rank, capped to 1-25 upstream, so a
 * rank being present is the whole test.
 */
function isRankedGame(game: Game): boolean {
  return game.home.rank !== undefined || game.away.rank !== undefined
}

/** Either team in the conference, so a conference team's non-conference
 * games still show — you follow a team's season, not only its league
 * fixtures. */
function isConferenceGame(game: Game, conference: Conference | undefined): boolean {
  if (!conference) return false
  return conference.teamIds.has(game.home.id) || conference.teamIds.has(game.away.id)
}

/**
 * Filters combine with AND: turning on Top 25 *and* a conference gives that
 * conference's ranked games, not the union. That is what stacked filters
 * mean everywhere else, and the union is reachable by just using one.
 *
 * An unresolved conference (its membership hasn't loaded, or the id is
 * stale) matches nothing rather than everything, so a filter that is on can
 * never silently behave as though it were off.
 */
export function filterGames(games: Game[], filters: GameFilters, conference: Conference | undefined): Game[] {
  if (!hasActiveFilters(filters)) return games
  return games.filter((game) => {
    if (filters.rankedOnly && !isRankedGame(game)) return false
    if (filters.conferenceId !== null && !isConferenceGame(game, conference)) return false
    return true
  })
}

/** Short summary of what's on, for the empty state. */
export function describeFilters(filters: GameFilters, conference: Conference | undefined): string {
  const parts: string[] = []
  if (filters.rankedOnly) parts.push('Top 25')
  if (filters.conferenceId !== null) parts.push(conference?.shortName ?? 'that conference')
  return parts.join(' + ')
}
