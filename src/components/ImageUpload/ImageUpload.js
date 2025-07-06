import React, { useState, useRef } from 'react';
import './ImageUpload.css';

const ImageUpload = ({ currentImage, onImageChange, className = '' }) => {
  const [preview, setPreview] = useState(currentImage || null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (file) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Proszę wybrać plik obrazu (JPG, PNG, GIF)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Plik jest za duży. Maksymalny rozmiar to 5MB.');
      return;
    }

    setUploading(true);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageDataUrl = e.target.result;
      setPreview(imageDataUrl);
      
      // Call the callback with the image data
      if (onImageChange) {
        onImageChange(imageDataUrl);
      }
      
      setUploading(false);
    };
    
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    handleFileSelect(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemove = () => {
    setPreview(null);
    if (onImageChange) {
      onImageChange(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`image-upload ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
      />
      
      {preview ? (
        <div className="image-preview">
          <img src={preview} alt="Preview" className="preview-image" />
          <div className="image-overlay">
            <button
              type="button"
              className="change-btn"
              onClick={handleClick}
              disabled={uploading}
            >
              📷 Zmień
            </button>
            <button
              type="button"
              className="remove-btn"
              onClick={handleRemove}
              disabled={uploading}
            >
              🗑️ Usuń
            </button>
          </div>
          {uploading && (
            <div className="upload-spinner">
              <div className="spinner"></div>
            </div>
          )}
        </div>
      ) : (
        <div
          className={`upload-area ${dragOver ? 'drag-over' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleClick}
        >
          <div className="upload-content">
            <div className="upload-icon">📷</div>
            <div className="upload-text">
              <p className="upload-primary">Kliknij lub przeciągnij zdjęcie</p>
              <p className="upload-secondary">JPG, PNG, GIF (max 5MB)</p>
            </div>
          </div>
          {uploading && (
            <div className="upload-spinner">
              <div className="spinner"></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ImageUpload;