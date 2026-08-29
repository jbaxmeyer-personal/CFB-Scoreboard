import { useMemo } from 'react'
import type { Game } from '../types/game'
import { isGameProtected, toSafeView } from '../lib/spoilers'
import { useSettings } from '../context/SettingsContext'

export interface SafeGameEntry {
  /** Sanitized view — the only thing collapsed rows/cards should ever render. */
  game: Game
  isProtected: boolean
  /**
   * The untouched game. Only the expanded Individual Game View may use this,
   * and only behind its own tap-to-reveal gate (SpoilerGate) — never render
   * `rawGame` fields directly in a row, card, or anywhere else.
   */
  rawGame: Game
}

/**
 * The single choke point between raw game data and anything rendered on
 * screen. Every screen reads games through this hook rather than the raw
 * list, so a protected score has no path to reach the UI unsanitized —
 * including any future feature (notifications, embeds, sharing).
 */
export function useSpoilerSafeGames(games: Game[]): SafeGameEntry[] {
  const { settings } = useSettings()
  return useMemo(
    () =>
      games.map((game) => ({
        game: toSafeView(game, settings.spoilers),
        isProtected: isGameProtected(game, settings.spoilers),
        rawGame: game,
      })),
    [games, settings.spoilers],
  )
}
