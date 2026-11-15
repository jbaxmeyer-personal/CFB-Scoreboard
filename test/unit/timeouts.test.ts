/**
 * Timeouts left, counted from the play-by-play.
 *
 * This started as a read of ESPN's live situation field, and could not be
 * settled: on a real game the app showed "A&M 1", which fits both "one
 * left" and "one used" — opposite readings, and no way to tell them apart
 * from the number. A field that might be inverted is worse than no field.
 *
 * The plays say it outright. The text below is verbatim from a live game:
 * "Timeout Texas A&M, clock 07:50", Q3. Three a half minus the ones
 * charged in the half being played cannot be inverted, cannot be mirrored
 * between home and away, and resets at halftime without anything having
 * to know halftime happened.
 */
import { check, report } from '../helpers/check'
import { timeoutsLeft } from '../../src/lib/timeouts'
import type { GamePlay, Team } from '../../src/types/game'

const TENN = { id: '2633', name: 'Tennessee Volunteers', shortName: 'Tennessee', abbreviation: 'TENN' } as Team
const TAMU = { id: '245', name: 'Texas A&M Aggies', shortName: 'Texas A&M', abbreviation: 'TA&M' } as Team

let seq = 0
const play = (period: number, text: string): GamePlay =>
  ({ id: `p${seq++}`, text, period, clock: '07:50', homeScore: 7, awayScore: 6, isScoringPlay: false }) as GamePlay
const run = (period: number) => play(period, '#4 R.Owens II rush middle for 1 yard gain to the TAMU40')

// --- The reported game ---------------------------------------------------
// Texas A&M (home) called one in the third quarter. Tennessee called none.
const real = [
  run(1),
  play(1, 'Timeout Tennessee, clock 02:00'),
  play(2, 'Timeout Texas A&M, clock 00:48'),
  run(3),
  play(3, 'Timeout Texas A&M, clock 07:50'),
  run(3),
]
check('the half being played is the only one counted', timeoutsLeft(real, TAMU, TENN, 3), { home: 2, away: 3 })
// The first half is its own count — the same plays, read during it.
check('and the first half counts its own', timeoutsLeft(real, TAMU, TENN, 2), { home: 2, away: 2 })

// --- Who was charged -----------------------------------------------------
// The text names the team. The play's offence does not: a defence can
// call one, so the crest beside it is the wrong team about half the time.
check('a timeout is charged by name, not by who had the ball',
  timeoutsLeft([play(3, 'Timeout Tennessee, clock 05:00')], TAMU, TENN, 3), { home: 3, away: 2 })

// "Texas" is a prefix of "Texas A&M". In a game containing both, the team
// the text names outright is the one charged — treating the prefix as an
// equally good answer would make the clearest possible text ambiguous.
const TEX = { id: '251', name: 'Texas Longhorns', shortName: 'Texas', abbreviation: 'TEX' } as Team
const collide = [play(3, 'Timeout Texas A&M, clock 07:50')]
check('the team named outright beats the one it merely prefixes', timeoutsLeft(collide, TAMU, TEX, 3), { home: 2, away: 3 })

// The two Miamis are the same story and come out right: ESPN writes each
// team's own name, so "Miami" is the whole of the Hurricanes' short name
// and only a prefix of the RedHawks'.
const UM = { id: '2390', name: 'Miami Hurricanes', shortName: 'Miami', abbreviation: 'MIA' } as Team
const MOH = { id: '193', name: 'Miami (OH) RedHawks', shortName: 'Miami (OH)', abbreviation: 'M-OH' } as Team
check('the Miami that is named outright is the one charged',
  timeoutsLeft([play(3, 'Timeout Miami, clock 05:00')], UM, MOH, 3), { home: 2, away: 3 })
check('and the other one by its fuller name',
  timeoutsLeft([play(3, 'Timeout Miami (OH), clock 05:00')], UM, MOH, 3), { home: 3, away: 2 })

// When neither side is named outright and the text fits both only as a
// prefix, there is nothing to choose between them: charged to neither,
// rather than to whichever happens to be the home team.
const FL = { ...UM, shortName: 'Miami FL', abbreviation: 'MIA-FL' } as Team
const OH = { ...MOH, shortName: 'Miami OH', abbreviation: 'MIA-OH' } as Team
check('a name that fits both sides equally charges neither',
  timeoutsLeft([play(3, 'Timeout Miami, clock 05:00')], FL, OH, 3), { home: 3, away: 3 })

