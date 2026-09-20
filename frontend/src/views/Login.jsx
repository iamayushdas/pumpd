import { useStore, hasData } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { webauthnOK, passkeyLogin, passkeyRegister, adminLogin, requestAccess, api, BIO, VAULT } from '../lib/api.js'
import { t } from '../lib/i18n.js'
import { DEMO, REPO } from '../lib/demo.js'
import { useState, useRef, useEffect } from 'react'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

function PasskeyInfoSheet({ close }) {
  return (
    <>
      <h3 style={{ fontSize: 20, fontWeight: 700 }}>{t('Why Passkeys?')}</h3>
      <div className="card small muted" style={{ textAlign: 'left', lineHeight: 1.55, marginTop: 14, fontSize: 14 }}>
        <p style={{ marginBottom: 12 }}>
          <strong style={{ color: 'var(--label)', display: 'block', marginBottom: 2 }}>{t('Passwordless & Phishing-Proof:')}</strong>
          {t('Passkeys use biometric cryptography backed by your hardware ({0}). No passwords to remember or leak.', BIO)}
        </p>
        <p>
          <strong style={{ color: 'var(--label)', display: 'block', marginBottom: 2 }}>{t('Private & Self-Owned:')}</strong>
          {t('Your private key stays in your device ({0}). Workout logs, weights, and plans sync securely with your database.', VAULT)}
        </p>
      </div>
      <div style={{ height: 16 }} />
      <Button variant="primary" onClick={close} style={{ width: '100%', height: 46, fontSize: 15, fontWeight: 600 }}>
        {t('Got it')}
      </Button>
    </>
  )
}

