/**
 * How a period is labelled while a game is being played.
 *
 * Reported from a live card: UCLA at Michigan read "Q5 0:00" in the first
 * overtime. ESPN numbers overtime from period 5, so the quarter form kept
 * counting past the four that exist. ESPN's own label for that same game,
 * verbatim from the scoreboard feed, is "OT" — with its clock sent as
 * "0:00" and no time printed, because no clock runs in a college overtime.
 */
import { check, report } from '../helpers/check'
import { periodLabel, livePeriodLabel, liveStatusText } from '../../src/lib/linescore'

// --- Regulation is unchanged ---------------------------------------------
check('the first quarter', livePeriodLabel(1), 'Q1')
check('the fourth', livePeriodLabel(4), 'Q4')
check('and the clock comes with it', liveStatusText(3, '4:12'), 'Q3 4:12')
check('including a stopped one', liveStatusText(4, '0:00'), 'Q4 0:00')

// --- Overtime ------------------------------------------------------------
// Period 5 is the first overtime, not a fifth quarter.
check('the first overtime is OT, not Q5', livePeriodLabel(5), 'OT')
check('the second is 2OT', livePeriodLabel(6), '2OT')
check('the fourth is 4OT', livePeriodLabel(8), '4OT')

// No time, because there is no clock running in one. ESPN sends "0:00"
// throughout and prints nothing of its own; "OT 0:00" would be a countdown
// to nothing.
check('overtime shows no clock', liveStatusText(5, '0:00'), 'OT')
check('nor does the second', liveStatusText(6, '0:00'), '2OT')
// Even if the feed sent a time, overtime has none to show.
check('and not even when the feed sends one', liveStatusText(5, '12:34'), 'OT')

// --- The box score's own labels are untouched ----------------------------
// That column heading reads "1st"/"2nd", not "Q1"/"Q2", and still does.
check('the box score keeps its own form', periodLabel(1), '1st')
check('and its overtimes agree', periodLabel(5), 'OT')

report()
