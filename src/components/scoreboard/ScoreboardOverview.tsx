import { Fragment, useEffect, useMemo } from 'react'
import './ScoreboardOverview.css'
import { DAYS_BEFORE, useScoreboardDays } from '../../hooks/useScoreboardDays'
import { useGamesByDay } from '../../hooks/useGamesByDay'
import { useSpoilerSafeGames } from '../../hooks/useSpoilerSafeGames'
import { useSettings } from '../../context/SettingsContext'
import { useViewState } from '../../context/ViewStateContext'
import { DayTabs } from '../shared/DayTabs'
import { GameCard } from './GameCard'
import { GameDetailPanel } from '../shared/GameDetailPanel'
import { LoadingState, ErrorState, EmptyState } from '../shared/StatusStates'
import { AppHeader } from '../shared/AppHeader'
import { FilterBar } from '../shared/FilterBar'
import { useFilteredGames } from '../../hooks/useFilteredGames'
import { useScrollToCollapsedGame } from '../../hooks/useScrollToCollapsedGame'

export function ScoreboardOverview() {
  const { settings } = useSettings()
  const { selectedDateKey, setSelectedDateKey, expandedGameId, setExpandedGameId, toggleExpandedGame, scoreboardAnchorDate, setScoreboardAnchorDate } =
    useViewState()
  const { games: allGames, dateKeys, season, isLoading, isError, refetch } = useScoreboardDays(scoreboardAnchorDate, settings.timezoneId)
  // Filtered before grouping, so the day strip reflects the filter too: a
  // day with no Top 25 games shouldn't offer a tab that leads to nothing.
  const { games, filtersActive, filterSummary } = useFilteredGames(allGames)
  const grouped = useGamesByDay(games, settings.timezoneId)
  useScrollToCollapsedGame(expandedGameId)

  // Only days that actually have games get a tab. The window is still ten
  // days wide — that's what gets fetched — but the strip used to be a fixed
  // ruler including the empty ones, and in college football most of the
  // week is empty: a midweek tab was a tab that led to a blank screen.
  // Days outside the window (a late kickoff filed under the next day) are
  // still dropped rather than appended, which would extend the strip past
  // what was fetched.
  const days = useMemo(() => {
    const byKey = new Map(grouped.map((d) => [d.dateKey, d]))
    return dateKeys.flatMap((dateKey) => byKey.get(dateKey) ?? [])
  }, [grouped, dateKeys])

  // The strip offers the whole season when the payload said which days have
  // games, rather than only the ten days this screen fetched: a date it
  // hasn't fetched is still worth a tab, because selecting one re-anchors
  // the window and goes and gets it. Days in the window that have games are
  // unioned in, so a day the season calendar didn't mention — a midweek
  // game added late — doesn't disappear from a strip built off it.
  //
  // With no season calendar this is exactly the fetched window, which is
  // what the screen showed before.
  const stripDateKeys = useMemo(() => {
    const keys = new Set(days.map((d) => d.dateKey))
    for (const date of season.dates) keys.add(date)
    return [...keys].sort()
  }, [days, season.dates])

  // The anchor day when it has games, otherwise the nearest day that does,
  // looking forward first: landing on an empty Tuesday should show you
  // Thursday's games rather than last Saturday's. `days` is in window
  // order, so the first key past the anchor is the nearest one ahead and
  // the last entry is the most recent one behind.
  const defaultDateKey = useMemo(() => {
    const anchorKey = dateKeys[DAYS_BEFORE]
    if (days.some((d) => d.dateKey === anchorKey)) return anchorKey
    return (days.find((d) => d.dateKey > anchorKey) ?? days[days.length - 1])?.dateKey
  }, [days, dateKeys])

  // A day the strip offers but the window hasn't reached yet still counts as
  // the selection — picking it re-anchors the window, and the selection
  // shouldn't visibly bounce back to another tab while that lands.
  const activeDateKey = selectedDateKey && stripDateKeys.includes(selectedDateKey) ? selectedDateKey : defaultDateKey

  useEffect(() => {
    if (!selectedDateKey && activeDateKey) setSelectedDateKey(activeDateKey)
  }, [activeDateKey, selectedDateKey, setSelectedDateKey])

  // Picking a date re-centres the window on it, so you can keep browsing
  // outward from wherever you landed.
  const pickDate = (dateKey: string) => {
    setScoreboardAnchorDate(dateKey)
    setSelectedDateKey(dateKey)
  }

  const activeDay = days.find((d) => d.dateKey === activeDateKey)
  // Selected, offered by the season calendar, and not fetched yet: that's a
  // day still on its way, not a day with no games.
  const awaitingDay = activeDateKey !== undefined && activeDay === undefined && stripDateKeys.includes(activeDateKey)
  const safeGames = useSpoilerSafeGames(activeDay?.games ?? [])

  return (
    <div className="scoreboard-overview">
      <AppHeader section="Scoreboard" showDelayBadge />

      {isLoading && <LoadingState label="Loading the scoreboard…" />}
      {isError && <ErrorState onRetry={refetch} />}

      {!isLoading && !isError && <FilterBar />}

      {!isLoading && !isError && (
        <DayTabs
          dateKeys={stripDateKeys}
          selectedDateKey={activeDateKey ?? ''}
          onSelect={pickDate}
          onPickDate={pickDate}
          minDateKey={season.start}
          maxDateKey={season.end}
        />
      )}

      {!isLoading && !isError && awaitingDay && <LoadingState label="Loading that day…" />}

      {!isLoading && !isError && !awaitingDay && (activeDay?.games.length ?? 0) === 0 && (
        <EmptyState message={filtersActive ? `No games match ${filterSummary}.` : undefined} />
      )}

      {!isLoading && !isError && activeDay && activeDay.games.length > 0 && (
        <div className="scoreboard-overview__grid">
          {chunkIntoRows(safeGames, 2).map((row) => (
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
      )}
    </div>
  )
}

/** Groups the (already row-major, 2-column) card list into its visual rows,
 * so the expanded detail panel can be inserted right after the row holding
 * the selected card instead of dumped after every card in the grid. */
function chunkIntoRows<T>(items: T[], perRow: number): T[][] {
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += perRow) rows.push(items.slice(i, i + perRow))
  return rows
}
