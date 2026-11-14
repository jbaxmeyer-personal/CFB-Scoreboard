import { useEffect } from 'react'

/**
 * Holds the screen awake while `active` is true.
 *
 * The complaint this answers: a phone propped up against something with a
 * live game open goes dark after thirty seconds, and you have to reach over
 * and wake it to see the score. The play-by-play updating in the background
 * is not activity as far as the idle timer is concerned — only touching the
 * thing is — so the app has to ask for the screen explicitly.
 *
 * Screen Wake Lock does that. It needs a secure context (Pages is HTTPS) and
 * exists in iOS Safari from 16.4, including an installed PWA. Where it does
 * not exist, or where the browser refuses — battery saver, a low battery —
 * nothing happens and the screen behaves as it did before. There is no
 * fallback: the usual trick is a looping invisible video, which costs
 * battery and decoder time to fake what this API does properly, and a
 * screen that dims on an old phone is a much smaller problem than that.
 *
 * Two things about the lock itself drive the shape of this hook.
 *
 * It is dropped by the browser whenever the page stops being visible, and
 * it does not come back by itself — so backgrounding the app and returning
 * to it would leave a live game with no lock, which is exactly when you are
 * most likely to have set the phone down. Hence the visibilitychange
 * listener, which re-takes it on the way back.
 *
 * And `request` is async, so the panel can close while one is still in
 * flight. A sentinel that arrives after that would be a lock nothing holds
 * a reference to and nothing ever releases — the screen would stay on until
 * the tab was closed. `cancelled` catches it and releases it on arrival.
 */
export function useKeepAwake(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const wakeLock = navigator.wakeLock
    if (!wakeLock) return

    let cancelled = false
    let sentinel: WakeLockSentinel | null = null

    const acquire = async (): Promise<void> => {
      // A request made while the page is hidden is rejected, so this waits
      // for the visibilitychange instead of throwing for nothing.
      if (cancelled || document.visibilityState !== 'visible') return
      if (sentinel && !sentinel.released) return
      try {
        const next = await wakeLock.request('screen')
        if (cancelled) {
          void next.release()
          return
        }
        sentinel = next
      } catch {
        // Refused: unsupported, battery saver, or the page lost visibility
        // between the check above and the call. The screen dims, which is
        // the behaviour without this hook at all.
      }
    }

    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (sentinel && !sentinel.released) void sentinel.release()
      sentinel = null
    }
  }, [active])
}
