/**
 * Penalties and penalty yards on the expanded game.
 *
 * Two rows from one ESPN key ("7-55"), each with the bar favouring the
 * team with *fewer* — the opposite of every yardage row above them.
 *
 * The bar is what this is really about. It reads an "X-Y" value as a
 * success rate, the way 3rd Down % is drawn, so the combined string
 * reaching it unsplit would show seven penalties as 13% — and the
 * segment would favour the wrong team into the bargain.
 *
 * Run: npm run dev -- --port 5199   then   node test/ui/penalties.mjs
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const PORT = process.env.PORT || 5199
const DAY = 86400000
const iso = (o) => new Date(Date.now() + o * DAY).toISOString().slice(0, 10)
const TODAY = iso(0)

const team = (id, abbr) => ({
  id, location: abbr, name: abbr, abbreviation: abbr, displayName: abbr, shortDisplayName: abbr, color: '0C2340',
})
const final = { clock: 0, displayClock: '0:00', period: 4, type: { id: '3', name: 'STATUS_FINAL', state: 'post', completed: true, description: 'Final', detail: 'Final', shortDetail: 'Final' } }
const scoreboard = {
  leagues: [{ calendar: [{ label: 'R', entries: [{ label: 'Week 11', startDate: `${iso(-3)}T07:00Z`, endDate: `${iso(4)}T06:59Z` }] }] }],
  season: { year: 2026, type: 2 }, week: { number: 11 },
  events: [{
    id: 'g1', date: `${TODAY}T19:00Z`, name: 'x', shortName: 'MIA @ ND', status: final,
    competitions: [{
      id: 'g1', date: `${TODAY}T19:00Z`, status: final, venue: { fullName: 'Stadium' }, broadcasts: [{ names: ['NBC'] }],
      competitors: [
        { id: 'h', homeAway: 'home', team: team('87', 'ND'), score: '24', records: [{ type: 'total', summary: '8-1' }] },
        { id: 'a', homeAway: 'away', team: team('2390', 'MIA'), score: '17', records: [{ type: 'total', summary: '8-0' }] },
      ],
    }],
  }],
}

// Notre Dame flagged nine times for 45; Miami three times for 50. The two
// rows disagree about who is ahead, which is the reason there are two.
const stats = (penalties, totalYards) => [
  // Different per team on purpose: a control row where both sides match
  // is 50/50 whether or not it is inverted, and proves nothing about
  // which direction these rows run.
  { name: 'totalYards', displayValue: totalYards },
  { name: 'turnovers', displayValue: '1' },
  { name: 'totalPenaltiesYards', displayValue: penalties },
  { name: 'possessionTime', displayValue: '30:00' },
]
const summary = {
  header: { competitions: [{ playByPlaySource: 'none' }] },
  boxscore: {
    teams: [
      { team: { id: '87', abbreviation: 'ND', displayName: 'ND' }, statistics: stats('9-45', '300') },
      { team: { id: '2390', abbreviation: 'MIA', displayName: 'MIA' }, statistics: stats('3-50', '100') },
    ],
    players: [],
  },
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

const read = await page.evaluate(() =>
  [...document.querySelectorAll('.game-stats__stat-row')].map((row) => {
    const values = [...row.querySelectorAll('.game-stats__stat-value')].map((v) => v.textContent.trim())
    const segments = [...row.querySelectorAll('.game-stats__stat-bar-segment')].map((s) =>
      Math.round(parseFloat(s.style.width)),
    )
    return { label: row.querySelector('.game-stats__stat-label').textContent.trim(), away: values[0], home: values[1], segments }
  }),
)
console.log('   rows:', JSON.stringify(read))

const penalties = read.find((r) => r.label === 'Penalties')
const yards = read.find((r) => r.label === 'Penalty Yards')
check('penalties are on the comparison', [penalties?.away, penalties?.home], ['3', '9'])
check('and so are penalty yards', [yards?.away, yards?.home], ['50', '45'])
check('neither row shows the combined string', read.filter((r) => /^\d+-\d+$/.test(r.away)).map((r) => r.label), [])

// Miami took three penalties to Notre Dame's nine, so Miami's segment —
// the away one, drawn first — is the bigger on that row.
check('the bar favours the team with fewer penalties', penalties.segments[0] > penalties.segments[1], true)
// But Miami lost 50 yards to Notre Dame's 45, so on yards it flips.
check('and on yards it flips to the other team', yards.segments[0] < yards.segments[1], true)
// Not read as a rate: 9 of 45 would draw 20/80, not 75/25.
check('the count row is drawn from the count, not from a rate', penalties.segments, [75, 25])

// An ordinary row runs the other way, so the inversion belongs to these
// two rows and is not something done to the whole comparison. Miami 100
// yards to Notre Dame's 300: the away segment is the quarter, not the
// three quarters it would be if this were inverted too.
const total = read.find((r) => r.label === 'Total Yards')
check('an ordinary row still favours the bigger number', total.segments, [25, 75])

await page.screenshot({ path: '/tmp/claude-0/-home-user-CFB-Scoreboard/c9537513-1e0b-58a9-8bcd-b6e707f00768/scratchpad/penalties.png' })
if (errs.length) { fails += 1; console.log('PAGE ERRORS:', errs) }
await browser.close()
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
