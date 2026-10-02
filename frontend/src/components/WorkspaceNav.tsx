import { useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '../store/useStore'
import Icon from './Icon'

/**
 * Workspace navigation component for admins to quickly switch between
 * System Admin and Gym Operations workspaces
 */
export default function WorkspaceNav() {
  const nav = useNavigate()
  const loc = useLocation()
  const user = useStore(s => s.user)

  if (!user?.admin) return null

  const isAdmin = loc.pathname === '/admin'
  const isManagement = loc.pathname === '/management'
  
  if (!isAdmin && !isManagement) return null

  return (
    <div className="workspace-nav">
      <button
        type="button"
        className={`workspace-nav-btn ${isAdmin ? 'active' : ''}`}
        onClick={() => nav('/admin')}
        aria-label="System Admin"
        aria-current={isAdmin ? 'page' : undefined}
      >
        <Icon name="shield" />
        <span>System Admin</span>
      </button>
      <button
        type="button"
        className={`workspace-nav-btn ${isManagement ? 'active' : ''}`}
        onClick={() => nav('/management')}
        aria-label="Gym Operations"
        aria-current={isManagement ? 'page' : undefined}
      >
        <Icon name="wrench" />
        <span>Gym Operations</span>
      </button>
    </div>
  )
}
