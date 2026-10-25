import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useSettings } from '../context/SettingsContext'
import { seasonYearFromDate } from '../lib/espn'
import {
  buildStandings,
  buildTop25,
  describeStandingsStats,
  fetchStandings,
  recordsFromStandings,
  type StandingsData,
} from '../lib/standings'
import { fetchRankings, rankingsFrom, NO_RANKINGS } from '../lib/rankings'
import type { SpoilerSettings } from '../lib/spoilers'

const NO_SPOILERS: SpoilerSettings = { globalEnabled: false, protectedGameIds: [], protectedTeamIds: [] }

/**
 * Conference standings and the Top 25 for the current season.
 *
 * The table itself is static, so this never gates the screen on a request:
 * `conferences` is always every conference with every team in it, and a
 * failed or unrecognized response only costs the records column. `note`
 * carries the reason in that case, the way the empty box-score panel names
 * what it asked for rather than showing nothing.
 *
 * Two requests, independent on purpose. Standings fills the record columns;
 * the poll fills the Top 25 section and the rank badges. Either can fail
 * without taking the other down — no ranks means no badges and no Top 25
 * section, and the conference tables carry on.
 *
 * `reveal` drops the no-spoilers filter for this render, which is what the
 * screen's one "Show records" button does.
 *
 * An hour's staleTime. A record changes when a game ends and a poll changes
 * once a week; the live scoreboard is what you watch for the former.
 */
export function useStandings(reveal = false): StandingsData & { isLoading: boolean } {
  const { settings } = useSettings()
  const year = seasonYearFromDate(new Date().toISOString())

  const standings = useQuery({
    queryKey: ['standings', year],
    queryFn: () => fetchStandings(year),
    staleTime: 60 * 60_000,
    retry: 1,
  })

  const polls = useQuery({
    queryKey: ['rankings', year],
    queryFn: () => fetchRankings(),
    staleTime: 60 * 60_000,
    retry: 1,
  })

  const records = useMemo(() => (standings.data ? recordsFromStandings(standings.data) : new Map()), [standings.data])
  const rankings = useMemo(() => (polls.data ? rankingsFrom(polls.data) : NO_RANKINGS), [polls.data])

  // Revealing is the whole no-spoilers table, not a row at a time: the
  // button is only offered because you came here to read records.
  const spoilers = reveal ? NO_SPOILERS : settings.spoilers
  const conferences = useMemo(
    () => buildStandings(records, spoilers, { ranks: rankings.byTeamId }),
    [records, spoilers, rankings],
  )
  const top25 = useMemo(() => buildTop25(rankings.byTeamId, records, spoilers), [rankings, records, spoilers])

  const note = useMemo(() => {
    if (standings.error) {
      const reason = standings.error instanceof Error ? standings.error.message : 'request failed'
      return `Couldn't load records (${reason}). Conferences and teams are shown without them.`
    }
    if (standings.data && records.size === 0) {
      return 'ESPN answered, but no records could be read from the response. Conferences and teams are shown without them.'
    }
    // The case this screen shipped with: overall records arrived and
    // conference ones didn't. Naming the stats ESPN actually sent is what
    // makes that fixable from a phone, since the payload can't be opened
    // from the build environment.
    if (records.size > 0 && ![...records.values()].some((r) => r.conference !== undefined)) {
      const seen = describeStandingsStats(standings.data)
      return `No conference records in ESPN's response — showing overall only.${seen ? ` Stats it sent: ${seen}.` : ''}`
    }
    return undefined
  }, [standings.error, standings.data, records])

  return {
    conferences,
    top25,
    pollName: rankings.pollName,
    teamsWithRecords: records.size,
    note,
    isLoading: standings.isLoading,
  }
}
