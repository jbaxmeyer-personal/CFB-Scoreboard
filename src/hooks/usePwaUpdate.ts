import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

// Keeps the installed app up to date without the delete-and-re-add dance.
// An installed iOS PWA almost never does a real page load, so the service
// worker rarely checks for a new build on its own. We force a check every
// time the app is brought to the foreground (plus a slow hourly poll while
// it stays open); when a new version is found we surface a Refresh banner
// instead of silently swapping code out from under the user mid-session.
export function usePwaUpdate() {
  const [needRefresh, setNeedRefresh] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true)
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return
        const checkForUpdate = () => {
          registration.update().catch(() => {})
        }
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkForUpdate()
        })
        setInterval(checkForUpdate, 60 * 60 * 1000)
      },
    })
  }, [])

  // Applying the update the "polite" way (skipWaiting + reload on
  // controllerchange) is unreliable in an iOS standalone PWA — the reload
  // often never fires, so tapping Refresh appears to do nothing. Instead
  // drop the service worker and its caches outright, then reload: with no
  // worker intercepting, the browser fetches the new build fresh and the SW
  // re-registers on that load.
  async function update() {
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
      // Reload regardless — a plain reload is still better than a stuck banner.
    }
    window.location.reload()
  }

  return { needRefresh, update }
}
