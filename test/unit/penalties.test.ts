/**
 * Penalties and penalty yards on the expanded game's comparison.
 *
 * ESPN reports both as one string — "7-55", seven penalties for
 * fifty-five yards — under `totalPenaltiesYards`. They are two rows here,
 * because a team can be flagged often for little or rarely for a lot and
 * the bar compares one number at a time.
 *
 * The split is not cosmetic. The bar reads an "X-Y" value as a success
 * *rate*, which is how 3rd Down % and Red Zone % are drawn, so "7-55"
 * reaching it unsplit would render as 13% rather than as seven penalties.
 */
import { check, report } from '../helpers/check'
import { normalizeBoxScore } from '../../src/lib/espn'
import type { EspnSummaryResponse } from '../../src/types/espn'

const HOME = { id: '87', abbreviation: 'ND', name: 'Notre Dame' }
const AWAY = { id: '2390', abbreviation: 'MIA', name: 'Miami' }

const response = (homePenalties?: string, awayPenalties?: string): EspnSummaryResponse =>
  ({
    boxscore: {
      teams: [
        {
          team: { id: HOME.id, abbreviation: 'ND', displayName: 'Notre Dame' },
          statistics: [
            { name: 'totalYards', displayValue: '412' },
            { name: 'turnovers', displayValue: '1' },
            { name: 'possessionTime', displayValue: '31:12' },
            ...(homePenalties ? [{ name: 'totalPenaltiesYards', displayValue: homePenalties }] : []),
          ],
        },
        {
          team: { id: AWAY.id, abbreviation: 'MIA', displayName: 'Miami' },
          statistics: [
            { name: 'totalYards', displayValue: '377' },
            { name: 'turnovers', displayValue: '2' },
            { name: 'possessionTime', displayValue: '28:48' },
            ...(awayPenalties ? [{ name: 'totalPenaltiesYards', displayValue: awayPenalties }] : []),
          ],
        },
      ],
    },
  }) as unknown as EspnSummaryResponse

const rows = (home?: string, away?: string) => normalizeBoxScore(response(home, away), HOME, AWAY).teamStats
const row = (home: string | undefined, away: string | undefined, label: string) =>
  rows(home, away).find((r) => r.label === label)

// Notre Dame 7 for 55, Miami 4 for 30.
const count = row('7-55', '4-30', 'Penalties')
check('the penalty count is its own row', [count?.homeValue, count?.awayValue], ['7', '4'])
// Fewer is better, so the bar favours whoever has less — the same flag
// Turnovers carries.
check('and fewer is better on it', count?.invert, true)

const yards = row('7-55', '4-30', 'Penalty Yards')
check('the yards are a row of their own', [yards?.homeValue, yards?.awayValue], ['55', '30'])
check('and fewer is better there too', yards?.invert, true)

// The thing the split is for: "7-55" left whole would be read as a rate
// by the bar, so neither row may carry the combined string.
check(
  'neither row carries the combined string',
  rows('7-55', '4-30').filter((r) => /^\d+-\d+$/.test(r.homeValue)).map((r) => r.label),
  [],
)

// Flagged often for little against rarely for a lot: the two rows
// disagree about who is ahead, which is the reason there are two.
const scrappy = rows('9-45', '3-50')
check('nine for 45 against three for 50 splits the two rows', [
  scrappy.find((r) => r.label === 'Penalties')?.homeValue,
  scrappy.find((r) => r.label === 'Penalty Yards')?.homeValue,
], ['9', '45'])

// A clean game is still a row — 0-0 is a real answer, not a missing one.
const clean = row('0-0', '2-10', 'Penalties')
check('a team with no penalties still gets a row', [clean?.homeValue, clean?.awayValue], ['0', '2'])

// Nothing invented where the payload has nothing, or has something
// unreadable. A row needs a value from both teams, so neither appears.
check('no penalties key means no rows', rows(undefined, undefined).filter((r) => r.label.startsWith('Penalt')), [])
check('one team missing means no rows', rows('7-55', undefined).filter((r) => r.label.startsWith('Penalt')), [])
check('an unreadable value means no rows', rows('seven', '4-30').filter((r) => r.label.startsWith('Penalt')), [])

// The rows sit with Turnovers — the other discipline stat — rather than
// tacked on the end, and the rest of the comparison is undisturbed.
const labels = rows('7-55', '4-30').map((r) => r.label)
check('they sit between Turnovers and Time of Possession',
  labels.slice(labels.indexOf('Turnovers')),
  ['Turnovers', 'Penalties', 'Penalty Yards', 'Time of Possession'])
check('and Total Yards still leads the comparison', labels[0], 'Total Yards')
// Dropping the penalty rows leaves the old comparison exactly as it was.
check('nothing else is added or lost', rows(undefined, undefined).map((r) => r.label),
  ['Total Yards', 'Turnovers', 'Time of Possession'])

report()
