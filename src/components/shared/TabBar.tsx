import './TabBar.css'
import { useViewState, type Tab } from '../../context/ViewStateContext'

const TABS: { id: Tab; label: string }[] = [
  { id: 'schedule', label: 'Slate' },
  { id: 'scoreboard', label: 'Scoreboard' },
  { id: 'settings', label: 'Settings' },
]

export function TabBar() {
  const { tab, setTab } = useViewState()
  return (
    <nav className="tab-bar" aria-label="Primary">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`tab-bar__item${tab === t.id ? ' tab-bar__item--active' : ''}`}
          onClick={() => setTab(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  )
}
