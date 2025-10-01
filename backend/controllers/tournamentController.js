import Tournament from '../models/Tournament.js';
import User from '../models/User.js';

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

export const getAllTournaments = async (req, res) => {
  try {
    const tournaments = await Tournament.find()
      .populate('createdBy', 'username')
      .populate('participants', 'username profile.profilePicture')
      .sort({ createdAt: -1 });

    // Add participant count and status info
    const enhancedTournaments = tournaments.map(tournament => ({
      ...tournament.toObject(),
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

export const getTournamentById = async (req, res) => {
  const { id } = req.params;

  try {
    const tournament = await Tournament.findById(id)
      .populate('createdBy', 'username')
      .populate('participants', 'username profile.profilePicture')
      .populate('winner', 'username');

    if (!tournament) {
      return res.status(404).json({ msg: 'Tournament not found' });
    }

    // Add user participation info if authenticated
    const tournamentObj = tournament.toObject();
    if (req.user) {
      const userParticipation = tournament.participants?.find(
        p => p._id.toString() === req.user.id
      );
      tournamentObj.userParticipation = userParticipation || null;
    }

    res.json(tournamentObj);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

export const createTournament = async (req, res) => {
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
    // Check if user is moderator
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'moderator') {
      return res.status(403).json({ msg: 'Access denied. Moderator role required.' });
    }

    const newTournament = new Tournament({
      name: title,
      description,
      startDate,
      endDate,
      maxParticipants: maxParticipants || 32,
      rules: rules || '',
      tournamentType: tournamentType || 'single_elimination',
      divisionId: divisionId || null,
      prize: prizePool || '0',
      createdBy: req.user.id,
      status: 'upcoming',
      participants: [],
      fights: [],
      settings: {
        publicJoin: true,
        votingDuration: 24,
        requireApproval: false
      }
    });

    // Store additional fields not in schema as metadata
    newTournament.brackets = [];
    newTournament.stats = {
      totalMatches: 0,
      completedMatches: 0,
      totalVotes: 0
    };

    await newTournament.save();

    res.json(newTournament);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

export const startTournament = async (req, res) => {
  const { id } = req.params;

  try {
    // Check if user is moderator
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'moderator') {
      return res.status(403).json({ msg: 'Access denied. Moderator role required.' });
    }

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ msg: 'Tournament not found' });
    }

    if (tournament.status !== 'upcoming') {
      return res.status(400).json({ msg: 'Tournament cannot be started' });
    }

    if (tournament.participants.length < 2) {
      return res.status(400).json({ msg: 'Need at least 2 participants to start tournament' });
    }

    // Get participant details for seeding
    const participants = await User.find({
      _id: { $in: tournament.participants }
    }).select('_id stats.points');

    const participantsWithPoints = participants.map(p => ({
      userId: p._id,
      points: p.stats?.points || 0
    }));

    // Generate brackets
    const brackets = generateBrackets(participantsWithPoints, 'single_elimination');

    // Update tournament
    tournament.status = 'active';
    tournament.startDate = new Date();
    tournament.brackets = brackets;
    tournament.stats = {
      totalMatches: brackets.reduce((total, round) => total + round.matches.length, 0),
      completedMatches: 0,
      totalVotes: 0
    };

    await tournament.save();

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

export const advanceMatch = async (req, res) => {
  const { id, matchId } = req.params;
  const { winnerId } = req.body;

  try {
    // Check if user is moderator
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'moderator') {
      return res.status(403).json({ msg: 'Access denied. Moderator role required.' });
    }

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ msg: 'Tournament not found' });
    }

    if (tournament.status !== 'active') {
      return res.status(400).json({ msg: 'Tournament is not active' });
    }

    // Advance the tournament
    const updatedTournament = advanceTournament(tournament, matchId, winnerId);

    // Update stats
    if (!updatedTournament.stats) {
      updatedTournament.stats = { totalMatches: 0, completedMatches: 0, totalVotes: 0 };
    }
    updatedTournament.stats.completedMatches += 1;

    // Update user stats for winner if tournament is completed
    if (updatedTournament.status === 'completed') {
      const winner = await User.findById(winnerId);
      if (winner) {
        if (!winner.activity) {
          winner.activity = {
            postsCreated: 0,
            likesReceived: 0,
            commentsPosted: 0,
            tournamentsWon: 0,
            tournamentsParticipated: 0
          };
        }
        winner.activity.tournamentsWon = (winner.activity.tournamentsWon || 0) + 1;
        if (!winner.stats) winner.stats = {};
        winner.stats.experience = (winner.stats.experience || 0) + 20;
        await winner.save();
      }
    }

    await tournament.save();

    res.json({
      msg: 'Match advanced successfully',
      tournament: updatedTournament
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

export const voteInTournament = async (req, res) => {
  const { id, matchId } = req.params;
  const { winnerId } = req.body;

  try {
    const tournament = await Tournament.findById(id);
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
    if (!tournament.stats) {
      tournament.stats = { totalMatches: 0, completedMatches: 0, totalVotes: 0 };
    }
    tournament.stats.totalVotes = (tournament.stats.totalVotes || 0) + 1;

    await tournament.save();

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

export const getTournamentBrackets = async (req, res) => {
  const { id } = req.params;

  try {
    const tournament = await Tournament.findById(id);

    if (!tournament) {
      return res.status(404).json({ msg: 'Tournament not found' });
    }

    res.json({
      tournament: {
        id: tournament._id,
        title: tournament.name,
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

export const updateTournament = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    // Check if user is moderator
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'moderator') {
      return res.status(403).json({ msg: 'Access denied. Moderator role required.' });
    }

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ msg: 'Tournament not found' });
    }

    // Update fields
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined && key !== '_id' && key !== 'createdBy') {
        tournament[key] = updates[key];
      }
    });

    tournament.updatedAt = new Date();

    await tournament.save();
    res.json(tournament);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

export const deleteTournament = async (req, res) => {
  const { id } = req.params;

  try {
    // Check if user is moderator
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'moderator') {
      return res.status(403).json({ msg: 'Access denied. Moderator role required.' });
    }

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ msg: 'Tournament not found' });
    }

    await Tournament.findByIdAndDelete(id);

    res.json({ msg: 'Tournament deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

export const joinTournament = async (req, res) => {
  const { id } = req.params;
  const { characterId } = req.body;

  try {
    const tournament = await Tournament.findById(id);
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
    const isAlreadyParticipating = tournament.participants.some(
      p => p.toString() === req.user.id
    );
    if (isAlreadyParticipating) {
      return res.status(400).json({ msg: 'You are already participating in this tournament' });
    }

    // Add participant
    tournament.participants.push(req.user.id);

    // Update user stats
    const user = await User.findById(req.user.id);
    if (user) {
      if (!user.activity) {
        user.activity = {
          postsCreated: 0,
          likesReceived: 0,
          commentsPosted: 0,
          tournamentsWon: 0,
          tournamentsParticipated: 0
        };
      }
      user.activity.tournamentsParticipated = (user.activity.tournamentsParticipated || 0) + 1;
      await user.save();
    }

    await tournament.save();
    res.json({ msg: 'Successfully joined tournament', tournament });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

export const leaveTournament = async (req, res) => {
  const { id } = req.params;

  try {
    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ msg: 'Tournament not found' });
    }

    if (tournament.status !== 'upcoming') {
      return res.status(400).json({ msg: 'Cannot leave tournament that has already started' });
    }

    const participantIndex = tournament.participants.findIndex(
      p => p.toString() === req.user.id
    );
    if (participantIndex === -1) {
      return res.status(400).json({ msg: 'You are not participating in this tournament' });
    }

    // Remove participant
    tournament.participants.splice(participantIndex, 1);

    // Update user stats
    const user = await User.findById(req.user.id);
    if (user && user.activity) {
      user.activity.tournamentsParticipated = Math.max(
        0,
        (user.activity.tournamentsParticipated || 0) - 1
      );
      await user.save();
    }

    await tournament.save();
    res.json({ msg: 'Successfully left tournament', tournament });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};
