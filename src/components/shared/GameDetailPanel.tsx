import { useEffect, useRef } from 'react'
import './GameDetailPanel.css'
import type { SafeGameEntry } from '../../hooks/useSpoilerSafeGames'
import { ExpandedGame } from '../scoreboard/ExpandedGame'

interface GameDetailPanelProps {
  entries: SafeGameEntry[]
  expandedGameId: string | null
  onClose: () => void
  zoneId: string
}

/**
 * Renders the expanded game detail as its own section below a card/chip
 * grid — never by growing the individual card/chip itself. A CSS grid's row
 * and column tracks are shared across every item in it, so resizing one
 * item in place (rather than appending a separate section like this) warps
 * the layout of unrelated siblings.
 */
export function GameDetailPanel({ entries, expandedGameId, onClose, zoneId }: GameDetailPanelProps) {
  const entry = entries.find((e) => e.game.id === expandedGameId)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (entry) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [entry])

  if (!entry) return null

  return (
    <div className="game-detail-panel" ref={ref}>
      <button type="button" className="game-detail-panel__close" onClick={onClose}>
        Close ×
      </button>
      <ExpandedGame game={entry.rawGame} zoneId={zoneId} isProtected={entry.isProtected} />
    </div>
  )
}
