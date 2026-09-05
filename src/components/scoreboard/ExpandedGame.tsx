import './ExpandedGame.css'
import type { Game, Team } from '../../types/game'
import { TeamLogo } from '../shared/TeamLogo'
import { SpoilerGate } from '../shared/SpoilerGate'
import { SeasonLeaders, SeasonTeamComparison, GameSummarySections, FieldPositionBar } from './GameStats'
import { formatDayLabel, formatKickoff } from '../../lib/timezone'
import { seasonYearFromDate } from '../../lib/espn'
import { useGameSummary } from '../../hooks/useGameSummary'
import { useViewState } from '../../context/ViewStateContext'
import { TeamPage } from '../team/TeamPage'

/** Logo above name (not side by side) so a long team name gets the
 * identity column's full width instead of being squeezed to the right of
 * the logo, where it was clipping (e.g. "North Caroli…"). */
function TeamIdentity({
  team,
  showRecord,
  role,
  onOpenTeam,
}: {
  team: Team
  showRecord: boolean
  role: 'home' | 'away'
  onOpenTeam?: () => void
}) {
  // The role-specific split (this team's home record if they're playing at
  // home here, their road record if they're the visitor) — not both splits
  // for both teams, matching how this is normally shown alongside a matchup.
  const splitRecord = role === 'home' ? team.homeRecord : team.awayRecord
  return (
    <button
      type="button"
      className="expanded-game__identity expanded-game__identity--tappable"
      onClick={onOpenTeam}
      disabled={!onOpenTeam}
      aria-label={onOpenTeam ? `${team.name} team page` : undefined}
    >
      <TeamLogo team={team} size={40} rank={team.rank} />
      <div className="expanded-game__name">
        <span>{team.shortName}</span>
        {/* Only shown pre-game: a live/final record can itself reflect this
            game's outcome, which would leak a protected result. */}
        {showRecord && team.record && <span className="expanded-game__record">{team.record}</span>}
        {showRecord && splitRecord && (
          <span className="expanded-game__record expanded-game__record--split">
            {role === 'home' ? 'Home' : 'Away'}: {splitRecord}
          </span>
        )}
      </div>
    </button>
  )
}

/**
 * Everything derived from live score/game-state. Only ever rendered with
 * the *real* game — callers must gate this behind SpoilerGate whenever the
 * game is protected and there's something (a live score or a final) to hide.
 */
function LiveArea({ game, zoneId, isDelayed }: { game: Game; zoneId: string; isDelayed: boolean }) {
  // Called unconditionally — game.state can transition pre -> in on this
  // same mounted instance as scoreboard data refreshes, so this can't sit
  // after the pre-game early return below (Rules of Hooks). Only actually
  // fetches once live/final, and shares its query key with
  // GameSummarySections further down, so this never costs an extra request.
  const { plays, currentDrive } = useGameSummary(game, game.state === 'in', game.state !== 'pre')

  if (game.state === 'pre') {
    return <span className="ticker expanded-game__clock">{formatKickoff(game.startDate, zoneId)}</span>
  }

  // The score fields are stripped while the delay holds this game, and the
  // fallbacks below would render that as 0-0 — a scoreline of its own, and a
  // wrong one. Say what is actually happening instead.
  if (isDelayed) {
    return (
      <div className="expanded-game__score-block">
        <span className="ticker expanded-game__clock expanded-game__clock--live">
          <span className="live-dot" aria-hidden="true" />
          LIVE
        </span>
        <span className="expanded-game__delay-note">Waiting on your broadcast delay…</span>
      </div>
    )
  }

  // The scoreboard endpoint (game.homeScore/awayScore, polled every 30s
  // across the whole week's games) and the per-game summary endpoint
  // (plays, polled every 20s for just this game while live) can briefly
  // disagree right after a score — prefer the newest play's score once
  // there is one, since that endpoint is both more granular and faster.
  const latestPlay = plays[0]
  const awayScore = latestPlay?.awayScore ?? game.awayScore ?? 0
  const homeScore = latestPlay?.homeScore ?? game.homeScore ?? 0

  // Only a final score is a real result — a live score can still flip, so
  // only 'post' games ever get a winner highlight.
  const isFinal = game.state === 'post'
  const awayWins = isFinal && awayScore > homeScore
  const homeWins = isFinal && homeScore > awayScore

  return (
    <div className="expanded-game__score-block">
      <div className="expanded-game__digits">
        <span
          className={`expanded-game__led${game.possession === 'away' ? ' expanded-game__led--possession' : ''}${awayWins ? ' expanded-game__led--winner' : ''}`}
        >
          {awayScore}
        </span>
        <span className="expanded-game__led-sep">–</span>
        <span
          className={`expanded-game__led${game.possession === 'home' ? ' expanded-game__led--possession' : ''}${homeWins ? ' expanded-game__led--winner' : ''}`}
        >
          {homeScore}
        </span>
      </div>
      {game.state === 'in' && (
        <span className="ticker expanded-game__clock expanded-game__clock--live">
          <span className="live-dot" aria-hidden="true" />
          {game.period ? `Q${game.period}` : ''} {game.clock ?? ''}
        </span>
      )}
      {game.state === 'post' && <span className="ticker expanded-game__clock expanded-game__clock--final">FINAL</span>}
      {game.state === 'in' && <FieldPositionBar game={game} drive={currentDrive} />}
      <GameSummarySections game={game} />
    </div>
  )
}

