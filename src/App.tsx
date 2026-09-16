import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SettingsProvider } from './context/SettingsContext'
import { ViewStateProvider, useViewState } from './context/ViewStateContext'
import { ScheduleGrid } from './components/schedule/ScheduleGrid'
import { ScoreboardOverview } from './components/scoreboard/ScoreboardOverview'
import { SettingsScreen } from './components/settings/SettingsScreen'
import { TabBar } from './components/shared/TabBar'
import { UpdateBanner } from './components/shared/UpdateBanner'
import { ErrorBoundary } from './components/shared/ErrorBoundary'

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

function Shell() {
  const { tab } = useViewState()
  return (
    <>
      <RotateNotice />
      <main className="app-main">
        {tab === 'schedule' && <ScheduleGrid />}
        {tab === 'scoreboard' && <ScoreboardOverview />}
        {tab === 'settings' && <SettingsScreen />}
      </main>
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
