/**
 * Keeping the screen awake while a live game is open.
 *
 * The complaint: a propped-up phone following a game goes dark, and you
 * have to touch it to see the score. Screen Wake Lock fixes it, and the
 * part worth testing is not the API — it is *when* the lock is held, which
 * is entirely our logic:
 *
 *   - taken while a live game is on screen, and only then;
 *   - released the moment it isn't, including on a stacked team page;
 *   - re-taken after the page is backgrounded, because the browser drops
 *     the lock on the way out and does not give it back;
 *   - never taken at all when the setting is off;
 *   - on for someone whose stored settings predate the setting existing.
 *
 * `navigator.wakeLock` is stubbed with a recorder that models the two parts
 * of the real contract that matter: a sentinel that reports whether it has
 * been released, and the browser dropping the lock when the page hides.
 * Stubbed rather than driven for real because headless Chromium's own
 * answer to a screen lock request is not the thing under test, and a test
 * that depends on it tells us nothing about this code.
 *
 * Run: npm run dev -- --port 5199   then   node test/ui/keep-awake.mjs
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
const ND = team('87', 'ND', 'Notre Dame', 'Notre Dame Fighting Irish')
const MIA = team('2390', 'MIA', 'Miami', 'Miami Hurricanes')
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
  events: [game('g1', ND, MIA, live), game('g3', MICH, OSU, final)],
}

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })

// The stub. Counts requests and releases, tracks how many locks are held,
// and — like a real browser — drops the lock when the page stops being
// visible, which is the thing the hook has to recover from.
await page.addInitScript(() => {
  let visibility = 'visible'
  let delay = 0
  const held = new Set()
  const log = { requests: 0, releases: 0, types: [] }
  // How long `request` takes to resolve. Zero for every check but the race
  // one, which needs the panel to close while a request is still in flight.
  window.__setRequestDelay = (ms) => { delay = ms }
  window.__wake = {
    held: () => held.size,
    requests: () => log.requests,
    releases: () => log.releases,
    types: () => log.types,
  }
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
  window.__setVisibility = (next) => {
    visibility = next
    if (next !== 'visible') for (const s of Array.from(held)) s.__drop()
    document.dispatchEvent(new Event('visibilitychange'))
  }
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: {
      request: async (type) => {
        if (visibility !== 'visible') throw new DOMException('hidden', 'NotAllowedError')
        log.requests += 1
        log.types.push(type)
        if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
        const sentinel = {
          type,
          released: false,
          release: async () => {
            if (sentinel.released) return
            sentinel.released = true
            held.delete(sentinel)
            log.releases += 1
          },
          __drop: () => {
            sentinel.released = true
            held.delete(sentinel)
            log.releases += 1
          },
          addEventListener: () => {},
          removeEventListener: () => {},
        }
        held.add(sentinel)
        return sentinel
      },
    },
  })
})

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
const held = () => page.evaluate(() => window.__wake.held())
const requests = () => page.evaluate(() => window.__wake.requests())

const toScoreboard = async () => {
  await page.click('.tab-bar__item:has-text("Scoreboard")')
  await page.waitForSelector('.game-card')
  await page.waitForTimeout(700)
}
const openGame = async (abbr) => {
  await page.evaluate((name) => {
    const card = [...document.querySelectorAll('.game-card')].find((c) => c.textContent.includes(name))
    card.querySelector('.game-card__trigger').click()
  }, abbr)
  await page.waitForSelector('.expanded-game__matchup')
  await page.waitForTimeout(600)
}
const close = async () => {
  await page.evaluate(() => document.querySelector('.game-detail-panel__close').click())
  await page.waitForTimeout(500)
}

// --- Someone who has used the app before the setting existed -------------
// Their stored settings have no keepScreenAwake at all. It has to read as
// on: `undefined` is falsey, so getting this wrong ships the feature off
// to every existing user while looking fine on a fresh install.
await page.goto(`http://localhost:${PORT}/CFB-Scoreboard/`, { waitUntil: 'domcontentloaded' })
await page.evaluate(() =>
  localStorage.setItem('slate.settings.v1', JSON.stringify({
    timezoneId: 'America/New_York', favoriteTeamIds: [], broadcastDelaySeconds: 0,
    spoilers: { globalEnabled: false, protectedGameIds: [], protectedTeamIds: [] },
  })),
)
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(700)

check('nothing is held on the list itself', await held(), 0)
await toScoreboard()
check('still nothing on the scoreboard', await held(), 0)

// --- A live game ---------------------------------------------------------
await openGame('MIA')
check('a live game holds the screen awake', await held(), 1)
check('and asks for the screen, not the system', await page.evaluate(() => window.__wake.types()), ['screen'])

await close()
check('closing it lets the screen sleep again', await held(), 0)

// --- A finished game -----------------------------------------------------
const before = await requests()
await openGame('OSU')
check('a finished game holds nothing', await held(), 0)
check('and never even asked', (await requests()) - before, 0)
await close()

// --- Backgrounding and coming back ---------------------------------------
// The browser drops the lock when the page hides and does not hand it back,
// so returning to a live game has to take it again. This is the case that
// matters most: backgrounding the app is exactly when you put the phone
// down.
await openGame('MIA')
check('held again on reopening the live game', await held(), 1)
const beforeHide = await requests()
await page.evaluate(() => window.__setVisibility('hidden'))
await page.waitForTimeout(300)
check('the browser takes it away when the page hides', await held(), 0)
await page.evaluate(() => window.__setVisibility('visible'))
await page.waitForTimeout(400)
check('and it is taken again on coming back', await held(), 1)
check('by asking afresh', (await requests()) - beforeHide, 1)

// --- A team page stacked over the live game ------------------------------
// A schedule is a thing you scroll, and scrolling keeps the screen alive by
// itself, so the lock goes while one is on top.
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.expanded-game__identity')].find((e) => e.textContent.includes('MIA'))
  el?.click()
})
await page.waitForSelector('.team-page')
await page.waitForTimeout(700)
check('a team page over the game releases it', await held(), 0)
await page.evaluate(() => document.querySelector('.team-page__back')?.click())
await page.waitForTimeout(700)
check('and going back to the game takes it again', await held(), 1)
await close()

// --- The setting off -----------------------------------------------------
await page.evaluate(() => {
  const stored = JSON.parse(localStorage.getItem('slate.settings.v1'))
  localStorage.setItem('slate.settings.v1', JSON.stringify({ ...stored, keepScreenAwake: false }))
})
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(700)
await toScoreboard()
const beforeOff = await requests()
await openGame('MIA')
check('with the setting off, nothing is held', await held(), 0)
check('and nothing is asked for', (await requests()) - beforeOff, 0)

// --- The toggle is on the Settings screen --------------------------------
await close()
await page.click('.tab-bar__item:has-text("Settings")')
await page.waitForSelector('.settings-screen')
await page.waitForTimeout(400)
const toggle = await page.evaluate(() => {
  const label = [...document.querySelectorAll('.settings-toggle')].find((l) => l.textContent.includes('Keep Screen Awake'))
  if (!label) return null
  return { checked: label.querySelector('input[type="checkbox"]').checked }
})
check('the setting has a toggle, showing it off', toggle, { checked: false })
// Turning it back on and returning to the game takes the lock without a reload.
await page.evaluate(() => {
  const label = [...document.querySelectorAll('.settings-toggle')].find((l) => l.textContent.includes('Keep Screen Awake'))
  label.querySelector('input[type="checkbox"]').click()
})
await page.waitForTimeout(300)
await toScoreboard()
await openGame('MIA')
check('switching it on takes effect without a reload', await held(), 1)

// --- Closed while the request is still in flight -------------------------
// `request` is async, so the panel can close before the lock arrives. A
// sentinel landing after that is a lock nothing holds a reference to and
// nothing will ever release: the screen would stay on until the tab was
// closed. It has to be released on arrival instead.
await close()
await page.evaluate(() => window.__setRequestDelay(700))
const beforeRace = await requests()
await page.evaluate(() => {
  const card = [...document.querySelectorAll('.game-card')].find((c) => c.textContent.includes('MIA'))
  card.querySelector('.game-card__trigger').click()
})
await page.waitForSelector('.expanded-game__matchup')
// Closed well inside the 700ms the request takes.
await page.evaluate(() => document.querySelector('.game-detail-panel__close').click())
await page.waitForTimeout(1400)
check('a lock arriving after the panel closed is released', await held(), 0)
check('and it really was in flight', (await requests()) - beforeRace, 1)
await page.evaluate(() => window.__setRequestDelay(0))

await page.screenshot({ path: '/tmp/claude-0/-home-user-CFB-Scoreboard/c9537513-1e0b-58a9-8bcd-b6e707f00768/scratchpad/keep-awake.png' })
if (errs.length) { fails += 1; console.log('PAGE ERRORS:', errs) }
await browser.close()
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
