import jwt from 'jsonwebtoken';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { usersRepo } from '../../repositories/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const usersFile = path.join(dataDir, 'users.json');

const resolveUserId = (user) => user?.id || user?._id;

const createCcgProfile = (mainUser) => ({
  id: resolveUserId(mainUser),
  username: mainUser.username,
  email: mainUser.email,
  points: 0,
  collection: [],
  packs: { normal: 8, premium: 0 },
  currency: { gold: 1000, premium: 0 },
  decks: [],
  xp: 0,
  level: 1,
  stats: {
    gamesPlayed: 0,
    gamesWon: 0,
    gamesLost: 0,
    cardsPlayed: 0,
    damageDealt: 0,
    unitsDeployed: 0,
    commandsPlayed: 0
  },
  achievements: [],
  rank: {
    tier: 'Bronze',
    division: 9,
    points: 0
  },
  cardFragments: 0
});

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

export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const bearer = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;
  const token = bearer || req.header('x-auth-token');
  if (!token) {
    return res.status(401).json({ message: 'Brak tokena' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = resolveUserId(decoded?.user) || decoded?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Nieprawidłowy token' });
    }

    const mainUser = await usersRepo.findOne(
      (entry) => resolveUserId(entry) === userId
    );
    if (!mainUser) {
      return res.status(401).json({ message: 'Nieprawidłowy token' });
    }

    const users = await loadUsers();
    let ccgUser = users.find((entry) => entry.id === userId);
    if (!ccgUser) {
      ccgUser = createCcgProfile(mainUser);
      users.push(ccgUser);
      await saveUsers(users);
    } else if (ccgUser.username !== mainUser.username || ccgUser.email !== mainUser.email) {
      ccgUser.username = mainUser.username;
      ccgUser.email = mainUser.email;
      await saveUsers(users);
    }

    req.user = { id: userId, username: ccgUser.username, email: ccgUser.email };
    next();
  } catch (error) {
    res.status(401).json({ message: 'Nieprawidłowy token' });
  }
};
