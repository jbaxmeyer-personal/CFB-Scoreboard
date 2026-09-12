/**
 * Every team's colours, fetched once and kept.
 *
 * ESPN's scoreboard competitors carry no colour at all — established on the
 * device, where every comparison bar drew in the same neutral. The colours
 * were then scavenged from wherever else they happened to turn up: a
 * finished game's box score, a team's schedule response. That works, but it
 * only works where those requests already exist, and it re-derives the same
 * unchanging fact on every screen.
 *
 * A team's colours don't change during a season, so they're fetched once
 * from ESPN's own team directory and written to local storage. After the
 * first launch they're there immediately, including offline, and nothing
 * has to go looking.
 *
 * Everything here degrades rather than fails: a request that doesn't come
 * back, or comes back in a shape this doesn't recognise, leaves the store
 * empty and the bars fall back to the sources they use today.
 */
import type { EspnTeam } from '../types/espn'

const TEAMS_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams'
const STORAGE_KEY = 'slate.teamColors.v1'

/** Colours don't change mid-season. Refreshed weekly so a rebrand or a new
 * program lands eventually, without this ever being on the critical path. */
export const TEAM_COLORS_MAX_AGE_MS = 7 * 24 * 60 * 60_000

const REQUEST_TIMEOUT_MS = 12_000

export interface TeamColors {
  color?: string
  alternateColor?: string
}

export type TeamColorMap = Record<string, TeamColors>

interface StoredColors {
  fetchedAt: number
  colors: TeamColorMap
}

/** ESPN nests the directory three deep. Every level is optional here because
 * a shape that doesn't match should yield no colours, not an exception. */
interface EspnTeamDirectoryResponse {
  sports?: { leagues?: { teams?: { team?: EspnTeam }[] }[] }[]
}

function hex(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim().replace(/^#/, '')
  return /^[0-9a-f]{6}$/i.test(trimmed) ? `#${trimmed}` : undefined
}

export function parseTeamDirectory(body: EspnTeamDirectoryResponse | undefined): TeamColorMap {
  const colors: TeamColorMap = {}
  for (const sport of body?.sports ?? []) {
    for (const league of sport.leagues ?? []) {
      for (const entry of league.teams ?? []) {
        const team = entry.team
        if (!team?.id) continue
        const color = hex(team.color)
        const alternateColor = hex(team.alternateColor)
        if (color || alternateColor) colors[team.id] = { color, alternateColor }
      }
    }
  }
  return colors
}

export async function fetchTeamColors(): Promise<TeamColorMap> {
  const res = await fetch(`${TEAMS_URL}?limit=1000`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`ESPN team directory request failed: ${res.status}`)
  return parseTeamDirectory((await res.json()) as EspnTeamDirectoryResponse)
}

export function readStoredTeamColors(): StoredColors | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as StoredColors
    if (!parsed?.colors || typeof parsed.fetchedAt !== 'number') return undefined
    return parsed
  } catch {
    // Unreadable or unparseable storage is the same as none.
    return undefined
  }
}

export function writeStoredTeamColors(colors: TeamColorMap): void {
  // An empty map means the request came back in a shape with no colours in
  // it. Storing that would cache the failure for a week.
  if (Object.keys(colors).length === 0) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ fetchedAt: Date.now(), colors }))
  } catch {
    // Full or blocked storage just means it's fetched again next launch.
  }
}
