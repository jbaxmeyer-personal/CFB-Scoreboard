import { useMemo, useState } from 'react'
import './GameStats.css'
import type { Game, GameBoxScore, GamePlay, StatLeader, Team, TeamStatLine } from '../../types/game'
import { useGameSummary } from '../../hooks/useGameSummary'
import { useReactions } from '../../hooks/useReactions'
import { useSeasonTeamStats } from '../../hooks/useSeasonTeamStats'

const REACTIONS = ['🔥', '😱', '👏', '😂', '💀', '🚀']
const DOWN_ORDINAL = ['', '1st', '2nd', '3rd', '4th']

const CATEGORY_LABEL: Record<StatLeader['category'], string> = {
  passing: 'Passing',
  rushing: 'Rushing',
  receiving: 'Receiving',
}

function LeaderRow({ leader }: { leader: StatLeader }) {
  return (
    <div className="game-stats__leader-row">
      <span className="game-stats__leader-category">{CATEGORY_LABEL[leader.category]}</span>
      <span className="game-stats__leader-name">{leader.playerName}</span>
      <span className="game-stats__leader-value">{leader.displayValue}</span>
    </div>
  )
}

/** Season stat leaders — safe to show pre-game since they reflect the
 * season so far, not this game's outcome. */
export function SeasonLeaders({ home, away }: { home: Team; away: Team }) {
  const hasAny = (home.seasonLeaders?.length ?? 0) > 0 || (away.seasonLeaders?.length ?? 0) > 0
  if (!hasAny) return null

  return (
    <div className="game-stats game-stats--season">
      <h3 className="game-stats__title">Season Leaders</h3>
      <div className="game-stats__columns">
        <div className="game-stats__column">
          <div className="game-stats__column-team">{away.abbreviation}</div>
          {away.seasonLeaders?.map((l) => <LeaderRow key={l.category} leader={l} />)}
        </div>
        <div className="game-stats__column">
          <div className="game-stats__column-team">{home.abbreviation}</div>
          {home.seasonLeaders?.map((l) => <LeaderRow key={l.category} leader={l} />)}
        </div>
      </div>
    </div>
  )
}

/**
 * Season-long team stat comparison (points/yards per game, turnovers,
 * etc.) — safe to show pre-game since it's about the season so far, not
 * this game's outcome. A separate per-team endpoint from season leaders
 * above; degrades to nothing if it doesn't resolve for both teams.
 */
const SEASON_SECTION_LABEL: Record<NonNullable<TeamStatLine['section']>, string> = {
  offense: 'Offense',
  defense: 'Defense',
  turnovers: 'Turnovers',
}

export function SeasonTeamComparison({ home, away, year }: { home: Team; away: Team; year: number }) {
  const { stats, isLoading, isError } = useSeasonTeamStats(home.id, away.id, year)

  if (isLoading) return <p className="game-stats__hint">Loading season stats…</p>
  if (isError || stats.length === 0) return null

  const awayColor = resolveAwayBarColor(home.color, away.color)
  let lastSection: TeamStatLine['section'] | undefined
  return (
    <div className="game-stats">
      <h3 className="game-stats__title">Season Comparison</h3>
      <div className="game-stats__team-header">
        <span>{away.abbreviation}</span>
        <span>{home.abbreviation}</span>
      </div>
      {stats.map((line) => {
        const showSectionHeader = line.section !== undefined && line.section !== lastSection
        lastSection = line.section
        return (
          <div key={line.label}>
            {showSectionHeader && <div className="game-stats__section-label">{SEASON_SECTION_LABEL[line.section!]}</div>}
            <StatRow line={line} awayColor={awayColor} homeColor={home.color} />
          </div>
        )
      })}
    </div>
  )
}

/** Live down/distance/field-position — only rendered while a game is
 * actually in progress (see ExpandedGame). yardLine is 0-100 from the
 * possessing team's own goal line; unverified against a live response but
 * degrades to nothing if the situation data is missing entirely. */
