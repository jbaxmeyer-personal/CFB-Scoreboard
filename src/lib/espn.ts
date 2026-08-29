import type { EspnCompetitor, EspnEvent, EspnLogo, EspnScoreboardResponse } from '../types/espn'
import type { Game, GameState, Team } from '../types/game'

export const FBS_GROUP = 80

const SCOREBOARD_URL =
  'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard'

export function buildScoreboardUrl(dateParam: string, group = FBS_GROUP): string {
  const params = new URLSearchParams({
    dates: dateParam,
    groups: String(group),
    limit: '300',
  })
  return `${SCOREBOARD_URL}?${params.toString()}`
}

export async function fetchScoreboard(dateParam: string): Promise<EspnScoreboardResponse> {
  const res = await fetch(buildScoreboardUrl(dateParam))
  if (!res.ok) {
    throw new Error(`ESPN scoreboard request failed: ${res.status}`)
  }
  return res.json() as Promise<EspnScoreboardResponse>
}

// ESPN's CDN publishes a "-dark" logo variant for teams whose default mark
// has dark elements that disappear on a dark background (many others 404
// on this path) — e.g. .../teamlogos/ncaa/500/99.png -> .../500-dark/99.png.
// TeamLogo tries this first and falls back to the regular logo on error.
function deriveDarkVariant(url: string): string | undefined {
  const match = url.match(/^(.*\/ncaa\/)500(\/.*)$/)
  return match ? `${match[1]}500-dark${match[2]}` : undefined
}

function pickLogos(logos: EspnLogo[] | undefined, singleLogo: string | undefined): { logoLight?: string; logoDark?: string } {
  if (logos && logos.length > 0) {
    const dark = logos.find((l) => l.rel.includes('dark'))
    const full = logos.find((l) => l.rel.includes('full')) ?? logos[0]
    return { logoLight: full?.href, logoDark: dark?.href ?? full?.href }
  }
  // The scoreboard endpoint gives just this single (light-background) URL.
  if (singleLogo) return { logoLight: singleLogo, logoDark: deriveDarkVariant(singleLogo) ?? singleLogo }
  return {}
}

function toTeam(competitor: EspnCompetitor): Team {
  const { team, curatedRank } = competitor
  const rank = curatedRank?.current
  return {
    id: team.id,
    name: team.displayName,
    shortName: team.shortDisplayName,
    abbreviation: team.abbreviation,
    color: team.color ? `#${team.color}` : undefined,
    alternateColor: team.alternateColor ? `#${team.alternateColor}` : undefined,
    rank: rank && rank > 0 && rank <= 25 ? rank : undefined,
    ...pickLogos(team.logos, team.logo),
  }
}

function toGameState(state: string): GameState {
  if (state === 'in') return 'in'
  if (state === 'post') return 'post'
  return 'pre'
}

export function normalizeEvent(event: EspnEvent): Game | null {
  const competition = event.competitions?.[0]
  if (!competition) return null

  const home = competition.competitors.find((c) => c.homeAway === 'home')
  const away = competition.competitors.find((c) => c.homeAway === 'away')
  if (!home || !away) return null

  const status = competition.status ?? event.status
  const broadcasts = (competition.broadcasts ?? []).flatMap((b) => b.names)
  const possessionId = competition.situation?.possession
  const possession =
    possessionId === home.team.id ? 'home' : possessionId === away.team.id ? 'away' : undefined

  return {
    id: event.id,
    startDate: event.date,
    shortName: event.shortName,
    venue: competition.venue?.fullName,
    home: toTeam(home),
    away: toTeam(away),
    homeScore: home.score !== undefined ? Number(home.score) : undefined,
    awayScore: away.score !== undefined ? Number(away.score) : undefined,
    state: toGameState(status.type.state),
    statusDetail: status.type.shortDetail || status.type.detail,
    period: status.period,
    clock: status.displayClock,
    possession,
    broadcasts,
  }
}

export function normalizeScoreboard(response: EspnScoreboardResponse): Game[] {
  return response.events
    .map(normalizeEvent)
    .filter((g): g is Game => g !== null)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
}
