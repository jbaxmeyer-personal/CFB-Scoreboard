import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type Tab = 'schedule' | 'scoreboard' | 'settings'

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
}

const ViewStateContext = createContext<ViewStateValue | null>(null)

export function ViewStateProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<Tab>('schedule')
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null)
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null)

  const value = useMemo<ViewStateValue>(
    () => ({
      tab,
      setTab,
      selectedDateKey,
      setSelectedDateKey,
      expandedGameId,
      setExpandedGameId,
      toggleExpandedGame: (gameId) => setExpandedGameId((cur) => (cur === gameId ? null : gameId)),
    }),
    [tab, selectedDateKey, expandedGameId],
  )

  return <ViewStateContext.Provider value={value}>{children}</ViewStateContext.Provider>
}

export function useViewState(): ViewStateValue {
  const ctx = useContext(ViewStateContext)
  if (!ctx) throw new Error('useViewState must be used within ViewStateProvider')
  return ctx
}
