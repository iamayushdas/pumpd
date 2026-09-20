import React, { useEffect, useState } from 'react'
import { 
  requestHealthPermissions, 
  checkHealthAuthorization,
  HealthSyncStatus,
  isHealthKitAvailable,
  isGoogleFitAvailable,
  startHealthSyncInterval,
  fetchHealthMetrics,
  syncHealthMetrics
} from '../lib/healthKit'

export function HealthSettings() {
  const [status, setStatus] = useState<HealthSyncStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(
    localStorage.getItem('health_autosync') === 'true'
  )

  useEffect(() => {
    checkStatus()
  }, [])

  useEffect(() => {
    if (autoSyncEnabled) {
      localStorage.setItem('health_autosync', 'true')
      const cleanup = startHealthSyncInterval(3600000) // 1 hour
      return cleanup
    } else {
      localStorage.removeItem('health_autosync')
    }
  }, [autoSyncEnabled])

  async function checkStatus() {
    try {
      setLoading(true)
      const authStatus = await checkHealthAuthorization()
      setStatus(authStatus)
      const lastSyncStr = localStorage.getItem('health_last_sync')
      if (lastSyncStr) {
        const date = new Date(parseInt(lastSyncStr))
        setLastSync(date.toLocaleString())
      }
    } catch (error) {
      console.error('Failed to check health status:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleRequestPermissions() {
    try {
      setLoading(true)
      const authorized = await requestHealthPermissions()
      if (authorized) {
        await checkStatus()
      } else {
        alert('Health permissions were not granted')
      }
    } catch (error) {
      console.error('Failed to request permissions:', error)
      alert('Failed to request health permissions')
    } finally {
      setLoading(false)
    }
  }

  async function handleManualSync() {
    try {
      setSyncing(true)
      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
      
      const metrics = await fetchHealthMetrics(startDate, endDate)
      if (metrics.length > 0) {
        await syncHealthMetrics(metrics)
        localStorage.setItem('health_last_sync', Date.now().toString())
        setLastSync(new Date().toLocaleString())
        alert(`Successfully synced ${metrics.length} health metrics`)
      } else {
        alert('No health metrics found to sync')
      }
    } catch (error) {
      console.error('Sync failed:', error)
      alert('Failed to sync health metrics: ' + String(error))
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return <div className={styles.container}><div className={styles.loading}>Loading...</div></div>
  }

  const isAvailable = isHealthKitAvailable() || isGoogleFitAvailable()
  const platformName = isHealthKitAvailable() ? 'Apple Health' : isGoogleFitAvailable() ? 'Google Fit' : 'Health Service'

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Health & Fitness Integration</h2>
      </div>

      {!isAvailable ? (
        <div className={styles.unavailable}>
          <p>Health integration is not available on this device or browser.</p>
          <p>This feature requires iOS (Apple Health) or Android (Google Fit).</p>
        </div>
      ) : (
        <>
          <div className={styles.section}>
            <h3>Connection Status</h3>
            <div className={styles.statusBox}>
              <div className={styles.statusRow}>
                <span>Platform:</span>
                <span className={styles.value}>{platformName}</span>
              </div>
              <div className={styles.statusRow}>
                <span>Authorization:</span>
                <span className={status?.isAuthorized ? styles.authorized : styles.unauthorized}>
                  {status?.isAuthorized ? '✓ Connected' : '✗ Not Connected'}
                </span>
              </div>
              {lastSync && (
                <div className={styles.statusRow}>
                  <span>Last Sync:</span>
                  <span className={styles.value}>{lastSync}</span>
                </div>
              )}
            </div>
          </div>

          <div className={styles.section}>
            <h3>Permissions</h3>
            {!status?.isAuthorized ? (
              <p className={styles.description}>
                To sync your health data, pumpd needs access to your {platformName}. 
                You'll be prompted to grant permission when you click the button below.
              </p>
            ) : (
              <p className={styles.description}>
                ✓ Permissions granted. Your health metrics will be synced automatically.
              </p>
            )}
            <button
              onClick={handleRequestPermissions}
              disabled={loading || status?.isAuthorized}
              className={styles.button}
            >
              {status?.isAuthorized ? 'Permissions Granted' : 'Grant Permissions'}
            </button>
          </div>

          <div className={styles.section}>
            <h3>Sync Settings</h3>
            <div className={styles.syncSettings}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={autoSyncEnabled}
                  onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                  disabled={!status?.isAuthorized}
                />
                <span>Enable automatic sync every hour</span>
              </label>
              <p className={styles.description}>
                When enabled, your health metrics will be automatically synced from {platformName} 
                every hour in the background.
              </p>
            </div>
          </div>

          <div className={styles.section}>
            <h3>Manual Sync</h3>
            <button
              onClick={handleManualSync}
              disabled={syncing || !status?.isAuthorized}
              className={styles.button}
            >
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
            <p className={styles.description}>
              Click to manually sync your health data from the last 7 days.
            </p>
          </div>

          <div className={styles.section}>
            <h3>Synced Data Types</h3>
            <ul className={styles.dataTypes}>
              <li>👟 Steps</li>
              <li>📏 Distance</li>
              <li>🔥 Calories</li>
              <li>❤️ Heart Rate</li>
              <li>😴 Sleep</li>
            </ul>
          </div>

          <div className={styles.note}>
            <strong>Privacy:</strong> Your health data stays on your device and server. 
            No data is shared with third parties.
          </div>
        </>
      )}
    </div>
  )
}
