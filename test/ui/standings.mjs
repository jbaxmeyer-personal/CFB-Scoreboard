/**
 * The Standings tab, rendered.
 *
 * Three things this has to prove, in rough order of what would embarrass us:
 *
 * 1. A protected team's *position* leaks its record. Vanderbilt is given
 *    the best conference record in the SEC and protected: the table must
 *    not put it first, must show a lock instead of a record, and must put
 *    it first the moment you ask to see it.
 * 2. The table renders in full with no records at all. ESPN's standings
 *    shape can't be checked from the build environment, so the failure mode
 *    had to be "every conference and team, empty record columns, and a note
 *    saying why" rather than a blank tab.
 * 3. Four tabs still fit the bar on a phone.
 *
 * Run: npm run dev -- --port 5199   then   node test/ui/standings.mjs
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const PORT = process.env.PORT || 5199

// Real SEC team ids, from src/data/conferences.ts. The conference node is
// given ESPN's own SEC group id, 8 — which is also Arkansas's team id, the
// collision the parser has to refuse.
const entry = (teamId, overall, conference) => ({
  team: { id: teamId },
  stats: [
    { name: 'overall', displayValue: overall },
    { name: 'vsConf', displayValue: conference },
  ],
})
const standings = {
  children: [
    {
      id: '8',
      name: 'Southeastern Conference',
      abbreviation: 'SEC',
      standings: {
        entries: [
          // Protected below: best in the conference, and alphabetically last.
          entry('238', '8-0', '5-0'), // Vanderbilt
          entry('333', '7-1', '4-1'), // Alabama
          entry('61', '6-2', '3-2'), // Georgia
          entry('99', '5-3', '2-3'), // LSU
          // The rest of the SEC is deliberately absent, so the dash for a
          // team the feed never mentioned is on screen too.
        ],
      },
    },
  ],
}

// The AP poll, with the coaches' poll listed FIRST so the screen is proved
// to pick by name rather than by position.
const rank = (current, teamId, record) => ({ current, team: { id: teamId }, recordSummary: record })
const rankings = {
  rankings: [
    {
      name: 'USA Today Coaches Poll',
      shortName: 'Coaches Poll',
      type: 'usa',
      ranks: [rank(1, '333', '7-1')],
    },
    {
      name: 'AP Top 25',
      shortName: 'AP Poll',
      type: 'ap',
      ranks: [
        rank(1, '238', '8-0'), // Vanderbilt — protected below
        rank(2, '333', '7-1'), // Alabama
        rank(3, '61', '6-2'), // Georgia
      ],
    },
  ],
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))

let standingsRequests = 0
let failStandings = false
await page.route('**/site.api.espn.com/**', (r) => {
  const url = r.request().url()
  if (url.includes('/standings')) {
    standingsRequests += 1
    if (failStandings) return r.fulfill({ status: 500, body: 'nope' })
    return r.fulfill({ json: standings })
  }
  if (url.includes('/rankings')) return r.fulfill({ json: rankings })
  if (url.includes('/summary?')) return r.fulfill({ json: { header: { competitions: [{ playByPlaySource: 'none' }] }, boxscore: {} } })
  return r.fulfill({ json: { leagues: [{ calendar: [] }], season: { year: 2026, type: 2 }, events: [] } })
})
await page.route('**/sports.core.api.espn.com/**', (r) => r.fulfill({ json: { items: [] } }))
// Recorded rather than silently dropped: which logo URL the rows ask for
// is the only way to tell the dark mark from the light one here, since the
// images themselves are never allowed to load.
let logoRequests = []
await page.route('**/a.espncdn.com/**', (r) => {
  logoRequests.push(r.request().url())
  r.abort()
})

let fails = 0
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) fails += 1
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` !== ${JSON.stringify(expected)}`}`)
}

// Vanderbilt protected, the way a no-spoilers user would have it.
await page.addInitScript(() => {
  try {
    localStorage.setItem('slate.settings.v1', JSON.stringify({ spoilers: { globalEnabled: false, protectedGameIds: [], protectedTeamIds: ['238'] } }))
  } catch { /* ignore */ }
})

