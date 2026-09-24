import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import {
  effectiveRoutine,
  effectiveRoutineId,
  streakWeeks,
  lastBW,
  setsDoneActive
} from '../lib/history'
import { fmtNum, fmtDate, todayISO, isoOf, weekKey, DAYS } from '../lib/format'
import { t, dateLocale } from '../lib/i18n'
import {
  bwSheet,
  goalSheet,
  dayOverrideSheet,
  calendarSheet,
  startFlow,
  loadStarterPlan,
  bwDeltaColor
} from '../sheets'
import LineChart from '../components/LineChart'
import Icon from '../components/Icon'
import { Button } from '../components/ui'
import { glyphOf } from '../lib/glyphs'

function getGreeting(name) {
  const hour = new Date().getHours()
  const part = hour < 12 ? t('Good morning') : hour < 17 ? t('Good afternoon') : t('Good evening')
  return name ? `${part}, ${name}` : part
}

export default function Home() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const [weekOffset, setWeekOffset] = useState(0)

  const today = new Date()
  const routine = effectiveRoutine(S, todayISO())
  const todayOvr = S.dayPlan[todayISO()] !== undefined
  const bw = lastBW(S)
  const prevBW = S.bodyweight.length > 1 ? S.bodyweight[S.bodyweight.length - 2] : null
  const delta = bw && prevBW ? bw.w - prevBW.w : null

  // 7-day week strip
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7)
  const doneDays = new Set(S.workouts.map(w => w.d))
  const strip = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const iso = isoOf(d)
    const eff = effectiveRoutineId(S, iso)
    const ovr = S.dayPlan[iso] !== undefined
    const done = doneDays.has(iso)
    const dot = done ? ' done' : ovr && eff ? ' ovr' : eff ? ' plan' : ''
    strip.push(
      <div
        key={i}
        className={'wday' + (iso === todayISO() ? ' today' : '')}
        onClick={() => dayOverrideSheet(iso)}
      >
        <div className="lbl">{t(DAYS[d.getDay()])}</div>
        <div className="num">{d.getDate()}</div>
        <div className={'dot' + dot} />
      </div>
    )
  }
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const wkLabel =
    weekOffset === 0
      ? t('This week')
      : `${monday.getDate()} ${monday.toLocaleDateString(dateLocale(), { month: 'short' })} – ${sunday.getDate()} ${sunday.toLocaleDateString(dateLocale(), { month: 'short' })}`

  const wThisWeek = S.workouts.filter(w => weekKey(w.d) === weekKey(todayISO())).length
  const plannedPerWeek = Object.keys(S.week).filter(k => S.week[k]).length
  const streak = streakWeeks(S)
  const bwPoints = S.bodyweight.slice(-30).map(b => ({
    t: b.t || new Date(b.d).getTime(),
    y: b.w,
    d: b.d
  }))

  // Goal progress calculation
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
    else if (routine) startFlow(routine.id)
    else dayOverrideSheet(todayISO())
  }

  const activeSetsDone = S.active ? setsDoneActive(S.active) : 0
  const activeSetsTotal = S.active
    ? S.active.entries.reduce((acc, e) => acc + (e.sets ? e.sets.length : 0), 0)
    : 0

  return (
    <div className="narrow">
      {/* Header */}
      <div className="hdr" style={{ marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 750 }}>
            {user?.name ? (
              <>
                {getGreeting(null)}, <span style={{ color: 'var(--acc)' }}>{user.name}</span>
              </>
            ) : (
              getGreeting(user?.name)
            )}
          </h1>
          <div className="sub" style={{ fontSize: 13.5, marginTop: 2 }}>
            {today.toLocaleDateString(dateLocale(), {
              weekday: 'long',
              day: 'numeric',
              month: 'long'
            })}
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button
            className="iconbtn"
            onClick={() => nav('/feed')}
            aria-label={t('Feed')}
            title={t('Feed')}
          >
            <Icon name="users" />
          </button>
          <button
            className="iconbtn"
            onClick={() => nav('/settings')}
            aria-label={t('Settings')}
          >
            <Icon name="gear" />
          </button>
        </div>
      </div>

      {/* Top 3 Stat Highlights */}
      <div className="home-stats-row">
        <div
          className="home-stat-card"
          onClick={() => calendarSheet()}
          style={{ cursor: 'pointer' }}
        >
          <span className="home-stat-icon" style={{ color: 'var(--orange)' }}>
            <Icon name="flame" />
          </span>
          <div className="home-stat-val">{streak}</div>
          <div className="home-stat-lbl">{t('Week Streak')}</div>
        </div>

        <div
          className="home-stat-card"
          onClick={() => calendarSheet()}
          style={{ cursor: 'pointer' }}
        >
          <span className="home-stat-icon" style={{ color: 'var(--acc)' }}>
            <Icon name="dumbbell" />
          </span>
          <div className="home-stat-val">
            {wThisWeek}
            {plannedPerWeek ? `/${plannedPerWeek}` : ''}
          </div>
          <div className="home-stat-lbl">{t('This Week')}</div>
        </div>

        <div
          className="home-stat-card"
          onClick={() => bwSheet()}
          style={{ cursor: 'pointer' }}
        >
          <span className="home-stat-icon" style={{ color: 'var(--teal)' }}>
            <Icon name="chartLine" />
          </span>
          <div className="home-stat-val">
            {bw ? `${fmtNum(bw.w)}` : '—'}
          </div>
          <div className="home-stat-lbl">{S.unit || 'kg'}</div>
        </div>
      </div>

      {/* Featured Workout Hero Card */}
      <div className={`home-hero ${S.active ? 'active-workout' : ''}`}>
        <div className="home-hero-glow" />

        <div className="home-hero-head">
          <div className="home-hero-badge">
            {S.active ? (
              <>
                <span className="live-pulse-dot" />
                <span>{t('Workout in Progress')}</span>
              </>
            ) : routine ? (
              <>
                <Icon name={glyphOf(routine.emoji)} />
                <span>{t("Today's Session")}</span>
              </>
            ) : (
              <>
                <Icon name="moon" />
                <span>{t('Rest & Recovery')}</span>
              </>
            )}
          </div>

          {todayOvr && routine && (
            <span className="dim small" style={{ fontSize: 11.5 }}>
              {t('Rescheduled')}
            </span>
          )}
        </div>

        <h2 className="home-hero-title">
          {S.active
            ? S.active.name
            : routine
            ? routine.name
            : t('Rest Day')}
        </h2>

        <p className="home-hero-desc">
          {S.active
            ? t('Set {0} of {1} completed · Tap to resume your session', activeSetsDone, activeSetsTotal)
            : routine
            ? t('{0} exercises planned for today', (routine.ex || []).length)
            : t('No routine scheduled today. Rest up or swap in a workout.')}
        </p>

        {routine && !S.active && (
          <div className="home-hero-meta">
            <div className="home-hero-meta-item">
              <Icon name="list" />
              <span>{t('{0} exercises', (routine.ex || []).length)}</span>
            </div>
            <div className="home-hero-meta-item">
              <Icon name="timer" />
              <span>~45 min</span>
            </div>
          </div>
        )}

        <Button
          variant={S.active ? 'danger' : 'primary'}
          icon={S.active ? 'play' : routine ? 'play' : 'calendar'}
          onClick={onTodayAction}
          style={{
            width: '100%',
            height: 46,
            fontSize: 15,
            fontWeight: 600,
            background: S.active ? 'var(--orange)' : undefined,
            color: S.active ? '#000' : undefined
          }}
        >
          {S.active
            ? t('Resume Workout')
            : routine
            ? t('Start Workout')
            : t('Schedule a Workout')}
        </Button>
      </div>

      {/* 7-Day Timeline Card */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row between" style={{ marginBottom: 8 }}>
          <button
            className="iconbtn"
            style={{ width: 28, height: 28, fontSize: 13 }}
            onClick={() => setWeekOffset(w => w - 1)}
            aria-label="Previous week"
          >
            <Icon name="chevronLeft" />
          </button>
          <div className="small muted" style={{ fontWeight: 600, fontSize: 13 }}>
            {wkLabel}
          </div>
          <button
            className="iconbtn"
            style={{ width: 28, height: 28, fontSize: 13 }}
            onClick={() => setWeekOffset(w => w + 1)}
            aria-label="Next week"
          >
            <Icon name="chevronRight" />
          </button>
        </div>
        <div className="week">{strip}</div>
      </div>

      {/* Starter Plan Prompt (for fresh profiles) */}
      {!S.routines.length && !S.active && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="row" style={{ gap: 10, marginBottom: 6 }}>
            <span className="lrow-i">
              <Icon name="sparkles" />
            </span>
            <div className="big" style={{ fontSize: 20 }}>
              {t('Welcome to pumpd!')}
            </div>
          </div>
          <div className="muted small" style={{ marginBottom: 12 }}>
            {t(
              'Set up your weekly routine to get going — or load a ready-made Push / Pull / Legs plan.'
            )}
          </div>
          <Button variant="primary" icon="sparkles" onClick={loadStarterPlan}>
            {t('Load starter plan (PPL)')}
          </Button>
          <div style={{ height: 8 }} />
          <Button onClick={() => nav('/plan')}>{t('Build my own plan')}</Button>
        </div>
      )}

      {/* Body Weight & Trend Card */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row between" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {t('Body weight')}
          </h2>
          <div className="row" style={{ gap: 6 }}>
            <Button
              size="sm"
              icon="target"
              style={S.targetW ? { color: 'var(--yellow)' } : undefined}
              onClick={goalSheet}
            >
              {S.targetW ? fmtNum(S.targetW) : t('Goal')}
            </Button>
            <Button size="sm" icon="plus" onClick={() => bwSheet()}>
              {t('Log')}
            </Button>
          </div>
        </div>

        {bw ? (
          <>
            <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
              <div className="big" style={{ fontSize: 28, fontWeight: 750 }}>
                {fmtNum(bw.w)}{' '}
                <span className="muted" style={{ fontSize: '1rem', fontWeight: 500 }}>
                  {S.unit}
                </span>
              </div>
              {!!delta && (
                <span
                  className="small row"
                  style={{
                    gap: 3,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: 'var(--surface-2)',
                    color: bwDeltaColor(delta, bw.w)
                  }}
                >
                  <Icon name={delta > 0 ? 'arrowUp' : 'arrowDown'} style={{ fontSize: 11 }} />
                  {fmtNum(Math.abs(delta))} {S.unit}
                </span>
              )}
              <span className="dim small" style={{ marginLeft: 'auto', fontSize: 12 }}>
                {fmtDate(bw.d, true)}
              </span>
            </div>

            {S.targetW && (
              <div style={{ marginTop: 8 }}>
                <div className="small row between" style={{ color: 'var(--yellow)', fontSize: 12.5, fontWeight: 500 }}>
                  <span className="row" style={{ gap: 4 }}>
                    <Icon name="target" style={{ fontSize: 13 }} />
                    <span>
                      {t('Goal')}: {fmtNum(S.targetW)} {S.unit}
                    </span>
                  </span>
                  <span>
                    {Math.abs(S.targetW - bw.w) < 0.05
                      ? t('reached!')
                      : t(
                          S.targetW > bw.w ? '{0} to gain' : '{0} to lose',
                          `${fmtNum(Math.abs(S.targetW - bw.w))} ${S.unit}`
                        )}
                  </span>
                </div>
                <div className="home-goal-progress">
                  <div className="home-goal-fill" style={{ width: `${goalPct}%` }} />
                </div>
              </div>
            )}

            <div className="chart" style={{ marginTop: 10 }}>
              <LineChart points={bwPoints} h={130} unit={S.unit} goal={S.targetW} />
            </div>
          </>
        ) : (
          <div className="muted small" style={{ padding: '8px 0', lineHeight: 1.45 }}>
            {t(
              "No entries yet — log your weight to start the curve. It's also asked before every workout."
            )}
          </div>
        )}
      </div>
    </div>
  )
}
