import { useMemo } from 'react'
import type { Game } from '../types/game'
import { isGameProtected, toSafeView } from '../lib/spoilers'
import { useSettings } from '../context/SettingsContext'
import { useDelayedGames } from './useDelayedGames'

export interface SafeGameEntry {
  /** Sanitized view — the only thing collapsed rows/cards should ever render. */
  game: Game
  isProtected: boolean
  /**
   * The broadcast delay is holding this game's live state back. Distinct
   * from `isProtected`: a protected game is hidden until you ask for it, and
   * this one simply hasn't been released yet and can't be asked for.
   */
  isDelayed: boolean
  /**
   * The untouched game. Only the expanded Individual Game View may use this,
   * and only behind its own tap-to-reveal gate (SpoilerGate) — never render
   * `rawGame` fields directly in a row, card, or anywhere else.
   *
   * "Untouched" means un-sanitized, not un-delayed: the broadcast delay is
   * applied before this, because a delay you can tap through isn't a delay.
   */
  rawGame: Game
}

/**
 * The single choke point between raw game data and anything rendered on
 * screen. Every screen reads games through this hook rather than the raw
 * list, so a protected score has no path to reach the UI unsanitized —
 * including any future feature (notifications, embeds, sharing).
 *
 * The broadcast delay is applied here, ahead of the spoiler view, for the
 * same reason: one place where live data enters the UI means neither feature
 * can be bypassed by a screen that forgets about it.
 */
export function useSpoilerSafeGames(games: Game[]): SafeGameEntry[] {
  const { settings } = useSettings()
  const delayed = useDelayedGames(games, settings.broadcastDelaySeconds)

  return useMemo(
    () =>
      delayed.map(({ game, isDelayed }) => ({
        game: toSafeView(game, settings.spoilers),
        isProtected: isGameProtected(game, settings.spoilers),
        isDelayed,
        rawGame: game,
      })),
    [delayed, settings.spoilers],
  )
}
