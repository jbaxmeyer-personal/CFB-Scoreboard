/**
 * Records on a team's page: the opponents' on each schedule row, and the
 * team's own in the header.
 *
 * Neither was showing. The schedule endpoint spells a record's value
 * `displayValue` where the scoreboard spells it `summary` — the third ESPN
 * field to come in two spellings, after scores and the `record`/`records`
 * key itself — so every opponent came back with no record at all, and a
 * team opened from one of those games carried none into its page header.
 */
import { check, report } from '../helpers/check'
import { overallRecordFrom, teamRecordFromSchedule, describeScheduleRecords, normalizeTeamSchedule } from '../../src/lib/espn'

// The shape the scoreboard sends.
check('a summary is read', overallRecordFrom([{ type: 'total', summary: '8-1' }]), '8-1')

// The shape the team-schedule endpoint sends, and the reported bug.
check('so is a displayValue', overallRecordFrom([{ type: 'total', displayValue: '8-1' }]), '8-1')

// Named, wherever it sits in the array.
check(
  'the total is picked by name, not by position',
  overallRecordFrom([
    { type: 'home', displayValue: '5-0' },
    { type: 'total', displayValue: '8-1' },
  ]),
  '8-1',
)

// A split is never promoted to "the record" — the user was explicit that
// home and away splits are not wanted, and a home record shown as a season
// record is worse than no record.
check('a home record alone is not the record', overallRecordFrom([{ type: 'home', displayValue: '5-0' }]), undefined)
check('nor is a conference one', overallRecordFrom([{ type: 'vsConf', displayValue: '5-1' }]), undefined)

// An unnamed entry is usable, since some payloads carry only one.
check('an unnamed entry is used', overallRecordFrom([{ displayValue: '8-1' }]), '8-1')

// Anything not won-lost shaped is not a record.
check('a streak is not a record', overallRecordFrom([{ type: 'streak', displayValue: 'W4' }]), undefined)
check('nor are points', overallRecordFrom([{ type: 'total', displayValue: '412' }]), undefined)
check('and nothing at all is undefined', overallRecordFrom(undefined), undefined)
check('as is an empty list', overallRecordFrom([]), undefined)

// --- Through the whole schedule normalizer ------------------------------
const scheduleResponse = {
  team: { id: '84', displayName: 'Indiana Hoosiers', record: { items: [{ type: 'total', displayValue: '8-1' }] } },
  events: [
    {
      id: 'g1',
      date: '2026-10-10T19:00Z',
      shortName: 'IU @ NEB',
      status: { type: { id: '3', name: 'STATUS_FINAL', state: 'post', completed: true, description: 'Final', detail: 'Final', shortDetail: 'Final' } },
      competitions: [
        {
          id: 'g1',
          date: '2026-10-10T19:00Z',
          status: { type: { id: '3', name: 'STATUS_FINAL', state: 'post', completed: true, description: 'Final', detail: 'Final', shortDetail: 'Final' } },
          competitors: [
            {
              id: 'h', homeAway: 'home', score: { value: 17, displayValue: '17' },
              team: { id: '158', location: 'Nebraska', abbreviation: 'NEB', displayName: 'Nebraska Cornhuskers', shortDisplayName: 'Nebraska' },
              record: [{ type: 'total', displayValue: '5-1' }],
            },
            {
              id: 'a', homeAway: 'away', score: { value: 20, displayValue: '20' },
              team: { id: '84', location: 'Indiana', abbreviation: 'IU', displayName: 'Indiana Hoosiers', shortDisplayName: 'Indiana' },
              record: [{ type: 'total', displayValue: '6-0' }],
            },
          ],
        },
      ],
    },
  ],
} as unknown as Parameters<typeof normalizeTeamSchedule>[0]

const games = normalizeTeamSchedule(scheduleResponse)
check('the schedule normalizes to one game', games.length, 1)
check("the opponent's record is on the row", games[0].home.record, '5-1')
check("and the team's own is too", games[0].away.record, '6-0')
check('the scores still read from the object shape', [games[0].awayScore, games[0].homeScore], [20, 17])

// The header record comes from the response's own team object, which is
// the record *now* rather than as of some game in the list.
check("the page's own record is read", teamRecordFromSchedule(scheduleResponse), '8-1')
check('and is undefined when the response has none', teamRecordFromSchedule(undefined), undefined)

// The diagnostic names what arrived, so a column that still comes up empty
// reports itself rather than being guessed at a third time.
check('the diagnostic names the fields sent', describeScheduleRecords(scheduleResponse), 'total=5-1')
check('and is empty when there is nothing to describe', describeScheduleRecords(undefined), '')

report()
