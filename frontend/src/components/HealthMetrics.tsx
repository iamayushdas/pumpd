import React, { useEffect, useState } from 'react'
import { startWebStepCounter, isWebStepCounterRunning, getWebStepCounterStatus } from '../lib/healthKit'

export function HealthMetrics({ days = 7 }) {
  const [summary, setSummary] = useState({})
  const [loading, setLoading] = useState(true)
  const [webStepStatus, setWebStepStatus] = useState({ isRunning: false, stepCount: 0 })

  useEffect(() => {
    fetch(`/api/health/summary?days=${days}`)
      .then(r => r.json())
      .then(data => {
        setSummary(data.summary || {})
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [days])

  // Initialize WebStepCounter on web platforms
  useEffect(() => {
    let statusInterval: number;

    const initWebStepCounter = async () => {
      try {
        // Check if we're on web platform
        const { Capacitor } = await import('@capacitor/core')
        const platform = Capacitor.getPlatform()

        if (platform === 'web') {
          // Start WebStepCounter if not already running
          if (!isWebStepCounterRunning()) {
            await startWebStepCounter()
          }
        }
      } catch (error) {
        console.error('Failed to initialize WebStepCounter:', error)
      }
    }

    initWebStepCounter()

    // Update WebStepCounter status periodically
    statusInterval = setInterval(() => {
      const status = getWebStepCounterStatus()
      setWebStepStatus(status)
    }, 5000) // Update every 5 seconds

    return () => clearInterval(statusInterval)
  }, [])

  if (loading) return <div className="empty small" style={{ padding: '12px 0' }}>Loading...</div>
  if (Object.keys(summary).length === 0) return <div className="empty small" style={{ padding: '12px 0' }}>No data</div>

  return (
    <div className="cols">
      {summary.steps && (
        <div style={{ paddingTop: '8px' }}>
          <div className="t-cap muted">{summary.steps.total.toLocaleString()} steps</div>
          <div className="t-sub" style={{ marginTop: '2px' }}>Avg: {Math.round(summary.steps.average)}</div>
          {webStepStatus.isRunning && (
            <div className="t-sub" style={{ marginTop: '4px', color: '#30d158' }}>
              📱 Live: {webStepStatus.stepCount} steps (web tracking)
            </div>
          )}
        </div>
      )}
      {summary.distance && (
        <div style={{ paddingTop: '8px' }}>
          <div className="t-cap muted">{(summary.distance.total / 1000).toFixed(1)} km walked</div>
          <div className="t-sub" style={{ marginTop: '2px' }}>Avg: {(summary.distance.average / 1000).toFixed(1)} km</div>
        </div>
      )}
      {summary.calories && (
        <div style={{ paddingTop: '8px' }}>
          <div className="t-cap muted">{Math.round(summary.calories.total)} kcal burned</div>
          <div className="t-sub" style={{ marginTop: '2px' }}>Avg: {Math.round(summary.calories.average)}</div>
        </div>
      )}
      {summary.heart_rate && (
        <div style={{ paddingTop: '8px' }}>
          <div className="t-cap muted">{Math.round(summary.heart_rate.average)} bpm avg</div>
          <div className="t-sub" style={{ marginTop: '2px' }}>Max: {Math.round(summary.heart_rate.max)}</div>
        </div>
      )}
      {summary.sleep && (
        <div style={{ paddingTop: '8px' }}>
          <div className="t-cap muted">{(summary.sleep.total / 60).toFixed(1)} h sleep</div>
          <div className="t-sub" style={{ marginTop: '2px' }}>Avg: {(summary.sleep.average / 60).toFixed(1)} h</div>
        </div>
      )}
    </div>
  )
}