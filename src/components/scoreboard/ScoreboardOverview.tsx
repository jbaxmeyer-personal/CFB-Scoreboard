import { Fragment, useEffect } from 'react'
import './ScoreboardOverview.css'
import { useSeasonScoreboard } from '../../hooks/useSeasonScoreboard'
import { useGamesByDay } from '../../hooks/useGamesByDay'
import { useSpoilerSafeGames } from '../../hooks/useSpoilerSafeGames'
import { useSettings } from '../../context/SettingsContext'
import { useViewState } from '../../context/ViewStateContext'
import { DayTabs } from '../shared/DayTabs'
import { GameCard } from './GameCard'
import { GameDetailPanel } from '../shared/GameDetailPanel'
import { WeekNav } from './WeekNav'
import { LoadingState, ErrorState, EmptyState } from '../shared/StatusStates'

export function ScoreboardOverview() {
  const { games, weekLabel, isLoading, isError, goToPrevWeek, goToNextWeek, refetch } = useSeasonScoreboard()
  const { settings } = useSettings()
  const { selectedDateKey, setSelectedDateKey, expandedGameId, setExpandedGameId, toggleExpandedGame } = useViewState()
  const days = useGamesByDay(games, settings.timezoneId)

  const activeDateKey = selectedDateKey && days.some((d) => d.dateKey === selectedDateKey) ? selectedDateKey : days[0]?.dateKey

  useEffect(() => {
    if (!selectedDateKey && days[0]) setSelectedDateKey(days[0].dateKey)
  }, [days, selectedDateKey, setSelectedDateKey])

  const activeDay = days.find((d) => d.dateKey === activeDateKey)
  const safeGames = useSpoilerSafeGames(activeDay?.games ?? [])

  return (
    <div className="scoreboard-overview">
      <div className="scoreboard-overview__header">
        <h1 className="scoreboard-overview__title">Scoreboard</h1>
      </div>

      {weekLabel && <WeekNav label={weekLabel} onPrev={goToPrevWeek} onNext={goToNextWeek} />}

      {isLoading && <LoadingState label="Loading the scoreboard…" />}
      {isError && <ErrorState onRetry={refetch} />}

      {!isLoading && !isError && days.length > 0 && (
        <DayTabs days={days} selectedDateKey={activeDateKey ?? ''} onSelect={setSelectedDateKey} zoneId={settings.timezoneId} />
      )}

      {!isLoading && !isError && days.length === 0 && <EmptyState />}

      {!isLoading && !isError && activeDay && (
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
