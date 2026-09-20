import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutine } from '../lib/history.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'

export default function TabBar({ onStart }) {
  const nav = useNavigate()
  const loc = useLocation()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const isGuest = useStore(s => s.isGuest())
  if (!user && !isGuest) return null

  const cur = loc.pathname.split('/')[1] || 'home'
  const on = k =>
    cur === k ||
    (cur === 'history' && k === 'stats') ||
    (cur === 'new-post' && k === 'library') ||
    (cur === 'profile' && k === 'library') ||
    (cur === 'discover' && k === 'library') ||
    (cur === 'handle-setup' && k === 'library') ||
    (cur === 'library' && k === 'home') ||
    (cur === 'settings' && k === 'home')

  const startWorkout = () => {
    if (!S.active) {
      const r = effectiveRoutine(S, todayISO())
      if (r && r.ex.length) {
        onStart(r.id)
        return
      }
    }
    nav('/workout')
  }

  const handleCenterButton = () => {
    if (cur === 'feed') {
      nav('/new-post')
    } else {
      startWorkout()
    }
  }

  const isFeedPage = cur === 'feed'

  const Tab = ({ k, icon, to, label }) => (
    <button
      type="button"
      className={on(k) ? 'on' : ''}
      onClick={() => nav(to)}
      aria-label={label}
    >
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  )

  return (
    <nav id="tabbar" aria-label="Main Navigation">
      <Tab k="home" icon="house" to="/home" label={t('Home')} />
      <Tab k="plan" icon="calendar" to="/plan" label={t('Plan')} />

      <button
        type="button"
        className={'start' + (S.active && !isFeedPage ? ' rec' : '')}
        onClick={handleCenterButton}
        aria-label={isFeedPage ? t('New Post') : (S.active ? t('Resume Workout') : t('Start Workout'))}
      >
        <span className="cir">
          <Icon name={isFeedPage ? 'plus' : (S.active ? 'play' : 'dumbbell')} />
        </span>
        <span className="lbl">{isFeedPage ? t('Post') : (S.active ? t('Resume') : t('Start'))}</span>
      </button>

      <Tab k="stats" icon="chart" to="/stats" label={t('Stats')} />
      <Tab k="library" icon="list" to="/library" label={t('Library')} />
    </nav>
  )
}
