import type { Game } from '../types/game'
import type { Conference } from '../data/conferences'

export interface GameFilters {
  /** Only games with at least one AP Top 25 team. */
  rankedOnly: boolean
  /** Only games involving a team from one of these conferences. Empty for
   * all of them, which is the same thing said two ways — a list naming
   * every conference would filter nothing either. */
  conferenceIds: string[]
}

export const NO_FILTERS: GameFilters = { rankedOnly: false, conferenceIds: [] }

export function hasActiveFilters(filters: GameFilters): boolean {
  return filters.rankedOnly || filters.conferenceIds.length > 0
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

/** Either team in any of the chosen conferences, so a conference team's
 * non-conference games still show — you follow a team's season, not only
 * its league fixtures.
 *
 * Several conferences are a union: picking the SEC and the Big Ten wants
 * both slates, not the handful of games where one plays the other. */
function isConferenceGame(game: Game, conferences: Conference[]): boolean {
  return conferences.some((c) => c.teamIds.has(game.home.id) || c.teamIds.has(game.away.id))
}

/**
 * The two filters combine with AND: Top 25 *and* a conference gives that
 * conference's ranked games. Within the conference filter it's OR, because
 * that's what ticking two of them means. So Top 25 with the SEC and the Big
 * Ten is the ranked games of either.
 *
 * Conferences chosen but none of them resolvable (membership hasn't loaded,
 * or every id is stale) matches nothing rather than everything, so a filter
 * that is on can never silently behave as though it were off.
 */
export function filterGames(games: Game[], filters: GameFilters, conferences: Conference[]): Game[] {
  if (!hasActiveFilters(filters)) return games
  return games.filter((game) => {
    if (filters.rankedOnly && !isRankedGame(game)) return false
    if (filters.conferenceIds.length > 0 && !isConferenceGame(game, conferences)) return false
    return true
  })
}

/** Short summary of what's on, for the empty state. */
export function describeFilters(filters: GameFilters, conferences: Conference[]): string {
  const parts: string[] = []
  if (filters.rankedOnly) parts.push('Top 25')
  if (filters.conferenceIds.length > 0) {
    parts.push(conferences.length > 0 ? conferences.map((c) => c.shortName).join(' / ') : 'those conferences')
  }
  return parts.join(' + ')
}
