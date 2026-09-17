/**
 * The colour to mark a favourite's game in.
 *
 * Whichever of a team's two colours is lighter. A team wears a dark and a
 * light — nobody's kit is black and navy — so the lighter of the pair is
 * the one that can be seen against this app's panels. Taking the primary
 * without looking is what made Notre Dame's highlight invisible: #0c2340
 * against a near-black panel is nothing at all.
 *
 * Returns undefined when neither colour clears the dark-panel threshold, or
 * when the team carries no colours. Callers fall back to the app's own
 * favourite amber, so a team with no usable colour is still marked — the
 * point is that a favourite is always visible, not that it is always in
 * school colours.
 */
import type { Team } from '../types/game'

/** Below this an HSL lightness disappears into the panels. Shared with the
 * comparison bars, which learned the same lesson on the same teams. */
const MIN_LIGHTNESS = 0.32

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const value = Number.parseInt(match[1], 16)
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 }
}

/** HSL lightness, 0-1. */
export function lightness(hex: string | undefined): number | null {
  if (!hex) return null
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const max = Math.max(rgb.r, rgb.g, rgb.b) / 255
  const min = Math.min(rgb.r, rgb.g, rgb.b) / 255
  return (max + min) / 2
}

export interface TeamPalette {
  color?: string
  alternateColor?: string
}

/** The lighter of a team's two colours, if it's light enough to see.
 *
 * `fallback` is the team-colour directory. The scoreboard's own competitors
 * carry no colours at all — that is why the directory exists — so without
 * consulting it this would find nothing to work with and every favourite
 * would come out the same amber. */
export function teamHighlightColor(team: Team | undefined, fallback?: TeamPalette): string | undefined {
  if (!team) return undefined
  const candidates = [team.color ?? fallback?.color, team.alternateColor ?? fallback?.alternateColor]
    .flatMap((hex) => {
      const l = lightness(hex)
      return l === null || hex === undefined ? [] : [{ hex, l }]
    })
    .sort((a, b) => b.l - a.l)
  const lightest = candidates[0]
  return lightest && lightest.l >= MIN_LIGHTNESS ? lightest.hex : undefined
}

/** The colour for a game, from whichever side is the favourite. Home first
 * when both are, so a rivalry between two of your teams picks one and stays
 * with it rather than depending on which list came back first. */
export function favoriteHighlightColor(
  home: Team,
  away: Team,
  isFavoriteTeam: (teamId: string) => boolean,
  palette?: (teamId: string) => TeamPalette | undefined,
): string | undefined {
  if (isFavoriteTeam(home.id)) return teamHighlightColor(home, palette?.(home.id))
  if (isFavoriteTeam(away.id)) return teamHighlightColor(away, palette?.(away.id))
  return undefined
}
