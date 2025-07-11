const { v4: uuidv4 } = require('uuid');

exports.getAllPosts = async (req, res) => {
  const db = req.db;
  const { page = 1, limit = 10, sortBy = 'createdAt' } = req.query;
  
  try {
    console.log('Fetching all posts with params:', { page, limit, sortBy });
    await db.read();
    let posts = db.data.posts || [];
    
    // Sort posts
    posts.sort((a, b) => {
      if (sortBy === 'likes') {
        return b.likes.length - a.likes.length;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedPosts = posts.slice(startIndex, endIndex);
    
    // Add user info to posts
    const postsWithUserInfo = paginatedPosts.map(post => {
      const author = db.data.users.find(u => u.id === post.authorId);
      return {
        ...post,
        author: author ? {
          id: author.id,
          username: author.username,
          profilePicture: author.profile?.profilePicture || '',
          rank: author.stats?.rank || 'Rookie'
        } : null
      };
    });
    
    console.log(`Returning ${postsWithUserInfo.length} posts out of ${posts.length}`);
    res.json({
      posts: postsWithUserInfo,
      totalPosts: posts.length,
      currentPage: parseInt(page),
      totalPages: Math.ceil(posts.length / limit)
    });
  } catch (err) {
    console.error('Error fetching all posts:', err.message);
    res.status(500).send('Server Error');
  }
};

exports.getPostsByUser = async (req, res) => {
  const db = req.db;
  const { userId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  
  try {
    await db.read();
    
    if (!db.data.posts) {
      return res.json([]);
    }
    
    // Filter posts by user ID
    let userPosts = db.data.posts.filter(post => post.authorId === userId);
    
    // Sort by creation date (newest first)
    userPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedPosts = userPosts.slice(startIndex, endIndex);
    
    // Add author info to posts
    const author = db.data.users.find(u => u.id === userId);
    const postsWithUserInfo = paginatedPosts.map(post => ({
      ...post,
      author: author ? {
        id: author.id,
        username: author.username,
        profilePicture: author.profile?.profilePicture || author.profilePicture || '',
        rank: author.stats?.rank || author.rank || 'Rookie'
      } : null
    }));
    
    res.json(postsWithUserInfo);
  } catch (err) {
    console.error('Error fetching user posts:', err.message);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

exports.getPostById = async (req, res) => {
  const db = req.db;
  const { id } = req.params;
  
  try {
    await db.read();
    const post = db.data.posts.find(p => p.id === id);
    
    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }
    
    // Add author info
    const author = db.data.users.find(u => u.id === post.authorId);
    const postWithAuthor = {
      ...post,
      author: author ? {
        id: author.id,
        username: author.username,
        profilePicture: author.profile?.profilePicture || '',
        rank: author.stats?.rank || 'Rookie'
      } : null
    };
    
    res.json(postWithAuthor);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.createPost = async (req, res) => {
  const db = req.db;
  const { title, content, type, teamA, teamB, photos, pollOptions, isOfficial, moderatorCreated, category } = req.body;
  
  try {
    await db.read();
    
    // Check if user is moderator for official fights
    const user = db.data.users.find(u => u.id === req.user.id);
    if (isOfficial && user.role !== 'moderator') {
      return res.status(403).json({ message: 'Only moderators can create official fights' });
    }
    
    const newPost = {
      id: uuidv4(),
      title,
      content,
      type: type || 'discussion', // discussion, fight, other
      authorId: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      likes: [],
      comments: [],
      views: 0,
      photos: photos && photos.length > 0 ? photos : [],
      poll: null,
      fight: null,
      isOfficial: isOfficial || false,
      moderatorCreated: moderatorCreated || false,
      category: category || null,
      featured: false,
      tags: [] // Will be populated below
    };

    if (type === 'fight') {
      // Calculate lock time (72 hours from creation)
      const lockTime = new Date();
      lockTime.setHours(lockTime.getHours() + 72);
      
      newPost.fight = {
        teamA: teamA || null,
        teamB: teamB || null,
        votes: {
          teamA: 0,
          teamB: 0,
          voters: []
        },
        status: 'active', // active, completed, locked
        isOfficial: isOfficial || false,
        lockTime: lockTime.toISOString(), // When the fight will be locked
        winner: null, // Will be set when fight is locked
        winnerTeam: null // 'teamA', 'teamB', or 'draw'
      };
      // For fight posts, pollOptions are mandatory and correspond to teamA and teamB
      newPost.poll = {
        options: [teamA, teamB],
        votes: {
          voters: []
        }
      };
    } else if (type === 'other' && pollOptions && pollOptions.some(opt => opt.trim() !== '')) {
      // For other posts, optional poll
      newPost.poll = {
        options: pollOptions.filter(opt => opt.trim() !== ''),
        votes: {
          voters: []
        }
      };
    }
    
    // Generate tags if the function is provided
    if (req.generateTagsFromPost) {
      newPost.tags = req.generateTagsFromPost(newPost);
    }

    db.data.posts.push(newPost);
    
    // Update user stats safely
    const userIndex = db.data.users.findIndex(u => u.id === req.user.id);
    if (userIndex !== -1) {
      // Initialize activity and stats if they don't exist
      if (!db.data.users[userIndex].activity) {
        db.data.users[userIndex].activity = {
          postsCreated: 0,
          likesReceived: 0,
          commentsPosted: 0,
          fightsCreated: 0,
          votesGiven: 0,
          officialFightsCreated: 0
        };
      }
      if (!db.data.users[userIndex].stats) {
        db.data.users[userIndex].stats = {
          experience: 0,
          rank: 'Rookie',
          level: 1,
          points: 0
        };
      }
      
      db.data.users[userIndex].activity.postsCreated += 1;
      db.data.users[userIndex].stats.experience += 10; // Award experience for posting
      
      if (type === 'fight') {
        db.data.users[userIndex].activity.fightsCreated += 1;
        if (isOfficial) {
          db.data.users[userIndex].activity.officialFightsCreated += 1;
          db.data.users[userIndex].stats.experience += 50; // Extra experience for official fights
        }
      }
    }
    
    await db.write();
    
    // Return post with author info
    const author = db.data.users.find(u => u.id === req.user.id);
    const postWithAuthor = {
      ...newPost,
      author: {
        id: author.id,
        username: author.username,
        profilePicture: author.profile?.profilePicture || '',
        rank: author.stats?.rank || 'Rookie'
      }
    };
    
    res.json(postWithAuthor);
  } catch (err) {
    console.error('Error creating post:', err.message);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

exports.updatePost = async (req, res) => {
  const db = req.db;
  const { id } = req.params;
  const updates = req.body;
  
  try {
    await db.read();
    
    const postIndex = db.data.posts.findIndex(p => p.id === id);
    if (postIndex === -1) {
      return res.status(404).json({ msg: 'Post not found' });
    }
    
    const post = db.data.posts[postIndex];
    
    // Check if user is the author or moderator
    const user = db.data.users.find(u => u.id === req.user.id);
    if (post.authorId !== req.user.id && user.role !== 'moderator') {
      return res.status(403).json({ msg: 'Access denied' });
    }
    
    db.data.posts[postIndex] = {
      ...post,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await db.write();
    res.json(db.data.posts[postIndex]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.deletePost = async (req, res) => {
  const db = req.db;
  const { id } = req.params;
  
  try {
    await db.read();
    
    const postIndex = db.data.posts.findIndex(p => p.id === id);
    if (postIndex === -1) {
      return res.status(404).json({ msg: 'Post not found' });
    }
    
    const post = db.data.posts[postIndex];
    
    // Check if user is the author or moderator
    const user = db.data.users.find(u => u.id === req.user.id);
    if (post.authorId !== req.user.id && user.role !== 'moderator') {
      return res.status(403).json({ msg: 'Access denied' });
    }
    
    db.data.posts.splice(postIndex, 1);
    await db.write();
    
    res.json({ msg: 'Post deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.toggleLike = async (req, res) => {
  const db = req.db;
  const { id } = req.params;
  
  try {
    await db.read();
    
    const postIndex = db.data.posts.findIndex(p => p.id === id);
    if (postIndex === -1) {
      return res.status(404).json({ msg: 'Post not found' });
    }
    
    const post = db.data.posts[postIndex];
    const userLikeIndex = post.likes.findIndex(like => like.userId === req.user.id);
    
    if (userLikeIndex > -1) {
      // Unlike
      post.likes.splice(userLikeIndex, 1);
    } else {
      // Like
      post.likes.push({
        userId: req.user.id,
        likedAt: new Date().toISOString()
      });
      
      // Update post author's stats safely
      const authorIndex = db.data.users.findIndex(u => u.id === post.authorId);
      if (authorIndex !== -1) {
        if (!db.data.users[authorIndex].activity) {
          db.data.users[authorIndex].activity = {
            postsCreated: 0,
            likesReceived: 0,
            commentsPosted: 0,
            fightsCreated: 0,
            votesGiven: 0
          };
        }
        db.data.users[authorIndex].activity.likesReceived += 1;
      }
    }
    
    await db.write();
    res.json({ 
      msg: userLikeIndex > -1 ? 'Post unliked' : 'Post liked',
      likesCount: post.likes.length,
      isLiked: userLikeIndex === -1
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.voteInPoll = async (req, res) => {
  const db = req.db;
  const { id } = req.params;
  const { optionIndex } = req.body;
  
  try {
    await db.read();
    
    const postIndex = db.data.posts.findIndex(p => p.id === id);
    if (postIndex === -1) {
      return res.status(404).json({ msg: 'Post not found' });
    }
    
    const post = db.data.posts[postIndex];
    
    // Check if post has a poll
    if (!post.poll || !post.poll.options) {
      return res.status(400).json({ msg: 'Post does not have a poll' });
    }
    
    // Check if option index is valid
    if (optionIndex < 0 || optionIndex >= post.poll.options.length) {
      return res.status(400).json({ msg: 'Invalid option index' });
    }
    
    // Initialize poll votes if not exists
    if (!post.poll.votes) {
      post.poll.votes = { voters: [] };
    }
    
    // Check if user already voted
    const existingVoteIndex = post.poll.votes.voters.findIndex(v => v.userId === req.user.id);
    if (existingVoteIndex > -1) {
      return res.status(400).json({ msg: 'User already voted in this poll' });
    }
    
    // Add vote
    post.poll.votes.voters.push({
      userId: req.user.id,
      optionIndex: optionIndex,
      votedAt: new Date().toISOString()
    });
    
    // Update user stats
    const userIndex = db.data.users.findIndex(u => u.id === req.user.id);
    if (userIndex !== -1) {
      if (!db.data.users[userIndex].activity) {
        db.data.users[userIndex].activity = {
          postsCreated: 0,
          likesReceived: 0,
          commentsPosted: 0,
          fightsCreated: 0,
          votesGiven: 0
        };
      }
      db.data.users[userIndex].activity.votesGiven += 1;
      db.data.users[userIndex].stats.experience += 5; // Award experience for voting
    }
    
    await db.write();
    
    // Return updated poll data
    const optionVotes = post.poll.votes.voters.filter(v => v.optionIndex === optionIndex).length;
    const totalVotes = post.poll.votes.voters.length;
    
    res.json({
      msg: 'Vote recorded successfully',
      optionVotes,
      totalVotes,
      votedOption: optionIndex
    });
  } catch (err) {
    console.error('Error voting in poll:', err.message);
    res.status(500).send('Server Error');
  }
};

exports.getOfficialFights = async (req, res) => {
  const db = req.db;
  const { limit = 10 } = req.query;
  
  try {
    console.log('Fetching official fights');
    await db.read();
    let posts = db.data.posts || [];
    
    // Filter only official fights
    let officialFights = posts.filter(post => 
      post.isOfficial && post.type === 'fight' && post.fight?.status === 'active'
    );
    
    // Sort by creation date (newest first)
    officialFights.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Limit results
    const limitedFights = officialFights.slice(0, parseInt(limit));
    
    // Add user info to posts
    const fightsWithUserInfo = limitedFights.map(post => {
      const author = db.data.users.find(u => u.id === post.authorId);
      return {
        ...post,
        author: author ? {
          id: author.id,
          username: author.username,
          profilePicture: author.profile?.profilePicture || '',
          rank: author.stats?.rank || 'Rookie'
        } : null
      };
    });
    
    console.log(`Returning ${fightsWithUserInfo.length} official fights`);
    res.json({
      fights: fightsWithUserInfo,
      totalFights: officialFights.length
    });
  } catch (err) {
    console.error('Error fetching official fights:', err.message);
    res.status(500).send('Server Error');
  }
};

exports.voteInFight = async (req, res) => {
  const db = req.db;
  const { id } = req.params;
  const { team } = req.body; // team: 'A' or 'B'
  
  try {
    await db.read();
    
    const postIndex = db.data.posts.findIndex(p => p.id === id);
    if (postIndex === -1) {
      return res.status(404).json({ msg: 'Post not found' });
    }
    
    const post = db.data.posts[postIndex];
    
    // Check if post is a fight post
    if (post.type !== 'fight' || !post.fight) {
      return res.status(400).json({ msg: 'Post is not a fight post' });
    }
    
    // Check if fight is locked
    if (post.fight.status === 'locked' || post.fight.status === 'completed') {
      return res.status(400).json({ msg: 'This fight has ended and is no longer accepting votes' });
    }
    
    // Check if lock time has passed
    if (post.fight.lockTime && new Date() > new Date(post.fight.lockTime)) {
      return res.status(400).json({ msg: 'This fight has exceeded the 72-hour voting period and is now locked' });
    }
    
    // Check if team is valid
    if (team !== 'A' && team !== 'B' && team !== 'draw') {
      return res.status(400).json({ msg: 'Invalid team choice' });
    }
    
    // Check if user already voted
    const existingVoteIndex = post.fight.votes.voters.findIndex(v => v.userId === req.user.id);
    if (existingVoteIndex > -1) {
      // User already voted, update their vote
      const prevTeam = post.fight.votes.voters[existingVoteIndex].team;
      // Decrement previous vote count
      if (prevTeam === 'A') post.fight.votes.teamA = Math.max(0, (post.fight.votes.teamA || 0) - 1);
      if (prevTeam === 'B') post.fight.votes.teamB = Math.max(0, (post.fight.votes.teamB || 0) - 1);
      if (prevTeam === 'draw') post.fight.votes.draw = Math.max(0, (post.fight.votes.draw || 0) - 1);
      // Update to new team
      post.fight.votes.voters[existingVoteIndex].team = team;
      post.fight.votes.voters[existingVoteIndex].votedAt = new Date().toISOString();
    } else {
      // Add vote
      post.fight.votes.voters.push({
        userId: req.user.id,
        team: team,
        votedAt: new Date().toISOString()
      });
    }
    // Increment new vote count
    if (team === 'A') post.fight.votes.teamA = (post.fight.votes.teamA || 0) + 1;
    if (team === 'B') post.fight.votes.teamB = (post.fight.votes.teamB || 0) + 1;
    if (team === 'draw') post.fight.votes.draw = (post.fight.votes.draw || 0) + 1;
    await db.write();
    res.json({ 
      msg: 'Vote recorded successfully',
      votes: post.fight.votes
    });
  } catch (err) {
    console.error('Error voting in fight:', err.message);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

exports.addReaction = async (req, res) => {
  const db = req.db;
  const { id } = req.params;
  const { reactionId, reactionIcon, reactionName } = req.body;
  
  try {
    await db.read();
    
    const postIndex = db.data.posts.findIndex(p => p.id === id);
    if (postIndex === -1) {
      return res.status(404).json({ msg: 'Post not found' });
    }
    
    const post = db.data.posts[postIndex];
    
    // Initialize reactions array if it doesn't exist
    if (!post.reactions) {
      post.reactions = [];
    }
    
    // Check if user already reacted
    const existingReactionIndex = post.reactions.findIndex(r => r.userId === req.user.id);
    if (existingReactionIndex > -1) {
      // Update existing reaction
      post.reactions[existingReactionIndex] = {
        userId: req.user.id,
        reactionId,
        reactionIcon,
        reactionName,
        reactedAt: new Date().toISOString()
      };
    } else {
      // Add new reaction
      post.reactions.push({
        userId: req.user.id,
        reactionId,
        reactionIcon,
        reactionName,
        reactedAt: new Date().toISOString()
      });
    }
    
    // Count reactions by type
    const reactionCounts = {};
    post.reactions.forEach(reaction => {
      const key = `${reaction.reactionIcon}-${reaction.reactionName}`;
      reactionCounts[key] = (reactionCounts[key] || 0) + 1;
    });
    
    // Convert to array format for frontend
    const reactionsArray = Object.entries(reactionCounts).map(([key, count]) => {
      const [icon, name] = key.split('-', 2);
      return { icon, name, count };
    });
    
    await db.write();
    
    res.json({ 
      msg: 'Reaction added successfully',
      reactions: reactionsArray
    });
  } catch (err) {
    console.error('Error adding reaction:', err.message);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};
