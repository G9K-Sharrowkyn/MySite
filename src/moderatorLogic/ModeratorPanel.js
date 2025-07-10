import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './ModeratorPanel.css';

const ModeratorPanel = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fights, setFights] = useState([]);
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [activeTab, setActiveTab] = useState('fights');
  const navigate = useNavigate();

  const checkModeratorAccess = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await axios.get('/api/profile/me', {
        headers: { 'x-auth-token': token }
      });

      if (response.data.role !== 'moderator') {
        navigate('/');
        return;
      }

      setIsAuthorized(true);
    } catch (error) {
      console.error('Error checking moderator access:', error);
      navigate('/');
    }
  }, [navigate]);

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const [fightsResponse, usersResponse, reportsResponse] = await Promise.all([
        axios.get('/api/fights', { headers: { 'x-auth-token': token } }),
        axios.get('/api/users', { headers: { 'x-auth-token': token } }),
        axios.get('/api/reports', { headers: { 'x-auth-token': token } })
      ]);

      setFights(fightsResponse.data || []);
      setUsers(usersResponse.data || []);
      setReports(reportsResponse.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkModeratorAccess();
    if (isAuthorized) {
      fetchData();
    }
  }, [checkModeratorAccess, fetchData, isAuthorized]);

  if (loading) {
    return <div className="loading">Loading moderator panel...</div>;
  }

  if (!isAuthorized) {
    return <div className="unauthorized">Access denied</div>;
  }

  return (
    <div className="moderator-panel">
      <h1>Moderator Panel</h1>
      <div className="tabs">
        <button 
          className={activeTab === 'fights' ? 'active' : ''}
          onClick={() => setActiveTab('fights')}
        >
          Fights ({fights.length})
        </button>
        <button 
          className={activeTab === 'users' ? 'active' : ''}
          onClick={() => setActiveTab('users')}
        >
          Users ({users.length})
        </button>
        <button 
          className={activeTab === 'reports' ? 'active' : ''}
          onClick={() => setActiveTab('reports')}
        >
          Reports ({reports.length})
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'fights' && (
          <div className="fights-section">
            <h2>Manage Fights</h2>
            {fights.map(fight => (
              <div key={fight.id} className="fight-item">
                <h3>{fight.title}</h3>
                <p>Status: {fight.status}</p>
                <p>Created: {new Date(fight.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="users-section">
            <h2>Manage Users</h2>
            {users.map(user => (
              <div key={user.id} className="user-item">
                <h3>{user.username}</h3>
                <p>Role: {user.role}</p>
                <p>Joined: {new Date(user.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="reports-section">
            <h2>Manage Reports</h2>
            {reports.map(report => (
              <div key={report.id} className="report-item">
                <h3>{report.title}</h3>
                <p>Type: {report.type}</p>
                <p>Status: {report.status}</p>
                <p>Created: {new Date(report.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModeratorPanel;