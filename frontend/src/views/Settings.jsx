import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, DEF, hasData } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { ACCENTS, todayISO, localTZ } from '../lib/format.js'
import { effortOf } from '../lib/history.js'
import { api, webauthnOK, passkeyLogin, passkeyRegister, IS_ANDROID } from '../lib/api.js'
import { pushSupported, enablePush, disablePush, sendTestPush } from '../lib/push.js'
import { wakeLockSupported } from '../lib/wakelock.js'
import { t, LANGS, INSTR_LANGS } from '../lib/i18n.js'
import { DEMO, REPO } from '../lib/demo.js'
import { MOBILE, shareExport, syncReminder } from '../lib/mobile.js'
import { loadStarterPlan, confirmSheet, importFromApp } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Section, Row, SelectRow, Switch, Segmented, Button, TextField } from '../components/ui.jsx'
import { ProfileSettings } from '../components/ProfileSettings.jsx'

export default function Settings() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const { update, replaceState, setUser, pullState, pushState, signOut, signOutAll, resetDemo } = useStore()
  const toast = useUI(s => s.toast)
  const fileRef = useRef(null)
  const importRef = useRef(null)
  const wakeOK = wakeLockSupported()

  const doExport = async () => {
    const json = JSON.stringify(S, null, 2)
    const name = 'pumpd-backup-' + todayISO() + '.json'
    if (MOBILE) {
      try { await shareExport(json, name); toast(t('Backup exported')) } catch (e) { /* share sheet dismissed */ }
      return
    }
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href)
    toast(t('Backup exported'))
  }

  const doImport = ev => {
    const f = ev.target.files[0]; if (!f) return
    const rd = new FileReader()
    rd.onload = () => {
      try {
        const data = JSON.parse(rd.result)
        if (!data.workouts || !data.routines) throw new Error('not a valid pumpd backup')
        confirmSheet({
          title: t('Import backup?'),
          message: t('This replaces all current data with the backup file.'),
          confirmText: t('Import'),
          danger: true,
          onConfirm: () => {
            replaceState(Object.assign(JSON.parse(JSON.stringify(DEF)), data), true)
            toast(t('Backup imported'))
          }
        })
      } catch (e) {
        toast(t('Import failed: {0}', e.message))
      }
    }
    rd.readAsText(f)
  }

  const signInHere = async () => {
    try {
      const u = await passkeyLogin()
      setUser(u)
      await pullState()
      toast(t('Welcome back, {0}', u.name))
    } catch (e) {
      if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') {
        toast(e.message || t('Sign-in failed'))
      }
    }
  }

  const registerHere = () => useUI.getState().openSheet(close => (
    <RegisterInline
      close={close}
      setUser={setUser}
      pushState={pushState}
      pullState={pullState}
      toast={toast}
    />
  ))

  const signOutEverywhere = () => confirmSheet({
    title: t('Sign out everywhere?'),
    message: t('Signs this profile out on every device, including this one. Your passkeys keep working — sign in with them again anytime.'),
    confirmText: t('Sign out everywhere'),
    danger: true,
    onConfirm: async () => {
      try {
        await signOutAll()
        nav('/home')
        toast(t('Signed out on all devices'))
      } catch (e) {
        toast(t('Could not sign out everywhere — you are still signed in.'))
      }
    },
  })

  return (
    <div className="narrow">
      {/* Top Header */}
      <div className="hdr" style={{ marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 750 }}>{t('Settings')}</h1>
          <div className="sub" style={{ fontSize: 13.5, marginTop: 2 }}>
            {t('Preferences, workouts & profile')}
          </div>
        </div>
        <button
          className="iconbtn"
          onClick={() => nav('/home')}
          aria-label={t('Home')}
          title={t('Return home')}
        >
          <Icon name="house" />
        </button>
      </div>

       {/* Hero Account Profile Card */}
       <div className="settings-profile-card">
         <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
           <div className="settings-avatar">
             <Icon name={user ? 'personCircle' : MOBILE ? 'lock' : 'sparkles'} />
           </div>
           <div style={{ flex: 1, minWidth: 0 }}>
             <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
               <span className="settings-profile-name">
                 {user ? user.name : MOBILE ? t('Local Mobile Profile') : DEMO ? t('Demo Account') : t('Guest User')}
               </span>
               {user && <span className="settings-status-tag">{t('Passkey')}</span>}
             </div>
             <div className="settings-profile-sub">
               {user
                 ? t('Data securely synced to your self-hosted instance')
                 : MOBILE
                   ? t('All workout data is stored locally on this phone')
                   : DEMO
                     ? t('Running on browser memory — reset anytime')
                     : t('Data stored in this browser · Create a passkey to sync')}
             </div>
           </div>
         </div>

        {/* Profile Action Buttons */}
        {!user && !DEMO && !MOBILE && webauthnOK() && (
          <div className="row" style={{ gap: 8, marginTop: 14 }}>
            <Button
              variant="primary"
              size="sm"
              icon="sparkles"
              onClick={registerHere}
              style={{ flex: 1 }}
            >
              {t('Create Passkey')}
            </Button>
            <Button
              size="sm"
              variant="tinted"
              icon="person"
              onClick={signInHere}
              style={{ flex: 1 }}
            >
              {t('Sign In')}
            </Button>
          </div>
        )}

        {user && user.admin && (
          <div style={{ marginTop: 12 }}>
            <Button
              size="sm"
              variant="tinted"
              icon="wrench"
              onClick={() => nav('/admin')}
            >
              {t('Open Admin Dashboard')}
            </Button>
          </div>
        )}
      </div>

      {/* ---------- Social Profile ---------- */}
      <ProfileSettings />

      {/* ---------- Workout Experience ---------- */}
      <Section
        title={t('Workout Experience')}
        footer={wakeOK ? t('Screen stay-awake keeps your session running uninterrupted.') : null}
      >
        <SelectRow
          icon="timer"
          iconTint="var(--orange)"
          title={t('Default Rest Timer')}
          sheetTitle={t('Rest Timer Duration')}
          value={S.restSec}
          onChange={v => update(s => { s.restSec = v })}
          options={[30, 60, 90, 120, 150, 180, 240, 300].map(v => ({
            value: v,
            label: `${v}s (${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')})`
          }))}
        />

        {(wakeOK || !MOBILE) && (
          <Row
            icon="sun"
            iconTint="var(--yellow)"
            title={t('Keep Screen Awake')}
            subtitle={wakeOK ? t('Prevent auto-lock while in a workout') : t('Not supported in this browser.')}
          >
            <Switch
              checked={wakeOK && S.keepAwake !== false}
              disabled={!wakeOK}
              onChange={v => update(s => { s.keepAwake = v })}
            />
          </Row>
        )}

        <Row icon="bell" iconTint="var(--pink)" title={t('Sound Effects & Chimes')}>
          <Switch checked={!!S.sound} onChange={v => update(s => { s.sound = v })} />
        </Row>

        <Row icon="target" iconTint="var(--purple)" title={t('Effort Tracking (RIR / RPE)')}>
          <button
            className="helpbtn"
            aria-label={t('What are RIR and RPE?')}
            onClick={effortHelpSheet}
          >
            <Icon name="info" />
          </button>
          <Segmented
            className="seg-inline"
            options={[
              { value: 'none', label: t('Off') },
              { value: 'rir', label: t('RIR') },
              { value: 'rpe', label: t('RPE') }
            ]}
            value={effortOf(S)}
            onChange={v => update(s => { s.effort = v; delete s.showRir })}
          />
        </Row>
      </Section>

      {/* ---------- Appearance & Personalization ---------- */}
      <Section
        title={t('Appearance & Theme')}
        footer={DEMO || MOBILE ? undefined : t('Appearance preferences are synced with your profile.')}
      >
        <Row icon="moon" iconTint="var(--indigo)" title={t('Theme Mode')}>
          <Segmented
            className="seg-inline"
            options={[
              { value: 'dark', icon: 'moon', label: t('Dark') },
              { value: 'light', icon: 'sun', label: t('Light') }
            ]}
            value={S.theme === 'light' ? 'light' : 'dark'}
            onChange={v => update(s => { s.theme = v })}
          />
        </Row>

        <Row icon="figureStrength" iconTint="var(--teal)" title={t('Body Anatomy Model')}>
          <Segmented
            className="seg-inline"
            options={[
              { value: 'male', label: t('Male') },
              { value: 'female', label: t('Female') }
            ]}
            value={S.body === 'female' ? 'female' : 'male'}
            onChange={v => update(s => { s.body = v })}
          />
        </Row>

        <div className="lrow" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10, padding: '12px 14px' }}>
          <span className="lrow-t" style={{ fontSize: 15, fontWeight: 600 }}>{t('Accent Palette')}</span>
          <div className="swatches">
            {Object.entries(ACCENTS).map(([k, c]) => (
              <button
                key={k}
                className={`swatch ${((S.accent || 'lime') === k ? ' on' : '')}`}
                style={{ background: c }}
                onClick={() => update(s => { s.accent = k })}
                aria-label={k}
              />
            ))}
          </div>
        </div>
      </Section>

      {/* ---------- Units & Regional ---------- */}
      <Section
        title={t('Units & Language')}
        footer={t('Note: Switching weight units changes display labels; logged numbers remain accurate.')}
      >
        <SelectRow
          icon="globe"
          iconTint="var(--blue)"
          title={t('Language')}
          sheetTitle={t('Select Language')}
          value={S.lang || 'en'}
          onChange={v => update(s => { s.lang = v })}
          options={Object.entries(LANGS).map(([k, name]) => ({
            value: k,
            label: name,
            subtitle: INSTR_LANGS.includes(k) ? null : t("Instructions in English"),
          }))}
        />

        <Row icon="scale" iconTint="var(--teal)" title={t('Weight Units')}>
          <Segmented
            className="seg-inline"
            options={[
              { value: 'kg', label: 'kg' },
              { value: 'lb', label: 'lb' }
            ]}
            value={S.unit}
            onChange={v => update(s => { s.unit = v })}
          />
        </Row>
      </Section>

      {/* ---------- Notifications ---------- */}
      {(user || MOBILE) && <NotificationsCard S={S} update={update} toast={toast} />}

      {/* ---------- Data Management & Backup ---------- */}
      <Section title={t('Data & Backups')}>
        <Row
          icon="sparkles"
          iconTint="var(--acc)"
          title={t('Load Starter Split (PPL)')}
          subtitle={t('Push · Pull · Legs default program')}
          accessory="chevron"
          onClick={loadStarterPlan}
        />
        <Row
          icon="shuffle"
          iconTint="var(--teal)"
          title={t('Import from Other Apps')}
          subtitle={t('FitNotes, Strong, Hevy, or Apple Health')}
          accessory="chevron"
          onClick={() => importRef.current?.click()}
        />
        <Row
          icon="upload"
          iconTint="var(--blue)"
          title={t('Restore Backup (JSON)')}
          subtitle={t('Load a previously saved backup file')}
          accessory="chevron"
          onClick={() => fileRef.current?.click()}
        />
        <Row
          icon="download"
          iconTint="var(--blue)"
          title={t('Export Full Backup (JSON)')}
          subtitle={t('Save all routines, workouts and weigh-ins')}
          accessory="chevron"
          onClick={doExport}
        />
        <Row
          icon="trash"
          iconTint="var(--red)"
          title={t('Reset All Data')}
          subtitle={t('Permanently clear local data')}
          danger
          onClick={() => confirmSheet({
            title: t('Reset all data?'),
            message: t('Deletes your plan, workouts and body weight history on this device. This cannot be undone.'),
            confirmText: t('Delete Everything'),
            danger: true,
            onConfirm: () => {
              replaceState(JSON.parse(JSON.stringify(DEF)), true)
              nav('/home')
              toast(t('All data reset'))
            }
          })}
        />
      </Section>

      {/* Hidden file inputs */}
      <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={doImport} />
      <input
        ref={importRef}
        type="file"
        accept=".csv,.xml,text/csv,text/xml"
        style={{ display: 'none' }}
        onChange={ev => {
          const f = ev.target.files[0]
          if (f) importFromApp(f)
          ev.target.value = ''
        }}
      />

      {/* Account Session Actions (Signed-in Users) */}
      {user && (
        <Section title={t('Account Actions')}>
          <Row
            icon="signOut"
            iconTint="var(--red)"
            title={t('Sign Out')}
            danger
            onClick={() => confirmSheet({
              title: t('Sign out?'),
              message: t('Your data is synced to your profile first, then cleared from this device.'),
              confirmText: t('Sign out'),
              danger: true,
              onConfirm: () => { signOut(); nav('/home') }
            })}
          />
          <Row
            icon="shield"
            iconTint="var(--red)"
            title={t('Sign Out Everywhere')}
            subtitle={t('Terminates active sessions on all your devices')}
            danger
            onClick={signOutEverywhere}
          />
        </Section>
      )}

      {/* Demo Reset */}
      {DEMO && (
        <Section title={t('Demo Options')}>
          <Row
            icon="reset"
            iconTint="var(--blue)"
            title={t('Reset Demo Dataset')}
            subtitle={t('Revert plan, history and weights to starting demo data')}
            accessory="chevron"
            onClick={() => confirmSheet({
              title: t('Reset demo data?'),
              message: t('Puts the example plan, workouts and weigh-ins back the way they started.'),
              confirmText: t('Reset'),
              onConfirm: () => { resetDemo(); nav('/home'); toast(t('Demo data reset')) }
            })}
          />
        </Section>
      )}

      {/* App Footer & Open Source Info */}
      <div className="settings-footer">
        <div className="settings-footer-badge">
          <Icon name="shield" />
          <span>pumpd · v1.2.4 · AGPL v3</span>
        </div>
        <div className="settings-footer-links">
          <a href="https://github.com/DuarteSantos8/pumpd" target="_blank" rel="noopener">GitHub Repository</a>
          <span>·</span>
          <span>Self-Hosted & Privacy-First</span>
        </div>
      </div>
    </div>
  )
}

/* ---------- Effort Help Table Sheet ---------- */
const EFFORT_ROWS = [
  ['0', '10', 'Nothing left — went to failure'],
  ['1', '9', 'One more rep in the tank'],
  ['2', '8', 'Two more reps'],
  ['3', '7', 'Three more reps'],
  ['4+', '≤6', 'Easy — warm-up territory'],
]
const EFFORT_TYPICAL = 2

function effortHelpSheet() {
  useUI.getState().openSheet(close => <>
    <h3>{t('Effort per set')}</h3>
    <div className="muted small" style={{ lineHeight: 1.5 }}>
      {t('How hard a set was, logged next to weight and reps. Two scales for the same judgement, counted from opposite ends.')}
    </div>
    <div className="efftbl">
      <div className="r hd"><span className="n">{t('RIR')}</span><span className="n">{t('RPE')}</span><span className="f">{t('How it felt')}</span></div>
      {EFFORT_ROWS.map(([rir, rpe, feel], i) => (
        <div key={rir} className={'r' + (i === EFFORT_TYPICAL ? ' on' : '')}>
          <span className="n">{rir}</span><span className="n">{rpe}</span><span className="f">{t(feel)}</span>
        </div>
      ))}
    </div>
    <div className="dim small" style={{ lineHeight: 1.5, display: 'grid', gap: 8 }}>
      <div>{t('RIR counts the reps you left; RPE reads the same effort off a 10-point scale — so RPE ≈ 10 − RIR. Pick the one you already think in.')}</div>
      <div>{t('The highlighted row is where most working sets land. Sets you have already logged keep their own scale, and nothing else reads the value — progression and estimated 1RM are unaffected.')}</div>
    </div>
    <div style={{ height: 8 }} />
  </>)
}

