/**
 * The box score.
 *
 * Defends two bugs that both reached a phone:
 *
 *  - Miami at Wake Forest read 7/20/4/2 where ESPN had 7/17/7/2. The line
 *    was derived from the play-by-play, whose running scores are not
 *    reliable, instead of from the line ESPN publishes.
 *  - The fix for that then shipped doing nothing for an hour, because it
 *    required a numeric `value` and ESPN sends `displayValue` strings.
 */
import { check, report } from '../helpers/check'
import { linescoreFromSummary, computeLinescore } from '../../src/lib/linescore'
import type { GamePlay } from '../../src/types/game'

/** ESPN's real shape: displayValue strings, no numeric value anywhere. */
const line = (home: (string | number | undefined)[], away: (string | number | undefined)[]) => ({
  header: { competitions: [{ competitors: [
    { homeAway: 'away', linescores: away.map((v) => (typeof v === 'number' ? { value: v } : { displayValue: v })) },
    { homeAway: 'home', linescores: home.map((v) => (typeof v === 'number' ? { value: v } : { displayValue: v })) },
  ] }] },
})

// The reported game, in the shape ESPN actually sent it.
const MIAMI = ['7', '17', '7', '2']
const WAKE = ['7', '0', '6', '7']
const reported = linescoreFromSummary(line(WAKE, MIAMI) as never)

check('displayValue strings are read', reported, [
  { period: 1, home: 7, away: 7 },
  { period: 2, home: 0, away: 17 },
  { period: 3, home: 6, away: 7 },
  { period: 4, home: 7, away: 2 },
])
check('the quarters add up to the real final score, 33-20', [
  reported!.reduce((n, p) => n + p.away, 0),
  reported!.reduce((n, p) => n + p.home, 0),
], [33, 20])
check('a numeric value is still read', linescoreFromSummary(line([7, 3], [7, 10]) as never)?.at(-1), { period: 2, home: 3, away: 10 })
check('overtime comes through as period 5', linescoreFromSummary(line(['7', '7', '0', '10', '3'], ['0', '14', '7', '3', '6']) as never)?.at(-1), { period: 5, home: 3, away: 6 })
check('a game in the 2nd shows two periods, not four', linescoreFromSummary(line(['7', '3'], ['0', '10']) as never)?.length, 2)

// A half-populated line is worse than none: every one of these must fall
// back to the derived line rather than render a partial box score.
check('no header falls back', linescoreFromSummary({} as never), null)
check('no competitors falls back', linescoreFromSummary({ header: { competitions: [{}] } } as never), null)
check('one side only falls back', linescoreFromSummary({ header: { competitions: [{ competitors: [
  { homeAway: 'home', linescores: [{ displayValue: '7' }] },
] }] } } as never), null)
check('mismatched lengths fall back', linescoreFromSummary(line(['7', '3', '7'], ['0', '10']) as never), null)
check('an empty line falls back', linescoreFromSummary(line([], []) as never), null)
check('a missing entry falls back', linescoreFromSummary(line(['7', undefined], ['0', '10']) as never), null)
check('a non-numeric entry falls back', linescoreFromSummary(line(['7', 'x'], ['0', '10']) as never), null)

// The derived line remains the fallback when ESPN sends no line at all.
const play = (period: number, homeScore: number, awayScore: number): GamePlay =>
  ({ id: `${period}-${homeScore}-${awayScore}`, text: 'x', period, homeScore, awayScore }) as GamePlay
check('the derived line still works when ESPN sends none',
  computeLinescore([play(1, 7, 7), play(2, 10, 24), play(3, 17, 31), play(4, 20, 33)]),
  [
    { period: 1, home: 7, away: 7 },
    { period: 2, home: 3, away: 17 },
    { period: 3, home: 7, away: 7 },
    { period: 4, home: 3, away: 2 },
  ])
check('and an empty feed derives nothing', computeLinescore([]), null)

report()
