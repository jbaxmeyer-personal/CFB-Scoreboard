import './GameCard.css'
import type { Game, Team } from '../../types/game'
import { TeamLogo } from '../shared/TeamLogo'
import { NetworkBadgeList } from '../shared/NetworkBadge'
import { ProtectedToggle } from '../shared/SpoilerGate'
import { useSettings } from '../../context/SettingsContext'
import { kickoffOrStatus } from '../../lib/gameDisplay'

function TeamCompactRow({ team, score, showScore, isWinner }: { team: Team; score?: number; showScore: boolean; isWinner: boolean }) {
  const { isFavoriteTeam } = useSettings()
  const favorite = isFavoriteTeam(team.id)
  return (
    <div className={`game-card__team-row${favorite ? ' game-card__team-row--favorite' : ''}`}>
      <TeamLogo team={team} size={26} rank={team.rank} />
      <span className={`game-card__team-name${isWinner ? ' game-card__team-name--winner' : ''}`}>{team.abbreviation}</span>
      {showScore && <span className={`game-card__score ticker${isWinner ? ' game-card__score--winner' : ''}`}>{score ?? 0}</span>}
    </div>
  )
}

interface GameCardProps {
  game: Game // sanitized
  isProtected: boolean
  /** Whether this card's detail is the one currently shown in the
   * GameDetailPanel below the grid — just a highlight, the card itself
   * never grows (that would warp the grid's shared row/column tracks). */
  isSelected: boolean
  onToggle: () => void
  zoneId: string
}

export function GameCard({ game, isProtected, isSelected, onToggle, zoneId }: GameCardProps) {
  const { toggleProtectedGame } = useSettings()
  // ESPN reports score "0" for competitors even before kickoff, so a pre-game
  // check is required on top of definedness — and definedness is still
  // required because a protected *live* game reports state 'in' (to show the
  // bare LIVE badge) with scores stripped, and must not fall back to "0".
  const showScore = game.state !== 'pre' && game.homeScore !== undefined && game.awayScore !== undefined
  // Only a final score is a real result — a live score can still flip, so
  // only 'post' games ever get a winner highlight.
  const isFinal = game.state === 'post' && showScore
  const homeWins = isFinal && game.homeScore! > game.awayScore!
  const awayWins = isFinal && game.awayScore! > game.homeScore!

  return (
    <div id={`game-card-${game.id}`} className={`game-card${isSelected ? ' game-card--selected' : ''}${game.state === 'in' ? ' game-card--live' : ''}`}>
      <div
        role="button"
        tabIndex={0}
        className="game-card__trigger"
        onClick={onToggle}
        aria-expanded={isSelected}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle()
          }
        }}
      >
        <div className="game-card__header">
          <NetworkBadgeList networks={game.broadcasts} />
          <ProtectedToggle isProtected={isProtected} onToggle={() => toggleProtectedGame(game.id)} />
        </div>
        <TeamCompactRow team={game.away} score={game.awayScore} showScore={showScore} isWinner={awayWins} />
        <TeamCompactRow team={game.home} score={game.homeScore} showScore={showScore} isWinner={homeWins} />
        <div className={`game-card__status ticker${game.state === 'in' ? ' game-card__status--live' : ''}`}>
          {game.state === 'in' && <span className="live-dot" aria-hidden="true" />}
          {kickoffOrStatus(game, zoneId)}
        </div>
      </div>
    </div>
  )
}
