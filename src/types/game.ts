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
  /** Overall win-loss record entering/during this game, e.g. "7-1". */
  record?: string
  /** Season stat leaders (passing/rushing/receiving), shown pre-game only. */
  seasonLeaders?: StatLeader[]
}

export interface StatLeader {
  category: 'passing' | 'rushing' | 'receiving'
  playerName: string
  displayValue: string
}

export interface TeamStatLine {
  label: string
  homeValue: string
  awayValue: string
}

/** This-game box score — only ever fetched/shown once a game is live or
 * final, and only rendered behind the same spoiler gate as the score. */
export interface GameBoxScore {
  teamStats: TeamStatLine[]
  homeLeaders: StatLeader[]
  awayLeaders: StatLeader[]
}

export type GameState = 'pre' | 'in' | 'post'

/** Identifies one ESPN scoreboard week — seasonType 2 = regular season,
 * 3 = postseason (bowls/playoff). */
export interface WeekSelector {
  year: number
  seasonType: number
  week: number
}

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
