export interface User {
  id: string;
  name: string;
  admin?: boolean;
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