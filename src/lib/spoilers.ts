import type { Game } from '../types/game'

export interface SpoilerSettings {
  globalEnabled: boolean
  protectedGameIds: string[]
  protectedTeamIds: string[]
}

export function isGameProtected(game: Game, spoilers: SpoilerSettings): boolean {
  if (spoilers.globalEnabled) return true
  if (spoilers.protectedGameIds.includes(game.id)) return true
  if (spoilers.protectedTeamIds.includes(game.home.id)) return true
  if (spoilers.protectedTeamIds.includes(game.away.id)) return true
  return false
}

// Design call (flagged in the project brief, not yet confirmed with the user):
// a protected *live* game is still allowed to show a bare "LIVE" pulse — it
// reveals that the game is happening, not who's ahead or whether it ended.
// Flip this to `false` if that itself feels like too much of a spoiler.
const SHOW_LIVE_BADGE_FOR_PROTECTED_GAMES = true

/**
 * Every score/result/live-state field, stripped, leaving only what the
 * schedule already tells you: who is playing, when, and on what.
 *
 * Two features share this. No-spoilers mode strips a game the viewer asked
 * never to see, and the broadcast delay strips a live game whose current
 * state hasn't been released yet — different reasons, but the same set of
 * fields has to go, so they use one implementation rather than two that can
 * drift apart.
 */
export function stripLiveState(game: Game, spoilers?: SpoilerSettings): Game {
  const isLive = game.state === 'in' && SHOW_LIVE_BADGE_FOR_PROTECTED_GAMES

  return {
    ...game,
    homeScore: undefined,
    awayScore: undefined,
    // A protected FINAL is presented identically to a protected upcoming
    // game — otherwise "no score shown, but marked final" still spoils the
    // fact that the game is over.
    state: isLive ? 'in' : 'pre',
    statusDetail: isLive ? 'LIVE' : game.state === 'pre' ? game.statusDetail : '',
    period: undefined,
    clock: undefined,
    possession: undefined,
    situation: undefined,
    home: hidesRecord(game.home, game, spoilers) ? withoutRecord(game.home) : game.home,
    away: hidesRecord(game.away, game, spoilers) ? withoutRecord(game.away) : game.away,
  }
}

/**
 * Whether this team's record has to be withheld on this game.
 *
 * A record is a running tally of results, so it leaks in two ways.
 *
 * Once *this* game has kicked off, it is counted in both teams' records —
 * "5-0" beside "2-2" names the winner as plainly as the scoreline does.
 * Both sides lose it, whatever the reason for hiding the game.
 *
 * The subtler one, which the first version of this missed: a protected
 * team's record counts the games they have already played, so it leaks
 * *those* results on every later fixture too. Notre Dame protected and
 * 5-0 on next week's card says they won today. So a team on the protected
 * list never shows a record, on any game, including one that has not
 * kicked off.
 *
 * The other side of such a fixture keeps theirs. Protecting Notre Dame is
 * not a request to hide Purdue's season.
 */
function hidesRecord(team: Game['home'], game: Game, spoilers?: SpoilerSettings): boolean {
  if (game.state !== 'pre') return true
  if (!spoilers) return false
  return spoilers.globalEnabled || spoilers.protectedTeamIds.includes(team.id)
}

function withoutRecord(team: Game['home']): Game['home'] {
  return team.record === undefined ? team : { ...team, record: undefined }
}

/**
 * The no-spoilers view of a game. Anything that renders a game outside the
 * explicit tap-to-reveal flow — grid rows, overview cards, and any future
 * feature (notifications, embeds, sharing) — must render through this
 * function rather than touching `Game` fields directly, so a protected score
 * has no path to leak out.
 */
export function toSafeView(game: Game, spoilers: SpoilerSettings): Game {
  return isGameProtected(game, spoilers) ? stripLiveState(game, spoilers) : game
}
