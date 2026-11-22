/**
 * A negative stat still draws a comparison bar.
 *
 * Reported from a live game: Utah at TCU in the first quarter, Utah on
 * -23 total yards against 30 after a sack and a penalty. The bar vanished
 * — a share of a whole has no room for a negative — so the comparison
 * disappeared at exactly the moment it was most lopsided.
 *
 * A negative counts as nothing now, which hands the other side the whole
 * bar. That is what having gone backwards looks like.
 *
 * The numbers below are the reported ones, verbatim from that screen.
 *
 * Run: npm run dev -- --port 5199   then   node test/ui/negative-stats.mjs
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const PORT = process.env.PORT || 5199
const DAY = 86400000
const iso = (o) => new Date(Date.now() + o * DAY).toISOString().slice(0, 10)
const TODAY = iso(0)

const team = (id, abbr) => ({
  id, location: abbr, name: abbr, abbreviation: abbr,
  displayName: abbr, shortDisplayName: abbr, color: '0C2340',
})
const UTAH = team('254', 'UTAH')
const TCU = team('2628', 'TCU')

const live = { clock: 564, displayClock: '9:24', period: 1, type: { id: '2', name: 'STATUS_IN_PROGRESS', state: 'in', completed: false, description: 'In Progress', detail: 'Q1', shortDetail: 'Q1 9:24' } }

// Utah's numbers are the reported ones: behind on total and rushing yards,
// and negative on both. Rushing yards/play is negative on one side too.
const stats = (total, rushing, rushYpp, turnovers) => [
  { name: 'totalYards', displayValue: total },
  { name: 'netPassingYards', displayValue: '0' },
  { name: 'rushingYards', displayValue: rushing },
  { name: 'rushingAttempts', displayValue: '4' },
  { name: 'turnovers', displayValue: turnovers },
  { name: 'totalPenaltiesYards', displayValue: '2-25' },
  { name: 'possessionTime', displayValue: '3:19' },
  { name: 'yardsPerRushAttempt', displayValue: rushYpp },
]
const summary = {
  header: { competitions: [{ playByPlaySource: 'none' }] },
  boxscore: {
    teams: [
      { team: { id: '2628', abbreviation: 'TCU', displayName: 'TCU' }, statistics: stats('30', '9', '4.5', '1') },
      { team: { id: '254', abbreviation: 'UTAH', displayName: 'UTAH' }, statistics: stats('-23', '-12', '-3.0', '0') },
    ],
    players: [],
  },
}

const scoreboard = {
  leagues: [{ calendar: [{ label: 'R', entries: [{ label: 'Week 13', startDate: `${iso(-3)}T07:00Z`, endDate: `${iso(4)}T06:59Z` }] }] }],
  season: { year: 2026, type: 2 }, week: { number: 13 },
  events: [{
    id: 'g1', date: `${TODAY}T19:00Z`, name: 'x', shortName: 'UTAH @ TCU', status: live,
    competitions: [{
      id: 'g1', date: `${TODAY}T19:00Z`, status: live, venue: { fullName: 'Stadium' }, broadcasts: [{ names: ['Fox'] }],
      competitors: [
        { id: 'h', homeAway: 'home', team: TCU, score: '0', records: [{ type: 'total', summary: '7-3' }] },
        { id: 'a', homeAway: 'away', team: UTAH, score: '0', records: [{ type: 'total', summary: '9-1' }] },
      ],
    }],
  }],
}

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.route('**/site.api.espn.com/**', (r) => {
  const u = r.request().url()
  if (u.includes('/summary?')) return r.fulfill({ json: summary })
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

await page.goto(`http://localhost:${PORT}/CFB-Scoreboard/`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(600)
await page.click('.tab-bar__item:has-text("Scoreboard")')
await page.waitForSelector('.game-card')
await page.waitForTimeout(700)
await page.click('.game-card')
await page.waitForSelector('.game-stats__stat-row')
await page.waitForTimeout(800)

const rows = await page.evaluate(() =>
  [...document.querySelectorAll('.game-stats__stat-row')].map((row) => {
    const values = [...row.querySelectorAll('.game-stats__stat-value')].map((v) => v.textContent.trim())
    const segments = [...row.querySelectorAll('.game-stats__stat-bar-segment')].map((s) =>
      Math.round(parseFloat(s.style.width)),
    )
    return { label: row.querySelector('.game-stats__stat-label').textContent.trim(), away: values[0], home: values[1], segments }
  }),
)
console.log('   rows:', JSON.stringify(rows))

const total = rows.find((r) => r.label === 'Total Yards')
const rush = rows.find((r) => r.label === 'Rushing Yards')

// The reported row. Utah away on -23, TCU home on 30.
check('the reported row still shows its values', [total?.away, total?.home], ['-23', '30'])
check('and it draws a bar at all', total?.segments.length, 2)
// The negative counts as nothing, so the whole bar goes to the other team.
check('the negative side gets none of it', total?.segments[0], 0)
check('and the other team gets all of it', total?.segments[1], 100)

// Same for rushing yards, -12 against 9.
check('a second negative row behaves the same', [rush?.away, rush?.home], ['-12', '9'])
check('with the whole bar to the positive side', rush?.segments, [0, 100])

// Every row draws a bar now — none of them bail out.
const barless = rows.filter((r) => r.segments.length !== 2).map((r) => r.label)
check('no row is left without a bar', barless, [])

await page.screenshot({ path: '/tmp/claude-0/-home-user-CFB-Scoreboard/c9537513-1e0b-58a9-8bcd-b6e707f00768/scratchpad/negative-stats.png' })
if (errs.length) { fails += 1; console.log('PAGE ERRORS:', errs) }
await browser.close()
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
