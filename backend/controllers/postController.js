import { v4 as uuidv4 } from 'uuid';
import Post from '../models/Post.js';
import User from '../models/User.js';
import taggingService from '../services/taggingService.js';

export const getAllPosts = async (req, res) => {
  const { page = 1, limit = 10, sortBy = 'createdAt' } = req.query;
  try {
    const sortObj = sortBy === 'likes' ? { likes: -1 } : { createdAt: -1 };
    const posts = await Post.find()
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const totalPosts = await Post.countDocuments();
    // Populate author info
    const postsWithUserInfo = await Promise.all(posts.map(async post => {
      const author = await User.findById(post.authorId);
      return {
        ...post.toObject(),
        author: author ? {
          id: author._id,
          username: author.username,
          profilePicture: author.profile?.profilePicture || '',
          rank: author.stats?.rank || 'Rookie'
        } : null
      };
    }));
    res.json({
      posts: postsWithUserInfo,
      totalPosts,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalPosts / limit)
    });
  } catch (err) {
    console.error('Error fetching all posts from MongoDB:', err.message);
    res.status(500).send('Server Error');
  }
};

export const getPostsByUser = async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  try {
    const posts = await Post.find({ authorId: userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const totalPosts = await Post.countDocuments({ authorId: userId });

    // Populate author info
    const author = await User.findById(userId);
    const postsWithUserInfo = posts.map(post => ({
      ...post.toObject(),
      author: author ? {
        id: author._id,
        username: author.username,
        profilePicture: author.profile?.profilePicture || '',
        rank: author.stats?.rank || 'Rookie'
      } : null
    }));

    res.json({
      posts: postsWithUserInfo,
      totalPosts,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalPosts / limit)
    });
  } catch (err) {
    console.error('Error fetching user posts:', err.message);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

export const getPostById = async (req, res) => {
  const { id } = req.params;

  try {
    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }
    
    // Add author info
    const author = await User.findById(post.authorId);
    const postWithAuthor = {
      ...post.toObject(),
      author: author ? {
        id: author._id,
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

export const createPost = async (req, res) => {
  const { title, content, type, teamA, teamB, photos, pollOptions, isOfficial, moderatorCreated, category } = req.body;

  try {
    // Check if user is moderator for official fights
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (isOfficial && user.role !== 'moderator') {
      return res.status(403).json({ message: 'Only moderators can create official fights' });
    }

    const postData = {
      title,
      content,
      type: type || 'discussion', // discussion, fight, other
      authorId: req.user.id,
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

      postData.fight = {
        teamA: teamA || null,
        teamB: teamB || null,
        votes: {
          teamA: 0,
          teamB: 0,
          voters: []
        },
        status: 'active', // active, completed, locked
        isOfficial: isOfficial || false,
        lockTime: lockTime, // When the fight will be locked
        winner: null, // Will be set when fight is locked
        winnerTeam: null // 'teamA', 'teamB', or 'draw'
      };
      // For fight posts, pollOptions are mandatory and correspond to teamA and teamB
      postData.poll = {
        options: [teamA, teamB],
        votes: {
          voters: []
        }
      };
    } else if (type === 'other' && pollOptions && pollOptions.some(opt => opt.trim() !== '')) {
      // For other posts, optional poll
      postData.poll = {
        options: pollOptions.filter(opt => opt.trim() !== ''),
        votes: {
          voters: []
        }
      };
    }

    // Create post in MongoDB
    const newPost = await Post.create(postData);

    // Automatyczne tagowanie posta
    try {
      const taggingResult = await taggingService.autoTagPost(newPost.toObject());
      newPost.tags = taggingResult.tags;
      newPost.autoTags = taggingResult.autoTags;
      await newPost.save();

      // Aktualizuj statystyki tagów
      await taggingService.updateTagStats(taggingResult.tags);
    } catch (tagError) {
      console.error('Error auto-tagging post:', tagError);
      // Kontynuuj bez tagowania jeśli wystąpi błąd
    }

    // Add author info to response
    const postWithAuthor = {
      ...newPost.toObject(),
      author: {
        id: user._id,
        username: user.username,
        profilePicture: user.profile?.profilePicture || '',
        rank: user.stats?.rank || 'Rookie'
      }
    };

    res.status(201).json(postWithAuthor);
  } catch (err) {
    console.error('Error creating post:', err.message);
    res.status(500).send('Server Error');
  }
};

export const updatePost = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }

    // Check if user is the author or moderator
    const user = await User.findById(req.user.id);
    if (post.authorId.toString() !== req.user.id && user.role !== 'moderator') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    // Update post
    Object.assign(post, updates);
    post.updatedAt = new Date();
    await post.save();

    res.json(post.toObject());
  } catch (err) {
    console.error('Error updating post:', err.message);
    res.status(500).send('Server Error');
  }
};

export const deletePost = async (req, res) => {
  const { id } = req.params;

  try {
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }

    // Check if user is the author or moderator
    const user = await User.findById(req.user.id);
    if (post.authorId.toString() !== req.user.id && user.role !== 'moderator') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    await Post.findByIdAndDelete(id);

    res.json({ msg: 'Post deleted successfully' });
  } catch (err) {
    console.error('Error deleting post:', err.message);
    res.status(500).send('Server Error');
  }
};

export const toggleLike = async (req, res) => {
  const { id } = req.params;

  try {
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }

    const userLikeIndex = post.likes.findIndex(like => like.userId === req.user.id);
    const wasLiked = userLikeIndex > -1;

    if (wasLiked) {
      // Unlike
      post.likes.splice(userLikeIndex, 1);
    } else {
      // Like
      post.likes.push({
        userId: req.user.id,
        likedAt: new Date()
      });

      // Update post author's stats
      const author = await User.findById(post.authorId);
      if (author) {
        if (!author.activity) {
          author.activity = {
            postsCreated: 0,
            likesReceived: 0,
            commentsPosted: 0,
            fightsCreated: 0,
            votesGiven: 0
          };
        }
        author.activity.likesReceived += 1;
        await author.save();
      }
    }

    await post.save();

    res.json({
      msg: wasLiked ? 'Post unliked' : 'Post liked',
      likesCount: post.likes.length,
      isLiked: !wasLiked
    });
  } catch (err) {
    console.error('Error toggling like:', err.message);
    res.status(500).send('Server Error');
  }
};