export function FieldPositionBar({ game }: { game: Game }) {
  const sit = game.situation
  if (!sit) return null
  const possessor = game.possession === 'home' ? game.home : game.possession === 'away' ? game.away : undefined
  const color = possessor?.color ?? 'var(--accent-primary)'
  // ESPN sends down/distance as -1 (not just absent) whenever there's no
  // live down to show — between a score and the ensuing kickoff, at
  // halftime, etc. — so a real down is always 1-4, never a value to render.
  const hasDown = sit.down >= 1 && sit.down <= 4

  return (
    <div className="field-bar">
      <div className="field-bar__track">
        <div className="field-bar__fill" style={{ width: `${sit.yardLine}%`, background: color }} />
        <div className="field-bar__marker" style={{ left: `${sit.yardLine}%` }} />
      </div>
      <div className="field-bar__ticks">
        <span>G</span>
        <span>20</span>
        <span>50</span>
        <span>20</span>
        <span>G</span>
      </div>
      {hasDown && (
        <div className="field-bar__downs ticker">
          {DOWN_ORDINAL[sit.down]} &amp; {sit.distance}
          {sit.possessionText ? ` · ${sit.possessionText}` : ''}
        </div>
      )}
    </div>
  )
}

/** Parses "180", "9.5", "-3", or "18:22" (mm:ss) into a comparable number;
 * anything else (e.g. an already-formatted "48.15%") opts out of the
 * comparison bar. */
