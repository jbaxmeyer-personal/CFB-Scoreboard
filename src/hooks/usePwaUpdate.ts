import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

/** How often to look for a new build while the app stays open. An installed
 * app can sit in the background for days, so the check on resume matters far
 * more than this does. */
const POLL_MS = 15 * 60_000

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
 * Applying it stays a deliberate tap on the Refresh banner. An update is
 * never installed on its own — a reload that arrives unannounced is worse
 * than one you asked for, and the banner is how you know a new build landed
 * at all.
 */
export function usePwaUpdate() {
  const [needRefresh, setNeedRefresh] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let registration: ServiceWorkerRegistration | undefined
    let swUrl = ''

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
      if (registration.waiting) setNeedRefresh(true)
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
        setNeedRefresh(true)
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
