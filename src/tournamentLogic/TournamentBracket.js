import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './TournamentBracket.css';

const TournamentBracket = ({ tournamentId, status }) => {
  const [brackets, setBrackets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userVotes, setUserVotes] = useState({});
  const token = localStorage.getItem('token');

  const fetchBrackets = useCallback(async () => {
    try {
      const response = await axios.get(`/api/tournaments/${tournamentId}/brackets`);
      setBrackets(response.data.brackets || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching brackets:', error);
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchBrackets();
  }, [fetchBrackets]);

  const handleVote = async (matchId, participantId) => {
    if (!token) {
      alert('Please log in to vote');
      return;
    }

    try {
      await axios.post(
        `/api/tournaments/${tournamentId}/matches/${matchId}/vote`,
        { participantId },
        { headers: { 'x-auth-token': token } }
      );

      setUserVotes({ ...userVotes, [matchId]: participantId });
      fetchBrackets();
    } catch (error) {
      console.error('Error voting:', error);
      alert(error.response?.data?.msg || 'Error voting');
    }
  };

  const renderParticipant = (participant, matchId, match) => {
    if (!participant || participant.type === 'tbd') {
      return (
        <div className="participant tbd">
          <span className="participant-name">TBD</span>
        </div>
      );
    }

    if (participant.type === 'bye') {
      return (
        <div className="participant bye">
          <span className="participant-name">BYE</span>
        </div>
      );
    }

    const isWinner = match.winner === participant.userId;
    const hasVoted = userVotes[matchId] === participant.userId;
    const canVote = match.status === 'active' && token;

    return (
      <div className={`participant ${isWinner ? 'winner' : ''} ${hasVoted ? 'voted' : ''}`}>
        <div className="participant-info">
          <span className="participant-name">{participant.username}</span>
          <div className="participant-characters">
            {participant.characters?.map((char, idx) => (
              <span key={idx} className="char-badge">{char.name}</span>
            ))}
          </div>
        </div>
        
        <div className="participant-actions">
          {match.votesHidden ? (
            <span className="vote-count hidden">Votes hidden until the end</span>
          ) : (
            match.votes && (
              <span className="vote-count">{match.votes[participant.userId] || 0} votes</span>
            )
          )}
          
          {canVote && !match.winner && (
            <button
              className="vote-btn"
              onClick={() => handleVote(matchId, participant.userId)}
              disabled={hasVoted}
            >
              {hasVoted ? '✓ Voted' : 'Vote'}
            </button>
          )}
          
          {isWinner && <span className="winner-badge">🏆</span>}
        </div>
      </div>
    );
  };

  const renderMatch = (match) => {
    return (
      <div key={match.id} className={`match ${match.status}`}>
        <div className="match-header">
          <span className="match-id">Match {match.matchNumber || match.id}</span>
          <span className={`match-status ${match.status}`}>{match.status}</span>
        </div>

        <div className="match-participants">
          {renderParticipant(match.participant1, match.id, match)}
          <div className="vs-divider">VS</div>
          {renderParticipant(match.participant2, match.id, match)}
        </div>

        {match.status === 'completed' && match.winner && (
          <div className="match-result">
            Winner advances to next round
          </div>
        )}
      </div>
    );
  };

  const renderRound = (round, roundIndex) => {
    const roundNames = ['Finals', 'Semi-Finals', 'Quarter-Finals', 'Round of 16', 'Round of 32'];
    const totalRounds = brackets.length;
    const reversedIndex = totalRounds - roundIndex - 1;
    const roundName = reversedIndex < roundNames.length ? roundNames[reversedIndex] : `Round ${round.round}`;

    return (
      <div key={roundIndex} className="bracket-round">
        <div className="round-header">
          <h3>{roundName}</h3>
          <span className="round-info">Round {round.round}</span>
        </div>
        
        <div className="round-matches">
          {round.matches.map(match => renderMatch(match))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="tournament-bracket">
        <div className="loading">Loading brackets...</div>
      </div>
    );
  }

  if (!brackets || brackets.length === 0) {
    return (
      <div className="tournament-bracket">
        <div className="no-brackets">
          <p>No brackets generated yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tournament-bracket">
      <h2>Tournament Bracket</h2>
      
      <div className="bracket-container">
        {brackets.map((round, index) => renderRound(round, index))}
      </div>

      {status === 'completed' && brackets.length > 0 && (
        <div className="tournament-winner">
          <h2>🏆 Tournament Champion 🏆</h2>
          {/* Winner info would be displayed here */}
        </div>
      )}
    </div>
  );
};

export default TournamentBracket;
