import { useEffect, useRef, useState } from 'react'
import './FilterBar.css'
import { useViewState } from '../../context/ViewStateContext'
import { useConferences } from '../../hooks/useConferences'

/**
 * Top 25 and conference filters, shared by Slate and Scoreboard.
 *
 * The conference list is deliberately not a native <select>. Building it
 * costs a request per conference, so it is fetched only when the picker is
 * opened — and a native select can't say "loading": the first tap would
 * open a wheel containing nothing but "All conferences", with the real list
 * arriving after it had already been dismissed. This dropdown can show the
 * fetch happening, so opening it once is enough.
 */
export function FilterBar() {
  const { filters, setFilters } = useViewState()
  const [open, setOpen] = useState(false)
  // Also needed when a conference is already chosen: the list is what turns
  // a stored id back into a name.
  const needsConferences = open || filters.conferenceId !== null
  const { conferences, byId, isLoading, isError } = useConferences(needsConferences)
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

  const selected = filters.conferenceId ? byId.get(filters.conferenceId) : undefined
  const conferenceLabel = filters.conferenceId
    ? (selected?.shortName ?? (isLoading ? 'Loading…' : 'Conference'))
    : 'All conferences'

  const choose = (conferenceId: string | null) => {
    setFilters({ ...filters, conferenceId })
    setOpen(false)
  }

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
          className={`filter-bar__chip${filters.conferenceId ? ' filter-bar__chip--on' : ''}`}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen((o) => !o)}
        >
          {conferenceLabel} <span aria-hidden="true">▾</span>
        </button>

        {open && (
          <div className="filter-bar__menu" role="listbox" aria-label="Filter by conference">
            <button
              type="button"
              role="option"
              aria-selected={filters.conferenceId === null}
              className={`filter-bar__option${filters.conferenceId === null ? ' filter-bar__option--on' : ''}`}
              onClick={() => choose(null)}
            >
              All conferences
            </button>
            {/* Reported, not left as a blank list — an empty menu reads as
                "there are no conferences" rather than as a failed request. */}
            {isLoading && <p className="filter-bar__menu-note">Loading conferences…</p>}
            {isError && <p className="filter-bar__menu-note">Couldn't load conferences.</p>}
            {conferences.map((c) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={filters.conferenceId === c.id}
                className={`filter-bar__option${filters.conferenceId === c.id ? ' filter-bar__option--on' : ''}`}
                onClick={() => choose(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {(filters.rankedOnly || filters.conferenceId) && (
        <button type="button" className="filter-bar__clear" onClick={() => setFilters({ rankedOnly: false, conferenceId: null })}>
          Clear
        </button>
      )}
    </div>
  )
}
