export interface HealthSyncResult {
  synced: number;
  syncTime: string;
}

export interface HealthSyncStatus {
  platform: 'ios' | 'android' | 'web';
  isAuthorized: boolean;
  lastSyncTime?: string;
  metricsCount?: number;
  error?: string;
}