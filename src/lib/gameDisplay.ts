import type { Game } from '../types/game'
import { formatKickoffTime } from './timezone'

/** Kickoff time (in the user's zone) for pre-game, or live/final status text.
 * A game whose time hasn't been announced says so rather than showing the
 * midnight-Eastern placeholder ESPN sends in its place. */
export function kickoffOrStatus(game: Game, zoneId: string): string {
  if (game.state === 'pre') return game.timeTBD ? 'TBD' : formatKickoffTime(game.startDate, zoneId)
  if (game.state === 'post') return 'FINAL'
  if (game.period && game.clock) return `Q${game.period} ${game.clock}`
  return game.statusDetail || 'LIVE'
}
