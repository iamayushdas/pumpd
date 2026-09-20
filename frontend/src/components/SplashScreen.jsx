import { useEffect } from 'react'

export default function SplashScreen() {
  useEffect(() => {
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
