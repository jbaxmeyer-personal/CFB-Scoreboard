import { useEffect } from 'react'
import './ScheduleGrid.css'
import { useScoreboard } from '../../hooks/useScoreboard'
import { useGamesByDay } from '../../hooks/useGamesByDay'
import { useSpoilerSafeGames } from '../../hooks/useSpoilerSafeGames'
import { useSettings } from '../../context/SettingsContext'
import { useViewState } from '../../context/ViewStateContext'
import { DayTabs } from '../shared/DayTabs'
import { TimeGrid } from './TimeGrid'
import { GameDetailPanel } from '../shared/GameDetailPanel'
import { zoneLabel, zoneAbbrNow } from '../../lib/timezone'
import { LoadingState, ErrorState, EmptyState } from '../shared/StatusStates'
import { AppHeader } from '../shared/AppHeader'
import { useScrollToCollapsedGame } from '../../hooks/useScrollToCollapsedGame'
import { FilterBar } from '../shared/FilterBar'
import { useFilteredGames } from '../../hooks/useFilteredGames'

export function ScheduleGrid() {
  const { games: allGames, isLoading, isError, refetch } = useScoreboard()
  const { settings } = useSettings()
  const { selectedDateKey, setSelectedDateKey, expandedGameId, setExpandedGameId, toggleExpandedGame } = useViewState()
  // Filtered before grouping, so the day strip reflects the filter too: a
  // day with no Top 25 games shouldn't offer a tab that leads to nothing.
  const { games, filtersActive, filterSummary } = useFilteredGames(allGames)
  const days = useGamesByDay(games, settings.timezoneId)
  useScrollToCollapsedGame(expandedGameId)

  const activeDateKey = selectedDateKey && days.some((d) => d.dateKey === selectedDateKey) ? selectedDateKey : days[0]?.dateKey

  useEffect(() => {
    if (!selectedDateKey && days[0]) setSelectedDateKey(days[0].dateKey)
  }, [days, selectedDateKey, setSelectedDateKey])

  const activeDay = days.find((d) => d.dateKey === activeDateKey)
  const safeGames = useSpoilerSafeGames(activeDay?.games ?? [])

  return (
    <div className="schedule-grid">
      <AppHeader showDelayBadge>
        <p className="schedule-grid__zone">
          Times shown in {zoneLabel(settings.timezoneId)} ({zoneAbbrNow(settings.timezoneId)})
        </p>
      </AppHeader>

      {isLoading && <LoadingState label="Loading the slate…" />}
      {isError && <ErrorState onRetry={refetch} />}

      {!isLoading && !isError && <FilterBar />}

      {!isLoading && !isError && days.length > 0 && (
        <DayTabs days={days} selectedDateKey={activeDateKey ?? ''} onSelect={setSelectedDateKey} zoneId={settings.timezoneId} />
      )}

      {!isLoading && !isError && days.length === 0 && (
        <EmptyState message={filtersActive ? `No games match ${filterSummary}.` : undefined} />
      )}

      {!isLoading && !isError && activeDay && (
        <TimeGrid entries={safeGames} zoneId={settings.timezoneId} onSelectGame={toggleExpandedGame} />
      )}

      <GameDetailPanel
        entries={safeGames}
        expandedGameId={expandedGameId}
        onClose={() => setExpandedGameId(null)}
        zoneId={settings.timezoneId}
      />
    </div>
  )
}
