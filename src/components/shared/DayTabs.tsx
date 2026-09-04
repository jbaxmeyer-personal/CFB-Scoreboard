import './DayTabs.css'
import type { DayGroup } from '../../hooks/useGamesByDay'
import { formatDayChip } from '../../lib/timezone'

interface DayTabsProps {
  days: DayGroup[]
  selectedDateKey: string
  onSelect: (dateKey: string) => void
  zoneId: string
  /** When set, a date picker sits at the end of the strip for jumping
   * outside the visible window. Omitted on screens with a fixed window. */
  onPickDate?: (dateKey: string) => void
}

export function DayTabs({ days, selectedDateKey, onSelect, zoneId, onPickDate }: DayTabsProps) {
  return (
    <div className="day-tabs scrollbar-hide" role="tablist" aria-label="Select day">
      {days.map((day) => {
        const isActive = day.dateKey === selectedDateKey
        // A day with no games still gets a tab, so the strip is a stable
        // ruler; noon local is only used to label it.
        const sample = day.games[0]?.startDate ?? `${day.dateKey}T12:00:00Z`
        return (
          <button
            key={day.dateKey}
            role="tab"
            aria-selected={isActive}
            className={`day-tabs__tab${isActive ? ' day-tabs__tab--active' : ''}${day.games.length === 0 ? ' day-tabs__tab--empty' : ''}`}
            onClick={() => onSelect(day.dateKey)}
          >
            {formatDayChip(sample, zoneId)}
          </button>
        )
      })}
      {onPickDate && (
        <label className="day-tabs__pick" title="Jump to a date">
          <span aria-hidden="true">📅</span>
          <input
            type="date"
            className="day-tabs__pick-input"
            value={selectedDateKey}
            onChange={(e) => e.target.value && onPickDate(e.target.value)}
            aria-label="Jump to a date"
          />
        </label>
      )}
    </div>
  )
}
