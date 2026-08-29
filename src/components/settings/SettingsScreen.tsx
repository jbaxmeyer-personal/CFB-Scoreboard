import { useMemo } from 'react'
import './SettingsScreen.css'
import { useScoreboard } from '../../hooks/useScoreboard'
import { useSettings } from '../../context/SettingsContext'
import { TIMEZONE_OPTIONS, DEVICE_TIMEZONE_ID, getDeviceTimezone } from '../../lib/timezone'
import { TeamLogo } from '../shared/TeamLogo'
import { StarIcon } from '../shared/icons'
import { formatDayChip, formatKickoffTime } from '../../lib/timezone'
import type { Team, Game } from '../../types/game'

function uniqueTeams(games: Game[]): Team[] {
  const map = new Map<string, Team>()
  for (const g of games) {
    map.set(g.home.id, g.home)
    map.set(g.away.id, g.away)
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function SettingsScreen() {
  const { games } = useScoreboard()
  const {
    settings,
    setTimezoneId,
    isFavoriteTeam,
    toggleFavoriteTeam,
    setGlobalSpoilers,
    isTeamSpoilerListed,
    toggleProtectedTeam,
    isGameSpoilerListed,
    toggleProtectedGame,
  } = useSettings()

  const teams = useMemo(() => uniqueTeams(games), [games])

  return (
    <div className="settings-screen">
      <div className="settings-screen__header">
        <h1 className="settings-screen__title">Settings</h1>
      </div>

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
        <div className="settings-team-list">
          {teams.map((team) => {
            const favorite = isFavoriteTeam(team.id)
            return (
              <button key={team.id} type="button" className="settings-team-row" onClick={() => toggleFavoriteTeam(team.id)}>
                <TeamLogo team={team} size={28} />
                <span className="settings-team-row__name">{team.name}</span>
                <StarIcon size={16} filled={favorite} />
              </button>
            )
          })}
        </div>
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
        <div className="settings-team-list">
          {teams.map((team) => {
            const listed = isTeamSpoilerListed(team.id)
            return (
              <button
                key={team.id}
                type="button"
                className={`settings-team-row${listed ? ' settings-team-row--active' : ''}`}
                onClick={() => toggleProtectedTeam(team.id)}
              >
                <TeamLogo team={team} size={28} />
                <span className="settings-team-row__name">{team.name}</span>
                <span className="settings-checkbox-indicator" aria-hidden="true">
                  {listed ? '✓' : ''}
                </span>
              </button>
            )
          })}
        </div>

        <h3 className="settings-section__subtitle">Protected Games</h3>
        <p className="settings-section__hint">Hide the score for one specific matchup.</p>
        <div className="settings-game-list">
          {games.map((game) => {
            const listed = isGameSpoilerListed(game.id)
            return (
              <button
                key={game.id}
                type="button"
                className={`settings-game-row${listed ? ' settings-game-row--active' : ''}`}
                onClick={() => toggleProtectedGame(game.id)}
              >
                <span className="settings-game-row__matchup">
                  {game.away.abbreviation} @ {game.home.abbreviation}
                </span>
                <span className="settings-game-row__time">
                  {formatDayChip(game.startDate, settings.timezoneId)} · {formatKickoffTime(game.startDate, settings.timezoneId)}
                </span>
                <span className="settings-checkbox-indicator" aria-hidden="true">
                  {listed ? '✓' : ''}
                </span>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
