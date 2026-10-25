/**
 * The AP Top 25, read out of ESPN's rankings payload.
 *
 * Same constraint as the standings: the response can't be opened from this
 * build environment, so the payload is walked rather than addressed, and
 * anything unrecognized costs the ranks and nothing else.
 *
 * The one thing that genuinely can't be walked blindly is *which poll*.
 * This endpoint carries the AP poll, the coaches' poll, and in December the
 * committee's rankings — collecting every `rank` in the tree would give
 * some teams one poll's number and some another's, which is worse than
 * showing none.
 */
import { check, report } from '../helpers/check'
import { rankingsFrom } from '../../src/lib/rankings'

const ap = {
  name: 'AP Top 25',
  shortName: 'AP Poll',
  type: 'ap',
  ranks: [
    { current: 1, team: { id: '194' }, recordSummary: '8-0' },
    { current: 2, team: { id: '333' }, recordSummary: '7-1' },
  ],
}
const coaches = {
  name: 'USA Today Coaches Poll',
  shortName: 'Coaches Poll',
  type: 'usa',
  ranks: [{ current: 1, team: { id: '99' }, recordSummary: '7-1' }],
}

// The coaches' poll is listed FIRST here on purpose: picking by position
// rather than by name is the bug this guards.
const both = rankingsFrom({ rankings: [coaches, ap] })
check('the AP poll is the one read, not whichever came first', both.byTeamId.get('194')?.rank, 1)
check('and the coaches poll is left out entirely', both.byTeamId.has('99'), false)
check('the heading is the poll that says Top 25', both.pollName, 'AP Top 25')
check('with the record the poll shipped', both.byTeamId.get('333')?.record, '7-1')

// Only the AP poll present under a different nesting.
const nested = rankingsFrom({ sports: [{ leagues: [{ rankings: [ap] }] }] })
check('a poll nested deeper is still found', nested.byTeamId.get('194')?.rank, 1)

// Rank numbers outside the Top 25 are not badges.
const votes = rankingsFrom({ rankings: [{ name: 'AP Top 25', ranks: [{ current: 38, team: { id: '194' } }] }] })
check('others receiving votes is not a Top 25 rank', votes.byTeamId.size, 0)

// A team id that isn't an FBS team we know is skipped rather than invented.
const unknown = rankingsFrom({ rankings: [{ name: 'AP Top 25', ranks: [{ current: 3, team: { id: '999999' } }] }] })
check('an unknown team is skipped', unknown.byTeamId.size, 0)

// Nothing recognizable: no ranks, no section, no badges — and never a throw.
check('an unrecognized payload yields nothing', rankingsFrom({ foo: 1 }).byTeamId.size, 0)
check('and says so in its name', rankingsFrom({ foo: 1 }).pollName, 'Top 25')
check('null is handled too', rankingsFrom(null).byTeamId.size, 0)

// A poll we can't identify is captioned with its own name rather than
// being passed off as the AP poll.
const odd = rankingsFrom({ rankings: [{ name: 'CFP Rankings', ranks: [{ current: 1, team: { id: '194' } }] }] })
check('an unfamiliar poll keeps its own name', odd.pollName, 'CFP Rankings')
check('and is still read', odd.byTeamId.get('194')?.rank, 1)

report()
