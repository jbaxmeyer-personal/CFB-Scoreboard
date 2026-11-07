/**
 * A spoiler-protected team must not have its record on any card.
 *
 * Notre Dame protected, game over: the card hid the score and read
 * "11:00 AM", then printed ND 5-0 against UNC 2-2 — which says who won.
 *
 * And the half of it the first fix missed: a record counts the games
 * already played, so ND 5-0 beside next week's opponent says they won
 * today, on a game that has not kicked off.
 *
 * The opponent's record goes too. A version in between kept it, on the
 * argument that protecting Notre Dame is not a request to hide Purdue's
 * season — and shipped a card reading "MIA 8-0" next to a blank Notre
 * Dame, which announces which team is being protected and looks like a
 * bug doing it.
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
const IDS = { ND: '87', UNC: '153', PUR: '2509', MSST: '344', ALA: '333', MIA: '2390' }
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
    // The reported card: an undefeated opponent, a protected team, and a
    // kickoff still to come.
    ev('mia', 'ND', 'MIA', 0, 0, '11-1', '8-0', `${iso(7)}T23:30Z`, scheduled),
    // An unprotected upcoming game beside them, with records on both
    // sides. Without one, a sweep for record-shaped text finds nothing on
    // this tab and passes whether or not it works.
    ev('open', 'MSST', 'ALA', 0, 0, '1-4', '5-0', `${iso(7)}T20:00Z`, scheduled),
  ],
}

// No executablePath: PLAYWRIGHT_BROWSERS_PATH is set in this environment
// and Playwright resolves the browser itself. These used to name
// .../chromium-1194/... directly, which broke the moment the container was
// rebuilt with 1243 — a pinned build number is a thing that goes stale
// without anyone touching the tests.
const browser = await chromium.launch({ args: ['--no-sandbox'] })
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

// Next week's tab. The card is protected because Notre Dame is on it, and
// a protected card shows no records at all — not Notre Dame's, which
// counts games already played, and not their opponent's either. "PUR 2-3"
// beside a blank Notre Dame would say plainly which team is being
// protected, and would read as a half-drawn row while it did it.
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
check('and shows no records at all', future?.records, [])
check('so the protected season is nowhere on it', /5-0/.test(future?.text ?? ''), false)
check('and neither is the opponent\u2019s', /2-3/.test(future?.text ?? ''), false)

// --- The card exactly as it was reported --------------------------------
// Miami 8-0 at Notre Dame, 6:30 PM, Notre Dame protected: the card showed
// "MIA 8-0" and nothing beside ND. Both sides have a record in the feed,
// the game has not kicked off, and neither record may be on the card.
const reported = await page.evaluate(() => {
  const card = [...document.querySelectorAll('.game-card')].find((c) => c.textContent.includes('MIA'))
  if (!card) return null
  return {
    text: card.textContent.replace(/\s+/g, ' ').trim(),
    records: [...card.querySelectorAll('.game-card__team-record')].map((r) => r.textContent.trim()),
  }
})
console.log('   reported card:', JSON.stringify(reported))
check('the reported matchup is on screen', reported !== null, true)
check('with no record on either side', reported?.records, [])
check("not the protected team's", /11-1/.test(reported?.text ?? ''), false)
check("and not their opponent's", /8-0/.test(reported?.text ?? ''), false)

// --- Nothing record-shaped on any protected card, anywhere --------------
// Checked by pattern rather than by value. Every previous version of this
// looked for the specific numbers in the specific element the last bug
// used, and the next bug used a different element with different numbers.
// This one does not know what the numbers are.
const sweep = await page.evaluate(() => {
  const read = (card) => ({
    // Notre Dame is the protected team, so a card with ND on it is a
    // protected card. Read from the fixture rather than from lock markup,
    // which would make this test depend on a class name it is not about.
    protected: card.textContent.includes('ND'),
    // Leaf elements, not the card's whole text: a record is rendered in
    // an element of its own, and the card's concatenated text runs it
    // into its neighbours ("ALA5-0MSST1-48:00 PM"), where no pattern can
    // pick it out reliably. Every leaf is checked, so a record rendered
    // in some element nobody thought of is still caught.
    records: [...card.querySelectorAll('*')]
      .filter((el) => el.children.length === 0)
      .map((el) => el.textContent.trim())
      .filter((text) => /^\d{1,3}-\d{1,3}(-\d{1,3})?$/.test(text)),
  })
  return [...document.querySelectorAll('.game-card')].map(read)
})
console.log('   record-shaped text per card:', JSON.stringify(sweep))
// The sweep has to be able to see a record before its silence means
// anything: the unprotected game beside them shows both of its own.
check('the sweep can see records where they are allowed', sweep.filter((c) => !c.protected && c.records.length > 0).length, 1)
check('and finds none at all on a protected card', sweep.filter((c) => c.protected).flatMap((c) => c.records), [])

await page.screenshot({ path: '/tmp/claude-0/-home-user-CFB-Scoreboard/c9537513-1e0b-58a9-8bcd-b6e707f00768/scratchpad/protected.png' })
if (errs.length) { fails += 1; console.log('PAGE ERRORS:', errs) }
await browser.close()
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
