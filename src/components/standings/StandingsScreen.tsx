import { useEffect, useMemo, useRef, useState } from 'react'
import './StandingsScreen.css'
import { TeamLogo } from '../shared/TeamLogo'
import { LoadingState } from '../shared/StatusStates'
import { LockIcon } from '../shared/icons'
import { conferenceLogoUrl } from '../../lib/conferenceBadge'
import { useStandings } from '../../hooks/useStandings'
import { useConferences } from '../../hooks/useConferences'
import { useSettings } from '../../context/SettingsContext'
import { useViewState } from '../../context/ViewStateContext'
import { TeamDetailPanel } from '../shared/TeamDetailPanel'
import { seasonYearFromDate } from '../../lib/espn'
import { POWER_CONFERENCE_IDS, readSelectedConferences, writeSelectedConferences } from '../../lib/standingsPrefs'
import type { StandingsRow, ConferenceStandings } from '../../lib/standings'

/** A dash rather than an empty cell, so a missing record reads as "nothing
 * here" instead of as a column that failed to draw. */
const NO_RECORD = '–'

function Row({
  row,
  position,
  favorite,
  showBadge = true,
  onSelect,
}: {
  row: StandingsRow
  position: string
  favorite: boolean
  /** The Top 25 list prints the rank in its own column, so the badge there
   * would say the same number twice, eight pixels apart. In a conference
   * table the position column means something else entirely — where you
   * sit in the conference — so the badge is the only thing carrying the
   * poll, and it stays. */
  showBadge?: boolean
  /** Opens this team's page. The row is the button, the way a team's own
   * schedule rows are — the whole line is the tap target, which on a phone
   * is the difference between a list you can use and one you aim at. */
  onSelect: () => void
}) {
  return (
    <li>
      <button
        type="button"
        className={`standings__row${favorite ? ' standings__row--favorite' : ''}`}
        onClick={onSelect}
      >
        <span className="standings__position">{position}</span>
        <TeamLogo team={row.team} size={24} rank={showBadge ? row.team.rank : undefined} />
        <span className="standings__team">{row.team.name}</span>
        {row.hidden ? (
          <span className="standings__hidden" aria-label="Record hidden by no-spoilers">
            <LockIcon size={11} />
          </span>
        ) : (
          <>
            <span className="standings__record ticker">{row.record?.conference ?? NO_RECORD}</span>
            <span className="standings__record standings__record--overall ticker">
              {row.record?.overall ?? NO_RECORD}
            </span>
          </>
        )}
      </button>
    </li>
  )
}

function ConferenceTable({
  section,
  favoriteIds,
  onSelectTeam,
}: {
  section: ConferenceStandings
  favoriteIds: string[]
  onSelectTeam: (row: StandingsRow) => void
}) {
  const { conference, rows, unranked, hidesRecords } = section
  const shield = conferenceLogoUrl(conference)

  return (
    <section className="standings__conference">
      <div className="standings__conference-head">
        {shield && <img className="standings__shield" src={shield} alt="" aria-hidden />}
        <h3 className="standings__conference-name">{conference.name}</h3>
        <span className="standings__col-label">Conf</span>
        <span className="standings__col-label">Overall</span>
      </div>
      <ol className="standings__rows">
        {rows.map((row, index) => (
          <Row
            key={row.team.id}
            row={row}
            // Positions are only printed on a ranked table. Numbering an
            // alphabetical one would state an order it doesn't have.
            position={unranked ? '' : String(index + 1)}
            favorite={favoriteIds.includes(row.team.id)}
            onSelect={() => onSelectTeam(row)}
          />
        ))}
      </ol>
      {hidesRecords && (
        <p className="standings__unranked-note">
          Listed alphabetically — a protected team’s position would give its record away.
        </p>
      )}
    </section>
  )
}

/**
 * Which conferences to show, as a multi-select menu.
 *
 * Deliberately the same kind of control as the Slate/Scoreboard conference
 * filter — a custom menu rather than a native `<select>`, staying open as
 * you tick, closing on a tap outside or Escape — because it is the same
 * question asked on a different screen, and two different-looking pickers
 * for one idea is worse than either.
 */
