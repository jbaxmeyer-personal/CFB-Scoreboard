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

  // The grid starts at the first kickoff itself, not the hour before it.
  // Rounding down to the hour meant a 5:40 kickoff opened the day at 5:00
  // and the slate began with 40 minutes of dead space.
  const start = minStart
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

/** Real clock-hour boundaries inside the grid's span. The grid no longer
 * starts on an hour boundary, so stepping in hours from its start would
 * label the axis 5:40, 6:40, 7:40 — tick from the first whole hour instead. */
export function hourTicks(bounds: GridBounds): DateTime[] {
  const end = bounds.start.plus({ minutes: bounds.totalMinutes })
  let tick = bounds.start.startOf('hour')
  if (tick < bounds.start) tick = tick.plus({ hours: 1 })

  const ticks: DateTime[] = []
  while (tick <= end) {
    ticks.push(tick)
    tick = tick.plus({ hours: 1 })
  }
  return ticks
}

export interface PositionedGame {
  game: Game
  left: number
  width: number
  /** Which stacked sub-row within the network row this chip sits in. */
  lane: number
}

/**
 * Positions one network's games, stacking overlaps instead of shrinking
 * them.
 *
 * This used to cap each chip's width at the next kickoff on the same
 * network, on the assumption that a network only airs one game at a time.
 * That is false for the streaming rows — ESPN+, ESPNU and SECN+ carry many
 * simultaneous games — so a game followed twenty minutes later by another
 * on the same row was squeezed to roughly its own logo. Every chip now gets
 * the full assumed duration, and a game that would overlap the one before
 * it drops into the next lane, the way a calendar stacks conflicting
 * events. Lanes are reused as soon as they're free, so a row only grows as
 * tall as its worst simultaneous overlap.
 */
export function layoutRow(games: Game[], zoneId: string, bounds: GridBounds): PositionedGame[] {
  const sorted = [...games].sort((a, b) => a.startDate.localeCompare(b.startDate))
  const laneEndsAt: number[] = []

  return sorted.map((game) => {
    const startMin = minutesFromStart(game.startDate, zoneId, bounds)
    const endMin = startMin + ASSUMED_DURATION_MIN

    let lane = laneEndsAt.findIndex((freeAt) => freeAt <= startMin)
    if (lane === -1) lane = laneEndsAt.length
    laneEndsAt[lane] = endMin

    return { game, left: startMin * pxPerMinute(), width: ASSUMED_DURATION_MIN * pxPerMinute(), lane }
  })
}

/** How many stacked lanes a positioned row needs — at least one, so an
 * empty row still occupies a normal row's height. */
export function laneCount(positioned: PositionedGame[]): number {
  return positioned.reduce((most, p) => Math.max(most, p.lane + 1), 1)
}

/**
 * Networks that sort to the bottom of the grid regardless of kickoff time.
 * ESPN+ is an overflow tier carrying many simultaneous lower-profile games,
 * so its row stacks several lanes tall (see layoutRow). Left in kickoff
 * order it would push the marquee rows down the screen; last, it can grow
 * as tall as it needs to without displacing anything above it.
 */
const DEMOTED_NETWORKS = ['ESPN+']

function isDemoted(network: string): boolean {
  return DEMOTED_NETWORKS.includes(network.toUpperCase())
}

/** Games grouped by their first broadcast network. Rows are ordered by each
 * network's earliest kickoff, except the demoted overflow tiers above,
 * which always sort last. */
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
    .sort((a, b) => {
      const demotedDiff = Number(isDemoted(a.network)) - Number(isDemoted(b.network))
      if (demotedDiff !== 0) return demotedDiff
      return a.games[0].startDate.localeCompare(b.games[0].startDate)
    })
}
