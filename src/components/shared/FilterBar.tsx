import { useEffect, useRef, useState } from 'react'
import './FilterBar.css'
import { useViewState } from '../../context/ViewStateContext'
import { useConferences } from '../../hooks/useConferences'
import { NO_FILTERS } from '../../lib/gameFilters'

/**
 * Top 25 and conference filters, shared by Slate and Scoreboard.
 *
 * The conference list comes from a static table, so the picker opens with
 * every conference already in it — no loading state, nothing to fail, and
 * no request. It stays a custom dropdown rather than a native <select>
 * because the chips either side of it are ours, and a native control in the
 * middle of them looks like a different app — and because a native select
 * can't do the multiple selection this needs without turning into a list
 * box the height of the screen.
 *
 * Conferences are a multi-select, so the menu stays open as you tick them:
 * closing after each would make choosing three a three-trip job. It closes
 * on a tap outside or Escape, like any menu.
 */
export function FilterBar() {
  const { filters, setFilters } = useViewState()
  const [open, setOpen] = useState(false)
  const { conferences, byId } = useConferences()
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const chosen = filters.conferenceIds
  const isChosen = (id: string) => chosen.includes(id)

  // One conference names itself; two still fit the chip; beyond that the
  // names stop fitting and a count reads better than a truncated list.
  const conferenceLabel = (() => {
    if (chosen.length === 0) return 'All conferences'
    const names = chosen.flatMap((id) => byId.get(id)?.shortName ?? [])
    if (names.length === 0) return 'All conferences'
    return names.length <= 2 ? names.join(' · ') : `${names.length} conferences`
  })()

  /** Ticking stays on the menu — the list is the point of a multi-select. */
  const toggle = (conferenceId: string) => {
    setFilters({
      ...filters,
      conferenceIds: isChosen(conferenceId)
        ? chosen.filter((id) => id !== conferenceId)
        : [...chosen, conferenceId],
    })
  }

  /** "All conferences" is the absence of a choice, so it clears rather than
   * selecting everything — the two mean the same thing and an empty list is
   * the one that keeps working when a conference is added or renamed. */
  const clearConferences = () => setFilters({ ...filters, conferenceIds: [] })

  return (
    <div className="filter-bar" ref={rootRef}>
      <button
        type="button"
        className={`filter-bar__chip${filters.rankedOnly ? ' filter-bar__chip--on' : ''}`}
        aria-pressed={filters.rankedOnly}
        onClick={() => setFilters({ ...filters, rankedOnly: !filters.rankedOnly })}
      >
        Top 25
      </button>

      <div className="filter-bar__picker">
        <button
          type="button"
          className={`filter-bar__chip${chosen.length > 0 ? ' filter-bar__chip--on' : ''}`}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen((o) => !o)}
        >
          {conferenceLabel} <span aria-hidden="true">▾</span>
        </button>

        {open && (
          <div className="filter-bar__menu" role="listbox" aria-multiselectable aria-label="Filter by conference">
            <button
              type="button"
              role="option"
              aria-selected={chosen.length === 0}
              className={`filter-bar__option${chosen.length === 0 ? ' filter-bar__option--on' : ''}`}
              onClick={clearConferences}
            >
              All conferences
            </button>
            {conferences.map((c) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={isChosen(c.id)}
                className={`filter-bar__option${isChosen(c.id) ? ' filter-bar__option--on' : ''}`}
                onClick={() => toggle(c.id)}
              >
                <span className="filter-bar__option-tick" aria-hidden="true">
                  {isChosen(c.id) ? '✓' : ''}
                </span>
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {(filters.rankedOnly || chosen.length > 0) && (
        <button type="button" className="filter-bar__clear" onClick={() => setFilters(NO_FILTERS)}>
          Clear
        </button>
      )}
    </div>
  )
}
