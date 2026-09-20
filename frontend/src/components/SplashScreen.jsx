import { useState, useEffect } from 'react'

export default function SplashScreen({ onFinish }) {
  const [fading, setFading] = useState(false)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    // Start exit transition after letters assemble and hold
    const timerExit = setTimeout(() => {
      setFading(true)
    }, 1600)

    // Complete removal after fade-out transition
    const timerDone = setTimeout(() => {
      setVisible(false)
      if (onFinish) onFinish()
    }, 2050)

    return () => {
      clearTimeout(timerExit)
      clearTimeout(timerDone)
    }
  }, [onFinish])

  if (!visible) return null

  return (
    <div className={`splash-overlay ${fading ? 'splash-exit' : ''}`} aria-hidden="true">
      <div className="splash-glow" />
      <div className="splash-word">
        <span className="splash-char char-p1">p</span>
        <span className="splash-char char-u">u</span>
        <span className="splash-char char-m">m</span>
        <span className="splash-char char-p2">p</span>
        <span className="splash-char char-d">d</span>
        <span className="splash-char char-dot">.</span>
      </div>
    </div>
  )
}
