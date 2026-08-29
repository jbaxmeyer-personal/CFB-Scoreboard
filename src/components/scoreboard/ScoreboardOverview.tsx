import { useEffect } from 'react'
import './ScoreboardOverview.css'
import { useScoreboard } from '../../hooks/useScoreboard'
import { useGamesByDay } from '../../hooks/useGamesByDay'
import { useSpoilerSafeGames } from '../../hooks/useSpoilerSafeGames'
import { useSettings } from '../../context/SettingsContext'
import { useViewState } from '../../context/ViewStateContext'
import { DayTabs } from '../shared/DayTabs'
import { GameCard } from './GameCard'
import { GameDetailPanel } from '../shared/GameDetailPanel'
import { LoadingState, ErrorState, EmptyState } from '../shared/StatusStates'

export function ScoreboardOverview() {
  const { games, isLoading, isError, refetch } = useScoreboard()
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

      {isLoading && <LoadingState label="Loading the scoreboard…" />}
      {isError && <ErrorState onRetry={refetch} />}

      {!isLoading && !isError && days.length > 0 && (
        <DayTabs days={days} selectedDateKey={activeDateKey ?? ''} onSelect={setSelectedDateKey} zoneId={settings.timezoneId} />
      )}

      {!isLoading && !isError && days.length === 0 && <EmptyState />}

      {!isLoading && !isError && activeDay && (
        <div className="scoreboard-overview__grid">
          {safeGames.map(({ game, isProtected }) => (
            <GameCard
              key={game.id}
              game={game}
              isProtected={isProtected}
              isSelected={expandedGameId === game.id}
              onToggle={() => toggleExpandedGame(game.id)}
              zoneId={settings.timezoneId}
            />
          ))}
        </div>
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