function NotificationsCard({ S, update, toast }) {
  if (MOBILE) return <MobileReminderCard S={S} update={update} toast={toast} />
  return <PushCard S={S} update={update} toast={toast} />
}

function MobileReminderCard({ S, update, toast }) {
  const setReminder = patch => update(s => { s.reminder = { ...(s.reminder || DEF.reminder), ...patch, tz: localTZ() } })
  const toggle = async () => {
    const on = !S.reminder?.on
    if (on) {
      const ok = await syncReminder({ ...S, reminder: { ...(S.reminder || DEF.reminder), on: true } }, true)
      if (!ok) { toast(t('Could not change notification settings')); return }
    }
    setReminder({ on })
  }
  return (
    <Section
      title={t('Notifications')}
      footer={S.reminder?.on ? t('Reminds you at this time on days that have a routine planned.') : null}
    >
      <Row icon="calendar" iconTint="var(--orange)" title={t('Workout Day Reminder')}>
        <Switch checked={!!S.reminder?.on} onChange={toggle} />
      </Row>
      {S.reminder?.on && (
        <Row icon="clock" iconTint="var(--purple)" title={t('Reminder Time')}>
          <input
            type="time"
            className="timef"
            value={S.reminder?.time || DEF.reminder.time}
            onChange={e => setReminder({ time: e.target.value })}
          />
        </Row>
      )}
    </Section>
  )
}

