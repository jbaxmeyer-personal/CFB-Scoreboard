import './DayTabs.css'
import type { DayGroup } from '../../hooks/useGamesByDay'
import { formatDayKeyChip } from '../../lib/timezone'

interface DayTabsProps {
  days: DayGroup[]
  selectedDateKey: string
  onSelect: (dateKey: string) => void
  /** When set, a date picker sits at the end of the strip for jumping
   * outside the visible window. Omitted on screens with a fixed window. */
  onPickDate?: (dateKey: string) => void
}

export function DayTabs({ days, selectedDateKey, onSelect, onPickDate }: DayTabsProps) {
  return (
    <div className="day-tabs scrollbar-hide" role="tablist" aria-label="Select day">
      {days.map((day) => {
        const isActive = day.dateKey === selectedDateKey
        return (
          <button
            key={day.dateKey}
            role="tab"
            aria-selected={isActive}
            className={`day-tabs__tab${isActive ? ' day-tabs__tab--active' : ''}`}
            onClick={() => onSelect(day.dateKey)}
          >
            {formatDayKeyChip(day.dateKey)}
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
