import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import Icon from '../components/Icon';
import '../index.css';

export default function Discover() {
  const { user } = useStore();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  const searchUsers = async (q) => {
    if (!q.trim()) {
      setUsers([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}&limit=30`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to search users');
      
      setUsers(data.users);
      setLoading(false);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  const handleFollow = async (userId, isFollowing) => {
    try {
      const endpoint = isFollowing ? '/api/unfollow' : '/api/follow';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      
      if (!res.ok) throw new Error('Failed to update follow status');
      
      setUsers(prev => prev.map(u => {
        if (u.id === userId) {
          return { ...u, isFollowing: !isFollowing };
        }
        return u;
      }));
    } catch (e) {
      console.error('Follow error:', e);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="narrow">
      {/* Header */}
      <div className="hdr" style={{ marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 750 }}>Discover</h1>
          <div className="sub" style={{ fontSize: 13.5, marginTop: 2 }}>
            Find people to follow
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or handle..."
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
              border: '0.5px solid var(--sep)',
              borderRadius: 'var(--r)',
              backgroundColor: 'var(--surface)',
              color: 'var(--label)',
              fontSize: '15px',
              fontFamily: 'inherit',
              boxSizing: 'border-box'
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--acc)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--sep)'}
          />
          <Icon 
            name="magnifier" 
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--label-3)',
              pointerEvents: 'none',
              fontSize: '16px'
            }}
          />
        </div>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 14, background: 'color-mix(in srgb, var(--red) 12%, transparent)', color: 'var(--red)' }}>
          <div className="row" style={{ gap: 8 }}>
            <Icon name="info" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 13 }}>{error}</div>
          </div>
        </div>
      )}

      {loading && query ? (
        <div className="card" style={{ marginBottom: 14, textAlign: 'center', padding: 40 }}>
          <div style={{ color: 'var(--label-3)' }}>Searching...</div>
        </div>
      ) : !searched ? (
        <div className="card" style={{ marginBottom: 14, textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center' }}>
            <Icon name="users" style={{ fontSize: 48, color: 'var(--label-3)', opacity: 0.3 }} />
          </div>
          <div style={{ color: 'var(--label)', fontWeight: 600, marginBottom: 4 }}>Find people to follow</div>
          <div style={{ color: 'var(--label-3)', fontSize: 13 }}>
            Search by name or @handle
          </div>
        </div>
      ) : users.length === 0 ? (
        <div className="card" style={{ marginBottom: 14, textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center' }}>
            <Icon name="users" style={{ fontSize: 48, color: 'var(--label-3)', opacity: 0.3 }} />
          </div>
          <div style={{ color: 'var(--label-3)', fontSize: 13 }}>No users found for "{query}"</div>
        </div>
      ) : (
        <div>
          {users.map(u => (
            <div key={u.id} className="card" style={{ marginBottom: 8 }}>
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <a
                  href={`#/profile/${u.handle}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    flex: 1,
                    textDecoration: 'none',
                    color: 'inherit',
                    minWidth: 0,
                    gap: 10
                  }}
                >
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    backgroundColor: 'var(--surface-2)',
                    overflow: 'hidden',
                    flexShrink: 0
                  }}>
                    {u.profilePhoto ? (
                      <img 
                        src={`/photo/${u.profilePhoto}/thumb`} 
                        alt={u.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ 
                        width: '100%', 
                        height: '100%', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        fontSize: 18,
                        fontWeight: 600,
                        color: 'var(--label-3)'
                      }}>
                        {u.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{u.name}</div>
                    <div style={{ 
                      fontSize: 13, 
                      color: 'var(--label-3)',
                      marginTop: 2
                    }}>
                      @{u.handle}
                    </div>
                    {u.bio && (
                      <div style={{ 
                        fontSize: 13, 
                        color: 'var(--label-3)',
                        marginTop: 4,
                        lineHeight: 1.4
                      }}>
                        {u.bio}
                      </div>
                    )}
                    {u.followerCount > 0 && (
                      <div style={{ 
                        fontSize: 12, 
                        color: 'var(--label-3)',
                        marginTop: 4
                      }}>
                        {u.followerCount} {u.followerCount === 1 ? 'follower' : 'followers'}
                      </div>
                    )}
                  </div>
                </a>

                {u.id !== user?.id && (
                  <button
                    onClick={() => handleFollow(u.id, u.isFollowing)}
                    className={`btn sm ${u.isFollowing ? 'ghost' : 'primary'}`}
                    style={{ marginLeft: 10, flexShrink: 0 }}
                  >
                    {u.isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
