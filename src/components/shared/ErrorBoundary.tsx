import { Component, type ErrorInfo, type ReactNode } from 'react'
import './ErrorBoundary.css'

/** Every key the view state persists. Listed here rather than imported so
 * the boundary has no dependency on the context it may have to rescue —
 * whatever crashed, clearing these has to keep working. */
const VIEW_STATE_KEYS = [
  'slate.tab.v1',
  'slate.selectedDate.v1',
  'slate.expandedGame.v1',
  'slate.scoreboardAnchor.v1',
  'slate.teamPage.v1',
]

interface State {
  error: Error | null
}

/**
 * Catches a render error instead of letting React unmount the whole tree.
 *
 * Without this a single component throwing leaves a blank screen with
 * nothing to tap, and because the view state is persisted — tab, day,
 * expanded game, open team — reloading restores the exact state that
 * crashed and blanks it again. That combination is a trap with no way out
 * short of clearing site data.
 *
 * So the fallback offers both exits: reload (for a transient failure) and
 * a reset that clears the persisted view state first, guaranteeing the app
 * comes back on a clean screen even when the stored state is what breaks
 * it. The error text is shown rather than hidden, since the alternative is
 * a bug report that can only say "it went blank".
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Slate crashed:', error, info.componentStack)
  }

  private reset = () => {
    for (const key of VIEW_STATE_KEYS) {
      try {
        localStorage.removeItem(key)
      } catch {
        // Best-effort, same as everywhere else this app touches storage.
      }
    }
    window.location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="error-boundary">
        <h1 className="error-boundary__title">Something went wrong</h1>
        <p className="error-boundary__message">{error.message || 'The screen failed to render.'}</p>
        <div className="error-boundary__actions">
          <button type="button" className="error-boundary__button" onClick={() => window.location.reload()}>
            Reload
          </button>
          <button type="button" className="error-boundary__button error-boundary__button--primary" onClick={this.reset}>
            Reset view
          </button>
        </div>
        <p className="error-boundary__hint">Reset returns to the Slate tab and closes any open game or team.</p>
      </div>
    )
  }
}
