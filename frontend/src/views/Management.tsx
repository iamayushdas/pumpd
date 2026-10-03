import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import {
  api,
  approveAccessRequest,
  createDiet,
  createFee,
  createManagementRequest,
  createTrainingPlan,
  getAccessRequests,
  getManagementOverview,
  listGyms,
  reviewFee,
  reviewManagementRequest,
  submitFee,
  logAssignment,
} from '../lib/api'
import Icon from '../components/Icon'
import { Button, TextField, TextArea, SelectButton } from '../components/ui'
import { personaLabel } from '../components/PersonaPicker'
import WorkspaceNav from '../components/WorkspaceNav'
import type { PersonaRole } from '../types/store/user'

const roles: PersonaRole[] = ['member', 'trainer', 'owner', 'admin']
const PLAN_DAYS = [1, 2, 3, 4, 5, 6, 0]
const PLAN_DAY_LABELS: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  0: 'Sunday',
}
const PLAN_DAY_SHORT: Record<number, string> = {
  1: 'MON',
  2: 'TUE',
  3: 'WED',
  4: 'THU',
  5: 'FRI',
  6: 'SAT',
  0: 'SUN',
}
const blankWeek = () => PLAN_DAYS.reduce((week, day) => ({ ...week, [day]: '' }), {} as Record<number, string>)

const prettyDate = (value: string | number | Date | null | undefined) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

const timeAgo = (value: string | number | Date | null | undefined) => {
  if (!value) return '—'
  const diffMs = Date.now() - new Date(value).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return prettyDate(value)
}

const FOOD_PRESETS = [
  { name: 'Whey Protein Shake', serving: '1 scoop (30g) + milk', time: '08:00' },
  { name: 'Oatmeal & Berries', serving: '80g oats + blueberries', time: '09:00' },
  { name: 'Grilled Chicken & Rice', serving: '200g breast + 150g rice', time: '13:00' },
  { name: 'Salmon & Sweet Potato', serving: '180g salmon + roasted greens', time: '19:30' },
  { name: 'Eggs & Avocado Toast', serving: '3 whole eggs + 1 slice sourdough', time: '08:30' },
  { name: 'Greek Yogurt & Honey', serving: '200g 0% Greek yogurt + almonds', time: '16:00' },
]

