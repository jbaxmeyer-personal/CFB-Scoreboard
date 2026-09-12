import type { GamePlay } from '../types/game'

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
 * Points per quarter, worked out from the play-by-play rather than fetched.
 *
 * Every play already carries the period it belongs to and the running score
 * after it, so the last play of a quarter is that quarter's closing score
 * and the difference between two of them is what was scored in between.
 * Nothing new is requested, and it inherits the corrections the play list
 * has already had — a called-back touchdown is off the board here too.
 *
 * Only quarters that have actually been played appear, so a game in the
 * second shows two columns rather than four with zeroes standing in for
 * football that hasn't happened.
 */
export function computeLinescore(plays: GamePlay[]): LinescorePeriod[] | null {
  if (plays.length === 0) return null

  const closing = new Map<number, { home: number; away: number }>()
  let lastPeriod = 0
  // plays is newest-first; walking it in reverse leaves each period mapped
  // to the score after its final play.
  for (const play of [...plays].reverse()) {
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
