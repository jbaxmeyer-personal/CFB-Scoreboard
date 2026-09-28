/**
 * The order plays are in.
 *
 * Plays were sorted by ESPN's `sequenceNumber` whenever every play had one.
 * ESPN's numbering is not reliable enough for that: in Miami at Wake Forest
 * the safety at Q4 13:11 carried sequence 170, the highest number in the
 * game, so it sorted after "End of 4th quarter." at 0:00 — a play with
 * eleven minutes left shown as the last of the game. It also left every
 * play after it reporting 31-20 on a game that finished 33-20.
 *
 * The clock alone is not enough either: it stalls. A kickoff, a 10-yard run
 * and a false start were all stamped 15:00 in one live payload, so plays
 * sharing a clock still need the sequence number to separate them.
 */
import { check, report } from '../helpers/check'
import { normalizePlays } from '../../src/lib/espn'

const play = (id: string, seq: number, period: number, clock: string, text: string, away = 0, home = 0) =>
  ({ id, sequenceNumber: String(seq), text, period: { number: period }, clock: { displayValue: clock }, awayScore: away, homeScore: home })

const clockSecs = (c?: string) => {
  const [m, s] = (c ?? '0:00').split(':').map(Number)
  return m * 60 + s
}

// 1) The reported case: a misnumbered safety.
const misnumbered = normalizePlays({
  header: { competitions: [{ playByPlaySource: 'full', competitors: [
    { homeAway: 'away', team: { id: '2390' }, score: '33' },
    { homeAway: 'home', team: { id: '154' }, score: '20' },
  ] }] },
  // As the real payload had it: the scoring plays are published, so the
  // running score is taken from them rather than inferred.
  scoringPlays: [
    { id: 'a', text: 'Carlos Hernandez 17 Yd pass from Gio Lopez', period: { number: 4 }, clock: { displayValue: '14:56' }, awayScore: 31, homeScore: 20 },
    { id: 'd', text: 'Team Safety', period: { number: 4 }, clock: { displayValue: '13:11' }, awayScore: 33, homeScore: 20 },
  ],
  drives: { previous: [{ team: { id: '2390' }, plays: [
    play('a', 166, 4, '14:56', 'Carlos Hernandez 17 Yd pass from Gio Lopez', 31, 20),
    play('b', 168, 4, '0:19', 'Kneel down by #10 D.Mensah', 31, 20),
    play('c', 169, 4, '0:00', 'End of 4th quarter.', 31, 20),
    // ESPN really numbered the safety 170 — the highest in the game.
    play('d', 170, 4, '13:11', 'Team Safety', 33, 20),
  ] }] },
} as never)

const safetyIndex = misnumbered.findIndex((p) => /Team Safety/i.test(p.text))
check('the safety is not the last play of the game', safetyIndex === misnumbered.length - 1, false)
check('it sits where its clock says, at Q4 13:11', [misnumbered[safetyIndex].period, misnumbered[safetyIndex].clock], [4, '13:11'])
check('the feed ends where the game did', misnumbered.at(-1)!.text, 'End of 4th quarter.')
check('every play after the safety carries the final score',
  misnumbered.slice(safetyIndex).every((p) => p.awayScore === 33 && p.homeScore === 20), true)

// 2) Strict monotonicity: never a later quarter above an earlier one, and
//    never the clock running backwards inside a quarter.
let backwards = 0
for (let i = 1; i < misnumbered.length; i += 1) {
  const a = misnumbered[i - 1]
  const b = misnumbered[i]
  if (b.period! < a.period!) backwards += 1
  else if (b.period === a.period && clockSecs(b.clock) > clockSecs(a.clock)) backwards += 1
}
check('the feed never runs backwards, by quarter or by clock', backwards, 0)

// 3) The stalled clock: plays sharing a period and a clock keep the order
//    ESPN numbered them in, which is the only thing that separates them.
const stalled = normalizePlays({
  drives: { previous: [{ plays: [
    play('z', 3, 1, '15:00', 'PENALTY False Start'),
    play('x', 1, 1, '15:00', 'K.Rowe kickoff 65 yards'),
    play('y', 2, 1, '15:00', 'J.Hayes rush for 10 yards'),
  ] }] },
} as never)
check('plays sharing a clock keep their sequence order',
  stalled.map((p) => p.id), ['x', 'y', 'z'])

// 4) Quarters still order ahead of the clock within them.
const quarters = normalizePlays({
  drives: { previous: [{ plays: [
    play('q3', 1, 3, '15:00', 'Third quarter play'),
    play('q1', 2, 1, '2:00', 'First quarter play'),
    play('q2', 3, 2, '9:00', 'Second quarter play'),
  ] }] },
} as never)
check('quarters come in order regardless of numbering', quarters.map((p) => p.period), [1, 2, 3])

report()
