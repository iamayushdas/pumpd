import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import Icon from './Icon';
import { Section, Row, Button } from './ui';

export function ProfileSettings() {
  const { user } = useStore();
  const toast = useUI(s => s.toast);
  const [profile, setProfile] = useState(null);
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      const data = await res.json();
      
      if (res.ok) {
        setProfile(data.profile);
        setHandle(data.profile.handle || '');
        setBio(data.profile.bio || '');
      }
    } catch (e) {
      console.error('Failed to load profile:', e);
    }
  };

  const handleSave = async () => {
    if (!handle.trim()) {
      toast('Handle is required');
      return;
    }

    if (!/^[a-z0-9_]{3,20}$/.test(handle.trim().toLowerCase())) {
      toast('Handle must be 3-20 characters, letters, numbers, and underscores only');
      return;
    }

    setLoading(true);

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

      toast('Profile updated');
      setEditing(false);
      loadProfile();
    } catch (e) {
      toast(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Section title="Social Profile">
      {profile ? (
        <>
          <Row
            icon="person"
            iconTint="var(--acc)"
            title="Handle"
            subtitle={profile.handle ? `@${profile.handle}` : 'Not set yet'}
            onClick={() => setEditing(!editing)}
          >
            {!editing && <Icon name="pencil" style={{ color: 'var(--label-3)', fontSize: '16px' }} />}
          </Row>
          
          {editing && (
            <div style={{ 
              padding: '14px 16px',
              borderTop: '0.5px solid var(--sep)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              backgroundColor: 'var(--surface-2)'
            }}>
              <div>
                <label style={{ 
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--label-2)',
                  marginBottom: '8px'
                }}>
                  Handle
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{
                    position: 'absolute',
                    left: '12px',
                    color: 'var(--label-3)',
                    fontSize: '15px',
                    fontWeight: 600
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
                      padding: '10px 12px 10px 32px',
                      border: `0.5px solid var(--sep)`,
                      borderRadius: 'var(--r)',
                      backgroundColor: 'var(--surface)',
                      color: 'var(--label)',
                      fontSize: '15px',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
                <div style={{ 
                  fontSize: '12px',
                  color: 'var(--label-3)',
                  marginTop: '6px'
                }}>
                  3-20 characters, lowercase, numbers & underscores
                </div>
              </div>

              <div>
                <label style={{ 
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--label-2)',
                  marginBottom: '8px'
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
                    minHeight: '76px',
                    padding: '10px 12px',
                    border: `0.5px solid var(--sep)`,
                    borderRadius: 'var(--r)',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--label)',
                    fontSize: '15px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
                <div style={{ 
                  textAlign: 'right',
                  fontSize: '12px',
                  color: 'var(--label-3)',
                  marginTop: '4px'
                }}>
                  {bio.length}/200
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', paddingTop: '2px' }}>
                <button
                  onClick={() => {
                    setHandle(profile.handle || '');
                    setBio(profile.bio || '');
                    setEditing(false);
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: 'transparent',
                    color: 'var(--label)',
                    border: `0.5px solid var(--sep)`,
                    borderRadius: 'var(--r)',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 140ms cubic-bezier(.32,.72,0,1)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-3)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: loading ? 'var(--surface-3)' : 'var(--acc)',
                    color: loading ? 'var(--label-3)' : 'var(--on-acc)',
                    border: 'none',
                    borderRadius: 'var(--r)',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'all 140ms cubic-bezier(.32,.72,0,1)'
                  }}
                  onMouseEnter={(e) => !loading && (e.currentTarget.style.filter = 'brightness(1.08)')}
                  onMouseLeave={(e) => !loading && (e.currentTarget.style.filter = 'brightness(1)')}
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {profile.handle && (
            <>
              <Row
                icon="users"
                iconTint="var(--blue)"
                title={`${profile.followerCount || 0} Followers`}
              />
              
              <Row
                icon="star"
                iconTint="var(--yellow)"
                title={`${profile.postCount || 0} Posts`}
              />
            </>
          )}
        </>
      ) : (
        <Row
          icon="person"
          iconTint="var(--acc)"
          title="Social Profile"
          subtitle="Set up your handle to join the community"
          onClick={() => window.location.hash = '#/handle-setup'}
        >
          <Icon name="chevronRight" style={{ color: 'var(--label-3)', fontSize: '16px' }} />
        </Row>
      )}
    </Section>
  );
}
