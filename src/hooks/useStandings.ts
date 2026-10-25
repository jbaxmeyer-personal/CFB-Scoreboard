import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useSettings } from '../context/SettingsContext'
import { seasonYearFromDate } from '../lib/espn'
import { buildStandings, fetchStandings, recordsFromStandings, type StandingsData } from '../lib/standings'
import type { SpoilerSettings } from '../lib/spoilers'

const NO_SPOILERS: SpoilerSettings = { globalEnabled: false, protectedGameIds: [], protectedTeamIds: [] }

/**
 * Conference standings for the current season.
 *
 * The table itself is static, so this never gates the screen on a request:
 * `conferences` is always every conference with every team in it, and a
 * failed or unrecognized response only costs the records column. `note`
 * carries the reason in that case, the way the empty box-score panel names
 * what it asked for rather than showing nothing.
 *
 * `reveal` drops the no-spoilers filter for this render, which is what the
 * screen's one "Show records" button does.
 *
 * An hour's staleTime. A record changes when a game ends, and the live
 * scoreboard is what you watch for that — a standings table that re-fetches
 * every thirty seconds would be all cost and no news.
 */
export function useStandings(reveal = false): StandingsData & { isLoading: boolean; refetch: () => void } {
  const { settings } = useSettings()
  const year = seasonYearFromDate(new Date().toISOString())

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['standings', year],
    queryFn: () => fetchStandings(year),
    staleTime: 60 * 60_000,
    retry: 1,
  })

  const records = useMemo(() => (data ? recordsFromStandings(data) : new Map()), [data])
  // Revealing is the whole no-spoilers table, not a row at a time: the
  // button is only offered because you came here to read records.
  const spoilers = reveal ? NO_SPOILERS : settings.spoilers
  const conferences = useMemo(() => buildStandings(records, spoilers), [records, spoilers])

  const note = error
    ? `Couldn't load records (${error instanceof Error ? error.message : 'request failed'}). Conferences and teams are shown without them.`
    : data && records.size === 0
      ? 'ESPN answered, but no records could be read from the response. Conferences and teams are shown without them.'
      : undefined

  return { conferences, teamsWithRecords: records.size, note, isLoading, refetch }
}
