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

/** Served from public/conferences, so the shield is part of the build: no
 * request, nothing to 404, nothing to answer with a placeholder, and it
 * works offline. BASE_URL carries the /CFB-Scoreboard/ prefix on Pages. */
export function conferenceLogoUrl(conference: Conference): string | undefined {
  if (!conference.logo) return undefined
  return `${import.meta.env.BASE_URL}conferences/${conference.logo}`
}

/**
 * The conference both teams share, or undefined when they don't share one.
 *
 * Independent is deliberately excluded. Notre Dame playing UConn is two
 * teams with the same entry in the membership table, but it is not a
 * conference game and there is no shield to draw — "Independent" is the
 * absence of a conference, not the name of one. It carries no `logo`,
 * which is what rules it out here, along with any conference whose shield
 * hasn't been added yet.
 */
export function conferenceForGame(game: Game, conferences: Conference[]): Conference | undefined {
  return conferences.find((c) => c.logo !== undefined && c.teamIds.has(game.home.id) && c.teamIds.has(game.away.id))
}
