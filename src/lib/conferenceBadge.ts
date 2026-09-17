/**
 * Which conference a game belongs to, for the badge on Slate and Scoreboard.
 *
 * A conference game is both teams in the same conference. That's the fact
 * worth marking: a conference game carries standings, a non-conference game
 * mostly doesn't, and in September the two are mixed together all day.
 *
 * Membership already lives in src/data/conferences.ts, so this costs a set
 * lookup and no request.
 */
import type { Game } from '../types/game'
import type { Conference } from '../data/conferences'

/** ESPN files its conference logos under its own group ids. The `dark/`
 * variant is the one drawn for dark backgrounds, which is every background
 * in this app.
 *
 * Only that variant is used. The plain shields are dark ink on transparent
 * — Dynasty Tracker draws the same assets and has to sit them on white to
 * make them show — and a backing behind a logo is the circle that came off
 * the team logos on purpose. So where there is no dark variant the badge
 * draws nothing, rather than something invisible or a stand-in for it. */
const CONFERENCE_LOGO_BASE = 'https://a.espncdn.com/i/teamlogos/ncaa_conf/500'

export function conferenceLogoUrl(conference: Conference): string | undefined {
  if (!conference.espnId) return undefined
  return `${CONFERENCE_LOGO_BASE}/dark/${conference.espnId}.png`
}

/**
 * The conference both teams share, or undefined when they don't share one.
 *
 * Independent is deliberately excluded. Notre Dame playing UConn is two
 * teams with the same entry in the membership table, but it is not a
 * conference game and there is no shield to draw — "Independent" is the
 * absence of a conference, not the name of one. It carries no `espnId`,
 * which is what rules it out here.
 */
export function conferenceForGame(game: Game, conferences: Conference[]): Conference | undefined {
  return conferences.find((c) => c.espnId !== undefined && c.teamIds.has(game.home.id) && c.teamIds.has(game.away.id))
}
