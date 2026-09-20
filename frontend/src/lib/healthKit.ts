import { Capacitor } from '@capacitor/core';

/**
 * Health data types supported by Apple HealthKit and Google Fit
 */
export type HealthMetricType = 'steps' | 'distance' | 'calories' | 'heart_rate' | 'sleep' | 'active_energy';

export interface HealthMetric {
  type: HealthMetricType;
  value: number;
  unit: string;
  date: string; // ISO date (YYYY-MM-DD)
  timestamp?: number;
  source?: string;
}

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

/**
 * Check if health metrics APIs are available
 */
export function isHealthKitAvailable(): boolean {
  if (Capacitor.getPlatform() !== 'ios') return false;
  return typeof (window as any).HealthKit !== 'undefined';
}

export function isGoogleFitAvailable(): boolean {
  if (Capacitor.getPlatform() !== 'android') return false;
  return typeof (window as any).GoogleFit !== 'undefined';
}

/**
 * Request permissions for health data access
 */
export async function requestHealthPermissions(): Promise<boolean> {
  const platform = Capacitor.getPlatform();
  
  try {
    if (platform === 'ios' && isHealthKitAvailable()) {
      const result = await (window as any).HealthKit.requestAuthorization({
        permissions: [
          'HKQuantityTypeIdentifierStepCount',
          'HKQuantityTypeIdentifierDistanceWalkingRunning',
          'HKQuantityTypeIdentifierActiveEnergyBurned',
          'HKQuantityTypeIdentifierHeartRate',
          'HKCategoryTypeIdentifierSleepAnalysis'
        ]
      });
      return result?.authorized === true;
    } else if (platform === 'android' && isGoogleFitAvailable()) {
      const result = await (window as any).GoogleFit.requestPermissions({
        scopes: [
          'com.google.android.gms.fitness.SCOPE_ACTIVITY_READ',
          'com.google.android.gms.fitness.SCOPE_BODY_READ',
          'com.google.android.gms.fitness.SCOPE_SLEEP_READ',
          'com.google.android.gms.fitness.SCOPE_HEART_RATE_READ'
        ]
      });
      return result?.authorized === true;
    }
    return false;
  } catch (error) {
    console.error('Failed to request health permissions:', error);
    return false;
  }
}

/**
 * Check authorization status
 */
export async function checkHealthAuthorization(): Promise<HealthSyncStatus> {
  const platform = Capacitor.getPlatform() as any;
  
  try {
    if (platform === 'ios' && isHealthKitAvailable()) {
      const result = await (window as any).HealthKit.getAuthorizationStatus();
      return {
        platform: 'ios',
        isAuthorized: result?.authorized === true,
        lastSyncTime: result?.lastSync
      };
    } else if (platform === 'android' && isGoogleFitAvailable()) {
      const result = await (window as any).GoogleFit.getAuthorizationStatus();
      return {
        platform: 'android',
        isAuthorized: result?.authorized === true,
        lastSyncTime: result?.lastSync
      };
    }
    return {
      platform: 'web',
      isAuthorized: false,
      error: 'Health APIs not available on this platform'
    };
  } catch (error) {
    return {
      platform: platform || 'web',
      isAuthorized: false,
      error: String(error)
    };
  }
}

/**
 * Fetch health metrics for a date range
 */
export async function fetchHealthMetrics(
  startDate: Date,
  endDate: Date,
  types?: HealthMetricType[]
): Promise<HealthMetric[]> {
  const platform = Capacitor.getPlatform();
  
  try {
    if (platform === 'ios' && isHealthKitAvailable()) {
      return await fetchHealthKitMetrics(startDate, endDate, types);
    } else if (platform === 'android' && isGoogleFitAvailable()) {
      return await fetchGoogleFitMetrics(startDate, endDate, types);
    }
    return [];
  } catch (error) {
    console.error('Failed to fetch health metrics:', error);
    return [];
  }
}

/**
 * iOS HealthKit metric fetching
 */
async function fetchHealthKitMetrics(
  startDate: Date,
  endDate: Date,
  types?: HealthMetricType[]
): Promise<HealthMetric[]> {
  const metrics: HealthMetric[] = [];
  const typesToFetch = types || ['steps', 'distance', 'calories', 'heart_rate', 'sleep'];

  for (const type of typesToFetch) {
    try {
      const result = await (window as any).HealthKit.queryMetric({
        type,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      if (result?.data && Array.isArray(result.data)) {
        metrics.push(...result.data.map((item: any) => ({
          type,
          value: item.value,
          unit: item.unit || getDefaultUnit(type),
          date: new Date(item.startDate).toISOString().split('T')[0],
          timestamp: new Date(item.startDate).getTime(),
          source: item.source || 'Apple Health'
        })));
      }
    } catch (error) {
      console.error(`Failed to fetch HealthKit metric ${type}:`, error);
    }
  }

  return metrics;
}

/**
 * Android Google Fit metric fetching
 */
async function fetchGoogleFitMetrics(
  startDate: Date,
  endDate: Date,
  types?: HealthMetricType[]
): Promise<HealthMetric[]> {
  const metrics: HealthMetric[] = [];
  const typesToFetch = types || ['steps', 'distance', 'calories', 'heart_rate', 'sleep'];

  for (const type of typesToFetch) {
    try {
      const result = await (window as any).GoogleFit.queryMetric({
        type,
        startTime: startDate.getTime(),
        endTime: endDate.getTime()
      });

      if (result?.data && Array.isArray(result.data)) {
        metrics.push(...result.data.map((item: any) => ({
          type,
          value: item.value,
          unit: item.unit || getDefaultUnit(type),
          date: new Date(item.startTime).toISOString().split('T')[0],
          timestamp: item.startTime,
          source: item.source || 'Google Fit'
        })));
      }
    } catch (error) {
      console.error(`Failed to fetch Google Fit metric ${type}:`, error);
    }
  }

  return metrics;
}

/**
 * Get default unit for metric type
 */
function getDefaultUnit(type: HealthMetricType): string {
  const units: Record<HealthMetricType, string> = {
    steps: 'count',
    distance: 'm',
    calories: 'kcal',
    heart_rate: 'bpm',
    sleep: 'min',
    active_energy: 'kcal'
  };
  return units[type] || '';
}

/**
 * Sync health metrics to backend
 */
export async function syncHealthMetrics(metrics: HealthMetric[]): Promise<HealthSyncResult> {
  const platform = Capacitor.getPlatform();
  
  try {
    const response = await fetch('/api/health/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metrics,
        platform,
        lastSyncTime: new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to sync health metrics:', error);
    throw error;
  }
}

/**
 * Start periodic health sync (call this once on app startup)
 */
export function startHealthSyncInterval(intervalMs: number = 3600000): () => void {
  const interval = setInterval(async () => {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
      
      const metrics = await fetchHealthMetrics(startDate, endDate);
      if (metrics.length > 0) {
        await syncHealthMetrics(metrics);
        console.log('Health metrics synced:', metrics.length);
      }
    } catch (error) {
      console.error('Periodic health sync failed:', error);
    }
  }, intervalMs);

  // Return cleanup function
  return () => clearInterval(interval);
}
