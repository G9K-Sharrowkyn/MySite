import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import CharacterSelector from '../feedLogic/CharacterSelector';
import { getOptimizedImageProps } from '../utils/placeholderImage';
import './ChallengeResponse.css';

const ChallengeResponse = ({ post, onResponse, currentUserId }) => {
  const [characters, setCharacters] = useState([]);
  const [team, setTeam] = useState([{ character: null }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const token = localStorage.getItem('token');
  const fight = post?.fight;

  useEffect(() => {
    fetchCharacters();
  }, []);

  const fetchCharacters = async () => {
    try {
      const response = await axios.get('/api/characters');
      setCharacters(response.data);
    } catch (err) {
      console.error('Error fetching characters:', err);
    }
  };

  const addWarrior = () => {
    setTeam([...team, { character: null }]);
  };

  const removeWarrior = (index) => {
    if (team.length > 1) {
      setTeam(team.filter((_, i) => i !== index));
    }
  };

  const updateWarrior = (index, character) => {
    const newTeam = [...team];
    newTeam[index] = { character };
    setTeam(newTeam);
  };

  const handleAccept = async () => {
    const validWarriors = team.filter(w => w.character?.name).map(w => w.character.name);
    if (validWarriors.length === 0) {
      setError('Musisz wybrać przynajmniej jedną postać do swojej drużyny');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await axios.post(`/api/posts/${post.id}/respond`, {
        accept: true,
        opponentTeam: validWarriors.join(', ')
      }, {
        headers: { 'x-auth-token': token }
      });

      if (onResponse) {
        onResponse('accepted');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Wystąpił błąd');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await axios.post(`/api/posts/${post.id}/respond`, {
        accept: false
      }, {
        headers: { 'x-auth-token': token }
      });

      if (onResponse) {
        onResponse('rejected');
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

  // Check if current user is the opponent
  if (fight.opponentId !== currentUserId) {
    return null;
  }

  // Check if challenge is still pending
  if (fight.status !== 'pending_opponent') {
    return null;
  }

  // Check expiration
  const isExpired = new Date() > new Date(fight.expiresAt);
  if (isExpired) {
    return (
      <div className="challenge-response-panel expired">
        <h3>Wyzwanie wygasło</h3>
        <p>Ten czas na odpowiedź na to wyzwanie minął.</p>
      </div>
    );
  }

  const expiresAt = new Date(fight.expiresAt);
  const timeLeft = expiresAt - new Date();
  const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  return (
    <div className="challenge-response-panel">
      <div className="challenge-header">
        <h3>Wyzwanie na walkę!</h3>
        <div className="challenge-timer">
          Pozostało: {daysLeft}d {hoursLeft}h
        </div>
      </div>

      <div className="challenger-section">
        <div className="challenger-info">
          <Link to={`/profile/${fight.challengerId}`} className="challenger-link">
            <strong>{fight.challengerUsername}</strong>
          </Link>
          <span> wyzwał Cię na walkę!</span>
        </div>
        <div className="challenger-team">
          <h4>Drużyna przeciwnika:</h4>
          <div className="team-names">{fight.challengerTeam}</div>
        </div>
      </div>

      <div className="your-team-section">
        <h4>Wybierz swoją drużynę:</h4>
        <div className="warriors-grid">
          {team.map((warrior, index) => (
            <div key={index} className="warrior-slot">
              <CharacterSelector
                characters={characters}
                selectedCharacter={warrior.character}
                onSelect={(character) => updateWarrior(index, character)}
              />
              {warrior.character && (
                <div className="warrior-preview">
                  <img
                    {...getOptimizedImageProps(warrior.character.image, { size: 120 })}
                    alt={warrior.character.name}
                  />
                  <span className="warrior-name">{warrior.character.name}</span>
                </div>
              )}
              {team.length > 1 && (
                <button
                  type="button"
                  className="remove-warrior-btn"
                  onClick={() => removeWarrior(index)}
                >
                  Usuń
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          className="add-warrior-btn"
          onClick={addWarrior}
        >
          + Dodaj postać
        </button>
      </div>

      {error && <div className="challenge-error">{error}</div>}

      <div className="challenge-actions">
        <button
          className="reject-btn"
          onClick={handleReject}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Przetwarzanie...' : 'Odrzuć wyzwanie'}
        </button>
        <button
          className="accept-btn"
          onClick={handleAccept}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Przetwarzanie...' : 'Akceptuj wyzwanie'}
        </button>
      </div>
    </div>
  );
};

export default ChallengeResponse;
