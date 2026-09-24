import { useEffect } from 'react'

export default function SplashScreen() {
  useEffect(() => {
    // Check if we are in an iOS browser (and not in a Capacitor native app)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isCapacitorApp = window.capacitor || (window.Capacitor && Capacitor.isNativePlatform());

    // If it's iOS and not a Capacitor app (i.e., running in browser), then remove the splash screen immediately
    if (isIOS && !isCapacitorApp) {
      const splashEl = document.getElementById('splash-overlay')
      if (splashEl && splashEl.parentNode) {
        splashEl.parentNode.removeChild(splashEl)
      }
      return;
    }

    // Otherwise, proceed with showing the splash screen
    const splashEl = document.getElementById('splash-overlay')
    if (!splashEl) return

    const timerExit = setTimeout(() => {
      splashEl.classList.add('splash-exit')
    }, 1600)

    const timerDone = setTimeout(() => {
      if (splashEl && splashEl.parentNode) {
        splashEl.parentNode.removeChild(splashEl)
      }
    }, 2100)

    return () => {
      clearTimeout(timerExit)
      clearTimeout(timerDone)
    }
  }, [])

  return null
}