export default function Login() {
  const { setUser, pushState, pullState, setGuest } = useStore()
  const [tab, setTab] = useState('login') // 'login' | 'register' | 'request'
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [requestSubmitted, setRequestSubmitted] = useState(false)
  const [inviteOnly, setInviteOnly] = useState(false)
  const [loading, setLoading] = useState(false)
  const [serverOk, setServerOk] = useState(true)
  const [isAutoFilled, setIsAutoFilled] = useState(false)
  const nameRef = useRef(null)

  useEffect(() => {
    // Check for invite link parameters in URL
    const params = new URLSearchParams(window.location.search)
    const inviteCode = params.get('invite')
    const inviteName = params.get('name')
    
    if (inviteCode && inviteName) {
      setCode(inviteCode)
      setName(inviteName)
      setTab('register')
      setIsAutoFilled(true)
      // Clean up URL to avoid showing raw parameters
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  useEffect(() => {
    api('/api/config')
      .then(c => {
        setInviteOnly(!!c.invite_only)
        setServerOk(true)
      })
      .catch(() => setServerOk(false))
  }, [])

  useEffect(() => {
    if (tab === 'register') {
      setTimeout(() => nameRef.current?.focus(), 150)
    }
  }, [tab])

  useEffect(() => {
    // Auto-trigger registration when form is auto-filled from URL parameters
    if (isAutoFilled && name && code && !loading) {
      const triggerAutoRegister = async () => {
        setLoading(true)
        try {
          const u = await passkeyRegister(name, code)
          setUser(u)
          if (hasData(useStore.getState().S)) {
            await pushState()
            useUI.getState().toast(t('Profile created — data from this device moved into it'))
          } else {
            await pullState()
            useUI.getState().toast(t('Welcome, {0}', u.name))
          }
        } catch (e) {
          if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') {
            useUI.getState().toast(e.message || t('Registration failed'))
          }
        } finally {
          setLoading(false)
          setIsAutoFilled(false)
        }
      }
      
      // Give a small delay to ensure UI is fully mounted
      const timer = setTimeout(triggerAutoRegister, 500)
      return () => clearTimeout(timer)
    }
  }, [isAutoFilled, name, code, loading])

  const handleSignIn = async () => {
    if (loading) return
    setLoading(true)
    try {
      const u = await passkeyLogin()
      setUser(u)
      await pullState()
      useUI.getState().toast(t('Welcome back, {0}', u.name))
    } catch (e) {
      if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') {
        useUI.getState().toast(e.message || t('Sign-in failed'))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e?.preventDefault()
    if (loading) return
    const n = name.trim()
    if (!n) {
      useUI.getState().toast(t('Enter a name'))
      nameRef.current?.focus()
      return
    }

    setLoading(true)

    // Secret Admin Login: If profile name or invite code matches the admin pass, authenticate as Admin
    try {
      const adminUser = await adminLogin(n).catch(async () => {
        if (code.trim()) return await adminLogin(code.trim())
        throw new Error('Not admin')
      })
      if (adminUser) {
        setUser(adminUser)
        await pullState()
        useUI.getState().toast(t('Welcome back, Admin'))
        setLoading(false)
        return
      }
    } catch {
      // Not admin code, continue with standard registration
    }

    if (inviteOnly && !code.trim()) {
      useUI.getState().toast(t('An invite code is required'))
      setLoading(false)
      return
    }

    try {
      const u = await passkeyRegister(n, code.trim())
      setUser(u)
      if (hasData(useStore.getState().S)) {
        await pushState()
        useUI.getState().toast(t('Profile created — data from this device moved into it'))
      } else {
        await pullState()
        useUI.getState().toast(t('Welcome, {0}', u.name))
      }
    } catch (e) {
      if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') {
        useUI.getState().toast(e.message || t('Registration failed'))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRequestAccess = async (e) => {
    e?.preventDefault()
    if (loading) return
    const n = name.trim()
    const em = email.trim()
    
    if (!n || !em) {
      useUI.getState().toast(t('Name and email are required'))
      return
    }

    setLoading(true)
    try {
      await requestAccess(em, n, message.trim())
      setRequestSubmitted(true)
      useUI.getState().toast(t('Access request submitted'))
    } catch (e) {
      useUI.getState().toast(e.message || t('Request failed'))
    } finally {
      setLoading(false)
    }
  }

  // Demo build: no backend to sign in against
  if (DEMO) {
    return (
      <div className="login-screen">
        <div className="login-ambient" />
        <div className="login-content">
          <div className="login-brand-badge">
            <Icon name="sparkles" /> {t('Live Demo')}
          </div>

          <div>
            <span className="login-brand-title">pumpd<span className="login-brand-dot">.</span></span>
          </div>

          <p className="login-subtitle">{t('Live demo — everything stays in this browser.')}</p>

          <div className="login-card">
            <Button
              variant="primary"
              icon="sparkles"
              onClick={() => setGuest(true)}
              style={{ width: '100%', height: 48, fontSize: 16, fontWeight: 600 }}
            >
              {t('Start the demo')}
            </Button>
            <p className="dim small" style={{ marginTop: 14, lineHeight: 1.5, fontSize: 13.5 }}>
              {t('This demo runs entirely in your browser on example data — nothing is sent anywhere. Passkey sign-in and sync across your devices come with the pumpd server, which you get by self-hosting it.')}
            </p>
          </div>

          <div className="dim small" style={{ marginTop: 14, fontSize: 13.5 }}>
            <a href={REPO} target="_blank" rel="noopener">{t('Self-host it in a minute →')}</a>
          </div>
        </div>
      </div>
    )
  }

  const supportsPasskeys = webauthnOK()

  return (
    <div className="login-screen">
      <div className="login-ambient" />

      <div className="login-content">
        {/* Top Badge */}
        <div className="login-brand-badge">
          <Icon name="shield" /> {t('Self-Hosted & Private')}
        </div>

        {/* Animated Brand Title */}
        <div>
          <span className="login-brand-title">
            pumpd<span className="login-brand-dot">.</span>
          </span>
        </div>

        <p className="login-subtitle">
          {t('Your workouts. Your weights. Your profile.')}
        </p>

        {/* Main Card */}
        <div className="login-card">
          {/* Segmented Tab Switcher */}
          <div className="login-tab-seg">
            <button
              type="button"
              className={`login-tab-btn ${tab === 'login' ? 'active' : ''}`}
              onClick={() => setTab('login')}
            >
              <Icon name="person" />
              <span>{t('Sign In')}</span>
            </button>
            <button
              type="button"
              className={`login-tab-btn ${tab === 'register' ? 'active' : ''}`}
              onClick={() => setTab('register')}
            >
              <Icon name="sparkles" />
              <span>{inviteOnly ? t('Have Code') : t('New Profile')}</span>
            </button>
            {inviteOnly && (
              <button
                type="button"
                className={`login-tab-btn ${tab === 'request' ? 'active' : ''}`}
                onClick={() => setTab('request')}
              >
                <Icon name="mail" />
                <span>{t('Request Access')}</span>
              </button>
            )}
          </div>

          {supportsPasskeys ? (
            tab === 'login' ? (
              /* Sign In Tab */
              <div>
                <Button
                  variant="primary"
                  icon={loading ? undefined : 'person'}
                  disabled={loading}
                  onClick={handleSignIn}
                  style={{ width: '100%', height: 48, fontSize: 16, fontWeight: 600 }}
                >
                  {loading ? (
                    <span className="row" style={{ gap: 8, justifyContent: 'center' }}>
                      <span className="login-spinner" />
                      {t('Verifying...')}
                    </span>
                  ) : (
                    t('Sign in with passkey')
                  )}
                </Button>

                <div style={{ height: 10 }} />

                <Button
                  variant="ghost"
                  className="dim"
                  onClick={() => setGuest(true)}
                  style={{ width: '100%', height: 40, fontSize: 14.5 }}
                >
                  {t('Continue as Guest')}
                </Button>
              </div>
            ) : tab === 'register' ? (
              /* Create Profile Tab */
              <form onSubmit={handleRegister}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--label-2)', marginBottom: 6, letterSpacing: '.03em' }}>
                    {t('PROFILE NAME')}
                  </label>
                  <input
                    ref={nameRef}
                    className="input field"
                    placeholder={t('e.g. Alex')}
                    maxLength={40}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    style={{ width: '100%', borderRadius: 10, padding: '10px 12px', fontSize: 15 }}
                  />
                </div>

                {inviteOnly && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--label-2)', marginBottom: 6, letterSpacing: '.03em' }}>
                      {t('INVITE CODE')}
                    </label>
                    <input
                      className="input field"
                      placeholder={t('ABCD-1234')}
                      maxLength={40}
                      value={code}
                      onChange={e => setCode(e.target.value.toUpperCase())}
                      style={{ width: '100%', letterSpacing: '.14em', fontWeight: 600, textAlign: 'center', borderRadius: 10, padding: '10px 12px', fontSize: 15 }}
                    />
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  icon={loading ? undefined : 'sparkles'}
                  disabled={loading}
                  style={{ width: '100%', height: 48, fontSize: 16, fontWeight: 600, marginTop: 4 }}
                >
                  {loading ? (
                    <span className="row" style={{ gap: 8, justifyContent: 'center' }}>
                      <span className="login-spinner" />
                      {t('Creating Passkey...')}
                    </span>
                  ) : (
                    t('Create Profile')
                  )}
                </Button>
              </form>
            ) : (
              /* Request Access Tab */
              <form onSubmit={handleRequestAccess}>
                {requestSubmitted ? (
                  <div>
                    <div className="card small" style={{ textAlign: 'center', marginBottom: 16, padding: 20 }}>
                      <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
                      <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{t('Request Submitted')}</p>
                      <p className="dim" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                        {t('You will receive an invite code at {0} once approved.', email)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => { setRequestSubmitted(false); setTab('login'); }}
                      style={{ width: '100%', height: 40, fontSize: 14.5 }}
                    >
                      {t('Back to Sign In')}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--label-2)', marginBottom: 6, letterSpacing: '.03em' }}>
                        {t('NAME')}
                      </label>
                      <input
                        className="input field"
                        placeholder={t('Your name')}
                        maxLength={40}
                        value={name}
                        onChange={e => setName(e.target.value)}
                        style={{ width: '100%', borderRadius: 10, padding: '10px 12px', fontSize: 15 }}
                      />
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--label-2)', marginBottom: 6, letterSpacing: '.03em' }}>
                        {t('EMAIL')}
                      </label>
                      <input
                        type="email"
                        className="input field"
                        placeholder={t('you@example.com')}
                        maxLength={100}
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        style={{ width: '100%', borderRadius: 10, padding: '10px 12px', fontSize: 15 }}
                      />
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--label-2)', marginBottom: 6, letterSpacing: '.03em' }}>
                        {t('MESSAGE (OPTIONAL)')}
                      </label>
                      <textarea
                        className="input field"
                        placeholder={t('Why would you like to join?')}
                        maxLength={500}
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        rows={3}
                        style={{ width: '100%', borderRadius: 10, padding: '10px 12px', fontSize: 15, resize: 'vertical' }}
                      />
                    </div>

                    <Button
                      type="submit"
                      variant="primary"
                      icon={loading ? undefined : 'mail'}
                      disabled={loading}
                      style={{ width: '100%', height: 48, fontSize: 16, fontWeight: 600, marginTop: 4 }}
                    >
                      {loading ? (
                        <span className="row" style={{ gap: 8, justifyContent: 'center' }}>
                          <span className="login-spinner" />
                          {t('Submitting...')}
                        </span>
                      ) : (
                        t('Request Access')
                      )}
                    </Button>
                  </>
                )}
              </form>
            )
          ) : (
            /* Passkeys Not Supported */
            <div>
              <div className="card small muted" style={{ textAlign: 'left', marginBottom: 12, fontSize: 13.5, lineHeight: 1.45 }}>
                {t("This browser doesn't support passkeys — you can still use pumpd locally on this device.")}
              </div>
              <Button
                variant="primary"
                onClick={() => setGuest(true)}
                style={{ width: '100%', height: 46, fontSize: 15 }}
              >
                {t('Continue without account')}
              </Button>
            </div>
          )}
        </div>

        {/* Feature Highlights Grid */}
        <div className="login-features">
          <div className="login-feat-item">
            <span className="login-feat-icon"><Icon name="shield" /></span>
            <span>{t('Zero Passwords')}</span>
          </div>
          <div className="login-feat-item">
            <span className="login-feat-icon"><Icon name="figureStrength" /></span>
            <span>{t('1,324+ Exercises')}</span>
          </div>
          <div className="login-feat-item">
            <span className="login-feat-icon"><Icon name="chartLine" /></span>
            <span>{t('Progression & 1RM')}</span>
          </div>
          <div className="login-feat-item">
            <span className="login-feat-icon"><Icon name="bolt" /></span>
            <span>{t('Atlas Cloud Sync')}</span>
          </div>
        </div>

        {/* Info Sheet Trigger */}
        <div style={{ marginTop: 14 }}>
          <button
            type="button"
            className="btn plain xs dim"
            onClick={() => useUI.getState().openSheet(close => <PasskeyInfoSheet close={close} />)}
            style={{ margin: '0 auto', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}
          >
            <Icon name="info" />
            <span>{t('Why passkeys?')}</span>
          </button>
        </div>

        {/* Database & Server Status Pill */}
        <div className="login-status-bar">
          <span className="login-status-dot" style={{ background: serverOk ? 'var(--green)' : 'var(--orange)' }} />
          <span>{serverOk ? t('MongoDB Atlas & Backend Online') : t('Offline Mode Active')}</span>
        </div>
      </div>
    </div>
  )
}
