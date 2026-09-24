import { useState, useRef, useEffect } from 'react';
import Icon from './Icon';
import { cropImage } from '../lib/imageCrop';
import '../index.css';

export function CropModal({ imageSrc, onCrop, onCancel }) {
  const [cropArea, setCropArea] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(false);
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      if (containerRef.current && imageRef.current) {
        const container = containerRef.current;
        const displayWidth = container.clientWidth;
        const displayHeight = container.clientHeight;
        
        // Calculate initial square crop area (center)
        const size = Math.min(displayWidth, displayHeight) * 0.8;
        const x = (displayWidth - size) / 2;
        const y = (displayHeight - size) / 2;
        
        setCropArea({ x, y, width: size, height: size });
      }
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const handleMouseDown = (e) => {
    if (e.button !== 0 || !cropArea) return;
    
    // Check if clicking on resize handle
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if within crop area (for dragging)
    if (x >= cropArea.x && x <= cropArea.x + cropArea.width &&
        y >= cropArea.y && y <= cropArea.y + cropArea.height) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !cropArea || !containerRef.current) return;

    const container = containerRef.current;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    let newX = cropArea.x + dx;
    let newY = cropArea.y + dy;

    // Constrain crop area within container
    newX = Math.max(0, Math.min(newX, container.clientWidth - cropArea.width));
    newY = Math.max(0, Math.min(newY, container.clientHeight - cropArea.height));

    setCropArea({ ...cropArea, x: newX, y: newY });
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleResize = (edge, e) => {
    if (!cropArea || !containerRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const container = containerRef.current;
    const startX = e.clientX;
    const startY = e.clientY;
    const startArea = { ...cropArea };

    const handleMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      let newArea = { ...startArea };

      if (edge === 'right') {
        newArea.width = Math.max(60, Math.min(startArea.width + dx, container.clientWidth - startArea.x));
        newArea.height = newArea.width; // Keep square
      } else if (edge === 'bottom') {
        newArea.height = Math.max(60, Math.min(startArea.height + dy, container.clientHeight - startArea.y));
        newArea.width = newArea.height; // Keep square
      } else if (edge === 'bottom-right') {
        const newWidth = Math.max(60, Math.min(startArea.width + dx, container.clientWidth - startArea.x));
        const newHeight = Math.max(60, Math.min(startArea.height + dy, container.clientHeight - startArea.y));
        newArea.width = Math.min(newWidth, newHeight);
        newArea.height = newArea.width; // Keep square
      }

      setCropArea(newArea);
    };

    const handleEnd = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
  };

  const handleCrop = async () => {
    if (!cropArea || !imageRef.current) return;

    setLoading(true);
    try {
      const img = new Image();
      img.onload = async () => {
        const scaleX = img.width / imageRef.current.naturalWidth;
        const scaleY = img.height / imageRef.current.naturalHeight;

        const scaledCropArea = {
          x: cropArea.x * scaleX,
          y: cropArea.y * scaleY,
          width: cropArea.width * scaleX,
          height: cropArea.height * scaleY,
        };

        const croppedBlob = await cropImage(imageSrc, scaledCropArea);
        onCrop(croppedBlob);
      };
      img.src = imageSrc;
    } catch (e) {
      console.error('Crop failed:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      background: 'rgba(0, 0, 0, 0.9)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(12px)'
      }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#fff' }}>Crop Photo</h2>
        <button
          onClick={onCancel}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            fontSize: 24,
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Icon name="xmark" />
        </button>
      </div>

      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '90vw',
          height: '90vh',
          maxWidth: '500px',
          maxHeight: '500px',
          marginTop: 50,
          marginBottom: 80,
          cursor: isDragging ? 'grabbing' : 'grab',
          overflow: 'hidden'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          ref={imageRef}
          src={imageSrc}
          alt="Crop"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            userSelect: 'none',
            pointerEvents: 'none'
          }}
        />

        {cropArea && (
          <>
            {/* Overlay darken areas outside crop */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              boxShadow: `inset 0 0 0 9999px rgba(0, 0, 0, 0.5)`,
              borderRadius: 0,
              pointerEvents: 'none'
            }} />

            {/* Crop frame with grid */}
            <div
              style={{
                position: 'absolute',
                left: cropArea.x,
                top: cropArea.y,
                width: cropArea.width,
                height: cropArea.height,
                border: '2px solid #fff',
                borderRadius: 8,
                boxShadow: '0 0 0 1px rgba(255,255,255,0.3)',
                pointerEvents: 'auto'
              }}
            >
              {/* Grid lines */}
              <div style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                opacity: 0.3
              }}>
                {[1, 2].map((i) => (
                  <div
                    key={`v${i}`}
                    style={{
                      position: 'absolute',
                      left: `${(i * 100) / 3}%`,
                      top: 0,
                      width: 1,
                      height: '100%',
                      background: '#fff'
                    }}
                  />
                ))}
                {[1, 2].map((i) => (
                  <div
                    key={`h${i}`}
                    style={{
                      position: 'absolute',
                      top: `${(i * 100) / 3}%`,
                      left: 0,
                      width: '100%',
                      height: 1,
                      background: '#fff'
                    }}
                  />
                ))}
              </div>

              {/* Resize handle */}
              <div
                style={{
                  position: 'absolute',
                  right: -6,
                  bottom: -6,
                  width: 24,
                  height: 24,
                  background: '#fff',
                  border: '2px solid rgba(0,0,0,0.5)',
                  borderRadius: '50%',
                  cursor: 'nwse-resize',
                  zIndex: 10
                }}
                onMouseDown={(e) => handleResize('bottom-right', e)}
              />
            </div>
          </>
        )}
      </div>

      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '16px',
        display: 'flex',
        gap: 8,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(12px)'
      }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 8,
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 140ms'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
        >
          Cancel
        </button>
        <button
          onClick={handleCrop}
          disabled={loading}
          style={{
            flex: 1,
            padding: '12px 16px',
            background: '#30d158',
            border: 'none',
            borderRadius: 8,
            color: '#000',
            fontSize: 15,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            transition: 'all 140ms'
          }}
          onMouseEnter={(e) => !loading && (e.currentTarget.style.background = '#27c74a')}
          onMouseLeave={(e) => !loading && (e.currentTarget.style.background = '#30d158')}
        >
          {loading ? 'Cropping...' : 'Crop'}
        </button>
      </div>
    </div>
  );
}
