import { useQuery } from '@tanstack/react-query'
import { fetchConferences, seasonYearFromDate, type Conference } from '../lib/espn'

export interface ConferencesResult {
  conferences: Conference[]
  byId: Map<string, Conference>
  isLoading: boolean
  isError: boolean
}

/**
 * The FBS conferences and their membership.
 *
 * `enabled` is what keeps this honest about its cost: building the list
 * takes one request for the conference list plus one per conference, so it
 * only runs once someone actually opens the conference filter. Nobody who
 * never touches it pays for it.
 *
 * Cached for the session with a long staleTime — conference membership
 * changes between seasons, not between refreshes — and never refetched on
 * an interval.
 */
export function useConferences(enabled: boolean): ConferencesResult {
  const year = seasonYearFromDate(new Date().toISOString())
  const query = useQuery({
    queryKey: ['conferences', year],
    queryFn: () => fetchConferences(year),
    enabled,
    staleTime: 24 * 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: 1,
  })

  const conferences = query.data ?? []
  return {
    conferences,
    byId: new Map(conferences.map((c) => [c.id, c])),
    isLoading: query.isPending && query.isFetching,
    isError: query.isError,
  }
}
