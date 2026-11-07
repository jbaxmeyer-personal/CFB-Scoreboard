import { useLayoutEffect, useRef } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SettingsProvider } from './context/SettingsContext'
import { ViewStateProvider, useViewState, type Tab } from './context/ViewStateContext'
import { ScheduleGrid } from './components/schedule/ScheduleGrid'
import { ScoreboardWeeks } from './components/scoreboard/ScoreboardWeeks'
import { SettingsScreen } from './components/settings/SettingsScreen'
import { StandingsScreen } from './components/standings/StandingsScreen'
import { TabBar } from './components/shared/TabBar'
import { UpdateBanner } from './components/shared/UpdateBanner'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import { DETAIL_LAYER_ID } from './components/shared/GameDetailPanel'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
})

/**
 * Landscape on a phone isn't a layout this app has. The time grid, the card
 * pairs and the tab bar are all built for a tall, narrow screen, and there
 * is no way to stop the phone turning: the manifest's `orientation` is
 * honoured on Android but ignored by iOS Safari, and `screen.orientation
 * .lock()` doesn't exist there at all. So rather than lock the screen, the
 * app covers it and asks for the phone back the other way up.
 *
 * Phone landscape only — the media query needs a short viewport as well as a
 * wide one, so a tablet or a desktop browser window, where the layout is
 * perfectly usable, never sees this.
 */
function RotateNotice() {
  return (
    <div className="rotate-notice" role="alert">
      <p className="rotate-notice__title">Turn your phone upright</p>
      <p className="rotate-notice__hint">Slate is built for portrait.</p>
    </div>
  )
}

/**
 * Each tab's scroll position, kept apart from the others'.
 *
 * All four tabs render into one scrolling element, so its scrollTop simply
 * carried over: scrolling halfway down Standings and switching to
 * Scoreboard landed you halfway down Scoreboard, at a position you never
 * chose. The element is shared because the layout wants exactly one
 * scrolling region under a fixed tab bar; what has to be per-tab is the
 * position, not the element.
 *
 * Positions are recorded as you scroll rather than on the way out: by the
 * time a tab change has committed, the old screen is unmounted and the
 * scrollTop has already been clamped by the new, possibly shorter content.
 *
 * The restore runs twice. Once in layout, so no frame is ever painted at
 * the outgoing tab's position; once on the next frame, for a screen whose
 * content arrives after the first attempt and would otherwise have clamped
 * the scroll to a shorter page.
 *
 * Nothing guards against the scroll event our own restore fires: it writes
 * back whatever the element ended up at, which is the value just restored,
 * or the clamped one if the content was short — and the clamped one is
 * what the position should be in that case anyway. A guard was written
 * here first and removed when putting it back changed nothing.
 */
function useScrollPerTab(tab: Tab) {
  const ref = useRef<HTMLElement>(null)
  const positions = useRef<Partial<Record<Tab, number>>>({})

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const wanted = positions.current[tab] ?? 0
    el.scrollTop = wanted
    const id = requestAnimationFrame(() => {
      el.scrollTop = wanted
    })
    return () => cancelAnimationFrame(id)
  }, [tab])

  const onScroll = () => {
    const el = ref.current
    if (el) positions.current[tab] = el.scrollTop
  }

  return { ref, onScroll }
}

function Shell() {
  const { tab } = useViewState()
  const { ref: mainRef, onScroll } = useScrollPerTab(tab)
  return (
    <>
      <RotateNotice />
      {/* The list and the game detail are siblings in a positioned box, not
          nested. A game used to expand inside the list it was opened from,
          which meant the list had to be scrolled to the panel on open and
          back to the card on close, and the panel had to fight the layout it
          was injected into. Here the detail covers the list instead: the
          list keeps its own scroll position because nothing ever touches it,
          so closing returns you exactly where you were with no restoring
          involved. The tab bar is outside this and stays put. */}
      <div className="app-body">
        <main className="app-main" ref={mainRef} onScroll={onScroll}>
          {tab === 'schedule' && <ScheduleGrid />}
          {tab === 'scoreboard' && <ScoreboardWeeks />}
          {tab === 'standings' && <StandingsScreen />}
          {tab === 'settings' && <SettingsScreen />}
        </main>
        {/* Where GameDetailPanel portals to. Empty — and so not in anyone's
            way — whenever no game is open. */}
        <div id={DETAIL_LAYER_ID} />
      </div>
      <TabBar />
      <UpdateBanner />
    </>
  )
}

export default function App() {
  return (
    // Outermost, so a crash inside any provider or screen still lands on a
    // recoverable message rather than a blank page.
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SettingsProvider>
          <ViewStateProvider>
            <Shell />
          </ViewStateProvider>
        </SettingsProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
