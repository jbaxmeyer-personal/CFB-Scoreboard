import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchTeamSchedule, normalizeTeamSchedule } from '../lib/espn'
import type { TeamProfileStat } from '../lib/espn'
import { seasonDefenseRows } from '../lib/seasonDefense'
import { useTeamGameSummaries } from './useTeamGameSummaries'

/**
 * One team's defensive season rows, wherever they're needed.
 *
 * Both screens that show season stats were built to read defence from
 * `results.opponent`, which does not exist, so both silently showed no
 * Defense block at all. Fixing one and not the other is how the same bug
 * gets reported twice, so the derivation lives here and each screen calls
 * this rather than reaching for the feed itself.
 *
 * Takes the schedule if the caller already has it — the team page does —
 * and fetches it otherwise, which the pre-game comparison needs since it
 * knows only the two teams.
 */
export function useSeasonDefense(teamId: string, year: number, enabled = true): TeamProfileStat[] {
  const scheduleQuery = useQuery({
    queryKey: ['teamSchedule', teamId, year],
    queryFn: () => fetchTeamSchedule(teamId, year),
    enabled,
    staleTime: 30 * 60_000,
  })

  const schedule = useMemo(() => normalizeTeamSchedule(scheduleQuery.data), [scheduleQuery.data])
  const { games } = useTeamGameSummaries(schedule, enabled)
  return useMemo(() => seasonDefenseRows(teamId, games), [teamId, games])
}
