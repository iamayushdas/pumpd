import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import Icon from '../components/Icon';
import '../index.css';

export default function UserProfile({ handle }) {
  const { user } = useStore();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [following, setFollowing] = useState(false);

  const isOwnProfile = user?.handle === handle;

  const loadProfile = async () => {
    try {
      const res = await fetch(`/api/profile/${handle}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to load profile');
      
      setProfile(data.profile);
      setFollowing(data.profile.isFollowing);
      setLoading(false);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  const loadPosts = async () => {
    if (!profile) return;
    
    try {
      const res = await fetch(`/api/posts?userId=${profile.id}&limit=50`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to load posts');
      
      setPosts(data.posts);
    } catch (e) {
      console.error('Failed to load posts:', e);
    }
  };

  const handleFollow = async () => {
    if (!profile || isOwnProfile) return;
    
    try {
      const endpoint = following ? '/api/unfollow' : '/api/follow';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id })
      });
      
      if (!res.ok) throw new Error('Failed to update follow status');
      
      setFollowing(!following);
      setProfile(prev => ({
        ...prev,
        followerCount: following ? prev.followerCount - 1 : prev.followerCount + 1
      }));
    } catch (e) {
      console.error('Follow error:', e);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [handle]);

  useEffect(() => {
    if (profile) {
      loadPosts();
    }
  }, [profile]);

  if (loading) {
    return (
      <div className="view">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--label-3)' }}>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="view">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--red)', marginBottom: '1rem' }}>{error}</p>
          <button onClick={() => { setError(null); setLoading(true); loadProfile(); }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="view" style={{ paddingBottom: '5rem' }}>
      {/* Header */}
      <div style={{ 
        padding: '1rem', 
        borderBottom: '1px solid var(--sep)',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        position: 'sticky',
        top: 0,
        backgroundColor: 'var(--bg)',
        zIndex: 10
      }}>
        <button
          onClick={() => window.history.back()}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--label)',
            fontSize: '1.5rem',
            cursor: 'pointer',
            padding: 0
          }}
        >
          <Icon name="chevronLeft" />
        </button>
        <div>
          <h1 style={{ fontSize: '1.25rem', margin: 0 }}>{profile?.name}</h1>
          <div style={{ fontSize: '0.875rem', color: 'var(--label-3)' }}>
            {profile?.postCount || 0} posts
          </div>
        </div>
      </div>

      {/* Profile Info */}
      <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--sep)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: 'var(--sep)',
            marginRight: '1rem',
            overflow: 'hidden',
            flexShrink: 0
          }}>
            {profile?.profilePhoto ? (
              <img 
                src={`/photo/${profile.profilePhoto}`} 
                alt={profile.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{ 
                width: '100%', 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                fontSize: '2rem',
                fontWeight: 600,
                color: 'var(--label-3)'
              }}>
                {profile?.name?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '1.5rem', margin: '0 0 0.25rem 0' }}>
              {profile?.name}
            </h2>
            <div style={{ 
              fontSize: '1rem', 
              color: 'var(--label-3)',
              marginBottom: '0.5rem'
            }}>
              @{profile?.handle}
            </div>
            
            {!isOwnProfile && (
              <button
                onClick={handleFollow}
                style={{
                  padding: '0.5rem 1.5rem',
                  backgroundColor: following ? 'transparent' : 'var(--acc)',
                  color: following ? 'var(--label)' : 'white',
                  border: following ? '1px solid var(--sep)' : 'none',
                  borderRadius: '20px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {following ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
        </div>

        {profile?.bio && (
          <p style={{ margin: '0 0 1rem 0', color: 'var(--label)' }}>
            {profile.bio}
          </p>
        )}

        {/* Stats */}
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <div>
            <span style={{ fontWeight: 600 }}>{profile?.postCount || 0}</span>
            {' '}
            <span style={{ color: 'var(--label-3)' }}>posts</span>
          </div>
          <a 
            href={`#/profile/${handle}/followers`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <span style={{ fontWeight: 600 }}>{profile?.followerCount || 0}</span>
            {' '}
            <span style={{ color: 'var(--label-3)' }}>followers</span>
          </a>
          <a 
            href={`#/profile/${handle}/following`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <span style={{ fontWeight: 600 }}>{profile?.followingCount || 0}</span>
            {' '}
            <span style={{ color: 'var(--label-3)' }}>following</span>
          </a>
        </div>
      </div>

      {/* Posts Grid */}
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '2px',
        backgroundColor: 'var(--sep)'
      }}>
        {posts.map(post => (
          <a
            key={post.postId}
            href={`#/post/${post.postId}`}
            style={{
              aspectRatio: '1',
              backgroundColor: 'var(--bg)',
              overflow: 'hidden',
              display: 'block',
              position: 'relative'
            }}
          >
            <img 
              src={`/photo/${post.photoId}`}
              alt="Post"
              style={{ 
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
              loading="lazy"
            />
            {post.likeCount > 0 && (
              <div style={{
                position: 'absolute',
                top: '0.5rem',
                right: '0.5rem',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                padding: '0.25rem 0.5rem',
                borderRadius: '12px',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}>
                <Icon name="heart-fill" />
                {post.likeCount}
              </div>
            )}
          </a>
        ))}
      </div>

      {posts.length === 0 && (
        <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--label-3)' }}>
            {isOwnProfile ? 'No posts yet. Share your first workout!' : 'No posts yet.'}
          </p>
        </div>
      )}
    </div>
  );
}
