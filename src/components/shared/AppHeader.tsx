import type { ReactNode } from 'react'
import './AppHeader.css'
import { useSettings } from '../../context/SettingsContext'
import { delayBadge } from '../../lib/broadcastDelay'

interface AppHeaderProps {
  /** The screen's own name, shown beside the wordmark. Omitted on the Slate
   * tab, where the section and the app share a name and printing it twice
   * would just read as a mistake. */
  section?: string
  /** Anything the screen wants under the header row, e.g. the timezone note. */
  children?: ReactNode
  /** Shows the active broadcast delay beside the section name. Set on the
   * screens that render live scores; without it, a held-back score reads as
   * the app being broken rather than as the setting doing its job. */
  showDelayBadge?: boolean
}

/**
 * The app's wordmark, on every screen.
 *
 * Each screen used to print its own title, so "Slate" appeared only on the
 * Slate tab and read as a section name rather than the product's. The
 * wordmark now leads every screen and the section name sits beside it on
 * the same row — branding all three tabs without costing a second line of
 * vertical space, which this layout has none to spare.
 */
export function AppHeader({ section, children, showDelayBadge }: AppHeaderProps) {
  const { settings } = useSettings()
  const badge = showDelayBadge ? delayBadge(settings.broadcastDelaySeconds) : ''

  return (
    <header className="app-header">
      <div className="app-header__row">
        <span className="app-header__brand">Slate</span>
        {badge && (
          <span className="app-header__delay" title={`Live scores are held back ${settings.broadcastDelaySeconds} seconds`}>
            {badge}
          </span>
        )}
        {section && <span className="app-header__section">{section}</span>}
      </div>
      {children}
    </header>
  )
}
