import { useState } from 'react'
import './SpoilerGate.css'
import { LockIcon } from './icons'

/**
 * Covers protected content (the LED score panel) until the user taps to
 * reveal it. Reveal state is local to this component instance and
 * intentionally not persisted — collapsing and re-expanding the game hides
 * it again.
 */
export function SpoilerGate({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false)

  if (revealed) return <>{children}</>

  return (
    <div className="spoiler-gate">
      <button type="button" className="spoiler-gate__trigger" onClick={() => setRevealed(true)}>
        <LockIcon size={22} />
        <span>Spoiler Protected</span>
        <span className="spoiler-gate__hint">Tap to reveal</span>
      </button>
    </div>
  )
}

export function ProtectedTag() {
  return (
    <span className="protected-tag" title="Spoiler protected">
      <LockIcon size={11} />
    </span>
  )
}

interface ProtectedToggleProps {
  isProtected: boolean
  onToggle: () => void
  size?: number
}

/** Inline per-game spoiler-protect button — lives on the chip/card itself
 * rather than buried in Settings, so protecting one game is a single tap. */
export function ProtectedToggle({ isProtected, onToggle, size = 14 }: ProtectedToggleProps) {
  return (
    <button
      type="button"
      className={`protected-toggle${isProtected ? ' protected-toggle--active' : ''}`}
      title={isProtected ? 'Spoiler protected — tap to remove' : 'Tap to hide this game’s score'}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      <LockIcon size={size} open={!isProtected} />
    </button>
  )
}
