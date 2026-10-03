/**
 * The play-by-play must not swallow the page.
 *
 * It was capped, then uncapped when the game became a screen of its own on
 * the argument that one scrolling surface beats a nested one. With a real
 * game's ~180 plays that made the page thousands of pixels tall, and Team
 * Stats and the leaders under it a full game's worth of scrolling away.
 *
 * Run: npm run dev -- --port 5199   then   node test/ui/play-by-play.mjs
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const PORT = process.env.PORT || 5199
const DAY = 86400000
const iso = (o) => new Date(Date.now() + o * DAY).toISOString().slice(0, 10)
const TODAY = iso(0)

const team = (id, abbr) => ({
  id, location: abbr, name: abbr, abbreviation: abbr, displayName: abbr, shortDisplayName: abbr,
  color: '0021A5', alternateColor: 'FA4616', logo: `https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png`,
})
const FLA = team('57', 'FLA')
const MIZ = team('142', 'MIZ')
const live = { clock: 114, displayClock: '1:54', period: 3, type: { id: '2', name: 'STATUS_IN_PROGRESS', state: 'in', completed: false, description: 'In Progress', detail: 'Q3 1:54', shortDetail: 'Q3 1:54' } }

const scoreboard = {
  leagues: [{ calendar: [{ label: 'Regular Season', entries: [{ label: 'Week 6', startDate: `${iso(-3)}T07:00Z`, endDate: `${iso(4)}T06:59Z` }] }] }],
  season: { year: 2026, type: 2 }, week: { number: 6 },
  events: [{ id: '402100', date: `${TODAY}T20:00Z`, name: 'Florida at Missouri', shortName: 'FLA @ MIZ', status: live,
    competitions: [{ id: '402100', date: `${TODAY}T20:00Z`, status: live, venue: { fullName: 'Faurot Field' }, broadcasts: [{ names: ['ABC'] }],
      competitors: [
        { id: '142', homeAway: 'home', team: MIZ, score: '30', curatedRank: { current: 25 }, records: [{ type: 'total', summary: '3-1' }] },
        { id: '57', homeAway: 'away', team: FLA, score: '10', curatedRank: { current: 8 }, records: [{ type: 'total', summary: '4-0' }] },
      ] }] }],
}

// A real game's worth of plays.
const PLAY_COUNT = 180
const plays = []
for (let i = 0; i < PLAY_COUNT; i += 1) {
  plays.push({
    id: `p${i}`, sequenceNumber: String(i),
    text: `#12 A.Philo pass incomplete short right to #15 L.Harpring thrown to Mizzou40 QB hurried by #10 D.Hopkins (play ${i})`,
    period: { number: 1 + Math.floor(i / 60) }, clock: { displayValue: `${14 - (i % 14)}:00` },
    homeScore: 30, awayScore: 10,
  })
}
const st = (o) => Object.entries(o).map(([name, displayValue]) => ({ name, displayValue }))
const BOX = { totalYards: '312', netPassingYards: '198', rushingYards: '114', completionAttempts: '18-27', rushingAttempts: '24', thirdDownEff: '5-11', turnovers: '1', possessionTime: '26:25' }
const summary = {
  header: { competitions: [{ playByPlaySource: 'full', competitors: [
    { homeAway: 'away', team: { id: '57' }, score: '10', linescores: [{ displayValue: '3' }, { displayValue: '7' }, { displayValue: '0' }] },
    { homeAway: 'home', team: { id: '142' }, score: '30', linescores: [{ displayValue: '3' }, { displayValue: '17' }, { displayValue: '10' }] },
  ] }] },
  boxscore: { teams: [{ team: { id: '57', abbreviation: 'FLA' }, statistics: st(BOX) }, { team: { id: '142', abbreviation: 'MIZ' }, statistics: st(BOX) }], players: [] },
  drives: { previous: [{ team: { id: '142' }, plays }] },
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.route('**/site.api.espn.com/**', (r) =>
  r.fulfill({ json: r.request().url().includes('/summary?') ? summary : scoreboard }))
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
await page.waitForTimeout(900)
await page.locator('.game-card__trigger').first().click()
await page.waitForTimeout(1800)
// A live game opens on the full feed already.
await page.waitForSelector('.game-stats__play-row')

const m = await page.evaluate(() => {
  const panel = document.querySelector('.game-detail-panel')
  const list = document.querySelector('.game-stats__plays')
  return {
    rows: document.querySelectorAll('.game-stats__play-row').length,
    listH: list.clientHeight,
    listScrollH: list.scrollHeight,
    listScrolls: list.scrollHeight > list.clientHeight + 4,
    pageH: panel.clientHeight,
    pageScrollH: panel.scrollHeight,
  }
})
console.log('   ', JSON.stringify(m))

check('all 180 plays are still rendered', m.rows, PLAY_COUNT)
check('the feed is its own scroll region', m.listScrolls, true)
check('and is not taller than the screen', m.listH <= m.pageH, true)

// The point of all of it: the sections under the feed are a flick away,
// not a whole game's worth of scrolling. Three screens is generous.
const screens = m.pageScrollH / m.pageH
console.log(`    page is ${screens.toFixed(1)} screens tall`)
check('the page is at most three screens tall', screens <= 3, true)

// Team Stats must actually be reachable by scrolling the page.
await page.evaluate(() => { document.querySelector('.game-detail-panel').scrollTop = 99999 })
await page.waitForTimeout(400)
const teamStatsVisible = await page.evaluate(() => {
  const heads = [...document.querySelectorAll('.game-stats__title')].map((h) => h.textContent.trim())
  const el = [...document.querySelectorAll('.game-stats__title')].find((h) => /team stats/i.test(h.textContent))
  if (!el) return { heads, visible: false }
  const r = el.getBoundingClientRect()
  return { heads, visible: r.top >= 0 && r.bottom <= window.innerHeight }
})
console.log('    sections:', JSON.stringify(teamStatsVisible.heads))
check('Team Stats is on screen at the bottom of the page', teamStatsVisible.visible, true)

// Scrolling the feed must not drag the page with it.
await page.evaluate(() => { document.querySelector('.game-detail-panel').scrollTop = 0 })
await page.waitForTimeout(300)
const pageBefore = await page.evaluate(() => document.querySelector('.game-detail-panel').scrollTop)
await page.evaluate(() => { document.querySelector('.game-stats__plays').scrollTop = 400 })
await page.waitForTimeout(300)
const after = await page.evaluate(() => ({
  list: document.querySelector('.game-stats__plays').scrollTop,
  page: document.querySelector('.game-detail-panel').scrollTop,
}))
check('the feed scrolls on its own', after.list > 300, true)
check('without moving the page', after.page, pageBefore)

await page.screenshot({ path: '/tmp/claude-0/-home-user-CFB-Scoreboard/c9537513-1e0b-58a9-8bcd-b6e707f00768/scratchpad/pbp.png' })
if (errs.length) { fails += 1; console.log('PAGE ERRORS:', errs) }
await browser.close()
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
