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

function Shell() {
  const { tab } = useViewState()
  return (
    <>
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
