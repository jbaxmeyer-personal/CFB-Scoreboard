import { Fragment, useMemo, useState } from 'react'
import './ScoreboardOverview.css'
import './ScoreboardWeeks.css'
import { useScoreboardDays } from '../../hooks/useScoreboardDays'
import { useGamesByDay } from '../../hooks/useGamesByDay'
import { useSpoilerSafeGames, type SafeGameEntry } from '../../hooks/useSpoilerSafeGames'
import { useSettings } from '../../context/SettingsContext'
import { useViewState } from '../../context/ViewStateContext'
import { GameCard } from './GameCard'
import { GameDetailPanel } from '../shared/GameDetailPanel'
import { LoadingState, ErrorState, EmptyState } from '../shared/StatusStates'
import { AppHeader } from '../shared/AppHeader'
import { FilterBar } from '../shared/FilterBar'
import { useFilteredGames } from '../../hooks/useFilteredGames'
import { useScrollToCollapsedGame } from '../../hooks/useScrollToCollapsedGame'
import { weekDateKeys, weekForDate } from '../../lib/seasonCalendar'
import { formatDayHeading } from '../../lib/timezone'
import { DateTime } from 'luxon'
import { resolveZone } from '../../lib/timezone'

/**
 * Scoreboard, navigated by week.
 *
 * College football is organised in weeks and talked about in weeks, and
 * ESPN's calendar says so: the one thing it reliably carries is fifteen
 * regular-season weeks with their spans. A week is a known, bounded range,
 * so its days are simply enumerated and fetched — there is no window to
 * grow, no scroll position to anchor, and no edge to detect.
 *
 * Inside a week the days are sections rather than another row of pills: a
 * week has three or four days with games in it, and showing them stacked
 * means the whole week is one scroll instead of three taps.
 */
export function ScoreboardWeeks() {
  const { settings, isFavoriteTeam } = useSettings()
  const { expandedGameId, setExpandedGameId, toggleExpandedGame } = useViewState()
  const [chosenWeekStart, setChosenWeekStart] = useState<string | null>(null)
  useScrollToCollapsedGame(expandedGameId)

  const todayKey = useMemo(
    () => DateTime.now().setZone(resolveZone(settings.timezoneId)).toFormat('yyyy-MM-dd'),
    [settings.timezoneId],
  )

  // The calendar arrives on any day's payload, so the first pass fetches the
  // default window purely to learn the weeks; every pass after that fetches
  // exactly one week. The overlap is served from cache.
  const [weeks, setWeeks] = useState<ReturnType<typeof weekForDate>[]>([])
  const activeWeek = useMemo(() => {
    const list = weeks.filter(Boolean) as NonNullable<ReturnType<typeof weekForDate>>[]
    if (list.length === 0) return undefined
    return list.find((w) => w.start === chosenWeekStart) ?? weekForDate(list, todayKey) ?? list[0]
  }, [weeks, chosenWeekStart, todayKey])

  const explicitDays = activeWeek ? weekDateKeys(activeWeek) : undefined
  const { games: allGames, season, isLoading, isError, refetch } = useScoreboardDays(
    null,
    settings.timezoneId,
    0,
    0,
    explicitDays,
  )

  // Learned once, from whichever response came back first.
  if (season.weeks.length > 0 && weeks.length !== season.weeks.length) setWeeks(season.weeks)

  const { games, filtersActive, filterSummary } = useFilteredGames(allGames)
  const grouped = useGamesByDay(games, settings.timezoneId)

  // Only the days of this week, and only those with games — a week with no
  // Wednesday game shouldn't carry an empty Wednesday heading.
  const daysInWeek = useMemo(() => {
    if (!activeWeek) return []
    return grouped.filter((d) => d.dateKey >= activeWeek.start && d.dateKey <= activeWeek.end && d.games.length > 0)
  }, [grouped, activeWeek])

  const everyGame = useMemo(() => daysInWeek.flatMap((d) => d.games), [daysInWeek])
  const safeGames = useSpoilerSafeGames(everyGame)

  const byDay = useMemo(() => {
    const lookup = new Map(safeGames.map((e) => [e.game.id, e]))
    const isFavoriteGame = (entry: SafeGameEntry) =>
      isFavoriteTeam(entry.game.home.id) || isFavoriteTeam(entry.game.away.id)
    return daysInWeek.map((day) => ({
      dateKey: day.dateKey,
      // Favourites first within the day, kickoff order within each group —
      // the same rule the day view uses, applied per section.
      entries: day.games
        .flatMap((g) => lookup.get(g.id) ?? [])
        .sort((a, b) => Number(isFavoriteGame(b)) - Number(isFavoriteGame(a))),
    }))
    // isFavoriteTeam closes over the settings, so the list is what to watch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysInWeek, safeGames, settings.favoriteTeamIds])

  const nothingThisWeek = !isLoading && !isError && byDay.every((d) => d.entries.length === 0)

  return (
    <div className="scoreboard-overview">
      <AppHeader section="Scoreboard" showDelayBadge />

      {isLoading && <LoadingState label="Loading the scoreboard…" />}
      {isError && <ErrorState onRetry={refetch} />}

      {!isLoading && !isError && <FilterBar />}

      {!isLoading && !isError && weeks.length > 0 && (
        <div className="week-tabs scrollbar-hide" role="tablist" aria-label="Select week">
          {(weeks.filter(Boolean) as NonNullable<ReturnType<typeof weekForDate>>[]).map((week) => (
            <button
              key={week.start}
              role="tab"
              aria-selected={week.start === activeWeek?.start}
              className={`week-tabs__tab${week.start === activeWeek?.start ? ' week-tabs__tab--active' : ''}`}
              onClick={() => setChosenWeekStart(week.start)}
            >
              {week.label}
            </button>
          ))}
        </div>
      )}

      {nothingThisWeek && <EmptyState message={filtersActive ? `No games match ${filterSummary}.` : undefined} />}

      {!isLoading && !isError &&
        byDay.map(({ dateKey, entries }) => {
          if (entries.length === 0) return null
          const [weekday, date] = formatDayHeading(dateKey)
          return (
            <section key={dateKey} className="scoreboard-week__day">
              <h2 className="scoreboard-week__heading">
                <span className="scoreboard-week__weekday">{weekday}</span>
                <span className="scoreboard-week__date">{date}</span>
              </h2>
              <div className="scoreboard-overview__grid">
                {chunkIntoRows(entries, 2).map((row) => (
                  <Fragment key={row[0].game.id}>
                    {row.map(({ game, isProtected }) => (
                      <GameCard
                        key={game.id}
                        game={game}
                        isProtected={isProtected}
                        isSelected={expandedGameId === game.id}
                        onToggle={() => toggleExpandedGame(game.id)}
                        zoneId={settings.timezoneId}
                      />
                    ))}
                    {row.some(({ game }) => game.id === expandedGameId) && (
                      <GameDetailPanel
                        entries={safeGames}
                        expandedGameId={expandedGameId}
                        onClose={() => setExpandedGameId(null)}
                        zoneId={settings.timezoneId}
                        flush
                      />
                    )}
                  </Fragment>
                ))}
              </div>
            </section>
          )
        })}
    </div>
  )
}

function chunkIntoRows<T>(items: T[], perRow: number): T[][] {
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += perRow) rows.push(items.slice(i, i + perRow))
  return rows
}
