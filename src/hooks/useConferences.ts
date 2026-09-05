import { CONFERENCES, CONFERENCES_BY_ID, type Conference } from '../data/conferences'

export interface ConferencesResult {
  conferences: Conference[]
  byId: Map<string, Conference>
}

/**
 * The FBS conferences and their membership.
 *
 * A static table rather than a fetch. This used to walk ESPN's core API —
 * one request for the conference list and one per conference — which meant
 * a picker that had to show a loading state, could fail, and rested on a
 * response shape that couldn't be checked from the build environment.
 * Membership changes once a season, so paying for it at runtime bought
 * nothing.
 *
 * Kept as a hook so callers don't change shape, and so swapping the source
 * again later is a one-file edit.
 */
export function useConferences(): ConferencesResult {
  return { conferences: CONFERENCES, byId: CONFERENCES_BY_ID }
}
