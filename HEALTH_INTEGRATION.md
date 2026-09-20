# Apple Health & Google Fit Integration Guide

## Overview

Pumpd now supports automatic syncing of health metrics from Apple Health (iOS) and Google Fit (Android). Track steps, distance, calories, heart rate, and sleep data directly from your device's native health apps.

## Supported Metrics

- **Steps** - Daily step count
- **Distance** - Walking/running distance in meters
- **Calories** - Active energy burned in kilocalories
- **Heart Rate** - Average/max heart rate in beats per minute
- **Sleep** - Total sleep duration in minutes

## iOS Setup (Apple Health)

### Prerequisites
- iOS 12.0 or later
- Xcode for building the app
- CocoaPods for dependency management

### Installation Steps

1. **Install HealthKit capability in Xcode:**
   ```
   Xcode → Project → Signing & Capabilities → + Capability → HealthKit
   ```

2. **Add health data permissions to Info.plist:**
   ```xml
   <key>NSHealthShareUsageDescription</key>
   <string>pumpd needs access to your health data to sync metrics</string>
   <key>NSHealthUpdateUsageDescription</key>
   <string>pumpd syncs your fitness metrics from Apple Health</string>
   ```

3. **Build and deploy:**
   ```bash
   npm run build:mobile
   # Follow Capacitor iOS deployment instructions
   ```

4. **Grant permissions:**
   - Open pumpd on your iPhone
   - Navigate to Settings → Health & Fitness Integration
   - Tap "Grant Permissions"
   - Select the health metrics you want to sync
   - Confirm in the Apple Health app prompt

### Supported Apple Health Data Types
- HKQuantityTypeIdentifierStepCount
- HKQuantityTypeIdentifierDistanceWalkingRunning
- HKQuantityTypeIdentifierActiveEnergyBurned
- HKQuantityTypeIdentifierHeartRate
- HKCategoryTypeIdentifierSleepAnalysis

## Android Setup (Google Fit)

### Prerequisites
- Android 5.0 (API level 21) or later
- Google Play Services 15.0 or later
- Google account with Google Fit enabled

### Installation Steps

1. **Create Google OAuth credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable Google Fit API
   - Create OAuth 2.0 credentials (Android app)
   - Add your app's SHA-1 fingerprint

2. **Configure android/app/build.gradle:**
   ```gradle
   dependencies {
     implementation 'com.google.android.gms:play-services-fitness:21.1.0'
     implementation 'com.google.android.gms:play-services-auth:21.0.0'
   }
   ```

3. **Build and deploy:**
   ```bash
   npm run build:mobile
   # Follow Capacitor Android deployment instructions
   ```

4. **Grant permissions:**
   - Open pumpd on your Android device
   - Navigate to Settings → Health & Fitness Integration
   - Tap "Grant Permissions"
   - Sign in with your Google account
   - Grant access to fitness data
   - Confirm in Google Fit

### Supported Google Fit Data Types
- com.google.android.gms.fitness.data.TYPE_STEP_COUNT_DELTA
- com.google.android.gms.fitness.data.TYPE_DISTANCE_DELTA
- com.google.android.gms.fitness.data.TYPE_CALORIES_EXPENDED
- com.google.android.gms.fitness.data.TYPE_HEART_RATE_BPM
- com.google.android.gms.fitness.data.TYPE_SLEEP_SEGMENT

## Frontend Integration

### Using Health Settings Component

Add the health settings to your settings page:

```tsx
import { HealthSettings } from './components/HealthSettings'

export function Settings() {
  return (
    <div>
      {/* ... other settings ... */}
      <HealthSettings />
    </div>
  )
}
```

### Using Health Metrics Dashboard

Display health metrics in your dashboard:

```tsx
import { HealthMetrics } from './components/HealthMetrics'

export function Dashboard() {
  return (
    <div>
      <HealthMetrics days={7} />
    </div>
  )
}
```

### Using the useHealthIntegration Hook

For custom implementations:

```tsx
import { useHealthIntegration } from './lib/useHealthIntegration'

export function MyComponent() {
  const { status, isSyncing, lastSyncTime, sync, isAvailable } = useHealthIntegration({
    autoSync: true,
    syncIntervalMs: 3600000, // 1 hour
    onSyncSuccess: (count) => console.log(`Synced ${count} metrics`),
    onSyncError: (error) => console.error('Sync failed:', error)
  })

  return (
    <div>
      <p>Connected: {status?.isAuthorized ? 'Yes' : 'No'}</p>
      <p>Last sync: {lastSyncTime?.toLocaleString()}</p>
      <button onClick={() => sync(7)} disabled={isSyncing}>
        {isSyncing ? 'Syncing...' : 'Sync Now'}
      </button>
    </div>
  )
}
```