// A timeout matching neither side is charged to neither, rather than
// guessed at — a wrong crest is worse than a missing one.
check('an unrecognised team charges nobody',
  timeoutsLeft([play(3, 'Timeout Someone Else, clock 05:00')], TAMU, TENN, 3), { home: 3, away: 3 })

// --- Overtime ------------------------------------------------------------
// One each per overtime period, and it does not carry over.
const ot = [play(5, 'Timeout Texas A&M, clock 00:00'), play(6, 'Timeout Tennessee, clock 00:00')]
check('overtime gives one each', timeoutsLeft(ot, TAMU, TENN, 5), { home: 0, away: 1 })
check('and the next overtime starts again', timeoutsLeft(ot, TAMU, TENN, 6), { home: 1, away: 0 })

// From the third overtime, one each for the rest of the game — a 2025 rule
// change for pace of play, after a coach called one on every defensive
// play of an eight-overtime game. So a timeout spent in the third is still
// spent in the fourth, fifth and sixth.
const deep = [
  play(5, 'Timeout Texas A&M, clock 00:00'),
  play(6, 'Timeout Texas A&M, clock 00:00'),
  play(7, 'Timeout Texas A&M, clock 00:00'),
]
check('the third overtime gives one each', timeoutsLeft(deep, TAMU, TENN, 7), { home: 0, away: 1 })
check('and the fourth gives no more', timeoutsLeft(deep, TAMU, TENN, 8), { home: 0, away: 1 })
check('nor does the eighth', timeoutsLeft(deep, TAMU, TENN, 12), { home: 0, away: 1 })
// The first two are still periods of their own, so what was spent there is
// not held against the third.
const earlyOnly = [play(5, 'Timeout Texas A&M, clock 00:00'), play(6, 'Timeout Texas A&M, clock 00:00')]
check('the first two overtimes are not held against the third',
  timeoutsLeft(earlyOnly, TAMU, TENN, 7), { home: 1, away: 1 })
// And regulation never carries in, which the per-block counting gives for
// free rather than needing a rule of its own.
check('regulation timeouts do not carry into overtime',
  timeoutsLeft([run(3), play(3, 'Timeout Texas A&M, clock 07:50')], TAMU, TENN, 5), { home: 1, away: 1 })

// --- Nothing to count ----------------------------------------------------
check('a half with no timeouts has all three', timeoutsLeft([run(3)], TAMU, TENN, 3), { home: 3, away: 3 })
// But an empty list is the feed being missing rather than a quiet half —
// a live game always has plays — so there is nothing to show.
check('and no plays at all shows nothing', timeoutsLeft([], TAMU, TENN, 1), undefined)
check('with no period there is nothing to count', timeoutsLeft(real, TAMU, TENN, undefined), undefined)

// A feed that repeats a play must not drive the count negative.
const repeated = Array.from({ length: 5 }, () => play(3, 'Timeout Texas A&M, clock 07:50'))
check('a repeated timeout cannot go below zero', timeoutsLeft(repeated, TAMU, TENN, 3), { home: 0, away: 3 })

// --- Text shapes ---------------------------------------------------------
check('no comma is fine', timeoutsLeft([play(3, 'Timeout Tennessee clock 05:00')], TAMU, TENN, 3), { home: 3, away: 2 })
check('and no clock at all', timeoutsLeft([play(3, 'Timeout Tennessee')], TAMU, TENN, 3), { home: 3, away: 2 })
check('upper case is fine', timeoutsLeft([play(3, 'TIMEOUT TEXAS A&M, clock 07:50')], TAMU, TENN, 3), { home: 2, away: 3 })
// A play that merely mentions a timeout is not one being charged.
// A fragment that is not the start of either name is not a match: the
// rule is a prefix, not "appears somewhere in". "State" sits inside half
// the names in the sport.
check('a fragment in the middle of a name is not a match',
  timeoutsLeft([play(3, 'Timeout State, clock 05:00')],
    { id: '194', name: 'Ohio State Buckeyes', shortName: 'Ohio State', abbreviation: 'OSU' } as Team,
    TENN, 3), { home: 3, away: 3 })

check('a play that only mentions one is not counted',
  timeoutsLeft([play(3, '#10 M.Reed pass incomplete after timeout')], TAMU, TENN, 3), { home: 3, away: 3 })


