import type { User, Reminder, BodyweightEntry } from './user'
import type { Exercise } from '../models/exercise'
import type { Routine } from '../models/routine'
import type { Workout } from '../models/workout'

export interface GymState {
  unit: string;
  restSec: number;
  sound: boolean;
  keepAwake: boolean;
  lang: string;
  theme: string;
  accent: string;
  body: string;
  targetW: number | null;
  bodyweight: BodyweightEntry[];
  routines: Routine[];
  week: Record<number, string | null>;
  dayPlan: Record<string, string>;
  exWeights: Record<string, any>;
  workouts: Workout[];
  active: any | null;
  customEx: Exercise[];
  gifSize: string;
  reminder: Reminder;
  effort: string | null;
  _ts?: number;
}