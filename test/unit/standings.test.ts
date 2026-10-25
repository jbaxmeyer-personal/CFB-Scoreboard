/**
 * The Standings screen's data layer.
 *
 * ESPN is not reachable from this build environment, so the standings
 * payload could not be inspected before this was written — the same
 * position that shipped a box score requiring a numeric `value` ESPN never
 * sends, and a conference list built on a shape nobody could check.
 *
 * Two things follow, and both are what these checks are about. The parser
 * reads the payload as a tree and accepts every spelling of a record it
 * might plausibly use, so being wrong about the shape costs nothing. And
 * the table is built from the static tables in src/data, so the worst case
 * is a complete screen with an empty records column rather than a blank
 * tab.
 */
import { check, report } from '../helpers/check'
import { recordsFromStandings, buildStandings, buildTop25, describeStandingsStats } from '../../src/lib/standings'
import type { SpoilerSettings } from '../../src/lib/spoilers'
import type { Conference } from '../../src/data/conferences'

const NO_SPOILERS: SpoilerSettings = { globalEnabled: false, protectedGameIds: [], protectedTeamIds: [] }
const protecting = (teamIds: string[]): SpoilerSettings => ({ ...NO_SPOILERS, protectedTeamIds: teamIds })

// Real ESPN team ids, so the parser's own FBS membership check applies:
// Notre Dame 87, North Carolina 153, Alabama 333, Purdue 2509, Ohio State
// 194, Michigan 130.
const ND = '87'
const UNC = '153'

// --- Shape 1: conferences under `children`, pre-formatted stat strings ---
const shapeOne = {
  children: [
    {
      id: '1',
      name: 'Atlantic Coast Conference',
      standings: {
        entries: [
          {
            team: { id: UNC, displayName: 'North Carolina' },
            stats: [
              { name: 'overall', displayValue: '2-6' },
              { name: 'vsConf', displayValue: '1-4' },
            ],
          },
        ],
      },
    },
  ],
}
const one = recordsFromStandings(shapeOne)
check('a conference entry yields its overall record', one.get(UNC)?.overall, '2-6')
check('and its conference record', one.get(UNC)?.conference, '1-4')
check('parsed into numbers for ordering', [one.get(UNC)?.overallWins, one.get(UNC)?.overallLosses], [2, 6])

// --- Shape 2: numeric wins/losses rather than a formatted string --------
const shapeTwo = {
  children: [
    {
      standings: {
        entries: [
          {
            team: { id: ND },
            stats: [
              { name: 'wins', value: 7, displayValue: '7' },
              { name: 'losses', value: 1, displayValue: '1' },
            ],
          },
        ],
      },
    },
  ],
}
check('wins and losses sent apart are composed', recordsFromStandings(shapeTwo).get(ND)?.overall, '7-1')

// --- Shape 3: team.record.items, the shape the scoreboard really uses ---
const shapeThree = {
  entries: [
    {
      team: {
        id: ND,
        record: {
          items: [
            { type: 'total', summary: '7-1' },
            { type: 'vsconf', summary: '0-0' },
          ],
        },
      },
    },
  ],
}
const three = recordsFromStandings(shapeThree)
check('a record.items list is read too', [three.get(ND)?.overall, three.get(ND)?.conference], ['7-1', '0-0'])

// --- Nesting and id resolution ------------------------------------------
// Divisions one level deeper than conferences, which is how ESPN files a
// league that has them. The tree walk doesn't care how deep it is.
const nested = {
  children: [
    {
      name: 'Conference',
      children: [
        {
          name: 'East',
          standings: { entries: [{ team: { id: UNC }, stats: [{ name: 'overall', displayValue: '9-0' }] }] },
        },
      ],
    },
  ],
}
check('a division nested under a conference is still found', recordsFromStandings(nested).get(UNC)?.overall, '9-0')

// A `$ref` to the team rather than an inline id.
const byRef = {
  entries: [
    {
      team: { $ref: 'http://sports.core.api.espn.com/v2/sports/football/leagues/college-football/seasons/2026/teams/87?lang=en' },
      stats: [{ name: 'overall', displayValue: '7-1' }],
    },
  ],
}
check('a team named only by $ref resolves', recordsFromStandings(byRef).get(ND)?.overall, '7-1')

// An entry keyed on the team id directly, with no nested team object.
const flat = { entries: [{ id: ND, stats: [{ name: 'overall', displayValue: '7-1' }] }] }
check('an entry keyed on the team id resolves', recordsFromStandings(flat).get(ND)?.overall, '7-1')

