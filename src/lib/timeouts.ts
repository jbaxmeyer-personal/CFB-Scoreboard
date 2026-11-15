import type { GamePlay, Team, TeamTimeouts } from '../types/game'

/**
 * Timeouts left, counted from the play-by-play.
 *
 * ESPN's live situation carries a timeouts field, and this used to show
 * it. The trouble is that its meaning could not be checked from the build
 * environment and could not be settled from a phone either: a reading of
 * "A&M 1" fits both "one left" and "one used", and the two are opposite.
 * A field that might be inverted is worse than no field.
 *
 * The plays are not ambiguous. ESPN posts a timeout as a play of its own —
 * "Timeout Texas A&M, clock 07:50" — carrying the period it happened in
 * and the name of the team charged. Three per half minus the ones charged
 * in the half being played is the answer by construction: it cannot be
 * inverted, it cannot be mirrored between home and away, and it resets at
 * halftime without anything having to know that halftime happened.
 *
 * It is only as current as the play feed, which runs a little behind the
 * scoreboard's clock. For a thing that changes a few times a half, that
 * is a better trade than a number that might be backwards.
 */

/** Three a half. Overtime is its own thing: one each in the first overtime
 * and one each in the second, neither carried over — and then, from the
 * third overtime, one each for the whole rest of the game however many
 * periods it runs to.
 *
 * That last part is a 2025 rule change, made for pace of play after a
 * coach called a timeout on every defensive play of an eight-overtime
 * game. It is why the third overtime onward is one block rather than one
 * per period: the allowance is shared across all of them.
 *
 * Regulation timeouts never carry into overtime either, which falls out of
 * counting per block rather than needing its own rule. */
const PER_HALF = 3
const PER_OVERTIME = 1

/** The period the third overtime starts at: four quarters, then OT1, OT2. */
const THIRD_OVERTIME = 7

/** Which block of the game a period belongs to. Timeouts reset between
 * blocks, so only the plays inside the current one are counted. */
function block(period: number): string {
  if (period <= 2) return 'H1'
  if (period <= 4) return 'H2'
  // The first two overtimes stand alone. The third and everything after it
  // share one block, because they share one timeout.
  if (period >= THIRD_OVERTIME) return 'OT3+'
  return `OT${period - 4}`
}

function allowance(period: number): number {
  return period <= 4 ? PER_HALF : PER_OVERTIME
}

/**
 * How many each side is entitled to in the block this period belongs to.
 *
 * Exported so the row can draw that many pips rather than always three: in
 * overtime a team has one, and three pips with one lit would say they had
 * spent two they never had.
 */
export function timeoutAllowance(period: number | undefined): number {
  return !period || period < 1 ? PER_HALF : allowance(period)
}

/** ESPN writes the team charged into the play text. */
const TIMEOUT_TEXT = /^timeout\s+(.+?)(?:,|\s+clock\b|$)/i

function normalize(value: string | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** How well the name in the play text matches one of a team's own names:
 * an exact match, a prefix of one, or nothing. */
const EXACT = 2
const PREFIX = 1
const NO_MATCH = 0

/**
 * How strongly this timeout's text names this team.
 *
 * Matched on the team's own names rather than on who had the ball: a
 * defence can call a timeout, so the play's offence is the wrong team about
 * half the time.
 *
 * A prefix counts because the text says "Texas A&M" where the team is
 * "Texas A&M Aggies" — but only as the weaker answer, never as an equal
 * one. In a Texas / Texas A&M game, "Timeout Texas A&M" is a prefix of
 * Texas and the whole of Texas A&M; treating those the same would make the
 * clearest possible text ambiguous and charge the timeout to nobody.
 * Nothing looser than a prefix is considered in either direction.
 */
function matchStrength(name: string, team: Team): number {
  const called = normalize(name)
  if (!called) return NO_MATCH
  let best = NO_MATCH
  for (const candidate of [team.shortName, team.name, team.abbreviation]) {
    const known = normalize(candidate)
    if (!known) continue
    if (known === called) return EXACT
    if (known.startsWith(called) || called.startsWith(known)) best = PREFIX
  }
  return best
}

export function timeoutsLeft(
  plays: GamePlay[],
  home: Team,
  away: Team,
  period: number | undefined,
): TeamTimeouts | undefined {
  if (!period || period < 1) return undefined
  // No plays at all means the feed for this game is missing, not that
  // nobody has called a timeout: a live game in the second half always has
  // plays. Showing a confident "three each" off an empty list would be
  // inventing the one thing this is supposed to stop doing, so the row is
  // left off instead. A game whose plays exist but hold no timeout in the
  // current half is the other case, and three each is right there.
  if (plays.length === 0) return undefined
  const here = block(period)
  const left = allowance(period)
  let homeUsed = 0
  let awayUsed = 0

  for (const play of plays) {
    if (block(play.period) !== here) continue
    const called = TIMEOUT_TEXT.exec(play.text.trim())?.[1]
    if (!called) continue
    // The better match is charged. A tie goes to neither side rather than
    // being guessed at — including the tie at zero, where the text named a
    // team that is not in this game at all. A wrong crest is worse than a
    // missing one.
    const homeMatch = matchStrength(called, home)
    const awayMatch = matchStrength(called, away)
    if (homeMatch > awayMatch) homeUsed += 1
    else if (awayMatch > homeMatch) awayUsed += 1
  }

  // Clamped, because a feed that repeats a timeout play must not produce a
  // negative count.
  return { home: Math.max(0, left - homeUsed), away: Math.max(0, left - awayUsed) }
}
