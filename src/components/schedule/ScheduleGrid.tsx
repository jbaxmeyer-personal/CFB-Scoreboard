import { useEffect } from 'react'
import './ScheduleGrid.css'
import { useScoreboard } from '../../hooks/useScoreboard'
import { useGamesByDay } from '../../hooks/useGamesByDay'
import { useSpoilerSafeGames } from '../../hooks/useSpoilerSafeGames'
import { useSettings } from '../../context/SettingsContext'
import { useViewState } from '../../context/ViewStateContext'
import { DayTabs } from '../shared/DayTabs'
import { TimeGrid } from './TimeGrid'
import { zoneLabel, zoneAbbrNow } from '../../lib/timezone'
import { LoadingState, ErrorState, EmptyState } from '../shared/StatusStates'

export function ScheduleGrid() {
  const { games, isLoading, isError, refetch } = useScoreboard()
  const { settings } = useSettings()
  const { selectedDateKey, setSelectedDateKey, jumpToGame } = useViewState()
  const days = useGamesByDay(games, settings.timezoneId)

  const activeDateKey = selectedDateKey && days.some((d) => d.dateKey === selectedDateKey) ? selectedDateKey : days[0]?.dateKey

  useEffect(() => {
    if (!selectedDateKey && days[0]) setSelectedDateKey(days[0].dateKey)
  }, [days, selectedDateKey, setSelectedDateKey])

  const activeDay = days.find((d) => d.dateKey === activeDateKey)
  const safeGames = useSpoilerSafeGames(activeDay?.games ?? [])

  return (
    <div className="schedule-grid">
      <div className="schedule-grid__header">
        <h1 className="schedule-grid__title">Slate</h1>
        <p className="schedule-grid__zone">
          Times shown in {zoneLabel(settings.timezoneId)} ({zoneAbbrNow(settings.timezoneId)})
        </p>
      </div>

      {isLoading && <LoadingState label="Loading the slate…" />}
      {isError && <ErrorState onRetry={refetch} />}

      {!isLoading && !isError && days.length > 0 && (
        <DayTabs days={days} selectedDateKey={activeDateKey ?? ''} onSelect={setSelectedDateKey} zoneId={settings.timezoneId} />
      )}

      {!isLoading && !isError && days.length === 0 && <EmptyState />}

      {!isLoading && !isError && activeDay && (
        <TimeGrid
          entries={safeGames}
          zoneId={settings.timezoneId}
          onSelectGame={(gameId) => jumpToGame(activeDay.dateKey, gameId)}
        />
      )}
    </div>
  )
}
