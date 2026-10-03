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
import { stripLiveState, toSafeView, isGameProtected, type SpoilerSettings } from '../../src/lib/spoilers'
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

const settingsFor = (teamIds: string[]): SpoilerSettings =>
  ({ globalEnabled: false, protectedGameIds: [], protectedTeamIds: teamIds })

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

// An upcoming game, with no idea which team is protected: nothing is
// counted in it yet, so both records stand.
const upcoming = stripLiveState(game('pre'))
check('an upcoming game keeps both records when no team is named', [upcoming.away.record, upcoming.home.record], ['5-0', '2-2'])
check('and still has no score', [upcoming.awayScore, upcoming.homeScore], [undefined, undefined])

// The one the first version missed. A protected team's record counts the
// games they have already played, so it leaks those results on every later
// fixture — Notre Dame 5-0 on next week's card says they won today.
const nextWeek = stripLiveState(game('pre'), settingsFor(['87']))
check('a protected team shows no record on a future game', nextWeek.away.record, undefined)
check('while the other side keeps theirs', nextWeek.home.record, '2-2')

// Protecting one game by id is not a request to hide either team's season.
const oneGame = stripLiveState(game('pre'), { globalEnabled: false, protectedGameIds: ['g1'], protectedTeamIds: [] })
check('protecting a single game leaves both seasons alone', [oneGame.away.record, oneGame.home.record], ['5-0', '2-2'])

// Global no-spoilers means every team's season is off limits.
const everything = stripLiveState(game('pre'), { globalEnabled: true, protectedGameIds: [], protectedTeamIds: [] })
check('global no-spoilers hides every record', [everything.away.record, everything.home.record], [undefined, undefined])

// Both sides still lose it once the game itself is counted, whoever is
// protected and whatever the reason for hiding it.
const liveBoth = stripLiveState(game('in'), settingsFor(['87']))
check('a kicked-off game still hides both', [liveBoth.away.record, liveBoth.home.record], [undefined, undefined])

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
const settings = settingsFor(['87'])
check('the game is protected because Notre Dame is', isGameProtected(game('post'), settings), true)
check('a protected final is sanitized', toSafeView(game('post'), settings).away.record, undefined)
check('and so is the same team\u2019s next fixture', toSafeView(game('pre'), settings).away.record, undefined)
const unprotected = { globalEnabled: false, protectedGameIds: [], protectedTeamIds: [] }
check('an unprotected final is untouched', toSafeView(game('post'), unprotected).away.record, '5-0')
check('and keeps its score', toSafeView(game('post'), unprotected).awayScore, 17)

report()
