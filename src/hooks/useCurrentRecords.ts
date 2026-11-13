import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { seasonYearFromDate } from '../lib/espn'
import { fetchStandings, recordsFromStandings, type TeamRecord } from '../lib/standings'

/**
 * Every team's record now, keyed by team id.
 *
 * The records ESPN attaches to a game are that team's record *as of that
 * game* — and for a game not yet played there are none at all, which is
 * why an upcoming matchup opened from a team's schedule had no records
 * under either crest. The standings feed is the only source that answers
 * "what is their record today" for a team that has not played yet.
 *
 * One shared query key with the Standings screen and the team page, so
 * this is a single request for the whole app however many screens ask.
 * A failure leaves the map empty and callers fall back to whatever the
 * game itself carried.
 */
export function useCurrentRecords(year = seasonYearFromDate(new Date().toISOString())): (teamId: string) => string | undefined {
  const { data } = useQuery({
    queryKey: ['standings', year],
    queryFn: () => fetchStandings(year),
    staleTime: 60 * 60_000,
    retry: 1,
  })

  const records = useMemo(
    () => (data ? recordsFromStandings(data) : new Map<string, TeamRecord>()),
    [data],
  )

  return (teamId: string) => records.get(teamId)?.overall
}
