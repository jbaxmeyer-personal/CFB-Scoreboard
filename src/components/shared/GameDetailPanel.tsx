import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import './GameDetailPanel.css'
import { useSpoilerSafeGames, type SafeGameEntry } from '../../hooks/useSpoilerSafeGames'
import { useViewState } from '../../context/ViewStateContext'
import { ExpandedGame } from '../scoreboard/ExpandedGame'
import { TeamPage } from '../team/TeamPage'
import { NetworkBadgeList } from './NetworkBadge'

/** The element in the app shell this panel renders into. Exported so the
 * shell and the panel cannot disagree about it. */
export const DETAIL_LAYER_ID = 'game-detail-layer'

interface GameDetailPanelProps {
  entries: SafeGameEntry[]
  expandedGameId: string | null
  onClose: () => void
  zoneId: string
}

/**
 * The expanded game, shown as a screen of its own over the list it was
 * opened from.
 *
 * It renders where it can see the live `entries` — inside the screen that
 * owns them, so the score and play-by-play keep updating — but it *paints*
 * into the shell's detail layer, above the list rather than inside it.
 *
 * That one move deletes most of what this component used to do. It had to
 * scroll itself to the top of the page on open, and because it opened before
 * its box score and play-by-play had loaded there was nothing to scroll yet,
 * so it retried every 200ms for three seconds waiting for the content to
 * arrive and make the page tall enough. Then a separate hook scrolled the
 * list back to the card on close, because by then you were far below it.
 * None of that is needed by a layer that covers the list: it starts at its
 * own top, and the list underneath never moves at all.
 */
export function GameDetailPanel({ entries, expandedGameId, onClose, zoneId }: GameDetailPanelProps) {
  const entry = entries.find((e) => e.game.id === expandedGameId)
  const { detailStack, pushDetail, popDetail } = useViewState()
  const top = detailStack.at(-1)

  // A game reached from a team's schedule is raw feed data like any other,
  // so it goes through the same choke point before anything renders it — a
  // protected team's past results must not become visible just because you
  // arrived at them sideways.
  const stackedGames = useMemo(() => (top?.kind === 'game' ? [top.game] : []), [top])
  const stackedEntry = useSpoilerSafeGames(stackedGames)[0]

  if (!entry) return null

  // What the panel is showing: the game it was opened on, or whatever has
  // been stacked on top of it since.
  const shown = top?.kind === 'game' && stackedEntry ? stackedEntry : entry
  const body =
    top?.kind === 'team' ? (
      <TeamPage
        team={top.team}
        year={top.year}
        onBack={popDetail}
        onSelectGame={(game) => pushDetail({ kind: 'game', game })}
      />
    ) : (
      <ExpandedGame
        game={shown.rawGame}
        zoneId={zoneId}
        isProtected={shown.isProtected}
        isDelayed={shown.isDelayed}
      />
    )

  const layer = typeof document === 'undefined' ? null : document.getElementById(DETAIL_LAYER_ID)
  if (!layer) return null

  return createPortal(
    <div className="game-detail-panel">
      {/* Where you're watching it, opposite the way out. Read from the
          sanitized view rather than the raw game — the network is not a
          spoiler, but nothing outside the gate should reach for rawGame.

          Back appears only for a game stacked on top of another screen; a
          team page draws its own, and the root game has nothing to go back
          to. Close always unwinds the lot. */}
      <div className="game-detail-panel__header">
        {top?.kind === 'game' && (
          <button type="button" className="game-detail-panel__back" onClick={popDetail}>
            ‹ Back
          </button>
        )}
        <NetworkBadgeList networks={shown.game.broadcasts} />
        <button type="button" className="game-detail-panel__close" onClick={onClose}>
          Close ×
        </button>
      </div>
      {body}
    </div>,
    layer,
  )
}
