import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { effectiveRoutine } from '../lib/history'
import { todayISO } from '../lib/format'
import { t } from '../lib/i18n'
import { getManagementOverview } from '../lib/api'
import { startAssignedRoutineFlow } from '../sheets'
import Icon from './Icon'

export default function TabBar({ onStart }) {
  const nav = useNavigate()
  const loc = useLocation()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const isGuest = useStore(s => s.isGuest())
  const [managementData, setManagementData] = useState(null)

  useEffect(() => {
    if (user?.role !== 'member') {
      setManagementData(null)
      return
    }
    getManagementOverview().then(setManagementData).catch(() => setManagementData(null))
  }, [user?.id, user?.role])

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
      const assignedPlan = user?.role === 'member' ? managementData?.trainingPlan : null
      const assignedRoutine = assignedPlan
        ? (assignedPlan.routines || []).find(routine => routine.id === assignedPlan.week?.[new Date().getDay()])
        : null
      if (assignedRoutine) {
        startAssignedRoutineFlow(assignedRoutine)
        return
      }
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
  const isStaff = !!user && (user.admin || user.role === 'owner' || user.role === 'trainer')

  const Tab = ({ k, icon, to, label }) => (
    <button
      type="button"
      className={on(k) ? 'on' : ''}
      onClick={() => nav(to)}
      aria-label={label}
      aria-current={on(k) ? 'page' : undefined}
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
      {isStaff
        ? <Tab k="management" icon="wrench" to="/management" label={t('Manage')} />
        : <Tab k="library" icon="list" to="/library" label={t('Library')} />}
    </nav>
  )
}
