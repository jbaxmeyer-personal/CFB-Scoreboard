import type { GamePlay } from '../types/game'
import type { EspnSummaryResponse } from '../types/espn'

export interface LinescorePeriod {
  period: number
  home: number
  away: number
}

/** 1st-4th, then overtimes. ESPN numbers OT as period 5 onwards. */
export function periodLabel(period: number): string {
  if (period <= 4) return ['1st', '2nd', '3rd', '4th'][period - 1]
  return period === 5 ? 'OT' : `${period - 4}OT`
}

/**
 * ESPN's own points per quarter, when the summary carries them.
 *
 * Preferred over deriving quarters from the play-by-play, because ESPN's
 * line is the authority and the derived one is not: each play carries the
 * running score *as reported at that play*, and those snapshots lag — a
 * safety was seen reading 31-20 while the free kick after it read 33-20.
 * A play that is stamped in one quarter but carries the score from the
 * next puts points in the wrong column, which is what a reported box score
 * did (20 and 4 in the 2nd and 3rd where ESPN had 17 and 7).
 *
 * Returns nothing unless both sides are present with the same number of
 * periods — a half-populated line would be worse than the derived one.
 */
export function linescoreFromSummary(response: EspnSummaryResponse | undefined): LinescorePeriod[] | null {
  const competitors = response?.header?.competitions?.[0]?.competitors
  if (!Array.isArray(competitors)) return null

  const home = competitors.find((c) => c?.homeAway === 'home')?.linescores
  const away = competitors.find((c) => c?.homeAway === 'away')?.linescores
  if (!Array.isArray(home) || !Array.isArray(away)) return null
  if (home.length === 0 || home.length !== away.length) return null

  const periods: LinescorePeriod[] = []
  for (let i = 0; i < home.length; i += 1) {
    const h = periodPoints(home[i])
    const a = periodPoints(away[i])
    // A missing or unreadable entry means this line can't be trusted as a
    // whole; fall back rather than render a quarter as a silent zero.
    if (h === undefined || a === undefined) return null
    periods.push({ period: i + 1, home: h, away: a })
  }
  return periods
}

/** One team's points in one period.
 *
 * Confirmed against a real payload: ESPN sends these as `displayValue`
 * strings only — `{"displayValue":"17"}` — with no numeric `value` field at
 * all. Reading `value` alone found nothing and silently fell back to the
 * derived line, so both are read, the number first. */
function periodPoints(entry: { value?: number; displayValue?: string } | undefined): number | undefined {
  if (typeof entry?.value === 'number' && Number.isFinite(entry.value)) return entry.value
  const text = entry?.displayValue?.trim()
  if (!text || !/^\d+$/.test(text)) return undefined
  return Number(text)
}

/**
 * Points per quarter derived from the play-by-play. The fallback for when
 * ESPN's own line (above) isn't in the payload.
 *
 * Every play already carries the period it belongs to and the running score
 * after it, so the last play of a quarter is that quarter's closing score
 * and the difference between two of them is what was scored in between.
 * Nothing new is requested, and it inherits the corrections the play list
 * has already had — a called-back touchdown is off the board here too. What
 * it cannot correct is a lagging snapshot at a quarter boundary, which is
 * why ESPN's own line is preferred whenever there is one.
 *
 * Only quarters that have actually been played appear, so a game in the
 * second shows two columns rather than four with zeroes standing in for
 * football that hasn't happened.
 */
export function computeLinescore(plays: GamePlay[]): LinescorePeriod[] | null {
  if (plays.length === 0) return null

  const closing = new Map<number, { home: number; away: number }>()
  let lastPeriod = 0
  // Plays are chronological, so the last one written for a period is that
  // period's closing score.
  for (const play of plays) {
    if (!play.period) continue
    closing.set(play.period, { home: play.homeScore, away: play.awayScore })
    lastPeriod = Math.max(lastPeriod, play.period)
  }
  if (lastPeriod === 0) return null

  const periods: LinescorePeriod[] = []
  let previous = { home: 0, away: 0 }
  for (let period = 1; period <= lastPeriod; period += 1) {
    // A quarter with no plays of its own closes where the last one did.
    const end = closing.get(period) ?? previous
    periods.push({
      period,
      // Never negative: points taken off the board in a later quarter than
      // they were scored in would otherwise read as a negative quarter.
      home: Math.max(0, end.home - previous.home),
      away: Math.max(0, end.away - previous.away),
    })
    previous = end
  }
  return periods
}
