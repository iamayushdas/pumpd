# Health Integration - Complete Guide (Web + Mobile)

## Overview

Pumpd supports health metrics tracking across all platforms:

- **iOS**: Apple HealthKit (automatic sync)
- **Android**: Google Fit (automatic sync)
- **Web Browser**: Manual entry + accelerometer-based step counting
- **PWA**: Works offline, syncs when online

## Platform Capabilities

| Feature | iOS Native | Android Native | Web Browser | PWA |
|---------|-----|---------|-------------|-----|
| Auto-sync from health app | ✅ HealthKit | ✅ Google Fit | ❌ | ❌ |
| Manual metric entry | ✅ | ✅ | ✅ | ✅ |
| Live step counting (accelerometer) | ✅ | ✅ | ✅ | ✅ |
| Local data storage | ✅ | ✅ | ✅ (IndexedDB) | ✅ (IndexedDB) |
| Offline support | ✅ | ✅ | ✅ | ✅ |
| Cloud sync | ✅ | ✅ | ✅ | ✅ |
| Background periodic sync | ✅ | ✅ | ❌ | ✅ (Android 12+) |
| Home screen install | ✅ | ✅ | Manual | ✅ |

## Supported Metrics

All platforms support logging these metrics:

- **Steps** - Daily step count
- **Distance** - Walking/running distance (meters)
- **Calories** - Active energy burned (kilocalories)
- **Heart Rate** - Average/max beats per minute
- **Sleep** - Total sleep duration (minutes)
- **Active Energy** - Energy expenditure (kilocalories)

## Web Browser Setup

### For Manual Entry

No special setup required. Just open pumpd in your browser and:

1. Go to Health & Fitness → Log Data
2. Enter your metrics for the day
3. Click "Log" to save

Data is stored locally and automatically synced to your account.

### For Accelerometer-Based Step Counting

**Requirements:**
- Modern mobile browser (Chrome, Firefox, Safari on iOS 14.5+)
- HTTPS connection (localhost for development)
- Device permission for motion sensors

**Usage:**

1. Open pumpd in your mobile browser
2. Go to Health & Fitness → Log Data
3. Enable device motion permissions when prompted
4. Move your device - steps will be counted automatically
5. Click "Log Steps" to save the count

**How it works:**
- Accelerometer detects motion patterns that match walking/running
- Estimates step count from acceleration data
- More accurate when device is in pocket or hand during walking

**Tips for accuracy:**
- Keep device in pocket or held at waist level
- Walk at normal pace
- Avoid rapid non-walking movements

### For IndexedDB Local Storage

Web data is automatically stored in your browser's IndexedDB database:

```javascript
// Data persists across browser sessions
// Syncs automatically when backend is available
// Falls back to local storage if sync fails
```

## iOS Setup (Native App)

### Requirements
- iOS 12.0 or later
- Xcode and Capacitor CLI
- CocoaPods

### Installation

1. **Enable HealthKit in Xcode:**
   ```
   Xcode → Project → Signing & Capabilities → + Capability → HealthKit
   ```

2. **Add permissions to Info.plist:**
   ```xml
   <key>NSHealthShareUsageDescription</key>
   <string>pumpd syncs your fitness metrics from Apple Health</string>
   <key>NSHealthUpdateUsageDescription</key>
   <string>pumpd reads your health data to track metrics</string>
   ```

3. **Build the app:**
   ```bash
   npm run build:mobile
   npx cap build ios
   ```

4. **Grant permissions:**
   - Open pumpd on your iPhone
   - Go to Health & Fitness → Settings
   - Tap "Grant Permissions"
   - Select metrics to sync in Apple Health popup
   - Enable automatic sync

### Data Synced from Apple Health
- HKQuantityTypeIdentifierStepCount
- HKQuantityTypeIdentifierDistanceWalkingRunning
- HKQuantityTypeIdentifierActiveEnergyBurned
- HKQuantityTypeIdentifierHeartRate
- HKCategoryTypeIdentifierSleepAnalysis

## Android Setup (Native App)

### Requirements
- Android 5.0 (API level 21) or later
- Google Play Services 15.0+
- Google account with Google Fit enabled

### Installation

1. **Create Google OAuth credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create OAuth 2.0 credentials (Android)
   - Add your app's SHA-1 fingerprint

2. **Configure build.gradle:**
   ```gradle
   dependencies {
     implementation 'com.google.android.gms:play-services-fitness:21.1.0'
     implementation 'com.google.android.gms:play-services-auth:21.0.0'
   }
   ```

3. **Build the app:**
   ```bash
   npm run build:mobile
   npx cap build android
   ```

4. **Grant permissions:**
   - Open pumpd on your Android device
   - Go to Health & Fitness → Settings
   - Tap "Grant Permissions"
   - Sign in with your Google account
   - Grant access to fitness data

### Data Synced from Google Fit
- Step count delta
- Distance delta
- Calories expended
- Heart rate
- Sleep segments

## Using the Health Dashboard

All platforms access the same unified dashboard at Health & Fitness:

### Overview Tab
- 7-day summary statistics
- Total, average, max, min for each metric
- Quick view of your health trends

### Log Data Tab
- Manual entry for all metrics
- Live step counter (web/mobile with accelerometer)
- Real-time metric logging

### Settings Tab
- **Native apps**: Permission management, auto-sync toggle, sync history
- **Web**: Platform information, data privacy, permission status

## Backend API Reference

### Sync Metrics

```bash
POST /api/health/sync
Content-Type: application/json

{
  "metrics": [
    {
      "type": "steps",
      "value": 8234,
      "unit": "count",
      "date": "2026-09-20",
      "source": "Manual Entry"
    }
  ],
  "platform": "web",
  "lastSyncTime": "2026-09-20T16:15:00Z"
}
```

