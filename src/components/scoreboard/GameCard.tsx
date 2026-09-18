import type { CSSProperties } from 'react'
import './GameCard.css'
import type { Game, Team } from '../../types/game'
import { TeamLogo } from '../shared/TeamLogo'
import { NetworkBadgeList } from '../shared/NetworkBadge'
import { ProtectedToggle } from '../shared/SpoilerGate'
import { ConferenceBadge } from '../shared/ConferenceBadge'
import { useSettings } from '../../context/SettingsContext'
import { favoriteHighlightColor } from '../../lib/teamHighlight'
import { useTeamColors } from '../../hooks/useTeamColors'
import { kickoffOrStatus } from '../../lib/gameDisplay'
import { GAME_ANCHOR_ATTR } from '../../hooks/useScrollToCollapsedGame'

/**
 * One team's line, emitted as cells of the shared grid on .game-card__teams
 * rather than as a row of its own.
 *
 * It has to be cells because the conference shield sits in a column between
 * the names and the records and spans both lines — one mark for the game,
 * not one per team. Two independent flex rows have no column either of them
 * could share, so the shield would have to be floated over them, and
 * floated over them it landed on top of the abbreviations.
 *
 * The favourite wash is its own cell spanning the full width behind the
 * line, because a grid row cannot carry a background itself.
 */
function TeamCompactRow({
  team,
  score,
  showScore,
  showRecord,
  isWinner,
  row,
}: {
  team: Team
  score?: number
  showScore: boolean
  showRecord: boolean
  isWinner: boolean
  /** Which of the two grid lines this team occupies. */
  row: 1 | 2
}) {
  const { isFavoriteTeam } = useSettings()
  const favorite = isFavoriteTeam(team.id)
  return (
    <>
      {favorite && <div className="game-card__team-wash" style={{ gridRow: row }} />}
      <div className="game-card__team-logo" style={{ gridRow: row }}>
        <TeamLogo team={team} size={26} rank={team.rank} />
      </div>
      <span className={`game-card__team-name${isWinner ? ' game-card__team-name--winner' : ''}`} style={{ gridRow: row }}>
        {team.abbreviation}
      </span>
      {/* Only pre-game: a live/final record can itself reflect this game's
          outcome, which would leak a protected result. */}
      {showRecord && team.record && (
        <span className="game-card__team-record" style={{ gridRow: row }}>
          {team.record}
        </span>
      )}
      {showScore && (
        <span className={`game-card__score ticker${isWinner ? ' game-card__score--winner' : ''}`} style={{ gridRow: row }}>
          {score ?? 0}
        </span>
      )}
    </>
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
  const { toggleProtectedGame, isFavoriteTeam } = useSettings()
  const isFavoriteGame = isFavoriteTeam(game.home.id) || isFavoriteTeam(game.away.id)
  const teamColors = useTeamColors()
  const highlight = favoriteHighlightColor(game.home, game.away, isFavoriteTeam, teamColors)
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
    <div
      {...{ [GAME_ANCHOR_ATTR]: game.id }}
      className={`game-card${isFavoriteGame ? ' game-card--favorite' : ''}${isSelected ? ' game-card--selected' : ''}${game.state === 'in' ? ' game-card--live' : ''}`}
      style={highlight ? ({ '--favorite-highlight': highlight } as CSSProperties) : undefined}
    >
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
        {/* The shield in its own column between the names and the records,
            spanning both lines — one mark for the game. */}
        <div className="game-card__teams">
          <TeamCompactRow team={game.away} score={game.awayScore} showScore={showScore} showRecord={game.state === 'pre'} isWinner={awayWins} row={1} />
          <TeamCompactRow team={game.home} score={game.homeScore} showScore={showScore} showRecord={game.state === 'pre'} isWinner={homeWins} row={2} />
          <ConferenceBadge game={game} size={22} maxWidth={33} />
        </div>
        <div className={`game-card__status ticker${game.state === 'in' ? ' game-card__status--live' : ''}`}>
          {game.state === 'in' && <span className="live-dot" aria-hidden="true" />}
          {kickoffOrStatus(game, zoneId)}
        </div>
      </div>
    </div>
  )
}
