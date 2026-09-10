import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

/** How often to look for a new build while the app stays open. An installed
 * app can sit in the background for days, so the check on resume matters far
 * more than this does. */
const POLL_MS = 15 * 60_000

/** Guards against an update that reapplies itself in a loop. */
const APPLIED_AT = 'slate:update-applied-at'
const APPLY_COOLDOWN_MS = 60_000

/**
 * Drops the service worker and its caches, then reloads.
 *
 * The polite path — skipWaiting, then reload on controllerchange — is
 * unreliable in an iOS standalone app: the reload often never fires, so
 * applying an update appears to do nothing. With no worker left to intercept,
 * the browser fetches the new build fresh and the worker re-registers on that
 * load.
 */
async function applyUpdate(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch {
    // Reload regardless — a plain reload beats a stuck banner.
  }
  window.location.reload()
}

/**
 * Keeps the installed app on the current build.
 *
 * An installed iOS app almost never does a real page load, so left alone the
 * service worker can serve the same build for days. The fix is in finding
 * the update, not in applying it behind your back: the check refetches the
 * worker script with `cache: 'no-store'` before asking the registration to
 * update, because `registration.update()` on its own is allowed to reuse the
 * HTTP-cached copy of that script, and GitHub Pages serves it with cache
 * headers. Without that the check could run on schedule, find the same bytes
 * it already had, and conclude there was nothing new.
 *
 * Applying it no longer waits for a tap. A fix can be built, deployed and
 * green while the installed app quietly keeps serving the build from before
 * it — which is exactly how a bug already fixed gets reported again. The
 * banner stays as the visible fallback if the reload doesn't take.
 */
export function usePwaUpdate() {
  const [needRefresh, setNeedRefresh] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let registration: ServiceWorkerRegistration | undefined
    let swUrl = ''
    let applying = false

    /** Show the banner, then apply it. The guards are only against a reload
     * loop: once per page load, and never twice inside a minute even across
     * loads, so a build that somehow always reports itself stale can't spin. */
    const foundUpdate = () => {
      setNeedRefresh(true)
      if (applying) return
      applying = true
      const now = Date.now()
      const last = Number(sessionStorage.getItem(APPLIED_AT) ?? 0)
      if (now - last < APPLY_COOLDOWN_MS) return
      try {
        sessionStorage.setItem(APPLIED_AT, String(now))
      } catch {
        // Private mode or a full quota. The reload below still stands.
      }
      void applyUpdate()
    }

    const checkForUpdate = async () => {
      if (!registration || registration.installing) return
      if ('onLine' in navigator && !navigator.onLine) return
      try {
        // The no-store fetch is the point: it forces the browser past its own
        // cached copy of the worker script so `update()` sees a new build.
        const res = await fetch(swUrl, {
          cache: 'no-store',
          headers: { 'cache-control': 'no-cache' },
        })
        if (res.status !== 200) return
        await registration.update()
      } catch {
        // Offline, or the check raced a reload. Try again next time.
      }
      if (registration.waiting) foundUpdate()
    }

    // Coming back to the app is the moment worth checking: an installed app
    // can sit in the background for days without ever loading a page.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void checkForUpdate()
    }

    document.addEventListener('visibilitychange', onVisible)
    const poll = window.setInterval(() => {
      void checkForUpdate()
    }, POLL_MS)

    registerSW({
      immediate: true,
      onNeedRefresh() {
        foundUpdate()
      },
      onRegisteredSW(url, reg) {
        swUrl = url
        registration = reg
        if (!reg) return
        void checkForUpdate()
      },
    })

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(poll)
    }
  }, [])

  return { needRefresh, update: applyUpdate }
}