**Response:**
```json
{
  "ok": true,
  "synced": 1,
  "syncTime": "2026-09-20T16:15:02Z"
}
```

### Get Metrics

```bash
GET /api/health/metrics?type=steps&days=30
```

**Response:**
```json
{
  "metrics": [
    {
      "userId": "user-123",
      "metricType": "steps",
      "value": 8234,
      "unit": "count",
      "date": "2026-09-20",
      "platform": "web",
      "source": "Manual Entry",
      "timestamp": 1695206102000
    }
  ]
}
```

### Get Summary

```bash
GET /api/health/summary?days=7
```

**Response:**
```json
{
  "summary": {
    "steps": {
      "total": 57680,
      "average": 8240,
      "max": 12000,
      "min": 5000,
      "dataPoints": 7
    }
  },
  "days": 7
}
```

## Frontend Integration

### Using the Health Dashboard

```tsx
import { HealthDashboard } from './components/HealthDashboard'

export function App() {
  return (
    <Routes>
      {/* ... other routes ... */}
      <Route path="/health" element={<HealthDashboard />} />
    </Routes>
  )
}
```

### Using Individual Components

```tsx
// Health overview with stats
import { HealthMetrics } from './components/HealthMetrics'
<HealthMetrics days={7} />

// Manual logging (web + mobile)
import { HealthWeb } from './components/HealthWeb'
<HealthWeb />

// Native settings (iOS + Android)
import { HealthSettings } from './components/HealthSettings'
<HealthSettings />

// Line chart visualization
import { HealthChart } from './components/HealthChart'
<HealthChart metricType="steps" days={30} />

// Unified dashboard (auto-detects platform)
import { HealthDashboard } from './components/HealthDashboard'
<HealthDashboard />
```

### Using the Hook

```tsx
import { useHealthIntegration } from './lib/useHealthIntegration'

function MyComponent() {
  const { status, isSyncing, lastSyncTime, sync, isAvailable } = useHealthIntegration({
    autoSync: true,
    syncIntervalMs: 3600000,
    onSyncSuccess: (count) => console.log(`Synced ${count} metrics`),
    onSyncError: (error) => console.error('Sync failed:', error)
  })

  return (
    <div>
      <p>Status: {status?.isAuthorized ? 'Connected' : 'Not connected'}</p>
      <p>Last sync: {lastSyncTime?.toLocaleString()}</p>
      <button onClick={() => sync()}>Sync Now</button>
    </div>
  )
}
```

## Data Storage

### MongoDB Collections

**healthMetrics** - All synced metrics
```javascript
{
  _id: ObjectId,
  userId: "user-123",
  metricType: "steps",
  value: 8234,
  unit: "count",
  date: "2026-09-20",
  platform: "web" | "ios" | "android",
  source: "Manual Entry" | "Apple Health" | "Google Fit",
  timestamp: 1695206102000,
  createdAt: ISODate("2026-09-20T16:15:02Z")
}
```

**healthSyncLog** - Sync history
```javascript
{
  _id: ObjectId,
  userId: "user-123",
  platform: "web",
  metricsCount: 1,
  syncStatus: "success" | "failed",
  syncedAt: ISODate("2026-09-20T16:15:02Z"),
  error: null | "error message"
}
```

### Browser Storage (Web Only)

**IndexedDB** - Local metric storage
```javascript
// Automatically managed by LocalHealthStorage class
// Syncs to backend when available
// Survives browser refreshes and session restarts
```

## Automatic Syncing

### Native Apps (iOS + Android)
- Hourly background sync when permissions granted
- Toggle on/off in Settings
- Manual sync available anytime
- Syncs last 7 days by default

### Web Browser
- Manual sync only (click "Sync Now" button)
- Data stored locally in IndexedDB
- Syncs to backend when clicked
- Offline-first approach

### PWA
- Works like web browser
- Offline support via service worker
- Syncs when connection restored

## Privacy & Security

### Data Handling
- ✅ All data encrypted in transit (HTTPS)
- ✅ Stored on your personal server only
- ✅ No third-party data sharing
- ✅ User-controlled permissions
- ✅ Session-based authentication

### Data Retention
- Metrics stored for 90 days
- Automatically purged after 90 days
- Sync logs kept for 30 days
- Manual cleanup available via API

### Permissions
- **iOS**: Explicitly request each metric type
- **Android**: Google account OAuth with fitness scope
- **Web**: Browser motion sensor permission
- All permissions can be revoked anytime

## Troubleshooting

### Web: No accelerometer detected
- Browser doesn't support motion APIs
- Use manual entry instead
- Try enabling via Settings
- Check browser permissions

### Native: Permissions not showing
- Rebuild app after Info.plist changes (iOS)
- Clear app cache and try again
- Reinstall if permissions broken
- Check device OS version compatibility

### Sync failing
- Check network connection
- Verify backend is running
- Try manual sync first
- Check sync logs for errors

### Data not appearing
- Verify data exists in source app (Apple Health/Google Fit)
- Try manual re-sync
- Check browser permissions
- Clear cache and try again

## Performance

- Bulk sync optimized for large datasets
- Indexes on userId, date, metricType for fast queries
- TTL indexes auto-purge old data
- Background sync respects device resources

## Future Enhancements

- Export to CSV/PDF
- Wearable device support (Fitbit, Garmin)
- Health goal tracking
- Advanced analytics
- Integration with workout logging
- Health trend predictions

## Support

For issues or questions:
- Check sync logs in Health & Fitness → Settings
- Verify network connection
- Review browser console for errors
- Check MongoDB connection and collections
- Ensure API endpoints are accessible
