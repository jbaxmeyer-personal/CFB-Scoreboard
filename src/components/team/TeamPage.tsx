import './TeamPage.css'
import type { Game, Team, TeamProfileSection } from '../../types/game'
import type { TeamProfileStat } from '../../lib/espn'
import { TeamLogo } from '../shared/TeamLogo'
import { useTeamPage } from '../../hooks/useTeamPage'
import { useSpoilerSafeGames } from '../../hooks/useSpoilerSafeGames'
import { useSettings } from '../../context/SettingsContext'
import { formatDayChip, formatKickoffTime } from '../../lib/timezone'
import { LoadingState } from '../shared/StatusStates'
import { PlayerCategory } from '../scoreboard/GameStats'
import { useSeasonPlayerStats } from '../../hooks/useSeasonPlayerStats'
import { useState } from 'react'

const SECTION_LABEL: Record<TeamProfileSection, string> = {
  offense: 'Offense',
  defense: 'Defense',
  turnovers: 'Turnovers',
}

function StatRows({ stats }: { stats: TeamProfileStat[] }) {
  // Reserve the rank column for every row as soon as any row has a rank,
  // so a rankless row (the derived per-play ones) keeps its value in the
  // same column as the rest instead of sliding right into the rank slot.
  // When nothing is ranked at all — an FCS team — the column is dropped
  // entirely rather than leaving dead space down the whole panel.
  const showRankColumn = stats.some((stat) => stat.rank)
  let lastSection: TeamProfileSection | undefined
  return (
    <>
      {stats.map((stat) => {
        const showHeader = stat.section !== lastSection
        lastSection = stat.section
        return (
          <div key={stat.label}>
            {showHeader && <div className="team-page__section-label">{SECTION_LABEL[stat.section]}</div>}
            <div className="team-page__stat-row">
              <span className="team-page__stat-label">{stat.label}</span>
              <span className="team-page__stat-value ticker">{stat.value}</span>
              {/* Rank only when ESPN actually sends one — a missing rank
                  shows nothing rather than a placeholder that reads as data.
                  The cell itself still holds its place so the values line up. */}
              {showRankColumn && <span className="team-page__stat-rank ticker">{stat.rank ?? ''}</span>}
            </div>
          </div>
        )
      })}
    </>
  )
}

/** One row of the team's schedule, rendered from the sanitized view. A
 * schedule is a list of finals, which is the most direct way a spoiler
 * could leak into a new surface — so a protected team's past results stay
 * hidden here exactly as they are on Slate and Scoreboard. */
function ScheduleRow({ game, teamId, zoneId, onSelect }: { game: Game; teamId: string; zoneId: string; onSelect?: () => void }) {
  const isHome = game.home.id === teamId
  const opponent = isHome ? game.away : game.home
  const teamScore = isHome ? game.homeScore : game.awayScore
  const oppScore = isHome ? game.awayScore : game.homeScore

  const decided = game.state === 'post' && teamScore !== undefined && oppScore !== undefined
  const result = decided ? (teamScore > oppScore ? 'W' : teamScore < oppScore ? 'L' : 'T') : undefined

  return (
    <button type="button" className="team-page__game" onClick={onSelect} disabled={!onSelect}>
      <span className="team-page__game-date ticker">{formatDayChip(game.startDate, zoneId)}</span>
      <span className="team-page__game-side">{isHome ? 'vs' : '@'}</span>
      <TeamLogo team={opponent} size={22} rank={opponent.rank} />
      <span className="team-page__game-opponent">{opponent.shortName}</span>
      <span className={`team-page__game-outcome ticker${result ? ` team-page__game-outcome--${result.toLowerCase()}` : ''}`}>
        {result ? (
          <>
            <span className="team-page__result">{result}</span> {teamScore}–{oppScore}
          </>
        ) : game.state === 'in' ? (
          'LIVE'
        ) : (
          formatKickoffTime(game.startDate, zoneId)
        )}
      </span>
    </button>
  )
}

interface TeamPageProps {
  team: Team
  /** Season the page shows — taken from the game it was opened from, so an
   * in-progress season isn't silently swapped for a completed one (this
   * endpoint does that when the year isn't forced). */
  year: number
  onBack: () => void
  onSelectGame?: (gameId: string) => void
}

