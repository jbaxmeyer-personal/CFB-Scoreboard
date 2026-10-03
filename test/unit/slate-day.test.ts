/**
 * Which day Slate opens on.
 *
 * It opened on whichever day came first in the fetched window, and that
 * window starts two days before today — so a fresh open landed on a day
 * whose games had already been played. The remembered choice made it worse:
 * it was stored with no record of when, so a day picked last Saturday was
 * still selected the following Tuesday.
 */
import { check, report } from '../helpers/check'
import { defaultSlateDayKey, parseRememberedDay, serializeRememberedDay } from '../../src/lib/slateDay'

// The window as it really arrives: two days back, seven forward.
const WINDOW = [
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05',
  '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10',
]
const TODAY = '2026-10-03'

check('today is chosen when today has games', defaultSlateDayKey(WINDOW, TODAY), TODAY)
check('and not the first day in the window, which is in the past', defaultSlateDayKey(WINDOW, TODAY) === WINDOW[0], false)

// A Tuesday in October has nothing on it; Saturday is the useful answer.
check('the next day with games is chosen when today has none',
  defaultSlateDayKey(['2026-10-01', '2026-10-02', '2026-10-06', '2026-10-10'], TODAY), '2026-10-06')
check('days are considered in order, not in the order they arrive',
  defaultSlateDayKey(['2026-10-10', '2026-10-06', '2026-10-01'], TODAY), '2026-10-06')

// Everything left is behind us — the last day beats showing nothing.
check('the last day is the fallback when every day is past',
  defaultSlateDayKey(['2026-09-26', '2026-10-01', '2026-10-02'], TODAY), '2026-10-02')
check('an empty window selects nothing', defaultSlateDayKey([], TODAY), undefined)

// A choice made today is kept; one made on any other day is not.
const chosenToday = serializeRememberedDay('2026-10-06', TODAY)
check('a day chosen today is restored', parseRememberedDay(chosenToday, TODAY), '2026-10-06')
check('the same choice is dropped tomorrow', parseRememberedDay(chosenToday, '2026-10-04'), null)
check('clearing the choice stores nothing', serializeRememberedDay(null, TODAY), null)

// Anything unreadable is dropped rather than guessed at — including the
// bare string the previous build wrote, which carries no date at all.
check('the old bare-string format is dropped', parseRememberedDay('2026-10-02', TODAY), null)
check('nothing stored is dropped', parseRememberedDay(null, TODAY), null)
check('malformed JSON is dropped', parseRememberedDay('{oops', TODAY), null)
check('an entry with no date stamp is dropped', parseRememberedDay(JSON.stringify({ dateKey: '2026-10-06' }), TODAY), null)

report()