// The collision guard. ESPN's conference group ids share a range with its
// team ids: the SEC's group is 8, and 8 is Arkansas. A conference node
// carrying any aggregate stats must not be filed as that team's record —
// which is what the first version of this parser would have done, because
// the team-id check passes: 8 is a real team.
const collide = {
  children: [
    {
      id: '8',
      name: 'SEC',
      stats: [{ name: 'overall', displayValue: '61-19' }],
      standings: {
        entries: [{ team: { id: '333' }, stats: [{ name: 'overall', displayValue: '6-2' }] }],
      },
    },
  ],
}
const collided = recordsFromStandings(collide)
check('a conference whose group id is a team id is not read as that team', collided.get('8'), undefined)
check('while the real entry inside it still is', collided.get('333')?.overall, '6-2')

// And an entry whose id is synthetic rather than a team id is skipped, not
// filed under the made-up key. Reading nothing is recoverable — the screen
// says so and still lists every team; a map keyed on invented ids would
// quietly match nobody and look like ESPN had sent no records.
const synthetic = { entries: [{ id: 'standings-row-1', stats: [{ name: 'overall', displayValue: '5-5' }] }] }
check('a row with no resolvable team is skipped', recordsFromStandings(synthetic).size, 0)

// A season stamp or a week number is not a standings row either.
const strays = { season: { year: 2026, id: '87' }, week: { number: 9 } }
check('ids outside an entry are not mistaken for records', recordsFromStandings(strays).size, 0)

// An answered request that contains nothing recognizable reads as empty
// rather than throwing — that is what puts the note on the screen.
check('an unrecognized payload yields no records', recordsFromStandings({ foo: 'bar' }).size, 0)
check('and so does a null one', recordsFromStandings(null).size, 0)

// --- The table ----------------------------------------------------------
const testConf: Conference = {
  id: 'Test',
  name: 'Test Conference',
  shortName: 'TEST',
  teamIds: new Set([ND, UNC, '2509']),
}
const only = { conferences: [testConf] }

const records = new Map([
  [ND, { overall: '7-1', conference: '5-0', overallWins: 7, overallLosses: 1, conferenceWins: 5, conferenceLosses: 0 }],
  [UNC, { overall: '2-6', conference: '1-4', overallWins: 2, overallLosses: 6, conferenceWins: 1, conferenceLosses: 4 }],
])

const table = buildStandings(records, NO_SPOILERS, only)
check('the conference is listed', table.length, 1)
check('with every team in it, including one the feed never mentioned', table[0].rows.length, 3)
check('ordered by conference record', table[0].rows.map((r) => r.team.abbreviation), ['ND', 'UNC', 'PUR'])
check('a team with no record sorts last rather than first', table[0].rows[2].record, undefined)
check('and the ranked table is ranked', table[0].unranked, false)

// Percentage, not wins: 4-1 is ahead of 5-2 even though 5 > 4.
const pct = buildStandings(
  new Map([
    [ND, { conferenceWins: 4, conferenceLosses: 1 }],
    [UNC, { conferenceWins: 5, conferenceLosses: 2 }],
  ]),
  NO_SPOILERS,
  only,
)
check('a better percentage outranks more wins', pct[0].rows.map((r) => r.team.abbreviation)[0], 'ND')

// Every conference the app knows is on the screen, with no team missing a
// row — the point of building from the static tables.
const everything = buildStandings(new Map(), NO_SPOILERS)
check('every conference renders with no records at all', everything.length >= 10, true)
check('and no conference comes out empty', everything.every((c) => c.rows.length > 0), true)
check('each row still has a team to name', everything.every((c) => c.rows.every((r) => r.team.name.length > 0)), true)
// Caught by looking at the rendered screen: with no records loaded it was
// still numbering rows 1-14 down an alphabetical list, which says Army
// leads the AAC. Nothing to rank on is not a tie for first.
check('a conference with no records at all is not ranked', everything.every((c) => c.unranked), true)
check('and owes no explanation, since nothing is being withheld', everything.every((c) => !c.hidesRecords), true)
// One record in the conference is enough to have a standing again.
check('one record is enough to rank on', buildStandings(records, NO_SPOILERS, only)[0].unranked, false)

// --- No-spoilers --------------------------------------------------------
// The leak this has to avoid is the one that was just fixed on the game
// cards, in a worse form: a table of records is nothing but season tallies,
// and a protected team's *position* states its record even when the record
// itself is blank.
const guarded = buildStandings(records, protecting([ND]), only)
check('a protected team keeps its row', guarded[0].rows.length, 3)
check('but gives up its record', guarded[0].rows.find((r) => r.team.id === ND)?.record, undefined)
check('and is flagged as hidden for the lock', guarded[0].rows.find((r) => r.team.id === ND)?.hidden, true)
check('while the rest of the conference keeps theirs', guarded[0].rows.find((r) => r.team.id === UNC)?.record?.overall, '2-6')
check('the conference drops out of standings order', guarded[0].unranked, true)
check('and says so, because something is being withheld', guarded[0].hidesRecords, true)
check('and is listed alphabetically, so no position gives it away', guarded[0].rows.map((r) => r.team.abbreviation), ['UNC', 'ND', 'PUR'])

