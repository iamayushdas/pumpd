import type { User, Reminder, BodyweightEntry } from './user'
import type { GymState } from './gymState'
import type { Exercise, Routine, Workout } from '../models'

export type { User, Reminder, BodyweightEntry } from './user'
export type { GymState } from './gymState'
export type { Exercise, Routine, Workout } from '../models'

// Store interface is the Zustand store shape
export interface Store {
  S: GymState
  user: User | null
  ready: boolean
  update(mut: (s: GymState) => void, push?: boolean): void
  replaceState(S: GymState, push?: boolean): void
  isGuest(): boolean
  setGuest(v: boolean): void
  setUser(u: User | null): void
  pushState(): Promise<void>
  pullState(): Promise<void>
  signOut(): Promise<void>
  signOutAll(): Promise<void>
  resetDemo(): Promise<void>
  boot(): Promise<void>
}

// Utility function
export const hasData = (st: GymState): boolean => !!((st.workouts || []).length || (st.routines || []).length || (st.bodyweight || []).length)