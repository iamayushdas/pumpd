import React, { useEffect, useState } from 'react'
import { getHealthPlatform } from '../lib/healthKitWeb'
import { Capacitor } from '@capacitor/core'
import { HealthSettings } from './HealthSettings'
import { HealthWeb } from './HealthWeb'
import { HealthMetrics } from './HealthMetrics'

export type HealthTab = 'overview' | 'settings' | 'manual'

export function HealthDashboard() {
  const [platform, setPlatform] = useState('')
  const [activeTab, setActiveTab] = useState<HealthTab>('overview')

  useEffect(() => {
    const detectedPlatform = Capacitor.getPlatform()
    const healthPlatform = getHealthPlatform()
    
    setPlatform(healthPlatform)
  }, [])

  if (!platform) {
    return <div className="empty small" style={{ padding: '24px 0' }}>Loading health dashboard...</div>
  }

  const isNative = platform === 'native'
  const isWebWithAccel = platform === 'web-oauth'

  return (
    <div>
      <div className="login-tab-seg" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={`login-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <span>Overview</span>
        </button>
        <button
          type="button"
          className={`login-tab-btn ${activeTab === 'manual' ? 'active' : ''}`}
          onClick={() => setActiveTab('manual')}
        >
          <span>Log Data</span>
        </button>
        <button
          type="button"
          className={`login-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <span>Settings</span>
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="card">
          <h2>Health Overview</h2>
          <HealthMetrics days={7} />
        </div>
      )}

      {activeTab === 'manual' && (
        <HealthWeb />
      )}

      {activeTab === 'settings' && (
        <div>
          {isNative ? (
            <HealthSettings />
          ) : (
            <div className="sect">
              <h4 className="sect-t">Web Health Settings</h4>
              <div className="sect-b">
                <div style={{ padding: '16px' }}>
                  <div className="t-sub" style={{ marginBottom: '12px' }}>
                    You're using pumpd in a web browser.
                  </div>
                  <div className="t-cap muted" style={{ marginBottom: '8px' }}>
                    Options:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '20px' }}>
                    {isWebWithAccel && (
                      <li className="t-sub" style={{ marginBottom: '4px' }}>
                        ✅ Accelerometer step counting available
                      </li>
                    )}
                    <li className="t-sub" style={{ marginBottom: '4px' }}>
                      ✅ Manual metric entry
                    </li>
                    <li className="t-sub" style={{ marginBottom: '4px' }}>
                      ✅ Data stored locally and synced to account
                    </li>
                    <li className="t-sub" style={{ marginBottom: '4px' }}>
                      ✅ Full privacy - no third-party data sharing
                    </li>
                  </ul>
                  <div className="t-cap muted" style={{ marginTop: '12px', marginBottom: '8px' }}>
                    For automatic syncing from Apple Health or Google Fit, install the native app.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}