/**
 * The band under the tab bar, on a cold relaunch.
 *
 * Reported three times. Installed to the home screen, close Slate from the
 * switcher, reopen it on Standings, and a dark band sat under the tab bar:
 * iOS handed the page a viewport 62px short of the screen (the top inset)
 * and never fired a resize to correct it.
 *
 * This reproduces those readings — standalone, a 402x812 viewport on a
 * 402x874 screen — and checks two things:
 *   1. the column is sized to the screen anyway, so the bar reaches the
 *      bottom edge;
 *   2. even with --app-height taken away entirely (every number lying),
 *      what shows under the bar is the bar's own colour, not a band.
 *
 * Run: npm run dev -- --port 5199   then   node test/ui/app-height.mjs
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const PORT = process.env.PORT || 5199
// Same fixture as tabs.mjs: a real scoreboard, so the app renders.
const DAY = 86400000
const iso = (o) => new Date(Date.now() + o * DAY).toISOString().slice(0, 10)
const TODAY = iso(0)

const team = (id, abbr) => ({
  id, location: abbr, name: abbr, abbreviation: abbr, displayName: abbr, shortDisplayName: abbr, color: '333333',
})
const final = { clock: 0, displayClock: '0:00', period: 4, type: { id: '3', name: 'STATUS_FINAL', state: 'post', completed: true, description: 'Final', detail: 'Final', shortDetail: 'Final' } }
// Enough games that the Scoreboard is taller than the screen and can be
// scrolled independently of Standings.
const events = Array.from({ length: 14 }, (_, i) => {
  const id = `g${i}`
  return {
    id, date: `${TODAY}T15:00Z`, name: 'x', shortName: `A${i} @ B${i}`, status: final,
    competitions: [{
      id, date: `${TODAY}T15:00Z`, status: final, venue: { fullName: 'Stadium' }, broadcasts: [{ names: ['ESPN'] }],
      competitors: [
        // The first game is a real SEC matchup, so a conference shield is
        // drawn on that tile — the shield is the only thing that was
        // reacting to a touch, so a fixture without one cannot catch it.
        { id: `${id}h`, homeAway: 'home', team: i === 0 ? team('61', 'UGA') : team(`${1000 + i}`, `H${i}`), score: '21', records: [{ type: 'total', summary: '5-1' }] },
        { id: `${id}a`, homeAway: 'away', team: i === 0 ? team('333', 'ALA') : team(`${2000 + i}`, `A${i}`), score: '17', records: [{ type: 'total', summary: '4-2' }] },
      ],
    }],
  }
})
const scoreboard = {
  leagues: [{ calendar: [{ label: 'Regular Season', entries: [{ label: 'Week 11', startDate: `${iso(-3)}T07:00Z`, endDate: `${iso(4)}T06:59Z` }] }] }],
  season: { year: 2026, type: 2 },
  week: { number: 11 },
  events,
}

const SCREEN = { width: 402, height: 874 }
const SHORT = { width: 402, height: 812 }

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: SHORT, screen: SCREEN, deviceScaleFactor: 1, hasTouch: true, isMobile: true })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.addInitScript(() => {
  Object.defineProperty(window.navigator, 'standalone', { get: () => true })
})
await page.route('**/site.api.espn.com/**', (r) => {
  const url = r.request().url()
  if (url.includes('/standings') || url.includes('/rankings')) return r.fulfill({ json: {} })
  if (url.includes('/summary?')) return r.fulfill({ json: { header: { competitions: [{ playByPlaySource: 'none' }] }, boxscore: {} } })
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
await page.waitForTimeout(700)
await page.click('.tab-bar__item:has-text("Standings")')
await page.waitForTimeout(700)

const measure = () => page.evaluate(() => {
  const bar = document.querySelector('.tab-bar').getBoundingClientRect()
  return {
    appHeight: document.documentElement.style.getPropertyValue('--app-height'),
    rootHeight: Math.round(document.getElementById('root').getBoundingClientRect().height),
    // Relative to the column: Chromium's viewport really is 812, where an
    // iPhone's is the full screen and only reports 812, so the page can be
    // scrolled here. What matters is the bar ending where the column does.
    barBottom: Math.round(bar.bottom - document.getElementById('root').getBoundingClientRect().top),
    htmlBg: getComputedStyle(document.documentElement).backgroundColor,
    barBg: getComputedStyle(document.querySelector('.tab-bar')).backgroundColor,
  }
})

const m = await measure()
console.log('   ', JSON.stringify(m))
check('the column is sized to the screen, not the short viewport', m.appHeight, '874px')
check('so it is the screen tall', m.rootHeight, SCREEN.height)
check('and the tab bar ends on its bottom edge', m.barBottom, SCREEN.height)
check('what sits under the column is the tab bar colour', m.htmlBg, m.barBg)

// Worst case: no measurement at all, and the column falls back to a
// viewport unit that is short. The strip under the bar must still be the
// bar's colour, pixel for pixel.
await page.setViewportSize(SHORT)
await page.evaluate(() => {
  const s = document.createElement('style')
  s.textContent = '#root{height:750px!important}'
  document.head.appendChild(s)
})
await page.waitForTimeout(200)
const shot = await page.screenshot({ clip: { x: 0, y: 700, width: 402, height: 112 } })
const px = await page.evaluate(async (b64) => {
  const img = new Image()
  img.src = `data:image/png;base64,${b64}`
  await img.decode()
  const c = document.createElement('canvas')
  c.width = img.width; c.height = img.height
  const x = c.getContext('2d')
  x.drawImage(img, 0, 0)
  const at = (y) => [...x.getImageData(200, y, 1, 1).data.slice(0, 3)].join(',')
  // 745: inside the bar's bottom padding. 790: below the short column.
  return { inBar: at(45), below: at(90) }
}, shot.toString('base64'))
console.log('   ', JSON.stringify(px))
check('a short column shows as a taller bar, not a band', px.below, px.inBar)

check('no page errors', errs, [])
await browser.close()
process.exit(fails ? 1 : 0)
