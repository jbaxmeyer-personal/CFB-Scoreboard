import './DayTabs.css'
import { formatDayKeyChip } from '../../lib/timezone'

interface DayTabsProps {
  /** yyyy-MM-dd, in order. Plain keys rather than the days' games, because
   * the strip can offer a date the screen hasn't fetched yet — selecting it
   * is what goes and gets it. */
  dateKeys: string[]
  selectedDateKey: string
  onSelect: (dateKey: string) => void
  /** When set, a date picker sits at the end of the strip for jumping
   * outside the visible window. Omitted on screens with a fixed window. */
  onPickDate?: (dateKey: string) => void
  /** yyyy-MM-dd bounds for that picker, so it can't wander outside the
   * season. The native picker is the phone's own, and min/max are the only
   * control it offers — individual days can't be greyed out in it. */
  minDateKey?: string
  maxDateKey?: string
}

export function DayTabs({ dateKeys, selectedDateKey, onSelect, onPickDate, minDateKey, maxDateKey }: DayTabsProps) {
  return (
    <div className="day-tabs scrollbar-hide" role="tablist" aria-label="Select day">
      {dateKeys.map((dateKey) => {
        const isActive = dateKey === selectedDateKey
        return (
          <button
            key={dateKey}
            role="tab"
            aria-selected={isActive}
            className={`day-tabs__tab${isActive ? ' day-tabs__tab--active' : ''}`}
            onClick={() => onSelect(dateKey)}
          >
            {formatDayKeyChip(dateKey)}
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
            min={minDateKey}
            max={maxDateKey}
            onChange={(e) => e.target.value && onPickDate(e.target.value)}
            aria-label="Jump to a date"
          />
        </label>
      )}
    </div>
  )
}
