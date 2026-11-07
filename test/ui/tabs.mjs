/**
 * Two things about moving between tabs.
 *
 * All four screens render into one scrolling element, so its scrollTop
 * carried straight over: scrolling halfway down Standings and switching to
 * Scoreboard landed you halfway down Scoreboard, at a position you never
 * chose. Each tab keeps its own position now.
 *
 * And the tiles on Scoreboard: pressing one and dragging to scroll left it
 * lit for as long as the finger was down, because nothing turned off the
 * browser's own tap highlight. Every tile now sits at the lighter surface
 * all the time and none of them reacts to a touch.
 *
 * Run: npm run dev -- --port 5199   then   node test/ui/tabs.mjs
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const PORT = process.env.PORT || 5199
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

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))

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

const scrollTop = () => page.evaluate(() => document.querySelector('.app-main').scrollTop)
const scrollTo = async (y) => {
  await page.evaluate((to) => { document.querySelector('.app-main').scrollTop = to }, y)
  await page.waitForTimeout(250)
}
const openTab = async (label, selector) => {
  await page.click(`.tab-bar__item:has-text("${label}")`)
  await page.waitForSelector(selector)
  await page.waitForTimeout(500)
}

await page.goto(`http://localhost:${PORT}/CFB-Scoreboard/`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(700)

// --- Each tab keeps its own scroll position ------------------------------
await openTab('Standings', '.standings__conference')
await scrollTo(1200)
const standingsAt = await scrollTop()
check('Standings scrolled', standingsAt > 500, true)

await openTab('Scoreboard', '.game-card')
check('switching tabs does not carry the position over', await scrollTop(), 0)

await scrollTo(600)
const scoreboardAt = await scrollTop()
check('Scoreboard scrolled somewhere of its own', scoreboardAt > 200, true)

await openTab('Standings', '.standings__conference')
check('coming back to Standings restores its position', await scrollTop(), standingsAt)

await openTab('Scoreboard', '.game-card')
check('and Scoreboard keeps its own', await scrollTop(), scoreboardAt)

// Slate too, which is the third screen sharing that element.
await openTab('Slate', '.schedule-grid, .time-grid, .day-tabs')
check('a third tab opens at its own top', await scrollTop(), 0)
await openTab('Standings', '.standings__conference')
check('without disturbing the one before it', await scrollTop(), standingsAt)

// --- The tiles ------------------------------------------------------------
await openTab('Scoreboard', '.game-card')
const tiles = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.game-card')]
  const raised = getComputedStyle(document.documentElement).getPropertyValue('--bg-panel-raised').trim()
  const toRgb = (hex) => {
    const n = parseInt(hex.slice(1), 16)
    return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
  }
  return {
    backgrounds: [...new Set(cards.map((c) => getComputedStyle(c).backgroundColor))],
    expected: toRgb(raised),
    tapHighlight: getComputedStyle(cards[0].querySelector('.game-card__trigger')).webkitTapHighlightColor,
  }
})
console.log('   tiles:', JSON.stringify(tiles))
check('every tile is the same shade', tiles.backgrounds.length, 1)
check('and it is the raised surface, not the darker panel', tiles.backgrounds[0], tiles.expected)
check('pressing one flashes nothing', tiles.tapHighlight, 'rgba(0, 0, 0, 0)')

// Holding a tile down must not change it — that is the scroll-and-light-up
// the report was about.
await page.evaluate(() => {
  const card = document.querySelector('.game-card')
  const rect = card.getBoundingClientRect()
  const opts = { bubbles: true, clientX: rect.x + 10, clientY: rect.y + 10 }
  card.dispatchEvent(new PointerEvent('pointerdown', opts))
  card.dispatchEvent(new MouseEvent('mousedown', opts))
})
await page.waitForTimeout(200)
const held = await page.evaluate(() => getComputedStyle(document.querySelector('.game-card')).backgroundColor)
check('a tile held down looks the same as the rest', held, tiles.expected)

// --- Nothing on a tile reacts to the pointer ----------------------------
// Asserted over every element in the tile rather than against a named
// property. The thing that was lighting up was the conference shield's
// opacity, which no check aimed at the card's own background would have
// found — and the next one could be anything.
const styles = () =>
  page.evaluate(() => {
    const card = [...document.querySelectorAll('.game-card')].find((c) => c.querySelector('.conference-badge'))
    const out = {}
    const walk = (el, path) => {
      const cs = getComputedStyle(el)
      out[path] = [cs.opacity, cs.backgroundColor, cs.borderColor, cs.boxShadow, cs.filter, cs.color].join(' | ')
      ;[...el.children].forEach((c, i) => walk(c, `${path}>${c.className || c.tagName}#${i}`))
    }
    walk(card, 'card')
    return out
  })

const shield = await page.evaluate(() => {
  const badge = document.querySelector('.game-card .conference-badge')
  return badge ? getComputedStyle(badge).opacity : null
})
check('the conference shield is drawn on a conference tile', shield !== null, true)
check('and it is at full strength, not dimmed', shield, '1')

const atRest = await styles()
// .hover(), not el.click(): a click does not set :hover, which is the
// state iOS leaves a tapped element in — the whole bug.
await page.hover('.game-card')
await page.waitForTimeout(300)
const hovered = await styles()
const moved = Object.keys(hovered).filter((k) => atRest[k] !== hovered[k])
console.log('   changed under the pointer:', JSON.stringify(moved))
check('nothing in the tile changes under the pointer', moved, [])

await page.screenshot({ path: '/tmp/claude-0/-home-user-CFB-Scoreboard/c9537513-1e0b-58a9-8bcd-b6e707f00768/scratchpad/tabs.png' })
if (errs.length) { fails += 1; console.log('PAGE ERRORS:', errs) }
await browser.close()
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
