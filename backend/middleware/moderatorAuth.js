import User from '../models/User.js';

const moderatorAuth = async (req, res, next) => {
  try {
    // Sprawdź czy użytkownik jest już uwierzytelniony przez middleware auth
    if (!req.user || !req.user.id) {
      return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    // Pobierz użytkownika z bazy danych
    const user = await User.findById(req.user.id).select('role');
    
    if (!user) {
      return res.status(401).json({ msg: 'User not found' });
    }

    // Sprawdź czy użytkownik ma rolę moderatora
    if (user.role !== 'moderator') {
      return res.status(403).json({ msg: 'Access denied. Moderator role required.' });
    }

    next();
  } catch (error) {
    console.error('Moderator auth middleware error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

export default moderatorAuth;