// --- The two-minute timeout ----------------------------------------------
/**
 * Replayed from the real feed: Florida at Kentucky, 14 November 2026,
 * ESPN event 401856884. Every row below is verbatim.
 *
 * The reported bug. At Q4 1:59 the app showed Florida one timeout left
 * where ESPN showed two. ESPN was right: the 1:59 row is the automatic
 * two-minute stoppage, logged against Florida because Florida had the
 * ball — the play before it ran "(02:03)" to 1:59, carrying the clock
 * through the two-minute mark.
 */
const FLA = { id: '57', name: 'Florida Gators', shortName: 'Florida', abbreviation: 'FLA' } as Team
const UK = { id: '96', name: 'Kentucky Wildcats', shortName: 'Kentucky', abbreviation: 'UK' } as Team

let realSeq = 0
const at = (period: number, clock: string, text: string): GamePlay =>
  ({ id: `r${realSeq++}`, text, period, clock, homeScore: 14, awayScore: 21, isScoringPlay: false }) as GamePlay

// Kentucky at home, Florida away — as the feed has them.
const real2min = [
  at(3, '7:20', 'Timeout Florida, clock 07:20'),
  at(4, '2:46', 'Shotgun #13 J.Baugh rush left for 1 yard gain to the UF43'),
  at(4, '2:43', 'Timeout Kentucky, clock 02:43'),
  at(4, '2:37', 'Shotgun #12 A.Philo pass complete short right to #15 L.Harpring'),
  // The clock crosses two minutes during this play: it starts at 02:03.
  at(4, '1:59', 'Shotgun #12 A.Philo rush left for 7 yards gain to the UK38'),
  at(4, '1:59', 'Timeout Florida, clock 01:59'),
]
// What was on screen when the bug was reported.
check('the two-minute stoppage is charged to nobody', timeoutsLeft(real2min, UK, FLA, 4), { home: 2, away: 2 })

// Playing on to the end of the real game: both sides then spend the rest.
const realRest = [
  ...real2min,
  at(4, '1:53', 'Timeout Kentucky, clock 01:53'),
  at(4, '1:48', 'Shotgun #12 A.Philo rush middle for 0 yards to the UK36'),
  at(4, '1:48', 'Timeout Kentucky, clock 01:48'),
  at(4, '1:48', 'Timeout Florida, clock 01:48'),
]
// Kentucky spent all three; Florida spent one in the third and one at 1:48,
// and the 1:59 row was never theirs to spend.
check('and the real timeouts around it still are', timeoutsLeft(realRest, UK, FLA, 4), { home: 0, away: 1 })

// Only the first one in the window: a team timeout seconds later is its own.
check('a timeout just below the window is charged',
  timeoutsLeft([at(4, '2:00', 'Timeout Florida, clock 02:00'), at(4, '1:53', 'Timeout Florida, clock 01:53')], UK, FLA, 4),
  { home: 3, away: 2 })

// Two inside the window: the automatic stoppage happens once, so the
// second is a team's own even though it lands seconds later.
check('a second timeout inside the window is still charged',
  timeoutsLeft([at(4, '2:00', 'Timeout Florida, clock 02:00'), at(4, '1:57', 'Timeout Florida, clock 01:57')], UK, FLA, 4),
  { home: 3, away: 2 })

// The mark is in the second quarter too.
check('the second quarter has one as well',
  timeoutsLeft([at(2, '2:00', 'Timeout Kentucky, clock 02:00')], UK, FLA, 2), { home: 3, away: 3 })

// And nowhere else: the third quarter has no two-minute stoppage, so a
// timeout at 1:59 there is an ordinary one.
check('the third quarter has none, so 1:59 there is charged',
  timeoutsLeft([at(3, '1:59', 'Timeout Florida, clock 01:59')], UK, FLA, 3), { home: 3, away: 2 })

// Well clear of the mark is an ordinary timeout, not an automatic one.
check('a timeout well under two minutes is charged',
  timeoutsLeft([at(4, '1:48', 'Timeout Florida, clock 01:48')], UK, FLA, 4), { home: 3, away: 2 })
// As is one before the mark.
check('and one before it', timeoutsLeft([at(4, '2:43', 'Timeout Kentucky, clock 02:43')], UK, FLA, 4), { home: 2, away: 3 })

report()
