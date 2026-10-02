import type { PersonaRole } from '../types/store/user'
import { t } from '../lib/i18n'
import Icon from './Icon'

export const PERSONA_OPTIONS: Array<{ value: Exclude<PersonaRole, 'admin'>; icon: string; title: string; description: string }> = [
  {
    value: 'member',
    icon: 'person',
    title: 'Gym Member',
    description: 'Track your workouts and progress.'
  },
  {
    value: 'trainer',
    icon: 'figureStrength',
    title: 'Gym Trainer',
    description: 'Coach clients and plan training.'
  },
  {
    value: 'owner',
    icon: 'wrench',
    title: 'Gym Owner',
    description: 'Manage your gym and its members.'
  }
]

export function normalizePersona(role?: string, admin = false): PersonaRole {
  if (role === 'trainer' || role === 'owner' || role === 'member' || role === 'admin') return role
  return admin ? 'admin' : 'member'
}

export function personaLabel(role?: string, admin = false): string {
  const normalized = normalizePersona(role, admin)
  if (normalized === 'admin') return t('Admin')
  const option = PERSONA_OPTIONS.find(option => option.value === normalized)
  return option ? t(option.title) : t('Gym Member')
}

interface PersonaPickerProps {
  value: Exclude<PersonaRole, 'admin'>
  onChange: (role: Exclude<PersonaRole, 'admin'>) => void
}

export default function PersonaPicker({ value, onChange }: PersonaPickerProps) {
  return (
    <fieldset className="persona-picker">
      <legend>{t('I AM A')}</legend>
      <div className="persona-options" role="radiogroup" aria-label={t('Choose your persona')}>
        {PERSONA_OPTIONS.map(option => (
          <button
            key={option.value}
            type="button"
            className={'persona-option' + (value === option.value ? ' active' : '')}
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
          >
            <span className="persona-option-icon"><Icon name={option.icon} /></span>
            <span className="persona-option-copy">
              <strong>{t(option.title)}</strong>
              <small>{t(option.description)}</small>
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}
