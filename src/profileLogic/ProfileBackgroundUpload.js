import React, { useState } from 'react';
import { getOptimizedImageProps } from '../utils/placeholderImage';
import axios from 'axios';
import './ProfileBackgroundUpload.css';

const ProfileBackgroundUpload = ({ currentBackground, onBackgroundUpdate }) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState('');
  const token = localStorage.getItem('token');

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Only JPEG, PNG, GIF, and WebP images are allowed');
      return;
    }

    setError('');
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    const fileInput = document.getElementById('background-upload');
    const file = fileInput?.files[0];
    
    if (!file) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('background', file);

    try {
      const response = await axios.post('/api/profile/background-upload', formData, {
        headers: {
          'x-auth-token': token,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (onBackgroundUpdate) {
        onBackgroundUpdate(response.data.backgroundPath);
      }
      
      setPreviewUrl(null);
      fileInput.value = '';
      setError('');
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.response?.data?.message || 'Failed to upload background');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Are you sure you want to remove your profile background?')) {
      return;
    }

    setUploading(true);
    try {
      await axios.delete('/api/profile/background', {
        headers: { 'x-auth-token': token }
      });

      if (onBackgroundUpdate) {
        onBackgroundUpdate(null);
      }
      
      setPreviewUrl(null);
    } catch (error) {
      console.error('Remove error:', error);
      setError('Failed to remove background');
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setPreviewUrl(null);
    setError('');
    const fileInput = document.getElementById('background-upload');
    if (fileInput) fileInput.value = '';
  };

  return (
    <div className="profile-background-upload">
      <h3>🖼️ Profile Background</h3>
      
      {currentBackground && !previewUrl && (
        <div className="current-background">
          <img 
            {...getOptimizedImageProps(currentBackground, { size: 800 })}
            alt="Current background" 
            className="background-preview"
          />
          <button 
            className="remove-btn"
            onClick={handleRemove}
            disabled={uploading}
          >
            🗑️ Remove Background
          </button>
        </div>
      )}

      {previewUrl && (
        <div className="preview-section">
          <img 
            {...getOptimizedImageProps(previewUrl, { size: 800 })}
            alt="Preview" 
            className="background-preview"
          />
          <div className="preview-actions">
            <button 
              className="upload-btn"
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : '✅ Upload'}
            </button>
            <button 
              className="cancel-btn"
              onClick={handleCancel}
              disabled={uploading}
            >
              ❌ Cancel
            </button>
          </div>
        </div>
      )}

      {!previewUrl && (
        <div className="upload-section">
          <input
            type="file"
            id="background-upload"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            onChange={handleFileSelect}
            className="file-input"
            hidden
          />
          <label htmlFor="background-upload" className="upload-label">
            <div className="upload-content">
              <span className="upload-icon">📷</span>
              <span className="upload-text">Choose Background Image</span>
              <span className="upload-hint">JPEG, PNG, GIF, WebP (Max 5MB)</span>
            </div>
          </label>
        </div>
      )}

      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}

      <div className="background-tips">
        <h4>💡 Tips for best results:</h4>
        <ul>
          <li>Use images at least 1920x400 pixels for best quality</li>
          <li>Landscape images work best for profile backgrounds</li>
          <li>Keep file size under 5MB</li>
          <li>Darker images work better with the profile text overlay</li>
        </ul>
      </div>
    </div>
  );
};

export default ProfileBackgroundUpload; 
