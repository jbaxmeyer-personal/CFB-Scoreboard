import './ExpandedGame.css'
import type { Game, Team } from '../../types/game'
import { TeamLogo } from '../shared/TeamLogo'
import { NetworkBadgeList } from '../shared/NetworkBadge'
import { SpoilerGate } from '../shared/SpoilerGate'
import { SeasonLeaders, GameBoxScoreContainer } from './GameStats'
import { formatDayLabel, formatKickoff } from '../../lib/timezone'

/** Logo above name (not side by side) so a long team name gets the
 * identity column's full width instead of being squeezed to the right of
 * the logo, where it was clipping (e.g. "North Caroli…"). */
function TeamIdentity({ team, showRecord }: { team: Team; showRecord: boolean }) {
  return (
    <div className="expanded-game__identity">
      <TeamLogo team={team} size={40} rank={team.rank} />
      <div className="expanded-game__name">
        <span>{team.shortName}</span>
        {/* Only shown pre-game: a live/final record can itself reflect this
            game's outcome, which would leak a protected result. */}
        {showRecord && team.record && <span className="expanded-game__record">{team.record}</span>}
      </div>
    </div>
  )
}

/**
 * Everything derived from live score/game-state. Only ever rendered with
 * the *real* game — callers must gate this behind SpoilerGate whenever the
 * game is protected and there's something (a live score or a final) to hide.
 */
function LiveArea({ game, zoneId }: { game: Game; zoneId: string }) {
  if (game.state === 'pre') {
    return <span className="ticker expanded-game__clock">{formatKickoff(game.startDate, zoneId)}</span>
  }
  return (
    <div className="expanded-game__score-block">
      <div className="expanded-game__digits">
        <span className={`expanded-game__led${game.possession === 'away' ? ' expanded-game__led--possession' : ''}`}>
          {game.awayScore ?? 0}
        </span>
        <span className="expanded-game__led-sep">–</span>
        <span className={`expanded-game__led${game.possession === 'home' ? ' expanded-game__led--possession' : ''}`}>
          {game.homeScore ?? 0}
        </span>
      </div>
      {game.state === 'in' && (
        <span className="ticker expanded-game__clock expanded-game__clock--live">
          <span className="live-dot" aria-hidden="true" />
          {game.period ? `Q${game.period}` : ''} {game.clock ?? ''}
        </span>
      )}
      {game.state === 'post' && <span className="ticker expanded-game__clock expanded-game__clock--final">FINAL</span>}
      <GameBoxScoreContainer game={game} />
    </div>
  )
}

interface ExpandedGameProps {
  /** The true, unsanitized game — only safe here because the score/state
   * portion below is gated by SpoilerGate whenever `isProtected` is set. */
  game: Game
  zoneId: string
  isProtected: boolean
}

export function ExpandedGame({ game, zoneId, isProtected }: ExpandedGameProps) {
  const hasHideableResult = isProtected && game.state !== 'pre'

  return (
    <div className="expanded-game">
      <div className="expanded-game__panel">
        <div className="expanded-game__bezel">
          <div className="expanded-game__matchup">
            <TeamIdentity team={game.away} showRecord={game.state === 'pre'} />
            <span className="expanded-game__at">@</span>
            <TeamIdentity team={game.home} showRecord={game.state === 'pre'} />
          </div>

          <div className={`expanded-game__live-area${hasHideableResult ? ' expanded-game__live-area--gated' : ''}`}>
            {hasHideableResult ? (
              <SpoilerGate>
                <LiveArea game={game} zoneId={zoneId} />
              </SpoilerGate>
            ) : (
              <LiveArea game={game} zoneId={zoneId} />
            )}
          </div>
        </div>

        {game.state === 'pre' && <SeasonLeaders home={game.home} away={game.away} />}

        <div className="expanded-game__footer">
          <span className="expanded-game__venue">{game.venue ?? formatDayLabel(game.startDate, zoneId)}</span>
          <NetworkBadgeList networks={game.broadcasts} />
        </div>
      </div>
    </div>
  )
}
