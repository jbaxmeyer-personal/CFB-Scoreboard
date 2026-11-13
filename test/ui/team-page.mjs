/**
 * Records on a team's page.
 *
 * Two things were missing on a real phone. The schedule listed every
 * opponent with no record beside them, and a team reached by tapping into
 * a game and then tapping that team arrived at a page with no record in
 * its header.
 *
 * One cause: the team-schedule endpoint spells a record's value
 * `displayValue`, where the scoreboard spells it `summary`. So this fixture
 * deliberately uses the schedule endpoint's spelling — reading it with the
 * scoreboard's would reproduce the bug exactly.
 *
 * Run: npm run dev -- --port 5199   then   node test/ui/team-page.mjs
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const PORT = process.env.PORT || 5199
const DAY = 86400000
const iso = (o) => new Date(Date.now() + o * DAY).toISOString().slice(0, 10)

const IDS = { IU: '84', NEB: '158', PUR: '2509', OSU: '194' }
const team = (abbr) => ({
  id: IDS[abbr], location: abbr, name: abbr, abbreviation: abbr,
  displayName: `${abbr} Full Name`, shortDisplayName: abbr, color: '990000',
  logo: `https://a.espncdn.com/i/teamlogos/ncaa/500/${IDS[abbr]}.png`,
})
const final = { type: { id: '3', name: 'STATUS_FINAL', state: 'post', completed: true, description: 'Final', detail: 'Final', shortDetail: 'Final' } }
const scheduled = { type: { id: '1', name: 'STATUS_SCHEDULED', state: 'pre', completed: false, description: 'Scheduled', detail: 'Scheduled', shortDetail: 'Sat' } }

// The schedule endpoint's spelling throughout: scores as objects, records
// under `record` with `displayValue`.
const game = (id, home, away, hs, as, hr, ar, date, status = final) => ({
  id, date, name: 'x', shortName: `${away} @ ${home}`, status,
  competitions: [{
    id, date, status, venue: { fullName: 'Stadium' }, broadcasts: [{ names: ['Fox'] }],
    competitors: [
      { id: `${id}h`, homeAway: 'home', team: team(home), score: { value: hs, displayValue: String(hs) }, record: [{ type: 'total', displayValue: hr }] },
      { id: `${id}a`, homeAway: 'away', team: team(away), score: { value: as, displayValue: String(as) }, record: [{ type: 'total', displayValue: ar }] },
    ],
  }],
})

/** A game not yet played: no scores, and no `record` on either side —
 * the shape ESPN actually sends, and the one that left those rows bare. */
const upcoming = (id, home, away, date) => ({
  id, date, name: 'x', shortName: `${away} @ ${home}`, status: scheduled,
  competitions: [{
    id, date, status: scheduled, venue: { fullName: 'Stadium' }, broadcasts: [{ names: ['Fox'] }],
    competitors: [
      { id: `${id}h`, homeAway: 'home', team: team(home) },
      { id: `${id}a`, homeAway: 'away', team: team(away) },
    ],
  }],
})

const schedules = {
  // Indiana: a played game at Nebraska, and an upcoming one against Purdue.
  84: {
    team: { ...team('IU'), record: { items: [{ type: 'total', displayValue: '8-1' }] } },
    requestedSeason: { year: 2026, type: 2 },
    events: [
      game('g1', 'NEB', 'IU', 17, 20, '5-1', '6-0', `${iso(-20)}T19:00Z`),
      // No records on this one: ESPN sends none for a game still to come,
      // which is exactly the row that came up blank on a phone.
      upcoming('g2', 'IU', 'PUR', `${iso(14)}T19:00Z`),
    ],
  },
  // Nebraska, reached by tapping their side of that game.
  158: {
    team: { ...team('NEB'), record: { items: [{ type: 'total', displayValue: '5-4' }] } },
    requestedSeason: { year: 2026, type: 2 },
    events: [game('g1', 'NEB', 'IU', 17, 20, '5-1', '6-0', `${iso(-20)}T19:00Z`)],
  },
}

// Current records for every team, the way the Standings screen reads them.
// ESPN sends no record on a schedule row for a game not yet played, so this
// is where those rows get one.
const standings = {
  children: [
    {
      id: '5',
      name: 'Big Ten',
      standings: {
        entries: [
          { team: { id: IDS.IU }, stats: [{ name: 'overall', displayValue: '8-1' }] },
          { team: { id: IDS.NEB }, stats: [{ name: 'overall', displayValue: '5-4' }] },
          // Purdue's game against Indiana has not been played.
          { team: { id: IDS.PUR }, stats: [{ name: 'overall', displayValue: '4-5' }] },
        ],
      },
    },
  ],
}

