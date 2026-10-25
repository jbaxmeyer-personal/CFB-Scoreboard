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
    const section = [...document.querySelectorAll('.standings__conference')].find((s) =>
      s.querySelector('.standings__conference-name')?.textContent.includes('SEC'),
    )
    const rows = [...section.querySelectorAll('.standings__row')].map((row) => ({
      team: row.querySelector('.standings__team').textContent.trim(),
      records: [...row.querySelectorAll('.standings__record')].map((r) => r.textContent.trim()),
      locked: row.querySelector('.standings__hidden') !== null,
      position: row.querySelector('.standings__position').textContent.trim(),
    }))
    return {
      conferences: document.querySelectorAll('.standings__conference').length,
      rows,
      unrankedNote: section.querySelector('.standings__unranked-note') !== null,
      reveal: document.querySelector('.standings__reveal') !== null,
      note: document.querySelector('.standings__note')?.textContent.trim() ?? null,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    }
  })

const hidden = await read()
console.log('   SEC, protected:', JSON.stringify(hidden.rows.slice(0, 4)))
check('every conference has a table', hidden.conferences >= 10, true)
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

// --- The whole point: a failed request is not a blank tab ----------------
failStandings = true
// Vanderbilt is still protected after this reload — addInitScript re-runs
// on every navigation — so its row carries a lock rather than two dashes,
// and the arithmetic below accounts for it instead of ignoring it.
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForSelector('.standings__conference')
await page.waitForTimeout(1500)
const broken = await page.evaluate(() => ({
  conferences: document.querySelectorAll('.standings__conference').length,
  teams: document.querySelectorAll('.standings__row').length,
  dashes: [...document.querySelectorAll('.standings__record')].filter((r) => r.textContent.trim() === '–').length,
  locks: document.querySelectorAll('.standings__hidden').length,
  positions: [...document.querySelectorAll('.standings__position')].map((p) => p.textContent.trim()).filter(Boolean),
  // Only the one conference holding the protected team explains itself.
  notes: document.querySelectorAll('.standings__unranked-note').length,
  note: document.querySelector('.standings__note')?.textContent.trim() ?? null,
}))
console.log('   with the request failing:', JSON.stringify({ ...broken, note: broken.note?.slice(0, 60) }))
check('no positions are printed when nothing has a record', broken.positions, [])
check('and no conference claims a reason it does not have', broken.notes, 1)
check('a failed standings request still lists every conference', broken.conferences >= 10, true)
check('and every team', broken.teams >= 130, true)
check('the one protected team is still locked', broken.locks, 1)
check('and every other row shows empty columns rather than nothing', broken.dashes, (broken.teams - broken.locks) * 2)
check('and a note saying what happened', /Couldn.t load records/.test(broken.note ?? ''), true)

await page.screenshot({ path: '/tmp/claude-0/-home-user-CFB-Scoreboard/c9537513-1e0b-58a9-8bcd-b6e707f00768/scratchpad/standings.png', fullPage: false })
if (errs.length) { fails += 1; console.log('PAGE ERRORS:', errs) }
await browser.close()
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