function parseStatMagnitude(value: string): number | null {
  const mmss = value.match(/^(\d+):(\d{2})$/)
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2])
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value)
  return null
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.replace('#', '').match(/^([0-9a-f]{6})$/i)
  if (!match) return null
  const n = parseInt(match[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function colorDistance(a: string, b: string): number {
  const rgbA = hexToRgb(a)
  const rgbB = hexToRgb(b)
  if (!rgbA || !rgbB) return Infinity
  return Math.sqrt((rgbA.r - rgbB.r) ** 2 + (rgbA.g - rgbB.g) ** 2 + (rgbA.b - rgbB.b) ** 2)
}

function lighten(hex: string, amount: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const mix = (c: number) => Math.round(c + (255 - c) * amount)
  return `#${[mix(rgb.r), mix(rgb.g), mix(rgb.b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/** When both teams share (near enough) the same color — common for two
 * red/blue programs facing off — a solid-color comparison bar becomes
 * unreadable at a glance. Lightens the away team's segment so the two
 * stay visually distinct without introducing an unrelated third color. */
function resolveAwayBarColor(homeColor: string | undefined, awayColor: string | undefined): string | undefined {
  if (!homeColor || !awayColor) return awayColor
  if (colorDistance(homeColor, awayColor) > 60) return awayColor
  return lighten(awayColor, 0.45)
}

function StatRow({ line, awayColor, homeColor }: { line: TeamStatLine; awayColor?: string; homeColor?: string }) {
  const awayNum = parseStatMagnitude(line.awayValue)
  const homeNum = parseStatMagnitude(line.homeValue)
  // A negative value (e.g. turnover margin) can't be shown as a share of a
  // whole — bail out of the bar rather than render a nonsensical width.
  const bothNonNegative = awayNum !== null && homeNum !== null && awayNum >= 0 && homeNum >= 0
  const total = bothNonNegative ? awayNum + homeNum : 0
  const rawAwayPct = total > 0 ? (awayNum! / total) * 100 : 0
  // For an "invert" stat (allowed yards/points, turnovers) a *lower* value
  // is better, so the bigger bar segment should go to whoever has less —
  // i.e. each team's segment shows the *other* team's share of the total.
  const awayPct = line.invert ? 100 - rawAwayPct : rawAwayPct

  return (
    <div className="game-stats__stat-row">
      <div className="game-stats__stat-row-line">
        <span className="game-stats__stat-value">{line.awayValue}</span>
        <span className="game-stats__stat-label">{line.label}</span>
        <span className="game-stats__stat-value">{line.homeValue}</span>
      </div>
      {total > 0 && (
        <div className="game-stats__stat-bar">
          <span className="game-stats__stat-bar-segment" style={{ width: `${awayPct}%`, background: awayColor ?? 'var(--text-tertiary)' }} />
          <span className="game-stats__stat-bar-segment" style={{ width: `${100 - awayPct}%`, background: homeColor ?? 'var(--text-tertiary)' }} />
          {/* Marks the exact halfway point so it's obvious at a glance which
              side's segment crosses past it — that's always the "ahead" team. */}
          <span className="game-stats__stat-bar-mid" />
        </div>
      )}
    </div>
  )
}

function BoxScoreBody({ boxScore, home, away }: { boxScore: GameBoxScore; home: Team; away: Team }) {
  const hasStats = boxScore.teamStats.length > 0
  const hasLeaders = boxScore.homeLeaders.length > 0 || boxScore.awayLeaders.length > 0
  if (!hasStats && !hasLeaders) return null

  const awayColor = resolveAwayBarColor(home.color, away.color)
  return (
    <div className="game-stats">
      {hasStats && (
        <>
          <h3 className="game-stats__title">Team Stats</h3>
          <div className="game-stats__team-header">
            <span>{away.abbreviation}</span>
            <span>{home.abbreviation}</span>
          </div>
          {boxScore.teamStats.map((line) => (
            <StatRow key={line.label} line={line} awayColor={awayColor} homeColor={home.color} />
          ))}
        </>
      )}
      {hasLeaders && (
        <>
          <h3 className="game-stats__title">Game Leaders</h3>
          <div className="game-stats__columns">
            <div className="game-stats__column">
              <div className="game-stats__column-team">{away.abbreviation}</div>
              {boxScore.awayLeaders.map((l) => <LeaderRow key={l.category} leader={l} />)}
            </div>
            <div className="game-stats__column">
              <div className="game-stats__column-team">{home.abbreviation}</div>
              {boxScore.homeLeaders.map((l) => <LeaderRow key={l.category} leader={l} />)}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Fetches and renders the box score for the game currently expanded — only
 * mounted for a live/final game once its detail view is visible (and, when
 * protected, only after the spoiler reveal — see ExpandedGame), so this
 * never fires for every game in a list.
 */
export function GameBoxScoreContainer({ game }: { game: Game }) {
  const { boxScore, isLoading, isError } = useGameSummary(game.id, game.home.id, game.away.id, game.state === 'in')

  if (isLoading) return <p className="game-stats__hint">Loading stats…</p>
  if (isError || !boxScore) return null

  return <BoxScoreBody boxScore={boxScore} home={game.home} away={game.away} />
}

function PlayRow({ play, reaction, onReact }: { play: GamePlay; reaction?: string; onReact: (emoji: string) => void }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  return (
    <div className={`game-stats__play-row${play.isScoringPlay ? ' game-stats__play-row--scoring' : ''}`}>
      <div className="game-stats__play-main">
        <span className="game-stats__play-meta">
          Q{play.period}
          <br />
          {play.clock}
        </span>
        <span className="game-stats__play-text">{play.text}</span>
        <span className="game-stats__play-score ticker">
          {play.awayScore}–{play.homeScore}
        </span>
        <button
          type="button"
          className="game-stats__play-react-trigger"
          onClick={() => setPickerOpen((o) => !o)}
          aria-label="React to this play"
        >
          {reaction ?? '+'}
        </button>
      </div>
      {pickerOpen && (
        <div className="game-stats__play-react-menu">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={`game-stats__play-react-option${reaction === emoji ? ' game-stats__play-react-option--selected' : ''}`}
              onClick={() => {
                onReact(emoji)
                setPickerOpen(false)
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface LeadStats {
  leadChanges: number
  homeBiggestLead: number
  awayBiggestLead: number
  homeBiggestLeadPeriod?: number
  awayBiggestLeadPeriod?: number
}

/** Every number here is a pure derivation from the same plays we already
 * fetch — no new endpoint, no new risk. */
function computeLeadStats(plays: GamePlay[]): LeadStats | null {
  if (plays.length === 0) return null
  const chronological = [...plays].reverse()
  let leadChanges = 0
  let prevLeader: 'home' | 'away' | 'tie' = 'tie'
  const stats: LeadStats = { leadChanges: 0, homeBiggestLead: 0, awayBiggestLead: 0 }

  for (const play of chronological) {
    const diff = play.homeScore - play.awayScore
    const leader = diff > 0 ? 'home' : diff < 0 ? 'away' : 'tie'
    if (leader !== 'tie' && prevLeader !== 'tie' && leader !== prevLeader) leadChanges++
    if (diff > stats.homeBiggestLead) {
      stats.homeBiggestLead = diff
      stats.homeBiggestLeadPeriod = play.period
    }
    if (-diff > stats.awayBiggestLead) {
      stats.awayBiggestLead = -diff
      stats.awayBiggestLeadPeriod = play.period
    }
    if (leader !== 'tie') prevLeader = leader
  }
  stats.leadChanges = leadChanges
  return stats
}

function LeadTracker({ stats, home, away }: { stats: LeadStats; home: Team; away: Team }) {
  return (
    <div className="game-stats__leads">
      <h3 className="game-stats__title">
        Biggest Leads · {stats.leadChanges} lead change{stats.leadChanges === 1 ? '' : 's'}
      </h3>
      <div className="game-stats__columns">
        <div className="game-stats__column">
          <div className="game-stats__column-team">{away.abbreviation}</div>
          <div className="game-stats__lead-value">
            {stats.awayBiggestLead > 0 ? `${stats.awayBiggestLead} at Q${stats.awayBiggestLeadPeriod}` : 'None'}
          </div>
        </div>
        <div className="game-stats__column">
          <div className="game-stats__column-team">{home.abbreviation}</div>
          <div className="game-stats__lead-value">
            {stats.homeBiggestLead > 0 ? `${stats.homeBiggestLead} at Q${stats.homeBiggestLeadPeriod}` : 'None'}
          </div>
        </div>
      </div>
    </div>
  )
}

type PlayFilter = 'all' | 'scoring'

/**
 * Fetches and renders the live play-by-play feed for the game currently
 * expanded, newest play first — same gating and shared query as the box
 * score above (see GameBoxScoreContainer), so mounting both here costs no
 * extra network request. Each play carries your own emoji reaction, saved
 * locally (see useReactions) — no accounts, no server, no other users.
 */
export function PlayByPlayContainer({ game }: { game: Game }) {
  const { plays, isLoading, isError } = useGameSummary(game.id, game.home.id, game.away.id, game.state === 'in')
  const { reactions, setReaction } = useReactions()
  // A finished game defaults to just the scoring plays (the full feed is a
  // long scroll of no-longer-relevant detail once the outcome is set); a
  // live game defaults to the full feed since every play still matters.
  const [filter, setFilter] = useState<PlayFilter>(game.state === 'post' ? 'scoring' : 'all')

  const leadStats = useMemo(() => computeLeadStats(plays), [plays])
  const visiblePlays = filter === 'scoring' ? plays.filter((p) => p.isScoringPlay) : plays

  if (isLoading) return <p className="game-stats__hint">Loading plays…</p>
  if (isError || plays.length === 0) return null

  return (
    <>
      {leadStats && <LeadTracker stats={leadStats} home={game.home} away={game.away} />}
      <div className="game-stats">
        <div className="game-stats__plays-header">
          <h3 className="game-stats__title">Play by Play</h3>
          <div className="game-stats__play-filter">
            <button
              type="button"
              className={`game-stats__play-filter-option${filter === 'all' ? ' game-stats__play-filter-option--active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`game-stats__play-filter-option${filter === 'scoring' ? ' game-stats__play-filter-option--active' : ''}`}
              onClick={() => setFilter('scoring')}
            >
              Scoring
            </button>
          </div>
        </div>
        <div className="game-stats__plays">
          {visiblePlays.map((play) => {
            const key = `${game.id}:${play.id}`
            return <PlayRow key={play.id} play={play} reaction={reactions[key]} onReact={(emoji) => setReaction(key, emoji)} />
          })}
        </div>
      </div>
    </>
  )
}
