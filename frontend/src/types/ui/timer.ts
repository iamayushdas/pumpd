export interface Timer {
  left: number;
  total: number;
  endsAt: number;
}

export interface WorkTimer extends Timer {
  label: string;
}