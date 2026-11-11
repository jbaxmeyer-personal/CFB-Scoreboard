/**
 * Publishes the height of the screen the app is actually on as --app-height.
 *
 * On this device the app's own box measured 812px tall inside an 874px
 * screen — 62px short, exactly the top safe-area inset — because iOS
 * standalone resolves viewport units against an initial containing block
 * that size. Anything laid out against `100dvh` therefore ends 62px above
 * the bottom of the screen, tab bar included.
 *
 * So the height is taken from the numbers that describe the screen rather
 * than from a viewport unit, and the largest of them wins.
 *
 * That alone came back (Nov 2026): close the app from the switcher, reopen
 * it, and the band was there again. On a cold relaunch iOS runs this script
 * before it has applied the safe-area insets, so every viewport number —
 * innerHeight, visualViewport, clientHeight + inset — reads 812 at once,
 * and then no resize event ever follows to correct it. Two changes:
 *
 * - The physical screen is a candidate too. Installed on an iPhone, the web
 *   view *is* the screen, and `screen` does not wait on the insets. It is
 *   only trusted when it is within a status bar's height of what the
 *   viewport reports, so an iPad window smaller than its screen is never
 *   stretched past its own bottom edge.
 * - The height is re-taken whenever the app comes back (pageshow,
 *   visibilitychange, focus) and a few times in the first seconds after
 *   launch, when iOS settles the insets without telling anyone.
 *
 * And if every number still lies, the strip below the column is painted
 * the tab bar's colour (see html in index.css), so the worst case is a
 * taller tab bar, never a dark band under it.
 *
 * Standalone only. In a browser tab the answer is already correct and
 * innerHeight jumps around as the toolbar collapses.
 */
const STANDALONE = '(display-mode: standalone)'

/** Most the viewport can come up short of the screen and still be the
 *  inset bug rather than a window that really is smaller (status bar plus
 *  Dynamic Island is 62px today). */
const MAX_INSET_SHORTFALL = 100

function isStandalone(): boolean {
  return (
    window.matchMedia(STANDALONE).matches ||
    // iOS predates display-mode and still reports it this way.
    (window.navigator as { standalone?: boolean }).standalone === true
  )
}

/** env() can't be read from script, so a probe takes it as its own height. */
function insetTop(): number {
  const host = document.body ?? document.documentElement
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:absolute;visibility:hidden;top:0;left:0;width:0;height:env(safe-area-inset-top, 0px)'
  host.appendChild(probe)
  const height = probe.getBoundingClientRect().height
  probe.remove()
  return height
}

export interface ViewportReadings {
  innerWidth: number
  innerHeight: number
  visualViewportHeight: number
  clientHeight: number
  insetTop: number
  screenWidth: number
  screenHeight: number
}

/** Pure, so the cold-launch numbers can be tested without a phone. */
export function appHeightFrom(r: ViewportReadings): number {
  const viewport = Math.max(r.innerHeight, r.visualViewportHeight, r.clientHeight + r.insetTop)
  // `screen` is portrait-fixed on some iOS versions; take the side that
  // matches the orientation the viewport is in.
  const landscape = r.innerWidth > r.innerHeight
  const screenSide = landscape
    ? Math.min(r.screenWidth, r.screenHeight)
    : Math.max(r.screenWidth, r.screenHeight)
  const screenFits =
    screenSide >= viewport && screenSide - viewport <= MAX_INSET_SHORTFALL
  return Math.round(screenFits ? screenSide : viewport)
}

function readings(): ViewportReadings {
  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    visualViewportHeight: window.visualViewport?.height ?? 0,
    clientHeight: document.documentElement.clientHeight,
    insetTop: insetTop(),
    screenWidth: window.screen?.width ?? 0,
    screenHeight: window.screen?.height ?? 0,
  }
}

export function trackAppHeight(): void {
  const apply = () => {
    if (!isStandalone()) {
      document.documentElement.style.removeProperty('--app-height')
      return
    }
    document.documentElement.style.setProperty('--app-height', `${appHeightFrom(readings())}px`)
  }

  apply()
  window.addEventListener('resize', apply)
  window.addEventListener('orientationchange', apply)
  window.addEventListener('pageshow', apply)
  window.addEventListener('focus', apply)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') apply()
  })
  window.addEventListener('load', apply)
  window.visualViewport?.addEventListener('resize', apply)
  window.matchMedia(STANDALONE).addEventListener('change', apply)
  // iOS can settle the insets after launch without firing anything.
  requestAnimationFrame(apply)
  for (const ms of [100, 300, 1000, 2500]) setTimeout(apply, ms)
}
