import Vote from '../models/Vote.js';
import Fight from '../models/Fight.js';

// @desc    Vote on a fight
// @route   POST /api/votes
// @access  Private
export const vote = async (req, res) => {
  try {
    console.log('Vote request received:', {
      userId: req.user.id,
      body: req.body
    });

    const { fightId, choice } = req.body; // choice: 'fighter1' or 'fighter2' or 'A' or 'B'

    // Check if fight exists
    const fight = await Fight.findById(fightId);
    if (!fight) {
      console.error('Fight not found:', fightId);
      return res.status(404).json({ msg: 'Walka nie znaleziona' });
    }

    // Check if fight is still active
    if (fight.status !== 'active') {
      return res.status(400).json({ msg: 'Nie można głosować na zakończoną walkę' });
    }

    // Convert old choice format to new format
    let team;
    if (choice === 'fighter1' || choice === 'teamA' || choice === 'A') {
      team = 'A';
    } else if (choice === 'fighter2' || choice === 'teamB' || choice === 'B') {
      team = 'B';
    } else if (choice === 'draw') {
      team = 'draw';
    } else {
      return res.status(400).json({ msg: 'Nieprawidłowy wybór' });
    }

    // Check if user already voted
    const existingVote = await Vote.findOne({ fightId: fight._id, userId: req.user.id });

    if (existingVote) {
      // Update existing vote
      existingVote.team = team;
      existingVote.updatedAt = new Date();
      await existingVote.save();

      // Update fight vote counts
      const teamAVotes = await Vote.countDocuments({ fightId: fight._id, team: { $in: ['A', 'teamA'] } });
      const teamBVotes = await Vote.countDocuments({ fightId: fight._id, team: { $in: ['B', 'teamB'] } });
      fight.votesA = teamAVotes;
      fight.votesB = teamBVotes;
      await fight.save();

      console.log('Vote updated:', existingVote);
      return res.json({ msg: 'Głos zaktualizowany', vote: existingVote });
    }

    // Create new vote
    const newVote = await Vote.create({
      fightId: fight._id,
      userId: req.user.id,
      team,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    // Update fight vote counts
    const teamAVotes = await Vote.countDocuments({ fightId: fight._id, team: { $in: ['A', 'teamA'] } });
    const teamBVotes = await Vote.countDocuments({ fightId: fight._id, team: { $in: ['B', 'teamB'] } });
    fight.votesA = teamAVotes;
    fight.votesB = teamBVotes;
    await fight.save();

    console.log('Vote created:', newVote);
    res.json({ msg: 'Głos oddany', vote: newVote });
  } catch (error) {
    console.error('Error processing vote:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get user's vote for a fight
// @route   GET /api/votes/fight/:fightId/user
// @access  Private
export const getUserVote = async (req, res) => {
  try {
    const vote = await Vote.findOne({
      fightId: req.params.fightId,
      userId: req.user.id
    });

    if (!vote) {
      return res.status(404).json({ msg: 'Nie znaleziono głosu' });
    }

    res.json(vote);
  } catch (error) {
    console.error('Error fetching user vote:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get vote statistics for a fight
// @route   GET /api/votes/fight/:fightId/stats
// @access  Public
export const getFightVoteStats = async (req, res) => {
  try {
    const totalVotes = await Vote.countDocuments({ fightId: req.params.fightId });
    const teamAVotes = await Vote.countDocuments({ fightId: req.params.fightId, team: { $in: ['A', 'teamA'] } });
    const teamBVotes = await Vote.countDocuments({ fightId: req.params.fightId, team: { $in: ['B', 'teamB'] } });

    const fighter1Percentage = totalVotes > 0 ? ((teamAVotes / totalVotes) * 100).toFixed(1) : 0;
    const fighter2Percentage = totalVotes > 0 ? ((teamBVotes / totalVotes) * 100).toFixed(1) : 0;

    res.json({
      fighter1Votes: teamAVotes,
      fighter2Votes: teamBVotes,
      teamAVotes,
      teamBVotes,
      totalVotes,
      fighter1Percentage: parseFloat(fighter1Percentage),
      fighter2Percentage: parseFloat(fighter2Percentage)
    });
  } catch (error) {
    console.error('Error fetching vote stats:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Remove vote
// @route   DELETE /api/votes/fight/:fightId
// @access  Private
export const removeVote = async (req, res) => {
  try {
    const vote = await Vote.findOne({
      fightId: req.params.fightId,
      userId: req.user.id
    });

    if (!vote) {
      return res.status(404).json({ msg: 'Nie znaleziono głosu' });
    }

    // Check if fight is still active
    const fight = await Fight.findById(req.params.fightId);
    if (fight && fight.status !== 'active') {
      return res.status(400).json({ msg: 'Nie można usunąć głosu z zakończonej walki' });
    }

    await Vote.findByIdAndDelete(vote._id);

    // Update fight vote counts
    if (fight) {
      const teamAVotes = await Vote.countDocuments({ fightId: fight._id, team: { $in: ['A', 'teamA'] } });
      const teamBVotes = await Vote.countDocuments({ fightId: fight._id, team: { $in: ['B', 'teamB'] } });
      fight.votesA = teamAVotes;
      fight.votesB = teamBVotes;
      await fight.save();
    }

    res.json({ msg: 'Głos usunięty' });
  } catch (error) {
    console.error('Error removing vote:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all votes by user
// @route   GET /api/votes/user/me
// @access  Private
export const getUserVotes = async (req, res) => {
  try {
    const userVotes = await Vote.find({ userId: req.user.id });

    // Add fight details to each vote
    const votesWithFights = await Promise.all(userVotes.map(async (vote) => {
      const fight = await Fight.findById(vote.fightId);
      return {
        ...vote.toObject(),
        fight: fight ? {
          id: fight._id,
          title: fight.title,
          fighter1: fight.teamA?.[0]?.characterName || 'Fighter 1',
          fighter2: fight.teamB?.[0]?.characterName || 'Fighter 2',
          status: fight.status,
          winner: fight.result?.winner
        } : null
      };
    }));

    res.json(votesWithFights);
  } catch (error) {
    console.error('Error fetching user votes:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
