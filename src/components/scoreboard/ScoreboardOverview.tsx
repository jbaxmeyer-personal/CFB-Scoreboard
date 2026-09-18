import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import './ScoreboardOverview.css'
import { DAYS_BEFORE, useScoreboardDays } from '../../hooks/useScoreboardDays'
import { useGamesByDay } from '../../hooks/useGamesByDay'
import { useSpoilerSafeGames, type SafeGameEntry } from '../../hooks/useSpoilerSafeGames'
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

/** Days added to each end of the window when the strip reaches it. A week
 * at a time: enough that scrolling doesn't stall on every other chip, small
 * enough that reaching an edge isn't a burst of requests for days nobody
 * asked to see. */
const GROW_BY_DAYS = 7

export function ScoreboardOverview() {
  const { settings, isFavoriteTeam } = useSettings()
  const { selectedDateKey, setSelectedDateKey, expandedGameId, setExpandedGameId, toggleExpandedGame, scoreboardAnchorDate, setScoreboardAnchorDate } =
    useViewState()
  // How far the strip has been grown past its default window, in days at
  // each end. ESPN's season calendar only describes weeks as spans — it
  // never says which days inside one have games — so the days on the strip
  // have to come from the games themselves, which means fetching them.
  // Growing on demand keeps that to the part of the season you actually
  // scroll to.
  const [grown, setGrown] = useState({ before: 0, after: 0 })
  const { games: allGames, dateKeys, season, isLoading, isError, refetch } = useScoreboardDays(
    scoreboardAnchorDate,
    settings.timezoneId,
    grown.before,
    grown.after,
  )

  // Jumping to a date re-centres the window, so the growth that belonged to
  // the old centre goes with it.
  useEffect(() => {
    setGrown({ before: 0, after: 0 })
  }, [scoreboardAnchorDate])

  // Stop at the season's own edges, which the calendar does give us even
  // though the individual days aren't there. Without this, scrolling to the
  // end would keep fetching into an off-season that answers with nothing.
  const reachedSeasonStart = season.start !== undefined && dateKeys[0] !== undefined && dateKeys[0] <= season.start
  const reachedSeasonEnd =
    season.end !== undefined && dateKeys[dateKeys.length - 1] !== undefined && dateKeys[dateKeys.length - 1] >= season.end

  const growBefore = useCallback(() => {
    if (!reachedSeasonStart) setGrown((g) => ({ ...g, before: g.before + GROW_BY_DAYS }))
  }, [reachedSeasonStart])
  const growAfter = useCallback(() => {
    if (!reachedSeasonEnd) setGrown((g) => ({ ...g, after: g.after + GROW_BY_DAYS }))
  }, [reachedSeasonEnd])
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
    // Trimmed to the season. Growing stops once the window's far edge
    // reaches a bound, but the block that reached it overshoots by up to a
    // week, and a day outside the season has no business on the strip
    // whatever came back for it.
    return [...keys]
      .filter((key) => (!season.start || key >= season.start) && (!season.end || key <= season.end))
      .sort()
  }, [days, season.dates, season.start, season.end])

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

  // Jumping to a date re-centres the window on it, so you can keep browsing
  // outward from wherever you landed.
  const jumpToDate = (dateKey: string) => {
    setScoreboardAnchorDate(dateKey)
    setSelectedDateKey(dateKey)
  }

  // Tapping a day already in the window just selects it. Re-anchoring there
  // would rebuild the window around it and throw away everything the strip
  // had been grown to hold — scroll out three weeks, tap a Saturday, and the
  // strip you just scrolled would collapse back to its opening ten days.
  // A day the strip offers but the window hasn't reached still re-anchors,
  // because that is what goes and fetches it.
  const selectDate = (dateKey: string) => {
    if (dateKeys.includes(dateKey)) setSelectedDateKey(dateKey)
    else jumpToDate(dateKey)
  }

  const activeDay = days.find((d) => d.dateKey === activeDateKey)
  // Selected, offered by the season calendar, and not fetched yet: that's a
  // day still on its way, not a day with no games.
  const awaitingDay = activeDateKey !== undefined && activeDay === undefined && stripDateKeys.includes(activeDateKey)
  const safeGames = useSpoilerSafeGames(activeDay?.games ?? [])

  // Games with a team you follow come first. Sort is stable, so within the
  // favourites and within the rest the day still runs in kickoff order —
  // this lifts your games to the top without scrambling the day around them.
  //
  // Scoreboard only. Slate is a time grid, where a game's position *is* its
  // kickoff; reordering there would be moving games to the wrong time.
  const orderedGames = useMemo(() => {
    const isFavoriteGame = (entry: SafeGameEntry) =>
      isFavoriteTeam(entry.game.home.id) || isFavoriteTeam(entry.game.away.id)
    return [...safeGames].sort((a, b) => Number(isFavoriteGame(b)) - Number(isFavoriteGame(a)))
    // isFavoriteTeam closes over the settings, so the list is what to watch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeGames, settings.favoriteTeamIds])

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
          onSelect={selectDate}
          onPickDate={jumpToDate}
          minDateKey={season.start}
          maxDateKey={season.end}
          onReachStart={growBefore}
          onReachEnd={growAfter}
        />
      )}

      {!isLoading && !isError && awaitingDay && <LoadingState label="Loading that day…" />}

      {!isLoading && !isError && !awaitingDay && (activeDay?.games.length ?? 0) === 0 && (
        <EmptyState message={filtersActive ? `No games match ${filterSummary}.` : undefined} />
      )}

      {!isLoading && !isError && activeDay && activeDay.games.length > 0 && (
        <div className="scoreboard-overview__grid">
          {chunkIntoRows(orderedGames, 2).map((row) => (
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