export const voteInPoll = async (req, res) => {
  const { id } = req.params;
  const { optionIndex } = req.body;

  try {
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }

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
      votedAt: new Date()
    });

    await post.save();

    // Update user stats
    const user = await User.findById(req.user.id);
    if (user) {
      if (!user.activity) {
        user.activity = {
          postsCreated: 0,
          likesReceived: 0,
          commentsPosted: 0,
          fightsCreated: 0,
          votesGiven: 0
        };
      }
      user.activity.votesGiven += 1;
      user.stats.experience = (user.stats.experience || 0) + 5; // Award experience for voting
      await user.save();
    }

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

export const getOfficialFights = async (req, res) => {
  const { limit = 10 } = req.query;

  try {
    console.log('Fetching official fights');

    // Filter only official fights
    const officialFights = await Post.find({
      isOfficial: true,
      type: 'fight',
      'fight.status': 'active'
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const totalFights = await Post.countDocuments({
      isOfficial: true,
      type: 'fight',
      'fight.status': 'active'
    });

    // Add user info to posts
    const fightsWithUserInfo = await Promise.all(
      officialFights.map(async post => {
        const author = await User.findById(post.authorId);
        return {
          ...post.toObject(),
          author: author ? {
            id: author._id,
            username: author.username,
            profilePicture: author.profile?.profilePicture || '',
            rank: author.stats?.rank || 'Rookie'
          } : null
        };
      })
    );

    console.log(`Returning ${fightsWithUserInfo.length} official fights`);
    res.json({
      fights: fightsWithUserInfo,
      totalFights
    });
  } catch (err) {
    console.error('Error fetching official fights:', err.message);
    res.status(500).send('Server Error');
  }
};

export const voteInFight = async (req, res) => {
  const { id } = req.params;
  const { team } = req.body; // team: 'A' or 'B'

  try {
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }

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
      post.fight.votes.voters[existingVoteIndex].votedAt = new Date();
    } else {
      // Add vote
      post.fight.votes.voters.push({
        userId: req.user.id,
        team: team,
        votedAt: new Date()
      });
    }
    // Increment new vote count
    if (team === 'A') post.fight.votes.teamA = (post.fight.votes.teamA || 0) + 1;
    if (team === 'B') post.fight.votes.teamB = (post.fight.votes.teamB || 0) + 1;
    if (team === 'draw') post.fight.votes.draw = (post.fight.votes.draw || 0) + 1;

    await post.save();

    res.json({
      msg: 'Vote recorded successfully',
      votes: post.fight.votes
    });
  } catch (err) {
    console.error('Error voting in fight:', err.message);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

export const addReaction = async (req, res) => {
  const { id } = req.params;
  const { reactionId, reactionIcon, reactionName } = req.body;

  try {
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ msg: 'Post not found' });
    }

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
        reactedAt: new Date()
      };
    } else {
      // Add new reaction
      post.reactions.push({
        userId: req.user.id,
        reactionId,
        reactionIcon,
        reactionName,
        reactedAt: new Date()
      });
    }

    await post.save();

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

    res.json({
      msg: 'Reaction added successfully',
      reactions: reactionsArray
    });
  } catch (err) {
    console.error('Error adding reaction:', err.message);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};