function ConferencePicker({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
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

  const label = (() => {
    if (selected.length === 0) return 'No conferences'
    if (selected.length === conferences.length) return 'All conferences'
    const names = selected.flatMap((id) => byId.get(id)?.shortName ?? [])
    return names.length <= 2 ? names.join(' · ') : `${names.length} conferences`
  })()

  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])

  return (
    <div className="standings__picker" ref={rootRef}>
      <button
        type="button"
        className="standings__picker-chip"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
      >
        {label} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="standings__menu" role="listbox" aria-multiselectable="true">
          <div className="standings__menu-actions">
            <button type="button" onClick={() => onChange([...POWER_CONFERENCE_IDS])}>
              Power four
            </button>
            <button type="button" onClick={() => onChange(conferences.map((c) => c.id))}>
              All
            </button>
            <button type="button" onClick={() => onChange([])}>
              None
            </button>
          </div>
          {conferences.map((conference) => {
            const on = selected.includes(conference.id)
            return (
              <button
                key={conference.id}
                type="button"
                role="option"
                aria-selected={on}
                className={`standings__menu-item${on ? ' standings__menu-item--on' : ''}`}
                onClick={() => toggle(conference.id)}
              >
                <span className="standings__check" aria-hidden="true">
                  {on ? '✓' : ''}
                </span>
                {conference.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * The Top 25, then the conference tables.
 *
 * The screen is built from the static conference and team tables, so it
 * renders in full before any request finishes and keeps rendering in full
 * if the requests fail — only the record columns, the Top 25 section and
 * the rank badges depend on ESPN. That is deliberate: a standings tab that
 * can come up blank is worse than no tab, and neither ESPN response shape
 * can be verified from the build environment.
 *
 * No-spoilers hides the record *and* the position. A protected team sitting
 * first in the Big Ten tells you how its season is going just as plainly as
 * "5-0" does, so a conference holding one is listed alphabetically until
 * you ask to see it. One button reveals the whole screen, like the team
 * page's "Show results" — you are here on purpose, and a gate per row would
 * be forty taps.
 *
 * The Top 25 is not filtered by the conference picker. It is the national
 * poll, listed first because it is the one table everybody reads; narrowing
 * it to the chosen conferences would make it a different list wearing the
 * same name.
 */
export function StandingsScreen() {
  const [revealed, setRevealed] = useState(false)
  const [selected, setSelected] = useState<string[]>(readSelectedConferences)
  const { settings } = useSettings()
  const { pushDetail } = useViewState()
  const year = seasonYearFromDate(new Date().toISOString())
  const { conferences, top25, pollName, note, isLoading } = useStandings(revealed)

  useEffect(() => {
    writeSelectedConferences(selected)
  }, [selected])

  const shown = useMemo(
    () => conferences.filter((section) => selected.includes(section.conference.id)),
    [conferences, selected],
  )
  // Read off the rows themselves, so revealing clears the button with the
  // same render that fills the columns in. The Top 25 counts: it is on the
  // screen whatever conferences are chosen.
  const hidesAnything = top25.some((row) => row.hidden) || shown.some((c) => c.rows.some((row) => row.hidden))

  /**
   * Open a team's page over the table, the same screen tapping a team in
   * an expanded game opens.
   *
   * The record travels with the team. The static table has no record in it
   * — records change weekly — so without this the page you arrive at from
   * a row showing "7-1" has no record in its header at all. It is read off
   * the row rather than the feed, which also means a protected team
   * carries nothing: `row.record` is already undefined when it is hidden.
   */
  const openTeam = (row: StandingsRow) =>
    pushDetail({
      kind: 'team',
      team: row.record?.overall ? { ...row.team, record: row.record.overall } : row.team,
      year,
    })

  return (
    <div className="standings">
      <div className="standings__bar">
        <h2 className="standings__title">Standings</h2>
        {hidesAnything && (
          <button type="button" className="standings__reveal" onClick={() => setRevealed(true)}>
            <LockIcon size={12} />
            Show records
          </button>
        )}
      </div>

      <div className="standings__controls">
        <ConferencePicker selected={selected} onChange={setSelected} />
      </div>

      {note && <p className="standings__note">{note}</p>}
      {isLoading && <LoadingState label="Loading records…" />}

      {top25.length > 0 && (
        <section className="standings__conference">
          <div className="standings__conference-head">
            <h3 className="standings__conference-name standings__conference-name--wide">{pollName}</h3>
            <span className="standings__col-label">Conf</span>
            <span className="standings__col-label">Overall</span>
          </div>
          <ol className="standings__rows">
            {top25.map((row) => (
              <Row
                key={row.team.id}
                row={row}
                // The poll's own number, not this list's index: a team
                // missing from the static table would otherwise shift every
                // rank below it by one.
                position={String(row.team.rank ?? '')}
                favorite={settings.favoriteTeamIds.includes(row.team.id)}
                showBadge={false}
                onSelect={() => openTeam(row)}
              />
            ))}
          </ol>
        </section>
      )}

      {shown.map((section) => (
        <ConferenceTable
          key={section.conference.id}
          section={section}
          favoriteIds={settings.favoriteTeamIds}
          onSelectTeam={openTeam}
        />
      ))}

      {shown.length === 0 && (
        <p className="standings__empty">No conferences selected. Pick some from the menu above.</p>
      )}

      {/* Paints over this screen rather than inside it, so the table keeps
          its scroll position with nothing to restore on the way back. */}
      <TeamDetailPanel />
    </div>
  )
}
