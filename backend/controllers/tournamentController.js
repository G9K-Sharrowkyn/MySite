const { v4: uuidv4 } = require('uuid');

// Helper function to generate tournament brackets
function generateBrackets(participants, tournamentType = 'single_elimination') {
  const numParticipants = participants.length;
  const rounds = Math.ceil(Math.log2(numParticipants));
  const totalSlots = Math.pow(2, rounds);
  
  // Seed participants based on their ranking/points
  const seededParticipants = participants.sort((a, b) => (b.points || 0) - (a.points || 0));
  
  // Fill remaining slots with byes
  while (seededParticipants.length < totalSlots) {
    seededParticipants.push({ type: 'bye', userId: null, characterId: null });
  }
  
  const brackets = [];
  
  if (tournamentType === 'single_elimination') {
    // Generate single elimination brackets
    for (let round = 0; round < rounds; round++) {
      const roundMatches = [];
      const matchesInRound = Math.pow(2, rounds - round - 1);
      
      for (let match = 0; match < matchesInRound; match++) {
        const matchId = `${round}-${match}`;
        let player1, player2;
        
        if (round === 0) {
          // First round - use seeding
          const player1Index = match;
          const player2Index = totalSlots - 1 - match;
          player1 = seededParticipants[player1Index];
          player2 = seededParticipants[player2Index];
        } else {
          // Later rounds - will be filled as tournament progresses
          player1 = { type: 'tbd', matchId: `${round-1}-${match*2}` };
          player2 = { type: 'tbd', matchId: `${round-1}-${match*2+1}` };
        }
        
        roundMatches.push({
          id: matchId,
          player1,
          player2,
          winner: null,
          status: 'pending',
          scheduledTime: null,
          votes: { player1: 0, player2: 0 },
          voters: []
        });
      }
      
      brackets.push({
        round: round + 1,
        matches: roundMatches
      });
    }
  }
  
  return brackets;
}

// Helper function to advance tournament
function advanceTournament(tournament, matchId, winnerId) {
  const [roundIndex, matchIndex] = matchId.split('-').map(Number);
  const currentRound = tournament.brackets[roundIndex];
  const currentMatch = currentRound.matches[matchIndex];
  
  // Set winner for current match
  currentMatch.winner = winnerId;
  currentMatch.status = 'completed';
  
  // Advance winner to next round
  if (roundIndex < tournament.brackets.length - 1) {
    const nextRound = tournament.brackets[roundIndex + 1];
    const nextMatchIndex = Math.floor(matchIndex / 2);
    const nextMatch = nextRound.matches[nextMatchIndex];
    
    if (matchIndex % 2 === 0) {
      nextMatch.player1 = { userId: winnerId, type: 'player' };
    } else {
      nextMatch.player2 = { userId: winnerId, type: 'player' };
    }
    
    nextMatch.status = 'ready';
  } else {
    // Tournament finished
    tournament.winner = winnerId;
    tournament.status = 'completed';
    tournament.completedAt = new Date().toISOString();
  }
  
  return tournament;
}

