import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// The default auto-injected registration only registers the SW once with no
// update checks at all, so a new deploy can sit undetected behind an
// already-installed one indefinitely (even across a hard refresh). Register
// it ourselves and force a real update check on every visibility change —
// combined with registerType: 'autoUpdate' this reloads onto the new
// version automatically, with no user action needed.
if ('serviceWorker' in navigator) {
  const updateSW = registerSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      const checkForUpdate = () => registration.update()
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate()
      })
      setInterval(checkForUpdate, 60 * 60 * 1000)
    },
  })
  void updateSW
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
