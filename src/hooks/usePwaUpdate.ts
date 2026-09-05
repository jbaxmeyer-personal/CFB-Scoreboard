import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

/** How often to look for a new build while the app stays open. An installed
 * app can sit in the background for days, so the check on resume matters far
 * more than this does. */
const POLL_MS = 15 * 60_000

/** Applying an update reloads the app, so a bug that kept finding one would
 * be a boot loop. This is the floor between two automatic applies; the
 * Refresh button ignores it, because that one is a person asking. */
const MIN_APPLY_GAP_MS = 60_000
const LAST_APPLY_KEY = 'slate.lastUpdateApply.v1'

function recentlyApplied(): boolean {
  try {
    const last = Number(sessionStorage.getItem(LAST_APPLY_KEY) ?? 0)
    return Number.isFinite(last) && Date.now() - last < MIN_APPLY_GAP_MS
  } catch {
    return false
  }
}

function markApplied(): void {
  try {
    sessionStorage.setItem(LAST_APPLY_KEY, String(Date.now()))
  } catch {
    // best-effort only; the guard is a safety net, not a requirement
  }
}

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
  markApplied()
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
 * service worker can serve the same build for days. Two things fix that.
 *
 * The check itself refetches the worker script with `cache: 'no-store'`
 * before asking the registration to update. `registration.update()` on its
 * own is allowed to reuse the HTTP-cached copy of that script, and GitHub
 * Pages serves it with cache headers — so the check could run on schedule,
 * find the same bytes it already had, and conclude there was nothing new.
 * That is the version of this that looked like it worked and didn't.
 *
 * And a waiting update is applied automatically when the app is opened or
 * returned to, rather than waiting for someone to notice a banner. Coming
 * back to the app is the moment a reload costs nothing. An update that turns
 * up mid-session still just offers the banner, so the screen never changes
 * under someone who is reading it.
 */
export function usePwaUpdate() {
  const [needRefresh, setNeedRefresh] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let registration: ServiceWorkerRegistration | undefined
    let swUrl = ''
    // True until the app has been visible for a moment, so the check that
    // runs at startup counts as "on open" and applies straight away.
    let openingOrResuming = true

    const applyIfWaiting = () => {
      if (!registration?.waiting) return false
      if (openingOrResuming && !recentlyApplied()) {
        void applyUpdate()
        return true
      }
      setNeedRefresh(true)
      return false
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
      applyIfWaiting()
    }

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      openingOrResuming = true
      void checkForUpdate()
      // Anything found after this window is a mid-session update, which gets
      // the banner rather than pulling the page out from under a reader.
      window.setTimeout(() => {
        openingOrResuming = false
      }, 10_000)
    }

    document.addEventListener('visibilitychange', onVisible)
    const poll = window.setInterval(() => {
      void checkForUpdate()
    }, POLL_MS)

    registerSW({
      immediate: true,
      onNeedRefresh() {
        if (!applyIfWaiting()) setNeedRefresh(true)
      },
      onRegisteredSW(url, reg) {
        swUrl = url
        registration = reg
        if (!reg) return
        void checkForUpdate()
        window.setTimeout(() => {
          openingOrResuming = false
        }, 10_000)
      },
    })

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(poll)
    }
  }, [])

  return { needRefresh, update: applyUpdate }
}