await page.goto(`http://localhost:${PORT}/CFB-Scoreboard/`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(600)

// --- The tab bar still fits ---------------------------------------------
const tabs = await page.evaluate(() =>
  [...document.querySelectorAll('.tab-bar__item')].map((el) => ({
    label: el.textContent.trim(),
    clipped: el.scrollWidth > el.clientWidth + 1,
    wrapped: el.getBoundingClientRect().height > 30,
  })),
)
console.log('   tabs:', JSON.stringify(tabs.map((t) => t.label)))
check('there are four tabs', tabs.map((t) => t.label), ['Slate', 'Scoreboard', 'Standings', 'Settings'])
check('none of the labels is clipped', tabs.filter((t) => t.clipped).map((t) => t.label), [])
check('and none of them wraps onto a second line', tabs.filter((t) => t.wrapped).map((t) => t.label), [])

logoRequests = []
await page.click('.tab-bar__item:has-text("Standings")')
await page.waitForSelector('.standings__conference')
await page.waitForTimeout(600)

const scrollToSec = async () => {
  await page.evaluate(() => {
    const section = [...document.querySelectorAll('.standings__conference')].find((s) =>
      s.querySelector('.standings__conference-name')?.textContent.includes('SEC'),
    )
    section.scrollIntoView({ block: 'start' })
  })
  await page.waitForTimeout(400)
}
// Rows are lazy — only the ones on screen ask for a logo at all, which is
// why the SEC has to be scrolled to before Alabama's is among them.
await scrollToSec()

// --- The logos are the dark ones, like everywhere else ------------------
// The static team table used to carry only ESPN's light-background mark,
// so this screen drew light logos on a dark page while every screen fed
// from a game feed drew the dark ones.
const dark = logoRequests.filter((u) => u.includes('/500-dark/'))
const light = logoRequests.filter((u) => u.includes('/ncaa/500/'))
console.log('   logos asked for:', JSON.stringify({ dark: dark.length, light: light.length, ofTeams: 137 }))
check('the rows ask for the dark marks', dark.length > 0, true)
check("Alabama's is the dark one", dark.some((u) => u.endsWith('/500-dark/333.png')), true)
// Every light URL here is a fallback after the aborted dark request, never
// a first choice — so a light request with no dark request before it for
// the same team would mean the dark mark was never tried.
const triedDarkFirst = light.every((u) => dark.includes(u.replace('/ncaa/500/', '/ncaa/500-dark/')))
check('and every light one is only a fallback from a dark one', triedDarkFirst, true)

const read = () =>
  page.evaluate(() => {
    const sections = [...document.querySelectorAll('.standings__conference')]
    const section = sections.find((s) => s.querySelector('.standings__conference-name')?.textContent.trim() === 'SEC')
    const top = sections.find((s) => /Top 25|Poll/.test(s.querySelector('.standings__conference-name')?.textContent ?? ''))
    const rows = [...section.querySelectorAll('.standings__row')].map((row) => ({
      team: row.querySelector('.standings__team').textContent.trim(),
      records: [...row.querySelectorAll('.standings__record')].map((r) => r.textContent.trim()),
      locked: row.querySelector('.standings__hidden') !== null,
      position: row.querySelector('.standings__position').textContent.trim(),
    }))
    const badge = (row) => row.querySelector('.rank-badge')?.textContent.trim() ?? null
    return {
      conferences: sections.length,
      conferenceNames: sections.map((s) => s.querySelector('.standings__conference-name').textContent.trim()),
      pollHeading: top?.querySelector('.standings__conference-name').textContent.trim() ?? null,
      top25: [...(top?.querySelectorAll('.standings__row') ?? [])].map((row) => ({
        position: row.querySelector('.standings__position').textContent.trim(),
        team: row.querySelector('.standings__team').textContent.trim(),
        records: [...row.querySelectorAll('.standings__record')].map((r) => r.textContent.trim()),
        locked: row.querySelector('.standings__hidden') !== null,
      })),
      badges: [...(section?.querySelectorAll('.standings__row') ?? [])].map(badge).filter(Boolean),
      top25Badges: (top?.querySelectorAll('.rank-badge') ?? []).length,
      pickerLabel: document.querySelector('.standings__picker-chip')?.textContent.trim() ?? null,
      rows,
      unrankedNote: section.querySelector('.standings__unranked-note') !== null,
      reveal: document.querySelector('.standings__reveal') !== null,
      note: document.querySelector('.standings__note')?.textContent.trim() ?? null,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    }
  })

// The app scrolls an inner element, not the window — scrolling the window
// here did nothing and screenshotted whatever was last in view.
await page.evaluate(() => {
  document.querySelectorAll('*').forEach((el) => {
    if (el.scrollTop > 0) el.scrollTop = 0
  })
})
await page.waitForTimeout(200)
await page.screenshot({ path: '/tmp/claude-0/-home-user-CFB-Scoreboard/c9537513-1e0b-58a9-8bcd-b6e707f00768/scratchpad/standings-top.png' })
const hidden = await read()
console.log('   SEC, protected:', JSON.stringify(hidden.rows.slice(0, 4)))
// --- Opens on the power four, not on all eleven -------------------------
check('the power four are shown, plus the Top 25 section', hidden.conferenceNames, ['AP Top 25', 'ACC', 'Big 12', 'Big Ten', 'SEC'])
check('and the chip says how many', hidden.pickerLabel, '4 conferences ▾')

// --- The Top 25, listed first -------------------------------------------
check('the AP poll is the one listed, not the coaches poll first in the payload', hidden.pollHeading, 'AP Top 25')
check('in poll order', hidden.top25.map((r) => [r.position, r.team.split(' ')[0]]), [['1', 'Vanderbilt'], ['2', 'Alabama'], ['3', 'Georgia']])
check('with records beside them', hidden.top25[1].records, ['4-1', '7-1'])

// --- Top 25 badges on the logos -----------------------------------------
// Alabama (2) and Georgia (3) are in the SEC table; Vanderbilt is protected
// but a poll ranking is not a result, so it keeps its badge.
check('ranked teams carry their badge into the conference table', hidden.badges.sort(), ['1', '2', '3'])
// In the Top 25 the position column already is the rank, so a badge there
// would print the same number twice in adjacent columns.
check('and the Top 25 does not print its rank twice', hidden.top25Badges, 0)

check('the SEC lists all sixteen teams', hidden.rows.length, 16)
check('an unmentioned team shows a dash, not a blank', hidden.rows.find((r) => r.team.startsWith('Missouri'))?.records, ['–', '–'])
check('a record the feed did send is shown', hidden.rows.find((r) => r.team.startsWith('Alabama'))?.records, ['4-1', '7-1'])

const vandy = hidden.rows.find((r) => r.team.startsWith('Vanderbilt'))
check('the protected team keeps its row', vandy !== undefined, true)
check('with a lock instead of a record', [vandy?.locked, vandy?.records], [true, []])
check('its 5-0 is nowhere in the table', hidden.rows.some((r) => r.records.includes('5-0')), false)
// The position leak: ranked, Vanderbilt is first. Alphabetically it is last.
check('and it is not sitting first, which would say the same thing', hidden.rows[0].team.startsWith('Vanderbilt'), false)
check('the conference is alphabetical instead', hidden.rows[0].team.startsWith('Alabama'), true)
check('with no positions printed, since there is no order to state', hidden.rows[0].position, '')
check('and it says why', hidden.unrankedNote, true)
// A poll is published on a schedule and is not a result, so the rank
// stays while the record goes — the same split the game cards make.
check('the protected team keeps its poll rank', hidden.top25[0].position, '1')
check('but not its record', [hidden.top25[0].locked, hidden.top25[0].records], [true, []])
check('a reveal is offered', hidden.reveal, true)
check('nothing overflows the screen sideways', hidden.overflow, false)
check('no error note while the request is fine', hidden.note, null)

// --- One tap, then everything -------------------------------------------
await page.click('.standings__reveal')
await page.waitForTimeout(300)
const shown = await read()
console.log('   SEC, revealed:', JSON.stringify(shown.rows.slice(0, 3)))
check('revealed, the best conference record is first', shown.rows[0].team.startsWith('Vanderbilt'), true)
check('with its record', shown.rows[0].records, ['5-0', '8-0'])
check('the table is ranked', shown.rows.map((r) => r.position).slice(0, 3), ['1', '2', '3'])
check('nothing is locked any more', shown.rows.some((r) => r.locked), false)
check('and the reveal button is gone', shown.reveal, false)

// Scrolled to the SEC, which is the conference this fixture gave records
// to — a screenshot of the empty tables above it shows nothing useful.
await scrollToSec()
await page.screenshot({ path: '/tmp/claude-0/-home-user-CFB-Scoreboard/c9537513-1e0b-58a9-8bcd-b6e707f00768/scratchpad/standings-records.png' })

// --- The selection is remembered ----------------------------------------
// The explicit ask: add the AAC, leave, come back, and it is still there.
await page.click('.standings__picker-chip')
await page.waitForSelector('.standings__menu')
await page.click('.standings__menu-item:has-text("AAC")')
await page.waitForTimeout(200)
const added = await read()
check('ticking a conference adds its table', added.conferenceNames, ['AP Top 25', 'AAC', 'ACC', 'Big 12', 'Big Ten', 'SEC'])
check('and the menu stays open for the next one', await page.locator('.standings__menu').isVisible(), true)
await page.click('.standings__title')
check('tapping outside closes it', await page.locator('.standings__menu').isVisible(), false)

// Leave the tab entirely, come back.
await page.click('.tab-bar__item:has-text("Slate")')
await page.waitForTimeout(200)
await page.click('.tab-bar__item:has-text("Standings")')
await page.waitForSelector('.standings__conference')
await page.waitForTimeout(300)
check('leaving the tab and returning keeps it', (await read()).conferenceNames.includes('AAC'), true)

// And a full reload, which is what "when they leave and come back" means
// once the app has been closed.
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForSelector('.standings__conference')
await page.waitForTimeout(900)
const remembered = await read()
check('and so does closing the app and opening it again', remembered.conferenceNames, ['AP Top 25', 'AAC', 'ACC', 'Big 12', 'Big Ten', 'SEC'])
check('the chip counts them', remembered.pickerLabel, '5 conferences ▾')

// Put it back, so the failure case below measures the four it opens on.
await page.click('.standings__picker-chip')
await page.click('.standings__menu-actions button:has-text("Power four")')
await page.click('.standings__title')
await page.waitForTimeout(200)
check('the Power four shortcut resets the selection', (await read()).conferenceNames, ['AP Top 25', 'ACC', 'Big 12', 'Big Ten', 'SEC'])

// --- The whole point: a failed request is not a blank tab ----------------
failStandings = true
// Vanderbilt is still protected after this reload — addInitScript re-runs
// on every navigation — so its row carries a lock rather than two dashes,
// and the arithmetic below accounts for it instead of ignoring it.
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForSelector('.standings__conference')
await page.waitForTimeout(1500)
const broken = await page.evaluate(() => {
  const sections = [...document.querySelectorAll('.standings__conference')]
  // The poll request still succeeds, so the Top 25 section is still there
  // and still numbered. Only the conference tables lost their records.
  const tables = sections.filter((s) => !/Top 25|Poll/.test(s.querySelector('.standings__conference-name').textContent))
  const rows = tables.flatMap((s) => [...s.querySelectorAll('.standings__row')])
  return {
    tables: tables.length,
    teams: rows.length,
    dashes: rows.flatMap((r) => [...r.querySelectorAll('.standings__record')]).filter((r) => r.textContent.trim() === '–').length,
    locks: rows.filter((r) => r.querySelector('.standings__hidden')).length,
    positions: rows.map((r) => r.querySelector('.standings__position').textContent.trim()).filter(Boolean),
    notes: document.querySelectorAll('.standings__unranked-note').length,
    note: document.querySelector('.standings__note')?.textContent.trim() ?? null,
    pollStillThere: sections.length - tables.length,
  }
})
console.log('   with the request failing:', JSON.stringify({ ...broken, note: broken.note?.slice(0, 50) }))
check('no positions are printed when nothing has a record', broken.positions, [])
check('and only the conference holding the protected team explains itself', broken.notes, 1)
check('a failed standings request still lists the chosen conferences', broken.tables, 4)
check('and every team in them', broken.teams >= 60, true)
check('the one protected team is still locked', broken.locks, 1)
check('every other row shows empty columns rather than nothing', broken.dashes, (broken.teams - broken.locks) * 2)
check('and a note saying what happened', /Couldn.t load records/.test(broken.note ?? ''), true)
// The two requests are independent: the poll succeeding is why the Top 25
// is still on screen when the standings request is the one that failed.
check('the Top 25 is unaffected by the standings request failing', broken.pollStillThere, 1)

await page.screenshot({ path: '/tmp/claude-0/-home-user-CFB-Scoreboard/c9537513-1e0b-58a9-8bcd-b6e707f00768/scratchpad/standings.png', fullPage: false })
if (errs.length) { fails += 1; console.log('PAGE ERRORS:', errs) }
await browser.close()
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