## Backend API Endpoints

### Sync Health Metrics

```
POST /api/health/sync
Content-Type: application/json

{
  "metrics": [
    {
      "type": "steps",
      "value": 8234,
      "unit": "count",
      "date": "2026-09-20",
      "timestamp": 1695206954000,
      "source": "Apple Health"
    }
  ],
  "platform": "ios",
  "lastSyncTime": "2026-09-20T16:09:14Z"
}

Response: { "ok": true, "synced": 1, "syncTime": "2026-09-20T16:09:14Z" }
```

### Get Health Metrics

```
GET /api/health/metrics?type=steps&days=30

Response: {
  "metrics": [
    {
      "userId": "user-123",
      "metricType": "steps",
      "value": 8234,
      "unit": "count",
      "date": "2026-09-20",
      "platform": "ios",
      "source": "Apple Health",
      "timestamp": 1695206954000
    }
  ]
}
```

### Get Health Summary

```
GET /api/health/summary?days=7

Response: {
  "summary": {
    "steps": {
      "total": 57680,
      "average": 8240,
      "max": 12000,
      "min": 5000,
      "dataPoints": 7
    },
    "distance": {
      "total": 45600,
      "average": 6514,
      "max": 9200,
      "min": 3800,
      "dataPoints": 7
    }
  },
  "days": 7
}
```

### Get Sync Status

```
GET /api/health/sync-status

Response: {
  "syncLog": [
    {
      "userId": "user-123",
      "platform": "ios",
      "metricsCount": 5,
      "lastSyncTime": "2026-09-20T16:09:14Z",
      "syncedAt": "2026-09-20T16:09:14Z",
      "syncStatus": "success"
    }
  ]
}
```

## Data Storage

Health metrics are stored in MongoDB with the following schema:

```javascript
// healthMetrics collection
{
  _id: ObjectId,
  userId: "user-123",
  metricType: "steps", // steps | distance | calories | heart_rate | sleep
  value: 8234,
  unit: "count",
  date: "2026-09-20",
  source: "Apple Health",
  platform: "ios", // ios | android
  timestamp: 1695206954000,
  createdAt: ISODate("2026-09-20T16:09:14Z")
}

// healthSyncLog collection
{
  _id: ObjectId,
  userId: "user-123",
  platform: "ios",
  metricsCount: 5,
  lastSyncTime: "2026-09-20T15:09:14Z",
  syncedAt: ISODate("2026-09-20T16:09:14Z"),
  syncStatus: "success", // success | failed
  error: null // Error message if failed
}
```

## Automatic Syncing

The app supports two sync modes:

### 1. Automatic Background Sync (Recommended)
- Syncs every hour when app is open
- Can be toggled in Settings → Health & Fitness Integration
- Stored preference survives app restarts

### 2. Manual Sync
- Users can manually trigger sync from Health Settings
- Syncs last 7 days of data by default
- Shows sync status and timestamp

## Privacy & Data Security

- **On-device processing**: Health metrics are read directly from Apple Health/Google Fit
- **Encrypted transmission**: All API requests use HTTPS
- **User-controlled**: Users must explicitly grant permissions
- **No third-party sharing**: Data never leaves your server
- **TTL enforcement**: Metrics older than 90 days are automatically purged from MongoDB
- **Session-based**: Only authenticated users can sync and view their metrics

## Troubleshooting

### "Health APIs not available on this platform"
- This feature requires iOS (Apple Health) or Android (Google Fit)
- Not available on web or desktop browsers
- Ensure you're using a native app built with Capacitor

### Permissions not granted
- Check Info.plist (iOS) or AndroidManifest.xml (Android)
- Ensure HealthKit capability is enabled in Xcode (iOS)
- Verify Google Fit API is enabled in Google Cloud Console (Android)
- Try revoking permissions and requesting again

### Metrics not syncing
- Check network connection
- Verify backend is running and /api/health/sync endpoint is accessible
- Enable auto-sync or try manual sync
- Check sync status logs for error details

### Data not appearing in Apple Health/Google Fit
- These are read-only integrations - pumpd only reads, never writes to health apps
- Check that data exists in your Apple Health/Google Fit app
- Try clearing app cache and re-granting permissions

## Performance Considerations

- Syncs are batched in bulk operations for efficiency
- Background syncing respects device battery and network conditions
- Large data transfers are limited to 7-day windows per sync
- MongoDB indexes optimize queries by userId, date, and metric type

## Future Enhancements

Planned features:
- Export health data to CSV/PDF
- Integration with workout logging (sync gym sessions to Apple Health)
- Health goals and progress tracking
- Advanced health analytics and trends
- Wearable device support (Fitbit, Garmin, etc.)
