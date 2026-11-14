import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEVICE_TIMEZONE_ID } from '../lib/timezone'
import { readStorage, writeStorage } from '../lib/storage'
import type { SpoilerSettings } from '../lib/spoilers'
import { DEFAULT_BROADCAST_DELAY_SECONDS, normalizeDelaySeconds } from '../lib/broadcastDelay'

const STORAGE_KEY = 'slate.settings.v1'

export interface Settings {
  timezoneId: string
  favoriteTeamIds: string[]
  spoilers: SpoilerSettings
  /** Seconds to hold live game data back, so the app trails the television
   * broadcast instead of leading it. 0 is off. */
  broadcastDelaySeconds: number
  /** Hold the screen awake while a live game is open. On by default: a
   * phone propped up to follow a game going dark every thirty seconds is
   * the thing people actually complain about, and the cost is paid only
   * while a live game is on screen. */
  keepScreenAwake: boolean
}

const DEFAULT_SETTINGS: Settings = {
  timezoneId: DEVICE_TIMEZONE_ID,
  favoriteTeamIds: [],
  broadcastDelaySeconds: DEFAULT_BROADCAST_DELAY_SECONDS,
  keepScreenAwake: true,
  spoilers: {
    globalEnabled: false,
    protectedGameIds: [],
    protectedTeamIds: [],
  },
}

interface SettingsContextValue {
  settings: Settings
  setTimezoneId: (id: string) => void
  toggleFavoriteTeam: (teamId: string) => void
  isFavoriteTeam: (teamId: string) => boolean
  setGlobalSpoilers: (enabled: boolean) => void
  setBroadcastDelaySeconds: (seconds: number) => void
  setKeepScreenAwake: (enabled: boolean) => void
  toggleProtectedGame: (gameId: string) => void
  toggleProtectedTeam: (teamId: string) => void
  isTeamSpoilerListed: (teamId: string) => boolean
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

function toggleInList(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    const stored = readStorage(STORAGE_KEY, DEFAULT_SETTINGS)
    // Settings persisted before a field existed come back without it, and
    // readStorage merges DEFAULT_SETTINGS underneath for exactly that — so
    // keepScreenAwake arrives as true for someone who has used the app
    // since before it existed, rather than as `undefined`, which is falsey
    // and would have shipped the feature off to every existing user. That
    // merge is load-bearing here; there is a check on it.
    //
    // The delay needs more than a default: a value that is present but not
    // one of the offered options would leave the app on a delay it cannot
    // name, which merging cannot fix.
    return { ...stored, broadcastDelaySeconds: normalizeDelaySeconds(stored.broadcastDelaySeconds) }
  })

  useEffect(() => {
    writeStorage(STORAGE_KEY, settings)
  }, [settings])

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      setTimezoneId: (id) => setSettings((s) => ({ ...s, timezoneId: id })),
      toggleFavoriteTeam: (teamId) =>
        setSettings((s) => ({ ...s, favoriteTeamIds: toggleInList(s.favoriteTeamIds, teamId) })),
      isFavoriteTeam: (teamId) => settings.favoriteTeamIds.includes(teamId),
      setBroadcastDelaySeconds: (seconds) =>
        setSettings((s) => ({ ...s, broadcastDelaySeconds: normalizeDelaySeconds(seconds) })),
      setKeepScreenAwake: (enabled) => setSettings((s) => ({ ...s, keepScreenAwake: enabled })),
      setGlobalSpoilers: (enabled) =>
        setSettings((s) => ({ ...s, spoilers: { ...s.spoilers, globalEnabled: enabled } })),
      toggleProtectedGame: (gameId) =>
        setSettings((s) => ({
          ...s,
          spoilers: { ...s.spoilers, protectedGameIds: toggleInList(s.spoilers.protectedGameIds, gameId) },
        })),
      toggleProtectedTeam: (teamId) =>
        setSettings((s) => ({
          ...s,
          spoilers: { ...s.spoilers, protectedTeamIds: toggleInList(s.spoilers.protectedTeamIds, teamId) },
        })),
      isTeamSpoilerListed: (teamId) => settings.spoilers.protectedTeamIds.includes(teamId),
    }),
    [settings],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
