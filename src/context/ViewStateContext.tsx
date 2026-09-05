import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Tab = 'schedule' | 'scoreboard' | 'settings'

const TAB_STORAGE_KEY = 'slate.tab.v1'
const DATE_KEY_STORAGE_KEY = 'slate.selectedDate.v1'
const EXPANDED_GAME_STORAGE_KEY = 'slate.expandedGame.v1'
const SCOREBOARD_ANCHOR_STORAGE_KEY = 'slate.scoreboardAnchor.v1'
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
  /** The day Scoreboard's ten-day window is centred on (yyyy-MM-dd), or
   * null for "anchored on today". Set by the date picker when you jump to a
   * specific date. Lives here (not local state in the hook) so it survives
   * Scoreboard unmounting when you switch tabs. */
  scoreboardAnchorDate: string | null
  setScoreboardAnchorDate: (dateKey: string | null) => void
  /** Team whose page the expanded game is currently showing, or null for
   * the game itself.
   *
   * Deliberately NOT persisted, unlike the tab, day and expanded game. If a
   * team page ever fails to render, persisting it means every reload
   * restores the screen that just broke — a blank page that reloading
   * can't escape. Refresh returns to the expanded game instead, which is
   * one tap away and can't trap anyone. */
  teamPageId: string | null
  setTeamPageId: (teamId: string | null) => void
}

const ViewStateContext = createContext<ViewStateValue | null>(null)

export function ViewStateProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<Tab>(readStoredTab)
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(() => readStoredString(DATE_KEY_STORAGE_KEY))
  const [expandedGameId, setExpandedGameId] = useState<string | null>(() => readStoredString(EXPANDED_GAME_STORAGE_KEY))
  const [scoreboardAnchorDate, setScoreboardAnchorDate] = useState<string | null>(() => readStoredString(SCOREBOARD_ANCHOR_STORAGE_KEY))
  const [teamPageId, setTeamPageId] = useState<string | null>(null)

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
    writeStoredValue(SCOREBOARD_ANCHOR_STORAGE_KEY, scoreboardAnchorDate)
  }, [scoreboardAnchorDate])


  const value = useMemo<ViewStateValue>(
    () => ({
      tab,
      setTab,
      selectedDateKey,
      setSelectedDateKey,
      expandedGameId,
      setExpandedGameId,
      toggleExpandedGame: (gameId) => {
        // Switching or closing a game leaves whatever team page it was
        // showing — otherwise the next game you open opens on a team.
        setTeamPageId(null)
        setExpandedGameId((cur) => (cur === gameId ? null : gameId))
      },
      scoreboardAnchorDate,
      setScoreboardAnchorDate,
      teamPageId,
      setTeamPageId,
    }),
    [tab, selectedDateKey, expandedGameId, scoreboardAnchorDate, teamPageId],
  )

  return <ViewStateContext.Provider value={value}>{children}</ViewStateContext.Provider>
}

export function useViewState(): ViewStateValue {
  const ctx = useContext(ViewStateContext)
  if (!ctx) throw new Error('useViewState must be used within ViewStateProvider')
  return ctx
}
