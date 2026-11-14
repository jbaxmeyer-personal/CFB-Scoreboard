/**
 * Timeouts left, read off the scoreboard's live situation.
 *
 * Declared under two spellings because the payload could not be checked
 * from this build environment — reading only one key is how the record,
 * the score and the linescore each came back empty in turn, and all three
 * were a key spelled a way the parser did not expect.
 */
import { check, report } from '../helpers/check'
import { normalizeEvent } from '../../src/lib/espn'
import type { EspnEvent } from '../../src/types/espn'

const live = { clock: 131, displayClock: '2:11', period: 4, type: { id: '2', name: 'STATUS_IN_PROGRESS', state: 'in', completed: false, description: 'In Progress', detail: 'Q4', shortDetail: 'Q4 2:11' } }

const event = (situation: unknown): EspnEvent =>
  ({
    id: 'g1', date: '2026-11-14T19:00Z', name: 'x', shortName: 'MIA @ ND', status: live,
    competitions: [{
      id: 'g1', date: '2026-11-14T19:00Z', status: live, situation,
      competitors: [
        { id: 'h', homeAway: 'home', score: '21', team: { id: '87', location: 'ND', abbreviation: 'ND', displayName: 'ND', shortDisplayName: 'ND' } },
        { id: 'a', homeAway: 'away', score: '17', team: { id: '2390', location: 'MIA', abbreviation: 'MIA', displayName: 'MIA', shortDisplayName: 'MIA' } },
      ],
    }],
  }) as unknown as EspnEvent

const timeouts = (situation: unknown) => normalizeEvent(event(situation))?.timeouts

check('both counts are read', timeouts({ homeTimeouts: 2, awayTimeouts: 3 }), { home: 2, away: 3 })
check('and under the longer spelling too', timeouts({ homeTimeoutsRemaining: 1, awayTimeoutsRemaining: 0 }), { home: 1, away: 0 })

// All three left, and none left, are both real answers — zero is the most
// interesting one in the last two minutes and must not read as missing.
check('none left is a count, not an absence', timeouts({ homeTimeouts: 0, awayTimeouts: 0 }), { home: 0, away: 0 })
check('and three left is too', timeouts({ homeTimeouts: 3, awayTimeouts: 3 }), { home: 3, away: 3 })

// One side alone is not a comparison, so neither is shown.
check('one side on its own yields nothing', timeouts({ homeTimeouts: 2 }), undefined)
check('nor does the other', timeouts({ awayTimeouts: 2 }), undefined)
check('nor a situation with no timeouts in it', timeouts({ down: 2, distance: 7 }), undefined)
check('nor no situation at all', timeouts(undefined), undefined)

// A value outside 0-3 is not a timeout count — college football gives
// three a half — so it means the field being read is not the field meant.
check('a count above three is refused', timeouts({ homeTimeouts: 7, awayTimeouts: 2 }), undefined)
check('as is a negative one', timeouts({ homeTimeouts: -1, awayTimeouts: 2 }), undefined)
check('and a fractional one', timeouts({ homeTimeouts: 1.5, awayTimeouts: 2 }), undefined)
check('and a string', timeouts({ homeTimeouts: '2', awayTimeouts: '3' }), undefined)

// The short spelling wins where both are present and disagree, since it is
// the one read first.
check('the first spelling wins a disagreement', timeouts({ homeTimeouts: 1, homeTimeoutsRemaining: 3, awayTimeouts: 2 }), { home: 1, away: 2 })
// But an unusable value under the first spelling falls through to the
// second rather than discarding the pair.
check('an unusable first spelling falls through', timeouts({ homeTimeouts: 9, homeTimeoutsRemaining: 3, awayTimeouts: 2 }), { home: 3, away: 2 })

report()
