const Vote = require('../models/voteModel');
const Fight = require('../models/fightModel');
const User = require('../models/userModel');
const { addCoins } = require('./coinController');
const { useFallback, fallbackData } = require('../config/db');

// GET /api/votes/:voteId/results - Get vote results (public)
const getVoteResults = async (req, res) => {
  try {
    const { voteId } = req.params;
    
    // This would typically fetch from a Vote model
    // For now, return mock data
    res.json({
      voteId,
      totalVotes: 25,
      optionA: { votes: 15, percentage: 60 },
      optionB: { votes: 10, percentage: 40 }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/votes/poll/:pollId/results - Get poll results (public)
const getPollResults = async (req, res) => {
  try {
    const { pollId } = req.params;
    
    // This would typically fetch from a Poll model
    // For now, return mock data
    res.json({
      pollId,
      question: 'Who is the strongest hero?',
      totalVotes: 50,
      options: [
        { id: 'A', text: 'Superman', votes: 20, percentage: 40 },
        { id: 'B', text: 'Thor', votes: 15, percentage: 30 },
        { id: 'C', text: 'Goku', votes: 15, percentage: 30 }
      ]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/votes/:voteId/user - Get user's vote
const getUserVote = async (req, res) => {
  try {
    const { voteId } = req.params;
    
    // This would typically fetch from a Vote model
    // For now, return mock data
    res.json({
      voteId,
      userVote: 'A',
      hasVoted: true
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/votes/fight/:fightId - Vote on fight
const voteOnFight = async (req, res) => {
  try {
    const { fightId } = req.params;
    const { team } = req.body; // 'A' or 'B'
    const userId = req.user._id;
    
    if (!['A', 'B'].includes(team)) {
      return res.status(400).json({ message: 'Invalid team selection' });
    }
    
    let fight;
    if (useFallback()) {
      fight = fallbackData.fights.find(f => f._id === fightId);
    } else {
      fight = await Fight.findById(fightId);
    }

    if (!fight) {
      return res.status(404).json({ message: 'Fight not found' });
    }
    
    if (fight.status !== 'open') {
      return res.status(400).json({ message: 'Voting is closed for this fight' });
    }
    
    // Check if user already voted
    let existingVote;
    if (useFallback()) {
      existingVote = fight.voters.find(v => v.user === userId);
    } else {
      existingVote = fight.voters.find(v => v.user.toString() === userId.toString());
    }

    if (existingVote) {
      return res.status(400).json({ message: 'You have already voted on this fight' });
    }
    
    // Add vote
    if (useFallback()) {
      fight.voters.push({ user: userId, team });
      if (team === 'A') {
        fight.votesA = (fight.votesA || 0) + 1;
      } else {
        fight.votesB = (fight.votesB || 0) + 1;
      }
    } else {
      fight.voters.push({ user: userId, team });
      if (team === 'A') {
        fight.votesA += 1;
      } else {
        fight.votesB += 1;
      }
      
      await fight.save();
    }
    
    // Award coins for voting
    try {
      await addCoins(userId, 1, 'Voted on a fight', fightId, 'Fight');
    } catch (coinError) {
      console.error('Error awarding coins for voting:', coinError);
      // Don't fail the vote if coin awarding fails
    }
    
    // Update user activity
    if (!useFallback()) {
      await User.findByIdAndUpdate(userId, {
        $inc: { 'activity.votesGiven': 1 }
      });
    }
    
    res.json({ message: 'Vote recorded successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/votes/poll/:pollId - Vote on poll
const voteOnPoll = async (req, res) => {
  try {
    const { pollId } = req.params;
    const { option } = req.body;
    
    // This would typically save to a Poll model
    // For now, just return success
    res.json({ message: 'Poll vote recorded successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/votes/poll - Create poll (moderator only)
const createPoll = async (req, res) => {
  try {
    if (req.user.role !== 'moderator') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const { question, options } = req.body;
    
    // This would typically save to a Poll model
    // For now, just return success
    res.status(201).json({ message: 'Poll created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/votes/poll/:pollId - Update poll (moderator only)
const updatePoll = async (req, res) => {
  try {
    if (req.user.role !== 'moderator') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const { pollId } = req.params;
    const { question, options } = req.body;
    
    // This would typically update a Poll model
    // For now, just return success
    res.json({ message: 'Poll updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/votes/poll/:pollId - Delete poll (moderator only)
const deletePoll = async (req, res) => {
  try {
    if (req.user.role !== 'moderator') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const { pollId } = req.params;
    
    // This would typically delete from a Poll model
    // For now, just return success
    res.json({ message: 'Poll deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/votes/fight/:fightId - Get votes for a specific fight
const getFightVotes = async (req, res) => {
  try {
    const { fightId } = req.params;
    
    const fight = await Fight.findById(fightId);
    if (!fight) {
      return res.status(404).json({ message: 'Fight not found' });
    }
    
    res.json({
      fightId,
      votesA: fight.votesA,
      votesB: fight.votesB,
      totalVotes: fight.votesA + fight.votesB,
      voters: fight.voters.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/votes/user/:userId - Get user's voting history
const getUserVotes = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const fights = await Fight.find({
      'voters.user': userId
    }).select('teamA teamB votesA votesB voters status endsAt');
    
    const userVotes = fights.map(fight => {
      const userVote = fight.voters.find(v => v.user.toString() === userId);
      return {
        fightId: fight._id,
        team: userVote.team,
        votesA: fight.votesA,
        votesB: fight.votesB,
        status: fight.status,
        endsAt: fight.endsAt
      };
    });
    
    res.json(userVotes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/votes/stats - Get voting statistics
const getVoteStats = async (req, res) => {
  try {
    const stats = await Fight.aggregate([
      {
        $group: {
          _id: null,
          totalFights: { $sum: 1 },
          totalVotes: { $sum: { $add: ['$votesA', '$votesB'] } },
          avgVotesPerFight: { $avg: { $add: ['$votesA', '$votesB'] } }
        }
      }
    ]);
    
    res.json(stats[0] || { totalFights: 0, totalVotes: 0, avgVotesPerFight: 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getVoteResults,
  getPollResults,
  getUserVote,
  voteOnFight,
  voteOnPoll,
  createPoll,
  updatePoll,
  deletePoll,
  getFightVotes,
  getUserVotes,
  getVoteStats
}; 