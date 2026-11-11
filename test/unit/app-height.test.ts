/**
 * The band under the tab bar, the third time.
 *
 * Installed to the home screen on an iPhone 16 Pro (874px tall, 62px top
 * inset), the app column is sized from --app-height. Close the app from the
 * switcher and reopen it, and iOS runs the script before it has applied the
 * insets: every viewport number reads 812 and the inset probe reads 0, with
 * no resize to follow. The column came up 62px short and a dark band sat
 * under the tab bar. The physical screen is the number that does not lie.
 */
import { check, report } from '../helpers/check'
import { appHeightFrom, type ViewportReadings } from '../../src/lib/appHeight'

const settled: ViewportReadings = {
  innerWidth: 402, innerHeight: 874, visualViewportHeight: 874,
  clientHeight: 812, insetTop: 62, screenWidth: 402, screenHeight: 874,
}

// What a cold relaunch actually hands over: everything short, inset 0.
const coldRelaunch: ViewportReadings = {
  ...settled, innerHeight: 812, visualViewportHeight: 812, clientHeight: 812, insetTop: 0,
}

check('settled launch fills the screen', appHeightFrom(settled), 874)
check('cold relaunch still fills the screen, not 812', appHeightFrom(coldRelaunch), 874)

// Keep the bug reproducible: without the screen, these readings are 812.
check('the viewport numbers alone really do come up short',
  appHeightFrom({ ...coldRelaunch, screenWidth: 0, screenHeight: 0 }), 812)

// Some iOS versions keep `screen` portrait while the phone is on its side.
check('landscape takes the short side of a portrait-fixed screen',
  appHeightFrom({ innerWidth: 874, innerHeight: 402, visualViewportHeight: 402,
    clientHeight: 402, insetTop: 0, screenWidth: 402, screenHeight: 874 }), 402)

// An iPad window in split view is much shorter than its screen; stretching
// it to the screen would push the tab bar off its own bottom edge.
check('a window far smaller than the screen keeps its own height',
  appHeightFrom({ innerWidth: 507, innerHeight: 700, visualViewportHeight: 700,
    clientHeight: 700, insetTop: 24, screenWidth: 1032, screenHeight: 1376 }), 724)

report()
