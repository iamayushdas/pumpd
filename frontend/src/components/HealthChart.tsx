import React, { useEffect, useState } from 'react'
import { t } from '../lib/i18n.js'

export function HealthChart({ metricType, days = 30 }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/health/metrics?type=${metricType}&days=${days}`)
      .then(r => r.json())
      .then(data => {
        const sorted = (data.metrics || []).sort((a, b) => a.date.localeCompare(b.date))
        setData(sorted.map(m => ({ date: m.date, value: m.value })))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [metricType, days])

  const title = {
    steps: t('Steps'),
    distance: t('Distance'),
    calories: t('Calories'),
    heart_rate: t('Heart Rate'),
    sleep: t('Sleep')
  }[metricType] || metricType

  const unit = {
    steps: 'steps',
    distance: 'km',
    calories: 'kcal',
    heart_rate: 'bpm',
    sleep: 'h'
  }[metricType] || ''

  const formatValue = (val) => {
    if (metricType === 'distance') return (val / 1000).toFixed(1)
    if (metricType === 'sleep') return (val / 60).toFixed(1)
    return Math.round(val).toLocaleString()
  }

  if (loading) return <div className="card" style={{ marginBottom: 14 }}><h2>{title}</h2><div className="empty small">Loading...</div></div>
  if (data.length === 0) return <div className="card" style={{ marginBottom: 14 }}><h2>{title}</h2><div className="empty small">No data</div></div>

  const maxValue = Math.max(...data.map(d => d.value))
  const minValue = Math.min(...data.map(d => d.value))
  const range = maxValue - minValue || 1

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h2>
        <div className="t-cap muted">{formatValue(data[data.length - 1]?.value || 0)} {unit}</div>
      </div>
      <svg viewBox={`0 0 ${Math.max(data.length * 12, 200)} 80`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <polyline
          points={data.map((d, i) => {
            const x = i * 12 + 6
            const y = 70 - ((d.value - minValue) / range) * 60
            return `${x},${y}`
          }).join(' ')}
          fill="none"
          stroke="var(--acc)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {data.map((d, i) => (
          <circle key={i} cx={i * 12 + 6} cy={70 - ((d.value - minValue) / range) * 60} r="2" fill="var(--acc)" />
        ))}
      </svg>
      <div className="t-cap muted" style={{ textAlign: 'center', marginTop: 4 }}>
        {data[0]?.date?.slice(5) || ''} → {data[data.length - 1]?.date?.slice(5) || ''}
      </div>
    </div>
  )
}