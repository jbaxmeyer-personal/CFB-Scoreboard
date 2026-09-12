import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchTeamSchedule, normalizeTeamSchedule } from '../lib/espn'
import type { TeamProfileStat } from '../lib/espn'
import { seasonDefenseRows } from '../lib/seasonDefense'
import { useTeamGameSummaries } from './useTeamGameSummaries'

export interface SeasonDefenseResult {
  rows: TeamProfileStat[]
  /**
   * The team's own colour, for the comparison bars.
   *
   * The scoreboard's competitors arrive without one — measured on-device:
   * every bar drew in the same neutral because neither side had a colour to
   * use. A finished game's box score carries it, which is what brought the
   * colours back on live and past games; a fixture has no box score, so the
   * colour comes from the two things this hook already loads. No extra
   * request either way: both are queries it is making regardless.
   */
  color?: string
}

/**
 * One team's defensive season rows and its colour, wherever they're needed.
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
export function useSeasonDefense(teamId: string, year: number, enabled = true): SeasonDefenseResult {
  const scheduleQuery = useQuery({
    queryKey: ['teamSchedule', teamId, year],
    queryFn: () => fetchTeamSchedule(teamId, year),
    enabled,
    staleTime: 30 * 60_000,
  })

  const schedule = useMemo(() => normalizeTeamSchedule(scheduleQuery.data), [scheduleQuery.data])
  const { games } = useTeamGameSummaries(schedule, enabled)
  const rows = useMemo(() => seasonDefenseRows(teamId, games), [teamId, games])

  // The schedule's own team record first, then any box score that has come
  // back — a team with no games played yet has only the former, and a
  // response without either simply leaves the bar on its neutral.
  const color = useMemo(() => {
    const fromSchedule = scheduleQuery.data?.team?.color
    if (fromSchedule) return `#${fromSchedule}`
    for (const { summary } of games) {
      const entry = summary?.boxscore?.teams?.find((t) => t.team.id === teamId)
      if (entry?.team.color) return `#${entry.team.color}`
    }
    return undefined
  }, [scheduleQuery.data, games, teamId])

  return { rows, color }
}
