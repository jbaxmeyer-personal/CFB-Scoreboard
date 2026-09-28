/**
 * Whether a game has been played.
 *
 * Notre Dame's page listed a 3-0 team's first three games as upcoming
 * kickoff times. State came from `status.type.state` alone, through a
 * helper that answers "pre" for anything it does not recognise — a missing
 * value included — so one differently-shaped status turned a whole season
 * of finished games into fixtures, silently, with no error anywhere.
 */
import { check, report } from '../helpers/check'
import { normalizeTeamSchedule } from '../../src/lib/espn'

const ND = { id: '87', abbreviation: 'ND', displayName: 'Notre Dame', shortDisplayName: 'Notre Dame', location: 'Notre Dame', name: 'x' }
const WIS = { id: '275', abbreviation: 'WIS', displayName: 'Wisconsin', shortDisplayName: 'Wisconsin', location: 'Wisconsin', name: 'x' }

const one = (opts: Record<string, unknown>) =>
  normalizeTeamSchedule({ events: [{
    id: '1', date: '2026-09-06T22:30Z', shortName: 'WIS @ ND', name: 'x',
    competitions: [{
      id: '1', date: '2026-09-06T22:30Z', status: opts.status,
      competitors: [
        { id: '87', homeAway: 'home', team: ND, score: opts.homeScore, ...(opts.homeWinner !== undefined ? { winner: opts.homeWinner } : {}) },
        { id: '275', homeAway: 'away', team: WIS, score: opts.awayScore, ...(opts.awayWinner !== undefined ? { winner: opts.awayWinner } : {}) },
      ],
    }],
  }] } as never)[0]

const type = (extra: Record<string, unknown>) => ({ type: { id: '3', name: 'STATUS_FINAL', description: 'Final', detail: 'Final', shortDetail: 'Final', ...extra } })

// 1) The scoreboard's own shape must keep working exactly as before.
let g = one({ status: type({ state: 'post', completed: true }), homeScore: '27', awayScore: '10' })
check('scoreboard shape: played', g.state, 'post')
check('scoreboard shape: scores', [g.homeScore, g.awayScore], [27, 10])

// 2) The team-schedule endpoint sends scores as objects.
g = one({ status: type({ state: 'post', completed: true }), homeScore: { value: 27, displayValue: '27' }, awayScore: { value: 10, displayValue: '10' } })
check('object scores are read', [g.homeScore, g.awayScore], [27, 10])

// 3) The bug: a status with no `state` at all. `completed` still says what
//    happened, and must be believed.
g = one({ status: type({ completed: true }), homeScore: { value: 27 }, awayScore: { value: 10 } })
check('no state, but completed: counted as played', g.state, 'post')
check('and the score still comes through', [g.homeScore, g.awayScore], [27, 10])

// 4) Neither state nor completed — only the winner mark, which ESPN sets
//    only once a game is decided.
g = one({ status: type({}), homeScore: { value: 27 }, awayScore: { value: 10 }, homeWinner: true, awayWinner: false })
check('the winner mark alone is enough', g.state, 'post')

// 5) Nothing may promote a real fixture. These are the guards that stop the
//    fix inventing results.
const SCHEDULED = { type: { id: '1', name: 'STATUS_SCHEDULED', state: 'pre', completed: false, description: 'Scheduled', detail: 'Sat 6:30', shortDetail: 'Sat 6:30' } }
g = one({ status: SCHEDULED })
check('an unplayed game stays upcoming', g.state, 'pre')
check('with no score invented', [g.homeScore, g.awayScore], [undefined, undefined])
check('completed:false stays upcoming', one({ status: { type: { id: '1', name: 'STATUS_SCHEDULED', completed: false, description: 'x', detail: 'x', shortDetail: 'x' } } }).state, 'pre')
check('a game in progress stays live', one({
  status: { type: { id: '2', name: 'STATUS_IN_PROGRESS', state: 'in', completed: false, description: 'x', detail: 'Q2 8:23', shortDetail: 'Q2 8:23' } },
  homeScore: { value: 10 }, awayScore: { value: 3 },
}).state, 'in')

report()
