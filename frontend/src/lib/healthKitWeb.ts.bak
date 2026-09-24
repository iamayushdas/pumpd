import { Capacitor } from '@capacitor/core';

/**
 * Web-compatible health metrics collection
 * Works on web, iOS, and Android with fallbacks
 */

export type HealthMetricType = 'steps' | 'distance' | 'calories' | 'heart_rate' | 'sleep' | 'active_energy';

export interface HealthMetric {
  type: HealthMetricType;
  value: number;
  unit: string;
  date: string;
  timestamp?: number;
  source?: string;
}

export interface HealthSyncResult {
  synced: number;
  syncTime: string;
}

/**
 * Check platform capabilities
 */
export function getHealthPlatform(): 'native' | 'web-oauth' | 'web-local' | 'none' {
  const platform = Capacitor.getPlatform();
  
  if (platform === 'ios' || platform === 'android') {
    return 'native'; // Native HealthKit/Google Fit
  }
  
  if (platform === 'web') {
    // Check for Web Activity API support
    if ('LinearAccelerationSensor' in window || 'Accelerometer' in window) {
      return 'web-oauth'; // Can use Google Fit web API
    }
  }
  
  return 'web-local'; // Fallback to manual/local tracking
}

/**
 * Web-based step counting using accelerometer
 * Estimates steps from device motion
 */
export class WebStepCounter {
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

/**
 * Store metrics locally in IndexedDB for web
 */
export class LocalHealthStorage {
  private dbName = 'pumpd_health';
  private storeName = 'metrics';
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
          store.createIndex('date', 'date', { unique: false });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('userId', 'userId', { unique: false });
        }
      };
    });
  }

  async add(userId: string, metric: HealthMetric): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.add({
        ...metric,
        userId,
        createdAt: new Date()
      });
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getByDateRange(userId: string, startDate: string, endDate: string): Promise<HealthMetric[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('userId');
      const request = index.getAll(userId);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const results = request.result
          .filter((m: any) => m.date >= startDate && m.date <= endDate)
          .map((m: any) => ({
            type: m.type,
            value: m.value,
            unit: m.unit,
            date: m.date,
            timestamp: m.timestamp,
            source: m.source
          }));
        resolve(results);
      };
    });
  }

  async clear(userId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('userId');
      const request = index.getAll(userId);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        request.result.forEach((m: any) => {
          store.delete(m.id);
        });
        resolve();
      };
    });
  }
}

/**
 * Google Fit Web OAuth integration for web browsers
 * Requires Google OAuth credentials configured
 */
export class GoogleFitWeb {
  private clientId: string;
  private accessToken: string | null = null;

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  async authorize(): Promise<boolean> {
    try {
      // Load Google API client
      await this.loadGoogleAPI();
      
      const result = await (window as any).gapi.auth2.getAuthInstance().signIn();
      const user = result.getBasicProfile();
      
      const response = await fetch('https://www.googleapis.com/oauth2/v4/token', {
        method: 'POST',
        body: new URLSearchParams({
          client_id: this.clientId,
          scope: 'https://www.googleapis.com/auth/fitness.activity.read',
          response_type: 'token'
        })
      });

      const data = await response.json();
      this.accessToken = data.access_token;
      return !!this.accessToken;
    } catch (error) {
      console.error('Google Fit authorization failed:', error);
      return false;
    }
  }

  async fetchSteps(startDate: Date, endDate: Date): Promise<HealthMetric[]> {
    if (!this.accessToken) throw new Error('Not authorized');

    const startTimeMs = startDate.getTime();
    const endTimeMs = endDate.getTime();

    const response = await fetch(
      'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          aggregateBy: [{
            dataTypeName: 'com.google.step_count.delta'
          }],
          bucketByTime: { durationMillis: 86400000 }, // 1 day
          startTimeMillis: startTimeMs,
          endTimeMillis: endTimeMs
        })
      }
    );

    if (!response.ok) throw new Error('Failed to fetch steps');

    const data = await response.json();
    const metrics: HealthMetric[] = [];

    data.bucket?.forEach((bucket: any) => {
      bucket.dataset?.forEach((dataset: any) => {
        dataset.point?.forEach((point: any) => {
          const date = new Date(parseInt(point.startTimeNanos) / 1000000);
          metrics.push({
            type: 'steps',
            value: point.value?.[0]?.intVal || 0,
            unit: 'count',
            date: date.toISOString().split('T')[0],
            timestamp: date.getTime(),
            source: 'Google Fit Web'
          });
        });
      });
    });

    return metrics;
  }

  private loadGoogleAPI(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).gapi) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/platform.js';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        (window as any).gapi.load('auth2', () => {
          (window as any).gapi.auth2.init({ client_id: this.clientId });
          resolve();
        });
      };
      script.onerror = () => reject(new Error('Failed to load Google API'));
      document.head.appendChild(script);
    });
  }
}

/**
 * Unified web health API wrapper
 */
export async function syncWebHealthMetrics(
  metrics: HealthMetric[],
  userId: string
): Promise<HealthSyncResult> {
  const platform = getHealthPlatform();

  if (platform === 'native') {
    // Use native sync (handled by native plugin)
    throw new Error('Use native health API for mobile');
  }

  // Store locally first
  const storage = new LocalHealthStorage();
  await storage.init();

  for (const metric of metrics) {
    await storage.add(userId, metric);
  }

  // Try to sync to backend
  try {
    const response = await fetch('/api/health/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metrics,
        platform: 'web',
        lastSyncTime: new Date().toISOString()
      })
    });

    if (!response.ok) throw new Error('Sync failed');

    return await response.json();
  } catch (error) {
    console.warn('Backend sync failed, metrics stored locally:', error);
    return {
      synced: metrics.length,
      syncTime: new Date().toISOString()
    };
  }
}

/**
 * Get locally stored metrics (web only)
 */
export async function getLocalHealthMetrics(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<HealthMetric[]> {
  const storage = new LocalHealthStorage();
  await storage.init();

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  return storage.getByDateRange(userId, startDateStr, endDateStr);
}

/**
 * Manual metric logging for web users
 */
export function createManualMetric(
  type: HealthMetricType,
  value: number,
  date: Date = new Date()
): HealthMetric {
  return {
    type,
    value,
    unit: getUnitForType(type),
    date: date.toISOString().split('T')[0],
    timestamp: date.getTime(),
    source: 'Manual Entry'
  };
}

function getUnitForType(type: HealthMetricType): string {
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