function PushCard({ S, update, toast }) {
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const supported = pushSupported()

  useEffect(() => {
    if (!supported) return
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setOn(!!sub))
      .catch(() => {})
  }, [supported])

  const toggle = async v => {
    setBusy(true)
    try {
      if (!v) { await disablePush(); setOn(false); toast(t('Notifications off')) }
      else { await enablePush(); setOn(true); toast(t('Notifications on')) }
    } catch (e) { toast(e.message || t('Could not change notification settings')) }
    setBusy(false)
  }
  const test = async () => {
    try { await sendTestPush(); toast(t('Test sent — should arrive any second')) }
    catch (e) { toast(e.message || t('Test failed')) }
  }

  if (!supported) return (
    <Section title={t('Notifications')}>
      <Row icon="bellSlash" iconTint="var(--grey)" title={t('Not supported in this browser.')} />
    </Section>
  )

  return (
    <>
      <Section
        title={t('Notifications')}
        footer={on && S.reminder?.on
          ? t("Sent only on days you have a routine planned and haven't logged a workout yet.")
          : null}
      >
        <Row icon="bell" iconTint="var(--red)" title={t('Push Notifications')} subtitle={t('Rest-timer alerts, even if pumpd is in background')}>
          <Switch checked={on} disabled={busy} onChange={toggle} />
        </Row>
        {on && (
          <Row icon="calendar" iconTint="var(--orange)" title={t('Workout Day Reminder')}>
            <Switch checked={!!S.reminder?.on} onChange={() => update(s => { s.reminder = { ...(s.reminder || DEF.reminder), on: !s.reminder?.on, tz: localTZ() } })} />
          </Row>
        )}
        {on && S.reminder?.on && (
          <Row icon="clock" iconTint="var(--purple)" title={t('Reminder Time')}>
            <input
              type="time"
              className="timef"
              value={S.reminder?.time || DEF.reminder.time}
              onChange={e => update(s => { s.reminder = { ...(s.reminder || DEF.reminder), time: e.target.value, tz: localTZ() } })}
            />
          </Row>
        )}
      </Section>
      {on && (
        <div style={{ marginTop: -12, marginBottom: 22 }}>
          <Button size="sm" variant="tinted" icon="bell" onClick={test}>
            {t('Send Test Notification')}
          </Button>
        </div>
      )}
    </>
  )
}

