import { forwardRef } from 'react'
import { fmtDate, fmtDur, fmtVol, fmtNum } from '../lib/format'
import { setsDone } from '../lib/history'
import { loadOfWorkouts } from '../lib/muscles'
import Icon from './Icon'
import BodyMap from './BodyMap'

// Template types
export type ShareTemplate = 'modern' | 'minimal' | 'stats' | 'gradient'

interface WorkoutShareCardProps {
  workout: any
  prs: string[]
  unit: string
  template: ShareTemplate
  body?: string
  appName?: string
}

const WorkoutShareCard = forwardRef<HTMLDivElement, WorkoutShareCardProps>(
  ({ workout, prs, unit, template, body = 'male', appName = 'Pumpd' }, ref) => {
    const duration = fmtDur(workout.end - workout.start)
    const volume = fmtVol(workout.vol, unit)
    const sets = setsDone(workout)
    const date = fmtDate(workout.d, true)
    const muscleLoad = loadOfWorkouts([workout])

    if (template === 'modern') {
      return (
        <div
          ref={ref}
          style={{
            width: '600px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '40px',
            borderRadius: '24px',
            color: '#ffffff',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
          }}
        >
          <div style={{ marginBottom: '30px' }}>
            <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>{date}</div>
            <h1 style={{ fontSize: '36px', fontWeight: '700', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
              {workout.name}
            </h1>
            <div style={{ fontSize: '16px', opacity: 0.85 }}>Workout Complete 💪</div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              marginBottom: '30px',
            }}
          >
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(10px)',
                padding: '20px',
                borderRadius: '16px',
              }}
            >
              <div style={{ fontSize: '14px', opacity: 0.85, marginBottom: '8px' }}>⏱️ Duration</div>
              <div style={{ fontSize: '28px', fontWeight: '700' }}>{duration}</div>
            </div>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(10px)',
                padding: '20px',
                borderRadius: '16px',
              }}
            >
              <div style={{ fontSize: '14px', opacity: 0.85, marginBottom: '8px' }}>📊 Volume</div>
              <div style={{ fontSize: '28px', fontWeight: '700' }}>{volume}</div>
            </div>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(10px)',
                padding: '20px',
                borderRadius: '16px',
              }}
            >
              <div style={{ fontSize: '14px', opacity: 0.85, marginBottom: '8px' }}>💪 Sets</div>
              <div style={{ fontSize: '28px', fontWeight: '700' }}>{sets}</div>
            </div>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(10px)',
                padding: '20px',
                borderRadius: '16px',
              }}
            >
              <div style={{ fontSize: '14px', opacity: 0.85, marginBottom: '8px' }}>🏆 PRs</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: prs.length ? '#ffd60a' : '#ffffff' }}>
                {prs.length || '0'}
              </div>
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(10px)',
              padding: '20px',
              borderRadius: '16px',
              marginBottom: '30px',
            }}
          >
            <div style={{ fontSize: '14px', opacity: 0.85, marginBottom: '12px', textAlign: 'center' }}>
              Muscles Trained
            </div>
            <div style={{ filter: 'brightness(1.2)' }}>
              <BodyMap load={muscleLoad} body={body} />
            </div>
          </div>

          <div
            style={{
              textAlign: 'center',
              fontSize: '14px',
              opacity: 0.7,
              borderTop: '1px solid rgba(255, 255, 255, 0.2)',
              paddingTop: '20px',
            }}
          >
            {appName}
          </div>
        </div>
      )
    }

    if (template === 'minimal') {
      return (
        <div
          ref={ref}
          style={{
            width: '600px',
            background: '#ffffff',
            padding: '50px',
            borderRadius: '0',
            color: '#000000',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
            border: '8px solid #000000',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h1 style={{ fontSize: '48px', fontWeight: '900', margin: '0 0 12px 0', letterSpacing: '-0.03em' }}>
              {workout.name}
            </h1>
            <div style={{ fontSize: '16px', color: '#666666' }}>{date}</div>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', borderBottom: '2px solid #000000', paddingBottom: '12px' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Duration</div>
                <div style={{ fontSize: '32px', fontWeight: '800', marginTop: '4px' }}>{duration}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Volume</div>
                <div style={{ fontSize: '32px', fontWeight: '800', marginTop: '4px' }}>{volume}</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000000', paddingBottom: '12px', marginBottom: '32px' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Sets</div>
                <div style={{ fontSize: '32px', fontWeight: '800', marginTop: '4px' }}>{sets}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.1em' }}>PRs</div>
                <div style={{ fontSize: '32px', fontWeight: '800', marginTop: '4px' }}>{prs.length || '0'}</div>
              </div>
            </div>

            <div style={{ border: '2px solid #000000', padding: '20px', marginBottom: '32px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center', marginBottom: '16px' }}>
                Muscles Trained
              </div>
              <BodyMap load={muscleLoad} body={body} />
            </div>
          </div>

          <div style={{ textAlign: 'center', fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
            {appName}
          </div>
        </div>
      )
    }

    if (template === 'stats') {
      return (
        <div
          ref={ref}
          style={{
            width: '600px',
            background: '#0a0e27',
            padding: '40px',
            borderRadius: '20px',
            color: '#ffffff',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
          }}
        >
          <div style={{ marginBottom: '30px' }}>
            <div style={{ display: 'inline-block', background: '#30d158', color: '#000', padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', marginBottom: '16px' }}>
              COMPLETED
            </div>
            <h1 style={{ fontSize: '40px', fontWeight: '800', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
              {workout.name}
            </h1>
            <div style={{ fontSize: '14px', color: '#a0a0a0' }}>{date}</div>
          </div>

          <div style={{ marginBottom: '30px' }}>
            {[
              { label: 'Duration', value: duration, icon: '⏱️' },
              { label: 'Volume', value: volume, icon: '📈' },
              { label: 'Sets Completed', value: sets, icon: '💪' },
              { label: 'Personal Records', value: prs.length || '0', icon: '🏆', highlight: prs.length > 0 },
            ].map((stat, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 20px',
                  background: stat.highlight ? 'rgba(255, 214, 10, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  marginBottom: '12px',
                  borderLeft: stat.highlight ? '4px solid #ffd60a' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '24px' }}>{stat.icon}</span>
                  <span style={{ fontSize: '16px', fontWeight: '500' }}>{stat.label}</span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: stat.highlight ? '#ffd60a' : '#ffffff' }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '30px',
            }}
          >
            <div style={{ fontSize: '14px', marginBottom: '16px', textAlign: 'center', opacity: 0.8 }}>
              Muscles Trained
            </div>
            <div style={{ filter: 'brightness(1.1)' }}>
              <BodyMap load={muscleLoad} body={body} />
            </div>
          </div>

          <div
            style={{
              textAlign: 'center',
              fontSize: '12px',
              color: '#666',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              paddingTop: '20px',
            }}
          >
            Tracked with {appName}
          </div>
        </div>
      )
    }

    if (template === 'gradient') {
      return (
        <div
          ref={ref}
          style={{
            width: '600px',
            background: 'linear-gradient(to bottom right, #ff6b6b, #ee5a6f, #c44569, #4ecdc4)',
            padding: '50px',
            borderRadius: '30px',
            color: '#ffffff',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ marginBottom: '40px' }}>
              <div style={{ fontSize: '16px', opacity: 0.9, fontWeight: '600', marginBottom: '12px' }}>
                ✨ {date}
              </div>
              <h1 style={{ fontSize: '44px', fontWeight: '900', margin: '0 0 12px 0', letterSpacing: '-0.03em', textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
                {workout.name}
              </h1>
              <div style={{ fontSize: '18px', opacity: 0.95, fontWeight: '600' }}>Crushed It! 🔥</div>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(20px)',
                borderRadius: '20px',
                padding: '30px',
                marginBottom: '24px',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div>
                  <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '6px', fontWeight: '600' }}>⏱️ TIME</div>
                  <div style={{ fontSize: '32px', fontWeight: '800' }}>{duration}</div>
                </div>
                <div>
                  <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '6px', fontWeight: '600' }}>📊 VOLUME</div>
                  <div style={{ fontSize: '32px', fontWeight: '800' }}>{volume}</div>
                </div>
                <div>
                  <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '6px', fontWeight: '600' }}>💪 SETS</div>
                  <div style={{ fontSize: '32px', fontWeight: '800' }}>{sets}</div>
                </div>
                <div>
                  <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '6px', fontWeight: '600' }}>🏆 PRS</div>
                  <div style={{ fontSize: '32px', fontWeight: '800' }}>{prs.length || '0'}</div>
                </div>
              </div>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(20px)',
                borderRadius: '20px',
                padding: '24px',
                marginBottom: '30px',
              }}
            >
              <div style={{ fontSize: '14px', marginBottom: '16px', textAlign: 'center', fontWeight: '600' }}>
                Muscles Trained
              </div>
              <div style={{ filter: 'brightness(1.15) contrast(1.05)' }}>
                <BodyMap load={muscleLoad} body={body} />
              </div>
            </div>

            <div style={{ textAlign: 'center', fontSize: '14px', fontWeight: '700', opacity: 0.8 }}>
              {appName}
            </div>
          </div>

          {/* Decorative circles */}
          <div style={{ position: 'absolute', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.1)', top: '-100px', right: '-50px' }} />
          <div style={{ position: 'absolute', width: '150px', height: '150px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.08)', bottom: '-75px', left: '-40px' }} />
        </div>
      )
    }

    return null
  }
)

WorkoutShareCard.displayName = 'WorkoutShareCard'

export default WorkoutShareCard
