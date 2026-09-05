import './StatusStates.css'

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="status-state">
      <div className="status-state__spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  )
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="status-state">
      <p className="status-state__title">Couldn't load the slate</p>
      <p className="status-state__body">
        ESPN's scoreboard is unofficial and occasionally unreachable or rate-limited. Give it a moment and try again.
      </p>
      <button type="button" className="status-state__retry" onClick={onRetry}>
        Retry
      </button>
    </div>
  )
}

/** `message` distinguishes "nothing is scheduled" from "your filters hid
 * everything" — the same blank screen otherwise, but only one of them is
 * something the viewer can undo. */
export function EmptyState({ message }: { message?: string } = {}) {
  return (
    <div className="status-state">
      <p className="status-state__title">{message ? 'No games match your filters' : 'No games on the slate'}</p>
      <p className="status-state__body">
        {message ?? 'Nothing scheduled for this window — check back closer to kickoff.'}
      </p>
    </div>
  )
}
