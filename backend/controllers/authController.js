const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid'); // Do generowania unikalnych ID

exports.register = async (req, res) => {
  const { username, email, password } = req.body;
  const db = req.db; // Dostęp do lowdb z obiektu request

  try {
    await db.read(); // Upewnij się, że dane są aktualne

    let user = db.data.users.find(u => u.email === email);
    if (user) {
      return res.status(400).json({ msg: 'Użytkownik o podanym adresie email już istnieje' });
    }

    user = db.data.users.find(u => u.username === username);
    if (user) {
      return res.status(400).json({ msg: 'Nazwa użytkownika jest już zajęta' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = {
      id: uuidv4(), // Generowanie unikalnego ID
      username,
      email,
      password: hashedPassword,
      role: 'user', // Domyślna rola dla nowego użytkownika
      profile: {
        bio: '',
        profilePicture: '',
        favoriteCharacters: [],
        joinDate: new Date().toISOString(),
        lastActive: new Date().toISOString()
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
      }
    };

    db.data.users.push(newUser);
    await db.write(); // Zapisz zmiany do pliku JSON

    const payload = {
      user: {
        id: newUser.id,
        role: newUser.role, // Dodaj rolę do payloadu JWT
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;
        res.json({ token, userId: newUser.id });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Błąd serwera');
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const db = req.db; // Dostęp do lowdb z obiektu request

  try {
    await db.read(); // Upewnij się, że dane są aktualne

    let user = db.data.users.find(u => u.email === email);
    if (!user) {
      return res.status(400).json({ msg: 'Nieprawidłowe dane uwierzytelniające' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Nieprawidłowe dane uwierzytelniające' });
    }

    const payload = {
      user: {
        id: user.id,
        role: user.role, // Dodaj rolę do payloadu JWT
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;
        res.json({ token, userId: user.id });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Błąd serwera');
  }
};