export function TeamPage({ team, year, onBack, onSelectGame }: TeamPageProps) {
  const { settings } = useSettings()
  const { stats, schedule, statsLoading, scheduleLoading, statsError, scheduleError, rankSource, ranksApply } = useTeamPage(team.id, year)
  // Defensive ranks come from the site payload and always resolve, so "any
  // rank at all" would never flag an empty offense column. The core source
  // is what fills the non-defensive rows, so that's what this reports on.
  const coreBackedRows = stats.filter((s) => s.section !== 'defense')
  // Withheld on purpose for an FCS team, so nothing to report there.
  const missingCoreRanks = ranksApply && coreBackedRows.length > 0 && !coreBackedRows.some((s) => s.rank)
  const safeSchedule = useSpoilerSafeGames(schedule)

  return (
    <div className="team-page">
      <div className="team-page__bar">
        <button type="button" className="team-page__back" onClick={onBack}>
          ‹ Back
        </button>
      </div>

      <div className="team-page__header">
        <TeamLogo team={team} size={56} rank={team.rank} />
        <div className="team-page__identity">
          <h2 className="team-page__name">{team.name}</h2>
          {team.record && <span className="team-page__record ticker">{team.record}</span>}
        </div>
      </div>

      <section className="team-page__section">
        <h3 className="team-page__title">{year} Schedule</h3>
        {scheduleLoading && <LoadingState label="Loading schedule…" />}
        {!scheduleLoading && safeSchedule.length === 0 && (
          <p className="team-page__hint">{scheduleError ? 'Couldn’t load the schedule.' : 'No schedule posted yet.'}</p>
        )}
        <div className="team-page__games">
          {safeSchedule.map(({ game }) => (
            <ScheduleRow
              key={game.id}
              game={game}
              teamId={team.id}
              zoneId={settings.timezoneId}
              onSelect={onSelectGame ? () => onSelectGame(game.id) : undefined}
            />
          ))}
        </div>
      </section>
      <SeasonPlayerStatsSection team={team} year={year} schedule={schedule} />

      <section className="team-page__section">
        <h3 className="team-page__title">{year} Season Stats</h3>
        {statsLoading && <LoadingState label="Loading season stats…" />}
        {!statsLoading && stats.length === 0 && (
          <p className="team-page__hint">{statsError ? 'Couldn’t load season stats.' : `No ${year} season stats posted yet.`}</p>
        )}
        {stats.length > 0 && <StatRows stats={stats} />}
        {/* Only when the rank column is entirely empty: say what the rank
            source actually returned instead of leaving it a mystery. */}
        {missingCoreRanks && <p className="team-page__hint">Rank source: {rankSource}</p>}
      </section>

    </div>
  )
}

/**
 * Every player's season line for this team, added up from its own games.
 *
 * ESPN publishes no per-team source for these, and the one endpoint with the
 * right shape cannot be narrowed to a team. But the numbers are already in
 * reach: every game summary carries both teams' per-player lines, the
 * schedule above says which games have been played, and those summaries are
 * cached under the same key the expanded game view uses. So this is one
 * request per game played, most of them already in hand — and each one
 * fetched here makes opening that game instant later.
 *
 * Still behind a button. A team deep into a season is a dozen requests, and
 * someone who opened this page for the schedule shouldn't pay for them.
 */
function SeasonPlayerStatsSection({ team, year, schedule }: { team: Team; year: number; schedule: Game[] }) {
  const [requested, setRequested] = useState(false)
  const { categories, isLoading, isError, gamesCounted, gamesAvailable } = useSeasonPlayerStats(
    team.id,
    team.abbreviation,
    schedule,
    requested,
  )

  return (
    <section className="team-page__section">
      <h3 className="team-page__title">{year} Player Stats</h3>
      {!requested && (
        <>
          <p className="team-page__hint">
            Added up from this team&rsquo;s box scores — one request per game played, and none for games already
            opened.
          </p>
          <button type="button" className="team-page__load" onClick={() => setRequested(true)} disabled={gamesAvailable === 0}>
            {gamesAvailable === 0 ? 'No games played yet' : `Load player stats (${gamesAvailable} game${gamesAvailable === 1 ? '' : 's'})`}
          </button>
        </>
      )}
      {isLoading && <LoadingState label="Reading this season&rsquo;s box scores…" />}
      {isError && <p className="team-page__hint">Couldn&rsquo;t load the box scores.</p>}
      {requested && !isLoading && !isError && categories.length === 0 && (
        <p className="team-page__hint">No {year} player stats posted for this team yet.</p>
      )}
      {categories.map((category) => (
        <PlayerCategory key={category.name} category={category} />
      ))}
      {categories.length > 0 && (
        <p className="team-page__hint">
          Totals from {gamesCounted} of {gamesAvailable} game{gamesAvailable === 1 ? '' : 's'}. Yards per game is
          worked out from those totals; percentages and ratings are left out, since they can&rsquo;t be recovered by
          adding up per-game figures.
        </p>
      )}
    </section>
  )
}
