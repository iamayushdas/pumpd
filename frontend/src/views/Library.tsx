import { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { EXDB, BODYPARTS, allExercises, equipmentOf } from '../lib/exercises'
import { bestWeightFor } from '../lib/history'
import { fmtNum } from '../lib/format'
import { t } from '../lib/i18n'
import { Thumb } from '../components/Media'
import { exerciseDetailSheet, addToRoutineSheet, customExSheet } from '../sheets'
import Icon from '../components/Icon'
import { Button, SearchField } from '../components/ui'

export default function Library() {
  const S = useStore(s => s.S)
  const [q, setQ] = useState('')
  const [bp, setBp] = useState('')
  const [eq, setEq] = useState('')
  const [filterMode, setFilterMode] = useState('all') // 'all' | 'plan' | 'custom' | 'prs'
  const [shown, setShown] = useState(40)

  const ql = q.toLowerCase().trim()
  const allList = allExercises(S)

  // Track which exercises are used in current routines
  const inPlanIds = useMemo(() => {
    const ids = new Set()
    ;(S.routines || []).forEach(r => {
      ;(r.ex || []).forEach(e => ids.add(e.id))
    })
    return ids
  }, [S.routines])

  // Track exercises that have logged PRs/best weights
  const prIds = useMemo(() => {
    const ids = new Set()
    allList.forEach(e => {
      if (bestWeightFor(S, e.id) > 0) ids.add(e.id)
    })
    return ids
  }, [S.workouts, allList])

  // Filter base by search query & category & mode
  const base = useMemo(() => {
    return allList.filter(e => {
      // Search filter
      if (ql && !(
        e.n.toLowerCase().includes(ql) ||
        (e.tg && e.tg.toLowerCase().includes(ql)) ||
        (e.eq && e.eq.toLowerCase().includes(ql)) ||
        (e.desc || '').toLowerCase().includes(ql)
      )) {
        return false
      }

      // Mode filter
      if (filterMode === 'plan' && !inPlanIds.has(e.id)) return false
      if (filterMode === 'custom' && !e.custom) return false
      if (filterMode === 'prs' && !prIds.has(e.id)) return false

      // Body part filter
      if (bp && e.bp !== bp) return false

      return true
    })
  }, [allList, ql, bp, filterMode, inPlanIds, prIds])

  const eqOpts = useMemo(() => equipmentOf(base), [base])
  const eqOn = eqOpts.includes(eq) ? eq : ''
  const filtered = useMemo(() => eqOn ? base.filter(e => e.eq === eqOn) : base, [base, eqOn])

  const resetFilters = () => {
    setQ('')
    setBp('')
    setEq('')
    setFilterMode('all')
    setShown(40)
  }

  const customCount = (S.customEx || []).length

  return (
    <div className="narrow">
      {/* Top Header */}
      <div className="hdr" style={{ marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 750 }}>{t('Exercise Library')}</h1>
          <div className="sub" style={{ fontSize: 13.5, marginTop: 2 }}>
            {t('{0} exercises with animated guides', EXDB.length)}
          </div>
        </div>
        <button
          className="iconbtn"
          onClick={() => customExSheet(null, ex => exerciseDetailSheet(ex), q.trim())}
          title={t('Create custom exercise')}
          aria-label={t('Create custom exercise')}
        >
          <Icon name="plus" />
        </button>
      </div>

      {/* Modern Search Bar */}
      <div style={{ marginBottom: 12 }}>
        <SearchField
          placeholder={t('Search exercise, muscle, or equipment…')}
          value={q}
          onChange={e => { setQ(e.target.value); setShown(40) }}
          onClear={() => { setQ(''); setShown(40) }}
        />
      </div>

      {/* Quick View Segment Filter */}
      <div className="lib-quick-filters" style={{ marginBottom: 10 }}>
        <button
          type="button"
          className={`lib-filter-pill ${filterMode === 'all' ? 'active' : ''}`}
          onClick={() => { setFilterMode('all'); setShown(40) }}
        >
          {t('All ({0})', allList.length)}
        </button>
        {inPlanIds.size > 0 && (
          <button
            type="button"
            className={`lib-filter-pill ${filterMode === 'plan' ? 'active' : ''}`}
            onClick={() => { setFilterMode('plan'); setShown(40) }}
          >
            <Icon name="calendar" />
            <span>{t('In Plan ({0})', inPlanIds.size)}</span>
          </button>
        )}
        {prIds.size > 0 && (
          <button
            type="button"
            className={`lib-filter-pill ${filterMode === 'prs' ? 'active' : ''}`}
            onClick={() => { setFilterMode('prs'); setShown(40) }}
          >
            <Icon name="trophy" />
            <span>{t('With PRs ({0})', prIds.size)}</span>
          </button>
        )}
        {customCount > 0 && (
          <button
            type="button"
            className={`lib-filter-pill ${filterMode === 'custom' ? 'active' : ''}`}
            onClick={() => { setFilterMode('custom'); setShown(40) }}
          >
            <Icon name="sparkles" />
            <span>{t('Custom ({0})', customCount)}</span>
          </button>
        )}
      </div>

      {/* Body Parts Horizontal Carousel */}
      <div className="chips" style={{ marginBottom: eqOpts.length > 1 ? 8 : 14 }}>
        <button
          className={`chip nocap ${!bp ? 'on' : ''}`}
          onClick={() => { setBp(''); setEq(''); setShown(40) }}
        >
          {t('All Body Parts')}
        </button>
        {BODYPARTS.map(b => (
          <button
            key={b}
            className={`chip ${bp === b ? 'on' : ''}`}
            onClick={() => { setBp(b); setEq(''); setShown(40) }}
          >
            {t(b)}
          </button>
        ))}
      </div>

      {/* Equipment Filter Strip (Adaptive) */}
      {eqOpts.length > 1 && (
        <div className="chips" style={{ marginBottom: 14 }}>
          <button
            className={`chip nocap ${!eqOn ? 'on' : ''}`}
            onClick={() => { setEq(''); setShown(40) }}
          >
            {t('Any Equipment')}
          </button>
          {eqOpts.map(x => (
            <button
              key={x}
              className={`chip ${eqOn === x ? 'on' : ''}`}
              onClick={() => { setEq(x); setShown(40) }}
            >
              {t(x)}
            </button>
          ))}
        </div>
      )}

      {/* Create Custom Exercise Quick Action Tile */}
      {!ql && filterMode === 'all' && !bp && (
        <div
          className="lib-custom-card"
          onClick={() => customExSheet(null, ex => exerciseDetailSheet(ex), q.trim())}
        >
          <div className="lib-custom-icon">
            <Icon name="sparkles" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="lib-custom-title">{t('Create Custom Exercise')}</div>
            <div className="lib-custom-sub">{t('Add unique movements with custom body parts & equipment')}</div>
          </div>
          <Icon name="chevronRight" style={{ color: 'var(--label-3)', fontSize: 16 }} />
        </div>
      )}

      {/* Results Header Count */}
      <div className="row between" style={{ marginBottom: 10, padding: '0 4px' }}>
        <span className="t-cap muted" style={{ fontWeight: 600 }}>
          {t('SHOWING {0} EXERCISES', filtered.length)}
        </span>
        {(bp || eqOn || filterMode !== 'all' || q) && (
          <button className="btn plain xs" onClick={resetFilters}>
            {t('Reset filters')}
          </button>
        )}
      </div>

      {/* Exercise List */}
      <div className="lib-exercise-list">
        {filtered.slice(0, shown).map(e => {
          const best = bestWeightFor(S, e.id)
          const inPlan = inPlanIds.has(e.id)

          return (
            <div
              key={e.id}
              className="lib-exercise-card"
              onClick={() => exerciseDetailSheet(e)}
            >
              <div className="lib-thumb-box">
                <Thumb ex={e} />
              </div>

              <div className="lib-info-box">
                <div className="lib-name capitalize">{e.n}</div>
                <div className="lib-meta">
                  <span className="lib-pill-bp capitalize">{t(e.tg || e.bp)}</span>
                  {e.eq && <span className="lib-pill-eq capitalize">{t(e.eq)}</span>}
                  {e.custom && <span className="lib-pill-custom">{t('Custom')}</span>}
                </div>
              </div>

              <div className="lib-actions-box" onClick={ev => ev.stopPropagation()}>
                {best > 0 && (
                  <span className="lib-pr-pill" title={t('All-time best')}>
                    <Icon name="trophy" />
                    <span>{fmtNum(best)} {S.unit}</span>
                  </span>
                )}
                {inPlan && (
                  <span className="lib-plan-indicator" title={t('In your active plan')}>
                    <Icon name="calendar" />
                  </span>
                )}
                <Button
                  size="sm"
                  variant="tinted"
                  icon="plus"
                  onClick={() => addToRoutineSheet(e)}
                  aria-label={t('Add to plan')}
                >
                  {t('Plan')}
                </Button>
              </div>
            </div>
          )
        })}

        {/* Empty State */}
        {filtered.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px', marginBottom: 14 }}>
            <div className="r-empty-icon">
              <Icon name="magnifier" />
            </div>
            <div className="t-head" style={{ marginBottom: 4 }}>{t('No matching exercises')}</div>
            <div className="t-sub muted" style={{ marginBottom: 16 }}>
              {t('Try searching with different terms or create this exercise yourself.')}
            </div>
            <Button
              variant="primary"
              icon="plus"
              onClick={() => customExSheet(null, ex => exerciseDetailSheet(ex), q.trim())}
            >
              {t('Create "{0}"', q.trim() || t('Custom exercise'))}
            </Button>
          </div>
        )}
      </div>

      {/* Pagination Load More */}
      {filtered.length > shown && (
        <div style={{ marginTop: 12, marginBottom: 20 }}>
          <Button
            variant="tinted"
            onClick={() => setShown(s => s + 40)}
          >
            {t('Show More ({0} remaining)', filtered.length - shown)}
          </Button>
        </div>
      )}
    </div>
  )
}
