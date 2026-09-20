import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { EXIDX } from '../lib/exercises.js'
import { lastBW, streakWeeks, setLabel, modeOf, effortOf } from '../lib/history.js'
import { fmtNum, fmtDate, fmtVol, todayISO, weekKey } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { bwSheet, goalSheet, calendarSheet, workoutDetailSheet, WorkoutRow, bwDeltaColor } from '../sheets.jsx'
import LineChart from '../components/LineChart.jsx'
import Heatmap from '../components/Heatmap.jsx'
import Icon from '../components/Icon.jsx'
import BodyMap, { BodyMapLegend } from '../components/BodyMap.jsx'
import { loadOfWorkouts, rankOf, MUSCLE_NAME } from '../lib/muscles.js'
import { e1rmSeries, best1RM } from '../lib/onerm.js'
import {
  hasEffort, displayScale, scaleName, toScale, avgRir, effortSummary, effortWeeks,
  effortHistogram, isHardSet, HARD_RIR
} from '../lib/effort.js'
import { Button, Segmented, SelectRow } from '../components/ui.jsx'

/* ---------- Muscle Stimulus & Balance Card ---------- */
function MuscleBalance({ S }) {
  const [win, setWin] = useState(7)
  const [hard, setHard] = useState(false)
  const [sel, setSel] = useState(null)
  const now = Date.now()

  const inWin = S.workouts.filter(w =>
    win === 0 ? true
      : win === 7 ? weekKey(w.d) === weekKey(todayISO())
        : (w.start || new Date(w.d).getTime()) > now - win * 86400000
  )

  const rated = inWin.some(w => w.entries.some(e => e.sets.some(s => s.done && isHardSet(s))))
  const on = hard && rated
  const load = loadOfWorkouts(inWin, on ? isHardSet : null)
  const { worked, missed } = rankOf(load)
  const top = worked.slice(0, 5)
  const max = worked.length ? load[worked[0]] : 0
  const sets = m => Math.round((load[m] || 0) * 10) / 10

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="row between" style={{ marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{t('Muscle Balance')}</h2>
          <div className="t-cap muted" style={{ marginTop: 2 }}>
            {on ? t('Stimulus by hard sets near failure') : t('Volume distribution by sets worked')}
          </div>
        </div>
        {rated && (
          <button
            className={`iconbtn ${on ? 'on-ss' : ''}`}
            onClick={() => { setHard(h => !h); setSel(null) }}
            title={on ? t('Showing hard sets only') : t('Show all sets')}
            aria-label={t('Hard sets')}
            style={{ width: 34, height: 34 }}
          >
            <Icon name="flame" />
          </button>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <Segmented
          className="seg-range"
          value={win}
          onChange={v => { setWin(v); setSel(null) }}
          options={[
            { value: 7, label: t('Week') },
            { value: 30, label: '30d' },
            { value: 90, label: '90d' },
            { value: 0, label: t('All') }
          ]}
        />
      </div>

      {inWin.length ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 12px' }}>
            <BodyMap
              className="tappable"
              load={load}
              body={S.body}
              selected={sel}
              onMuscle={m => setSel(s => (s === m ? null : m))}
            />
          </div>
          <BodyMapLegend />

          {sel && (
            <div className="stat-muscle-sel">
              <span className="stat-sel-name">{t(MUSCLE_NAME[sel])}</span>
              <span className="stat-sel-val">
                {sets(sel) ? t('{0} sets worked', sets(sel)) : on ? t('No hard sets') : t('Not trained')}
              </span>
            </div>
          )}

          {!sel && top.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="t-cap muted" style={{ fontWeight: 600, marginBottom: 8 }}>
                {t('TOP TARGETED MUSCLES')}
              </div>
              {top.map(m => (
                <div key={m} className="mrow">
                  <span className="nm">{t(MUSCLE_NAME[m])}</span>
                  <span className="bar">
                    <i
                      style={{
                        width: `${Math.round((load[m] / max) * 100)}%`,
                        background: on ? 'var(--yellow)' : 'var(--acc)'
                      }}
                    />
                  </span>
                  <span className="v">{t('{0} sets', sets(m))}</span>
                </div>
              ))}
            </div>
          )}

          {missed.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="t-cap muted" style={{ fontWeight: 600, marginBottom: 6 }}>
                {on ? t('NO HARD STIMULUS IN THIS PERIOD') : t('NOT TRAINED IN THIS PERIOD')}
              </div>
              <div className="mchips">
                {missed.slice(0, 8).map(m => (
                  <span key={m} className="mchip miss">{t(MUSCLE_NAME[m])}</span>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="empty small" style={{ padding: '24px 0' }}>
          {t('No workouts logged in this period.')}
        </div>
      )}
    </div>
  )
}

/* ---------- Training Effort & Intensity Card ---------- */
function EffortCard({ S }) {
  const [win, setWin] = useState(90)
  const kind = displayScale(S)
  const hd = scaleName(kind)
  const sum = effortSummary(S, win)
  const weeks = effortWeeks(S, win)
  const hist = effortHistogram(S, win)
  const maxBin = Math.max(1, ...hist.map(b => b.n))

  const pts = weeks.map(w => ({ t: w.t, y: toScale(kind, w.rir), note: t('{0} sets', w.sets) }))
  const binLabel = b => kind === 'rpe' ? (b.tail ? '≤ 6' : String(10 - b.rir)) : (b.tail ? b.rir + '+' : String(b.rir))

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="row between" style={{ marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{t('Training Intensity & Effort')}</h2>
          <div className="t-cap muted" style={{ marginTop: 2 }}>{t('How close to failure your working sets were')}</div>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <Segmented
          className="seg-range"
          value={win}
          onChange={setWin}
          options={[
            { value: 30, label: '30d' },
            { value: 90, label: '90d' },
            { value: 365, label: '1Y' },
            { value: 0, label: t('All') }
          ]}
        />
      </div>

      {sum.rated === 0 ? (
        <div className="empty small" style={{ padding: '24px 0' }}>
          {t('No rated sets in this period.')}
        </div>
      ) : (
        <>
          <div className="stat-effort-split">
            <div className="stat-effort-box">
              <span className="stat-effort-num">
                {sum.avg == null ? '—' : `${fmtNum(toScale(kind, sum.avg))} ${hd}`}
              </span>
              <span className="stat-effort-lbl">{t('Average Effort')}</span>
            </div>
            <div className="stat-effort-divider" />
            <div className="stat-effort-box">
              <span className="stat-effort-num" style={{ color: 'var(--yellow)' }}>
                {sum.hardPct == null ? '—' : `${Math.round(sum.hardPct * 100)}%`}
              </span>
              <span className="stat-effort-lbl">{t('Hard Sets (≤ 2 RIR)')}</span>
            </div>
          </div>

          <div className="t-cap muted" style={{ marginTop: 8, textAlign: 'center' }}>
            {t('{0} of {1} completed sets rated', sum.rated, sum.done)}
          </div>

          {pts.length > 1 && (
            <div style={{ marginTop: 14 }}>
              <div className="t-cap muted" style={{ fontWeight: 600, marginBottom: 6 }}>
                {t('WEEKLY EFFORT TREND')}
              </div>
              <div className="chart">
                <LineChart points={pts} h={130} unit={hd} color="var(--yellow)" invert={kind === 'rir'} />
              </div>
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <div className="t-cap muted" style={{ fontWeight: 600, marginBottom: 8 }}>
              {t('SET INTENSITY DISTRIBUTION')}
            </div>
            {hist.map(b => (
              <div key={b.rir} className="mrow">
                <span className="nm">{hd} {binLabel(b)}</span>
                <span className="bar">
                  <i
                    style={{
                      width: `${Math.round((b.n / maxBin) * 100)}%`,
                      background: b.rir <= HARD_RIR ? 'var(--yellow)' : 'var(--surface-3)'
                    }}
                  />
                </span>
                <span className="v">{b.n ? `${b.n} · ${Math.round(b.pct * 100)}%` : '—'}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ---------- Main Stats View ---------- */
export default function Stats() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const [tab, setTab] = useState('overview') // 'overview' | 'muscles' | 'progress' | 'all'
  const [range, setRange] = useState(90)
  const [exId, setExId] = useState(null)
  const [exMetric, setExMetric] = useState('top')
  const now = Date.now()

  const anyEffort = hasEffort(S)
  const kind = displayScale(S)
  const hd = scaleName(kind)

  // Bodyweight calculations
  const bwPts = (S.bodyweight || [])
    .filter(b => range === 0 || (b.t || new Date(b.d).getTime()) > now - range * 86400000)
    .map(b => ({ t: b.t || new Date(b.d).getTime(), y: b.w, d: b.d }))
  const bw30 = (S.bodyweight || []).filter(b => (b.t || new Date(b.d).getTime()) > now - 30 * 86400000)
  const bwDelta30 = bw30.length > 1 ? bw30[bw30.length - 1].w - bw30[0].w : null
  const currentBw = lastBW(S)?.w

  // General workout metrics
  const monthW = S.workouts.filter(w => w.d.slice(0, 7) === todayISO().slice(0, 7)).length
  const totalVol = S.workouts.reduce((sum, w) => sum + (w.vol || 0), 0)
  const totalSetsLogged = S.workouts.reduce((sum, w) =>
    sum + w.entries.reduce((eSum, e) => eSum + (e.sets ? e.sets.filter(s => s.done).length : 0), 0), 0
  )

  // Exercise history
  const exHist = [...new Set(S.workouts.flatMap(w => w.entries.map(e => e.id)))]
    .filter(id => EXIDX[id])
    .sort((a, b) => (EXIDX[a].n < EXIDX[b].n ? -1 : 1))
  const curEx = exId && exHist.includes(exId) ? exId : exHist[0] || null

  const curMode = curEx ? (() => {
    for (let i = S.workouts.length - 1; i >= 0; i--) {
      const en = S.workouts[i].entries.find(e => e.id === curEx)
      if (en) return modeOf({ ...(en.target || {}), id: curEx })
    }
    return modeOf({ id: curEx })
  })() : 'reps'

  const curCardio = curMode === 'cardio'
  const curTimed = curMode === 'time'
  const metric = s => curCardio ? (s.speed || 0) : curTimed ? (s.sec || 0) : (s.w || 0)
  const exUnit = curCardio ? 'km/h' : curTimed ? 's' : S.unit

  let exPts = [], exList = [], exBest = 0
  if (curEx) {
    S.workouts.forEach(w => {
      const en = w.entries.find(e => e.id === curEx)
      if (en) {
        const mx = Math.max(0, ...en.sets.filter(s => s.done).map(metric), curCardio || curTimed ? 0 : (en.topW || 0))
        if (mx > 0) {
          exPts.push({ t: w.start, y: mx, d: w.d, sets: en.sets.filter(s => s.done), target: en.target })
          if (mx > exBest) exBest = mx
        }
      }
    })
    exList = exPts.slice(-5).reverse()
  }

  const e1Pts = curEx ? e1rmSeries(S, curEx) : []
  const e1Best = curEx ? best1RM(S, curEx) : null
  const showE1 = e1Pts.length > 0
  const exRir = exPts.map(p => avgRir(p.sets))
  const showEff = exRir.filter(v => v != null).length >= 3
  const effPts = exPts.map((p, i) => (exRir[i] == null ? null : { t: p.t, y: toScale(kind, exRir[i]), d: p.d })).filter(Boolean)

  const onE1 = showE1 && exMetric === 'e1rm'
  const onEff = showEff && exMetric === 'effort'

  const topPts = exPts.map((p, i) => ({
    t: p.t,
    y: p.y,
    d: p.d,
    m: exRir[i] == null ? null : 1 - Math.min(4, Math.max(0, exRir[i])) / 4,
    note: exRir[i] == null ? undefined : `${hd} ${fmtNum(toScale(kind, exRir[i]))}`
  }))

  const exOpts = [{ value: 'top', label: t('Top Set') }]
  if (showE1) exOpts.push({ value: 'e1rm', label: t('Est. 1RM') })
  if (showEff) exOpts.push({ value: 'effort', label: t('Effort') })

  return (
    <div className="narrow">
      {/* Top Header */}
      <div className="hdr" style={{ marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 750 }}>{t('Analytics & Stats')}</h1>
          <div className="sub" style={{ fontSize: 13.5, marginTop: 2 }}>
            {t('{0} completed workouts · {1} total sets', S.workouts.length, totalSetsLogged)}
          </div>
        </div>
        <button
          className="iconbtn"
          onClick={() => nav('/history')}
          aria-label={t('History')}
          title={t('Workout history')}
        >
          <Icon name="calendar" />
        </button>
      </div>

      {/* Hero Metric KPI Cards */}
      <div className="stat-kpi-grid">
        <div className="stat-kpi-card" onClick={() => nav('/history')}>
          <div className="stat-kpi-top">
            <span className="stat-kpi-icon acc"><Icon name="dumbbell" /></span>
            <span className="stat-kpi-badge">{monthW} {t('this mo')}</span>
          </div>
          <div className="stat-kpi-num">{S.workouts.length}</div>
          <div className="stat-kpi-lbl">{t('Workouts')}</div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-top">
            <span className="stat-kpi-icon orange"><Icon name="flame" /></span>
            <span className="stat-kpi-badge orange">{streakWeeks(S)} {t('wks')}</span>
          </div>
          <div className="stat-kpi-num">{streakWeeks(S)}</div>
          <div className="stat-kpi-lbl">{t('Week Streak')}</div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-top">
            <span className="stat-kpi-icon teal"><Icon name="chartLine" /></span>
            <span className="stat-kpi-badge teal">{S.unit}</span>
          </div>
          <div className="stat-kpi-num">{fmtVol(totalVol, S.unit).replace(S.unit, '').trim()}</div>
          <div className="stat-kpi-lbl">{t('Total Volume')}</div>
        </div>

        <div className="stat-kpi-card" onClick={() => bwSheet()}>
          <div className="stat-kpi-top">
            <span className="stat-kpi-icon purple"><Icon name="scale" /></span>
            {bwDelta30 !== null && (
              <span className="stat-kpi-badge" style={{ color: bwDeltaColor(bwDelta30, currentBw || 0) }}>
                {bwDelta30 > 0 ? '+' : ''}{fmtNum(bwDelta30)}
              </span>
            )}
          </div>
          <div className="stat-kpi-num">
            {currentBw ? fmtNum(currentBw) : '—'}
          </div>
          <div className="stat-kpi-lbl">{t('Body Weight')} ({S.unit})</div>
        </div>
      </div>

      {/* Section View Tabs */}
      <div className="login-tab-seg" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={`login-tab-btn ${tab === 'overview' ? 'active' : ''}`}
          onClick={() => setTab('overview')}
        >
          <Icon name="calendar" />
          <span>{t('Overview')}</span>
        </button>
        <button
          type="button"
          className={`login-tab-btn ${tab === 'muscles' ? 'active' : ''}`}
          onClick={() => setTab('muscles')}
        >
          <Icon name="figureStrength" />
          <span>{t('Muscles & Effort')}</span>
        </button>
        <button
          type="button"
          className={`login-tab-btn ${tab === 'progress' ? 'active' : ''}`}
          onClick={() => setTab('progress')}
        >
          <Icon name="chart" />
          <span>{t('Progress')}</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {(tab === 'overview' || tab === 'all') && (
        <>
          {/* Consistency Heatmap */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="row between" style={{ marginBottom: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{t('Training Consistency')}</h2>
                <div className="t-cap muted" style={{ marginTop: 2 }}>{t('Activity over the last 12 months')}</div>
              </div>
            </div>
            <Heatmap
              S={S}
              onDay={iso => {
                const ws = S.workouts.filter(w => w.d === iso)
                if (ws.length === 1) workoutDetailSheet(ws[0])
                else if (ws.length) calendarSheet(iso)
              }}
            />
          </div>

          {/* Recent Workouts Stream */}
          {S.workouts.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div className="row between" style={{ marginBottom: 10, padding: '0 4px' }}>
                <h2 className="sect-t" style={{ margin: 0, padding: 0 }}>{t('Recent Workouts')}</h2>
                <Button
                  size="sm"
                  variant="ghost"
                  trailingIcon="chevronRight"
                  onClick={() => nav('/history')}
                >
                  {t('View All ({0})', S.workouts.length)}
                </Button>
              </div>
              <div className="list">
                {[...S.workouts].reverse().slice(0, 5).map(w => (
                  <WorkoutRow key={w.id} w={w} onClick={() => workoutDetailSheet(w)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 2: MUSCLES & EFFORT */}
      {(tab === 'muscles' || tab === 'all') && (
        <>
          {S.workouts.length > 0 ? (
            <>
              <MuscleBalance S={S} />
              {anyEffort && <EffortCard S={S} />}
            </>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '36px 16px', marginBottom: 14 }}>
              <div className="r-empty-icon"><Icon name="figureStrength" /></div>
              <div className="t-head" style={{ marginBottom: 4 }}>{t('No training data yet')}</div>
              <div className="t-sub muted">{t('Log your first workout to see muscle distribution maps.')}</div>
            </div>
          )}
        </>
      )}

      {/* TAB 3: PROGRESS & CURVES */}
      {(tab === 'progress' || tab === 'all') && (
        <div className="cols">
          {/* Body Weight Card */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="row between" style={{ marginBottom: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{t('Body Weight')}</h2>
                <div className="t-cap muted" style={{ marginTop: 2 }}>
                  {currentBw ? `${fmtNum(currentBw)} ${S.unit}` : t('No weight logged')}
                  {S.targetW && ` · ${t('Goal')}: ${fmtNum(S.targetW)} ${S.unit}`}
                </div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <Button size="sm" icon="target" onClick={goalSheet}>
                  {S.targetW ? fmtNum(S.targetW) : t('Goal')}
                </Button>
                <Button size="sm" variant="primary" icon="plus" onClick={() => bwSheet()}>
                  {t('Log')}
                </Button>
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <Segmented
                className="seg-range"
                value={range}
                onChange={setRange}
                options={[
                  { value: 30, label: '1M' },
                  { value: 90, label: '3M' },
                  { value: 365, label: '1Y' },
                  { value: 0, label: t('All') }
                ]}
              />
            </div>

            <div className="chart">
              <LineChart points={bwPts} h={160} unit={S.unit} goal={S.targetW} />
            </div>
          </div>

          {/* Exercise Progress Card */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="row between" style={{ marginBottom: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{t('Exercise Performance')}</h2>
                <div className="t-cap muted" style={{ marginTop: 2 }}>{t('Strength curves & estimated 1RM')}</div>
              </div>
            </div>

            {exHist.length ? (
              <>
                <div className="sect-b" style={{ marginBottom: 10 }}>
                  <SelectRow
                    title={t('Select Exercise')}
                    sheetTitle={t('Exercise Progress')}
                    value={curEx}
                    onChange={setExId}
                    options={exHist.map(id => ({ value: id, label: EXIDX[id].n }))}
                  />
                </div>

                {/* PR Highlight Pill */}
                {curEx && (exBest > 0 || (onE1 && e1Best)) && (
                  <div className="stat-pr-banner">
                    <span className="stat-pr-badge"><Icon name="trophy" /> {t('ALL-TIME BEST')}</span>
                    <span className="stat-pr-val">
                      {onE1 ? `${fmtNum(e1Best.est)} ${S.unit}` : `${fmtNum(exBest)} ${exUnit}`}
                    </span>
                  </div>
                )}

                {exOpts.length > 1 && (
                  <div style={{ marginBottom: 10 }}>
                    <Segmented
                      className="seg-range"
                      value={onEff ? 'effort' : onE1 ? 'e1rm' : 'top'}
                      onChange={setExMetric}
                      options={exOpts}
                    />
                  </div>
                )}

                <div className="chart">
                  {onEff ? (
                    <LineChart points={effPts} h={150} unit={hd} color="var(--yellow)" invert={kind === 'rir'} />
                  ) : (
                    <LineChart
                      points={onE1 ? e1Pts.map(p => ({ t: p.t, y: p.y, d: p.d })) : topPts}
                      h={150}
                      unit={exUnit}
                      color="var(--blue)"
                    />
                  )}
                </div>

                {exList.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div className="t-cap muted" style={{ fontWeight: 600, marginBottom: 6 }}>
                      {t('RECENT SESSIONS')}
                    </div>
                    {exList.map((p, i) => (
                      <div
                        key={i}
                        className="row between small"
                        style={{ padding: '7px 0', borderBottom: 'var(--hair) solid var(--sep)' }}
                      >
                        <span className="muted">{fmtDate(p.d, true)}</span>
                        <span style={{ fontWeight: 550 }}>
                          {p.sets.map(s => setLabel(curEx, s, p.target)).join('  ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="empty small" style={{ padding: '24px 0' }}>
                {t('Finish your first workout to see strength progression curves.')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
