import { useState } from 'react'
import { AppHeader } from '../shared/AppHeader'
import './SettingsScreen.css'
import { useSettings } from '../../context/SettingsContext'
import { TIMEZONE_OPTIONS, DEVICE_TIMEZONE_ID, getDeviceTimezone } from '../../lib/timezone'
import { TeamSearchPicker } from './TeamSearchPicker'
import type { Team } from '../../types/game'

export function SettingsScreen() {
  const {
    settings,
    setTimezoneId,
    isFavoriteTeam,
    toggleFavoriteTeam,
    setGlobalSpoilers,
    isTeamSpoilerListed,
    toggleProtectedTeam,
  } = useSettings()

  const [protectPrompt, setProtectPrompt] = useState<Team | null>(null)

  function handleFavoriteToggle(team: Team) {
    const wasFavorite = isFavoriteTeam(team.id)
    toggleFavoriteTeam(team.id)
    if (!wasFavorite && !isTeamSpoilerListed(team.id)) {
      setProtectPrompt(team)
    }
  }

  return (
    <div className="settings-screen">
      <AppHeader section="Settings" />

      <section className="settings-section">
        <h2 className="settings-section__title">Timezone</h2>
        <p className="settings-section__hint">All kickoff times update immediately when you change this.</p>
        <div className="settings-radio-group">
          <label className="settings-radio">
            <input
              type="radio"
              name="timezone"
              checked={settings.timezoneId === DEVICE_TIMEZONE_ID}
              onChange={() => setTimezoneId(DEVICE_TIMEZONE_ID)}
            />
            <span>Device ({getDeviceTimezone()})</span>
          </label>
          {TIMEZONE_OPTIONS.map((tz) => (
            <label className="settings-radio" key={tz.id}>
              <input type="radio" name="timezone" checked={settings.timezoneId === tz.id} onChange={() => setTimezoneId(tz.id)} />
              <span>
                {tz.label} ({tz.abbr})
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">Favorite Teams</h2>
        <p className="settings-section__hint">Favorited teams are highlighted throughout the schedule.</p>
        <TeamSearchPicker
          isSelected={isFavoriteTeam}
          onToggle={handleFavoriteToggle}
          placeholder="Search teams to favorite…"
          emptyHint="No favorite teams yet."
        />
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">No-Spoilers Mode</h2>
        <label className="settings-toggle">
          <span>
            <strong>Global No-Spoilers</strong>
            <br />
            <span className="settings-section__hint">Hides score, live status, and results everywhere.</span>
          </span>
          <input
            type="checkbox"
            checked={settings.spoilers.globalEnabled}
            onChange={(e) => setGlobalSpoilers(e.target.checked)}
          />
        </label>

        <h3 className="settings-section__subtitle">Protected Teams</h3>
        <p className="settings-section__hint">Always hide scores for these teams, regardless of the global toggle.</p>
        <TeamSearchPicker
          isSelected={isTeamSpoilerListed}
          onToggle={(team) => toggleProtectedTeam(team.id)}
          placeholder="Search teams to protect…"
          emptyHint="No protected teams yet."
        />
        <p className="settings-section__hint" style={{ marginTop: 10 }}>
          To hide a single game's score, tap the lock icon on that game in Slate or Scoreboard.
        </p>
      </section>

      {protectPrompt && (
        <div className="confirm-prompt-backdrop" onClick={() => setProtectPrompt(null)}>
          <div className="confirm-prompt" onClick={(e) => e.stopPropagation()}>
            <p>
              Also hide spoilers for <strong>{protectPrompt.name}</strong>?
            </p>
            <div className="confirm-prompt__actions">
              <button type="button" className="confirm-prompt__no" onClick={() => setProtectPrompt(null)}>
                No thanks
              </button>
              <button
                type="button"
                className="confirm-prompt__yes"
                onClick={() => {
                  toggleProtectedTeam(protectPrompt.id)
                  setProtectPrompt(null)
                }}
              >
                Yes, protect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