// A conference with nobody protected is unaffected — protecting Notre Dame
// is not a reason to stop ranking the SEC.
const mixed = buildStandings(records, protecting([ND]), {
  conferences: [testConf, { id: 'Other', name: 'Other', shortName: 'OTH', teamIds: new Set([UNC]) }],
})
check('another conference stays ranked', mixed[1].unranked, false)

const global = buildStandings(records, { ...NO_SPOILERS, globalEnabled: true }, only)
check('global no-spoilers hides every record', global[0].rows.every((r) => r.record === undefined && r.hidden), true)
check('and unranks the table', global[0].unranked, true)

// Protecting a single game is about that game. It is not a request to
// blank out either team's season, here or on a card.
const gameOnly = buildStandings(records, { ...NO_SPOILERS, protectedGameIds: ['401858226'] }, only)
check('protecting a game leaves the standings alone', gameOnly[0].rows.find((r) => r.team.id === ND)?.record?.overall, '7-1')
check('and keeps it ranked', gameOnly[0].unranked, false)

// --- Conference records sent as numeric parts ---------------------------
// The reported gap: overall records arrived and the conference column was
// empty. One way that happens is a feed that spells the pieces out rather
// than sending "3-1", so both records are composed from parts now, not
// just the overall one.
const parts = recordsFromStandings({
  entries: [
    {
      team: { id: ND },
      stats: [
        { name: 'wins', value: 7 },
        { name: 'losses', value: 1 },
        { name: 'vsConfWins', value: 5 },
        { name: 'vsConfLosses', value: 0 },
      ],
    },
  ],
})
check('a conference record sent as parts is composed too', parts.get(ND)?.conference, '5-0')
check('alongside the overall one', parts.get(ND)?.overall, '7-1')

// A percentage must not be read as a win count. The losses part is in the
// fixture on purpose: with only a stray wins value there is nothing to
// compose a record from, so the guard would never be reached and the check
// would pass whether or not it worked.
const pcts = recordsFromStandings({
  entries: [
    {
      team: { id: ND },
      stats: [
        { name: 'conferenceWinPercent', value: 0.8 },
        { name: 'vsConfLosses', value: 1 },
        { name: 'overall', displayValue: '7-1' },
      ],
    },
  ],
})
check('a win percentage is not mistaken for a win count', pcts.get(ND)?.conference, undefined)
check('and the overall record is unaffected by it', pcts.get(ND)?.overall, '7-1')

// --- The diagnostic -----------------------------------------------------
// What makes the missing conference column fixable from a phone: the
// screen prints the stat names ESPN actually sent, because this build
// environment cannot open the payload itself.
const described = describeStandingsStats({
  children: [
    {
      id: '8',
      standings: {
        entries: [{ team: { id: ND }, stats: [{ name: 'overall', displayValue: '7-1' }, { name: 'streak', value: 4 }] }],
      },
    },
  ],
})
check('the stat names ESPN sent are reported', described, 'overall, streak')
check('a payload with no entries describes nothing', describeStandingsStats({ foo: 1 }), '')

// --- The Top 25 ---------------------------------------------------------
const poll = new Map([
  ['194', { rank: 2 }],
  [ND, { rank: 1, record: '7-1' }],
  ['999999', { rank: 3 }],
])
const top = buildTop25(poll, records, NO_SPOILERS)
check('the Top 25 is in poll order, not map order', top.map((r) => r.team.rank), [1, 2])
check('a ranked team unknown to the static table is dropped', top.length, 2)
check('the record comes from the standings feed where there is one', top[0].record?.overall, '7-1')
check('and the conference record with it', top[0].record?.conference, '5-0')
// Ohio State is in the poll but not in the `records` map.
check("the poll's own record fills in where the standings had none", top[1].record?.overall, undefined)

const pollOnly = buildTop25(new Map([['194', { rank: 1, record: '8-0' }]]), new Map(), NO_SPOILERS)
check('a poll record is used when the standings had nothing', pollOnly[0].record?.overall, '8-0')
check('and is not shown as a conference record, which it is not', pollOnly[0].record?.conference, undefined)

// A protected team keeps its rank and loses its record — the same split the
// game cards have always made. A poll is published on a schedule; a record
// counts the games played.
const guardedTop = buildTop25(poll, records, protecting([ND]))
check('a protected team keeps its rank in the poll', guardedTop[0].team.rank, 1)
check('but not its record', [guardedTop[0].record, guardedTop[0].hidden], [undefined, true])

// --- Rank badges on the conference tables -------------------------------
const ranked = buildStandings(records, NO_SPOILERS, { ...only, ranks: new Map([[ND, { rank: 4 }]]) })
check('a ranked team carries its rank into the conference table', ranked[0].rows.find((r) => r.team.id === ND)?.team.rank, 4)
check('an unranked one carries none', ranked[0].rows.find((r) => r.team.id === UNC)?.team.rank, undefined)

report()
