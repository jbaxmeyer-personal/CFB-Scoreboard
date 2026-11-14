/**
 * Timeouts left, on a live game's expanded view.
 *
 * Counted from the play-by-play rather than read off a field: ESPN posts a
 * timeout as a play of its own, and three a half minus the ones charged in
 * the half being played cannot come out inverted. This suite is the part
 * the unit tests can't reach — that the count survives the real pipeline,
 * where the play text has been through the formation/clock stripping on
 * its way to the screen, and that the teams are matched on the names ESPN
 * actually sends rather than on the ids the fixture made up.
 *
 * Three pips a side, spent ones kept in place so the row holds still as
 * they go. Only while the game is being played — a finished game's
 * timeouts are not a fact anyone wants — and never on a protected game,
 * where the whole live state is withheld.
 *
 * Run: npm run dev -- --port 5199   then   node test/ui/timeouts.mjs
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const PORT = process.env.PORT || 5199
const DAY = 86400000
const iso = (o) => new Date(Date.now() + o * DAY).toISOString().slice(0, 10)
const TODAY = iso(0)

// The names ESPN sends, not the abbreviation three times over: the count
// matches a timeout to a team by the team's own names, so a fixture that
// called everything "ND" would pass whatever the matching did.
const team = (id, abbr, short, display) => ({
  id, location: short, name: short, abbreviation: abbr,
  displayName: display, shortDisplayName: short, color: '0C2340',
})
const ND = team('87', 'ND', 'Notre Dame', 'Notre Dame Fighting Irish')
const MIA = team('2390', 'MIA', 'Miami', 'Miami Hurricanes')
const UGA = team('61', 'UGA', 'Georgia', 'Georgia Bulldogs')
const ALA = team('333', 'ALA', 'Alabama', 'Alabama Crimson Tide')
const MICH = team('130', 'MICH', 'Michigan', 'Michigan Wolverines')
const OSU = team('194', 'OSU', 'Ohio State', 'Ohio State Buckeyes')

const live = { clock: 131, displayClock: '2:11', period: 4, type: { id: '2', name: 'STATUS_IN_PROGRESS', state: 'in', completed: false, description: 'In Progress', detail: 'Q4', shortDetail: 'Q4 2:11' } }
const final = { clock: 0, displayClock: '0:00', period: 4, type: { id: '3', name: 'STATUS_FINAL', state: 'post', completed: true, description: 'Final', detail: 'Final', shortDetail: 'Final' } }

const game = (id, home, away, status) => ({
  id, date: `${TODAY}T19:00Z`, name: 'x', shortName: `${away.abbreviation} @ ${home.abbreviation}`, status,
  competitions: [{
    id, date: `${TODAY}T19:00Z`, status, venue: { fullName: 'Stadium' }, broadcasts: [{ names: ['NBC'] }],
    competitors: [
      { id: `${id}h`, homeAway: 'home', team: home, score: '21', records: [{ type: 'total', summary: '8-1' }] },
      { id: `${id}a`, homeAway: 'away', team: away, score: '17', records: [{ type: 'total', summary: '8-0' }] },
    ],
  }],
})

const scoreboard = {
  leagues: [{ calendar: [{ label: 'R', entries: [{ label: 'Week 12', startDate: `${iso(-3)}T07:00Z`, endDate: `${iso(4)}T06:59Z` }] }] }],
  season: { year: 2026, type: 2 }, week: { number: 12 },
  events: [
    game('g1', ND, MIA, live),   // live, with timeout plays
    game('g2', UGA, ALA, live),  // live, no timeout plays at all
    game('g3', MICH, OSU, final),
  ],
}

let seq = 0
const play = (period, clock, text) => ({
  id: `p${seq}`, sequenceNumber: String(seq++), text,
  period: { number: period }, clock: { displayValue: clock },
  homeScore: 21, awayScore: 17,
})
const snap = (period, clock) => play(period, clock, '#9 B.Leonard rush middle for 3 yards to the MIA 44')

// Q4 is the second half, so only the Q3/Q4 timeouts count. Notre Dame
// spent one of three; Miami spent two. The first-half ones are in the feed
// precisely so a count that forgot to reset at halftime would be wrong.
const g1Plays = [
  play(1, '12:40', '(12:40) Timeout Notre Dame, clock 12:40'),
  play(2, '00:48', 'Timeout Miami, clock 00:48'),
  snap(3, '11:02'),
  play(3, '07:50', 'Timeout Miami, clock 07:50'),
  snap(3, '04:19'),
  // A timeout called by the defence: whoever had the ball on this drive,
  // the text names who is charged.
  play(4, '06:33', 'Timeout Notre Dame, clock 06:33'),
  play(4, '02:11', 'Shotgun Timeout Miami, clock 02:11'),
  snap(4, '02:11'),
]

const summaryFor = (plays) => ({
  header: { competitions: [{ playByPlaySource: plays ? 'full' : 'none' }] },
  boxscore: {},
  ...(plays ? { drives: { previous: [{ team: { id: '87' }, plays }] } } : {}),
})

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.route('**/site.api.espn.com/**', (r) => {
  const u = r.request().url()
  if (u.includes('/summary?')) {
    // g1 and g3 carry the timeout plays; g2 carries none.
    const withPlays = /event=g1|event=g3/.test(u)
    return r.fulfill({ json: summaryFor(withPlays ? g1Plays : undefined) })
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

const readTimeouts = () =>
  page.evaluate(() => {
    const row = document.querySelector('.expanded-game__timeouts')
    if (!row) return null
    return {
      label: row.querySelector('.expanded-game__timeouts-label').textContent.trim(),
      // [away, home], each as [total pips, how many read as left].
      sides: [...row.querySelectorAll('.expanded-game__timeout-pips')].map((p) => [
        p.querySelectorAll('.expanded-game__timeout-pip').length,
        p.querySelectorAll('.expanded-game__timeout-pip--left').length,
      ]),
      labels: [...row.querySelectorAll('.expanded-game__timeout-pips')].map((p) => p.getAttribute('aria-label')),
    }
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

// --- A live game counts them from the plays -------------------------------
await openGame('MIA')
const liveRow = await readTimeouts()
console.log('   live:', JSON.stringify(liveRow))
check('a live game shows the timeouts', liveRow !== null, true)
check('labelled', liveRow?.label, 'Timeouts')
// Away first, like the score above it. Miami spent two in this half, Notre
// Dame one — and the two first-half ones are not counted against either.
check('three pips a side, spent ones kept in place', liveRow?.sides, [[3, 1], [3, 2]])
check('and the counts are spoken for a screen reader', liveRow?.labels, ['Away 1 timeout left', 'Home 2 timeouts left'])
// The play rows are the receipt: the same feed, on screen.
const timeoutRows = await page.evaluate(() =>
  [...document.querySelectorAll('.game-stats__play-row')]
    .map((n) => n.textContent.trim())
    .filter((t) => /Timeout (Notre Dame|Miami)/i.test(t)))
console.log('   timeout plays on screen:', JSON.stringify(timeoutRows))
check('every timeout in the feed is a play row', timeoutRows.length, 5)
await page.screenshot({ path: '/tmp/claude-0/-home-user-CFB-Scoreboard/c9537513-1e0b-58a9-8bcd-b6e707f00768/scratchpad/timeouts-live.png' })
await close()

// --- A live game with no play feed ---------------------------------------
// The count comes from the plays, so with no plays there is nothing to
// count. A live game always has plays, which makes an empty feed a missing
// one — and "three each" off a missing feed would be invented.
await openGame('ALA')
check('a live game with no play feed shows no row', await readTimeouts(), null)
await close()

// --- A finished game -----------------------------------------------------
// Same plays underneath; the row is gone because the game is over.
await openGame('OSU')
check('a finished game shows no row', await readTimeouts(), null)
await close()

// --- Protected ------------------------------------------------------------
// The whole live state is withheld, timeouts with it — two left is a fact
// about a game in progress, which is what being protected hides.
await page.evaluate(() =>
  localStorage.setItem('slate.settings.v1', JSON.stringify({ spoilers: { globalEnabled: false, protectedGameIds: [], protectedTeamIds: ['87'] } })),
)
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForSelector('.game-card')
await page.waitForTimeout(900)
await openGame('MIA')
check('a protected live game shows no timeouts', await readTimeouts(), null)

await page.screenshot({ path: '/tmp/claude-0/-home-user-CFB-Scoreboard/c9537513-1e0b-58a9-8bcd-b6e707f00768/scratchpad/timeouts.png' })
if (errs.length) { fails += 1; console.log('PAGE ERRORS:', errs) }
await browser.close()
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
