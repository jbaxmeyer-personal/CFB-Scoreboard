/**
 * Timeouts left, on a live game's expanded view.
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

const team = (id, abbr) => ({ id, location: abbr, name: abbr, abbreviation: abbr, displayName: abbr, shortDisplayName: abbr, color: '0C2340' })
const live = { clock: 131, displayClock: '2:11', period: 4, type: { id: '2', name: 'STATUS_IN_PROGRESS', state: 'in', completed: false, description: 'In Progress', detail: 'Q4', shortDetail: 'Q4 2:11' } }
const final = { clock: 0, displayClock: '0:00', period: 4, type: { id: '3', name: 'STATUS_FINAL', state: 'post', completed: true, description: 'Final', detail: 'Final', shortDetail: 'Final' } }

const game = (id, home, away, homeId, awayId, status, situation) => ({
  id, date: `${TODAY}T19:00Z`, name: 'x', shortName: `${away} @ ${home}`, status,
  competitions: [{
    id, date: `${TODAY}T19:00Z`, status, situation, venue: { fullName: 'Stadium' }, broadcasts: [{ names: ['NBC'] }],
    competitors: [
      { id: `${id}h`, homeAway: 'home', team: team(homeId, home), score: '21', records: [{ type: 'total', summary: '8-1' }] },
      { id: `${id}a`, homeAway: 'away', team: team(awayId, away), score: '17', records: [{ type: 'total', summary: '8-0' }] },
    ],
  }],
})

const scoreboard = {
  leagues: [{ calendar: [{ label: 'R', entries: [{ label: 'Week 12', startDate: `${iso(-3)}T07:00Z`, endDate: `${iso(4)}T06:59Z` }] }] }],
  season: { year: 2026, type: 2 }, week: { number: 12 },
  events: [
    // Live: Notre Dame two left, Miami all three.
    game('g1', 'ND', 'MIA', '87', '2390', live, { homeTimeouts: 2, awayTimeouts: 3 }),
    // Live with no timeouts in the payload at all.
    game('g2', 'UGA', 'ALA', '61', '333', live, { down: 2, distance: 7 }),
    // Finished, but the payload still carries them.
    game('g3', 'MICH', 'OSU', '130', '194', final, { homeTimeouts: 1, awayTimeouts: 0 }),
  ],
}

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.route('**/site.api.espn.com/**', (r) => {
  const u = r.request().url()
  if (u.includes('/summary?')) return r.fulfill({ json: { header: { competitions: [{ playByPlaySource: 'none' }] }, boxscore: {} } })
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
  await page.waitForTimeout(700)
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

// --- A live game shows them ----------------------------------------------
await openGame('MIA')
const liveRow = await readTimeouts()
console.log('   live:', JSON.stringify(liveRow))
check('a live game shows the timeouts', liveRow !== null, true)
check('labelled', liveRow?.label, 'Timeouts')
// Away first, like the score above it: Miami three of three, ND two of three.
check('three pips a side, spent ones kept in place', liveRow?.sides, [[3, 3], [3, 2]])
check('and the counts are spoken for a screen reader', liveRow?.labels, ['Away 3 timeouts left', 'Home 2 timeouts left'])
await page.screenshot({ path: '/tmp/claude-0/-home-user-CFB-Scoreboard/c9537513-1e0b-58a9-8bcd-b6e707f00768/scratchpad/timeouts-live.png' })
await close()

// --- No timeouts in the payload ------------------------------------------
await openGame('ALA')
check('a live game without them shows no row', await readTimeouts(), null)
await close()

// --- A finished game -----------------------------------------------------
await openGame('OSU')
check('a finished game shows no row either', await readTimeouts(), null)
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
