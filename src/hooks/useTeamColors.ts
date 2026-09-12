import { useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TEAM_COLORS_MAX_AGE_MS,
  fetchTeamColors,
  readStoredTeamColors,
  writeStoredTeamColors,
  type TeamColors,
} from '../lib/teamColors'

/**
 * Looks up a team's colours, from one request shared by the whole app.
 *
 * Seeded from local storage so the first render after a launch already has
 * them — `initialDataUpdatedAt` is when they were actually stored, not now,
 * so a week-old copy still counts as stale and is refreshed in the
 * background while the old one keeps being used.
 *
 * Returns undefined for a team it doesn't know, which is what callers fall
 * back from. A failed request is not retried hard: nothing here is on the
 * critical path.
 */
export function useTeamColors(): (teamId: string | undefined) => TeamColors | undefined {
  const stored = readStoredTeamColors()

  const { data } = useQuery({
    queryKey: ['teamColors'],
    queryFn: fetchTeamColors,
    staleTime: TEAM_COLORS_MAX_AGE_MS,
    gcTime: TEAM_COLORS_MAX_AGE_MS,
    retry: 1,
    initialData: stored?.colors,
    initialDataUpdatedAt: stored?.fetchedAt,
  })

  useEffect(() => {
    if (data) writeStoredTeamColors(data)
  }, [data])

  return useCallback((teamId: string | undefined) => (teamId ? data?.[teamId] : undefined), [data])
}
