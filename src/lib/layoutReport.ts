/**
 * What the app's layout actually measures on the device it's running on.
 *
 * The gap below the tab bar cannot be reproduced here: with an iPhone's
 * insets standing in, the bar's bottom edge lands exactly on the viewport's
 * and the document is no taller than the screen. Two different explanations
 * fit the screenshots equally well — the page being shorter than the screen,
 * or the bar's own reserved strip for the home indicator reading as empty
 * space because its background barely differs from the page — and they need
 * opposite fixes.
 *
 * So rather than guess a third time, this reports the numbers that tell them
 * apart. Nothing here is interpreted.
 */
export function layoutReport(): string {
  const root = document.getElementById('root')
  const bar = document.querySelector('.tab-bar')
  const main = document.querySelector('.app-main')
  const rect = (el: Element | null) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) }
  }

  // env() can't be read directly, so a probe element resolves each inset by
  // taking it as its own height and having that height measured.
  const probe = document.createElement('div')
  probe.style.cssText = 'position:absolute;visibility:hidden;top:0;left:0;width:0'
  document.body.appendChild(probe)
  const inset = (side: string) => {
    probe.style.height = `env(safe-area-inset-${side}, 0px)`
    return Math.round(probe.getBoundingClientRect().height)
  }
  const insets = { top: inset('top'), bottom: inset('bottom'), left: inset('left'), right: inset('right') }
  // The number the first report was missing: what a viewport unit actually
  // resolves to here. `min-height` on the app column is what decides a short
  // page's height, so if these disagree with innerHeight, that difference is
  // the gap.
  const unit = (value: string) => {
    probe.style.height = value
    return Math.round(probe.getBoundingClientRect().height)
  }
  const viewportUnits = { vh: unit('100vh'), dvh: unit('100dvh'), svh: unit('100svh'), lvh: unit('100lvh') }
  probe.remove()

  const barStyle = bar ? getComputedStyle(bar) : undefined

  return JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      standalone: window.matchMedia('(display-mode: standalone)').matches,
      insets,
      viewport: {
        innerHeight: window.innerHeight,
        clientHeight: document.documentElement.clientHeight,
        visualViewport: window.visualViewport ? Math.round(window.visualViewport.height) : null,
        screen: window.screen?.height ?? null,
        devicePixelRatio: window.devicePixelRatio,
      },
      document: {
        scrollHeight: document.documentElement.scrollHeight,
        scrollTop: Math.round(window.scrollY),
        scrollableBy: document.documentElement.scrollHeight - window.innerHeight,
      },
      viewportUnits,
      appHeight: getComputedStyle(document.documentElement).getPropertyValue('--app-height').trim() || null,
      root: rect(root),
      main: rect(main),
      tabBar: rect(bar),
      // The two numbers that decide it. A gap below the bar means the page
      // stops short of the screen; a tall reserve with no gap means the strip
      // is the bar's own padding and the fix is how it looks, not where it is.
      gapBelowTabBar: bar ? Math.round(window.innerHeight - bar.getBoundingClientRect().bottom) : null,
      tabBarBottomReserve: barStyle ? barStyle.paddingBottom : null,
      tabBarBackground: barStyle ? barStyle.backgroundColor : null,
      tabBarPosition: barStyle ? barStyle.position : null,
    },
    null,
    2,
  )
}
