import React, { useEffect } from 'react';
import './Modal.css';

const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  type = 'info', // 'info', 'warning', 'error', 'success'
  showConfirmButton = true,
  showCancelButton = true,
  confirmButtonType = 'primary' // 'primary', 'danger', 'success'
}) => {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onClose();
  };

  const getIcon = () => {
    switch (type) {
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      case 'success':
        return '✅';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className={`modal-container modal-${type}`}>
        <div className="modal-header">
          <div className="modal-title">
            <span className="modal-icon">{getIcon()}</span>
            <h3>{title}</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        
        <div className="modal-content">
          {children}
        </div>
        
        {(showConfirmButton || showCancelButton) && (
          <div className="modal-actions">
            {showCancelButton && (
              <button 
                className="modal-btn modal-btn-secondary"
                onClick={handleCancel}
              >
                {cancelText}
              </button>
            )}
            {showConfirmButton && (
              <button 
                className={`modal-btn modal-btn-${confirmButtonType}`}
                onClick={handleConfirm}
              >
                {confirmText}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
