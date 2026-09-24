export type HealthMetricType = 'steps' | 'distance' | 'calories' | 'heart_rate' | 'sleep' | 'active_energy';

export interface HealthMetric {
  type: HealthMetricType;
  value: number;
  unit: string;
  date: string;
  timestamp?: number;
  source?: string;
}