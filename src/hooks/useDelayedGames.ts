import { useEffect, useMemo, useRef, useState } from 'react'
import type { Game } from '../types/game'
import { stripLiveState } from '../lib/spoilers'
import { nextDueAt, pruneReleased, recordSnapshot, selectReleased, type Snapshot } from '../lib/delayBuffer'

export interface DelayedGame {
  game: Game
  /** The delay is holding this game's live state back — score, clock and
   * state have been stripped, and appear once the buffer has aged. */
  isDelayed: boolean
}

interface GameBuffer {
  snapshots: Snapshot<Game>[]
  /** Whether this game has ever been seen in progress. A game that was
   * already final the first time we saw it is history, not a broadcast, and
   * is never delayed — but one that goes final while we're watching has its
   * FINAL held back like any other update, since that transition is the last
   * thing you want ahead of the picture. */
  wasLive: boolean
}

/** Only live games are held back. A game that hasn't kicked off has no live
 * state to leak, and one that was over before we ever saw it is already
 * spoiled or not, independent of anything we do now. */
function shouldDelay(game: Game, buffer: GameBuffer | undefined): boolean {
  if (game.state === 'in') return true
  return game.state === 'post' && buffer?.wasLive === true
}

/** Live fields only. Kickoff time, teams and networks don't change, so
 * including them would restart the delay on cosmetic churn. */
function fingerprintOf(game: Game): string {
  return JSON.stringify([
    game.state,
    game.homeScore,
    game.awayScore,
    game.statusDetail,
    game.period,
    game.clock,
    game.possession,
    game.situation,
  ])
}

/**
 * Runs live game data `delaySeconds` behind, per game.
 *
 * Each game keeps its own short history of what the feed said and when we
 * were told, and the game rendered is the newest entry old enough to
 * release. Per game rather than per poll, so switching days — or one game
 * kicking off while another is already running — doesn't restart anyone
 * else's clock.
 *
 * On a fresh load there is no history to show: we know only the current
 * state, which is exactly the thing being withheld. So a live game reads as
 * live with no score until the first snapshot ages in. That gap lasts the
 * delay's length, once, and it is the honest answer — the alternative is
 * showing the very score the delay exists to hold back.
 *
 * Unlike no-spoilers mode, the delay cannot be tapped through. Revealing it
 * on demand would just be the spoiler arriving early by another route.
 */
export function useDelayedGames(games: Game[], delaySeconds: number): DelayedGame[] {
  const buffers = useRef(new Map<string, GameBuffer>())
  // Marks "time has moved" so the selection below recomputes. Bumped when a
  // snapshot is recorded and when one comes due.
  const [tick, setTick] = useState(0)
  const delayMs = Math.max(0, delaySeconds) * 1000

  // Recording is a side effect, so it happens after the commit rather than
  // during render; the tick is what re-renders with the new entry.
  useEffect(() => {
    if (delayMs === 0) {
      buffers.current.clear()
      return
    }
    const now = Date.now()
    let changed = false
    for (const game of games) {
      let buffer = buffers.current.get(game.id)
      if (!buffer) {
        buffer = { snapshots: [], wasLive: false }
        buffers.current.set(game.id, buffer)
      }
      if (game.state === 'in') buffer.wasLive = true
      if (recordSnapshot(buffer.snapshots, game, fingerprintOf(game), now)) changed = true
    }
    if (changed) setTick((t) => t + 1)
  }, [games, delayMs])

  const result = useMemo<DelayedGame[]>(() => {
    if (delayMs === 0) return games.map((game) => ({ game, isDelayed: false }))
    const now = Date.now()

    return games.map((game) => {
      const buffer = buffers.current.get(game.id)
      if (!shouldDelay(game, buffer)) return { game, isDelayed: false }

      const released = buffer && selectReleased(buffer.snapshots, now, delayMs)
      if (!released) return { game: stripLiveState(game), isDelayed: true }
      return { game: released.value, isDelayed: false }
    })
    // `tick` stands in for the clock this reads through Date.now().
  }, [games, delayMs, tick])

  // Wake up exactly when the next held snapshot comes due, rather than
  // polling on an interval: with nothing pending there is no timer at all.
  useEffect(() => {
    if (delayMs === 0) return
    const now = Date.now()
    let soonest = Infinity
    for (const game of games) {
      const buffer = buffers.current.get(game.id)
      if (!buffer || !shouldDelay(game, buffer)) continue
      const due = nextDueAt(buffer.snapshots, now, delayMs)
      if (due !== undefined && due < soonest) soonest = due
    }
    if (soonest === Infinity) return
    const timer = setTimeout(() => setTick((t) => t + 1), Math.max(50, soonest - now))
    return () => clearTimeout(timer)
  }, [games, delayMs, tick])

  useEffect(() => {
    if (delayMs === 0) return
    const now = Date.now()
    for (const buffer of buffers.current.values()) pruneReleased(buffer.snapshots, now, delayMs)
  }, [delayMs, tick])

  return result
}
