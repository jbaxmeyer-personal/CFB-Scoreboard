import './DayTabs.css'
import { formatDayKeyChip } from '../../lib/timezone'

interface DayTabsProps {
  /** yyyy-MM-dd, in order. */
  dateKeys: string[]
  selectedDateKey: string
  onSelect: (dateKey: string) => void
}

/**
 * The day strip on Slate.
 *
 * Slate is a day at a time — what is on tonight — so a handful of days is
 * the whole job and the strip is just a row of chips.
 *
 * It used to carry a date picker, season bounds, and edges that fetched
 * more days as you scrolled into them, all for Scoreboard. Scoreboard is
 * navigated by week now, so none of that has a caller: the window growing,
 * the scroll anchoring, the momentum settling and the initial placement
 * came out with it. They existed to make a list that changed under you
 * behave, and this list does not change under you.
 */
export function DayTabs({ dateKeys, selectedDateKey, onSelect }: DayTabsProps) {
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
    </div>
  )
}
