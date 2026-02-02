import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const usersFile = path.join(dataDir, 'users.json');

async function loadUsers() {
  try {
    const data = await fs.readFile(usersFile, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveUsers(users) {
  await fs.writeFile(usersFile, JSON.stringify(users, null, 2));
}

export const register = async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Wymagane: username, email, password' });
  }

  const users = await loadUsers();
  if (users.some(u => u.email === email || u.username === username)) {
    return res.status(400).json({ message: 'Taki użytkownik już istnieje' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const newUser = {
    id: uuidv4(),
    username,
    email,
    password: hashed,
    points: 0,
    collection: [], // start bez kart
    packs: { normal: 8, premium: 0 },
    currency: { gold: 1000, premium: 0 },
    decks: [],
    // System XP i levelowania
    xp: 0,
    level: 1,
    // Statystyki użytkownika
    stats: {
      gamesPlayed: 0,
      gamesWon: 0,
      gamesLost: 0,
      cardsPlayed: 0,
      damageDealt: 0,
      unitsDeployed: 0,
      commandsPlayed: 0
    },
    // Osiągnięcia
    achievements: [],
    // Ranking
    rank: {
      tier: 'Bronze',
      division: 9,
      points: 0
    },
    // Materiały do craftingu
    cardFragments: 0
  };

  users.push(newUser);
  await saveUsers(users);

  const token = jwt.sign({ id: newUser.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({
    user: {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      points: newUser.points
    },
    token
  });
};

export const login = async (req, res) => {
  const { email, username, password } = req.body;
  if ((!email && !username) || !password) {
    return res.status(400).json({ message: 'Wymagane: email lub username oraz hasło' });
  }

  const users = await loadUsers();
  const user = users.find(u =>
    email ? u.email === email : u.username === username
  );
  if (!user) {
    return res.status(401).json({ message: 'Nieprawidłowe dane' });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ message: 'Nieprawidłowe dane' });
  }

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      points: user.points
    },
    token
  });
};
