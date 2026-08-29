import { useMemo } from 'react'
import type { Game } from '../types/game'
import { localDateKey } from '../lib/timezone'

export interface DayGroup {
  dateKey: string
  games: Game[]
}

/** Groups games into local-day buckets (in the given timezone), sorted chronologically. */
export function useGamesByDay(games: Game[], zoneId: string): DayGroup[] {
  return useMemo(() => {
    const map = new Map<string, Game[]>()
    for (const game of games) {
      const key = localDateKey(game.startDate, zoneId)
      const bucket = map.get(key)
      if (bucket) bucket.push(game)
      else map.set(key, [game])
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateKey, gamesInDay]) => ({ dateKey, games: gamesInDay }))
  }, [games, zoneId])
}
