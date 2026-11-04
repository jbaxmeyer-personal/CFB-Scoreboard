import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { fetchStandings, recordsFromStandings, type TeamRecord } from '../lib/standings'
import {
  coreRankMap,
  describeRankSource,
  fetchCoreTeamSeasonStats,
  fetchFbsTeamIds,
  fetchTeamSchedule,
  fetchTeamSeasonStats,
  normalizeTeamProfile,
  normalizeTeamSchedule,
  teamRecordFromSchedule,
  describeScheduleRecords,
} from '../lib/espn'
import type { TeamProfileStat } from '../lib/espn'
import type { Game } from '../types/game'

export interface TeamPageResult {
  stats: TeamProfileStat[]
  schedule: Game[]
  statsLoading: boolean
  scheduleLoading: boolean
  statsError: boolean
  scheduleError: boolean
  /** What the core rank source returned, shown only when the rank column
   * came up empty — so a missing rank reports itself rather than being
   * guessed at again. */
  rankSource: string
  /** False for an FCS team, where ranks are deliberately withheld rather
   * than missing — the UI shouldn't then report a rank source. */
  ranksApply: boolean
  /** The team's record now, from its own schedule response — not the one
   * carried by whatever opened the page, which on a game in October is the
   * record as of that game. */
  record?: string
  /** Set only when the schedule arrived with no readable opponent record
   * on it, and then names the fields ESPN did send. */
  recordFieldsSeen?: string
  /** Every team's record now, keyed by team id. The schedule's own records
   * are the opponent's record *as of that game*, which does not exist for
   * a game that has not been played — so the rows for those fill in from
   * here. */
  currentRecords: Map<string, TeamRecord>
}

/** Everything a team's page needs: its season profile and its full
 * schedule. Two independent requests so a slow or failed schedule doesn't
 * hold up the stats, or the other way round — each section reports its own
 * state. Both are cached for an hour; neither changes within a session
 * except when a game finishes, which the scoreboard already polls for. */
export function useTeamPage(teamId: string, year: number): TeamPageResult {
  const statsQuery = useQuery({
    queryKey: ['teamSeasonStats', teamId, year],
    queryFn: () => fetchTeamSeasonStats(teamId, year),
    staleTime: 60 * 60_000,
  })

  // FBS membership decides whether ranks apply at all. Cached for the day:
  // a season's membership doesn't change, and this is shared across every
  // team page rather than re-fetched per team.
  const fbsQuery = useQuery({
    queryKey: ['fbsTeamIds', year],
    queryFn: () => fetchFbsTeamIds(year),
    staleTime: 24 * 60 * 60_000,
    retry: 1,
  })

  // Rank source. The site endpoint carries ranks only on its opponent
  // categories, so offensive and turnover rows need this; it's a separate
  // query so a failure here leaves the stats themselves intact.
  const coreQuery = useQuery({
    queryKey: ['coreTeamSeasonStats', teamId, year],
    queryFn: () => fetchCoreTeamSeasonStats(teamId, year),
    staleTime: 60 * 60_000,
    retry: 1,
  })

  const scheduleQuery = useQuery({
    queryKey: ['teamSchedule', teamId, year],
    queryFn: () => fetchTeamSchedule(teamId, year),
    staleTime: 60 * 60_000,
  })

  // The same query key the Standings screen uses, so this is free for
  // anyone who has opened that tab and costs one shared request for anyone
  // who hasn't. A failure here only leaves the unplayed rows as they were.
  const standingsQuery = useQuery({
    queryKey: ['standings', year],
    queryFn: () => fetchStandings(year),
    staleTime: 60 * 60_000,
    retry: 1,
  })

  // Only withhold ranks when membership is actually known and excludes this
  // team. If the lookup fails we can't tell, and hiding real FBS ranks on a
  // network hiccup is worse than the alternative.
  const ranksApply = !fbsQuery.data || fbsQuery.data.has(teamId)
  const coreRanks = coreRankMap(coreQuery.data)
  const stats = statsQuery.data ? normalizeTeamProfile(statsQuery.data, year, coreRanks, ranksApply) : []
  const schedule = normalizeTeamSchedule(scheduleQuery.data)
  const currentRecords = useMemo(
    () => (standingsQuery.data ? recordsFromStandings(standingsQuery.data) : new Map<string, TeamRecord>()),
    [standingsQuery.data],
  )
  const noOpponentRecords = schedule.length > 0 && !schedule.some((g) => g.home.record || g.away.record)

  return {
    currentRecords,
    record: teamRecordFromSchedule(scheduleQuery.data),
    recordFieldsSeen: noOpponentRecords ? describeScheduleRecords(scheduleQuery.data) : undefined,
    stats,
    schedule,
    statsLoading: statsQuery.isLoading,
    scheduleLoading: scheduleQuery.isLoading,
    statsError: statsQuery.isError,
    scheduleError: scheduleQuery.isError,
    rankSource: describeRankSource(coreQuery.data, coreQuery.isError ? (coreQuery.error?.message ?? 'request failed') : undefined),
    ranksApply,
  }
}
