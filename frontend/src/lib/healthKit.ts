import { Capacitor } from '@capacitor/core';
import type { HealthMetricType, HealthMetric, HealthSyncResult, HealthSyncStatus } from '../types/health'

export { type HealthMetricType, type HealthMetric, type HealthSyncResult, type HealthSyncStatus }

export interface WebStepCounterStatus {
  isRunning: boolean;
  stepCount: number;
  lastStepTime?: Date;
  accuracy?: 'high' | 'medium' | 'low';
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
 * Web-specific step tracking functionality
 */
class WebStepCounter {
  private motionThreshold = 15;
  private stepCount = 0;
  private lastMagnitude = 0;
  private isMoving = false;
  private onStepCallback?: (steps: number) => void;

  start(onStep?: (steps: number) => void) {
    this.onStepCallback = onStep;

    if ('Accelerometer' in window) {
      try {
        const accel = new (window as any).Accelerometer({ frequency: 10 });
        accel.addEventListener('reading', () => {
          this.processAccelerometerData(accel.x, accel.y, accel.z);
        });
        accel.addEventListener('error', (e: any) => console.error('Accelerometer error:', e));
        accel.start();
      } catch (e) {
        console.warn('Accelerometer API not available:', e);
        this.fallbackToDeviceMotion();
      }
    } else {
      this.fallbackToDeviceMotion();
    }
  }

  private fallbackToDeviceMotion() {
    window.addEventListener('devicemotion', (event) => {
      const accel = event.acceleration;
      if (accel) {
        this.processAccelerometerData(accel.x || 0, accel.y || 0, accel.z || 0);
      }
    });
  }

  private processAccelerometerData(x: number, y: number, z: number) {
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    const delta = Math.abs(magnitude - this.lastMagnitude);

    if (delta > this.motionThreshold) {
      if (!this.isMoving) {
        this.isMoving = true;
        this.stepCount++;
        this.onStepCallback?.(this.stepCount);
      }
    } else {
      this.isMoving = false;
    }

    this.lastMagnitude = magnitude;
  }

  stop() {
    // Stop listening to device motion
  }

  getSteps(): number {
    return this.stepCount;
  }

  reset() {
    this.stepCount = 0;
  }
}

let webStepCounter: WebStepCounter | null = null;

/**
 * Start WebStepCounter for web platforms
 * @param onStep - Callback function called when a step is detected
 * @returns Promise that resolves when step counter is started
 */
export async function startWebStepCounter(onStep?: (steps: number) => void): Promise<void> {
  try {
    // Initialize WebStepCounter
    webStepCounter = new WebStepCounter();

    // Start step counting with callback
    webStepCounter.start(onStep || ((steps: number) => {
      // Sync step data to backend
      syncWebStepData(steps);
    }));

    console.log('WebStepCounter started successfully');
  } catch (error) {
    console.error('Failed to start WebStepCounter:', error);
    throw error;
  }
}

/**
 * Get current step count from WebStepCounter
 * @returns Current step count (0 if not available)
 */
export function getWebSteps(): number {
  return webStepCounter ? webStepCounter.getSteps() : 0;
}

/**
 * Stop WebStepCounter
 */
export function stopWebStepCounter(): void {
  if (webStepCounter) {
    webStepCounter.stop();
    webStepCounter = null;
    console.log('WebStepCounter stopped');
  }
}

/**
 * Check if WebStepCounter is running
 * @returns True if WebStepCounter is active
 */
export function isWebStepCounterRunning(): boolean {
  return webStepCounter !== null;
}

/**
 * Get WebStepCounter status
 * @returns Status object with step counting information
 */
export function getWebStepCounterStatus(): WebStepCounterStatus {
  return {
    isRunning: isWebStepCounterRunning(),
    stepCount: getWebSteps(),
    lastStepTime: undefined, // Could add timestamp tracking if needed
    accuracy: 'medium' // Default accuracy for web-based step counting
  };
}

/**
 * Sync web step data to backend
 * @param steps - Step count to sync
 * @returns Promise that resolves when sync is complete
 */
export async function syncWebStepData(steps: number): Promise<void> {
  if (steps <= 0) return; // No step data to sync

  try {
    const platform = Capacitor.getPlatform();
    const metric: HealthMetric = {
      type: 'steps',
      value: steps,
      unit: 'count',
      date: new Date().toISOString().split('T')[0],
      timestamp: Date.now(),
      source: 'WebStepCounter'
    };

    await syncHealthMetrics([metric]);
    console.log(`Web step data synced: ${steps} steps`);
  } catch (error) {
    console.error('Failed to sync web step data:', error);
  }
}

/**
 * Start automatic step sync for web platforms
 * This periodically checks for step updates and syncs them
 * @param intervalMs - Sync interval in milliseconds (default: 5 minutes)
 * @returns Cleanup function to stop the interval
 */
export function startWebStepSyncInterval(intervalMs: number = 300000): () => void {
  const interval = setInterval(async () => {
    try {
      const currentSteps = getWebSteps();
      if (currentSteps > 0) {
        await syncWebStepData(currentSteps);
      }
    } catch (error) {
      console.error('Web step sync interval failed:', error);
    }
  }, intervalMs);

  return () => clearInterval(interval);
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
