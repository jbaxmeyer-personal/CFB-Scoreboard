import './GameRow.css'
import type { Game, Team } from '../../types/game'
import { TeamLogo } from '../shared/TeamLogo'
import { RankBadge } from '../shared/RankBadge'
import { NetworkBadgeList } from '../shared/NetworkBadge'
import { ProtectedTag } from '../shared/SpoilerGate'
import { StarIcon } from '../shared/icons'
import { useSettings } from '../../context/SettingsContext'
import { kickoffOrStatus } from '../../lib/gameDisplay'

interface GameRowProps {
  game: Game
  isProtected: boolean
  zoneId: string
  onSelect: () => void
}

function TeamCell({ team, align }: { team: Team; align: 'left' | 'right' }) {
  const { isFavoriteTeam, toggleFavoriteTeam } = useSettings()
  const favorite = isFavoriteTeam(team.id)
  return (
    <div className={`game-row__team game-row__team--${align}`}>
      {align === 'right' && <TeamLogo team={team} size={32} />}
      <div className="game-row__team-label">
        {team.rank && <RankBadge rank={team.rank} />}
        <span className="game-row__team-name">{team.shortName}</span>
      </div>
      {align === 'left' && <TeamLogo team={team} size={32} />}
      <button
        type="button"
        className={`game-row__star${favorite ? ' game-row__star--active' : ''}`}
        aria-label={favorite ? `Unfavorite ${team.name}` : `Favorite ${team.name}`}
        onClick={(e) => {
          e.stopPropagation()
          toggleFavoriteTeam(team.id)
        }}
      >
        <StarIcon size={15} filled={favorite} />
      </button>
    </div>
  )
}

export function GameRow({ game, isProtected, zoneId, onSelect }: GameRowProps) {
  const { isFavoriteTeam } = useSettings()
  const isFavoriteGame = isFavoriteTeam(game.home.id) || isFavoriteTeam(game.away.id)
  const glowColor = isFavoriteTeam(game.home.id) ? game.home.color : game.away.color

  const rowClasses = [
    'game-row',
    game.state === 'in' && 'game-row--live',
    isFavoriteGame && 'game-row--favorite',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      role="button"
      tabIndex={0}
      className={rowClasses}
      style={isFavoriteGame && glowColor ? ({ '--favorite-glow': glowColor } as React.CSSProperties) : undefined}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      <div className="game-row__matchup">
        <TeamCell team={game.away} align="right" />
        <span className="game-row__at">@</span>
        <TeamCell team={game.home} align="left" />
      </div>

      <div className="game-row__meta">
        {isProtected && <ProtectedTag />}
        <span className={`game-row__status ticker${game.state === 'in' ? ' game-row__status--live' : ''}`}>
          {game.state === 'in' && <span className="live-dot" aria-hidden="true" />}
          {kickoffOrStatus(game, zoneId)}
        </span>
        <NetworkBadgeList networks={game.broadcasts} />
      </div>
    </div>
  )
}
