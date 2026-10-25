/**
 * Which conferences the Standings screen is showing, remembered between
 * visits.
 *
 * Eleven conferences is about 140 rows, and nobody follows all of them. The
 * screen opens on the power four, and whatever you add or remove from there
 * is what you get next time — including the next time you open the app,
 * which is the point. Stored separately from the Slate/Scoreboard
 * conference *filter*: that one answers "which games do I want on this
 * slate", this one answers "whose table do I want to read", and tying them
 * together would mean narrowing a Saturday to the Big Ten also deleted nine
 * conferences from this screen.
 */
import { isKnownConferenceId } from '../data/conferences'

const STORAGE_KEY = 'slate.standings.conferences.v1'

/** The four whose standings most people actually follow, and the default.
 * Not derived from a flag on the conference table: "power" is a fact about
 * the sport in a given year, not a property of a membership list, and
 * hard-coding it here keeps the yearly realignment edit in one file. */
export const POWER_CONFERENCE_IDS = ['ACC', 'Big 12', 'Big Ten', 'SEC']

/**
 * Nothing stored means a first visit, which opens on the power four.
 *
 * An empty *stored* list is different and is honoured: it means every
 * conference was unticked on purpose, and quietly re-adding four would
 * undo a choice the user made deliberately. The screen shows an empty
 * state with the menu right there, so it is one tap to recover.
 */
export function readSelectedConferences(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return [...POWER_CONFERENCE_IDS]
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return [...POWER_CONFERENCE_IDS]
    // Ids this build doesn't know — saved before a realignment, or
    // hand-edited — are dropped rather than left to match no conference and
    // show an empty screen nobody could explain.
    return [...new Set(parsed.filter((id): id is string => typeof id === 'string' && isKnownConferenceId(id)))]
  } catch {
    return [...POWER_CONFERENCE_IDS]
  }
}

export function writeSelectedConferences(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // best-effort persistence only
  }
}
