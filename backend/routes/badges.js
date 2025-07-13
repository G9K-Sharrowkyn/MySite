import express from 'express';
import auth from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Badge definitions (same as frontend)
const BADGE_DEFINITIONS = {
  // Championship badges
  DIVISION_CHAMPION: {
    id: 'division_champion',
    name: 'Division Champion',
    description: 'Current champion in at least one division',
    category: 'championship'
  },
  MULTI_DIVISION_CHAMPION: {
    id: 'multi_division_champion',
    name: 'Multi-Division Champion',
    description: 'Champion in multiple divisions simultaneously',
    category: 'championship'
  },
  LONGEST_REIGN: {
    id: 'longest_reign',
    name: 'Iron Throne',
    description: 'Held a championship for over 30 days',
    category: 'championship'
  },
  // Fight badges
  FIRST_WIN: {
    id: 'first_win',
    name: 'First Victory',
    description: 'Won your first official fight',
    category: 'combat'
  },
  WINNING_STREAK_5: {
    id: 'winning_streak_5',
    name: 'Hot Streak',
    description: 'Won 5 official fights in a row',
    category: 'combat'
  },
  WINNING_STREAK_10: {
    id: 'winning_streak_10',
    name: 'Unstoppable',
    description: 'Won 10 official fights in a row',
    category: 'combat'
  },
  // Social badges
  POPULAR_FIGHTER: {
    id: 'popular_fighter',
    name: 'Fan Favorite',
    description: 'Received over 1000 votes in your fights',
    category: 'social'
  },
  COMMUNITY_HERO: {
    id: 'community_hero',
    name: 'Community Hero',
    description: 'Created 50+ fights for the community',
    category: 'social'
  },
  DEBATE_MASTER: {
    id: 'debate_master',
    name: 'Debate Master',
    description: 'Posted 100+ comments on fights',
    category: 'social'
  }
};

// Get user badges
router.get('/:userId', async (req, res) => {
  try {
    await req.db.read();
    const { userId } = req.params;
    
    const user = req.db.data.users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const badges = user.badges || [];
    res.json(badges);
  } catch (error) {
    console.error('Error fetching badges:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Award badge (internal function)
const awardBadge = async (db, userId, badgeId, details = null) => {
  const userIndex = db.data.users.findIndex(u => u.id === userId);
  if (userIndex === -1) return false;
  
  if (!db.data.users[userIndex].badges) {
    db.data.users[userIndex].badges = [];
  }
  
  // Check if badge already exists
  const existingBadge = db.data.users[userIndex].badges.find(b => b.badgeId === badgeId);
  if (existingBadge) return false;
  
  // Award badge
  const newBadge = {
    id: uuidv4(),
    badgeId,
    earnedAt: new Date().toISOString(),
    details
  };
  
  db.data.users[userIndex].badges.push(newBadge);
  
  // Create notification
  if (!db.data.notifications) db.data.notifications = [];
  db.data.notifications.push({
    id: uuidv4(),
    userId,
    type: 'badge_earned',
    message: `You earned a new badge: ${BADGE_DEFINITIONS[badgeId]?.name || badgeId}!`,
    read: false,
    createdAt: new Date().toISOString(),
    badgeId
  });
  
  await db.write();
  return true;
};

// Check and award badges after fight result
const checkFightBadges = async (db, winnerId, loserId) => {
  // Check winner badges
  if (winnerId) {
    const winnerIndex = db.data.users.findIndex(u => u.id === winnerId);
    if (winnerIndex !== -1) {
      const winner = db.data.users[winnerIndex];
      
      // First win badge
      const totalWins = Object.values(winner.divisions || {})
        .reduce((sum, div) => sum + (div.wins || 0), 0);
      
      if (totalWins === 1) {
        await awardBadge(db, winnerId, 'FIRST_WIN');
      }
      
      // Winning streak badges
      const currentStreak = Math.max(
        ...Object.values(winner.divisions || {}).map(div => div.streak || 0)
      );
      
      if (currentStreak === 5) {
        await awardBadge(db, winnerId, 'WINNING_STREAK_5');
      }
      if (currentStreak === 10) {
        await awardBadge(db, winnerId, 'WINNING_STREAK_10');
      }
    }
  }
};

// Check and award championship badges
const checkChampionshipBadges = async (db, userId) => {
  const userIndex = db.data.users.findIndex(u => u.id === userId);
  if (userIndex === -1) return;
  
  const user = db.data.users[userIndex];
  const championDivisions = Object.entries(user.divisions || {})
    .filter(([_, div]) => div.isChampion)
    .map(([divId, div]) => ({
      divisionId: divId,
      since: div.championSince
    }));
  
  // Division champion badge
  if (championDivisions.length >= 1) {
    await awardBadge(db, userId, 'DIVISION_CHAMPION');
  }
  
  // Multi-division champion badge
  if (championDivisions.length >= 2) {
    await awardBadge(db, userId, 'MULTI_DIVISION_CHAMPION');
  }
  
  // Longest reign badge
  const now = new Date();
  const hasLongReign = championDivisions.some(champ => {
    const reignDays = (now - new Date(champ.since)) / (1000 * 60 * 60 * 24);
    return reignDays >= 30;
  });
  
  if (hasLongReign) {
    await awardBadge(db, userId, 'LONGEST_REIGN');
  }
};

// Check social badges
const checkSocialBadges = async (db, userId) => {
  const userIndex = db.data.users.findIndex(u => u.id === userId);
  if (userIndex === -1) return;
  
  const user = db.data.users[userIndex];
  
  // Community hero badge
  const fightsCreated = db.data.posts?.filter(p => 
    p.authorId === userId && p.type === 'fight'
  ).length || 0;
  
  if (fightsCreated >= 50) {
    await awardBadge(db, userId, 'COMMUNITY_HERO');
  }
  
  // Debate master badge
  const commentsPosted = db.data.comments?.filter(c => 
    c.authorId === userId
  ).length || 0;
  
  if (commentsPosted >= 100) {
    await awardBadge(db, userId, 'DEBATE_MASTER');
  }
  
  // Popular fighter badge
  const totalVotesReceived = db.data.posts
    ?.filter(p => p.authorId === userId && p.type === 'fight')
    .reduce((sum, post) => {
      const votes = (post.fight?.votes?.teamA || 0) + (post.fight?.votes?.teamB || 0);
      return sum + votes;
    }, 0) || 0;
  
  if (totalVotesReceived >= 1000) {
    await awardBadge(db, userId, 'POPULAR_FIGHTER');
  }
};

// Export functions for use in other routes
export default router;