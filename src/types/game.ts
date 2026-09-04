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
  /** Split records — this team's record at home / on the road this season,
   * not specific to whoever they're playing this game. Best-effort: parsed
   * from the same `records` array as the overall record above. */
  homeRecord?: string
  awayRecord?: string
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
  /** Season-comparison-only: groups the row under an Offense/Defense/
   * Turnovers subheader, and (for allowed/defense stats, where a lower
   * value is better) flips which team's bar segment reads as "ahead". */
  section?: 'offense' | 'defense' | 'turnovers'
  invert?: boolean
}

/** This-game box score — only ever fetched/shown once a game is live or
 * final, and only rendered behind the same spoiler gate as the score. */
export interface GameBoxScore {
  teamStats: TeamStatLine[]
  homeLeaders: StatLeader[]
  awayLeaders: StatLeader[]
}

/** One play from the live play-by-play feed — same spoiler-gating rules as
 * the box score (only ever shown once a game is live or final). */
export interface GamePlay {
  id: string
  text: string
  period: number
  clock: string
  homeScore: number
  awayScore: number
  isScoringPlay: boolean
}

export type GameState = 'pre' | 'in' | 'post'

/** Live down/distance/field-position, when the game is in progress.
 * yardLine is 0-100 from the possessing team's own goal line. */
export interface FieldSituation {
  down: number
  distance: number
  yardLine: number
  possessionText: string
  isRedZone: boolean
}

/** Identifies one ESPN scoreboard week — seasonType 2 = regular season,
 * 3 = postseason (bowls/playoff). */
export interface WeekSelector {
  year: number
  seasonType: number
  week: number
}

export interface Game {
  id: string
  /** ESPN's competition id. Usually equal to the event id, but it is a
   * distinct field and the core API addresses games by
   * events/{eventId}/competitions/{competitionId} — so assuming they match
   * is a guess, and a wrong one 404s the whole core fallback. Read from the
   * payload instead; falls back to the event id only when absent. */
  competitionId: string
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
  situation?: FieldSituation
}
