/**
 * Which colour each team's bar is drawn in.
 *
 * Florida at Kentucky came out with Florida in grey. Both wear blue, so
 * the away team falls back to its second colour — and the second colour
 * the code had was ESPN's `alternateColor`, which for a team reached from
 * a schedule is missing entirely. A neutral stood in, and a neutral says
 * nothing about whose bar it is.
 *
 * The colours are a vetted table now. Grey is only ever right for a school
 * whose second colour genuinely is grey or silver.
 */
import { check, report } from '../helpers/check'
import { statBarColors } from '../../src/components/scoreboard/GameStats'
import { TEAM_PALETTE } from '../../src/data/teamPalette'
import type { Team } from '../../src/types/game'

const team = (id: string, abbreviation: string): Team =>
  ({ id, abbreviation, name: abbreviation, shortName: abbreviation }) as Team

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Hue in degrees, for comparing a colour against one the panel has
 * lifted: onDarkPanel raises lightness and keeps hue, so the hex moves and
 * the hue does not. */
function hue(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return -1
  const d = max - min
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h * 60 + 360) % 360
}
const sameHue = (a: string, b: string) => Math.abs(hue(a) - hue(b)) < 8

/** A true silver or grey: no hue to speak of, and mid-lightness — black
 * and off-white are their own thing and plenty of schools wear them. */
function readsGrey(hex: string): boolean {
  const [r, g, b] = rgb(hex)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const chroma = max === 0 ? 0 : (max - min) / max
  return chroma < 0.12 && max > 60 && max < 230
}

// --- The reported matchup ------------------------------------------------
// Florida (blue/orange) away at Kentucky (blue/white).
const fla = statBarColors(team('96', 'UK'), team('57', 'FLA'))
check('Kentucky keeps its blue', sameHue(fla.homeColor, '#0033A0'), true)
check('and Florida is not grey', readsGrey(fla.awayColor), false)
check('it is their orange', sameHue(fla.awayColor, '#FA4616'), true)

// --- Teams whose second colour really is grey ----------------------------
// The user named these: grey is the right answer for them and only them.
const osu = statBarColors(team('2641', 'TTU'), team('194', 'OSU')) // both red
check('Ohio State against another red team falls to their grey', readsGrey(osu.awayColor), true)
const nev = statBarColors(team('68', 'BSU'), team('2440', 'NEV')) // both blue
check('and Nevada to their silver', readsGrey(nev.awayColor), true)

// --- A black primary leads with the team's second colour -----------------
// Black lifts to grey, which is the thing being complained about. Iowa is
// gold, Purdue old gold — colours those teams actually wear.
const iowa = statBarColors(team('2294', 'IOWA'), team('135', 'MINN'))
check('Iowa leads with gold rather than a lifted black', sameHue(iowa.homeColor, '#FFCD00'), true)
const purdue = statBarColors(team('2509', 'PUR'), team('84', 'IND'))
check('and Purdue with old gold', sameHue(purdue.homeColor, '#CEB888'), true)

// --- No clash, no fallback ----------------------------------------------
const plain = statBarColors(team('2483', 'ORE'), team('251', 'TEX')) // green v burnt orange
check('two teams that already differ keep both primaries',
  [sameHue(plain.homeColor, '#154733'), sameHue(plain.awayColor, '#BF5700')], [true, true])

// --- The table itself ----------------------------------------------------
const ids = Object.keys(TEAM_PALETTE)
check('every entry has two colours', ids.every((id) => /^#[0-9A-F]{6}$/i.test(TEAM_PALETTE[id].primary) && /^#[0-9A-F]{6}$/i.test(TEAM_PALETTE[id].secondary)), true)
check('and they are never the same colour twice', ids.filter((id) => TEAM_PALETTE[id].primary.toUpperCase() === TEAM_PALETTE[id].secondary.toUpperCase()), [])

// Grey is deliberate and rare, so the schools that have it are named.
// A grey appearing on any other school is the exact complaint this file
// exists for, and it fails here rather than on a phone. Black is not grey
// for this purpose: a red-and-black school really does wear black.
// Washington State is crimson and grey too, but their grey (#5E6A71)
// carries enough blue to read as a colour rather than a neutral, so it
// does not land here.
const SILVER_SCHOOLS = ['2005', '2306', '235', '2440', '167', '194', '242', '2628', '2653', '2439']
const greySecondaries = ids.filter((id) => readsGrey(TEAM_PALETTE[id].secondary))
check('only the schools that really wear grey have a grey second colour', greySecondaries.sort(), SILVER_SCHOOLS.sort())
check('and no primary is grey at all', ids.filter((id) => readsGrey(TEAM_PALETTE[id].primary)), [])

// --- Nothing from the feed overrides the table ---------------------------
// A team arriving with ESPN's own colours still gets the vetted pair, so
// a near-duplicate alternateColor can't put the bars back to grey.
const withFeedColours = { ...team('57', 'FLA'), color: '#0021A5', alternateColor: '#0021A5' } as Team
const stubborn = statBarColors(team('96', 'UK'), withFeedColours)
check('a duplicate alternate from the feed is ignored', sameHue(stubborn.awayColor, '#FA4616'), true)

// --- A team the table doesn't know still works ---------------------------
const unknown = { ...team('999999', 'FCS'), color: '#123456' } as Team
const withUnknown = statBarColors(team('96', 'UK'), unknown)
check('a team off the table falls back to what the feed gave', sameHue(withUnknown.awayColor, '#123456'), true)

report()
