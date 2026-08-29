// Shape of the (unofficial) ESPN college football scoreboard response.
// Only the fields Slate actually reads are typed here — the real payload
// carries a lot more. See README for the endpoint caveat.

export interface EspnLogo {
  href: string
  width: number
  height: number
  alt?: string
  rel: string[]
}

export interface EspnTeam {
  id: string
  location: string
  name?: string
  abbreviation: string
  displayName: string
  shortDisplayName: string
  color?: string
  alternateColor?: string
  // The scoreboard endpoint typically gives a single `logo` URL; the richer
  // `logos` array (with rel tags like "dark") shows up on other ESPN
  // endpoints (e.g. /teams/{id}) and occasionally here too — handle both.
  logo?: string
  logos?: EspnLogo[]
}

export interface EspnCurrentRank {
  current: number
}

export interface EspnRecord {
  name?: string
  type?: string
  summary: string
}

export interface EspnCompetitor {
  id: string
  homeAway: 'home' | 'away'
  winner?: boolean
  team: EspnTeam
  score?: string
  curatedRank?: EspnCurrentRank
  records?: EspnRecord[]
}

export interface EspnStatusType {
  id: string
  name: string
  state: 'pre' | 'in' | 'post'
  completed: boolean
  description: string
  detail: string
  shortDetail: string
}

export interface EspnStatus {
  clock?: number
  displayClock?: string
  period?: number
  type: EspnStatusType
}

export interface EspnBroadcast {
  market?: string
  names: string[]
}

export interface EspnSituation {
  possession?: string
}

export interface EspnCompetition {
  id: string
  date: string
  competitors: EspnCompetitor[]
  status: EspnStatus
  broadcasts?: EspnBroadcast[]
  situation?: EspnSituation
  venue?: { fullName?: string }
}

export interface EspnEvent {
  id: string
  date: string
  name: string
  shortName: string
  competitions: EspnCompetition[]
  status: EspnStatus
}

export interface EspnScoreboardResponse {
  events: EspnEvent[]
}
