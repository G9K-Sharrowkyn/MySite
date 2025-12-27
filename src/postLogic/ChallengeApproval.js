import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './ChallengeApproval.css';

const ChallengeApproval = ({ post, onApproval, currentUserId }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const token = localStorage.getItem('token');
  const fight = post?.fight;

  const handleApprove = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await axios.post(`/api/posts/${post.id}/approve`, {
        approve: true
      }, {
        headers: { 'x-auth-token': token }
      });

      if (onApproval) {
        onApproval('approved');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Wystąpił błąd');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await axios.post(`/api/posts/${post.id}/approve`, {
        approve: false
      }, {
        headers: { 'x-auth-token': token }
      });

      if (onApproval) {
        onApproval('cancelled');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Wystąpił błąd');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!fight || fight.fightMode !== 'user_vs_user') {
    return null;
  }

  // Check if current user is the challenger
  if (fight.challengerId !== currentUserId) {
    return null;
  }

  // Check if challenge is awaiting approval
  if (fight.status !== 'pending_approval') {
    return null;
  }

  return (
    <div className="challenge-approval-panel">
      <div className="approval-header">
        <h3>Zatwierdzenie walki</h3>
        <div className="approval-badge">Oczekuje na Twoją decyzję</div>
      </div>

      <div className="teams-comparison">
        <div className="team-box challenger-team">
          <h4>Twoja drużyna</h4>
          <div className="team-content">{fight.challengerTeam}</div>
        </div>
        <div className="vs-divider">VS</div>
        <div className="team-box opponent-team">
          <h4>
            Drużyna{' '}
            <Link to={`/profile/${fight.opponentId}`} className="opponent-link">
              {fight.opponentUsername}
            </Link>
          </h4>
          <div className="team-content">{fight.opponentTeam}</div>
        </div>
      </div>

      <div className="vote-duration-info">
        <span className="info-icon">⏱️</span>
        <span>Czas głosowania: {fight.voteDuration === '1d' ? '1 dzień' : fight.voteDuration === '2d' ? '2 dni' : fight.voteDuration === '3d' ? '3 dni' : fight.voteDuration === '7d' ? '7 dni' : fight.voteDuration}</span>
      </div>

      {error && <div className="approval-error">{error}</div>}

      <div className="approval-actions">
        <button
          className="cancel-btn"
          onClick={handleCancel}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Przetwarzanie...' : 'Anuluj walkę'}
        </button>
        <button
          className="approve-btn"
          onClick={handleApprove}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Przetwarzanie...' : 'Zatwierdź walkę!'}
        </button>
      </div>

      <p className="approval-note">
        Po zatwierdzeniu walka stanie się publiczna i społeczność będzie mogła głosować.
      </p>
    </div>
  );
};

export default ChallengeApproval;
