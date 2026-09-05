import type { ReactNode } from 'react'
import './AppHeader.css'

interface AppHeaderProps {
  /** The screen's own name, shown beside the wordmark. Omitted on the Slate
   * tab, where the section and the app share a name and printing it twice
   * would just read as a mistake. */
  section?: string
  /** Anything the screen wants under the header row, e.g. the timezone note. */
  children?: ReactNode
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
export function AppHeader({ section, children }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__row">
        <span className="app-header__brand">Slate</span>
        {section && <span className="app-header__section">{section}</span>}
      </div>
      {children}
    </header>
  )
}
