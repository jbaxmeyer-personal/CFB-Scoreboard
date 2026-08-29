import { useState } from 'react'
import './TeamSearchPicker.css'
import type { Team } from '../../types/game'
import { TeamLogo } from '../shared/TeamLogo'
import { ALL_TEAMS } from '../../data/teams'

interface TeamSearchPickerProps {
  isSelected: (teamId: string) => boolean
  onToggle: (team: Team) => void
  placeholder?: string
  emptyHint?: string
}

/**
 * Type-to-search, tap-to-toggle team picker with logos — replaces a long
 * static scroll list. Selected teams show as a compact chip row; the full
 * ~130-team list is never rendered at once, only filtered search matches.
 */
export function TeamSearchPicker({ isSelected, onToggle, placeholder = 'Search teams…', emptyHint }: TeamSearchPickerProps) {
  const [query, setQuery] = useState('')

  const selected = ALL_TEAMS.filter((t) => isSelected(t.id))
  const q = query.trim().toLowerCase()
  const matches = q ? ALL_TEAMS.filter((t) => t.name.toLowerCase().includes(q) || t.abbreviation.toLowerCase().includes(q)).slice(0, 8) : []

  return (
    <div className="team-picker">
      {selected.length > 0 ? (
        <div className="team-picker__chips">
          {selected.map((team) => (
            <button key={team.id} type="button" className="team-picker__chip" onClick={() => onToggle(team)}>
              <TeamLogo team={team} size={22} />
              <span>{team.abbreviation}</span>
              <span className="team-picker__chip-remove" aria-hidden="true">
                ×
              </span>
            </button>
          ))}
        </div>
      ) : (
        emptyHint && <p className="team-picker__empty">{emptyHint}</p>
      )}

      <input
        type="text"
        className="team-picker__input"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {q && (
        <div className="team-picker__results">
          {matches.length === 0 && <p className="team-picker__no-match">No teams match "{query}"</p>}
          {matches.map((team) => {
            const active = isSelected(team.id)
            return (
              <button
                key={team.id}
                type="button"
                className={`team-picker__result${active ? ' team-picker__result--active' : ''}`}
                onClick={() => {
                  onToggle(team)
                  setQuery('')
                }}
              >
                <TeamLogo team={team} size={24} />
                <span className="team-picker__result-name">{team.name}</span>
                {active && <span aria-hidden="true">✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
