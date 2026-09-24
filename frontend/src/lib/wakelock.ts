// Screen Wake Lock — keeps the display on while a workout is running, so nobody has to
// unlock their phone between sets.
//
// The browser drops the lock on its own whenever the document stops being visible (tab
// switch, app backgrounded, screen locked by hand). A one-shot request therefore works
// exactly once and then silently dies, which is why `wanted` is kept as our own intent
// and the lock is re-acquired on every visibilitychange for as long as it holds.
import { useEffect } from 'react'

export const wakeLockSupported = (): boolean => 'wakeLock' in navigator

let sentinel: WakeLockSentinel | null = null
let wanted = false
let pending = false

async function acquire() {
  if (!wanted || sentinel || pending || !wakeLockSupported()) return
  if (document.visibilityState !== 'visible') return
  pending = true
  try {
    const s = await navigator.wakeLock.request('screen')
    if (!wanted) { s.release().catch(() => {}); return }
    sentinel = s
    s.addEventListener('release', () => { if (sentinel === s) sentinel = null })
  } catch (e) {
    sentinel = null
  } finally { pending = false }
}

const onVisible = () => { if (document.visibilityState === 'visible') acquire() }

export function requestWakeLock() {
  if (wanted) return
  wanted = true
  document.addEventListener('visibilitychange', onVisible)
  acquire()
}

export function releaseWakeLock() {
  wanted = false
  document.removeEventListener('visibilitychange', onVisible)
  const s = sentinel
  sentinel = null
  if (s) s.release().catch(() => {})
}

// Holds the lock for as long as `enabled` stays true.
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    requestWakeLock()
    return releaseWakeLock
  }, [enabled])
}
