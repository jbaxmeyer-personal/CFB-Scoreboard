import './GameStats.css'
import type { Game, GameBoxScore, GamePlay, StatLeader, Team } from '../../types/game'
import { useGameSummary } from '../../hooks/useGameSummary'

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

function BoxScoreBody({ boxScore, home, away }: { boxScore: GameBoxScore; home: Team; away: Team }) {
  const hasStats = boxScore.teamStats.length > 0
  const hasLeaders = boxScore.homeLeaders.length > 0 || boxScore.awayLeaders.length > 0
  if (!hasStats && !hasLeaders) return null

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
            <div className="game-stats__stat-row" key={line.label}>
              <span className="game-stats__stat-value">{line.awayValue}</span>
              <span className="game-stats__stat-label">{line.label}</span>
              <span className="game-stats__stat-value">{line.homeValue}</span>
            </div>
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

function PlayRow({ play }: { play: GamePlay }) {
  return (
    <div className={`game-stats__play-row${play.isScoringPlay ? ' game-stats__play-row--scoring' : ''}`}>
      <span className="game-stats__play-meta">
        Q{play.period}
        <br />
        {play.clock}
      </span>
      <span className="game-stats__play-text">{play.text}</span>
      <span className="game-stats__play-score ticker">
        {play.awayScore}–{play.homeScore}
      </span>
    </div>
  )
}

/**
 * Fetches and renders the live play-by-play feed for the game currently
 * expanded, newest play first — same gating and shared query as the box
 * score above (see GameBoxScoreContainer), so mounting both here costs no
 * extra network request.
 */
export function PlayByPlayContainer({ game }: { game: Game }) {
  const { plays, isLoading, isError } = useGameSummary(game.id, game.home.id, game.away.id, game.state === 'in')

  if (isLoading) return <p className="game-stats__hint">Loading plays…</p>
  if (isError || plays.length === 0) return null

  return (
    <div className="game-stats">
      <h3 className="game-stats__title">Play by Play</h3>
      <div className="game-stats__plays">
        {plays.map((play) => (
          <PlayRow key={play.id} play={play} />
        ))}
      </div>
    </div>
  )
}
