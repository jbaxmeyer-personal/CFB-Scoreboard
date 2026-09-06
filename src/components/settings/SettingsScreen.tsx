import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AppHeader } from '../shared/AppHeader'
import './SettingsScreen.css'
import { useSettings } from '../../context/SettingsContext'
import { TIMEZONE_OPTIONS, DEVICE_TIMEZONE_ID, getDeviceTimezone } from '../../lib/timezone'
import { TeamSearchPicker } from './TeamSearchPicker'
import { BROADCAST_DELAY_OPTIONS } from '../../lib/broadcastDelay'
import { buildFeedSample } from '../../lib/feedSample'
import { probeTeamPlayerSources } from '../../lib/teamPlayerProbe'
import { seasonYearFromDate } from '../../lib/espn'
import { useViewState } from '../../context/ViewStateContext'
import type { EspnScoreboardResponse, EspnSummaryResponse } from '../../types/espn'
import type { Team } from '../../types/game'

export function SettingsScreen() {
  const {
    settings,
    setTimezoneId,
    isFavoriteTeam,
    toggleFavoriteTeam,
    setGlobalSpoilers,
    setBroadcastDelaySeconds,
    isTeamSpoilerListed,
    toggleProtectedTeam,
  } = useSettings()

  const [protectPrompt, setProtectPrompt] = useState<Team | null>(null)
  const [feedSample, setFeedSample] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [probeOutput, setProbeOutput] = useState<string | null>(null)
  const [probing, setProbing] = useState(false)
  const [probeCopied, setProbeCopied] = useState(false)
  const queryClient = useQueryClient()
  const { expandedGameId, teamPageId } = useViewState()

  // Reads the responses already in the cache — no new requests, and nothing
  // is interpreted on the way out.
  function showFeedSample() {
    const gameId = expandedGameId
    if (!gameId) {
      setFeedSample('Open a game first (tap one on Slate or Scoreboard), then come back here.')
      return
    }
    const scoreboards = queryClient
      .getQueriesData<EspnScoreboardResponse>({ queryKey: ['scoreboard'] })
      .map(([, data]) => data)
      .filter((d): d is EspnScoreboardResponse => Boolean(d))
    const summary = queryClient.getQueryData<EspnSummaryResponse>(['gameSummary', gameId])
    // The newest of the day-queries: the scoreboard is one request per day
    // in the window, and the one carrying this game is the one that matters.
    const scoreboardFetchedAt = queryClient
      .getQueryCache()
      .findAll({ queryKey: ['scoreboard'] })
      .reduce((newest, q) => Math.max(newest, q.state.dataUpdatedAt), 0)
    const summaryFetchedAt = queryClient.getQueryState(['gameSummary', gameId])?.dataUpdatedAt
    setFeedSample(
      buildFeedSample({
        gameId,
        scoreboards,
        summary,
        scoreboardFetchedAt: scoreboardFetchedAt || undefined,
        summaryFetchedAt,
        delaySeconds: settings.broadcastDelaySeconds,
      }),
    )
    setCopied(false)
  }

  // Unlike the sample above, this one does make requests — that is the whole
  // point of it. It runs on a device that can reach ESPN, against endpoints
  // nothing in the app reads yet, to find out what season player stats
  // actually look like before any of it is built.
  async function runTeamProbe() {
    if (!teamPageId) {
      setProbeOutput('Open a team page first (tap a team name in an expanded game), then come back here.')
      return
    }
    setProbing(true)
    setProbeCopied(false)
    try {
      setProbeOutput(await probeTeamPlayerSources(teamPageId, seasonYearFromDate(new Date().toISOString())))
    } catch (e) {
      setProbeOutput(`Probe failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setProbing(false)
    }
  }

  async function copyProbeOutput() {
    if (!probeOutput) return
    try {
      await navigator.clipboard.writeText(probeOutput)
      setProbeCopied(true)
    } catch {
      setProbeCopied(false)
    }
  }

  async function copyFeedSample() {
    if (!feedSample) return
    try {
      await navigator.clipboard.writeText(feedSample)
      setCopied(true)
    } catch {
      // Clipboard can be refused; the text is on screen to select either way.
      setCopied(false)
    }
  }

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
        <h2 className="settings-section__title">Feed Diagnostics</h2>
        <p className="settings-section__hint">
          Shows exactly what ESPN sent for the last game you opened — the field position, the current drive, a few
          plays — copied out verbatim, nothing interpreted. ESPN can't be reached from where Slate is built, so this is
          how a question about its data gets answered by reading rather than guessing. No new requests; it reads what's
          already loaded.
        </p>
        <div className="settings-feed__actions">
          <button type="button" className="settings-feed__button" onClick={showFeedSample}>
            Show feed sample
          </button>
          {feedSample && (
            <button type="button" className="settings-feed__button" onClick={copyFeedSample}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>
        {feedSample && <pre className="settings-feed__sample">{feedSample}</pre>}
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">Season Player Stats Probe</h2>
        <p className="settings-section__hint">
          Asks ESPN which of its endpoints carries per-player season stats, and reports what comes back verbatim —
          status, top-level keys, and a trimmed excerpt. Nothing in the app reads this; it exists so the feature can be
          built against a real response instead of a guess. Open a team page first, then run it here and send me the
          output.
        </p>
        <div className="settings-feed__actions">
          <button type="button" className="settings-feed__button" onClick={runTeamProbe} disabled={probing}>
            {probing ? 'Asking ESPN…' : 'Run probe'}
          </button>
          {probeOutput && (
            <button type="button" className="settings-feed__button" onClick={copyProbeOutput}>
              {probeCopied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>
        {probeOutput && <pre className="settings-feed__sample">{probeOutput}</pre>}
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">Broadcast Delay</h2>
        <p className="settings-section__hint">
          ESPN's feed runs ahead of the television picture, so scores here can land before the play does on screen.
          This holds live games back so the app trails your broadcast instead of beating it. Finals and upcoming games
          are never delayed, and a live game shows no score for the first stretch after you open the app — that gap is
          the delay itself, with nothing yet old enough to show.
        </p>
        <div className="settings-radio-group">
          {BROADCAST_DELAY_OPTIONS.map((option) => (
            <label className="settings-radio" key={option.seconds}>
              <input
                type="radio"
                name="broadcast-delay"
                checked={settings.broadcastDelaySeconds === option.seconds}
                onChange={() => setBroadcastDelaySeconds(option.seconds)}
              />
              <span>{option.label}</span>
            </label>
          ))}
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
