import type { EspnSummaryResponse } from '../types/espn'
import type { Game } from '../types/game'
import type { TeamProfileStat } from './espn'

/**
 * A team's defensive season numbers, added up from its own games.
 *
 * These used to come from `results.opponent` on ESPN's team statistics
 * endpoint — what opponents did against this team. That field does not
 * exist. It was an assumption written into a comment as though it were a
 * fact, and because every defensive row read from it, every one of them
 * evaluated to undefined and the whole Defense section silently disappeared
 * off the team page. Nothing errored; the section simply was not there.
 *
 * What does exist is the other side of every box score the team has played.
 * `boxscore.teams` in a game summary carries both teams' totals, and the
 * team page already fetches those summaries. So what opponents did against
 * this team is the sum of the opponent column across its own games — the
 * same source, and the same arithmetic, as the player totals beside it.
 *
 * Points allowed doesn't even need the box score: it is the other score in
 * each game, which the schedule already carries.
 */

/** ESPN writes completions and attempts as one "18/27" cell. */
function attemptsOf(pair: string | undefined): number | undefined {
  const match = pair?.match(/^(\d+)\/(\d+)$/)
  return match ? Number(match[2]) : undefined
}

function statValue(stats: { name: string; displayValue: string }[] | undefined, name: string): number | undefined {
  const raw = stats?.find((s) => s.name === name)?.displayValue
  if (raw === undefined) return undefined
  const value = Number(raw.replace(/,/g, ''))
  return Number.isFinite(value) ? value : undefined
}

interface Totals {
  games: number
  points: number
  totalYards: number
  passYards: number
  rushYards: number
  passAttempts: number
  rushAttempts: number
  /** Counted per figure, since a game whose box score is missing a category
   * must not drag the average down as though the opponent gained nothing. */
  yardGames: number
  passGames: number
  rushGames: number
  pointGames: number
}

const EMPTY: Totals = {
  games: 0, points: 0, totalYards: 0, passYards: 0, rushYards: 0,
  passAttempts: 0, rushAttempts: 0, yardGames: 0, passGames: 0, rushGames: 0, pointGames: 0,
}

/** What this team's opponents did to it, game by game. */
export function opponentTotals(
  teamId: string,
  games: { game: Game; summary?: EspnSummaryResponse }[],
): Totals {
  const totals = { ...EMPTY }

  for (const { game, summary } of games) {
    // The opponent's score is the one that isn't this team's. Read from the
    // schedule rather than the box score, so it lands even for a game whose
    // team statistics never posted.
    const isHome = game.home.id === teamId
    const isAway = game.away.id === teamId
    if (!isHome && !isAway) continue
    const pointsAgainst = isHome ? game.awayScore : game.homeScore
    if (pointsAgainst !== undefined) {
      totals.points += pointsAgainst
      totals.pointGames++
    }

    const entry = summary?.boxscore?.teams?.find((t) => t.team.id !== teamId)
    if (!entry) continue
    totals.games++

    const yards = statValue(entry.statistics, 'totalYards')
    if (yards !== undefined) {
      totals.totalYards += yards
      totals.yardGames++
    }
    const passYards = statValue(entry.statistics, 'netPassingYards')
    const passAttempts = attemptsOf(entry.statistics?.find((s) => s.name === 'completionAttempts')?.displayValue)
    if (passYards !== undefined) {
      totals.passYards += passYards
      totals.passGames++
      if (passAttempts !== undefined) totals.passAttempts += passAttempts
    }
    const rushYards = statValue(entry.statistics, 'rushingYards')
    const rushAttempts = statValue(entry.statistics, 'rushingAttempts')
    if (rushYards !== undefined) {
      totals.rushYards += rushYards
      totals.rushGames++
      if (rushAttempts !== undefined) totals.rushAttempts += rushAttempts
    }
  }

  return totals
}

function rate(total: number, divisor: number): string | undefined {
  return divisor > 0 ? (total / divisor).toFixed(1) : undefined
}

/**
 * The defensive rows, in the order and wording the offensive rows use, so
 * the two blocks read as one table.
 *
 * No national ranks: ranking these would mean knowing what every other team
 * allowed, which is a different and much larger question than this answers.
 * A rank column that is empty for defence is honest; an invented one is not.
 */
export function seasonDefenseRows(teamId: string, games: { game: Game; summary?: EspnSummaryResponse }[]): TeamProfileStat[] {
  const totals = opponentTotals(teamId, games)
  const rows: TeamProfileStat[] = []
  const add = (label: string, value: string | undefined) => {
    if (value !== undefined) rows.push({ label, value, section: 'defense' })
  }

  add('Points Allowed Per Game', rate(totals.points, totals.pointGames))
  add('Total Yards Allowed Per Game', rate(totals.totalYards, totals.yardGames))
  add('Passing Yards Allowed Per Game', rate(totals.passYards, totals.passGames))
  add('Rushing Yards Allowed Per Game', rate(totals.rushYards, totals.rushGames))
  add('Passing Yards Allowed Per Play', rate(totals.passYards, totals.passAttempts))
  add('Rushing Yards Allowed Per Play', rate(totals.rushYards, totals.rushAttempts))
  return rows
}
