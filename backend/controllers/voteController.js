const { v4: uuidv4 } = require('uuid');

// @desc    Vote on a fight
// @route   POST /api/votes
// @access  Private
exports.vote = async (req, res) => {
  try {
    console.log('Vote request received:', {
      userId: req.user.id,
      body: req.body
    });

    const { fightId, choice } = req.body; // choice: 'fighter1' or 'fighter2'
    const db = req.db;
    await db.read();

    // Check if fight exists
    const fight = db.data.fights.find(f => f.id === fightId);
    if (!fight) {
      console.error('Fight not found:', fightId);
      return res.status(404).json({ msg: 'Walka nie znaleziona' });
    }

    // Check if fight is still active
    if (fight.status !== 'active') {
      return res.status(400).json({ msg: 'Nie można głosować na zakończoną walkę' });
    }

    // Check if user already voted
    const existingVote = db.data.votes.find(v => v.fightId === fightId && v.userId === req.user.id);
    if (existingVote) {
      // Update existing vote
      existingVote.choice = choice;
      existingVote.updatedAt = new Date().toISOString();
      await db.write();
      console.log('Vote updated:', existingVote);
      return res.json({ msg: 'Głos zaktualizowany', vote: existingVote });
    }

    // Create new vote
    const newVote = {
      id: uuidv4(),
      fightId,
      userId: req.user.id,
      choice,
      createdAt: new Date().toISOString()
    };

    db.data.votes.push(newVote);
    await db.write();

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
exports.getUserVote = async (req, res) => {
  const db = req.db;
  await db.read();

  const vote = db.data.votes.find(v => v.fightId === req.params.fightId && v.userId === req.user.id);
  
  if (!vote) {
    return res.status(404).json({ msg: 'Nie znaleziono głosu' });
  }

  res.json(vote);
};

// @desc    Get vote statistics for a fight
// @route   GET /api/votes/fight/:fightId/stats
// @access  Public
exports.getFightVoteStats = async (req, res) => {
  const db = req.db;
  await db.read();

  const fightVotes = db.data.votes.filter(v => v.fightId === req.params.fightId);
  
  const fighter1Votes = fightVotes.filter(v => v.choice === 'fighter1').length;
  const fighter2Votes = fightVotes.filter(v => v.choice === 'fighter2').length;
  const totalVotes = fightVotes.length;

  const fighter1Percentage = totalVotes > 0 ? ((fighter1Votes / totalVotes) * 100).toFixed(1) : 0;
  const fighter2Percentage = totalVotes > 0 ? ((fighter2Votes / totalVotes) * 100).toFixed(1) : 0;

  res.json({
    fighter1Votes,
    fighter2Votes,
    totalVotes,
    fighter1Percentage: parseFloat(fighter1Percentage),
    fighter2Percentage: parseFloat(fighter2Percentage)
  });
};

// @desc    Remove vote
// @route   DELETE /api/votes/fight/:fightId
// @access  Private
exports.removeVote = async (req, res) => {
  const db = req.db;
  await db.read();

  const voteIndex = db.data.votes.findIndex(v => v.fightId === req.params.fightId && v.userId === req.user.id);
  
  if (voteIndex === -1) {
    return res.status(404).json({ msg: 'Nie znaleziono głosu' });
  }

  // Check if fight is still active
  const fight = db.data.fights.find(f => f.id === req.params.fightId);
  if (fight && fight.status !== 'active') {
    return res.status(400).json({ msg: 'Nie można usunąć głosu z zakończonej walki' });
  }

  db.data.votes.splice(voteIndex, 1);
  await db.write();

  res.json({ msg: 'Głos usunięty' });
};

// @desc    Get all votes by user
// @route   GET /api/votes/user/me
// @access  Private
exports.getUserVotes = async (req, res) => {
  const db = req.db;
  await db.read();

  const userVotes = db.data.votes.filter(v => v.userId === req.user.id);
  
  // Add fight details to each vote
  const votesWithFights = userVotes.map(vote => {
    const fight = db.data.fights.find(f => f.id === vote.fightId);
    return {
      ...vote,
      fight: fight ? {
        id: fight.id,
        title: fight.title,
        fighter1: fight.fighter1,
        fighter2: fight.fighter2,
        status: fight.status,
        winner: fight.winner
      } : null
    };
  });

  res.json(votesWithFights);
};