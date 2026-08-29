import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEVICE_TIMEZONE_ID } from '../lib/timezone'
import { readStorage, writeStorage } from '../lib/storage'
import type { SpoilerSettings } from '../lib/spoilers'

const STORAGE_KEY = 'slate.settings.v1'

export interface Settings {
  timezoneId: string
  favoriteTeamIds: string[]
  spoilers: SpoilerSettings
}

const DEFAULT_SETTINGS: Settings = {
  timezoneId: DEVICE_TIMEZONE_ID,
  favoriteTeamIds: [],
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
  toggleProtectedGame: (gameId: string) => void
  toggleProtectedTeam: (teamId: string) => void
  isTeamSpoilerListed: (teamId: string) => boolean
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

function toggleInList(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => readStorage(STORAGE_KEY, DEFAULT_SETTINGS))

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
