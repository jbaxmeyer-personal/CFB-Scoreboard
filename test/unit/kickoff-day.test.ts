/**
 * The day a game is filed under.
 *
 * ESPN's placeholder for a kickoff that has not been announced is midnight
 * Eastern on the day of the game. Midnight is the worst possible instant to
 * carry a date on: read anywhere west of Eastern it is still the evening
 * before. Notre Dame's schedule listed North Carolina, BYU and Syracuse —
 * all Saturdays — as Fridays.
 */
import { check, report } from '../helpers/check'
import { normalizeEvent } from '../../src/lib/espn'
import { formatDayChip, gameDayKey } from '../../src/lib/timezone'

const ND = { id: '87', abbreviation: 'ND', displayName: 'Notre Dame', shortDisplayName: 'Notre Dame', location: 'Notre Dame', name: 'x' }
const UNC = { id: '153', abbreviation: 'UNC', displayName: 'North Carolina', shortDisplayName: 'North Carolina', location: 'North Carolina', name: 'x' }
const SCHEDULED = { type: { id: '1', name: 'STATUS_SCHEDULED', state: 'pre', completed: false, description: 'Scheduled', detail: 'TBD', shortDetail: 'TBD' } }

const game = (date: string, timeValid?: boolean) =>
  normalizeEvent({
    id: '1', date, shortName: 'ND @ UNC', name: 'x',
    competitions: [{
      id: '1', date, status: SCHEDULED, ...(timeValid === undefined ? {} : { timeValid }),
      competitors: [
        { id: '153', homeAway: 'home', team: UNC },
        { id: '87', homeAway: 'away', team: ND },
      ],
    }],
  } as never)!

// Saturday 10 October 2026. Midnight Eastern that day is 04:00Z.
const PLACEHOLDER = '2026-10-10T04:00Z'
const tbd = game(PLACEHOLDER)
check('the placeholder is recognised as TBD', tbd.timeTBD, true)

// Every zone an American viewer might be in, plus two well outside.
for (const zone of [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Anchorage', 'Pacific/Honolulu', 'Europe/London', 'Europe/Berlin',
]) {
  check(`a TBD Saturday game reads Saturday in ${zone}`, formatDayChip(tbd.startDate, zone), 'Sat 10/10')
}
// The bug itself, kept as a check so the fixture cannot quietly stop
// reproducing it.
check('the raw placeholder really did read Friday in Central', formatDayChip(PLACEHOLDER, 'America/Chicago'), 'Fri 10/9')
check('and it groups under Saturday', gameDayKey(tbd, 'America/Chicago'), '2026-10-10')

const flagged = game('2026-10-10T07:00Z', false)
check('a timeValid:false game is TBD too', flagged.timeTBD, true)
check('and also reads Saturday in Central', formatDayChip(flagged.startDate, 'America/Chicago'), 'Sat 10/10')

// A real kickoff must not be touched — including one that legitimately
// falls after midnight Eastern, which is genuinely the next day out east.
const REAL = '2026-10-10T23:30Z'
const real = game(REAL, true)
check('a game with a real kickoff is not TBD', real.timeTBD, false)
check('and its timestamp is left exactly as ESPN sent it', real.startDate, REAL)
const late = game('2026-10-11T02:30Z', true)
check('a late kickoff is untouched as well', [late.timeTBD, late.startDate], [false, '2026-10-11T02:30Z'])
check('and is still honestly Sunday in Berlin', formatDayChip(late.startDate, 'Europe/Berlin'), 'Sun 10/11')

report()
