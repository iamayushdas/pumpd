export type PersonaRole = 'member' | 'trainer' | 'owner' | 'admin';

export interface User {
  id: string;
  name: string;
  role?: PersonaRole;
  admin?: boolean;
  gymId?: string | null;
  trainerId?: string | null;
}

export interface Reminder {
  on: boolean;
  time: string;
  tz: string | null;
}

export interface BodyweightEntry {
  d: string;
  w: number;
}