import { useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { exOr } from '../lib/exercises.js'
import { uid } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { supersetUnits, cleanupSg, exLine } from '../lib/history.js'
import { Thumb } from '../components/Media.jsx'
import { glyphPicker, exercisePicker, exConfigSheet, confirmSheet, startFlow, planToolsSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
import { Button, SelectRow, Section, Row } from '../components/ui.jsx'
import { POLICIES_FOR, POLICY_NAME, POLICY_DESC } from '../lib/progression.js'
import BodyMap from '../components/BodyMap.jsx'
import { loadOfRoutine, rankOf, MUSCLE_NAME } from '../lib/muscles.js'

const DAY_NAMES = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 0: 'Sun' }

export default function RoutineEdit() {
  const nav = useNavigate()
  const { id } = useParams()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const [showAllMuscles, setShowAllMuscles] = useState(false)

  const r = S.routines.find(x => x.id === id)
  useEffect(() => { if (!r) nav('/plan') }, [!r])
  if (!r) return null

  const edit = fn => update(s => {
    const routine = s.routines.find(x => x.id === id)
    if (routine) fn(routine.ex)
  })

  const move = (i, dir) => edit(ex => {
    const j = i + dir
    if (j < 0 || j >= ex.length) return
    [ex[i], ex[j]] = [ex[j], ex[i]]
    cleanupSg(ex)
  })

  const toggleLink = i => edit(ex => {
    if (i < 1) return
    const cur = ex[i], prev = ex[i - 1]
    if (cur.sg && prev.sg && cur.sg === prev.sg) {
      delete cur.sg
    } else {
      const gid = prev.sg || ('sg' + uid())
      prev.sg = gid
      cur.sg = gid
    }
    cleanupSg(ex)
  })

  const duplicateRoutine = () => {
    const newId = uid()
    const clone = {
      id: newId,
      name: `${r.name} (${t('Copy')})`,
      emoji: r.emoji || DEFAULT_GLYPH,
      prog: r.prog,
      ex: JSON.parse(JSON.stringify(r.ex || []))
    }
    update(s => { s.routines.push(clone) })
    nav('/plan/r/' + newId)
  }

  const deleteRoutine = () => {
    confirmSheet({
      title: t('Delete routine?'),
      message: t('"{0}" and its exercises will be removed from your plan.', r.name),
      confirmText: t('Delete'),
      danger: true,
      onConfirm: () => {
        update(s => {
          s.routines = s.routines.filter(x => x.id !== id)
          Object.keys(s.week || {}).forEach(k => { if (s.week[k] === id) delete s.week[k] })
          Object.keys(s.dayPlan || {}).forEach(k => { if (s.dayPlan[k] === id) delete s.dayPlan[k] })
        })
        nav('/plan')
      }
    })
  }

  const units = supersetUnits(r.ex || [])
  const inSS = new Set(units.filter(u => u.length > 1).flat())
  const unitFirst = new Set(units.filter(u => u.length > 1).map(u => u[0]))

  // Assigned days in weekly plan
  const assignedDays = [1, 2, 3, 4, 5, 6, 0].filter(d => S.week && S.week[d] === id)

  // Metrics
  const exCount = (r.ex || []).length
  const totalSets = (r.ex || []).reduce((sum, e) => sum + (e.sets || 3), 0)
  const estMinutes = Math.max(10, Math.round(totalSets * 2.2))

  // Muscle loading
  const load = exCount > 0 ? loadOfRoutine(r) : {}
  const muscleRank = exCount > 0 ? rankOf(load) : { worked: [], neglected: [] }
  const worked = muscleRank.worked || []
  const neglected = muscleRank.neglected || []

  return (
    <div className="narrow">
      {/* Top Navigation */}
      <div className="hdr" style={{ marginBottom: 16 }}>
        <button className="iconbtn" onClick={() => nav('/plan')} aria-label={t('Plan')}>
          <Icon name="chevronLeft" />
        </button>
        <div className="row" style={{ gap: 8 }}>
          <button className="iconbtn" onClick={planToolsSheet} title={t('Share plan')} aria-label={t('Share plan')}>
            <Icon name="upload" />
          </button>
          <button className="iconbtn" onClick={duplicateRoutine} title={t('Duplicate routine')} aria-label={t('Duplicate routine')}>
            <Icon name="sparkles" />
          </button>
        </div>
      </div>

      {/* Routine Hero Card */}
      <div className="card" style={{ padding: '18px 16px', marginBottom: 14 }}>
        <div className="row" style={{ alignItems: 'center', gap: 14 }}>
          <button
            className="r-avatar-btn"
            onClick={() => glyphPicker(r.emoji, g => update(s => {
              const routine = s.routines.find(x => x.id === id)
              if (routine) routine.emoji = g
            }))}
            aria-label={t('Change icon')}
            title={t('Change icon')}
          >
            <Icon name={glyphOf(r.emoji)} />
            <span className="r-avatar-hint"><Icon name="sparkles" /></span>
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              className="r-title-field"
              defaultValue={r.name}
              placeholder={t('Routine Name')}
              onChange={e => update(s => {
                const routine = s.routines.find(x => x.id === id)
                if (routine) routine.name = e.target.value.trim() || t('Routine')
              })}
            />
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {assignedDays.length > 0 ? (
                assignedDays.map(d => (
                  <span key={d} className="r-day-badge active">{t(DAY_NAMES[d])}</span>
                ))
              ) : (
                <span className="r-day-badge dim">{t('Unscheduled')}</span>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats Strip */}
        <div className="r-stats-bar">
          <div className="r-stat-cell">
            <span className="r-stat-num">{exCount}</span>
            <span className="r-stat-lbl">{t('Exercises')}</span>
          </div>
          <div className="r-stat-divider" />
          <div className="r-stat-cell">
            <span className="r-stat-num">{totalSets}</span>
            <span className="r-stat-lbl">{t('Sets')}</span>
          </div>
          <div className="r-stat-divider" />
          <div className="r-stat-cell">
            <span className="r-stat-num">~{estMinutes}m</span>
            <span className="r-stat-lbl">{t('Est. Time')}</span>
          </div>
        </div>

        {/* Start Workout CTA */}
        {exCount > 0 && (
          <div style={{ marginTop: 14 }}>
            <Button variant="primary" icon="play" onClick={() => startFlow(r.id)}>
              {t('Start Workout')}
            </Button>
          </div>
        )}
      </div>

      {/* Exercises Section */}
      <div style={{ marginBottom: 22 }}>
        <div className="row between" style={{ marginBottom: 10, padding: '0 4px' }}>
          <h2 className="sect-t" style={{ margin: 0, padding: 0 }}>{t('Exercises')}</h2>
          <span className="t-cap muted">{exCount} {exCount === 1 ? t('exercise') : t('exercises')}</span>
        </div>

        {exCount > 0 ? (
          <div className="r-ex-container">
            {r.ex.map((e, i) => {
              const ex = exOr(e.id)
              const linkedPrev = i > 0 && e.sg && r.ex[i - 1].sg === e.sg
              const isFirstInSS = unitFirst.has(i)
              const isInSuperset = inSS.has(i)

              return (
                <div key={i} className={`r-ex-wrapper ${isInSuperset ? 'in-ss' : ''}`}>
                  {isFirstInSS && (
                    <div className="r-ss-banner">
                      <Icon name="link" />
                      <span>{t('Superset')}</span>
                    </div>
                  )}

                  <div
                    className={`r-ex-row ${isInSuperset ? 'ss-card' : ''}`}
                    onClick={() => exConfigSheet(
                      ex,
                      e,
                      cfg => edit(x => { x[i] = { id: x[i].id, sg: x[i].sg, ...cfg } }),
                      () => edit(x => { x.splice(i, 1); cleanupSg(x) }),
                      r
                    )}
                  >
                    <span className="r-ex-idx">{String(i + 1).padStart(2, '0')}</span>

                    <div className="r-ex-thumb">
                      <Thumb ex={ex} />
                    </div>

                    <div className="r-ex-body">
                      <div className="r-ex-name capitalize">{ex.n}</div>
                      <div className="r-ex-details">
                        <span className="r-ex-pill">{exLine(e, S.unit)}</span>
                        {ex.bp && <span className="r-ex-subtag capitalize">{ex.bp}</span>}
                      </div>
                    </div>

                    <div className="r-ex-actions" onClick={ev => ev.stopPropagation()}>
                      {i > 0 && (
                        <button
                          className={`iconbtn r-action-btn ${linkedPrev ? 'on-ss' : ''}`}
                          title={t('Superset with exercise above')}
                          onClick={() => toggleLink(i)}
                          aria-label={t('Superset')}
                        >
                          <Icon name="link" />
                        </button>
                      )}
                      <div className="r-reorder-group">
                        <button
                          className="iconbtn r-action-btn sm"
                          onClick={() => move(i, -1)}
                          disabled={i === 0}
                          aria-label="Move up"
                        >
                          <Icon name="chevronUp" />
                        </button>
                        <button
                          className="iconbtn r-action-btn sm"
                          onClick={() => move(i, 1)}
                          disabled={i === r.ex.length - 1}
                          aria-label="Move down"
                        >
                          <Icon name="chevronDown" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '36px 16px', marginBottom: 12 }}>
            <div className="r-empty-icon">
              <Icon name="dumbbell" />
            </div>
            <div className="t-head" style={{ marginBottom: 4 }}>{t('No exercises yet')}</div>
            <div className="t-sub muted" style={{ marginBottom: 16 }}>
              {t('Add your first exercise to complete this routine.')}
            </div>
          </div>
        )}

        {/* Add Exercise CTA */}
        <Button
          variant="tinted"
          icon="plus"
          onClick={() => exercisePicker(ex => exConfigSheet(ex, null, cfg => edit(x => { x.push({ id: ex.id, ...cfg }) }), null, r))}
        >
          {t('Add Exercise')}
        </Button>
      </div>

      {/* Routine Settings & Progression */}
      <Section title={t('Routine Settings')}>
        <SelectRow
          icon="chartLine"
          iconTint="var(--teal)"
          title={t('Progression Policy')}
          sheetTitle={t('Progression')}
          value={r.prog || 'linear'}
          onChange={v => update(s => {
            const routine = s.routines.find(x => x.id === id)
            if (routine) routine.prog = v
          })}
          options={POLICIES_FOR.reps.map(p => ({
            value: p,
            label: t(POLICY_NAME[p]),
            subtitle: t(POLICY_DESC[p])
          }))}
        />
      </Section>
      <p className="sect-f" style={{ marginTop: -16, marginBottom: 22 }}>
        {t('Applies to every exercise in this routine that does not define its own progression rule.')}
      </p>

      {/* Muscle Coverage */}
      {exCount > 0 && (
        <div className="card" style={{ marginBottom: 22, padding: '18px 16px' }}>
          <div className="row between" style={{ marginBottom: 12 }}>
            <div>
              <div className="t-head">{t('Target Muscle Coverage')}</div>
              <div className="t-cap muted">{t('Muscles engaged during this session')}</div>
            </div>
            <span className="plan-pill acc">{worked.length} {t('muscles')}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 16px' }}>
            <BodyMap load={load} body={S.body} />
          </div>

          {worked.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div className="t-cap muted" style={{ marginBottom: 6, fontWeight: 600 }}>{t('PRIMARY TARGETS')}</div>
              <div className="mchips">
                {worked.slice(0, showAllMuscles ? worked.length : 6).map(m => (
                  <span key={m} className="mchip" style={{ background: 'var(--acc-soft)', color: 'var(--acc)' }}>
                    {t(MUSCLE_NAME[m])}
                  </span>
                ))}
              </div>
              {worked.length > 6 && (
                <button
                  className="btn plain sm"
                  style={{ marginTop: 6, paddingLeft: 0 }}
                  onClick={() => setShowAllMuscles(!showAllMuscles)}
                >
                  {showAllMuscles ? t('Show less') : t('Show {0} more', worked.length - 6)}
                </button>
              )}
            </div>
          )}

          {neglected.length > 0 && (
            <div>
              <div className="t-cap muted" style={{ marginBottom: 6, fontWeight: 600 }}>{t('NOT TARGETED IN THIS ROUTINE')}</div>
              <div className="mchips">
                {neglected.slice(0, 8).map(m => (
                  <span key={m} className="mchip miss">
                    {t(MUSCLE_NAME[m])}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Routine Options */}
      <Section title={t('Options')}>
        <Row
          icon="sparkles"
          iconTint="var(--indigo)"
          title={t('Duplicate Routine')}
          subtitle={t('Create a copy of this routine')}
          accessory="chevron"
          onClick={duplicateRoutine}
        />
        <Row
          icon="trash"
          iconTint="var(--red)"
          title={t('Delete Routine')}
          subtitle={t('Remove this routine and its exercises')}
          danger
          onClick={deleteRoutine}
        />
      </Section>
    </div>
  )
}
