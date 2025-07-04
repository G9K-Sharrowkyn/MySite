const { v4: uuidv4 } = require('uuid');

exports.getAllPosts = async (req, res) => {
  const db = req.db;
  const { page = 1, limit = 10, sortBy = 'createdAt' } = req.query;
  
  try {
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
    
    res.json({
      posts: postsWithUserInfo,
      totalPosts: posts.length,
      currentPage: parseInt(page),
      totalPages: Math.ceil(posts.length / limit)
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
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
  const { title, content, type, teamA, teamB, image } = req.body;
  
  try {
    await db.read();
    
    const newPost = {
      id: uuidv4(),
      title,
      content,
      type: type || 'discussion', // discussion, fight, image, poll
      authorId: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      likes: [],
      comments: [],
      views: 0,
      image: image || null,
      fight: type === 'fight' ? {
        teamA: teamA || null,
        teamB: teamB || null,
        votes: {
          teamA: 0,
          teamB: 0,
          voters: []
        },
        status: 'active' // active, completed
      } : null
    };
    
    db.data.posts.push(newPost);
    
    // Update user stats
    const userIndex = db.data.users.findIndex(u => u.id === req.user.id);
    if (userIndex !== -1) {
      db.data.users[userIndex].activity.postsCreated += 1;
      db.data.users[userIndex].stats.experience += 10; // Award experience for posting
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
    console.error(err.message);
    res.status(500).send('Server Error');
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
      
      // Update post author's stats
      const authorIndex = db.data.users.findIndex(u => u.id === post.authorId);
      if (authorIndex !== -1) {
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