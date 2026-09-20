import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import Icon from '../components/Icon';
import '../index.css';

export default function NewPost() {
  const { user, ready, S } = useStore();
  const toast = useUI(s => s.toast);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [caption, setCaption] = useState('');
  const [selectedMetric, setSelectedMetric] = useState('strength');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(null);

  // Load user profile to check for handle
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        setProfileLoading(false);
        return;
      }
      
      try {
        const res = await fetch('/api/profile');
        const data = await res.json();
        if (res.ok) {
          setProfile(data.profile);
        }
      } catch (e) {
        console.error('Failed to load profile:', e);
      } finally {
        setProfileLoading(false);
      }
    };

    if (ready) {
      loadProfile();
    }
  }, [user, ready]);

  // Get latest workout stats
  const getLatestStats = () => {
    if (!S.workouts || S.workouts.length === 0) return null;
    
    const latestWorkout = S.workouts[S.workouts.length - 1];
    if (!latestWorkout) return null;

    let totalVolume = 0;
    let maxWeight = 0;
    let exerciseCount = 0;
    let setCount = 0;

    if (latestWorkout.entries) {
      latestWorkout.entries.forEach(entry => {
        if (entry.sets) {
          setCount += entry.sets.length;
          exerciseCount++;
          
          entry.sets.forEach(set => {
            if (set.w && set.r) {
              totalVolume += (set.w * set.r);
              maxWeight = Math.max(maxWeight, set.w);
            }
          });
        }
      });
    }

    return {
      date: latestWorkout.d,
      volume: totalVolume,
      maxWeight,
      exercises: exerciseCount,
      sets: setCount,
      duration: latestWorkout.min || 0
    };
  };

  const stats = getLatestStats();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!stats) {
      toast('No workout data to share');
      return;
    }

    setPosting(true);
    setError(null);

    try {
      const postRes = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'stats',
          metric: selectedMetric,
          stats: {
            date: stats.date,
            volume: stats.volume,
            maxWeight: stats.maxWeight,
            exercises: stats.exercises,
            sets: stats.sets,
            duration: stats.duration
          },
          caption: caption.trim()
        })
      });
      
      const postData = await postRes.json();
      if (!postRes.ok) throw new Error(postData.error || 'Failed to create post');
      
      toast('Stats shared!');
      // Navigate back to feed
      window.location.hash = '#/feed';
    } catch (e) {
      setError(e.message);
      toast(e.message);
      setPosting(false);
    }
  };

  // Show loading state while app boots or profile loads
  if (!ready || profileLoading) {
    return (
      <div className="narrow">
        <div style={{ marginTop: 40, textAlign: 'center', color: 'var(--label-3)' }}>
          Loading...
        </div>
      </div>
    );
  }

  if (!profile?.handle) {
    return (
      <div className="narrow">
        <div className="card" style={{ marginBottom: 14, textAlign: 'center', padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <Icon name="person" style={{ fontSize: 48, color: 'var(--label-3)', opacity: 0.3 }} />
          </div>
          <p style={{ marginBottom: 14, color: 'var(--label-3)' }}>Set up your handle first to share stats</p>
          <a 
            href="#/settings" 
            className="btn primary sm"
          >
            Go to Settings
          </a>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="narrow">
        <div className="card" style={{ marginBottom: 14, textAlign: 'center', padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <Icon name="chart" style={{ fontSize: 48, color: 'var(--label-3)', opacity: 0.3 }} />
          </div>
          <p style={{ marginBottom: 14, color: 'var(--label-3)', fontWeight: 600 }}>No workout to share</p>
          <p style={{ marginBottom: 14, color: 'var(--label-3)', fontSize: 13 }}>Complete a workout first to share your stats</p>
          <a 
            href="#/home" 
            className="btn primary sm"
          >
            Start Workout
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="narrow">
      {/* Header */}
      <div className="hdr" style={{ marginBottom: 22 }}>
        <button
          onClick={() => window.history.back()}
          className="iconbtn"
          aria-label="Back"
          title="Back"
        >
          <Icon name="chevronLeft" />
        </button>
        <h1 style={{ fontSize: 28, fontWeight: 750, margin: 0, flex: 1 }}>Share Stats</h1>
        <div style={{ width: 24 }} />
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 16, background: 'color-mix(in srgb, var(--red) 12%, transparent)', color: 'var(--red)' }}>
          <div className="row" style={{ gap: 8 }}>
            <Icon name="info" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 13 }}>{error}</div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Stats Card */}
        <div className="card" style={{ margin: 0 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-2)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Workout Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: '12px', background: 'var(--surface-2)', borderRadius: 'var(--r)' }}>
                <div style={{ fontSize: 12, color: 'var(--label-2)', marginBottom: 4 }}>Total Volume</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--label)' }}>{stats.volume.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--label-3)', marginTop: 2 }}>lbs</div>
              </div>
              <div style={{ padding: '12px', background: 'var(--surface-2)', borderRadius: 'var(--r)' }}>
                <div style={{ fontSize: 12, color: 'var(--label-2)', marginBottom: 4 }}>Max Weight</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--label)' }}>{stats.maxWeight.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--label-3)', marginTop: 2 }}>lbs</div>
              </div>
              <div style={{ padding: '12px', background: 'var(--surface-2)', borderRadius: 'var(--r)' }}>
                <div style={{ fontSize: 12, color: 'var(--label-2)', marginBottom: 4 }}>Exercises</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--label)' }}>{stats.exercises}</div>
                <div style={{ fontSize: 11, color: 'var(--label-3)', marginTop: 2 }}>completed</div>
              </div>
              <div style={{ padding: '12px', background: 'var(--surface-2)', borderRadius: 'var(--r)' }}>
                <div style={{ fontSize: 12, color: 'var(--label-2)', marginBottom: 4 }}>Duration</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--label)' }}>{stats.duration}</div>
                <div style={{ fontSize: 11, color: 'var(--label-3)', marginTop: 2 }}>minutes</div>
              </div>
            </div>
          </div>
        </div>

        {/* Metric Selection */}
        <div className="card" style={{ margin: 0 }}>
          <label style={{ 
            display: 'block',
            marginBottom: 10,
            fontWeight: 600,
            fontSize: 14,
            color: 'var(--label)'
          }}>
            Highlight Metric
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { id: 'volume', label: 'Total Volume', icon: 'barbell' },
              { id: 'strength', label: 'Max Weight', icon: 'dumbbell' },
              { id: 'endurance', label: 'Exercises', icon: 'fire' },
              { id: 'duration', label: 'Duration', icon: 'timer' }
            ].map(metric => (
              <button
                key={metric.id}
                type="button"
                onClick={() => setSelectedMetric(metric.id)}
                style={{
                  padding: '12px',
                  background: selectedMetric === metric.id ? 'var(--acc)' : 'var(--surface-2)',
                  color: selectedMetric === metric.id ? 'var(--on-acc)' : 'var(--label)',
                  border: 'none',
                  borderRadius: 'var(--r)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13,
                  transition: 'all 140ms',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
                onMouseEnter={(e) => {
                  if (selectedMetric !== metric.id) {
                    e.currentTarget.style.background = 'var(--surface-3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedMetric !== metric.id) {
                    e.currentTarget.style.background = 'var(--surface-2)';
                  }
                }}
              >
                <Icon name={metric.icon} style={{ fontSize: 16 }} />
                {metric.label}
              </button>
            ))}
          </div>
        </div>

        {/* Caption */}
        <div className="card" style={{ padding: 16, margin: 0 }}>
          <label style={{ 
            display: 'block',
            marginBottom: 10,
            fontWeight: 600,
            fontSize: 14,
            color: 'var(--label)'
          }}>
            Caption (optional)
          </label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="How are you feeling? Any PRs or achievements?"
            maxLength={500}
            style={{
              width: '100%',
              minHeight: 96,
              padding: 12,
              border: '0.5px solid var(--sep)',
              borderRadius: 'var(--r)',
              backgroundColor: 'var(--surface-2)',
              color: 'var(--label)',
              fontSize: 15,
              fontFamily: 'inherit',
              resize: 'vertical',
              boxSizing: 'border-box',
              lineHeight: 1.4
            }}
          />
          <div style={{ 
            textAlign: 'right',
            fontSize: 12,
            color: 'var(--label-3)',
            marginTop: 8
          }}>
            {caption.length}/500
          </div>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={posting}
          className={`btn ${!posting ? 'primary' : 'ghost'}`}
          style={{
            width: '100%',
            height: 46,
            fontSize: 15,
            fontWeight: 600,
            opacity: !posting ? 1 : 0.5,
            margin: 0
          }}
        >
          {posting ? 'Sharing...' : 'Share Stats'}
        </button>
      </form>
    </div>
  );
}
