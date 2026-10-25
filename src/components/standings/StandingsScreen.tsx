import { useState } from 'react'
import './StandingsScreen.css'
import { TeamLogo } from '../shared/TeamLogo'
import { LoadingState } from '../shared/StatusStates'
import { LockIcon } from '../shared/icons'
import { conferenceLogoUrl } from '../../lib/conferenceBadge'
import { useStandings } from '../../hooks/useStandings'
import { useSettings } from '../../context/SettingsContext'
import type { ConferenceStandings } from '../../lib/standings'

/** A dash rather than an empty cell, so a missing record reads as "nothing
 * here" instead of as a column that failed to draw. */
const NO_RECORD = '–'

function ConferenceTable({ section, favoriteIds }: { section: ConferenceStandings; favoriteIds: string[] }) {
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
          <li
            key={row.team.id}
            className={`standings__row${favoriteIds.includes(row.team.id) ? ' standings__row--favorite' : ''}`}
          >
            {/* Positions are only printed on a ranked table. Numbering an
                alphabetical one would state an order it doesn't have. */}
            <span className="standings__position">{unranked ? '' : index + 1}</span>
            <TeamLogo team={row.team} size={22} />
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
          </li>
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
 * Every FBS conference, its teams, and their records.
 *
 * The screen is built from the static conference and team tables, so it
 * renders in full before any request finishes and keeps rendering in full
 * if the request fails — only the two record columns depend on ESPN. That
 * is deliberate: a standings tab that can come up blank is worse than no
 * tab, and ESPN's standings shape can't be verified from the build
 * environment.
 *
 * No-spoilers is handled by hiding the record *and* the position. A
 * protected team sitting first in the Big Ten tells you how its season is
 * going just as plainly as "5-0" does, so a conference holding one is
 * listed alphabetically until you ask to see it. One button reveals the
 * whole table, like the team page's "Show results" — you are on this screen
 * on purpose, and a gate per row would be forty taps.
 */
export function StandingsScreen() {
  const [revealed, setRevealed] = useState(false)
  const { settings } = useSettings()
  const { conferences, note, isLoading } = useStandings(revealed)
  // Read off the rows themselves, so revealing clears the button with the
  // same render that fills the columns in.
  const hidesAnything = conferences.some((c) => c.rows.some((row) => row.hidden))

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
      {note && <p className="standings__note">{note}</p>}
      {isLoading && <LoadingState label="Loading records…" />}
      {conferences.map((section) => (
        <ConferenceTable key={section.conference.id} section={section} favoriteIds={settings.favoriteTeamIds} />
      ))}
    </div>
  )
}
