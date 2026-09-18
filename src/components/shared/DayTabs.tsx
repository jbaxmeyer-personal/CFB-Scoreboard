import { useCallback, useLayoutEffect, useRef } from 'react'
import './DayTabs.css'
import { formatDayKeyChip } from '../../lib/timezone'

/** How close to an end counts as reaching it. A chip is ~90px, so this is
 * about half a chip: near enough to mean "you are looking at the end",
 * far enough that the fetch is already underway when you get there. */
const EDGE_SLACK_PX = 48

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
  /** Called when the strip is scrolled to its start/end, so the caller can
   * fetch further out and hand back a longer list. Each fires once per
   * arrival, not continuously while you sit at the edge. */
  onReachStart?: () => void
  onReachEnd?: () => void
}

export function DayTabs({
  dateKeys,
  selectedDateKey,
  onSelect,
  onPickDate,
  minDateKey,
  maxDateKey,
  onReachStart,
  onReachEnd,
}: DayTabsProps) {
  const stripRef = useRef<HTMLDivElement>(null)
  // Which edge we have already asked about. Cleared on leaving that edge, so
  // scrolling back to it asks again — without this, sitting at the end fires
  // on every scroll event and runs the window off the end of the season.
  const asked = useRef<'start' | 'end' | null>(null)
  // What the strip measured before this render, for restoring the scroll
  // position when days are added to the *front*: prepending shifts every
  // chip right by the width of what was added, and the day you were looking
  // at would slide off under your thumb.
  const before = useRef<{ first: string | undefined; scrollWidth: number; scrollLeft: number }>({
    first: undefined,
    scrollWidth: 0,
    scrollLeft: 0,
  })

  useLayoutEffect(() => {
    const el = stripRef.current
    if (!el) return
    const prev = before.current
    const prepended = prev.first !== undefined && dateKeys[0] !== undefined && dateKeys[0] < prev.first
    if (prepended) {
      el.scrollLeft = prev.scrollLeft + (el.scrollWidth - prev.scrollWidth)
    }
    before.current = { first: dateKeys[0], scrollWidth: el.scrollWidth, scrollLeft: el.scrollLeft }
    // More days arrived, so the edge we asked about is a different edge now
    // and may be asked about again. Without this the only thing that clears
    // the flag is scrolling back through the middle — and at the end of a
    // strip you are dragging *towards* the edge, not away from it, so the
    // second pull would do nothing.
    asked.current = null
  }, [dateKeys])

  const onScroll = useCallback(() => {
    const el = stripRef.current
    if (!el) return
    before.current = { first: dateKeys[0], scrollWidth: el.scrollWidth, scrollLeft: el.scrollLeft }
    const atStart = el.scrollLeft <= EDGE_SLACK_PX
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - EDGE_SLACK_PX
    if (atStart && asked.current !== 'start') {
      asked.current = 'start'
      onReachStart?.()
    } else if (atEnd && asked.current !== 'end') {
      asked.current = 'end'
      onReachEnd?.()
    } else if (!atStart && !atEnd) {
      asked.current = null
    }
  }, [dateKeys, onReachStart, onReachEnd])

  return (
    <div className="day-tabs scrollbar-hide" role="tablist" aria-label="Select day" ref={stripRef} onScroll={onScroll}>
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
