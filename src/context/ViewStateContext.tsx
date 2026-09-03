import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { WeekSelector } from '../types/game'

export type Tab = 'schedule' | 'scoreboard' | 'settings'

const TAB_STORAGE_KEY = 'slate.tab.v1'
const DATE_KEY_STORAGE_KEY = 'slate.selectedDate.v1'
const EXPANDED_GAME_STORAGE_KEY = 'slate.expandedGame.v1'
const SCOREBOARD_WEEK_STORAGE_KEY = 'slate.scoreboardWeek.v1'
const VALID_TABS: Tab[] = ['schedule', 'scoreboard', 'settings']

function readStoredTab(): Tab {
  try {
    const raw = localStorage.getItem(TAB_STORAGE_KEY)
    return VALID_TABS.includes(raw as Tab) ? (raw as Tab) : 'schedule'
  } catch {
    return 'schedule'
  }
}

function readStoredString(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function readStoredWeek(): WeekSelector | null {
  try {
    const raw = localStorage.getItem(SCOREBOARD_WEEK_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.year === 'number' && typeof parsed?.seasonType === 'number' && typeof parsed?.week === 'number') {
      return parsed as WeekSelector
    }
    return null
  } catch {
    return null
  }
}

/** Best-effort persistence — private browsing/quota errors are silently
 * ignored, same as the rest of the app's localStorage usage. */
function writeStoredValue(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // best-effort persistence only
  }
}

interface ViewStateValue {
  tab: Tab
  setTab: (tab: Tab) => void
  selectedDateKey: string | null
  setSelectedDateKey: (key: string) => void
  /** Shared between Slate and Scoreboard — both are views onto the same
   * data, so the same game shows expanded on either screen. */
  expandedGameId: string | null
  setExpandedGameId: (id: string | null) => void
  toggleExpandedGame: (gameId: string) => void
  /** Which season week Scoreboard is currently browsing — null until the
   * "current week" bootstrap fetch resolves it. Lives here (not local state
   * in the hook) so it survives Scoreboard unmounting when you switch tabs. */
  scoreboardWeek: WeekSelector | null
  setScoreboardWeek: (week: WeekSelector | null) => void
}

const ViewStateContext = createContext<ViewStateValue | null>(null)

export function ViewStateProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<Tab>(readStoredTab)
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(() => readStoredString(DATE_KEY_STORAGE_KEY))
  const [expandedGameId, setExpandedGameId] = useState<string | null>(() => readStoredString(EXPANDED_GAME_STORAGE_KEY))
  const [scoreboardWeek, setScoreboardWeek] = useState<WeekSelector | null>(readStoredWeek)

  useEffect(() => {
    writeStoredValue(TAB_STORAGE_KEY, tab)
  }, [tab])

  useEffect(() => {
    writeStoredValue(DATE_KEY_STORAGE_KEY, selectedDateKey)
  }, [selectedDateKey])

  useEffect(() => {
    writeStoredValue(EXPANDED_GAME_STORAGE_KEY, expandedGameId)
  }, [expandedGameId])

  useEffect(() => {
    writeStoredValue(SCOREBOARD_WEEK_STORAGE_KEY, scoreboardWeek ? JSON.stringify(scoreboardWeek) : null)
  }, [scoreboardWeek])

  const value = useMemo<ViewStateValue>(
    () => ({
      tab,
      setTab,
      selectedDateKey,
      setSelectedDateKey,
      expandedGameId,
      setExpandedGameId,
      toggleExpandedGame: (gameId) => setExpandedGameId((cur) => (cur === gameId ? null : gameId)),
      scoreboardWeek,
      setScoreboardWeek,
    }),
    [tab, selectedDateKey, expandedGameId, scoreboardWeek],
  )

  return <ViewStateContext.Provider value={value}>{children}</ViewStateContext.Provider>
}

export function useViewState(): ViewStateValue {
  const ctx = useContext(ViewStateContext)
  if (!ctx) throw new Error('useViewState must be used within ViewStateProvider')
  return ctx
}
