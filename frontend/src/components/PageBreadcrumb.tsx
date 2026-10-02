import { useNavigate } from 'react-router-dom'
import Icon from './Icon'

interface BreadcrumbProps {
  items: Array<{
    label: string
    icon?: string
    path?: string
  }>
  scope?: 'system' | 'gym' | 'personal'
}

/**
 * Breadcrumb component with scope indicator
 */
export default function PageBreadcrumb({ items, scope }: BreadcrumbProps) {
  const nav = useNavigate()

  const scopeConfig = {
    system: { icon: 'shield', label: 'System-wide', color: 'var(--red)' },
    gym: { icon: 'house', label: 'Gym-specific', color: 'var(--blue)' },
    personal: { icon: 'person', label: 'Personal', color: 'var(--purple)' },
  }

  const scopeInfo = scope ? scopeConfig[scope] : null

  return (
    <div className="page-breadcrumb">
      {scopeInfo && (
        <div className="page-scope-badge" style={{ '--scope-color': scopeInfo.color } as React.CSSProperties}>
          <Icon name={scopeInfo.icon} />
          <span>{scopeInfo.label}</span>
        </div>
      )}
      <nav className="breadcrumb-nav" aria-label="Breadcrumb">
        {items.map((item, i) => (
          <span key={i} className="breadcrumb-item">
            {i > 0 && <Icon name="chevronRight" className="breadcrumb-sep" />}
            {item.path ? (
              <button
                type="button"
                className="breadcrumb-link"
                onClick={() => nav(item.path!)}
              >
                {item.icon && <Icon name={item.icon} />}
                <span>{item.label}</span>
              </button>
            ) : (
              <span className="breadcrumb-current">
                {item.icon && <Icon name={item.icon} />}
                <span>{item.label}</span>
              </span>
            )}
          </span>
        ))}
      </nav>
    </div>
  )
}
