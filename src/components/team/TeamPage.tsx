import './TeamPage.css'
import type { Game, Team, TeamProfileSection } from '../../types/game'
import type { TeamProfileStat } from '../../lib/espn'
import { TeamLogo } from '../shared/TeamLogo'
import { useTeamPage } from '../../hooks/useTeamPage'
import { useSpoilerSafeGames } from '../../hooks/useSpoilerSafeGames'
import { useSettings } from '../../context/SettingsContext'
import { formatDayChip, formatKickoffTime } from '../../lib/timezone'
import { LoadingState } from '../shared/StatusStates'

const SECTION_LABEL: Record<TeamProfileSection, string> = {
  offense: 'Offense',
  defense: 'Defense',
  turnovers: 'Turnovers',
}

function StatRows({ stats }: { stats: TeamProfileStat[] }) {
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
                  shows nothing rather than a placeholder that reads as data. */}
              {stat.rank && <span className="team-page__stat-rank ticker">{stat.rank}</span>}
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
