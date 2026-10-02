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
import { Button, TextField, TextArea } from '../components/ui'
import { personaLabel } from '../components/PersonaPicker'
import PageBreadcrumb from '../components/PageBreadcrumb'
import WorkspaceNav from '../components/WorkspaceNav'
import type { PersonaRole } from '../types/store/user'

const roles: PersonaRole[] = ['member', 'trainer', 'owner', 'admin']
const PLAN_DAYS = [1, 2, 3, 4, 5, 6, 0]
const PLAN_DAY_LABELS: Record<number, string> = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 0: 'Sunday' }
const PLAN_DAY_SHORT: Record<number, string> = { 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT', 0: 'SUN' }
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

function GenZBadge({ children, variant = 'acc', icon }: { children: React.ReactNode; variant?: 'acc' | 'orange' | 'purple' | 'blue' | 'pink' | 'neutral'; icon?: string }) {
  return (
    <span className={`gz-badge gz-badge-${variant}`}>
      {icon && <Icon name={icon} />}
      <span>{children}</span>
    </span>
  )
}

function BentoStat({
  label,
  value,
  sub,
  icon,
  accent = 'var(--acc)',
  trend,
  onClick,
}: {
  label: string
  value: string | number
  sub?: string
  icon: string
  accent?: string
  trend?: string
  onClick?: () => void
}) {
  return (
    <div
      className={`gz-bento-stat ${onClick ? 'interactive' : ''}`}
      onClick={onClick}
      style={{ '--stat-acc': accent } as React.CSSProperties}
    >
      <div className="gz-bento-stat-top">
        <span className="gz-bento-stat-icon">
          <Icon name={icon} />
        </span>
        {trend && <span className="gz-bento-stat-trend">{trend}</span>}
      </div>
      <div className="gz-bento-stat-val">{value}</div>
      <div className="gz-bento-stat-label">{label}</div>
      {sub && <div className="gz-bento-stat-sub">{sub}</div>}
    </div>
  )
}

function SectionPanel({
  title,
  tag,
  icon,
  children,
  badge,
  action,
  glow = false,
}: {
  title: string
  tag?: string
  icon: string
  children: React.ReactNode
  badge?: React.ReactNode
  action?: React.ReactNode
  glow?: boolean
}) {
  return (
    <section className={`card gz-card ${glow ? 'gz-card-glow' : ''}`}>
      <div className="gz-card-header">
        <div className="gz-card-header-left">
          <span className="gz-card-icon">
            <Icon name={icon} />
          </span>
          <div>
            {tag && <div className="gz-card-tag">{tag}</div>}
            <h2 className="gz-card-title">{title}</h2>
          </div>
        </div>
        <div className="gz-card-header-right">
          {badge}
          {action}
        </div>
      </div>
      <div className="gz-card-body">{children}</div>
    </section>
  )
}

function CustomPicker({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select option…',
  searchable = false,
  icon,
}: {
  label?: string
  value: string
  options: Array<{ value: string; label: string; meta?: string; icon?: string }>
  onChange: (value: string) => void
  placeholder?: string
  searchable?: boolean
  icon?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const current = options.find(option => option.value === value)
  const visible = searchable && query.trim()
    ? options.filter(option => `${option.label} ${option.meta || ''}`.toLowerCase().includes(query.toLowerCase())).slice(0, 16)
    : options.slice(0, searchable ? 16 : 80)

  return (
    <div className="gz-picker">
      {label && <label className="gz-picker-label">{label}</label>}
      <button
        type="button"
        className={`gz-picker-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen(prev => !prev)}
        aria-expanded={open}
      >
        <span className="gz-picker-trigger-content">
          {icon && <Icon name={icon} className="gz-picker-trigger-icon" />}
          <span className={current ? 'gz-picker-selected' : 'gz-picker-placeholder'}>
            {current?.label || placeholder}
          </span>
          {current?.meta && <span className="gz-picker-meta-chip">{current.meta}</span>}
        </span>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} className="gz-picker-arrow" />
      </button>

      {open && (
        <>
          <div className="gz-picker-backdrop" onClick={() => { setOpen(false); setQuery('') }} />
          <div className="gz-picker-menu">
            {searchable && (
              <div className="gz-picker-search-wrap">
                <Icon name="magnifier" className="gz-picker-search-icon" />
                <input
                  autoFocus
                  className="gz-picker-search"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search…"
                />
                {query && (
                  <button type="button" className="gz-picker-search-clear" onClick={() => setQuery('')}>
                    <Icon name="xmark" />
                  </button>
                )}
              </div>
            )}
            <div className="gz-picker-options">
              {visible.map(option => (
                <button
                  type="button"
                  className={`gz-picker-option ${option.value === value ? 'selected' : ''}`}
                  key={option.value}
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  <span className="gz-picker-option-copy">
                    <strong className="gz-picker-option-title">
                      {option.icon && <Icon name={option.icon} style={{ marginRight: 6 }} />}
                      {option.label}
                    </strong>
                    {option.meta && <small className="gz-picker-option-meta">{option.meta}</small>}
                  </span>
                  {option.value === value && <Icon name="check" className="gz-picker-check" />}
                </button>
              ))}
              {!visible.length && <div className="gz-picker-empty">No results found</div>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function Management() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const S = useStore(s => s.S)
  const toast = useUI(s => s.toast)

  const [data, setData] = useState<any>(null)
  const [accessRequests, setAccessRequests] = useState<any[]>([])
  const [gyms, setGyms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>('overview')

  const role = (user?.admin ? 'admin' : user?.role || 'member') as PersonaRole
  const isManager = role === 'admin' || role === 'owner'
  const isCoach = isManager || role === 'trainer'

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
      { id: '3', name: 'Salmon & Roasted Vegetables', time: '19:30', serving: '180g salmon + asparagus' }
    ]
  })
  const [feeForm, setFeeForm] = useState({
    amount: '49.00',
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    currency: 'USD',
    note: 'Monthly Gym Access & Coaching'
  })

  const members = useMemo(() => (data?.members || []).filter((m: any) => m.role === 'member'), [data])
  const selectedTrainingPlan = useMemo(
    () => (data?.trainingPlans || []).find((plan: any) => plan.memberId === selectedMember),
    [data, selectedMember]
  )

  const routineOptions = useMemo(() => [
    { value: '', label: 'Rest & Recovery', meta: 'Active rest / mobility', icon: 'moon' },
    ...S.routines.map(routine => ({
      value: routine.id,
      label: routine.name,
      meta: `${routine.ex?.length || 0} exercises`,
      icon: 'dumbbell'
    }))
  ], [S.routines])

  useEffect(() => {
    const assignedWeek = selectedTrainingPlan?.week || {}
    setTrainingPlanForm({
      week: PLAN_DAYS.reduce((week, day) => ({ ...week, [day]: assignedWeek[day] || '' }), {} as Record<number, string>)
    })
  }, [selectedMember, selectedTrainingPlan?.id, selectedTrainingPlan?.updatedAt])

  const reload = async () => {
    try {
      const [next, requests] = await Promise.all([
        getManagementOverview(),
        getAccessRequests().catch(() => ({ requests: [] }))
      ])
      setData(next)
      setAccessRequests(requests.requests || [])
      setSelectedMember(current => current || next.members?.find((m: any) => m.role === 'member')?.id || '')
      setRoleForm(current => ({
        ...current,
        memberId: current.memberId || next.members?.[0]?.id || '',
        gymId: current.gymId || next.viewer?.gymId || ''
      }))
      setRequestForm(current => ({
        ...current,
        gymId: current.gymId || next.viewer?.gymId || next.gyms?.[0]?.id || ''
      }))
    } catch (e: any) {
      toast(e.message || 'Could not load gym workspace')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    listGyms().then(result => setGyms(result.gyms || [])).catch(() => {})
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
  const todayPlanRoutines = selectedTrainingPlan?.routines || S.routines
  const todayRoutine = todayPlanRoutines.find((routine: any) => routine.id === trainingPlanForm.week[todayDay])

  const trainerOptions = useMemo(
    () => (data?.members || []).filter((member: any) => member.role === 'trainer').map((member: any) => ({
      value: member.id,
      label: member.name,
      meta: 'Trainer'
    })),
    [data]
  )

  const pendingRequestsCount = (data?.requests?.length || 0) + accessRequests.filter((r: any) => r.status === 'pending').length
  const pendingFeesCount = (data?.fees || []).filter((f: any) => f.status === 'submitted').length
  const totalLogsHit = (data?.logs || []).filter((l: any) => l.status === 'hit' || l.status === 'logged').length
  const totalLogsMissed = (data?.logs || []).filter((l: any) => l.status === 'missed').length
  const complianceRate = (totalLogsHit + totalLogsMissed) > 0
    ? Math.round((totalLogsHit / (totalLogsHit + totalLogsMissed)) * 100)
    : 100

  const updateFood = (id: string, patch: Partial<(typeof dietForm.foods)[0]>) =>
    setDietForm(current => ({
      ...current,
      foods: current.foods.map(food => (food.id === id ? { ...food, ...patch } : food))
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
          serving: preset?.serving || ''
        }
      ]
    }))

  const removeFood = (id: string) =>
    setDietForm(current => ({
      ...current,
      foods: current.foods.length > 1 ? current.foods.filter(food => food.id !== id) : current.foods
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
      <div className="narrow management-page">
        <div className="gz-hero-banner">
          <div className="gz-hero-kicker">
            <span className="gz-pulse-dot" /> LOADING HQ
          </div>
          <h1 className="gz-hero-title">Syncing Workspace…</h1>
          <p className="gz-hero-sub">Initializing your gym dashboard and protocols.</p>
        </div>
        <div className="card gz-loading-skeleton">
          <div className="gz-skeleton-line gz-w-60" />
          <div className="gz-skeleton-box" />
          <div className="gz-skeleton-line gz-w-80" />
        </div>
      </div>
    )
  }

  return (
    <div className="narrow management-page">
      <PageBreadcrumb
        items={[
          { label: 'Settings', icon: 'gear', path: '/settings' },
          { label: 'Gym Operations', icon: 'wrench' },
        ]}
        scope="gym"
      />
      
      <WorkspaceNav />

      {/* ======================= HERO BANNER ======================= */}
      <div className="gz-hero-banner" style={{ marginTop: 12 }}>
        <div className="gz-hero-top">
          <div className="gz-hero-badges">
            <span className="gz-role-pill">
              <span className="gz-pulse-dot" />
              <Icon name={role === 'admin' ? 'crown' : role === 'owner' ? 'bolt' : role === 'trainer' ? 'arm' : 'shield'} />
              <span>{personaLabel(role, role === 'admin')}</span>
            </span>
            {data?.viewer?.gymId && (
              <span
                className="gz-gym-chip"
                onClick={() => {
                  navigator.clipboard?.writeText(data.viewer.gymId).catch(() => {})
                  toast(`Gym ID "${data.viewer.gymId}" copied!`)
                }}
                title="Click to copy Gym ID"
              >
                <Icon name="globe" />
                <span>{data.viewer.gymId}</span>
              </span>
            )}
          </div>
          <div className="gz-hero-actions">
            <button className="gz-circle-btn" onClick={reload} aria-label="Refresh Workspace" title="Refresh">
              <Icon name="reset" />
            </button>
            <button className="gz-circle-btn" onClick={() => nav('/home')} aria-label="Home" title="Home">
              <Icon name="house" />
            </button>
          </div>
        </div>

        <h1 className="gz-hero-title">
          {role === 'member'
            ? 'My Gym Portal'
            : role === 'trainer'
            ? 'Coach Command'
            : role === 'owner'
            ? 'Gym HQ & Ops'
            : 'Super Admin Matrix'}
        </h1>
        <p className="gz-hero-sub">
          {role === 'member'
            ? 'Track your daily training split, fuel protocol, and gym dues.'
            : isManager
            ? 'Orchestrate members, deploy weekly splits, review payments, and approve requests.'
            : 'Assign personalized weekly training schedules and fuel guidelines for your squad.'}
        </p>
      </div>

      {/* ======================= BENTO STATS STRIP ======================= */}
      <div className="gz-bento-grid">
        {isCoach ? (
          <>
            <BentoStat
              label="Trainee Squad"
              value={members.length}
              sub={`${(data?.trainingPlans || []).length} active plans`}
              icon="users"
              accent="var(--blue)"
              trend="+Squad"
              onClick={() => setActiveTab('workouts')}
            />
            <BentoStat
              label="Compliance Rate"
              value={`${complianceRate}%`}
              sub={`${totalLogsHit} logged hits`}
              icon="flame"
              accent="var(--green)"
              trend="🔥 Fuel"
              onClick={() => setActiveTab('progress')}
            />
            <BentoStat
              label="Action Inbox"
              value={pendingRequestsCount + pendingFeesCount}
              sub={`${pendingRequestsCount} req · ${pendingFeesCount} fees`}
              icon="bell"
              accent={pendingRequestsCount + pendingFeesCount > 0 ? 'var(--orange)' : 'var(--acc)'}
              trend={pendingRequestsCount + pendingFeesCount > 0 ? '⚡ Action' : '✨ Clear'}
              onClick={() => setActiveTab(pendingRequestsCount > 0 ? 'inbox' : 'fees')}
            />
          </>
        ) : (
          <>
            <BentoStat
              label="Today's Split"
              value={data?.trainingPlan ? (todayRoutine?.name || 'Recovery') : 'Self Guided'}
              sub={todayRoutine ? `${todayRoutine.ex?.length || 0} exercises` : 'Ready to train'}
              icon="dumbbell"
              accent="var(--acc)"
              trend="Today"
              onClick={() => nav('/workout')}
            />
            <BentoStat
              label="Fuel Status"
              value={data?.diets?.length ? `${data.diets[0]?.foods?.length || 0} items` : 'Open'}
              sub={data?.diets?.[0]?.calories ? `${data.diets[0].calories} kcal goal` : 'Nutrition logged'}
              icon="heart"
              accent="var(--pink)"
              trend="Daily"
              onClick={() => setActiveTab('nutrition')}
            />
            <BentoStat
              label="Membership Dues"
              value={(data?.fees || []).some((f: any) => f.status === 'due' || f.status === 'overdue') ? 'Due' : 'Active'}
              sub={(data?.fees || [])[0] ? `${(data.fees)[0].amount} ${(data.fees)[0].currency}` : 'Paid up'}
              icon="target"
              accent="var(--blue)"
              trend="Status"
              onClick={() => setActiveTab('fees')}
            />
          </>
        )}
      </div>

      {/* ======================= SUB-NAV PILL TABS ======================= */}
      <div className="gz-tab-bar">
        <button
          className={`gz-tab-pill ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Icon name="chart" />
          <span>Overview</span>
        </button>

        {isCoach && (
          <button
            className={`gz-tab-pill ${activeTab === 'workouts' ? 'active' : ''}`}
            onClick={() => setActiveTab('workouts')}
          >
            <Icon name="dumbbell" />
            <span>Splits & Plans</span>
          </button>
        )}

        <button
          className={`gz-tab-pill ${activeTab === 'nutrition' ? 'active' : ''}`}
          onClick={() => setActiveTab('nutrition')}
        >
          <Icon name="heart" />
          <span>{role === 'member' ? 'Daily Fuel' : 'Nutrition & Fuel'}</span>
        </button>

        {(isManager || role === 'member') && (
          <button
            className={`gz-tab-pill ${activeTab === 'fees' ? 'active' : ''}`}
            onClick={() => setActiveTab('fees')}
          >
            <Icon name="plate" />
            <span>Fees & Dues</span>
            {pendingFeesCount > 0 && <span className="gz-tab-badge">{pendingFeesCount}</span>}
          </button>
        )}

        {isManager && (
          <button
            className={`gz-tab-pill ${activeTab === 'roster' ? 'active' : ''}`}
            onClick={() => setActiveTab('roster')}
          >
            <Icon name="users" />
            <span>Team & Roles</span>
          </button>
        )}

        {isCoach && (
          <button
            className={`gz-tab-pill ${activeTab === 'progress' ? 'active' : ''}`}
            onClick={() => setActiveTab('progress')}
          >
            <Icon name="flame" />
            <span>Squad Activity</span>
          </button>
        )}

        {(isManager || role === 'member') && (
          <button
            className={`gz-tab-pill ${activeTab === 'inbox' ? 'active' : ''}`}
            onClick={() => setActiveTab('inbox')}
          >
            <Icon name={role === 'member' ? 'mail' : 'bell'} />
            <span>{role === 'member' ? 'Gym Request' : 'Inbox'}</span>
            {pendingRequestsCount > 0 && <span className="gz-tab-badge">{pendingRequestsCount}</span>}
          </button>
        )}
      </div>

      {/* ======================= TRAINEE SPOTLIGHT BAR (COACHES) ======================= */}
      {isCoach && members.length > 0 && (activeTab === 'overview' || activeTab === 'workouts' || activeTab === 'nutrition') && (
        <div className="gz-trainee-spotlight">
          <div className="gz-trainee-spotlight-head">
            <div>
              <span className="gz-card-tag">ACTIVE TRAINEE SPOTLIGHT</span>
              <h3 className="gz-trainee-spotlight-title">Select Member to Manage</h3>
            </div>
            <span className="gz-member-count-badge">{members.length} trainees</span>
          </div>

          <div className="gz-trainee-scroll-row">
            {members.map((m: any) => {
              const hasPlan = (data?.trainingPlans || []).some((p: any) => p.memberId === m.id)
              const isSel = m.id === selectedMember
              return (
                <button
                  type="button"
                  key={m.id}
                  className={`gz-trainee-card ${isSel ? 'selected' : ''}`}
                  onClick={() => setSelectedMember(m.id)}
                >
                  <div className="gz-trainee-avatar">
                    {m.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="gz-trainee-info">
                    <strong>{m.name}</strong>
                    <span className={`gz-trainee-plan-status ${hasPlan ? 'has-plan' : 'no-plan'}`}>
                      {hasPlan ? '⚡ Active Plan' : '⏳ Needs Plan'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB CONTENT: OVERVIEW
         ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="gz-tab-content">
          {/* Today's Focus Card for selected trainee or current user */}
          {isCoach && coachFormReady && (
            <SectionPanel
              title={`Today's Focus: ${selectedMemberName}`}
              tag={PLAN_DAY_LABELS[todayDay].toUpperCase()}
              icon={todayRoutine ? 'dumbbell' : 'moon'}
              glow={!!todayRoutine}
              badge={
                <GenZBadge variant={todayRoutine ? 'acc' : 'purple'}>
                  {todayRoutine ? 'Workout Day' : 'Rest Day'}
                </GenZBadge>
              }
            >
              <div className="gz-today-hero-row">
                <div className="gz-today-hero-copy">
                  <h3>{todayRoutine?.name || (selectedTrainingPlan ? 'Rest & Recovery Protocol' : 'No weekly plan assigned')}</h3>
                  <p>
                    {todayRoutine
                      ? `${todayRoutine.ex?.length || 0} exercises scheduled for today · ${todayRoutine.name}`
                      : selectedTrainingPlan
                      ? 'Scheduled muscle repair, light mobility, and hydration'
                      : 'Deploy a weekly split below to give this trainee their daily workouts.'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setActiveTab('workouts')}
                >
                  Edit Split
                </Button>
              </div>
            </SectionPanel>
          )}

          {/* Quick Shortcuts Bento */}
          <div className="gz-quick-grid">
            {isCoach && (
              <div className="gz-quick-card" onClick={() => setActiveTab('workouts')}>
                <div className="gz-quick-card-icon"><Icon name="calendar" /></div>
                <h4>Weekly Splits</h4>
                <p>Deploy 7-day routine schedules with one-tap split presets.</p>
                <span className="gz-quick-link">Configure Split →</span>
              </div>
            )}
            <div className="gz-quick-card" onClick={() => setActiveTab('nutrition')}>
              <div className="gz-quick-card-icon"><Icon name="heart" /></div>
              <h4>Fuel & Macros</h4>
              <p>Daily calorie targets, macro splits, and interactive meal checklist.</p>
              <span className="gz-quick-link">View Nutrition →</span>
            </div>
            {isManager && (
              <div className="gz-quick-card" onClick={() => setActiveTab('fees')}>
                <div className="gz-quick-card-icon"><Icon name="target" /></div>
                <h4>Billing & Dues</h4>
                <p>Create invoices, set due dates, and verify member payment proofs.</p>
                <span className="gz-quick-link">Manage Dues →</span>
              </div>
            )}
            {isManager && (
              <div className="gz-quick-card" onClick={() => setActiveTab('roster')}>
                <div className="gz-quick-card-icon"><Icon name="users" /></div>
                <h4>Squad Roster</h4>
                <p>Promote trainers, assign trainees, and manage gym passkeys.</p>
                <span className="gz-quick-link">Open Roster →</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB CONTENT: WORKOUTS & SPLITS (COACHES)
         ========================================================================= */}
      {isCoach && (activeTab === 'workouts' || activeTab === 'overview') && (
        <div className={activeTab === 'overview' ? '' : 'gz-tab-content'}>
          <SectionPanel
            title="Weekly Training Split"
            tag="7-DAY PROTOCOL"
            icon="calendar"
            glow={true}
            badge={
              selectedTrainingPlan ? (
                <GenZBadge variant="acc">
                  Updated {prettyDate(selectedTrainingPlan.updatedAt || selectedTrainingPlan.created)}
                </GenZBadge>
              ) : null
            }
          >
            <p className="gz-help-text">
              Assign routines from your library to each day of the week for <strong>{selectedMemberName}</strong>.
            </p>

            {!S.routines.length ? (
              <div className="gz-empty-card">
                <Icon name="dumbbell" className="gz-empty-icon" />
                <h4>No routines found in your library</h4>
                <p>Build custom routines in your Plan tab before assigning weekly splits to trainees.</p>
                <Button size="sm" variant="primary" onClick={() => nav('/plan')}>
                  Create Routines in Plan
                </Button>
              </div>
            ) : (
              <>
                {/* One-Tap Split Presets */}
                <div className="gz-preset-bar">
                  <span className="gz-preset-label">⚡ Rapid Split Presets:</span>
                  <div className="gz-preset-chips">
                    <button type="button" className="gz-chip-btn" onClick={() => applySplitPreset('ppl')}>
                      🔥 Push / Pull / Legs
                    </button>
                    <button type="button" className="gz-chip-btn" onClick={() => applySplitPreset('upperlower')}>
                      💪 Upper / Lower
                    </button>
                    <button type="button" className="gz-chip-btn" onClick={() => applySplitPreset('fullbody')}>
                      ✨ Full Body 3x
                    </button>
                    <button type="button" className="gz-chip-btn muted" onClick={() => applySplitPreset('clear')}>
                      🌙 Clear to Rest
                    </button>
                  </div>
                </div>

                {/* 7-Day Interactive Matrix */}
                <div className="gz-days-grid">
                  {PLAN_DAYS.map(day => {
                    const isToday = day === todayDay
                    const assignedRoutineId = trainingPlanForm.week[day]
                    const routineObj = S.routines.find(r => r.id === assignedRoutineId)
                    return (
                      <div className={`gz-day-card ${isToday ? 'today' : ''} ${assignedRoutineId ? 'has-routine' : 'rest'}`} key={day}>
                        <div className="gz-day-card-header">
                          <span className="gz-day-short">{PLAN_DAY_SHORT[day]}</span>
                          <span className="gz-day-name">{PLAN_DAY_LABELS[day]}</span>
                          {isToday && <span className="gz-today-indicator">TODAY</span>}
                        </div>
                        <div className="gz-day-card-body">
                          <CustomPicker
                            value={assignedRoutineId}
                            onChange={routineId =>
                              setTrainingPlanForm(current => ({
                                ...current,
                                week: { ...current.week, [day]: routineId }
                              }))
                            }
                            options={routineOptions}
                            placeholder="Rest & Recovery"
                            icon={assignedRoutineId ? 'dumbbell' : 'moon'}
                          />
                        </div>
                        {routineObj && (
                          <div className="gz-day-card-footer">
                            <span className="gz-day-stat-chip">
                              <Icon name="flame" /> {routineObj.ex?.length || 0} exercises
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="gz-card-actions">
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
                            week: trainingPlanForm.week
                          }),
                        `Weekly split deployed to ${selectedMemberName}!`
                      )
                    }
                  >
                    Deploy Split to {selectedMemberName}
                  </Button>
                </div>
              </>
            )}
          </SectionPanel>
        </div>
      )}

      {/* =========================================================================
          TAB CONTENT: NUTRITION & DAILY FUEL
         ========================================================================= */}
      {(activeTab === 'nutrition' || (activeTab === 'overview' && role === 'member')) && (
        <div className={activeTab === 'overview' ? '' : 'gz-tab-content'}>
          {isCoach ? (
            <SectionPanel
              title={`Fuel Protocol: ${selectedMemberName}`}
              tag="NUTRITION & MACROS"
              icon="heart"
              glow={true}
              badge={<GenZBadge variant="pink">Target: {dietForm.calories || '2400'} kcal</GenZBadge>}
            >
              <p className="gz-help-text">
                Build a tailored daily nutrition protocol and meal checklist for <strong>{selectedMemberName}</strong>.
              </p>

              <div className="gz-form-2col">
                <label className="gz-form-label">
                  Protocol Title
                  <TextField
                    value={dietForm.title}
                    onChange={e => setDietForm({ ...dietForm, title: e.target.value })}
                    placeholder="e.g. Lean Bulk Protocol 2.0"
                  />
                </label>
                <label className="gz-form-label">
                  Daily Calorie Target (kcal)
                  <TextField
                    value={dietForm.calories}
                    onChange={e => setDietForm({ ...dietForm, calories: e.target.value })}
                    inputMode="numeric"
                    placeholder="e.g. 2600"
                  />
                </label>
              </div>

              {/* Quick Meal Suggestion Chips */}
              <div className="gz-preset-bar" style={{ marginTop: 12 }}>
                <span className="gz-preset-label">🥑 Quick Food Adds:</span>
                <div className="gz-preset-chips">
                  {FOOD_PRESETS.map((preset, idx) => (
                    <button
                      type="button"
                      key={idx}
                      className="gz-chip-btn"
                      onClick={() => addFood(preset)}
                    >
                      + {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interactive Meal Checklist Builder */}
              <div className="gz-food-builder-card">
                <div className="gz-food-builder-header">
                  <span className="gz-food-builder-title">DAILY MEAL CHECKLIST ({dietForm.foods.length} items)</span>
                  <Button size="xs" variant="ghost" icon="plus" onClick={() => addFood()}>
                    Add Custom Food
                  </Button>
                </div>

                <div className="gz-food-rows">
                  {dietForm.foods.map((food, i) => (
                    <div className="gz-food-row" key={food.id}>
                      <span className="gz-food-num">0{i + 1}</span>
                      <input
                        className="field gz-food-field-time"
                        type="time"
                        value={food.time}
                        onChange={e => updateFood(food.id, { time: e.target.value })}
                      />
                      <input
                        className="field gz-food-field-name"
                        value={food.name}
                        onChange={e => updateFood(food.id, { name: e.target.value })}
                        placeholder="Food / Meal description"
                      />
                      <input
                        className="field gz-food-field-serving"
                        value={food.serving}
                        onChange={e => updateFood(food.id, { serving: e.target.value })}
                        placeholder="Portion / grams"
                      />
                      <button
                        type="button"
                        className="iconbtn gz-food-remove-btn"
                        onClick={() => removeFood(food.id)}
                        aria-label="Remove item"
                      >
                        <Icon name="xmark" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="gz-form-2col" style={{ marginTop: 14 }}>
                <label className="gz-form-label">
                  Macro Guidelines & Meal Timing
                  <TextArea
                    value={dietForm.meals}
                    onChange={e => setDietForm({ ...dietForm, meals: e.target.value })}
                    placeholder="e.g. 180g Protein, 250g Carbs, 65g Fats. Meal 1 within 1h of waking."
                  />
                </label>
                <label className="gz-form-label">
                  Coach Guidance & Allergy Notes
                  <TextArea
                    value={dietForm.notes}
                    onChange={e => setDietForm({ ...dietForm, notes: e.target.value })}
                    placeholder="e.g. Lactose intolerant; swap whey with plant isolate. Drink 3L water."
                  />
                </label>
              </div>

              <div className="gz-card-actions">
                <Button
                  variant="primary"
                  size="sm"
                  icon="heart"
                  disabled={!coachFormReady || !dietForm.title || !dietForm.foods.some(food => food.name.trim())}
                  onClick={() =>
                    run(
                      () => createDiet({ memberId: selectedMember, ...dietForm }),
                      `Diet protocol deployed to ${selectedMemberName}!`
                    )
                  }
                >
                  Deploy Nutrition Protocol
                </Button>
              </div>
            </SectionPanel>
          ) : (
            /* Member Nutrition View */
            <div className="gz-member-diet-section">
              <MemberRecords
                data={data}
                onSubmitFee={id => run(() => submitFee(id), 'Payment submitted for review')}
                onLog={(type, id, status, itemId) =>
                  run(
                    () => logAssignment(type, id, status, undefined, undefined, itemId),
                    status === 'hit' || status === 'logged' ? 'Progress logged!' : 'Marked missed'
                  )
                }
              />
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB CONTENT: FEES & MEMBERSHIP DUES
         ========================================================================= */}
      {(activeTab === 'fees' || (activeTab === 'overview' && isManager)) && (
        <div className={activeTab === 'overview' ? '' : 'gz-tab-content'}>
          {isManager && (
            <SectionPanel
              title="Membership Fees & Dues"
              tag="FINANCIALS & INVOICING"
              icon="plate"
              badge={<GenZBadge variant="orange">{(data?.fees || []).length} Invoices</GenZBadge>}
            >
              <p className="gz-help-text">
                Generate membership dues for trainees and approve proof of payment submissions.
              </p>

              <div className="gz-form-grid-4">
                <CustomPicker
                  label="Trainee"
                  value={selectedMember}
                  onChange={setSelectedMember}
                  placeholder="Select Trainee"
                  options={members.map((m: any) => ({ value: m.id, label: m.name }))}
                  icon="person"
                />
                <label className="gz-form-label">
                  Amount
                  <input
                    className="field"
                    type="number"
                    min="0"
                    step="0.01"
                    value={feeForm.amount}
                    onChange={e => setFeeForm({ ...feeForm, amount: e.target.value })}
                    placeholder="49.00"
                  />
                </label>
                <label className="gz-form-label">
                  Due Date
                  <input
                    className="field"
                    type="date"
                    value={feeForm.dueDate}
                    onChange={e => setFeeForm({ ...feeForm, dueDate: e.target.value })}
                  />
                </label>
                <label className="gz-form-label">
                  Currency
                  <input
                    className="field"
                    value={feeForm.currency}
                    onChange={e => setFeeForm({ ...feeForm, currency: e.target.value.toUpperCase() })}
                    maxLength={6}
                  />
                </label>
              </div>

              <label className="gz-form-label" style={{ marginTop: 10 }}>
                Invoice Memo / Plan Note
                <TextField
                  value={feeForm.note}
                  onChange={e => setFeeForm({ ...feeForm, note: e.target.value })}
                  placeholder="e.g. Monthly Unlimited Gym + 1-on-1 Coaching"
                />
              </label>

              <div className="gz-card-actions">
                <Button
                  variant="primary"
                  size="sm"
                  icon="plus"
                  disabled={!selectedMember || !feeForm.amount || !feeForm.dueDate}
                  onClick={() => run(() => createFee({ memberId: selectedMember, ...feeForm }), 'Invoice created!')}
                >
                  Create Membership Fee
                </Button>
              </div>

              {/* Invoices List */}
              <div className="gz-records-container" style={{ marginTop: 20 }}>
                <h4 className="gz-subheading">INVOICE ROSTER</h4>
                {(data?.fees || []).length ? (
                  <div className="gz-invoice-list">
                    {(data?.fees || []).map((fee: any) => {
                      const memberName = members.find((m: any) => m.id === fee.memberId)?.name || fee.memberId
                      return (
                        <div className="gz-invoice-card" key={fee.id}>
                          <div className="gz-invoice-avatar">
                            {memberName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="gz-invoice-copy">
                            <strong>{memberName}</strong>
                            <span>
                              {fee.amount} {fee.currency} · Due {prettyDate(fee.dueDate)}
                            </span>
                            {fee.note && <small>{fee.note}</small>}
                          </div>
                          <div className="gz-invoice-actions">
                            <span className={`gz-status-tag status-${fee.status}`}>
                              {fee.status === 'submitted' ? '⚡ Review Needed' : fee.status}
                            </span>
                            {fee.status === 'submitted' && (
                              <div className="row" style={{ gap: 6 }}>
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
                  </div>
                ) : (
                  <div className="gz-empty-card">
                    <Icon name="plate" className="gz-empty-icon" />
                    <p>No membership fees issued yet.</p>
                  </div>
                )}
              </div>
            </SectionPanel>
          )}

          {role === 'member' && (
            <MemberRecords
              data={data}
              onSubmitFee={id => run(() => submitFee(id), 'Payment submitted for review')}
              onLog={(type, id, status, itemId) =>
                run(
                  () => logAssignment(type, id, status, undefined, undefined, itemId),
                  status === 'hit' || status === 'logged' ? 'Progress logged!' : 'Marked missed'
                )
              }
            />
          )}
        </div>
      )}

      {/* =========================================================================
          TAB CONTENT: TEAM & ROLES (MANAGERS)
         ========================================================================= */}
      {isManager && (activeTab === 'roster' || (activeTab === 'overview' && role === 'admin')) && (
        <div className={activeTab === 'overview' ? '' : 'gz-tab-content'}>
          <SectionPanel
            title="Team & Role Assignments"
            tag="ROSTER MANAGEMENT"
            icon="personCircle"
            badge={<GenZBadge variant="purple">{(data?.members || []).length} Members</GenZBadge>}
          >
            <p className="gz-help-text">
              Assign roles, connect gym members with personal trainers, and manage squad permissions.
            </p>

            <div className="gz-form-grid-2">
              <CustomPicker
                label="Person"
                value={roleForm.memberId}
                onChange={memberId => setRoleForm({ ...roleForm, memberId, trainerId: '' })}
                placeholder="Choose a user"
                options={(data?.members || []).map((m: any) => ({
                  value: m.id,
                  label: m.name,
                  meta: personaLabel(m.role)
                }))}
                icon="person"
              />
              <CustomPicker
                label="Role"
                value={roleForm.role}
                onChange={nextRole => setRoleForm({ ...roleForm, role: nextRole as PersonaRole })}
                options={roles
                  .filter(value => role === 'admin' || value === 'member' || value === 'trainer')
                  .map(value => ({ value, label: personaLabel(value, value === 'admin') }))}
                icon="crown"
              />
              <label className="gz-form-label">
                Gym ID
                <input
                  className="field"
                  value={roleForm.gymId}
                  onChange={e => setRoleForm({ ...roleForm, gymId: e.target.value })}
                  placeholder="e.g. downtown"
                />
              </label>
              {roleForm.role === 'member' && (
                <CustomPicker
                  label="Assigned Trainer"
                  value={roleForm.trainerId}
                  onChange={trainerId => setRoleForm({ ...roleForm, trainerId })}
                  placeholder="No trainer assigned"
                  options={[{ value: '', label: 'No trainer assigned' }, ...trainerOptions]}
                  icon="arm"
                />
              )}
            </div>

            <div className="gz-card-actions">
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
                          trainerId: roleForm.trainerId || null
                        })
                      }),
                    'Role and trainer configuration saved!'
                  )
                }
              >
                Save Role Assignment
              </Button>
            </div>
          </SectionPanel>

          {/* Admin Gym Creator */}
          {role === 'admin' && (
            <SectionPanel
              title="Create New Gym Hub"
              tag="FACILITY DIRECTORY"
              icon="plusCircle"
            >
              <p className="gz-help-text">
                Establish a new gym identifier to assign owners and squad members.
              </p>
              <div className="gz-inline-form">
                <TextField
                  value={gymName}
                  onChange={e => setGymName(e.target.value)}
                  placeholder="Gym facility name (e.g. Iron Vault)"
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
                  Create Gym
                </Button>
              </div>

              {gyms.length > 0 && (
                <div className="gz-gym-chip-cloud" style={{ marginTop: 14 }}>
                  {gyms.map(gym => (
                    <span
                      className="gz-gym-badge"
                      key={gym.id}
                      onClick={() => {
                        navigator.clipboard?.writeText(gym.id).catch(() => {})
                        toast(`Copied Gym ID: ${gym.id}`)
                      }}
                      title="Click to copy Gym ID"
                    >
                      <Icon name="globe" />
                      <strong>{gym.name}</strong>
                      <small>{gym.id}</small>
                    </span>
                  ))}
                </div>
              )}
            </SectionPanel>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB CONTENT: SQUAD PROGRESS & ACTIVITY LOGS (COACHES)
         ========================================================================= */}
      {isCoach && activeTab === 'progress' && (
        <div className="gz-tab-content">
          <AssignmentRecords data={data} members={members} />
        </div>
      )}

      {/* =========================================================================
          TAB CONTENT: REQUESTS INBOX & ROLE REQUESTS
         ========================================================================= */}
      {(activeTab === 'inbox' || (activeTab === 'overview' && pendingRequestsCount > 0)) && (
        <div className={activeTab === 'overview' ? '' : 'gz-tab-content'}>
          {isManager ? (
            <SectionPanel
              title="Requests Inbox"
              tag="APPROVALS QUEUE"
              icon="bell"
              glow={pendingRequestsCount > 0}
              badge={
                <GenZBadge variant={pendingRequestsCount > 0 ? 'orange' : 'acc'}>
                  {pendingRequestsCount} Pending
                </GenZBadge>
              }
            >
              <p className="gz-help-text">
                Admins approve all requests. Gym owners can approve member and trainer requests inside their gym.
              </p>

              {pendingRequestsCount > 0 ? (
                <div className="gz-request-list">
                  {(data?.requests || []).map((request: any) => (
                    <div className="gz-request-card" key={String(request._id)}>
                      <div className="gz-request-avatar">
                        {(request.requesterName || 'Req').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="gz-request-copy">
                        <div className="gz-request-copy-top">
                          <strong>{request.requesterName || 'Member Request'}</strong>
                          <span className="gz-request-time">{timeAgo(request.created)}</span>
                        </div>
                        <div className="gz-request-badges">
                          <GenZBadge variant="purple">{personaLabel(request.requestedRole)}</GenZBadge>
                          <span className="gz-meta-tag">
                            {request.type === 'join-gym' ? 'Join Gym' : 'Role Change'}
                          </span>
                        </div>
                        {request.message && <div className="gz-request-bubble">{request.message}</div>}
                      </div>
                      <div className="gz-request-actions">
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
                      <div className="gz-request-card" key={String(request._id)}>
                        <div className="gz-request-avatar">
                          {request.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="gz-request-copy">
                          <div className="gz-request-copy-top">
                            <strong>{request.name}</strong>
                            <span className="gz-request-time">{timeAgo(request.created)}</span>
                          </div>
                          <div className="gz-request-badges">
                            <GenZBadge variant="blue">{personaLabel(request.requestedRole)}</GenZBadge>
                            <span className="gz-meta-tag">Access Request</span>
                          </div>
                          <div className="gz-request-bubble">
                            <span style={{ color: 'var(--acc)' }}>{request.email}</span>
                            {request.message ? ` · ${request.message}` : ''}
                          </div>
                        </div>
                        <div className="gz-request-actions">
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
                                    body: JSON.stringify({ id: request._id })
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
                </div>
              ) : (
                <div className="gz-empty-card">
                  <Icon name="checkCircle" className="gz-empty-icon" />
                  <h4>Inbox Zero</h4>
                  <p>All pending applications and access requests have been cleared.</p>
                </div>
              )}
            </SectionPanel>
          ) : (
            /* Member Gym Request Form */
            <SectionPanel
              title="Request Gym Access or Role"
              tag="GYM MEMBERSHIP"
              icon="mail"
            >
              <p className="gz-help-text">
                Apply to join a local gym facility or upgrade your account to trainer status.
              </p>

              <div className="gz-form-2col">
                <div>
                  <CustomPicker
                    label="Target Gym"
                    value={requestForm.gymId}
                    onChange={gymId => setRequestForm({ ...requestForm, gymId })}
                    placeholder="Select a gym facility"
                    options={[
                      ...(gyms.length ? gyms : data?.gyms || []).map((g: any) => ({
                        value: g.id,
                        label: g.name || g.id,
                        meta: g.id
                      })),
                      ...(requestForm.gymId && !(gyms.length ? gyms : data?.gyms || []).some((g: any) => g.id === requestForm.gymId)
                        ? [{ value: requestForm.gymId, label: requestForm.gymId, meta: 'Custom Gym ID' }]
                        : [])
                    ]}
                    icon="globe"
                    searchable={true}
                  />
                  <div style={{ marginTop: 6 }}>
                    <input
                      className="field"
                      placeholder="Or enter custom Gym ID (e.g. downtown)"
                      value={requestForm.gymId}
                      onChange={e => setRequestForm({ ...requestForm, gymId: e.target.value })}
                      style={{ fontSize: 13, minHeight: 36 }}
                    />
                  </div>
                </div>
                <CustomPicker
                  label="Requested Status"
                  value={requestForm.requestedRole}
                  onChange={requestedRole => setRequestForm({ ...requestForm, requestedRole })}
                  options={[
                    { value: 'member', label: 'Gym Member (Trainee)', icon: 'shield' },
                    { value: 'trainer', label: 'Gym Trainer (Coach)', icon: 'arm' }
                  ]}
                  icon="crown"
                />
              </div>

              <label className="gz-form-label" style={{ marginTop: 10 }}>
                Message to Gym Management
                <TextArea
                  value={requestForm.message}
                  onChange={e => setRequestForm({ ...requestForm, message: e.target.value })}
                  placeholder="Tell the gym owner about your fitness goals or training experience…"
                />
              </label>

              <div className="gz-card-actions">
                <Button
                  variant="primary"
                  size="sm"
                  icon="mail"
                  disabled={!requestForm.gymId}
                  onClick={() => run(() => createManagementRequest(requestForm), 'Application sent to Gym Owner!')}
                >
                  Submit Application
                </Button>
              </div>
            </SectionPanel>
          )}
        </div>
      )}
    </div>
  )
}

function latestLog(data: any, assignmentId: string) {
  return (data?.logs || []).find((log: any) => log.assignmentId === assignmentId)
}

function ProgressActions({
  type,
  id,
  current,
  onLog,
  itemId,
}: {
  type: 'diet' | 'schedule' | 'exercise'
  id: string
  current?: any
  onLog: (type: any, id: string, status: string, itemId?: string) => void
  itemId?: string
}) {
  const isDone = current?.status === 'hit' || current?.status === 'logged'
  return (
    <div className="gz-progress-actions">
      {current && (
        <span className={`gz-status-tag ${isDone ? 'status-approved' : 'status-rejected'}`}>
          {current.status}
        </span>
      )}
      <Button
        size="xs"
        variant={isDone ? 'ghost' : 'primary'}
        onClick={() => onLog(type, id, type === 'diet' ? 'logged' : 'hit', itemId)}
      >
        {type === 'diet' ? 'Log Today' : 'Hit'}
      </Button>
      <Button size="xs" variant="ghost" onClick={() => onLog(type, id, 'missed', itemId)}>
        Missed
      </Button>
    </div>
  )
}

function MemberRecords({
  data,
  onSubmitFee,
  onLog,
}: {
  data: any
  onSubmitFee: (id: string) => void
  onLog: (type: any, id: string, status: string, itemId?: string) => void
}) {
  return (
    <div className="gz-grid-2col">
      {/* Member Nutrition Card */}
      <SectionPanel
        title="My Daily Fuel Checklist"
        tag="NUTRITION LOG"
        icon="heart"
        glow={true}
        badge={
          data?.diets?.[0]?.calories ? (
            <GenZBadge variant="pink">{data.diets[0].calories} kcal goal</GenZBadge>
          ) : null
        }
      >
        {data?.diets?.length ? (
          data.diets.map((diet: any) => (
            <div className="gz-member-diet-card" key={diet.id}>
              <div className="gz-member-diet-header">
                <div>
                  <h3 className="gz-member-diet-title">{diet.title}</h3>
                  <p className="gz-member-diet-notes">
                    {diet.calories ? `${diet.calories} kcal · ` : ''}
                    {diet.notes || 'Daily nutrition guidelines'}
                  </p>
                </div>
                <ProgressActions
                  type="diet"
                  id={diet.id}
                  current={latestLog(data, diet.id)}
                  onLog={onLog}
                />
              </div>

              {diet.foods?.length > 0 && (
                <div className="gz-member-food-list">
                  {diet.foods.map((food: any) => {
                    const checked = (data.logs || []).some(
                      (log: any) =>
                        log.assignmentId === diet.id &&
                        log.itemId === food.id &&
                        log.status === 'logged'
                    )
                    return (
                      <button
                        type="button"
                        className={`gz-member-food-item ${checked ? 'checked' : ''}`}
                        key={food.id}
                        onClick={() => onLog('diet', diet.id, checked ? 'missed' : 'logged', food.id)}
                      >
                        <span className="gz-food-checkbox">
                          {checked && <Icon name="check" />}
                        </span>
                        <div className="gz-member-food-copy">
                          <strong className="gz-member-food-name">{food.name}</strong>
                          <span className="gz-member-food-sub">
                            {food.time}
                            {food.serving ? ` · ${food.serving}` : ''}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="gz-empty-card">
            <Icon name="heart" className="gz-empty-icon" />
            <p>No diet plan assigned by your coach yet.</p>
          </div>
        )}
      </SectionPanel>

      {/* Member Fees Card */}
      <SectionPanel
        title="My Membership Dues"
        tag="PAYMENTS & INVOICES"
        icon="plate"
        badge={
          (data?.fees || []).some((f: any) => f.status === 'due' || f.status === 'overdue') ? (
            <GenZBadge variant="orange">Payment Due</GenZBadge>
          ) : (
            <GenZBadge variant="acc">Up to date</GenZBadge>
          )
        }
      >
        {data?.fees?.length ? (
          <div className="gz-invoice-list">
            {data.fees.map((fee: any) => (
              <div className="gz-invoice-card" key={fee.id}>
                <div className="gz-invoice-icon">
                  <Icon name="plate" />
                </div>
                <div className="gz-invoice-copy">
                  <strong>
                    {fee.amount} {fee.currency}
                  </strong>
                  <span>
                    Due {prettyDate(fee.dueDate)} · <span className={`status-text-${fee.status}`}>{fee.status}</span>
                  </span>
                  {fee.note && <small>{fee.note}</small>}
                </div>
                {['due', 'overdue', 'rejected'].includes(fee.status) && (
                  <Button size="xs" variant="primary" onClick={() => onSubmitFee(fee.id)}>
                    Mark Paid
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="gz-empty-card">
            <Icon name="checkCircle" className="gz-empty-icon" />
            <p>No outstanding membership fees.</p>
          </div>
        )}
      </SectionPanel>
    </div>
  )
}

function AssignmentRecords({ data, members }: { data: any; members: any[] }) {
  const hitCount = (data?.logs || []).filter((l: any) => l.status === 'hit' || l.status === 'logged').length
  const missedCount = (data?.logs || []).filter((l: any) => l.status === 'missed').length

  return (
    <div className="gz-grid-2col">
      <SectionPanel
        title="Squad Consistency Tracker"
        tag="LIVE ACTIVITY"
        icon="chartLine"
        badge={<GenZBadge variant="acc">{hitCount} Hits Logged</GenZBadge>}
      >
        <div className="gz-progress-metric-strip">
          <div className="gz-metric-pill green">
            <strong>{hitCount}</strong>
            <span>Completed Hits</span>
          </div>
          <div className="gz-metric-pill orange">
            <strong>{missedCount}</strong>
            <span>Missed / Skipped</span>
          </div>
        </div>

        {data?.logs?.length ? (
          <div className="gz-log-list">
            {data.logs.slice(0, 15).map((log: any, idx: number) => {
              const mem = members.find((m: any) => m.id === log.memberId)
              const isHit = log.status === 'hit' || log.status === 'logged'
              return (
                <div className="gz-log-item" key={`${log.assignmentId}-${log.date}-${idx}`}>
                  <div className="gz-log-avatar">
                    {(mem?.name || log.memberId || 'TR').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="gz-log-copy">
                    <strong>{mem?.name || log.memberId}</strong>
                    <span>
                      {log.assignmentType} · {log.date}
                      {log.metric ? ` · ${log.metric}` : ''}
                    </span>
                  </div>
                  <span className={`gz-status-tag ${isHit ? 'status-approved' : 'status-rejected'}`}>
                    {log.status}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="gz-empty-card">
            <Icon name="chartLine" className="gz-empty-icon" />
            <p>No squad activity recorded yet.</p>
          </div>
        )}
      </SectionPanel>

      <SectionPanel
        title="Deployed Diet Protocols"
        tag="NUTRITION STATUS"
        icon="heart"
        badge={<GenZBadge variant="purple">{(data?.diets || []).length} Active</GenZBadge>}
      >
        {data?.diets?.length ? (
          <div className="gz-log-list">
            {data.diets.slice(0, 10).map((diet: any) => {
              const mem = members.find((m: any) => m.id === diet.memberId)
              return (
                <div className="gz-log-item" key={diet.id}>
                  <div className="gz-log-icon">
                    <Icon name="heart" />
                  </div>
                  <div className="gz-log-copy">
                    <strong>{diet.title}</strong>
                    <span>{mem?.name || diet.memberId}</span>
                  </div>
                  <span className="gz-status-tag status-approved">
                    {latestLog(data, diet.id)?.status || 'Active'}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="gz-empty-card">
            <Icon name="heart" className="gz-empty-icon" />
            <p>No diet protocols deployed yet.</p>
          </div>
        )}
      </SectionPanel>
    </div>
  )
}
