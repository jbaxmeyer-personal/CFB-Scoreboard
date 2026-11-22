/**
 * Overtime on a card, and on the expanded game.
 *
 * Reported from a live board: UCLA at Michigan read "Q5 0:00" in the first
 * overtime. ESPN numbers overtime from period 5, so the quarter form kept
 * counting past the four that exist.
 *
 * The status below is verbatim from ESPN's scoreboard feed for that game —
 * period 5, clock "0:00", and ESPN's own label "OT". No time is shown
 * because no clock runs in a college overtime.
 *
 * Run: npm run dev -- --port 5199   then   node test/ui/overtime.mjs
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
const UCLA = team('26', 'UCLA', 'UCLA', 'UCLA Bruins')
const MICH = team('130', 'MICH', 'Michigan', 'Michigan Wolverines')
const IOWA = team('2294', 'IOWA', 'Iowa', 'Iowa Hawkeyes')
const ILL = team('356', 'ILL', 'Illinois', 'Illinois Fighting Illini')
const LSU = team('99', 'LSU', 'LSU', 'LSU Tigers')
const TENN = team('2633', 'TENN', 'Tennessee', 'Tennessee Volunteers')

// Verbatim from the feed: period 5, clock "0:00", detail "OT".
const ot1 = { clock: 0, displayClock: '0:00', period: 5, type: { id: '2', name: 'STATUS_IN_PROGRESS', state: 'in', completed: false, description: 'In Progress', detail: 'OT', shortDetail: 'OT' } }
const ot3 = { clock: 0, displayClock: '0:00', period: 7, type: { id: '2', name: 'STATUS_IN_PROGRESS', state: 'in', completed: false, description: 'In Progress', detail: '3OT', shortDetail: '3OT' } }
const q4 = { clock: 60, displayClock: '1:00', period: 4, type: { id: '2', name: 'STATUS_IN_PROGRESS', state: 'in', completed: false, description: 'In Progress', detail: '1:00 - 4th Quarter', shortDetail: '1:00 - 4th' } }

const game = (id, home, away, status) => ({
  id, date: `${TODAY}T19:00Z`, name: 'x', shortName: `${away.abbreviation} @ ${home.abbreviation}`, status,
  competitions: [{
    id, date: `${TODAY}T19:00Z`, status, venue: { fullName: 'Stadium' }, broadcasts: [{ names: ['CBS'] }],
    competitors: [
      { id: `${id}h`, homeAway: 'home', team: home, score: '10', records: [{ type: 'total', summary: '8-1' }] },
      { id: `${id}a`, homeAway: 'away', team: away, score: '10', records: [{ type: 'total', summary: '8-0' }] },
    ],
  }],
})

const scoreboard = {
  leagues: [{ calendar: [{ label: 'R', entries: [{ label: 'Week 13', startDate: `${iso(-3)}T07:00Z`, endDate: `${iso(4)}T06:59Z` }] }] }],
  season: { year: 2026, type: 2 }, week: { number: 13 },
  events: [
    game('g1', MICH, UCLA, ot1),
    game('g2', ILL, IOWA, ot3),
    game('g3', TENN, LSU, q4),
  ],
}

let seq = 0
const play = (period, clock, text) => ({
  id: `p${seq}`, sequenceNumber: String(seq++), text,
  period: { number: period }, clock: { displayValue: clock },
  homeScore: 10, awayScore: 10,
  end: { team: { id: '130' }, down: 1, distance: 10, yardsToEndzone: 25, shortDownDistanceText: '1st & 10', possessionText: 'MICH 25' },
})
const otPlays = [play(5, '0:00', '#1 J.Smith rush middle for 3 yards to the MICH 22')]

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.route('**/site.api.espn.com/**', (r) => {
  const u = r.request().url()
  if (u.includes('/summary?')) return r.fulfill({ json: {
    header: { competitions: [{ playByPlaySource: 'full' }] }, boxscore: {},
    drives: { previous: [{ team: { id: '130' }, plays: otPlays }] },
  } })
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

const cardStatus = (abbr) =>
  page.evaluate((name) => {
    const card = [...document.querySelectorAll('.game-card')].find((c) => c.textContent.includes(name))
    return card?.querySelector('.game-card__status')?.textContent.replace(/\s+/g, ' ').trim() ?? null
  }, abbr)

await page.goto(`http://localhost:${PORT}/CFB-Scoreboard/`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(600)
await page.click('.tab-bar__item:has-text("Scoreboard")')
await page.waitForSelector('.game-card')
await page.waitForTimeout(800)

// --- The reported card ----------------------------------------------------
const first = await cardStatus('UCLA')
console.log('   UCLA card:', JSON.stringify(first))
check('the first overtime reads OT', first, 'OT')
check('not a fifth quarter', first?.includes('Q5') ?? false, false)
// No clock: there is none running, and the feed's "0:00" is a placeholder.
check('and carries no clock', first?.includes('0:00') ?? false, false)

check('a third overtime reads 3OT', await cardStatus('IOWA'), '3OT')
// Regulation is untouched.
check('regulation still reads the quarter and time', await cardStatus('LSU'), 'Q4 1:00')

// --- The expanded game says the same thing --------------------------------
await page.evaluate(() => {
  const card = [...document.querySelectorAll('.game-card')].find((c) => c.textContent.includes('UCLA'))
  card.querySelector('.game-card__trigger').click()
})
await page.waitForSelector('.expanded-game__matchup')
await page.waitForTimeout(900)
const header = await page.evaluate(() =>
  document.querySelector('.expanded-game__clock')?.textContent.replace(/\s+/g, ' ').trim() ?? null)
console.log('   expanded header:', JSON.stringify(header))
check('the expanded game reads OT too', header, 'OT')
check('and not Q5 there either', header?.includes('Q5') ?? false, false)
// The play rows label their period the same way.
const playMeta = await page.evaluate(() =>
  document.querySelector('.game-stats__play-meta')?.textContent.replace(/\s+/g, ' ').trim() ?? null)
console.log('   play row:', JSON.stringify(playMeta))
check('a play row in overtime says OT', playMeta?.includes('OT') ?? false, true)
check('and not Q5', playMeta?.includes('Q5') ?? false, false)

await page.screenshot({ path: '/tmp/claude-0/-home-user-CFB-Scoreboard/c9537513-1e0b-58a9-8bcd-b6e707f00768/scratchpad/overtime.png' })
if (errs.length) { fails += 1; console.log('PAGE ERRORS:', errs) }
await browser.close()
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
