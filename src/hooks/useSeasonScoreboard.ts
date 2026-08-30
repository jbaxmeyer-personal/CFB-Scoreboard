import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCurrentWeek, fetchScoreboardWeek, normalizeScoreboard } from '../lib/espn'
import { useViewState } from '../context/ViewStateContext'
import type { Game, WeekSelector } from '../types/game'

export interface SeasonScoreboardResult {
  games: Game[]
  weekLabel: string
  isLoading: boolean
  isError: boolean
  goToPrevWeek: () => void
  goToNextWeek: () => void
  refetch: () => void
}

function formatWeekLabel({ seasonType, week }: WeekSelector): string {
  if (seasonType === 3) return week <= 1 ? 'Bowls' : `Postseason Week ${week}`
  if (week === 0) return 'Week 0'
  return `Week ${week}`
}

/**
 * Lets Scoreboard browse the whole season one ESPN week at a time, instead
 * of Slate's short rolling window of "known kickoff time" days. One request
 * per week (not per day) is what makes browsing the full season practical.
 */
export function useSeasonScoreboard(): SeasonScoreboardResult {
  const { scoreboardWeek, setScoreboardWeek } = useViewState()

  // Bootstrap once: learn the current year/seasonType/week so navigation has
  // a starting point. Only runs until scoreboardWeek is first set.
  const anchorQuery = useQuery({
    queryKey: ['scoreboard-current-week'],
    queryFn: () => fetchCurrentWeek(),
    enabled: scoreboardWeek === null,
    staleTime: 60 * 60_000, // "what week is it" barely changes within a session
  })

  useEffect(() => {
    if (scoreboardWeek !== null || !anchorQuery.data) return
    const year = anchorQuery.data.season?.year ?? new Date().getFullYear()
    const seasonType = anchorQuery.data.season?.type ?? 2
    const week = anchorQuery.data.week?.number ?? 1
    setScoreboardWeek({ year, seasonType, week })
  }, [scoreboardWeek, anchorQuery.data, setScoreboardWeek])

  const weekQuery = useQuery({
    queryKey: ['scoreboard-week', scoreboardWeek?.year, scoreboardWeek?.seasonType, scoreboardWeek?.week],
    queryFn: () => fetchScoreboardWeek(scoreboardWeek!),
    enabled: scoreboardWeek !== null,
    staleTime: 5 * 60_000,
    refetchInterval: 30_000,
  })

  const games = useMemo(() => (weekQuery.data ? normalizeScoreboard(weekQuery.data) : []), [weekQuery.data])

  return {
    games,
    weekLabel: scoreboardWeek ? formatWeekLabel(scoreboardWeek) : '',
    isLoading: scoreboardWeek === null ? anchorQuery.isLoading : weekQuery.isLoading,
    isError: scoreboardWeek === null ? anchorQuery.isError : weekQuery.isError,
    goToPrevWeek: () => setScoreboardWeek(scoreboardWeek && { ...scoreboardWeek, week: Math.max(0, scoreboardWeek.week - 1) }),
    goToNextWeek: () => setScoreboardWeek(scoreboardWeek && { ...scoreboardWeek, week: scoreboardWeek.week + 1 }),
    refetch: () => weekQuery.refetch(),
  }
}
