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

// --- The CFP rankings take over when they exist -------------------------
// From the first Tuesday in November the committee's rankings are what the
// season is being decided by, and the AP poll becomes a sidebar. Written as
// "prefer the CFP poll whenever the payload has one" rather than as a date,
// so the switch happens by itself every season, in both directions, with
// nothing to remember in November and nothing to undo in January.
const cfp = {
  name: 'College Football Playoff Rankings',
  shortName: 'CFP Rankings',
  type: 'cfp',
  ranks: [
    { current: 1, team: { id: '99' }, recordSummary: '8-0' },
    { current: 2, team: { id: '194' }, recordSummary: '8-0' },
  ],
}

const withCfp = rankingsFrom({ rankings: [ap, coaches, cfp] })
check('the CFP rankings win when the payload has them', withCfp.byTeamId.get('99')?.rank, 1)
check('and the AP poll is not used at all', withCfp.byTeamId.has('333'), false)
check('the heading says which poll it is', withCfp.pollName, 'CFP Rankings')

// Before November there is no CFP poll, and nothing changes.
check('without them the AP poll is still the Top 25', rankingsFrom({ rankings: [ap, coaches] }).pollName, 'AP Top 25')

// The Tuesday itself: ESPN can list the poll before the show airs, with
// nothing in it. Preferring it on its name alone would empty the Top 25
// for the day instead of leaving the AP poll up until the real thing lands.
const announced = rankingsFrom({ rankings: [ap, { ...cfp, ranks: [] }] })
check('an empty CFP poll does not take the section down', announced.pollName, 'AP Top 25')
check('and the AP teams are still there', announced.byTeamId.get('194')?.rank, 1)

// A CFP poll whose entries are all unreadable is the same case.
const unreadable = rankingsFrom({ rankings: [ap, { ...cfp, ranks: [{ current: 1, team: { id: '999999' } }] }] })
check('nor does one whose teams cannot be read', unreadable.pollName, 'AP Top 25')

// Next September, if the response still carries last season's final CFP
// rankings, they must not outrank this season's live AP poll. This is the
// shape the "do it next year too" part turns into if nothing checks when a
// poll is from.
const stale = rankingsFrom(
  { rankings: [{ ...ap, season: { year: 2027 } }, { ...cfp, season: { year: 2026 } }] },
  undefined,
  2027,
)
check("last season's CFP rankings do not outrank this season's AP poll", stale.pollName, 'AP Top 25')
check('and it is this season\u2019s AP teams that are shown', stale.byTeamId.get('194')?.rank, 1)

// A season stamp above a poll rather than on it is inherited from the node
// it hangs under.
const inherited = rankingsFrom(
  {
    seasons: [
      { season: { year: 2026 }, rankings: [cfp] },
      { season: { year: 2027 }, rankings: [ap] },
    ],
  },
  undefined,
  2027,
)
check('a season stamp above the poll counts too', inherited.pollName, 'AP Top 25')

// When everything in the response is from last season — the offseason, with
// no current poll to prefer — the preferred poll still wins. Last season's
// final CFP rankings are the right answer in July, and an empty section
// would not be.
const offseason = rankingsFrom({ season: { year: 2026 }, rankings: [ap, cfp] }, undefined, 2027)
check('with nothing current, the best of what is there is shown', offseason.pollName, 'CFP Rankings')

// Same season: the CFP rankings are current and win, as they should.
const current = rankingsFrom({ season: { year: 2026 }, rankings: [ap, cfp] }, undefined, 2026)
check('this season\u2019s CFP rankings do win', current.pollName, 'CFP Rankings')

// With no season to compare against, nothing is treated as stale.
check('an unstamped payload is not assumed stale', rankingsFrom({ rankings: [ap, cfp] }).pollName, 'CFP Rankings')

// The coaches poll is last rather than banned: if it were somehow the only
// poll in the response, showing it correctly labelled beats showing nothing.
const onlyCoaches = rankingsFrom({ rankings: [coaches] })
check('the coaches poll is used only when it is all there is', onlyCoaches.byTeamId.get('99')?.rank, 1)
check('and is labelled as itself', onlyCoaches.pollName, 'Coaches Poll')

report()
