/**
 * Slate's opening day, and the stacking order of its time grid.
 *
 *  - Slate opened on whichever day came first in the fetched window, which
 *    starts two days before today, so it landed on games already played.
 *  - Tapping a chip (or its lock) left it riding over the sticky network
 *    badges: the chip's :hover rule raised it above the rail, and a phone
 *    holds :hover on whatever was tapped last.
 *
 * Browser tests are not in `npm test` — they need a dev server and a
 * browser. Run: node test/ui/slate.mjs   (with `npm run dev -- --port 5199`)
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const PORT = process.env.PORT || 5199
const DAY = 86400000
const iso = (o) => new Date(Date.now() + o * DAY).toISOString().slice(0, 10)

const team = (id, abbr) => ({
  id, location: abbr, name: abbr, abbreviation: abbr, displayName: abbr, shortDisplayName: abbr,
  color: '224488', alternateColor: '000000', logo: `https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png`,
})
const pre = (hhmm) => ({ clock: 0, displayClock: '0:00', period: 0, type: { id: '1', name: 'STATUS_SCHEDULED', state: 'pre', completed: false, description: 'Scheduled', detail: hhmm, shortDetail: hhmm } })

/** Games on the day two back (already played) and on today. */
function event(id, dayOffset, hour, net, home, away) {
  const date = `${iso(dayOffset)}T${String(hour).padStart(2, '0')}:00Z`
  const status = pre('11:00 AM')
  return {
    id, date, name: 'x', shortName: `${away} @ ${home}`, status,
    competitions: [{ id, date, status, venue: { fullName: 'Stadium' }, broadcasts: [{ names: [net] }],
      competitors: [
        { id: `${id}h`, homeAway: 'home', team: team(`${id}h`, home) },
        { id: `${id}a`, homeAway: 'away', team: team(`${id}a`, away) },
      ] }],
  }
}
const scoreboard = {
  season: { year: 2026, type: 2 }, week: { number: 6 },
  events: [
    // Two days ago — the day the grid used to open on.
    event('p1', -2, 17, 'ABC', 'OLD', 'PAST'),
    // Today.
    event('t1', 0, 17, 'ABC', 'MSST', 'OLEMISS'),
    event('t2', 0, 17, 'CBS', 'AFA', 'NAVY'),
    event('t3', 0, 18, 'BTN', 'WIS', 'MSU'),
  ],
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
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

// A day chosen two days ago, left behind in storage by a previous visit.
await page.addInitScript((stale) => {
  try { localStorage.setItem('slate.selectedDate.v1', stale) } catch { /* ignore */ }
}, iso(-2))
await page.goto(`http://localhost:${PORT}/CFB-Scoreboard/`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)

// 1) It opens on today, not on the first day of the window and not on the
//    day left in storage. The label is compared in full: a substring check
//    like "contains the date number" passes on the 13th as well as the 3rd.
const label = (offset) => {
  const d = new Date(Date.now() + offset * DAY)
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]
  return `${day} ${d.getMonth() + 1}/${d.getDate()}`
}
const active = (await page.locator('.day-tabs__tab--active').first().innerText()).replace(/\s+/g, ' ').trim()
check('Slate opens on today', active, label(0))
check('not the first day of the window, two days back', active === label(-2), false)

// 2) The chip must stay under the sticky network rail.
//
// The trigger is :hover, not the click — iOS leaves whatever was tapped in
// :hover until something else is tapped, so a tapped chip stayed raised.
// A click alone does not set :hover in a browser, so hovering is what
// reproduces it; a test that only clicked passed against the bug.
await page.waitForSelector('.game-chip')
const stacking = async (p) => p.evaluate(() => {
  const chip = document.querySelector('.game-chip')
  const rail = document.querySelector('.time-grid__row-label')
  const cr = chip.getBoundingClientRect()
  const rr = rail.getBoundingClientRect()
  const top = document.elementFromPoint(rr.left + rr.width / 2, cr.top + cr.height / 2)
  return {
    chipZ: Number(getComputedStyle(chip).zIndex),
    railZ: Number(getComputedStyle(rail).zIndex),
    railOnTop: Boolean(top?.closest('.time-grid__row-label')),
    chipOnTop: Boolean(top?.closest('.game-chip')),
  }
})

check('a resting chip sits under the rail', (await stacking(page)).chipZ < (await stacking(page)).railZ, true)

await page.locator('.game-chip').first().hover()
await page.waitForTimeout(400)
const touched = await stacking(page)
console.log('   touch, after hover:', JSON.stringify(touched))
check('on a touch screen the hover rule does not apply at all', touched.chipZ, 1)
check('so the chip stays under the rail', touched.chipZ < touched.railZ, true)
check('and the rail is what paints where they cross', touched.railOnTop, true)
check('not the chip', touched.chipOnTop, false)

// With a real pointer the chip may rise above its neighbours — chips do
// overlap when two kickoffs are close — but never above the rail.
const desktop = await browser.newPage({ viewport: { width: 1100, height: 900 } })
await desktop.route('**/site.api.espn.com/**', (r) =>
  r.fulfill({ json: r.request().url().includes('/summary?') ? { header: { competitions: [{ playByPlaySource: 'none' }] }, boxscore: {} } : scoreboard }))
await desktop.route('**/sports.core.api.espn.com/**', (r) => r.fulfill({ json: { items: [] } }))
await desktop.route('**/a.espncdn.com/**', (r) => r.abort())
await desktop.goto(`http://localhost:${PORT}/CFB-Scoreboard/`, { waitUntil: 'domcontentloaded' })
await desktop.waitForTimeout(1200)
await desktop.waitForSelector('.game-chip')
await desktop.locator('.game-chip').first().hover()
await desktop.waitForTimeout(400)
const pointer = await stacking(desktop)
console.log('   pointer, after hover:', JSON.stringify(pointer))
check('with a pointer the chip rises above its neighbours', pointer.chipZ > 1, true)
check('but still stays under the rail', pointer.chipZ < pointer.railZ, true)
check('and the rail still paints on top', pointer.railOnTop, true)
await desktop.close()

if (errs.length) { fails += 1; console.log('PAGE ERRORS:', errs) }
await browser.close()
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
