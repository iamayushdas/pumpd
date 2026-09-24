import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom'
import { useStore } from './store/useStore'
import { useUI } from './store/useUI'
import { bindUI } from './components/ui'
import { ACCENTS } from './lib/format'
import { setLang, useLang } from './lib/i18n'
import { setNav } from './lib/nav'
import { useWakeLock } from './lib/wakelock'
import { startFlow } from './sheets'
import SplashScreen from './components/SplashScreen'
import Icon from './components/Icon'
import TabBar from './components/TabBar'
import ErrorBoundary from './components/ErrorBoundary'
import Modals from './components/Modals'
import Toast from './components/Toast'
import RestTimer from './components/RestTimer'
import Login from './views/Login'
import Home from './views/Home'
import Plan from './views/Plan'
import RoutineEdit from './views/RoutineEdit'
import Workout from './views/Workout'
import Stats from './views/Stats'
import History from './views/History'
import Library from './views/Library'
import Settings from './views/Settings'
import Admin from './views/Admin'
import Feed from './views/Feed'
import NewPost from './views/NewPost'
import UserProfile from './views/UserProfile'
import Discover from './views/Discover'
import HandleSetup from './views/HandleSetup'
import Health from './views/Health'

bindUI(useUI)   // lets the shared controls open sheets without importing the store at module scope

function ProfileWrapper() {
  const { handle } = useParams()
  return <UserProfile handle={handle} />
}

function applyPrefs(theme, accent) {
  const de = document.documentElement
  de.dataset.theme = theme === 'light' ? 'light' : 'dark'
  de.dataset.accent = ACCENTS[accent] ? accent : 'lime'
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.content = de.dataset.theme === 'light' ? '#f2f2f7' : '#000000'
}

function Shell() {
  const navigate = useNavigate()
  const loc = useLocation()
  const { S, user, ready } = useStore()
  const isGuest = useStore(s => s.isGuest())
  const langV = useLang()   // re-renders the whole shell when the language (pack) changes
  useEffect(() => { setNav(navigate) }, [navigate])
  useEffect(() => { applyPrefs(S.theme, S.accent) }, [S.theme, S.accent])
  useEffect(() => { setLang(S.lang || 'en') }, [S.lang])
  useEffect(() => { document.documentElement.lang = S.lang || 'en' }, [langV, S.lang])
  // every tab/route change starts at the top of the page
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])
  // bound to the workout, not to the route — checking Stats mid-session keeps the screen on
  useWakeLock(!!S.active && S.keepAwake !== false)

  const authed = user || isGuest
  if (!ready && !authed) return (
    <div id="app" style={{ background: 'var(--bg, #000000)' }} />
  )

  return (
    <>
      {/* keyed on the route: a view that throws is contained, and switching tabs
          re-mounts the boundary, so the tab bar is always a way out */}
      <div id="app" className="vfade" key={loc.pathname}>
        <ErrorBoundary>
          {!authed ? <Login /> : (
            <Routes>
              <Route path="/home" element={<Home />} />
              <Route path="/plan" element={<Plan />} />
              <Route path="/plan/r/:id" element={<RoutineEdit />} />
              <Route path="/workout" element={<Workout />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/history" element={<History />} />
              <Route path="/library" element={<Library />} />
              <Route path="/health" element={<Health />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin" element={user?.admin ? <Admin /> : <Navigate to="/home" replace />} />
              <Route path="/feed" element={<Feed />} />
              <Route path="/new-post" element={<NewPost />} />
              <Route path="/profile/:handle" element={<ProfileWrapper />} />
              <Route path="/discover" element={<Discover />} />
              <Route path="/handle-setup" element={<HandleSetup />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          )}
        </ErrorBoundary>
      </div>
      <TabBar onStart={startFlow} />
      <RestTimer />
      <Modals />
      <Toast />
    </>
  )
}

export default function App() {
  const boot = useStore(s => s.boot)
  useEffect(() => { boot() }, [boot])
  return (
    <HashRouter>
      <SplashScreen />
      <Shell />
    </HashRouter>
  )
}
