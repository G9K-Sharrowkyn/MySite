import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from '../i18n/LanguageContext';
import './FighterProposalSystem.css';

const FighterProposalSystem = ({ user, isModerator }) => {
  const [proposals, setProposals] = useState([]);
  const [userProposals, setUserProposals] = useState([]);
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [newProposal, setNewProposal] = useState({
    name: '',
    universe: '',
    powerTier: '',
    description: '',
    imageUrl: '',
    abilities: [],
    reasonForInclusion: '',
    sourceMediaType: '',
    sourceMedia: ''
  });
  const [filterStatus, setFilterStatus] = useState('pending');
  const [filterPowerTier, setFilterPowerTier] = useState('all');
  const { t } = useLanguage();

  const powerTiers = [
    { id: 'regular_people', name: 'Regular People', range: '1-10' },
    { id: 'metahuman', name: 'Metahuman', range: '11-100' },
    { id: 'planet_busters', name: 'Planet Busters', range: '101-1000' },
    { id: 'god_tier', name: 'God Tier', range: '1001-10000' },
    { id: 'universal_threat', name: 'Universal Threat', range: '10001-100000' },
    { id: 'omnipotent', name: 'Omnipotent', range: '100000+' }
  ];

  const sourceMediaTypes = [
    'Anime/Manga', 'Marvel Comics', 'DC Comics', 'Movies', 'TV Shows', 
    'Video Games', 'Books/Novels', 'Mythology', 'Real Person', 'Other'
  ];

  useEffect(() => {
    fetchProposals();
    fetchUserProposals();
  }, []);

  const fetchProposals = async () => {
    try {
      const response = await axios.get('/api/fighter-proposals', {
        params: { status: filterStatus, powerTier: filterPowerTier }
      });
      setProposals(response.data || []);
    } catch (error) {
      console.error('Error fetching proposals:', error);
    }
  };

  const fetchUserProposals = async () => {
    try {
      const response = await axios.get(`/api/fighter-proposals/user/${user?.id}`);
      setUserProposals(response.data || []);
    } catch (error) {
      console.error('Error fetching user proposals:', error);
    }
  };

  const submitProposal = async () => {
    if (!newProposal.name || !newProposal.universe || !newProposal.powerTier) {
      alert('Please fill in all required fields.');
      return;
    }

    try {
      await axios.post('/api/fighter-proposals', {
        ...newProposal,
        proposedBy: user.id,
        status: 'pending'
      });

      setNewProposal({
        name: '',
        universe: '',
        powerTier: '',
        description: '',
        imageUrl: '',
        abilities: [],
        reasonForInclusion: '',
        sourceMediaType: '',
        sourceMedia: ''
      });
      setShowProposalForm(false);
      
      alert('Fighter proposal submitted successfully!');
      fetchProposals();
      fetchUserProposals();
    } catch (error) {
      console.error('Error submitting proposal:', error);
      alert('Failed to submit proposal.');
    }
  };

  const moderatorAction = async (proposalId, action, feedback = '') => {
    if (!isModerator) return;

    try {
      await axios.post(`/api/fighter-proposals/${proposalId}/moderate`, {
        action, // 'approve', 'reject', 'request_changes'
        feedback,
        moderatedBy: user.id
      });

      fetchProposals();
      alert(`Proposal ${action}ed successfully!`);
    } catch (error) {
      console.error('Error moderating proposal:', error);
      alert('Failed to moderate proposal.');
    }
  };

  const voteOnProposal = async (proposalId, vote) => {
    try {
      await axios.post(`/api/fighter-proposals/${proposalId}/vote`, {
        userId: user.id,
        vote // 'upvote' or 'downvote'
      });

      fetchProposals();
    } catch (error) {
      console.error('Error voting on proposal:', error);
    }
  };

  const addAbility = () => {
    setNewProposal(prev => ({
      ...prev,
      abilities: [...prev.abilities, '']
    }));
  };

  const updateAbility = (index, value) => {
    setNewProposal(prev => ({
      ...prev,
      abilities: prev.abilities.map((ability, i) => i === index ? value : ability)
    }));
  };

  const removeAbility = (index) => {
    setNewProposal(prev => ({
      ...prev,
      abilities: prev.abilities.filter((_, i) => i !== index)
    }));
  };

  const ProposalForm = () => (
    <div className="proposal-form">
      <div className="form-header">
        <h3>🥋 Propose New Fighter</h3>
        <button onClick={() => setShowProposalForm(false)}>✕</button>
      </div>

      <div className="form-content">
        <div className="form-row">
          <div className="form-group">
            <label>Fighter Name *</label>
            <input
              type="text"
              value={newProposal.name}
              onChange={(e) => setNewProposal(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Goku, Batman, Superman"
            />
          </div>
          <div className="form-group">
            <label>Universe/Series *</label>
            <input
              type="text"
              value={newProposal.universe}
              onChange={(e) => setNewProposal(prev => ({ ...prev, universe: e.target.value }))}
              placeholder="e.g., Dragon Ball Z, DC Comics, Marvel"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Power Tier *</label>
            <select
              value={newProposal.powerTier}
              onChange={(e) => setNewProposal(prev => ({ ...prev, powerTier: e.target.value }))}
            >
              <option value="">Select Power Tier</option>
              {powerTiers.map(tier => (
                <option key={tier.id} value={tier.id}>
                  {tier.name} ({tier.range})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Source Media Type</label>
            <select
              value={newProposal.sourceMediaType}
              onChange={(e) => setNewProposal(prev => ({ ...prev, sourceMediaType: e.target.value }))}
            >
              <option value="">Select Media Type</option>
              {sourceMediaTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>Source Media Title</label>
          <input
            type="text"
            value={newProposal.sourceMedia}
            onChange={(e) => setNewProposal(prev => ({ ...prev, sourceMedia: e.target.value }))}
            placeholder="e.g., Dragon Ball Super, The Dark Knight, Avengers"
          />
        </div>

        <div className="form-group">
          <label>Character Image URL</label>
          <input
            type="url"
            value={newProposal.imageUrl}
            onChange={(e) => setNewProposal(prev => ({ ...prev, imageUrl: e.target.value }))}
            placeholder="https://example.com/character-image.jpg"
          />
          {newProposal.imageUrl && (
            <div className="image-preview">
              <img src={newProposal.imageUrl} alt="Character preview" />
            </div>
          )}
        </div>

        <div className="form-group">
          <label>Character Description</label>
          <textarea
            value={newProposal.description}
            onChange={(e) => setNewProposal(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Brief description of the character and their background..."
            rows="4"
          />
        </div>

        <div className="form-group">
          <label>Key Abilities/Powers</label>
          <div className="abilities-list">
            {newProposal.abilities.map((ability, index) => (
              <div key={index} className="ability-input">
                <input
                  type="text"
                  value={ability}
                  onChange={(e) => updateAbility(index, e.target.value)}
                  placeholder={`Ability ${index + 1}`}
                />
                <button onClick={() => removeAbility(index)}>🗑️</button>
              </div>
            ))}
            <button className="add-ability-btn" onClick={addAbility}>
              + Add Ability
            </button>
          </div>
        </div>

        <div className="form-group">
          <label>Reason for Inclusion</label>
          <textarea
            value={newProposal.reasonForInclusion}
            onChange={(e) => setNewProposal(prev => ({ ...prev, reasonForInclusion: e.target.value }))}
            placeholder="Why should this character be added to the database? What makes them interesting for fights?"
            rows="3"
          />
        </div>

        <div className="form-actions">
          <button className="submit-btn" onClick={submitProposal}>
            🚀 Submit Proposal
          </button>
          <button className="cancel-btn" onClick={() => setShowProposalForm(false)}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  const ProposalCard = ({ proposal, isUserProposal = false }) => (
    <div className={`proposal-card ${proposal.status}`}>
      <div className="proposal-header">
        <div className="character-info">
          {proposal.imageUrl && (
            <img src={proposal.imageUrl} alt={proposal.name} className="character-image" />
          )}
          <div className="character-details">
            <h4>{proposal.name}</h4>
            <span className="universe">{proposal.universe}</span>
            <span className="power-tier">
              {powerTiers.find(t => t.id === proposal.powerTier)?.name}
            </span>
          </div>
        </div>
        
        <div className="proposal-status">
          <span className={`status-badge ${proposal.status}`}>
            {proposal.status === 'pending' && '⏳ Pending'}
            {proposal.status === 'approved' && '✅ Approved'}
            {proposal.status === 'rejected' && '❌ Rejected'}
            {proposal.status === 'changes_requested' && '📝 Changes Requested'}
          </span>
          {proposal.sourceMediaType && (
            <span className="media-type">{proposal.sourceMediaType}</span>
          )}
        </div>
      </div>

      {proposal.description && (
        <div className="proposal-description">
          <p>{proposal.description}</p>
        </div>
      )}

      {proposal.abilities && proposal.abilities.length > 0 && (
        <div className="abilities-section">
          <h5>🔥 Key Abilities:</h5>
          <div className="abilities-list">
            {proposal.abilities.map((ability, index) => (
              <span key={index} className="ability-tag">{ability}</span>
            ))}
          </div>
        </div>
      )}

      {proposal.reasonForInclusion && (
        <div className="reason-section">
          <h5>💡 Reason for Inclusion:</h5>
          <p>{proposal.reasonForInclusion}</p>
        </div>
      )}

      <div className="proposal-footer">
        <div className="proposal-meta">
          <span className="proposer">
            👤 Proposed by: {proposal.proposedBy?.username || 'Anonymous'}
          </span>
          <span className="proposal-date">
            📅 {new Date(proposal.createdAt).toLocaleDateString()}
          </span>
        </div>

        {!isUserProposal && proposal.status === 'pending' && (
          <div className="community-voting">
            <button 
              className="vote-btn upvote"
              onClick={() => voteOnProposal(proposal.id, 'upvote')}
            >
              👍 {proposal.upvotes || 0}
            </button>
            <button 
              className="vote-btn downvote"
              onClick={() => voteOnProposal(proposal.id, 'downvote')}
            >
              👎 {proposal.downvotes || 0}
            </button>
          </div>
        )}

        {isModerator && proposal.status === 'pending' && (
          <div className="moderator-actions">
            <button 
              className="mod-btn approve"
              onClick={() => moderatorAction(proposal.id, 'approve')}
            >
              ✅ Approve
            </button>
            <button 
              className="mod-btn reject"
              onClick={() => {
                const feedback = prompt('Reason for rejection:');
                if (feedback) moderatorAction(proposal.id, 'reject', feedback);
              }}
            >
              ❌ Reject
            </button>
            <button 
              className="mod-btn changes"
              onClick={() => {
                const feedback = prompt('What changes are needed?');
                if (feedback) moderatorAction(proposal.id, 'request_changes', feedback);
              }}
            >
              📝 Request Changes
            </button>
          </div>
        )}

        {proposal.moderatorFeedback && (
          <div className="moderator-feedback">
            <h5>📋 Moderator Feedback:</h5>
            <p>{proposal.moderatorFeedback}</p>
          </div>
        )}
      </div>
    </div>
  );

  const FilterControls = () => (
    <div className="filter-controls">
      <div className="filter-group">
        <label>Status:</label>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="pending">⏳ Pending</option>
          <option value="approved">✅ Approved</option>
          <option value="rejected">❌ Rejected</option>
          <option value="changes_requested">📝 Changes Requested</option>
          <option value="all">All Statuses</option>
        </select>
      </div>
      
      <div className="filter-group">
        <label>Power Tier:</label>
        <select value={filterPowerTier} onChange={(e) => setFilterPowerTier(e.target.value)}>
          <option value="all">All Tiers</option>
          {powerTiers.map(tier => (
            <option key={tier.id} value={tier.id}>{tier.name}</option>
          ))}
        </select>
      </div>

      <button className="refresh-btn" onClick={fetchProposals}>
        🔄 Refresh
      </button>
    </div>
  );

  return (
    <div className="fighter-proposal-system">
      <div className="system-header">
        <h1>🥋 Fighter Proposal System</h1>
        <p>Suggest new characters to be added to the fighting database!</p>
        
        <div className="header-actions">
          <button 
            className="new-proposal-btn"
            onClick={() => setShowProposalForm(true)}
          >
            ➕ Propose New Fighter
          </button>
        </div>
      </div>

      <div className="proposal-stats">
        <div className="stat-card">
          <span className="stat-number">{proposals.filter(p => p.status === 'pending').length}</span>
          <span className="stat-label">Pending</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{proposals.filter(p => p.status === 'approved').length}</span>
          <span className="stat-label">Approved</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{userProposals.length}</span>
          <span className="stat-label">Your Proposals</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{proposals.length}</span>
          <span className="stat-label">Total Proposals</span>
        </div>
      </div>

      {showProposalForm && <ProposalForm />}

      <div className="proposals-section">
        <div className="section-header">
          <h2>🗳️ Community Proposals</h2>
          <FilterControls />
        </div>

        <div className="proposals-grid">
          {proposals.map(proposal => (
            <ProposalCard key={proposal.id} proposal={proposal} />
          ))}
        </div>

        {proposals.length === 0 && (
          <div className="empty-state">
            <h3>No proposals found</h3>
            <p>Be the first to suggest a new fighter!</p>
          </div>
        )}
      </div>

      {userProposals.length > 0 && (
        <div className="user-proposals-section">
          <h2>📝 Your Proposals</h2>
          <div className="proposals-grid">
            {userProposals.map(proposal => (
              <ProposalCard key={proposal.id} proposal={proposal} isUserProposal={true} />
            ))}
          </div>
        </div>
      )}

      {isModerator && (
        <div className="moderator-guidelines">
          <h3>📋 Moderation Guidelines</h3>
          <div className="guidelines-content">
            <div className="guideline-item">
              <h4>✅ Approval Criteria:</h4>
              <ul>
                <li>Character is from established media (anime, comics, movies, etc.)</li>
                <li>Power tier is accurately assessed</li>
                <li>Character adds unique value to fights</li>
                <li>Good quality image provided</li>
                <li>Clear description and abilities listed</li>
              </ul>
            </div>
            <div className="guideline-item">
              <h4>❌ Rejection Reasons:</h4>
              <ul>
                <li>Character already exists in database</li>
                <li>Inappropriate or offensive content</li>
                <li>Original characters (not from established media)</li>
                <li>Extremely obscure characters with no fan recognition</li>
                <li>Power tier grossly inaccurate</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FighterProposalSystem;