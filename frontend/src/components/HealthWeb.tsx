import React, { useState } from 'react'
import { createManualMetric, HealthMetricType } from '../lib/healthKitWeb'

export function HealthWeb() {
  const [metrics, setMetrics] = useState({ steps: '', distance: '', calories: '', heart_rate: '', sleep: '' })
  const [saving, setSaving] = useState(false)

  const handleChange = (metric: string, value: string) => {
    setMetrics(prev => ({ ...prev, [metric]: value }))
  }

  const handleLog = async (metric: HealthMetricType) => {
    const value = parseFloat(metrics[metric])
    if (isNaN(value) || value <= 0) return

    setSaving(true)
    try {
      const healthMetric = createManualMetric(metric, value)
      await fetch('/api/health/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics: [healthMetric], platform: 'web', lastSyncTime: new Date().toISOString() })
      })
      setMetrics(prev => ({ ...prev, [metric]: '' }))
    } catch (e) {
      console.error(e)
    }
    setSaving(false)
  }

  const rows = [
    { key: 'steps', label: 'Steps', unit: 'steps', color: 'var(--green)' },
    { key: 'distance', label: 'Distance', unit: 'km', color: 'var(--blue)' },
    { key: 'calories', label: 'Calories', unit: 'kcal', color: 'var(--orange)' },
    { key: 'heart_rate', label: 'Heart Rate', unit: 'bpm', color: 'var(--red)' },
    { key: 'sleep', label: 'Sleep', unit: 'h', color: 'var(--purple)' }
  ]

  return (
    <div className="sect-b">
      {rows.map(row => (
        <div key={row.key} className="lrow tap">
          <div className="lrow-m">
            <div className="lrow-t">{row.label}</div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <input
              type="number"
              value={metrics[row.key as keyof typeof metrics]}
              onChange={e => handleChange(row.key, e.target.value)}
              placeholder="0"
              disabled={saving}
              style={{
                width: 72,
                padding: '6px 8px',
                borderRadius: 6,
                background: 'var(--surface-2)',
                border: '1px solid var(--sep)',
                color: 'var(--label)',
                fontSize: 15,
                textAlign: 'right'
              }}
            />
            <span className="t-foot muted" style={{ minWidth: 35 }}>{row.unit}</span>
            <button
              className="btn btn.xs primary"
              onClick={() => handleLog(row.key as HealthMetricType)}
              disabled={saving || !metrics[row.key as keyof typeof metrics]}
              style={{ width: 'auto', padding: '6px 12px' }}
            >
              Log
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}