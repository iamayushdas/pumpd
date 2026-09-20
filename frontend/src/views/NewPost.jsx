import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { compressPhoto, validatePhoto } from '../lib/photoCompression';
import Icon from '../components/Icon';
import '../index.css';

export default function NewPost() {
  const { user, ready } = useStore();
  const toast = useUI(s => s.toast);
  const [caption, setCaption] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const fileInputRef = useRef(null);

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

  // Show loading state while app boots or profile data loads
  if (!ready || profileLoading) {
    return (
      <div className="narrow">
        <div style={{ marginTop: 40, textAlign: 'center', color: 'var(--label-3)' }}>
          Loading...
        </div>
      </div>
    );
  }

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validatePhoto(file);
    if (!validation.valid) {
      toast(validation.error);
      return;
    }

    setError(null);
    setPhoto(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!photo) {
      toast('Please select a photo');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Compress photo
      const compressed = await compressPhoto(photo);
      
      // Upload photo with base64 JSON
      const uploadRes = await fetch('/api/upload/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: compressed })
      });
      
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Failed to upload photo');
      
      // Create post
      const postRes = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoId: uploadData.photoId,
          caption: caption.trim()
        })
      });
      
      const postData = await postRes.json();
      if (!postRes.ok) throw new Error(postData.error || 'Failed to create post');
      
      toast('Post shared!');
      // Navigate back to feed
      window.location.hash = '#/feed';
    } catch (e) {
      setError(e.message);
      toast(e.message);
      setUploading(false);
    }
  };

  const handleRemovePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!profile?.handle) {
    return (
      <div className="narrow">
        <div className="card" style={{ marginBottom: 14, textAlign: 'center', padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <Icon name="person" style={{ fontSize: 48, color: 'var(--label-3)', opacity: 0.3 }} />
          </div>
          <p style={{ marginBottom: 14, color: 'var(--label-3)' }}>Set up your handle first to create posts</p>
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
        <h1 style={{ fontSize: 28, fontWeight: 750, margin: 0, flex: 1 }}>New Post</h1>
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
        {/* Photo Upload */}
        {!photoPreview ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="card"
            style={{
              padding: 32,
              textAlign: 'center',
              cursor: 'pointer',
              border: '1px dashed var(--sep)',
              transition: 'border 140ms',
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--acc)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--sep)'}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <Icon name="image" style={{ fontSize: 48, color: 'var(--label-3)', opacity: 0.3 }} />
            </div>
            <p style={{ margin: '0 0 6px 0', color: 'var(--label-3)', fontSize: 16, fontWeight: 500 }}>
              Tap to select a photo
            </p>
            <p style={{ 
              fontSize: 13, 
              color: 'var(--label-3)', 
              margin: 0,
              opacity: 0.7
            }}>
              Photos will be compressed automatically
            </p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative', margin: 0 }}>
            <img 
              src={photoPreview} 
              alt="Preview"
              style={{ 
                width: '100%',
                display: 'block',
                aspectRatio: '1'
              }}
            />
            <button
              type="button"
              onClick={handleRemovePhoto}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: 'rgba(0, 0, 0, 0.7)',
                border: 'none',
                color: 'white',
                width: 36,
                height: 36,
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                transition: 'background 140ms'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.9)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.7)'}
            >
              <Icon name="xmark" />
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handlePhotoSelect}
          style={{ display: 'none' }}
        />

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
            placeholder="Share something about your workout..."
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
          disabled={!photo || uploading}
          className={`btn ${photo && !uploading ? 'primary' : 'ghost'}`}
          style={{
            width: '100%',
            height: 46,
            fontSize: 15,
            fontWeight: 600,
            opacity: photo && !uploading ? 1 : 0.5,
            margin: 0
          }}
        >
          {uploading ? 'Posting...' : 'Share Post'}
        </button>
      </form>
    </div>
  );
}
