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
}

const DEFAULT_SETTINGS: Settings = {
  timezoneId: DEVICE_TIMEZONE_ID,
  favoriteTeamIds: [],
  broadcastDelaySeconds: DEFAULT_BROADCAST_DELAY_SECONDS,
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
    // Settings persisted before the delay existed come back without it, and
    // an unrecognized value would leave the app on a delay it can't name.
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
