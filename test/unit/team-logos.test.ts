/**
 * The static team table has to carry the same pair of logos the live feed
 * does.
 *
 * It carried only the light-background mark. TeamLogo starts on the dark
 * variant and falls back, but with no dark variant to start on it went
 * straight to the light one — so every surface fed from this table drew
 * ESPN's light logos on a dark page while the rest of the app drew the dark
 * ones. The Settings pickers had it quietly; the Standings screen put forty
 * of them on one screen and made it obvious.
 */
import { check, report } from '../helpers/check'
import { ALL_TEAMS } from '../../src/data/teams'
import { deriveDarkVariant } from '../../src/lib/espn'

const alabama = ALL_TEAMS.find((t) => t.id === '333')
check('a team from the table has a light mark', alabama?.logoLight, 'https://a.espncdn.com/i/teamlogos/ncaa/500/333.png')
check('and the dark one beside it', alabama?.logoDark, 'https://a.espncdn.com/i/teamlogos/ncaa/500-dark/333.png')

check('every team has both', ALL_TEAMS.every((t) => t.logoLight !== undefined && t.logoDark !== undefined), true)

// TeamLogo only starts on the dark mark when the two differ — identical
// URLs read as "there is no dark variant" and it goes straight to light.
check('and the two are never the same URL', ALL_TEAMS.every((t) => t.logoDark !== t.logoLight), true)

check('all of them on the dark CDN path', ALL_TEAMS.every((t) => t.logoDark?.includes('/ncaa/500-dark/')), true)

// The derivation is shared with the game feed rather than written out
// twice, which is what lets a team from this table and the same team from a
// live game render identically.
check(
  'the table uses the same derivation the scoreboard does',
  ALL_TEAMS.every((t) => t.logoDark === deriveDarkVariant(t.logoLight as string)),
  true,
)

report()
