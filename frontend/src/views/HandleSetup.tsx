import { useState } from 'react';
import { useStore } from '../store/useStore';
import Icon from '../components/Icon';
import '../index.css';

export default function HandleSetup() {
  const { user } = useStore();
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!handle.trim()) {
      setError('Handle is required');
      return;
    }

    if (!/^[a-z0-9_]{3,20}$/.test(handle.trim().toLowerCase())) {
      setError('Handle must be 3-20 characters, letters, numbers, and underscores only');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: handle.trim().toLowerCase(),
          bio: bio.trim()
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      setSuccess(true);
      
      // Redirect after a short delay
      setTimeout(() => {
        window.location.hash = '#/feed';
      }, 1500);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className="view">
        <div style={{ 
          padding: '3rem 2rem',
          textAlign: 'center'
        }}>
          <div style={{ 
            fontSize: '4rem',
            marginBottom: '1rem'
          }}>
            ✅
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            Profile created!
          </h2>
          <p style={{ color: 'var(--label-3)' }}>
            Redirecting to your feed...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="view" style={{ paddingBottom: '5rem' }}>
      <div style={{ 
        padding: '1rem', 
        borderBottom: '1px solid var(--sep)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Create Your Handle</h1>
      </div>

      <div style={{ padding: '2rem 1rem' }}>
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <Icon name="user" style={{ fontSize: '3rem', color: 'var(--acc)', marginBottom: '1rem' }} />
          <p style={{ color: 'var(--label-3)' }}>
            Set up your pumpd handle to start sharing your gym journey
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ 
              padding: '1rem',
              marginBottom: '1rem',
              backgroundColor: 'rgba(255, 59, 48, 0.1)',
              color: 'var(--red)',
              borderRadius: '8px'
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ 
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 600
            }}>
              Handle *
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--label-3)',
                fontSize: '1rem'
              }}>
                @
              </span>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase())}
                placeholder="yourhandle"
                maxLength={20}
                style={{
                  width: '100%',
                  padding: '0.75rem 0.75rem 0.75rem 2rem',
                  border: '1px solid var(--sep)',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--label)',
                  fontSize: '1rem'
                }}
                required
              />
            </div>
            <div style={{ 
              fontSize: '0.875rem',
              color: 'var(--label-3)',
              marginTop: '0.5rem'
            }}>
              3-20 characters, letters, numbers, and underscores only
            </div>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ 
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 600
            }}>
              Bio (optional)
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell others about your fitness journey..."
              maxLength={200}
              style={{
                width: '100%',
                minHeight: '100px',
                padding: '0.75rem',
                border: '1px solid var(--sep)',
                borderRadius: '8px',
                backgroundColor: 'var(--bg)',
                color: 'var(--label)',
                fontSize: '1rem',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
            <div style={{ 
              textAlign: 'right',
              fontSize: '0.875rem',
              color: 'var(--label-3)',
              marginTop: '0.25rem'
            }}>
              {bio.length}/200
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              width: '100%',
              padding: '1rem',
              backgroundColor: saving ? 'var(--sep)' : 'var(--acc)',
              color: saving ? 'var(--label-3)' : 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? 'Creating...' : 'Create Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}
