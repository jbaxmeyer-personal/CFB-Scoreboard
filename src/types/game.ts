// Normalized domain types the UI actually renders. Keeping these separate
// from the raw ESPN response means the rest of the app (and a future
// native port) never has to know ESPN's response shape directly.

export interface Team {
  id: string
  name: string
  shortName: string
  abbreviation: string
  color?: string
  alternateColor?: string
  logoLight?: string
  logoDark?: string
  rank?: number
}

export type GameState = 'pre' | 'in' | 'post'

export interface Game {
  id: string
  startDate: string // ISO 8601, UTC
  shortName: string
  venue?: string
  home: Team
  away: Team
  homeScore?: number
  awayScore?: number
  state: GameState
  statusDetail: string // e.g. "7:30 PM", "Q3 4:12", "FINAL"
  period?: number
  clock?: string
  possession?: 'home' | 'away'
  broadcasts: string[]
}
