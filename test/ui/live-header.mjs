/**
 * What the header is allowed to say, and when.
 *
 * Two rules, both reported from a real game.
 *
 * 1. The score and clock must never be ahead of the play list below them.
 *    The scoreboard endpoint is usually a beat quicker than the play feed,
 *    and taking the higher of the two meant the number at the top moved
 *    before the play that explained it existed to read — the ending
 *    printed above the page it happens on. A live game now reads both off
 *    the newest play and nothing else.
 *
 *    A finished game still takes the higher of the two, and that is not an
 *    oversight: a final feed once stopped short at 14-19 on a game that
 *    ended 20-19 and printed the loser as the winner. Both are checked
 *    here so neither fix can quietly undo the other.
 *
 * 2. Down and distance must survive the numeric down going to -1. ESPN
 *    sends -1 between plays, including while the clock is stopped for a
 *    timeout — which is exactly when you want to know what the offence is
 *    facing — while its own app keeps showing "2nd & 3" from a formatted
 *    string it sends alongside. That string is now preferred.
 *
 * Run: npm run dev -- --port 5199   then   node test/ui/live-header.mjs
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const PORT = process.env.PORT || 5199
const DAY = 86400000
const iso = (o) => new Date(Date.now() + o * DAY).toISOString().slice(0, 10)
const TODAY = iso(0)

const team = (id, abbr, short, display) => ({
  id, location: short, name: short, abbreviation: abbr,
  displayName: display, shortDisplayName: short, color: '0C2340',
})
const ND = team('87', 'ND', 'Notre Dame', 'Notre Dame Fighting Irish')
const UGA = team('61', 'UGA', 'Georgia', 'Georgia Bulldogs')
const ALA = team('333', 'ALA', 'Alabama', 'Alabama Crimson Tide')
const MIA = team('2390', 'MIA', 'Miami', 'Miami Hurricanes')
const MICH = team('130', 'MICH', 'Michigan', 'Michigan Wolverines')
const OSU = team('194', 'OSU', 'Ohio State', 'Ohio State Buckeyes')

// The scoreboard is deliberately AHEAD of the play feed here: 28-14 at Q4
// 0:30, where the newest play is 21-14 at Q4 1:59. That gap is the bug.
const live = { clock: 30, displayClock: '0:30', period: 4, type: { id: '2', name: 'STATUS_IN_PROGRESS', state: 'in', completed: false, description: 'In Progress', detail: 'Q4', shortDetail: 'Q4 0:30' } }
const final = { clock: 0, displayClock: '0:00', period: 4, type: { id: '3', name: 'STATUS_FINAL', state: 'post', completed: true, description: 'Final', detail: 'Final', shortDetail: 'Final' } }

// down and distance as -1, the way ESPN sends them while the clock is
// stopped, with the formatted string still populated beside them.
// The live scoreboard, running ahead of the play feed — reported with the
// list showing "1st & 10" while the header read "3rd & 2". Its down and
// distance are also -1, the way ESPN sends them while the clock is stopped.
const situation = {
  possession: '87', down: -1, distance: -1, yardLine: 38,
  possessionText: 'MIA 47', isRedZone: false, shortDownDistanceText: '3rd & 2',
  downDistanceText: '3rd & 2 at MIA 47',
}

const game = (id, home, away, status, homeScore, awayScore, sit) => ({
  id, date: `${TODAY}T19:00Z`, name: 'x', shortName: `${away.abbreviation} @ ${home.abbreviation}`, status,
  competitions: [{
    id, date: `${TODAY}T19:00Z`, status, situation: sit, venue: { fullName: 'Stadium' }, broadcasts: [{ names: ['NBC'] }],
    competitors: [
      { id: `${id}h`, homeAway: 'home', team: home, score: String(homeScore), records: [{ type: 'total', summary: '8-1' }] },
      { id: `${id}a`, homeAway: 'away', team: away, score: String(awayScore), records: [{ type: 'total', summary: '8-0' }] },
    ],
  }],
})

const scoreboard = {
  leagues: [{ calendar: [{ label: 'R', entries: [{ label: 'Week 12', startDate: `${iso(-3)}T07:00Z`, endDate: `${iso(4)}T06:59Z` }] }] }],
  season: { year: 2026, type: 2 }, week: { number: 12 },
  events: [
    game('g1', ND, MIA, live, 28, 14, situation),
    // Finished, and the scoreboard carries the COMPLETE score while the
    // play feed below stops short.
    game('g3', MICH, OSU, final, 20, 19, undefined),
    // Live, with a scoreboard situation but a play feed that has no spots.
    game('g4', UGA, ALA, live, 10, 3, situation),
  ],
}

let seq = 0
const play = (period, clock, text, homeScore, awayScore, end) => ({
  id: `p${seq}`, sequenceNumber: String(seq++), text,
  period: { number: period }, clock: { displayValue: clock },
  homeScore, awayScore,
  // What the play left behind — the next snap's down, distance and spot.
  ...(end ? { end: { team: { id: '87' }, ...end } } : {}),
})

// Newest play: 21-14 at Q3 1:59. The scoreboard says 28-14 at Q4 0:30 —
// a whole quarter ahead, so the period on screen says which source won.
const livePlays = [
  play(3, '04:12', '#9 B.Leonard rush middle for 3 yards to the MIA 44', 14, 14),
  play(3, '02:03', '#12 A.Philo rush left for 7 yards gain to the UK38', 21, 14),
  // The newest play leaves 1st & 10 at the MIA 40. The scoreboard's own
  // situation (below) says 3rd & 2 at the MIA 47 — two snaps further on.
  play(3, '02:01', '#12 A.Philo pass incomplete short right to #7 B.Pegan', 21, 14, {
    down: 1, distance: 10, yardsToEndzone: 40,
    shortDownDistanceText: '1st & 10', downDistanceText: '1st & 10 at MIA 40',
    possessionText: 'MIA 40',
  }),
  // The newest row is a timeout, which carries no situation of its own —
  // the shape the bug was reported in. Measured on real feeds, 13% of
  // plays are like this, and they are the ones most likely to be newest.
  // It carries down and distance but NO spot. A play's yard line is
  // measured to the opponent's end zone where the scoreboard's is measured
  // from the home goal, so using one without its text would mirror the
  // ball into the wrong half. Without a spot there is no situation.
  play(3, '01:59', 'Timeout Notre Dame, clock 01:59', 21, 14, {
    down: 2, distance: 7, yardsToEndzone: 55, shortDownDistanceText: '2nd & 7',
  }),
]

// A live game whose plays carry no situation at all.
const spotlessPlays = [
  play(3, '08:00', '#9 B.Leonard rush middle for 3 yards', 7, 7),
  play(3, '07:30', '#9 B.Leonard rush left for 2 yards', 7, 7),
]
// A short final feed: last play says 14-19 on a game that ended 20-19.
const shortFinalPlays = [play(4, '00:21', '#3 K.Wilson rush right for 2 yards', 14, 19)]

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.route('**/site.api.espn.com/**', (r) => {
  const u = r.request().url()
  if (u.includes('/summary?')) {
    const plays = u.includes('event=g3') ? shortFinalPlays : u.includes('event=g4') ? spotlessPlays : livePlays
    return r.fulfill({ json: {
      header: { competitions: [{ playByPlaySource: 'full' }] },
      boxscore: {},
      drives: { previous: [{ team: { id: '87' }, plays }] },
    } })
  }
  if (u.includes('/standings') || u.includes('/rankings')) return r.fulfill({ json: {} })
  return r.fulfill({ json: scoreboard })
})
await page.route('**/sports.core.api.espn.com/**', (r) => r.fulfill({ json: { items: [] } }))
await page.route('**/a.espncdn.com/**', (r) => r.abort())

let fails = 0
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) fails += 1
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` !== ${JSON.stringify(expected)}`}`)
}

const header = () =>
  page.evaluate(() => ({
    score: [...document.querySelectorAll('.expanded-game__led')].map((n) => n.textContent.trim()),
    clock: document.querySelector('.expanded-game__clock')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
    downs: document.querySelector('.field-bar__downs')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
  }))
const newestPlay = () =>
  page.evaluate(() => {
    const row = document.querySelector('.game-stats__play-row')
    return row ? row.textContent.replace(/\s+/g, ' ').trim() : null
  })

const openGame = async (abbr) => {
  await page.evaluate((name) => {
    const card = [...document.querySelectorAll('.game-card')].find((c) => c.textContent.includes(name))
    card.querySelector('.game-card__trigger').click()
  }, abbr)
  await page.waitForSelector('.expanded-game__matchup')
  await page.waitForTimeout(900)
}
const close = async () => {
  await page.evaluate(() => document.querySelector('.game-detail-panel__close').click())
  await page.waitForTimeout(400)
}

await page.goto(`http://localhost:${PORT}/CFB-Scoreboard/`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(600)
await page.click('.tab-bar__item:has-text("Scoreboard")')
await page.waitForSelector('.game-card')
await page.waitForTimeout(800)

// --- A live game never leads its own play list ----------------------------
await openGame('MIA')
const live1 = await header()
console.log('   header:', JSON.stringify(live1))
console.log('   newest play row:', JSON.stringify(await newestPlay()))
// The scoreboard says 28-14. The newest play says 21-14. The play wins.
check('the score comes from the newest play, not the quicker feed', live1.score, ['14', '21'])
// The scoreboard says Q4 0:30. The newest play is at Q3 1:59. The play wins
// — the quarter as well as the time, so a feed a quarter behind cannot be
// overtaken by the quicker one.
check('and so does the clock', live1.clock?.includes('Q3 1:59'), true)
check('the quarter is the play\'s too', live1.clock?.includes('Q4'), false)
// The play feed zero-pads its clock where the scoreboard does not, so the
// header must not silently gain a digit by changing source.
check('without picking up the feed\'s zero padding', live1.clock?.includes('01:59'), false)
check('the scoreboard clock is not shown', live1.clock?.includes('0:30'), false)
// The receipt: the play the header is quoting is on screen below it.
check('and that play is in the list below', (await newestPlay())?.includes('01:59'), true)
// The newest row is a timeout with no situation of its own, so the spot
// comes from the snap before it — still a row in the list, still not ahead.
check('a newest row with no spot falls back to the last one that had it',
  (await newestPlay())?.includes('Timeout'), true)

// --- Down and distance follows the play list too --------------------------
// The whole reason this suite exists: the scoreboard says 3rd & 2 at the
// MIA 47, the newest play left 1st & 10 at the MIA 40. The play wins, so
// nothing above the list describes a snap the list has not reached.
check('down and distance comes from the newest play', live1.downs?.startsWith('1st & 10'), true)
check('and not from the scoreboard running ahead', live1.downs?.includes('3rd & 2'), false)
check('nor does the ball sit where the scoreboard put it', live1.downs?.includes('MIA 47'), false)
check('it sits where the play left it', live1.downs?.includes('MIA 40'), true)
// The timeout row's own down and distance came with no spot, so it was
// skipped entirely rather than used to place the ball.
check('a situation with no spot is not used at all', live1.downs?.includes('2nd & 7'), false)
await page.screenshot({ path: '/tmp/claude-0/-home-user-CFB-Scoreboard/c9537513-1e0b-58a9-8bcd-b6e707f00768/scratchpad/live-header.png' })
await close()

// --- A live game whose plays carry no spot --------------------------------
// The scoreboard has a situation and the play feed does not. Nothing is
// drawn: borrowing the scoreboard here is borrowing the very thing that
// runs ahead of the list. (The panel is already closed above.)
await openGame('ALA')
const spotless = await header()
console.log('   spotless header:', JSON.stringify(spotless))
check('no spot in the feed means no down and distance', spotless.downs, null)
check('and the scoreboard\'s is not borrowed', spotless.downs?.includes('3rd & 2') ?? false, false)
await close()

// --- A finished game still takes the complete score -----------------------
// The opposite rule, and it has to keep working: the feed stops short at
// 14-19 and the scoreboard has the real 20-19. Reading the play here would
// print Ohio State the winner of a game Michigan won.
await openGame('OSU')
const done = await header()
console.log('   final header:', JSON.stringify(done))
check('a finished game takes the higher of the two', done.score, ['19', '20'])

if (errs.length) { fails += 1; console.log('PAGE ERRORS:', errs) }
await browser.close()
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
