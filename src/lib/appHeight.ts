/**
 * Pins the app column to the height iOS actually gives a standalone web app.
 *
 * The on-device Layout Report showed `innerHeight` 874 but
 * `documentElement.clientHeight` 812 — a 62px disagreement, exactly the top
 * safe-area inset. The tab bar's own rectangle settled which of the two is
 * the real screen: while scrolled, sticky pinned its bottom edge to 874. So
 * 874 is the viewport; 812 is the initial containing block, which is what
 * viewport units resolve against.
 *
 * That difference is invisible on a long page, where the column is taller
 * than either number and `min-height` never binds — which is why the first
 * report, captured mid-scroll on a full slate, read a zero gap. On a short
 * page (one game, or an empty day) `min-height: 100dvh` is what decides the
 * column's height, and 62px short of the screen is a visible band under the
 * tab bar.
 *
 * So the height comes from `innerHeight` rather than from a viewport unit.
 * Only in standalone: there is no collapsing browser toolbar there, so the
 * number is stable, whereas in a Safari tab it changes as you scroll and
 * `100dvh` is already the right answer.
 */
const STANDALONE = '(display-mode: standalone)'

function isStandalone(): boolean {
  return (
    window.matchMedia(STANDALONE).matches ||
    // iOS predates display-mode and still reports it this way.
    (window.navigator as { standalone?: boolean }).standalone === true
  )
}

export function trackAppHeight(): void {
  const apply = () => {
    if (!isStandalone()) {
      document.documentElement.style.removeProperty('--app-height')
      return
    }
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`)
  }

  apply()
  window.addEventListener('resize', apply)
  window.addEventListener('orientationchange', apply)
  window.matchMedia(STANDALONE).addEventListener('change', apply)
}