/* ---------- Passkey Register Sheet ---------- */
function RegisterInline({ close, setUser, pushState, pullState, toast }) {
  const nameRef = useRef(null)
  const [code, setCode] = useState('')
  const [inviteOnly, setInviteOnly] = useState(false)
  useEffect(() => { api('/api/config').then(c => setInviteOnly(!!c.invite_only)).catch(() => {}) }, [])

  const go = async () => {
    const n = (nameRef.current?.value || '').trim()
    if (!n) { toast(t('Enter a name')); return }
    if (inviteOnly && !code.trim()) { toast(t('An invite code is required')); return }
    try {
      const u = await passkeyRegister(n, code.trim())
      setUser(u)
      close()
      if (hasData(useStore.getState().S)) {
        await pushState()
        toast(t('Profile created — data moved into it'))
      } else {
        await pullState()
        toast(t('Welcome, {0}', u.name))
      }
    } catch (e) {
      if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') {
        toast(e.message || t('Registration failed'))
      }
    }
  }

  return (
    <>
      <div className="sheet-hdr">
        <h3 className="sheet-title">{t('Create Your Profile')}</h3>
      </div>
      <div className="muted small" style={{ marginBottom: 14 }}>
        {t('Pick a username, then authenticate securely with your device passkey.')}
      </div>
      <TextField ref={nameRef} placeholder={t('Your Name / Handle')} maxLength={40} />
      {inviteOnly && (
        <>
          <div style={{ height: 10 }} />
          <input
            className="input"
            placeholder={t('Invite Code')}
            maxLength={40}
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            style={{ letterSpacing: '.14em', fontWeight: 600, textAlign: 'center' }}
          />
          <div className="dim small" style={{ marginTop: 6 }}>
            {t('This app instance is invite-only — enter your invite code.')}
          </div>
        </>
      )}
      <div style={{ height: 14 }} />
      <Button variant="primary" onClick={go}>{t('Register with Passkey')}</Button>
    </>
  )
}
