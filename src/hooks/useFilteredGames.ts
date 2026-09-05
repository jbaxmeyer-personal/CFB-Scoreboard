import { useMemo } from 'react'
import type { Game } from '../types/game'
import { useViewState } from '../context/ViewStateContext'
import { useConferences } from './useConferences'
import { describeFilters, filterGames, hasActiveFilters } from '../lib/gameFilters'

export interface FilteredGamesResult {
  games: Game[]
  filtersActive: boolean
  /** What's on, for the empty state: "Top 25", "SEC", "Top 25 + SEC". */
  filterSummary: string
}

/**
 * Applies the shared Top 25 / conference filters to a screen's games.
 *
 * Both screens call this on their full list, before grouping into days, so
 * the day strip and the games agree: a day whose only games are filtered
 * out doesn't offer a tab that leads to an empty screen.
 *
 * The conference list is fetched only when a conference filter is actually
 * set — a screen with no conference filter never pays for it.
 */
export function useFilteredGames(games: Game[]): FilteredGamesResult {
  const { filters } = useViewState()
  const { byId } = useConferences(filters.conferenceId !== null)
  const conference = filters.conferenceId ? byId.get(filters.conferenceId) : undefined

  return useMemo(
    () => ({
      games: filterGames(games, filters, conference),
      filtersActive: hasActiveFilters(filters),
      filterSummary: describeFilters(filters, conference),
    }),
    [games, filters, conference],
  )
}
