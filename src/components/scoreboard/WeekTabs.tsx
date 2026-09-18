import { useLayoutEffect, useRef } from 'react'
import './WeekTabs.css'
import type { SeasonWeek } from '../../lib/seasonCalendar'

interface WeekTabsProps {
  weeks: SeasonWeek[]
  activeWeekStart: string | undefined
  onSelect: (weekStart: string) => void
}

/**
 * The season's weeks, as a strip of pills.
 *
 * Kept mounted while the week it selects is still loading. It used to sit
 * behind the screen's loading guard, so tapping a week that wasn't fetched
 * yet took the pills off the screen and put them back — which flashed, and
 * brought them back at scroll position zero, i.e. Week 0, with no sign of
 * where you had been.
 *
 * The active week is scrolled into view when it changes, and only then:
 * nineteen pills do not fit, so opening in September would otherwise show
 * August. Keyed on the week rather than on every render, because re-running
 * it on unrelated updates is how the day strip used to drag itself back to
 * today mid-scroll.
 */
export function WeekTabs({ weeks, activeWeekStart, onSelect }: WeekTabsProps) {
  const stripRef = useRef<HTMLDivElement>(null)
  const placedFor = useRef<string | null>(null)

  useLayoutEffect(() => {
    const el = stripRef.current
    if (!el || !activeWeekStart || placedFor.current === activeWeekStart) return
    const tab = el.querySelector<HTMLElement>(`[data-week="${CSS.escape(activeWeekStart)}"]`)
    if (!tab) return
    const box = tab.getBoundingClientRect()
    const view = el.getBoundingClientRect()
    if (box.left < view.left || box.right > view.right) {
      el.scrollLeft = Math.max(0, tab.offsetLeft - (el.clientWidth - tab.offsetWidth) / 2)
    }
    placedFor.current = activeWeekStart
  }, [activeWeekStart, weeks])

  return (
    <div className="week-tabs scrollbar-hide" role="tablist" aria-label="Select week" ref={stripRef}>
      {weeks.map((week) => {
        const isActive = week.start === activeWeekStart
        return (
          <button
            key={week.start}
            role="tab"
            aria-selected={isActive}
            data-week={week.start}
            className={`week-tabs__tab${isActive ? ' week-tabs__tab--active' : ''}`}
            onClick={() => onSelect(week.start)}
          >
            {week.label}
          </button>
        )
      })}
    </div>
  )
}
