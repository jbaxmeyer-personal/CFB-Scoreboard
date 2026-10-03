/**
 * What a spoiler-protected game is allowed to show.
 *
 * Notre Dame, protected, finished: the card hid the score and read
 * "11:00 AM" — and then showed ND 5-0 against North Carolina 2-2. ESPN's
 * record already counts the game that just finished, so that names the
 * winner as plainly as the scoreline would.
 *
 * The guard that was meant to stop it lived on the card and read the
 * *sanitized* state — and sanitizing a protected final presents it as
 * upcoming, so the guard passed. Protecting the game is what switched the
 * leak on. It is the sanitizer's job now: one place, so no surface has to
 * remember.
 */
import { check, report } from '../helpers/check'
import { stripLiveState, toSafeView, isGameProtected } from '../../src/lib/spoilers'
import type { Game, Team } from '../../src/types/game'

const team = (id: string, abbreviation: string, record: string): Team =>
  ({ id, abbreviation, name: abbreviation, shortName: abbreviation, record }) as Team

const game = (state: Game['state'], homeRecord = '2-2', awayRecord = '5-0'): Game =>
  ({
    id: 'g1', competitionId: 'g1', startDate: '2026-10-03T15:00Z', shortName: 'ND @ UNC',
    timeTBD: false, broadcasts: ['ESPN'], statusDetail: state === 'post' ? 'Final' : '11:00 AM',
    state, homeScore: state === 'pre' ? undefined : 24, awayScore: state === 'pre' ? undefined : 17,
    home: team('153', 'UNC', homeRecord), away: team('87', 'ND', awayRecord),
  }) as Game

// The reported case.
const hiddenFinal = stripLiveState(game('post'))
check('a protected final gives away no record', [hiddenFinal.away.record, hiddenFinal.home.record], [undefined, undefined])
check('nor a score', [hiddenFinal.awayScore, hiddenFinal.homeScore], [undefined, undefined])
check('and is presented as though it has not kicked off', hiddenFinal.state, 'pre')

// A live game's record has not been updated yet, but it will be the moment
// the game ends — and the app polls. Holding it from kickoff is one rule
// instead of a race.
const hiddenLive = stripLiveState(game('in'))
check('a protected live game gives away no record either', [hiddenLive.away.record, hiddenLive.home.record], [undefined, undefined])
check('while still showing that it is being played', hiddenLive.state, 'in')

// An upcoming game has nothing in its record to give away, and keeps it —
// the records are the useful part of a card for a game not yet played.
const upcoming = stripLiveState(game('pre'))
check('a protected upcoming game keeps both records', [upcoming.away.record, upcoming.home.record], ['5-0', '2-2'])
check('and still has no score', [upcoming.awayScore, upcoming.homeScore], [undefined, undefined])

// Nothing is invented where a record was never sent.
const noRecords = stripLiveState(game('post', undefined as unknown as string, undefined as unknown as string))
check('a game with no records stays that way', [noRecords.away.record, noRecords.home.record], [undefined, undefined])

// The original game must not be mutated — it is what the expanded view
// renders behind the tap-to-reveal gate.
const original = game('post')
stripLiveState(original)
check('the real game is left untouched', [original.away.record, original.home.record, original.awayScore], ['5-0', '2-2', 17])

// And the whole thing only applies to a protected game: an unprotected
// final keeps everything, which is what the rest of the slate shows.
const settings = { globalEnabled: false, protectedGameIds: [], protectedTeamIds: ['87'] }
check('the game is protected because Notre Dame is', isGameProtected(game('post'), settings), true)
check('a protected final is sanitized', toSafeView(game('post'), settings).away.record, undefined)
const unprotected = { globalEnabled: false, protectedGameIds: [], protectedTeamIds: [] }
check('an unprotected final is untouched', toSafeView(game('post'), unprotected).away.record, '5-0')
check('and keeps its score', toSafeView(game('post'), unprotected).awayScore, 17)

report()