export default function Management() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const S = useStore(s => s.S)
  const toast = useUI(s => s.toast)

  const [data, setData] = useState<any>(null)
  const [accessRequests, setAccessRequests] = useState<any[]>([])
  const [gyms, setGyms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const role = (user?.admin ? 'admin' : user?.role || 'member') as PersonaRole
  const isManager = role === 'admin' || role === 'owner'
  const isCoach = isManager || role === 'trainer'

  const [activeTab, setActiveTab] = useState<string>(isCoach ? 'splits' : 'overview')

  const [selectedMember, setSelectedMember] = useState<string>('')
  const [roleForm, setRoleForm] = useState({ memberId: '', role: 'member' as PersonaRole, gymId: '', trainerId: '' })
  const [gymName, setGymName] = useState('')
  const [requestForm, setRequestForm] = useState({ requestedRole: 'member', gymId: '', message: '' })
  const [trainingPlanForm, setTrainingPlanForm] = useState<{ week: Record<number, string> }>({ week: blankWeek() })
  const [dietForm, setDietForm] = useState({
    title: 'Daily Fuel Protocol',
    calories: '2400',
    meals: '3 High Protein Meals + 1 Snack',
    notes: 'Prioritize whole foods, 1g protein per lb BW, stay hydrated with 3-4L water.',
    foods: [
      { id: '1', name: 'Whey Protein Shake', time: '08:00', serving: '1 scoop + 300ml milk' },
      { id: '2', name: 'Chicken Breast & Jasmine Rice', time: '13:00', serving: '200g chicken + 150g rice' },
      { id: '3', name: 'Salmon & Roasted Vegetables', time: '19:30', serving: '180g salmon + asparagus' },
    ],
  })
  const [feeForm, setFeeForm] = useState({
    amount: '49.00',
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    currency: 'USD',
    note: 'Monthly Gym Access & Coaching',
  })

  // Filters
  const [feeStatusFilter, setFeeStatusFilter] = useState<'all' | 'submitted' | 'due' | 'approved' | 'overdue' | 'rejected'>('all')
  const [rosterSearch, setRosterSearch] = useState('')
  const [rosterRoleFilter, setRosterRoleFilter] = useState<'all' | 'member' | 'trainer' | 'owner' | 'admin'>('all')

  const members = useMemo(() => (data?.members || []).filter((m: any) => m.role === 'member'), [data])
  const selectedTrainingPlan = useMemo(
    () => (data?.trainingPlans || []).find((plan: any) => plan.memberId === selectedMember),
    [data, selectedMember]
  )

  const routineOptions = useMemo(
    () => [
      { value: '', label: 'Rest & Recovery', icon: 'moon', subtitle: 'Active rest & recovery' },
      ...S.routines.map(routine => ({
        value: routine.id,
        label: routine.name,
        icon: 'dumbbell',
        subtitle: `${routine.ex?.length || 0} exercises`,
      })),
    ],
    [S.routines]
  )

  useEffect(() => {
    const assignedWeek = selectedTrainingPlan?.week || {}
    setTrainingPlanForm({
      week: PLAN_DAYS.reduce(
        (week, day) => ({ ...week, [day]: assignedWeek[day] || '' }),
        {} as Record<number, string>
      ),
    })
  }, [selectedMember, selectedTrainingPlan?.id, selectedTrainingPlan?.updatedAt])

  const reload = async () => {
    try {
      const [next, requests] = await Promise.all([
        getManagementOverview(),
        getAccessRequests().catch(() => ({ requests: [] })),
      ])
      setData(next)
      setAccessRequests(requests.requests || [])
      setSelectedMember(current => current || next.members?.find((m: any) => m.role === 'member')?.id || '')
      setRoleForm(current => ({
        ...current,
        memberId: current.memberId || next.members?.[0]?.id || '',
        gymId: current.gymId || next.viewer?.gymId || '',
      }))
      setRequestForm(current => ({
        ...current,
        gymId: current.gymId || next.viewer?.gymId || next.gyms?.[0]?.id || '',
      }))
    } catch (e: any) {
      toast(e.message || 'Could not load gym workspace')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    listGyms()
      .then(result => setGyms(result.gyms || []))
      .catch(() => {})
  }, [])

  const run = async (work: () => Promise<any>, successMsg: string) => {
    try {
      await work()
      toast(`⚡ ${successMsg}`)
      await reload()
    } catch (e: any) {
      toast(e.message || 'Something went wrong')
    }
  }

  const selectedMemberObj = members.find((m: any) => m.id === selectedMember)
  const selectedMemberName = selectedMemberObj?.name || 'Trainee'
  const coachFormReady = !!selectedMember
  const todayDay = new Date().getDay()

  // For members: today routine
  const myAssignedPlan = data?.trainingPlan
  const myAssignedRoutine = myAssignedPlan
    ? (myAssignedPlan.routines || []).find((routine: any) => routine.id === myAssignedPlan.week?.[todayDay])
    : null

  const trainerOptions = useMemo(
    () => [
      { value: '', label: 'No trainer assigned' },
      ...(data?.members || [])
        .filter((member: any) => member.role === 'trainer' || member.role === 'owner' || member.admin)
        .map((member: any) => ({
          value: member.id,
          label: member.name,
          subtitle: personaLabel(member.role, member.admin),
          icon: 'arm',
        })),
    ],
    [data]
  )

  const memberOptions = useMemo(
    () =>
      (data?.members || []).map((m: any) => ({
        value: m.id,
        label: m.name,
        subtitle: `${personaLabel(m.role, m.admin)}${m.gymId ? ` · Gym: ${m.gymId}` : ''}`,
        icon: 'person',
      })),
    [data]
  )

  const gymOptions = useMemo(
    () =>
      (gyms.length ? gyms : data?.gyms || []).map((g: any) => ({
        value: g.id,
        label: g.name || g.id,
        subtitle: `ID: ${g.id}`,
        icon: 'globe',
      })),
    [gyms, data]
  )

  const pendingRequestsCount =
    (data?.requests?.length || 0) + accessRequests.filter((r: any) => r.status === 'pending').length
  const pendingFeesCount = (data?.fees || []).filter((f: any) => f.status === 'submitted').length
  const totalLogsHit = (data?.logs || []).filter((l: any) => l.status === 'hit' || l.status === 'logged').length
  const totalLogsMissed = (data?.logs || []).filter((l: any) => l.status === 'missed').length
  const complianceRate =
    totalLogsHit + totalLogsMissed > 0
      ? Math.round((totalLogsHit / (totalLogsHit + totalLogsMissed)) * 100)
      : 100

  const updateFood = (id: string, patch: Partial<(typeof dietForm.foods)[0]>) =>
    setDietForm(current => ({
      ...current,
      foods: current.foods.map(food => (food.id === id ? { ...food, ...patch } : food)),
    }))

  const addFood = (preset?: { name: string; serving: string; time: string }) =>
    setDietForm(current => ({
      ...current,
      foods: [
        ...current.foods,
        {
          id: crypto.randomUUID?.() || String(Date.now() + current.foods.length),
          name: preset?.name || '',
          time: preset?.time || '12:00',
          serving: preset?.serving || '',
        },
      ],
    }))

  const removeFood = (id: string) =>
    setDietForm(current => ({
      ...current,
      foods: current.foods.length > 1 ? current.foods.filter(food => food.id !== id) : current.foods,
    }))

  const applySplitPreset = (presetKey: string) => {
    if (!S.routines.length) {
      toast('Create routines in your Plan tab first to auto-populate splits!')
      return
    }
    const rPush = S.routines.find(r => /push/i.test(r.name))?.id || S.routines[0]?.id || ''
    const rPull = S.routines.find(r => /pull/i.test(r.name))?.id || S.routines[1]?.id || S.routines[0]?.id || ''
    const rLegs = S.routines.find(r => /leg/i.test(r.name))?.id || S.routines[2]?.id || S.routines[0]?.id || ''
    const rUpper = S.routines.find(r => /upper/i.test(r.name))?.id || rPush
    const rLower = S.routines.find(r => /lower/i.test(r.name))?.id || rLegs
    const rFull = S.routines[0]?.id || ''

    let newWeek: Record<number, string> = blankWeek()

    if (presetKey === 'ppl') {
      newWeek = { 1: rPush, 2: rPull, 3: rLegs, 4: '', 5: rPush, 6: rPull, 0: '' }
      toast('Applied Push / Pull / Legs split template!')
    } else if (presetKey === 'upperlower') {
      newWeek = { 1: rUpper, 2: rLower, 3: '', 4: rUpper, 5: rLower, 6: '', 0: '' }
      toast('Applied Upper / Lower 4-day split!')
    } else if (presetKey === 'fullbody') {
      newWeek = { 1: rFull, 2: '', 3: rFull, 4: '', 5: rFull, 6: '', 0: '' }
      toast('Applied Full Body 3x split!')
    } else if (presetKey === 'clear') {
      newWeek = blankWeek()
      toast('Cleared week schedule to rest days.')
    }
    setTrainingPlanForm({ week: newWeek })
  }

  if (loading) {
    return (
      <div className="narrow mgmt-page">
        <div className="hdr" style={{ marginBottom: 16 }}>
          <div>
            <h1 className="t">Gym Operations</h1>
            <div className="sub">Connecting to workspace…</div>
          </div>
        </div>
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <div className="dim small">Loading gym data…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="narrow mgmt-page" style={{ paddingBottom: 32 }}>
      <WorkspaceNav />

      {/* Header Banner */}
      <div className="mgmt-header-card" style={{ marginTop: 12 }}>
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 6 }}>
              <span className="tag acc">{personaLabel(role, role === 'admin')}</span>
              {data?.viewer?.gymId ? (
                <span
                  className="tag"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    navigator.clipboard?.writeText(data.viewer.gymId).catch(() => {})
                    toast(`Copied Gym ID: ${data.viewer.gymId}`)
                  }}
                  title="Click to copy Gym ID"
                >
                  <Icon name="globe" style={{ fontSize: 11, marginRight: 4 }} />
                  Facility: {data.viewer.gymId}
                </span>
              ) : (
                <span className="tag" style={{ color: 'var(--orange)' }}>No Gym Assigned</span>
              )}
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 750 }}>
              {role === 'member'
                ? 'My Gym Portal'
                : role === 'trainer'
                ? 'Coach Command Center'
                : role === 'owner'
                ? 'Gym Operations & Ops'
                : 'Super Admin Gym Matrix'}
            </h1>
            <div className="dim small" style={{ marginTop: 4 }}>
              {role === 'member'
                ? 'Track your assigned routine splits, daily fuel checklist, and membership dues.'
                : 'Deploy 7-day splits, configure nutrition protocols, and manage squad dues.'}
            </div>
          </div>
          <button className="iconbtn" onClick={reload} aria-label="Refresh data" title="Refresh">
            ↻
          </button>
        </div>
      </div>

      {/* KPI Tiles */}
      <div className="tiles" style={{ marginBottom: 14 }}>
        {isCoach ? (
          <>
            <div className="tile" onClick={() => setActiveTab('splits')} style={{ cursor: 'pointer' }}>
              <div className="l">Trainees</div>
              <div className="v">{members.length}</div>
            </div>
            <div className="tile" onClick={() => setActiveTab('splits')} style={{ cursor: 'pointer' }}>
              <div className="l">Active Plans</div>
              <div className="v" style={{ color: 'var(--acc)' }}>{(data?.trainingPlans || []).length}</div>
            </div>
            <div className="tile" onClick={() => setActiveTab('activity')} style={{ cursor: 'pointer' }}>
              <div className="l">Compliance</div>
              <div className="v" style={{ color: 'var(--green)' }}>{complianceRate}%</div>
            </div>
            <div
              className="tile"
              onClick={() => setActiveTab(pendingRequestsCount > 0 ? 'inbox' : 'fees')}
              style={{ cursor: 'pointer' }}
            >
              <div className="l">Inbox Actions</div>
              <div className="v" style={{ color: pendingRequestsCount + pendingFeesCount > 0 ? 'var(--orange)' : undefined }}>
                {pendingRequestsCount + pendingFeesCount}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="tile" onClick={() => myAssignedRoutine && nav('/workout')} style={{ cursor: 'pointer' }}>
              <div className="l">Today's Workout</div>
              <div className="v" style={{ fontSize: '1rem', color: myAssignedRoutine ? 'var(--acc)' : undefined }}>
                {myAssignedRoutine ? myAssignedRoutine.name : 'Rest / Open'}
              </div>
            </div>
            <div className="tile" onClick={() => setActiveTab('nutrition')} style={{ cursor: 'pointer' }}>
              <div className="l">Daily Fuel</div>
              <div className="v">{data?.diets?.[0]?.calories ? `${data.diets[0].calories} kcal` : 'Open'}</div>
            </div>
            <div className="tile" onClick={() => setActiveTab('fees')} style={{ cursor: 'pointer' }}>
              <div className="l">Dues Status</div>
              <div
                className="v"
                style={{
                  fontSize: '.95rem',
                  color: (data?.fees || []).some((f: any) => f.status === 'due' || f.status === 'overdue')
                    ? 'var(--orange)'
                    : 'var(--green)',
                }}
              >
                {(data?.fees || []).some((f: any) => f.status === 'due' || f.status === 'overdue') ? 'Payment Due' : 'Paid Up'}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main Tab Bar */}
      <div className="mgmt-tab-bar" style={{ marginBottom: 14 }}>
        {isCoach ? (
          <>
            <button
              type="button"
              className={`mgmt-tab-pill ${activeTab === 'splits' ? 'active' : ''}`}
              onClick={() => setActiveTab('splits')}
            >
              <Icon name="dumbbell" />
              <span>Splits & Plans</span>
            </button>
            <button
              type="button"
              className={`mgmt-tab-pill ${activeTab === 'nutrition' ? 'active' : ''}`}
              onClick={() => setActiveTab('nutrition')}
            >
              <Icon name="heart" />
              <span>Fuel Protocols</span>
            </button>
            <button
              type="button"
              className={`mgmt-tab-pill ${activeTab === 'fees' ? 'active' : ''}`}
              onClick={() => setActiveTab('fees')}
            >
              <Icon name="plate" />
              <span>Billing & Dues</span>
              {pendingFeesCount > 0 && <span className="gz-tab-badge">{pendingFeesCount}</span>}
            </button>
            {isManager && (
              <button
                type="button"
                className={`mgmt-tab-pill ${activeTab === 'roster' ? 'active' : ''}`}
                onClick={() => setActiveTab('roster')}
              >
                <Icon name="users" />
                <span>Team & Roster</span>
              </button>
            )}
            <button
              type="button"
              className={`mgmt-tab-pill ${activeTab === 'activity' ? 'active' : ''}`}
              onClick={() => setActiveTab('activity')}
            >
              <Icon name="flame" />
              <span>Squad Activity</span>
            </button>
            <button
              type="button"
              className={`mgmt-tab-pill ${activeTab === 'inbox' ? 'active' : ''}`}
              onClick={() => setActiveTab('inbox')}
            >
              <Icon name="bell" />
              <span>Requests Queue</span>
              {pendingRequestsCount > 0 && <span className="gz-tab-badge">{pendingRequestsCount}</span>}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`mgmt-tab-pill ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <Icon name="chart" />
              <span>Overview</span>
            </button>
            <button
              type="button"
              className={`mgmt-tab-pill ${activeTab === 'nutrition' ? 'active' : ''}`}
              onClick={() => setActiveTab('nutrition')}
            >
              <Icon name="heart" />
              <span>Daily Fuel</span>
            </button>
            <button
              type="button"
              className={`mgmt-tab-pill ${activeTab === 'fees' ? 'active' : ''}`}
              onClick={() => setActiveTab('fees')}
            >
              <Icon name="plate" />
              <span>My Dues</span>
            </button>
            <button
              type="button"
              className={`mgmt-tab-pill ${activeTab === 'inbox' ? 'active' : ''}`}
              onClick={() => setActiveTab('inbox')}
            >
              <Icon name="mail" />
              <span>Gym Access</span>
            </button>
          </>
        )}
      </div>

      {/* =========================================================================
          TAB: OVERVIEW (FOR MEMBERS)
         ========================================================================= */}
      {activeTab === 'overview' && !isCoach && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Today's Focus Card */}
          <div className="card">
            <div className="row between" style={{ marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>Today's Training Schedule</h2>
              <span className="tag acc">{PLAN_DAY_LABELS[todayDay]}</span>
            </div>
            <div style={{ padding: '8px 0' }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {myAssignedRoutine ? myAssignedRoutine.name : 'Self-Guided Training / Active Recovery'}
              </div>
              <p className="dim small" style={{ margin: '6px 0 12px', lineHeight: 1.4 }}>
                {myAssignedRoutine
                  ? `${myAssignedRoutine.ex?.length || 0} exercises prescribed by your coach for today.`
                  : 'No trainer routine scheduled for today. Train freely or take a rest day.'}
              </p>
              {myAssignedRoutine && (
                <Button variant="primary" size="sm" icon="play" onClick={() => nav('/workout')}>
                  Start Workout
                </Button>
              )}
            </div>
          </div>

          {/* 7-Day Schedule Overview */}
          {myAssignedPlan && (
            <div className="card">
              <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>7-Day Split Routine</h2>
              <div className="list" style={{ gap: 4 }}>
                {PLAN_DAYS.map(day => {
                  const routineId = myAssignedPlan.week?.[day]
                  const rObj = (myAssignedPlan.routines || []).find((r: any) => r.id === routineId)
                  const isToday = day === todayDay
                  return (
                    <div
                      key={day}
                      className="row between"
                      style={{
                        padding: '8px 4px',
                        borderBottom: '1px solid var(--sep)',
                        background: isToday ? 'var(--surface-2)' : undefined,
                        borderRadius: isToday ? 8 : 0,
                      }}
                    >
                      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                        <span className="tag" style={{ width: 44, textAlign: 'center' }}>
                          {PLAN_DAY_SHORT[day]}
                        </span>
                        <span style={{ fontWeight: isToday ? 700 : 500 }}>
                          {rObj ? rObj.name : 'Rest & Recovery'}
                        </span>
                      </div>
                      {isToday && <span className="tag acc">Today</span>}
                      {rObj && !isToday && <span className="dim small">{rObj.ex?.length || 0} ex</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB: SPLITS & PLANS (COACHES)
         ========================================================================= */}
      {isCoach && activeTab === 'splits' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Trainee Spotlight Bar */}
          {members.length > 0 ? (
            <div className="card" style={{ padding: 12 }}>
              <div className="row between" style={{ marginBottom: 8 }}>
                <span className="small muted" style={{ fontWeight: 700 }}>SELECT SQUAD TRAINEE</span>
                <span className="tag acc">{members.length} Trainees</span>
              </div>
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                {members.map((m: any) => {
                  const isSel = m.id === selectedMember
                  const hasPlan = (data?.trainingPlans || []).some((p: any) => p.memberId === m.id)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={`admin-filter-pill ${isSel ? 'active' : ''}`}
                      onClick={() => setSelectedMember(m.id)}
                      style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <span>{m.name}</span>
                      <small style={{ opacity: 0.8 }}>{hasPlan ? '✓' : '•'}</small>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 16, textAlign: 'center' }}>
              <div className="dim small">No trainees assigned to your squad yet. Assign members in the Roster tab.</div>
            </div>
          )}

          {/* Weekly Split Matrix */}
          <div className="card">
            <div className="row between" style={{ marginBottom: 10 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16 }}>7-Day Weekly Split</h2>
                <div className="small muted" style={{ marginTop: 2 }}>
                  Assign daily routines to <strong>{selectedMemberName}</strong>
                </div>
              </div>
              {selectedTrainingPlan && (
                <span className="tag">
                  Updated {prettyDate(selectedTrainingPlan.updatedAt || selectedTrainingPlan.created)}
                </span>
              )}
            </div>

            {/* Split Presets */}
            <div style={{ marginBottom: 12 }}>
              <div className="small muted" style={{ marginBottom: 6 }}>Templates:</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Button size="xs" variant="secondary" onClick={() => applySplitPreset('ppl')}>
                  Push / Pull / Legs
                </Button>
                <Button size="xs" variant="secondary" onClick={() => applySplitPreset('upperlower')}>
                  Upper / Lower (4d)
                </Button>
                <Button size="xs" variant="secondary" onClick={() => applySplitPreset('fullbody')}>
                  Full Body (3d)
                </Button>
                <Button size="xs" variant="ghost" onClick={() => applySplitPreset('clear')}>
                  Clear to Rest
                </Button>
              </div>
            </div>

            {/* 7 Days List with SelectButtons */}
            <div className="list" style={{ gap: 8, marginBottom: 14 }}>
              {PLAN_DAYS.map(day => {
                const isToday = day === todayDay
                const routineId = trainingPlanForm.week[day]
                return (
                  <div
                    key={day}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      background: 'var(--surface-2)',
                      border: isToday ? '1px solid var(--acc-line)' : '1px solid var(--sep-op)',
                    }}
                  >
                    <div className="row between" style={{ marginBottom: 6 }}>
                      <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{PLAN_DAY_LABELS[day]}</span>
                        {isToday && <span className="tag acc" style={{ fontSize: 10 }}>Today</span>}
                      </div>
                    </div>
                    <SelectButton
                      value={routineId}
                      onChange={val =>
                        setTrainingPlanForm(cur => ({
                          ...cur,
                          week: { ...cur.week, [day]: val },
                        }))
                      }
                      options={routineOptions}
                      placeholder="Rest & Recovery"
                      title={`${PLAN_DAY_LABELS[day]} Routine`}
                    />
                  </div>
                )
              })}
            </div>

            <Button
              variant="primary"
              size="sm"
              icon="check"
              disabled={!coachFormReady || !Object.values(trainingPlanForm.week).some(Boolean)}
              onClick={() =>
                run(
                  () =>
                    createTrainingPlan({
                      memberId: selectedMember,
                      routines: S.routines,
                      week: trainingPlanForm.week,
                    }),
                  `Weekly split deployed to ${selectedMemberName}!`
                )
              }
            >
              Deploy Split to {selectedMemberName}
            </Button>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB: NUTRITION & FUEL
         ========================================================================= */}
      {activeTab === 'nutrition' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isCoach ? (
            <div className="card">
              <div className="row between" style={{ marginBottom: 10 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 16 }}>Fuel & Nutrition Protocol</h2>
                  <div className="small muted" style={{ marginTop: 2 }}>
                    Trainee: <strong>{selectedMemberName}</strong>
                  </div>
                </div>
              </div>

              <div className="form-grid-2" style={{ marginBottom: 12 }}>
                <div>
                  <label className="small muted" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                    Protocol Title
                  </label>
                  <TextField
                    value={dietForm.title}
                    onChange={e => setDietForm({ ...dietForm, title: e.target.value })}
                    placeholder="e.g. Daily High Protein Target"
                  />
                </div>
                <div>
                  <label className="small muted" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                    Target (kcal)
                  </label>
                  <TextField
                    value={dietForm.calories}
                    onChange={e => setDietForm({ ...dietForm, calories: e.target.value })}
                    placeholder="2400"
                  />
                </div>
              </div>

              {/* Quick food adds */}
              <div style={{ marginBottom: 12 }}>
                <div className="small muted" style={{ marginBottom: 6 }}>Quick Add Presets:</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {FOOD_PRESETS.map((preset, idx) => (
                    <Button key={idx} size="xs" variant="secondary" onClick={() => addFood(preset)}>
                      + {preset.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Meal checklist builder */}
              <div className="card" style={{ background: 'var(--surface-2)', padding: 12, marginBottom: 12 }}>
                <div className="row between" style={{ marginBottom: 8 }}>
                  <span className="small muted" style={{ fontWeight: 700 }}>
                    DAILY MEAL ITEMS ({dietForm.foods.length})
                  </span>
                  <Button size="xs" variant="ghost" icon="plus" onClick={() => addFood()}>
                    Add Meal
                  </Button>
                </div>

                <div className="list" style={{ gap: 8 }}>
                  {dietForm.foods.map(food => (
                    <div
                      key={food.id}
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 6,
                        alignItems: 'center',
                        padding: 8,
                        borderRadius: 8,
                        background: 'var(--surface)',
                        border: '1px solid var(--sep-op)',
                      }}
                    >
                      <input
                        className="field"
                        type="time"
                        value={food.time}
                        onChange={e => updateFood(food.id, { time: e.target.value })}
                        style={{ width: 85, height: 34, fontSize: 12, flex: 'none' }}
                      />
                      <input
                        className="field"
                        value={food.name}
                        onChange={e => updateFood(food.id, { name: e.target.value })}
                        placeholder="Food / meal"
                        style={{ height: 34, fontSize: 13, flex: '1 1 120px' }}
                      />
                      <input
                        className="field"
                        value={food.serving}
                        onChange={e => updateFood(food.id, { serving: e.target.value })}
                        placeholder="Portion"
                        style={{ height: 34, fontSize: 13, flex: '1 1 100px' }}
                      />
                      <button
                        type="button"
                        className="iconbtn"
                        onClick={() => removeFood(food.id)}
                        style={{ width: 32, height: 32, color: 'var(--red)', flex: 'none' }}
                        aria-label="Remove food"
                      >
                        <Icon name="xmark" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-grid-2" style={{ marginBottom: 12 }}>
                <div>
                  <label className="small muted" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                    Macro Guidelines
                  </label>
                  <TextArea
                    value={dietForm.meals}
                    onChange={e => setDietForm({ ...dietForm, meals: e.target.value })}
                    placeholder="e.g. 180g Protein, 200g Carbs, 60g Fats"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="small muted" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                    Coach Guidance
                  </label>
                  <TextArea
                    value={dietForm.notes}
                    onChange={e => setDietForm({ ...dietForm, notes: e.target.value })}
                    placeholder="e.g. Hydrate with 3-4L water daily"
                    rows={2}
                  />
                </div>
              </div>

              <Button
                variant="primary"
                size="sm"
                icon="heart"
                disabled={!coachFormReady || !dietForm.title || !dietForm.foods.some(food => food.name.trim())}
                onClick={() =>
                  run(
                    () => createDiet({ memberId: selectedMember, ...dietForm }),
                    `Nutrition protocol deployed to ${selectedMemberName}!`
                  )
                }
              >
                Deploy Protocol to {selectedMemberName}
              </Button>
            </div>
          ) : (
            /* Member interactive diet checklist */
            <div className="card">
              <div className="row between" style={{ marginBottom: 10 }}>
                <h2 style={{ margin: 0, fontSize: 16 }}>My Daily Nutrition Checklist</h2>
                {data?.diets?.[0]?.calories && <span className="tag acc">{data.diets[0].calories} kcal</span>}
              </div>

              {data?.diets?.length ? (
                data.diets.map((diet: any) => (
                  <div key={diet.id}>
                    <div style={{ fontWeight: 650, fontSize: 15, marginBottom: 4 }}>{diet.title}</div>
                    <div className="dim small" style={{ marginBottom: 12 }}>
                      {diet.notes || 'Follow your daily nutrition guidelines below:'}
                    </div>

                    <div className="list" style={{ gap: 6 }}>
                      {(diet.foods || []).map((food: any) => {
                        const checked = (data.logs || []).some(
                          (log: any) =>
                            log.assignmentId === diet.id &&
                            log.itemId === food.id &&
                            log.status === 'logged'
                        )
                        return (
                          <div
                            key={food.id}
                            className="card small"
                            style={{
                              padding: '10px 12px',
                              background: checked ? 'var(--surface-3)' : 'var(--surface-2)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              border: checked ? '1px solid var(--acc)' : undefined,
                            }}
                            onClick={() =>
                              run(
                                () =>
                                  logAssignment('diet', diet.id, checked ? 'missed' : 'logged', undefined, undefined, food.id),
                                checked ? 'Unmarked item' : 'Logged item complete!'
                              )
                            }
                          >
                            <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                              <div
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: 6,
                                  border: '2px solid var(--acc)',
                                  background: checked ? 'var(--acc)' : 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'var(--on-acc)',
                                  fontSize: 12,
                                  fontWeight: 800,
                                }}
                              >
                                {checked && '✓'}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, textDecoration: checked ? 'line-through' : 'none' }}>
                                  {food.name}
                                </div>
                                <div className="dim small" style={{ fontSize: '.76rem' }}>
                                  {food.time} {food.serving ? `· ${food.serving}` : ''}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="dim small">No nutrition protocol assigned by your coach yet.</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB: FEES & DUES
         ========================================================================= */}
      {activeTab === 'fees' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isManager && (
            <div className="card">
              <div className="row between" style={{ marginBottom: 10 }}>
                <h2 style={{ margin: 0, fontSize: 16 }}>Issue Membership Fee</h2>
                <span className="tag">Invoicing</span>
              </div>

              <div className="form-grid-4" style={{ marginBottom: 10 }}>
                <SelectButton
                  label="Trainee"
                  value={selectedMember}
                  onChange={setSelectedMember}
                  options={members.map((m: any) => ({
                    value: m.id,
                    label: m.name,
                    icon: 'person',
                  }))}
                  placeholder="Select Trainee"
                  searchable={true}
                />
                <div>
                  <label className="small muted" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Amount</label>
                  <input
                    className="field"
                    type="number"
                    value={feeForm.amount}
                    onChange={e => setFeeForm({ ...feeForm, amount: e.target.value })}
                    style={{ minHeight: 38 }}
                  />
                </div>
                <div>
                  <label className="small muted" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Due Date</label>
                  <input
                    className="field"
                    type="date"
                    value={feeForm.dueDate}
                    onChange={e => setFeeForm({ ...feeForm, dueDate: e.target.value })}
                    style={{ minHeight: 38 }}
                  />
                </div>
                <div>
                  <label className="small muted" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Currency</label>
                  <input
                    className="field"
                    value={feeForm.currency}
                    onChange={e => setFeeForm({ ...feeForm, currency: e.target.value.toUpperCase() })}
                    style={{ minHeight: 38 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label className="small muted" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Plan Note / Memo</label>
                <TextField
                  value={feeForm.note}
                  onChange={e => setFeeForm({ ...feeForm, note: e.target.value })}
                  placeholder="e.g. Monthly Unlimited Gym + Coaching"
                />
              </div>

              <Button
                variant="primary"
                size="sm"
                icon="plus"
                disabled={!selectedMember || !feeForm.amount || !feeForm.dueDate}
                onClick={() => run(() => createFee({ memberId: selectedMember, ...feeForm }), 'Invoice created!')}
              >
                Create Invoice
              </Button>

              {/* Invoice Roster */}
              <div style={{ marginTop: 20 }}>
                <div className="row between" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                  <h4 className="sec" style={{ margin: 0 }}>Invoice Roster</h4>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {(['all', 'submitted', 'due', 'approved', 'overdue', 'rejected'] as const).map(st => (
                      <button
                        key={st}
                        type="button"
                        className={`admin-filter-pill ${feeStatusFilter === st ? 'active' : ''}`}
                        onClick={() => setFeeStatusFilter(st)}
                        style={{ fontSize: 11, padding: '2px 8px' }}
                      >
                        {st === 'all' ? 'All' : st === 'submitted' ? 'Review Needed' : st}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="list" style={{ gap: 6 }}>
                  {(data?.fees || [])
                    .filter((f: any) => feeStatusFilter === 'all' || f.status === feeStatusFilter)
                    .map((fee: any) => {
                      const memberName = members.find((m: any) => m.id === fee.memberId)?.name || fee.memberId
                      return (
                        <div
                          key={fee.id}
                          className="card small"
                          style={{
                            padding: '10px 12px',
                            background: 'var(--surface-2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 650 }}>{memberName}</div>
                            <div className="dim small" style={{ fontSize: '.76rem' }}>
                              {fee.amount} {fee.currency} · Due {prettyDate(fee.dueDate)}
                              {fee.note ? ` · ${fee.note}` : ''}
                            </div>
                          </div>
                          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                            <span className="tag" style={{ textTransform: 'capitalize' }}>
                              {fee.status === 'submitted' ? 'Review Needed' : fee.status}
                            </span>
                            {fee.status === 'submitted' && (
                              <div className="row" style={{ gap: 4 }}>
                                <Button
                                  size="xs"
                                  variant="primary"
                                  onClick={() => run(() => reviewFee(fee.id, 'approved'), 'Payment approved!')}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="xs"
                                  variant="danger"
                                  onClick={() => run(() => reviewFee(fee.id, 'rejected'), 'Payment rejected')}
                                >
                                  Reject
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  {!(data?.fees || []).filter((f: any) => feeStatusFilter === 'all' || f.status === feeStatusFilter).length && (
                    <div className="dim small" style={{ padding: '8px 0', textAlign: 'center' }}>
                      No invoices in this status.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {role === 'member' && (
            <div className="card">
              <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>My Membership Dues</h2>
              <div className="list" style={{ gap: 6 }}>
                {(data?.fees || []).map((fee: any) => (
                  <div
                    key={fee.id}
                    className="card small"
                    style={{
                      padding: '10px 12px',
                      background: 'var(--surface-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>
                        {fee.amount} {fee.currency}
                      </div>
                      <div className="dim small" style={{ fontSize: '.76rem' }}>
                        Due {prettyDate(fee.dueDate)} · {fee.note || 'Membership'}
                      </div>
                    </div>
                    <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                      <span className="tag" style={{ textTransform: 'capitalize' }}>
                        {fee.status}
                      </span>
                      {['due', 'overdue', 'rejected'].includes(fee.status) && (
                        <Button size="xs" variant="primary" onClick={() => run(() => submitFee(fee.id), 'Payment submitted for review')}>
                          Mark Paid
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {!(data?.fees || []).length && (
                  <div className="dim small" style={{ textAlign: 'center', padding: '8px 0' }}>
                    No dues or invoices pending.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB: TEAM & ROSTER (MANAGERS)
         ========================================================================= */}
      {isManager && activeTab === 'roster' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="row between" style={{ marginBottom: 10 }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>Team & Role Assignments</h2>
              <span className="tag acc">{(data?.members || []).length} Members</span>
            </div>

            {/* Role Config Form */}
            <div className="form-grid-2" style={{ marginBottom: 12 }}>
              <SelectButton
                label="Person"
                value={roleForm.memberId}
                onChange={val => setRoleForm({ ...roleForm, memberId: val, trainerId: '' })}
                options={memberOptions}
                placeholder="Choose user"
                searchable={true}
              />
              <SelectButton
                label="Role"
                value={roleForm.role}
                onChange={val => setRoleForm({ ...roleForm, role: val as PersonaRole })}
                options={roles
                  .filter(value => role === 'admin' || value === 'member' || value === 'trainer')
                  .map(val => ({
                    value: val,
                    label: personaLabel(val, val === 'admin'),
                    icon: val === 'admin' ? 'crown' : val === 'owner' ? 'bolt' : val === 'trainer' ? 'arm' : 'person',
                  }))}
                placeholder="Select role"
              />
              <div>
                <label className="small muted" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                  Gym Facility ID
                </label>
                <input
                  className="field"
                  value={roleForm.gymId}
                  onChange={e => setRoleForm({ ...roleForm, gymId: e.target.value })}
                  placeholder="e.g. downtown"
                  style={{ minHeight: 38 }}
                />
              </div>

              {roleForm.role === 'member' && (
                <SelectButton
                  label="Assigned Coach"
                  value={roleForm.trainerId}
                  onChange={val => setRoleForm({ ...roleForm, trainerId: val })}
                  options={trainerOptions}
                  placeholder="No trainer assigned"
                />
              )}
            </div>

            <Button
              variant="primary"
              size="sm"
              icon="check"
              disabled={!roleForm.memberId || !roleForm.gymId}
              onClick={() =>
                run(
                  () =>
                    api('/api/admin/user/role', {
                      method: 'POST',
                      body: JSON.stringify({
                        id: roleForm.memberId,
                        role: roleForm.role,
                        gymId: roleForm.gymId,
                        trainerId: roleForm.trainerId || null,
                      }),
                    }),
                  'Role and trainer configuration saved!'
                )
              }
            >
              Save Assignment
            </Button>

            {/* Squad Directory */}
            <div style={{ marginTop: 20 }}>
              <div className="row between" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                <h4 className="sec" style={{ margin: 0 }}>Squad Directory</h4>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['all', 'trainer', 'member', 'owner', 'admin'] as const).map(rf => (
                    <button
                      key={rf}
                      type="button"
                      className={`admin-filter-pill ${rosterRoleFilter === rf ? 'active' : ''}`}
                      onClick={() => setRosterRoleFilter(rf)}
                      style={{ fontSize: 11, padding: '2px 8px' }}
                    >
                      {rf === 'all' ? 'All' : personaLabel(rf, rf === 'admin')}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 8 }}>
                <TextField
                  value={rosterSearch}
                  onChange={e => setRosterSearch(e.target.value)}
                  placeholder="Search squad by name or ID…"
                  style={{ height: 34, fontSize: 13 }}
                />
              </div>

              <div className="list" style={{ gap: 6 }}>
                {(data?.members || [])
                  .filter((m: any) => {
                    if (rosterRoleFilter !== 'all' && m.role !== rosterRoleFilter) return false
                    if (rosterSearch.trim()) {
                      const q = rosterSearch.toLowerCase()
                      return (m.name || '').toLowerCase().includes(q) || (m.id || '').toLowerCase().includes(q)
                    }
                    return true
                  })
                  .map((m: any) => {
                    const assignedCoach = (data?.members || []).find((c: any) => c.id === m.trainerId)
                    return (
                      <div
                        key={m.id}
                        className="card small"
                        style={{
                          padding: '8px 12px',
                          background: 'var(--surface-2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 650 }}>{m.name}</div>
                          <div className="row" style={{ gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                            <span className="tag acc" style={{ fontSize: 10 }}>
                              {personaLabel(m.role, m.admin)}
                            </span>
                            {m.gymId && (
                              <span className="tag" style={{ fontSize: 10 }}>
                                Gym: {m.gymId}
                              </span>
                            )}
                            {assignedCoach && (
                              <span className="tag" style={{ fontSize: 10 }}>
                                Coach: {assignedCoach.name}
                              </span>
                            )}
                          </div>
                        </div>

                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            setRoleForm({
                              memberId: m.id,
                              role: m.role || 'member',
                              gymId: m.gymId || data?.viewer?.gymId || '',
                              trainerId: m.trainerId || '',
                            })
                            toast(`Selected ${m.name} for editing above`)
                          }}
                        >
                          Edit
                        </Button>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>

          {/* Admin Gym Hub Creator */}
          {role === 'admin' && (
            <div className="card">
              <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Create Gym Facility Hub</h2>
              <div className="row" style={{ gap: 8, marginBottom: 10 }}>
                <TextField
                  value={gymName}
                  onChange={e => setGymName(e.target.value)}
                  placeholder="Facility name (e.g. Iron Vault)"
                  style={{ flex: 1 }}
                />
                <Button
                  variant="primary"
                  size="sm"
                  icon="plus"
                  disabled={!gymName.trim()}
                  onClick={() =>
                    run(
                      () =>
                        api('/api/admin/gyms', { method: 'POST', body: JSON.stringify({ name: gymName }) })
                          .then(() => {
                            setGymName('')
                            return listGyms()
                          })
                          .then(result => setGyms(result.gyms || [])),
                      'Gym Hub created!'
                    )
                  }
                >
                  Create
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB: SQUAD ACTIVITY (COACHES)
         ========================================================================= */}
      {isCoach && activeTab === 'activity' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="row between" style={{ marginBottom: 10 }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>Squad Activity & Consistency</h2>
              <span className="tag acc">{complianceRate}% Consistency</span>
            </div>

            <div className="list" style={{ gap: 6 }}>
              {(data?.logs || []).slice(0, 25).map((log: any, idx: number) => {
                const mem = members.find((m: any) => m.id === log.memberId)
                const isHit = log.status === 'hit' || log.status === 'logged'
                return (
                  <div
                    key={`${log.assignmentId}-${log.date}-${idx}`}
                    className="card small"
                    style={{
                      padding: '8px 12px',
                      background: 'var(--surface-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 650 }}>{mem?.name || log.memberId}</div>
                      <div className="dim small" style={{ fontSize: '.76rem' }}>
                        {log.assignmentType} · {log.date}
                        {log.metric ? ` · ${log.metric}` : ''}
                      </div>
                    </div>
                    <span className="tag" style={{ color: isHit ? 'var(--green)' : 'var(--orange)' }}>
                      {log.status}
                    </span>
                  </div>
                )
              })}
              {!(data?.logs || []).length && <div className="dim small">No squad activity recorded yet.</div>}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB: REQUESTS INBOX
         ========================================================================= */}
      {activeTab === 'inbox' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isManager ? (
            <div className="card">
              <div className="row between" style={{ marginBottom: 10 }}>
                <h2 style={{ margin: 0, fontSize: 16 }}>Requests Queue</h2>
                <span className="tag acc">{pendingRequestsCount} Pending</span>
              </div>

              <div className="list" style={{ gap: 8 }}>
                {(data?.requests || []).map((request: any) => (
                  <div
                    key={String(request._id)}
                    className="card small"
                    style={{ padding: 12, background: 'var(--surface-2)' }}
                  >
                    <div className="row between" style={{ marginBottom: 6 }}>
                      <div>
                        <div style={{ fontWeight: 650 }}>{request.requesterName || 'Member Request'}</div>
                        <div className="dim small">{timeAgo(request.created)}</div>
                      </div>
                      <span className="tag acc">{personaLabel(request.requestedRole)}</span>
                    </div>
                    {request.message && (
                      <div className="dim small" style={{ marginBottom: 8 }}>
                        "{request.message}"
                      </div>
                    )}
                    <div className="row" style={{ gap: 6 }}>
                      <Button
                        size="xs"
                        variant="primary"
                        onClick={() =>
                          run(() => reviewManagementRequest(String(request._id), 'approve'), 'Request approved!')
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        size="xs"
                        variant="danger"
                        onClick={() =>
                          run(() => reviewManagementRequest(String(request._id), 'reject'), 'Request rejected')
                        }
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}

                {accessRequests
                  .filter((r: any) => r.status === 'pending')
                  .map((request: any) => (
                    <div
                      key={String(request._id)}
                      className="card small"
                      style={{ padding: 12, background: 'var(--surface-2)' }}
                    >
                      <div className="row between" style={{ marginBottom: 6 }}>
                        <div>
                          <div style={{ fontWeight: 650 }}>{request.name}</div>
                          <div className="dim small">{request.email}</div>
                        </div>
                        <span className="tag">{personaLabel(request.requestedRole)}</span>
                      </div>
                      {request.message && (
                        <div className="dim small" style={{ marginBottom: 8 }}>
                          "{request.message}"
                        </div>
                      )}
                      <div className="row" style={{ gap: 6 }}>
                        <Button
                          size="xs"
                          variant="primary"
                          onClick={() =>
                            run(
                              () =>
                                approveAccessRequest(
                                  String(request._id),
                                  request.requestedRole || 'member',
                                  request.gymId || user?.gymId
                                ),
                              'Access Invite Approved!'
                            )
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          size="xs"
                          variant="danger"
                          onClick={() =>
                            run(
                              () =>
                                api('/api/admin/access-request/reject', {
                                  method: 'POST',
                                  body: JSON.stringify({ id: request._id }),
                                }),
                              'Access request rejected'
                            )
                          }
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}

                {!pendingRequestsCount && (
                  <div className="dim small" style={{ textAlign: 'center', padding: '12px 0' }}>
                    Inbox Zero — all applications cleared.
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Member Gym Request Form */
            <div className="card">
              <h2 style={{ margin: '0 0 6px', fontSize: 16 }}>Request Gym Access or Role</h2>
              <p className="dim small" style={{ marginBottom: 12 }}>
                Apply to join a local gym facility or upgrade your status to trainer.
              </p>

              <div className="form-grid-2" style={{ marginBottom: 12 }}>
                <SelectButton
                  label="Target Facility"
                  value={requestForm.gymId}
                  onChange={val => setRequestForm({ ...requestForm, gymId: val })}
                  options={gymOptions}
                  placeholder="Select facility"
                  searchable={true}
                />
                <SelectButton
                  label="Requested Role"
                  value={requestForm.requestedRole}
                  onChange={val => setRequestForm({ ...requestForm, requestedRole: val })}
                  options={[
                    { value: 'member', label: 'Gym Member (Trainee)', icon: 'person' },
                    { value: 'trainer', label: 'Gym Trainer (Coach)', icon: 'arm' },
                  ]}
                  placeholder="Select role"
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label className="small muted" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                  Message to Management
                </label>
                <TextArea
                  value={requestForm.message}
                  onChange={e => setRequestForm({ ...requestForm, message: e.target.value })}
                  placeholder="Tell the gym owner about your training goals…"
                  rows={2}
                />
              </div>

              <Button
                variant="primary"
                size="sm"
                icon="mail"
                disabled={!requestForm.gymId}
                onClick={() => run(() => createManagementRequest(requestForm), 'Application sent!')}
              >
                Submit Application
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
