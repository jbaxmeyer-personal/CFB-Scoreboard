/**
 * The running score on each play.
 *
 * The drives feed's per-play scores are not merely late, they are at times
 * fictional. In Miami at Wake Forest, Miami went 21 to 24 on a field goal
 * at the end of the 2nd, then 24 to 31 on a touchdown in the 3rd, and was
 * never on 27 at any point — yet "End of 2nd quarter." and fourteen other
 * plays carried 27-7. That put three of Miami's points in the wrong
 * quarter of the box score, and showed a scoreline that never happened on
 * fifteen rows of the play-by-play.
 *
 * ESPN's own scoringPlays array was right for all nine scores, so the
 * scores are grafted back on from it — but only when it can be shown to be
 * complete, which is what the rest of this file guards.
 */
import { check, report } from '../helpers/check'
import { normalizePlays } from '../../src/lib/espn'
import { computeLinescore } from '../../src/lib/linescore'

/** The real scoring sequence of that game. */
const SCORES: [number, number, string][] = [
  [7, 0, 'Joshua Moore 9 Yd pass from Darian Mensah (Jake Weinberg Kick)'],
  [7, 7, 'Kamrean Johnson 10 Yd pass from Gio Lopez (Connor Calvert Kick)'],
  [14, 7, 'Elija Lofton 21 Yd pass from Darian Mensah (Jake Weinberg Kick)'],
  [21, 7, 'Mark Fletcher Jr. 1 Yd Run (Jake Weinberg Kick)'],
  [24, 7, 'Jake Weinberg 27 Yd Field Goal'],
  [31, 7, 'Malachi Toney 2 Yd pass from Darian Mensah (Jake Weinberg Kick)'],
  [31, 13, 'Jack Foley 23 Yd pass from Gio Lopez (Two-Point Pass Conversion Failed)'],
  [31, 20, 'Carlos Hernandez 17 Yd pass from Gio Lopez (Connor Calvert Kick)'],
  [33, 20, 'Team Safety'],
]
const PERIODS = [1, 1, 2, 2, 2, 3, 3, 4, 4]
const CLOCKS = ['7:20', '1:22', '13:07', '8:17', '0:00', '8:56', '4:06', '14:56', '13:11']

const scoringPlays = SCORES.map(([away, home, text], i) => ({
  id: `s${i}`, text, period: { number: PERIODS[i] }, clock: { displayValue: CLOCKS[i] },
  awayScore: away, homeScore: home,
}))

/**
 * The drives feed for the same game: the nine scoring plays plus filler,
 * with the running scores deliberately wrong from the end of the 2nd — 27,
 * a scoreline that never existed — exactly as the real payload had them.
 */
function drivesFeed({ phantom = true } = {}) {
  const plays: unknown[] = []
  let seq = 0
  SCORES.forEach(([away, home], i) => {
    // Filler before each score, carrying the score as the feed reported it.
    const reportedAway = phantom && i >= 5 && i <= 6 ? 27 : i === 0 ? 0 : SCORES[i - 1][0]
    const reportedHome = i === 0 ? 0 : SCORES[i - 1][1]
    plays.push({ id: `f${i}`, sequenceNumber: String(seq++), text: `Filler before score ${i}`,
      period: { number: PERIODS[i] }, clock: { displayValue: CLOCKS[i] }, awayScore: reportedAway, homeScore: reportedHome })
    plays.push({ ...scoringPlays[i], sequenceNumber: String(seq++), awayScore: away, homeScore: home })
  })
  return { previous: [{ team: { id: '2390' }, plays }] }
}

const header = (awayScore: string, homeScore: string) => ({
  competitions: [{ playByPlaySource: 'full', competitors: [
    { homeAway: 'away', team: { id: '2390' }, score: awayScore },
    { homeAway: 'home', team: { id: '154' }, score: homeScore },
  ] }],
})

// 1) With a complete scoringPlays list, the phantom score is replaced.
const good = normalizePlays({ header: header('33', '20'), scoringPlays, drives: drivesFeed() } as never)
check('no play reports the score that never existed', good.filter((p) => p.awayScore === 27).length, 0)
check('the last play carries the real final score', [good.at(-1)!.awayScore, good.at(-1)!.homeScore], [33, 20])
check('the Scoring filter holds exactly ESPN’s nine', good.filter((p) => p.isScoringPlay).length, 9)
check('in game order, each with the right score',
  good.filter((p) => p.isScoringPlay).map((p) => `${p.awayScore}-${p.homeScore}`),
  SCORES.map(([a, h]) => `${a}-${h}`))
check('credited to the side whose total went up',
  good.filter((p) => p.isScoringPlay).map((p) => p.scoringTeam),
  ['away', 'home', 'away', 'away', 'away', 'away', 'home', 'home', 'away'])
check('and the derived box score now agrees with ESPN', computeLinescore(good), [
  { period: 1, home: 7, away: 7 },
  { period: 2, home: 0, away: 17 },
  { period: 3, home: 6, away: 7 },
  { period: 4, home: 7, away: 2 },
])

// 2) Each way the list can fail to be trustworthy must fall back to the
//    old heuristics rather than freeze the game below its real total. The
//    phantom 27 coming back is how the fallback proves it ran.
const noScoring = normalizePlays({ header: header('33', '20'), drives: drivesFeed() } as never)
check('with no scoring plays it falls back', noScoring.filter((p) => p.awayScore === 27).length > 0, true)
check('and still reaches the final score', [noScoring.at(-1)!.awayScore, noScoring.at(-1)!.homeScore], [33, 20])

const short = normalizePlays({ header: header('33', '20'), scoringPlays: scoringPlays.slice(0, -1), drives: drivesFeed() } as never)
check('an incomplete scoring list is refused', short.filter((p) => p.awayScore === 27).length > 0, true)

const noHeader = normalizePlays({ scoringPlays, drives: drivesFeed() } as never)
check('no official score to verify against is refused', noHeader.filter((p) => p.awayScore === 27).length > 0, true)

// 3) A game in progress: the official score is simply the current one, so
//    the same check works and the list is trusted.
const live = normalizePlays({ header: header('31', '7'), scoringPlays: scoringPlays.slice(0, 6), drives: drivesFeed() } as never)
check('a live game verifies against its current score', live.filter((p) => p.awayScore === 27).length, 0)
check('with the scores so far flagged', live.filter((p) => p.isScoringPlay).length, 6)

report()
