import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import Icon from '../components/Icon';
import '../index.css';

export default function Feed() {
  const { user } = useStore();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const observerRef = useRef(null);
  const loadingRef = useRef(null);

  const loadFeed = async (before = null) => {
    try {
      const url = before ? `/api/feed?limit=20&before=${before}` : '/api/feed?limit=20';
      const res = await fetch(url);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to load feed');
      
      if (before) {
        setPosts(prev => [...prev, ...data.posts]);
      } else {
        setPosts(data.posts);
      }
      
      setHasMore(data.hasMore);
      setLoading(false);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  const handleLike = async (postId, isLiked) => {
    try {
      const endpoint = isLiked ? `/api/posts/${postId}/unlike` : `/api/posts/${postId}/like`;
      const res = await fetch(endpoint, { method: 'POST' });
      
      if (!res.ok) throw new Error('Failed to update like');
      
      setPosts(prev => prev.map(p => {
        if (p.postId === postId) {
          return {
            ...p,
            liked: !isLiked,
            likeCount: isLiked ? p.likeCount - 1 : p.likeCount + 1
          };
        }
        return p;
      }));
    } catch (e) {
      console.error('Like error:', e);
    }
  };

  const handleDelete = async (postId) => {
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete post');
      setPosts(prev => prev.filter(p => p.postId !== postId));
    } catch (e) {
      console.error('Delete error:', e);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading && posts.length > 0) {
        const lastPost = posts[posts.length - 1];
        loadFeed(lastPost.created);
      }
    });

    if (loadingRef.current) {
      observer.observe(loadingRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [posts, hasMore, loading]);

  return (
    <div className="narrow">
      {/* Header */}
      <div className="hdr" style={{ marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 750 }}>Feed</h1>
          <div className="sub" style={{ fontSize: 13.5, marginTop: 2 }}>
            Workout stats from people you follow
          </div>
        </div>
        <button
          className="iconbtn"
          onClick={() => window.location.hash = '#/new-post'}
          aria-label="Share stats"
          title="Share stats"
        >
          <Icon name="plusCircle" />
        </button>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 14, background: 'color-mix(in srgb, var(--red) 12%, transparent)', color: 'var(--red)' }}>
          <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
            <Icon name="info" style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600 }}>Error loading feed</div>
              <div style={{ fontSize: 13, marginTop: 4, opacity: 0.8 }}>{error}</div>
            </div>
          </div>
        </div>
      )}

      {loading && posts.length === 0 ? (
        <div className="card" style={{ marginBottom: 14, textAlign: 'center', padding: 40 }}>
          <div style={{ color: 'var(--label-3)' }}>Loading feed...</div>
        </div>
      ) : posts.length === 0 ? (
        <div className="card" style={{ marginBottom: 14, textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center' }}>
            <Icon name="users" style={{ fontSize: 48, color: 'var(--label-3)', opacity: 0.3 }} />
          </div>
          <div style={{ color: 'var(--label-3)', marginBottom: 8 }}>No stats shared yet</div>
          <div style={{ color: 'var(--label-3)', fontSize: 13, marginBottom: 16 }}>
            Follow people to see their workout stats
          </div>
          <button
            className="btn primary sm"
            onClick={() => window.location.hash = '#/discover'}
          >
            Discover Users →
          </button>
        </div>
      ) : (
        <>
          {posts.map(post => (
            <StatsCard 
              key={post.postId} 
              post={post} 
              currentUserId={user?.id}
              onLike={handleLike}
              onDelete={handleDelete}
            />
          ))}
          
          {hasMore && (
            <div ref={loadingRef} style={{ textAlign: 'center', padding: 20, marginTop: 10 }}>
              <div style={{ color: 'var(--label-3)', fontSize: 13 }}>Loading more...</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatsCard({ post, currentUserId, onLike, onDelete }) {
  const formatDate = (iso) => {
    const date = new Date(iso);
    const now = Date.now();
    const diff = now - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  const getMetricLabel = (metric) => {
    const labels = {
      volume: 'Total Volume',
      strength: 'Max Weight',
      endurance: 'Exercises',
      duration: 'Duration'
    };
    return labels[metric] || metric;
  };

  const getMetricValue = (metric, stats) => {
    if (!stats) return '0';
    switch(metric) {
      case 'volume':
        return `${(stats.volume || 0).toLocaleString()} lbs`;
      case 'strength':
        return `${stats.maxWeight || 0} lbs`;
      case 'endurance':
        return `${stats.exercises || 0} exercises`;
      case 'duration':
        return `${stats.duration || 0} min`;
      default:
        return '';
    }
  };

  const getMetricIcon = (metric) => {
    const icons = {
      volume: 'barbell',
      strength: 'dumbbell',
      endurance: 'flame',
      duration: 'timer'
    };
    return icons[metric] || 'chart';
  };

  // Guard against undefined stats
  if (!post.stats) {
    return null;
  }

  const stats = post.stats || {};

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'var(--acc-soft)',
            color: 'var(--acc)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18
          }}>
            <Icon name="figureStrength" />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--label)' }}>
              {post.user?.name || 'Unknown'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--label-3)', marginTop: 2 }}>
              @{post.user?.handle} · {formatDate(post.created)}
            </div>
          </div>
        </div>
        {post.userId === currentUserId && (
          <button
            onClick={() => onDelete(post.postId)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--label-3)',
              cursor: 'pointer',
              padding: 8,
              fontSize: 16
            }}
          >
            <Icon name="trash" />
          </button>
        )}
      </div>

      {/* Main Stat Highlight */}
      <div style={{
        background: 'var(--acc-soft)',
        padding: '16px',
        borderRadius: 'var(--r)',
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }}>
        <div style={{
          fontSize: 28,
          color: 'var(--acc)'
        }}>
          <Icon name={getMetricIcon(post.metric)} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--acc)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            {getMetricLabel(post.metric)}
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--acc)', marginTop: 2 }}>
            {getMetricValue(post.metric, stats)}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div style={{ padding: '10px', background: 'var(--surface-2)', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--label-2)', marginBottom: 4 }}>Volume</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--label)' }}>
            {(stats.volume || 0).toLocaleString()} lbs
          </div>
        </div>
        <div style={{ padding: '10px', background: 'var(--surface-2)', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--label-2)', marginBottom: 4 }}>Max Weight</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--label)' }}>
            {stats.maxWeight || 0} lbs
          </div>
        </div>
        <div style={{ padding: '10px', background: 'var(--surface-2)', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--label-2)', marginBottom: 4 }}>Exercises</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--label)' }}>
            {stats.exercises || 0}
          </div>
        </div>
        <div style={{ padding: '10px', background: 'var(--surface-2)', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--label-2)', marginBottom: 4 }}>Duration</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--label)' }}>
            {stats.duration || 0} min
          </div>
        </div>
      </div>

      {/* Caption */}
      {post.caption && (
        <div style={{ fontSize: 14, color: 'var(--label)', marginBottom: 12, lineHeight: 1.4 }}>
          {post.caption}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '0.5px solid var(--sep)', paddingTop: 12 }}>
        <button
          onClick={() => onLike(post.postId, post.liked)}
          style={{
            background: 'none',
            border: 'none',
            color: post.liked ? 'var(--red)' : 'var(--label-2)',
            cursor: 'pointer',
            padding: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 14,
            fontWeight: 500,
            transition: 'color 140ms'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = post.liked ? 'var(--red)' : 'var(--label)'}
          onMouseLeave={(e) => e.currentTarget.style.color = post.liked ? 'var(--red)' : 'var(--label-2)'}
        >
          <Icon name={post.liked ? 'heartFill' : 'heart'} />
          {post.likeCount > 0 && <span>{post.likeCount}</span>}
        </button>
      </div>
    </div>
  );
}
