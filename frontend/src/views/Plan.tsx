import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { DAYN, uid, exCount } from '../lib/format'
import { t } from '../lib/i18n'
import { dayAssignSheet, loadStarterPlan, planToolsSheet, startFlow, confirmSheet } from '../sheets'
import Icon from '../components/Icon'
import { Button } from '../components/ui'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs'
import { EXIDX } from '../lib/exercises'
import { POLICY_NAME } from '../lib/progression'

export default function Plan() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const [tab, setTab] = useState('schedule') // 'schedule' | 'routines'

  const addRoutine = () => {
    const r = { id: uid(), name: t('New routine'), emoji: DEFAULT_GLYPH, ex: [] }
    update(s => {
      s.routines.push(r)
    })
    nav('/plan/r/' + r.id)
  }

  // Calculate stats
  const activeDays = Object.values(S.week || {}).filter(Boolean).length
  const restDays = 7 - activeDays
  const totalRoutines = S.routines.length

  // Extract unique muscle groups trained in routines
  const getRoutineMuscles = r => {
    const set = new Set()
    ;(r.ex || []).forEach(e => {
      const ex = EXIDX[e.id]
      if (ex?.tg) set.add(ex.tg)
      else if (ex?.bp) set.add(ex.bp)
    })
    return Array.from(set).slice(0, 4)
  }

  const loadUpperLower = () => {
    confirmSheet({
      title: t('Load Upper / Lower Split?'),
      text: t('This will add Upper Body and Lower Body routines to your plan.'),
      confirm: t('Load Split'),
      onConfirm: () => {
        const upper = {
          id: uid(),
          name: 'Upper Body',
          emoji: 'barbell',
          ex: [
            { id: '0025', sets: 4, reps: 8, weight: 0 },
            { id: '2330', sets: 4, reps: 10, weight: 0 },
            { id: '0047', sets: 3, reps: 10, weight: 0 },
            { id: '0027', sets: 3, reps: 10, weight: 0 },
            { id: '0334', sets: 3, reps: 12, weight: 0 }
          ]
        }
        const lower = {
          id: uid(),
          name: 'Lower Body',
          emoji: 'legs',
          ex: [
            { id: '0043', sets: 4, reps: 8, weight: 0 },
            { id: '0085', sets: 3, reps: 10, weight: 0 },
            { id: '0739', sets: 3, reps: 12, weight: 0 },
            { id: '0585', sets: 3, reps: 12, weight: 0 }
          ]
        }
        update(s => {
          s.routines.push(upper, lower)
          s.week[1] = upper.id // Mon
          s.week[2] = lower.id // Tue
          s.week[4] = upper.id // Thu
          s.week[5] = lower.id // Fri
        })
      }
    })
  }

  return (
    <div className="narrow">
      {/* Header */}
      <div className="hdr" style={{ marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 750 }}>{t('Weekly Plan')}</h1>
          <div className="sub" style={{ fontSize: 13.5, marginTop: 2 }}>
            {t('Your training split & routines')}
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button
            className="iconbtn"
            onClick={planToolsSheet}
            aria-label={t('Share your plan')}
            title={t('Share your plan')}
          >
            <Icon name="upload" />
          </button>
        </div>
      </div>

      {/* Program Summary Card */}
      <div className="plan-overview-card">
        <div className="row between">
          <div>
            <div style={{ fontSize: 13, color: 'var(--label-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.03em' }}>
              {t('TRAINING SCHEDULE')}
            </div>
            <div style={{ fontSize: 20, fontWeight: 750, marginTop: 2 }}>
              {activeDays} {t('Training Days')} · {restDays} {t('Rest')}
            </div>
          </div>
          <span className="plan-pill acc" style={{ fontSize: 13 }}>
            {totalRoutines} {t('Routines')}
          </span>
        </div>

        <div className="plan-stat-pills">
          <span className="plan-pill">
            <Icon name="dumbbell" style={{ color: 'var(--acc)' }} />
            {activeDays * 4} {t('estimated sets/wk')}
          </span>
          <span className="plan-pill">
            <Icon name="calendar" style={{ color: 'var(--orange)' }} />
            {t('Weekly Cycle')}
          </span>
          <span className="plan-pill">
            <Icon name="chartLine" style={{ color: 'var(--teal)' }} />
            {t('Linear & Auto Deload')}
          </span>
        </div>
      </div>

      {/* Tab Segment Switcher */}
      <div className="login-tab-seg" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={`login-tab-btn ${tab === 'schedule' ? 'active' : ''}`}
          onClick={() => setTab('schedule')}
        >
          <Icon name="calendar" />
          <span>{t('7-Day Schedule')}</span>
        </button>
        <button
          type="button"
          className={`login-tab-btn ${tab === 'routines' ? 'active' : ''}`}
          onClick={() => setTab('routines')}
        >
          <Icon name="list" />
          <span>{t('Routines ({0})', totalRoutines)}</span>
        </button>
      </div>

      {tab === 'schedule' ? (
        /* 7-Day Schedule View */
        <div>
          <div className="row between" style={{ marginBottom: 10 }}>
            <h4 className="sec" style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: '.02em' }}>
              {t('WEEKDAY ASSIGNMENTS')}
            </h4>
            <span className="dim small" style={{ fontSize: 12 }}>
              {t('Tap any day to change')}
            </span>
          </div>

          <div style={{ marginBottom: 20 }}>
            {[1, 2, 3, 4, 5, 6, 0].map(d => {
              const r = S.routines.find(x => x.id === S.week[d])
              return (
                <div
                  key={d}
                  className="plan-day-item"
                  onClick={() => dayAssignSheet(d)}
                >
                  <div className="plan-day-tag">{t(DAYN[d].slice(0, 3))}</div>

                  <div className="grow" style={{ minWidth: 0 }}>
                    {r ? (
                      <div className="plan-routine-pill active">
                        <Icon name={glyphOf(r.emoji)} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.name}
                        </span>
                      </div>
                    ) : (
                      <div className="plan-routine-pill rest">
                        <Icon name="moon" />
                        <span>{t('Rest & Recovery')}</span>
                      </div>
                    )}
                  </div>

                  {r && (
                    <span className="dim small" style={{ fontSize: 12 }}>
                      {exCount((r.ex || []).length)}
                    </span>
                  )}

                  <Icon name="chevronRight" className="chev" style={{ fontSize: 14 }} />
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* Routines View */
        <div>
          <div className="row between" style={{ marginBottom: 12 }}>
            <h4 className="sec" style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: '.02em' }}>
              {t('CUSTOM ROUTINES')}
            </h4>
            <Button
              size="sm"
              variant="primary"
              icon="plus"
              onClick={addRoutine}
            >
              {t('New Routine')}
            </Button>
          </div>

          {S.routines.length ? (
            <div>
              {S.routines.map(r => {
                const muscles = getRoutineMuscles(r)
                const progName = POLICY_NAME[r.prog || 'linear']
                return (
                  <div key={r.id} className="plan-routine-card">
                    <div
                      className="plan-routine-head"
                      onClick={() => nav('/plan/r/' + r.id)}
                    >
                      <div className="plan-routine-avatar">
                        <Icon name={glyphOf(r.emoji)} />
                      </div>
                      <div className="plan-routine-info">
                        <div className="plan-routine-name">{r.name}</div>
                        <div className="plan-routine-meta">
                          <span>{exCount((r.ex || []).length)}</span>
                          <span>·</span>
                          <span style={{ color: 'var(--acc)', textTransform: 'capitalize' }}>
                            {t(progName || 'Linear')}
                          </span>
                        </div>
                      </div>
                      <Icon name="chevronRight" className="chev" />
                    </div>

                    {muscles.length > 0 && (
                      <div className="plan-muscle-tags">
                        {muscles.map((m, idx) => (
                          <span key={idx} className="plan-muscle-chip capitalize">
                            {m}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="plan-routine-acts">
                      <Button
                        size="sm"
                        variant="primary"
                        icon="play"
                        onClick={() => startFlow(r.id)}
                        style={{ flex: 1, height: 38 }}
                      >
                        {t('Start Workout')}
                      </Button>
                      <Button
                        size="sm"
                        variant="tinted"
                        icon="gear"
                        onClick={() => nav('/plan/r/' + r.id)}
                        style={{ height: 38 }}
                      >
                        {t('Edit')}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
              <div className="row" style={{ justifyContent: 'center', fontSize: 32, color: 'var(--label-3)', marginBottom: 8 }}>
                <Icon name="clipboard" />
              </div>
              <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>
                {t('No routines yet')}
              </div>
              <div className="muted small" style={{ marginBottom: 16 }}>
                {t('Create your own custom split or load a pre-built starter plan.')}
              </div>
              <Button variant="primary" icon="sparkles" onClick={loadStarterPlan}>
                {t('Load Push / Pull / Legs (PPL)')}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Starter Templates Section */}
      <div style={{ marginTop: 24, marginBottom: 30 }}>
        <h4 className="sec" style={{ marginBottom: 10, fontSize: 13, fontWeight: 600, letterSpacing: '.02em' }}>
          {t('PRESET TRAINING TEMPLATES')}
        </h4>

        <div className="plan-template-grid">
          {/* PPL Template */}
          <div className="plan-template-card" onClick={loadStarterPlan}>
            <div className="row between" style={{ marginBottom: 6 }}>
              <span className="plan-pill acc" style={{ fontSize: 11 }}>
                {t('Most Popular')}
              </span>
              <Icon name="sparkles" style={{ color: 'var(--acc)', fontSize: 16 }} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>
              Push / Pull / Legs (PPL)
            </div>
            <div className="muted small" style={{ fontSize: 12.5, lineHeight: 1.35 }}>
              {t('Classic 3-6 day split balancing chest, back, and leg volume with compound lifts.')}
            </div>
          </div>

          {/* Upper / Lower Template */}
          <div className="plan-template-card" onClick={loadUpperLower}>
            <div className="row between" style={{ marginBottom: 6 }}>
              <span className="plan-pill" style={{ fontSize: 11 }}>
                {t('4 Days / Week')}
              </span>
              <Icon name="dumbbell" style={{ color: 'var(--teal)', fontSize: 16 }} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>
              Upper / Lower Split
            </div>
            <div className="muted small" style={{ fontSize: 12.5, lineHeight: 1.35 }}>
              {t('Balanced 4-day athletic split allowing optimal recovery between workouts.')}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
