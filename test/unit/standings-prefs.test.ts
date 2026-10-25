/**
 * Which conferences the Standings screen remembers.
 *
 * The ask was explicit: open on the power four, and whatever the user adds
 * or removes from there is what they get next time they come back —
 * including after closing the app.
 */
import { check, report } from '../helpers/check'

// A standalone localStorage, since this runs on node. Written before the
// module is imported, because the module reads it on first call.
const store = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage

const { readSelectedConferences, writeSelectedConferences, POWER_CONFERENCE_IDS } = await import('../../src/lib/standingsPrefs')

check('a first visit opens on the power four', readSelectedConferences(), POWER_CONFERENCE_IDS)

// The round trip the request was about: add the AAC, come back, still there.
writeSelectedConferences([...POWER_CONFERENCE_IDS, 'AAC'])
check('a conference added is remembered', readSelectedConferences(), [...POWER_CONFERENCE_IDS, 'AAC'])

writeSelectedConferences(['Big Ten'])
check('and so is narrowing it down to one', readSelectedConferences(), ['Big Ten'])

// Unticking everything is a choice, not a reset. Quietly putting the power
// four back would undo it on every visit.
writeSelectedConferences([])
check('an empty selection is honoured rather than reset', readSelectedConferences(), [])

// A conference id this build doesn't have — saved before a realignment, or
// hand-edited — would match nothing and leave an empty screen nobody could
// explain, so it is dropped and the rest kept.
writeSelectedConferences(['SEC', 'Southwest Conference'])
check('an unknown conference is dropped', readSelectedConferences(), ['SEC'])

// Duplicates would render the same table twice.
writeSelectedConferences(['SEC', 'SEC', 'ACC'])
check('duplicates are collapsed', readSelectedConferences(), ['SEC', 'ACC'])

// Anything unparseable reads as a first visit rather than throwing on load.
store.set('slate.standings.conferences.v1', 'not json')
check('a corrupt value falls back to the default', readSelectedConferences(), POWER_CONFERENCE_IDS)
store.set('slate.standings.conferences.v1', '{"not":"an array"}')
check('and so does the wrong shape', readSelectedConferences(), POWER_CONFERENCE_IDS)

report()
