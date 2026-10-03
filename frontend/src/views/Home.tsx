import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useStore } from '../store/useStore'
import {
  effectiveRoutine,
  effectiveRoutineId,
  streakWeeks,
  lastBW,
  setsDoneActive,
} from '../lib/history'
import { fmtNum, fmtDate, todayISO, isoOf, weekKey, DAYS } from '../lib/format'
import { t, dateLocale } from '../lib/i18n'
import { getManagementOverview } from '../lib/api'
import {
  bwSheet,
  goalSheet,
  dayOverrideSheet,
  calendarSheet,
  startFlow,
  startAssignedRoutineFlow,
  startAssignedWorkoutFlow,
  loadStarterPlan,
  bwDeltaColor,
} from '../sheets'
import LineChart from '../components/LineChart'
import Icon from '../components/Icon'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Progress } from '../components/ui/progress'
import { cn } from '../lib/utils'
import { glyphOf } from '../lib/glyphs'

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
}

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
}

const statCardVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.34, 1.56, 0.64, 1],
    },
  },
}

function getGreeting() {
  const hour = new Date().getHours()
  return hour < 12 ? t('Good morning') : hour < 17 ? t('Good afternoon') : t('Good evening')
}

function prettySessionTime(value) {
  if (!value) return 'Today'
  return new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export default function Home() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const [weekOffset, setWeekOffset] = useState(0)
  const [managementData, setManagementData] = useState(null)

  useEffect(() => {
    if (!user?.id) return
    getManagementOverview().then(setManagementData).catch(() => {})
  }, [user?.id])

  const today = new Date()
  const todayKey = todayISO()
  const routine = effectiveRoutine(S, todayKey)
  const todayOvr = S.dayPlan[todayKey] !== undefined
  const trainerAssigned = !!managementData?.trainer || !!managementData?.trainingPlan
  const trainerPlan = managementData?.trainingPlan
  const trainerRoutine = trainerPlan
    ? (trainerPlan.routines || []).find(routine => routine.id === trainerPlan.week?.[today.getDay()])
    : null
  const trainerSchedule = trainerAssigned ? (managementData?.schedules || []).find(schedule => String(schedule.startAt || '').slice(0, 10) === todayKey) : null
  const trainerExercises = trainerRoutine?.ex || (trainerSchedule
    ? (managementData?.exercises || []).filter(exercise => !exercise.scheduleId || exercise.scheduleId === trainerSchedule.id)
    : [])
  const hasTrainerWorkout = !!(trainerRoutine || trainerSchedule)
  const bw = lastBW(S)
  const prevBW = S.bodyweight.length > 1 ? S.bodyweight[S.bodyweight.length - 2] : null
  const delta = bw && prevBW ? bw.w - prevBW.w : null
  const doneDays = new Set(S.workouts.map(w => w.d))

  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    const iso = isoOf(date)
    const effectiveId = effectiveRoutineId(S, iso)
    const override = S.dayPlan[iso] !== undefined
    const done = doneDays.has(iso)
    return {
      date,
      iso,
      done,
      planned: !!effectiveId,
      override,
      today: iso === todayKey,
    }
  })
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const wkLabel =
    weekOffset === 0
      ? t('This week')
      : `${monday.getDate()} ${monday.toLocaleDateString(dateLocale(), { month: 'short' })} – ${sunday.getDate()} ${sunday.toLocaleDateString(dateLocale(), { month: 'short' })}`

  const wThisWeek = S.workouts.filter(w => weekKey(w.d) === weekKey(todayKey)).length
  const plannedPerWeek = Object.keys(S.week).filter(k => S.week[k]).length
  const streak = streakWeeks(S)
  const bwPoints = S.bodyweight.slice(-30).map(b => ({
    t: new Date(b.d).getTime(),
    y: b.w,
    d: b.d,
  }))

  let goalPct = 0
  if (S.targetW && bw && S.bodyweight.length > 0) {
    const firstW = S.bodyweight[0].w
    const totalDist = Math.abs(firstW - S.targetW)
    const curDist = Math.abs(bw.w - S.targetW)
    if (totalDist > 0) {
      goalPct = Math.min(100, Math.max(0, Math.round(((totalDist - curDist) / totalDist) * 100)))
    }
  }

  const onTodayAction = () => {
    if (S.active) nav('/workout')
    else if (trainerRoutine) startAssignedRoutineFlow(trainerRoutine)
    else if (trainerSchedule) startAssignedWorkoutFlow(trainerExercises, trainerSchedule)
    else if (routine) startFlow(routine.id)
    else dayOverrideSheet(todayKey)
  }

  const activeSetsDone = S.active ? setsDoneActive(S.active) : 0
  const activeSetsTotal = S.active
    ? S.active.entries.reduce((acc, entry) => acc + (entry.sets ? entry.sets.length : 0), 0)
    : 0
  const displayName = user?.name || t('athlete')

  return (
    <motion.main 
      className="mx-auto w-full max-w-3xl space-y-5 sm:space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.header className="space-y-3 pt-1 sm:space-y-4 sm:pt-3" variants={itemVariants}>
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--label-3)]">{t('Your daily momentum')}</p>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => nav('/feed')} aria-label={t('Feed')}>
              <Icon name="users" className="text-[18px]" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => nav('/settings')} aria-label={t('Settings')}>
              <Icon name="gear" className="text-[18px]" />
            </Button>
          </div>
        </div>
        <div className="min-w-0">
          <h1 className="max-w-[32rem] break-words text-[clamp(1.8rem,8vw,2.65rem)] font-bold leading-[1.02] tracking-[-0.06em] text-[var(--label)]">
            {getGreeting()}, <span className="text-[var(--acc)]">{displayName}</span>
          </h1>
          <p className="mt-1.5 text-xs text-[var(--label-2)]">
            {today.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </motion.header>

      <motion.section 
        className="grid grid-cols-3 gap-2.5 sm:gap-3" 
        aria-label={t('Your progress')}
        variants={itemVariants}
      >
        <motion.button
          type="button"
          onClick={() => calendarSheet(todayKey)}
          className="group min-h-[112px] rounded-[24px] border border-white/[0.07] bg-[var(--surface)] p-3 text-left shadow-[0_14px_40px_-30px_rgba(0,0,0,0.9)] transition-transform duration-200 active:scale-[0.97] sm:p-4"
          variants={statCardVariants}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.97 }}
        >
          <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--orange)_15%,transparent)] text-[var(--orange)]">
            <Icon name="flame" className="text-[17px]" />
          </span>
          <span className="block text-xl font-bold tracking-[-0.05em] text-[var(--label)]">{streak}</span>
          <span className="mt-0.5 block truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--label-3)]">{t('Week Streak')}</span>
        </motion.button>
        <motion.button
          type="button"
          onClick={() => calendarSheet(todayKey)}
          className="group min-h-[112px] rounded-[24px] border border-white/[0.07] bg-[var(--surface)] p-3 text-left shadow-[0_14px_40px_-30px_rgba(0,0,0,0.9)] transition-transform duration-200 active:scale-[0.97] sm:p-4"
          variants={statCardVariants}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.97 }}
        >
          <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--acc-soft)] text-[var(--acc)]">
            <Icon name="dumbbell" className="text-[17px]" />
          </span>
          <span className="block text-xl font-bold tracking-[-0.05em] text-[var(--label)]">
            {wThisWeek}<span className="text-sm font-medium text-[var(--label-3)]">{plannedPerWeek ? `/${plannedPerWeek}` : ''}</span>
          </span>
          <span className="mt-0.5 block truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--label-3)]">{t('This Week')}</span>
        </motion.button>
        <motion.button
          type="button"
          onClick={() => bwSheet()}
          className="group min-h-[112px] rounded-[24px] border border-white/[0.07] bg-[var(--surface)] p-3 text-left shadow-[0_14px_40px_-30px_rgba(0,0,0,0.9)] transition-transform duration-200 active:scale-[0.97] sm:p-4"
          variants={statCardVariants}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.97 }}
        >
          <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--teal)_15%,transparent)] text-[var(--teal)]">
            <Icon name="chartLine" className="text-[17px]" />
          </span>
          <span className="block text-xl font-bold tracking-[-0.05em] text-[var(--label)]">{bw ? fmtNum(bw.w) : '—'}</span>
          <span className="mt-0.5 block truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--label-3)]">{S.unit || 'kg'}</span>
        </motion.button>
      </motion.section>

      <Card
        className={cn(
          'relative overflow-hidden border-[var(--sep-op)] bg-[linear-gradient(135deg,var(--surface)_0%,color-mix(in_srgb,var(--surface)_78%,var(--acc)_22%)_100%)] p-5 sm:p-7',
          S.active && 'bg-[linear-gradient(135deg,var(--surface)_0%,color-mix(in_srgb,var(--surface)_75%,var(--orange)_25%)_100%)]',
        )}
      >
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
        >
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[var(--acc-soft)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-16 h-48 w-48 rounded-full bg-[color-mix(in_srgb,var(--purple)_13%,transparent)] blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <Badge className={cn(S.active && 'border-[color-mix(in_srgb,var(--orange)_35%,transparent)] bg-[color-mix(in_srgb,var(--orange)_15%,transparent)] text-[var(--orange)]')}>
              {S.active ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--orange)]" /> : <Icon name={hasTrainerWorkout ? 'figureStrength' : routine ? glyphOf(routine.emoji) : 'moon'} className="text-[13px]" />}
              {S.active ? t('Workout in Progress') : hasTrainerWorkout ? t('Trainer assignment') : routine ? t("Today's Session") : t('Rest & Recovery')}
            </Badge>
            {todayOvr && routine && <span className="text-[11px] font-medium text-[var(--label-3)]">{t('Rescheduled')}</span>}
          </div>
          <h2 className="mt-5 max-w-[18ch] text-[clamp(1.8rem,8vw,2.8rem)] font-bold leading-[0.98] tracking-[-0.065em] text-[var(--label)]">
            {S.active ? S.active.name : trainerRoutine?.name || trainerSchedule?.title || routine?.name || t('Rest Day')}
          </h2>
          <p className="mt-3 max-w-[42ch] text-sm leading-5 text-[var(--label-2)]">
            {S.active
              ? t('Set {0} of {1} completed · Tap to resume your session', activeSetsDone, activeSetsTotal)
              : hasTrainerWorkout
                ? t('{0} exercises assigned by {1}', trainerExercises.length, managementData.trainer?.name || t('your trainer'))
                : routine
                  ? t('{0} exercises planned for today', (routine.ex || []).length)
                  : t('No routine scheduled today. Rest up or swap in a workout.')}
          </p>
          {(hasTrainerWorkout || (routine && !S.active)) && (
            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--label-2)]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--label)_6%,transparent)] px-2.5 py-1.5"><Icon name="list" className="text-[14px] text-[var(--acc)]" />{t('{0} exercises', hasTrainerWorkout ? trainerExercises.length : (routine?.ex || []).length)}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--label)_6%,transparent)] px-2.5 py-1.5"><Icon name="timer" className="text-[14px] text-[var(--teal)]" />{trainerRoutine ? t('Today') : trainerSchedule ? prettySessionTime(trainerSchedule.startAt) : '~45 min'}</span>
            </div>
          )}
          <Button
            size="lg"
            variant={S.active ? 'destructive' : 'default'}
            className="mt-6 w-full sm:w-auto sm:min-w-[190px]"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTodayAction();
            }}
          >
            <Icon name={S.active ? 'play' : hasTrainerWorkout || routine ? 'play' : 'calendar'} className="text-[17px]" />
            {S.active ? t('Resume Workout') : hasTrainerWorkout ? t('Start Trainer Workout') : routine ? t('Start Workout') : t('Schedule a Workout')}
          </Button>
        </div>
        </motion.div>
      </Card>

      <motion.div variants={itemVariants}>
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--label-3)]">{t('Your rhythm')}</p>
              <h2 className="mt-1 text-base font-semibold tracking-[-0.025em] text-[var(--label)]">{wkLabel}</h2>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setWeekOffset(value => value - 1)} aria-label={t('Previous week')}>
                <Icon name="chevronLeft" className="text-[16px]" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setWeekOffset(value => value + 1)} aria-label={t('Next week')}>
                <Icon name="chevronRight" className="text-[16px]" />
              </Button>
            </div>
          </div>
        <div className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-2">
          {weekDays.map(day => (
            <button
              type="button"
              key={day.iso}
              onClick={() => dayOverrideSheet(day.iso)}
              className={cn(
                'flex min-w-0 flex-col items-center rounded-2xl px-1 py-2.5 text-center transition-all duration-200 active:scale-95',
                day.today ? 'bg-[var(--acc)] text-[var(--on-acc)] shadow-[0_8px_20px_-12px_var(--acc)]' : 'hover:bg-[var(--surface-2)]',
              )}
              aria-label={day.iso}
            >
              <span className={cn('text-[10px] font-bold uppercase tracking-[0.08em]', day.today ? 'opacity-80' : 'text-[var(--label-3)]')}>{t(DAYS[day.date.getDay()])}</span>
              <span className={cn('mt-2 text-sm font-semibold', day.today ? '' : 'text-[var(--label)]')}>{day.date.getDate()}</span>
              <span className="mt-2 flex h-1.5 items-center justify-center">
                <span className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  day.today ? 'bg-[var(--on-acc)]' : day.done ? 'bg-[var(--acc)] shadow-[0_0_8px_var(--acc)]' : day.override && day.planned ? 'bg-[var(--orange)]' : day.planned ? 'bg-[var(--label-3)]' : 'bg-transparent',
                )} />
              </span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-[var(--label-3)]">
          <span className="inline-flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-[var(--acc)]" />{t('Completed')}</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-[var(--label-3)]" />{t('Planned')}</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-[var(--orange)]" />{t('Moved')}</span>
        </div>
      </Card>
      </motion.div>

      <motion.section variants={itemVariants}>
        <div className="mb-3 flex items-end justify-between px-1">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--label-3)]">{t('Keep the momentum')}</p>
            <h2 className="mt-1 text-lg font-bold tracking-[-0.04em] text-[var(--label)]">{t('Quick actions')}</h2>
          </div>
          <Icon name="sparkles" className="text-[var(--acc)]" />
        </div>
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <motion.button 
            type="button" 
            onClick={() => nav('/plan')} 
            className="group rounded-[22px] border border-[var(--sep-op)] bg-[var(--surface)] p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--acc-line)] active:scale-[0.97] sm:p-4"
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.97 }}
          >
            <span className="mb-8 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--acc-soft)] text-[var(--acc)]"><Icon name="calendar" className="text-[17px]" /></span>
            <span className="block text-xs font-bold text-[var(--label)]">{t('Plan')}</span>
            <span className="mt-1 block text-[10px] leading-4 text-[var(--label-3)]">{t('Build your split')}</span>
          </motion.button>
          <motion.button 
            type="button" 
            onClick={() => bwSheet()} 
            className="group rounded-[22px] border border-[var(--sep-op)] bg-[var(--surface)] p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--teal)_35%,transparent)] active:scale-[0.97] sm:p-4"
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.97 }}
          >
            <span className="mb-8 flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--teal)_15%,transparent)] text-[var(--teal)]"><Icon name="scale" className="text-[17px]" /></span>
            <span className="block text-xs font-bold text-[var(--label)]">{t('Log weight')}</span>
            <span className="mt-1 block text-[10px] leading-4 text-[var(--label-3)]">{t('Track the trend')}</span>
          </motion.button>
          <motion.button 
            type="button" 
            onClick={() => nav('/library')} 
            className="group rounded-[22px] border border-[var(--sep-op)] bg-[var(--surface)] p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--purple)_35%,transparent)] active:scale-[0.97] sm:p-4"
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.97 }}
          >
            <span className="mb-8 flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--purple)_15%,transparent)] text-[var(--purple)]"><Icon name="list" className="text-[17px]" /></span>
            <span className="block text-xs font-bold text-[var(--label)]">{t('Library')}</span>
            <span className="mt-1 block text-[10px] leading-4 text-[var(--label-3)]">{t('Find a move')}</span>
          </motion.button>
        </div>
      </motion.section>

      {!trainerAssigned && !S.routines.length && !S.active && (
        <motion.div variants={cardVariants}>
          <Card className="relative overflow-hidden border-[var(--acc-line)] bg-[linear-gradient(135deg,var(--acc-soft),transparent)] p-5 sm:p-6">
          <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[var(--acc-soft)] blur-2xl" />
          <div className="relative flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--acc)] text-[var(--on-acc)] shadow-[0_10px_24px_-10px_var(--acc)]"><Icon name="sparkles" /></span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold tracking-[-0.04em] text-[var(--label)]">{t('Welcome to pumpd!')}</h2>
              <p className="mt-1 text-sm leading-5 text-[var(--label-2)]">{t('Set up your weekly routine to get going — or load a ready-made Push / Pull / Legs plan.')}</p>
            </div>
          </div>
          <div className="relative mt-5 grid gap-2 sm:grid-cols-2">
            <><Button onClick={loadStarterPlan} className="w-full"><Icon name="sparkles" className="text-[16px]" />{t('Load starter plan (PPL)')}</Button><Button variant="secondary" onClick={() => nav('/plan')} className="w-full">{t('Build my own plan')}</Button></>
          </div>
        </Card>
        </motion.div>
      )}

      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--label-3)]">{t('Body weight')}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-[-0.06em] text-[var(--label)]">{bw ? fmtNum(bw.w) : '—'}</span>
              <span className="text-sm font-medium text-[var(--label-3)]">{S.unit}</span>
              {!!delta && (
                <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2 py-1 text-[11px] font-semibold" style={{ color: bwDeltaColor(delta, bw.w) }}>
                  <Icon name={delta > 0 ? 'arrowUp' : 'arrowDown'} className="text-[11px]" />{fmtNum(Math.abs(delta))}
                </span>
              )}
            </div>
            {bw && <p className="mt-1 text-[11px] text-[var(--label-3)]">{fmtDate(bw.d, true)}</p>}
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={goalSheet} className={cn(S.targetW && 'text-[var(--yellow)]')}><Icon name="target" className="text-[14px]" />{S.targetW ? fmtNum(S.targetW) : t('Goal')}</Button>
            <Button size="sm" onClick={() => bwSheet()}><Icon name="plus" className="text-[14px]" />{t('Log')}</Button>
          </div>
        </div>
        {bw && S.targetW && (
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-medium text-[var(--yellow)]">
              <span className="inline-flex items-center gap-1.5"><Icon name="target" className="text-[13px]" />{t('Goal')}: {fmtNum(S.targetW)} {S.unit}</span>
              <span>{Math.abs(S.targetW - bw.w) < 0.05 ? t('reached!') : t(S.targetW > bw.w ? '{0} to gain' : '{0} to lose', `${fmtNum(Math.abs(S.targetW - bw.w))} ${S.unit}`)}</span>
            </div>
            <Progress value={goalPct} />
          </div>
        )}
        {bw ? (
          <div className="chart mt-4 min-h-[130px]">
            <LineChart points={bwPoints} h={130} unit={S.unit} goal={S.targetW} />
          </div>
        ) : (
          <div className="mt-6 rounded-2xl bg-[var(--surface-2)] px-4 py-5 text-sm leading-5 text-[var(--label-2)]">{t("No entries yet — log your weight to start the curve. It's also asked before every workout.")}</div>
        )}
      </Card>
      </motion.div>
    </motion.main>
  )
}
