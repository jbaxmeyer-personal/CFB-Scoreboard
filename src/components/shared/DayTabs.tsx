import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import './DayTabs.css'
import { formatDayKeyChip } from '../../lib/timezone'

/** How close to an end counts as reaching it. A chip is ~90px, so this is
 * about half a chip: near enough to mean "you are looking at the end",
 * far enough that the fetch is already underway when you get there. */
const EDGE_SLACK_PX = 48

/** How long the strip must stop moving before reaching an edge counts.
 *
 * A flick on a touch screen keeps firing scroll events after the finger
 * has gone, and acting on them mid-flight is what made this run away:
 * growth fired, the momentum carried straight back into the edge zone, and
 * it fired again, and again. Waiting for the strip to come to rest turns a
 * whole gesture into one question, however long its tail. */
const SETTLE_MS = 180

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
  // Fires the edge check once the strip has come to rest; see SETTLE_MS.
  const settling = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // The day the strip has already been positioned for, or null before it
  // has been positioned at all. Keyed by day rather than a bare flag so
  // that growing the strip — which changes the list but not the selection —
  // cannot be mistaken for a reason to move it.
  const placedFor = useRef<string | null>(null)
  // The day at the strip's left edge, and how far into it that edge falls.
  //
  // Anchoring to a *day* rather than to a width. The first cut remembered
  // scrollWidth and shifted scrollLeft by however much it grew, which is
  // right in principle and wrong in practice: the widths it compared came
  // from different renders, so the correction was routinely zero and the
  // view stayed pinned to the left edge. Each backward pull then showed the
  // seven days it had just added, and pulling a few times in a row walked
  // the strip back to the start of the season. Restoring a known day to a
  // known offset cannot drift that way.
  const anchor = useRef<{ key: string; offset: number } | null>(null)

  const rememberAnchor = useCallback(() => {
    const el = stripRef.current
    if (!el) return
    const edge = el.getBoundingClientRect().left
    for (const tab of el.querySelectorAll<HTMLElement>('[data-day]')) {
      const box = tab.getBoundingClientRect()
      if (box.right > edge + 4) {
        anchor.current = { key: tab.dataset.day ?? '', offset: box.left - edge }
        return
      }
    }
  }, [])

  useLayoutEffect(() => {
    const el = stripRef.current
    if (!el) return
    const held = anchor.current
    if (held) {
      const tab = el.querySelector<HTMLElement>(`[data-day="${CSS.escape(held.key)}"]`)
      if (tab) {
        el.scrollLeft += tab.getBoundingClientRect().left - el.getBoundingClientRect().left - held.offset
      }
    }
  }, [dateKeys])

  useEffect(() => () => clearTimeout(settling.current), [])

  /**
   * Put the selected day on screen.
   *
   * A scroll container opens at 0, and 0 is the earliest day that has been
   * loaded — which was near enough to today while the window was a fixed
   * ten days, and is weeks in the past now that the strip keeps whatever it
   * has been grown to. So every return from Slate opened the strip at the
   * start of the season, and every one of those also sat inside the start
   * edge zone and asked for more days from there.
   *
   * Runs once per selected day: on mount, and again when a date jump picks
   * a different one. Explicitly NOT when the strip merely grows — growing
   * changes the list while you are reading some other part of the season,
   * and re-centring on the selected day there drags you back to today from
   * wherever you had scrolled to.
   *
   * Tapping a day already in view leaves the strip where it is, because
   * moving it under the finger that just tapped is its own kind of jarring.
   */
  useLayoutEffect(() => {
    const el = stripRef.current
    if (!el || !selectedDateKey || placedFor.current === selectedDateKey) return
    const tab = el.querySelector<HTMLElement>(`[data-day="${CSS.escape(selectedDateKey)}"]`)
    // Not on the strip yet — the day's games are still arriving. Try again
    // on the render that adds it.
    if (!tab) return
    const box = tab.getBoundingClientRect()
    const view = el.getBoundingClientRect()
    if (box.left < view.left || box.right > view.right) {
      el.scrollLeft = Math.max(0, tab.offsetLeft - (el.clientWidth - tab.offsetWidth) / 2)
      rememberAnchor()
    }
    placedFor.current = selectedDateKey
  }, [selectedDateKey, dateKeys, rememberAnchor])

  const onScroll = useCallback(() => {
    rememberAnchor()
    // Restarted on every scroll event, so it only fires once the strip has
    // actually stopped — one question per gesture rather than one per frame
    // of a flick's momentum.
    clearTimeout(settling.current)
    settling.current = setTimeout(() => {
      const el = stripRef.current
      // Not before the selected day has been placed: until then the strip
      // is at 0 by default rather than by choice.
      if (!el || placedFor.current === null) return
      if (el.scrollLeft <= EDGE_SLACK_PX) onReachStart?.()
      else if (el.scrollLeft + el.clientWidth >= el.scrollWidth - EDGE_SLACK_PX) onReachEnd?.()
    }, SETTLE_MS)
  }, [rememberAnchor, onReachStart, onReachEnd])

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
            data-day={dateKey}
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
