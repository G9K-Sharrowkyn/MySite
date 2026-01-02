import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Toast from '../tournamentLogic/Toast';
import './AccountSettings.css';

const AccountSettings = () => {
  const [user, setUser] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [availableTimezones] = useState([
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Anchorage',
    'America/Honolulu',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Rome',
    'Europe/Madrid',
    'Europe/Warsaw',
    'Europe/Moscow',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Bangkok',
    'Asia/Singapore',
    'Asia/Shanghai',
    'Asia/Tokyo',
    'Asia/Seoul',
    'Australia/Sydney',
    'Australia/Melbourne',
    'Pacific/Auckland'
  ]);
  
  const token = localStorage.getItem('token');
  const navigate = useNavigate();

  const fetchUserData = useCallback(async () => {
    try {
      const response = await axios.get('/api/profile/me', {
        headers: { 'x-auth-token': token }
      });
      setUser(response.data);
      setTimezone(response.data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching user data:', error);
      setToast({ message: 'Error loading user data', type: 'error' });
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchUserData();
  }, [fetchUserData, navigate, token]);

  const handlePasswordChange = (e) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setToast({ message: 'New passwords do not match', type: 'error' });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setToast({ message: 'Password must be at least 6 characters', type: 'error' });
      return;
    }

    try {
      await axios.put('/api/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      }, {
        headers: { 'x-auth-token': token }
      });
      
      setToast({ message: 'Password changed successfully!', type: 'success' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Error changing password:', error);
      setToast({ message: error.response?.data?.msg || 'Error changing password', type: 'error' });
    }
  };

  const handleTimezoneSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await axios.put('/api/auth/update-timezone', {
        timezone: timezone
      }, {
        headers: { 'x-auth-token': token }
      });
      
      setToast({ message: 'Timezone updated successfully!', type: 'success' });
      fetchUserData();
    } catch (error) {
      console.error('Error updating timezone:', error);
      setToast({ message: error.response?.data?.msg || 'Error updating timezone', type: 'error' });
    }
  };

  const getTimezoneLabel = (tz) => {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        timeZoneName: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
      const parts = formatter.formatToParts(now);
      const timeZoneName = parts.find(p => p.type === 'timeZoneName')?.value || '';
      return `${tz.replace(/_/g, ' ')} (${timeZoneName})`;
    } catch (error) {
      return tz.replace(/_/g, ' ');
    }
  };

  if (loading) {
    return (
      <div className="account-settings">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="account-settings">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="settings-container">
        <div className="settings-header">
          <h1>⚙️ Account Settings</h1>
          <p className="username-display">Logged in as: <strong>{user?.username}</strong></p>
        </div>

        <div className="settings-section">
          <h2>🔒 Change Password</h2>
          <form onSubmit={handlePasswordSubmit} className="settings-form">
            <div className="form-group">
              <label>Current Password</label>
              <input
                type="password"
                name="currentPassword"
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
                required
                placeholder="Enter current password"
              />
            </div>

            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                name="newPassword"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                required
                placeholder="Enter new password (min 6 characters)"
              />
            </div>

            <div className="form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                name="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                required
                placeholder="Confirm new password"
              />
            </div>

            <button type="submit" className="btn-submit">
              Update Password
            </button>
          </form>
        </div>

        <div className="settings-section">
          <h2>🌍 Time Zone Settings</h2>
          <p className="section-description">
            Set your timezone to see tournament times in your local time.
            Current time in your timezone:{' '}
            <strong>
              {new Date().toLocaleString(undefined, {
                timeZone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
              })}
            </strong>
          </p>
          <form onSubmit={handleTimezoneSubmit} className="settings-form">
            <div className="form-group">
              <label>Select Your Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                required
              >
                {availableTimezones.map(tz => (
                  <option key={tz} value={tz}>
                    {getTimezoneLabel(tz)}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" className="btn-submit">
              Update Timezone
            </button>
          </form>
        </div>

        <div className="settings-section danger-zone">
          <h2>⚠️ Danger Zone</h2>
          <p className="section-description">
            Irreversible actions. Proceed with caution.
          </p>
          <button 
            className="btn-danger"
            onClick={() => setToast({ message: 'Account deletion not yet implemented', type: 'info' })}
          >
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;
