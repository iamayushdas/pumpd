import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import {
  api,
  getAccessRequests,
  approveAccessRequest,
  rejectAccessRequest,
  listGyms,
} from '../lib/api'
import { fmtDate, fmtNum, fmtVol, fmtDur } from '../lib/format'
import { workoutVolume, setsDone } from '../lib/history'
import { confirmSheet } from '../sheets'
import Icon from '../components/Icon'
import { Button, TextField, SelectButton } from '../components/ui'
import { personaLabel } from '../components/PersonaPicker'
import PageBreadcrumb from '../components/PageBreadcrumb'
import WorkspaceNav from '../components/WorkspaceNav'
import type { PersonaRole } from '../types/store/user'

const roles: PersonaRole[] = ['member', 'trainer', 'owner', 'admin']

const rel = (ts: number | null | undefined) => {
  if (!ts) return 'never'
  const s = Math.max(0, (Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s / 60) + 'm ago'
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'
  return Math.floor(s / 86400) + 'd ago'
}

const dur = (ms: number) => {
  const m = Math.max(0, Math.floor(ms / 60000))
  return m < 60 ? m + 'm' : Math.floor(m / 60) + 'h' + (m % 60) + 'm'
}

function UserDetailSheet({
  id,
  gyms,
  trainers,
  onChanged,
  close,
}: {
  id: string
  gyms: any[]
  trainers: any[]
  onChanged: () => void
  close: () => void
}) {
  const [d, setD] = useState<any>(null)
  const [editingRole, setEditingRole] = useState<PersonaRole>('member')
  const [editingGymId, setEditingGymId] = useState('')
  const [editingTrainerId, setEditingTrainerId] = useState('')
  const [savingRole, setSavingRole] = useState(false)
  const toast = useUI(s => s.toast)

  useEffect(() => {
    api('/api/admin/user?id=' + encodeURIComponent(id))
      .then(data => {
        setD(data)
        if (data.user) {
          setEditingRole((data.user.admin ? 'admin' : data.user.role || 'member') as PersonaRole)
          setEditingGymId(data.user.gymId || '')
          setEditingTrainerId(data.user.trainerId || '')
        }
      })
      .catch(e => toast(e.message))
  }, [id])

  if (!d) return <div className="muted small" style={{ padding: 20 }}>Loading user details…</div>
  const u = d.user

  const saveRoleAndGym = async () => {
    setSavingRole(true)
    try {
      await api('/api/admin/user/role', {
        method: 'POST',
        body: JSON.stringify({
          id: u.id,
          role: editingRole,
          gymId: editingGymId.trim() || null,
          trainerId: editingRole === 'member' && editingTrainerId ? editingTrainerId : null,
        }),
      })
      toast('User role & facility assignment updated!')
      onChanged()
      // Reload current user data
      const refreshed = await api('/api/admin/user?id=' + encodeURIComponent(id))
      setD(refreshed)
    } catch (e: any) {
      toast(e.message || 'Failed to update user role')
    } finally {
      setSavingRole(false)
    }
  }

  const setDisabled = (disabled: boolean) => {
    api('/api/admin/user/disable', { method: 'POST', body: JSON.stringify({ id: u.id, disabled }) })
      .then(() => {
        toast(disabled ? 'Account disabled' : 'Account enabled')
        onChanged()
        close()
      })
      .catch(e => toast(e.message))
  }

  return (
    <div className="admin-user-sheet">
      <div className="admin-sheet-head">
        <div className="admin-sheet-avatar">
          {u.name ? u.name.slice(0, 2).toUpperCase() : 'US'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className="capitalize" style={{ margin: 0, fontSize: 18, fontWeight: 750 }}>
            {u.name}
          </h3>
          <div className="dim small" style={{ marginTop: 2, wordBreak: 'break-all' }}>
            {u.email || u.id}
          </div>
        </div>
        {u.disabled ? (
          <span className="tag" style={{ color: 'var(--red)', borderColor: 'var(--red)' }}>Disabled</span>
        ) : (
          <span className="tag acc">Active</span>
        )}
      </div>

      <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '12px 0' }}>
        <span className="tag acc">{personaLabel(u.role, u.admin)}</span>
        {u.gymId && <span className="tag">Gym: {u.gymId}</span>}
        {u.invitedBy && <span className="tag">Invite: {u.invitedBy}</span>}
        <span className="tag">Joined {u.created ? fmtDate(u.created.slice(0, 10)) : '—'}</span>
      </div>

      {/* User Stats Grid */}
      <div className="tiles" style={{ textAlign: 'left', marginBottom: 16 }}>
        <div className="tile">
          <div className="l">Workouts</div>
          <div className="v" style={{ fontSize: '1.15rem' }}>{d.workouts.length}</div>
        </div>
        <div className="tile">
          <div className="l">Weigh-ins</div>
          <div className="v" style={{ fontSize: '1.15rem' }}>{d.bodyweight.length}</div>
        </div>
        <div className="tile">
          <div className="l">Routines</div>
          <div className="v" style={{ fontSize: '1.15rem' }}>{d.routines.length}</div>
        </div>
        <div className="tile">
          <div className="l">Last Sync</div>
          <div className="v" style={{ fontSize: '.95rem' }}>{rel(d.lastSync)}</div>
        </div>
      </div>

      {/* Access & Role Management Card */}
      <div className="card" style={{ padding: 14, marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700 }}>Access & Role Assignment</h4>
        <div className="form-grid-2" style={{ marginBottom: 12 }}>
          <SelectButton
            label="Role"
            value={editingRole}
            onChange={val => setEditingRole(val as PersonaRole)}
            options={roles.map(r => ({
              value: r,
              label: personaLabel(r, r === 'admin'),
              icon: r === 'admin' ? 'crown' : r === 'owner' ? 'bolt' : r === 'trainer' ? 'arm' : 'person',
            }))}
          />

          <SelectButton
            label="Gym Facility"
            value={editingGymId}
            onChange={setEditingGymId}
            options={[
              { value: '', label: 'No gym assigned' },
              ...gyms.map(g => ({
                value: g.id,
                label: g.name || g.id,
                subtitle: `ID: ${g.id}`,
                icon: 'globe',
              })),
              ...(editingGymId && !gyms.some(g => g.id === editingGymId)
                ? [{ value: editingGymId, label: `${editingGymId} (Custom)` }]
                : []),
            ]}
            searchable={true}
          />

          {editingRole === 'member' && (
            <SelectButton
              label="Assigned Trainer"
              value={editingTrainerId}
              onChange={setEditingTrainerId}
              options={[
                { value: '', label: 'No trainer assigned' },
                ...trainers.map(tr => ({
                  value: tr.id,
                  label: tr.name,
                  subtitle: personaLabel(tr.role, tr.admin),
                  icon: 'arm',
                })),
              ]}
              searchable={true}
            />
          )}
        </div>

        <div className="row between" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
          <Button
            size="sm"
            variant="primary"
            icon="check"
            disabled={savingRole}
            onClick={saveRoleAndGym}
          >
            {savingRole ? 'Saving…' : 'Save Role & Gym'}
          </Button>

          {!u.admin && (
            <Button
              size="sm"
              variant={u.disabled ? 'primary' : 'danger'}
              onClick={() =>
                u.disabled
                  ? setDisabled(false)
                  : confirmSheet({
                      title: 'Disable ' + u.name + '?',
                      message: 'They will be signed out everywhere and cannot log in or sync until re-enabled.',
                      confirmText: 'Disable Account',
                      danger: true,
                      onConfirm: () => setDisabled(true),
                    })
              }
            >
              {u.disabled ? 'Enable Account' : 'Disable Account'}
            </Button>
          )}
        </div>
      </div>

      {/* Workout History */}
      <h4 className="sec" style={{ margin: '14px 0 8px' }}>
        Workout History ({d.workouts.length})
      </h4>
      {d.workouts.length ? (
        <div className="list" style={{ gap: 0, maxHeight: 240, overflowY: 'auto' }}>
          {d.workouts.slice(0, 40).map(w => (
            <div
              key={w.id}
              className="row between"
              style={{ padding: '8px 2px', borderBottom: '1px solid var(--sep)' }}
            >
              <div>
                <div className="small" style={{ fontWeight: 600 }}>
                  {w.name}
                </div>
                <div className="dim" style={{ fontSize: '.72rem' }}>
                  {fmtDate(w.d, true)} · {fmtDur((w.end || w.start) - w.start)} · {setsDone(w)} sets
                  {w.prs?.length ? ' · ' + w.prs.length + ' PR' : ''}
                </div>
              </div>
              <span className="small muted">{fmtVol(w.vol ?? workoutVolume(w), d.unit)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty small">No workouts logged yet.</div>
      )}
    </div>
  )
}

function AccessRequestsCard({
  requests,
  gyms,
  reload,
}: {
  requests: any[]
  gyms: any[]
  reload: () => void
}) {
  const toast = useUI(s => s.toast)

  const handleApprove = (req: any) => {
    confirmSheet({
      title: 'Approve ' + req.name + '?',
      message:
        'An invite code will be generated' +
        (req.email ? ' and emailed to ' + req.email : '') +
        ' with role "' +
        personaLabel(req.requestedRole) +
        '".',
      confirmText: 'Approve & Issue Code',
      onConfirm: () => {
        approveAccessRequest(req._id, req.requestedRole || 'member', req.gymId || null)
          .then(({ code, emailSent, emailError }) => {
            navigator.clipboard?.writeText(code).catch(() => {})
            const msg = emailSent
              ? 'Approved! Code ' + code + ' sent to ' + req.email
              : 'Approved! Code ' + code + ' copied to clipboard' + (emailError ? ' (email failed: ' + emailError + ')' : '')
            toast(msg)
            reload()
          })
          .catch(e => toast(e.message))
      },
    })
  }

  const handleReject = (req: any) => {
    confirmSheet({
      title: 'Reject ' + req.name + '?',
      message: 'This will mark their access request as rejected.',
      confirmText: 'Reject Request',
      danger: true,
      onConfirm: () => {
        rejectAccessRequest(req._id)
          .then(() => {
            toast('Request rejected')
            reload()
          })
          .catch(e => toast(e.message))
      },
    })
  }

  const pending = (requests || []).filter(r => r.status === 'pending')
  const processed = (requests || []).filter(r => r.status !== 'pending')

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Access Requests Queue</h2>
        <span className="tag acc">{pending.length} Pending</span>
      </div>
      <div className="small muted" style={{ marginBottom: 12 }}>
        {pending.length} pending · {processed.length} previously processed
      </div>

      {pending.map(r => (
        <div key={r._id} className="card small" style={{ marginBottom: 8, padding: 12, background: 'var(--surface-2)' }}>
          <div className="row between" style={{ marginBottom: 6 }}>
            <div>
              <div style={{ fontWeight: 600 }}>{r.name}</div>
              <div className="dim small">{r.email}</div>
            </div>
            <div className="row" style={{ gap: 4 }}>
              <span className="tag acc">{personaLabel(r.requestedRole)}</span>
              {r.gymId && <span className="tag">Gym: {r.gymId}</span>}
            </div>
          </div>
          {r.message && (
            <div className="dim small" style={{ marginBottom: 8, lineHeight: 1.4, background: 'var(--surface)', padding: 8, borderRadius: 8 }}>
              "{r.message}"
            </div>
          )}
          <div className="small dim" style={{ marginBottom: 10 }}>
            Requested {rel(new Date(r.created).getTime())}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Button variant="primary" size="sm" onClick={() => handleApprove(r)} style={{ flex: 1 }}>
              Approve & Issue Code
            </Button>
            <Button variant="danger" size="sm" onClick={() => handleReject(r)} style={{ flex: 1 }}>
              Reject
            </Button>
          </div>
        </div>
      ))}

      {pending.length === 0 && (
        <div className="dim small" style={{ padding: '8px 0', textAlign: 'center' }}>
          No pending access requests.
        </div>
      )}

      {processed.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary className="small muted" style={{ cursor: 'pointer', marginBottom: 8 }}>
            Processed Requests Archive ({processed.length})
          </summary>
          {processed.map(r => (
            <div
              key={r._id}
              className="row between dim"
              style={{ padding: '7px 2px', fontSize: '.8rem', borderBottom: '1px solid var(--sep)' }}
            >
              <div>
                <div>{r.name} ({r.email})</div>
                <div style={{ fontSize: '.7rem' }}>
                  Role: {personaLabel(r.requestedRole)} {r.gymId ? `· Gym: ${r.gymId}` : ''}
                </div>
              </div>
              <span
                className="tag"
                style={{ color: r.status === 'approved' ? 'var(--green)' : 'var(--red)', textTransform: 'capitalize' }}
              >
                {r.status}
              </span>
            </div>
          ))}
        </details>
      )}
    </div>
  )
}

function InvitesCard({
  invites,
  gyms,
  reload,
}: {
  invites: any[]
  gyms: any[]
  reload: () => void
}) {
  const toast = useUI(s => s.toast)
  const [selectedRole, setSelectedRole] = useState<PersonaRole>('member')
  const [selectedGymId, setSelectedGymId] = useState('')
  const [creating, setCreating] = useState(false)

  const gen = async () => {
    setCreating(true)
    try {
      const { invite } = await api('/api/admin/invites/new', {
        method: 'POST',
        body: JSON.stringify({
          role: selectedRole,
          gymId: selectedGymId || undefined,
        }),
      })
      navigator.clipboard?.writeText(invite.code).catch(() => {})
      toast('Invite code ' + invite.code + ' created & copied to clipboard!')
      reload()
    } catch (e: any) {
      toast(e.message || 'Failed to generate code')
    } finally {
      setCreating(false)
    }
  }

  const revoke = (code: string) => {
    confirmSheet({
      title: 'Revoke code ' + code + '?',
      message: 'This invite code will become invalid immediately.',
      confirmText: 'Revoke Code',
      danger: true,
      onConfirm: () => {
        api('/api/admin/invites/revoke', { method: 'POST', body: JSON.stringify({ code }) })
          .then(() => {
            toast('Code ' + code + ' revoked')
            reload()
          })
          .catch(e => toast(e.message))
      },
    })
  }

  const open = (invites || []).filter(i => !i.usedBy)
  const used = (invites || []).filter(i => i.usedBy)

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16 }}>Invite Codes</h2>
          <div className="small muted" style={{ marginTop: 2 }}>
            {open.length} unused · {used.length} redeemed
          </div>
        </div>
      </div>

      {/* Generator Form */}
      <div
        className="card small"
        style={{ padding: 12, marginBottom: 12, background: 'var(--surface-2)' }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--label-2)' }}>
          GENERATE PRE-CONFIGURED INVITE
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'flex-end' }}>
          <div>
            <label className="small muted" style={{ display: 'block', marginBottom: 2 }}>Role</label>
            <select
              className="field"
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value as PersonaRole)}
              style={{ width: '100%', height: 36, fontSize: 13 }}
            >
              {roles.map(r => (
                <option key={r} value={r}>
                  {personaLabel(r, r === 'admin')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="small muted" style={{ display: 'block', marginBottom: 2 }}>Facility</label>
            <select
              className="field"
              value={selectedGymId}
              onChange={e => setSelectedGymId(e.target.value)}
              style={{ width: '100%', height: 36, fontSize: 13 }}
            >
              <option value="">No Gym Preset</option>
              {gyms.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name || g.id}
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={gen}
            icon="plus"
            disabled={creating}
            style={{ height: 36 }}
          >
            Create
          </Button>
        </div>
      </div>

      {/* Unused Invites */}
      <div style={{ marginBottom: 12 }}>
        <div className="small muted" style={{ fontWeight: 600, marginBottom: 6 }}>
          Active Codes ({open.length})
        </div>
        {open.map(i => (
          <div
            key={i.code}
            className="row between"
            style={{ padding: '8px 4px', borderBottom: '1px solid var(--sep)' }}
          >
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <span
                style={{
                  fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace',
                  fontWeight: 600,
                  letterSpacing: '.06em',
                  cursor: 'pointer',
                  color: 'var(--acc)',
                }}
                onClick={() => {
                  navigator.clipboard?.writeText(i.code).catch(() => {})
                  toast('Copied ' + i.code)
                }}
                title="Click to copy"
              >
                {i.code}
              </span>
              {i.role && <span className="tag" style={{ fontSize: 10 }}>{personaLabel(i.role)}</span>}
              {i.gymId && <span className="tag" style={{ fontSize: 10 }}>{i.gymId}</span>}
            </div>
            <button
              className="iconbtn"
              style={{ width: 30, height: 30, borderRadius: 8, fontSize: 14, color: 'var(--red)' }}
              onClick={() => revoke(i.code)}
              aria-label="Revoke"
              title="Revoke code"
            >
              <Icon name="trash" />
            </button>
          </div>
        ))}
        {!open.length && <div className="dim small">No active unused invite codes.</div>}
      </div>

      {/* Used Invites */}
      {used.length > 0 && (
        <details>
          <summary className="small muted" style={{ cursor: 'pointer', marginBottom: 6 }}>
            Redeemed Codes Log ({used.length})
          </summary>
          {used.map(i => (
            <div
              key={i.code}
              className="row between dim"
              style={{ padding: '6px 2px', fontSize: '.8rem', borderBottom: '1px solid var(--sep)' }}
            >
              <span style={{ fontFamily: 'monospace' }}>{i.code}</span>
              <span>→ {i.usedByName || 'Used'}</span>
            </div>
          ))}
        </details>
      )}
    </div>
  )
}

function FacilitiesCard({
  gyms,
  users,
  reload,
}: {
  gyms: any[]
  users: any[]
  reload: () => void
}) {
  const nav = useNavigate()
  const toast = useUI(s => s.toast)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  const createGym = async () => {
    if (!name.trim()) return
    setCreating(true)
    try {
      await api('/api/admin/gyms', { method: 'POST', body: JSON.stringify({ name: name.trim() }) })
      toast('Facility "' + name.trim() + '" created!')
      setName('')
      reload()
    } catch (e: any) {
      toast(e.message || 'Failed to create gym')
    } finally {
      setCreating(false)
    }
  }

  const gymUserCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    ;(users || []).forEach(u => {
      if (u.gymId) {
        counts[u.gymId] = (counts[u.gymId] || 0) + 1
      }
    })
    return counts
  }, [users])

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Gym Facilities & Hubs</h2>
        <span className="tag acc">{gyms.length} Facilities</span>
      </div>

      <p className="dim small" style={{ marginBottom: 12 }}>
        Create and organize gym hubs for multi-facility operations, member assignments, and coaching.
      </p>

      {/* Create Gym Inline */}
      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <TextField
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="New gym name (e.g. Iron Vault Downtown)"
          style={{ flex: 1 }}
        />
        <Button
          variant="primary"
          size="sm"
          icon="plus"
          disabled={!name.trim() || creating}
          onClick={createGym}
        >
          {creating ? 'Creating…' : 'Add Facility'}
        </Button>
      </div>

      {/* Gyms List */}
      <div className="list" style={{ gap: 6 }}>
        {gyms.map(g => (
          <div
            key={g.id}
            className="card small"
            style={{ padding: '10px 12px', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
          >
            <div>
              <div style={{ fontWeight: 650, fontSize: 14 }}>{g.name || g.id}</div>
              <div className="row" style={{ gap: 6, marginTop: 3 }}>
                <span
                  className="tag"
                  style={{ cursor: 'pointer', fontFamily: 'monospace' }}
                  onClick={() => {
                    navigator.clipboard?.writeText(g.id).catch(() => {})
                    toast('Copied Gym ID: ' + g.id)
                  }}
                  title="Click to copy Gym ID"
                >
                  ID: {g.id}
                </span>
                <span className="tag acc">{gymUserCounts[g.id] || 0} Members</span>
              </div>
            </div>

            <Button
              size="xs"
              variant="ghost"
              icon="wrench"
              onClick={() => nav('/management')}
            >
              Manage Ops
            </Button>
          </div>
        ))}
        {!gyms.length && <div className="dim small">No gym facilities created yet.</div>}
      </div>
    </div>
  )
}

export default function Admin() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const toast = useUI(s => s.toast)
  const openSheet = useUI(s => s.openSheet)

  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'facilities' | 'invites' | 'requests'>('overview')
  const [users, setUsers] = useState<any[] | null>(null)
  const [invites, setInvites] = useState<any[] | null>(null)
  const [accessRequests, setAccessRequests] = useState<any[] | null>(null)
  const [gyms, setGyms] = useState<any[]>([])
  const [inviteOnly, setInviteOnly] = useState(false)

  // Filters for User Directory
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | PersonaRole>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'active' | 'disabled'>('all')
  const [gymFilter, setGymFilter] = useState<'all' | string>('all')

  const loadUsers = () =>
    api('/api/admin/users')
      .then(d => {
        setUsers(d.users)
        setInviteOnly(d.invite_only)
      })
      .catch(e => toast(e.message || 'Failed to load users'))

  const loadInvites = () =>
    api('/api/admin/invites')
      .then(d => setInvites(d.invites))
      .catch(() => {})

  const loadAccessRequests = () =>
    getAccessRequests()
      .then(d => setAccessRequests(d.requests))
      .catch(() => {})

  const loadGyms = () =>
    listGyms()
      .then(d => setGyms(d.gyms || []))
      .catch(() => {})

  const reloadAll = () => {
    loadUsers()
    loadInvites()
    loadAccessRequests()
    loadGyms()
  }

  useEffect(() => {
    if (!user?.admin) return
    reloadAll()
    const iv = setInterval(() => {
      loadUsers()
      loadAccessRequests()
    }, 15000)
    return () => clearInterval(iv)
  }, [user?.admin])

  if (!user?.admin) return null

  const trainers = useMemo(
    () => (users || []).filter(u => u.role === 'trainer' || u.role === 'owner' || u.admin),
    [users]
  )

  const openUser = (id: string) =>
    openSheet(close => (
      <UserDetailSheet
        id={id}
        gyms={gyms}
        trainers={trainers}
        onChanged={loadUsers}
        close={close}
      />
    ))

  const liveUsers = useMemo(() => (users || []).filter(u => u.live), [users])
  const activeCount = useMemo(
    () => (users || []).filter(u => u.lastSync && Date.now() - u.lastSync < 7 * 86400000).length,
    [users]
  )
  const pendingRequests = useMemo(
    () => (accessRequests || []).filter(r => r.status === 'pending').length,
    [accessRequests]
  )

  const filteredUsers = useMemo(() => {
    if (!users) return []
    return users.filter(u => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchName = u.name?.toLowerCase().includes(q)
        const matchEmail = u.email?.toLowerCase().includes(q)
        const matchId = u.id?.toLowerCase().includes(q)
        const matchGym = u.gymId?.toLowerCase().includes(q)
        if (!matchName && !matchEmail && !matchId && !matchGym) return false
      }
      // Role filter
      if (roleFilter !== 'all') {
        const uRole = u.admin ? 'admin' : u.role || 'member'
        if (uRole !== roleFilter) return false
      }
      // Status filter
      if (statusFilter === 'live' && !u.live) return false
      if (statusFilter === 'disabled' && !u.disabled) return false
      if (statusFilter === 'active' && (!u.lastSync || Date.now() - u.lastSync >= 7 * 86400000)) return false
      // Gym filter
      if (gymFilter !== 'all' && u.gymId !== gymFilter) return false

      return true
    })
  }, [users, searchQuery, roleFilter, statusFilter, gymFilter])

  return (
    <div className="narrow admin-page" style={{ paddingBottom: 32 }}>
      <PageBreadcrumb
        items={[
          { label: 'Settings', icon: 'gear', path: '/settings' },
          { label: 'System Admin', icon: 'shield' },
        ]}
        scope="system"
      />

      <WorkspaceNav />

      {/* Header Banner */}
      <div className="admin-header-card" style={{ marginTop: 12 }}>
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 4 }}>
              <span className="admin-role-badge">
                <Icon name="shield" />
                <span>Super Admin</span>
              </span>
              <span className="admin-live-pulse">
                <span className="admin-pulse-dot" /> Live Polling
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>
              System Administration
            </h1>
            <div className="dim small" style={{ marginTop: 4 }}>
              {users ? `${users.length} users · ${activeCount} active this week · ${gyms.length} facilities` : 'Loading system data…'}
            </div>
          </div>
          <button className="iconbtn" onClick={reloadAll} aria-label="Refresh data" title="Refresh">
            ↻
          </button>
        </div>
      </div>

      {/* KPI Bento Grid */}
      <div className="admin-kpi-grid">
        <div className="admin-kpi-card" onClick={() => setActiveTab('users')}>
          <div className="admin-kpi-icon" style={{ background: 'var(--acc-soft)', color: 'var(--acc)' }}>
            <Icon name="person" />
          </div>
          <div className="admin-kpi-val">{users ? users.length : '—'}</div>
          <div className="admin-kpi-label">Total Users</div>
        </div>

        <div
          className="admin-kpi-card"
          onClick={() => {
            setActiveTab('users')
            setStatusFilter('live')
          }}
          style={liveUsers.length ? { borderColor: 'var(--green)' } : undefined}
        >
          <div className="admin-kpi-icon" style={{ background: 'rgba(52, 199, 89, 0.15)', color: 'var(--green)' }}>
            <Icon name="flame" />
          </div>
          <div className="admin-kpi-val" style={{ color: liveUsers.length ? 'var(--green)' : undefined }}>
            {liveUsers.length}
          </div>
          <div className="admin-kpi-label">Training Now</div>
        </div>

        <div className="admin-kpi-card" onClick={() => setActiveTab('facilities')}>
          <div className="admin-kpi-icon" style={{ background: 'rgba(10, 132, 255, 0.15)', color: 'var(--blue)' }}>
            <Icon name="globe" />
          </div>
          <div className="admin-kpi-val">{gyms.length}</div>
          <div className="admin-kpi-label">Facilities</div>
        </div>

        <div
          className="admin-kpi-card"
          onClick={() => setActiveTab('requests')}
          style={pendingRequests > 0 ? { borderColor: 'var(--orange)' } : undefined}
        >
          <div className="admin-kpi-icon" style={{ background: 'rgba(255, 159, 10, 0.15)', color: 'var(--orange)' }}>
            <Icon name="bell" />
          </div>
          <div className="admin-kpi-val" style={{ color: pendingRequests > 0 ? 'var(--orange)' : undefined }}>
            {pendingRequests}
          </div>
          <div className="admin-kpi-label">Requests</div>
        </div>
      </div>

      {/* Sub-Nav Pill Tabs */}
      <div className="gz-tab-bar" style={{ marginBottom: 12 }}>
        <button
          className={`gz-tab-pill ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Icon name="chart" />
          <span>Overview & Live</span>
        </button>
        <button
          className={`gz-tab-pill ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <Icon name="users" />
          <span>User Directory</span>
          {users && <span className="gz-tab-badge">{users.length}</span>}
        </button>
        <button
          className={`gz-tab-pill ${activeTab === 'facilities' ? 'active' : ''}`}
          onClick={() => setActiveTab('facilities')}
        >
          <Icon name="globe" />
          <span>Facilities</span>
        </button>
        <button
          className={`gz-tab-pill ${activeTab === 'invites' ? 'active' : ''}`}
          onClick={() => setActiveTab('invites')}
        >
          <Icon name="key" />
          <span>Invite Codes</span>
        </button>
        <button
          className={`gz-tab-pill ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          <Icon name="mail" />
          <span>Access Requests</span>
          {pendingRequests > 0 && <span className="gz-tab-badge">{pendingRequests}</span>}
        </button>
      </div>

      {/* ==================== TAB: OVERVIEW & LIVE ==================== */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Live Workouts Monitor */}
          {liveUsers.length > 0 ? (
            <div className="card" style={{ borderColor: 'var(--green)' }}>
              <div className="row between" style={{ marginBottom: 10 }}>
                <h2 className="row" style={{ margin: 0, gap: 6, fontSize: 16, color: 'var(--green)' }}>
                  <span className="admin-pulse-dot" style={{ background: 'var(--green)', boxShadow: '0 0 8px var(--green)' }} />
                  Live Training Stream ({liveUsers.length})
                </h2>
                <span className="tag acc">Real-time</span>
              </div>
              <div className="list" style={{ gap: 6 }}>
                {liveUsers.map(u => (
                  <div
                    key={u.id}
                    className="card small"
                    style={{ padding: '10px 12px', background: 'var(--surface-2)', cursor: 'pointer' }}
                    onClick={() => openUser(u.id)}
                  >
                    <div className="row between">
                      <div>
                        <div style={{ fontWeight: 650 }}>{u.name}</div>
                        <div className="dim" style={{ fontSize: '.76rem', marginTop: 2 }}>
                          {u.live.name} · Exercise {u.live.exIdx}/{u.live.exTotal} · {u.live.setsDone}/{u.live.setsTotal} sets
                        </div>
                      </div>
                      <span className="tag acc">{dur(Date.now() - u.live.startedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 14, textAlign: 'center' }}>
              <Icon name="flame" style={{ fontSize: 24, color: 'var(--label-3)', marginBottom: 6 }} />
              <div className="small muted">No users currently in an active workout session.</div>
            </div>
          )}

          {/* Quick Domain Navigation */}
          <div className="gz-quick-grid">
            <div className="gz-quick-card" onClick={() => setActiveTab('users')}>
              <div className="gz-quick-card-icon"><Icon name="users" /></div>
              <h4>User Directory</h4>
              <p>Search, manage roles, assign facilities, and inspect workout histories.</p>
              <span className="gz-quick-link">Manage Users →</span>
            </div>

            <div className="gz-quick-card" onClick={() => setActiveTab('facilities')}>
              <div className="gz-quick-card-icon"><Icon name="globe" /></div>
              <h4>Facilities & Hubs</h4>
              <p>Create and configure gym identifiers for multi-tenant squad management.</p>
              <span className="gz-quick-link">Manage Facilities →</span>
            </div>

            <div className="gz-quick-card" onClick={() => setActiveTab('invites')}>
              <div className="gz-quick-card-icon"><Icon name="key" /></div>
              <h4>Invite Keys</h4>
              <p>Issue pre-assigned role invites and monitor redemption logs.</p>
              <span className="gz-quick-link">Manage Invites →</span>
            </div>

            <div className="gz-quick-card" onClick={() => setActiveTab('requests')}>
              <div className="gz-quick-card-icon"><Icon name="mail" /></div>
              <h4>Access Requests</h4>
              <p>Review visitor sign-up requests and issue instant passkeys.</p>
              <span className="gz-quick-link">Review Requests →</span>
            </div>
          </div>

          {/* Quick Access to Gym Operations */}
          <div className="card" style={{ padding: 16, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Switch to Gym Operations</div>
              <div className="dim small" style={{ marginTop: 2 }}>
                Configure weekly splits, nutrition protocols, and squad dues.
              </div>
            </div>
            <Button variant="primary" size="sm" icon="wrench" onClick={() => nav('/management')}>
              Open Gym Ops
            </Button>
          </div>
        </div>
      )}

      {/* ==================== TAB: USER DIRECTORY ==================== */}
      {activeTab === 'users' && (
        <div>
          {/* Search & Filter Bar */}
          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div className="row" style={{ gap: 8, marginBottom: 10 }}>
              <TextField
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, ID, or gym…"
                style={{ flex: 1 }}
              />
              {searchQuery && (
                <button className="iconbtn" onClick={() => setSearchQuery('')} aria-label="Clear search">
                  <Icon name="xmark" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="small dim" style={{ marginRight: 4 }}>Role:</span>
              {(['all', 'admin', 'owner', 'trainer', 'member'] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  className={`admin-filter-pill ${roleFilter === r ? 'active' : ''}`}
                  onClick={() => setRoleFilter(r)}
                >
                  {r === 'all' ? 'All Roles' : personaLabel(r, r === 'admin')}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
              <span className="small dim" style={{ marginRight: 4 }}>Status:</span>
              {(['all', 'live', 'active', 'disabled'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  className={`admin-filter-pill ${statusFilter === s ? 'active' : ''}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === 'all' ? 'All' : s === 'live' ? '⚡ Live Now' : s === 'active' ? 'Active 7d' : 'Disabled'}
                </button>
              ))}
            </div>
          </div>

          {/* User List */}
          <div className="row between" style={{ marginBottom: 8, padding: '0 4px' }}>
            <span className="small muted">
              Showing {filteredUsers.length} of {users?.length || 0} users
            </span>
          </div>

          <div className="list">
            {filteredUsers.map(u => (
              <div
                key={u.id}
                className="item"
                onClick={() => openUser(u.id)}
                style={u.disabled ? { opacity: 0.55 } : undefined}
              >
                <div className="grow">
                  <div className="tt">
                    {u.live && (
                      <span className="admin-pulse-dot" style={{ display: 'inline-block', marginRight: 6, background: 'var(--green)' }} />
                    )}
                    {u.name}
                    <span className="tag acc" style={{ marginLeft: 6 }}>
                      {personaLabel(u.role, u.admin)}
                    </span>
                    {u.gymId && <span className="tag" style={{ marginLeft: 4 }}>Gym: {u.gymId}</span>}
                    {u.disabled && <span className="tag" style={{ marginLeft: 4, color: 'var(--red)' }}>Off</span>}
                  </div>
                  <div className="ss">
                    {u.live
                      ? '⚡ Training now · ' + u.live.name
                      : `${u.workouts || 0} workouts · synced ${rel(u.lastSync)}`}
                  </div>
                </div>
                {u.hasPush && <Icon name="bell" title="Push notifications active" style={{ fontSize: 14, color: 'var(--label-3)' }} />}
                <Icon name="chevronRight" className="chev" />
              </div>
            ))}
            {!filteredUsers.length && <div className="empty">No matching users found.</div>}
          </div>
        </div>
      )}

      {/* ==================== TAB: FACILITIES ==================== */}
      {activeTab === 'facilities' && (
        <FacilitiesCard gyms={gyms} users={users || []} reload={loadGyms} />
      )}

      {/* ==================== TAB: INVITE CODES ==================== */}
      {activeTab === 'invites' && (
        <InvitesCard invites={invites || []} gyms={gyms} reload={loadInvites} />
      )}

      {/* ==================== TAB: ACCESS REQUESTS ==================== */}
      {activeTab === 'requests' && (
        <AccessRequestsCard requests={accessRequests || []} gyms={gyms} reload={loadAccessRequests} />
      )}
    </div>
  )
}
