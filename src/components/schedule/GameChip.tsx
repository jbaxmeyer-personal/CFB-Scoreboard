import './GameChip.css'
import type { Game } from '../../types/game'
import { TeamLogo } from '../shared/TeamLogo'
import { ProtectedTag } from '../shared/SpoilerGate'
import { useSettings } from '../../context/SettingsContext'
import { kickoffOrStatus } from '../../lib/gameDisplay'

interface GameChipProps {
  game: Game
  isProtected: boolean
  zoneId: string
  left: number
  top: number
  width: number
  onSelect: () => void
}

export function GameChip({ game, isProtected, zoneId, left, top, width, onSelect }: GameChipProps) {
  const { isFavoriteTeam } = useSettings()
  const isFavoriteGame = isFavoriteTeam(game.home.id) || isFavoriteTeam(game.away.id)
  const glowColor = isFavoriteTeam(game.home.id) ? game.home.color : game.away.color

  const classes = [
    'game-chip',
    game.state === 'in' && 'game-chip--live',
    isFavoriteGame && 'game-chip--favorite',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      role="button"
      tabIndex={0}
      className={classes}
      style={{ left, top, width, ...(isFavoriteGame && glowColor ? ({ '--favorite-glow': glowColor } as React.CSSProperties) : {}) }}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      <div className="game-chip__matchup">
        <div className="game-chip__team">
          <TeamLogo team={game.away} size={20} rank={game.away.rank} />
          <span className="game-chip__abbr">{game.away.abbreviation}</span>
        </div>
        <span className="game-chip__at">@</span>
        <div className="game-chip__team">
          <TeamLogo team={game.home} size={20} rank={game.home.rank} />
          <span className="game-chip__abbr">{game.home.abbreviation}</span>
        </div>
      </div>
      <div className="game-chip__meta">
        {isProtected && <ProtectedTag />}
        <span className={`game-chip__status ticker${game.state === 'in' ? ' game-chip__status--live' : ''}`}>
          {game.state === 'in' && <span className="live-dot" aria-hidden="true" />}
          {kickoffOrStatus(game, zoneId)}
        </span>
      </div>
    </div>
  )
}
