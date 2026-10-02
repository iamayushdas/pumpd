import { describe, expect, it } from 'vitest'
import { normalizePersona, personaLabel } from './PersonaPicker'

describe('persona roles', () => {
  it('preserves the supported member, trainer, and owner roles', () => {
    expect(normalizePersona('member')).toBe('member')
    expect(normalizePersona('trainer')).toBe('trainer')
    expect(normalizePersona('owner')).toBe('owner')
  })

  it('keeps admin as a separate privileged persona and defaults unknown roles to member', () => {
    expect(normalizePersona('admin')).toBe('admin')
    expect(normalizePersona('not-a-role')).toBe('member')
    expect(normalizePersona(undefined, true)).toBe('admin')
  })

  it('labels legacy users without a role as members unless they are admins', () => {
    expect(personaLabel()).toBe('Gym Member')
    expect(personaLabel(undefined, true)).toBe('Admin')
    expect(personaLabel('trainer')).toBe('Gym Trainer')
  })
})
