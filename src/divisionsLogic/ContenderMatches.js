import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import PostCard from '../postLogic/PostCard';
import { getOptimizedImageProps } from '../utils/placeholderImage';
import './ContenderMatches.css';

const ContenderMatches = ({ divisionId, currentUser }) => {
  const [contenderMatches, setContenderMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [divisionMembers, setDivisionMembers] = useState([]);
  const [selectedChallengers, setSelectedChallengers] = useState({ challenger1: '', challenger2: '' });
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchContenderMatches = useCallback(async () => {
    try {
      const response = await axios.get(`/api/divisions/${divisionId}/contender-matches`);
      setContenderMatches(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching contender matches:', error);
      setLoading(false);
    }
  }, [divisionId]);

  const fetchDivisionMembers = useCallback(async () => {
    try {
      const response = await axios.get(`/api/divisions/${divisionId}/members`);
      // Filter out current champion and #1 contenders
      const eligibleMembers = response.data.filter(member => 
        !member.divisions[divisionId]?.isChampion && 
        !member.divisions[divisionId]?.contenderStatus?.isNumberOneContender
      );
      setDivisionMembers(eligibleMembers);
    } catch (error) {
      console.error('Error fetching division members:', error);
    }
  }, [divisionId]);

  useEffect(() => {
    fetchContenderMatches();
    if (currentUser?.role === 'moderator') {
      fetchDivisionMembers();
    }
  }, [currentUser?.role, fetchContenderMatches, fetchDivisionMembers]);

  const handleCreateContenderMatch = async (e) => {
    e.preventDefault();
    if (!selectedChallengers.challenger1 || !selectedChallengers.challenger2) {
      alert('Please select both challengers');
      return;
    }

    if (selectedChallengers.challenger1 === selectedChallengers.challenger2) {
      alert('Please select different challengers');
      return;
    }

    setCreating(true);
    const token = localStorage.getItem('token');

    try {
      await axios.post(
        `/api/divisions/${divisionId}/contender-match`,
        {
          challenger1Id: selectedChallengers.challenger1,
          challenger2Id: selectedChallengers.challenger2,
          description
        },
        { headers: { 'x-auth-token': token } }
      );

      setShowCreateModal(false);
      setSelectedChallengers({ challenger1: '', challenger2: '' });
      setDescription('');
      fetchContenderMatches();
    } catch (error) {
      console.error('Error creating contender match:', error);
      alert(error.response?.data?.msg || 'Error creating contender match');
    } finally {
      setCreating(false);
    }
  };

  const getContenderBadge = (match) => {
    if (match.fight?.status === 'locked') {
      return <span className="match-badge completed">Completed</span>;
    }
    return <span className="match-badge active">Active</span>;
  };

  if (loading) {
    return <div className="contender-matches-loading">Loading contender matches...</div>;
  }

  return (
    <div className="contender-matches-container">
      <div className="contender-header">
        <h3>🥊 Contender Matches</h3>
        {currentUser?.role === 'moderator' && (
          <button 
            className="create-contender-btn"
            onClick={() => setShowCreateModal(true)}
          >
            Create Contender Match
          </button>
        )}
      </div>

      {contenderMatches.length === 0 ? (
        <div className="no-matches">
          <p>No active contender matches in this division</p>
        </div>
      ) : (
        <div className="matches-list">
          {contenderMatches.map(match => (
            <div key={match.id} className="contender-match-wrapper">
              {getContenderBadge(match)}
              <div className="match-header">
                <div className="challenger-info">
                  <img 
                    {...getOptimizedImageProps(
                      match.challenger1?.profilePicture || '/placeholder-avatar.png',
                      { size: 60 }
                    )}
                    alt={match.challenger1?.username}
                  />
                  <div>
                    <h4>{match.challenger1?.username}</h4>
                    <span className="record">
                      {match.challenger1?.divisionStats?.wins || 0}-
                      {match.challenger1?.divisionStats?.losses || 0}-
                      {match.challenger1?.divisionStats?.draws || 0}
                    </span>
                  </div>
                </div>
                <span className="vs-text">VS</span>
                <div className="challenger-info">
                  <img 
                    {...getOptimizedImageProps(
                      match.challenger2?.profilePicture || '/placeholder-avatar.png',
                      { size: 60 }
                    )}
                    alt={match.challenger2?.username}
                  />
                  <div>
                    <h4>{match.challenger2?.username}</h4>
                    <span className="record">
                      {match.challenger2?.divisionStats?.wins || 0}-
                      {match.challenger2?.divisionStats?.losses || 0}-
                      {match.challenger2?.divisionStats?.draws || 0}
                    </span>
                  </div>
                </div>
              </div>
              <PostCard post={match} onUpdate={() => fetchContenderMatches()} />
            </div>
          ))}
        </div>
      )}

      {/* Create Contender Match Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Create Contender Match</h3>
            <form onSubmit={handleCreateContenderMatch}>
              <div className="form-group">
                <label>Challenger 1</label>
                <select 
                  value={selectedChallengers.challenger1}
                  onChange={(e) => setSelectedChallengers(prev => ({ ...prev, challenger1: e.target.value }))}
                  required
                >
                  <option value="">Select challenger...</option>
                  {divisionMembers.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.username} ({member.divisions[divisionId]?.wins || 0}-
                      {member.divisions[divisionId]?.losses || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Challenger 2</label>
                <select 
                  value={selectedChallengers.challenger2}
                  onChange={(e) => setSelectedChallengers(prev => ({ ...prev, challenger2: e.target.value }))}
                  required
                >
                  <option value="">Select challenger...</option>
                  {divisionMembers
                    .filter(m => m.id !== selectedChallengers.challenger1)
                    .map(member => (
                      <option key={member.id} value={member.id}>
                        {member.username} ({member.divisions[divisionId]?.wins || 0}-
                        {member.divisions[divisionId]?.losses || 0})
                      </option>
                    ))}
                </select>
              </div>

              <div className="form-group">
                <label>Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add context or stakes for this match..."
                  rows={3}
                />
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn-cancel"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={creating}
                >
                  {creating ? 'Creating...' : 'Create Match'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContenderMatches; 
