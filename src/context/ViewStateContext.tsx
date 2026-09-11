import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { NO_FILTERS, type GameFilters } from '../lib/gameFilters'
import { isKnownConferenceId } from '../data/conferences'
import type { Game, Team } from '../types/game'

/**
 * One screen stacked on top of an expanded game: a team's page, or another
 * game opened from that page's schedule.
 *
 * A stack rather than a single "which team page is open" flag, because the
 * two screens lead to each other without end — a game's teams, a team's
 * schedule, that game's teams — and Back has to unwind exactly the way you
 * came. The game is carried by value: a fixture in November is nowhere in
 * the day you happen to be browsing, so an id alone would have nothing to
 * resolve against.
 */
export type DetailFrame =
  | { kind: 'team'; team: Team; year: number }
  | { kind: 'game'; game: Game }

export type Tab = 'schedule' | 'scoreboard' | 'settings'

const TAB_STORAGE_KEY = 'slate.tab.v1'
const DATE_KEY_STORAGE_KEY = 'slate.selectedDate.v1'
const EXPANDED_GAME_STORAGE_KEY = 'slate.expandedGame.v1'
const SCOREBOARD_ANCHOR_STORAGE_KEY = 'slate.scoreboardAnchor.v1'
const FILTERS_STORAGE_KEY = 'slate.filters.v1'
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

/** Filters survive a reload, like the tab and day do. A filter you set and
 * then lose on refresh is worse than no filter — you would not know why the
 * slate looked short. Anything unparseable reads as no filters rather than
 * trapping the app behind a filter it can't describe. */
function readStoredFilters(): GameFilters {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY)
    if (!raw) return NO_FILTERS
    const parsed = JSON.parse(raw) as Partial<GameFilters>
    // A conference id this build doesn't know — one saved when conferences
    // were keyed by ESPN's numeric group ids, or a hand-edited value — would
    // match no games at all, leaving an empty slate with a filter chip
    // nobody could explain. Unknown reads as no conference filter.
    const conferenceId =
      typeof parsed.conferenceId === 'string' && isKnownConferenceId(parsed.conferenceId) ? parsed.conferenceId : null
    return { rankedOnly: parsed.rankedOnly === true, conferenceId }
  } catch {
    return NO_FILTERS
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
  /** Screens stacked on top of the expanded game, innermost last. Empty
   * means the expanded game itself.
   *
   * Deliberately NOT persisted, unlike the tab, day and expanded game. If a
   * team page ever fails to render, persisting it means every reload
   * restores the screen that just broke — a blank page that reloading
   * can't escape. Refresh returns to the expanded game instead, which is
   * one tap away and can't trap anyone. */
  detailStack: DetailFrame[]
  pushDetail: (frame: DetailFrame) => void
  popDetail: () => void
  /** The team whose page is on top, if one is — what a screen needs when it
   * only cares about that, like the Settings probe. */
  teamPageId: string | null
  /** Shared by Slate and Scoreboard, like the selected day: they are two
   * views onto the same slate, so filtering one and not the other would
   * show two different answers to the same question. */
  filters: GameFilters
  setFilters: (filters: GameFilters) => void
}

const ViewStateContext = createContext<ViewStateValue | null>(null)

export function ViewStateProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<Tab>(readStoredTab)
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(() => readStoredString(DATE_KEY_STORAGE_KEY))
  const [expandedGameId, setExpandedGameId] = useState<string | null>(() => readStoredString(EXPANDED_GAME_STORAGE_KEY))
  const [scoreboardAnchorDate, setScoreboardAnchorDate] = useState<string | null>(() => readStoredString(SCOREBOARD_ANCHOR_STORAGE_KEY))
  const [detailStack, setDetailStack] = useState<DetailFrame[]>([])
  const [filters, setFilters] = useState<GameFilters>(readStoredFilters)

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

  useEffect(() => {
    writeStoredValue(FILTERS_STORAGE_KEY, JSON.stringify(filters))
  }, [filters])


  const value = useMemo<ViewStateValue>(
    () => ({
      tab,
      setTab,
      selectedDateKey,
      setSelectedDateKey,
      expandedGameId,
      setExpandedGameId,
      toggleExpandedGame: (gameId) => {
        // Switching or closing a game unwinds whatever was stacked on it —
        // otherwise the next game you open opens on someone else's page.
        setDetailStack([])
        setExpandedGameId((cur) => (cur === gameId ? null : gameId))
      },
      scoreboardAnchorDate,
      setScoreboardAnchorDate,
      detailStack,
      pushDetail: (frame) => setDetailStack((cur) => [...cur, frame]),
      popDetail: () => setDetailStack((cur) => cur.slice(0, -1)),
      teamPageId: detailStack.at(-1)?.kind === 'team' ? (detailStack.at(-1) as { team: Team }).team.id : null,
      filters,
      setFilters,
    }),
    [tab, selectedDateKey, expandedGameId, scoreboardAnchorDate, detailStack, filters],
  )

  return <ViewStateContext.Provider value={value}>{children}</ViewStateContext.Provider>
}

export function useViewState(): ViewStateValue {
  const ctx = useContext(ViewStateContext)
  if (!ctx) throw new Error('useViewState must be used within ViewStateProvider')
  return ctx
}
