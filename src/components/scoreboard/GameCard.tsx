import './GameCard.css'
import type { Game, Team } from '../../types/game'
import { TeamLogo } from '../shared/TeamLogo'
import { RankBadge } from '../shared/RankBadge'
import { NetworkBadgeList } from '../shared/NetworkBadge'
import { ProtectedTag } from '../shared/SpoilerGate'
import { ExpandedGame } from './ExpandedGame'
import { useSettings } from '../../context/SettingsContext'
import { kickoffOrStatus } from '../../lib/gameDisplay'

function TeamCompactRow({ team, score, showScore }: { team: Team; score?: number; showScore: boolean }) {
  const { isFavoriteTeam } = useSettings()
  const favorite = isFavoriteTeam(team.id)
  return (
    <div className={`game-card__team-row${favorite ? ' game-card__team-row--favorite' : ''}`}>
      <TeamLogo team={team} size={26} />
      <span className="game-card__team-name">
        {team.rank && <RankBadge rank={team.rank} />} {team.abbreviation}
      </span>
      {showScore && <span className="game-card__score ticker">{score ?? 0}</span>}
    </div>
  )
}

interface GameCardProps {
  game: Game // sanitized
  rawGame: Game
  isProtected: boolean
  isExpanded: boolean
  onToggle: () => void
  zoneId: string
}

export function GameCard({ game, rawGame, isProtected, isExpanded, onToggle, zoneId }: GameCardProps) {
  // Not just `state !== 'pre'` — a protected live game reports state 'in' (to
  // show the bare LIVE badge) but with scores stripped, and must not fall
  // back to rendering "0".
  const showScore = game.homeScore !== undefined && game.awayScore !== undefined

  return (
    <div id={`game-card-${game.id}`} className={`game-card${isExpanded ? ' game-card--expanded' : ''}${game.state === 'in' ? ' game-card--live' : ''}`}>
      <button type="button" className="game-card__trigger" onClick={onToggle} aria-expanded={isExpanded}>
        <div className="game-card__header">
          <NetworkBadgeList networks={game.broadcasts} />
          {isProtected && <ProtectedTag />}
        </div>
        <TeamCompactRow team={game.away} score={game.awayScore} showScore={showScore} />
        <TeamCompactRow team={game.home} score={game.homeScore} showScore={showScore} />
        <div className={`game-card__status ticker${game.state === 'in' ? ' game-card__status--live' : ''}`}>
          {game.state === 'in' && <span className="live-dot" aria-hidden="true" />}
          {kickoffOrStatus(game, zoneId)}
        </div>
      </button>

      {isExpanded && <ExpandedGame game={rawGame} zoneId={zoneId} isProtected={isProtected} />}
    </div>
  )
}