exports.getAllTournaments = async (req, res) => {
  const db = req.db;
  
  try {
    await db.read();
    const tournaments = db.data.tournaments || [];
    
    // Add participant count and status info
    const enhancedTournaments = tournaments.map(tournament => ({
      ...tournament,
      participantCount: tournament.participants?.length || 0,
      isFull: tournament.participants?.length >= tournament.maxParticipants,
      canJoin: tournament.status === 'upcoming' && 
               (tournament.participants?.length || 0) < tournament.maxParticipants
    }));
    
    res.json(enhancedTournaments);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.getTournamentById = async (req, res) => {
  const db = req.db;
  const { id } = req.params;
  
  try {
    await db.read();
    const tournament = db.data.tournaments.find(t => t.id === id);
    
    if (!tournament) {
      return res.status(404).json({ msg: 'Tournament not found' });
    }
    
    // Add user participation info if authenticated
    if (req.user) {
      const userParticipation = tournament.participants?.find(p => p.userId === req.user.id);
      tournament.userParticipation = userParticipation || null;
    }
    
    res.json(tournament);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.createTournament = async (req, res) => {
  const db = req.db;
  const { 
    title, 
    description, 
    startDate, 
    endDate, 
    maxParticipants, 
    rules, 
    tournamentType,
    divisionId,
    prizePool,
    entryFee
  } = req.body;
  
  try {
    await db.read();
    
    // Check if user is moderator
    const user = db.data.users.find(u => u.id === req.user.id);
    if (!user || user.role !== 'moderator') {
      return res.status(403).json({ msg: 'Access denied. Moderator role required.' });
    }
    
    const newTournament = {
      id: uuidv4(),
      title,
      description,
      startDate,
      endDate,
      maxParticipants: maxParticipants || 32,
      rules: rules || '',
      tournamentType: tournamentType || 'single_elimination',
      divisionId: divisionId || null,
      prizePool: prizePool || 0,
      entryFee: entryFee || 0,
      status: 'upcoming', // upcoming, active, completed, cancelled
      participants: [],
      brackets: [],
      fights: [],
      createdBy: req.user.id,
      createdAt: new Date().toISOString(),
      winner: null,
      runnerUp: null,
      thirdPlace: null,
      stats: {
        totalMatches: 0,
        completedMatches: 0,
        totalVotes: 0
      }
    };
    
    db.data.tournaments.push(newTournament);
    await db.write();
    
    res.json(newTournament);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.startTournament = async (req, res) => {
  const db = req.db;
  const { id } = req.params;
  
  try {
    await db.read();
    
    // Check if user is moderator
    const user = db.data.users.find(u => u.id === req.user.id);
    if (!user || user.role !== 'moderator') {
      return res.status(403).json({ msg: 'Access denied. Moderator role required.' });
    }
    
    const tournament = db.data.tournaments.find(t => t.id === id);
    if (!tournament) {
      return res.status(404).json({ msg: 'Tournament not found' });
    }
    
    if (tournament.status !== 'upcoming') {
      return res.status(400).json({ msg: 'Tournament cannot be started' });
    }
    
    if (tournament.participants.length < 2) {
      return res.status(400).json({ msg: 'Need at least 2 participants to start tournament' });
    }
    
    // Generate brackets
    const brackets = generateBrackets(tournament.participants, tournament.tournamentType);
    
    // Update tournament
    tournament.brackets = brackets;
    tournament.status = 'active';
    tournament.startedAt = new Date().toISOString();
    tournament.stats.totalMatches = brackets.reduce((total, round) => total + round.matches.length, 0);
    
    await db.write();
    
    res.json({ 
      msg: 'Tournament started successfully', 
      tournament,
      brackets 
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.advanceMatch = async (req, res) => {
  const db = req.db;
  const { id, matchId } = req.params;
  const { winnerId } = req.body;
  
  try {
    await db.read();
    
    // Check if user is moderator
    const user = db.data.users.find(u => u.id === req.user.id);
    if (!user || user.role !== 'moderator') {
      return res.status(403).json({ msg: 'Access denied. Moderator role required.' });
    }
    
    const tournament = db.data.tournaments.find(t => t.id === id);
    if (!tournament) {
      return res.status(404).json({ msg: 'Tournament not found' });
    }
    
    if (tournament.status !== 'active') {
      return res.status(400).json({ msg: 'Tournament is not active' });
    }
    
    // Advance the tournament
    const updatedTournament = advanceTournament(tournament, matchId, winnerId);
    
    // Update stats
    updatedTournament.stats.completedMatches += 1;
    
    // Update user stats for winner
    const winnerIndex = db.data.users.findIndex(u => u.id === winnerId);
    if (winnerIndex !== -1) {
      if (!db.data.users[winnerIndex].activity) {
        db.data.users[winnerIndex].activity = {
          postsCreated: 0,
          likesReceived: 0,
          commentsPosted: 0,
          fightsCreated: 0,
          votesGiven: 0,
          tournamentsParticipated: 0,
          tournamentsWon: 0
        };
      }
      db.data.users[winnerIndex].activity.tournamentsWon += 1;
      db.data.users[winnerIndex].stats.experience += 20; // Award experience for tournament win
    }
    
    // Update tournament in database
    const tournamentIndex = db.data.tournaments.findIndex(t => t.id === id);
    db.data.tournaments[tournamentIndex] = updatedTournament;
    
    await db.write();
    
    res.json({ 
      msg: 'Match advanced successfully', 
      tournament: updatedTournament 
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.voteInTournament = async (req, res) => {
  const db = req.db;
  const { id, matchId } = req.params;
  const { winnerId } = req.body;
  
  try {
    await db.read();
    
    const tournament = db.data.tournaments.find(t => t.id === id);
    if (!tournament) {
      return res.status(404).json({ msg: 'Tournament not found' });
    }
    
    if (tournament.status !== 'active') {
      return res.status(400).json({ msg: 'Tournament is not active' });
    }
    
    // Find the match
    const [roundIndex, matchIndex] = matchId.split('-').map(Number);
    const round = tournament.brackets[roundIndex];
    const match = round.matches[matchIndex];
    
    if (!match) {
      return res.status(404).json({ msg: 'Match not found' });
    }
    
    if (match.status !== 'active') {
      return res.status(400).json({ msg: 'Match is not active for voting' });
    }
    
    // Check if user already voted
    const hasVoted = match.voters.some(v => v.userId === req.user.id);
    if (hasVoted) {
      return res.status(400).json({ msg: 'You have already voted in this match' });
    }
    
    // Add vote
    match.voters.push({
      userId: req.user.id,
      votedFor: winnerId,
      votedAt: new Date().toISOString()
    });
    
    // Update vote counts
    if (winnerId === match.player1.userId) {
      match.votes.player1 += 1;
    } else if (winnerId === match.player2.userId) {
      match.votes.player2 += 1;
    }
    
    // Update tournament stats
    tournament.stats.totalVotes += 1;
    
    await db.write();
    
    res.json({ 
      msg: 'Vote recorded successfully', 
      match,
      totalVotes: match.votes.player1 + match.votes.player2
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.getTournamentBrackets = async (req, res) => {
  const db = req.db;
  const { id } = req.params;
  
  try {
    await db.read();
    const tournament = db.data.tournaments.find(t => t.id === id);
    
    if (!tournament) {
      return res.status(404).json({ msg: 'Tournament not found' });
    }
    
    res.json({
      tournament: {
        id: tournament.id,
        title: tournament.title,
        status: tournament.status,
        winner: tournament.winner
      },
      brackets: tournament.brackets || []
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.updateTournament = async (req, res) => {
  const db = req.db;
  const { id } = req.params;
  const updates = req.body;
  
  try {
    await db.read();
    
    // Check if user is moderator
    const user = db.data.users.find(u => u.id === req.user.id);
    if (!user || user.role !== 'moderator') {
      return res.status(403).json({ msg: 'Access denied. Moderator role required.' });
    }
    
    const tournamentIndex = db.data.tournaments.findIndex(t => t.id === id);
    if (tournamentIndex === -1) {
      return res.status(404).json({ msg: 'Tournament not found' });
    }
    
    db.data.tournaments[tournamentIndex] = {
      ...db.data.tournaments[tournamentIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await db.write();
    res.json(db.data.tournaments[tournamentIndex]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.deleteTournament = async (req, res) => {
  const db = req.db;
  const { id } = req.params;
  
  try {
    await db.read();
    
    // Check if user is moderator
    const user = db.data.users.find(u => u.id === req.user.id);
    if (!user || user.role !== 'moderator') {
      return res.status(403).json({ msg: 'Access denied. Moderator role required.' });
    }
    
    const tournamentIndex = db.data.tournaments.findIndex(t => t.id === id);
    if (tournamentIndex === -1) {
      return res.status(404).json({ msg: 'Tournament not found' });
    }
    
    db.data.tournaments.splice(tournamentIndex, 1);
    await db.write();
    
    res.json({ msg: 'Tournament deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.joinTournament = async (req, res) => {
  const db = req.db;
  const { id } = req.params;
  const { characterId } = req.body;
  
  try {
    await db.read();
    
    const tournament = db.data.tournaments.find(t => t.id === id);
    if (!tournament) {
      return res.status(404).json({ msg: 'Tournament not found' });
    }
    
    if (tournament.status !== 'upcoming') {
      return res.status(400).json({ msg: 'Cannot join tournament that has already started' });
    }
    
    if (tournament.participants.length >= tournament.maxParticipants) {
      return res.status(400).json({ msg: 'Tournament is full' });
    }
    
    // Check if user is already participating
    const isAlreadyParticipating = tournament.participants.some(p => p.userId === req.user.id);
    if (isAlreadyParticipating) {
      return res.status(400).json({ msg: 'You are already participating in this tournament' });
    }
    
    const participant = {
      userId: req.user.id,
      characterId,
      joinedAt: new Date().toISOString(),
      status: 'active'
    };
    
    tournament.participants.push(participant);
    
    // Update user stats
    const userIndex = db.data.users.findIndex(u => u.id === req.user.id);
    if (userIndex !== -1) {
      db.data.users[userIndex].activity.tournamentsParticipated += 1;
    }
    
    await db.write();
    res.json({ msg: 'Successfully joined tournament', tournament });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.leaveTournament = async (req, res) => {
  const db = req.db;
  const { id } = req.params;
  
  try {
    await db.read();
    
    const tournament = db.data.tournaments.find(t => t.id === id);
    if (!tournament) {
      return res.status(404).json({ msg: 'Tournament not found' });
    }
    
    if (tournament.status !== 'upcoming') {
      return res.status(400).json({ msg: 'Cannot leave tournament that has already started' });
    }
    
    const participantIndex = tournament.participants.findIndex(p => p.userId === req.user.id);
    if (participantIndex === -1) {
      return res.status(400).json({ msg: 'You are not participating in this tournament' });
    }
    
    tournament.participants.splice(participantIndex, 1);
    
    // Update user stats
    const userIndex = db.data.users.findIndex(u => u.id === req.user.id);
    if (userIndex !== -1) {
      db.data.users[userIndex].activity.tournamentsParticipated -= 1;
    }
    
    await db.write();
    res.json({ msg: 'Successfully left tournament', tournament });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};