const { v4: uuidv4 } = require('uuid');

exports.getAllTournaments = async (req, res) => {
  const db = req.db;
  
  try {
    await db.read();
    const tournaments = db.data.tournaments || [];
    res.json(tournaments);
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
    
    res.json(tournament);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.createTournament = async (req, res) => {
  const db = req.db;
  const { title, description, startDate, endDate, maxParticipants, rules } = req.body;
  
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
      status: 'upcoming', // upcoming, active, completed
      participants: [],
      fights: [],
      createdBy: req.user.id,
      createdAt: new Date().toISOString(),
      winner: null
    };
    
    db.data.tournaments.push(newTournament);
    await db.write();
    
    res.json(newTournament);
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