interface ExpandedGameProps {
  /** The true, unsanitized game — only safe here because the score/state
   * portion below is gated by SpoilerGate whenever `isProtected` is set. */
  game: Game
  zoneId: string
  isProtected: boolean
  /** The broadcast delay is holding this game's live state back. */
  isDelayed?: boolean
}

export function ExpandedGame({ game, zoneId, isProtected, isDelayed = false }: ExpandedGameProps) {
  const hasHideableResult = isProtected && game.state !== 'pre'
  const { teamPageId, setTeamPageId } = useViewState()

  // The team page replaces the game detail in place rather than pushing a
  // new screen, so you stay in the day you were browsing and one Back
  // returns you to the same expanded game.
  const openTeam = teamPageId === game.home.id ? game.home : teamPageId === game.away.id ? game.away : null
  if (openTeam) {
    return (
      <div className="expanded-game">
        <div className="expanded-game__panel">
          <TeamPage team={openTeam} year={seasonYearFromDate(game.startDate)} onBack={() => setTeamPageId(null)} />
        </div>
      </div>
    )
  }

  return (
    <div className="expanded-game">
      <div className="expanded-game__panel">
        <div className="expanded-game__bezel">
          <div className="expanded-game__matchup">
            <TeamIdentity team={game.away} showRecord={game.state === 'pre'} role="away" onOpenTeam={() => setTeamPageId(game.away.id)} />
            <span className="expanded-game__at">@</span>
            <TeamIdentity team={game.home} showRecord={game.state === 'pre'} role="home" onOpenTeam={() => setTeamPageId(game.home.id)} />
          </div>

          <div className={`expanded-game__live-area${hasHideableResult ? ' expanded-game__live-area--gated' : ''}`}>
            {hasHideableResult ? (
              <SpoilerGate>
                <LiveArea game={game} zoneId={zoneId} isDelayed={isDelayed} />
              </SpoilerGate>
            ) : (
              <LiveArea game={game} zoneId={zoneId} isDelayed={isDelayed} />
            )}
          </div>
        </div>

        {game.state === 'pre' && <SeasonTeamComparison home={game.home} away={game.away} year={seasonYearFromDate(game.startDate)} />}
        {game.state === 'pre' && <SeasonLeaders home={game.home} away={game.away} />}

        <div className="expanded-game__footer">
          <span className="expanded-game__venue">{game.venue ?? formatDayLabel(game.startDate, zoneId)}</span>
        </div>
      </div>
    </div>
  )
}
