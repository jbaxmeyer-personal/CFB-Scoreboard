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

export function ScoreboardOverview() {
  const { settings } = useSettings()
  const { selectedDateKey, setSelectedDateKey, expandedGameId, setExpandedGameId, toggleExpandedGame, scoreboardAnchorDate, setScoreboardAnchorDate } =
    useViewState()
  const { games, dateKeys, isLoading, isError, refetch } = useScoreboardDays(scoreboardAnchorDate, settings.timezoneId)
  const grouped = useGamesByDay(games, settings.timezoneId)

  // Every day in the window gets a tab, whether or not it has games, so the
  // strip is a stable ten-day ruler instead of reflowing as midweek thins
  // out. Days outside the window (a late kickoff filed under the next day)
  // are dropped rather than appended, which would push the ruler around.
  const days = useMemo(() => {
    const byKey = new Map(grouped.map((d) => [d.dateKey, d]))
    return dateKeys.map((dateKey) => byKey.get(dateKey) ?? { dateKey, games: [] })
  }, [grouped, dateKeys])

  const activeDateKey = selectedDateKey && days.some((d) => d.dateKey === selectedDateKey) ? selectedDateKey : dateKeys[DAYS_BEFORE]

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
  const safeGames = useSpoilerSafeGames(activeDay?.games ?? [])

  return (
    <div className="scoreboard-overview">
      <div className="scoreboard-overview__header">
        <h1 className="scoreboard-overview__title">Scoreboard</h1>
      </div>

      {isLoading && <LoadingState label="Loading the scoreboard…" />}
      {isError && <ErrorState onRetry={refetch} />}

      {!isLoading && !isError && (
        <DayTabs
          days={days}
          selectedDateKey={activeDateKey ?? ''}
          onSelect={setSelectedDateKey}
          zoneId={settings.timezoneId}
          onPickDate={pickDate}
        />
      )}

      {!isLoading && !isError && (activeDay?.games.length ?? 0) === 0 && <EmptyState />}

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