const scoreboard = {
  leagues: [{ calendar: [{ label: 'Regular Season', entries: [{ label: 'Week 10', startDate: `${iso(-3)}T07:00Z`, endDate: `${iso(4)}T06:59Z` }] }] }],
  season: { year: 2026, type: 2 },
  week: { number: 10 },
  events: [game('sb1', 'IU', 'OSU', 15, 19, '8-1', '8-0', `${iso(0)}T19:00Z`)],
}

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))

await page.route('**/site.api.espn.com/**', (r) => {
  const url = r.request().url()
  const schedule = /\/teams\/(\d+)\/schedule/.exec(url)
  if (schedule) return r.fulfill({ json: schedules[schedule[1]] ?? { events: [] } })
  if (url.includes('/statistics')) return r.fulfill({ json: { requestedSeason: { year: 2026, type: 2 }, results: { stats: { categories: [] } } } })
  if (url.includes('/summary?')) return r.fulfill({ json: { header: { competitions: [{ playByPlaySource: 'none' }] }, boxscore: {} } })
  if (url.includes('/standings')) return r.fulfill({ json: standings })
  if (url.includes('/rankings')) return r.fulfill({ json: {} })
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

const readTeamPage = () =>
  page.evaluate(() => ({
    name: document.querySelector('.team-page__name')?.textContent.trim() ?? null,
    record: document.querySelector('.team-page__record')?.textContent.trim() ?? null,
    rows: [...document.querySelectorAll('.team-page__game')].map((row) => ({
      opponent: row.querySelector('.team-page__game-opponent')?.textContent.trim() ?? null,
      record: row.querySelector('.team-page__game-record')?.textContent.trim() ?? null,
    })),
    // Only the records diagnostic: `team-page__hint` is also the empty
    // state for sections with nothing in them, which is not what this is
    // asking about.
    hint: [...document.querySelectorAll('.team-page__hint--records')].map((h) => h.textContent.trim()),
  }))

await page.goto(`http://localhost:${PORT}/CFB-Scoreboard/`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(600)
await page.click('.tab-bar__item:has-text("Scoreboard")')
await page.waitForSelector('.game-card')
await page.waitForTimeout(800)

// Into the game, then onto Indiana's page — the path from the report.
// A real click, not el.click(): the card's handler is on a child, so
// clicking the container element does not reach it.
await page.click('.game-card')
await page.waitForSelector('.game-detail-panel')
await page.waitForTimeout(700)
const openTeam = async (abbr) => {
  await page.evaluate((name) => {
    const el = [...document.querySelectorAll('.expanded-game__identity')].find((e) => e.textContent.includes(name))
    el?.click()
  }, abbr)
  await page.waitForSelector('.team-page')
  await page.waitForTimeout(900)
}
await openTeam('IU')
const iu = await readTeamPage()
console.log('   Indiana:', JSON.stringify(iu))
check('the team page opened', iu.name, 'IU Full Name')
// The second reported bug: this header was blank.
check('its own record is in the header', iu.record, '8-1')
// The first: every opponent row was bare.
// Both current: Nebraska 5-4, not the 5-1 the October game's payload
// carries, and Purdue 4-5 on a game not yet played. The schedule's own
// records are each opponent's record as of that game — never shown.
check('every opponent carries its record now', iu.rows.map((r) => [r.opponent, r.record]), [['NEB', '5-4'], ['PUR', '4-5']])
check('and nothing reports a missing column', iu.hint, [])
// The precise thing that was wrong: the schedule payload says Nebraska
// were 5-1 at the time of that game, and that number must not be on this
// screen at all.
const asOf = await page.evaluate(() => {
  const section = [...document.querySelectorAll('.team-page__section')].find((s) =>
    s.querySelector('.team-page__title')?.textContent.includes('Schedule'),
  )
  return [...section.querySelectorAll('.team-page__game-record')].map((r) => r.textContent.trim())
})
check('no row shows the record as of its game', asOf.includes('5-1'), false)

// Tap the played game on the schedule, then the other team in it — the
// second path from the report, which arrived at a page with no record.
await page.click('.team-page__game')
await page.waitForTimeout(900)
await openTeam('NEB')
const neb = await readTeamPage()
console.log('   Nebraska:', JSON.stringify(neb))
check('the other team in the game opens too', neb.name, 'NEB Full Name')
// 5-4, not the 5-1 the game carried: a page about the team says the
// record now, not the record as of a game in October.
check('with its record as it is now, not as of that game', neb.record, '5-4')

// --- Records under the crests on an upcoming game ------------------------
// The reported screen: an upcoming matchup opened from a team's schedule
// had no record under either logo. ESPN attaches a team's record as of
// that game, and a game not yet played has none — the same gap the
// schedule rows above had, not carried through to the game they open.
// Back to Indiana's page: we are on Nebraska's, which has only the one
// game on it. Nebraska pops to the game it was opened from, and that pops
// to Indiana's schedule.
await page.evaluate(() => document.querySelector('.team-page__back').click())
await page.waitForTimeout(400)
await page.evaluate(() => document.querySelector('.game-detail-panel__back')?.click())
await page.waitForSelector('.team-page__game')
await page.waitForTimeout(600)
await page.evaluate(() => {
  const row = [...document.querySelectorAll('.team-page__game')].find((r) => r.textContent.includes('PUR'))
  row.click()
})
await page.waitForSelector('.expanded-game__matchup')
await page.waitForTimeout(900)
const crests = await page.evaluate(() => ({
  names: [...document.querySelectorAll('.expanded-game__name > span:first-child')].map((n) => n.textContent.trim()),
  records: [...document.querySelectorAll('.expanded-game__record')].map((r) => r.textContent.trim()),
}))
console.log('   upcoming game crests:', JSON.stringify(crests))
check('both teams are named', crests.names.length, 2)
check('and both carry a record', crests.records, ['4-5', '8-1'])
await page.evaluate(() => document.querySelector('.game-detail-panel__back')?.click())
await page.waitForTimeout(400)

// --- A protected team's own record ---------------------------------------
// Fetching the header record for the page is a new way to leak one: a
// record counts the games already played, so printing 8-1 above a list of
// locked results gives them away. The one reveal covers both.
await page.evaluate(() =>
  localStorage.setItem(
    'slate.settings.v1',
    JSON.stringify({ spoilers: { globalEnabled: false, protectedGameIds: [], protectedTeamIds: ['84'] } }),
  ),
)
// The expanded game is remembered across a reload, so the panel comes back
// already open — clicking the card again would hit the panel covering it.
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForSelector('.game-detail-panel')
await page.waitForTimeout(900)
await openTeam('IU')
const guarded = await readTeamPage()
console.log('   Indiana, protected:', JSON.stringify({ record: guarded.record, rows: guarded.rows }))
check('a protected team shows no record in its header', guarded.record, null)
check('and no opponent records either', guarded.rows.map((r) => r.record), [null, null])

// In-page click: the panel's footer overlays the button's position, and
// Playwright's hit-testing refuses a click it thinks something else would
// receive.
await page.evaluate(() => document.querySelector('.team-page__reveal').click())
await page.waitForTimeout(400)
const revealed = await readTeamPage()
check('revealing shows the record', revealed.record, '8-1')
check('and the opponents with it', revealed.rows.map((r) => r.record), ['5-4', '4-5'])

// A protected game's crests stay empty. Filling an upcoming game's
// records from the standings feed is a new way into the gap the sanitizer
// deliberately leaves — the crests are outside the spoiler gate, so
// nothing may put a record back there.
await page.evaluate(() => {
  const row = [...document.querySelectorAll('.team-page__game')].find((r) => r.textContent.includes('PUR'))
  row.click()
})
await page.waitForSelector('.expanded-game__matchup')
await page.waitForTimeout(900)
const guardedCrests = await page.evaluate(() =>
  [...document.querySelectorAll('.expanded-game__record')].map((r) => r.textContent.trim()),
)
console.log('   protected game crests:', JSON.stringify(guardedCrests))
check('a protected game carries no record under either crest', guardedCrests, [])
await page.evaluate(() => document.querySelector('.game-detail-panel__back')?.click())
await page.waitForTimeout(400)

// --- A protected opponent on an unprotected team's page -----------------
// The row-level guard covers a protected team's *played* games, because
// those are what make a page hide its results. A future game against a
// protected opponent hides nothing — and until these rows were filled in
// it leaked nothing either, because ESPN sent no record for them. Filling
// the gap is what would have turned it into a leak.
await page.evaluate(() =>
  localStorage.setItem(
    'slate.settings.v1',
    JSON.stringify({ spoilers: { globalEnabled: false, protectedGameIds: [], protectedTeamIds: ['2509'] } }),
  ),
)
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForSelector('.game-detail-panel')
await page.waitForTimeout(900)
await openTeam('IU')
const mixed = await readTeamPage()
console.log('   Indiana, Purdue protected:', JSON.stringify(mixed.rows))
check('the page itself hides nothing', mixed.record, '8-1')
check('a played opponent still shows its record', mixed.rows[0].record, '5-4')
check('but a protected opponent does not', mixed.rows[1].record, null)

await page.screenshot({ path: '/tmp/claude-0/-home-user-CFB-Scoreboard/c9537513-1e0b-58a9-8bcd-b6e707f00768/scratchpad/team-page.png' })
if (errs.length) { fails += 1; console.log('PAGE ERRORS:', errs) }
await browser.close()
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
