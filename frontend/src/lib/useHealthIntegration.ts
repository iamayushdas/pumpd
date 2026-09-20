import { useEffect, useCallback, useState } from 'react'
import { 
  checkHealthAuthorization,
  fetchHealthMetrics,
  syncHealthMetrics,
  startHealthSyncInterval,
  HealthSyncStatus
} from './healthKit'

export interface UseHealthIntegrationOptions {
  autoSync?: boolean
  syncIntervalMs?: number
  onSyncSuccess?: (count: number) => void
  onSyncError?: (error: Error) => void
}

export function useHealthIntegration(options: UseHealthIntegrationOptions = {}) {
  const {
    autoSync = true,
    syncIntervalMs = 3600000, // 1 hour
    onSyncSuccess,
    onSyncError
  } = options

  const [status, setStatus] = useState<HealthSyncStatus | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)

  // Check authorization on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authStatus = await checkHealthAuthorization()
        setStatus(authStatus)
      } catch (error) {
        console.error('Failed to check health authorization:', error)
      }
    }
    checkAuth()
  }, [])

  // Manual sync function
  const sync = useCallback(async (days: number = 7) => {
    if (isSyncing) return
    
    try {
      setIsSyncing(true)
      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)
      
      const metrics = await fetchHealthMetrics(startDate, endDate)
      if (metrics.length > 0) {
        await syncHealthMetrics(metrics)
        const now = new Date()
        setLastSyncTime(now)
        localStorage.setItem('health_last_sync', now.getTime().toString())
        onSyncSuccess?.(metrics.length)
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      console.error('Health sync failed:', err)
      onSyncError?.(err)
    } finally {
      setIsSyncing(false)
    }
  }, [isSyncing, onSyncSuccess, onSyncError])

  // Setup auto-sync interval
  useEffect(() => {
    if (!autoSync || !status?.isAuthorized) return

    const cleanup = startHealthSyncInterval(syncIntervalMs)
    
    // Initial sync
    sync()

    return cleanup
  }, [autoSync, status?.isAuthorized, syncIntervalMs, sync])

  // Restore last sync time from localStorage
  useEffect(() => {
    const lastSync = localStorage.getItem('health_last_sync')
    if (lastSync) {
      setLastSyncTime(new Date(parseInt(lastSync)))
    }
  }, [])

  return {
    status,
    isSyncing,
    lastSyncTime,
    sync,
    isAvailable: status !== null && status.platform !== 'web'
  }
}
