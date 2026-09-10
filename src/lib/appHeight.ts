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
 * than from a viewport unit, and the largest of them wins: whichever of
 * innerHeight, visualViewport and "containing block plus the inset it
 * dropped" is biggest is the one that reaches the bottom edge. They agree
 * at 874 here; taking the max means no single one of them lying makes the
 * app come up short.
 *
 * Standalone only. In a browser tab the answer is already correct and
 * innerHeight jumps around as the toolbar collapses.
 */
const STANDALONE = '(display-mode: standalone)'

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

function screenHeight(): number {
  return Math.round(
    Math.max(
      window.innerHeight,
      window.visualViewport?.height ?? 0,
      document.documentElement.clientHeight + insetTop(),
    ),
  )
}

export function trackAppHeight(): void {
  const apply = () => {
    if (!isStandalone()) {
      document.documentElement.style.removeProperty('--app-height')
      return
    }
    document.documentElement.style.setProperty('--app-height', `${screenHeight()}px`)
  }

  apply()
  window.addEventListener('resize', apply)
  window.addEventListener('orientationchange', apply)
  window.visualViewport?.addEventListener('resize', apply)
  window.matchMedia(STANDALONE).addEventListener('change', apply)
}
