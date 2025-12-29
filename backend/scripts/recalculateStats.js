import { readDb, updateDb } from '../services/jsonDb.js';

/**
 * One-time script to recalculate all user stats
 * This ensures the cached stats in user.stats are accurate
 */
async function recalculateStats() {
  console.log('Starting stats recalculation...');
  
  await updateDb((db) => {
    const users = db.users || [];
    const fights = db.fights || [];
    const posts = db.posts || [];
    const comments = db.comments || [];
    const votes = db.votes || [];
    
    console.log(`Processing ${users.length} users...`);
    
    users.forEach(user => {
      const userId = user.id || user._id;
      
      // Calculate fight stats
      const userFights = fights.filter(fight => 
        Array.isArray(fight.participants) && 
        fight.participants.some(p => p.userId === userId) &&
        fight.status === 'ended'
      );
      
      const userWins = userFights.filter(fight => {
        const participant = fight.participants.find(p => p.userId === userId);
        if (!participant) return false;
        
        const participantTeam = participant.team || participant.side;
        const winner = fight.result?.winner;
        
        return (winner === 'A' && ['A', 'teamA', 'fighter1'].includes(participantTeam)) ||
               (winner === 'B' && ['B', 'teamB', 'fighter2'].includes(participantTeam));
      });
      
      const userLosses = userFights.filter(fight => {
        const participant = fight.participants.find(p => p.userId === userId);
        if (!participant) return false;
        
        const participantTeam = participant.team || participant.side;
        const winner = fight.result?.winner;
        
        if (winner === 'draw') return false;
        
        return (winner === 'A' && !['A', 'teamA', 'fighter1'].includes(participantTeam)) ||
               (winner === 'B' && !['B', 'teamB', 'fighter2'].includes(participantTeam));
      });
      
      // Calculate post stats
      const userPosts = posts.filter(p => (p.authorId === userId || p.userId === userId));
      
      // Calculate comment stats
      const userComments = comments.filter(c => (c.authorId === userId || c.userId === userId));
      
      // Calculate vote stats
      const userVotes = votes.filter(v => v.userId === userId);
      
      // Initialize stats if not exists
      if (!user.stats) {
        user.stats = {};
      }
      
      // Update fight stats
      user.stats.fights = {
        total: userFights.length,
        wins: userWins.length,
        losses: userLosses.length,
        winRate: userFights.length > 0 ? Math.round((userWins.length / userFights.length) * 100) : 0
      };
      
      // Update other stats
      user.stats.posts = userPosts.length;
      user.stats.comments = userComments.length;
      user.stats.votes = userVotes.length;
      
      // Preserve experience and points if they exist
      user.stats.experience = user.stats.experience || 0;
      user.stats.points = user.stats.points || 0;
      user.stats.level = user.stats.level || Math.floor((user.stats.experience || 0) / 100) + 1;
      
      console.log(`Updated stats for ${user.username}: ${userFights.length} fights, ${userWins.length} wins, ${userPosts.length} posts`);
    });
    
    return db;
  });
  
  console.log('Stats recalculation complete!');
}

// Run the script
recalculateStats()
  .then(() => {
    console.log('Success!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
