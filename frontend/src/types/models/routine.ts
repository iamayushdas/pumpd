import type { Exercise } from './exercise'

export interface Routine {
  id: string;
  name: string;
  emoji?: string;
  ex?: Exercise[];
  [key: string]: any;
}