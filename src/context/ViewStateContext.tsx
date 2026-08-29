import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type Tab = 'schedule' | 'scoreboard' | 'settings'

interface ViewStateValue {
  tab: Tab
  setTab: (tab: Tab) => void
  selectedDateKey: string | null
  setSelectedDateKey: (key: string) => void
  /** Set when the user taps a game in the Schedule Grid; the Scoreboard
   * Overview reads and clears it to auto-expand + scroll to that card. */
  highlightedGameId: string | null
  jumpToGame: (dateKey: string, gameId: string) => void
  clearHighlight: () => void
}

const ViewStateContext = createContext<ViewStateValue | null>(null)

export function ViewStateProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<Tab>('schedule')
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null)
  const [highlightedGameId, setHighlightedGameId] = useState<string | null>(null)

  const value = useMemo<ViewStateValue>(
    () => ({
      tab,
      setTab,
      selectedDateKey,
      setSelectedDateKey,
      highlightedGameId,
      jumpToGame: (dateKey, gameId) => {
        setSelectedDateKey(dateKey)
        setHighlightedGameId(gameId)
        setTab('scoreboard')
      },
      clearHighlight: () => setHighlightedGameId(null),
    }),
    [tab, selectedDateKey, highlightedGameId],
  )

  return <ViewStateContext.Provider value={value}>{children}</ViewStateContext.Provider>
}

export function useViewState(): ViewStateValue {
  const ctx = useContext(ViewStateContext)
  if (!ctx) throw new Error('useViewState must be used within ViewStateProvider')
  return ctx
}
