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
    if (!confirm('Delete this post?')) return;
    
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete post');
      
      setPosts(prev => prev.filter(p => p.postId !== postId));
    } catch (e) {
      console.error('Delete error:', e);
      alert('Failed to delete post');
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  useEffect(() => {
    if (!hasMore || loading) return;
    
    const options = {
      root: null,
      rootMargin: '100px',
      threshold: 0.1
    };
    
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        const lastPost = posts[posts.length - 1];
        if (lastPost) {
          setLoading(true);
          loadFeed(lastPost.created);
        }
      }
    }, options);
    
    if (loadingRef.current) {
      observerRef.current.observe(loadingRef.current);
    }
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [posts, hasMore, loading]);

  return (
    <div className="narrow">
      {/* Under Construction Banner */}
      <div className="card" style={{ marginBottom: 16, background: 'color-mix(in srgb, var(--yellow) 14%, transparent)', color: 'var(--yellow)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Icon name="construction" style={{ flexShrink: 0, fontSize: 20 }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Under Construction</div>
          <div style={{ fontSize: 13, marginTop: 2, opacity: 0.8 }}>Feed features coming soon</div>
        </div>
      </div>

      {/* Header */}
      <div className="hdr" style={{ marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 750 }}>Feed</h1>
          <div className="sub" style={{ fontSize: 13.5, marginTop: 2 }}>
            Posts from those you follow
          </div>
        </div>
        <button
          className="iconbtn"
          onClick={() => window.location.hash = '#/new-post'}
          aria-label="New post"
          title="New post"
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
          <div style={{ color: 'var(--label-3)', marginBottom: 8 }}>No posts yet</div>
          <div style={{ color: 'var(--label-3)', fontSize: 13, marginBottom: 16 }}>
            Follow people to see their gym posts
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
            <PostCard 
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

function PostCard({ post, currentUserId, onLike, onDelete }) {
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

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      {/* Header */}
      <div className="row between" style={{ marginBottom: 10, alignItems: 'flex-start' }}>
        <a 
          href={`#/profile/${post.user?.handle}`}
          style={{ 
            display: 'flex',
            alignItems: 'center',
            textDecoration: 'none',
            color: 'inherit',
            flex: 1,
            minWidth: 0
          }}
        >
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'var(--surface-2)',
            marginRight: 10,
            overflow: 'hidden',
            flexShrink: 0
          }}>
            {post.user?.profilePhoto ? (
              <img 
                src={`/photo/${post.user.profilePhoto}/thumb`} 
                alt={post.user.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{ 
                width: '100%', 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                fontWeight: 600,
                color: 'var(--label-3)',
                fontSize: 16
              }}>
                {post.user?.name?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{post.user?.name}</div>
            <div style={{ fontSize: 13, color: 'var(--label-3)', marginTop: 2 }}>
              @{post.user?.handle} · {formatDate(post.created)}
            </div>
          </div>
        </a>
        
        {currentUserId === post.userId && (
          <button
            onClick={() => onDelete(post.postId)}
            className="iconbtn"
            style={{ marginLeft: 8 }}
            title="Delete post"
          >
            <Icon name="trash" />
          </button>
        )}
      </div>

      {/* Photo */}
      <div style={{ 
        marginBottom: 10,
        borderRadius: 'var(--r)',
        overflow: 'hidden',
        background: 'var(--surface-2)'
      }}>
        <img 
          src={`/photo/${post.photoId}`}
          alt="Post"
          style={{ 
            width: '100%',
            display: 'block',
            aspectRatio: '1'
          }}
          loading="lazy"
        />
      </div>

      {/* Actions */}
      <div style={{ marginBottom: 10 }}>
        <button
          onClick={() => onLike(post.postId, post.liked)}
          className="iconbtn"
          style={{ 
            color: post.liked ? 'var(--red)' : 'var(--label)',
            gap: 4,
            display: 'flex',
            alignItems: 'center',
            fontSize: 15
          }}
          title={post.liked ? 'Unlike' : 'Like'}
        >
          <Icon name={post.liked ? 'heartFill' : 'heart'} style={{ fontSize: 20 }} />
          {post.likeCount > 0 && (
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              {post.likeCount}
            </span>
          )}
        </button>
      </div>

      {/* Caption */}
      {post.caption && (
        <div style={{ lineHeight: 1.5, fontSize: 15, color: 'var(--label)' }}>
          <span style={{ fontWeight: 600, color: 'var(--acc)' }}>
            @{post.user?.handle}
          </span>
          {' '}
          {post.caption}
        </div>
      )}
    </div>
  );
}
