import { useState, useRef, useEffect } from 'react';
import './ImageUploadCrop.css';

interface Props {
  onImageSelected: (croppedImage: string) => void;
  initialImage?: string;
  aspectRatio?: number;
}

export function ImageUploadCrop({ onImageSelected, initialImage, aspectRatio = 4 / 3 }: Props) {
  const [image, setImage] = useState<string | null>(initialImage || null);
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (image && imageRef.current && canvasRef.current) {
      applyCrop();
    }
  }, [crop, image]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setImage(event.target?.result as string);
        // Initialize crop to center
        const cropHeight = img.width / aspectRatio;
        const cropWidth = img.width;
        setCrop({
          x: 0,
          y: Math.max(0, (img.height - cropHeight) / 2),
          width: cropWidth,
          height: cropHeight,
        });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !imageRef.current || !containerRef.current) return;

    const img = imageRef.current;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;

    const deltaX = (e.clientX - dragStart.x) * scaleX;
    const deltaY = (e.clientY - dragStart.y) * scaleY;

    setCrop((prev) => {
      const newX = Math.max(0, Math.min(img.naturalWidth - prev.width, prev.x + deltaX));
      const newY = Math.max(0, Math.min(img.naturalHeight - prev.height, prev.y + deltaY));
      return { ...prev, x: newX, y: newY };
    });

    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoom = (delta: number) => {
    if (!imageRef.current) return;

    const img = imageRef.current;
    setCrop((prev) => {
      const newWidth = Math.max(100, Math.min(img.naturalWidth, prev.width + delta));
      const newHeight = newWidth / aspectRatio;

      // Keep crop centered
      const centerX = prev.x + prev.width / 2;
      const centerY = prev.y + prev.height / 2;
      const newX = Math.max(0, Math.min(img.naturalWidth - newWidth, centerX - newWidth / 2));
      const newY = Math.max(0, Math.min(img.naturalHeight - newHeight, centerY - newHeight / 2));

      return { x: newX, y: newY, width: newWidth, height: newHeight };
    });
  };

  const applyCrop = () => {
    if (!imageRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to desired output (max 800px width)
    const maxWidth = 800;
    const scale = maxWidth / crop.width;
    canvas.width = maxWidth;
    canvas.height = crop.height * scale;

    // Draw cropped image
    ctx.drawImage(
      imageRef.current,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      canvas.width,
      canvas.height
    );

    // Get data URL
    const croppedImage = canvas.toDataURL('image/jpeg', 0.85);
    onImageSelected(croppedImage);
  };

  return (
    <div className="image-upload-crop">
      {!image ? (
        <div className="upload-zone">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            id="image-upload"
            style={{ display: 'none' }}
          />
          <label htmlFor="image-upload" className="upload-label">
            <div className="upload-icon">📷</div>
            <p className="upload-text">Click to upload an image</p>
            <p className="upload-hint">JPG, PNG, or GIF</p>
          </label>
        </div>
      ) : (
        <div className="crop-container">
          <div
            ref={containerRef}
            className="crop-preview"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img
              ref={imageRef}
              src={image}
              alt="Preview"
              className="preview-image"
              draggable={false}
            />
            {imageRef.current && (
              <div
                className="crop-overlay"
                style={{
                  left: `${(crop.x / imageRef.current.naturalWidth) * 100}%`,
                  top: `${(crop.y / imageRef.current.naturalHeight) * 100}%`,
                  width: `${(crop.width / imageRef.current.naturalWidth) * 100}%`,
                  height: `${(crop.height / imageRef.current.naturalHeight) * 100}%`,
                }}
              />
            )}
          </div>

          <div className="crop-controls">
            <button
              type="button"
              className="zoom-btn"
              onClick={() => handleZoom(-50)}
            >
              ➖ Zoom Out
            </button>
            <button
              type="button"
              className="zoom-btn"
              onClick={() => handleZoom(50)}
            >
              ➕ Zoom In
            </button>
            <button
              type="button"
              className="change-btn"
              onClick={() => setImage(null)}
            >
              🔄 Change Image
            </button>
          </div>

          <p className="crop-hint">💡 Drag to reposition • Use zoom to adjust size</p>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
