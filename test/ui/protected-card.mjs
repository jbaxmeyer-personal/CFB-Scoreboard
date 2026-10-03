/**
 * A spoiler-protected team must not have its record on any card.
 *
 * Notre Dame protected, game over: the card hid the score and read
 * "11:00 AM", then printed ND 5-0 against UNC 2-2 — which says who won.
 *
 * And the half of it the first fix missed: a record counts the games
 * already played, so ND 5-0 beside next week's opponent says they won
 * today, on a game that has not kicked off. The opponent keeps theirs.
 *
 * Run: npm run dev -- --port 5199   then   node test/ui/protected-card.mjs
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const PORT = process.env.PORT || 5199
const TODAY = new Date().toISOString().slice(0, 10)
// Real ESPN team ids, because that is what the protected list holds: one
// id per team, the same on every fixture they appear in. An earlier version
// of this file minted an id per event, which quietly made every card a
// different team and hid the bug it was supposed to catch.
const IDS = { ND: '87', UNC: '153', PUR: '2509', MSST: '344', ALA: '333' }
const team = (abbr) => ({
  id: IDS[abbr], location: abbr, name: abbr, abbreviation: abbr, displayName: abbr, shortDisplayName: abbr,
  color: '0C2340', alternateColor: 'C99700', logo: `https://a.espncdn.com/i/teamlogos/ncaa/500/${IDS[abbr]}.png`,
})
const final = { clock: 0, displayClock: '0:00', period: 4, type: { id: '3', name: 'STATUS_FINAL', state: 'post', completed: true, description: 'Final', detail: 'Final', shortDetail: 'Final' } }
const scheduled = { clock: 0, displayClock: '0:00', period: 0, type: { id: '1', name: 'STATUS_SCHEDULED', state: 'pre', completed: false, description: 'Scheduled', detail: 'Sat, October 10th at 2:30 PM EDT', shortDetail: '10/10 - 2:30 PM EDT' } }
const ev = (id, home, away, hs, as, hr, ar, date = `${TODAY}T15:00Z`, status = final) => ({
  id, date, name: 'x', shortName: `${away} @ ${home}`, status,
  competitions: [{ id, date, status, venue: { fullName: 'Stadium' }, broadcasts: [{ names: ['ESPN'] }],
    competitors: [
      { id: `${id}h`, homeAway: 'home', team: team(home), score: String(hs), records: [{ type: 'total', summary: hr }] },
      { id: `${id}a`, homeAway: 'away', team: team(away), score: String(as), records: [{ type: 'total', summary: ar }] },
    ] }],
})
// The protected game, and a control beside it.
const DAY = 86400000
const iso = (o) => new Date(Date.now() + o * DAY).toISOString().slice(0, 10)
const scoreboard = {
  leagues: [{ calendar: [{ label: 'Regular Season', entries: [
    { label: 'Week 6', startDate: `${iso(-3)}T07:00Z`, endDate: `${iso(4)}T06:59Z` },
    { label: 'Week 7', startDate: `${iso(4)}T07:00Z`, endDate: `${iso(11)}T06:59Z` },
  ] }] }],
  season: { year: 2026, type: 2 }, week: { number: 6 },
  events: [
    ev('nd', 'UNC', 'ND', 17, 24, '2-2', '5-0'),
    ev('ok', 'MSST', 'ALA', 23, 56, '1-4', '5-0'),
    // Notre Dame's next fixture, a week out and not kicked off. ESPN's
    // record for them already counts today's win.
    ev('next', 'PUR', 'ND', 0, 0, '2-3', '5-0', `${iso(7)}T18:30Z`, scheduled),
  ],
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
// Protect Notre Dame, the way the report had it.
await page.addInitScript(() => {
  try {
    localStorage.setItem('slate.settings.v1', JSON.stringify({ spoilers: { globalEnabled: false, protectedGameIds: [], protectedTeamIds: ['87'] } }))
  } catch { /* ignore */ }
})
await page.route('**/site.api.espn.com/**', (r) =>
  r.fulfill({ json: r.request().url().includes('/summary?') ? { header: { competitions: [{ playByPlaySource: 'none' }] }, boxscore: {} } : scoreboard }))
await page.route('**/sports.core.api.espn.com/**', (r) => r.fulfill({ json: { items: [] } }))
await page.route('**/a.espncdn.com/**', (r) => r.abort())

let fails = 0
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) fails += 1
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` !== ${JSON.stringify(expected)}`}`)
}

await page.goto(`http://localhost:${PORT}/CFB-Scoreboard/`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(700)
await page.click('.tab-bar__item:has-text("Scoreboard")')
await page.waitForTimeout(1200)
await page.waitForSelector('.game-card')

const card = await page.evaluate(() => {
  const nd = [...document.querySelectorAll('.game-card')].find((c) => c.textContent.includes('ND'))
  return {
    text: nd.textContent.replace(/\s+/g, ' ').trim(),
    records: [...nd.querySelectorAll('.game-card__team-record')].map((r) => r.textContent.trim()),
    scores: [...nd.querySelectorAll('.game-card__score')].map((r) => r.textContent.trim()),
  }
})
console.log('   card:', JSON.stringify(card))
check('the protected card shows no records at all', card.records, [])
check('and no scores', card.scores, [])
check('so neither record appears anywhere on it', /5-0|2-2/.test(card.text), false)
check('and it is not marked final', /FINAL/i.test(card.text), false)

// The reported miss, reached the way the report found it: next week's tab.
// An upcoming card is
// where records are *meant* to show, so this one has to show Purdue's and
// withhold Notre Dame's.
await page.click('.week-tabs__tab:has-text("Week 7")')
await page.waitForTimeout(1200)
const future = await page.evaluate(() => {
  const nd = [...document.querySelectorAll('.game-card')].find((c) => c.textContent.includes('PUR'))
  if (!nd) return null
  return {
    text: nd.textContent.replace(/\s+/g, ' ').trim(),
    records: [...nd.querySelectorAll('.game-card__team-record')].map((r) => r.textContent.trim()),
  }
})
console.log('   next week:', JSON.stringify(future))
check('the next fixture is on screen', future !== null, true)
check('and shows only the opponent\u2019s record', future?.records, ['2-3'])
check('so the protected season is nowhere on it', /5-0/.test(future?.text ?? ''), false)

await page.screenshot({ path: '/tmp/claude-0/-home-user-CFB-Scoreboard/c9537513-1e0b-58a9-8bcd-b6e707f00768/scratchpad/protected.png' })
if (errs.length) { fails += 1; console.log('PAGE ERRORS:', errs) }
await browser.close()
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
