import { useCallback, useState } from 'react'
import { readStorage, writeStorage } from '../lib/storage'

const STORAGE_KEY = 'slate.reactions.v1'

export type ReactionMap = Record<string, string>

export interface ReactionsResult {
  reactions: ReactionMap
  /** Setting the same emoji that's already there clears it (tap to toggle). */
  setReaction: (key: string, emoji: string) => void
}

/**
 * Your own emoji reactions to individual plays — personal-only, saved to
 * this browser's localStorage. No accounts, no server, no other users see
 * these; this is intentionally the scoped-down version of Real's social
 * reactions rather than a live shared reaction count.
 */
export function useReactions(): ReactionsResult {
  const [reactions, setReactions] = useState<ReactionMap>(() => readStorage(STORAGE_KEY, {}))

  const setReaction = useCallback((key: string, emoji: string) => {
    setReactions((prev) => {
      const next = { ...prev }
      if (prev[key] === emoji) delete next[key]
      else next[key] = emoji
      writeStorage(STORAGE_KEY, next)
      return next
    })
  }, [])

  return { reactions, setReaction }
}
