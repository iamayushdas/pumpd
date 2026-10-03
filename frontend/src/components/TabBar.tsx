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
  const update = useStore(s => s.update)
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

  const togglePauseResume = () => {
    if (S.active) {
      update(s => {
        if (s.active.paused) {
          // Resume: adjust start time to account for paused duration
          const pausedDuration = Date.now() - s.active.pausedTime
          s.active.start = s.active.start + pausedDuration
          s.active.paused = false
          s.active.pausedTime = null
        } else {
          // Pause: record the time when paused
          s.active.paused = true
          s.active.pausedTime = Date.now()
        }
      })
    }
  }

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
    // Only navigate if not already on the workout page
    if (cur !== 'workout') {
      nav('/workout')
    }
  }

  const handleCenterButton = () => {
    if (cur === 'feed') {
      nav('/new-post')
    } else if (S.active && cur === 'workout') {
      // On workout page with active workout: toggle pause/resume
      togglePauseResume()
    } else {
      // Start new workout or navigate to workout page
      startWorkout()
    }
  }

  const isFeedPage = cur === 'feed'
  const isStaff = !!user && (user.admin || user.role === 'owner' || user.role === 'trainer')
  const isWorkoutPage = cur === 'workout'
  
  // Determine button icon and label based on state
  let centerIcon = 'dumbbell'
  let centerLabel = t('Start')
  let centerAriaLabel = t('Start Workout')
  
  if (isFeedPage) {
    centerIcon = 'plus'
    centerLabel = t('Post')
    centerAriaLabel = t('New Post')
  } else if (S.active) {
    if (isWorkoutPage && S.active.paused) {
      centerIcon = 'play'
      centerLabel = t('Resume')
      centerAriaLabel = t('Resume Workout')
    } else if (isWorkoutPage && !S.active.paused) {
      centerIcon = 'pause'
      centerLabel = t('Pause')
      centerAriaLabel = t('Pause Workout')
    } else {
      // Active workout but not on workout page - navigate to workout
      centerIcon = 'play'
      centerLabel = t('Resume')
      centerAriaLabel = t('Resume Workout')
    }
  }

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
        aria-label={centerAriaLabel}
      >
        <span className="cir">
          <Icon name={centerIcon} />
        </span>
        <span className="lbl">{centerLabel}</span>
      </button>

      <Tab k="stats" icon="chart" to="/stats" label={t('Stats')} />
      {isStaff
        ? <Tab k="management" icon="wrench" to="/management" label={t('Manage')} />
        : <Tab k="library" icon="list" to="/library" label={t('Library')} />}
    </nav>
  )
}
