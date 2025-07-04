const { v4: uuidv4 } = require('uuid');

exports.voteForFight = async (req, res) => {
  const db = req.db;
  const { fightId } = req.params;
  const { team, postId } = req.body; // team: 'A' or 'B', postId for community fights
  
  try {
    await db.read();
    
    let fight = null;
    let isPostFight = false;
    
    // Check if it's a tournament fight or community post fight
    if (postId) {
      const post = db.data.posts.find(p => p.id === postId && p.type === 'fight');
      if (!post) {
        return res.status(404).json({ msg: 'Fight post not found' });
      }
      fight = post.fight;
      isPostFight = true;
    } else {
      fight = db.data.fights.find(f => f.id === fightId);
      if (!fight) {
        return res.status(404).json({ msg: 'Fight not found' });
      }
    }
    
    if (fight.status !== 'active') {
      return res.status(400).json({ msg: 'Voting is closed for this fight' });
    }
    
    // Check if user already voted
    const existingVoteIndex = fight.votes.voters.findIndex(v => v.userId === req.user.id);
    
    if (existingVoteIndex > -1) {
      // Update existing vote
      const oldTeam = fight.votes.voters[existingVoteIndex].team;
      if (oldTeam === team) {
        return res.status(400).json({ msg: 'You have already voted for this team' });
      }
      
      // Remove old vote count and add new one
      if (oldTeam === 'A') {
        fight.votes.teamA -= 1;
      } else {
        fight.votes.teamB -= 1;
      }
      
      if (team === 'A') {
        fight.votes.teamA += 1;
      } else {
        fight.votes.teamB += 1;
      }
      
      fight.votes.voters[existingVoteIndex] = {
        userId: req.user.id,
        team,
        votedAt: new Date().toISOString()
      };
    } else {
      // New vote
      if (team === 'A') {
        fight.votes.teamA += 1;
      } else {
        fight.votes.teamB += 1;
      }
      
      fight.votes.voters.push({
        userId: req.user.id,
        team,
        votedAt: new Date().toISOString()
      });
    }
    
    await db.write();
    
    res.json({
      msg: 'Vote recorded successfully',
      votes: {
        teamA: fight.votes.teamA,
        teamB: fight.votes.teamB,
        total: fight.votes.teamA + fight.votes.teamB
      },
      userVote: team
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.getFightVotes = async (req, res) => {
  const db = req.db;
  const { fightId } = req.params;
  const { postId } = req.query;
  
  try {
    await db.read();
    
    let fight = null;
    
    if (postId) {
      const post = db.data.posts.find(p => p.id === postId && p.type === 'fight');
      if (!post) {
        return res.status(404).json({ msg: 'Fight post not found' });
      }
      fight = post.fight;
    } else {
      fight = db.data.fights.find(f => f.id === fightId);
      if (!fight) {
        return res.status(404).json({ msg: 'Fight not found' });
      }
    }
    
    const totalVotes = fight.votes.teamA + fight.votes.teamB;
    const teamAPercentage = totalVotes > 0 ? Math.round((fight.votes.teamA / totalVotes) * 100) : 0;
    const teamBPercentage = totalVotes > 0 ? Math.round((fight.votes.teamB / totalVotes) * 100) : 0;
    
    res.json({
      votes: {
        teamA: fight.votes.teamA,
        teamB: fight.votes.teamB,
        total: totalVotes
      },
      percentages: {
        teamA: teamAPercentage,
        teamB: teamBPercentage
      },
      status: fight.status
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.getUserVotes = async (req, res) => {
  const db = req.db;
  const { userId } = req.params;
  
  try {
    await db.read();
    
    // Check if requesting user's own votes or if user is moderator
    const requestingUser = db.data.users.find(u => u.id === req.user.id);
    if (req.user.id !== userId && requestingUser.role !== 'moderator') {
      return res.status(403).json({ msg: 'Access denied' });
    }
    
    const userVotes = [];
    
    // Check tournament fights
    db.data.fights.forEach(fight => {
      const userVote = fight.votes.voters.find(v => v.userId === userId);
      if (userVote) {
        userVotes.push({
          fightId: fight.id,
          type: 'tournament',
          team: userVote.team,
          votedAt: userVote.votedAt,
          fightTitle: fight.title || `${fight.teamA?.name} vs ${fight.teamB?.name}`
        });
      }
    });
    
    // Check community post fights
    db.data.posts.forEach(post => {
      if (post.type === 'fight' && post.fight) {
        const userVote = post.fight.votes.voters.find(v => v.userId === userId);
        if (userVote) {
          userVotes.push({
            fightId: post.id,
            type: 'community',
            team: userVote.team,
            votedAt: userVote.votedAt,
            fightTitle: post.title
          });
        }
      }
    });
    
    // Sort by vote date (newest first)
    userVotes.sort((a, b) => new Date(b.votedAt) - new Date(a.votedAt));
    
    res.json({
      votes: userVotes,
      totalVotes: userVotes.length
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};