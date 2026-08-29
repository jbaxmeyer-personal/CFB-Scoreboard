import { DateTime } from 'luxon'
import type { Game } from '../types/game'
import { resolveZone } from './timezone'

// Visual layout constants for the horizontal timeline grid. ESPN doesn't
// give us an actual end time, so chip width is an assumed average CFB game
// length — long enough that the grid reads like a real broadcast schedule
// (games overlapping into the next kickoff slot) rather than implying every
// game wraps in under an hour.
export const PX_PER_HOUR = 78
export const LABEL_WIDTH = 68
export const ASSUMED_DURATION_MIN = 210 // ~3.5 hours
const MIN_SPAN_HOURS = 5

export interface GridBounds {
  start: DateTime
  totalMinutes: number
}

export interface NetworkRow {
  network: string
  games: Game[]
}

export function computeGridBounds(games: Game[], zoneId: string): GridBounds | null {
  if (games.length === 0) return null
  const zone = resolveZone(zoneId)
  const starts = games.map((g) => DateTime.fromISO(g.startDate, { zone }))

  let minStart = starts[0]
  let maxStart = starts[0]
  for (const s of starts) {
    if (s < minStart) minStart = s
    if (s > maxStart) maxStart = s
  }

  const start = minStart.startOf('hour')
  const latestNeeded = maxStart.plus({ minutes: ASSUMED_DURATION_MIN })
  let end = latestNeeded.startOf('hour')
  if (end < latestNeeded) end = end.plus({ hours: 1 })

  let totalMinutes = end.diff(start, 'minutes').minutes
  const minMinutes = MIN_SPAN_HOURS * 60
  if (totalMinutes < minMinutes) totalMinutes = minMinutes

  return { start, totalMinutes }
}

export function pxPerMinute(): number {
  return PX_PER_HOUR / 60
}

export function chipWidth(): number {
  return ASSUMED_DURATION_MIN * pxPerMinute()
}

export function minutesFromStart(iso: string, zoneId: string, bounds: GridBounds): number {
  const zone = resolveZone(zoneId)
  const dt = DateTime.fromISO(iso, { zone })
  return dt.diff(bounds.start, 'minutes').minutes
}

/** Minutes from the grid's start hour to right now, in the given zone —
 * used to position the "now" line. Can be negative or beyond totalMinutes
 * if the viewed day isn't today; callers should check that range. */
export function nowOffsetMinutes(zoneId: string, bounds: GridBounds): number {
  const zone = resolveZone(zoneId)
  return DateTime.now().setZone(zone).diff(bounds.start, 'minutes').minutes
}

export function hourTicks(bounds: GridBounds): DateTime[] {
  const ticks: DateTime[] = []
  const hours = Math.ceil(bounds.totalMinutes / 60)
  for (let i = 0; i <= hours; i++) {
    ticks.push(bounds.start.plus({ hours: i }))
  }
  return ticks
}

export interface PositionedGame {
  game: Game
  left: number
  width: number
}

/**
 * A single network only ever airs one game at a time, so games on the same
 * row never stack — instead, each chip's width is capped at the next
 * game's kickoff on that same network (falling back to the full assumed
 * duration for the last game in the row).
 */
export function layoutRow(games: Game[], zoneId: string, bounds: GridBounds): PositionedGame[] {
  const sorted = [...games].sort((a, b) => a.startDate.localeCompare(b.startDate))
  return sorted.map((game, i) => {
    const startMin = minutesFromStart(game.startDate, zoneId, bounds)
    const next = sorted[i + 1]
    const gapToNext = next ? minutesFromStart(next.startDate, zoneId, bounds) - startMin : Infinity
    const durationMin = Math.min(ASSUMED_DURATION_MIN, gapToNext)
    return { game, left: startMin * pxPerMinute(), width: durationMin * pxPerMinute() }
  })
}

/** Games grouped by their first broadcast network, rows ordered by each network's earliest kickoff. */
export function groupByNetwork(games: Game[]): NetworkRow[] {
  const map = new Map<string, Game[]>()
  for (const game of games) {
    const key = game.broadcasts[0] ?? 'TBD'
    const bucket = map.get(key)
    if (bucket) bucket.push(game)
    else map.set(key, [game])
  }
  return [...map.entries()]
    .map(([network, gamesForNetwork]) => ({
      network,
      games: gamesForNetwork.sort((a, b) => a.startDate.localeCompare(b.startDate)),
    }))
    .sort((a, b) => a.games[0].startDate.localeCompare(b.games[0].startDate))
}
