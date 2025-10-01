import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const register = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'Użytkownik o podanym adresie email już istnieje' });
    }

    user = await User.findOne({ username });
    if (user) {
      return res.status(400).json({ msg: 'Nazwa użytkownika jest już zajęta' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role: 'user',
      profile: {
        bio: '',
        profilePicture: '',
        favoriteCharacters: [],
        joinDate: new Date(),
        lastActive: new Date()
      },
      stats: {
        fightsWon: 0,
        fightsLost: 0,
        fightsDrawn: 0,
        fightsNoContest: 0,
        totalFights: 0,
        winRate: 0,
        rank: 'Rookie',
        points: 0,
        level: 1,
        experience: 0
      },
      activity: {
        postsCreated: 0,
        commentsPosted: 0,
        likesReceived: 0,
        tournamentsWon: 0,
        tournamentsParticipated: 0
      },
      coins: {
        balance: 1000,
        totalEarned: 1000,
        totalSpent: 0,
        lastBonusDate: new Date()
      },
      achievements: [],
      divisions: new Map()
    });

    await newUser.save();

    const payload = {
      user: {
        id: newUser._id,
        role: newUser.role,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '24h' },
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          userId: newUser._id,
          user: {
            id: newUser._id,
            username: newUser.username,
            email: newUser.email,
            role: newUser.role,
            profile: newUser.profile
          }
        });
      }
    );
  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).json({ msg: 'Błąd serwera' });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user by email
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Nieprawidłowe dane uwierzytelniające' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Nieprawidłowe dane uwierzytelniające' });
    }

    // Update last active
    user.profile.lastActive = new Date();
    await user.save();

    const payload = {
      user: {
        id: user._id,
        role: user.role,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '24h' },
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          userId: user._id,
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            profile: user.profile,
            coins: user.coins
          }
        });
      }
    );
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ msg: 'Błąd serwera' });
  }
};
