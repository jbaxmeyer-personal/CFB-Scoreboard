import { useMemo, useState } from 'react'
import './GameStats.css'
import type { Game, GameBoxScore, GamePlay, PlayerStatCategory, StatLeader, Team, TeamStatLine } from '../../types/game'
import { useGameSummary } from '../../hooks/useGameSummary'
import type { CurrentDrive, SummaryDiagnostics } from '../../lib/espn'
import { useReactions } from '../../hooks/useReactions'
import { useSeasonTeamStats } from '../../hooks/useSeasonTeamStats'
import { TeamLogo } from '../shared/TeamLogo'

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

  const awayColor = resolveAwayBarColor(home, away)
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

/** A yard line as the feed writes it — "ORE 34" — placed on the bar's axis,
 * where 0 is the away team's goal line and 100 is the home team's.
 *
 * This text is the only field-position value that says what it means: the
 * abbreviation names which half of the field the number counts from. It is
 * also checkable, because that abbreviation has to be one of the two teams
 * in this game — anything else, or any text not in this form, returns
 * undefined so the caller falls back rather than placing the ball somewhere
 * invented.
 */
function positionFromFieldText(text: string | undefined, game: Game): number | undefined {
  const match = text?.trim().match(/^([A-Za-z&.'-]{2,6})\s+(\d{1,2})$/)
  if (!match) return undefined
  const yard = Number(match[2])
  // A yard line runs 1 to 50 from each side; anything else isn't one. Zero
  // is excluded on purpose: the feed uses it as a placeholder, not a spot —
  // a drive that began at Oregon's own 25 came through as "ORE 0" — and the
  // goal line itself is written as the 1. Treating it as a real position is
  // what painted the fill across the whole field.
  if (!Number.isFinite(yard) || yard < 1 || yard > 50) return undefined
  const side = match[1].toUpperCase()
  if (side === game.away.abbreviation?.toUpperCase()) return yard
  if (side === game.home.abbreviation?.toUpperCase()) return 100 - yard
  return undefined
}

/** Live down/distance/field-position — only rendered while a game is
 * actually in progress (see ExpandedGame). The bar fixes away's goal on the
 * left and home's on the right, like a broadcast graphic, so the two ends
 * never swap when possession changes and the ball moves back and forth
 * realistically. Degrades to nothing if the situation data is missing. */
export function FieldPositionBar({ game, drive }: { game: Game; drive?: CurrentDrive }) {
  const sit = game.situation
  if (!sit) return null
  const possessor = game.possession === 'home' ? game.home : game.possession === 'away' ? game.away : undefined
  const color = possessor?.color ?? 'var(--accent-primary)'
  // ESPN sends down/distance as -1 (not just absent) whenever there's no
  // live down to show — between a score and the ensuing kickoff, at
  // halftime, etc. — so a real down is always 1-4, never a value to render.
  const hasDown = sit.down >= 1 && sit.down <= 4

  // The ball, on the fixed axis.
  //
  // `possessionText` first, because it names the side it counts from. The
  // numeric `yardLine` is the fallback, and it is measured from the HOME
  // team's goal line — not, as this once assumed, from the goal line of
  // whoever has the ball. Those two readings agree whenever the home team is
  // driving, which is why the bar looked right until an away team had it and
  // the ball appeared mirrored into the wrong half. Checked against four
  // live states where the text gave the true spot: "ORE 34", "BOIS 42",
  // "OHIO 37" and "HOU 40" all place correctly this way and only this way.
  const fieldPosition = positionFromFieldText(sit.possessionText, game) ?? 100 - sit.yardLine

  // The fill is the drive: from where this possession began to the ball. It
  // used to run from the ball to the possessing team's own goal, which grew
  // as they advanced and so read as a drive the length of the field.
  //
  // Drive start comes only as text that names the side its number counts
  // from, and now from the drive's own plays rather than its `start` field —
  // both numbers on that field turned out to be unusable, `yardsToEndzone`
  // reading 100 and `yardLine` reading 0 for the same drive that plainly
  // began at Oregon's own 25 (see driveStartText). Each painted the fill to
  // the goal line, which is the very thing this bar was changed to stop
  // doing. No fill at all beats a wrong one, so there is no numeric
  // fallback: without readable text the bar shows the ball and nothing else.
  const driveIsCurrent =
    drive !== undefined &&
    (drive.teamId === undefined || drive.teamId === possessor?.id || drive.teamAbbr === possessor?.abbreviation)
  const driveStart = driveIsCurrent ? positionFromFieldText(drive.startText, game) : undefined
  const fillLeft = driveStart === undefined ? 0 : Math.min(driveStart, fieldPosition)
  const fillWidth = driveStart === undefined ? 0 : Math.abs(fieldPosition - driveStart)

  // Which way they're going: away attacks rightward toward home's goal,
  // home leftward toward away's.
  const attackingLeft = game.possession === 'home'

  return (
    <div className="field-bar">
      <div className="field-bar__track">
        {fillWidth > 0 && (
          <div className="field-bar__fill" style={{ left: `${fillLeft}%`, width: `${fillWidth}%`, background: color }} />
        )}
        {possessor && (
          <div
            className={`field-bar__possessor${attackingLeft ? ' field-bar__possessor--left' : ''}`}
            style={{ left: `${fieldPosition}%` }}
          >
            <span className="field-bar__arrow" aria-hidden="true">
              {attackingLeft ? '\u25C0' : '\u25B6'}
            </span>
            <TeamLogo team={possessor} size={18} />
          </div>
        )}
        <div className="field-bar__marker" style={{ left: `${fieldPosition}%` }} />
      </div>
      <div className="field-bar__ticks">
        <span className="field-bar__ticks-team" style={{ color: game.away.color }}>
          {game.away.abbreviation}
        </span>
        <span>20</span>
        <span>50</span>
        <span>20</span>
        <span className="field-bar__ticks-team" style={{ color: game.home.color }}>
          {game.home.abbreviation}
        </span>
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

/** Parses "180", "9.5", "-3", "18:22" (mm:ss), "0:18:22" (hh:mm:ss — some
 * duration stats like time of possession come zero-padded with an hours
 * component), or "3-7" (a converted-of-attempted efficiency like 3rd down
 * and red zone, compared as its success *rate* so the bigger segment goes
 * to the better percentage rather than to whoever simply had more
 * attempts) into a comparable number; anything else (e.g. an
 * already-formatted "48.15%") opts out of the comparison bar. */
function parseStatMagnitude(value: string): number | null {
  if (/^\d+(:\d{2}){1,2}$/.test(value)) {
    return value.split(':').reduce((total, part) => total * 60 + Number(part), 0)
  }
  const eff = value.match(/^(\d+)-(\d+)$/)
  if (eff) {
    const attempts = Number(eff[2])
    return attempts === 0 ? 0 : (Number(eff[1]) / attempts) * 100
  }
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

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return { h: h * 60, s, l }
}

/** Shortest distance between two hues on the 360° color wheel. */
function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

/** Do these two colors read as the same color family? Not just
 * near-identical RGB values, but the same hue at a different shade (e.g.
 * UMass maroon vs. Rutgers scarlet: both plainly "red" to the eye despite
 * an RGB distance over 75). Falls back to plain RGB distance for
 * near-grayscale colors, where hue isn't meaningful. */
function readsAsSameColor(a: string, b: string): boolean {
  const aHsl = hexToHsl(a)
  const bHsl = hexToHsl(b)
  if (aHsl && bHsl && aHsl.s > 0.15 && bHsl.s > 0.15) return hueDistance(aHsl.h, bHsl.h) < 30
  return colorDistance(a, b) < 60
}

/** A near-black team color (several schools list black as their alternate)
 * disappears against this app's dark panels, so it can't stand in as the
 * away team's bar color no matter how distinct it is from the home team. */
function isVisibleOnDarkPanel(hex: string): boolean {
  const hsl = hexToHsl(hex)
  return hsl !== null && hsl.l > 0.22
}

/** Neutral stand-in for when a team has no usable distinct color left —
 * deliberately not a tint of their own color, which reads as a *wrong*
 * team color (a lightened maroon looks pink, which is nobody's color). */
const NEUTRAL_BAR_COLOR = '#c6cede'

/** Two solid bar segments in the same color family are unreadable at a
 * glance, so when the primaries clash the away team falls back to its own
 * secondary (alternate) color — a real color that team actually wears —
 * rather than a lightened tint of its primary. If the secondary is also
 * too close to the home color, or is too dark to show up on a dark panel
 * at all, a neutral light slate stands in instead. */
function resolveAwayBarColor(home: Team, away: Team): string | undefined {
  const homeColor = home.color
  const awayColor = away.color
  if (!homeColor || !awayColor) return awayColor
  if (!readsAsSameColor(homeColor, awayColor)) return awayColor

  const awayAlternate = away.alternateColor
  if (awayAlternate && isVisibleOnDarkPanel(awayAlternate) && !readsAsSameColor(homeColor, awayAlternate)) {
    return awayAlternate
  }
  return NEUTRAL_BAR_COLOR
}

function StatRow({ line, awayColor, homeColor }: { line: TeamStatLine; awayColor?: string; homeColor?: string }) {
  const awayNum = parseStatMagnitude(line.awayValue)
  const homeNum = parseStatMagnitude(line.homeValue)
  // A negative value (e.g. turnover margin) can't be shown as a share of a
  // whole — bail out of the bar rather than render a nonsensical width.
  const bothNonNegative = awayNum !== null && homeNum !== null && awayNum >= 0 && homeNum >= 0
  const total = bothNonNegative ? awayNum + homeNum : 0
  // A genuine 0-0 tie (e.g. neither team has turned it over) still gets a
  // bar — split exactly down the middle, since neither side is "ahead".
  const rawAwayPct = bothNonNegative ? (total > 0 ? (awayNum! / total) * 100 : 50) : 0
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
      {bothNonNegative && (
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

/** One category's table — passing, kick returns, whatever the game had.
 *
 * Always open. It was collapsible when the worry was a dozen categories
 * burying the play-by-play, but the reason to scroll down here is to read
 * the numbers, and a heading that hides them is a tap between someone and
 * the thing they came for. */
export function PlayerCategory({ category }: { category: PlayerStatCategory }) {
  return (
    <div className="player-stats__category">
      <h4 className="player-stats__heading">
        {category.label}
        <span className="player-stats__count">{category.rows.length}</span>
      </h4>
      {/* Its own horizontal scroller: some categories carry eight or nine
          columns, and the page itself must never scroll sideways. */}
      <div className="player-stats__scroll">
        <table className="player-stats__table">
          <thead>
            <tr>
              <th scope="col">Player</th>
              {/* Keyed by position, not by label: ESPN's own passing
                  category lists QBR twice, so a label is not unique. */}
              {category.columns.map((column, i) => (
                <th key={i} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {category.rows.map((row) => (
              <tr key={row.playerName}>
                <th scope="row">{row.playerName}</th>
                {row.stats.map((stat, i) => (
                  <td key={i}>{stat}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** The full individual box score, one team at a time.
 *
 * One team at a time rather than side by side: these are wide tables of
 * small numbers, and two of them on a phone would mean either four-point
 * type or a page that scrolls sideways. The toggle costs a tap and keeps
 * every column readable. */
function PlayerBoxScore({ boxScore, home, away }: { boxScore: GameBoxScore; home: Team; away: Team }) {
  const [side, setSide] = useState<'away' | 'home'>('away')
  const categories = side === 'home' ? boxScore.homePlayers : boxScore.awayPlayers
  const team = side === 'home' ? home : away

  return (
    <>
      <div className="game-stats__section-head">
        <h3 className="game-stats__title">Player Stats</h3>
        {/* Its own control rather than the play filter's styling, which is a
            pair of small text pills. This one is a choice between two teams,
            so it carries their crests and is sized to be hit while
            scrolling. */}
        <div className="player-stats__teams" role="group" aria-label="Which team's players to show">
          {(['away', 'home'] as const).map((option) => {
            const team = option === 'home' ? home : away
            return (
              <button
                key={option}
                type="button"
                className={`player-stats__team${side === option ? ' player-stats__team--active' : ''}`}
                onClick={() => setSide(option)}
                aria-pressed={side === option}
              >
                <TeamLogo team={team} size={20} />
                {team.abbreviation}
              </button>
            )
          })}
        </div>
      </div>
      {categories.length === 0 ? (
        <p className="game-stats__hint">No individual stats for {team.abbreviation} yet.</p>
      ) : (
        categories.map((category) => <PlayerCategory key={category.name} category={category} />)
      )}
    </>
  )
}

function BoxScoreBody({ boxScore, home, away }: { boxScore: GameBoxScore; home: Team; away: Team }) {
  const hasStats = boxScore.teamStats.length > 0
  const hasLeaders = boxScore.homeLeaders.length > 0 || boxScore.awayLeaders.length > 0
  const hasPlayers = boxScore.homePlayers.length > 0 || boxScore.awayPlayers.length > 0
  if (!hasStats && !hasLeaders && !hasPlayers) return null

  const awayColor = resolveAwayBarColor(home, away)
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
      {hasPlayers && <PlayerBoxScore boxScore={boxScore} home={home} away={away} />}
    </div>
  )
}

/** The team that had the ball, matched against this game's two. ESPN's drive
 * objects don't always carry an id, so the abbreviation is a second key. A
 * play we can't attribute — anything from the core-API fallback, which has no
 * drive team — simply gets no crest rather than a guessed one. */
function offenseTeam(play: GamePlay, game: Game): Team | undefined {
  for (const team of [game.home, game.away]) {
    if (play.offenseTeamId && team.id === play.offenseTeamId) return team
    if (play.offenseTeamAbbr && team.abbreviation === play.offenseTeamAbbr) return team
  }
  return undefined
}

function PlayRow({
  play,
  team,
  showClock,
  reaction,
  onReact,
}: {
  play: GamePlay
  team?: Team
  showClock: boolean
  reaction?: string
  onReact: (emoji: string) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  return (
    <div className={`game-stats__play-row${play.isScoringPlay ? ' game-stats__play-row--scoring' : ''}`}>
      <div className="game-stats__play-main">
        {/* Keeps its width when the clock is hidden, so the rows below a
            repeat still line up with the one that carries the time. */}
        <span className="game-stats__play-meta">
          {showClock && (
            <>
              Q{play.period}
              <br />
              {play.clock}
            </>
          )}
        </span>
        {/* Its own column between the clock and the description, not inline
            with the words: a fixed-width slot keeps every play's text on the
            same left edge, and it holds that slot even on a play with no
            attribution so the feed doesn't jog in and out. */}
        <span className="game-stats__play-team" title={team ? `${team.name} on offense` : undefined}>
          {team && <TeamLogo team={team} size={18} />}
        </span>
        <span className="game-stats__play-text">
          {/* Leads the description, in place of the formation ESPN prefixed
              nearly every play with. Absent on plays with no down at all —
              kickoffs, extra points, end of quarter — where the description
              stands on its own. */}
          {play.downDistance && <span className="game-stats__play-down">{play.downDistance}</span>}
          {play.text}
        </span>
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
 * Renders the play-by-play feed, newest play first. Each play carries your
 * own emoji reaction, saved locally (see useReactions) — no accounts, no
 * server, no other users. Only mounted once there's at least one play to
 * show; the empty and failed cases are handled once for the whole summary
 * by GameSummarySections below.
 */
function PlayByPlay({ game, plays }: { game: Game; plays: GamePlay[] }) {
  const { reactions, setReaction } = useReactions()
  // A finished game defaults to just the scoring plays (the full feed is a
  // long scroll of no-longer-relevant detail once the outcome is set); a
  // live game defaults to the full feed since every play still matters.
  const [filter, setFilter] = useState<PlayFilter>(game.state === 'post' ? 'scoring' : 'all')

  const leadStats = useMemo(() => computeLeadStats(plays), [plays])
  const visiblePlays = filter === 'scoring' ? plays.filter((p) => p.isScoringPlay) : plays

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
          {visiblePlays.map((play, i) => {
            const key = `${game.id}:${play.id}`
            // ESPN's per-play clock stalls: a live payload had a kickoff, a
            // 10-yard run and a false start all stamped 15:00 (their
            // wallclocks were two minutes apart), which read as three plays
            // happening at the same instant. The clock isn't wrong so much
            // as unchanged, so show it once per run of plays sharing it
            // instead of repeating a time that didn't advance.
            const prev = visiblePlays[i - 1]
            const repeatsClock = prev !== undefined && prev.period === play.period && prev.clock === play.clock
            return (
              <PlayRow
                key={play.id}
                play={play}
                team={offenseTeam(play, game)}
                showClock={!repeatsClock}
                reaction={reactions[key]}
                onReact={(emoji) => setReaction(key, emoji)}
              />
            )
          })}
        </div>
      </div>
    </>
  )
}

/**
 * Why this game's stats panel is empty. Rendering nothing leaves a live
 * game showing just a score and a venue, with no way to tell a Slate bug
 * from missing data — but the fix for that isn't to assert a reason either.
 * ESPN's API can't be reached from where this is built, so this states only
 * what's actually known ("nothing came back"), always offers a retry, and
 * puts the response's real shape one tap away instead of guessing at it.
 */
function SummaryNotice({
  gameId,
  isError,
  state,
  onRetry,
  diagnostics,
}: {
  gameId: string
  isError: boolean
  state: Game['state']
  onRetry: () => void
  diagnostics?: SummaryDiagnostics
}) {
  const [showDetails, setShowDetails] = useState(false)

  const message = isError
    ? 'Couldn\u2019t load stats for this game.'
    : state === 'in'
      ? 'No play-by-play or team stats have come back for this game yet.'
      : 'No play-by-play or team stats came back for this game.'

  return (
    <div className="game-stats__notice">
      <p className="game-stats__hint">{message}</p>
      <div className="game-stats__notice-actions">
        <button type="button" className="game-stats__notice-retry" onClick={onRetry}>
          Retry
        </button>
        {/* Confirmed necessary: ESPN's summary endpoint can return every
            container present and empty for a game — team statistics, player
            categories and leaders all zero — with no drives at all. There's
            nothing left for Slate to parse in that case, so the useful thing
            is one tap to the source rather than a dead end. */}
        <a
          className="game-stats__notice-retry"
          href={`https://www.espn.com/college-football/game/_/gameId/${gameId}`}
          target="_blank"
          rel="noreferrer"
        >
          View on ESPN
        </a>
        {diagnostics && (
          <button type="button" className="game-stats__notice-retry" onClick={() => setShowDetails((open) => !open)}>
            {showDetails ? 'Hide details' : 'What came back?'}
          </button>
        )}
      </div>
      {showDetails && diagnostics && (
        <dl className="game-stats__notice-details">
          <div>
            <dt>event / comp</dt>
            <dd>
              {diagnostics.eventId}
              {diagnostics.competitionId !== diagnostics.eventId ? ` / ${diagnostics.competitionId}` : ' (same)'}
            </dd>
          </div>
          <div>
            <dt>playByPlaySource</dt>
            <dd>{diagnostics.pbpSource}</dd>
          </div>
          <div>
            <dt>plays</dt>
            <dd>{diagnostics.plays}</dd>
          </div>
          <div>
            <dt>current drive</dt>
            <dd>{diagnostics.currentDrive}</dd>
          </div>
          <div>
            <dt>matching on</dt>
            <dd>{diagnostics.wantTeams}</dd>
          </div>
          <div>
            <dt>boxscore.teams</dt>
            <dd>{diagnostics.boxTeams}</dd>
          </div>
          <div>
            <dt>boxscore.players</dt>
            <dd>{diagnostics.boxPlayers}</dd>
          </div>
          <div>
            <dt>first stat names</dt>
            <dd>{diagnostics.statNames}</dd>
          </div>
          <div>
            <dt>leaders</dt>
            <dd>{diagnostics.leaders}</dd>
          </div>
          <div>
            <dt>core stats</dt>
            <dd>{diagnostics.coreStats ?? '(not fetched)'}</dd>
          </div>
          <div>
            <dt>core competitors</dt>
            <dd>{diagnostics.coreCompetitors ?? '(not fetched)'}</dd>
          </div>
          <div>
            <dt>core plays</dt>
            <dd>{diagnostics.corePlays ?? '(not fetched)'}</dd>
          </div>
          <div>
            <dt>keys</dt>
            <dd>{diagnostics.keys}</dd>
          </div>
        </dl>
      )}
    </div>
  )
}

/**
 * The whole detail half of an expanded live/final game: play-by-play and
 * box score, which come from a single shared request, plus the one notice
 * that explains an empty result. Both sections read the same query, so
 * owning them together means one hook call, one loading state, and one
 * explanation instead of two components independently rendering nothing.
 */
export function GameSummarySections({ game }: { game: Game }) {
  const { plays, boxScore, isLoading, isError, isDelayed, diagnostics, refetch } = useGameSummary(game, game.state === 'in')

  const hasPlays = plays.length > 0
  const hasBoxScore =
    boxScore !== undefined &&
    (boxScore.teamStats.length > 0 || boxScore.homeLeaders.length > 0 || boxScore.awayLeaders.length > 0)

  if (isLoading) return <p className="game-stats__hint">Loading stats…</p>
  // An empty feed and a held-back one look identical from here, and the
  // diagnostics notice would blame ESPN for a delay the viewer set.
  if (isDelayed) return <p className="game-stats__hint">Held until your broadcast delay catches up…</p>
  if (!hasPlays && !hasBoxScore) {
    return (
      <SummaryNotice gameId={game.id} isError={isError} state={game.state} onRetry={refetch} diagnostics={diagnostics} />
    )
  }

  return (
    <>
      {hasPlays && <PlayByPlay game={game} plays={plays} />}
      {hasBoxScore && <BoxScoreBody boxScore={boxScore!} home={game.home} away={game.away} />}
    </>
  )
}
