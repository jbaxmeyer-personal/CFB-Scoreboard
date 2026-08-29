import './DayTabs.css'
import type { DayGroup } from '../../hooks/useGamesByDay'
import { formatDayChip } from '../../lib/timezone'

interface DayTabsProps {
  days: DayGroup[]
  selectedDateKey: string
  onSelect: (dateKey: string) => void
  zoneId: string
}

export function DayTabs({ days, selectedDateKey, onSelect, zoneId }: DayTabsProps) {
  return (
    <div className="day-tabs scrollbar-hide" role="tablist" aria-label="Select day">
      {days.map((day) => {
        const isActive = day.dateKey === selectedDateKey
        const sample = day.games[0]?.startDate ?? `${day.dateKey}T12:00:00Z`
        return (
          <button
            key={day.dateKey}
            role="tab"
            aria-selected={isActive}
            className={`day-tabs__tab${isActive ? ' day-tabs__tab--active' : ''}`}
            onClick={() => onSelect(day.dateKey)}
          >
            {formatDayChip(sample, zoneId)}
          </button>
        )
      })}
    </div>
  )
}
