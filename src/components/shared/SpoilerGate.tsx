import { useState } from 'react'
import './SpoilerGate.css'
import { LockIcon } from './icons'

type Stage = 'hidden' | 'confirm' | 'revealed'

/**
 * Covers protected content (the LED score panel) until the user explicitly
 * taps through a confirmation. Reveal state is local to this component
 * instance and intentionally not persisted — collapsing and re-expanding
 * the game hides it again.
 */
export function SpoilerGate({ children }: { children: React.ReactNode }) {
  const [stage, setStage] = useState<Stage>('hidden')

  if (stage === 'revealed') return <>{children}</>

  return (
    <div className="spoiler-gate">
      {stage === 'hidden' && (
        <button type="button" className="spoiler-gate__trigger" onClick={() => setStage('confirm')}>
          <LockIcon size={22} />
          <span>Spoiler Protected</span>
          <span className="spoiler-gate__hint">Tap to reveal</span>
        </button>
      )}
      {stage === 'confirm' && (
        <div className="spoiler-gate__confirm">
          <p>Show the score and result for this game?</p>
          <div className="spoiler-gate__confirm-actions">
            <button type="button" className="spoiler-gate__cancel" onClick={() => setStage('hidden')}>
              Cancel
            </button>
            <button type="button" className="spoiler-gate__reveal" onClick={() => setStage('revealed')}>
              Reveal score
            </button>
          </div>
        </div>
      )}
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
