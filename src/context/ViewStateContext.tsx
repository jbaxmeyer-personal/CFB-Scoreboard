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

/** The two tabs that show games, and so the two that can have one open. */
export type GameTab = 'schedule' | 'scoreboard'

/** Settings shows no games; anything asked of it answers for Slate, which
 * is inert because neither screen is mounted while Settings is up. */
function gameTab(tab: Tab): GameTab {
  return tab === 'scoreboard' ? 'scoreboard' : 'schedule'
}

const TAB_STORAGE_KEY = 'slate.tab.v1'
const DATE_KEY_STORAGE_KEY = 'slate.selectedDate.v1'
const EXPANDED_GAME_STORAGE_KEY = 'slate.expandedGame.v1'
const EXPANDED_GAMES_STORAGE_KEY = 'slate.expandedGames.v2'
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

type ExpandedByTab = Record<GameTab, string | null>

const NO_EXPANDED: ExpandedByTab = { schedule: null, scoreboard: null }

/**
 * Which game each screen has open, remembered separately.
 *
 * A value saved by the old build was a single id shared by both screens. It
 * is restored to whichever tab was last open, because that is the screen it
 * was actually expanded on — giving it to both would put a game on Slate
 * that was only ever opened on Scoreboard.
 */
function readStoredExpanded(): ExpandedByTab {
  try {
    const raw = localStorage.getItem(EXPANDED_GAMES_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ExpandedByTab>
      return {
        schedule: typeof parsed.schedule === 'string' ? parsed.schedule : null,
        scoreboard: typeof parsed.scoreboard === 'string' ? parsed.scoreboard : null,
      }
    }
    const legacy = localStorage.getItem(EXPANDED_GAME_STORAGE_KEY)
    if (!legacy) return NO_EXPANDED
    return { ...NO_EXPANDED, [gameTab(readStoredTab())]: legacy }
  } catch {
    return NO_EXPANDED
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
    const parsed = JSON.parse(raw) as Partial<GameFilters> & { conferenceId?: unknown }
    // The filter used to hold a single id. A stored one is carried over
    // rather than dropped, so nobody's saved filter quietly turns itself off
    // the first time they open the new build.
    const stored = Array.isArray(parsed.conferenceIds)
      ? parsed.conferenceIds
      : typeof parsed.conferenceId === 'string'
        ? [parsed.conferenceId]
        : []
    // An id this build doesn't know — one saved when conferences were keyed
    // by ESPN's numeric group ids, or a hand-edited value — would match no
    // games at all, leaving an empty slate with a filter chip nobody could
    // explain. Unknown ids are dropped; the ones that still resolve stay.
    const conferenceIds = [...new Set(stored.filter((id): id is string => typeof id === 'string' && isKnownConferenceId(id)))]
    return { rankedOnly: parsed.rankedOnly === true, conferenceIds }
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
  /** The game open on the *current* tab, and nothing to do with the other
   * one. Slate and Scoreboard each remember their own, so leaving a game
   * open on Scoreboard and switching to Slate gives you Slate — and coming
   * back gives you the game again. They are two ways of reading a day, not
   * one screen rendered twice; carrying the open game between them meant
   * arriving somewhere already buried in a panel you never opened there. */
  expandedGameId: string | null
  setExpandedGameId: (id: string | null) => void
  toggleExpandedGame: (gameId: string) => void
  /** Which week Scoreboard is showing, as that week's start date, or null
   * for "the one containing today". Lives here because switching tabs
   * unmounts Scoreboard, and a week you chose should still be the week you
   * are on when you come back. Not persisted: a reload opens on the current
   * week, which is what opening the app means. */
  scoreboardWeekStart: string | null
  setScoreboardWeekStart: (weekStart: string | null) => void
  /** Screens stacked on top of the expanded game, innermost last. Empty
   * means the expanded game itself. Per-tab for the same reason the
   * expanded game is: a team page belongs to the game it was opened from,
   * so it has to travel with it rather than hang over the other screen.
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
  const [expandedByTab, setExpandedByTab] = useState<ExpandedByTab>(readStoredExpanded)
  const [stackByTab, setStackByTab] = useState<Record<GameTab, DetailFrame[]>>({ schedule: [], scoreboard: [] })
  const [scoreboardWeekStart, setScoreboardWeekStart] = useState<string | null>(null)

  const current = gameTab(tab)
  const expandedGameId = expandedByTab[current]
  const detailStack = stackByTab[current]
  const [filters, setFilters] = useState<GameFilters>(readStoredFilters)

  useEffect(() => {
    writeStoredValue(TAB_STORAGE_KEY, tab)
  }, [tab])

  useEffect(() => {
    writeStoredValue(DATE_KEY_STORAGE_KEY, selectedDateKey)
  }, [selectedDateKey])

  useEffect(() => {
    writeStoredValue(EXPANDED_GAMES_STORAGE_KEY, JSON.stringify(expandedByTab))
  }, [expandedByTab])

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
      setExpandedGameId: (id) => setExpandedByTab((cur) => ({ ...cur, [current]: id })),
      toggleExpandedGame: (gameId) => {
        // Switching or closing a game unwinds whatever was stacked on it —
        // otherwise the next game you open opens on someone else's page.
        setStackByTab((cur) => ({ ...cur, [current]: [] }))
        setExpandedByTab((cur) => ({ ...cur, [current]: cur[current] === gameId ? null : gameId }))
      },
      scoreboardWeekStart,
      setScoreboardWeekStart,
      detailStack,
      pushDetail: (frame) => setStackByTab((cur) => ({ ...cur, [current]: [...cur[current], frame] })),
      popDetail: () => setStackByTab((cur) => ({ ...cur, [current]: cur[current].slice(0, -1) })),
      teamPageId: detailStack.at(-1)?.kind === 'team' ? (detailStack.at(-1) as { team: Team }).team.id : null,
      filters,
      setFilters,
    }),
    [tab, current, selectedDateKey, expandedByTab, expandedGameId, scoreboardWeekStart, stackByTab, detailStack, filters],
  )

  return <ViewStateContext.Provider value={value}>{children}</ViewStateContext.Provider>
}

export function useViewState(): ViewStateValue {
  const ctx = useContext(ViewStateContext)
  if (!ctx) throw new Error('useViewState must be used within ViewStateProvider')
  return ctx
}
