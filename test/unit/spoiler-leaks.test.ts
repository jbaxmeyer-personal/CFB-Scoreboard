/**
 * Nothing a protected game knows may survive sanitizing. Every state,
 * every reason for protecting it, every field.
 *
 * This file exists because the same bug has now shipped three times in
 * different shapes: a record on a protected final, a record on the same
 * team's next fixture, and a record on the *opponent* of a protected
 * upcoming game. Each time the fix came with a check aimed exactly at the
 * shape just reported, and each time the next shape walked straight past
 * it.
 *
 * So this one asserts nothing in particular. It walks the whole sanitized
 * object and fails if any value anywhere in it looks like a record or
 * equals a score — whichever field it is in, including fields added to
 * `Game` after this was written, and whichever branch of the sanitizer
 * put it there. A carve-out cannot be written that this does not catch,
 * because it does not know what the carve-outs are.
 */
import { check, report } from '../helpers/check'
import { toSafeView, type SpoilerSettings } from '../../src/lib/spoilers'
import type { Game, GameState, Team } from '../../src/types/game'

const HOME_SCORE = 41
const AWAY_SCORE = 38
const RECORD_SHAPED = /^\d{1,3}-\d{1,3}(-\d{1,3})?$/

const team = (id: string, abbreviation: string, record: string, rank?: number): Team =>
  ({ id, abbreviation, name: abbreviation, shortName: abbreviation, record, rank }) as Team

/** Everything a live game carries, so there is something to find in every
 * field the sanitizer is supposed to clear. */
const game = (state: GameState): Game =>
  ({
    id: 'g1', competitionId: 'g1', startDate: '2026-11-07T23:30Z', shortName: 'MIA @ ND',
    timeTBD: false, broadcasts: ['NBC'],
    statusDetail: state === 'post' ? 'Final' : state === 'in' ? 'Q3 4:12' : '6:30 PM',
    state,
    homeScore: state === 'pre' ? undefined : HOME_SCORE,
    awayScore: state === 'pre' ? undefined : AWAY_SCORE,
    period: state === 'pre' ? undefined : 3,
    clock: state === 'pre' ? undefined : '4:12',
    possession: state === 'pre' ? undefined : 'home',
    situation: state === 'pre' ? undefined : { downDistanceText: '2nd & 7', possessionText: 'MIA 34' },
    home: team('87', 'ND', '11-1', 11),
    away: team('2390', 'MIA', '8-0', 1),
  }) as Game

/** Every value anywhere in the object, with the path it was found at. */
function values(node: unknown, path: string, into: [string, unknown][] = []): [string, unknown][] {
  if (node === null || node === undefined) return into
  if (Array.isArray(node)) {
    node.forEach((item, i) => values(item, `${path}[${i}]`, into))
    return into
  }
  if (typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) values(value, `${path}.${key}`, into)
    return into
  }
  into.push([path, node])
  return into
}

/** Anything in the sanitized game that gives the game away. */
function leaks(safe: Game): string[] {
  return values(safe, 'game')
    .filter(([path, value]) => {
      if (typeof value === 'string' && RECORD_SHAPED.test(value.trim())) return true
      if (value === HOME_SCORE || value === AWAY_SCORE) return true
      // The live clock and down-and-distance are state too, not just the
      // score — a protected game must not say it is in the third quarter.
      return /\.(period|clock|possession|situation)\b/.test(path)
    })
    .map(([path, value]) => `${path}=${String(value)}`)
}

// Every reason a game can be protected. The bug that prompted this file
// was in exactly one of these branches, on exactly one state.
const reasons: [string, SpoilerSettings][] = [
  ['the home team is protected', { globalEnabled: false, protectedGameIds: [], protectedTeamIds: ['87'] }],
  ['the away team is protected', { globalEnabled: false, protectedGameIds: [], protectedTeamIds: ['2390'] }],
  ['both teams are protected', { globalEnabled: false, protectedGameIds: [], protectedTeamIds: ['87', '2390'] }],
  ['the game itself is protected', { globalEnabled: false, protectedGameIds: ['g1'], protectedTeamIds: [] }],
  ['no-spoilers is on for everything', { globalEnabled: true, protectedGameIds: [], protectedTeamIds: [] }],
]

for (const state of ['pre', 'in', 'post'] as GameState[]) {
  for (const [why, spoilers] of reasons) {
    check(`${state}, ${why}: nothing leaks`, leaks(toSafeView(game(state), spoilers)), [])
  }
}

// The live badge is the one thing a protected live game is allowed to
// say, and it says only that the game is being played.
const live = toSafeView(game('in'), reasons[0][1])
check('a protected live game may still say it is live', [live.state, live.statusDetail], ['in', 'LIVE'])
check('and a protected final is presented as though it has not kicked off', toSafeView(game('post'), reasons[0][1]).state, 'pre')

// The other direction, so this cannot be satisfied by stripping
// everything from everything: a game nobody protected is untouched.
const open: SpoilerSettings = { globalEnabled: false, protectedGameIds: [], protectedTeamIds: ['999999'] }
for (const state of ['pre', 'in', 'post'] as GameState[]) {
  const untouched = toSafeView(game(state), open)
  check(`${state}, unprotected: both records stand`, [untouched.home.record, untouched.away.record], ['11-1', '8-0'])
}
const played = toSafeView(game('post'), open)
check('unprotected, the score stands', [played.homeScore, played.awayScore], [HOME_SCORE, AWAY_SCORE])
check('and so does the state', played.state, 'post')

// The sanitizer never edits the game it was handed — the expanded view
// renders that one behind its own gate.
const original = game('post')
toSafeView(original, reasons[0][1])
check('the real game is left alone', [original.home.record, original.homeScore, original.state], ['11-1', HOME_SCORE, 'post'])

report()
