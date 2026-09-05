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
export function stripLiveState(game: Game): Game {
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
  }
}

/**
 * The no-spoilers view of a game. Anything that renders a game outside the
 * explicit tap-to-reveal flow — grid rows, overview cards, and any future
 * feature (notifications, embeds, sharing) — must render through this
 * function rather than touching `Game` fields directly, so a protected score
 * has no path to leak out.
 */
export function toSafeView(game: Game, spoilers: SpoilerSettings): Game {
  return isGameProtected(game, spoilers) ? stripLiveState(game) : game
}
