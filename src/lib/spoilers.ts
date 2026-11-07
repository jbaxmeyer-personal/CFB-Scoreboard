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
 *
 * Both records go, on every protected game, whichever team is the reason
 * it is protected. This was briefly cleverer than that: on a game not yet
 * played only the protected team's record was withheld, on the argument
 * that protecting Notre Dame is not a request to hide Miami's season. The
 * argument is wrong twice over. A card reading "MIA 8-0" beside a blank
 * says plainly which team you are protecting, which is a thing about you
 * on screen for anyone looking over your shoulder; and a half-filled row
 * reads as a bug, not as a choice. One record on a protected card is
 * worth less than none.
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
    // Both records, always. A protected game shows no records at all.
    home: withoutRecord(game.home),
    away: withoutRecord(game.away),
  }
}

/**
 * Whether this team's season record is withheld, on any surface, with no
 * game in the question at all.
 *
 * The standings screen is a table of nothing but records, so it needs the
 * same rule the cards use, minus the per-game part. Shared rather than
 * restated: the two surfaces disagreeing about whether Notre Dame's 5-0 is
 * a spoiler is exactly the kind of drift this file exists to prevent.
 *
 * Protected *game* ids deliberately don't count. Hiding one game is about
 * that game; it is not a request to blank out either team's season.
 */
export function hidesTeamSeason(teamId: string, spoilers: SpoilerSettings): boolean {
  return spoilers.globalEnabled || spoilers.protectedTeamIds.includes(teamId)
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
  return isGameProtected(game, spoilers) ? stripLiveState(game) : game
}
